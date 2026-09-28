/**
 * financial-alerts.ts — as REGRAS dos alertas financeiros (⭐C1 · escopo firmado).
 *
 * PURO: recebe números, devolve os alertas que devem disparar. Quem coleta do banco e dispara é
 * `financial-alerts.service.ts`.
 *
 * O encanamento de notificação já existia inteiro — push OneSignal, toggle por tipo em
 * `User.adminNotificationPrefs`, tela de preferências. O que faltava era o financeiro ter voz nele:
 * o dono só descobria um mês ruim abrindo o DRE por conta própria, e o DRE é a tela que ele menos
 * abre.
 *
 * ## Silêncio é o estado normal
 *
 * Todo limiar aqui é deliberadamente folgado, e a razão é comportamental, não técnica: um alerta
 * que dispara toda semana vira ruído e é desligado no toggle — e aí o canal inteiro se perde,
 * inclusive para o mês em que ele importava. Preferimos perder um aviso marginal a gastar a
 * atenção do dono.
 *
 * ## Nada dispara sobre número que ainda vai mudar
 *
 * Margem e resultado são medidos com o mês em curso contra o mês ANTERIOR COMPLETO só depois que
 * há avanço suficiente ({@link MIN_ELAPSED_FOR_TREND}). No dia 2 de um mês, qualquer comparação
 * acusa desastre — e estaria errada.
 */

/** Quanto do mês precisa ter passado para valer um alerta de tendência (margem, resultado, meta). */
export const MIN_ELAPSED_FOR_TREND = 0.25

/** Acima disto, o gasto da categoria é anomalia. Mesmo limiar da tela de relatório de despesas. */
export const ANOMALY_RATIO = 1.4

/** Queda de margem bruta, em PONTOS percentuais, que merece aviso. */
export const MARGIN_DROP_PP = 5

/** Quanto abaixo do ritmo da meta dispara o aviso (0.9 = atingiu menos de 90% do esperado). */
export const GOAL_PACE_FLOOR = 0.9

export type FinancialAlertType =
  | 'ADMIN_EXPENSE_DUE'
  | 'ADMIN_EXPENSE_ANOMALY'
  | 'ADMIN_MARGIN_DROP'
  | 'ADMIN_RESULT_NEGATIVE'
  | 'ADMIN_GOAL_AT_RISK'

export interface FinancialAlert {
  type: FinancialAlertType
  title: string
  body: string
  /**
   * Chave de DEDUPLICAÇÃO. Dois alertas com a mesma chave são o mesmo aviso, e o segundo não é
   * enviado dentro da janela de silêncio. É o que impede uma conta cronicamente atrasada de
   * notificar todo dia até o dono desligar o canal.
   */
  dedupeKey: string
}

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)

export interface AlertInputs {
  /** Mês corrente "YYYY-MM" (BRT) — entra nas chaves de dedupe. */
  month: string
  /** Fração do mês já decorrida (0..1). */
  elapsed: number

  /** Contas a pagar: vencendo amanhã e já vencidas. */
  dueTomorrow: { count: number; total: number }
  overdue: { count: number; total: number }

  /** Categorias com gasto no mês e a média dos meses anteriores. */
  categories: Array<{ categoryId: string; name: string; current: number; previousAvg: number }>

  /** Margem bruta (0..1) do mês em curso e do mês anterior completo. */
  grossMargin: { current: number; previous: number | null }

  /** Resultado do mês em curso (R$). */
  result: number

  /** Meta de receita do mês, quando existe. */
  goal: { target: number; actual: number } | null
}

/**
 * Os alertas que devem disparar agora. Lista vazia = está tudo bem, e nada é enviado.
 *
 * A ordem é a de urgência: dinheiro que vai sair primeiro, depois o que explica o mês.
 */
export function evaluateAlerts(input: AlertInputs): FinancialAlert[] {
  const out: FinancialAlert[] = []

  // ── Contas a pagar ────────────────────────────────────────────────────────
  // Um aviso por DIA, agregando tudo: três notificações separadas para três contas do mesmo dia
  // seria o caminho mais rápido para o toggle ser desligado.
  const due = input.dueTomorrow
  const late = input.overdue
  if (due.count > 0 || late.count > 0) {
    const parts: string[] = []
    if (late.count > 0) parts.push(`${late.count} vencida(s) — ${brl(late.total)}`)
    if (due.count > 0) parts.push(`${due.count} vence(m) amanhã — ${brl(due.total)}`)
    out.push({
      type: 'ADMIN_EXPENSE_DUE',
      title: late.count > 0 ? 'Conta vencida' : 'Conta vence amanhã',
      body: parts.join(' · '),
      // Uma vez por dia, não por conta.
      dedupeKey: 'expense-due',
    })
  }

  // ── Anomalia de categoria ─────────────────────────────────────────────────
  // Só com base de comparação: uma categoria estreada este mês não é "anomalia", é categoria nova.
  for (const c of input.categories) {
    if (!(c.previousAvg > 0)) continue
    if (c.current < c.previousAvg * ANOMALY_RATIO) continue
    const pct = Math.round((c.current / c.previousAvg - 1) * 100)
    out.push({
      type: 'ADMIN_EXPENSE_ANOMALY',
      title: `${c.name} acima do normal`,
      body: `${brl(c.current)} neste mês, ${pct}% acima da média de ${brl(c.previousAvg)}.`,
      // Uma vez por categoria por mês.
      dedupeKey: `anomaly:${input.month}:${c.categoryId}`,
    })
  }

  // Os três abaixo comparam o mês em curso e só valem depois de avanço suficiente.
  if (input.elapsed < MIN_ELAPSED_FOR_TREND) return out

  // ── Queda de margem ───────────────────────────────────────────────────────
  const { current, previous } = input.grossMargin
  if (previous != null && previous > 0) {
    const dropPp = (previous - current) * 100
    // A tolerância não é preciosismo: `(0.6 − 0.55) × 100` dá 4.999999999999993 em ponto
    // flutuante, e sem ela uma queda de exatamente 5 p.p. — o limiar — passaria calada.
    if (dropPp >= MARGIN_DROP_PP - 1e-9) {
      out.push({
        type: 'ADMIN_MARGIN_DROP',
        title: 'Margem bruta em queda',
        body: `${(current * 100).toFixed(1)}% neste mês contra ${(previous * 100).toFixed(1)}% no anterior — ${dropPp.toFixed(1)} p.p. a menos.`,
        dedupeKey: `margin:${input.month}`,
      })
    }
  }

  // ── Resultado negativo ────────────────────────────────────────────────────
  if (input.result < 0) {
    out.push({
      type: 'ADMIN_RESULT_NEGATIVE',
      title: 'O mês está no vermelho',
      body: `Resultado de ${brl(input.result)} com ${Math.round(input.elapsed * 100)}% do mês decorrido. Ainda dá tempo de reagir.`,
      dedupeKey: `result:${input.month}`,
    })
  }

  // ── Meta em risco ─────────────────────────────────────────────────────────
  if (input.goal && input.goal.target > 0) {
    const expected = input.goal.target * input.elapsed
    // Compara com o ESPERADO ATÉ AQUI, não com a meta cheia: no dia 10, ter 30% da meta é estar
    // no ritmo, e alertar ali seria alarme falso todo mês.
    if (expected > 0 && input.goal.actual < expected * GOAL_PACE_FLOOR) {
      const pace = Math.round((input.goal.actual / expected) * 100)
      out.push({
        type: 'ADMIN_GOAL_AT_RISK',
        title: 'Meta do mês em risco',
        body: `${brl(input.goal.actual)} de receita — ${pace}% do esperado para esta altura do mês (meta ${brl(input.goal.target)}).`,
        dedupeKey: `goal:${input.month}`,
      })
    }
  }

  return out
}
