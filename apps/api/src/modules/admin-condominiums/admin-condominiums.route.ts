import { FastifyPluginAsync } from 'fastify'
import { AdminCondominiumsController } from './admin-condominiums.controller.js'

/**
 * adminCondominiumsRoute — rotas CRUD de condomínios para o admin.
 *
 * T-07-02-05: preHandler: [fastify.authenticate] garante JWT válido em todas as rotas.
 * T-07-02-01: Role check ADMIN fica inline no controller (per D-11).
 */
export const adminCondominiumsRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminCondominiumsController(fastify)

  fastify.get(
    '/admin/condominiums',
    { preHandler: [fastify.authenticate] },
    ctrl.list.bind(ctrl),
  )

  fastify.post(
    '/admin/condominiums',
    { preHandler: [fastify.authenticate] },
    ctrl.create.bind(ctrl),
  )

  fastify.patch(
    '/admin/condominiums/:id',
    { preHandler: [fastify.authenticate] },
    ctrl.update.bind(ctrl),
  )

  fastify.delete(
    '/admin/condominiums/:id',
    { preHandler: [fastify.authenticate] },
    ctrl.remove.bind(ctrl),
  )
}
