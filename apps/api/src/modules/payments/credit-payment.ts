import { FastifyInstance } from 'fastify'
import { PaymentsRepository } from './payments.repository.js'
import { notifyAdminsCreditPurchase } from './notify-credit-purchase.js'

/** Registro mínimo de Payment necessário para creditar. */
export interface CreditablePayment {
  id: string
  userId: string
  amount: number
  status: string
  comboId: string | null
  customQuantity: number | null
}

/**
 * Credita o cliente a partir de um registro de Payment — ÚNICO ponto de crédito,
 * compartilhado por Stripe (webhook), Mercado Pago (webhook) e reconciliação por pull.
 *
 * Idempotente: se o pagamento já está PAID, não faz nada (protege contra crédito em
 * dobro quando webhook e pull coincidem, ou o webhook chega duas vezes).
 */
export async function creditForPayment(
  fastify: FastifyInstance,
  payment: CreditablePayment | null,
): Promise<void> {
  if (!payment) return
  if (payment.status === 'PAID') return

  let quantity = payment.customQuantity ?? null
  if (quantity == null && payment.comboId) {
    const combo = await fastify.prisma.combo.findUnique({ where: { id: payment.comboId } })
    quantity = combo?.quantity ?? null
  }
  if (!quantity) return

  const repo = new PaymentsRepository(fastify)
  await repo.creditUserBalance(payment.userId, quantity, payment.id)
  await repo.updatePaymentStatus(payment.id, 'PAID')
  await notifyAdminsCreditPurchase(fastify, { userId: payment.userId, quantity, amount: payment.amount })
}
