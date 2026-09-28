import { FastifyPluginAsync } from 'fastify'
import { AdminDashboardController } from './admin-dashboard.controller.js'
import { periodQuerystring } from '../../lib/period-query.js'

/**
 * adminDashboardRoute — as faixas novas do Painel (§15 do plano-financeiro-vendas).
 *
 *   GET /admin/dashboard/alerts    — Faixa 0: só o que exige ação, em contagens baratas
 *   GET /admin/dashboard/overview  — Faixas 2/4/6: resultado, base de clientes e posição
 *
 * `GET /admin/dashboard` (operação) continua em `admin-orders`, **intocada** — ela é o que pinta
 * primeiro na tela e não deve esperar por nenhuma destas agregações.
 *
 * Auth: preHandler fastify.authenticate; role check ADMIN no controller.
 *
 * Sem `response` schema de propósito, nos dois casos: o payload é todo aninhado, e o
 * `fast-json-stringify` descarta campo de objeto aninhado em silêncio quando o schema sai de
 * sincronia — a mesma razão documentada em `admin-reports.route.ts`, e exatamente o defeito que
 * hoje existe em `GET /admin/dashboard`.
 */
export const adminDashboardRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminDashboardController(fastify)

  fastify.get(
    '/admin/dashboard/alerts',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — dashboard'],
        summary: 'Central de alertas do painel (admin)',
        description:
          'O que exige ação agora, em contagens: pedidos parados (pão + Cestinha), ganchos aguardando entrega, Cestinhas não entregues SEM desfecho de perda, produtos de estoque FIXO em falta ou na faixa crítica, e clientes cuja última tentativa de pagamento falhou sem pagamento posterior. ' +
          'Zero em tudo = nenhum alerta (a tela não desenha a faixa). Sem cache: é a informação que precisa estar fresca. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
      },
    },
    ctrl.getAlerts.bind(ctrl),
  )

  fastify.get(
    '/admin/dashboard/overview',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — dashboard'],
        summary: 'Visão geral do negócio no período (admin)',
        description:
          'Receita consolidada (crédito + Cestinha + gancho pago, sem GMV) com variação vs período anterior equivalente; base de clientes (ativos, novos, em risco de churn, adoção de recarga automática); e posição patrimonial (passivo de crédito e estoque FIXO a custo). ' +
          'Composto a partir de /admin/financial e /admin/reports/* — nunca reagrega, para painel e relatório não divergirem. ' +
          'Aceita period/month/from-to e `compare`. Cacheado por ~45s por janela. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: periodQuerystring,
      },
    },
    ctrl.getOverview.bind(ctrl),
  )
}
