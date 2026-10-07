import type { PrismaClient } from '@prisma/client'
import { offReasonFor, type OffReason } from '@cheirin-de-pao/shared'

/**
 * Quem está fora num dia/turno (F-8): folga cadastrada (`CourierTimeOff`) ou fora da escala
 * (`courierAvailability`). A divisão de entregas não sugere essas pessoas.
 */
export async function courierOffMap(
  prisma: Pick<PrismaClient, 'user' | 'courierTimeOff'>,
  courierIds: string[],
  date: string,
  slotId?: string,
): Promise<Map<string, OffReason>> {
  const out = new Map<string, OffReason>()
  if (courierIds.length === 0) return out
  const [users, offs] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: courierIds } }, select: { id: true, courierAvailability: true } }),
    prisma.courierTimeOff.findMany({
      where: { courierId: { in: courierIds }, startDate: { lte: date }, endDate: { gte: date } },
      select: { courierId: true, startDate: true, endDate: true },
    }),
  ])
  for (const u of users) {
    const availability = (u.courierAvailability ?? null) as { dias?: string[]; turnos?: string[] } | null
    const reason = offReasonFor(availability, offs.filter((o) => o.courierId === u.id), date, slotId)
    if (reason) out.set(u.id, reason)
  }
  return out
}
