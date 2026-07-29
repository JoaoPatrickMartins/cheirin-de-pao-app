import { FastifyInstance } from 'fastify'
import { getDateRange, type ReportPeriod } from '../../lib/date-range.js'
import { excludeNonCreditPurpose, nonCreditPurposeMatchRaw } from '../../lib/revenue.js'
import { CONFIRMED_MARKET_STATUSES } from '../../lib/bread-demand.js'
import { loadUnitCosts } from '../../lib/product-cost.js'

/** Centavos, sem lixo de ponto flutuante em somas de R$. */
const round2 = (n: number) => Math.round(n * 100) / 100

/** Resultado agregado de uma fatia de eventos (acessos OU logins). */
interface EventAggregate {
  total: number
  uniqueVisitors: number
  uniqueUsers: number
  series: Array<{ day: string; count: number; uniqueVisitors: number }>
}

export interface AccessReport {
  period: ReportPeriod
  access: { total: number; uniqueVisitors: number }
  logins: { total: number; uniqueClients: number }
  conversion: { rate: number; loginVisitors: number; accessVisitors: number }
  series: Array<{ day: string; accesses: number; accessVisitors: number; logins: number }>
}

export interface RetentionReport {
  period: ReportPeriod
  // #1 Adoção de recarga automática
  autoRecharge: {
    enabled: number
    activeClients: number
    rate: number
    byMode: { acabar: number; semanal: number }
  }
  // #2 Churn por esgotamento de crédito
  credit: { zeroBalance: number; atRisk: number }
  // #4 Funil de ativação (base de clientes)
  activation: { registered: number; withSchedule: number; withPurchase: number; withDelivery: number }
  // #3 Recompra & autonomia (intervalo em janela de 180d; créditos no período)
  repurchase: {
    avgIntervalDays: number | null
    repurchasingClients: number
    creditsSold: number
    creditsConsumed: number
  }
}

export interface CreditLiabilityReport {
  creditsOutstanding: number
  estPricePerCredit: number
  estLiabilityBRL: number
  clientsWithCredit: number
}

export interface CondominiumRankingReport {
  period: ReportPeriod
  items: Array<{
    condominiumId: string
    condominiumName: string
    /** Receita consolidada (D-2): crédito + dinheiro novo da Cestinha. É o critério de ordenação. */
    revenue: number
    /** Recorte de `revenue`: compra de crédito/combo/avulso. */
    creditRevenue: number
    /** Recorte de `revenue`: parte em dinheiro das Cestinhas. */
    marketRevenue: number
    activeClients: number
    /** Pães entregues — Order + `breadQty` de Cestinha entregue (D-1). */
    breadsDelivered: number
    /** Valor movimentado em Cestinhas. **Nunca** somado à receita (D-2). */
    cestinhaGmv: number
  }>
}

// ----- Tier 2 -----

/** Contadores de desfecho de uma população de pedidos. */
interface DeliveryCounts {
  total: number
  delivered: number
  notDelivered: number
  cancelled: number
  inProgress: number
}

export interface DeliveryReport {
  period: ReportPeriod
  /** Operação inteira — pedidos de pão + Cestinhas. */
  counts: DeliveryCounts
  deliveryRate: number
  /** A mesma conta separada por tipo (D-4), para saber de onde vem a falha. */
  byKind: {
    bread: DeliveryCounts & { deliveryRate: number }
    cestinha: DeliveryCounts & { deliveryRate: number }
  }
  failureReasons: Array<{ reason: string; count: number }>
  cancelReasons: Array<{ reason: string; count: number }>
}

export interface WasteReport {
  period: ReportPeriod
  ordered: number
  delivered: number
  waste: number
  wasteRate: number
  /**
   * Desperdício dos ITENS do mercadinho (Onda G4) — série **separada** da do pão (D-1): comparar
   * potes de geleia com pães comprados não significa nada. Aqui a pergunta é outra: do que foi
   * comprometido, quanto chegou ao cliente e quanto se perdeu no caminho — em unidades e em R$
   * (custo pela matriz de fornecimento, H9).
   */
  items: {
    /** Unidades de pedidos confirmados no período. */
    committed: number
    /** Unidades efetivamente entregues. */
    delivered: number
    /** Unidades de entregas que falharam e foram resolvidas como PERDA (não voltaram). */
    lost: number
    /** Unidades que voltaram à prateleira no desfecho da perda (G2). */
    returned: number
    /** Unidades de entregas falhadas ainda SEM desfecho — não são perda nem devolução ainda. */
    pending: number
    /** Custo das unidades perdidas (R$). */
    lostValue: number
    /** `lost / (delivered + lost)` — perda sobre o que saiu para entrega. */
    lossRate: number
    /** Quebra por produto, da maior perda para a menor. */
    byProduct: Array<{ productId: string; productName: string; lost: number; lostValue: number }>
  }
}

export interface ScheduleProfileReport {
  period: ReportPeriod
  activeSchedules: number
  totalWeeklyBreads: number
  avgWeeklyBreads: number
  byWeekday: Array<{ day: string; qty: number }>
  orderMix: { single: number; scheduled: number }
}

export interface PaymentsReport {
  period: ReportPeriod
  byStatus: { paid: number; pending: number; failed: number; refunded: number }
  approvalRate: number
  refundRate: number
  byMethod: Array<{ method: string; count: number; amount: number }>
  /**
   * Quebra por finalidade do pagamento (D6): sem ela, uma recusa de combo e uma recusa de Cestinha
   * viram o mesmo número — e a taxa de aprovação de um fluxo novo (que pode estar mal configurado)
   * fica escondida na média do fluxo antigo.
   */
  byPurpose: Array<{
    purpose: 'CREDITS' | 'HOOK' | 'MARKET'
    paid: number
    failed: number
    pending: number
    refunded: number
    amount: number
    approvalRate: number
  }>
  recovered: number
}

/**
 * AdminReportsService — relatórios de aquisição (acessos, logins e conversão).
 *
 * Segurança: role check ADMIN no controller (per D-11).
 * Agregações via $runCommandRaw com $match por date range (UTC, derivado do BRT) primeiro,
 * seguindo o padrão de AdminFinancialService.
 */
export class AdminReportsService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * Agrega uma fatia de AnalyticsEvent (por `match`) no intervalo, retornando
   * totais (com únicos) e a série diária no fuso BRT.
   */
  private async aggregateEvents(
    match: Record<string, unknown>,
    startDate: Date,
    endDate: Date,
  ): Promise<EventAggregate> {
    const pipeline: unknown[] = [
      {
        $match: {
          ...match,
          createdAt: {
            $gte: { $date: startDate.toISOString() },
            $lte: { $date: endDate.toISOString() },
          },
        },
      },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                visitors: { $addToSet: '$visitorId' },
                users: { $addToSet: '$userId' },
              },
            },
            {
              $project: {
                _id: 0,
                count: 1,
                uniqueVisitors: { $size: '$visitors' },
                // userId é null em ACCESS — removemos antes de contar
                uniqueUsers: { $size: { $setDifference: ['$users', [null]] } },
              },
            },
          ],
          series: [
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$createdAt',
                    timezone: 'America/Sao_Paulo',
                  },
                },
                count: { $sum: 1 },
                visitors: { $addToSet: '$visitorId' },
              },
            },
            { $project: { _id: 0, day: '$_id', count: 1, uniqueVisitors: { $size: '$visitors' } } },
            { $sort: { day: 1 } },
          ],
        },
      },
    ]

    const raw = (await this.prisma.$runCommandRaw({
      aggregate: 'AnalyticsEvent',
      pipeline: pipeline as unknown as import('@prisma/client/runtime/library').InputJsonValue,
      cursor: {},
    })) as {
      cursor?: {
        firstBatch?: Array<{
          totals?: Array<{ count?: number; uniqueVisitors?: number; uniqueUsers?: number }>
          series?: Array<{ day?: string; count?: number; uniqueVisitors?: number }>
        }>
      }
    }

    const doc = raw?.cursor?.firstBatch?.[0]
    const totals = doc?.totals?.[0]
    const series = (doc?.series ?? []).map((r) => ({
      day: r.day ?? '',
      count: r.count ?? 0,
      uniqueVisitors: r.uniqueVisitors ?? 0,
    }))

    return {
      total: totals?.count ?? 0,
      uniqueVisitors: totals?.uniqueVisitors ?? 0,
      uniqueUsers: totals?.uniqueUsers ?? 0,
      series,
    }
  }

  /**
   * getAccessReport — métricas de acesso, login de clientes e conversão acesso→login.
   *
   * - Acessos: eventos type=ACCESS (total + visitantes únicos por device).
   * - Logins:  eventos type=LOGIN com role=CLIENT (total + clientes únicos).
   * - Conversão: visitantes únicos que logaram / visitantes únicos que acessaram.
   */
  async getAccessReport(period: ReportPeriod): Promise<AccessReport> {
    const { startDate, endDate } = getDateRange(period)

    const access = await this.aggregateEvents({ type: 'ACCESS' }, startDate, endDate)
    const login = await this.aggregateEvents({ type: 'LOGIN', role: 'CLIENT' }, startDate, endDate)

    // Série unificada por dia (união das datas presentes em acessos e logins)
    const byDay = new Map<
      string,
      { day: string; accesses: number; accessVisitors: number; logins: number }
    >()
    for (const r of access.series) {
      byDay.set(r.day, { day: r.day, accesses: r.count, accessVisitors: r.uniqueVisitors, logins: 0 })
    }
    for (const r of login.series) {
      const cur = byDay.get(r.day) ?? { day: r.day, accesses: 0, accessVisitors: 0, logins: 0 }
      cur.logins = r.count
      byDay.set(r.day, cur)
    }
    const series = Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day))

    const accessVisitors = access.uniqueVisitors
    const loginVisitors = login.uniqueVisitors
    const rate = accessVisitors > 0 ? loginVisitors / accessVisitors : 0

    return {
      period,
      access: { total: access.total, uniqueVisitors: access.uniqueVisitors },
      logins: { total: login.total, uniqueClients: login.uniqueUsers },
      conversion: { rate, loginVisitors, accessVisitors },
      series,
    }
  }

  /**
   * getRetentionReport — saúde da recorrência (Tier 1):
   * #1 adoção de recarga automática, #2 churn por esgotamento de crédito,
   * #3 recompra & autonomia, #4 funil de ativação.
   *
   * "Cliente ativo" = role CLIENT & isBlocked=false (mesma definição do dashboard).
   * O intervalo de recompra usa janela fixa de 180 dias p/ estabilidade estatística;
   * créditos vendidos/consumidos respeitam o `period`.
   */
  async getRetentionReport(period: ReportPeriod): Promise<RetentionReport> {
    const { startDate, endDate } = getDateRange(period)

    // Clientes ativos (+ campos p/ recarga e saldo) e agendas ativas — 2 queries, contagem em memória
    const [clients, activeSchedules] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: 'CLIENT', isBlocked: false },
        select: { id: true, creditBalance: true, autoRecharge: true },
      }),
      this.prisma.schedule.findMany({ where: { isActive: true }, select: { userId: true } }),
    ])
    const activeSchedUserIds = new Set(activeSchedules.map((s) => s.userId))

    let enabled = 0
    let modeAcabar = 0
    let modeSemanal = 0
    let zeroBalance = 0
    let atRisk = 0
    for (const c of clients) {
      const ar = c.autoRecharge as { active?: boolean; mode?: string } | null
      if (ar?.active) {
        enabled++
        if (ar.mode === 'semanal') modeSemanal++
        else modeAcabar++
      }
      // creditBalance pode ser null em contas legadas — trata como 0
      if ((c.creditBalance ?? 0) <= 0) {
        zeroBalance++
        if (activeSchedUserIds.has(c.id)) atRisk++ // sem crédito mas com agenda ativa = risco
      }
    }
    const activeClients = clients.length

    // Funil de ativação (base de clientes)
    const [registered, purchasers, deliverers] = await Promise.all([
      this.prisma.user.count({ where: { role: 'CLIENT' } }),
      // Retenção conta toda atividade de pagamento (comportamento do cliente), incluindo HOOK/MARKET.
      this.prisma.payment.findMany({ where: { status: 'PAID' }, distinct: ['userId'], select: { userId: true } }),
      this.prisma.order.findMany({ where: { status: 'DELIVERED' }, distinct: ['userId'], select: { userId: true } }),
    ])

    // D5 — "chegou a receber" também vale pela Cestinha: um cliente que só recebeu Cestinha
    // completou o funil de ativação igual, e antes ficava eternamente no degrau anterior.
    const marketDeliverers = await this.prisma.marketOrder.findMany({
      where: { status: 'DELIVERED' },
      distinct: ['userId'],
      select: { userId: true },
    })
    const deliveredUserIds = new Set([...deliverers, ...marketDeliverers].map((d) => d.userId))

    // Créditos vendidos x consumidos no período
    const [soldAgg, consumedAgg] = await Promise.all([
      this.prisma.creditTransaction.aggregate({
        _sum: { quantity: true },
        where: { type: 'PURCHASE', createdAt: { gte: startDate, lte: endDate } },
      }),
      // D5 — consumo de crédito inclui o gasto na Cestinha (`MARKET_PURCHASE`). Sem isso, um
      // cliente que troca pãezinhos por bolo aparecia como quem não consome nada, e o número
      // "vendidos × consumidos" (que mede se o crédito vira entrega ou vira passivo) mentia.
      this.prisma.creditTransaction.aggregate({
        _sum: { quantity: true },
        where: { type: { in: ['DELIVERY', 'MARKET_PURCHASE'] }, createdAt: { gte: startDate, lte: endDate } },
      }),
    ])
    const creditsSold = soldAgg._sum.quantity ?? 0
    const creditsConsumed = Math.abs(consumedAgg._sum.quantity ?? 0) // DELIVERY/MARKET_PURCHASE são negativos

    // Intervalo médio de recompra — janela de 180 dias
    const since = new Date(endDate.getTime() - 180 * 24 * 60 * 60 * 1000)
    const payments = await this.prisma.payment.findMany({
      where: { status: 'PAID', createdAt: { gte: since } },
      select: { userId: true, createdAt: true },
      orderBy: [{ userId: 'asc' }, { createdAt: 'asc' }],
    })
    const byUser = new Map<string, Date[]>()
    for (const p of payments) {
      const arr = byUser.get(p.userId) ?? []
      arr.push(p.createdAt)
      byUser.set(p.userId, arr)
    }
    let intervalSumDays = 0
    let intervalCount = 0
    let repurchasingClients = 0
    for (const dates of byUser.values()) {
      if (dates.length < 2) continue
      repurchasingClients++
      for (let i = 1; i < dates.length; i++) {
        intervalSumDays += (dates[i].getTime() - dates[i - 1].getTime()) / (24 * 60 * 60 * 1000)
        intervalCount++
      }
    }
    const avgIntervalDays = intervalCount > 0 ? intervalSumDays / intervalCount : null

    return {
      period,
      autoRecharge: {
        enabled,
        activeClients,
        rate: activeClients > 0 ? enabled / activeClients : 0,
        byMode: { acabar: modeAcabar, semanal: modeSemanal },
      },
      credit: { zeroBalance, atRisk },
      activation: {
        registered,
        withSchedule: activeSchedUserIds.size,
        withPurchase: purchasers.length,
        withDelivery: deliveredUserIds.size,
      },
      repurchase: { avgIntervalDays, repurchasingClients, creditsSold, creditsConsumed },
    }
  }

  /**
   * getCreditLiability — passivo de crédito (receita diferida): #5.
   *
   * `creditsOutstanding` (soma de creditBalance dos clientes) é exato; o valor em R$ é uma
   * ESTIMATIVA usando o preço médio por crédito histórico (R$ pagos / créditos comprados).
   */
  async getCreditLiability(): Promise<CreditLiabilityReport> {
    const [balanceAgg, paidAgg, purchaseAgg, withCredit] = await Promise.all([
      this.prisma.user.aggregate({ _sum: { creditBalance: true }, where: { role: 'CLIENT' } }),
      // §4.7: passivo de crédito usa só receita de crédito (HOOK/MARKET não compram pães).
      this.prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'PAID', ...excludeNonCreditPurpose } }),
      this.prisma.creditTransaction.aggregate({ _sum: { quantity: true }, where: { type: 'PURCHASE' } }),
      this.prisma.user.count({ where: { role: 'CLIENT', creditBalance: { gt: 0 } } }),
    ])
    const creditsOutstanding = balanceAgg._sum.creditBalance ?? 0
    const totalPaid = paidAgg._sum.amount ?? 0
    const totalPurchased = purchaseAgg._sum.quantity ?? 0
    const estPricePerCredit = totalPurchased > 0 ? totalPaid / totalPurchased : 0

    return {
      creditsOutstanding,
      estPricePerCredit,
      estLiabilityBRL: creditsOutstanding * estPricePerCredit,
      clientsWithCredit: withCredit,
    }
  }

  /**
   * getCondominiumRanking — ranking de condomínios por receita, clientes ativos e pães: #6.
   *
   * Receita via $runCommandRaw ($lookup em User → group por condominiumId);
   * clientes ativos e pães entregues via groupBy direto (Order.condominiumId denormalizado).
   *
   * Onda D4 — `revenue` passou a ser a receita CONSOLIDADA (D-2: crédito + dinheiro novo da
   * Cestinha) e é ela que ordena o ranking; os dois recortes ficam visíveis em `creditRevenue` e
   * `marketRevenue` para o número nunca ser inexplicável. `breadsDelivered` soma o `breadQty` da
   * Cestinha entregue (D-1) e o GMV entra como coluna própria, jamais somado à receita.
   *
   * A receita da Cestinha por condomínio sai de `MarketOrder.moneyAmount` (campo denormalizado)
   * em vez de um segundo pipeline em `Payment`: um pedido fora de `PENDING_PAYMENT` é um pedido
   * cujo dinheiro entrou, e assim o número reconcilia com `market.moneyPart` do financeiro.
   */
  async getCondominiumRanking(period: ReportPeriod): Promise<CondominiumRankingReport> {
    const { startDate, endDate } = getDateRange(period)

    const revenuePipeline: unknown[] = [
      {
        $match: {
          status: 'PAID',
          createdAt: {
            $gte: { $date: startDate.toISOString() },
            $lte: { $date: endDate.toISOString() },
          },
          ...nonCreditPurposeMatchRaw, // §4.7: exclui HOOK/MARKET
        },
      },
      { $lookup: { from: 'User', localField: 'userId', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $group: { _id: '$user.condominiumId', total: { $sum: '$amount' } } },
    ]
    const revRaw = (await this.prisma.$runCommandRaw({
      aggregate: 'Payment',
      pipeline: revenuePipeline as unknown as import('@prisma/client/runtime/library').InputJsonValue,
      cursor: {},
    })) as { cursor?: { firstBatch?: Array<{ _id: unknown; total?: number }> } }
    const revBatch = revRaw?.cursor?.firstBatch ?? []

    const [clientGroups, breadGroups, marketMoneyGroups, marketBreadGroups] = await Promise.all([
      this.prisma.user.groupBy({
        by: ['condominiumId'],
        where: { role: 'CLIENT', isBlocked: false, condominiumId: { not: null } },
        _count: true,
      }),
      this.prisma.order.groupBy({
        by: ['condominiumId'],
        where: {
          status: 'DELIVERED',
          deliveredAt: { gte: startDate, lte: endDate },
          condominiumId: { not: null },
        },
        _sum: { quantity: true },
      }),
      // Receita e GMV da Cestinha por condomínio — janela da COMPRA, igual à receita de crédito
      // (que usa `Payment.createdAt`).
      this.prisma.marketOrder.groupBy({
        by: ['condominiumId'],
        where: {
          status: { in: [...CONFIRMED_MARKET_STATUSES] },
          createdAt: { gte: startDate, lte: endDate },
        },
        _sum: { moneyAmount: true, totalValue: true },
      }),
      // Pães da Cestinha entregues — janela da ENTREGA, igual ao `breadGroups` do pão.
      this.prisma.marketOrder.groupBy({
        by: ['condominiumId'],
        where: {
          status: 'DELIVERED',
          deliveredAt: { gte: startDate, lte: endDate },
        },
        _sum: { breadQty: true },
      }),
    ])

    const extractId = (raw: unknown): string => {
      if (typeof raw === 'string') return raw
      if (raw && typeof raw === 'object' && '$oid' in raw) {
        return String((raw as { $oid: unknown }).$oid ?? '')
      }
      return ''
    }

    const map = new Map<
      string,
      {
        condominiumId: string
        creditRevenue: number
        marketRevenue: number
        activeClients: number
        breadsDelivered: number
        cestinhaGmv: number
      }
    >()
    const ensure = (id: string) => {
      if (!id) return null
      let e = map.get(id)
      if (!e) {
        e = {
          condominiumId: id,
          creditRevenue: 0,
          marketRevenue: 0,
          activeClients: 0,
          breadsDelivered: 0,
          cestinhaGmv: 0,
        }
        map.set(id, e)
      }
      return e
    }
    for (const r of revBatch) {
      const e = ensure(extractId(r._id))
      if (e) e.creditRevenue = r.total ?? 0
    }
    for (const g of clientGroups) {
      const e = ensure(g.condominiumId ?? '')
      if (e) e.activeClients = g._count
    }
    for (const g of breadGroups) {
      const e = ensure(g.condominiumId ?? '')
      if (e) e.breadsDelivered = g._sum.quantity ?? 0
    }
    for (const g of marketMoneyGroups) {
      const e = ensure(g.condominiumId ?? '')
      if (!e) continue
      e.marketRevenue = round2(g._sum.moneyAmount ?? 0)
      e.cestinhaGmv = round2(g._sum.totalValue ?? 0)
    }
    for (const g of marketBreadGroups) {
      const e = ensure(g.condominiumId ?? '')
      // D-1: pão da Cestinha é pão — soma no MESMO contador.
      if (e) e.breadsDelivered += g._sum.breadQty ?? 0
    }

    const ids = Array.from(map.keys())
    const condos =
      ids.length > 0
        ? await this.prisma.condominium.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true },
          })
        : []
    const nameMap = new Map(condos.map((c) => [c.id, c.name]))

    const items = Array.from(map.values())
      .map((e) => ({
        ...e,
        condominiumName: nameMap.get(e.condominiumId) ?? '—',
        // D-2: receita consolidada = crédito + dinheiro NOVO da Cestinha. O GMV fica de fora.
        revenue: round2(e.creditRevenue + e.marketRevenue),
      }))
      .sort((a, b) => b.revenue - a.revenue)

    return { period, items }
  }

  /**
   * getDeliveryReport — entregas & falhas (#8): taxa de entrega, status, motivos de
   * não-entrega e cancelamento. Janela por `scheduledDate` (data da entrega).
   *
   * Onda D3 — passa a medir a operação INTEIRA (pão + Cestinha). Antes a taxa de entrega media só
   * o pão: uma Cestinha não entregue não aparecia em nenhum indicador, e os motivos de falha dela
   * (que a Onda B5 e o entregador já gravam) não tinham para onde ir.
   *
   * A unidade contada é o PEDIDO, não a parada (D-5). Numa parada combinada, pão e Cestinha são
   * duas coisas que podem falhar de forma independente — a Cestinha pode faltar um item mesmo com
   * o pão entregue —, e contar por parada esconderia justamente a falha do mercadinho. `byKind`
   * mantém a série histórica do pão intacta e legível ao lado da nova.
   */
  async getDeliveryReport(period: ReportPeriod): Promise<DeliveryReport> {
    const { startDate, endDate } = getDateRange(period)
    const where = { scheduledDate: { gte: startDate, lte: endDate } }

    const [statusGroups, failGroups, cancelGroups, marketStatusGroups, marketFailGroups, marketCancelGroups] =
      await Promise.all([
        this.prisma.order.groupBy({ by: ['status'], where, _count: true }),
        this.prisma.order.groupBy({
          by: ['failureReason'],
          where: { ...where, status: 'NOT_DELIVERED', failureReason: { not: null } },
          _count: true,
        }),
        this.prisma.order.groupBy({
          by: ['cancelReason'],
          where: { ...where, status: 'CANCELLED', cancelReason: { not: null } },
          _count: true,
        }),
        // `PENDING_PAYMENT` fora: pedido que nunca confirmou não é entrega pendente, é carrinho
        // abandonado — e o sweep do cron pode cancelá-lo a qualquer minuto (Onda F1).
        this.prisma.marketOrder.groupBy({
          by: ['status'],
          where: { ...where, status: { not: 'PENDING_PAYMENT' } },
          _count: true,
        }),
        this.prisma.marketOrder.groupBy({
          by: ['failureReason'],
          where: { ...where, status: 'NOT_DELIVERED', failureReason: { not: null } },
          _count: true,
        }),
        this.prisma.marketOrder.groupBy({
          by: ['cancelReason'],
          where: { ...where, status: 'CANCELLED', cancelReason: { not: null } },
          _count: true,
        }),
      ])

    const tally = (groups: Array<{ status: string; _count: number }>): DeliveryCounts & { deliveryRate: number } => {
      const countOf = (s: string) => groups.find((g) => g.status === s)?._count ?? 0
      const delivered = countOf('DELIVERED')
      const notDelivered = countOf('NOT_DELIVERED')
      return {
        total: groups.reduce((a, g) => a + g._count, 0),
        delivered,
        notDelivered,
        cancelled: countOf('CANCELLED'),
        inProgress: countOf('SCHEDULED') + countOf('SEPARATED') + countOf('OUT_FOR_DELIVERY'),
        deliveryRate: delivered + notDelivered > 0 ? delivered / (delivered + notDelivered) : 0,
      }
    }

    const bread = tally(statusGroups as Array<{ status: string; _count: number }>)
    const cestinha = tally(marketStatusGroups as Array<{ status: string; _count: number }>)
    const delivered = bread.delivered + cestinha.delivered
    const notDelivered = bread.notDelivered + cestinha.notDelivered

    // Motivos: a mesma razão pode vir dos dois lados ("cliente ausente" derruba a parada inteira),
    // então somamos por texto em vez de listar duas linhas iguais.
    const mergeReasons = (
      groups: Array<{ reason: string | null; count: number }>,
    ): Array<{ reason: string; count: number }> => {
      const acc = new Map<string, number>()
      for (const g of groups) {
        const key = g.reason ?? '—'
        acc.set(key, (acc.get(key) ?? 0) + g.count)
      }
      return [...acc.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count)
    }

    return {
      period,
      counts: {
        total: bread.total + cestinha.total,
        delivered,
        notDelivered,
        cancelled: bread.cancelled + cestinha.cancelled,
        inProgress: bread.inProgress + cestinha.inProgress,
      },
      deliveryRate: delivered + notDelivered > 0 ? delivered / (delivered + notDelivered) : 0,
      byKind: { bread, cestinha },
      failureReasons: mergeReasons([
        ...failGroups.map((g) => ({ reason: g.failureReason, count: g._count })),
        ...marketFailGroups.map((g) => ({ reason: g.failureReason, count: g._count })),
      ]),
      cancelReasons: mergeReasons([
        ...cancelGroups.map((g) => ({ reason: g.cancelReason, count: g._count })),
        ...marketCancelGroups.map((g) => ({ reason: g.cancelReason, count: g._count })),
      ]),
    }
  }

  /**
   * getWasteReport — desperdício (#7): pães comprados do fornecedor (PurchaseOrder
   * FINALIZED, por `date`) vs efetivamente entregues (Order DELIVERED, por `scheduledDate`).
   */
  async getWasteReport(period: ReportPeriod): Promise<WasteReport> {
    const { startDate, endDate } = getDateRange(period)
    const [orderedAgg, deliveredAgg, marketDeliveredAgg] = await Promise.all([
      this.prisma.purchaseOrder.aggregate({
        _sum: { totalQuantity: true },
        where: { status: 'FINALIZED', date: { gte: startDate, lte: endDate } },
      }),
      this.prisma.order.aggregate({
        _sum: { quantity: true },
        where: { status: 'DELIVERED', scheduledDate: { gte: startDate, lte: endDate } },
      }),
      // ACOPLADO AO PEDIDO AO FORNECEDOR: agora que `createQuick` pede o pão vendido dentro da
      // Cestinha, o lado "entregue" precisa contá-lo também — senão todo pão de Cestinha entregue
      // apareceria como desperdício. Os dois lados mudam juntos ou o relatório mente.
      this.prisma.marketOrder.aggregate({
        _sum: { breadQty: true },
        where: { status: 'DELIVERED', scheduledDate: { gte: startDate, lte: endDate } },
      }),
    ])
    const ordered = orderedAgg._sum.totalQuantity ?? 0
    const delivered = (deliveredAgg._sum.quantity ?? 0) + (marketDeliveredAgg._sum.breadQty ?? 0)
    const waste = ordered - delivered
    const items = await this.itemWaste(startDate, endDate)
    return { period, ordered, delivered, waste, wasteRate: ordered > 0 ? waste / ordered : 0, items }
  }

  /**
   * Desperdício dos itens do mercadinho (G4) — comprometido × entregue × perdido, com valor.
   *
   * `NOT_DELIVERED` sem desfecho (G2) entra em `pending`, **não** em `lost`: enquanto ninguém apurou
   * se o produto voltou à prateleira, chamar aquilo de perda seria inventar um prejuízo. É o mesmo
   * princípio do `unitsWithoutCost` do financeiro — número incompleto é declarado, não arredondado.
   */
  private async itemWaste(startDate: Date, endDate: Date): Promise<WasteReport['items']> {
    const window = { scheduledDate: { gte: startDate, lte: endDate } }
    const [committedOrders, deliveredOrders, failedOrders] = await Promise.all([
      this.prisma.marketOrder.findMany({
        where: { ...window, status: { in: [...CONFIRMED_MARKET_STATUSES] } },
        select: { items: { select: { productId: true, name: true, qty: true } } },
      }),
      this.prisma.marketOrder.findMany({
        where: { ...window, status: 'DELIVERED' },
        select: { items: { select: { qty: true } } },
      }),
      this.prisma.marketOrder.findMany({
        where: { ...window, status: 'NOT_DELIVERED' },
        select: {
          stockReturned: true,
          lossResolvedAt: true,
          items: { select: { productId: true, name: true, qty: true } },
        },
      }),
    ])

    const sum = (rows: Array<{ items: { qty: number }[] }>) =>
      rows.reduce((s, o) => s + o.items.reduce((n, i) => n + i.qty, 0), 0)

    const lostBy = new Map<string, { productName: string; lost: number }>()
    let lost = 0
    let returned = 0
    let pending = 0
    for (const o of failedOrders) {
      const units = o.items.reduce((n, i) => n + i.qty, 0)
      if (!o.lossResolvedAt) {
        pending += units
        continue
      }
      if (o.stockReturned) {
        returned += units
        continue
      }
      lost += units
      for (const it of o.items) {
        const cur = lostBy.get(it.productId) ?? { productName: it.name, lost: 0 }
        cur.lost += it.qty
        lostBy.set(it.productId, cur)
      }
    }

    const costs = lostBy.size > 0 ? await loadUnitCosts(this.prisma, [...lostBy.keys()]) : new Map()
    const byProduct = [...lostBy.entries()]
      .map(([productId, v]) => ({
        productId,
        productName: v.productName,
        lost: v.lost,
        lostValue: round2((costs.get(productId)?.unitCost ?? 0) * v.lost),
      }))
      .sort((a, b) => b.lostValue - a.lostValue || b.lost - a.lost)

    const deliveredUnits = sum(deliveredOrders)
    return {
      committed: sum(committedOrders),
      delivered: deliveredUnits,
      lost,
      returned,
      pending,
      lostValue: round2(byProduct.reduce((s, p) => s + p.lostValue, 0)),
      lossRate: deliveredUnits + lost > 0 ? lost / (deliveredUnits + lost) : 0,
      byProduct,
    }
  }

  /**
   * getScheduleProfileReport — perfil da agenda (#9) + mix único×recorrente (#10).
   * Agendas são estado atual (snapshot); o mix de pedidos respeita o `period`.
   * Schedule.days tem formato { slot: { seg|ter|...: qty } }.
   */
  async getScheduleProfileReport(period: ReportPeriod): Promise<ScheduleProfileReport> {
    const { startDate, endDate } = getDateRange(period)
    const [schedules, orderTypeGroups] = await Promise.all([
      this.prisma.schedule.findMany({ where: { isActive: true }, select: { weeklyQty: true, days: true } }),
      this.prisma.order.groupBy({ by: ['type'], where: { createdAt: { gte: startDate, lte: endDate } }, _count: true }),
    ])

    const WD: Array<[string, string]> = [
      ['seg', 'Seg'], ['ter', 'Ter'], ['qua', 'Qua'], ['qui', 'Qui'], ['sex', 'Sex'], ['sab', 'Sáb'], ['dom', 'Dom'],
    ]
    const weekdayTotals: Record<string, number> = { seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 }
    let totalWeeklyBreads = 0

    for (const s of schedules) {
      const days = s.days as Record<string, Record<string, number>> | null
      if (days && Object.keys(days).length > 0) {
        for (const slot of Object.values(days)) {
          for (const [wd, q] of Object.entries(slot ?? {})) {
            const n = Number(q) || 0
            if (wd in weekdayTotals) weekdayTotals[wd] += n
            totalWeeklyBreads += n
          }
        }
      } else {
        const wq = s.weeklyQty as Record<string, number> | null
        if (wq) {
          for (const [wd, q] of Object.entries(wq)) {
            const n = Number(q) || 0
            if (wd in weekdayTotals) weekdayTotals[wd] += n
            totalWeeklyBreads += n
          }
        }
      }
    }

    const activeSchedules = schedules.length
    return {
      period,
      activeSchedules,
      totalWeeklyBreads,
      avgWeeklyBreads: activeSchedules > 0 ? totalWeeklyBreads / activeSchedules : 0,
      byWeekday: WD.map(([k, label]) => ({ day: label, qty: weekdayTotals[k] })),
      orderMix: {
        single: orderTypeGroups.find((g) => g.type === 'SINGLE')?._count ?? 0,
        scheduled: orderTypeGroups.find((g) => g.type === 'SCHEDULED')?._count ?? 0,
      },
    }
  }

  /**
   * getPaymentsReport — pagamentos (#11): aprovação, estorno, mix Pix/cartão e
   * recuperação de pagamento falho (usuários com FAILED que depois tiveram um PAID).
   */
  async getPaymentsReport(period: ReportPeriod): Promise<PaymentsReport> {
    const { startDate, endDate } = getDateRange(period)
    const dateRange = { gte: startDate, lte: endDate }

    // Saúde do gateway: conta TODA atividade de pagamento (inclui HOOK/MARKET) — recusas do
    // fluxo novo (Cestinha) precisam aparecer aqui. (Segmentação §4.7 vale só p/ receita/passivo.)
    const [statusGroups, methodGroups, failed, purposeGroups] = await Promise.all([
      this.prisma.payment.groupBy({ by: ['status'], where: { createdAt: dateRange }, _count: true }),
      this.prisma.payment.groupBy({
        by: ['method'],
        where: { status: 'PAID', createdAt: dateRange },
        _count: true,
        _sum: { amount: true },
      }),
      this.prisma.payment.findMany({
        where: { status: 'FAILED', createdAt: dateRange },
        select: { userId: true, createdAt: true },
      }),
      // D6 — quebra por finalidade. `purpose` é null nas compras de crédito (nunca setam 'CREDITS'),
      // então o agrupamento traz null e nós o rotulamos.
      this.prisma.payment.groupBy({
        by: ['purpose', 'status'],
        where: { createdAt: dateRange },
        _count: true,
        _sum: { amount: true },
      }),
    ])

    const sCount = (s: string) => statusGroups.find((g) => g.status === s)?._count ?? 0
    const paid = sCount('PAID')
    const pending = sCount('PENDING')
    const failedC = sCount('FAILED')
    const refunded = sCount('REFUNDED')

    // Recuperação: usuários com FAILED no período que têm um PAID posterior
    let recovered = 0
    if (failed.length > 0) {
      const userIds = [...new Set(failed.map((f) => f.userId))]
      const paidAfter = await this.prisma.payment.findMany({
        where: { status: 'PAID', userId: { in: userIds } },
        select: { userId: true, createdAt: true },
      })
      const earliestFail = new Map<string, Date>()
      for (const f of failed) {
        const e = earliestFail.get(f.userId)
        if (!e || f.createdAt < e) earliestFail.set(f.userId, f.createdAt)
      }
      const recoveredUsers = new Set<string>()
      for (const pmt of paidAfter) {
        const ef = earliestFail.get(pmt.userId)
        if (ef && pmt.createdAt > ef) recoveredUsers.add(pmt.userId)
      }
      recovered = recoveredUsers.size
    }

    // Quebra por finalidade — só o valor dos PAID entra em `amount` (pendente/recusado não é
    // dinheiro), enquanto as contagens cobrem todos os status.
    const PURPOSE_ORDER: Array<'CREDITS' | 'HOOK' | 'MARKET'> = ['CREDITS', 'HOOK', 'MARKET']
    const byPurposeMap = new Map<
      'CREDITS' | 'HOOK' | 'MARKET',
      { paid: number; failed: number; pending: number; refunded: number; amount: number }
    >()
    for (const g of purposeGroups) {
      const key = (g.purpose ?? 'CREDITS') as 'CREDITS' | 'HOOK' | 'MARKET'
      const e = byPurposeMap.get(key) ?? { paid: 0, failed: 0, pending: 0, refunded: 0, amount: 0 }
      if (g.status === 'PAID') {
        e.paid += g._count
        e.amount = round2(e.amount + (g._sum.amount ?? 0))
      } else if (g.status === 'FAILED') e.failed += g._count
      else if (g.status === 'PENDING') e.pending += g._count
      else if (g.status === 'REFUNDED') e.refunded += g._count
      byPurposeMap.set(key, e)
    }

    return {
      period,
      byStatus: { paid, pending, failed: failedC, refunded },
      approvalRate: paid + failedC > 0 ? paid / (paid + failedC) : 0,
      refundRate: paid > 0 ? refunded / paid : 0,
      byMethod: methodGroups.map((g) => ({ method: g.method, count: g._count, amount: g._sum.amount ?? 0 })),
      byPurpose: PURPOSE_ORDER.filter((p) => byPurposeMap.has(p)).map((purpose) => {
        const e = byPurposeMap.get(purpose)!
        return {
          purpose,
          ...e,
          approvalRate: e.paid + e.failed > 0 ? e.paid / (e.paid + e.failed) : 0,
        }
      }),
      recovered,
    }
  }
}
