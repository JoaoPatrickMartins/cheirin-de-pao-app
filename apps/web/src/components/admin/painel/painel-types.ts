/**
 * Tipos das faixas novas do Painel (§15 do plano-financeiro-vendas).
 *
 * Arquivo próprio para as faixas e o `AdminPainel` compartilharem a forma do payload sem uma
 * depender do módulo da outra.
 */

export interface DashboardAlerts {
  stuckOrders: number
  pendingHooks: number
  unresolvedMarketLoss: number
  lowStock: { low: number; out: number }
  failedPayments: number
  /** Contas a pagar que exigem ação — vencidas e vencendo em até 3 dias (§15.6 · Fase 1). */
  payable?: { overdue: number; overdueTotal: number; dueSoon: number; dueSoonTotal: number }
  generatedAt: string
}

export interface WindowDescriptor {
  from: string
  to: string
  label: string
  /** Período ainda EM CURSO — a tela precisa dizer isso em vez de parecer fechamento. */
  isPartial: boolean
}

export interface DashboardOverview {
  window: WindowDescriptor
  previous?: WindowDescriptor
  revenue: {
    consolidated: number
    credit: number
    /** Quebra da receita de crédito no período selecionado. */
    byType: { combos: number; avulso: number }
    market: number
    hook: number
    /** Movimentado em Cestinhas — contexto, nunca receita (D-2). */
    cestinhaGmv: number
    purchases: number
    deltaPct: number | null
  }
  /** Faixa 2 — resultado (Fase 4). Ausente quando o DRE não pôde ser apurado. */
  result?: {
    netProfit: number
    grossProfit: number
    grossMarginPct: number
    netMarginPct: number
    operatingExpenses: number
    caveats: string[]
  }
  base: {
    activeClients: number
    newClients: number
    atRisk: number
    autoRechargeRate: number
  }
  position: {
    creditLiability: number
    creditsOutstanding: number
    stockAtCost: number
    /** Enquanto > 0, `stockAtCost` é PARCIAL. */
    stockUnitsWithoutCost: number
    /** Contas a pagar em aberto — a terceira linha do balanço da Faixa 6. */
    payable?: number
    payableOverdue?: number
  }
}

export const fmtBRL = (v: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)

export const fmtInt = (v: number): string => (v ?? 0).toLocaleString('pt-BR')

export const fmtPct = (rate: number): string =>
  `${((rate ?? 0) * 100).toFixed(0)}%`
