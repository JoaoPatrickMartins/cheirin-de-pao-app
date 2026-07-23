import { FastifyInstance } from 'fastify'
import { NotificationType } from '@prisma/client'
import { PaymentsRepository } from './payments.repository.js'
import { notifyAdminsCreditPurchase } from './notify-credit-purchase.js'
import { fulfillMarketOrder } from './fulfill-market-order.js'
import { NotificationsService } from '../notifications/notifications.service.js'

/** Registro mínimo de Payment necessário para creditar/fulfillar. */
export interface CreditablePayment {
  id: string
  userId: string
  amount: number
  status: string
  comboId: string | null
  customQuantity: number | null
  purpose?: string | null
}

/**
 * Credita o cliente a partir de um registro de Payment — ÚNICO ponto de fulfillment,
 * compartilhado por Stripe (webhook), Mercado Pago (webhook) e reconciliação por pull.
 *
 * Idempotente: se o pagamento já está PAID, não faz nada (protege contra crédito em
 * dobro quando webhook e pull coincidem, ou o webhook chega duas vezes).
 *
 * Ramo `purpose === 'HOOK'`: pagamento de um gancho adicional — NÃO credita pães; marca
 * o HookRequest vinculado como REQUESTED (entra na fila de entrega do admin).
 */
export async function creditForPayment(
  fastify: FastifyInstance,
  payment: CreditablePayment | null,
): Promise<void> {
  if (!payment) return
  if (payment.status === 'PAID') return

  if (payment.purpose === 'HOOK') {
    await fulfillHookPayment(fastify, payment)
    return
  }

  // Cestinha (mini market): confirma o MarketOrder vinculado; NÃO credita pães.
  if (payment.purpose === 'MARKET') {
    await fulfillMarketOrder(fastify, payment)
    return
  }

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

/**
 * Fulfillment de um pagamento de gancho adicional (Pix). Coloca o HookRequest vinculado
 * na fila do admin (PENDING_PAYMENT → REQUESTED) e avisa os admins. Sempre marca o
 * Payment como PAID ao final — garante que o registro não fique preso em PENDING mesmo
 * se o HookRequest já tiver sido promovido por uma chamada anterior (idempotente).
 */
async function fulfillHookPayment(fastify: FastifyInstance, payment: CreditablePayment): Promise<void> {
  const repo = new PaymentsRepository(fastify)
  const hook = await fastify.prisma.hookRequest.findFirst({ where: { paymentId: payment.id } })

  // Só na transição PENDING_PAYMENT → REQUESTED: promove e notifica (não re-notifica).
  if (hook && hook.status === 'PENDING_PAYMENT') {
    await fastify.prisma.hookRequest.update({
      where: { id: hook.id },
      data: { status: 'REQUESTED', requestedAt: new Date() },
    })

    try {
      const user = await fastify.prisma.user.findUnique({
        where: { id: payment.userId },
        select: { name: true, apartment: true, block: true },
      })
      const loc = [user?.block, user?.apartment].filter(Boolean).join(' ')
      await new NotificationsService(fastify).notifyAdmins({
        type: NotificationType.ADMIN_HOOK_REQUESTED,
        title: 'Gancho adicional (pago)',
        body: `${user?.name ?? 'Cliente'}${loc ? ` · Apto ${loc}` : ''} pagou um gancho adicional.`,
        actionRoute: '/admin',
      })
    } catch (err) {
      fastify.log.warn({ err }, '[hook] falha ao notificar admin (gancho pago) — ignorado')
    }
  }

  await repo.updatePaymentStatus(payment.id, 'PAID')
}
