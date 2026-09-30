import { FastifyPluginAsync } from 'fastify'
import { AdminReportsController } from './admin-reports.controller.js'
import { periodQuerystring } from '../../lib/period-query.js'

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
          'Adoção de recarga automática, churn por esgotamento de crédito, recompra & autonomia e funil de ativação. `creditsConsumed` inclui os pãezinhos gastos na Cestinha (`MARKET_PURCHASE`) e `withDelivery` conta quem recebeu pão OU Cestinha. Restrito a ADMIN.',
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
          'Receita, clientes ativos e pães entregues por condomínio no período, ordenado por receita. `revenue` é a receita CONSOLIDADA (D-2: `creditRevenue` + `marketRevenue`, o dinheiro novo da Cestinha); `breadsDelivered` inclui o pão vendido dentro da Cestinha (D-1) e `cestinhaGmv` é o valor movimentado, que NUNCA é somado à receita. Restrito a ADMIN.',
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
          'Taxa de entrega, contagem por status e motivos de não-entrega/cancelamento no período, medindo a operação inteira — pedidos de pão E Cestinhas —, com `byKind` separando as duas populações. Cestinha em `PENDING_PAYMENT` fica fora (nunca confirmou). Restrito a ADMIN.',
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
          'Taxa de aprovação, estorno, mix Pix/cartão, quebra por finalidade (`byPurpose`: CREDITS | HOOK | MARKET — cada fluxo com a sua taxa de aprovação) e recuperação de pagamento falho no período. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: periodQuerystring,
      },
    },
    ctrl.getPayments.bind(ctrl),
  )

  fastify.get(
    '/admin/reports/sales',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — reports'],
        summary: 'Vendas & performance (admin)',
        description:
          'Vendas do período item a item, curva ABC, mix de canal, ticket médio, receita por combo e performance por condomínio. ' +
          '**Duas bases que não fecham entre si, de propósito:** `sales` é apurado pelo DIA DE ENTREGA (`scheduledDate`) e mede VOLUME; ' +
          '`channel`/`ticket`/`combos` saem da DATA DO PAGAMENTO (`Payment.createdAt`) e medem RECEITA — no modelo pré-pago o pão entregue ' +
          'num período pode ter sido pago em outro. As ressalvas viajam em `caveats`. Comparativo LIGADO por padrão (`compare=false` desliga). Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: periodQuerystring,
      },
    },
    ctrl.getSales.bind(ctrl),
  )

  fastify.get(
    '/admin/reports/customers',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — reports'],
        summary: 'Top clientes, LTV e novos × recorrentes (admin)',
        description:
          'Ranking de clientes por receita no período, com LTV (receita acumulada desde sempre, só para o topo), concentração nos 5/10 maiores ' +
          'e a quebra novos × base. "Novo" é quem se CADASTROU no período — a ressalva viaja em `caveats`. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: periodQuerystring,
      },
    },
    ctrl.getCustomers.bind(ctrl),
  )

  fastify.get(
    '/admin/reports/credit-movement',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — reports'],
        summary: 'Movimentação do passivo de crédito (admin)',
        description:
          'Por que o passivo mudou no período: vendido, consumido, concedido, estornado, expirado (F7). A tela de Passivo responde QUANTO se deve em pão; esta responde POR QUE mudou — e a causa muda a leitura (venda de combo é ótimo, cortesia em massa nem tanto). ' +
          'Traz também o recorte 🚩A2: `TransactionType.EXPIRY` existe no enum e NUNCA é escrito, ou seja, crédito não expira e o passivo cresce para sempre — `inactive` mede o saldo parado há mais de 12 meses. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: periodQuerystring,
      },
    },
    ctrl.getCreditMovement.bind(ctrl),
  )

  fastify.get(
    '/admin/reports/referrals',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['admin — reports'],
        summary: 'Indique e Ganhe — relatório de indicações (admin)',
        description:
          'Relatório A6. COORTE (indicações cadastradas no período): funil visitas pelo link → cadastros → confirmados → recompensados, conversão e distribuição por estado. ' +
          'FLUXO (o que aconteceu no período): pãezins creditados (quem indicou, com as metas × amigos), custo estimado (pães × preço médio pago), receita dos indicados (pagamentos reais, sem gancho) e o top 5 de indicadores. As duas leituras viajam em `caveats`. Restrito a ADMIN.',
        security: [{ bearerAuth: [] }],
        querystring: periodQuerystring,
      },
    },
    ctrl.getReferrals.bind(ctrl),
  )
}
