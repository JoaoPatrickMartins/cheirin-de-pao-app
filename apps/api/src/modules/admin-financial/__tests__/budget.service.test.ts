// budget.service.test.ts — metas mensais e realizado × previsto (F11 · Fase 7).
//
// O que estes testes protegem:
//   - **`expectedToDate`**, a meta PRO RATA. É o que torna a meta útil no meio do mês; sem ela
//     todo dia 10 diz "30% da meta" e não informa nada.
//   - **O sinal**: receita acima da meta é bom, despesa acima é ruim. Resolvido no servidor para
//     nenhuma tela inventar a própria regra de cor.
//   - **A regra do Mongo**: `categoryId` é sempre gravado (com null explícito) e o casamento da
//     meta é resolvido em CÓDIGO, nunca com `where: { categoryId: null }`.
//   - Categoria COM meta e sem gasto continua sendo linha — "gastei zero do que planejei" é
//     informação, e sumiria se a lista viesse só do realizado.
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { BudgetService } from '../budget.service.js'
import { AdminFinancialService } from '../admin-financial.service.js'

/** 10 de agosto ao meio-dia BRT — mês em curso, ~30% decorrido. */
const MID_AUGUST = new Date('2026-08-10T15:00:00.000Z')
/** Setembro, com agosto já fechado. */
const AFTER_AUGUST = new Date('2026-09-05T12:00:00.000Z')

function makePrisma(
  opts: {
    budgets?: Array<{ id: string; month: string; kind: string; categoryId: string | null; amount: number }>
    expenses?: Array<{ categoryId: string; amount: number }>
    categories?: Array<{ id: string; name: string }>
  } = {},
) {
  const { budgets = [], expenses = [], categories = [] } = opts
  return {
    budget: {
      findMany: vi.fn().mockResolvedValue(budgets),
      findUnique: vi.fn().mockResolvedValue(budgets[0] ?? null),
      create: vi.fn().mockImplementation(({ data }: { data: unknown }) => Promise.resolve({ id: 'novo', ...(data as object) })),
      update: vi.fn().mockImplementation(({ data }: { data: unknown }) => Promise.resolve({ id: 'b1', ...(data as object) })),
      delete: vi.fn().mockResolvedValue({ id: 'b1' }),
    },
    expense: { findMany: vi.fn().mockResolvedValue(expenses) },
    expenseCategory: {
      findMany: vi.fn().mockResolvedValue(categories),
      findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(categories.find((c) => c.id === where.id) ?? null),
      ),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeService = (prisma: unknown) => new BudgetService({ prisma } as any)

const revenueStub = (totalConsolidated: number) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ({ totalConsolidated, total: 0, byType: { combos: 0, avulso: 0 } }) as any

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('BudgetService.upsert', () => {
  it('cria gravando `categoryId` EXPLICITAMENTE como null na meta do tipo inteiro', async () => {
    // Sem a chave presente, o índice único do Mongo não enxerga o documento e deixaria passar uma
    // segunda meta de receita para o mesmo mês.
    const prisma = makePrisma()
    await makeService(prisma).upsert({ month: '2026-08', kind: 'REVENUE', amount: 10000 })
    expect(prisma.budget.create).toHaveBeenCalled()
    expect(prisma.budget.create.mock.calls[0][0].data).toMatchObject({ categoryId: null })
  })

  it('atualiza a meta existente em vez de criar outra', async () => {
    const prisma = makePrisma({
      budgets: [{ id: 'b1', month: '2026-08', kind: 'REVENUE', categoryId: null, amount: 8000 }],
    })
    await makeService(prisma).upsert({ month: '2026-08', kind: 'REVENUE', amount: 12000 })
    expect(prisma.budget.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { amount: 12000, notes: null },
    })
    expect(prisma.budget.create).not.toHaveBeenCalled()
  })

  it('nunca procura a meta com `where: { categoryId: null }`', async () => {
    const prisma = makePrisma()
    await makeService(prisma).upsert({ month: '2026-08', kind: 'REVENUE', amount: 1 })
    for (const call of prisma.budget.findMany.mock.calls) {
      expect(call[0].where).not.toHaveProperty('categoryId')
    }
  })

  it('distingue a meta da categoria da meta do total no mesmo mês e tipo', async () => {
    const prisma = makePrisma({
      budgets: [{ id: 'total', month: '2026-08', kind: 'EXPENSE', categoryId: null, amount: 5000 }],
      categories: [{ id: 'cat1', name: 'Combustível' }],
    })
    await makeService(prisma).upsert({ month: '2026-08', kind: 'EXPENSE', categoryId: 'cat1', amount: 900 })
    // A meta do total NÃO pode ser confundida com a da categoria.
    expect(prisma.budget.update).not.toHaveBeenCalled()
    expect(prisma.budget.create).toHaveBeenCalled()
  })

  it('recusa mês fora do formato', async () => {
    await expect(
      makeService(makePrisma()).upsert({ month: '08/2026', kind: 'REVENUE', amount: 1 }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('recusa valor negativo', async () => {
    await expect(
      makeService(makePrisma()).upsert({ month: '2026-08', kind: 'REVENUE', amount: -1 }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('recusa meta por categoria em RECEITA — categoria é de despesa', async () => {
    await expect(
      makeService(makePrisma({ categories: [{ id: 'cat1', name: 'X' }] })).upsert({
        month: '2026-08',
        kind: 'REVENUE',
        categoryId: 'cat1',
        amount: 10,
      }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('recusa categoria inexistente', async () => {
    await expect(
      makeService(makePrisma()).upsert({ month: '2026-08', kind: 'EXPENSE', categoryId: 'sumiu', amount: 10 }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('BudgetService.getReport — ritmo do mês em curso', () => {
  beforeEach(() => {
    vi.spyOn(AdminFinancialService.prototype, 'getRevenue').mockResolvedValue(revenueStub(3000))
  })

  it('compara com a meta PRO RATA, não com a meta cheia', async () => {
    // R$ 4.000 realizados contra uma meta de R$ 10.000: apenas 40% da meta CHEIA, mas ~31% do mês
    // decorreu — está adiante do ritmo. É exatamente a leitura que a meta cheia não permite.
    vi.spyOn(AdminFinancialService.prototype, 'getRevenue').mockResolvedValue(revenueStub(4000))
    const r = await makeService(
      makePrisma({
        budgets: [{ id: 'b1', month: '2026-08', kind: 'REVENUE', categoryId: null, amount: 10000 }],
      }),
    ).getReport('2026-08', MID_AUGUST)

    expect(r.isPartial).toBe(true)
    // 9,5 de 31 dias decorridos ≈ 0,306.
    expect(r.elapsed).toBeGreaterThan(0.25)
    expect(r.elapsed).toBeLessThan(0.35)
    expect(r.revenue.target).toBe(10000)
    expect(r.revenue.expectedToDate).toBeCloseTo(10000 * r.elapsed, 0)
    expect(r.revenue.attainment).toBe(0.4)
    expect(r.revenue.paceStatus).toBe('on_track')
  })

  it('o pro rata é exigente: 30% da meta no dia 10 ainda fica atrás do ritmo', async () => {
    // Trava a régua. Com ~30,6% do mês decorrido, o esperado é R$ 3.064 — R$ 3.000 fica atrás,
    // e é essa precisão que faz a meta significar alguma coisa antes do fim do mês.
    const r = await makeService(
      makePrisma({
        budgets: [{ id: 'b1', month: '2026-08', kind: 'REVENUE', categoryId: null, amount: 10000 }],
      }),
    ).getReport('2026-08', MID_AUGUST)
    expect(r.revenue.actual).toBe(3000)
    expect(r.revenue.expectedToDate).toBeGreaterThan(3000)
    expect(r.revenue.paceStatus).toBe('at_risk')
  })

  it('projeta o fechamento mantido o ritmo atual', async () => {
    const r = await makeService(
      makePrisma({
        budgets: [{ id: 'b1', month: '2026-08', kind: 'REVENUE', categoryId: null, amount: 10000 }],
      }),
    ).getReport('2026-08', MID_AUGUST)
    // 3000 em ~30% do mês projeta ~10.000.
    expect(r.revenue.projected).toBeGreaterThan(9000)
    expect(r.revenue.projected).toBeLessThan(11500)
  })

  it('marca `at_risk` quando a receita está abaixo do esperado até aqui', async () => {
    vi.spyOn(AdminFinancialService.prototype, 'getRevenue').mockResolvedValue(revenueStub(500))
    const r = await makeService(
      makePrisma({
        budgets: [{ id: 'b1', month: '2026-08', kind: 'REVENUE', categoryId: null, amount: 10000 }],
      }),
    ).getReport('2026-08', MID_AUGUST)
    expect(r.revenue.paceStatus).toBe('at_risk')
  })

  it('no mês FECHADO o decorrido é 1 e não há projeção', async () => {
    const r = await makeService(
      makePrisma({
        budgets: [{ id: 'b1', month: '2026-08', kind: 'REVENUE', categoryId: null, amount: 10000 }],
      }),
    ).getReport('2026-08', AFTER_AUGUST)
    expect(r.isPartial).toBe(false)
    expect(r.elapsed).toBe(1)
    expect(r.revenue.expectedToDate).toBe(10000)
    expect(r.revenue.projected).toBeNull()
  })
})

describe('BudgetService.getReport — o sinal do desvio', () => {
  beforeEach(() => {
    vi.spyOn(AdminFinancialService.prototype, 'getRevenue').mockResolvedValue(revenueStub(12000))
  })

  it('receita ACIMA da meta é bom', async () => {
    const r = await makeService(
      makePrisma({
        budgets: [{ id: 'b1', month: '2026-08', kind: 'REVENUE', categoryId: null, amount: 10000 }],
      }),
    ).getReport('2026-08', AFTER_AUGUST)
    expect(r.revenue.variance).toBe(2000)
    expect(r.revenue.isGood).toBe(true)
  })

  it('despesa ACIMA da meta é RUIM — o sinal se inverte', async () => {
    const r = await makeService(
      makePrisma({
        budgets: [{ id: 'b1', month: '2026-08', kind: 'EXPENSE', categoryId: null, amount: 1000 }],
        expenses: [{ categoryId: 'cat1', amount: 1500 }],
        categories: [{ id: 'cat1', name: 'Combustível' }],
      }),
    ).getReport('2026-08', AFTER_AUGUST)
    expect(r.expenseTotal.variance).toBe(500)
    expect(r.expenseTotal.isGood).toBe(false)
    expect(r.expenseTotal.paceStatus).toBe('at_risk')
  })

  it('despesa ABAIXO da meta é bom', async () => {
    const r = await makeService(
      makePrisma({
        budgets: [{ id: 'b1', month: '2026-08', kind: 'EXPENSE', categoryId: null, amount: 2000 }],
        expenses: [{ categoryId: 'cat1', amount: 1500 }],
        categories: [{ id: 'cat1', name: 'Combustível' }],
      }),
    ).getReport('2026-08', AFTER_AUGUST)
    expect(r.expenseTotal.isGood).toBe(true)
    expect(r.expenseTotal.paceStatus).toBe('on_track')
  })

  it('sem meta definida, `paceStatus` é `no_target` e `attainment` é nulo', async () => {
    const r = await makeService(makePrisma()).getReport('2026-08', AFTER_AUGUST)
    expect(r.revenue.paceStatus).toBe('no_target')
    expect(r.revenue.attainment).toBeNull()
    expect(r.caveats.join(' ')).toMatch(/Nenhuma meta definida/)
  })
})

describe('BudgetService.getReport — categorias', () => {
  beforeEach(() => {
    vi.spyOn(AdminFinancialService.prototype, 'getRevenue').mockResolvedValue(revenueStub(0))
  })

  it('mantém como linha a categoria COM meta que não teve gasto', async () => {
    // "Gastei zero do que planejei" é informação e sumiria se a lista viesse só do realizado.
    const r = await makeService(
      makePrisma({
        budgets: [{ id: 'b1', month: '2026-08', kind: 'EXPENSE', categoryId: 'cat1', amount: 800 }],
        categories: [{ id: 'cat1', name: 'Marketing' }],
      }),
    ).getReport('2026-08', AFTER_AUGUST)

    expect(r.expenseByCategory).toHaveLength(1)
    expect(r.expenseByCategory[0]).toMatchObject({ label: 'Marketing', target: 800, actual: 0 })
    expect(r.expenseByCategory[0].isGood).toBe(true)
  })

  it('lista à parte as categorias que gastaram e ainda não têm meta', async () => {
    const r = await makeService(
      makePrisma({
        expenses: [
          { categoryId: 'cat1', amount: 300 },
          { categoryId: 'cat2', amount: 900 },
        ],
        categories: [
          { id: 'cat1', name: 'Combustível' },
          { id: 'cat2', name: 'Aluguel' },
        ],
      }),
    ).getReport('2026-08', AFTER_AUGUST)

    expect(r.expenseByCategory).toEqual([])
    // Ordenadas pelo maior gasto: é a ordem em que vale a pena definir meta.
    expect(r.categoriesWithoutTarget.map((c) => c.name)).toEqual(['Aluguel', 'Combustível'])
    expect(r.expenseTotal.actual).toBe(1200)
  })

  it('soma vários lançamentos da mesma categoria numa linha', async () => {
    const r = await makeService(
      makePrisma({
        budgets: [{ id: 'b1', month: '2026-08', kind: 'EXPENSE', categoryId: 'cat1', amount: 500 }],
        expenses: [
          { categoryId: 'cat1', amount: 100 },
          { categoryId: 'cat1', amount: 250 },
        ],
        categories: [{ id: 'cat1', name: 'Combustível' }],
      }),
    ).getReport('2026-08', AFTER_AUGUST)
    expect(r.expenseByCategory[0].actual).toBe(350)
  })

  it('apura por COMPETÊNCIA e deixa a despesa cancelada de fora', async () => {
    const prisma = makePrisma()
    await makeService(prisma).getReport('2026-08', AFTER_AUGUST)
    const where = prisma.expense.findMany.mock.calls[0][0].where
    expect(where).toHaveProperty('competenceDate')
    expect(where.status.in).toEqual(['PENDING', 'PAID'])
  })

  it('recusa mês fora do formato', async () => {
    await expect(makeService(makePrisma()).getReport('agosto')).rejects.toMatchObject({
      statusCode: 400,
    })
  })
})
