import { z } from 'zod'

/**
 * Querystring dos relatórios do admin.
 *
 * Desde a onda Financeiro/DRE a validação mora em `lib/period-query.ts`, compartilhada com o
 * financeiro, o DRE e o painel — um só formato de período em todo o admin. Aqui fica apenas o
 * default histórico deste módulo ('week'), que é o que preserva o comportamento das 8 telas.
 *
 * `ReportQuerySchema` continua exportado para não quebrar importação existente.
 */
export { PeriodQuerySchema, specFromQuery, periodQuerystring } from '../../lib/period-query.js'
export type { PeriodQuery } from '../../lib/period-query.js'

/** Default de período deste módulo. */
export const REPORTS_DEFAULT_PERIOD = 'week' as const

/**
 * Schema legado — mantido porque havia importação direta dele. Código novo deve usar
 * `PeriodQuerySchema`, que também aceita `month` e `from`/`to`.
 */
export const ReportQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month']).default('week'),
})

export type ReportQuery = z.infer<typeof ReportQuerySchema>
