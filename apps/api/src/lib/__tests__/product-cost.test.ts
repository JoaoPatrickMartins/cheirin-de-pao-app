// Onda H9 — custo unitário de um produto (D-8: o custo mora na RELAÇÃO fornecedor × produto).
// Para falar de margem é preciso UM número por produto, e a escolha é o custo ESPERADO: média das
// linhas ativas ponderada pela fatia com que cada fornecedor atende aquele produto.
import { describe, it, expect, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { loadUnitCosts, productMargin } from '../product-cost.js'

type Row = {
  productId: string
  supplierId: string
  unitCost: number
  defaultSharePct: number
  isPreferred: boolean
}

function mockPrisma(rows: Row[], activeSupplierIds?: string[]) {
  const ids = activeSupplierIds ?? [...new Set(rows.map((r) => r.supplierId))]
  return {
    supplierProduct: { findMany: vi.fn().mockResolvedValue(rows) },
    supplier: { findMany: vi.fn().mockResolvedValue(ids.map((id) => ({ id }))) },
  } as unknown as PrismaClient
}

const row = (over: Partial<Row> = {}): Row => ({
  productId: 'p1',
  supplierId: 'sup-1',
  unitCost: 10,
  defaultSharePct: 100,
  isPreferred: true,
  ...over,
})

describe('loadUnitCosts', () => {
  it('fornecedor único → o custo dele', async () => {
    const costs = await loadUnitCosts(mockPrisma([row({ unitCost: 8.5 })]), ['p1'])
    expect(costs.get('p1')).toMatchObject({ unitCost: 8.5, basis: 'MATRIX_WEIGHTED', suppliers: 1 })
  })

  it('dois fornecedores 75/25 → média PONDERADA pela fatia, não simples', async () => {
    const costs = await loadUnitCosts(
      mockPrisma([
        row({ supplierId: 'a', unitCost: 10, defaultSharePct: 75, isPreferred: true }),
        row({ supplierId: 'b', unitCost: 20, defaultSharePct: 25, isPreferred: false }),
      ]),
      ['p1'],
    )
    // 10×0,75 + 20×0,25 = 12,50 (a média simples seria 15 — e mentiria sobre o mix de compra).
    expect(costs.get('p1')!.unitCost).toBe(12.5)
    expect(costs.get('p1')!.suppliers).toBe(2)
  })

  it('Σ fatias = 0 → custo de quem levaria tudo no rateio (o preferido)', async () => {
    const costs = await loadUnitCosts(
      mockPrisma([
        row({ supplierId: 'a', unitCost: 30, defaultSharePct: 0, isPreferred: false }),
        row({ supplierId: 'b', unitCost: 7, defaultSharePct: 0, isPreferred: true }),
      ]),
      ['p1'],
    )
    expect(costs.get('p1')).toMatchObject({ unitCost: 7, basis: 'MATRIX_SINGLE' })
  })

  it('fornecedor INATIVO sai da conta sem apagar a linha dele', async () => {
    const costs = await loadUnitCosts(
      mockPrisma(
        [
          row({ supplierId: 'ativo', unitCost: 10, defaultSharePct: 50, isPreferred: true }),
          row({ supplierId: 'inativo', unitCost: 100, defaultSharePct: 50, isPreferred: false }),
        ],
        ['ativo'],
      ),
      ['p1'],
    )
    expect(costs.get('p1')!.unitCost).toBe(10)
    expect(costs.get('p1')!.suppliers).toBe(1)
  })

  it('produto sem linha na matriz NÃO entra no mapa (não é custo zero)', async () => {
    const costs = await loadUnitCosts(mockPrisma([row({ productId: 'outro' })]), ['p1', 'outro'])
    expect(costs.has('p1')).toBe(false)
    expect(costs.has('outro')).toBe(true)
  })

  it('lista vazia não consulta o banco', async () => {
    const prisma = mockPrisma([])
    const costs = await loadUnitCosts(prisma, [])
    expect(costs.size).toBe(0)
    expect(prisma.supplierProduct.findMany).not.toHaveBeenCalled()
  })
})

describe('productMargin', () => {
  it('preço − custo, com o percentual sobre o preço', () => {
    expect(productMargin(20, 12.5)).toEqual({ margin: 7.5, marginPct: 37.5 })
  })

  it('sem custo cadastrado devolve null — a UI diz "sem custo", nunca "100% de margem"', () => {
    expect(productMargin(20, null)).toBeNull()
    expect(productMargin(20, undefined)).toBeNull()
  })

  it('margem negativa é preservada (vender abaixo do custo tem de aparecer)', () => {
    expect(productMargin(8, 10)).toEqual({ margin: -2, marginPct: -25 })
  })

  it('preço 0 não divide por zero', () => {
    expect(productMargin(0, 5)).toEqual({ margin: -5, marginPct: 0 })
  })
})
