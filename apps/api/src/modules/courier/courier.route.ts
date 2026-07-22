import { FastifyPluginAsync } from 'fastify'
import { CourierController } from './courier.controller.js'

/**
 * courierRoute — registra rotas do entregador.
 *
 * T-06-02: preHandler [fastify.authenticate, fastify.requireCourier] em AMBAS as rotas:
 * - fastify.authenticate: valida JWT e popula request.user
 * - fastify.requireCourier: bloqueia roles != COURIER com 403
 *
 * D-12: Rotas do modulo courier.
 */
export const courierRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new CourierController(fastify)

  // GET /courier/orders/today — lista ordens do dia para o entregador logado
  fastify.get(
    '/courier/orders/today',
    {
      preHandler: [fastify.authenticate, fastify.requireCourier],
      schema: {
        tags: ['courier'],
        summary: 'Pedidos do dia para o entregador',
        description: 'Retorna todos os pedidos do dia atual atribuídos ao entregador autenticado, agrupados por condomínio com rota otimizada via OSRM. A rota é calculada automaticamente usando OpenStreetMap + OSRM para minimizar o percurso. Apenas entregadores com role=COURIER podem acessar.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            description: 'Pedidos do dia agrupados por condomínio (condos) + rota otimizada (route).',
            properties: {
              condos: {
                type: 'array',
                description: 'Condomínios da rota, cada um com seus stops (pedidos) ordenados por apartamento.',
                items: {
                  type: 'object',
                  properties: {
                    condominiumId: { type: 'string', description: 'ID do condomínio.' },
                    condominiumName: { type: 'string', description: 'Nome do condomínio.' },
                    address: { type: 'string', description: 'Endereço completo para navegação.' },
                    lat: { type: 'number', nullable: true, description: 'Latitude (null se não geocodificado).' },
                    lng: { type: 'number', nullable: true, description: 'Longitude (null se não geocodificado).' },
                    stops: {
                      type: 'array',
                      description: 'Pedidos a entregar neste condomínio.',
                      items: {
                        type: 'object',
                        properties: {
                          orderId: { type: 'string', description: 'ID do pedido.' },
                          apartment: { type: 'string', description: 'Apartamento.' },
                          block: { type: 'string', nullable: true, description: 'Bloco (se aplicável).' },
                          clientName: { type: 'string', description: 'Nome do cliente.' },
                          quantity: { type: 'integer', description: 'Quantidade de pãezinhos.' },
                          status: { type: 'string', description: 'Status atual do pedido.' },
                          sortKey: { type: 'integer', description: 'Chave de ordenação (apartamento numérico).' },
                          slotId: { type: 'string', description: 'Turno (manha/tarde) da entrega.' },
                          slotLabel: { type: 'string', description: 'Rótulo do turno (ex.: Manhã, Tarde).' },
                        },
                      },
                    },
                  },
                },
              },
              totalStops: { type: 'integer', description: 'Total de pedidos/paradas a entregar hoje.' },
              totalBreads: { type: 'integer', description: 'Total de pãezinhos a entregar hoje.' },
              completed: {
                type: 'array',
                description: 'Entregas já concluídas hoje (entregues ou não entregues), agrupadas por condomínio.',
                items: {
                  type: 'object',
                  properties: {
                    condominiumId: { type: 'string', description: 'ID do condomínio.' },
                    condominiumName: { type: 'string', description: 'Nome do condomínio.' },
                    stops: {
                      type: 'array',
                      description: 'Entregas concluídas neste condomínio (ordenadas por bloco/apartamento).',
                      items: {
                        type: 'object',
                        properties: {
                          orderId: { type: 'string', description: 'ID do pedido.' },
                          apartment: { type: 'string', description: 'Apartamento.' },
                          block: { type: 'string', nullable: true, description: 'Bloco (se aplicável).' },
                          clientName: { type: 'string', description: 'Nome do cliente.' },
                          quantity: { type: 'integer', description: 'Quantidade de pãezinhos.' },
                          status: { type: 'string', description: 'DELIVERED ou NOT_DELIVERED.' },
                          slotId: { type: 'string', description: 'Turno (manha/tarde) da entrega.' },
                          slotLabel: { type: 'string', description: 'Rótulo do turno.' },
                          completedAt: { type: 'string', nullable: true, description: 'Instante da conclusão (ISO 8601).' },
                        },
                      },
                    },
                  },
                },
              },
              completedTotal: { type: 'integer', description: 'Total de entregas concluídas hoje.' },
              slots: {
                type: 'array',
                description: 'Turnos distintos presentes na rota de hoje (ordenados por horário).',
                items: {
                  type: 'object',
                  properties: {
                    slotId: { type: 'string', description: 'ID do turno (manha/tarde).' },
                    label: { type: 'string', description: 'Rótulo do turno (ex.: Manhã).' },
                    emoji: { type: 'string', description: 'Emoji do turno (ex.: ☀️).' },
                    time: { type: 'string', description: 'Horário de entrega do turno (HH:mm).' },
                  },
                },
              },
              route: {
                type: 'object',
                nullable: true,
                description: 'Rota OSRM otimizada (null quando OSRM falha ou há menos de 2 paradas geocodificadas).',
                properties: {
                  distanceKm: { type: 'string', description: 'Distância total em km (1 casa decimal).' },
                  durationMin: { type: 'integer', description: 'Duração estimada em minutos.' },
                  geometry: {
                    type: 'array',
                    description: 'Polilinha [lat, lng] para o Leaflet.',
                    items: { type: 'array', items: { type: 'number' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    ctrl.getTodayOrders.bind(ctrl),
  )

  // PATCH /courier/orders/:id/confirm — confirma entrega de um pedido
  fastify.patch(
    '/courier/orders/:id/confirm',
    {
      preHandler: [fastify.authenticate, fastify.requireCourier],
      schema: {
        tags: ['courier'],
        summary: 'Confirmar entrega de pedido',
        description: 'Confirma a entrega de um pedido específico pelo entregador. Transiciona o status para DELIVERED, registra o timestamp de entrega e dispara uma notificação push para o cliente via OneSignal informando que o pão chegou. O entregador só pode confirmar pedidos atribuídos a ele.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do pedido a confirmar (MongoDB ObjectId).' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Entrega confirmada com sucesso.',
            properties: {
              id: { type: 'string', description: 'ID do pedido.' },
              status: { type: 'string', description: 'Novo status: "DELIVERED".' },
              deliveredAt: { type: 'string', description: 'Timestamp de confirmação da entrega (ISO 8601).' },
            },
          },
        },
      },
    },
    ctrl.confirmDelivery.bind(ctrl),
  )

  // PATCH /courier/orders/:id/not-delivered — marca a entrega como não realizada
  fastify.patch(
    '/courier/orders/:id/not-delivered',
    {
      preHandler: [fastify.authenticate, fastify.requireCourier],
      schema: {
        tags: ['courier'],
        summary: 'Marcar entrega como não realizada',
        description:
          'Registra que um pedido não pôde ser entregue (cliente ausente, endereço, etc.), transicionando o status para NOT_DELIVERED com o motivo. O entregador só pode marcar pedidos atribuídos a ele. O crédito do cliente permanece debitado (estorno é decisão manual do admin).',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', description: 'ID do pedido (MongoDB ObjectId).' } },
        },
        body: {
          type: 'object',
          properties: { reason: { type: 'string', description: 'Motivo da não-entrega.' } },
        },
        response: {
          200: {
            type: 'object',
            properties: { ok: { type: 'boolean', description: 'Indica sucesso da operação.' } },
          },
        },
      },
    },
    ctrl.markNotDelivered.bind(ctrl),
  )
}
