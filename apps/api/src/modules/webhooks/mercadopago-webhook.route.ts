import { FastifyPluginAsync } from 'fastify'
import { WebhookSignatureValidator, InvalidWebhookSignatureError } from 'mercadopago'
import { WebhooksService } from './webhooks.service.js'

/**
 * Webhook do Mercado Pago (Pix). Plugin PRÓPRIO — não compartilha o parser raw/Buffer
 * do webhook do Stripe: o MP envia JSON normal e a autenticidade é validada pela
 * assinatura HMAC (x-signature), não pelo corpo cru.
 */
export const mercadopagoWebhookRoute: FastifyPluginAsync = async (fastify) => {
  const service = new WebhooksService(fastify)

  fastify.post(
    '/webhooks/mercadopago',
    {
      schema: {
        tags: ['webhooks'],
        summary: 'Webhook do Mercado Pago (Pix)',
        description:
          'Recebe notificações de pagamento do Mercado Pago. Autenticidade validada pela ' +
          'assinatura x-signature (HMAC) quando MP_WEBHOOK_SECRET está configurada. ' +
          'Crédito idempotente. Responde 200 para o MP não retentar.',
        response: {
          200: { type: 'object', properties: { received: { type: 'boolean' } } },
          401: { type: 'object', properties: { error: { type: 'string' } } },
          500: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as
        | { type?: string; topic?: string; action?: string; data?: { id?: string | number } }
        | undefined
      // O id do pagamento vem em data.id (webhook v2) ou no query param data.id (notificação legada).
      const query = request.query as { 'data.id'?: string; id?: string; topic?: string } | undefined
      const dataId = body?.data?.id != null ? String(body.data.id) : (query?.['data.id'] ?? query?.id)

      // Validação da assinatura (quando o secret está configurado).
      const secret = process.env.MP_WEBHOOK_SECRET
      if (secret) {
        try {
          // NÃO passamos toleranceSeconds: o MP envia o `ts` do x-signature em SEGUNDOS,
          // mas o validador do SDK compara com Date.now() (ms) sem converter — o "drift"
          // resultante (~1,78 bilhão de s) reprova TODA notificação (TimestampOutOfTolerance).
          // A autenticidade segue 100% garantida pelo HMAC; e o crédito é idempotente,
          // então dispensar a janela anti-replay (quebrada nesta versão do SDK) é seguro.
          WebhookSignatureValidator.validate({
            xSignature: request.headers['x-signature'],
            xRequestId: request.headers['x-request-id'],
            dataId,
            secret,
          })
        } catch (err) {
          if (err instanceof InvalidWebhookSignatureError) {
            fastify.log.warn({ reason: err.reason }, 'mp webhook: assinatura inválida')
            return reply.status(401).send({ error: 'Assinatura inválida' })
          }
          throw err
        }
      }

      const type = body?.type ?? body?.topic ?? query?.topic
      try {
        if (type === 'payment' && dataId) {
          await service.processMercadoPagoPayment(dataId)
        }
        return reply.status(200).send({ received: true })
      } catch (err) {
        // 500 → o MP re-tenta a entrega. O pull no getStatus também é uma rede de segurança.
        fastify.log.error({ err }, 'mp webhook: erro ao processar')
        return reply.status(500).send({ error: 'Erro ao processar webhook' })
      }
    },
  )
}
