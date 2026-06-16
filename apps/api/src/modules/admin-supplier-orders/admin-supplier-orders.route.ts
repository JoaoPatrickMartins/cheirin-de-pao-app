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
    { preHandler: [fastify.authenticate] },
    ctrl.getDraft.bind(ctrl),
  )

  // 2. Criar pedido
  fastify.post(
    '/admin/supplier-orders',
    { preHandler: [fastify.authenticate] },
    ctrl.create.bind(ctrl),
  )

  // 3. Histórico de pedidos FINALIZED
  fastify.get(
    '/admin/supplier-orders',
    { preHandler: [fastify.authenticate] },
    ctrl.getHistory.bind(ctrl),
  )

  // 4. Finalizar pedido
  fastify.patch(
    '/admin/supplier-orders/:id/finalize',
    { preHandler: [fastify.authenticate] },
    ctrl.finalize.bind(ctrl),
  )

  // 5. Download PDF
  fastify.get(
    '/admin/supplier-orders/:id/pdf',
    { preHandler: [fastify.authenticate] },
    ctrl.getPdf.bind(ctrl),
  )

  // 6. Download Excel
  fastify.get(
    '/admin/supplier-orders/:id/excel',
    { preHandler: [fastify.authenticate] },
    ctrl.getExcel.bind(ctrl),
  )
}
