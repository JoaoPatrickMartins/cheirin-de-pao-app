import { FastifyPluginAsync } from 'fastify'
import { AdminHooksController } from './admin-hooks.controller.js'

/**
 * adminHooksRoute — gestão dos ganchos de porta pelo Admin.
 *
 * Rotas:
 *   GET   /admin/hook-requests             — lista (busca, filtro status/tipo, paginação)
 *   PATCH /admin/hook-requests/:id/deliver — marca a entrega de um gancho (por id do HookRequest)
 *   POST  /admin/hook-requests/grant       — concede um gancho de bonificação a um cliente
 */
export const adminHooksRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminHooksController(fastify)

  fastify.get(
    '/admin/hook-requests',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — hooks'],
        summary: 'Listar ganchos (admin)',
        description:
          'Retorna os ganchos de porta na fila (REQUESTED) ou entregues (DELIVERED), com busca (nome/apto/bloco/CPF/telefone), filtro por status e tipo (grátis/pago/bônus), ordenação e paginação. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string', description: 'Busca por nome, apartamento, bloco, CPF ou telefone.' },
            status: { type: 'string', enum: ['pending', 'delivered', 'all'], description: 'Filtro de status. Padrão: pending.' },
            type: { type: 'string', enum: ['all', 'free', 'paid', 'bonus'], description: 'Filtro por tipo. Padrão: all.' },
            sort: { type: 'string', enum: ['recent', 'name', 'location'], description: 'Ordenação: recent (data desc), name (alfabético) ou location (condomínio → bloco → apartamento). Padrão: recent.' },
            page: { type: 'integer', minimum: 1, description: 'Página (1-based). Padrão: 1.' },
            limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Itens por página. Padrão: 20.' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Página de ganchos.',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'ID do gancho (HookRequest — usar em /:id/deliver).' },
                    userId: { type: 'string', description: 'ID do cliente.' },
                    type: { type: 'string', enum: ['FREE', 'PAID', 'BONUS'], description: 'Tipo do gancho.' },
                    status: { type: 'string', enum: ['REQUESTED', 'DELIVERED'], description: 'Status do gancho.' },
                    reason: { type: 'string', nullable: true, description: 'Motivo (defeito/perda no pago; texto da bonificação no bônus).' },
                    name: { type: 'string', description: 'Nome do cliente.' },
                    phone: { type: 'string', nullable: true, description: 'Telefone (apenas dígitos).' },
                    apartment: { type: 'string', nullable: true, description: 'Apartamento.' },
                    block: { type: 'string', nullable: true, description: 'Bloco (se aplicável).' },
                    condominiumId: { type: 'string', nullable: true, description: 'ID do condomínio.' },
                    condominiumName: { type: 'string', nullable: true, description: 'Nome do condomínio.' },
                    requestedAt: { type: 'string', nullable: true, description: 'Quando entrou na fila (ISO 8601).' },
                    deliveredAt: { type: 'string', nullable: true, description: 'Quando foi entregue (ISO 8601), ou null.' },
                  },
                },
              },
              total: { type: 'integer', description: 'Total de ganchos que casam com o filtro.' },
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
          'Registra que o gancho foi entregue (auditoria: quem/quando). Idempotente. Ao concluir, dispara push OneSignal (best-effort) e notificação in-app HOOK_DELIVERED. 422 se o gancho não estiver na fila. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', description: 'ID do gancho (HookRequest — MongoDB ObjectId).' } },
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

  fastify.post(
    '/admin/hook-requests/grant',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — hooks'],
        summary: 'Conceder gancho de bonificação (admin)',
        description:
          'Concede um gancho de porta de bonificação (BONUS) a um cliente, entrando direto na fila de entrega. 422 se o cliente já tem um gancho em andamento. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string', description: 'ID do cliente que receberá o gancho.' },
            reason: { type: 'string', description: 'Motivo/nota da bonificação. Opcional.' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              hookRequestId: { type: 'string', description: 'ID do gancho criado.' },
            },
          },
        },
      },
    },
    ctrl.grant.bind(ctrl),
  )
}
