// trend.service.test.ts — dashboard financeiro consolidado (D4 · Fase 7).
//
// As decisões que os testes travam:
//   - o mês CORRENTE é marcado `isPartial` e fica FORA das comparações — medi-lo contra meses
//     fechados mostraria uma queda que é só o calendário;
//   - a margem varia em PONTOS percentuais, não em %: 5% → 10% é +5 p.p., e "+100%" ali seria
//     defensável e inútil;
//   - passivo e contas a pagar NÃO têm série — são saldos de hoje;
//   - conta que vence HOJE ainda não está atrasada;
//   - a série compõe o DRE mês a mês, então nunca discorda da tela de DRE.
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { TrendService } from '../trend.service.js'
import { DreService } from '../dre.service.js'
import { CashflowService } from '../cashflow.service.js'
import { AdminReportsService } from '../../admin-reports/admin-reports.service.js'

/** 10 de setembro de 2026, meio-dia BRT — setembro em curso, agosto e anteriores fechados. */
const NOW = new Date('2026-09-10T15:00:00.000Z')

/** O DRE de um mês, no formato que `TrendService` consome. */
const dreStub = (o: { revenue?: number; net?: number; netMarginPct?: number } = {}) => {
  const { revenue = 10000, net = 2000, netMarginPct = 20 } = o
  return {
    regime: 'cash',
    dre: {
      grossRevenue: revenue,
      cogs: 4000,
      grossProfit: revenue - 4000,
      grossMarginPct: 60,
      operatingExpenses: 3000,
      netProfit: net,
      netMarginPct,
      caveats: [],
      sections: [],
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cashStub = (net = 500) => ({ net }) as any

const liabilityStub = () =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ({ estLiabilityBRL: 7500, creditsOutstanding: 3000, estPricePerCredit: 2.5, clientsWithCredit: 40 }) as any

function makePrisma(pending: Array<{ amount: number; dueDate: Date | null }> = []) {
  return {
    expense: { findMany: vi.fn().mockResolvedValue(pending) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeService = (prisma: unknown) => new TrendService({ prisma } as any)

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(CashflowService.prototype, 'getReport').mockResolvedValue(cashStub())
  vi.spyOn(AdminReportsService.prototype, 'getCreditLiability').mockResolvedValue(liabilityStub())
})

describe('TrendService — a série', () => {
  it('devolve os N meses terminando no corrente, do mais antigo ao mais novo', async () => {
    vi.spyOn(DreService.prototype, 'getDre').mockResolvedValue(dreStub())
    const r = await makeService(makePrisma()).getTrend(6, NOW)

    expect(r.months).toHaveLength(6)
    expect(r.months.map((m) => m.month)).toEqual([
      '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09',
    ])
  })

  it('atravessa a virada de ano e marca o ano no rótulo só do ano anterior', async () => {
    vi.spyOn(DreService.prototype, 'getDre').mockResolvedValue(dreStub())
    const r = await makeService(makePrisma()).getTrend(3, new Date('2026-01-15T15:00:00.000Z'))

    expect(r.months.map((m) => m.month)).toEqual(['2025-11', '2025-12', '2026-01'])
    // "dez" sozinho num gráfico que começa em nov/25 seria ambíguo; "jan" do ano corrente não.
    expect(r.months.map((m) => m.label)).toEqual(['nov/25', 'dez/25', 'jan'])
  })

  it('marca APENAS o mês corrente como parcial', async () => {
    vi.spyOn(DreService.prototype, 'getDre').mockResolvedValue(dreStub())
    const r = await makeService(makePrisma()).getTrend(6, NOW)

    expect(r.months.filter((m) => m.isPartial).map((m) => m.month)).toEqual(['2026-09'])
  })

  it('converte as margens de 0..100 para TAXA, como todo percentual do módulo', async () => {
    vi.spyOn(DreService.prototype, 'getDre').mockResolvedValue(dreStub({ netMarginPct: 20 }))
    const r = await makeService(makePrisma()).getTrend(2, NOW)

    expect(r.months[0].netMarginPct).toBe(0.2)
    expect(r.months[0].grossMarginPct).toBe(0.6)
  })

  it('traz a variação de caixa do fluxo de caixa, não do DRE', async () => {
    vi.spyOn(DreService.prototype, 'getDre').mockResolvedValue(dreStub({ net: 2000 }))
    vi.spyOn(CashflowService.prototype, 'getReport').mockResolvedValue(cashStub(-350))
    const r = await makeService(makePrisma()).getTrend(2, NOW)

    // Resultado e caixa são números diferentes — e um caixa negativo precisa aparecer como tal.
    expect(r.months[0].netProfit).toBe(2000)
    expect(r.months[0].cashflow).toBe(-350)
  })

  it('pede o DRE em regime de CAIXA — o mesmo da tela que o dono já abre', async () => {
    const spy = vi.spyOn(DreService.prototype, 'getDre').mockResolvedValue(dreStub())
    await makeService(makePrisma()).getTrend(2, NOW)
    for (const call of spy.mock.calls) expect(call[1]).toBe('cash')
  })

  it('limita a série ao teto, mesmo pedindo mais', async () => {
    vi.spyOn(DreService.prototype, 'getDre').mockResolvedValue(dreStub())
    const r = await makeService(makePrisma()).getTrend(99, NOW)
    expect(r.months).toHaveLength(12)
  })

  it('aceita uma série de um mês só', async () => {
    vi.spyOn(DreService.prototype, 'getDre').mockResolvedValue(dreStub())
    const r = await makeService(makePrisma()).getTrend(1, NOW)
    expect(r.months).toHaveLength(1)
    expect(r.months[0].isPartial).toBe(true)
  })
})

describe('TrendService — o comparativo', () => {
  it('compara o último FECHADO com a média dos fechados anteriores, ignorando o parcial', async () => {
    vi.spyOn(DreService.prototype, 'getDre').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (input: any) => {
        const month = input.spec.month as string
        // ago (último fechado) = 12.000; jun e jul = 8.000 cada → média 8.000 → +50%.
        // set (corrente/parcial) = 1.000, e NÃO pode entrar na conta.
        const map: Record<string, number> = {
          '2026-06': 8000,
          '2026-07': 8000,
          '2026-08': 12000,
          '2026-09': 1000,
        }
        return Promise.resolve(dreStub({ revenue: map[month] ?? 0 }))
      },
    )
    const r = await makeService(makePrisma()).getTrend(4, NOW)

    expect(r.summary.month).toBe('2026-08')
    expect(r.summary.revenueDeltaPct).toBe(50)
  })

  it('mede a margem em PONTOS percentuais, não em variação relativa', async () => {
    vi.spyOn(DreService.prototype, 'getDre').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (input: any) => {
        const month = input.spec.month as string
        // anteriores 5%, último fechado 10% → +5 p.p. (dizer "+100%" seria inútil).
        const map: Record<string, number> = { '2026-07': 5, '2026-08': 10, '2026-09': 99 }
        return Promise.resolve(dreStub({ netMarginPct: map[month] ?? 5 }))
      },
    )
    const r = await makeService(makePrisma()).getTrend(3, NOW)
    expect(r.summary.netMarginDeltaPp).toBe(5)
  })

  it('conta quantos meses fechados terminaram no azul', async () => {
    vi.spyOn(DreService.prototype, 'getDre').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (input: any) => {
        const month = input.spec.month as string
        const map: Record<string, number> = { '2026-07': -500, '2026-08': 900, '2026-09': 100 }
        return Promise.resolve(dreStub({ net: map[month] ?? 0 }))
      },
    )
    const r = await makeService(makePrisma()).getTrend(3, NOW)
    // set está em curso e não conta como mês fechado.
    expect(r.summary.closedMonths).toBe(2)
    expect(r.summary.profitableMonths).toBe(1)
  })

  it('não compara quando há só um mês fechado, e diz que falta base', async () => {
    vi.spyOn(DreService.prototype, 'getDre').mockResolvedValue(dreStub())
    const r = await makeService(makePrisma()).getTrend(2, NOW)

    expect(r.summary.month).toBe('2026-08')
    expect(r.summary.revenueDeltaPct).toBeNull()
    expect(r.caveats.join(' ')).toMatch(/dois meses fechados/)
  })

  it('não quebra quando a janela é só o mês corrente', async () => {
    vi.spyOn(DreService.prototype, 'getDre').mockResolvedValue(dreStub())
    const r = await makeService(makePrisma()).getTrend(1, NOW)

    expect(r.summary.month).toBeNull()
    expect(r.summary.closedMonths).toBe(0)
    expect(r.summary.revenueDeltaPct).toBeNull()
  })
})

describe('TrendService — posição (saldos de hoje)', () => {
  beforeEach(() => {
    vi.spyOn(DreService.prototype, 'getDre').mockResolvedValue(dreStub())
  })

  it('traz passivo e contas a pagar como SALDO, fora da série', async () => {
    const r = await makeService(
      makePrisma([
        { amount: 300, dueDate: new Date('2026-09-20T15:00:00Z') },
        { amount: 200, dueDate: new Date('2026-09-01T15:00:00Z') },
      ]),
    ).getTrend(3, NOW)

    expect(r.position.creditLiability).toBe(7500)
    expect(r.position.payable).toBe(500)
    expect(r.position.payableOverdue).toBe(200)
    // Nenhum mês da série carrega esses números — eles não têm histórico.
    expect(r.months[0]).not.toHaveProperty('creditLiability')
    expect(r.caveats.join(' ')).toMatch(/SALDOS de hoje/)
  })

  it('conta que vence HOJE ainda não está atrasada', async () => {
    const r = await makeService(
      makePrisma([{ amount: 100, dueDate: new Date('2026-09-10T15:00:00Z') }]),
    ).getTrend(2, NOW)

    expect(r.position.payable).toBe(100)
    expect(r.position.payableOverdue).toBe(0)
  })

  it('despesa sem vencimento entra no total e nunca em atraso', async () => {
    const r = await makeService(makePrisma([{ amount: 80, dueDate: null }])).getTrend(2, NOW)
    expect(r.position.payable).toBe(80)
    expect(r.position.payableOverdue).toBe(0)
  })

  it('nunca filtra `dueDate: null` no Mongo — resolve em código', async () => {
    const prisma = makePrisma()
    await makeService(prisma).getTrend(2, NOW)
    expect(prisma.expense.findMany.mock.calls[0][0].where).not.toHaveProperty('dueDate')
  })

  it('declara sempre que a série compõe o DRE', async () => {
    const r = await makeService(makePrisma()).getTrend(3, NOW)
    expect(r.caveats.join(' ')).toMatch(/MESMO cálculo da tela de DRE/)
  })

  it('avisa que o mês corrente fica fora das comparações', async () => {
    const r = await makeService(makePrisma()).getTrend(3, NOW)
    expect(r.caveats[0]).toMatch(/EM CURSO/)
  })
})
