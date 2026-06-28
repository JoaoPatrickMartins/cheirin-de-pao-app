import { FastifyPluginAsync } from 'fastify'
import { AdminReportsController } from './admin-reports.controller.js'

/**
 * adminReportsRoute — Relatórios do admin (módulo "Relatórios").
 *
 * GET /admin/reports/access — métricas de acesso, login de clientes e conversão.
 *
 * Auth: preHandler fastify.authenticate; role check ADMIN no controller.
 * Sem `response` schema propositalmente — evita o fast-json-stringify descartar
 * campos do objeto aninhado (vide histórico de schemas desalinhados no admin).
 */
export const adminReportsRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminReportsController(fastify)

  const periodQuerystring = {
    type: 'object',
    properties: {
      period: {
        type: 'string',
        enum: ['day', 'week', 'month'],
        description: 'Período de análise. Padrão: "week".',
      },
    },
  }

  fastify.get(
    '/admin/reports/access',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — reports'],
        summary: 'Relatório de acesso, login e conversão (admin)',
        description:
          'Métricas de aquisição no período: acessos (total e visitantes únicos), logins de clientes (total e clientes únicos), conversão acesso→login e série diária. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: periodQuerystring,
      },
    },
    ctrl.getAccess.bind(ctrl),
  )

  fastify.get(
    '/admin/reports/retention',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — reports'],
        summary: 'Saúde da recorrência (admin)',
        description:
          'Adoção de recarga automática, churn por esgotamento de crédito, recompra & autonomia e funil de ativação. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: periodQuerystring,
      },
    },
    ctrl.getRetention.bind(ctrl),
  )

  fastify.get(
    '/admin/reports/credit-liability',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — reports'],
        summary: 'Passivo de crédito / receita diferida (admin)',
        description:
          'Créditos em circulação (passivo) e estimativa em R$ a partir do preço médio histórico por crédito. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
      },
    },
    ctrl.getCreditLiability.bind(ctrl),
  )

  fastify.get(
    '/admin/reports/condominiums',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — reports'],
        summary: 'Ranking de condomínios (admin)',
        description:
          'Receita, clientes ativos e pães entregues por condomínio no período, ordenado por receita. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: periodQuerystring,
      },
    },
    ctrl.getCondominiums.bind(ctrl),
  )

  fastify.get(
    '/admin/reports/delivery',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — reports'],
        summary: 'Entregas & falhas (admin)',
        description:
          'Taxa de entrega, contagem por status e motivos de não-entrega/cancelamento no período. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: periodQuerystring,
      },
    },
    ctrl.getDelivery.bind(ctrl),
  )

  fastify.get(
    '/admin/reports/waste',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — reports'],
        summary: 'Desperdício: pedido × entregue (admin)',
        description:
          'Pães comprados do fornecedor (pedidos finalizados) vs efetivamente entregues no período. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: periodQuerystring,
      },
    },
    ctrl.getWaste.bind(ctrl),
  )

  fastify.get(
    '/admin/reports/schedule-profile',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — reports'],
        summary: 'Perfil da agenda (admin)',
        description:
          'Pães/semana agendados, distribuição por dia da semana e mix de pedidos único×recorrente. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: periodQuerystring,
      },
    },
    ctrl.getScheduleProfile.bind(ctrl),
  )

  fastify.get(
    '/admin/reports/payments',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — reports'],
        summary: 'Pagamentos: aprovação, estorno e mix (admin)',
        description:
          'Taxa de aprovação, estorno, mix Pix/cartão e recuperação de pagamento falho no período. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: periodQuerystring,
      },
    },
    ctrl.getPayments.bind(ctrl),
  )
}
