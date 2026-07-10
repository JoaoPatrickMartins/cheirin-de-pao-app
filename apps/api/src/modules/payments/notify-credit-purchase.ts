import type { FastifyInstance } from 'fastify'
import { NotificationType } from '@prisma/client'
import { NotificationsService } from '../notifications/notifications.service.js'

/**
 * Notifica os admins de uma compra de créditos confirmada (best-effort).
 *
 * Chamado nos dois chokepoints de crédito (webhook do Stripe e cobrança síncrona
 * off_session) — ambos guardados por idempotência de status, então dispara 1× por pagamento.
 */
export async function notifyAdminsCreditPurchase(
  fastify: FastifyInstance,
  args: { userId: string; quantity: number; amount: number },
): Promise<void> {
  try {
    const user = await fastify.prisma.user.findUnique({
      where: { id: args.userId },
      select: { name: true },
    })
    const paes = args.quantity === 1 ? '1 pão' : `${args.quantity} pães`
    const valor = `R$ ${args.amount.toFixed(2).replace('.', ',')}`
    await new NotificationsService(fastify).notifyAdmins({
      type: NotificationType.ADMIN_CREDIT_PURCHASED,
      title: 'Compra de créditos',
      body: `${user?.name ?? 'Cliente'} comprou ${paes} · ${valor}`,
      actionRoute: '/admin',
    })
  } catch (err) {
    fastify.log.warn({ err }, '[payments] falha ao notificar admin (compra) — ignorado')
  }
}
