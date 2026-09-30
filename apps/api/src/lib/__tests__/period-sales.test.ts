// period-sales.test.ts — vendas de um INTERVALO de dias de entrega (Fase 6).
//
// Trava o que a generalização acrescenta sobre `day-sales` — e é justamente onde ela pode errar:
//   - a janela é encaixada em DIAS BRT INTEIROS (senão um preset "hoje" às 9h devolve zero, porque
//     `scheduledDate` é gravado ao MEIO-DIA BRT);
//   - `previousWindow`/mês fechado terminam na meia-noite do dia SEGUINTE, e ler esse instante cru
//     comeria um dia a mais;
//   - a parada é `(dia, cliente, turno)`, não `(cliente, turno)`;
//   - a série diária é CONTÍNUA (dia parado entra com zero);
//   - a sazonalidade divide pelas OCORRÊNCIAS do dia da semana, não pelo total bruto;
//   - a curva ABC é Pareto de verdade, e a linha que CRUZA os 80% ainda é A.
import { describe, it, expect, vi } from 'vitest'
import { buildPeriodSales, salesDayRange, withAbc, singleDayWindow } from '../period-sales.js'
import { monthWindow, rangeWindow, presetWindow } from '../date-range.js'

const NOW = new Date('2026-07-29T12:00:00.000Z')

/** Mock mínimo do Prisma: as duas fontes + os Settings que a lib lê. */
function makePrisma(
  opts: {
    orders?: Record<string, unknown>[]
    marketOrders?: Record<string, unknown>[]
    avulsoUnit?: string | null
    breadProductId?: string | null
    breadProductName?: string
  } = {},
) {
  const {
    orders = [],
    marketOrders = [],
    avulsoUnit = '1.20',
    breadProductId = null,
    breadProductName = 'Pão Francês da Casa',
  } = opts
  return {
    order: { findMany: vi.fn().mockResolvedValue(orders) },
    marketOrder: { findMany: vi.fn().mockResolvedValue(marketOrders) },
    setting: {
      findUnique: vi.fn(({ where }: { where: { key: string } }) => {
        if (where.key === 'avulsoUnit') {
          return Promise.resolve(avulsoUnit == null ? null : { key: 'avulsoUnit', value: avulsoUnit })
        }
        if (where.key === 'breadProductId') {
          return Promise.resolve(
            breadProductId == null ? null : { key: 'breadProductId', value: breadProductId },
          )
        }
        return Promise.resolve(null)
      }),
    },
    product: { findUnique: vi.fn().mockResolvedValue({ name: breadProductName }) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

/** `scheduledDate` é gravado ao MEIO-DIA BRT (15:00 UTC) — igual ao que `cutoff.ts` produz. */
const at = (dateStr: string) => new Date(`${dateStr}T15:00:00.000Z`)

const order = (o: Partial<Record<string, unknown>> = {}) => ({
  userId: 'u1',
  quantity: 4,
  type: 'SINGLE',
  slotId: 'manha',
  condominiumId: 'c1',
  scheduledDate: at('2026-07-29'),
  ...o,
})

const cestinha = (o: Partial<Record<string, unknown>> = {}) => ({
  userId: 'u1',
  condominiumId: 'c1',
  slotId: 'manha',
  breadQty: 0,
  moneyAmount: 0,
  creditsAppliedMilli: 0,
  scheduledDate: at('2026-07-29'),
  items: [],
  ...o,
})

// ─────────────────────────────────────────────────────────── salesDayRange

describe('salesDayRange', () => {
  it('cobre o mês fechado inteiro sem invadir o mês seguinte', () => {
    // agosto fechado: endDate = 01/09 00:00 BRT (exclusivo). Ler o dia BRT cru daria 01/09.
    const r = salesDayRange(monthWindow('2026-08', new Date('2026-09-15T12:00:00Z')))
    expect(r.days[0]).toBe('2026-08-01')
    expect(r.days.at(-1)).toBe('2026-08-31')
    expect(r.days).toHaveLength(31)
  })

  it('trata o `to` do intervalo como INCLUSIVO', () => {
    const r = salesDayRange(rangeWindow('2026-07-01', '2026-07-03', NOW))
    expect(r.days).toEqual(['2026-07-01', '2026-07-02', '2026-07-03'])
  })

  it('cobre o DIA INTEIRO num preset "hoje", mesmo de manhã', () => {
    // É o ponto do módulo: `presetWindow('day')` termina em `now`. Às 06:00 BRT, uma consulta por
    // `scheduledDate <= now` não acharia NADA — o pedido de hoje está gravado às 12:00 BRT.
    const manha = new Date('2026-07-29T09:00:00.000Z') // 06:00 BRT
    const r = salesDayRange(presetWindow('day', manha))
    expect(r.days).toEqual(['2026-07-29'])
    expect(r.end.getTime()).toBeGreaterThan(at('2026-07-29').getTime())
  })

  it('atravessa virada de mês e de ano', () => {
    const r = salesDayRange(rangeWindow('2026-12-30', '2027-01-02', new Date('2027-02-01T12:00:00Z')))
    expect(r.days).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02'])
  })

  it('devolve um único dia para a janela de um dia', () => {
    expect(salesDayRange(singleDayWindow('2026-07-29', NOW)).days).toEqual(['2026-07-29'])
  })

  it('cobre fevereiro de ano bissexto por inteiro', () => {
    const r = salesDayRange(monthWindow('2028-02', new Date('2028-03-10T12:00:00Z')))
    expect(r.days).toHaveLength(29)
    expect(r.days.at(-1)).toBe('2028-02-29')
  })
})

// ─────────────────────────────────────────────────────────── curva ABC

describe('withAbc', () => {
  it('classifica pelo acumulado ANTES da linha — quem CRUZA os 80% ainda é A', () => {
    const out = withAbc([
      { id: 'a', revenue: 79 },
      { id: 'b', revenue: 5 },
      { id: 'c', revenue: 11 },
      { id: 'd', revenue: 5 },
    ])
    // ordenado por receita: a(79) c(11) b(5) d(5) → acumulado 79%, 90%, 95%, 100%
    expect(out.map((l) => l.id)).toEqual(['a', 'c', 'b', 'd'])
    expect(out[0].abc).toBe('A') // entra com 0% acumulado
    expect(out[1].abc).toBe('A') // entra com 79% e é ela que FECHA os 80 — pertence ao bloco A
    expect(out[2].abc).toBe('B') // entra com 90%
    expect(out[3].abc).toBe('C') // entra com 95% cravados
  })

  it('80/20 exatos: só o primeiro é A', () => {
    const out = withAbc([
      { id: 'a', revenue: 80 },
      { id: 'b', revenue: 20 },
    ])
    expect(out.map((l) => l.abc)).toEqual(['A', 'B'])
  })

  it('a última linha fecha em 100% do acumulado', () => {
    const out = withAbc([{ revenue: 1 }, { revenue: 2 }, { revenue: 3 }])
    expect(out.at(-1)!.cumulativeShare).toBe(1)
  })

  it('um produto sozinho é A e vale 100%', () => {
    const out = withAbc([{ revenue: 42 }])
    expect(out[0]).toMatchObject({ share: 1, cumulativeShare: 1, abc: 'A' })
  })

  it('receita total zero devolve tudo como C, sem inventar destaque', () => {
    const out = withAbc([{ revenue: 0 }, { revenue: 0 }])
    expect(out.every((l) => l.abc === 'C' && l.share === 0)).toBe(true)
  })

  it('lista vazia não quebra', () => {
    expect(withAbc([])).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────── buildPeriodSales

describe('buildPeriodSales', () => {
  const win = () => rangeWindow('2026-07-27', '2026-07-29', NOW)

  it('devolve zeros com a série completa quando não houve venda nenhuma', async () => {
    const r = await buildPeriodSales(makePrisma(), win(), NOW)
    expect(r.totalRevenue).toBe(0)
    expect(r.lines).toEqual([])
    // A série NÃO é vazia: os 3 dias existem, parados, com zero.
    expect(r.byDay).toHaveLength(3)
    expect(r.byDay.every((d) => d.revenue === 0 && d.breads === 0)).toBe(true)
    expect(r.counts.days).toBe(3)
  })

  it('soma pão de dias diferentes numa linha só e mantém a série por dia', async () => {
    const r = await buildPeriodSales(
      makePrisma({
        orders: [
          order({ quantity: 10, scheduledDate: at('2026-07-27') }),
          order({ quantity: 5, scheduledDate: at('2026-07-29'), userId: 'u2' }),
        ],
      }),
      win(),
      NOW,
    )
    expect(r.breads.total).toBe(15)
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0].qty).toBe(15)
    expect(r.byDay.map((d) => d.breads)).toEqual([10, 0, 5])
    // 28/07 ficou parado e continua na série — senão o gráfico cola 27 em 29.
    expect(r.byDay[1].date).toBe('2026-07-28')
  })

  it('conta a parada por (dia, cliente, turno) — o mesmo cliente em 3 dias são 3 paradas', async () => {
    const r = await buildPeriodSales(
      makePrisma({
        orders: [
          order({ scheduledDate: at('2026-07-27') }),
          order({ scheduledDate: at('2026-07-28') }),
          order({ scheduledDate: at('2026-07-29') }),
        ],
      }),
      win(),
      NOW,
    )
    expect(r.counts.stops).toBe(3)
    // ...mas ele é UM cliente no período.
    expect(r.counts.clients).toBe(1)
  })

  it('funde pão e Cestinha do mesmo cliente/turno/dia numa parada só (D-5)', async () => {
    const r = await buildPeriodSales(
      makePrisma({
        orders: [order({ scheduledDate: at('2026-07-28') })],
        marketOrders: [cestinha({ scheduledDate: at('2026-07-28') })],
      }),
      win(),
      NOW,
    )
    expect(r.counts.stops).toBe(1)
    expect(r.counts.breadOrders).toBe(1)
    expect(r.counts.marketOrders).toBe(1)
  })

  it('separa pão de item (D-1) e valoriza o item pelo preço que saiu', async () => {
    const r = await buildPeriodSales(
      makePrisma({
        orders: [order({ quantity: 10 })],
        marketOrders: [
          cestinha({
            breadQty: 2,
            items: [{ productId: 'p1', name: 'Bolo', qty: 3, unitPrice: 9 }],
          }),
        ],
      }),
      win(),
      NOW,
    )
    expect(r.breads.total).toBe(12) // 10 do pedido + 2 da Cestinha
    expect(r.items).toEqual({ total: 3, revenue: 27 })
    expect(r.totalRevenue).toBe(12 * 1.2 + 27)
  })

  it('divide a sazonalidade pelas OCORRÊNCIAS do dia da semana', async () => {
    // 27/07/2026 é segunda. Janela de 8 dias → DUAS segundas (27 e 03/08), um sábado.
    const r = await buildPeriodSales(
      makePrisma({
        orders: [
          order({ quantity: 10, scheduledDate: at('2026-07-27') }),
          order({ quantity: 30, scheduledDate: at('2026-08-03'), userId: 'u2' }),
          order({ quantity: 30, scheduledDate: at('2026-08-01'), userId: 'u3' }), // sábado
        ],
      }),
      rangeWindow('2026-07-27', '2026-08-03', NOW),
      NOW,
    )
    const seg = r.byWeekday.find((d) => d.day === 'seg')!
    const sab = r.byWeekday.find((d) => d.day === 'sab')!
    expect(seg.occurrences).toBe(2)
    expect(sab.occurrences).toBe(1)
    // Bruto a segunda vence (40 pães × 1,20 = 48 contra 36); por ocorrência, empata em 24 vs 36 —
    // e é a MÉDIA que responde "que dia vende mais".
    expect(seg.revenue).toBe(48)
    expect(seg.avgRevenue).toBe(24)
    expect(sab.avgRevenue).toBe(36)
  })

  it('devolve a semana inteira na sazonalidade, com zero no dia que não ocorreu', async () => {
    const r = await buildPeriodSales(makePrisma(), rangeWindow('2026-07-27', '2026-07-28', NOW), NOW)
    expect(r.byWeekday).toHaveLength(7)
    expect(r.byWeekday[0].day).toBe('seg') // a semana começa na segunda
    expect(r.byWeekday.find((d) => d.day === 'dom')!.occurrences).toBe(0)
    expect(r.byWeekday.find((d) => d.day === 'dom')!.avgRevenue).toBe(0)
  })

  it('agrupa os produtos por linha somando os dias, com preço médio ponderado', async () => {
    const r = await buildPeriodSales(
      makePrisma({
        marketOrders: [
          cestinha({
            scheduledDate: at('2026-07-27'),
            items: [{ productId: 'p1', name: 'Bolo', qty: 2, unitPrice: 10 }],
          }),
          cestinha({
            scheduledDate: at('2026-07-29'),
            items: [{ productId: 'p1', name: 'Bolo', qty: 2, unitPrice: 8 }],
          }),
        ],
      }),
      win(),
      NOW,
    )
    const bolo = r.lines.find((l) => l.productId === 'p1')!
    expect(bolo.qty).toBe(4)
    expect(bolo.revenue).toBe(36)
    // Preço MÉDIO, não o de tabela: o mesmo produto saiu por valores diferentes no período.
    expect(bolo.avgUnitPrice).toBe(9)
  })

  it('não deixa o pão vendido como item da Cestinha virar linha duplicada', async () => {
    const r = await buildPeriodSales(
      makePrisma({
        breadProductId: 'bread1',
        marketOrders: [
          cestinha({ items: [{ productId: 'bread1', name: 'Pão', qty: 5, unitPrice: 1.2 }] }),
        ],
      }),
      win(),
      NOW,
    )
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0].isBread).toBe(true)
    expect(r.breads.fromItems).toBe(5)
    expect(r.items.total).toBe(0)
  })

  it('consulta o banco UMA vez por coleção, não um dia de cada vez', async () => {
    const prisma = makePrisma({ orders: [order()] })
    await buildPeriodSales(prisma, monthWindow('2026-07', new Date('2026-08-10T12:00:00Z')), NOW)
    // 31 dias de julho, ainda assim uma consulta por coleção.
    expect(prisma.order.findMany).toHaveBeenCalledTimes(1)
    expect(prisma.marketOrder.findMany).toHaveBeenCalledTimes(1)
  })

  it('consulta a janela em dias BRT inteiros, não até o instante de `now`', async () => {
    const prisma = makePrisma()
    const manha = new Date('2026-07-29T09:00:00.000Z') // 06:00 BRT
    await buildPeriodSales(prisma, presetWindow('day', manha), manha)
    const where = prisma.order.findMany.mock.calls[0][0].where
    // O pedido de hoje está gravado às 15:00 UTC; a janela precisa alcançá-lo.
    expect(where.scheduledDate.lte.getTime()).toBeGreaterThan(at('2026-07-29').getTime())
    expect(where.scheduledDate.gte.getTime()).toBeLessThan(at('2026-07-29').getTime())
  })

  it('soma os pãezinhos e o dinheiro da Cestinha ao longo do período', async () => {
    const r = await buildPeriodSales(
      makePrisma({
        marketOrders: [
          cestinha({ scheduledDate: at('2026-07-27'), moneyAmount: 20, creditsAppliedMilli: 3500 }),
          cestinha({ scheduledDate: at('2026-07-29'), moneyAmount: 5, creditsAppliedMilli: 1500 }),
        ],
      }),
      win(),
      NOW,
    )
    expect(r.cash).toEqual({ money: 25, creditsMilli: 5000 })
  })
})
