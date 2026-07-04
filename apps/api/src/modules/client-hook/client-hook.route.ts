import { FastifyPluginAsync } from 'fastify'
import { ClientHookController } from './client-hook.controller.js'

/**
 * clientHookRoute — solicitação do gancho de porta pelo cliente.
 *
 * Rotas:
 *   GET  /client/hook-request — status (hasOrdered, hookRequestedAt, needsConsent)
 *   POST /client/hook-request — cliente confirma o recebimento do gancho (idempotente)
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
          'Retorna se o cliente já fez algum pedido e se já solicitou o gancho. `needsConsent=true` indica que o app deve exibir o modal de consentimento (fez ao menos 1 pedido e ainda não solicitou). Restrito a CLIENT.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              hasOrdered: { type: 'boolean', description: 'true se o cliente já fez ao menos 1 pedido.' },
              hookRequestedAt: { type: 'string', nullable: true, description: 'Quando o cliente confirmou o gancho (ISO 8601), ou null.' },
              hookDeliveredAt: { type: 'string', nullable: true, description: 'Quando o gancho foi entregue (ISO 8601), ou null.' },
              needsConsent: { type: 'boolean', description: 'true se o app deve pedir o consentimento do gancho.' },
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
        summary: 'Confirmar recebimento do gancho de porta',
        description:
          'Registra a confirmação do cliente para receber o gancho de porta. Idempotente — chamadas repetidas mantêm a data original. A solicitação passa a aparecer para o Admin em Gestão → Solicitação de Gancho. Restrito a CLIENT.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              hookRequestedAt: { type: 'string', nullable: true, description: 'Data da solicitação (ISO 8601).' },
            },
          },
        },
      },
    },
    ctrl.request.bind(ctrl),
  )
}
