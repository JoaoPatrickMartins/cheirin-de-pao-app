import { FastifyInstance } from 'fastify'
import type Stripe from 'stripe'
import { PaymentsRepository } from '../payments/payments.repository.js'
import { StripeService } from '../payments/stripe.service.js'
import { MercadoPagoPixService } from '../payments/mercadopago-pix.service.js'
import { creditForPayment } from '../payments/credit-payment.js'

export class WebhooksService {
  private repo: PaymentsRepository
  private stripe: StripeService
  private mp: MercadoPagoPixService

  constructor(private fastify: FastifyInstance) {
    this.repo = new PaymentsRepository(fastify)
    this.stripe = new StripeService(fastify)
    this.mp = new MercadoPagoPixService(fastify)
  }

  // Valida a assinatura do Stripe e desserializa o evento a partir do corpo CRU.
  constructEvent(rawBody: Buffer | string, signature: string): Stripe.Event {
    return this.stripe.constructWebhookEvent(rawBody, signature)
  }

  /**
   * Processa eventos do Stripe (agora só CARTÃO — o Pix migrou para o Mercado Pago).
   * - payment_intent.succeeded       → credita (idempotente) e marca PAID
   * - payment_intent.payment_failed  → marca FAILED
   * - charge.refunded                → marca REFUNDED
   * Demais eventos são ignorados (200 para o Stripe não retentar).
   */
  async processEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        await this.creditFromPaymentIntent(pi.id)
        break
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        const payment = await this.repo.findPaymentByStripePaymentIntentId(pi.id)
        if (payment && payment.status === 'PENDING') {
          await this.repo.updatePaymentStatus(payment.id, 'FAILED')
        }
        break
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const piId =
          typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id
        if (piId) {
          const payment = await this.repo.findPaymentByStripePaymentIntentId(piId)
          if (payment && payment.status !== 'REFUNDED') {
            await this.repo.updatePaymentStatus(payment.id, 'REFUNDED')
          }
        }
        break
      }
      default:
        break
    }
  }

  /**
   * Processa a notificação de pagamento do Mercado Pago (Pix). O webhook só informa o id;
   * é preciso consultar o pagamento no MP para saber o status atual. Idempotente.
   */
  async processMercadoPagoPayment(mpId: string): Promise<void> {
    const mpPayment = await this.mp.getPayment(mpId)
    const status = mpPayment.status
    if (status === 'approved') {
      await this.creditFromMercadoPago(mpId)
    } else if (status === 'rejected' || status === 'cancelled') {
      const payment = await this.repo.findPaymentByMercadoPagoId(mpId)
      if (payment && payment.status === 'PENDING') {
        await this.repo.updatePaymentStatus(payment.id, 'FAILED')
      }
    }
  }

  // Crédito por id do PaymentIntent do Stripe (cartão). Delegado ao ponto único.
  private async creditFromPaymentIntent(paymentIntentId: string): Promise<void> {
    const payment = await this.repo.findPaymentByStripePaymentIntentId(paymentIntentId)
    await creditForPayment(this.fastify, payment)
  }

  // Crédito por id do pagamento do Mercado Pago (Pix). Delegado ao ponto único.
  async creditFromMercadoPago(mpId: string): Promise<void> {
    const payment = await this.repo.findPaymentByMercadoPagoId(mpId)
    await creditForPayment(this.fastify, payment)
  }
}
