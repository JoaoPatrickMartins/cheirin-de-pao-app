import { FastifyPluginAsync } from 'fastify'
import { AdminSuppliersController } from './admin-suppliers.controller.js'

/**
 * adminSuppliersRoute — registra rotas de CRUD de fornecedores pelo Admin.
 *
 * T-07-03-01: preHandler: [fastify.authenticate] garante JWT válido.
 * O role check (ADMIN only) fica no controller.
 *
 * Rotas registradas:
 *   GET  /admin/suppliers        — lista todos os fornecedores
 *   POST /admin/suppliers        — cria novo fornecedor
 *   PATCH /admin/suppliers/:id   — atualiza parcialmente
 *   DELETE /admin/suppliers/:id  — remove
 */
export const adminSuppliersRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminSuppliersController(fastify)

  fastify.get(
    '/admin/suppliers',
    { preHandler: [fastify.authenticate] },
    ctrl.list.bind(ctrl),
  )

  fastify.post(
    '/admin/suppliers',
    { preHandler: [fastify.authenticate] },
    ctrl.create.bind(ctrl),
  )

  fastify.patch(
    '/admin/suppliers/:id',
    { preHandler: [fastify.authenticate] },
    ctrl.update.bind(ctrl),
  )

  fastify.delete(
    '/admin/suppliers/:id',
    { preHandler: [fastify.authenticate] },
    ctrl.remove.bind(ctrl),
  )
}
