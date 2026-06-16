import { FastifyPluginAsync } from 'fastify'
import { AdminSettingsController } from './admin-settings.controller.js'

/**
 * adminSettingsRoute — rotas de configurações globais do admin.
 *
 * T-07-02-05: preHandler: [fastify.authenticate] garante JWT válido nas rotas admin.
 * T-07-02-01: Role check ADMIN fica inline no controller (per D-11).
 *
 * Rota pública (sem autenticação):
 *   GET /settings/cutoff-status — status de corte para clientes (07-06)
 */
export const adminSettingsRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminSettingsController(fastify)

  // Rota pública — sem preHandler (nenhum token necessário)
  // Registrada ANTES das rotas autenticadas para evitar conflito de preHandler
  fastify.get('/settings/cutoff-status', ctrl.cutoffStatus.bind(ctrl))

  fastify.get(
    '/admin/settings/cutoff',
    { preHandler: [fastify.authenticate] },
    ctrl.getCutoff.bind(ctrl),
  )

  fastify.patch(
    '/admin/settings/cutoff',
    { preHandler: [fastify.authenticate] },
    ctrl.setCutoff.bind(ctrl),
  )

  fastify.get(
    '/admin/settings/avulso',
    { preHandler: [fastify.authenticate] },
    ctrl.getAvulso.bind(ctrl),
  )

  fastify.patch(
    '/admin/settings/avulso',
    { preHandler: [fastify.authenticate] },
    ctrl.setAvulso.bind(ctrl),
  )
}
