/**
 * period-sales.ts — o que foi VENDIDO num INTERVALO de dias de entrega.
 *
 * Generalização de `day-sales.ts` de um dia para uma janela (Fase 6 do plano-financeiro-vendas).
 * A relação entre os dois arquivos é deliberada e vale explicar: **`buildDaySales` passou a ser
 * uma chamada de um dia só a `buildPeriodSales`**. Duas implementações do mesmo relatório
 * divergiriam no primeiro ajuste de regra — e a tela do dia e a do período responderiam números
 * diferentes para o mesmo dia, que é o defeito mais caro que um relatório pode ter.
 *
 * Herda inteiras as decisões de `day-sales.ts` (leia o cabeçalho de lá): as duas fontes são
 * `Order` não cancelado e `MarketOrder` confirmada; previsto de agenda e Cestinha
 * `PENDING_PAYMENT` ficam de fora; VENDIDO ≠ ENTREGUE; pão e item são contadores separados (D-1);
 * pedido sem turno cai num balde "Sem turno".
 *
 * Duas coisas são novas, e nenhuma é cosmética:
 *
 * 1. **A janela é encaixada em DIAS BRT INTEIROS.** `DateWindow` de preset termina em `new Date()`,
 *    e `scheduledDate` é gravado ao MEIO-DIA BRT (15:00 UTC, ver `cutoff.ts`). Consultar
 *    `scheduledDate <= agora` às 9h da manhã devolveria ZERO venda para hoje — o relatório diria
 *    que nada foi vendido justamente no dia em que o admin está olhando. Aqui a janela vira
 *    "do primeiro ao último dia BRT que ela toca, inteiros".
 *
 * 2. **A parada é por (dia, cliente, turno).** Em `day-sales` o dia é implícito; num intervalo,
 *    contar `(cliente, turno)` faria o mesmo cliente atendido 20 dias seguidos valer UMA parada.
 *
 * O que NÃO está aqui, de propósito: ticket médio, mix de canal e receita por combo. Todos saem do
 * lado do DINHEIRO (`Payment.createdAt`), não do dia de entrega, e misturar as duas bases no mesmo
 * agregador produziria um número que não é nem um nem outro. Quem cruza os dois é o serviço, que
 * declara a diferença no payload.
 */
import type { PrismaClient } from '@prisma/client'
import { brtDayRange, brtNoonFromStr, brtDateStr, dayKeyOf, type DayKey } from './cutoff.js'
import { CONFIRMED_MARKET_STATUSES } from './bread-demand.js'
import { getGlobalDeliverySlots } from './delivery-slots.js'
import { rangeWindow, type DateWindow } from './date-range.js'

const AVULSO_UNIT_KEY = 'avulsoUnit'
const BREAD_PRODUCT_KEY = 'breadProductId'

/** Id sintético da linha do pão quando `Setting.breadProductId` não está configurado. */
export const BREAD_LINE_FALLBACK_ID = '__bread__'

const NO_SLOT_ID = ''
const NO_SLOT_LABEL = 'Sem turno'

const DEFAULT_SLOT_LABELS: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde' }

const WEEKDAY_LABEL: Record<DayKey, string> = {
  dom: 'Domingo',
  seg: 'Segunda',
  ter: 'Terça',
  qua: 'Quarta',
  qui: 'Quinta',
  sex: 'Sexta',
  sab: 'Sábado',
}

/** Ordem de exibição da semana — segunda primeiro, como toda tela do projeto. */
const WEEKDAY_ORDER: DayKey[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']

const DAY_MS = 24 * 60 * 60 * 1000

function fallbackSlotLabel(slotId: string): string {
  if (!slotId) return NO_SLOT_LABEL
  return DEFAULT_SLOT_LABELS[slotId] ?? slotId.charAt(0).toUpperCase() + slotId.slice(1)
}

/** Arredonda R$ para 2 casas — soma de float precisa fechar com o que a tela mostra. */
function money(value: number): number {
  return Math.round(value * 100) / 100
}

// ─────────────────────────────────────────────────────────── janela em dias BRT

export interface SalesDayRange {
  /** Todo dia BRT tocado pela janela, em ordem, sem buraco. */
  days: string[]
  /** 00:00 BRT do primeiro dia. */
  start: Date
  /** 23:59:59.999 BRT do último dia. */
  end: Date
}

/**
 * Encaixa uma `DateWindow` em dias BRT inteiros — a razão está no item 1 do cabeçalho.
 *
 * O `−1ms` no fim não é defensivo, é obrigatório: `monthWindow`/`rangeWindow` devolvem `endDate`
 * na meia-noite BRT do dia SEGUINTE (fim exclusivo), então ler o dia BRT desse instante cru daria
 * um dia a mais — agosto viraria "01/08 a 01/09" e o relatório de agosto comeria o primeiro dia de
 * setembro.
 */
export function salesDayRange(win: DateWindow): SalesDayRange {
  const firstDay = brtDateStr(win.startDate)
  const lastInstant = new Date(Math.max(win.endDate.getTime() - 1, win.startDate.getTime()))
  const lastDay = brtDateStr(lastInstant)

  const start = brtDayRange(brtNoonFromStr(firstDay)).start
  const end = brtDayRange(brtNoonFromStr(lastDay)).end

  const days: string[] = []
  for (let t = brtNoonFromStr(firstDay).getTime(); ; t += DAY_MS) {
    const d = brtDateStr(new Date(t))
    days.push(d)
    if (d >= lastDay) break
  }

  return { days, start, end }
}

// ─────────────────────────────────────────────────────────── curva ABC

export type AbcClass = 'A' | 'B' | 'C'

export interface AbcLine {
  /** Fatia da linha na receita total (0..1). */
  share: number
  /** Fatia acumulada até esta linha, inclusive (0..1). */
  cumulativeShare: number
  /** A = até 80% da receita · B = até 95% · C = o resto (a cauda). */
  abc: AbcClass
}

/**
 * Curva ABC (V2) — PURA, sobre qualquer coisa que tenha receita.
 *
 * Corte clássico de Pareto: A é o MENOR conjunto de linhas que chega a 80% da receita, B vai daí
 * até 95%, C é a cauda.
 *
 * A classe olha a acumulada **ANTES** da linha, não depois — e a diferença não é sutil. Pela
 * acumulada depois, um produto sozinho no relatório fecharia em 100% e cairia em C: o único
 * produto que a loja vende, classificado como cauda. Olhando antes, ele entra com acumulada 0 e é
 * A, que é a leitura certa: **a linha que CRUZA o limiar pertence ao bloco que ela fecha**, porque
 * sem ela aquele bloco não chega aos 80%.
 *
 * Receita total zero devolve tudo como C: sem base, não existe "os 20% que fazem 80%", e
 * classificar como A o primeiro de uma lista de zeros seria inventar um destaque.
 */
export function withAbc<T extends { revenue: number }>(lines: T[]): Array<T & AbcLine> {
  const total = lines.reduce((s, l) => s + l.revenue, 0)
  if (total <= 0) {
    return lines.map((l) => ({ ...l, share: 0, cumulativeShare: 0, abc: 'C' as const }))
  }

  const sorted = [...lines].sort((a, b) => b.revenue - a.revenue)
  let acc = 0
  return sorted.map((l) => {
    const share = l.revenue / total
    // A tolerância evita que um acumulado que deveria ser exatamente 0,80 caia em 0,7999999996 e
    // promova a B para A — o erro de float apareceria como classe trocada, sem nenhum outro sinal.
    const before = acc
    const abc: AbcClass = before < 0.8 - 1e-9 ? 'A' : before < 0.95 - 1e-9 ? 'B' : 'C'
    acc += share
    return {
      ...l,
      share: Math.round(share * 10000) / 10000,
      cumulativeShare: Math.round(Math.min(acc, 1) * 10000) / 10000,
      abc,
    }
  })
}

// ─────────────────────────────────────────────────────────── tipos do relatório

/** Quanto de um produto saiu num turno. */
export interface SalesSlotQty {
  slotId: string
  label: string
  qty: number
}

/** Uma linha do relatório: um produto, com o quanto e o quanto rendeu. */
export interface PeriodSalesLine {
  productId: string
  name: string
  /** A linha do pão — soma as duas origens (pedido de pão + Cestinha) e vem sempre primeiro. */
  isBread: boolean
  qty: number
  /** R$ vendidos na linha. */
  revenue: number
  /**
   * Preço unitário MÉDIO (revenue / qty), não o preço de tabela: promoção e mudança de preço fazem
   * o mesmo produto sair por valores diferentes dentro do período.
   */
  avgUnitPrice: number
  bySlot: SalesSlotQty[]
}

/** Um dia da série. Dia sem venda entra com ZERO — ver `byDay`. */
export interface PeriodSalesDay {
  date: string
  breads: number
  items: number
  revenue: number
}

export interface PeriodSalesWeekday {
  day: DayKey
  label: string
  breads: number
  items: number
  revenue: number
  /** Quantos dias desse da semana o período contém — sem isso a soma engana (ver `byWeekday`). */
  occurrences: number
  /** Receita média por ocorrência. É este número que compara segunda com sábado. */
  avgRevenue: number
}

export interface PeriodSales {
  /** Dias BRT cobertos, do primeiro ao último, sem buraco. */
  days: string[]
  /** Instante da apuração. */
  generatedAt: string
  breads: {
    /** Pães vendidos = `single + scheduled + fromMarket + fromItems`. */
    total: number
    single: number
    scheduled: number
    fromMarket: number
    /** Pão que veio como item de Cestinha — sempre 0 no fluxo normal. */
    fromItems: number
    /** `Setting.avulsoUnit` — 0 quando não configurado. */
    unitPrice: number
    /** `total × unitPrice`. Valor de TABELA: o pão da agenda foi pago em pãezinhos de combo. */
    revenue: number
  }
  /** Produtos da Cestinha — métrica paralela aos pães (D-1), nunca somada a eles. */
  items: { total: number; revenue: number }
  /** `breads.revenue + items.revenue`. */
  totalRevenue: number
  /** Como a Cestinha foi paga — o recorte que de fato virou caixa. */
  cash: { money: number; creditsMilli: number }
  counts: {
    /** Paradas `(dia, cliente, turno)` — pão + Cestinha do mesmo cliente/turno/dia = 1 (D-5). */
    stops: number
    /** Clientes DISTINTOS no período inteiro, não a soma dos clientes de cada dia. */
    clients: number
    condominiums: number
    breadOrders: number
    marketOrders: number
    /** Dias do período. Divisor de toda média diária. */
    days: number
  }
  slots: Array<{ slotId: string; label: string; breads: number; items: number; revenue: number }>
  /** Pão primeiro; depois os produtos por receita decrescente (desempate por nome). */
  lines: PeriodSalesLine[]
  /** Série diária CONTÍNUA — dia parado entra com zero, senão o gráfico mente sobre o ritmo. */
  byDay: PeriodSalesDay[]
  /** Sazonalidade (V12): que dia da semana vende. Na ordem da semana, segunda primeiro. */
  byWeekday: PeriodSalesWeekday[]
}

/** Acumulador interno de uma linha. */
interface LineAcc extends Omit<PeriodSalesLine, 'bySlot' | 'avgUnitPrice'> {
  bySlot: Map<string, number>
}

interface SlotAcc {
  slotId: string
  label: string
  breads: number
  items: number
  revenue: number
}

interface DayAcc {
  breads: number
  items: number
  itemsRevenue: number
}

// ─────────────────────────────────────────────────────────── o relatório

/**
 * buildPeriodSales — o relatório de vendas de um INTERVALO de dias de entrega.
 *
 * Uma passada por coleção sobre a janela inteira, não N consultas por dia: o relatório de um mês
 * viraria 31 idas ao banco por coleção, e o agrupamento por dia é trivial em memória depois que os
 * documentos já vieram.
 */
export async function buildPeriodSales(
  prisma: PrismaClient,
  win: DateWindow,
  now: Date = new Date(),
): Promise<PeriodSales> {
  const { days, start, end } = salesDayRange(win)

  const [orders, marketOrders, avulsoRow, breadRow, slotConfig] = await Promise.all([
    prisma.order.findMany({
      where: { scheduledDate: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
      select: {
        userId: true,
        quantity: true,
        type: true,
        slotId: true,
        condominiumId: true,
        scheduledDate: true,
      },
    }),
    prisma.marketOrder.findMany({
      where: {
        scheduledDate: { gte: start, lte: end },
        status: { in: [...CONFIRMED_MARKET_STATUSES] },
      },
      select: {
        userId: true,
        condominiumId: true,
        slotId: true,
        breadQty: true,
        moneyAmount: true,
        creditsAppliedMilli: true,
        scheduledDate: true,
        items: { select: { productId: true, name: true, qty: true, unitPrice: true } },
      },
    }),
    prisma.setting.findUnique({ where: { key: AVULSO_UNIT_KEY } }),
    prisma.setting.findUnique({ where: { key: BREAD_PRODUCT_KEY } }),
    getGlobalDeliverySlots(prisma),
  ])

  const unitPrice = Number(avulsoRow?.value ?? 0) || 0
  const breadProductId = breadRow?.value ?? null
  const breadLineId = breadProductId ?? BREAD_LINE_FALLBACK_ID

  const labelBySlot = new Map(slotConfig.map((s) => [s.slotId, s.label]))
  const slotLabelFor = (slotId: string): string =>
    labelBySlot.get(slotId) ?? fallbackSlotLabel(slotId)

  // ── Acumuladores ─────────────────────────────────────────────────────────
  const lines = new Map<string, LineAcc>()
  const slots = new Map<string, SlotAcc>()
  const byDay = new Map<string, DayAcc>()
  const stopKeys = new Set<string>()
  const clientIds = new Set<string>()
  const condoIds = new Set<string>()

  // A série nasce com TODOS os dias em zero. Preencher só os dias com venda deixaria o gráfico
  // colar um domingo parado no sábado seguinte e sugerir um ritmo que não houve.
  for (const d of days) byDay.set(d, { breads: 0, items: 0, itemsRevenue: 0 })

  const ensureDay = (date: string): DayAcc => {
    let d = byDay.get(date)
    if (!d) {
      // Só acontece se um documento cair fora da grade (fuso inesperado); melhor somar num dia
      // novo do que descartar a venda em silêncio.
      d = { breads: 0, items: 0, itemsRevenue: 0 }
      byDay.set(date, d)
    }
    return d
  }

  const ensureLine = (productId: string, name: string, isBread: boolean): LineAcc => {
    let l = lines.get(productId)
    if (!l) {
      l = { productId, name, isBread, qty: 0, revenue: 0, bySlot: new Map() }
      lines.set(productId, l)
    }
    return l
  }

  const ensureSlot = (slotId: string): SlotAcc => {
    let s = slots.get(slotId)
    if (!s) {
      s = { slotId, label: slotLabelFor(slotId), breads: 0, items: 0, revenue: 0 }
      slots.set(slotId, s)
    }
    return s
  }

  /** A parada é `(dia, cliente, turno)` — ver o item 2 do cabeçalho. */
  const trackStop = (date: string, userId: string, slotId: string, condominiumId: string | null) => {
    stopKeys.add(`${date}|${userId}|${slotId}`)
    clientIds.add(userId)
    if (condominiumId) condoIds.add(condominiumId)
  }

  let breadSingle = 0
  let breadScheduled = 0
  let breadFromMarket = 0
  let breadFromItems = 0
  let cashMoney = 0
  let cashCreditsMilli = 0

  // ── 1. Pedidos de pão ────────────────────────────────────────────────────
  for (const o of orders) {
    const slotId = o.slotId ?? NO_SLOT_ID
    const date = brtDateStr(o.scheduledDate)
    trackStop(date, o.userId, slotId, o.condominiumId)
    if (o.type === 'SCHEDULED') breadScheduled += o.quantity
    else breadSingle += o.quantity
    ensureSlot(slotId).breads += o.quantity
    ensureDay(date).breads += o.quantity
  }

  // ── 2. Cestinhas confirmadas ─────────────────────────────────────────────
  for (const mo of marketOrders) {
    const slotId = mo.slotId ?? NO_SLOT_ID
    const date = brtDateStr(mo.scheduledDate)
    trackStop(date, mo.userId, slotId, mo.condominiumId)
    breadFromMarket += mo.breadQty
    ensureSlot(slotId).breads += mo.breadQty
    ensureDay(date).breads += mo.breadQty
    cashMoney += mo.moneyAmount
    cashCreditsMilli += mo.creditsAppliedMilli ?? 0

    for (const it of mo.items) {
      // O checkout separa o pão em `breadQty`, então ele NÃO chega como item. Se chegasse, vira
      // pão junto com o resto em vez de abrir uma linha duplicada — mesma defesa de `day-sales`.
      if (breadProductId != null && it.productId === breadProductId) {
        breadFromItems += it.qty
        ensureSlot(slotId).breads += it.qty
        ensureDay(date).breads += it.qty
        continue
      }
      const value = it.qty * it.unitPrice
      const line = ensureLine(it.productId, it.name, false)
      line.qty += it.qty
      line.revenue += value
      line.bySlot.set(slotId, (line.bySlot.get(slotId) ?? 0) + it.qty)

      const slot = ensureSlot(slotId)
      slot.revenue += value
      slot.items += it.qty

      const day = ensureDay(date)
      day.items += it.qty
      day.itemsRevenue += value
    }
  }

  // ── 3. Linha do pão ──────────────────────────────────────────────────────
  const breadTotal = breadSingle + breadScheduled + breadFromMarket + breadFromItems
  if (breadTotal > 0) {
    const line = ensureLine(breadLineId, 'Pão Francês', true)
    line.qty = breadTotal
    line.revenue = breadTotal * unitPrice
    for (const [slotId, acc] of slots) {
      if (acc.breads > 0) line.bySlot.set(slotId, acc.breads)
    }
    if (breadProductId) {
      const p = await prisma.product.findUnique({
        where: { id: breadProductId },
        select: { name: true },
      })
      if (p?.name) line.name = p.name
    }
  }

  // A receita de pão do turno entra depois da linha, para não contaminar o laço acima.
  for (const acc of slots.values()) acc.revenue = money(acc.revenue + acc.breads * unitPrice)

  // ── 4. Saída ─────────────────────────────────────────────────────────────
  const itemsTotal = [...lines.values()].filter((l) => !l.isBread).reduce((s, l) => s + l.qty, 0)
  const itemsRevenue = [...lines.values()]
    .filter((l) => !l.isBread)
    .reduce((s, l) => s + l.revenue, 0)
  const breadRevenue = money(breadTotal * unitPrice)

  const slotOrder = new Map(slotConfig.map((s, i) => [s.slotId, i]))
  const sortedSlots = [...slots.values()].sort(
    (a, b) => (slotOrder.get(a.slotId) ?? 99) - (slotOrder.get(b.slotId) ?? 99),
  )

  const sortedLines: PeriodSalesLine[] = [...lines.values()]
    .sort((a, b) => {
      if (a.isBread !== b.isBread) return a.isBread ? -1 : 1
      if (b.revenue !== a.revenue) return b.revenue - a.revenue
      return a.name.localeCompare(b.name, 'pt-BR')
    })
    .map((l) => ({
      productId: l.productId,
      name: l.name,
      isBread: l.isBread,
      qty: l.qty,
      revenue: money(l.revenue),
      avgUnitPrice: l.qty > 0 ? money(l.revenue / l.qty) : 0,
      bySlot: [...l.bySlot.entries()]
        .filter(([, qty]) => qty > 0)
        .sort(([a], [b]) => (slotOrder.get(a) ?? 99) - (slotOrder.get(b) ?? 99))
        .map(([slotId, qty]) => ({ slotId, label: slotLabelFor(slotId), qty })),
    }))

  const series: PeriodSalesDay[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, acc]) => ({
      date,
      breads: acc.breads,
      items: acc.items,
      revenue: money(acc.itemsRevenue + acc.breads * unitPrice),
    }))

  // Sazonalidade: acumula por dia da semana e divide pelas OCORRÊNCIAS. Um período de 10 dias tem
  // 2 segundas e 1 sábado — comparar os totais brutos premiaria o dia que calhou de repetir mais.
  const weekdayAcc = new Map<DayKey, PeriodSalesWeekday>()
  for (const d of WEEKDAY_ORDER) {
    weekdayAcc.set(d, {
      day: d,
      label: WEEKDAY_LABEL[d],
      breads: 0,
      items: 0,
      revenue: 0,
      occurrences: 0,
      avgRevenue: 0,
    })
  }
  for (const row of series) {
    const key = dayKeyOf(brtNoonFromStr(row.date))
    const acc = weekdayAcc.get(key)
    if (!acc) continue
    acc.breads += row.breads
    acc.items += row.items
    acc.revenue = money(acc.revenue + row.revenue)
    acc.occurrences += 1
  }
  const byWeekday = WEEKDAY_ORDER.map((d) => {
    const acc = weekdayAcc.get(d)!
    return { ...acc, avgRevenue: acc.occurrences > 0 ? money(acc.revenue / acc.occurrences) : 0 }
  })

  return {
    days,
    generatedAt: now.toISOString(),
    breads: {
      total: breadTotal,
      single: breadSingle,
      scheduled: breadScheduled,
      fromMarket: breadFromMarket,
      fromItems: breadFromItems,
      unitPrice,
      revenue: breadRevenue,
    },
    items: { total: itemsTotal, revenue: money(itemsRevenue) },
    totalRevenue: money(breadRevenue + itemsRevenue),
    cash: { money: money(cashMoney), creditsMilli: cashCreditsMilli },
    counts: {
      stops: stopKeys.size,
      clients: clientIds.size,
      condominiums: condoIds.size,
      breadOrders: orders.length,
      marketOrders: marketOrders.length,
      days: days.length,
    },
    slots: sortedSlots,
    lines: sortedLines,
    byDay: series,
    byWeekday,
  }
}

/**
 * Janela de UM dia BRT — a ponte que faz `buildDaySales` ser uma chamada deste módulo.
 *
 * @param dateStr dia de entrega BRT no formato YYYY-MM-DD
 */
export function singleDayWindow(dateStr: string, now: Date = new Date()): DateWindow {
  return rangeWindow(dateStr, dateStr, now)
}
