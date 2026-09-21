/**
 * day-sales.ts — o que foi VENDIDO para um dia de entrega, agregado no geral.
 *
 * Irmão de `product-demand.ts`, com o recorte trocado: aquele responde "o que eu preciso
 * comprar" (por TURNO, só quantidade, porque o fornecedor não quer saber de preço de venda);
 * este responde "o que eu já vendi para este dia até agora" (o DIA inteiro, com R$), que é o
 * relatório que o admin abre a partir da tela do dia na aba Pedidos.
 *
 * "Geral, não por condomínio" é a decisão central: as telas de compra e separação já quebram
 * tudo por condomínio, e nenhuma responde "quantos bolos saíram hoje". Aqui o condomínio só
 * aparece como contagem.
 *
 * Duas fontes, as MESMAS da compra — para o total de pães reconciliar com o card do dia:
 *   1. `Order`       — pedidos de pão não cancelados (avulso ou agenda).
 *   2. `MarketOrder` — Cestinhas confirmadas: `breadQty` é PÃO (D-1) e soma nos contadores de
 *      pão; `items[]` são os produtos, contados e valorizados em paralelo.
 *
 * Fora de propósito:
 *   - Previstos da agenda: não foram vendidos, ninguém pagou. (A compra os mostra como contexto;
 *     um relatório de vendas que os somasse estaria inventando receita.)
 *   - Cestinha `PENDING_PAYMENT`: o dinheiro não entrou e o sweep do cron pode cancelar.
 *     Mesmo conjunto de status do `bread-demand`/Separação, então os números reconciliam.
 *
 * VENDIDO ≠ ENTREGUE: `NOT_DELIVERED` continua aqui — foi vendido e cobrado; o que aconteceu com
 * a mercadoria é assunto do desfecho de perda (`lossResolvedAt`), não deste relatório.
 *
 * Duas diferenças DELIBERADAS em relação a `upcoming-days`, que consulta turno a turno e por isso
 * enxerga só o que tem `slotId` conhecido e `condominiumId` preenchido: aqui o relatório é
 * COMPLETO e inclui os dois casos, agrupando o que não tem turno num balde "Sem turno". É o único
 * ponto em que o total daqui pode passar do número do card do dia — e é intencional: um pedido
 * órfão de turno existe, foi pago, e sumir dele no relatório é pior do que a divergência.
 */
import type { PrismaClient } from '@prisma/client'
import { brtDayRange, brtNoonFromStr } from './cutoff.js'
import { CONFIRMED_MARKET_STATUSES } from './bread-demand.js'
import { getGlobalDeliverySlots } from './delivery-slots.js'

const AVULSO_UNIT_KEY = 'avulsoUnit'
const BREAD_PRODUCT_KEY = 'breadProductId'

/** Id sintético da linha do pão quando `Setting.breadProductId` não está configurado. */
export const BREAD_LINE_FALLBACK_ID = '__bread__'

/** Balde dos pedidos sem turno — existe só quando há algum. */
const NO_SLOT_ID = ''
const NO_SLOT_LABEL = 'Sem turno'

const DEFAULT_SLOT_LABELS: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde' }

function fallbackSlotLabel(slotId: string): string {
  if (!slotId) return NO_SLOT_LABEL
  return DEFAULT_SLOT_LABELS[slotId] ?? slotId.charAt(0).toUpperCase() + slotId.slice(1)
}

/** Arredonda R$ para 2 casas — soma de float precisa fechar com o que a tela mostra. */
function money(value: number): number {
  return Math.round(value * 100) / 100
}

/** Quanto de um produto saiu num turno. */
export interface DaySalesSlotQty {
  slotId: string
  label: string
  qty: number
}

/** Uma linha do relatório: um produto, com o quanto e o quanto rendeu. */
export interface DaySalesLine {
  productId: string
  name: string
  /** A linha do pão — some as duas origens (pedido de pão + Cestinha) e vem sempre primeiro. */
  isBread: boolean
  qty: number
  /** R$ vendidos na linha. */
  revenue: number
  /**
   * Preço unitário MÉDIO (revenue / qty), não o preço de tabela: promoção e mudança de preço
   * fazem o mesmo produto sair por valores diferentes no mesmo dia.
   */
  avgUnitPrice: number
  bySlot: DaySalesSlotQty[]
}

/** O relatório de um dia. */
export interface DaySales {
  /** Dia de entrega (YYYY-MM-DD, BRT). */
  date: string
  /** Instante da apuração — o "até o momento" do título. Vendas continuam entrando até o corte. */
  generatedAt: string
  breads: {
    /** Pães vendidos = `single + scheduled + fromMarket + fromItems`. */
    total: number
    single: number
    scheduled: number
    fromMarket: number
    /** Pão que veio como item de Cestinha — sempre 0 no fluxo normal (ver o cabeçalho). */
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
  /** Como a Cestinha foi paga — o recorte que de fato virou caixa no dia. */
  cash: { money: number; creditsMilli: number }
  counts: {
    /** Paradas `(cliente, turno)` — pão + Cestinha do mesmo cliente/turno = 1 (D-5). */
    stops: number
    clients: number
    condominiums: number
    breadOrders: number
    marketOrders: number
  }
  slots: Array<{ slotId: string; label: string; breads: number; items: number; revenue: number }>
  /** Pão primeiro; depois os produtos por receita decrescente (desempate por nome). */
  lines: DaySalesLine[]
}

/** Acumulador interno de uma linha. */
interface LineAcc extends Omit<DaySalesLine, 'bySlot' | 'avgUnitPrice'> {
  bySlot: Map<string, number>
}

/** Acumulador interno de um turno. */
interface SlotAcc {
  slotId: string
  label: string
  breads: number
  items: number
  revenue: number
}

/**
 * buildDaySales — o relatório de vendas de um dia de entrega, geral.
 *
 * Uma passada por coleção no dia inteiro. `getUpcomingDays` consulta turno a turno porque
 * precisa do estado de cada corte; aqui não precisamos, e N+1 consultas por um total do dia
 * seria caro à toa.
 *
 * @param dateStr dia de entrega BRT no formato YYYY-MM-DD
 * @param now instante da apuração (injetável para teste)
 */
export async function buildDaySales(
  prisma: PrismaClient,
  dateStr: string,
  now: Date = new Date(),
): Promise<DaySales> {
  const { start, end } = brtDayRange(brtNoonFromStr(dateStr))

  const [orders, marketOrders, avulsoRow, breadRow, slotConfig] = await Promise.all([
    prisma.order.findMany({
      where: { scheduledDate: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
      select: { userId: true, quantity: true, type: true, slotId: true, condominiumId: true },
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
  const stopKeys = new Set<string>()
  const clientIds = new Set<string>()
  const condoIds = new Set<string>()

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

  /** Registra a parada `(cliente, turno)` — pão e Cestinha do mesmo cliente/turno são UMA (D-5). */
  const trackStop = (userId: string, slotId: string, condominiumId: string | null) => {
    stopKeys.add(`${userId}|${slotId}`)
    clientIds.add(userId)
    if (condominiumId) condoIds.add(condominiumId)
  }

  let breadSingle = 0
  let breadScheduled = 0
  let breadFromMarket = 0
  /** Pão que chegou como ITEM de Cestinha — caminho que o checkout não produz (ver o laço 2). */
  let breadFromItems = 0
  let cashMoney = 0
  let cashCreditsMilli = 0

  // ── 1. Pedidos de pão ────────────────────────────────────────────────────
  for (const o of orders) {
    const slotId = o.slotId ?? NO_SLOT_ID
    trackStop(o.userId, slotId, o.condominiumId)
    if (o.type === 'SCHEDULED') breadScheduled += o.quantity
    else breadSingle += o.quantity
    ensureSlot(slotId).breads += o.quantity
  }

  // ── 2. Cestinhas confirmadas ─────────────────────────────────────────────
  for (const mo of marketOrders) {
    const slotId = mo.slotId ?? NO_SLOT_ID
    trackStop(mo.userId, slotId, mo.condominiumId)
    breadFromMarket += mo.breadQty
    ensureSlot(slotId).breads += mo.breadQty
    cashMoney += mo.moneyAmount
    cashCreditsMilli += mo.creditsAppliedMilli ?? 0

    for (const it of mo.items) {
      // O checkout separa o pão em `breadQty`, então ele NÃO chega como item. Se chegasse, vira
      // pão junto com o resto (e vale o preço do avulso, como todo pão) em vez de abrir uma linha
      // duplicada — mesma defesa de `buildProductDemand`. Contar aqui e de novo na linha do pão
      // é o erro que este desvio evita.
      if (breadProductId != null && it.productId === breadProductId) {
        breadFromItems += it.qty
        ensureSlot(slotId).breads += it.qty
        continue
      }
      const line = ensureLine(it.productId, it.name, false)
      line.qty += it.qty
      line.revenue += it.qty * it.unitPrice
      line.bySlot.set(slotId, (line.bySlot.get(slotId) ?? 0) + it.qty)

      const slot = ensureSlot(slotId)
      slot.revenue += it.qty * it.unitPrice
      slot.items += it.qty
    }
  }

  // ── 3. Linha do pão ──────────────────────────────────────────────────────
  // Os pães de `Order` e de `MarketOrder.breadQty` viram UMA linha, valorizada ao preço do avulso.
  const breadTotal = breadSingle + breadScheduled + breadFromMarket + breadFromItems
  if (breadTotal > 0) {
    const line = ensureLine(breadLineId, 'Pão Francês', true)
    line.qty = breadTotal
    line.revenue = breadTotal * unitPrice
    for (const [slotId, acc] of slots) {
      if (acc.breads > 0) line.bySlot.set(slotId, acc.breads)
    }
    // Nome real do produto-pão; o snapshot acima é só um fallback legível.
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
  const itemsTotal = [...lines.values()]
    .filter((l) => !l.isBread)
    .reduce((s, l) => s + l.qty, 0)
  const itemsRevenue = [...lines.values()]
    .filter((l) => !l.isBread)
    .reduce((s, l) => s + l.revenue, 0)
  const breadRevenue = money(breadTotal * unitPrice)

  const slotOrder = new Map(slotConfig.map((s, i) => [s.slotId, i]))
  const sortedSlots = [...slots.values()].sort(
    (a, b) => (slotOrder.get(a.slotId) ?? 99) - (slotOrder.get(b.slotId) ?? 99),
  )

  const sortedLines: DaySalesLine[] = [...lines.values()]
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

  return {
    date: dateStr,
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
    },
    slots: sortedSlots,
    lines: sortedLines,
  }
}
