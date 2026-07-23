import { FastifyInstance } from 'fastify'
import { PaymentsRepository } from './payments.repository.js'
import type { CreditablePayment } from './credit-payment.js'

/**
 * Fulfillment de um pagamento de Cestinha (mini market "Além do Pãozin"). Confirma o
 * `MarketOrder` vinculado ao pagamento (PENDING_PAYMENT → SCHEDULED, entrando na esteira de
 * entrega) e marca o Payment como PAID. **Não credita saldo** — o crédito já foi debitado no
 * checkout; este pagamento cobre apenas a parte em dinheiro.
 *
 * Ponto único chamado pelo `creditForPayment` (ramo MARKET), portanto compartilhado por
 * webhook Stripe, webhook Mercado Pago e reconciliação por pull. O vínculo é por
 * `MarketOrder.paymentId` (gravado na criação do pagamento).
 *
 * Idempotente: só transiciona a partir de PENDING_PAYMENT; marca PAID sempre ao final.
 */
export async function fulfillMarketOrder(
  fastify: FastifyInstance,
  payment: CreditablePayment,
): Promise<void> {
  const order = await fastify.prisma.marketOrder.findFirst({ where: { paymentId: payment.id } })

  if (order && order.status === 'PENDING_PAYMENT') {
    await fastify.prisma.marketOrder.update({
      where: { id: order.id },
      data: { status: 'SCHEDULED' },
    })
  }

  await new PaymentsRepository(fastify).updatePaymentStatus(payment.id, 'PAID')
}
