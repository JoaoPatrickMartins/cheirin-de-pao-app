import type { MarketOrderStatus, OrderStatus, PrismaClient } from '@prisma/client'
import { brtDayRange, brtNoonFromStr } from './cutoff.js'

/**
 * Parada SÓ de gancho (plano-gancho-sozinho-na-rota, D-8): o gancho está na fila (`REQUESTED`), na
 * rota de hoje de um entregador (`routeDate` + `routeCourierId`), e o cliente NÃO tem pão nem
 * Cestinha naquele dia e turno. Com pedido — mesmo ainda não despachado — o gancho pega carona na
 * parada do pão (o selo `hookToDeliver`) e a divisão decide quem leva (D-7).
 *
 * O desfecho fica no `DeliveryProof` com `hookRequestId`: é o registro de quem fez a parada, em que
 * turno e com que resultado (o gancho que volta para a fila perde `routeCourierId`).
 */

type Db = Pick<PrismaClient, 'hookRequest' | 'order' | 'marketOrder'>

/** Pedido que existe de verdade no turno (cancelado e Cestinha não paga não contam). */
const DEAD_ORDER: OrderStatus[] = ['CANCELLED']
const DEAD_MARKET: MarketOrderStatus[] = ['CANCELLED', 'PENDING_PAYMENT']

export interface PendingHookStop {
  hookId: string
  userId: string
  slotId: string
  courierId: string
}

export interface ResolvedHookStop {
  hookId: string
  courierId: string
  userId: string
  condominiumId: string
  slotId: string
  date: string
  outcome: 'DELIVERED' | 'NOT_DELIVERED'
  /** Status do comprovante (foto). */
  proofStatus: string
  at: Date
}

/** Clientes com pão ou Cestinha no dia, como `userId|slotId`. */
async function breadKeys(prisma: Db, userIds: string[], date: string): Promise<Set<string>> {
  if (userIds.length === 0) return new Set()
  const { start, end } = brtDayRange(brtNoonFromStr(date))
  const scheduledDate = { gte: start, lte: end }
  const [orders, markets] = await Promise.all([
    prisma.order.findMany({ where: { userId: { in: userIds }, scheduledDate, status: { notIn: DEAD_ORDER } }, select: { userId: true, slotId: true } }),
    prisma.marketOrder.findMany({ where: { userId: { in: userIds }, scheduledDate, status: { notIn: DEAD_MARKET } }, select: { userId: true, slotId: true } }),
  ])
  return new Set([...orders, ...markets].map((r) => `${r.userId}|${r.slotId ?? ''}`))
}

/**
 * Paradas só de gancho ainda pendentes no dia (e no turno, quando informado). Sem `courierIds`,
 * de todos os entregadores (mapa ao vivo do admin).
 */
export async function pendingHookOnlyStops(
  prisma: Db,
  input: { courierIds?: string[]; date: string; slotId?: string },
): Promise<PendingHookStop[]> {
  if (input.courierIds?.length === 0) return []
  const hooks = await prisma.hookRequest.findMany({
    where: {
      status: 'REQUESTED',
      routeDate: input.date,
      ...(input.courierIds ? { routeCourierId: { in: input.courierIds } } : {}),
      ...(input.slotId !== undefined ? { routeSlotId: input.slotId } : {}),
    },
    select: { id: true, userId: true, routeSlotId: true, routeCourierId: true },
  })
  // Sem entregador (o que leva com o pão perde o entregador quando o turno é recusado) não é parada de ninguém.
  const assigned = hooks.filter((h): h is typeof h & { routeCourierId: string } => !!h.routeCourierId)
  if (assigned.length === 0) return []
  const withBread = await breadKeys(prisma, [...new Set(assigned.map((h) => h.userId))], input.date)
  return assigned
    .filter((h) => !withBread.has(`${h.userId}|${h.routeSlotId ?? ''}`))
    .map((h) => ({ hookId: h.id, userId: h.userId, slotId: h.routeSlotId ?? '', courierId: h.routeCourierId }))
}

/** O gancho na rota de hoje é uma parada própria (o cliente não tem pão nem Cestinha no turno)? */
export async function isHookOnly(prisma: Db, hook: { userId: string; routeDate: string; routeSlotId: string | null }): Promise<boolean> {
  const withBread = await breadKeys(prisma, [hook.userId], hook.routeDate)
  return !withBread.has(`${hook.userId}|${hook.routeSlotId ?? ''}`)
}

/**
 * Paradas só de gancho já resolvidas (entregues ou não) entre dois dias BRT. `courierIds` nulo =
 * de todos os entregadores.
 */
export async function resolvedHookOnlyStops(
  prisma: Pick<PrismaClient, 'deliveryProof'>,
  courierIds: string[] | null,
  fromDay: string,
  toDay: string,
  slotId?: string,
): Promise<ResolvedHookStop[]> {
  if (courierIds?.length === 0) return []
  const rows = await prisma.deliveryProof.findMany({
    where: {
      ...(courierIds ? { courierId: { in: courierIds } } : {}),
      date: { gte: fromDay, lte: toDay },
      hookRequestId: { not: null },
      ...(slotId !== undefined ? { slotId } : {}),
    },
    select: { hookRequestId: true, courierId: true, userId: true, condominiumId: true, slotId: true, date: true, outcome: true, status: true, createdAt: true },
  })
  return rows
    .filter((r): r is typeof r & { hookRequestId: string } => !!r.hookRequestId)
    .map((r) => ({
      hookId: r.hookRequestId,
      courierId: r.courierId,
      userId: r.userId,
      condominiumId: r.condominiumId,
      slotId: r.slotId,
      date: r.date,
      outcome: r.outcome === 'DELIVERED' ? 'DELIVERED' : 'NOT_DELIVERED',
      proofStatus: r.status,
      at: r.createdAt,
    }))
}
