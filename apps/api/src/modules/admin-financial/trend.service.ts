/**
 * trend.service — dashboard financeiro consolidado (D4 · Fase 7).
 *
 * **Diferente do DRE de propósito:** o DRE é o detalhe de UM mês; este é a TENDÊNCIA. A pergunta
 * que ele responde não é "quanto deu agosto", e sim "está melhorando ou piorando" — que nenhuma
 * tela do módulo respondia, porque todas mostram uma janela de cada vez.
 *
 * ## Compõe o DRE mês a mês, e isso é o ponto
 *
 * Cada mês sai de `DreService.getDre` e `CashflowService.getReport` — os MESMOS serviços que as
 * telas de DRE e de fluxo de caixa consomem. Reagregar aqui seria mais barato e produziria, no
 * primeiro ajuste de regra, uma tendência que discorda do DRE que ela resume. O custo dessa escolha
 * é real (≈20 consultas por mês × N meses) e está pago em duas frentes: os meses são resolvidos em
 * paralelo e o controller cacheia por 5 minutos — dado mensal fechado praticamente não muda.
 *
 * ## Fluxo tem histórico; SALDO não
 *
 * Receita, despesa, resultado, margem e caixa são FLUXOS: cada mês tem o seu, e a série de 6 meses
 * significa alguma coisa. Passivo de crédito e contas a pagar são **saldos** — o estado de hoje. O
 * sistema não guarda snapshot mensal deles, então uma "série" seria o mesmo número repetido seis
 * vezes, sugerindo estabilidade onde não há medição. Eles vêm em `position`, à parte e declarados
 * como posição do momento. É a mesma disciplina de `caveats` do resto do módulo: preferir o número
 * ausente ao número inventado.
 */
import { FastifyInstance } from 'fastify'
import type { ExpenseStatus } from '@prisma/client'
import { monthWindow, monthKey, percentDelta } from '../../lib/date-range.js'
import { brtDateStr } from '../../lib/cutoff.js'
import { DreService } from './dre.service.js'
import { CashflowService } from './cashflow.service.js'
import { AdminReportsService } from '../admin-reports/admin-reports.service.js'

const round2 = (n: number) => Math.round(n * 100) / 100

/** Teto de meses por requisição — cada mês custa um DRE completo. */
export const MAX_TREND_MONTHS = 12
export const DEFAULT_TREND_MONTHS = 6

const MONTH_LABELS = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
] as const

export interface TrendMonth {
  /** "YYYY-MM" (BRT). */
  month: string
  /** Rótulo curto para o eixo do gráfico ("ago", "set/26" na virada de ano). */
  label: string
  /** `true` só no mês corrente — ele ainda vai mudar e não compara com os fechados. */
  isPartial: boolean
  revenue: number
  cogs: number
  grossProfit: number
  /** Margem bruta sobre a receita líquida (0..1). */
  grossMarginPct: number
  operatingExpenses: number
  netProfit: number
  netMarginPct: number
  /** Variação de caixa do mês (entradas líquidas − saídas). Pode ser negativa. */
  cashflow: number
}

export interface TrendReport {
  months: TrendMonth[]
  /**
   * Saldos de HOJE. Sem série: o sistema não guarda snapshot mensal deles (ver o cabeçalho).
   */
  position: {
    creditLiability: number
    creditsOutstanding: number
    payable: number
    payableOverdue: number
  }
  /**
   * O último mês FECHADO contra a média dos fechados anteriores. É a leitura que a tela destaca —
   * comparar com o mês corrente (parcial) daria sempre uma queda que é só o calendário.
   */
  summary: {
    /** Mês de referência da comparação. `null` quando não há nenhum mês fechado na janela. */
    month: string | null
    revenueDeltaPct: number | null
    netProfitDeltaPct: number | null
    /** Δ da margem líquida em PONTOS percentuais — margem não varia em %, varia em p.p. */
    netMarginDeltaPp: number | null
    /** Quantos dos meses fechados terminaram no azul. */
    profitableMonths: number
    closedMonths: number
  }
  caveats: string[]
}

export class TrendService {
  private dre: DreService
  private cashflow: CashflowService
  private reports: AdminReportsService

  constructor(private fastify: FastifyInstance) {
    this.dre = new DreService(fastify)
    this.cashflow = new CashflowService(fastify)
    this.reports = new AdminReportsService(fastify)
  }

  private get prisma() {
    return this.fastify.prisma
  }

  async getTrend(months = DEFAULT_TREND_MONTHS, now: Date = new Date()): Promise<TrendReport> {
    const count = Math.min(Math.max(Math.trunc(months), 1), MAX_TREND_MONTHS)
    const keys = this.recentMonths(count, now)

    const [rows, liability, payable] = await Promise.all([
      Promise.all(keys.map((m) => this.monthRow(m, now))),
      this.reports.getCreditLiability(),
      this.payableSnapshot(now),
    ])

    const closed = rows.filter((r) => !r.isPartial)
    const last = closed.at(-1) ?? null
    const previous = closed.slice(0, -1)
    const avg = (pick: (r: TrendMonth) => number) =>
      previous.length > 0 ? previous.reduce((s, r) => s + pick(r), 0) / previous.length : null

    const avgRevenue = avg((r) => r.revenue)
    const avgProfit = avg((r) => r.netProfit)
    const avgMargin = avg((r) => r.netMarginPct)

    const caveats = [
      'Cada mês é o MESMO cálculo da tela de DRE (regime de caixa) e do fluxo de caixa — a tendência resume aquelas telas, nunca discorda delas.',
      'Passivo de crédito e contas a pagar são SALDOS de hoje, não séries: o sistema não guarda snapshot mensal, e repetir o número do dia em seis barras sugeriria uma estabilidade que não foi medida.',
    ]
    if (rows.some((r) => r.isPartial)) {
      caveats.unshift(
        'O mês corrente está EM CURSO e fica fora das comparações — medi-lo contra meses fechados mostraria uma queda que é só o calendário.',
      )
    }
    if (closed.length < 2) {
      caveats.push('Menos de dois meses fechados na janela: ainda não há base para falar em tendência.')
    }

    return {
      months: rows,
      position: {
        creditLiability: liability.estLiabilityBRL,
        creditsOutstanding: liability.creditsOutstanding,
        payable: payable.total,
        payableOverdue: payable.overdue,
      },
      summary: {
        month: last?.month ?? null,
        revenueDeltaPct: last && avgRevenue != null ? percentDelta(last.revenue, avgRevenue) : null,
        netProfitDeltaPct: last && avgProfit != null ? percentDelta(last.netProfit, avgProfit) : null,
        // Pontos percentuais, não variação relativa: uma margem que vai de 5% para 10% subiu 5 p.p.,
        // e dizer "+100%" ali seria matematicamente defensável e praticamente inútil.
        netMarginDeltaPp:
          last && avgMargin != null ? Math.round((last.netMarginPct - avgMargin) * 1000) / 10 : null,
        profitableMonths: closed.filter((r) => r.netProfit > 0).length,
        closedMonths: closed.length,
      },
      caveats,
    }
  }

  /** As N chaves de mês terminando no mês corrente (BRT), da mais antiga para a mais recente. */
  private recentMonths(count: number, now: Date): string[] {
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    const y = brt.getUTCFullYear()
    const m = brt.getUTCMonth()
    const out: string[] = []
    for (let i = count - 1; i >= 0; i--) out.push(monthKey(y, m - i))
    return out
  }

  /**
   * Um mês da série — DRE em regime de CAIXA mais a variação do caixa.
   *
   * Caixa e não competência porque é o regime padrão do módulo (decisão 1): a tendência precisa
   * falar a mesma língua da tela que o dono já abre, senão o mesmo mês apareceria com dois
   * resultados diferentes em telas vizinhas.
   */
  private async monthRow(month: string, now: Date): Promise<TrendMonth> {
    const win = monthWindow(month, now)
    const [dre, cash] = await Promise.all([
      this.dre.getDre(win, 'cash'),
      this.cashflow.getReport(win),
    ])
    const d = dre.dre

    const [y, mm] = month.split('-').map(Number)
    const brtNow = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    // O ano só entra no rótulo quando a janela atravessa a virada — "dez" e "dez/25" lado a lado
    // seria ruído; "dez" sozinho num gráfico que começa em jul/25 seria ambíguo.
    const label = y === brtNow.getUTCFullYear()
      ? MONTH_LABELS[mm - 1]
      : `${MONTH_LABELS[mm - 1]}/${String(y).slice(2)}`

    return {
      month,
      label,
      isPartial: win.isPartial,
      revenue: d.grossRevenue,
      cogs: d.cogs,
      grossProfit: d.grossProfit,
      // O DRE devolve as margens em 0..100; a série usa TAXA (0..1), como todo percentual do módulo.
      grossMarginPct: Math.round(d.grossMarginPct * 100) / 10000,
      operatingExpenses: d.operatingExpenses,
      netProfit: d.netProfit,
      netMarginPct: Math.round(d.netMarginPct * 100) / 10000,
      cashflow: cash.net,
    }
  }

  /**
   * Contas a pagar em aberto AGORA — total e o recorte já vencido.
   *
   * Sem janela: é uma obrigação em aberto, não um fluxo.
   *
   * O atraso compara **dia BRT com dia BRT**, exatamente como `listPayable` faz — e não os
   * instantes. A diferença morde: `dueDate` é gravado ao meio-dia BRT, então comparar com o fim do
   * dia de hoje marcaria como atrasada uma conta que vence HOJE.
   */
  private async payableSnapshot(now: Date): Promise<{ total: number; overdue: number }> {
    const pending = await this.prisma.expense.findMany({
      where: { status: 'PENDING' as ExpenseStatus },
      select: { amount: true, dueDate: true },
    })
    const today = brtDateStr(now)

    let total = 0
    let overdue = 0
    for (const e of pending) {
      total += e.amount
      // Despesa sem vencimento não pode estar atrasada — resolvido em código, nunca com
      // `where: { dueDate: null }` (a chave pode não existir no documento).
      if (e.dueDate != null && brtDateStr(e.dueDate) < today) overdue += e.amount
    }
    return { total: round2(total), overdue: round2(overdue) }
  }
}
