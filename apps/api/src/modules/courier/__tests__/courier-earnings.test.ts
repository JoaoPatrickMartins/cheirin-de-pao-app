// E13 · Meus ganhos (Onda 7 do plano do entregador): semana em andamento estimada (não gravada) e o
// extrato — em análise · pago · a pagar, pelo que a operação lançou.
import { describe, it, expect, vi } from 'vitest'
import { CourierEarningsService } from '../courier-earnings.js'
import { PAYOUTS_SINCE_KEY } from '../../admin-courier-payouts/payouts.core.js'

const at = (day: string) => new Date(`${day}T09:00:00.000Z`)
const now = new Date('2026-10-02T15:00:00.000Z') // sexta; semana 28/09–04/10

function prisma(over: { pay?: unknown; payouts?: unknown[]; settings?: Record<string, string> } = {}) {
  const courier = {
    id: 'k1',
    name: 'Antônio Ribeiro',
    role: 'COURIER',
    isBlocked: false,
    courierPhotoUrl: null,
    courierPay: over.pay === undefined ? { modalidade: 'PER_DELIVERY', valor: 1.5, pagaCombustivel: true } : over.pay,
    courierVehicle: { tipo: 'MOTO', combustivel: 'GASOLINA', kmPorLitro: 38 },
  }
  return {
    user: { findUnique: vi.fn(async () => courier), findMany: vi.fn(async () => [courier]) },
    order: {
      findMany: vi.fn(async () => [
        { courierId: 'k1', userId: 'u1', slotId: 'manha', scheduledDate: at('2026-09-29'), status: 'DELIVERED', quantity: 4 },
        { courierId: 'k1', userId: 'u2', slotId: 'manha', scheduledDate: at('2026-09-30'), status: 'DELIVERED', quantity: 2 },
      ]),
    },
    marketOrder: { findMany: vi.fn(async () => []) },
    deliveryProof: { findMany: vi.fn(async () => []) },
    courierRun: { findMany: vi.fn(async () => [{ courierId: 'k1', status: 'ENDED', plannedKm: 38 }]) },
    setting: {
      findMany: vi.fn(async () => [{ key: 'combustivelGasolina', value: '6.09' }, ...Object.entries(over.settings ?? {}).map(([key, value]) => ({ key, value }))]),
      findUnique: vi.fn(async ({ where }: { where: { key: string } }) => (where.key === PAYOUTS_SINCE_KEY ? { key: PAYOUTS_SINCE_KEY, value: '2026-09-21' } : null)),
      create: vi.fn(),
    },
    courierPayout: {
      findMany: vi.fn(async ({ where }: { where: { weekStart?: string } }) =>
        where.weekStart
          ? []
          : over.payouts ?? [
              { id: 'p3', courierId: 'k1', weekStart: '2026-09-21', weekEnd: '2026-09-27', status: 'PENDING', remunerationEst: 300, fuelEst: 11, remunerationFinal: null, fuelFinal: null, expenseIds: [], paidAt: null, dueDate: null, fuelBasis: null },
              { id: 'p2', courierId: 'k1', weekStart: '2026-09-14', weekEnd: '2026-09-20', status: 'APPROVED', remunerationEst: 312, fuelEst: 11.4, remunerationFinal: 312, fuelFinal: 8, expenseIds: ['e1', 'e2'], paidAt: null, dueDate: null, fuelBasis: null },
              { id: 'p1', courierId: 'k1', weekStart: '2026-09-07', weekEnd: '2026-09-13', status: 'APPROVED', remunerationEst: 307.5, fuelEst: 11.1, remunerationFinal: null, fuelFinal: null, expenseIds: ['e3'], paidAt: null, dueDate: null, fuelBasis: null },
            ],
      ),
      create: vi.fn(async ({ data }: { data: object }) => data),
      updateMany: vi.fn(),
    },
    expense: {
      findMany: vi.fn(async () => [
        { id: 'e1', amount: 312, status: 'PAID', paidAt: new Date('2026-09-22T15:00:00Z'), dueDate: null, categoryId: 'c1' },
        { id: 'e2', amount: 8, status: 'PAID', paidAt: new Date('2026-09-22T15:00:00Z'), dueDate: null, categoryId: 'c2' },
        { id: 'e3', amount: 318.6, status: 'PENDING', paidAt: null, dueDate: new Date('2026-10-02T03:00:00Z'), categoryId: 'c1' },
      ]),
    },
    expenseCategory: { findMany: vi.fn(async () => [{ id: 'c1', name: 'Entregador' }, { id: 'c2', name: 'Combustível' }]) },
  }
}

const svc = (p: unknown) => new CourierEarningsService({ prisma: p, log: { warn: vi.fn() } } as never)

describe('E13 · meus ganhos', () => {
  it('semana em andamento estimada + extrato (em análise, pago com o final, a pagar com o vencimento)', async () => {
    const r = await svc(prisma({ settings: { entregadorVeCombGanhos: 'true' } })).earnings('k1', now)
    expect(r.pay).toEqual({ modalidade: 'PER_DELIVERY', valor: 1.5, pagaCombustivel: true })
    expect(r.fuelDetailVisible).toBe(true) // switch "Meus ganhos" ligado: a conta vai
    expect(r.current).toMatchObject({ weekStart: '2026-09-28', weekEnd: '2026-10-04', entregas: 2, units: 2, remuneration: 3, km: 38, fuel: 6.09, total: 9.09, fuelBasis: { kmPorLitro: 38, preco: 6.09 } })
    expect(r.extrato).toEqual([
      { weekStart: '2026-09-21', weekEnd: '2026-09-27', status: 'EM_ANALISE', remuneration: 300, fuel: 11, estimated: 311, final: 311, paidAt: null, dueDate: null },
      { weekStart: '2026-09-14', weekEnd: '2026-09-20', status: 'PAGO', remuneration: 312, fuel: 8, estimated: 323.4, final: 320, paidAt: '2026-09-22', dueDate: null },
      { weekStart: '2026-09-07', weekEnd: '2026-09-13', status: 'A_PAGAR', remuneration: 307.5, fuel: 11.1, estimated: 318.6, final: 318.6, paidAt: null, dueDate: '2026-10-02' },
    ])
  })

  it('sem modalidade: remuneração 0 e o combustível segue na estimativa', async () => {
    const r = await svc(prisma({ pay: null, payouts: [] })).earnings('k1', now)
    expect(r.pay).toBeNull()
    expect(r.current).toMatchObject({ remuneration: 0, fuel: 6.09, total: 6.09 })
    expect(r.extrato).toEqual([])
  })

  it('switch "Meus ganhos" desligado (padrão): o valor do combustível fica, o km e a conta não vão (H-7)', async () => {
    const r = await svc(prisma()).earnings('k1', now)
    expect(r.fuelDetailVisible).toBe(false)
    expect(r.current).toMatchObject({ km: null, fuel: 6.09, total: 9.09, fuelBasis: { kmPorLitro: null, preco: null, combustivel: null, reason: null } })
  })

  it('desligado, "a operação não paga combustível" continua (explica a falta da linha)', async () => {
    const r = await svc(prisma({ pay: { modalidade: 'PER_DELIVERY', valor: 1.5, pagaCombustivel: false }, settings: { entregadorVeCombGanhos: 'false' } })).earnings('k1', now)
    expect(r.current.fuelBasis.reason).toBe('NAO_PAGA')
    expect(r.current.fuel).toBe(0)
  })
})
