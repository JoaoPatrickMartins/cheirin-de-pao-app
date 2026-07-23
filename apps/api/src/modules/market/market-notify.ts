import { FastifyInstance } from 'fastify'
import { NotificationType } from '@prisma/client'
import { NotificationsService } from '../notifications/notifications.service.js'

/**
 * Notifica o cliente que a Cestinha ("Além do Pãozin") foi entregue (MKT-35 — só DELIVERED no
 * v1, paridade com o pão). Reusa o tipo `DELIVERY_DONE` com texto/rota próprios do market.
 * Best-effort: nunca interrompe a transição de status.
 */
export async function notifyMarketDelivered(fastify: FastifyInstance, userId: string): Promise<void> {
  try {
    await new NotificationsService(fastify).notifyUser(userId, {
      type: NotificationType.DELIVERY_DONE,
      title: 'Sua Cestinha chegou! 🧺',
      body: 'Os itens do Além do Pãozin foram entregues junto com o seu pão. Bom apetite!',
      actionRoute: '/client/pedidos',
    })
  } catch (err) {
    fastify.log.warn({ err, userId }, '[market] falha ao notificar entrega da Cestinha — ignorado')
  }
}
