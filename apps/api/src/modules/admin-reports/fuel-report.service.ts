import type { FastifyInstance } from 'fastify'
import { fuelPriceFor, fuelUnit, vehicleUsesFuel } from '@cheirin-de-pao/shared'
import type { DateWindow } from '../../lib/date-range.js'
import { brtDateStr } from '../../lib/cutoff.js'
import { getRouteConfig } from '../../lib/route-config.js'
import { resolvedCourierStops } from '../../lib/courier-stops.js'
import { readAcceptLog, type RouteChange } from '../courier/courier-plan.js'

/**
 * A9 · Combustível & rotas (plano do entregador, Onda 7). TUDO estimado: km da rota planejada de
 * cada turno encerrado e o consumo cadastrado do veículo. Rota encerrada usa o que foi congelado no
 * encerramento (km/l e preço do dia); sem isso, o cadastro e o preço de hoje.
 *
 * Economia das rotas aceitas: cada turno encerrado depois de um "Usar sugestão" conta a diferença
 * entre a alternativa evitada (a rota salva com os prédios novos) e a rota aceita — até a próxima
 * mudança da rota salva.
 *
 * GNV (Onda 11 · T-37) é medido em m³: `litros` soma só gasolina/etanol/flex e `m3` soma o GNV — somar
 * os dois daria um número sem sentido. O combustível vem do que a rota gravou no encerramento
 * (`summary.combustivel`); rota antiga, do cadastro de hoje.
 */
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d

export interface FuelReport {
  window: { from: string; to: string; label: string; isPartial: boolean }
  runs: number
  km: number
  litros: number
  /** GNV, em m³. */
  m3: number
  gasto: number
  entregas: number
  paes: number
  porEntrega: number | null
  porPao: number | null
  savings: { km: number; value: number | null; runs: number }
  couriers: Array<{ courierId: string; name: string; runs: number; km: number; litros: number; m3: number; gasto: number; entregas: number; porEntrega: number | null; semConsumo: boolean; semPreco: boolean }>
}

export class FuelReportService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  async getReport(win: DateWindow): Promise<FuelReport> {
    const from = brtDateStr(win.startDate)
    const to = brtDateStr(new Date(Math.max(win.startDate.getTime(), win.endDate.getTime() - 1)))
    const empty: FuelReport = {
      window: { from, to, label: win.label, isPartial: win.isPartial },
      runs: 0,
      km: 0,
      litros: 0,
      m3: 0,
      gasto: 0,
      entregas: 0,
      paes: 0,
      porEntrega: null,
      porPao: null,
      savings: { km: 0, value: null, runs: 0 },
      couriers: [],
    }
    if (win.endDate <= win.startDate) return empty

    const runs = await this.prisma.courierRun.findMany({
      where: { status: 'ENDED', date: { gte: from, lte: to } },
      select: { courierId: true, slotId: true, date: true, plannedKm: true, kmPerLiter: true, fuelPrice: true, fuelEstimate: true, summary: true },
    })
    if (runs.length === 0) return empty
    const ids = [...new Set(runs.map((r) => r.courierId))]
    const [users, cfg, stops, templates] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, courierVehicle: true } }),
      getRouteConfig(this.prisma),
      resolvedCourierStops(this.prisma, ids, from, to),
      this.prisma.courierRouteTemplate.findMany({ where: { courierId: { in: ids } }, select: { courierId: true, slotId: true, acceptLog: true } }),
    ])
    const prices = { gasolina: cfg.precoGasolina, etanol: cfg.precoEtanol, gnv: cfg.precoGnv }
    const logs = new Map<string, RouteChange[]>(templates.map((t) => [`${t.courierId}|${t.slotId}`, readAcceptLog(t.acceptLog).sort((a, b) => a.at.localeCompare(b.at))]))

    type Acc = FuelReport['couriers'][number]
    const per = new Map<string, Acc>()
    let savedKm = 0
    let savedValue = 0
    let valueKnown = false
    let savedRuns = 0

    for (const r of runs) {
      const u = users.find((x) => x.id === r.courierId)
      const v = (u?.courierVehicle ?? null) as { tipo?: string; combustivel?: string; kmPorLitro?: number } | null
      const acc =
        per.get(r.courierId) ??
        ({ courierId: r.courierId, name: u?.name ?? 'Entregador', runs: 0, km: 0, litros: 0, m3: 0, gasto: 0, entregas: 0, porEntrega: null, semConsumo: false, semPreco: false } as Acc)
      const km = r.plannedKm ?? 0
      const usa = r.kmPerLiter != null || vehicleUsesFuel(v?.tipo)
      const kmL = r.kmPerLiter ?? (usa && v?.kmPorLitro && v.kmPorLitro > 0 ? v.kmPorLitro : null)
      const fuel = ((r.summary ?? null) as { combustivel?: string | null } | null)?.combustivel ?? v?.combustivel ?? null
      const price = r.fuelPrice ?? (usa ? fuelPriceFor(fuel, prices) : null)
      acc.runs += 1
      acc.km += km
      if (usa) {
        if (!kmL) acc.semConsumo = true
        else {
          if (fuelUnit(fuel) === 'm³') acc.m3 += km / kmL
          else acc.litros += km / kmL
          if (r.fuelEstimate != null) acc.gasto += r.fuelEstimate
          else if (price) acc.gasto += (km / kmL) * price
          else acc.semPreco = true
        }
      }
      per.set(r.courierId, acc)

      // Economia: a última mudança da rota salva até o dia do turno precisa ser um aceite.
      const log = logs.get(`${r.courierId}|${r.slotId}`) ?? []
      const last = [...log].reverse().find((e) => e.date <= r.date)
      if (last?.kind === 'ACCEPT' && last.kmAlt != null && last.km != null && last.kmAlt > last.km) {
        const d = last.kmAlt - last.km
        savedKm += d
        savedRuns += 1
        if (kmL && price) {
          savedValue += (d / kmL) * price
          valueKnown = true
        }
      }
    }

    for (const s of stops) {
      if (s.status !== 'DELIVERED') continue
      const acc = per.get(s.courierId)
      if (acc) acc.entregas += 1
    }
    const paes = stops.filter((s) => s.status === 'DELIVERED').reduce((n, s) => n + s.breads, 0)
    const couriers = [...per.values()]
      .map((c) => ({ ...c, km: round(c.km, 1), litros: round(c.litros, 1), m3: round(c.m3, 1), gasto: round(c.gasto), porEntrega: c.entregas > 0 ? round(c.gasto / c.entregas) : null }))
      .sort((a, b) => b.km - a.km)
    const gasto = round(couriers.reduce((n, c) => n + c.gasto, 0))
    const entregas = couriers.reduce((n, c) => n + c.entregas, 0)
    return {
      window: empty.window,
      runs: runs.length,
      km: round(couriers.reduce((n, c) => n + c.km, 0), 1),
      litros: round(couriers.reduce((n, c) => n + c.litros, 0), 1),
      m3: round(couriers.reduce((n, c) => n + c.m3, 0), 1),
      gasto,
      entregas,
      paes,
      porEntrega: entregas > 0 ? round(gasto / entregas) : null,
      porPao: paes > 0 ? round(gasto / paes) : null,
      savings: { km: round(savedKm, 1), value: valueKnown ? round(savedValue) : null, runs: savedRuns },
      couriers,
    }
  }
}
