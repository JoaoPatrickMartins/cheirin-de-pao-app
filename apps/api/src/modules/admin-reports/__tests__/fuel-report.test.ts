// A9 · Combustível & rotas (Onda 7 do plano do entregador): KPIs estimados, por entregador (o
// congelado no encerramento ou o cadastro de hoje) e a economia das rotas aceitas.
import { describe, it, expect, vi } from 'vitest'
import { FuelReportService } from '../fuel-report.service.js'
import { rangeWindow } from '../../../lib/date-range.js'

const at = (day: string) => new Date(`${day}T09:00:00.000Z`)
const now = new Date('2026-10-02T15:00:00.000Z')

function prisma(over: { runs?: unknown[] } = {}) {
  return {
    courierRun: {
      findMany: vi.fn(async () =>
        over.runs ?? [
          // Antônio: 2 turnos congelados no encerramento + 1 sem (usa o cadastro e o preço de hoje)
          { courierId: 'k1', slotId: 'manha', date: '2026-09-29', plannedKm: 19, kmPerLiter: 38, fuelPrice: 6.09, fuelEstimate: 3.05 },
          { courierId: 'k1', slotId: 'manha', date: '2026-09-30', plannedKm: 19, kmPerLiter: 38, fuelPrice: 6.09, fuelEstimate: 3.05 },
          { courierId: 'k1', slotId: 'manha', date: '2026-10-01', plannedKm: 38, kmPerLiter: null, fuelPrice: null, fuelEstimate: null },
          // Rui de bicicleta: km sem combustível
          { courierId: 'k2', slotId: 'tarde', date: '2026-09-30', plannedKm: 12, kmPerLiter: null, fuelPrice: null, fuelEstimate: null },
          // Tereza: carro sem consumo cadastrado
          { courierId: 'k3', slotId: 'manha', date: '2026-09-30', plannedKm: 30, kmPerLiter: null, fuelPrice: null, fuelEstimate: null },
        ],
      ),
    },
    user: {
      findMany: vi.fn(async () => [
        { id: 'k1', name: 'Antônio Ribeiro', courierVehicle: { tipo: 'MOTO', combustivel: 'FLEX', kmPorLitro: 38 } },
        { id: 'k2', name: 'Rui Martins', courierVehicle: { tipo: 'BIKE' } },
        { id: 'k3', name: 'Dona Tereza', courierVehicle: { tipo: 'CARRO', combustivel: 'ETANOL' } },
        // Lia: rodou com GNV e depois trocou o cadastro para gasolina (vale o que a rota gravou)
        { id: 'k4', name: 'Lia Souza', courierVehicle: { tipo: 'CARRO', combustivel: 'GASOLINA', kmPorLitro: 10 } },
      ]),
    },
    setting: { findMany: vi.fn(async () => [{ key: 'combustivelGasolina', value: '6.09' }, { key: 'combustivelEtanol', value: '4.19' }]) },
    order: {
      findMany: vi.fn(async () => [
        { courierId: 'k1', userId: 'u1', slotId: 'manha', scheduledDate: at('2026-09-29'), status: 'DELIVERED', quantity: 4 },
        { courierId: 'k1', userId: 'u2', slotId: 'manha', scheduledDate: at('2026-09-30'), status: 'DELIVERED', quantity: 6 },
        { courierId: 'k1', userId: 'u3', slotId: 'manha', scheduledDate: at('2026-10-01'), status: 'NOT_DELIVERED', quantity: 2 },
        { courierId: 'k2', userId: 'u4', slotId: 'tarde', scheduledDate: at('2026-09-30'), status: 'DELIVERED', quantity: 2 },
      ]),
    },
    marketOrder: { findMany: vi.fn(async () => []) },
    deliveryProof: { findMany: vi.fn(async () => []) },
    courierRouteTemplate: {
      findMany: vi.fn(async () => [
        {
          courierId: 'k1',
          slotId: 'manha',
          // aceite em 30/09 economizou 1,5 km por turno (9,6 → 8,1); a mudança de 01/10 encerra a conta
          acceptLog: [
            { at: '2026-09-30T08:00:00.000Z', date: '2026-09-30', kind: 'ACCEPT', km: 8.1, kmAlt: 9.6 },
            { at: '2026-10-01T08:00:00.000Z', date: '2026-10-01', kind: 'ADJUST', km: 8.5, kmAlt: null },
          ],
        },
      ]),
    },
  }
}

const svc = (p: unknown) => new FuelReportService({ prisma: p } as never)

describe('A9 · combustível & rotas', () => {
  it('KPIs, por entregador e quem fica fora do gasto', async () => {
    const r = await svc(prisma()).getReport(rangeWindow('2026-09-28', '2026-10-04', now))
    expect(r.window).toMatchObject({ from: '2026-09-28', to: '2026-10-04' })
    expect(r).toMatchObject({ runs: 5, km: 118, entregas: 3, paes: 12 })
    const k1 = r.couriers.find((c) => c.courierId === 'k1')!
    // 3,05 + 3,05 congelados + 38 km ÷ 38 × 6,09 (cadastro e preço de hoje)
    expect(k1).toMatchObject({ runs: 3, km: 76, litros: 2, gasto: 12.19, entregas: 2, porEntrega: 6.1, semConsumo: false })
    expect(r.couriers.find((c) => c.courierId === 'k2')).toMatchObject({ km: 12, gasto: 0, litros: 0, semConsumo: false })
    expect(r.couriers.find((c) => c.courierId === 'k3')).toMatchObject({ km: 30, gasto: 0, semConsumo: true })
    expect(r.couriers.map((c) => c.courierId)).toEqual(['k1', 'k3', 'k2'])
    expect(r).toMatchObject({ gasto: 12.19, porEntrega: 4.06, porPao: 1.02 })
  })

  it('economia: só os turnos depois do aceite e antes da próxima mudança', async () => {
    const r = await svc(prisma()).getReport(rangeWindow('2026-09-28', '2026-10-04', now))
    // só o turno de 30/09 conta: 1,5 km ÷ 38 × 6,09
    expect(r.savings).toEqual({ km: 1.5, value: 0.24, runs: 1 })
  })

  it('GNV (Onda 11): m³ separados dos litros, pelo combustível gravado no encerramento', async () => {
    const runs = [
      { courierId: 'k4', slotId: 'manha', date: '2026-09-30', plannedKm: 24, kmPerLiter: 12, fuelPrice: 4.99, fuelEstimate: 9.98, summary: { entregues: 5, combustivel: 'GNV' } },
      { courierId: 'k1', slotId: 'manha', date: '2026-09-30', plannedKm: 19, kmPerLiter: 38, fuelPrice: 6.09, fuelEstimate: 3.05, summary: { entregues: 3, combustivel: 'FLEX' } },
    ]
    const r = await svc(prisma({ runs })).getReport(rangeWindow('2026-09-28', '2026-10-04', now))
    expect(r.couriers.find((c) => c.courierId === 'k4')).toMatchObject({ m3: 2, litros: 0, gasto: 9.98 })
    expect(r.couriers.find((c) => c.courierId === 'k1')).toMatchObject({ m3: 0, litros: 0.5 })
    expect(r).toMatchObject({ litros: 0.5, m3: 2, gasto: 13.03 })
  })

  it('sem rotas encerradas no período: vazio', async () => {
    const r = await svc(prisma({ runs: [] })).getReport(rangeWindow('2026-09-01', '2026-09-07', now))
    expect(r).toMatchObject({ runs: 0, km: 0, gasto: 0, couriers: [], porEntrega: null, savings: { km: 0, value: null } })
  })
})
