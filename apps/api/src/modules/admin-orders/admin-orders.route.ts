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
    { preHandler: [fastify.authenticate] },
    ctrl.dashboard.bind(ctrl),
  )

  // GET /admin/orders/delivery-status — status de entregas do dia agrupadas por condomínio (07-06)
  fastify.get(
    '/admin/orders/delivery-status',
    { preHandler: [fastify.authenticate] },
    ctrl.deliveryStatus.bind(ctrl),
  )

  // GET /admin/orders/division-suggestion — sugestão greedy de divisão entre entregadores (07-06)
  fastify.get(
    '/admin/orders/division-suggestion',
    { preHandler: [fastify.authenticate] },
    ctrl.divisionSuggestion.bind(ctrl),
  )

  // D-13: endpoint de atribuicao de entregador em batch
  // Role check ADMIN fica no controller (per D-11)
  fastify.patch(
    '/admin/orders/assign-courier',
    { preHandler: [fastify.authenticate] },
    ctrl.assignCourier.bind(ctrl),
  )

  // ACOMP-01: transição de status pelo Admin (rota dinâmica — deve ficar por último)
  fastify.patch(
    '/admin/orders/:id/status',
    { preHandler: [fastify.authenticate] },
    ctrl.updateOrderStatus.bind(ctrl),
  )
}
