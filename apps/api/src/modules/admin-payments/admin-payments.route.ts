import { FastifyPluginAsync } from 'fastify'
import { AdminPaymentsController } from './admin-payments.controller.js'

/**
 * adminPaymentsRoute — registra rotas de gestão de pagamentos pelo Admin.
 *
 * T-07-05-01: preHandler: [fastify.authenticate] garante JWT válido.
 * O role check (ADMIN only) fica no controller (per D-11).
 *
 * Rotas registradas:
 *   GET  /admin/payments          — lista de pagamentos com status (PAY-03)
 *   GET  /admin/payments/:id      — detalhe de um pagamento + User
 *   POST /admin/payments/:id/refund — estorno via MP + debito de créditos (PAY-04)
 */
export const adminPaymentsRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminPaymentsController(fastify)

  fastify.get(
    '/admin/payments',
    { preHandler: [fastify.authenticate] },
    ctrl.list.bind(ctrl),
  )

  fastify.get(
    '/admin/payments/:id',
    { preHandler: [fastify.authenticate] },
    ctrl.getById.bind(ctrl),
  )

  fastify.post(
    '/admin/payments/:id/refund',
    { preHandler: [fastify.authenticate] },
    ctrl.refund.bind(ctrl),
  )
}
