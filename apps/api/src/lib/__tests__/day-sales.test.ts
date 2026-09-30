// day-sales.test.ts — relatório de itens vendidos de um dia de entrega (geral, não por condomínio).
//
// Trava as decisões que definem o relatório:
//   - VENDIDO = `Order` não cancelado + Cestinha confirmada. Previsto da agenda e Cestinha
//     `PENDING_PAYMENT` ficam fora (ninguém pagou / o dinheiro não entrou).
//   - D-1 — pão e item são contadores diferentes: `breadQty` soma nos pães, `items[]` nos itens.
//   - O total de pães RECONCILIA com o que a tela do dia mostra (mesmas fontes).
//   - Pedido sem turno aparece num balde "Sem turno" em vez de sumir.
import { describe, it, expect, vi } from 'vitest'
import { buildDaySales, BREAD_LINE_FALLBACK_ID } from '../day-sales.js'

const DATE = '2026-07-29'
const NOW = new Date('2026-07-29T17:32:00.000Z')

/** Mock mínimo do Prisma: as duas fontes + os Settings que a lib lê. */
function makePrisma(
  opts: {
    orders?: Record<string, unknown>[]
    marketOrders?: Record<string, unknown>[]
    avulsoUnit?: string | null
    breadProductId?: string | null
    breadProductName?: string
  } = {},
) {
  const {
    orders = [],
    marketOrders = [],
    avulsoUnit = '1.20',
    breadProductId = null,
    breadProductName = 'Pão Francês da Casa',
  } = opts
  return {
    order: { findMany: vi.fn().mockResolvedValue(orders) },
    marketOrder: { findMany: vi.fn().mockResolvedValue(marketOrders) },
    setting: {
      findUnique: vi.fn(({ where }: { where: { key: string } }) => {
        if (where.key === 'avulsoUnit') {
          return Promise.resolve(avulsoUnit == null ? null : { key: 'avulsoUnit', value: avulsoUnit })
        }
        if (where.key === 'breadProductId') {
          return Promise.resolve(
            breadProductId == null ? null : { key: 'breadProductId', value: breadProductId },
          )
        }
        // deliverySlots ausente → getGlobalDeliverySlots devolve manha/tarde default
        return Promise.resolve(null)
      }),
    },
    product: { findUnique: vi.fn().mockResolvedValue({ name: breadProductName }) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

const order = (o: Partial<Record<string, unknown>> = {}) => ({
  userId: 'u1',
  quantity: 4,
  type: 'SINGLE',
  slotId: 'manha',
  condominiumId: 'c1',
  ...o,
})

const cestinha = (o: Partial<Record<string, unknown>> = {}) => ({
  userId: 'u1',
  condominiumId: 'c1',
  slotId: 'manha',
  breadQty: 0,
  moneyAmount: 0,
  creditsAppliedMilli: 0,
  items: [],
  ...o,
})

describe('buildDaySales', () => {
  it('dia vazio: zeros coerentes, sem linhas e sem quebrar', async () => {
    const report = await buildDaySales(makePrisma(), DATE, NOW)

    expect(report.date).toBe(DATE)
    expect(report.generatedAt).toBe(NOW.toISOString())
    expect(report.breads.total).toBe(0)
    expect(report.items.total).toBe(0)
    expect(report.totalRevenue).toBe(0)
    expect(report.lines).toEqual([])
    expect(report.slots).toEqual([])
    expect(report.counts).toEqual({
      stops: 0,
      clients: 0,
      condominiums: 0,
      breadOrders: 0,
      marketOrders: 0,
    })
  })

  it('D-1: pão do pedido e pão da Cestinha somam na MESMA linha; os produtos ficam em paralelo', async () => {
    const prisma = makePrisma({
      orders: [
        order({ userId: 'u1', quantity: 4, type: 'SINGLE' }),
        order({ userId: 'u2', quantity: 6, type: 'SCHEDULED' }),
      ],
      marketOrders: [
        cestinha({
          userId: 'u3',
          breadQty: 2,
          items: [{ productId: 'p1', name: 'Bolo de Fubá', qty: 3, unitPrice: 9 }],
        }),
      ],
    })
    const report = await buildDaySales(prisma, DATE, NOW)

    expect(report.breads).toMatchObject({
      total: 12, // 4 + 6 + 2
      single: 4,
      scheduled: 6,
      fromMarket: 2,
      fromItems: 0,
      unitPrice: 1.2,
      revenue: 14.4, // 12 × 1,20
    })
    // O bolo NÃO virou pão.
    expect(report.items).toEqual({ total: 3, revenue: 27 })
    expect(report.totalRevenue).toBe(41.4)

    const [breadLine, cakeLine] = report.lines
    expect(breadLine).toMatchObject({ isBread: true, qty: 12, revenue: 14.4, avgUnitPrice: 1.2 })
    expect(cakeLine).toMatchObject({ name: 'Bolo de Fubá', qty: 3, revenue: 27, avgUnitPrice: 9 })
  })

  it('invariantes: total de pães = as partes, e a receita total = linha do pão + itens', async () => {
    const prisma = makePrisma({
      orders: [order({ quantity: 5 }), order({ userId: 'u2', quantity: 7, type: 'SCHEDULED' })],
      marketOrders: [
        cestinha({
          userId: 'u3',
          breadQty: 3,
          items: [
            { productId: 'p1', name: 'Geleia', qty: 2, unitPrice: 11.9 },
            { productId: 'p2', name: 'Café', qty: 1, unitPrice: 15.9 },
          ],
        }),
      ],
    })
    const report = await buildDaySales(prisma, DATE, NOW)
    const { breads, items, lines, totalRevenue } = report

    expect(breads.total).toBe(breads.single + breads.scheduled + breads.fromMarket + breads.fromItems)
    const breadLine = lines.find((l) => l.isBread)!
    expect(breadLine.qty).toBe(breads.total)
    expect(lines.filter((l) => !l.isBread).reduce((s, l) => s + l.qty, 0)).toBe(items.total)
    expect(totalRevenue).toBe(breads.revenue + items.revenue)
  })

  it('o mesmo produto vendido a preços diferentes (promoção) vira uma linha com média ponderada', async () => {
    const prisma = makePrisma({
      marketOrders: [
        cestinha({ items: [{ productId: 'p1', name: 'Bolo', qty: 2, unitPrice: 10 }] }),
        // Segundo cliente pegou o bolo em promoção.
        cestinha({ userId: 'u2', items: [{ productId: 'p1', name: 'Bolo', qty: 2, unitPrice: 8 }] }),
      ],
    })
    const report = await buildDaySales(prisma, DATE, NOW)

    expect(report.lines).toHaveLength(1)
    expect(report.lines[0]).toMatchObject({ qty: 4, revenue: 36, avgUnitPrice: 9 })
  })

  it('exclui o que não foi vendido: CANCELLED e PENDING_PAYMENT nem chegam na agregação', async () => {
    const prisma = makePrisma()
    await buildDaySales(prisma, DATE, NOW)

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: { not: 'CANCELLED' } }) }),
    )
    const marketWhere = prisma.marketOrder.findMany.mock.calls[0][0].where
    expect(marketWhere.status.in).not.toContain('PENDING_PAYMENT')
    expect(marketWhere.status.in).toContain('DELIVERED')
    // Vendido ≠ entregue: uma Cestinha que voltou continua vendida.
    expect(marketWhere.status.in).toContain('NOT_DELIVERED')
  })

  it('quebra por turno: cada linha diz quanto saiu em cada turno, na ordem da config', async () => {
    const prisma = makePrisma({
      orders: [order({ slotId: 'tarde', quantity: 5 }), order({ slotId: 'manha', quantity: 8 })],
      marketOrders: [
        cestinha({ slotId: 'manha', items: [{ productId: 'p1', name: 'Bolo', qty: 6, unitPrice: 9 }] }),
        cestinha({ slotId: 'tarde', userId: 'u2', items: [{ productId: 'p1', name: 'Bolo', qty: 2, unitPrice: 9 }] }),
      ],
    })
    const report = await buildDaySales(prisma, DATE, NOW)

    expect(report.slots).toEqual([
      { slotId: 'manha', label: 'Manhã', breads: 8, items: 6, revenue: 63.6 }, // 54 + 8×1,20
      { slotId: 'tarde', label: 'Tarde', breads: 5, items: 2, revenue: 24 }, // 18 + 5×1,20
    ])
    const cake = report.lines.find((l) => l.name === 'Bolo')!
    expect(cake.bySlot).toEqual([
      { slotId: 'manha', label: 'Manhã', qty: 6 },
      { slotId: 'tarde', label: 'Tarde', qty: 2 },
    ])
  })

  it('pedido sem turno cai no balde "Sem turno" em vez de sumir do relatório', async () => {
    const prisma = makePrisma({
      orders: [order({ slotId: null, quantity: 3 })],
    })
    const report = await buildDaySales(prisma, DATE, NOW)

    expect(report.breads.total).toBe(3)
    expect(report.slots).toEqual([{ slotId: '', label: 'Sem turno', breads: 3, items: 0, revenue: 3.6 }])
  })

  it('D-5: pão + Cestinha do mesmo cliente/turno contam UMA parada', async () => {
    const prisma = makePrisma({
      orders: [order({ userId: 'u1', slotId: 'manha' })],
      marketOrders: [
        cestinha({ userId: 'u1', slotId: 'manha', items: [{ productId: 'p1', name: 'Bolo', qty: 1, unitPrice: 9 }] }),
        // Mesmo cliente, outro turno = outra visita.
        cestinha({ userId: 'u1', slotId: 'tarde', items: [{ productId: 'p1', name: 'Bolo', qty: 1, unitPrice: 9 }] }),
      ],
    })
    const report = await buildDaySales(prisma, DATE, NOW)

    expect(report.counts.stops).toBe(2)
    expect(report.counts.clients).toBe(1)
    expect(report.counts.condominiums).toBe(1)
  })

  it('caixa: separa o que entrou no gateway do que foi pago em pãezinhos', async () => {
    const prisma = makePrisma({
      marketOrders: [
        cestinha({ moneyAmount: 12.5, creditsAppliedMilli: 3500, items: [{ productId: 'p1', name: 'Bolo', qty: 1, unitPrice: 9 }] }),
        cestinha({ userId: 'u2', moneyAmount: 7.5, creditsAppliedMilli: null, items: [] }),
      ],
    })
    const report = await buildDaySales(prisma, DATE, NOW)

    expect(report.cash).toEqual({ money: 20, creditsMilli: 3500 })
  })

  it('sem avulsoUnit configurado, o pão conta em unidades e vale 0 — sem NaN na receita', async () => {
    const prisma = makePrisma({
      avulsoUnit: null,
      orders: [order({ quantity: 10 })],
      marketOrders: [cestinha({ userId: 'u2', items: [{ productId: 'p1', name: 'Bolo', qty: 1, unitPrice: 9 }] })],
    })
    const report = await buildDaySales(prisma, DATE, NOW)

    expect(report.breads.total).toBe(10)
    expect(report.breads.revenue).toBe(0)
    expect(report.totalRevenue).toBe(9)
    expect(Number.isNaN(report.totalRevenue)).toBe(false)
  })

  it('usa o nome real do produto-pão quando breadProductId está configurado', async () => {
    const prisma = makePrisma({
      breadProductId: 'bread-1',
      breadProductName: 'Pão Francês da Casa',
      orders: [order({ quantity: 2 })],
    })
    const report = await buildDaySales(prisma, DATE, NOW)

    expect(report.lines[0]).toMatchObject({ productId: 'bread-1', name: 'Pão Francês da Casa' })
  })

  it('sem breadProductId, a linha do pão usa o id sintético e o nome de fallback', async () => {
    const report = await buildDaySales(makePrisma({ orders: [order({ quantity: 2 })] }), DATE, NOW)

    expect(report.lines[0]).toMatchObject({ productId: BREAD_LINE_FALLBACK_ID, name: 'Pão Francês' })
  })

  it('pão que chega como ITEM de Cestinha vira pão (não duplica linha nem receita)', async () => {
    const prisma = makePrisma({
      breadProductId: 'bread-1',
      orders: [order({ quantity: 4 })],
      marketOrders: [
        cestinha({
          userId: 'u2',
          breadQty: 1,
          items: [{ productId: 'bread-1', name: 'Pão Francês', qty: 5, unitPrice: 1.2 }],
        }),
      ],
    })
    const report = await buildDaySales(prisma, DATE, NOW)

    expect(report.lines).toHaveLength(1) // uma linha só de pão
    expect(report.breads).toMatchObject({ total: 10, fromMarket: 1, fromItems: 5 })
    expect(report.items.total).toBe(0) // não é item
    expect(report.totalRevenue).toBe(12) // 10 × 1,20 — contado uma vez só
  })

  it('ordena: pão primeiro, depois os produtos por receita decrescente', async () => {
    const prisma = makePrisma({
      orders: [order({ quantity: 1 })],
      marketOrders: [
        cestinha({
          items: [
            { productId: 'p1', name: 'Barato', qty: 1, unitPrice: 5 },
            { productId: 'p2', name: 'Caro', qty: 2, unitPrice: 30 },
            { productId: 'p3', name: 'Médio', qty: 3, unitPrice: 8 },
          ],
        }),
      ],
    })
    const report = await buildDaySales(prisma, DATE, NOW)

    expect(report.lines.map((l) => l.name)).toEqual(['Pão Francês', 'Caro', 'Médio', 'Barato'])
  })
})
