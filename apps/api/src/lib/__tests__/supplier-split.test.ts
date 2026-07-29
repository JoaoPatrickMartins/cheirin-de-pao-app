// supplier-split.test.ts — motor de rateio (Onda H4).
//
// O invariante que mais importa: **a soma das linhas é SEMPRE igual à demanda**. Se o
// arredondamento vazar, a padaria compra menos pão do que vendeu.
import { describe, it, expect } from 'vitest'
import { splitDemandBySupplier, type SourcingOption, type ProductDemandLine } from '../supplier-split.js'

function opt(over: Partial<SourcingOption> & { supplierId: string }): SourcingOption {
  return {
    supplierName: `Forn ${over.supplierId}`,
    unitCost: 0.5,
    defaultSharePct: 0,
    isPreferred: false,
    ...over,
  }
}

const PAO: ProductDemandLine = { productId: 'p-pao', productName: 'Pão Francês', qty: 100 }

describe('splitDemandBySupplier', () => {
  it('fornecedor único leva tudo, mesmo sem fatia definida', () => {
    const r = splitDemandBySupplier([PAO], new Map([['p-pao', [opt({ supplierId: 's1' })]]]))
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0].quantity).toBe(100)
    expect(r.totalQuantity).toBe(100)
  })

  it('preserva o split 75/25 histórico do pão', () => {
    const r = splitDemandBySupplier(
      [PAO],
      new Map([
        ['p-pao', [opt({ supplierId: 's1', defaultSharePct: 75, isPreferred: true }), opt({ supplierId: 's2', defaultSharePct: 25 })]],
      ]),
    )
    const by = new Map(r.lines.map((l) => [l.supplierId, l.quantity]))
    expect(by.get('s1')).toBe(75)
    expect(by.get('s2')).toBe(25)
    expect(r.totalQuantity).toBe(100)
  })

  it('cenário do plano: bolo 50/50 com demanda 7 → 4/3, resto para o preferido', () => {
    const r = splitDemandBySupplier(
      [{ productId: 'p-bolo', productName: 'Bolo de Fubá', qty: 7 }],
      new Map([
        [
          'p-bolo',
          [
            opt({ supplierId: 'sA', defaultSharePct: 50, isPreferred: true }),
            opt({ supplierId: 'sB', defaultSharePct: 50 }),
          ],
        ],
      ]),
    )
    const by = new Map(r.lines.map((l) => [l.supplierId, l.quantity]))
    expect(by.get('sA')).toBe(4) // preferido absorve a sobra
    expect(by.get('sB')).toBe(3)
    expect(r.totalQuantity).toBe(7)
  })

  it('a soma NUNCA vaza — vale para qualquer demanda com fatias que não dividem redondo', () => {
    const options = [
      opt({ supplierId: 'sA', defaultSharePct: 33, isPreferred: true }),
      opt({ supplierId: 'sB', defaultSharePct: 33 }),
      opt({ supplierId: 'sC', defaultSharePct: 34 }),
    ]
    for (const qty of [1, 2, 3, 7, 11, 13, 17, 99, 101, 1000]) {
      const r = splitDemandBySupplier(
        [{ productId: 'p', productName: 'X', qty }],
        new Map([['p', options]]),
      )
      expect(r.totalQuantity).toBe(qty)
    }
  })

  it('sem fatia em ninguém (Σ = 0) → 100% no preferido', () => {
    const r = splitDemandBySupplier(
      [PAO],
      new Map([['p-pao', [opt({ supplierId: 's1' }), opt({ supplierId: 's2', isPreferred: true })]]]),
    )
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0].supplierId).toBe('s2')
    expect(r.lines[0].quantity).toBe(100)
  })

  it('sem fatia e sem preferido → a maior fatia; empate em 0 → o primeiro elegível', () => {
    const r = splitDemandBySupplier(
      [PAO],
      new Map([['p-pao', [opt({ supplierId: 's1' }), opt({ supplierId: 's2' })]]]),
    )
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0].supplierId).toBe('s1')
  })

  it('produto com demanda e SEM fornecedor sai em `unsourced` — nunca omitido em silêncio', () => {
    const r = splitDemandBySupplier(
      [PAO, { productId: 'p-bolo', productName: 'Bolo de Fubá', qty: 12 }],
      new Map([['p-pao', [opt({ supplierId: 's1' })]]]),
    )
    expect(r.lines).toHaveLength(1) // só o pão foi rateado
    expect(r.unsourced).toEqual([{ productId: 'p-bolo', productName: 'Bolo de Fubá', qty: 12 }])
  })

  it('ignora demanda zero/negativa sem gerar linha nem unsourced', () => {
    const r = splitDemandBySupplier(
      [
        { productId: 'p-a', productName: 'A', qty: 0 },
        { productId: 'p-b', productName: 'B', qty: -3 },
      ],
      new Map(),
    )
    expect(r.lines).toHaveLength(0)
    expect(r.unsourced).toHaveLength(0)
  })

  it('não gera linha de quantidade 0 quando a fatia é pequena demais', () => {
    // 1 unidade entre 50/50: o preferido leva 1, o outro leva 0 → só UMA linha.
    const r = splitDemandBySupplier(
      [{ productId: 'p', productName: 'X', qty: 1 }],
      new Map([
        ['p', [opt({ supplierId: 'sA', defaultSharePct: 50, isPreferred: true }), opt({ supplierId: 'sB', defaultSharePct: 50 })]],
      ]),
    )
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0].supplierId).toBe('sA')
    expect(r.lines[0].quantity).toBe(1)
  })

  it('calcula o custo total com o unitCost de CADA fornecedor', () => {
    const r = splitDemandBySupplier(
      [PAO],
      new Map([
        [
          'p-pao',
          [
            opt({ supplierId: 's1', defaultSharePct: 60, isPreferred: true, unitCost: 0.5 }),
            opt({ supplierId: 's2', defaultSharePct: 40, unitCost: 0.6 }),
          ],
        ],
      ]),
    )
    // 60 × 0,50 + 40 × 0,60 = 30 + 24
    expect(r.totalValue).toBe(54)
  })

  it('sinaliza belowMinimum sem bloquear a linha', () => {
    const r = splitDemandBySupplier(
      [{ productId: 'p', productName: 'X', qty: 5 }],
      new Map([['p', [opt({ supplierId: 's1', minOrderQty: 20 })]]]),
    )
    expect(r.lines[0].quantity).toBe(5)
    expect(r.lines[0].belowMinimum).toBe(true)
  })
})
