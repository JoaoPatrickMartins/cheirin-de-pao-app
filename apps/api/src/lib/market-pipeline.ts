import type { PrismaClient } from '@prisma/client'
import { brtDayRange } from './cutoff.js'

/**
 * market-pipeline.ts — o `MarketOrder` "pega carona" na esteira do pão (§4.2 do plano
 * Além do Pãozin). Como não existe "lista", cada ponto da esteira do `Order` (separação,
 * divisão, transições de status) chama estes helpers para espelhar o mesmo movimento nos
 * `MarketOrder` do MESMO escopo (condomínio, dia de entrega BRT, slot / courier).
 *
 * Todos usam `updateMany` guardado pelo status atual → idempotentes e seguros a reexecução.
 * NÃO tratam CANCELLED: cancelar um pedido de pão não cancela a Cestinha (é compra separada,
 * com estorno próprio na Onda 6).
 */

type Prisma = PrismaClient
const PRE_DELIVERY = ['SCHEDULED', 'SEPARATED', 'OUT_FOR_DELIVERY'] as const

/** Separação concluída de um lote (condo, slot, dia): SCHEDULED → SEPARATED. */
export async function separateMarketOrders(
  prisma: Prisma,
  condominiumId: string,
  slotId: string,
  start: Date,
  end: Date,
): Promise<number> {
  if (!slotId) return 0
  const r = await prisma.marketOrder.updateMany({
    where: { condominiumId, slotId, scheduledDate: { gte: start, lte: end }, status: 'SCHEDULED' },
    data: { status: 'SEPARATED', separatedAt: new Date() },
  })
  return r.count
}

/**
 * Divisão/atribuição de entregador. A partir dos `Order` atribuídos a UM courier, deriva os
 * escopos (condo, slot, dia) e aplica o mesmo courier aos `MarketOrder`. `dispatch=true`
 * (aprovar divisão) também move SCHEDULED/SEPARATED → OUT_FOR_DELIVERY.
 *
 * Granularidade correta mesmo com slot DIVIDIDO entre vários entregadores:
 *  1. **Combinadas** — casa por `userId`: a Cestinha do cliente vai para o MESMO entregador do
 *     pedido de pão dele (preciso, sem last-write-wins entre couriers).
 *  2. **Só-market** — cliente SEM pedido de pão no slot: cai no entregador que processar primeiro
 *     (guard `courierId: null` evita sobrescrever). Excluímos quem tem pão no slot (de QUALQUER
 *     courier) para não roubar a Cestinha de uma parada combinada de outro entregador.
 */
export async function dispatchMarketForOrders(
  prisma: Prisma,
  orders: { userId: string; condominiumId: string | null; slotId: string | null; scheduledDate: Date }[],
  courierId: string,
  dispatch: boolean,
): Promise<number> {
  const data = dispatch ? { courierId, status: 'OUT_FOR_DELIVERY' as const } : { courierId }

  // Escopos distintos por (condo, slot, dia) + os clientes de pão deste courier em cada escopo.
  const scopes = new Map<
    string,
    { condominiumId: string; slotId: string; start: Date; end: Date; userIds: Set<string> }
  >()
  for (const o of orders) {
    if (!o.condominiumId || !o.slotId) continue
    const { start, end } = brtDayRange(o.scheduledDate)
    const key = `${o.condominiumId}|${o.slotId}|${start.getTime()}`
    let s = scopes.get(key)
    if (!s) {
      s = { condominiumId: o.condominiumId, slotId: o.slotId, start, end, userIds: new Set() }
      scopes.set(key, s)
    }
    s.userIds.add(o.userId)
  }

  let count = 0
  for (const s of scopes.values()) {
    const scopeWhere = {
      condominiumId: s.condominiumId,
      slotId: s.slotId,
      scheduledDate: { gte: s.start, lte: s.end },
    }

    // 1) Paradas combinadas: Cestinha do mesmo cliente → este courier.
    const r1 = await prisma.marketOrder.updateMany({
      where: { ...scopeWhere, userId: { in: [...s.userIds] }, status: { in: [...PRE_DELIVERY] } },
      data,
    })

    // 2) Paradas só-market: clientes SEM pedido de pão no slot (de qualquer courier), ainda sem
    //    entregador. Guard courierId:null → o 1º a processar leva; não rouba combinada alheia.
    const breadRows = await prisma.order.findMany({
      where: { ...scopeWhere, status: { not: 'CANCELLED' } },
      select: { userId: true },
    })
    const breadUserIds = [...new Set(breadRows.map((o) => o.userId))]
    const r2 = await prisma.marketOrder.updateMany({
      where: {
        ...scopeWhere,
        courierId: null,
        status: { in: [...PRE_DELIVERY] },
        ...(breadUserIds.length ? { userId: { notIn: breadUserIds } } : {}),
      },
      data,
    })

    count += r1.count + r2.count
  }
  return count
}

/** Escopo por condomínio + dia (usado no assignCourier por condominiumId+date). */
export async function assignMarketByCondoDay(
  prisma: Prisma,
  condominiumId: string,
  start: Date,
  end: Date,
  courierId: string,
): Promise<number> {
  const r = await prisma.marketOrder.updateMany({
    where: {
      condominiumId,
      scheduledDate: { gte: start, lte: end },
      status: { in: ['SEPARATED', 'OUT_FOR_DELIVERY'] },
    },
    data: { courierId },
  })
  return r.count
}

/**
 * Espelha a transição de status de um `Order` nos `MarketOrder` do MESMO cliente/dia/slot.
 * Chamado pelo `updateOrderStatus` (cobre toggle de separação + confirm/fail do entregador
 * numa parada combinada pão+Cestinha). Escopo por userId — o pedido de pão é de um cliente,
 * e a Cestinha dele no mesmo slot deve acompanhar.
 */
export async function propagateMarketStatusForOrder(
  prisma: Prisma,
  order: { userId: string; condominiumId: string | null; slotId: string | null; scheduledDate: Date },
  newStatus: string,
  reason?: string,
): Promise<void> {
  if (!order.condominiumId || !order.slotId) return
  const { start, end } = brtDayRange(order.scheduledDate)
  const base = {
    userId: order.userId,
    condominiumId: order.condominiumId,
    slotId: order.slotId,
    scheduledDate: { gte: start, lte: end },
  }
  const now = new Date()

  switch (newStatus) {
    case 'SEPARATED':
      await prisma.marketOrder.updateMany({ where: { ...base, status: 'SCHEDULED' }, data: { status: 'SEPARATED', separatedAt: now } })
      break
    case 'SCHEDULED': // desfazer separação
      await prisma.marketOrder.updateMany({ where: { ...base, status: 'SEPARATED' }, data: { status: 'SCHEDULED', separatedAt: null } })
      break
    case 'OUT_FOR_DELIVERY':
      await prisma.marketOrder.updateMany({ where: { ...base, status: { in: ['SCHEDULED', 'SEPARATED'] } }, data: { status: 'OUT_FOR_DELIVERY' } })
      break
    case 'DELIVERED':
      await prisma.marketOrder.updateMany({ where: { ...base, status: { in: [...PRE_DELIVERY] } }, data: { status: 'DELIVERED', deliveredAt: now } })
      break
    case 'NOT_DELIVERED':
      await prisma.marketOrder.updateMany({ where: { ...base, status: { in: [...PRE_DELIVERY] } }, data: { status: 'NOT_DELIVERED', failedAt: now, failureReason: reason ?? null } })
      break
    // CANCELLED: intencionalmente não propaga (cancelar pão ≠ cancelar Cestinha).
  }
}
