import { FastifyPluginAsync } from 'fastify'
import { AdminSeparationController } from './admin-separation.controller.js'

/**
 * adminSeparationRoute — rotas da etapa de Separação (entre o corte e a entrega).
 *
 * preHandler: [fastify.authenticate] garante JWT; role check ADMIN é inline no controller.
 *
 * Rotas:
 *   GET   /admin/separation/board            — pedidos do dia agrupados por condomínio → turno → cliente
 *   PATCH /admin/separation/orders/:id       — marca/desmarca um pedido como separado
 *   PATCH /admin/separation/market-orders    — marca/desmarca uma parada só-Cestinha
 *   PATCH /admin/separation/conclude         — conclui um lote (condomínio + turno) → libera p/ entrega
 *
 * IMPORTANTE: a rota estática /conclude fica ANTES da dinâmica /orders/:id (não há
 * conflito real, mas mantém o padrão das demais rotas admin).
 */
export const adminSeparationRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminSeparationController(fastify)

  // Itens do mini market ("Além do Pãozin") que pegam carona na mesma parada.
  const marketItemProps = {
    type: 'array',
    items: { type: 'object', properties: { name: { type: 'string' }, qty: { type: 'integer' } } },
  }

  // Lista consolidada "quanto pegar da prateleira" — agregada por produto.
  const marketPicklistProps = {
    type: 'array',
    description: 'Produtos do mercadinho a separar, agregados por produto.',
    items: {
      type: 'object',
      properties: {
        productId: { type: 'string' },
        name: { type: 'string' },
        qty: { type: 'integer' },
      },
    },
  }

  const orderProps = {
    orderId: { type: 'string' },
    userId: { type: 'string' },
    name: { type: 'string' },
    block: { type: 'string' },
    complement: { type: 'string' },
    apartment: { type: 'string' },
    quantity: { type: 'integer' },
    slotId: { type: 'string' },
    slotLabel: { type: 'string' },
    type: { type: 'string' },
    status: { type: 'string' },
    separated: { type: 'boolean' },
    // Market: id do MarketOrder (em parada só-market), itens e contagem de itens de produto.
    marketOrderId: { type: 'string' },
    // Todas as Cestinhas da parada — o toggle de separação precisa da lista inteira.
    marketOrderIds: { type: 'array', items: { type: 'string' } },
    marketItems: marketItemProps,
    marketItemCount: { type: 'integer' },
  }

  const slotProps = {
    slotId: { type: 'string' },
    slotLabel: { type: 'string' },
    totalDeliveries: { type: 'integer' },
    separatedDeliveries: { type: 'integer' },
    totalBreads: { type: 'integer' },
    separatedBreads: { type: 'integer' },
    totalItems: { type: 'integer' },
    separatedItems: { type: 'integer' },
    concluded: { type: 'boolean' },
    orders: { type: 'array', items: { type: 'object', properties: orderProps } },
    marketPicklist: marketPicklistProps,
  }

  const condoProps = {
    condominiumId: { type: 'string' },
    name: { type: 'string' },
    totalDeliveries: { type: 'integer' },
    separatedDeliveries: { type: 'integer' },
    totalBreads: { type: 'integer' },
    separatedBreads: { type: 'integer' },
    totalItems: { type: 'integer' },
    separatedItems: { type: 'integer' },
    slots: { type: 'array', items: { type: 'object', properties: slotProps } },
  }

  // GET /admin/separation/board
  fastify.get(
    '/admin/separation/board',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — separation'],
        summary: 'Quadro de separação do dia',
        description:
          'Retorna os pedidos materializados de uma data de entrega (default: hoje BRT), agrupados por condomínio → turno → cliente, com o status de separação de cada um. É a base da tela de Separação, onde o operador confere, imprime o cupom e conclui cada lote (condomínio + turno).',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Data de entrega (YYYY-MM-DD, BRT). Default: hoje.' },
            slotId: { type: 'string', description: 'Turno (manha/tarde). Omitido = todos os turnos do dia.' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              date: { type: 'string' },
              totalDeliveries: { type: 'integer' },
              separatedDeliveries: { type: 'integer' },
              totalBreads: { type: 'integer' },
              separatedBreads: { type: 'integer' },
              totalItems: { type: 'integer' },
              separatedItems: { type: 'integer' },
              condominiums: { type: 'array', items: { type: 'object', properties: condoProps } },
              marketPicklist: marketPicklistProps,
            },
          },
        },
      },
    },
    ctrl.board.bind(ctrl),
  )

  // PATCH /admin/separation/conclude
  fastify.patch(
    '/admin/separation/conclude',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — separation'],
        summary: 'Concluir separação de um lote',
        description:
          'Conclui a separação de um lote físico (condomínio + turno) de uma data: move todos os pedidos SCHEDULED do escopo para SEPARATED, liberando-os para a divisão de entregas. Idempotente.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['condominiumId', 'slotId'],
          properties: {
            condominiumId: { type: 'string', description: 'ID do condomínio.' },
            slotId: { type: 'string', description: "ID do turno; '' para pedidos sem turno." },
            date: { type: 'string', description: 'Data de entrega (YYYY-MM-DD, BRT). Default: hoje.' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              count: { type: 'integer', description: 'Quantos pedidos foram movidos para SEPARATED.' },
            },
          },
        },
      },
    },
    ctrl.conclude.bind(ctrl),
  )

  // PATCH /admin/separation/market-orders (estática, antes da dinâmica /orders/:id)
  fastify.patch(
    '/admin/separation/market-orders',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — separation'],
        summary: 'Marcar/desmarcar Cestinha como separada',
        description:
          'Alterna a separação de uma parada SÓ-Cestinha (cliente sem pedido de pão no turno): SCHEDULED ↔ SEPARATED. Recebe todos os MarketOrder da parada, já que um cliente pode ter mais de uma Cestinha no mesmo turno. Idempotente.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['marketOrderIds', 'separated'],
          properties: {
            marketOrderIds: {
              type: 'array',
              minItems: 1,
              items: { type: 'string' },
              description: 'IDs dos MarketOrder da parada.',
            },
            separated: { type: 'boolean', description: 'true = separada (SEPARATED); false = desfazer (SCHEDULED).' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              count: { type: 'integer', description: 'Quantas cestinhas mudaram de status.' },
              status: { type: 'string' },
            },
          },
        },
      },
    },
    ctrl.setMarketSeparated.bind(ctrl),
  )

  // PATCH /admin/separation/orders/:id
  fastify.patch(
    '/admin/separation/orders/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — separation'],
        summary: 'Marcar/desmarcar pedido como separado',
        description:
          'Alterna o status de separação de um pedido (SCHEDULED ↔ SEPARATED). Idempotente quando já no estado desejado.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', description: 'ID do pedido (MongoDB ObjectId).' } },
        },
        body: {
          type: 'object',
          required: ['separated'],
          properties: {
            separated: { type: 'boolean', description: 'true = separado (SEPARATED); false = desfazer (SCHEDULED).' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              orderId: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
      },
    },
    ctrl.setSeparated.bind(ctrl),
  )
}
