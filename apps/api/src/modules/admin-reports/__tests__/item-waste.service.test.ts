// Onda G4 — desperdício dos ITENS do mercadinho, com valor em R$ (custo da matriz, H9).
// Série SEPARADA da do pão (D-1): comparar potes de geleia com pães comprados não significa nada.
import { describe, it, expect, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { AdminReportsService } from '../admin-reports.service.js'

type Failed = {
  stockReturned: boolean | null
  lossResolvedAt: Date | null
  items: { productId: string; name: string; qty: number }[]
}

function makeService(over: {
  committed?: Array<{ items: { productId: string; name: string; qty: number }[] }>
  delivered?: Array<{ items: { qty: number }[] }>
  failed?: Failed[]
  costs?: Array<{ productId: string; supplierId: string; unitCost: number; defaultSharePct: number; isPreferred: boolean }>
} = {}) {
  const { committed = [], delivered = [], failed = [], costs = [] } = over

  const prisma = {
    purchaseOrder: { aggregate: vi.fn().mockResolvedValue({ _sum: { totalQuantity: 0 } }) },
    order: { aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: 0 } }) },
    marketOrder: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { breadQty: 0 } }),
      findMany: vi.fn().mockImplementation((args: { where: { status: unknown } }) => {
        const status = args.where.status
        if (typeof status === 'string') {
          return Promise.resolve(status === 'DELIVERED' ? delivered : failed)
        }
        return Promise.resolve(committed) // CONFIRMED_MARKET_STATUSES
      }),
    },
    supplierProduct: { findMany: vi.fn().mockResolvedValue(costs) },
    supplier: { findMany: vi.fn().mockResolvedValue([{ id: 'sup-1' }]) },
  }

  return new AdminReportsService({ prisma, log: { warn: vi.fn(), error: vi.fn() } } as unknown as FastifyInstance)
}

const geleia = (qty: number) => ({ productId: 'geleia', name: 'Geleia', qty })
const custoGeleia = { productId: 'geleia', supplierId: 'sup-1', unitCost: 8, defaultSharePct: 100, isPreferred: true }

describe('getWasteReport — itens do mercadinho (G4)', () => {
  it('perda resolvida como "não voltou" conta em unidades e em R$', async () => {
    const service = makeService({
      committed: [{ items: [geleia(10)] }],
      delivered: [{ items: [{ qty: 7 }] }],
      failed: [{ stockReturned: false, lossResolvedAt: new Date('2026-07-29'), items: [geleia(3)] }],
      costs: [custoGeleia],
    })
    const r = await service.getWasteReport('month')

    expect(r.items).toMatchObject({ committed: 10, delivered: 7, lost: 3, returned: 0, pending: 0, lostValue: 24 })
    expect(r.items.lossRate).toBeCloseTo(0.3) // 3 de 10 que saíram
    expect(r.items.byProduct).toEqual([{ productId: 'geleia', productName: 'Geleia', lost: 3, lostValue: 24 }])
  })

  it('item que VOLTOU à prateleira não é perda', async () => {
    const service = makeService({
      failed: [{ stockReturned: true, lossResolvedAt: new Date('2026-07-29'), items: [geleia(4)] }],
      costs: [custoGeleia],
    })
    const r = await service.getWasteReport('month')

    expect(r.items).toMatchObject({ lost: 0, returned: 4, lostValue: 0 })
    expect(r.items.byProduct).toEqual([])
  })

  it('falha SEM desfecho fica em `pending` — não inventa prejuízo', async () => {
    const service = makeService({
      failed: [{ stockReturned: null, lossResolvedAt: null, items: [geleia(5)] }],
      costs: [custoGeleia],
    })
    const r = await service.getWasteReport('month')

    // Enquanto ninguém apurou se o produto voltou, chamar isso de perda seria inventar um número.
    expect(r.items).toMatchObject({ lost: 0, returned: 0, pending: 5, lostValue: 0, lossRate: 0 })
  })

  it('produto perdido sem custo cadastrado conta unidade, mas não inventa valor', async () => {
    const service = makeService({
      failed: [{ stockReturned: false, lossResolvedAt: new Date('2026-07-29'), items: [geleia(2)] }],
      costs: [], // ninguém fornece → sem custo
    })
    const r = await service.getWasteReport('month')

    expect(r.items.lost).toBe(2)
    expect(r.items.lostValue).toBe(0)
  })

  it('a série do PÃO continua intacta ao lado da nova (D-1)', async () => {
    const service = makeService({ committed: [{ items: [geleia(3)] }] })
    const r = await service.getWasteReport('month')

    expect(r).toMatchObject({ ordered: 0, delivered: 0, waste: 0, wasteRate: 0 })
    expect(r.items.committed).toBe(3)
  })

  it('sem movimento de itens → tudo zero, sem divisão por zero', async () => {
    const r = await makeService().getWasteReport('day')
    expect(r.items).toMatchObject({ committed: 0, delivered: 0, lost: 0, lossRate: 0, byProduct: [] })
  })
})
