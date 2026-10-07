import type { PrismaClient } from '@prisma/client'
import { brtDateStr, brtDayRange } from './cutoff.js'
import { resolvedHookOnlyStops } from './hook-stops.js'

/**
 * Parada resolvida do entregador: pão + Cestinha do mesmo cliente/turno/dia = 1 (T-13, a mesma
 * unidade da operação). O pão decide o desfecho; sem pão, vale a Cestinha. A parada só de gancho
 * também conta (plano-gancho-sozinho-na-rota, D-10), sem pão.
 */
export type ResolvedStop = {
  courierId: string
  date: string
  userId: string
  slotId: string
  status: 'DELIVERED' | 'NOT_DELIVERED'
  breads: number
  hasBread: boolean
}

type Db = Pick<PrismaClient, 'order' | 'marketOrder' | 'deliveryProof'>

/** Paradas resolvidas (entregues ou não) de um ou mais entregadores entre dois dias BRT. */
export async function resolvedCourierStops(prisma: Db, courierIds: string | string[], fromDay: string, toDay: string): Promise<ResolvedStop[]> {
  const ids = Array.isArray(courierIds) ? courierIds : [courierIds]
  if (ids.length === 0) return []
  const courierId = ids.length === 1 ? ids[0] : { in: ids }
  const start = brtDayRange(new Date(`${fromDay}T15:00:00.000Z`)).start
  const end = brtDayRange(new Date(`${toDay}T15:00:00.000Z`)).end
  const statuses = ['DELIVERED', 'NOT_DELIVERED'] as const
  const [orders, markets, hooks] = await Promise.all([
    prisma.order.findMany({
      where: { courierId, scheduledDate: { gte: start, lte: end }, status: { in: [...statuses] } },
      select: { courierId: true, userId: true, slotId: true, scheduledDate: true, status: true, quantity: true },
    }),
    prisma.marketOrder.findMany({
      where: { courierId, scheduledDate: { gte: start, lte: end }, status: { in: [...statuses] } },
      select: { courierId: true, userId: true, slotId: true, scheduledDate: true, status: true, breadQty: true },
    }),
    resolvedHookOnlyStops(prisma, ids, fromDay, toDay),
  ])
  const map = new Map<string, ResolvedStop>()
  const put = (cid: string, date: string, userId: string, slotId: string, status: string, breads: number, bread: boolean) => {
    const key = `${cid}|${date}|${userId}|${slotId}`
    const s = map.get(key) ?? { courierId: cid, date, userId, slotId, status: status as ResolvedStop['status'], breads: 0, hasBread: false }
    if (bread && !s.hasBread) s.status = status as ResolvedStop['status']
    s.hasBread ||= bread
    if (status === 'DELIVERED') s.breads += breads
    map.set(key, s)
  }
  const fallback = ids.length === 1 ? ids[0] : ''
  for (const o of orders) put(o.courierId ?? fallback, brtDateStr(o.scheduledDate), o.userId, o.slotId ?? '', o.status, o.quantity, true)
  for (const m of markets) put(m.courierId ?? fallback, brtDateStr(m.scheduledDate), m.userId, m.slotId ?? '', m.status, m.breadQty, false)
  for (const h of hooks) put(h.courierId, h.date, h.userId, h.slotId, h.outcome, 0, false)
  return [...map.values()]
}
