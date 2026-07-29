// Onda G1 — comprometido por produto e por dia. Responde "quanto preparar/comprar para cada dia",
// que a Separação (que só olha HOJE) não responde.
import { describe, it, expect, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { AdminMarketService } from '../admin-market.service.js'
import { brtDateStr } from '../../../lib/cutoff.js'

function makeService(over: {
  orders?: Array<{ scheduledDate: Date; items: { productId: string; name: string; qty: number }[] }>
  products?: Array<{ id: string; name: string; stockType: string; stock: number | null; dailyCapacity: number | null }>
  dailyStocks?: Array<{ productId: string; date: string; reserved: number }>
} = {}) {
  const { orders = [], products = [], dailyStocks = [] } = over
  const marketFindMany = vi.fn().mockResolvedValue(orders)
  const prisma = {
    marketOrder: { findMany: marketFindMany },
    product: { findMany: vi.fn().mockResolvedValue(products) },
    productDailyStock: { findMany: vi.fn().mockResolvedValue(dailyStocks) },
  }
  return {
    service: new AdminMarketService({ prisma, log: { warn: vi.fn(), error: vi.fn() } } as unknown as FastifyInstance),
    marketFindMany,
  }
}

const HOJE = brtDateStr(new Date())
const noonToday = () => {
  const [y, m, d] = HOJE.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 15)) // meio-dia BRT
}

const bolo = { id: 'bolo', name: 'Bolo', stockType: 'DAILY', stock: null, dailyCapacity: 12 }
const geleia = { id: 'geleia', name: 'Geleia', stockType: 'FIXED', stock: 9, dailyCapacity: null }

describe('getStockOutlook', () => {
  it('agrupa o confirmado por dia e produto, e mostra as vagas do dia', async () => {
    const { service } = makeService({
      products: [bolo],
      orders: [{ scheduledDate: noonToday(), items: [{ productId: 'bolo', name: 'Bolo', qty: 5 }] }],
      dailyStocks: [{ productId: 'bolo', date: HOJE, reserved: 7 }],
    })
    const r = await service.getStockOutlook(3)

    expect(r.days).toHaveLength(3)
    const hoje = r.days[0]
    expect(hoje.date).toBe(HOJE)
    expect(hoje.totalItems).toBe(5)
    expect(hoje.products[0]).toMatchObject({
      productName: 'Bolo',
      confirmed: 5, // é por este que se prepara
      reserved: 7, // inclui os 2 presos em carrinho não pago
      capacity: 12,
      available: 5,
    })
  })

  it('produto FIXO traz estoque em vez de vagas', async () => {
    const { service } = makeService({
      products: [geleia],
      orders: [{ scheduledDate: noonToday(), items: [{ productId: 'geleia', name: 'Geleia', qty: 2 }] }],
    })
    const r = await service.getStockOutlook(1)

    expect(r.days[0].products[0]).toMatchObject({ stock: 9, reserved: null, capacity: null, available: null })
  })

  it('dia sem movimento vem vazio em vez de listar o catálogo inteiro', async () => {
    const { service } = makeService({ products: [bolo, geleia] })
    const r = await service.getStockOutlook(2)

    expect(r.days.every((d) => d.products.length === 0)).toBe(true)
  })

  it('produto SEM vaga aparece mesmo com 0 confirmado — é venda perdida', async () => {
    const { service } = makeService({
      products: [bolo],
      dailyStocks: [{ productId: 'bolo', date: HOJE, reserved: 12 }],
    })
    const r = await service.getStockOutlook(1)

    expect(r.days[0].products[0]).toMatchObject({ confirmed: 0, reserved: 12, available: 0 })
  })

  it('só conta Cestinha confirmada — aguardando pagamento não vira preparo', async () => {
    const { marketFindMany, service } = makeService({ products: [bolo] })
    await service.getStockOutlook(1)

    const where = marketFindMany.mock.calls[0][0].where as { status: { in: string[] } }
    expect(where.status.in).not.toContain('PENDING_PAYMENT')
    expect(where.status.in).not.toContain('CANCELLED')
  })

  it('janela é limitada (1..30 dias)', async () => {
    const { service } = makeService({ products: [] })
    expect((await service.getStockOutlook(0)).days).toHaveLength(1)
    expect((await service.getStockOutlook(99)).days).toHaveLength(30)
  })
})
