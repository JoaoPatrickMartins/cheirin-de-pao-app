// Painel — faixas novas (§15 do plano-financeiro-vendas).
//
// O que estes testes protegem:
//   1. Cestinha sem desfecho é contada por SUBTRAÇÃO — o filtro `lossResolvedAt: null` é a
//      armadilha de null-vs-chave-ausente do Mongo que o projeto já pagou uma vez.
//   2. O alerta de pagamento conta CLIENTE com pendência real, não linha FAILED crua.
//   3. Estoque sem custo cadastrado não vira custo zero.
//   4. O comparativo usa a janela anterior EQUIVALENTE e some quando não foi pedido.
import { describe, it, expect, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { AdminDashboardService } from '../admin-dashboard.service.js'

interface Overrides {
  /** Despesas PENDING (contas a pagar) — `{ amount, dueDate }`. */
  pendingExpenses?: Array<{ amount: number; dueDate: Date | null }>
  orderStuck?: number
  marketStuck?: number
  pendingHooks?: number
  marketNotDelivered?: number
  marketLossResolved?: number
  outOfStock?: number
  lowStock?: number
  failedPayments?: Array<{ userId: string; createdAt: Date }>
  paidPayments?: Array<{ userId: string; createdAt: Date }>
  stockProducts?: Array<{ id: string; stock: number }>
  supplierProducts?: Array<{
    productId: string
    supplierId: string
    unitCost: number
    defaultSharePct: number
    isPreferred: boolean
  }>
}

function makeFastify(over: Overrides = {}) {
  const calls = { marketCountWheres: [] as unknown[] }

  const prisma = {
    // Contas a pagar (§15.6 · Fase 1) — por padrão nenhuma pendente, para os testes que não são
    // sobre isso não mudarem de comportamento.
    expense: {
      findMany: vi.fn().mockResolvedValue(over.pendingExpenses ?? []),
    },
    order: {
      count: vi.fn().mockResolvedValue(over.orderStuck ?? 0),
    },
    marketOrder: {
      count: vi.fn().mockImplementation((args: { where?: Record<string, unknown> }) => {
        calls.marketCountWheres.push(args.where)
        const w = args.where ?? {}
        if (w.scheduledDate != null) return Promise.resolve(over.marketStuck ?? 0)
        if (w.lossResolvedAt != null) return Promise.resolve(over.marketLossResolved ?? 0)
        return Promise.resolve(over.marketNotDelivered ?? 0)
      }),
    },
    hookRequest: { count: vi.fn().mockResolvedValue(over.pendingHooks ?? 0) },
    product: {
      count: vi.fn().mockImplementation((args: { where?: { stock?: Record<string, number> } }) => {
        // `lte: 0` = esgotado · `gt: 0` = faixa crítica.
        const stock = args.where?.stock ?? {}
        if ('gt' in stock) return Promise.resolve(over.lowStock ?? 0)
        return Promise.resolve(over.outOfStock ?? 0)
      }),
      findMany: vi.fn().mockResolvedValue(over.stockProducts ?? []),
    },
    payment: {
      findMany: vi.fn().mockImplementation((args: { where?: { status?: string } }) =>
        Promise.resolve(
          args.where?.status === 'FAILED' ? (over.failedPayments ?? []) : (over.paidPayments ?? []),
        ),
      ),
    },
    supplierProduct: {
      findMany: vi.fn().mockResolvedValue(over.supplierProducts ?? []),
    },
    supplier: {
      findMany: vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            [...new Set((over.supplierProducts ?? []).map((r) => r.supplierId))].map((id) => ({ id })),
          ),
        ),
    },
  }

  return {
    fastify: { prisma, log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } } as unknown as FastifyInstance,
    calls,
  }
}

describe('getAlerts — pedidos parados e ganchos', () => {
  it('soma pedidos de pão e Cestinhas parados', async () => {
    const { fastify } = makeFastify({ orderStuck: 3, marketStuck: 2 })
    const r = await new AdminDashboardService(fastify).getAlerts()
    expect(r.stuckOrders).toBe(5)
  })

  it('conta ganchos aguardando entrega', async () => {
    const { fastify } = makeFastify({ pendingHooks: 4 })
    expect((await new AdminDashboardService(fastify).getAlerts()).pendingHooks).toBe(4)
  })
})

describe('getAlerts — Cestinha sem desfecho (armadilha do null no Mongo)', () => {
  it('conta por SUBTRAÇÃO: não entregues menos resolvidas', async () => {
    const { fastify } = makeFastify({ marketNotDelivered: 7, marketLossResolved: 2 })
    const r = await new AdminDashboardService(fastify).getAlerts()
    expect(r.unresolvedMarketLoss).toBe(5)
  })

  it('NUNCA filtra por `lossResolvedAt: null` — documento antigo não tem a chave', async () => {
    // Esta é a asserção que protege a regra do projeto (Condominium.*Override): no Mongo,
    // `where: { campo: null }` não encontra documento criado antes do campo existir. Só
    // `{ not: null }` é seguro, e é o que a subtração usa.
    const { fastify, calls } = makeFastify({ marketNotDelivered: 7, marketLossResolved: 2 })
    await new AdminDashboardService(fastify).getAlerts()

    const nullFilters = calls.marketCountWheres.filter(
      (w) => (w as { lossResolvedAt?: unknown })?.lossResolvedAt === null,
    )
    expect(nullFilters).toEqual([])
    expect(
      calls.marketCountWheres.some(
        (w) =>
          JSON.stringify((w as { lossResolvedAt?: unknown })?.lossResolvedAt) ===
          JSON.stringify({ not: null }),
      ),
    ).toBe(true)
  })

  it('nunca devolve negativo se as contagens divergirem em corrida', async () => {
    const { fastify } = makeFastify({ marketNotDelivered: 1, marketLossResolved: 3 })
    expect((await new AdminDashboardService(fastify).getAlerts()).unresolvedMarketLoss).toBe(0)
  })
})

describe('getAlerts — pagamento recusado sem recuperação', () => {
  const t = (iso: string) => new Date(iso)

  it('não conta quem pagou DEPOIS da falha', async () => {
    const { fastify } = makeFastify({
      failedPayments: [{ userId: 'u1', createdAt: t('2026-09-10T10:00:00Z') }],
      paidPayments: [{ userId: 'u1', createdAt: t('2026-09-10T10:05:00Z') }],
    })
    // Contar FAILED cru daria 1 e o admin perseguiria um cliente que já pagou — alerta que se
    // aprende a ignorar é pior que nenhum.
    expect((await new AdminDashboardService(fastify).getAlerts()).failedPayments).toBe(0)
  })

  it('conta quem falhou e não pagou depois', async () => {
    const { fastify } = makeFastify({
      failedPayments: [{ userId: 'u1', createdAt: t('2026-09-10T10:00:00Z') }],
      paidPayments: [],
    })
    expect((await new AdminDashboardService(fastify).getAlerts()).failedPayments).toBe(1)
  })

  it('pagamento ANTERIOR à falha não conta como recuperação', async () => {
    const { fastify } = makeFastify({
      failedPayments: [{ userId: 'u1', createdAt: t('2026-09-10T10:00:00Z') }],
      paidPayments: [{ userId: 'u1', createdAt: t('2026-09-09T08:00:00Z') }],
    })
    expect((await new AdminDashboardService(fastify).getAlerts()).failedPayments).toBe(1)
  })

  it('conta CLIENTE, não linha: três falhas do mesmo cliente são uma pendência', async () => {
    const { fastify } = makeFastify({
      failedPayments: [
        { userId: 'u1', createdAt: t('2026-09-10T12:00:00Z') },
        { userId: 'u1', createdAt: t('2026-09-10T11:00:00Z') },
        { userId: 'u1', createdAt: t('2026-09-10T10:00:00Z') },
      ],
      paidPayments: [],
    })
    expect((await new AdminDashboardService(fastify).getAlerts()).failedPayments).toBe(1)
  })

  it('usa a ÚLTIMA falha: pagou no meio e falhou de novo ainda é pendência', async () => {
    const { fastify } = makeFastify({
      failedPayments: [
        { userId: 'u1', createdAt: t('2026-09-10T12:00:00Z') },
        { userId: 'u1', createdAt: t('2026-09-10T08:00:00Z') },
      ],
      paidPayments: [{ userId: 'u1', createdAt: t('2026-09-10T09:00:00Z') }],
    })
    expect((await new AdminDashboardService(fastify).getAlerts()).failedPayments).toBe(1)
  })
})

describe('getAlerts — estoque', () => {
  it('separa esgotado de faixa crítica', async () => {
    const { fastify } = makeFastify({ outOfStock: 2, lowStock: 3 })
    const r = await new AdminDashboardService(fastify).getAlerts()
    expect(r.lowStock).toEqual({ out: 2, low: 3 })
  })
})

describe('getOverview — posição: estoque a custo', () => {
  const supplier = (productId: string, unitCost: number) => ({
    productId,
    supplierId: 's1',
    unitCost,
    defaultSharePct: 0,
    isPreferred: true,
  })

  /** Serviço com as dependências compostas mockadas — aqui só a posição importa. */
  function serviceWithStock(over: Overrides) {
    const { fastify } = makeFastify(over)
    const svc = new AdminDashboardService(fastify)
    // `getOverview` compõe financeiro e relatórios; eles têm testes próprios, então aqui são
    // substituídos para isolar a faixa de posição.
    Object.assign(svc as unknown as Record<string, unknown>, {
      financial: { getRevenue: vi.fn().mockResolvedValue(revenueStub()) },
      reports: {
        getRetentionReport: vi.fn().mockResolvedValue(retentionStub()),
        getCreditLiability: vi
          .fn()
          .mockResolvedValue({ creditsOutstanding: 120, estPricePerCredit: 1.5, estLiabilityBRL: 180, clientsWithCredit: 9 }),
      },
    })
    return svc
  }

  it('valoriza o estoque pelo custo da matriz de fornecimento', async () => {
    const svc = serviceWithStock({
      stockProducts: [{ id: 'p1', stock: 10 }, { id: 'p2', stock: 4 }],
      supplierProducts: [supplier('p1', 2), supplier('p2', 5)],
    })
    const r = await svc.getOverview('month')
    expect(r.position.stockAtCost).toBe(40) // 10×2 + 4×5
    expect(r.position.stockUnitsWithoutCost).toBe(0)
  })

  it('produto sem custo cadastrado NÃO vira custo zero — é contado à parte', async () => {
    const svc = serviceWithStock({
      stockProducts: [{ id: 'p1', stock: 10 }, { id: 'semCusto', stock: 7 }],
      supplierProducts: [supplier('p1', 2)],
    })
    const r = await svc.getOverview('month')
    expect(r.position.stockAtCost).toBe(20)
    // Sem este contador, R$ 20 pareceria o estoque inteiro e as 7 unidades sairiam de graça.
    expect(r.position.stockUnitsWithoutCost).toBe(7)
  })

  it('devolve o passivo de crédito arredondado a centavos', async () => {
    const svc = serviceWithStock({})
    const r = await svc.getOverview('month')
    expect(r.position.creditLiability).toBe(180)
    expect(r.position.creditsOutstanding).toBe(120)
  })
})

describe('getOverview — comparativo', () => {
  function serviceWithRevenue(current: number, previous: number) {
    const { fastify } = makeFastify()
    const svc = new AdminDashboardService(fastify)
    const getRevenue = vi
      .fn()
      .mockResolvedValueOnce(revenueStub(current))
      .mockResolvedValueOnce(revenueStub(previous))
    Object.assign(svc as unknown as Record<string, unknown>, {
      financial: { getRevenue },
      reports: {
        getRetentionReport: vi.fn().mockResolvedValue(retentionStub()),
        getCreditLiability: vi
          .fn()
          .mockResolvedValue({ creditsOutstanding: 0, estPricePerCredit: 0, estLiabilityBRL: 0, clientsWithCredit: 0 }),
      },
    })
    return { svc, getRevenue }
  }

  it('sem compare: não busca a janela anterior e deltaPct fica null', async () => {
    const { svc, getRevenue } = serviceWithRevenue(500, 400)
    const r = await svc.getOverview('month', false)

    expect(getRevenue).toHaveBeenCalledTimes(1)
    expect(r.previous).toBeUndefined()
    expect(r.revenue.deltaPct).toBeNull()
  })

  it('com compare: calcula a variação e expõe a janela anterior', async () => {
    const { svc, getRevenue } = serviceWithRevenue(500, 400)
    const r = await svc.getOverview('month', true)

    expect(getRevenue).toHaveBeenCalledTimes(2)
    expect(r.revenue.deltaPct).toBe(25)
    expect(r.previous?.label).toContain('mesmo ponto')
  })

  it('base zero devolve null em vez de "+∞%"', async () => {
    const { svc } = serviceWithRevenue(500, 0)
    expect((await svc.getOverview('month', true)).revenue.deltaPct).toBeNull()
  })

  it('consolidado inclui gancho e NUNCA o GMV da Cestinha', async () => {
    const { fastify } = makeFastify()
    const svc = new AdminDashboardService(fastify)
    Object.assign(svc as unknown as Record<string, unknown>, {
      financial: {
        getRevenue: vi.fn().mockResolvedValue({
          ...revenueStub(),
          total: 300,
          market: { ...revenueStub().market, revenue: 50 },
          hook: { revenue: 10, orders: 2 },
          totalConsolidated: 360,
          byCondominium: [{ condominiumId: 'c1', total: 300, cestinhaGmv: 900 }],
        }),
      },
      reports: {
        getRetentionReport: vi.fn().mockResolvedValue(retentionStub()),
        getCreditLiability: vi
          .fn()
          .mockResolvedValue({ creditsOutstanding: 0, estPricePerCredit: 0, estLiabilityBRL: 0, clientsWithCredit: 0 }),
      },
    })

    const r = await svc.getOverview('month')
    expect(r.revenue.consolidated).toBe(360) // 300 + 50 + 10
    expect(r.revenue.hook).toBe(10)
    // D-2: o GMV aparece como CONTEXTO e jamais entra no consolidado.
    expect(r.revenue.cestinhaGmv).toBe(900)
    expect(r.revenue.consolidated).not.toBe(360 + 900)
  })
})

describe('getOverview — base de clientes', () => {
  it('expõe o que os relatórios já calculavam e o painel não mostrava', async () => {
    const { fastify } = makeFastify()
    const svc = new AdminDashboardService(fastify)
    Object.assign(svc as unknown as Record<string, unknown>, {
      financial: { getRevenue: vi.fn().mockResolvedValue(revenueStub()) },
      reports: {
        getRetentionReport: vi.fn().mockResolvedValue({
          ...retentionStub(),
          autoRecharge: { enabled: 12, activeClients: 40, rate: 0.3, byMode: { acabar: 8, semanal: 4 } },
          credit: { zeroBalance: 9, atRisk: 5 },
          activation: { registered: 7, withSchedule: 5, withPurchase: 4, withDelivery: 3 },
        }),
        getCreditLiability: vi
          .fn()
          .mockResolvedValue({ creditsOutstanding: 0, estPricePerCredit: 0, estLiabilityBRL: 0, clientsWithCredit: 0 }),
      },
    })

    const r = await svc.getOverview('month')
    expect(r.base).toEqual({
      activeClients: 40,
      newClients: 7,
      atRisk: 5,
      autoRechargeRate: 0.3,
    })
  })
})

// ─────────────────────────────────────────────────────────── stubs

function revenueStub(consolidated = 0) {
  return {
    window: { from: '', to: '', label: 'este mês', isPartial: true },
    total: consolidated,
    byType: { combos: 0, avulso: 0 },
    market: {
      revenue: 0, gmv: 0, moneyPart: 0, creditPart: 0, credits: 0, orders: 0,
      cmv: 0, margin: 0, marginPct: 0, unitsWithoutCost: 0,
    },
    hook: { revenue: 0, orders: 0 },
    totalConsolidated: consolidated,
    purchases: { total: 0, breadCost: 0, itemsCost: 0, orders: 0 },
    byCondominium: [] as Array<{ condominiumId: string; total: number; cestinhaGmv: number }>,
  }
}

function retentionStub() {
  return {
    window: { from: '', to: '', label: 'este mês', isPartial: true },
    autoRecharge: { enabled: 0, activeClients: 0, rate: 0, byMode: { acabar: 0, semanal: 0 } },
    credit: { zeroBalance: 0, atRisk: 0 },
    activation: { registered: 0, withSchedule: 0, withPurchase: 0, withDelivery: 0 },
    repurchase: { avgIntervalDays: null, repurchasingClients: 0, creditsSold: 0, creditsConsumed: 0 },
  }
}

// ── Contas a pagar na Faixa 0 e na Faixa 6 (§15.6 · Fase 1) ──────────────────
describe('getAlerts — contas a pagar', () => {
  /** 10/09/2026 — referência fixa para o dia BRT. */
  const hoje = new Date('2026-09-10T15:00:00.000Z')
  const dia = (iso: string) => new Date(`${iso}T15:00:00.000Z`)

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(hoje)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('separa vencida de vencendo em até 3 dias', async () => {
    const { fastify } = makeFastify({
      pendingExpenses: [
        { amount: 100, dueDate: dia('2026-09-01') }, // vencida
        { amount: 50, dueDate: dia('2026-09-12') }, // vence em 2 dias
        { amount: 70, dueDate: dia('2026-09-10') }, // vence HOJE — não está atrasada
        { amount: 900, dueDate: dia('2026-09-30') }, // longe
      ],
    })
    const a = await new AdminDashboardService(fastify).getAlerts()

    expect(a.payable).toEqual({
      overdue: 1,
      overdueTotal: 100,
      // Vence hoje e vence em 2 dias entram no "em breve"; o de 30/09 não.
      dueSoon: 2,
      dueSoonTotal: 120,
    })
  })

  it('despesa sem vencimento não entra em nenhum balde', async () => {
    const { fastify } = makeFastify({ pendingExpenses: [{ amount: 500, dueDate: null }] })
    const a = await new AdminDashboardService(fastify).getAlerts()
    expect(a.payable).toEqual({ overdue: 0, overdueTotal: 0, dueSoon: 0, dueSoonTotal: 0 })
  })

  it('nunca filtra `dueDate: null` no Mongo — resolve em código', async () => {
    const { fastify } = makeFastify()
    await new AdminDashboardService(fastify).getAlerts()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (fastify.prisma.expense.findMany as any).mock.calls[0][0]
    expect(call.where).toEqual({ status: 'PENDING' })
  })
})
