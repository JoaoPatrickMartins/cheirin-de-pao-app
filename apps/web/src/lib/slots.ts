// Helpers de turno (slot) para o pipeline por turno do admin.

export interface SlotOption {
  slotId: string
  label: string
  emoji?: string
  time: string
  cutoffTime: string
}

/** Rótulo do turno com emoji (ex.: "☀️ Manhã"); cai pro label puro se não houver emoji. */
export function slotTabLabel(s: { emoji?: string; label: string }): string {
  return s.emoji ? `${s.emoji} ${s.label}` : s.label
}

export function hhmmToMin(hhmm: string): number {
  const [h, m] = (hhmm ?? '').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/**
 * Turno padrão (automático pelo horário de corte): o slot cujo corte passou mais
 * recentemente em relação a `nowMin`; se nenhum passou ainda hoje, o último (corte da véspera).
 */
export function resolveDefaultSlot(slots: SlotOption[], nowMin: number): string {
  if (slots.length === 0) return ''
  const sorted = [...slots].sort((a, b) => hhmmToMin(a.cutoffTime) - hhmmToMin(b.cutoffTime))
  const passed = sorted.filter((s) => hhmmToMin(s.cutoffTime) <= nowMin)
  return (passed.length ? passed[passed.length - 1] : sorted[sorted.length - 1]).slotId
}

export function nowMinutesLocal(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}
