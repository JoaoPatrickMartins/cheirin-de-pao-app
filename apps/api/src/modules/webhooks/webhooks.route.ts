import { FastifyPluginAsync } from 'fastify'
import { WebhooksController } from './webhooks.controller.js'

export const webhooksRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new WebhooksController(fastify)

  // Public route — no authenticate preHandler (MP calls this without Bearer token)
  fastify.post('/webhooks/mercadopago', ctrl.handleWebhook.bind(ctrl))
}
