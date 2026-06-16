import { FastifyPluginAsync } from 'fastify'
import { AdminFinancialController } from './admin-financial.controller.js'

/**
 * adminFinancialRoute — registra rotas de receita financeira pelo Admin.
 *
 * T-07-05-04: preHandler: [fastify.authenticate] garante JWT válido.
 * O role check (ADMIN only) fica no controller (per D-11).
 *
 * Rota registrada:
 *   GET /admin/financial — receita por período com breakdown por tipo e condomínio
 */
export const adminFinancialRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminFinancialController(fastify)

  fastify.get(
    '/admin/financial',
    { preHandler: [fastify.authenticate] },
    ctrl.getRevenue.bind(ctrl),
  )
}
