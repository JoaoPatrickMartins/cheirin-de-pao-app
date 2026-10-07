import type { CourierPayout, PrismaClient } from '@prisma/client'
import { payoutProposal, payoutTotals, payWeekOf, type PayoutFuelBasis, type PayoutFuelReason, type PayMode } from '@cheirin-de-pao/shared'
import { brtDateStr } from '../../lib/cutoff.js'
import { getRouteConfig } from '../../lib/route-config.js'
import { resolvedCourierStops } from '../../lib/courier-stops.js'

/**
 * Núcleo do pagamento semanal dos entregadores (plano do entregador, Onda 7 · T-12 … T-15).
 *
 * A semana (segunda a domingo, BRT) FECHADA vira proposta gravada (`CourierPayout`) de forma
 * PREGUIÇOSA — ao abrir Pagamentos, ao abrir "Meus ganhos" ou no aviso de segunda —, no mesmo
 * espírito do `ExpenseRecurrence`: nenhum cron crítico que falha em silêncio. A semana em andamento
 * é só estimativa, nunca gravada.
 *
 * Proposta PENDENTE (intocada) é recalculada a cada abertura — uma correção de status ou o consumo
 * cadastrado depois entram nela. Editada, aprovada ou descartada fica congelada.
 */

export type Db = PrismaClient

const DAY_MS = 24 * 60 * 60 * 1000
export const addDays = (day: string, n: number) => new Date(new Date(`${day}T15:00:00.000Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10)

/** Semana a partir da qual as propostas são geradas (gravada na 1ª abertura: a semana anterior). */
export const PAYOUTS_SINCE_KEY = 'courierPayoutsSince'

export interface WeekCalc {
  courierId: string
  name: string
  photoUrl: string | null
  isBlocked: boolean
  pagaCombustivel: boolean
  payMode: PayMode | null
  payAmount: number | null
  entregas: number
  rotas: number
  /** Rotas iniciadas e não encerradas na semana: não entram no cálculo (T-13). */
  openRuns: number
  units: number
  remunerationEst: number
  kmEst: number
  fuelEst: number
  fuelBasis: PayoutFuelBasis
}

export type WeekState = 'CLOSED' | 'CURRENT' | 'FUTURE' | 'BEFORE_START'

export function weekStateOf(weekStart: string, today: string, since: string | null): WeekState {
  const { weekEnd } = payWeekOf(weekStart)
  if (weekStart > today) return 'FUTURE'
  if (weekEnd >= today) return 'CURRENT'
  if (since && weekStart < since) return 'BEFORE_START'
  return 'CLOSED'
}

/** Semana inicial das propostas. Sem registro, grava a semana anterior à de hoje (1ª abertura). */
export async function payoutsSince(prisma: Db, now: Date = new Date()): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key: PAYOUTS_SINCE_KEY } })
  if (row && /^\d{4}-\d{2}-\d{2}$/.test(row.value)) return row.value
  const since = payWeekOf(addDays(payWeekOf(brtDateStr(now)).weekStart, -7)).weekStart
  try {
    await prisma.setting.create({ data: { key: PAYOUTS_SINCE_KEY, value: since } })
  } catch {
    // outra abertura gravou junto — vale a que ficou
    const again = await prisma.setting.findUnique({ where: { key: PAYOUTS_SINCE_KEY } })
    if (again) return again.value
  }
  return since
}

/**
 * Calcula a semana de cada entregador com movimento (paradas resolvidas ou rotas) — e de quem
 * recebe semanal fixo e está ativo, mesmo sem movimento.
 */
export async function computeWeek(prisma: Db, weekStart: string, opts: { courierIds?: string[]; includeIdle?: boolean } = {}): Promise<WeekCalc[]> {
  const { weekEnd } = payWeekOf(weekStart)
  const couriers = await prisma.user.findMany({
    where: { role: 'COURIER', ...(opts.courierIds ? { id: { in: opts.courierIds } } : {}) },
    select: { id: true, name: true, isBlocked: true, courierPay: true, courierVehicle: true, courierPhotoUrl: true },
    orderBy: { name: 'asc' },
  })
  if (couriers.length === 0) return []
  const ids = couriers.map((c) => c.id)
  const [stops, runs, cfg] = await Promise.all([
    resolvedCourierStops(prisma, ids, weekStart, weekEnd),
    prisma.courierRun.findMany({
      where: { courierId: { in: ids }, date: { gte: weekStart, lte: weekEnd }, status: { in: ['STARTED', 'ENDED'] } },
      select: { courierId: true, status: true, plannedKm: true },
    }),
    getRouteConfig(prisma),
  ])
  const prices = { gasolina: cfg.precoGasolina, etanol: cfg.precoEtanol, gnv: cfg.precoGnv }
  const out: WeekCalc[] = []
  for (const c of couriers) {
    const entregas = stops.filter((s) => s.courierId === c.id && s.status === 'DELIVERED').length
    const failed = stops.filter((s) => s.courierId === c.id && s.status === 'NOT_DELIVERED').length
    const mine = runs.filter((r) => r.courierId === c.id)
    const ended = mine.filter((r) => r.status === 'ENDED')
    const openRuns = mine.length - ended.length
    const km = ended.reduce((n, r) => n + (r.plannedKm ?? 0), 0)
    const pay = (c.courierPay ?? null) as { modalidade?: string | null; valor?: number | null; pagaCombustivel?: boolean | null } | null
    const p = payoutProposal({ pay, vehicle: (c.courierVehicle ?? null) as Record<string, never> | null, prices, entregas, rotas: ended.length, km })
    const moved = entregas + failed + mine.length > 0
    if (!opts.includeIdle && !moved && !(p.payMode === 'WEEKLY_FIXED' && !c.isBlocked)) continue
    out.push({
      courierId: c.id,
      name: c.name,
      photoUrl: c.courierPhotoUrl ?? null,
      isBlocked: c.isBlocked,
      pagaCombustivel: pay?.pagaCombustivel !== false,
      payMode: p.payMode,
      payAmount: p.payAmount,
      entregas,
      rotas: ended.length,
      openRuns,
      units: p.units,
      remunerationEst: p.remunerationEst,
      kmEst: p.kmEst,
      fuelEst: p.fuelEst,
      fuelBasis: p.fuelBasis,
    })
  }
  return out
}

const sameEstimate = (a: CourierPayout, c: WeekCalc) =>
  a.payMode === c.payMode &&
  (a.payAmount ?? null) === c.payAmount &&
  a.units === c.units &&
  a.remunerationEst === c.remunerationEst &&
  a.kmEst === c.kmEst &&
  a.fuelEst === c.fuelEst &&
  JSON.stringify(a.fuelBasis ?? null) === JSON.stringify(c.fuelBasis)

/**
 * Grava as propostas de uma semana FECHADA (idempotente: o índice único courierId+weekStart
 * impede a semana em dobro). Pendentes são atualizadas; as demais não mudam.
 * @returns as propostas da semana e o cálculo (para as rotas não encerradas).
 */
export async function materializeWeek(prisma: Db, weekStart: string): Promise<{ payouts: CourierPayout[]; calc: WeekCalc[] }> {
  const { weekEnd } = payWeekOf(weekStart)
  const calc = await computeWeek(prisma, weekStart)
  const existing = await prisma.courierPayout.findMany({ where: { weekStart } })
  const byCourier = new Map(existing.map((p) => [p.courierId, p]))
  for (const c of calc) {
    const data = {
      payMode: c.payMode,
      payAmount: c.payAmount,
      units: c.units,
      remunerationEst: c.remunerationEst,
      kmEst: c.kmEst,
      fuelEst: c.fuelEst,
      fuelBasis: c.fuelBasis as object,
    }
    const cur = byCourier.get(c.courierId)
    if (!cur) {
      try {
        await prisma.courierPayout.create({ data: { courierId: c.courierId, weekStart, weekEnd, status: 'PENDING', expenseIds: [], ...data } })
      } catch (err) {
        const code = (err as { code?: string }).code
        if (code !== 'P2002') throw err // gravada por outra abertura ao mesmo tempo
      }
    } else if (cur.status === 'PENDING' && !sameEstimate(cur, c)) {
      await prisma.courierPayout.updateMany({ where: { id: cur.id, status: 'PENDING' }, data })
    }
  }
  return { payouts: await prisma.courierPayout.findMany({ where: { weekStart } }), calc }
}

/**
 * Garante as propostas da última semana fechada (a de antes da semana de hoje), se ela já conta.
 * Nunca lança. @returns a semana, ou null quando ainda não há o que gerar
 */
export async function ensureLastClosedWeek(prisma: Db, now: Date = new Date(), log?: { warn: (o: object, m: string) => void }): Promise<string | null> {
  const today = brtDateStr(now)
  try {
    const since = await payoutsSince(prisma, now)
    const last = addDays(payWeekOf(today).weekStart, -7)
    if (weekStateOf(last, today, since) !== 'CLOSED') return null
    await materializeWeek(prisma, last)
    return last
  } catch (err) {
    log?.warn({ err }, '[payouts] falha ao gerar as propostas da semana — segue')
    return null
  }
}

/** Status que o admin e o entregador veem para uma proposta aprovada, a partir das despesas. */
export type PaidState = 'PAGO' | 'A_PAGAR'
export interface ExpenseBrief {
  id: string
  category: string
  amount: number
  status: 'PENDING' | 'PAID' | 'CANCELLED'
  paidAt: string | null
  dueDate: string | null
}

export function paidStateOf(payout: Pick<CourierPayout, 'paidAt' | 'dueDate'>, expenses: ExpenseBrief[]): { state: PaidState; paidAt: string | null; dueDate: string | null } {
  const live = expenses.filter((e) => e.status !== 'CANCELLED')
  if (live.length > 0) {
    const pending = live.filter((e) => e.status === 'PENDING')
    if (pending.length === 0) {
      const last = live.map((e) => e.paidAt).filter((x): x is string => !!x).sort().pop() ?? null
      return { state: 'PAGO', paidAt: last, dueDate: null }
    }
    const due = pending.map((e) => e.dueDate).filter((x): x is string => !!x).sort()[0] ?? null
    return { state: 'A_PAGAR', paidAt: null, dueDate: due }
  }
  return payout.paidAt
    ? { state: 'PAGO', paidAt: brtDateStr(payout.paidAt), dueDate: null }
    : { state: 'A_PAGAR', paidAt: null, dueDate: payout.dueDate ? brtDateStr(payout.dueDate) : null }
}

/** Despesas das propostas (para "ver despesa" e o status pago / a pagar). */
export async function expensesOf(prisma: Db, payouts: Pick<CourierPayout, 'expenseIds'>[]): Promise<Map<string, ExpenseBrief>> {
  const ids = [...new Set(payouts.flatMap((p) => p.expenseIds))]
  if (ids.length === 0) return new Map()
  const rows = await prisma.expense.findMany({
    where: { id: { in: ids } },
    select: { id: true, amount: true, status: true, paidAt: true, dueDate: true, categoryId: true },
  })
  const catIds = [...new Set(rows.map((e) => e.categoryId))]
  const cats = catIds.length ? await prisma.expenseCategory.findMany({ where: { id: { in: catIds } }, select: { id: true, name: true } }) : []
  const catName = new Map(cats.map((c) => [c.id, c.name]))
  return new Map(
    rows.map((e) => [
      e.id,
      {
        id: e.id,
        category: catName.get(e.categoryId) ?? 'Despesa',
        amount: e.amount,
        status: e.status as ExpenseBrief['status'],
        paidAt: e.paidAt ? brtDateStr(e.paidAt) : null,
        dueDate: e.dueDate ? brtDateStr(e.dueDate) : null,
      },
    ]),
  )
}

export interface PayoutView {
  id: string | null
  courierId: string
  name: string
  photoUrl: string | null
  weekStart: string
  weekEnd: string
  status: 'ESTIMATE' | 'PENDING' | 'EDITED' | 'APPROVED' | 'DISCARDED'
  payMode: string | null
  payAmount: number | null
  units: number
  remunerationEst: number
  kmEst: number
  fuelEst: number
  fuelBasis: PayoutFuelBasis | null
  remunerationFinal: number | null
  fuelFinal: number | null
  estimated: number
  final: number
  adjustReason: string | null
  discardReason: string | null
  approvedAt: string | null
  paid: { state: PaidState; paidAt: string | null; dueDate: string | null } | null
  paymentMethod: string | null
  expenses: ExpenseBrief[]
  openRuns: number
}

export function readFuelBasis(json: unknown): PayoutFuelBasis | null {
  if (!json || typeof json !== 'object') return null
  const b = json as Partial<PayoutFuelBasis>
  const reasons: PayoutFuelReason[] = ['NAO_PAGA', 'NAO_USA', 'SEM_KM', 'SEM_CONSUMO', 'SEM_PRECO']
  return {
    kmPorLitro: typeof b.kmPorLitro === 'number' ? b.kmPorLitro : null,
    preco: typeof b.preco === 'number' ? b.preco : null,
    combustivel: typeof b.combustivel === 'string' ? b.combustivel : null,
    reason: reasons.includes(b.reason as PayoutFuelReason) ? (b.reason as PayoutFuelReason) : null,
  }
}

export function payoutView(
  p: CourierPayout,
  who: { name: string; photoUrl: string | null },
  expenses: Map<string, ExpenseBrief>,
  openRuns = 0,
): PayoutView {
  const t = payoutTotals(p)
  const exp = p.expenseIds.map((id) => expenses.get(id)).filter((x): x is ExpenseBrief => !!x)
  return {
    id: p.id,
    courierId: p.courierId,
    name: who.name,
    photoUrl: who.photoUrl,
    weekStart: p.weekStart,
    weekEnd: p.weekEnd,
    status: p.status as PayoutView['status'],
    payMode: p.payMode ?? null,
    payAmount: p.payAmount ?? null,
    units: p.units,
    remunerationEst: p.remunerationEst,
    kmEst: p.kmEst,
    fuelEst: p.fuelEst,
    fuelBasis: readFuelBasis(p.fuelBasis),
    remunerationFinal: p.remunerationFinal ?? null,
    fuelFinal: p.fuelFinal ?? null,
    estimated: t.estimated,
    final: t.final,
    adjustReason: p.adjustReason ?? null,
    discardReason: p.discardReason ?? null,
    approvedAt: p.approvedAt ? p.approvedAt.toISOString() : null,
    paid: p.status === 'APPROVED' ? paidStateOf(p, exp) : null,
    paymentMethod: p.paymentMethod ?? null,
    expenses: exp,
    openRuns,
  }
}

/** A semana em andamento como proposta só estimada (não gravada). */
export function estimateView(c: WeekCalc, weekStart: string): PayoutView {
  const t = payoutTotals(c)
  return {
    id: null,
    courierId: c.courierId,
    name: c.name,
    photoUrl: c.photoUrl,
    weekStart,
    weekEnd: payWeekOf(weekStart).weekEnd,
    status: 'ESTIMATE',
    payMode: c.payMode,
    payAmount: c.payAmount,
    units: c.units,
    remunerationEst: c.remunerationEst,
    kmEst: c.kmEst,
    fuelEst: c.fuelEst,
    fuelBasis: c.fuelBasis,
    remunerationFinal: null,
    fuelFinal: null,
    estimated: t.estimated,
    final: t.final,
    adjustReason: null,
    discardReason: null,
    approvedAt: null,
    paid: null,
    paymentMethod: null,
    expenses: [],
    openRuns: c.openRuns,
  }
}
