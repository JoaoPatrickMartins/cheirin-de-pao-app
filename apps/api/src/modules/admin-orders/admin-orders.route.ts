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
              breadsTodayCount: { type: 'integer', description: 'Total de pãezinhos a entregar hoje (soma de todos os pedidos SCHEDULED).' },
              revenueToday: { type: 'number', description: 'Receita total do dia em reais (pagamentos aprovados com date=hoje).' },
              clientsCount: { type: 'integer', description: 'Total de clientes ativos cadastrados no sistema.' },
              condominiumsCount: { type: 'integer', description: 'Total de condomínios ativos.' },
              cutoffTime: { type: 'string', description: 'Horário de corte de pedidos configurado (HH:MM).' },
              revenueByType: {
                type: 'object',
                description: 'Breakdown de receita por método de pagamento.',
                properties: {
                  pix: { type: 'number', description: 'Receita via Pix em reais.' },
                  card: { type: 'number', description: 'Receita via cartão em reais.' },
                },
              },
            },
          },
        },
      },
    },
    ctrl.dashboard.bind(ctrl),
  )

  // GET /admin/orders/delivery-status — status de entregas do dia agrupadas por condomínio (07-06)
  fastify.get(
    '/admin/orders/delivery-status',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — dashboard'],
        summary: 'Status de entregas do dia por condomínio',
        description: 'Retorna o status de entregas do dia atual agrupado por condomínio. Permite ao admin acompanhar o andamento das entregas em tempo real. Cada condomínio mostra o total de pedidos, quantos foram entregues e quais ainda estão pendentes.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'array',
            description: 'Lista de condomínios com status de entregas do dia.',
            items: {
              type: 'object',
              properties: {
                condominiumId: { type: 'string', description: 'ID do condomínio.' },
                condominiumName: { type: 'string', description: 'Nome do condomínio.' },
                totalOrders: { type: 'integer', description: 'Total de pedidos para hoje neste condomínio.' },
                deliveredCount: { type: 'integer', description: 'Pedidos com status DELIVERED.' },
                pendingCount: { type: 'integer', description: 'Pedidos ainda SCHEDULED ou OUT_FOR_DELIVERY.' },
                courierId: { type: 'string', description: 'ID do entregador atribuído (se houver).' },
                courierName: { type: 'string', description: 'Nome do entregador atribuído.' },
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
        description: 'Gera uma sugestão automática de divisão de condomínios entre os entregadores disponíveis, usando algoritmo greedy para balancear a carga por quantidade de pãezinhos. O admin pode aceitar a sugestão ou ajustar manualmente via /admin/orders/assign-courier. Considera apenas entregadores não bloqueados.',
        security: [{ bearerAuth: [] }],
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
                      totalBreads: { type: 'integer', description: 'Total de pãezinhos neste condomínio.' },
                    },
                  },
                },
                totalBreads: { type: 'integer', description: 'Total de pãezinhos atribuídos a este entregador.' },
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
              updatedCount: { type: 'integer', description: 'Número de pedidos atualizados com o novo entregador.' },
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
        description: 'Atualiza o status de um pedido. Transições válidas: SCHEDULED → OUT_FOR_DELIVERY → DELIVERED. Não é possível regredir status. Quando status=DELIVERED, registra deliveredAt com timestamp atual e dispara push para o cliente.',
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
            status: { type: 'string', enum: ['OUT_FOR_DELIVERY', 'DELIVERED'], description: 'Novo status do pedido. Transições: SCHEDULED→OUT_FOR_DELIVERY ou OUT_FOR_DELIVERY→DELIVERED.' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Status atualizado com sucesso.',
            properties: {
              id: { type: 'string', description: 'ID do pedido.' },
              status: { type: 'string', description: 'Novo status aplicado.' },
              deliveredAt: { type: 'string', description: 'Timestamp de entrega (quando status=DELIVERED).' },
            },
          },
        },
      },
    },
    ctrl.updateOrderStatus.bind(ctrl),
  )
}
