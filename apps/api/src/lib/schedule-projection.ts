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
