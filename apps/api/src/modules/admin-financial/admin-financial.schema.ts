import { PeriodQuerySchema } from '../../lib/period-query.js'
import { ObjectIdSchema } from '@cheirin-de-pao/shared'

/**
 * FinancialQuerySchema — querystring de GET /admin/financial.
 *
 * Período: delegado a `lib/period-query.ts` (compartilhado com relatórios, DRE e painel), então a
 * rota passou a aceitar `?month=YYYY-MM` e `?from=&to=` além do `?period=` histórico.
 *
 * O default deste módulo continua 'day' (ver FINANCIAL_DEFAULT_PERIOD) — os relatórios nasceram
 * com 'week' e a tela de Financeiro com 'day'; manter cada um preserva quem já usa as telas.
 *
 * `condominiumId` é validado como ObjectId: antes era `z.string()` livre e um id malformado
 * chegava ao `$oid` do pipeline, onde o Mongo devolve erro de driver em vez de um 400 claro.
 */
export const FinancialQuerySchema = PeriodQuerySchema.safeExtend({
  condominiumId: ObjectIdSchema.optional(),
})

export type FinancialQuery = typeof FinancialQuerySchema._zod.output

/** Default de período deste módulo. */
export const FINANCIAL_DEFAULT_PERIOD = 'day' as const
