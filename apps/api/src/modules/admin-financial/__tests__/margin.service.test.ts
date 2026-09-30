// margin.service.test.ts — margem por produto/condomínio e ponto de equilíbrio (F8/F9/B3 · Fase 7).
//
// As decisões travadas aqui são as que separam um relatório de margem útil de um enganoso:
//   - produto SEM custo cadastrado sai com `null` e entra em `unitsWithoutCost` — jamais como
//     margem de 100%, que é a mentira mais confortável possível;
//   - o rateio por condomínio (B3) usa pães entregues como driver, e despesa que JÁ tem centro de
//     custo fica FORA dele, senão o condomínio pagaria duas vezes;
//   - fixo × variável sai de `isFixed`, e categoria apagada cai em VARIÁVEL (inflar o fixo daria
//     uma meta inalcançável, que é o erro mais caro dos dois);
//   - o ranking é por margem em R$, não por receita: a pergunta é "onde a margem está".
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { MarginService } from '../margin.service.js'
import { AdminFinancialService } from '../admin-financial.service.js'
import { AdminReportsService } from '../../admin-reports/admin-reports.service.js'
import { rangeWindow } from '../../../lib/date-range.js'

const WIN = () => rangeWindow('2026-08-01', '2026-08-31', new Date('2026-09-05T12:00:00Z'))

const at = (d: string) => new Date(`${d}T15:00:00.000Z`)

function makePrisma(
  opts: {
    marketOrders?: Record<string, unknown>[]
    orders?: Record<string, unknown>[]
    supplierProducts?: Array<{ productId: string; supplierId: string; unitCost: number; defaultSharePct: number; isPreferred: boolean }>
    expenses?: Array<{ categoryId: string; amount: number; condominiumId: string | null }>
    categories?: Array<{ id: string; isFixed: boolean }>
  } = {},
) {
  const { marketOrders = [], orders = [], supplierProducts = [], expenses = [], categories = [] } = opts
  return {
    order: { findMany: vi.fn().mockResolvedValue(orders) },
    marketOrder: { findMany: vi.fn().mockResolvedValue(marketOrders) },
    product: { findUnique: vi.fn().mockResolvedValue(null) },
    setting: {
      findUnique: vi.fn(({ where }: { where: { key: string } }) =>
        Promise.resolve(where.key === 'avulsoUnit' ? { key: 'avulsoUnit', value: '2.00' } : null),
      ),
    },
    supplierProduct: { findMany: vi.fn().mockResolvedValue(supplierProducts) },
    supplier: {
      findMany: vi.fn().mockResolvedValue([...new Set(supplierProducts.map((s) => s.supplierId))].map((id) => ({ id }))),
    },
    expense: { findMany: vi.fn().mockResolvedValue(expenses) },
    expenseCategory: { findMany: vi.fn().mockResolvedValue(categories) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeService = (prisma: unknown) => new MarginService({ prisma } as any)

const revenueStub = (o: Partial<Record<string, unknown>> = {}) =>
  ({
    total: 1000,
    byType: { combos: 800, avulso: 200 },
    market: { revenue: 0, gmv: 0, orders: 0, cmv: 0, margin: 0, marginPct: 0, unitsWithoutCost: 0, moneyPart: 0, creditPart: 0, credits: 0 },
    hook: { revenue: 0, orders: 0 },
    totalConsolidated: 1000,
    purchases: { total: 400, breadCost: 400, itemsCost: 0, orders: 1 },
    byCondominium: [],
    window: { from: '', to: '', label: '', isPartial: false },
    ...o,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any

const condoStub = (
  items: Array<{ condominiumId: string; condominiumName: string; revenue: number; activeClients: number; breadsDelivered: number }> = [],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => ({ items, window: { from: '', to: '', label: '', isPartial: false } }) as any

const cestinha = (items: Array<{ productId: string; name: string; qty: number; unitPrice: number }>) => ({
  userId: 'u1',
  condominiumId: 'c1',
  slotId: 'manha',
  breadQty: 0,
  moneyAmount: 0,
  creditsAppliedMilli: 0,
  scheduledDate: at('2026-08-10'),
  items,
})

const sp = (productId: string, unitCost: number) => ({
  productId,
  supplierId: 's1',
  unitCost,
  defaultSharePct: 100,
  isPreferred: true,
})

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(AdminFinancialService.prototype, 'getRevenue').mockResolvedValue(revenueStub())
  vi.spyOn(AdminReportsService.prototype, 'getCondominiumRanking').mockResolvedValue(condoStub())
})

describe('MarginService — margem por produto (F8)', () => {
  it('calcula custo, margem e margem por unidade de cada produto', async () => {
    const r = await makeService(
      makePrisma({
        marketOrders: [cestinha([{ productId: 'p1', name: 'Bolo', qty: 10, unitPrice: 9 }])],
        supplierProducts: [sp('p1', 4)],
      }),
    ).getMarginReport(WIN())

    const bolo = r.products.rows.find((x) => x.productId === 'p1')!
    expect(bolo).toMatchObject({ qty: 10, revenue: 90, cost: 40, margin: 50, marginPerUnit: 5 })
    expect(bolo.marginPct).toBeCloseTo(0.5556, 3)
    expect(bolo.belowCost).toBe(false)
  })

  it('produto SEM custo sai com null e vira `unitsWithoutCost` — nunca 100% de margem', async () => {
    const r = await makeService(
      makePrisma({
        marketOrders: [cestinha([{ productId: 'p1', name: 'Sem custo', qty: 7, unitPrice: 9 }])],
        supplierProducts: [],
      }),
    ).getMarginReport(WIN())

    const row = r.products.rows[0]
    expect(row.cost).toBeNull()
    expect(row.margin).toBeNull()
    expect(row.marginPct).toBeNull()
    expect(r.products.unitsWithoutCost).toBe(7)
    // O custo total não recebe a linha sem custo — e a margem se declara PARCIAL.
    expect(r.products.cost).toBe(0)
    expect(r.caveats.join(' ')).toMatch(/PARCIAL/)
  })

  it('marca `belowCost` no produto vendido no prejuízo', async () => {
    const r = await makeService(
      makePrisma({
        marketOrders: [cestinha([{ productId: 'p1', name: 'Isca', qty: 5, unitPrice: 2 }])],
        supplierProducts: [sp('p1', 4)],
      }),
    ).getMarginReport(WIN())
    expect(r.products.rows[0]).toMatchObject({ margin: -10, belowCost: true })
  })

  it('ordena por MARGEM em R$, não por receita', async () => {
    const r = await makeService(
      makePrisma({
        marketOrders: [
          cestinha([
            // Alto faturamento, margem magra.
            { productId: 'volume', name: 'Volume', qty: 100, unitPrice: 10 },
            // Faturamento menor, margem maior — tem de vir primeiro.
            { productId: 'margem', name: 'Margem', qty: 50, unitPrice: 12 },
          ]),
        ],
        supplierProducts: [sp('volume', 9.5), sp('margem', 2)],
      }),
    ).getMarginReport(WIN())

    expect(r.products.rows.map((x) => x.productId)).toEqual(['margem', 'volume'])
    expect(r.products.rows[0].margin).toBe(500) // 600 − 100
    expect(r.products.rows[1].margin).toBe(50) // 1000 − 950
  })

  it('joga para o fim as linhas sem custo, que não têm posição legítima no ranking', async () => {
    const r = await makeService(
      makePrisma({
        marketOrders: [
          cestinha([
            { productId: 'semcusto', name: 'Sem custo', qty: 100, unitPrice: 50 },
            { productId: 'comcusto', name: 'Com custo', qty: 1, unitPrice: 10 },
          ]),
        ],
        supplierProducts: [sp('comcusto', 1)],
      }),
    ).getMarginReport(WIN())
    expect(r.products.rows.map((x) => x.productId)).toEqual(['comcusto', 'semcusto'])
  })
})

describe('MarginService — rateio por condomínio (B3)', () => {
  beforeEach(() => {
    vi.spyOn(AdminReportsService.prototype, 'getCondominiumRanking').mockResolvedValue(
      condoStub([
        { condominiumId: 'a', condominiumName: 'Alfa', revenue: 700, activeClients: 10, breadsDelivered: 750 },
        { condominiumId: 'b', condominiumName: 'Beta', revenue: 300, activeClients: 5, breadsDelivered: 250 },
      ]),
    )
  })

  it('rateia a despesa indireta pela fatia de pães entregues', async () => {
    const r = await makeService(
      makePrisma({
        expenses: [{ categoryId: 'cat1', amount: 400, condominiumId: null }],
        categories: [{ id: 'cat1', isFixed: false }],
      }),
    ).getMarginReport(WIN())

    expect(r.condominiums.breadsTotal).toBe(1000)
    expect(r.condominiums.allocatedTotal).toBe(400)
    const alfa = r.condominiums.rows.find((c) => c.condominiumId === 'a')!
    const beta = r.condominiums.rows.find((c) => c.condominiumId === 'b')!
    expect(alfa.shareOfBreads).toBe(0.75)
    expect(alfa.allocatedCost).toBe(300)
    expect(alfa.contribution).toBe(400)
    expect(beta.allocatedCost).toBe(100)
    // O rateio distribui o total, sem sobra nem duplicação.
    expect(alfa.allocatedCost + beta.allocatedCost).toBe(400)
  })

  it('deixa FORA do rateio a despesa que já tem centro de custo', async () => {
    // Ratear de novo faria o condomínio pagar duas vezes pelo mesmo gasto.
    const r = await makeService(
      makePrisma({
        expenses: [
          { categoryId: 'cat1', amount: 400, condominiumId: null },
          { categoryId: 'cat1', amount: 1000, condominiumId: 'a' },
        ],
        categories: [{ id: 'cat1', isFixed: false }],
      }),
    ).getMarginReport(WIN())
    expect(r.condominiums.allocatedTotal).toBe(400)
  })

  it('não rateia nada quando não houve pão entregue', async () => {
    vi.spyOn(AdminReportsService.prototype, 'getCondominiumRanking').mockResolvedValue(
      condoStub([
        { condominiumId: 'a', condominiumName: 'Alfa', revenue: 100, activeClients: 1, breadsDelivered: 0 },
      ]),
    )
    const r = await makeService(
      makePrisma({
        expenses: [{ categoryId: 'cat1', amount: 400, condominiumId: null }],
        categories: [{ id: 'cat1', isFixed: false }],
      }),
    ).getMarginReport(WIN())
    // Fatia igualitária não corresponderia a esforço nenhum — melhor não atribuir.
    expect(r.condominiums.rows[0].allocatedCost).toBe(0)
    expect(r.condominiums.rows[0].contribution).toBe(100)
  })

  it('ordena por contribuição depois do rateio', async () => {
    const r = await makeService(
      makePrisma({
        expenses: [{ categoryId: 'cat1', amount: 400, condominiumId: null }],
        categories: [{ id: 'cat1', isFixed: false }],
      }),
    ).getMarginReport(WIN())
    expect(r.condominiums.rows.map((c) => c.condominiumId)).toEqual(['a', 'b'])
  })
})

describe('MarginService — ponto de equilíbrio (F9)', () => {
  it('separa fixo de variável por `isFixed` e alimenta o cálculo', async () => {
    const r = await makeService(
      makePrisma({
        expenses: [
          { categoryId: 'fixa', amount: 300, condominiumId: null },
          { categoryId: 'var', amount: 100, condominiumId: null },
        ],
        categories: [
          { id: 'fixa', isFixed: true },
          { id: 'var', isFixed: false },
        ],
      }),
    ).getMarginReport(WIN())

    expect(r.breakEvenInputs.fixedExpenses).toBe(300)
    expect(r.breakEvenInputs.variableExpenses).toBe(100)
    // CMV = pão comprado (400) + CMV da Cestinha (0).
    expect(r.breakEvenInputs.cogs).toBe(400)
    expect(r.breakEven.fixedCosts).toBe(300)
    expect(r.breakEven.variableCosts).toBe(500)
    expect(r.breakEven.contributionMargin).toBe(500) // 1000 − 500
    expect(r.breakEven.breakEvenRevenue).toBe(600) // 300 ÷ 0,5
  })

  it('trata categoria APAGADA como variável, não como fixa', async () => {
    // Inflar o fixo daria uma meta inalcançável — o erro mais caro dos dois.
    const r = await makeService(
      makePrisma({
        expenses: [{ categoryId: 'sumiu', amount: 500, condominiumId: null }],
        categories: [],
      }),
    ).getMarginReport(WIN())
    expect(r.breakEvenInputs.fixedExpenses).toBe(0)
    expect(r.breakEvenInputs.variableExpenses).toBe(500)
  })

  it('expõe os insumos crus para o simulador mexer em cada eixo separadamente', async () => {
    const r = await makeService(makePrisma()).getMarginReport(WIN())
    expect(r.breakEvenInputs).toMatchObject({
      revenue: 1000,
      cogs: 400,
      fixedExpenses: 0,
      variableExpenses: 0,
    })
    expect(r.breakEvenInputs.days).toBe(31)
  })

  it('apura despesa por COMPETÊNCIA e ignora a cancelada', async () => {
    const prisma = makePrisma()
    await makeService(prisma).getMarginReport(WIN())
    const where = prisma.expense.findMany.mock.calls[0][0].where
    expect(where).toHaveProperty('competenceDate')
    expect(where.status.in).toEqual(['PENDING', 'PAID'])
    // Nunca filtra `condominiumId: null` no Mongo — a separação é feita em código.
    expect(where).not.toHaveProperty('condominiumId')
  })
})

describe('MarginService — ressalvas', () => {
  it('declara que a margem é de contribuição e que o pão vale preço de tabela', async () => {
    const r = await makeService(makePrisma()).getMarginReport(WIN())
    expect(r.caveats.join(' ')).toMatch(/CONTRIBUIÇÃO/)
    expect(r.caveats.join(' ')).toMatch(/preço do avulso/)
  })

  it('declara o rateio como rateio quando há despesa indireta', async () => {
    const r = await makeService(
      makePrisma({
        expenses: [{ categoryId: 'c', amount: 100, condominiumId: null }],
        categories: [{ id: 'c', isFixed: false }],
      }),
    ).getMarginReport(WIN())
    expect(r.caveats.join(' ')).toMatch(/RATEIO/)
  })
})
