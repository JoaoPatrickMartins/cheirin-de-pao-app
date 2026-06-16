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
            description: 'Pedidos do dia agrupados por condomínio com rota otimizada.',
            properties: {
              route: {
                type: 'array',
                description: 'Sequência otimizada de condomínios para entrega (ordem sugerida pelo OSRM).',
                items: {
                  type: 'object',
                  properties: {
                    condominiumId: { type: 'string', description: 'ID do condomínio.' },
                    condominiumName: { type: 'string', description: 'Nome do condomínio.' },
                    address: { type: 'string', description: 'Endereço completo para navegação.' },
                    coordinates: {
                      type: 'object',
                      description: 'Coordenadas para o mapa Leaflet.',
                      properties: {
                        lat: { type: 'number', description: 'Latitude.' },
                        lng: { type: 'number', description: 'Longitude.' },
                      },
                    },
                    orders: {
                      type: 'array',
                      description: 'Pedidos a entregar neste condomínio.',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', description: 'ID do pedido.' },
                          clientName: { type: 'string', description: 'Nome do cliente.' },
                          apartment: { type: 'string', description: 'Apartamento.' },
                          block: { type: 'string', description: 'Bloco (se aplicável).' },
                          quantity: { type: 'integer', description: 'Quantidade de pãezinhos.' },
                          status: { type: 'string', description: 'Status atual do pedido.' },
                        },
                      },
                    },
                  },
                },
              },
              totalBreads: { type: 'integer', description: 'Total de pãezinhos a entregar hoje.' },
              totalOrders: { type: 'integer', description: 'Total de pedidos a entregar hoje.' },
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
}
