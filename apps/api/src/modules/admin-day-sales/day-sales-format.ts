// day-sales-format.ts — formatação compartilhada entre o PDF e o Excel do relatório do dia.
//
// Existe para os dois documentos não divergirem no primeiro ajuste de formato: um relatório que
// mostra "R$ 1.234,50" no PDF e "R$ 1234.5" na planilha parece dois relatórios diferentes.

const BRT = 'America/Sao_Paulo'

/** "R$ 1.234,50" */
export function formatBrl(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** "YYYY-MM-DD" → "sábado, 28 de junho de 2026" (BRT). */
export function formatDayLong(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00-03:00`)
  const full = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: BRT,
  }).format(d)
  return full.charAt(0).toUpperCase() + full.slice(1)
}

/** "YYYY-MM-DD" → "28/06/2026" (BRT). */
export function formatDayShort(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: BRT }).format(
    new Date(`${dateStr}T12:00:00-03:00`),
  )
}

/** ISO → "28/06/2026 14:32" (BRT) — o "até o momento" do relatório. */
export function formatApuradoEm(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: BRT,
  })
    .format(new Date(iso))
    .replace(', ', ' ')
}
