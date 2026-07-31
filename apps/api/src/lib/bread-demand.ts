/**
 * bread-demand.ts — fonte ÚNICA da demanda de pão de um (turno, dia de entrega).
 *
 * Antes deste módulo, todo o fluxo "Pedido ao fornecedor / Cortes / Dias em aberto" derivava de
 * `_buildDeliveryRows`, que lia apenas `Order`. O pão vendido DENTRO da Cestinha
 * (`MarketOrder.breadQty`) era cobrado do cliente e **nunca pedido ao fornecedor** — falta física
 * na fornada. Pior: um dia com Cestinha e sem pedido de pão não gerava `PurchaseOrder`, e o gate da
 * Separação (que exige PO finalizado) deixava a Cestinha presa em SCHEDULED para sempre.
 *
 * Três fontes, uma saída:
 *   1. `Order`         — pedidos de pão já materializados (avulso ou agenda). Confirmados/pagos.
 *   2. `MarketOrder`   — Cestinhas confirmadas: `breadQty` é PÃO (D-1) e entra em todo contador
 *                        de pães; `items[]` são produtos do mercadinho, contados em paralelo.
 *   3. Projeção        — o que a agenda ativa prevê e ainda não virou `Order`. NÃO confirmado.
 *
 * **D-5 — a parada é a unidade de entrega.** A saída é uma linha por PARADA `(userId, slotId)`:
 * um cliente com pedido de pão + Cestinha no mesmo turno recebe UMA visita, então conta como UMA
 * entrega. Os pães somam sempre. Sem isso, `deliveryCount` e a quebra por turno passariam a contar
 * 2 entregas onde há 1, desbalanceando a divisão entre entregadores.
 *
 * **D-1 — pão e item são coisas diferentes.** Os pães vivem em `bread*`; os produtos do mercadinho
 * em `marketItems`/`marketItemCount`. Nunca somar os dois num contador só (senão "18 pães" pode ser
 * 12 pães + 6 potes de geleia, e o admin compra 18 pães).
 *
 * O que é "confirmado" importa: só `breadConfirmed` entra no pedido ao fornecedor. `breadProjected`
 * é contexto — ainda depende de saldo/conta ativa para materializar no corte.
 */
import type { PrismaClient } from '@prisma/client'
import { brtDayRange } from './cutoff.js'
import { projectScheduleDetailForDate } from './schedule-projection.js'

/**
 * Cestinhas que já contam como demanda real. `PENDING_PAYMENT` fica FORA de propósito: o dinheiro
 * ainda não entrou e o sweep do cron pode cancelar o pedido (devolvendo estoque e crédito) —
 * pedir esse pão ao fornecedor seria comprar por um pedido que vai morrer. Mesmo conjunto usado
 * pelo board da Separação, para os números reconciliarem entre as telas.
 */
export const CONFIRMED_MARKET_STATUSES = [
  'SCHEDULED',
  'SEPARATED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'NOT_DELIVERED',
] as const

/** Um item do mercadinho agregado numa parada. */
export interface MarketItemLine {
  name: string
  qty: number
}

/**
 * Uma PARADA de entrega `(userId, slotId)` num dia, com a demanda de pão decomposta por origem.
 *
 * Invariantes:
 * - `breadConfirmed === breadSingle + breadScheduled + breadFromMarket`
 * - `breadFromOrder === breadSingle + breadScheduled`
 * - `hasConfirmed === (breadConfirmed > 0 || marketItemCount > 0)`
 */
export interface BreadDemandStop {
  userId: string
  condominiumId: string
  slotId: string
  /** Pães JÁ pagos — a base do pedido ao fornecedor. */
  breadConfirmed: number
  /** Pães previstos pela agenda, ainda não materializados (contexto, não entram na compra). */
  breadProjected: number
  /** Recorte de `breadConfirmed` que vem de pedidos de pão (`Order`). */
  breadFromOrder: number
  /** Recorte de `breadConfirmed` que vem da Cestinha (`MarketOrder.breadQty`). */
  breadFromMarket: number
  /** Pães confirmados de `Order` com `type: SINGLE` (avulso). */
  breadSingle: number
  /** Pães confirmados de `Order` com `type: SCHEDULED` (agenda). */
  breadScheduled: number
  /** Produtos do mercadinho desta parada (não-pão) — métrica paralela aos pães (D-1). */
  marketItems: MarketItemLine[]
  /** Soma das quantidades de `marketItems`. */
  marketItemCount: number
  /** IDs das Cestinhas da parada (um cliente pode ter várias no mesmo turno/dia). */
  marketOrderIds: string[]
  /** true quando há algo já pago nesta parada (pão confirmado ou Cestinha). */
  hasConfirmed: boolean
  /** De onde a parada nasceu — usado para exibição (chip 🧺 / "só-Cestinha"). */
  origin: 'bread' | 'market' | 'both'
}

/** Acumulador interno por parada. */
interface StopAcc extends BreadDemandStop {
  hasBreadSource: boolean
}

/**
 * buildBreadDemand — demanda de pão do turno para o dia, uma linha por parada.
 *
 * @param slotId turno (obrigatório — o pipeline é por turno)
 * @param deliveryDate qualquer Date que caia no dia BRT alvo (meio-dia BRT é seguro)
 * @param opts.condominiumId restringe a um condomínio (tela de detalhe)
 */
export async function buildBreadDemand(
  prisma: PrismaClient,
  slotId: string,
  deliveryDate: Date,
  opts: { condominiumId?: string } = {},
): Promise<BreadDemandStop[]> {
  const { start, end } = brtDayRange(deliveryDate)
  const condoFilter = opts.condominiumId

  const [orders, marketOrders, projectedAll] = await Promise.all([
    prisma.order.findMany({
      where: {
        scheduledDate: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
        slotId,
        condominiumId: condoFilter ?? { not: null },
      },
      select: { userId: true, quantity: true, type: true, condominiumId: true },
    }),
    prisma.marketOrder.findMany({
      where: {
        scheduledDate: { gte: start, lte: end },
        status: { in: [...CONFIRMED_MARKET_STATUSES] },
        slotId,
        ...(condoFilter ? { condominiumId: condoFilter } : {}),
      },
      select: {
        id: true,
        userId: true,
        condominiumId: true,
        breadQty: true,
        items: { select: { name: true, qty: true } },
      },
    }),
    projectScheduleDetailForDate(prisma, deliveryDate),
  ])

  const projected = projectedAll.filter(
    (p) => p.slotId === slotId && (!condoFilter || p.condominiumId === condoFilter),
  )

  // Uma parada por (cliente, condomínio) — o slot é fixo nesta chamada.
  const stops = new Map<string, StopAcc>()
  const ensure = (userId: string, condominiumId: string): StopAcc => {
    const key = `${userId}|${condominiumId}`
    let s = stops.get(key)
    if (!s) {
      s = {
        userId,
        condominiumId,
        slotId,
        breadConfirmed: 0,
        breadProjected: 0,
        breadFromOrder: 0,
        breadFromMarket: 0,
        breadSingle: 0,
        breadScheduled: 0,
        marketItems: [],
        marketItemCount: 0,
        marketOrderIds: [],
        hasConfirmed: false,
        origin: 'bread',
        hasBreadSource: false,
      }
      stops.set(key, s)
    }
    return s
  }

  // 1. Pedidos de pão materializados. Vários pedidos do mesmo cliente no mesmo turno (ex.: um
  //    avulso + um da agenda) são UMA parada — o entregador toca a campainha uma vez (D-5).
  for (const o of orders) {
    if (!o.condominiumId) continue
    const s = ensure(o.userId, o.condominiumId)
    s.breadConfirmed += o.quantity
    s.breadFromOrder += o.quantity
    if (o.type === 'SCHEDULED') s.breadScheduled += o.quantity
    else s.breadSingle += o.quantity
    s.hasBreadSource = true
  }

  // 2. Cestinhas confirmadas. `breadQty` é pão e soma nos contadores de pão (D-1); os produtos
  //    entram na métrica paralela. Um cliente pode ter VÁRIAS Cestinhas no mesmo turno/dia.
  for (const mo of marketOrders) {
    const s = ensure(mo.userId, mo.condominiumId)
    s.breadConfirmed += mo.breadQty
    s.breadFromMarket += mo.breadQty
    s.marketOrderIds.push(mo.id)
    for (const it of mo.items) {
      s.marketItems.push({ name: it.name, qty: it.qty })
      s.marketItemCount += it.qty
    }
  }

  // 3. Previstos da agenda (ainda não materializados). A projeção já desconta o que virou Order
  //    para aquele cliente+turno, então não há dupla contagem com o passo 1.
  for (const p of projected) {
    const s = ensure(p.userId, p.condominiumId)
    s.breadProjected += p.quantity
    s.hasBreadSource = true
  }

  return [...stops.values()].map(({ hasBreadSource, ...s }) => ({
    ...s,
    hasConfirmed: s.breadConfirmed > 0 || s.marketItemCount > 0,
    origin:
      hasBreadSource && s.marketOrderIds.length > 0
        ? 'both'
        : s.marketOrderIds.length > 0
          ? 'market'
          : 'bread',
  }))
}
