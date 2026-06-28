/**
 * date-range — cálculo de janela temporal (startDate/endDate) em UTC a partir de um
 * período, respeitando o fuso BRT (UTC-3). Fonte compartilhada entre relatórios.
 *
 * Extraído do padrão de AdminFinancialService.getDateRange (07-05).
 */
export type ReportPeriod = 'day' | 'week' | 'month'

/**
 * Calcula startDate e endDate em UTC com base no período e offset BRT (-3h).
 * - day:   início do dia BRT (00:00 BRT)
 * - week:  segunda-feira desta semana em BRT
 * - month: primeiro dia do mês em BRT
 * endDate é sempre "agora".
 */
export function getDateRange(period: ReportPeriod): { startDate: Date; endDate: Date } {
  const BRT_OFFSET = 3 * 60 * 60 * 1000

  const nowUtc = new Date()
  const nowBrt = new Date(nowUtc.getTime() - BRT_OFFSET)

  let startBrt: Date

  if (period === 'day') {
    startBrt = new Date(
      Date.UTC(nowBrt.getUTCFullYear(), nowBrt.getUTCMonth(), nowBrt.getUTCDate()),
    )
  } else if (period === 'week') {
    const dayOfWeek = nowBrt.getUTCDay() // 0=Dom, 1=Seg, ...
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    startBrt = new Date(
      Date.UTC(nowBrt.getUTCFullYear(), nowBrt.getUTCMonth(), nowBrt.getUTCDate() - daysFromMonday),
    )
  } else {
    startBrt = new Date(Date.UTC(nowBrt.getUTCFullYear(), nowBrt.getUTCMonth(), 1))
  }

  // startBrt está em UTC mas representa a hora BRT; somamos o offset p/ obter o UTC real.
  const startDate = new Date(startBrt.getTime() + BRT_OFFSET)
  const endDate = nowUtc

  return { startDate, endDate }
}
