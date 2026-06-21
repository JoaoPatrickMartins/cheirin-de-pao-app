import { FastifyInstance } from 'fastify'
import type Stripe from 'stripe'
import { PaymentsRepository } from '../payments/payments.repository.js'
import { StripeService } from '../payments/stripe.service.js'

export class WebhooksService {
  private repo: PaymentsRepository
  private stripe: StripeService

  constructor(private fastify: FastifyInstance) {
    this.repo = new PaymentsRepository(fastify)
    this.stripe = new StripeService(fastify)
  }

  // Valida a assinatura do Stripe e desserializa o evento a partir do corpo CRU.
  constructEvent(rawBody: Buffer | string, signature: string): Stripe.Event {
    return this.stripe.constructWebhookEvent(rawBody, signature)
  }

  /**
   * Processa eventos do Stripe.
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

  // Idempotente: se já está PAID, não credita de novo (protege contra duplicidade
  // entre o crédito síncrono do off_session e este webhook).
  private async creditFromPaymentIntent(paymentIntentId: string): Promise<void> {
    const payment = await this.repo.findPaymentByStripePaymentIntentId(paymentIntentId)
    if (!payment) return
    if (payment.status === 'PAID') return

    const quantity = payment.customQuantity ?? (await this.getComboQuantity(payment.comboId))
    if (!quantity) return

    await this.repo.creditUserBalance(payment.userId, quantity, payment.id)
    await this.repo.updatePaymentStatus(payment.id, 'PAID')
  }

  private async getComboQuantity(comboId: string | null): Promise<number | null> {
    if (!comboId) return null
    const combo = await this.fastify.prisma.combo.findUnique({ where: { id: comboId } })
    return combo?.quantity ?? null
  }
}
