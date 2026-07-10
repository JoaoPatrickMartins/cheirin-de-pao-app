import { z } from 'zod'

/**
 * FinancialQuerySchema — validação da querystring de GET /admin/financial
 *
 * period: dia, semana ou mês (padrão: 'day')
 * condominiumId: filtrar apenas pagamentos de clientes de um condomínio específico
 */
export const FinancialQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month']).default('day'),
  condominiumId: z.string().optional(),
})

export type FinancialQuery = z.infer<typeof FinancialQuerySchema>
