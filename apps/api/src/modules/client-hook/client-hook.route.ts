import { FastifyPluginAsync } from 'fastify'
import { ClientHookController } from './client-hook.controller.js'

/**
 * clientHookRoute — gancho de porta pelo cliente.
 *
 * Rotas:
 *   GET  /client/hook-request      — status (grátis/pago/atual) do gancho do cliente
 *   POST /client/hook-request      — cliente PEDE o gancho GRÁTIS (consentimento)
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
          'Retorna o status do gancho do cliente. `needsConsent=true` → o app exibe o modal de consentimento do gancho GRÁTIS (cliente elegível e sem nenhum gancho). `canRequestPaid=true` → o cliente pode comprar um gancho adicional (Pix). `current` traz o gancho mais recente. O gancho grátis é único por cliente: quem já tem qualquer gancho (inclusive o de cortesia do admin) vem com `freeEligible=false`. Restrito a CLIENT.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              hookPrice: { type: 'number', description: 'Preço de um gancho adicional em reais.' },
              pedidoUnicoMin: { type: 'integer', description: 'Mínimo de pães num pedido único para dar direito ao gancho grátis.' },
              cestinhaMinValue: { type: 'number', description: 'Valor mínimo em R$ de uma Cestinha para dar direito ao gancho grátis (pedidoUnicoMin × preço avulso). 0 = regra indisponível (sem preço avulso configurado).' },
              recorrenciaMin: { type: 'integer', description: 'Pedidos entregues (pedido único + Cestinha) que dão o gancho por fidelidade. 0 = regra desligada.' },
              recorrenciaProgress: { type: 'integer', description: 'Pedidos entregues do cliente já contados na fidelidade. 0 quando a regra está desligada ou o cliente já tem gancho.' },
              freeEligible: { type: 'boolean', description: 'true se o cliente atende a alguma regra do gancho grátis (combo, pedido único >= mínimo, Cestinha >= limiar ou fidelidade).' },
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
        summary: 'Pedir o gancho grátis (consentimento do cliente)',
        description:
          'Registra o PEDIDO do gancho de porta GRÁTIS após o consentimento do cliente — o gancho ainda será entregue (nasce em REQUESTED). Idempotente — se o cliente já tem gancho, devolve o atual. 422 se ainda não atende a nenhuma regra (combo, pedido único >= mínimo, Cestinha >= limiar ou fidelidade). Restrito a CLIENT.',
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
