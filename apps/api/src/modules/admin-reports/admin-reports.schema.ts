import { z } from 'zod'

/**
 * ReportQuerySchema — querystring dos relatórios do admin.
 * period: 'day' | 'week' | 'month' (padrão: 'week')
 */
export const ReportQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month']).default('week'),
})

export type ReportQuery = z.infer<typeof ReportQuerySchema>
