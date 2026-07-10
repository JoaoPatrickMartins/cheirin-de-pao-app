import { FastifyInstance } from 'fastify'
import { getDateRange, type ReportPeriod } from '../../lib/date-range.js'

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
    revenue: number
    activeClients: number
    breadsDelivered: number
  }>
}

// ----- Tier 2 -----

export interface DeliveryReport {
  period: ReportPeriod
  counts: { total: number; delivered: number; notDelivered: number; cancelled: number; inProgress: number }
  deliveryRate: number
  failureReasons: Array<{ reason: string; count: number }>
  cancelReasons: Array<{ reason: string; count: number }>
}

export interface WasteReport {
  period: ReportPeriod
  ordered: number
  delivered: number
  waste: number
  wasteRate: number
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
      this.prisma.payment.findMany({ where: { status: 'PAID' }, distinct: ['userId'], select: { userId: true } }),
      this.prisma.order.findMany({ where: { status: 'DELIVERED' }, distinct: ['userId'], select: { userId: true } }),
    ])

    // Créditos vendidos x consumidos no período
    const [soldAgg, consumedAgg] = await Promise.all([
      this.prisma.creditTransaction.aggregate({
        _sum: { quantity: true },
        where: { type: 'PURCHASE', createdAt: { gte: startDate, lte: endDate } },
      }),
      this.prisma.creditTransaction.aggregate({
        _sum: { quantity: true },
        where: { type: 'DELIVERY', createdAt: { gte: startDate, lte: endDate } },
      }),
    ])
    const creditsSold = soldAgg._sum.quantity ?? 0
    const creditsConsumed = Math.abs(consumedAgg._sum.quantity ?? 0) // DELIVERY é negativo

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
        withDelivery: deliverers.length,
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
      this.prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'PAID' } }),
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

    const [clientGroups, breadGroups] = await Promise.all([
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
      { condominiumId: string; revenue: number; activeClients: number; breadsDelivered: number }
    >()
    const ensure = (id: string) => {
      if (!id) return null
      let e = map.get(id)
      if (!e) {
        e = { condominiumId: id, revenue: 0, activeClients: 0, breadsDelivered: 0 }
        map.set(id, e)
      }
      return e
    }
    for (const r of revBatch) {
      const e = ensure(extractId(r._id))
      if (e) e.revenue = r.total ?? 0
    }
    for (const g of clientGroups) {
      const e = ensure(g.condominiumId ?? '')
      if (e) e.activeClients = g._count
    }
    for (const g of breadGroups) {
      const e = ensure(g.condominiumId ?? '')
      if (e) e.breadsDelivered = g._sum.quantity ?? 0
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
      .map((e) => ({ ...e, condominiumName: nameMap.get(e.condominiumId) ?? '—' }))
      .sort((a, b) => b.revenue - a.revenue)

    return { period, items }
  }

  /**
   * getDeliveryReport — entregas & falhas (#8): taxa de entrega, status, motivos de
   * não-entrega e cancelamento. Janela por `scheduledDate` (data da entrega).
   */
  async getDeliveryReport(period: ReportPeriod): Promise<DeliveryReport> {
    const { startDate, endDate } = getDateRange(period)
    const where = { scheduledDate: { gte: startDate, lte: endDate } }

    const [statusGroups, failGroups, cancelGroups] = await Promise.all([
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
    ])

    const countOf = (s: string) => statusGroups.find((g) => g.status === s)?._count ?? 0
    const delivered = countOf('DELIVERED')
    const notDelivered = countOf('NOT_DELIVERED')
    const cancelled = countOf('CANCELLED')
    const inProgress = countOf('SCHEDULED') + countOf('SEPARATED') + countOf('OUT_FOR_DELIVERY')
    const total = statusGroups.reduce((a, g) => a + g._count, 0)
    const deliveryRate = delivered + notDelivered > 0 ? delivered / (delivered + notDelivered) : 0

    return {
      period,
      counts: { total, delivered, notDelivered, cancelled, inProgress },
      deliveryRate,
      failureReasons: failGroups
        .map((g) => ({ reason: g.failureReason ?? '—', count: g._count }))
        .sort((a, b) => b.count - a.count),
      cancelReasons: cancelGroups
        .map((g) => ({ reason: g.cancelReason ?? '—', count: g._count }))
        .sort((a, b) => b.count - a.count),
    }
  }

  /**
   * getWasteReport — desperdício (#7): pães comprados do fornecedor (PurchaseOrder
   * FINALIZED, por `date`) vs efetivamente entregues (Order DELIVERED, por `scheduledDate`).
   */
  async getWasteReport(period: ReportPeriod): Promise<WasteReport> {
    const { startDate, endDate } = getDateRange(period)
    const [orderedAgg, deliveredAgg] = await Promise.all([
      this.prisma.purchaseOrder.aggregate({
        _sum: { totalQuantity: true },
        where: { status: 'FINALIZED', date: { gte: startDate, lte: endDate } },
      }),
      this.prisma.order.aggregate({
        _sum: { quantity: true },
        where: { status: 'DELIVERED', scheduledDate: { gte: startDate, lte: endDate } },
      }),
    ])
    const ordered = orderedAgg._sum.totalQuantity ?? 0
    const delivered = deliveredAgg._sum.quantity ?? 0
    const waste = ordered - delivered
    return { period, ordered, delivered, waste, wasteRate: ordered > 0 ? waste / ordered : 0 }
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

    const [statusGroups, methodGroups, failed] = await Promise.all([
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

    return {
      period,
      byStatus: { paid, pending, failed: failedC, refunded },
      approvalRate: paid + failedC > 0 ? paid / (paid + failedC) : 0,
      refundRate: paid > 0 ? refunded / paid : 0,
      byMethod: methodGroups.map((g) => ({ method: g.method, count: g._count, amount: g._sum.amount ?? 0 })),
      recovered,
    }
  }
}
