import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { WebhooksService } from './webhooks.service.js'

export class WebhooksController {
  private service: WebhooksService

  constructor(private fastify: FastifyInstance) {
    this.service = new WebhooksService(fastify)
  }

  // POST /webhooks/stripe — rota pública. Autenticidade via assinatura Stripe (corpo cru).
  async handleStripe(request: FastifyRequest, reply: FastifyReply) {
    const signature = request.headers['stripe-signature'] as string | undefined
    if (!signature) {
      return reply.status(400).send({ error: 'Assinatura ausente' })
    }

    let event
    try {
      // request.body é um Buffer (parser raw escopado neste plugin)
      event = this.service.constructEvent(request.body as Buffer, signature)
    } catch (err) {
      this.fastify.log.warn({ err }, 'stripe webhook: assinatura inválida')
      return reply.status(400).send({ error: 'Assinatura inválida' })
    }

    try {
      await this.service.processEvent(event)
      return reply.status(200).send({ received: true })
    } catch (err) {
      this.fastify.log.error({ err }, 'stripe webhook: erro ao processar')
      return reply.status(500).send({ error: 'Erro ao processar webhook' })
    }
  }
}
