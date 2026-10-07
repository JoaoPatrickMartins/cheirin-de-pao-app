import type { FastifyInstance } from 'fastify'
import { payoutTotals, payWeekOf, type PayoutFuelBasis } from '@cheirin-de-pao/shared'
import { brtDateStr } from '../../lib/cutoff.js'
import { getRouteConfig } from '../../lib/route-config.js'
import { computeWeek, ensureLastClosedWeek, expensesOf, payoutView } from '../admin-courier-payouts/payouts.core.js'

/**
 * E13 · Meus ganhos (plano do entregador, Onda 7): a modalidade, a semana em andamento estimada
 * (não gravada) e o extrato das semanas — "em análise" enquanto a operação revisa, depois "pago" ou
 * "a pagar" pelo que ela lançou. O valor final é sempre o aprovado.
 *
 * Sem o switch "Meus ganhos" do A5 (padrão desligado, H-7), o combustível entra só como valor: o km, a
 * conta (km/l e preço) e os avisos de consumo/preço não vão ao aparelho. `NAO_PAGA`/`NAO_USA` ficam —
 * explicam por que não há combustível no pagamento.
 */
export interface CourierEarnings {
  pay: { modalidade: string | null; valor: number | null; pagaCombustivel: boolean } | null
  /** O entregador vê a conta do combustível (km ÷ km/l × preço). */
  fuelDetailVisible: boolean
  current: {
    weekStart: string
    weekEnd: string
    entregas: number
    rotas: number
    units: number
    remuneration: number
    km: number | null
    fuel: number
    fuelBasis: PayoutFuelBasis
    total: number
    openRuns: number
  }
  extrato: Array<{
    weekStart: string
    weekEnd: string
    status: 'EM_ANALISE' | 'PAGO' | 'A_PAGAR'
    remuneration: number
    fuel: number
    estimated: number
    final: number
    paidAt: string | null
    dueDate: string | null
  }>
}

export class CourierEarningsService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /** @throws 404 */
  async earnings(courierId: string, now: Date = new Date()): Promise<CourierEarnings> {
    const u = await this.prisma.user.findUnique({ where: { id: courierId }, select: { courierPay: true } })
    if (!u) throw { statusCode: 404, message: 'Entregador não encontrado' }
    const pay = (u.courierPay ?? null) as { modalidade?: string | null; valor?: number | null; pagaCombustivel?: boolean | null } | null
    const { weekStart, weekEnd } = payWeekOf(brtDateStr(now))
    await ensureLastClosedWeek(this.prisma, now, this.fastify.log)
    const [[c], rows, cfg] = await Promise.all([
      computeWeek(this.prisma, weekStart, { courierIds: [courierId], includeIdle: true }),
      this.prisma.courierPayout.findMany({
        where: { courierId, status: { in: ['PENDING', 'EDITED', 'APPROVED'] } },
        orderBy: { weekStart: 'desc' },
        take: 8,
      }),
      getRouteConfig(this.prisma),
    ])
    if (!c) throw { statusCode: 404, message: 'Entregador não encontrado' }
    const expenses = await expensesOf(this.prisma, rows)
    const total = payoutTotals(c)
    const detail = cfg.entregadorVeCombGanhos
    const reason = c.fuelBasis.reason
    const fuelBasis: PayoutFuelBasis = detail
      ? c.fuelBasis
      : { kmPorLitro: null, preco: null, combustivel: null, reason: reason === 'NAO_PAGA' || reason === 'NAO_USA' ? reason : null }
    return {
      pay: pay ? { modalidade: pay.modalidade ?? null, valor: pay.valor ?? null, pagaCombustivel: pay.pagaCombustivel !== false } : null,
      fuelDetailVisible: detail,
      current: {
        weekStart,
        weekEnd,
        entregas: c.entregas,
        rotas: c.rotas,
        units: c.units,
        remuneration: c.remunerationEst,
        km: detail ? c.kmEst : null,
        fuel: c.fuelEst,
        fuelBasis,
        total: total.estimated,
        openRuns: c.openRuns,
      },
      extrato: rows.map((p) => {
        const v = payoutView(p, { name: '', photoUrl: null }, expenses)
        const t = payoutTotals(p)
        return {
          weekStart: p.weekStart,
          weekEnd: p.weekEnd,
          status: p.status === 'APPROVED' ? v.paid!.state : 'EM_ANALISE',
          remuneration: t.remuneration,
          fuel: t.fuel,
          estimated: t.estimated,
          final: t.final,
          paidAt: v.paid?.paidAt ?? null,
          dueDate: v.paid?.dueDate ?? null,
        }
      }),
    }
  }
}
