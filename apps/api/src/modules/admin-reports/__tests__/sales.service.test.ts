// sales.service.test.ts — Vendas & performance (Fase 6).
//
// O serviço COMPÕE: receita vem do financeiro, contagens do relatório de pagamentos, ranking do de
// condomínios. Então os testes mockam esses serviços e travam o que este arquivo de fato DECIDE:
//
//   - o mix de canal e as fatias sobre o CONSOLIDADO;
//   - o ticket de crédito pela receita de crédito, e o da Cestinha pelo GMV (não pela receita nova);
//   - `pricePerCredit`, que é o que torna combos de tamanhos diferentes comparáveis;
//   - divisor zero em toda média — nenhuma tela pode receber `NaN`;
//   - as ressalvas, que precisam viajar com o número em vez de ficar só na tela.
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { SalesService } from '../sales.service.js'
import { AdminFinancialService } from '../../admin-financial/admin-financial.service.js'
import { AdminReportsService } from '../admin-reports.service.js'
import { rangeWindow, monthWindow } from '../../../lib/date-range.js'

const WIN = () => rangeWindow('2026-07-01', '2026-07-31', new Date('2026-08-05T12:00:00Z'))

/** Só o que `buildPeriodSales`, `combosBreakdown` e `distinctBuyers` consultam. */
function makePrisma(
  opts: {
    comboGroups?: Array<{ comboId: string | null; _sum: { amount: number }; _count: number }>
    combos?: Array<{ id: string; name: string; quantity: number; price: number }>
    buyers?: number
    avulsoUnit?: string | null
  } = {},
) {
  const { comboGroups = [], combos = [], buyers = 0, avulsoUnit = '1.20' } = opts
  return {
    order: { findMany: vi.fn().mockResolvedValue([]) },
    marketOrder: { findMany: vi.fn().mockResolvedValue([]) },
    product: { findUnique: vi.fn().mockResolvedValue(null) },
    setting: {
      findUnique: vi.fn(({ where }: { where: { key: string } }) =>
        Promise.resolve(
          where.key === 'avulsoUnit' && avulsoUnit != null
            ? { key: 'avulsoUnit', value: avulsoUnit }
            : null,
        ),
      ),
    },
    combo: { findMany: vi.fn().mockResolvedValue(combos) },
    payment: {
      groupBy: vi.fn().mockImplementation((args: { by: string[] }) =>
        Promise.resolve(
          args.by.includes('comboId')
            ? comboGroups
            : Array.from({ length: buyers }, (_, i) => ({ userId: `u${i}` })),
        ),
      ),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

const revenueStub = (o: Partial<Record<string, unknown>> = {}) =>
  ({
    total: 1000,
    byType: { combos: 800, avulso: 200 },
    market: { revenue: 300, gmv: 500, orders: 10, cmv: 0, margin: 0, marginPct: 0, unitsWithoutCost: 0, moneyPart: 300, creditPart: 200, credits: 0 },
    hook: { revenue: 50, orders: 5 },
    totalConsolidated: 1350,
    purchases: { total: 0, breadCost: 0, itemsCost: 0, orders: 0 },
    byCondominium: [],
    window: { from: '', to: '', label: '', isPartial: false },
    ...o,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any

const paymentsStub = (credits = { paid: 20, amount: 1000 }) =>
  ({
    byStatus: { paid: 30, pending: 0, failed: 0, refunded: 0 },
    approvalRate: 1,
    refundRate: 0,
    byMethod: [],
    byPurpose: [
      { purpose: 'CREDITS', paid: credits.paid, failed: 0, pending: 0, refunded: 0, amount: credits.amount, approvalRate: 1 },
    ],
    recovered: 0,
    window: { from: '', to: '', label: '', isPartial: false },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any

const condoStub = (
  items: Array<{ condominiumId: string; condominiumName: string; revenue: number; activeClients: number; breadsDelivered: number }> = [],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => ({ items, window: { from: '', to: '', label: '', isPartial: false } }) as any

function makeService(prisma: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new SalesService({ prisma } as any)
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('SalesService.getSalesReport — mix de canal (V4)', () => {
  beforeEach(() => {
    vi.spyOn(AdminReportsService.prototype, 'getPaymentsReport').mockResolvedValue(paymentsStub())
    vi.spyOn(AdminReportsService.prototype, 'getCondominiumRanking').mockResolvedValue(condoStub())
  })

  it('calcula a fatia de cada canal sobre o CONSOLIDADO', async () => {
    vi.spyOn(AdminFinancialService.prototype, 'getRevenue').mockResolvedValue(revenueStub())
    const r = await makeService(makePrisma()).getSalesReport(WIN(), false)

    expect(r.channel.total).toBe(1350)
    const byKey = Object.fromEntries(r.channel.slices.map((s) => [s.key, s]))
    expect(byKey.combos.revenue).toBe(800)
    expect(byKey.combos.share).toBeCloseTo(800 / 1350, 4)
    expect(byKey.hook.revenue).toBe(50)
    // As fatias somam 1 — o gancho entra no consolidado (decisão 7), senão faltaria pedaço.
    expect(r.channel.slices.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 3)
  })

  it('compara com a janela anterior quando `compare` está ligado', async () => {
    const spy = vi
      .spyOn(AdminFinancialService.prototype, 'getRevenue')
      .mockResolvedValueOnce(revenueStub())
      .mockResolvedValueOnce(revenueStub({ byType: { combos: 400, avulso: 200 }, totalConsolidated: 900 }))

    const r = await makeService(makePrisma()).getSalesReport(WIN(), true)

    expect(spy).toHaveBeenCalledTimes(2)
    expect(r.previous).toBeDefined()
    expect(r.channel.deltaPct).toBe(50) // 1350 vs 900
    expect(r.channel.slices.find((s) => s.key === 'combos')!.deltaPct).toBe(100) // 800 vs 400
  })

  it('não consulta a janela anterior quando `compare` está desligado', async () => {
    const spy = vi.spyOn(AdminFinancialService.prototype, 'getRevenue').mockResolvedValue(revenueStub())
    const r = await makeService(makePrisma()).getSalesReport(WIN(), false)

    expect(spy).toHaveBeenCalledTimes(1)
    expect(r.previous).toBeUndefined()
    expect(r.channel.deltaPct).toBeNull()
  })

  it('devolve `deltaPct` nulo quando a base anterior era zero, em vez de infinito', async () => {
    vi.spyOn(AdminFinancialService.prototype, 'getRevenue')
      .mockResolvedValueOnce(revenueStub())
      .mockResolvedValueOnce(revenueStub({ byType: { combos: 0, avulso: 0 }, totalConsolidated: 0 }))

    const r = await makeService(makePrisma()).getSalesReport(WIN(), true)
    expect(r.channel.deltaPct).toBeNull()
    expect(r.channel.slices.find((s) => s.key === 'combos')!.deltaPct).toBeNull()
  })
})

describe('SalesService.getSalesReport — ticket médio (V3)', () => {
  beforeEach(() => {
    vi.spyOn(AdminReportsService.prototype, 'getCondominiumRanking').mockResolvedValue(condoStub())
  })

  it('usa a receita de CRÉDITO e a contagem de pedidos de crédito', async () => {
    vi.spyOn(AdminFinancialService.prototype, 'getRevenue').mockResolvedValue(revenueStub())
    vi.spyOn(AdminReportsService.prototype, 'getPaymentsReport').mockResolvedValue(
      paymentsStub({ paid: 20, amount: 1000 }),
    )
    const r = await makeService(makePrisma()).getSalesReport(WIN(), false)
    expect(r.ticket.credit).toMatchObject({ orders: 20, revenue: 1000, avg: 50 })
  })

  it('usa o GMV para o ticket da Cestinha, não a receita nova', async () => {
    // O ticket responde "quanto vale um pedido": um pedido pago metade em pãezinhos vale o que o
    // cliente levou (500/10 = 50), não só a parte em dinheiro (300/10 = 30).
    vi.spyOn(AdminFinancialService.prototype, 'getRevenue').mockResolvedValue(revenueStub())
    vi.spyOn(AdminReportsService.prototype, 'getPaymentsReport').mockResolvedValue(paymentsStub())
    const r = await makeService(makePrisma()).getSalesReport(WIN(), false)
    expect(r.ticket.market).toMatchObject({ orders: 10, revenue: 500, avg: 50 })
  })

  it('divide o CONSOLIDADO pelos compradores distintos no ticket por cliente', async () => {
    vi.spyOn(AdminFinancialService.prototype, 'getRevenue').mockResolvedValue(revenueStub())
    vi.spyOn(AdminReportsService.prototype, 'getPaymentsReport').mockResolvedValue(paymentsStub())
    const r = await makeService(makePrisma({ buyers: 27 })).getSalesReport(WIN(), false)
    expect(r.ticket.perClient.orders).toBe(27)
    expect(r.ticket.perClient.avg).toBe(50) // 1350 / 27
  })

  it('devolve zero — nunca NaN — quando não houve pedido nenhum', async () => {
    vi.spyOn(AdminFinancialService.prototype, 'getRevenue').mockResolvedValue(
      revenueStub({
        total: 0,
        byType: { combos: 0, avulso: 0 },
        market: { revenue: 0, gmv: 0, orders: 0, cmv: 0, margin: 0, marginPct: 0, unitsWithoutCost: 0, moneyPart: 0, creditPart: 0, credits: 0 },
        hook: { revenue: 0, orders: 0 },
        totalConsolidated: 0,
      }),
    )
    vi.spyOn(AdminReportsService.prototype, 'getPaymentsReport').mockResolvedValue(
      paymentsStub({ paid: 0, amount: 0 }),
    )
    const r = await makeService(makePrisma({ buyers: 0 })).getSalesReport(WIN(), false)
    expect(r.ticket.credit.avg).toBe(0)
    expect(r.ticket.market.avg).toBe(0)
    expect(r.ticket.perClient.avg).toBe(0)
    expect(Number.isNaN(r.ticket.credit.avg)).toBe(false)
  })
})

describe('SalesService.getSalesReport — receita por combo (V6)', () => {
  beforeEach(() => {
    vi.spyOn(AdminFinancialService.prototype, 'getRevenue').mockResolvedValue(revenueStub())
    vi.spyOn(AdminReportsService.prototype, 'getPaymentsReport').mockResolvedValue(paymentsStub())
    vi.spyOn(AdminReportsService.prototype, 'getCondominiumRanking').mockResolvedValue(condoStub())
  })

  it('ordena por receita e calcula o R$ por pãozinho de cada combo', async () => {
    const r = await makeService(
      makePrisma({
        comboGroups: [
          { comboId: 'c1', _sum: { amount: 300 }, _count: 10 },
          { comboId: 'c2', _sum: { amount: 700 }, _count: 10 },
        ],
        combos: [
          { id: 'c1', name: 'Pequeno', quantity: 10, price: 30 },
          { id: 'c2', name: 'Grande', quantity: 35, price: 70 },
        ],
      }),
    ).getSalesReport(WIN(), false)

    expect(r.combos.map((c) => c.name)).toEqual(['Grande', 'Pequeno'])
    // Por receita o Grande vence; por pãozinho o Pequeno rende mais (3,00 contra 2,00) — e é
    // ESSA leitura que diz qual combo sustenta a margem.
    expect(r.combos.find((c) => c.name === 'Pequeno')!.pricePerCredit).toBe(3)
    expect(r.combos.find((c) => c.name === 'Grande')!.pricePerCredit).toBe(2)
    expect(r.combos[0].share).toBeCloseTo(0.7, 4)
  })

  it('mantém no relatório a venda de um combo que foi apagado do cadastro', async () => {
    const r = await makeService(
      makePrisma({ comboGroups: [{ comboId: 'sumiu', _sum: { amount: 120 }, _count: 4 }], combos: [] }),
    ).getSalesReport(WIN(), false)

    expect(r.combos).toHaveLength(1)
    expect(r.combos[0].name).toBe('Combo removido')
    expect(r.combos[0].revenue).toBe(120)
    // Sem quantidade não dá para derivar o R$ por pãozinho — e zero seria mentira.
    expect(r.combos[0].pricePerCredit).toBeNull()
  })

  it('devolve lista vazia quando ninguém comprou combo', async () => {
    const r = await makeService(makePrisma()).getSalesReport(WIN(), false)
    expect(r.combos).toEqual([])
  })

  it('nunca filtra `comboId: null` no Mongo — usa `{ not: null }`', async () => {
    const prisma = makePrisma()
    await makeService(prisma).getSalesReport(WIN(), false)
    const call = prisma.payment.groupBy.mock.calls.find((c: [{ by: string[] }]) =>
      c[0].by.includes('comboId'),
    )
    expect(call[0].where.comboId).toEqual({ not: null })
  })
})

describe('SalesService.getSalesReport — performance por condomínio (V9)', () => {
  beforeEach(() => {
    vi.spyOn(AdminFinancialService.prototype, 'getRevenue').mockResolvedValue(revenueStub())
    vi.spyOn(AdminReportsService.prototype, 'getPaymentsReport').mockResolvedValue(paymentsStub())
  })

  it('deriva receita e pães POR CLIENTE em cima do ranking existente', async () => {
    vi.spyOn(AdminReportsService.prototype, 'getCondominiumRanking').mockResolvedValue(
      condoStub([
        { condominiumId: 'a', condominiumName: 'Alfa', revenue: 900, activeClients: 10, breadsDelivered: 450 },
      ]),
    )
    const r = await makeService(makePrisma()).getSalesReport(WIN(), false)
    expect(r.condominiums[0]).toMatchObject({ revenuePerClient: 90, breadsPerClient: 45 })
  })

  it('não divide por zero em condomínio sem cliente ativo', async () => {
    vi.spyOn(AdminReportsService.prototype, 'getCondominiumRanking').mockResolvedValue(
      condoStub([
        { condominiumId: 'b', condominiumName: 'Beta', revenue: 100, activeClients: 0, breadsDelivered: 20 },
      ]),
    )
    const r = await makeService(makePrisma()).getSalesReport(WIN(), false)
    expect(r.condominiums[0].revenuePerClient).toBe(0)
    expect(r.condominiums[0].breadsPerClient).toBe(0)
  })
})

describe('SalesService.getSalesReport — ressalvas', () => {
  beforeEach(() => {
    vi.spyOn(AdminFinancialService.prototype, 'getRevenue').mockResolvedValue(revenueStub())
    vi.spyOn(AdminReportsService.prototype, 'getPaymentsReport').mockResolvedValue(paymentsStub())
    vi.spyOn(AdminReportsService.prototype, 'getCondominiumRanking').mockResolvedValue(condoStub())
  })

  it('declara sempre que as duas bases não fecham entre si', async () => {
    const r = await makeService(makePrisma()).getSalesReport(WIN(), false)
    expect(r.caveats.join(' ')).toMatch(/DIA DE ENTREGA/)
    expect(r.caveats.join(' ')).toMatch(/DATA DO PAGAMENTO/)
  })

  it('põe "período em curso" em PRIMEIRO lugar quando a janela não fechou', async () => {
    const parcial = monthWindow('2026-08', new Date('2026-08-10T12:00:00Z'))
    const r = await makeService(makePrisma()).getSalesReport(parcial, false)
    expect(r.caveats[0]).toMatch(/EM CURSO/)
  })

  it('avisa quando o preço do avulso não está configurado', async () => {
    const r = await makeService(makePrisma({ avulsoUnit: null })).getSalesReport(WIN(), false)
    expect(r.caveats.join(' ')).toMatch(/avulsoUnit/)
  })
})

describe('SalesService.getSalesReport — curva ABC nas linhas', () => {
  it('classifica as linhas de venda e as devolve ordenadas por receita', async () => {
    vi.spyOn(AdminFinancialService.prototype, 'getRevenue').mockResolvedValue(revenueStub())
    vi.spyOn(AdminReportsService.prototype, 'getPaymentsReport').mockResolvedValue(paymentsStub())
    vi.spyOn(AdminReportsService.prototype, 'getCondominiumRanking').mockResolvedValue(condoStub())

    const prisma = makePrisma()
    prisma.marketOrder.findMany.mockResolvedValue([
      {
        userId: 'u1',
        condominiumId: 'c1',
        slotId: 'manha',
        breadQty: 0,
        moneyAmount: 0,
        creditsAppliedMilli: 0,
        scheduledDate: new Date('2026-07-10T15:00:00.000Z'),
        items: [
          { productId: 'p1', name: 'Caro', qty: 1, unitPrice: 90 },
          { productId: 'p2', name: 'Barato', qty: 1, unitPrice: 10 },
        ],
      },
    ])

    const r = await makeService(prisma).getSalesReport(WIN(), false)
    expect(r.sales.lines.map((l) => l.name)).toEqual(['Caro', 'Barato'])
    expect(r.sales.lines[0].abc).toBe('A')
    expect(r.sales.lines[0].share).toBeCloseTo(0.9, 4)
    expect(r.sales.lines[1].abc).toBe('B')
  })
})
