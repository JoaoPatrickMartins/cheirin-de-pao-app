/**
 * period-query — a querystring de período compartilhada por relatórios, financeiro e painel.
 *
 * **Retrocompatível de propósito:** `?period=day|week|month` continua valendo e continua sendo o
 * default, então as 8 telas de relatório já entregues seguem funcionando sem que nenhuma delas seja
 * tocada. `month` (mês de competência) e `from`/`to` (intervalo) são acréscimos.
 *
 * Precedência: `from`/`to` > `month` > `period` — a especificação mais específica ganha.
 *
 * Separado de `date-range.ts` para manter aquele módulo puro (só aritmética de calendário,
 * testável sem Zod e sem Fastify).
 */
import { z } from 'zod'
import {
  DATE_RE,
  MONTH_RE,
  type PeriodSpec,
  type ReportPeriod,
} from './date-range.js'

/**
 * Querystring de período.
 *
 * `compare` aceita boolean E string: as rotas declaram `querystring` em JSON Schema, e o Fastify
 * pode coagir `"true"` para `true` antes do Zod ver o valor. Aceitar as duas formas evita um 400
 * que dependeria de qual rota declarou o tipo.
 */
export const PeriodQuerySchema = z
  .object({
    period: z.enum(['day', 'week', 'month']).optional(),
    month: z
      .string()
      .regex(MONTH_RE, 'month deve estar no formato YYYY-MM')
      .optional(),
    from: z
      .string()
      .regex(DATE_RE, 'from deve estar no formato YYYY-MM-DD')
      .optional(),
    to: z
      .string()
      .regex(DATE_RE, 'to deve estar no formato YYYY-MM-DD')
      .optional(),
    compare: z
      .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
      .optional()
      .transform((v) => v === true || v === 'true' || v === '1'),
  })
  // Metade de um intervalo é erro de chamada, não um default silencioso: aceitar `from` sozinho
  // faria a rota devolver a semana corrente e o admin juraria ter filtrado.
  .refine((q) => (q.from == null) === (q.to == null), {
    message: 'from e to devem ser informados juntos',
  })

export type PeriodQuery = z.infer<typeof PeriodQuerySchema>

/**
 * Converte a querystring validada na especificação de janela.
 *
 * @param fallback preset usado quando nada foi informado. Difere por módulo — os relatórios
 *   nasceram com 'week' e o financeiro com 'day'; manter cada default é o que preserva a
 *   experiência de quem já usa as telas.
 */
export function specFromQuery(q: PeriodQuery, fallback: ReportPeriod = 'week'): PeriodSpec {
  if (q.from != null && q.to != null) return { kind: 'range', from: q.from, to: q.to }
  if (q.month != null) return { kind: 'month', month: q.month }
  return { kind: 'preset', period: q.period ?? fallback }
}

/**
 * Fragmento de `querystring` em JSON Schema para as rotas do Fastify.
 *
 * Existe para os oito relatórios + financeiro + painel não divergirem na documentação do Swagger —
 * o mesmo motivo de `day-sales-format.ts` existir para PDF e Excel.
 */
export const periodQuerystring = {
  type: 'object',
  properties: {
    period: {
      type: 'string',
      enum: ['day', 'week', 'month'],
      description:
        'Atalho: início do dia/semana/mês (BRT) até agora. Ignorado quando `month` ou `from`/`to` são informados.',
    },
    month: {
      type: 'string',
      description:
        'Mês de competência (YYYY-MM, BRT). Mês já encerrado devolve janela FECHADA — é o que o DRE precisa; mês em curso devolve janela parcial.',
    },
    from: {
      type: 'string',
      description: 'Início do intervalo (YYYY-MM-DD, BRT). Exige `to`.',
    },
    to: {
      type: 'string',
      description: 'Fim do intervalo (YYYY-MM-DD, BRT) — INCLUSIVO. Exige `from`.',
    },
    compare: {
      type: 'boolean',
      description:
        'Quando true, inclui `previous` com a janela anterior EQUIVALENTE (mês a mês no mesmo ponto de avanço; dia com o mesmo dia da semana).',
    },
  },
} as const
