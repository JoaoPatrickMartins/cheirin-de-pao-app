import { FastifyInstance } from 'fastify'
import { notifyAdminMarketOrderPlaced } from '../market/market-notify.js'
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
 *
 * Onda F (F4): é aqui — e não no checkout — que os admins são avisados da Cestinha nova. Antes da
 * confirmação o pedido pode morrer no sweep sem nunca entrar na operação, então avisar no checkout
 * enfileiraria pedidos inexistentes. O aviso sai **só para quem ganhou o claim** da transição.
 */
export async function fulfillMarketOrder(
  fastify: FastifyInstance,
  payment: CreditablePayment,
): Promise<void> {
  const order = await fastify.prisma.marketOrder.findFirst({ where: { paymentId: payment.id } })

  if (order && order.status === 'PENDING_PAYMENT') {
    // `updateMany` guardado pelo status (em vez de `update`) porque webhook Stripe, webhook
    // Mercado Pago e o pull de reconciliação podem chegar juntos ao mesmo pagamento: os três
    // leriam PENDING_PAYMENT e os três avisariam o admin. Aqui só um conta.
    const claimed = await fastify.prisma.marketOrder.updateMany({
      where: { id: order.id, status: 'PENDING_PAYMENT' },
      data: { status: 'SCHEDULED' },
    })
    if (claimed.count > 0) await notifyAdminMarketOrderPlaced(fastify, order)
  }

  await new PaymentsRepository(fastify).updatePaymentStatus(payment.id, 'PAID')
}
