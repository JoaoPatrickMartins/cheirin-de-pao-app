// Onda H8 — sugestão de reposição de inventário (D-9). Antes disto não existia NENHUM caminho para
// comprar reposição de produto FIXED: o pedido ao fornecedor é sempre por turno e derivado da
// demanda do dia, o que não faz sentido para inventário.
import { describe, it, expect, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { buildRestockCandidates, RESTOCK_WINDOW_DAYS } from '../restock-demand.js'
import { LOW_STOCK_THRESHOLD } from '../market-stock-alerts.js'

type ProductRow = { id: string; name: string; stock: number | null }

function mockPrisma(products: ProductRow[], soldItems: Array<{ productId: string; qty: number }> = []) {
  const productFindMany = vi.fn().mockResolvedValue(products)
  return {
    prisma: {
      product: { findMany: productFindMany },
      marketOrder: { findMany: vi.fn().mockResolvedValue([{ items: soldItems }]) },
    } as unknown as PrismaClient,
    productFindMany,
  }
}

const NOW = new Date('2026-07-29T12:00:00.000Z')

describe('buildRestockCandidates', () => {
  it('só olha produto FIXED ativo — DAILY se compra pela demanda do turno', async () => {
    const { prisma, productFindMany } = mockPrisma([])
    await buildRestockCandidates(prisma, { now: NOW })

    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true, stockType: 'FIXED' } }),
    )
  })

  it('sugere a diferença até cobrir os dias pedidos, pelo ritmo de venda', async () => {
    // 30 vendidos em 30 dias = 1/dia. Para cobrir 30 dias precisa de 30; tem 4 → sugere 26.
    const { prisma } = mockPrisma(
      [{ id: 'p1', name: 'Geleia', stock: 4 }],
      [{ productId: 'p1', qty: 30 }],
    )
    const [c] = await buildRestockCandidates(prisma, { now: NOW, coverDays: 30 })

    expect(c).toMatchObject({
      productId: 'p1',
      stock: 4,
      sold: 30,
      dailyRate: 1,
      coverDays: 4, // o estoque atual dura 4 dias
      suggestedQty: 26,
      basis: 'CONSUMPTION',
      lowStock: true,
    })
  })

  it('cobertura menor pedida → compra menor', async () => {
    const { prisma } = mockPrisma(
      [{ id: 'p1', name: 'Geleia', stock: 4 }],
      [{ productId: 'p1', qty: 30 }],
    )
    const [c] = await buildRestockCandidates(prisma, { now: NOW, coverDays: 7 })
    expect(c.suggestedQty).toBe(3) // 7 de alvo − 4 em estoque
  })

  it('estoque já cobre o período e está fora da faixa crítica → fica fora da lista', async () => {
    const { prisma } = mockPrisma(
      [{ id: 'p1', name: 'Mel', stock: 100 }],
      [{ productId: 'p1', qty: 30 }],
    )
    expect(await buildRestockCandidates(prisma, { now: NOW, coverDays: 30 })).toEqual([])
  })

  it('esgotado SEM venda na janela ainda entra, com sugestão de piso (FALLBACK)', async () => {
    // O caso perigoso: um produto esgotado há semanas vende zero JUSTAMENTE porque está esgotado.
    // Uma sugestão de 0 seria a pior resposta possível.
    const { prisma } = mockPrisma([{ id: 'p1', name: 'Café', stock: 0 }], [])
    const [c] = await buildRestockCandidates(prisma, { now: NOW })

    expect(c).toMatchObject({ basis: 'FALLBACK', outOfStock: true, lowStock: true, coverDays: null })
    expect(c.suggestedQty).toBe(LOW_STOCK_THRESHOLD + 1)
  })

  it('sem venda e com estoque confortável → não sugere nada', async () => {
    const { prisma } = mockPrisma([{ id: 'p1', name: 'Mel', stock: 50 }], [])
    expect(await buildRestockCandidates(prisma, { now: NOW })).toEqual([])
  })

  it('stock null (legado) conta como 0', async () => {
    const { prisma } = mockPrisma([{ id: 'p1', name: 'Café', stock: null }], [])
    const [c] = await buildRestockCandidates(prisma, { now: NOW })
    expect(c).toMatchObject({ stock: 0, outOfStock: true })
  })

  it('ordena por urgência: esgotado primeiro, depois menor cobertura', async () => {
    const { prisma } = mockPrisma(
      [
        { id: 'folgado', name: 'Folgado', stock: 5 }, // crítico pelo limiar, cobre 5 dias
        { id: 'zerado', name: 'Zerado', stock: 0 },
        { id: 'apertado', name: 'Apertado', stock: 2 },
      ],
      [
        { productId: 'folgado', qty: 30 },
        { productId: 'zerado', qty: 30 },
        { productId: 'apertado', qty: 30 },
      ],
    )
    const out = await buildRestockCandidates(prisma, { now: NOW })
    expect(out.map((c) => c.productId)).toEqual(['zerado', 'apertado', 'folgado'])
  })

  it('a janela de histórico é a dos últimos RESTOCK_WINDOW_DAYS dias', async () => {
    const marketFindMany = vi.fn().mockResolvedValue([])
    const prisma = {
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'p1', name: 'Geleia', stock: 1 }]) },
      marketOrder: { findMany: marketFindMany },
    } as unknown as PrismaClient

    await buildRestockCandidates(prisma, { now: NOW })

    const where = marketFindMany.mock.calls[0][0].where as { createdAt: { gte: Date }; status: { in: string[] } }
    const expected = new Date(NOW.getTime() - RESTOCK_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    expect(where.createdAt.gte.getTime()).toBe(expected.getTime())
    // Cestinha cancelada devolveu o estoque — não consumiu nada e não pode contar como venda.
    expect(where.status.in).not.toContain('CANCELLED')
    expect(where.status.in).not.toContain('PENDING_PAYMENT')
  })
})
