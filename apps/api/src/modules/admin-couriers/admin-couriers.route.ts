import { FastifyPluginAsync } from 'fastify'
import { AdminCouriersController } from './admin-couriers.controller.js'

/**
 * adminCouriersRoute — registra rotas de gestão de entregadores pelo Admin.
 *
 * T-07-03-01: preHandler: [fastify.authenticate] garante JWT válido.
 * O role check (ADMIN only) fica no controller.
 *
 * Rotas registradas:
 *   GET  /admin/couriers              — lista entregadores
 *   POST /admin/couriers              — cadastra entregador
 *   PATCH /admin/couriers/:id/toggle  — ativa/desativa entregador (isBlocked)
 *   PATCH /admin/couriers/:id         — atualiza dados (sem cpf)
 */
export const adminCouriersRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminCouriersController(fastify)

  fastify.get(
    '/admin/couriers',
    { preHandler: [fastify.authenticate] },
    ctrl.list.bind(ctrl),
  )

  fastify.post(
    '/admin/couriers',
    { preHandler: [fastify.authenticate] },
    ctrl.create.bind(ctrl),
  )

  fastify.patch(
    '/admin/couriers/:id/toggle',
    { preHandler: [fastify.authenticate] },
    ctrl.toggle.bind(ctrl),
  )

  fastify.patch(
    '/admin/couriers/:id',
    { preHandler: [fastify.authenticate] },
    ctrl.updateCourier.bind(ctrl),
  )
}
