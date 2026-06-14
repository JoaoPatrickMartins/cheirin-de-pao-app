import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { WebhooksService, WebhookBody } from './webhooks.service.js'

export class WebhooksController {
  private service: WebhooksService

  constructor(private fastify: FastifyInstance) {
    this.service = new WebhooksService(fastify)
  }

  async handleWebhook(request: FastifyRequest, reply: FastifyReply) {
    const xSignature = request.headers['x-signature'] as string
    const xRequestId = request.headers['x-request-id'] as string
    const dataId = (request.query as Record<string, string>)['data.id']

    if (!xSignature || !xRequestId || !dataId) {
      return reply.status(400).send({ error: 'Headers ou parâmetros obrigatórios ausentes' })
    }

    if (!this.service.validateSignature(xSignature, xRequestId, dataId)) {
      return reply.status(401).send({ error: 'Assinatura inválida' })
    }

    try {
      await this.service.processPayment(request.body as WebhookBody)
      return reply.status(200).send({ ok: true })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro ao processar webhook' })
    }
  }
}
