import { FastifyPluginAsync } from 'fastify'
import { AdminClientsController } from './admin-clients.controller.js'

/**
 * adminClientsRoute — registra rotas de gestão de clientes pelo Admin.
 *
 * T-07-03-01: preHandler: [fastify.authenticate] garante JWT válido.
 * T-07-03-04: Role check e verificação de role=CLIENT ficam no controller/service.
 * T-07-03-05: getDetail expõe dados somente leitura — Schedule + Orders — apenas a ADMIN.
 *
 * Rotas registradas:
 *   GET   /admin/clients          — lista clientes (query: ?condominiumId)
 *   GET   /admin/clients/:id      — detalhe com Schedule ativo + Orders 30 dias
 *   PATCH /admin/clients/:id/block — toggle isBlocked do cliente
 */
export const adminClientsRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminClientsController(fastify)

  fastify.get(
    '/admin/clients',
    { preHandler: [fastify.authenticate] },
    ctrl.list.bind(ctrl),
  )

  fastify.get(
    '/admin/clients/:id',
    { preHandler: [fastify.authenticate] },
    ctrl.getDetail.bind(ctrl),
  )

  fastify.patch(
    '/admin/clients/:id/block',
    { preHandler: [fastify.authenticate] },
    ctrl.blockToggle.bind(ctrl),
  )
}
