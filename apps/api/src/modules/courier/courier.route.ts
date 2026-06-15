import { FastifyPluginAsync } from 'fastify'
import { CourierController } from './courier.controller.js'

/**
 * courierRoute — registra rotas do entregador.
 *
 * T-06-02: preHandler [fastify.authenticate, fastify.requireCourier] em AMBAS as rotas:
 * - fastify.authenticate: valida JWT e popula request.user
 * - fastify.requireCourier: bloqueia roles != COURIER com 403
 *
 * D-12: Rotas do modulo courier.
 */
export const courierRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new CourierController(fastify)

  // GET /courier/orders/today — lista ordens do dia para o entregador logado
  fastify.get(
    '/courier/orders/today',
    { preHandler: [fastify.authenticate, fastify.requireCourier] },
    ctrl.getTodayOrders.bind(ctrl),
  )

  // PATCH /courier/orders/:id/confirm — confirma entrega de um pedido
  fastify.patch(
    '/courier/orders/:id/confirm',
    { preHandler: [fastify.authenticate, fastify.requireCourier] },
    ctrl.confirmDelivery.bind(ctrl),
  )
}
