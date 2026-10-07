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
        description: 'Cria um pedido avulso único fora da agenda semanal. Os créditos são debitados imediatamente. O pedido é aceito apenas se: (1) o cliente tem créditos suficientes, (2) a data está no futuro e não está bloqueada pelo corte de pedidos (cutoffTime). Limite de 1 a 100 pãezinhos por pedido avulso.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['quantity', 'scheduledDate'],
          properties: {
            quantity: { type: 'integer', minimum: 1, maximum: 100, description: 'Quantidade de pãezinhos para o pedido avulso (1–100). Alinhado ao Zod CreateOrderSchema e ao PEDIDO_UNICO_MAX do front.' },
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

  fastify.patch(
    '/orders/:id/cancel',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['orders'],
        summary: 'Cancelar pedido único',
        description: 'Cancela um pedido único (avulso) do próprio cliente e devolve os pães ao saldo. Só é permitido enquanto o horário de corte daquele pedido não passou; após o corte responde 422 com code "CUTOFF_PASSED". O estorno de créditos é idempotente.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do pedido a cancelar (MongoDB ObjectId).' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Pedido cancelado e pães devolvidos ao saldo.',
            properties: {
              id: { type: 'string', description: 'ID do pedido cancelado.' },
              status: { type: 'string', description: 'Novo status: "CANCELLED".' },
              // `integer` de propósito: pedido de PÃO devolve pão inteiro (Order.quantity). O
              // decimal só existe na Cestinha, que tem rota própria.
              refundedCredits: { type: 'integer', description: 'Quantidade de pães devolvidos ao saldo (0 se já havia sido estornado).' },
              creditBalance: { type: 'number', description: 'Saldo de pãezinhos do cliente após o estorno (decimal — o crédito é fracionado).' },
            },
          },
        },
      },
    },
    ctrl.cancelSingleOrder.bind(ctrl),
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
              failedAt: { type: 'string', nullable: true, description: 'Quando foi marcado como não entregue (ISO 8601).' },
              failureText: { type: 'string', nullable: true, description: 'Motivo da não entrega em linguagem do cliente (completa "Tentamos entregar, mas ___").' },
              proof: {
                type: 'object',
                description: 'Comprovante (foto) da entrega — só com a função ligada pelo admin, por 90 dias.',
                properties: { available: { type: 'boolean' }, expired: { type: 'boolean' } },
              },
              onTheWayAt: { type: 'string', nullable: true, description: 'Quando o entregador iniciou a rota do turno (ISO). null antes disso — o "a caminho" só acende depois (D-7).' },
              courier: {
                type: 'object',
                nullable: true,
                description: 'Quem traz o pão (primeiro nome + foto) — só com a rota iniciada.',
                properties: { firstName: { type: 'string' }, photoUrl: { type: 'string', nullable: true } },
              },
            },
          },
        },
      },
    },
    ctrl.getTodayOrder.bind(ctrl),
  )

  fastify.get(
    '/orders/:id/proof',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['orders'],
        summary: 'Foto da entrega (comprovante)',
        description: 'URL ASSINADA (10 min) da foto do comprovante de um pedido do próprio cliente. Só com a função ligada pelo admin e por 90 dias. 404 quando não há foto para mostrar — inclusive para pedido de outro cliente.',
        security: [{ bearerAuth: [] }],
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        response: {
          200: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'URL assinada da foto (expira em 10 min).' },
              at: { type: 'string', description: 'Quando a foto foi tirada (ISO 8601).' },
              outcome: { type: 'string', description: 'DELIVERED | NOT_DELIVERED.' },
            },
          },
        },
      },
    },
    ctrl.getOrderProof.bind(ctrl),
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
                failedAt: { type: 'string', nullable: true, description: 'Quando foi marcado como não entregue (ISO 8601).' },
                failureText: { type: 'string', nullable: true, description: 'Motivo da não entrega em linguagem do cliente (completa "Tentamos entregar, mas ___").' },
                proof: {
                  type: 'object',
                  description: 'Comprovante (foto) da entrega — só com a função ligada pelo admin, por 90 dias.',
                  properties: { available: { type: 'boolean' }, expired: { type: 'boolean' } },
                },
              },
            },
          },
        },
      },
    },
    ctrl.getOrderHistory.bind(ctrl),
  )

  fastify.get(
    '/orders/availability',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['orders'],
        summary: 'Disponibilidade de datas para pedido único e Cestinha',
        description: 'Retorna, a partir de hoje (BRT), para cada data da janela: se a data não aceita entrega (blocked — por dia da semana bloqueado OU por bloqueio de data/período), o motivo do bloqueio de data quando houver (reason) e se o limite de pedidos daquele dia já foi atingido (full). Tudo resolvido no escopo do condomínio do cliente autenticado. Usado para desabilitar dias na régua do pedido único e da Cestinha.',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            days: { type: 'integer', minimum: 1, maximum: 60, default: 14, description: 'Tamanho da janela em dias (padrão 14).' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Disponibilidade por data.',
            properties: {
              availability: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    date: { type: 'string', description: 'Data no formato YYYY-MM-DD (BRT).' },
                    blocked: { type: 'boolean', description: 'true se a data não aceita entrega (dia da semana bloqueado ou data/período bloqueado).' },
                    full: { type: 'boolean', description: 'true se o limite de pedidos do dia já foi atingido.' },
                    reason: { type: 'string', description: 'Motivo do bloqueio de data, quando informado pelo admin (ex.: "Feriado"). Ausente em dias liberados ou bloqueados apenas por dia da semana.' },
                  },
                },
              },
            },
          },
        },
      },
    },
    ctrl.getAvailability.bind(ctrl),
  )
}
