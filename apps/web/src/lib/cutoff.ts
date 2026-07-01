/**
 * cutoff.ts (web) — espelha a regra de corte do backend (apps/api/src/lib/cutoff.ts)
 * para o frontend decidir, por UX, quais slots ainda estão disponíveis para um pedido único.
 * A validação autoritativa continua no backend (createSingleOrder).
 *
 * Todos os cálculos usam UTC explicitamente, então o resultado independe do fuso do dispositivo.
 */

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000

/** Data BRT como "YYYY-MM-DD" (com deslocamento opcional de dias). */
export function brtDateStr(now: Date = new Date(), addDays = 0): string {
  const base = new Date(now.getTime() - BRT_OFFSET_MS)
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + addDays))
  return d.toISOString().slice(0, 10)
}

/**
 * Instante ABSOLUTO (UTC) do corte que governa a entrega em `deliveryDateStr` (YYYY-MM-DD, dia
 * BRT). O corte ocorre no mesmo dia da entrega se slotTime > cutoffTime, senão na véspera.
 * Espelha apps/api/src/lib/cutoff.ts → cutoffInstantForDelivery / _cutoffAtIso. Por ser absoluto,
 * é seguro comparar contra `now` para qualquer dia (não confunde a hora-do-dia com o dia certo).
 */
export function cutoffInstantForDelivery(
  slotTime: string,
  cutoffTime: string,
  deliveryDateStr: string,
): Date {
  const [y, mo, d] = deliveryDateStr.slice(0, 10).split('-').map(Number)
  const [ch, cm] = cutoffTime.split(':').map(Number)
  const sameDay = slotTime > cutoffTime
  const cutoffDayOffset = sameDay ? 0 : -1
  // BRT → UTC: soma 3h
  return new Date(Date.UTC(y, mo - 1, d + cutoffDayOffset, ch + 3, cm, 0, 0))
}

/**
 * O corte que governa a entrega na data `deliveryDateStr` (dia BRT) já passou em `now`?
 * O corte ocorre no mesmo dia da entrega se slotTime > cutoffTime, senão na véspera.
 */
export function isPastCutoffForDelivery(
  slotTime: string,
  cutoffTime: string,
  deliveryDateStr: string,
  now: Date = new Date(),
): boolean {
  return now.getTime() >= cutoffInstantForDelivery(slotTime, cutoffTime, deliveryDateStr).getTime()
}
