import { FastifyPluginAsync } from 'fastify'
import { OrdersController } from './orders.controller.js'

/**
 * ordersRoute — registra rotas de pedidos avulsos.
 *
 * T-04-03-01: preHandler: fastify.authenticate garante que apenas usuários
 * autenticados acessam a rota. userId extraído do JWT no controller.
 */
export const ordersRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new OrdersController(fastify)

  fastify.post(
    '/orders',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['orders'],
        summary: 'Criar pedido avulso',
        description: 'Cria um pedido avulso único fora da agenda semanal. Os créditos são debitados imediatamente. O pedido é aceito apenas se: (1) o cliente tem créditos suficientes, (2) a data está no futuro e não está bloqueada pelo corte de pedidos (cutoffTime). Limite de 1 a 20 pãezinhos por pedido avulso.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['quantity', 'scheduledDate'],
          properties: {
            quantity: { type: 'integer', minimum: 1, maximum: 20, description: 'Quantidade de pãezinhos para o pedido avulso (1–20).' },
            scheduledDate: { type: 'string', format: 'date', description: 'Data de entrega no formato ISO (YYYY-MM-DD). Deve ser futura e antes do cutoff do dia.' },
            deliveryTime: { type: 'string', description: 'Horário do slot de entrega escolhido ("HH:MM"). Deve corresponder a um slot ativo do condomínio cujo corte ainda não passou para a data.' },
            paymentId: { type: 'string', description: 'ID do pagamento que financiou este avulso (fluxo "precisa pagar"). Vincula o pedido ao pagamento para eventual estorno de dinheiro. Omitido quando pago só com saldo.' },
          },
        },
        response: {
          201: {
            type: 'object',
            description: 'Pedido criado e créditos debitados.',
            properties: {
              orderId: { type: 'string', description: 'ID do pedido criado (MongoDB ObjectId).' },
              scheduledDate: { type: 'string', description: 'Data de entrega confirmada.' },
              quantity: { type: 'integer', description: 'Quantidade de pãezinhos confirmada.' },
              remainingCredits: { type: 'integer', description: 'Saldo de créditos restantes após o débito.' },
            },
          },
        },
      },
    },
    ctrl.createSingleOrder.bind(ctrl),
  )

  fastify.get(
    '/orders/today',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['orders'],
        summary: 'Pedido de hoje',
        description: 'Retorna o pedido do dia atual do cliente autenticado para exibição no rastreamento. Inclui status de entrega em tempo real. Retorna null se não houver pedido para hoje (dia sem entrega na agenda ou créditos insuficientes no momento da geração).',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            description: 'Pedido do dia atual ou null se não houver pedido.',
            properties: {
              id: { type: 'string', description: 'ID do pedido (MongoDB ObjectId).' },
              quantity: { type: 'integer', description: 'Quantidade de pãezinhos do pedido.' },
              status: { type: 'string', description: 'Status atual: "SCHEDULED" (programado), "OUT_FOR_DELIVERY" (a caminho), "DELIVERED" (entregue).' },
              scheduledDate: { type: 'string', description: 'Data do pedido (hoje).' },
              deliveryTime: { type: 'string', description: 'Horário do slot (HH:MM), quando disponível.' },
              slotId: { type: 'string', description: 'Identificador estável do slot do pedido (manha | tarde).' },
              courierName: { type: 'string', description: 'Nome do entregador atribuído (quando disponível).' },
              deliveredAt: { type: 'string', description: 'Hora de entrega confirmada pelo entregador (ISO 8601), quando disponível.' },
            },
          },
        },
      },
    },
    ctrl.getTodayOrder.bind(ctrl),
  )

  fastify.get(
    '/orders/next',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['orders'],
        summary: 'Próxima entrega futura',
        description: 'Retorna a próxima entrega agendada do cliente (de amanhã em diante), a mais próxima primeiro. Usado pelo card da Home quando não há entrega hoje. Retorna 404 se não houver entrega futura.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            description: 'Próxima entrega futura.',
            properties: {
              id: { type: 'string', description: 'ID do pedido (MongoDB ObjectId).' },
              quantity: { type: 'integer', description: 'Quantidade de pãezinhos do pedido.' },
              status: { type: 'string', description: 'Status: "SCHEDULED" ou "OUT_FOR_DELIVERY".' },
              scheduledDate: { type: 'string', description: 'Data da próxima entrega (ISO 8601).' },
              deliveryTime: { type: 'string', description: 'Horário do slot (HH:MM), quando disponível.' },
              slotId: { type: 'string', description: 'Identificador estável do slot do pedido (manha | tarde).' },
            },
          },
        },
      },
    },
    ctrl.getNextOrder.bind(ctrl),
  )

  fastify.get(
    '/orders/history',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['orders'],
        summary: 'Histórico de pedidos',
        description: 'Retorna o histórico de pedidos do cliente autenticado. Por padrão retorna os últimos 30 dias. Use o parâmetro days para ajustar o período. Inclui pedidos de agenda semanal e pedidos avulsos. Ordenado do mais recente.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            days: { type: 'integer', minimum: 1, maximum: 365, default: 30, description: 'Número de dias para buscar no histórico (padrão: 30, máximo: 365).' },
          },
        },
        response: {
          200: {
            type: 'array',
            description: 'Lista de pedidos do período.',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'ID do pedido.' },
                quantity: { type: 'integer', description: 'Quantidade de pãezinhos.' },
                status: { type: 'string', description: 'Status: "SCHEDULED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED".' },
                scheduledDate: { type: 'string', description: 'Data de entrega programada.' },
                deliveryTime: { type: 'string', description: 'Horário do slot (HH:MM), quando disponível.' },
                slotId: { type: 'string', description: 'Identificador estável do slot do pedido (manha | tarde).' },
                type: { type: 'string', description: 'Tipo: "SCHEDULE" (da agenda) ou "SINGLE" (avulso).' },
                deliveredAt: { type: 'string', description: 'Data/hora de entrega confirmada, se entregue.' },
              },
            },
          },
        },
      },
    },
    ctrl.getOrderHistory.bind(ctrl),
  )
}
