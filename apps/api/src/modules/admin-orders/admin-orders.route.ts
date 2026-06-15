import { FastifyPluginAsync } from 'fastify'
import { AdminOrdersController } from './admin-orders.controller.js'

/**
 * adminOrdersRoute — registra rotas de gestão de pedidos pelo Admin.
 *
 * T-05-01: preHandler: [fastify.authenticate] garante JWT válido.
 * O role check (ADMIN only) fica no controller (per D-11).
 *
 * Rota registrada:
 *   PATCH /admin/orders/:id/status — transição de status pelo Admin
 */
export const adminOrdersRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminOrdersController(fastify)

  fastify.patch(
    '/admin/orders/:id/status',
    { preHandler: [fastify.authenticate] },
    ctrl.updateOrderStatus.bind(ctrl),
  )
}
