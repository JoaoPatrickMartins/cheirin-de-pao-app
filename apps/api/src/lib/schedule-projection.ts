/**
 * schedule-projection.ts — projeção de pedidos AGENDADOS (Schedule) para uma data de entrega.
 *
 * "Previstos" = pães que a agenda semanal ativa prevê entregar na data, mas que AINDA NÃO
 * viraram Order (type=SCHEDULED) — ou seja, ainda não foram materializados pelo corte.
 * Espelha a lógica de materialização em schedules.service.ts (qty = days[slotId][dayKey]),
 * subtraindo o que já foi materializado para não contar em dobro.
 */
import type { PrismaClient } from '@prisma/client'
import { dayKeyOf, brtDayRange } from './cutoff.js'

type PerDay = Record<string, number>
type DaysMap = Record<string, PerDay>

export interface ProjectionResult {
  /** condominiumId -> { projectedBreads, projectedDeliveries } (apenas pendentes, breads > 0) */
  byCondo: Map<string, { projectedBreads: number; projectedDeliveries: number }>
  /** soma de pães previstos pendentes em todos os condomínios */
  total: number
}

/**
 * Projeta a agenda ativa para a data de entrega informada.
 * @param prisma client Prisma
 * @param deliveryDate qualquer Date que caia no dia BRT alvo (usar meio-dia BRT é seguro)
 */
export async function projectScheduleForDate(
  prisma: PrismaClient,
  deliveryDate: Date,
): Promise<ProjectionResult> {
  const weekday = dayKeyOf(deliveryDate)
  const { start, end } = brtDayRange(deliveryDate)

  const schedules = await prisma.schedule.findMany({
    where: { isActive: true },
    select: { condominiumId: true, days: true },
  })

  // Projeção bruta por condomínio (soma de todos os slots da agenda para o dia da semana)
  const projectedByCondo = new Map<string, { breads: number; deliveries: number }>()
  for (const s of schedules) {
    const days = (s.days as DaysMap | null) ?? {}
    let qty = 0
    for (const slotKey of Object.keys(days)) {
      const perDay = days[slotKey]
      if (perDay && typeof perDay === 'object') qty += Number(perDay[weekday] ?? 0)
    }
    if (qty <= 0) continue
    const cur = projectedByCondo.get(s.condominiumId) ?? { breads: 0, deliveries: 0 }
    cur.breads += qty
    cur.deliveries += 1
    projectedByCondo.set(s.condominiumId, cur)
  }

  if (projectedByCondo.size === 0) return { byCondo: new Map(), total: 0 }

  // Já materializado da AGENDA (type=SCHEDULED) na data — para descontar o pendente
  const matOrders = await prisma.order.findMany({
    where: {
      type: 'SCHEDULED',
      status: { not: 'CANCELLED' },
      scheduledDate: { gte: start, lte: end },
    },
    select: { condominiumId: true, quantity: true },
  })
  const matByCondo = new Map<string, number>()
  for (const o of matOrders) {
    if (!o.condominiumId) continue
    matByCondo.set(o.condominiumId, (matByCondo.get(o.condominiumId) ?? 0) + o.quantity)
  }

  const byCondo = new Map<string, { projectedBreads: number; projectedDeliveries: number }>()
  let total = 0
  for (const [condoId, proj] of projectedByCondo) {
    const mat = matByCondo.get(condoId) ?? 0
    const pending = Math.max(0, proj.breads - mat)
    if (pending <= 0) continue
    byCondo.set(condoId, { projectedBreads: pending, projectedDeliveries: proj.deliveries })
    total += pending
  }
  return { byCondo, total }
}

/**
 * countCommittedDeliveries — nº de ENTREGAS (Orders) comprometidas para uma data de entrega.
 *
 * Unidade = 1 entrega por Order (um cliente pode ter várias entregas no dia: 1 por slot/avulso).
 * Soma:
 *   - materializadas: Orders não-CANCELLED na janela do dia (SINGLE + SCHEDULED);
 *   - previstas pendentes: linhas da agenda ativa que ainda não viraram Order (projeção já
 *     desconta o que foi materializado por usuário+slot — não conta em dobro).
 *
 * `opts.excludeUserId` remove as entregas (materializadas e previstas) de um usuário — usado
 * ao salvar a agenda, para que o cliente não concorra contra a própria reserva já existente.
 *
 * @param deliveryDate qualquer Date que caia no dia BRT alvo (meio-dia BRT é seguro)
 */
export async function countCommittedDeliveries(
  prisma: PrismaClient,
  deliveryDate: Date,
  opts: { excludeUserId?: string } = {},
): Promise<number> {
  const { start, end } = brtDayRange(deliveryDate)

  const matWhere = {
    status: { not: 'CANCELLED' as const },
    scheduledDate: { gte: start, lte: end },
    ...(opts.excludeUserId ? { userId: { not: opts.excludeUserId } } : {}),
  }
  const matCount = await prisma.order.count({ where: matWhere })

  const projected = await projectScheduleDetailForDate(prisma, deliveryDate)
  const projectedCount = opts.excludeUserId
    ? projected.filter((r) => r.userId !== opts.excludeUserId).length
    : projected.length

  return matCount + projectedCount
}

/** Uma linha de projeção pendente: o que a agenda de um usuário prevê para um slot, ainda não materializado. */
export interface ProjectedRow {
  userId: string
  condominiumId: string
  slotId: string
  /** pães previstos pendentes (já descontado o que foi materializado para este usuário+slot) */
  quantity: number
}

/**
 * projectScheduleDetailForDate — versão detalhada (por usuário e por slot) da projeção da agenda.
 *
 * Diferente de projectScheduleForDate (que agrega por condomínio), retorna uma linha por
 * (usuário, condomínio, slot) com a quantidade pendente — descontando o que já foi materializado
 * para AQUELE usuário e AQUELE slot (granularidade fina: manhã pode estar materializada e tarde não).
 *
 * @param prisma client Prisma
 * @param deliveryDate qualquer Date que caia no dia BRT alvo (usar meio-dia BRT é seguro)
 */
export async function projectScheduleDetailForDate(
  prisma: PrismaClient,
  deliveryDate: Date,
): Promise<ProjectedRow[]> {
  const weekday = dayKeyOf(deliveryDate)
  const { start, end } = brtDayRange(deliveryDate)

  const schedules = await prisma.schedule.findMany({
    where: { isActive: true },
    select: { userId: true, condominiumId: true, days: true },
  })
  if (schedules.length === 0) return []

  // Já materializado da AGENDA (type=SCHEDULED) na data — para descontar por usuário+slot
  const matOrders = await prisma.order.findMany({
    where: {
      type: 'SCHEDULED',
      status: { not: 'CANCELLED' },
      scheduledDate: { gte: start, lte: end },
    },
    select: { userId: true, slotId: true, quantity: true },
  })
  const matByUserSlot = new Map<string, number>()
  for (const o of matOrders) {
    const key = `${o.userId}|${o.slotId ?? ''}`
    matByUserSlot.set(key, (matByUserSlot.get(key) ?? 0) + o.quantity)
  }

  const rows: ProjectedRow[] = []
  for (const s of schedules) {
    const days = (s.days as DaysMap | null) ?? {}
    for (const slotKey of Object.keys(days)) {
      const perDay = days[slotKey]
      if (!perDay || typeof perDay !== 'object') continue
      const qty = Number(perDay[weekday] ?? 0)
      if (qty <= 0) continue
      const mat = matByUserSlot.get(`${s.userId}|${slotKey}`) ?? 0
      const pending = Math.max(0, qty - mat)
      if (pending <= 0) continue
      rows.push({ userId: s.userId, condominiumId: s.condominiumId, slotId: slotKey, quantity: pending })
    }
  }
  return rows
}
