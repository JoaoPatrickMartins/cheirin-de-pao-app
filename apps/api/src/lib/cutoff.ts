/**
 * cutoff.ts — utilitários de horário de corte e datas em BRT (UTC-3).
 *
 * Regra A (dia de entrega de um slot): ao disparar o corte no `cutoffTime`, a entrega é
 * HOJE quando o horário do slot ainda está à frente (slotTime > cutoffTime), senão é AMANHÃ.
 *   - manhã 06:30 / corte 22:00 → 06:30 não é > 22:00 → entrega amanhã
 *   - tarde 15:30 / corte 10:00 → 15:30 > 10:00 → entrega hoje
 *
 * Comparação de horários usa string "HH:MM" zero-padded (lexicográfica == cronológica).
 */

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000

export type DayKey = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom'

// getUTCDay(): 0=Dom ... 6=Sáb
const WEEKDAY_KEYS: DayKey[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']

/** Hora atual em BRT no formato "HH:MM" (24h). */
export function nowHHMM(now: Date = new Date()): string {
  const brt = new Date(now.getTime() - BRT_OFFSET_MS)
  const hh = String(brt.getUTCHours()).padStart(2, '0')
  const mm = String(brt.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

/** Componentes ano/mês(0-based)/dia da data BRT de `now`. */
function brtYMD(now: Date): { y: number; m: number; d: number } {
  const brt = new Date(now.getTime() - BRT_OFFSET_MS)
  return { y: brt.getUTCFullYear(), m: brt.getUTCMonth(), d: brt.getUTCDate() }
}

/** Date (UTC) ao meio-dia BRT do dia BRT informado (+offsetDays). 12:00 BRT = 15:00 UTC. */
function brtNoon(y: number, m: number, d: number, offsetDays = 0): Date {
  return new Date(Date.UTC(y, m, d + offsetDays, 15, 0, 0, 0))
}

/** Chave do dia da semana (BRT) de uma Date. */
export function dayKeyOf(date: Date): DayKey {
  const brt = new Date(date.getTime() - BRT_OFFSET_MS)
  return WEEKDAY_KEYS[brt.getUTCDay()]
}

/**
 * Regra A — data de entrega alvo ao criar a order no corte de um slot.
 * HOJE se slotTime > cutoffTime (entrega ainda à frente hoje), senão AMANHÃ.
 * Retorna meio-dia BRT do dia alvo (cai com folga dentro da janela do dia nas queries).
 */
export function targetDeliveryDate(slotTime: string, cutoffTime: string, now: Date = new Date()): Date {
  const { y, m, d } = brtYMD(now)
  const sameDay = slotTime > cutoffTime
  return brtNoon(y, m, d, sameDay ? 0 : 1)
}

/** Data BRT como "YYYY-MM-DD" (com deslocamento opcional de dias). */
export function brtDateStr(now: Date = new Date(), addDays = 0): string {
  const base = new Date(now.getTime() - BRT_OFFSET_MS)
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + addDays))
  return d.toISOString().slice(0, 10)
}

/** Date (UTC) ao meio-dia BRT do dia informado em "YYYY-MM-DD" (cai dentro da janela do dia). */
export function brtNoonFromStr(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 15, 0, 0, 0))
}

/** Início/fim (UTC) da janela do dia BRT em que `date` cai. */
export function brtDayRange(date: Date): { start: Date; end: Date } {
  const { y, m, d } = brtYMD(date)
  // meia-noite BRT = 03:00 UTC do mesmo dia; fim = 02:59:59.999 UTC do dia seguinte
  const start = new Date(Date.UTC(y, m, d, 3, 0, 0, 0))
  const end = new Date(Date.UTC(y, m, d + 1, 2, 59, 59, 999))
  return { start, end }
}

/**
 * Para o avulso: o corte que governa a entrega na data `deliveryDateStr` (YYYY-MM-DD, dia BRT)
 * já passou em `now`? O corte ocorre no mesmo dia da entrega se slotTime > cutoffTime, senão na véspera.
 */
export function isPastCutoffForDelivery(
  slotTime: string,
  cutoffTime: string,
  deliveryDateStr: string,
  now: Date = new Date(),
): boolean {
  const [y, mo, d] = deliveryDateStr.slice(0, 10).split('-').map(Number)
  const [ch, cm] = cutoffTime.split(':').map(Number)
  const sameDay = slotTime > cutoffTime
  const cutoffDayOffset = sameDay ? 0 : -1
  // BRT → UTC: soma 3h
  const cutoffUTC = Date.UTC(y, mo - 1, d + cutoffDayOffset, ch + 3, cm, 0, 0)
  return now.getTime() >= cutoffUTC
}

/** Para o banner: o corte do slot para o ciclo atual já passou? (HH:MM BRT atual >= cutoffTime). */
export function isSlotCutoffPast(cutoffTime: string, now: Date = new Date()): boolean {
  return nowHHMM(now) >= cutoffTime
}

/**
 * Data "YYYY-MM-DD" (BRT) da PRÓXIMA entrega de um slot: hoje se o horário ainda está
 * à frente agora, senão amanhã. Ex.: tarde 15:30 às 20:46 → amanhã; manhã 06:30 → amanhã.
 */
export function nextDeliveryDateStr(slotTime: string, now: Date = new Date()): string {
  return brtDateStr(now, slotTime > nowHHMM(now) ? 0 : 1)
}
