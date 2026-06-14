import { FastifyPluginAsync } from 'fastify'
import { CreditsController } from './credits.controller.js'

export const creditsRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new CreditsController(fastify)

  fastify.get('/combos', { preHandler: [fastify.authenticate] }, ctrl.listCombos.bind(ctrl))
  fastify.get('/pricing', { preHandler: [fastify.authenticate] }, ctrl.getPricing.bind(ctrl))
  fastify.get(
    '/credits/history',
    { preHandler: [fastify.authenticate] },
    ctrl.getCreditHistory.bind(ctrl),
  )

  fastify.put(
    '/users/me/auto-recharge',
    { preHandler: [fastify.authenticate] },
    ctrl.updateAutoRecharge.bind(ctrl),
  )
  fastify.put(
    '/users/me/card-token',
    { preHandler: [fastify.authenticate] },
    ctrl.updateCardToken.bind(ctrl),
  )
}
