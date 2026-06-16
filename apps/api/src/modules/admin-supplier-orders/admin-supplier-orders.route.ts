// admin-supplier-orders.route.ts — registro de rotas do pedido ao fornecedor
// Padrão baseado em admin-orders.route.ts
// Requirements: ADMO-05..09
// T-07-04-01: preHandler authenticate em todas as rotas
// IMPORTANTE: GET /admin/supplier-orders/draft registrado ANTES de /:id para evitar conflito

import { FastifyPluginAsync } from 'fastify'
import { AdminSupplierOrdersController } from './admin-supplier-orders.controller.js'

/**
 * adminSupplierOrdersRoute — registra rotas de pedido ao fornecedor.
 *
 * Ordem de registro (crítico para evitar conflito /:id vs /draft):
 * 1. GET  /admin/supplier-orders/draft      — rota exata primeiro
 * 2. POST /admin/supplier-orders            — criação
 * 3. GET  /admin/supplier-orders            — histórico
 * 4. PATCH /admin/supplier-orders/:id/finalize
 * 5. GET  /admin/supplier-orders/:id/pdf
 * 6. GET  /admin/supplier-orders/:id/excel
 */
export const adminSupplierOrdersRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminSupplierOrdersController(fastify)

  // 1. Draft — deve vir ANTES de /:id para não ser interceptado como parâmetro
  fastify.get(
    '/admin/supplier-orders/draft',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — supplier-orders'],
        summary: 'Prévia do pedido ao fornecedor (draft)',
        description: 'Gera uma prévia do pedido a ser feito ao fornecedor para amanhã, baseado nas agendas semanais ativas e pedidos avulsos programados. Não persiste nada — apenas calcula e retorna. Use para revisar antes de criar o pedido definitivo via POST /admin/supplier-orders. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            description: 'Prévia do pedido para amanhã.',
            properties: {
              date: { type: 'string', description: 'Data do pedido (amanhã).' },
              totalBreads: { type: 'integer', description: 'Total de pãezinhos necessários para amanhã.' },
              breakdown: {
                type: 'array',
                description: 'Detalhamento por condomínio.',
                items: {
                  type: 'object',
                  properties: {
                    condominiumName: { type: 'string', description: 'Nome do condomínio.' },
                    quantity: { type: 'integer', description: 'Pãezinhos necessários neste condomínio.' },
                  },
                },
              },
            },
          },
        },
      },
    },
    ctrl.getDraft.bind(ctrl),
  )

  // 2. Criar pedido
  fastify.post(
    '/admin/supplier-orders',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — supplier-orders'],
        summary: 'Criar pedido ao fornecedor (admin)',
        description: 'Cria um pedido definitivo ao fornecedor com status DRAFT. Um pedido deve ser criado por dia para amanhã. O cutoffTime pode ser sobrescrito para este pedido específico. Items define a quantidade a pedir de cada fornecedor (normalmente apenas o fornecedor principal). Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              description: 'Lista de itens do pedido, um por fornecedor.',
              items: {
                type: 'object',
                required: ['supplierId', 'quantity'],
                properties: {
                  supplierId: { type: 'string', description: 'ID do fornecedor (MongoDB ObjectId).' },
                  quantity: { type: 'integer', minimum: 1, description: 'Quantidade de pãezinhos a pedir.' },
                },
              },
            },
            cutoffTime: { type: 'string', description: 'Horário de corte específico para este pedido (HH:MM). Opcional — usa o configurado no sistema se omitido.' },
          },
        },
        response: {
          201: {
            type: 'object',
            description: 'Pedido ao fornecedor criado com status DRAFT.',
            properties: {
              id: { type: 'string', description: 'ID do pedido ao fornecedor.' },
              status: { type: 'string', description: 'Status inicial: sempre "DRAFT".' },
              totalQuantity: { type: 'integer', description: 'Total de pãezinhos no pedido.' },
              createdAt: { type: 'string', description: 'Data/hora de criação.' },
            },
          },
        },
      },
    },
    ctrl.create.bind(ctrl),
  )

  // 3. Histórico de pedidos FINALIZED
  fastify.get(
    '/admin/supplier-orders',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — supplier-orders'],
        summary: 'Histórico de pedidos ao fornecedor (admin)',
        description: 'Retorna o histórico de pedidos ao fornecedor com status FINALIZED. Pedidos DRAFT não são listados aqui. Ordenado do mais recente. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'array',
            description: 'Lista de pedidos finalizados.',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'ID do pedido.' },
                status: { type: 'string', description: 'Status: sempre FINALIZED nesta listagem.' },
                totalQuantity: { type: 'integer', description: 'Total de pãezinhos pedidos.' },
                createdAt: { type: 'string', description: 'Data/hora de criação.' },
                finalizedAt: { type: 'string', description: 'Data/hora de finalização.' },
              },
            },
          },
        },
      },
    },
    ctrl.getHistory.bind(ctrl),
  )

  // 4. Finalizar pedido
  fastify.patch(
    '/admin/supplier-orders/:id/finalize',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — supplier-orders'],
        summary: 'Finalizar pedido ao fornecedor (admin)',
        description: 'Transiciona o pedido do status DRAFT para FINALIZED. Pedidos finalizados não podem ser alterados. A finalização confirma o pedido junto ao fornecedor. Apenas pedidos em status DRAFT podem ser finalizados. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do pedido ao fornecedor (MongoDB ObjectId).' },
          },
        },
        response: {
          200: {
            type: 'object',
            description: 'Pedido finalizado com sucesso.',
            properties: {
              id: { type: 'string', description: 'ID do pedido.' },
              status: { type: 'string', description: 'Novo status: "FINALIZED".' },
              finalizedAt: { type: 'string', description: 'Timestamp de finalização.' },
            },
          },
        },
      },
    },
    ctrl.finalize.bind(ctrl),
  )

  // 5. Download PDF — produces application/pdf
  fastify.get(
    '/admin/supplier-orders/:id/pdf',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — supplier-orders'],
        summary: 'Download PDF do pedido ao fornecedor (admin)',
        description: 'Gera e retorna o PDF do pedido ao fornecedor para envio/impressão. Produz arquivo application/pdf. O PDF contém detalhamento completo do pedido: fornecedor, itens, quantidades e data. Funciona para pedidos DRAFT e FINALIZED. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do pedido ao fornecedor (MongoDB ObjectId).' },
          },
        },
      },
    },
    ctrl.getPdf.bind(ctrl),
  )

  // 6. Download Excel — produces application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  fastify.get(
    '/admin/supplier-orders/:id/excel',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — supplier-orders'],
        summary: 'Download Excel do pedido ao fornecedor (admin)',
        description: 'Gera e retorna o Excel (.xlsx) do pedido ao fornecedor. Produz arquivo application/vnd.openxmlformats-officedocument.spreadsheetml.sheet. Útil para análises e controle em planilha. Funciona para pedidos DRAFT e FINALIZED. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', description: 'ID do pedido ao fornecedor (MongoDB ObjectId).' },
          },
        },
      },
    },
    ctrl.getExcel.bind(ctrl),
  )
}
