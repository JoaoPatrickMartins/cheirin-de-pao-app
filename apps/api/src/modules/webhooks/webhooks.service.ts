import { FastifyInstance } from 'fastify'
import { createHmac } from 'node:crypto'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { PaymentsRepository } from '../payments/payments.repository.js'

export interface WebhookBody {
  action: string
  data: { id: string }
}

export class WebhooksService {
  private repo: PaymentsRepository
  private paymentApi: Payment

  constructor(private fastify: FastifyInstance) {
    this.repo = new PaymentsRepository(fastify)
    const client = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN!,
      options: { timeout: 5000 },
    })
    this.paymentApi = new Payment(client)
  }

  validateSignature(xSignature: string, xRequestId: string, dataId: string): boolean {
    if (!xSignature) return false
    const secret = process.env.MP_WEBHOOK_SECRET
    if (!secret) return false
    try {
      const parts = Object.fromEntries(
        xSignature.split(',').map((p) => {
          const idx = p.indexOf('=')
          return [p.slice(0, idx), p.slice(idx + 1)]
        }),
      )
      const { ts, v1 } = parts
      if (!ts || !v1) return false
      const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
      const computed = createHmac('sha256', secret).update(manifest).digest('hex')
      return computed === v1
    } catch {
      return false
    }
  }

  /**
   * Reconcilia um pagamento a partir do ID do Mercado Pago.
   *
   * CRÍTICO: consulta o status REAL no MP antes de creditar. O webhook
   * payment.created/updated dispara para QUALQUER status (rejeitado, cancelado,
   * pendente, etc.) — creditar sem confirmar geraria crédito indevido.
   *
   * - approved              → credita e marca PAID
   * - rejected | cancelled  → marca FAILED (não credita)
   * - demais (pending/...)  → mantém PENDING (aguarda próxima notificação)
   *
   * Idempotente: se o pagamento local já está PAID, não consulta o MP nem credita.
   */
  async reconcilePayment(mpPaymentId: string): Promise<void> {
    const payment = await this.repo.findPaymentByMercadoPagoId(mpPaymentId)
    if (!payment) return
    if (payment.status === 'PAID') return

    const mpStatus = await this.fetchMercadoPagoStatus(mpPaymentId)

    if (mpStatus === 'approved') {
      const quantity = payment.customQuantity ?? (await this.getComboQuantity(payment.comboId))
      if (!quantity) return
      await this.repo.creditUserBalance(payment.userId, quantity, payment.id)
      await this.repo.updatePaymentStatus(payment.id, 'PAID')
      return
    }

    if (mpStatus === 'rejected' || mpStatus === 'cancelled') {
      await this.repo.updatePaymentStatus(payment.id, 'FAILED')
    }
  }

  private async fetchMercadoPagoStatus(mpPaymentId: string): Promise<string | undefined> {
    const mpPayment = await this.paymentApi.get({ id: mpPaymentId })
    return (mpPayment as { status?: string }).status
  }

  private async getComboQuantity(comboId: string | null): Promise<number | null> {
    if (!comboId) return null
    const combo = await this.fastify.prisma.combo.findUnique({ where: { id: comboId } })
    return combo?.quantity ?? null
  }

  async processPayment(body: WebhookBody): Promise<void> {
    if (body.action !== 'payment.created' && body.action !== 'payment.updated') return
    if (!body.data?.id) return
    await this.reconcilePayment(body.data.id)
  }
}
