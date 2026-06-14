import { FastifyInstance } from 'fastify'
import { createHmac } from 'node:crypto'
import { PaymentsRepository } from '../payments/payments.repository.js'

export interface WebhookBody {
  action: string
  data: { id: string }
}

export class WebhooksService {
  private repo: PaymentsRepository

  constructor(private fastify: FastifyInstance) {
    this.repo = new PaymentsRepository(fastify)
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

  async processApprovedPayment(mpPaymentId: string): Promise<void> {
    const payment = await this.repo.findPaymentByMercadoPagoId(mpPaymentId)
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

  async processPayment(body: WebhookBody): Promise<void> {
    if (body.action !== 'payment.updated') return
    if (!body.data?.id) return
    await this.processApprovedPayment(body.data.id)
  }
}
