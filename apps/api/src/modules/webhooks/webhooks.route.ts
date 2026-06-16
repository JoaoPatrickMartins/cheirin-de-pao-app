import { FastifyPluginAsync } from 'fastify'
import { WebhooksController } from './webhooks.controller.js'

export const webhooksRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new WebhooksController(fastify)

  // Public route — no authenticate preHandler (MP calls this without Bearer token)
  fastify.post('/webhooks/mercadopago', {
    schema: {
      tags: ['webhooks'],
      summary: 'Webhook do Mercado Pago',
      description: 'Recebe notificações de eventos de pagamento do Mercado Pago. Rota pública — sem Bearer token (o MP não envia autenticação). A autenticidade é validada via HMAC-SHA256 usando o secret configurado. Processamento idempotente: eventos duplicados são ignorados via campo mpPaymentId. Créditos são adicionados atomicamente apenas para eventos "payment.update" com status "approved". Retorna 200 imediatamente para evitar retentativas do MP.',
      body: {
        type: 'object',
        description: 'Payload de notificação enviado pelo Mercado Pago.',
        properties: {
          type: { type: 'string', description: 'Tipo do evento (ex: "payment.update"). Apenas payment.update é processado.' },
          data: {
            type: 'object',
            description: 'Dados do evento.',
            properties: {
              id: { type: 'string', description: 'ID do pagamento no Mercado Pago.' },
            },
          },
        },
      },
      response: {
        200: {
          type: 'object',
          description: 'Evento recebido. O processamento ocorre de forma assíncrona.',
          properties: {
            received: { type: 'boolean', description: 'Confirma recebimento do evento para o MP não retentar.' },
          },
        },
      },
    },
  }, ctrl.handleWebhook.bind(ctrl))
}
