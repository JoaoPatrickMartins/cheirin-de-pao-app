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
 *   PATCH /admin/separation/conclude         — conclui um lote (condomínio + turno) → libera p/ entrega
 *
 * IMPORTANTE: a rota estática /conclude fica ANTES da dinâmica /orders/:id (não há
 * conflito real, mas mantém o padrão das demais rotas admin).
 */
export const adminSeparationRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminSeparationController(fastify)

  const orderProps = {
    orderId: { type: 'string' },
    userId: { type: 'string' },
    name: { type: 'string' },
    block: { type: 'string' },
    apartment: { type: 'string' },
    quantity: { type: 'integer' },
    slotId: { type: 'string' },
    slotLabel: { type: 'string' },
    type: { type: 'string' },
    status: { type: 'string' },
    separated: { type: 'boolean' },
  }

  const slotProps = {
    slotId: { type: 'string' },
    slotLabel: { type: 'string' },
    totalDeliveries: { type: 'integer' },
    separatedDeliveries: { type: 'integer' },
    totalBreads: { type: 'integer' },
    separatedBreads: { type: 'integer' },
    concluded: { type: 'boolean' },
    orders: { type: 'array', items: { type: 'object', properties: orderProps } },
  }

  const condoProps = {
    condominiumId: { type: 'string' },
    name: { type: 'string' },
    totalDeliveries: { type: 'integer' },
    separatedDeliveries: { type: 'integer' },
    totalBreads: { type: 'integer' },
    separatedBreads: { type: 'integer' },
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
              condominiums: { type: 'array', items: { type: 'object', properties: condoProps } },
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
