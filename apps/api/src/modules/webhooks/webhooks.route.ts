import { FastifyPluginAsync } from 'fastify'
import { WebhooksController } from './webhooks.controller.js'

export const webhooksRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new WebhooksController(fastify)

  // Stripe valida a assinatura sobre o CORPO CRU — sobrescrevemos o parser de JSON
  // para Buffer apenas neste plugin (encapsulado pelo Fastify; não afeta o resto da API).
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body)
  })

  // Rota pública — sem authenticate (o Stripe não envia Bearer). Sem schema de body
  // (o corpo é um Buffer cru; a validação é feita pela assinatura no controller).
  fastify.post(
    '/webhooks/stripe',
    {
      schema: {
        tags: ['webhooks'],
        summary: 'Webhook do Stripe',
        description:
          'Recebe eventos do Stripe (payment_intent.succeeded/payment_failed, charge.refunded). ' +
          'Rota pública; autenticidade validada pela assinatura (header stripe-signature) sobre o corpo cru. ' +
          'Crédito idempotente: pagamentos já PAID são ignorados. Retorna 200 para o Stripe não retentar.',
        response: {
          200: {
            type: 'object',
            properties: { received: { type: 'boolean' } },
          },
        },
      },
    },
    ctrl.handleStripe.bind(ctrl),
  )
}
