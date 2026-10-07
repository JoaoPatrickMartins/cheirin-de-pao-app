import { FastifyPluginAsync } from 'fastify'
import { AdminHooksController } from './admin-hooks.controller.js'

/**
 * adminHooksRoute — gestão dos ganchos de porta pelo Admin.
 *
 * Rotas:
 *   GET   /admin/hook-requests/summary     — quantos ganchos aguardam entrega (badge de Gestão)
 *   GET   /admin/hook-requests             — lista (busca, filtro status/tipo, paginação)
 *   PATCH /admin/hook-requests/:id/deliver — marca a entrega de um gancho (por id do HookRequest)
 *   POST  /admin/hook-requests/grant       — concede um gancho de bonificação a um cliente
 */
export const adminHooksRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminHooksController(fastify)

  fastify.get(
    '/admin/hook-requests/summary',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — hooks'],
        summary: 'Contagem de ganchos pendentes (admin)',
        description:
          'Retorna quantos ganchos estão na fila de entrega (status REQUESTED). Consulta leve, feita a cada entrada no hub de Gestão para alimentar o badge de pendências. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              pending: { type: 'integer', description: 'Ganchos aguardando entrega (REQUESTED).' },
            },
          },
        },
      },
    },
    ctrl.summary.bind(ctrl),
  )

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
                    complement: { type: 'string', nullable: true, description: 'Complemento do bloco (ex.: "Lado A").' },
                    condominiumId: { type: 'string', nullable: true, description: 'ID do condomínio.' },
                    condominiumName: { type: 'string', nullable: true, description: 'Nome do condomínio.' },
                    route: {
                      type: 'object',
                      nullable: true,
                      description: 'Gancho enviado na rota (A7).',
                      properties: {
                        date: { type: 'string' },
                        slotId: { type: 'string' },
                        slotLabel: { type: 'string' },
                        courierName: { type: 'string', nullable: true },
                        overdue: { type: 'boolean', description: 'A data passou sem resposta do entregador.' },
                        alone: { type: 'boolean', description: 'Sem pão no dia/turno: parada só de gancho.' },
                      },
                    },
                    routeFailedAt: { type: 'string', nullable: true, description: '"Ficou para outro dia" — voltou para a fila.' },
                    routeFailedReason: { type: 'string', nullable: true, description: 'Motivo da volta à fila (não entregue ou turno recusado).' },
                    deliveredVia: { type: 'string', nullable: true, description: 'ADMIN · COURIER' },
                    deliveredByName: { type: 'string', nullable: true, description: 'Entregador que deixou o gancho.' },
                    routeState: { type: 'string', description: 'fila · rota · entregue · volta' },
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

  // ── Gancho na rota (A7) ───────────────────────────────────────────────────
  const errS = { type: 'object', properties: { error: { type: 'string' } } }
  const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'string' } } }
  const courierS = { type: 'object', nullable: true, properties: { id: { type: 'string' }, name: { type: 'string' }, photoUrl: { type: 'string', nullable: true } } }

  fastify.get('/admin/hook-requests/:id/route-options', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['admin — hooks'],
      summary: 'Dias e turnos em que o gancho pode ir (A7)',
      description:
        'Hoje e os próximos 6 dias, nos turnos ativos do condomínio do cliente. Cada opção diz se vai junto com o pão (pedido ou agenda) ou sozinho, ' +
        'e quem leva: o entregador da parada quando o pão já foi despachado (courierLocked), senão uma sugestão. Restrito a ADMIN.',
      security: [{ bearerAuth: [] }],
      params: idParams,
      response: {
        200: {
          type: 'object',
          properties: {
            options: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  slotId: { type: 'string' },
                  slotLabel: { type: 'string' },
                  slotEmoji: { type: 'string' },
                  slotTime: { type: 'string' },
                  withBread: { type: 'boolean' },
                  courierLocked: { type: 'boolean' },
                  courier: courierS,
                  unavailableCourierIds: { type: 'array', items: { type: 'string' } },
                },
              },
            },
            couriers: { type: 'array', items: courierS },
          },
        },
        404: errS,
      },
    },
  }, ctrl.routeOptions.bind(ctrl))

  fastify.post('/admin/hook-requests/:id/route', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['admin — hooks'],
      summary: 'Enviar o gancho na rota (A7)',
      description:
        'Com o pão do dia já despachado, o gancho entra na parada do cliente. Senão vai com o entregador escolhido (courierId, obrigatório): ' +
        'se o pão sair depois com outro entregador, o gancho vai junto com o pão; sem pão, vira parada só de gancho. ' +
        '400 se o dia/turno não está disponível ou falta o entregador · 422 entregador indisponível. Restrito a ADMIN.',
      security: [{ bearerAuth: [] }],
      params: idParams,
      body: { type: 'object', required: ['date', 'slotId'], properties: { date: { type: 'string' }, slotId: { type: 'string' }, courierId: { type: 'string' } } },
      response: {
        200: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            route: { type: 'object', properties: { date: { type: 'string' }, slotId: { type: 'string' }, courierName: { type: 'string', nullable: true }, alone: { type: 'boolean' } } },
          },
        },
        400: errS,
        404: errS,
        422: errS,
      },
    },
  }, ctrl.sendOnRoute.bind(ctrl))

  fastify.delete('/admin/hook-requests/:id/route', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['admin — hooks'],
      summary: 'Tirar o gancho da rota (volta para a fila)',
      security: [{ bearerAuth: [] }],
      params: idParams,
      response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } }, 404: errS },
    },
  }, ctrl.removeFromRoute.bind(ctrl))
}
