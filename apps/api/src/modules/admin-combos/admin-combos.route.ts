import { FastifyPluginAsync } from 'fastify'
import { AdminCombosController } from './admin-combos.controller.js'

/**
 * adminCombosRoute — rotas CRUD de combos + toggle de promoções para o admin.
 *
 * T-07-02-05: preHandler: [fastify.authenticate] garante JWT válido em todas as rotas.
 * T-07-02-01: Role check ADMIN fica inline no controller (per D-11).
 */
export const adminCombosRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminCombosController(fastify)

  fastify.get(
    '/admin/combos',
    { preHandler: [fastify.authenticate] },
    ctrl.list.bind(ctrl),
  )

  fastify.post(
    '/admin/combos',
    { preHandler: [fastify.authenticate] },
    ctrl.create.bind(ctrl),
  )

  fastify.patch(
    '/admin/combos/:id',
    { preHandler: [fastify.authenticate] },
    ctrl.update.bind(ctrl),
  )

  fastify.delete(
    '/admin/combos/:id',
    { preHandler: [fastify.authenticate] },
    ctrl.remove.bind(ctrl),
  )

  fastify.patch(
    '/admin/combos/:id/promotion',
    { preHandler: [fastify.authenticate] },
    ctrl.togglePromotion.bind(ctrl),
  )
}
