import { FastifyPluginAsync } from 'fastify'
import { AdminHooksController } from './admin-hooks.controller.js'

/**
 * adminHooksRoute — gestão das solicitações de gancho de porta pelo Admin.
 *
 * Rotas:
 *   GET   /admin/hook-requests          — lista (busca, filtro pending/delivered, paginação)
 *   PATCH /admin/hook-requests/:id/deliver — marca a entrega do gancho como realizada
 */
export const adminHooksRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminHooksController(fastify)

  fastify.get(
    '/admin/hook-requests',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — hooks'],
        summary: 'Listar solicitações de gancho (admin)',
        description:
          'Retorna clientes que solicitaram o gancho de porta, com busca (nome/apto/bloco/CPF/telefone), filtro pendente/entregue, ordenação e paginação. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string', description: 'Busca por nome, apartamento, bloco, CPF ou telefone.' },
            status: { type: 'string', enum: ['pending', 'delivered', 'all'], description: 'Filtro. Padrão: pending.' },
            sort: { type: 'string', enum: ['recent', 'name'], description: 'Ordenação. Padrão: recent.' },
            page: { type: 'integer', minimum: 1, description: 'Página (1-based). Padrão: 1.' },
            limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Itens por página. Padrão: 20.' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Página de solicitações de gancho.',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'ID do cliente (MongoDB ObjectId).' },
                    name: { type: 'string', description: 'Nome do cliente.' },
                    phone: { type: 'string', nullable: true, description: 'Telefone (apenas dígitos).' },
                    apartment: { type: 'string', nullable: true, description: 'Apartamento.' },
                    block: { type: 'string', nullable: true, description: 'Bloco (se aplicável).' },
                    condominiumId: { type: 'string', nullable: true, description: 'ID do condomínio.' },
                    condominiumName: { type: 'string', nullable: true, description: 'Nome do condomínio.' },
                    hookRequestedAt: { type: 'string', nullable: true, description: 'Quando o cliente solicitou (ISO 8601).' },
                    hookDeliveredAt: { type: 'string', nullable: true, description: 'Quando o gancho foi entregue (ISO 8601), ou null se pendente.' },
                  },
                },
              },
              total: { type: 'integer', description: 'Total de solicitações que casam com o filtro.' },
              page: { type: 'integer', description: 'Página atual.' },
              limit: { type: 'integer', description: 'Itens por página.' },
            },
          },
        },
      },
    },
    ctrl.list.bind(ctrl),
  )

  fastify.patch(
    '/admin/hook-requests/:id/deliver',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — hooks'],
        summary: 'Marcar gancho como entregue (admin)',
        description:
          'Registra que o gancho de porta foi entregue ao cliente (auditoria: quem/quando). Idempotente. Ao concluir, dispara push OneSignal (best-effort) e notificação in-app HOOK_DELIVERED. 422 se o cliente não solicitou o gancho. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', description: 'ID do cliente (MongoDB ObjectId).' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean', description: 'true quando a entrega foi registrada (ou já estava).' },
            },
          },
        },
      },
    },
    ctrl.deliver.bind(ctrl),
  )
}
