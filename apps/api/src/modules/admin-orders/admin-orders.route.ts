import { FastifyPluginAsync } from 'fastify'
import { AdminOrdersController } from './admin-orders.controller.js'

/**
 * adminOrdersRoute — registra rotas de gestão de pedidos pelo Admin.
 *
 * T-05-01 / T-07-06-01: preHandler: [fastify.authenticate] garante JWT válido.
 * O role check (ADMIN only) fica inline no controller (per D-11).
 *
 * Rotas registradas:
 *   GET  /admin/dashboard                       — KPIs do painel (07-06)
 *   GET  /admin/orders/delivery-status          — status de entregas do dia (07-06)
 *   GET  /admin/orders/division-suggestion      — sugestão de divisão entre entregadores (07-06)
 *   PATCH /admin/orders/assign-courier          — atribuição de entregador em batch (D-13)
 *   PATCH /admin/orders/:id/status              — transição de status pelo Admin (ACOMP-01)
 *
 * IMPORTANTE: rotas estáticas (/delivery-status, /division-suggestion, /assign-courier)
 * ficam ANTES das rotas dinâmicas (/:id/status) para evitar conflito de parâmetros.
 */
export const adminOrdersRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminOrdersController(fastify)

  // GET /admin/dashboard — KPIs do AdminPainel (07-06)
  // Registrado no módulo admin-orders para centralizar acesso ao serviço de pedidos
  fastify.get(
    '/admin/dashboard',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — dashboard'],
        summary: 'KPIs do painel administrativo',
        description: 'Retorna os KPIs principais do painel do admin: quantidade de pãezinhos do dia, receita do dia, total de clientes, condomínios ativos, horário de corte de pedidos e breakdown de receita por tipo de pagamento. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            description: 'KPIs do dia atual.',
            properties: {
              breadsTodayCount: { type: 'integer', description: 'Pães a entregar hoje — pedidos já materializados (Order com scheduledDate=hoje).' },
              breadsTodayProjected: { type: 'integer', description: 'Pães previstos para hoje pela agenda semanal, ainda NÃO materializados como pedido.' },
              breadsTomorrowCount: { type: 'integer', description: 'Pães a entregar amanhã — pedidos já materializados.' },
              breadsTomorrowProjected: { type: 'integer', description: 'Pães previstos para amanhã pela agenda, ainda não materializados.' },
              breadsByWeekday: {
                type: 'array',
                description: 'Pães materializados por dia da semana corrente (índices 0=Seg .. 6=Dom).',
                items: { type: 'integer' },
              },
              breadsTodayTrendPct: { type: 'integer', description: 'Variação % de pães a entregar hoje vs. ontem.' },
              revenueTrendPct: { type: 'integer', description: 'Variação % da receita de hoje vs. ontem.' },
              clientsNewCount: { type: 'integer', description: 'Novos clientes nos últimos 7 dias.' },
              revenueToday: { type: 'number', description: 'Receita total do dia em reais (pagamentos aprovados com date=hoje).' },
              clientsCount: { type: 'integer', description: 'Total de clientes ativos cadastrados no sistema.' },
              condominiumsCount: { type: 'integer', description: 'Total de condomínios ativos.' },
              deliverySlots: {
                type: 'array',
                description: 'Slots de entrega ativos (config global), cada um com seu horário de corte.',
                items: {
                  type: 'object',
                  properties: {
                    slotId: { type: 'string', description: 'Identificador do slot.' },
                    label: { type: 'string', description: 'Rótulo de exibição (ex.: "Manhã").' },
                    time: { type: 'string', description: 'Horário de entrega (HH:MM).' },
                    cutoffTime: { type: 'string', description: 'Horário de corte do slot (HH:MM).' },
                  },
                },
              },
              revenueByType: {
                type: 'object',
                description: 'Breakdown de receita por tipo de compra.',
                properties: {
                  combos: { type: 'number', description: 'Receita via combos em reais.' },
                  avulso: { type: 'number', description: 'Receita via compra avulsa/personalizada em reais.' },
                },
              },
              stuckCount: { type: 'integer', description: 'Pedidos "no limbo": data de entrega passada e ainda sem desfecho.' },
            },
          },
        },
      },
    },
    ctrl.dashboard.bind(ctrl),
  )

  // Propriedades de uma linha do ledger (verificação geral / histórico / limbo)
  const ledgerRowProps = {
    orderId: { type: 'string' },
    userId: { type: 'string' },
    clientName: { type: 'string' },
    condominiumId: { type: 'string' },
    condominiumName: { type: 'string' },
    block: { type: 'string' },
    apartment: { type: 'string' },
    quantity: { type: 'integer' },
    slotId: { type: 'string' },
    slotLabel: { type: 'string' },
    type: { type: 'string' },
    status: { type: 'string' },
    scheduledDate: { type: 'string' },
    courierId: { type: 'string' },
    courierName: { type: 'string' },
    separatedAt: { type: 'string' },
    deliveredAt: { type: 'string' },
    failedAt: { type: 'string' },
    failureReason: { type: 'string' },
    cancelReason: { type: 'string' },
    refunded: { type: 'boolean' },
  }

  // GET /admin/orders — ledger de pedidos (verificação geral + histórico)
  fastify.get(
    '/admin/orders',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — dashboard'],
        summary: 'Ledger de pedidos (verificação geral / histórico)',
        description:
          'Lista pedidos com filtros (intervalo de datas, status, condomínio, entregador, busca por cliente/apto) e paginação. Garante que nenhum pedido fique invisível: cobre futuros agendados e histórico (entregue/não entregue/cancelado).',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'Data inicial (ISO/YYYY-MM-DD).' },
            to: { type: 'string', description: 'Data final (ISO/YYYY-MM-DD).' },
            status: { type: 'string', description: 'CSV de status (ex.: "DELIVERED,NOT_DELIVERED").' },
            condominiumId: { type: 'string' },
            courierId: { type: 'string' },
            q: { type: 'string', description: 'Busca por nome do cliente ou apartamento.' },
            limit: { type: 'integer', description: 'Máx. de itens (1–200, default 50).' },
            skip: { type: 'integer', description: 'Offset de paginação.' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              rows: { type: 'array', items: { type: 'object', properties: ledgerRowProps } },
              total: { type: 'integer' },
              hasMore: { type: 'boolean' },
            },
          },
        },
      },
    },
    ctrl.ledger.bind(ctrl),
  )

  // GET /admin/orders/stuck — pedidos parados (limbo)
  fastify.get(
    '/admin/orders/stuck',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — dashboard'],
        summary: 'Pedidos parados (limbo)',
        description:
          'Retorna pedidos cuja data de entrega já passou e que ainda não tiveram desfecho (não entregue, não cancelado). Base do alerta no Painel e do filtro "Parados".',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              rows: { type: 'array', items: { type: 'object', properties: ledgerRowProps } },
              count: { type: 'integer' },
            },
          },
        },
      },
    },
    ctrl.stuck.bind(ctrl),
  )

  // POST /admin/orders/:id/refund — estorno de créditos de um pedido
  fastify.post(
    '/admin/orders/:id/refund',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — dashboard'],
        summary: 'Estornar créditos de um pedido',
        description:
          'Devolve ao cliente os créditos de um pedido (CreditTransaction REFUND + incremento do saldo). Idempotente: bloqueia um segundo estorno do mesmo pedido (409). Usado no atalho do detalhe de pedidos não entregues/cancelados.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', description: 'ID do pedido (MongoDB ObjectId).' } },
        },
        body: {
          type: 'object',
          properties: { reason: { type: 'string', description: 'Motivo do estorno (auditoria).' } },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              refundedCredits: { type: 'integer' },
              creditBalance: { type: 'integer' },
            },
          },
        },
      },
    },
    ctrl.refundOrder.bind(ctrl),
  )

  // GET /admin/orders/delivery-status — status de entregas do dia agrupadas por condomínio (07-06)
  fastify.get(
    '/admin/orders/delivery-status',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — dashboard'],
        summary: 'Status de entregas do dia por condomínio',
        description: 'Retorna o status de entregas de um turno (slotId) do dia (date, default hoje), agrupado por condomínio. Pipeline por turno: sem misturar manhã e tarde.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            slotId: { type: 'string', description: 'Turno (manha/tarde). Omitido = todos.' },
            date: { type: 'string', description: 'Data de entrega (YYYY-MM-DD, BRT). Default: hoje.' },
          },
        },
        response: {
          200: {
            type: 'array',
            description: 'Lista de condomínios com status de entregas do dia.',
            items: {
              type: 'object',
              properties: {
                condominiumId: { type: 'string', description: 'ID do condomínio.' },
                condominiumName: { type: 'string', description: 'Nome do condomínio.' },
                scheduled: { type: 'integer', description: 'Total de pedidos agendados para hoje neste condomínio (status != CANCELLED).' },
                delivered: { type: 'integer', description: 'Pedidos com status DELIVERED.' },
                orderIds: { type: 'array', items: { type: 'string' }, description: 'IDs dos pedidos do grupo (para atribuição em batch).' },
              },
            },
          },
        },
      },
    },
    ctrl.deliveryStatus.bind(ctrl),
  )

  // GET /admin/orders/division-suggestion — sugestão greedy de divisão entre entregadores (07-06)
  fastify.get(
    '/admin/orders/division-suggestion',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — dashboard'],
        summary: 'Sugestão de divisão de entregas entre entregadores',
        description: 'Gera a sugestão de divisão de condomínios entre entregadores para um turno (slotId) do dia (date, default hoje), balanceando por quantidade. Pipeline por turno: cada entregador recebe só o turno selecionado.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            slotId: { type: 'string', description: 'Turno (manha/tarde). Omitido = todos.' },
            date: { type: 'string', description: 'Data de entrega (YYYY-MM-DD, BRT). Default: hoje.' },
          },
        },
        response: {
          200: {
            type: 'array',
            description: 'Sugestão de atribuição de condomínios por entregador.',
            items: {
              type: 'object',
              properties: {
                courierId: { type: 'string', description: 'ID do entregador.' },
                courierName: { type: 'string', description: 'Nome do entregador.' },
                condominiums: {
                  type: 'array',
                  description: 'Lista de condomínios sugeridos para este entregador.',
                  items: {
                    type: 'object',
                    properties: {
                      condominiumId: { type: 'string', description: 'ID do condomínio.' },
                      condominiumName: { type: 'string', description: 'Nome do condomínio.' },
                      quantity: { type: 'integer', description: 'Total de pãezinhos neste condomínio.' },
                    },
                  },
                },
                total: { type: 'integer', description: 'Total de pãezinhos atribuídos a este entregador.' },
              },
            },
          },
        },
      },
    },
    ctrl.divisionSuggestion.bind(ctrl),
  )

  // D-13: endpoint de atribuicao de entregador em batch
  // Role check ADMIN fica no controller (per D-11)
  fastify.patch(
    '/admin/orders/assign-courier',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — dashboard'],
        summary: 'Atribuir entregador a pedidos',
        description: 'Atribui um entregador a um conjunto de pedidos. Pode ser usado com lista explícita de orderIds OU com condominiumId+date para atribuir todos os pedidos de um condomínio em uma data. As duas formas são mutuamente exclusivas.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['courierId'],
          description: 'Informe orderIds[] OU (condominiumId + date) — não ambos.',
          properties: {
            courierId: { type: 'string', description: 'ID do entregador a atribuir (MongoDB ObjectId).' },
            orderIds: { type: 'array', items: { type: 'string' }, description: 'Lista de IDs de pedidos para atribuir ao entregador. Mutuamente exclusivo com condominiumId+date.' },
            condominiumId: { type: 'string', description: 'ID do condomínio. Atribui todos os pedidos deste condomínio na data. Mutuamente exclusivo com orderIds.' },
            date: { type: 'string', format: 'date', description: 'Data dos pedidos (YYYY-MM-DD). Usar com condominiumId.' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Atribuição realizada.',
            properties: {
              ok: { type: 'boolean', description: 'Indica sucesso da operação.' },
              count: { type: 'integer', description: 'Número de pedidos atualizados com o novo entregador.' },
            },
          },
        },
      },
    },
    ctrl.assignCourier.bind(ctrl),
  )

  // ACOMP-01: transição de status pelo Admin (rota dinâmica — deve ficar por último)
  fastify.patch(
    '/admin/orders/:id/status',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — dashboard'],
        summary: 'Atualizar status de pedido',
        description: 'Atualiza o status de um pedido no ciclo de vida v2 (SCHEDULED → SEPARATED → OUT_FOR_DELIVERY → DELIVERED, com desfecho alternativo NOT_DELIVERED). Registra o marco de tempo correspondente (separatedAt/deliveredAt/failedAt) e, em NOT_DELIVERED, o motivo. Quando status=DELIVERED, dispara push para o cliente. Cancelamento é feito no fluxo de admin-clients (que também estorna créditos).',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do pedido (MongoDB ObjectId).' },
          },
        },
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['SEPARATED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'NOT_DELIVERED'], description: 'Novo status do pedido. Transições válidas em VALID_TRANSITIONS (ex.: SEPARATED→OUT_FOR_DELIVERY, OUT_FOR_DELIVERY→DELIVERED|NOT_DELIVERED).' },
            reason: { type: 'string', description: 'Motivo (opcional) — usado principalmente em NOT_DELIVERED (cliente ausente, endereço, etc.).' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Status atualizado com sucesso.',
            properties: {
              ok: { type: 'boolean', description: 'Indica sucesso da operação.' },
            },
          },
        },
      },
    },
    ctrl.updateOrderStatus.bind(ctrl),
  )
}
