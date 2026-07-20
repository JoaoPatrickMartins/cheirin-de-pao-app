import { FastifyPluginAsync } from 'fastify'
import { ClientHookController } from './client-hook.controller.js'

/**
 * clientHookRoute — gancho de porta pelo cliente.
 *
 * Rotas:
 *   GET  /client/hook-request      — status (grátis/pago/atual) do gancho do cliente
 *   POST /client/hook-request      — confirma o recebimento do gancho GRÁTIS (consentimento)
 *   POST /client/hook-request/paid — inicia a compra de um gancho ADICIONAL (Pix)
 */
export const clientHookRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new ClientHookController(fastify)

  fastify.get(
    '/client/hook-request',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['client — hook'],
        summary: 'Status do gancho de porta do cliente',
        description:
          'Retorna o status do gancho do cliente. `needsConsent=true` → o app exibe o modal de consentimento do gancho GRÁTIS (cliente elegível e sem nenhum gancho). `canRequestPaid=true` → o cliente pode comprar um gancho adicional (Pix). `current` traz o gancho mais recente. Restrito a CLIENT.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              hookPrice: { type: 'number', description: 'Preço de um gancho adicional em reais.' },
              pedidoUnicoMin: { type: 'integer', description: 'Mínimo de pães num pedido único para dar direito ao gancho grátis.' },
              freeEligible: { type: 'boolean', description: 'true se o cliente atende ao critério do gancho grátis (combo ou pedido único >= mínimo).' },
              hasHook: { type: 'boolean', description: 'true se o cliente já possui algum gancho (grátis, pago ou bônus).' },
              needsConsent: { type: 'boolean', description: 'true se o app deve exibir o modal de consentimento do gancho grátis.' },
              canRequestPaid: { type: 'boolean', description: 'true se o cliente pode comprar um gancho adicional.' },
              current: {
                type: 'object',
                nullable: true,
                description: 'Gancho mais recente do cliente, ou null.',
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string', enum: ['FREE', 'PAID', 'BONUS'] },
                  status: { type: 'string', enum: ['PENDING_PAYMENT', 'REQUESTED', 'DELIVERED', 'CANCELLED'] },
                  reason: { type: 'string', nullable: true },
                  requestedAt: { type: 'string', nullable: true },
                  deliveredAt: { type: 'string', nullable: true },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    ctrl.status.bind(ctrl),
  )

  fastify.post(
    '/client/hook-request',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['client — hook'],
        summary: 'Confirmar recebimento do gancho grátis',
        description:
          'Concede o gancho de porta GRÁTIS após o consentimento do cliente. Idempotente — se o cliente já tem gancho, devolve o atual. 422 se ainda não atende ao critério (combo ou pedido único >= mínimo). Restrito a CLIENT.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              hookRequestId: { type: 'string', description: 'ID do HookRequest (MongoDB ObjectId).' },
              status: { type: 'string', description: 'Status do gancho.' },
              type: { type: 'string', description: 'Tipo do gancho.' },
            },
          },
        },
      },
    },
    ctrl.request.bind(ctrl),
  )

  fastify.post(
    '/client/hook-request/paid',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['client — hook'],
        summary: 'Comprar um gancho adicional (Pix)',
        description:
          'Inicia a compra de um gancho adicional (reposição por defeito/perda) via Pix. Cria o pagamento e um HookRequest PAID pendente; o gancho entra na fila do admin quando o pagamento confirma. 422 se o cliente ainda não tem gancho ou já tem um em andamento. Restrito a CLIENT.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            reason: { type: 'string', description: 'Motivo (ex.: defeito ou perda). Opcional.' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              hookRequestId: { type: 'string', description: 'ID do HookRequest criado.' },
              paymentId: { type: 'string', description: 'ID interno do pagamento (usar em /payments/:id/status).' },
              amount: { type: 'number', description: 'Valor cobrado em reais.' },
              pixCopyPaste: { type: 'string', description: 'Código Pix copia-e-cola (EMV).' },
              pixQrCodeUrl: { type: 'string', description: 'QR Code como data-URI base64.' },
              expiresAt: { type: 'string', nullable: true, description: 'Expiração do QR (ISO 8601), ou null.' },
            },
          },
        },
      },
    },
    ctrl.requestPaid.bind(ctrl),
  )
}
