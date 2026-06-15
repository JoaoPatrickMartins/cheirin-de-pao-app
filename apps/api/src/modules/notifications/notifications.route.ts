import { FastifyPluginAsync } from 'fastify'
import { NotificationsController } from './notifications.controller.js'

/**
 * notificationsRoute — registra rotas de notificações push.
 *
 * T-04-03-05: preHandler: fastify.authenticate garante que apenas usuários
 * autenticados registram seu player_id. userId extraído do JWT no controller.
 */
export const notificationsRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new NotificationsController(fastify)

  fastify.post(
    '/users/push-token',
    { preHandler: [fastify.authenticate] },
    ctrl.savePushToken.bind(ctrl),
  )
}
