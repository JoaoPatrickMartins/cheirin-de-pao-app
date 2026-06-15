import { FastifyPluginAsync } from 'fastify'
import { OrdersController } from './orders.controller.js'

/**
 * ordersRoute — registra rotas de pedidos avulsos.
 *
 * T-04-03-01: preHandler: fastify.authenticate garante que apenas usuários
 * autenticados acessam a rota. userId extraído do JWT no controller.
 */
export const ordersRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new OrdersController(fastify)

  fastify.post(
    '/orders',
    { preHandler: [fastify.authenticate] },
    ctrl.createSingleOrder.bind(ctrl),
  )

  fastify.get(
    '/orders/today',
    { preHandler: [fastify.authenticate] },
    ctrl.getTodayOrder.bind(ctrl),
  )

  fastify.get(
    '/orders/history',
    { preHandler: [fastify.authenticate] },
    ctrl.getOrderHistory.bind(ctrl),
  )
}
