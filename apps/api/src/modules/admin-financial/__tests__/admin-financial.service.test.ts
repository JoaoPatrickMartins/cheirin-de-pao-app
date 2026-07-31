// AdminFinancialService unit tests — Fase 7 / Plano 07-05 (Wave 1 — implementação real)
// Requirements: ADMF-01 (receita por período), ADMF-02 (por condomínio), ADMF-03 (por tipo)
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { AdminFinancialService } from '../admin-financial.service.js'

// ── makeFastifyMock ───────────────────────────────────────────────────────────
function makeFastifyMock(overrides: {
  aggregateTotal?: number
  aggregateCombos?: number
  aggregateAvulso?: number
  runCommandRaw?: unknown
  /** Cestinha (Onda D1) — receita nova (Payment purpose=MARKET) e o pedido agregado. */
  marketRevenue?: number
  marketOrderAgg?: { _sum: { totalValue: number; moneyAmount: number; creditsApplied: number }; _count: number }
  marketByCondo?: Array<{ condominiumId: string | null; _sum: { totalValue: number | null } }>
  /** Linhas vendidas — insumo do CMV (H9). */
  soldOrders?: Array<{ breadQty: number; items: Array<{ productId: string; qty: number }> }>
  /** Matriz de fornecimento ativa (custo esperado por produto). */
  supplierProducts?: Array<{
    productId: string
    supplierId: string
    unitCost: number
    defaultSharePct: number
    isPreferred: boolean
  }>
  activeSuppliers?: Array<{ id: string }>
  /** Pedidos ao fornecedor finalizados no período + seus itens (H9 — dinheiro que saiu). */
  purchaseOrders?: Array<{ id: string }>
  purchaseItems?: Array<{ productId: string | null; quantity: number; unitPrice: number }>
  breadProductId?: string | null
} = {}) {
  const {
    aggregateTotal = 1500.0,
    aggregateCombos = 1000.0,
    aggregateAvulso = 500.0,
    runCommandRaw = { cursor: { firstBatch: [{ _id: 'condo-01', total: 1500 }] } },
    marketRevenue = 0,
    marketOrderAgg = { _sum: { totalValue: 0, moneyAmount: 0, creditsApplied: 0 }, _count: 0 },
    marketByCondo = [],
    soldOrders = [],
    supplierProducts = [],
    activeSuppliers = [{ id: 'sup-1' }],
    purchaseOrders = [],
    purchaseItems = [],
    breadProductId = 'bread-1',
  } = overrides

  const prisma = {
    payment: {
      // Despacha pelo `where` em vez de por ORDEM das chamadas: a Onda D1 acrescentou a agregação
      // da receita da Cestinha, e uma cadeia de `mockResolvedValueOnce` faria o 4º `aggregate`
      // devolver undefined — quebrando por posição, não por comportamento.
      aggregate: vi.fn().mockImplementation((args?: { where?: Record<string, unknown> }) => {
        const where = args?.where ?? {}
        if (where.purpose === 'MARKET') return Promise.resolve({ _sum: { amount: marketRevenue } })
        if (where.comboId) return Promise.resolve({ _sum: { amount: aggregateCombos } })
        if (where.customQuantity) return Promise.resolve({ _sum: { amount: aggregateAvulso } })
        return Promise.resolve({ _sum: { amount: aggregateTotal } })
      }),
    },
    marketOrder: {
      aggregate: vi.fn().mockResolvedValue(marketOrderAgg),
      groupBy: vi.fn().mockResolvedValue(marketByCondo),
      findMany: vi.fn().mockResolvedValue(soldOrders),
    },
    setting: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) =>
        Promise.resolve(where.key === 'breadProductId' && breadProductId ? { value: breadProductId } : null),
      ),
    },
    supplierProduct: { findMany: vi.fn().mockResolvedValue(supplierProducts) },
    supplier: { findMany: vi.fn().mockResolvedValue(activeSuppliers) },
    purchaseOrder: { findMany: vi.fn().mockResolvedValue(purchaseOrders) },
    purchaseOrderItem: { findMany: vi.fn().mockResolvedValue(purchaseItems) },
    condominium: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'condo-01', name: 'Residencial das Flores' },
      ]),
    },
    $runCommandRaw: vi.fn().mockResolvedValue(runCommandRaw),
  }

  return {
    fastify: {
      prisma,
      log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
    } as unknown,
    prisma,
  }
}

// ── Testes ────────────────────────────────────────────────────────────────────
describe('AdminFinancialService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getRevenue', () => {
    it('getRevenue retorna soma de Payment.amount WHERE status=PAID para period=day', async () => {
      const { fastify, prisma } = makeFastifyMock()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminFinancialService(fastify as any)
      const result = await service.getRevenue('day')

      expect(result).toBeDefined()
      expect(result.total).toBe(1500.0)
      // aggregate deve ter sido chamado com status=PAID
      expect(prisma.payment.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          _sum: { amount: true },
          where: expect.objectContaining({ status: 'PAID' }),
        }),
      )
    })

    it('getRevenue retorna byType com combos e avulso separados', async () => {
      const { fastify } = makeFastifyMock()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminFinancialService(fastify as any)
      const result = await service.getRevenue('week')

      expect(result.byType).toBeDefined()
      expect(result.byType.combos).toBe(1000.0)
      expect(result.byType.avulso).toBe(500.0)
    })

    it('getRevenue retorna byCondominium com dados do $runCommandRaw', async () => {
      const { fastify } = makeFastifyMock()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminFinancialService(fastify as any)
      const result = await service.getRevenue('month')

      expect(result.byCondominium).toBeDefined()
      expect(Array.isArray(result.byCondominium)).toBe(true)
      expect(result.byCondominium.length).toBeGreaterThanOrEqual(1)
      expect(result.byCondominium[0]).toHaveProperty('condominiumId')
      expect(result.byCondominium[0]).toHaveProperty('total')
    })

    it('getRevenue aceita condominiumId opcional para filtrar', async () => {
      const { fastify, prisma } = makeFastifyMock()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminFinancialService(fastify as any)
      await service.getRevenue('day', 'condo-01')

      // $runCommandRaw deve ter sido chamado
      expect(prisma.$runCommandRaw).toHaveBeenCalled()
    })

    it('getRevenue retorna total=0 quando nao ha pagamentos PAID', async () => {
      const { fastify } = makeFastifyMock({
        aggregateTotal: 0,
        aggregateCombos: 0,
        aggregateAvulso: 0,
        runCommandRaw: { cursor: { firstBatch: [] } },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AdminFinancialService(fastify as any)
      const result = await service.getRevenue('day')

      expect(result.total).toBe(0)
      expect(result.byCondominium).toEqual([])
    })
  })

  // ── Onda D1 — a Cestinha no financeiro (D-2) ────────────────────────────────
  // Antes disto TODOS os números aplicavam excludeNonCreditPurpose: o mercadinho não existia no
  // financeiro. O ponto da onda é que receita e GMV são grandezas DIFERENTES.
  describe('getRevenue — Cestinha (D-2)', () => {
    // Cestinha de R$ 30, sendo R$ 6 em dinheiro e R$ 24 em pãezinhos (4 créditos).
    const comCestinha = {
      marketRevenue: 6,
      marketOrderAgg: { _sum: { totalValue: 30, moneyAmount: 6, creditsApplied: 4 }, _count: 1 },
    }

    it('separa receita NOVA de valor movimentado e decompõe o GMV', async () => {
      const { fastify } = makeFastifyMock(comCestinha)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminFinancialService(fastify as any).getRevenue('day')

      expect(r.market).toMatchObject({
        revenue: 6,
        gmv: 30,
        moneyPart: 6,
        creditPart: 24, // GMV - dinheiro = o que foi pago em pãezinhos
        credits: 4,
        orders: 1,
      })
    })

    it('totalConsolidated soma as duas RECEITAS e nunca o GMV', async () => {
      const { fastify } = makeFastifyMock(comCestinha)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminFinancialService(fastify as any).getRevenue('day')

      expect(r.totalConsolidated).toBe(1506) // 1500 de crédito + 6 de dinheiro novo
      // O GMV (30) não entra: a parte em pãezinhos já foi faturada na compra do combo.
      expect(r.totalConsolidated).not.toBe(1530)
    })

    it('Cestinha 100% crédito: GMV sobe, receita NÃO — e isso é o correto (D-2)', async () => {
      const { fastify } = makeFastifyMock({
        marketRevenue: 0, // nenhum Payment: o cliente pagou só com pãezinhos
        marketOrderAgg: { _sum: { totalValue: 24, moneyAmount: 0, creditsApplied: 4 }, _count: 1 },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminFinancialService(fastify as any).getRevenue('day')

      expect(r.market.gmv).toBe(24)
      expect(r.market.revenue).toBe(0)
      expect(r.market.creditPart).toBe(24)
      expect(r.totalConsolidated).toBe(1500) // = só a receita de crédito, inalterada
    })

    it('não mexe nos números de crédito que já existiam', async () => {
      const { fastify } = makeFastifyMock(comCestinha)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminFinancialService(fastify as any).getRevenue('day')

      expect(r.total).toBe(1500)
      expect(r.byType).toEqual({ combos: 1000, avulso: 500 })
    })

    it('condomínio que SÓ comprou Cestinha aparece na quebra por condomínio', async () => {
      const { fastify } = makeFastifyMock({
        ...comCestinha,
        // O pipeline de Payment só conhece o condo-01 (receita de crédito).
        runCommandRaw: { cursor: { firstBatch: [{ _id: 'condo-01', total: 1500 }] } },
        marketByCondo: [
          { condominiumId: 'condo-01', _sum: { totalValue: 10 } },
          { condominiumId: 'condo-02', _sum: { totalValue: 20 } }, // sem receita de crédito
        ],
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminFinancialService(fastify as any).getRevenue('month')

      const byId = new Map(r.byCondominium.map((c) => [c.condominiumId, c]))
      expect(byId.get('condo-01')).toMatchObject({ total: 1500, cestinhaGmv: 10 })
      // Sem a união das duas fontes, este condomínio simplesmente não existiria no relatório.
      expect(byId.get('condo-02')).toMatchObject({ total: 0, cestinhaGmv: 20 })
    })

    it('sem Cestinha no período → zeros, e o consolidado é a receita de crédito', async () => {
      const { fastify } = makeFastifyMock()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminFinancialService(fastify as any).getRevenue('day')

      expect(r.market).toMatchObject({ revenue: 0, gmv: 0, orders: 0 })
      expect(r.totalConsolidated).toBe(1500)
    })
  })

  // ── Onda H9 — CMV e margem ──────────────────────────────────────────────────
  describe('getRevenue — CMV e margem da Cestinha (H9)', () => {
    /** Matriz: bolo custa 5 (fornecedor único), pão custa 0,50. */
    const matriz = {
      supplierProducts: [
        { productId: 'bolo', supplierId: 'sup-1', unitCost: 5, defaultSharePct: 100, isPreferred: true },
        { productId: 'bread-1', supplierId: 'sup-1', unitCost: 0.5, defaultSharePct: 100, isPreferred: true },
      ],
      activeSuppliers: [{ id: 'sup-1' }],
    }

    it('CMV soma itens E o pão da Cestinha (D-1: o pão dela tem custo)', async () => {
      const { fastify } = makeFastifyMock({
        ...matriz,
        marketOrderAgg: { _sum: { totalValue: 40, moneyAmount: 40, creditsApplied: 0 }, _count: 1 },
        soldOrders: [{ breadQty: 10, items: [{ productId: 'bolo', qty: 2 }] }],
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminFinancialService(fastify as any).getRevenue('day')

      // 2 bolos × 5 + 10 pães × 0,50 = 15
      expect(r.market.cmv).toBe(15)
      expect(r.market.margin).toBe(25) // 40 de GMV − 15
      expect(r.market.marginPct).toBe(62.5)
      expect(r.market.unitsWithoutCost).toBe(0)
    })

    it('produto SEM custo cadastrado não vira custo zero — conta como margem parcial', async () => {
      const { fastify } = makeFastifyMock({
        ...matriz,
        marketOrderAgg: { _sum: { totalValue: 40, moneyAmount: 40, creditsApplied: 0 }, _count: 1 },
        soldOrders: [{ breadQty: 0, items: [{ productId: 'bolo', qty: 1 }, { productId: 'geleia-sem-fornecedor', qty: 3 }] }],
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminFinancialService(fastify as any).getRevenue('day')

      expect(r.market.cmv).toBe(5) // só o bolo
      // As 3 geleias ficam sinalizadas: a margem de 35 é PARCIAL, e a tela precisa dizer isso.
      expect(r.market.unitsWithoutCost).toBe(3)
      expect(r.market.margin).toBe(35)
    })

    it('sem venda no período → CMV e margem zerados, sem divisão por zero', async () => {
      const { fastify } = makeFastifyMock(matriz)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminFinancialService(fastify as any).getRevenue('day')

      expect(r.market).toMatchObject({ cmv: 0, margin: 0, marginPct: 0, unitsWithoutCost: 0 })
    })
  })

  describe('getRevenue — compras do período (H9)', () => {
    it('separa o gasto com pão do gasto com produtos, pelo custo PAGO', async () => {
      const { fastify } = makeFastifyMock({
        purchaseOrders: [{ id: 'po-1' }, { id: 'po-2' }],
        purchaseItems: [
          { productId: 'bread-1', quantity: 100, unitPrice: 0.45 }, // 45,00 de pão
          { productId: 'bolo', quantity: 10, unitPrice: 4.8 }, // 48,00 de produto
          { productId: null, quantity: 20, unitPrice: 0.5 }, // item legado = pão → 10,00
        ],
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminFinancialService(fastify as any).getRevenue('month')

      expect(r.purchases).toEqual({ total: 103, breadCost: 55, itemsCost: 48, orders: 2 })
    })

    it('sem compra finalizada no período → zeros (e não busca itens)', async () => {
      const { fastify, prisma } = makeFastifyMock({ purchaseOrders: [] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await new AdminFinancialService(fastify as any).getRevenue('month')

      expect(r.purchases).toEqual({ total: 0, breadCost: 0, itemsCost: 0, orders: 0 })
      expect(prisma.purchaseOrderItem.findMany).not.toHaveBeenCalled()
    })
  })
})
