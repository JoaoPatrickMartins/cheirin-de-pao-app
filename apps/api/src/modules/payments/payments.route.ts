import { FastifyPluginAsync } from 'fastify'
import { PaymentsController } from './payments.controller.js'

export const paymentsRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new PaymentsController(fastify)

  fastify.post(
    '/payments/pix',
    { preHandler: [fastify.authenticate] },
    ctrl.createPix.bind(ctrl),
  )
  fastify.post(
    '/payments/card',
    { preHandler: [fastify.authenticate] },
    ctrl.createCard.bind(ctrl),
  )
  fastify.get(
    '/payments/:id/status',
    { preHandler: [fastify.authenticate] },
    ctrl.getStatus.bind(ctrl),
  )
}
