// expenses-report.service — o relatório de despesas (F2 da Fase 2).
//
// O que estes testes protegem:
//   1. Apura por COMPETÊNCIA (conta de agosto paga em setembro é custo de agosto).
//   2. Fixo × variável — o insumo do ponto de equilíbrio.
//   3. A média anterior divide pelos meses que EXISTEM, não por 3 fixo.
//   4. O CAC via gancho é `null` quando o custo não foi informado (A3) — CAC inventado é pior.
import { describe, it, expect, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { ExpensesReportService } from '../expenses-report.service.js'

const CATS = [
  { id: 'c-aluguel', name: 'Aluguel', group: 'ADMIN', emoji: '🏠', isFixed: true },
  { id: 'c-comb', name: 'Combustível', group: 'OPERATION', emoji: '⛽', isFixed: false },
  { id: 'c-entreg', name: 'Entregador', group: 'PEOPLE', emoji: '🛵', isFixed: false },
]

interface Row {
  categoryId: string
  amount: number
  competenceDate: Date
  status: string
  payee: string | null
  supplierId: string | null
}

const row = (over: Partial<Row> = {}): Row => ({
  categoryId: 'c-aluguel',
  amount: 900,
  competenceDate: new Date('2026-08-01T03:00:00Z'),
  status: 'PAID',
  payee: null,
  supplierId: null,
  ...over,
})

interface Over {
  current?: Row[]
  previous?: Row[]
  baseline?: Row[]
  freeHooks?: number
  hookCost?: string | null
  suppliers?: Array<{ id: string; name: string }>
}

function makeService(over: Over = {}) {
  // Despacha pelo `where`, nunca por ORDEM das chamadas: com `compare: false` a busca da janela
  // anterior não acontece, e um mock posicional devolveria a lista errada para a baseline —
  // quebrando por posição em vez de por comportamento. (Mesma disciplina de
  // `admin-reports.market.service.test.ts`.)
  const prisma = {
    expense: {
      findMany: vi.fn().mockImplementation((args: { where: { competenceDate: { gte: Date } } }) => {
        const gte = args.where.competenceDate.gte.getTime()
        if (gte === AGOSTO.startDate.getTime()) return Promise.resolve(over.current ?? [])
        // A baseline começa ~92 dias antes do início; a janela anterior, bem mais perto.
        const daysBefore = (AGOSTO.startDate.getTime() - gte) / (24 * 60 * 60 * 1000)
        return Promise.resolve(daysBefore > 60 ? (over.baseline ?? []) : (over.previous ?? []))
      }),
    },
    expenseCategory: { findMany: vi.fn().mockResolvedValue(CATS) },
    hookRequest: { count: vi.fn().mockResolvedValue(over.freeHooks ?? 0) },
    supplier: { findMany: vi.fn().mockResolvedValue(over.suppliers ?? []) },
    setting: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) =>
        Promise.resolve(
          where.key === 'ganchoCusto' && over.hookCost != null
            ? { value: over.hookCost }
            : null,
        ),
      ),
    },
  }

  return new ExpensesReportService({
    prisma,
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  } as unknown as FastifyInstance)
}

/** Variante que devolve o mock de `expense.findMany` para inspecionar o filtro montado. */
function makeServiceWithSpy() {
  const expenseFindMany = vi.fn().mockResolvedValue([])
  const prisma = {
    expense: { findMany: expenseFindMany },
    expenseCategory: { findMany: vi.fn().mockResolvedValue(CATS) },
    hookRequest: { count: vi.fn().mockResolvedValue(0) },
    supplier: { findMany: vi.fn().mockResolvedValue([]) },
    setting: { findUnique: vi.fn().mockResolvedValue(null) },
  }
  const service = new ExpensesReportService({
    prisma,
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  } as unknown as FastifyInstance)
  return { service, expenseFindMany }
}

const brt = (iso: string) => new Date(`${iso}-03:00`)

const AGOSTO = {
  startDate: brt('2026-08-01T00:00:00'),
  endDate: brt('2026-09-01T00:00:00'),
  label: 'agosto de 2026',
  isPartial: false,
  spec: { kind: 'month' as const, month: '2026-08' },
}

describe('totais', () => {
  it('soma os lançamentos do período', async () => {
    const svc = makeService({
      current: [row({ amount: 900 }), row({ categoryId: 'c-comb', amount: 250 })],
    })
    const r = await svc.getReport(AGOSTO, false)

    expect(r.total).toBe(1150)
    expect(r.count).toBe(2)
  })

  it('separa fixo de variável — o insumo do ponto de equilíbrio', async () => {
    const svc = makeService({
      current: [row({ amount: 900 }), row({ categoryId: 'c-comb', amount: 250 })],
    })
    const r = await svc.getReport(AGOSTO, false)

    expect(r.fixed).toBe(900) // Aluguel é fixa
    expect(r.variable).toBe(250)
  })

  it('soma à parte o que ainda não foi pago', async () => {
    const svc = makeService({
      current: [row({ amount: 900, status: 'PENDING' }), row({ categoryId: 'c-comb', amount: 250 })],
    })
    expect((await svc.getReport(AGOSTO, false)).pending).toBe(900)
  })

  it('consulta por COMPETÊNCIA e exclui CANCELLED', async () => {
    // Conta de agosto paga em setembro é custo de agosto — é a pergunta que o relatório responde.
    // Filtrar por `paidAt` aqui daria o fluxo de caixa, que é outra tela.
    const { service, expenseFindMany } = makeServiceWithSpy()
    await service.getReport(AGOSTO, false)

    const where = expenseFindMany.mock.calls[0][0].where
    expect(where.competenceDate).toEqual({ gte: AGOSTO.startDate, lt: AGOSTO.endDate })
    expect(where.status).toEqual({ in: ['PENDING', 'PAID'] })
    expect('paidAt' in where).toBe(false)
  })
})

describe('comparativo', () => {
  it('calcula a variação vs a janela anterior', async () => {
    const svc = makeService({
      current: [row({ amount: 1200 })],
      previous: [row({ amount: 1000 })],
    })
    expect((await svc.getReport(AGOSTO, true)).deltaPct).toBe(20)
  })

  it('sem comparativo, o delta é null e a janela anterior não vem', async () => {
    const svc = makeService({ current: [row({ amount: 1200 })] })
    const r = await svc.getReport(AGOSTO, false)

    expect(r.deltaPct).toBeNull()
    expect(r.previous).toBeUndefined()
  })

  it('base zero devolve null em vez de "+∞%"', async () => {
    const svc = makeService({ current: [row({ amount: 500 })], previous: [] })
    expect((await svc.getReport(AGOSTO, true)).deltaPct).toBeNull()
  })
})

describe('por grupo e por categoria', () => {
  it('agrupa pela linha do DRE, ordenando pelo maior gasto', async () => {
    const svc = makeService({
      current: [
        row({ amount: 900 }), // ADMIN
        row({ categoryId: 'c-entreg', amount: 1400 }), // PEOPLE
        row({ categoryId: 'c-comb', amount: 250 }), // OPERATION
      ],
    })
    const r = await svc.getReport(AGOSTO, false)

    expect(r.byGroup.map((g) => g.group)).toEqual(['PEOPLE', 'ADMIN', 'OPERATION'])
    expect(r.byGroup[0].pctOfTotal).toBe(54.9) // 1400 / 2550
  })

  it('média anterior divide pelos meses que EXISTEM, não por 3 fixo', async () => {
    // Numa base recém-criada, dividir por 3 daria uma média baixa e todo gasto pareceria anomalia.
    const svc = makeService({
      current: [row({ amount: 900 })],
      baseline: [
        row({ amount: 800, competenceDate: brt('2026-07-01T00:00:00') }),
        row({ amount: 1000, competenceDate: brt('2026-06-01T00:00:00') }),
      ],
    })
    const r = await svc.getReport(AGOSTO, false)

    // 1800 em 2 meses distintos = 900, não 600.
    expect(r.byCategory[0].avgPrevious).toBe(900)
  })

  it('sem histórico, a média anterior é null', async () => {
    const svc = makeService({ current: [row({ amount: 900 })] })
    expect((await svc.getReport(AGOSTO, false)).byCategory[0].avgPrevious).toBeNull()
  })

  it('categoria removida não some da soma — vira "Categoria removida"', async () => {
    // Sumir faria o total do relatório não bater com o da lista de despesas.
    const svc = makeService({ current: [row({ categoryId: 'apagada', amount: 400 })] })
    const r = await svc.getReport(AGOSTO, false)

    expect(r.total).toBe(400)
    expect(r.byCategory[0].name).toBe('Categoria removida')
    expect(r.byCategory[0].group).toBe('OTHER')
  })
})

describe('por recebedor', () => {
  it('usa o nome do fornecedor cadastrado', async () => {
    const svc = makeService({
      current: [row({ supplierId: 'sup-1', amount: 500 })],
      suppliers: [{ id: 'sup-1', name: 'Padaria do Zé' }],
    })
    expect((await svc.getReport(AGOSTO, false)).byPayee[0]).toMatchObject({
      payee: 'Padaria do Zé',
      total: 500,
    })
  })

  it('usa o texto livre quando não há fornecedor (o entregador não é Supplier)', async () => {
    const svc = makeService({ current: [row({ payee: 'João', amount: 300 })] })
    expect((await svc.getReport(AGOSTO, false)).byPayee[0].payee).toBe('João')
  })

  it('lançamento sem recebedor não vira linha em branco', async () => {
    const svc = makeService({ current: [row({ amount: 900 })] })
    expect((await svc.getReport(AGOSTO, false)).byPayee).toEqual([])
  })
})

describe('série mensal', () => {
  it('agrupa por mês BRT, em ordem', async () => {
    const svc = makeService({
      current: [
        row({ amount: 100, competenceDate: brt('2026-08-01T00:00:00') }),
        row({ amount: 200, competenceDate: brt('2026-07-01T00:00:00') }),
      ],
    })
    expect((await svc.getReport(AGOSTO, false)).monthly).toEqual([
      { month: '2026-07', total: 200 },
      { month: '2026-08', total: 100 },
    ])
  })
})

describe('CAC via gancho grátis (A3)', () => {
  it('multiplica ganchos entregues pelo custo unitário', async () => {
    const svc = makeService({ freeHooks: 12, hookCost: '3.50' })
    const r = await svc.getReport(AGOSTO, false)

    expect(r.hookAcquisition).toEqual({ freeDelivered: 12, unitCost: 3.5, cost: 42 })
  })

  it('sem custo informado, devolve null — não zero', async () => {
    // Zero faria a aquisição parecer gratuita, que é exatamente a ilusão que este número desfaz.
    const svc = makeService({ freeHooks: 12, hookCost: null })
    const r = await svc.getReport(AGOSTO, false)

    expect(r.hookAcquisition.freeDelivered).toBe(12)
    expect(r.hookAcquisition.unitCost).toBeNull()
    expect(r.hookAcquisition.cost).toBeNull()
  })

  it('custo zero também conta como "não informado"', async () => {
    const svc = makeService({ freeHooks: 5, hookCost: '0' })
    expect((await svc.getReport(AGOSTO, false)).hookAcquisition.cost).toBeNull()
  })

  it('NÃO entra na soma de despesas — é custo derivado, não lançamento', async () => {
    const svc = makeService({ current: [row({ amount: 900 })], freeHooks: 10, hookCost: '3' })
    const r = await svc.getReport(AGOSTO, false)

    expect(r.total).toBe(900) // e não 930
    expect(r.hookAcquisition.cost).toBe(30)
  })
})
