/**
 * admin-dashboard.service — as faixas novas do Painel (§15 do plano-financeiro-vendas).
 *
 * Módulo próprio, e o `GET /admin/dashboard` histórico fica **intocado** em `admin-orders`, por
 * dois motivos concretos:
 *
 *   1. Aquela rota tem `response` schema com allowlist. Campo aninhado que não esteja declarado lá
 *      é descartado em silêncio pelo `fast-json-stringify` — o risco que
 *      `admin-reports.route.ts` documenta ter custado caro. Empilhar 20 métricas nela seria
 *      convidar o bug de volta.
 *   2. A primeira pintura da tela não pode ficar refém da agregação mais lenta. Três rotas
 *      (operação · alertas · visão geral) pintam em paralelo e progressivamente.
 *
 * Regra de ouro deste serviço: ele **compõe**, não agrega. Receita sai de `AdminFinancialService`,
 * base de clientes e passivo saem de `AdminReportsService`. É o que garante que painel e relatório
 * nunca mostrem números diferentes para a mesma pergunta — se agregasse por conta própria, as duas
 * telas divergiriam no primeiro ajuste de regra.
 */
import { FastifyInstance } from 'fastify'
import { LOW_STOCK_THRESHOLD } from '../../lib/market-stock-alerts.js'
import { loadUnitCosts } from '../../lib/product-cost.js'
import { brtDateStr } from '../../lib/cutoff.js'
import {
  previousWindow,
  percentDelta,
  windowDescriptor,
  toWindow,
  type PeriodInput,
  type WindowDescriptor,
  type DateWindow,
} from '../../lib/date-range.js'
import { AdminFinancialService } from '../admin-financial/admin-financial.service.js'
import { AdminReportsService } from '../admin-reports/admin-reports.service.js'
import { DreService } from '../admin-financial/dre.service.js'

const round2 = (n: number) => Math.round(n * 100) / 100

/** Pedidos que ainda podem falhar/ser entregues — os mesmos status que o painel já considera. */
const OPEN_ORDER_STATUSES = ['SCHEDULED', 'SEPARATED', 'OUT_FOR_DELIVERY'] as const

/** Janela do alerta de pagamento recusado. */
const FAILED_PAYMENT_WINDOW_DAYS = 7

/**
 * Faixa 0 do painel — só o que exige AÇÃO, em contagens baratas.
 *
 * Zero em todos os campos significa faixa vazia na tela: ausência de alerta é a informação, e um
 * placeholder "nenhum alerta" só ocuparia a dobra mais valiosa da tela.
 */
export interface DashboardAlerts {
  /** Pedidos de pão + Cestinhas com data passada e sem desfecho. */
  stuckOrders: number
  /** Ganchos aguardando entrega física (hoje só visível como badge em Gestão). */
  pendingHooks: number
  /** Cestinhas NOT_DELIVERED sem desfecho de perda — mercadoria e crédito em limbo. */
  unresolvedMarketLoss: number
  /** Produtos de estoque FIXO em falta ou na faixa crítica. */
  lowStock: { low: number; out: number }
  /** Clientes cuja última tentativa de pagamento falhou e que NÃO pagaram depois. */
  failedPayments: number
  /**
   * Contas a pagar que exigem ação (§15.6 · Fase 1). `overdue` é o que já venceu; `dueSoon`, o que
   * vence nos próximos 3 dias. Atraso comparado por DIA BRT — conta que vence hoje não atrasou.
   */
  payable: { overdue: number; overdueTotal: number; dueSoon: number; dueSoonTotal: number }
  generatedAt: string
}

export interface DashboardOverview {
  window: WindowDescriptor
  /** Janela anterior EQUIVALENTE — presente só quando `compare` foi pedido. */
  previous?: WindowDescriptor

  /** Faixa 2 — resultado. Margem e lucro entram na Fase 4 (DRE). */
  revenue: {
    /** Crédito + Cestinha (dinheiro novo) + gancho pago. Sem GMV (D-2). */
    consolidated: number
    credit: number
    /** Quebra da receita de crédito. Vem de graça de `getRevenue` e é o que permite ao painel ter
     *  UMA só verdade de receita: sem ela, a composição por tipo teria de ficar num card "hoje"
     *  separado, com período diferente do resto da tela. */
    byType: { combos: number; avulso: number }
    market: number
    hook: number
    /** Valor movimentado em Cestinhas — contexto, NUNCA receita. */
    cestinhaGmv: number
    /** Compras ao fornecedor finalizadas: o outro lado do caixa. */
    purchases: number
    /** Variação vs janela anterior equivalente. `null` quando a base é zero. */
    deltaPct: number | null
  }

  /**
   * Faixa 2 — o resultado do período (Fase 4).
   *
   * Ausente quando o DRE não pôde ser apurado: a faixa então mostra só a receita, em vez de um
   * "R$ 0,00" que seria lido como prejuízo.
   *
   * Sempre em regime de CAIXA, sem alternância: o painel é leitura rápida, não análise contábil —
   * quem quer competência abre o DRE.
   */
  result?: {
    netProfit: number
    grossProfit: number
    grossMarginPct: number
    netMarginPct: number
    operatingExpenses: number
    /** Ressalvas do DRE que a tela precisa repassar (período em curso, taxa estimada…). */
    caveats: string[]
  }

  /** Faixa 4 — base e crescimento. Tudo já era calculado e nada aparecia no painel. */
  base: {
    /** Clientes com agenda ativa (a métrica acionável, no lugar do total cadastrado). */
    activeClients: number
    newClients: number
    /** Saldo zerado sem recarga — o sinal de churn do pré-pago. */
    atRisk: number
    /** Adoção de recarga automática (0..1) — a maior alavanca de retenção do modelo. */
    autoRechargeRate: number
  }

  /** Faixa 6 — posição patrimonial. Contas a pagar entram na Fase 1. */
  position: {
    /** Quanto a empresa "deve em pão" (R$ estimado). */
    creditLiability: number
    creditsOutstanding: number
    /** Valor do estoque FIXO a custo de fornecimento. */
    stockAtCost: number
    /**
     * Unidades em estoque sem custo cadastrado. Enquanto > 0, `stockAtCost` é PARCIAL — mesma
     * disciplina de `market.unitsWithoutCost`: zero apareceria como "estoque de graça".
     */
    stockUnitsWithoutCost: number
    /** Contas a pagar em aberto (R$) — a terceira linha do balanço da Faixa 6. */
    payable: number
    /** Recorte já vencido de `payable`. */
    payableOverdue: number
  }
}

export class AdminDashboardService {
  private financial: AdminFinancialService
  private reports: AdminReportsService
  private dre: DreService

  constructor(private fastify: FastifyInstance) {
    this.financial = new AdminFinancialService(fastify)
    this.reports = new AdminReportsService(fastify)
    this.dre = new DreService(fastify)
  }

  private get prisma() {
    return this.fastify.prisma
  }

  /** Início do dia BRT (00:00 BRT = 03:00 UTC). */
  private startOfTodayBrt(now = new Date()): Date {
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    return new Date(
      Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate()) + 3 * 60 * 60 * 1000,
    )
  }

  /** Faixa 0 — central de alertas. */
  async getAlerts(): Promise<DashboardAlerts> {
    const startOfToday = this.startOfTodayBrt()
    const failedSince = new Date(Date.now() - FAILED_PAYMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000)

    const [
      stuckOrders,
      stuckMarket,
      pendingHooks,
      notDelivered,
      lossResolved,
      outOfStock,
      lowStock,
      failedPayments,
      payable,
    ] = await Promise.all([
      this.prisma.order.count({
        where: { scheduledDate: { lt: startOfToday }, status: { in: [...OPEN_ORDER_STATUSES] } },
      }),
      this.prisma.marketOrder.count({
        where: { scheduledDate: { lt: startOfToday }, status: { in: [...OPEN_ORDER_STATUSES] } },
      }),
      this.prisma.hookRequest.count({ where: { status: 'REQUESTED' } }),

      // Cestinha sem desfecho = NOT_DELIVERED menos as já resolvidas.
      //
      // Contado por SUBTRAÇÃO de propósito. O caminho direto seria
      // `where: { lossResolvedAt: null }`, e é exatamente a armadilha que o projeto já documentou
      // em `Condominium.*Override`: no Mongo, documento criado antes do campo não tem a chave, e
      // esse filtro não o encontra. `{ not: null }` só casa com chave presente e preenchida, então
      // a diferença é sempre correta — inclusive para as Cestinhas antigas.
      this.prisma.marketOrder.count({ where: { status: 'NOT_DELIVERED' } }),
      this.prisma.marketOrder.count({
        where: { status: 'NOT_DELIVERED', lossResolvedAt: { not: null } },
      }),

      // Estoque: FIXED apenas, mesma semântica da flag `lowStock` da listagem de produtos e do
      // `market-stock-alerts.ts` — em produto DAILY, "restam 3 vagas" é o funcionamento normal de
      // um item que vende bem, não notícia.
      this.prisma.product.count({
        where: { isActive: true, stockType: 'FIXED', stock: { lte: 0 } },
      }),
      this.prisma.product.count({
        where: {
          isActive: true,
          stockType: 'FIXED',
          stock: { gt: 0, lte: LOW_STOCK_THRESHOLD },
        },
      }),

      this.countUnrecoveredPayers(failedSince),
      this.payableAlert(),
    ])

    return {
      stuckOrders: stuckOrders + stuckMarket,
      pendingHooks,
      unresolvedMarketLoss: Math.max(0, notDelivered - lossResolved),
      lowStock: { low: lowStock, out: outOfStock },
      failedPayments,
      payable,
      generatedAt: new Date().toISOString(),
    }
  }

  /**
   * Contas a pagar em ABERTO — total e o recorte vencido. Sem janela: é obrigação em aberto, não
   * fluxo do período, e por isso não acompanha o seletor da tela.
   */
  private async payableTotals(): Promise<{ total: number; overdue: number }> {
    const pending = await this.prisma.expense.findMany({
      where: { status: 'PENDING' },
      select: { amount: true, dueDate: true },
    })
    const today = brtDateStr(new Date())
    let total = 0
    let overdue = 0
    for (const e of pending) {
      total += e.amount
      if (e.dueDate != null && brtDateStr(e.dueDate) < today) overdue += e.amount
    }
    return { total: round2(total), overdue: round2(overdue) }
  }

  /**
   * Contas a pagar que exigem ação — vencidas e vencendo em até 3 dias.
   *
   * O horizonte curto é deliberado: a Faixa 0 é "o que preciso resolver AGORA". Uma conta que vence
   * daqui a três semanas é informação da tela de contas a pagar, e listá-la aqui diluiria o que
   * realmente precisa de ação hoje.
   *
   * Atraso por DIA BRT, a mesma régua de `listPayable` — `dueDate` é gravado ao meio-dia BRT, então
   * comparar instantes marcaria como atrasada uma conta que vence hoje.
   */
  private async payableAlert() {
    const pending = await this.prisma.expense.findMany({
      where: { status: 'PENDING' },
      select: { amount: true, dueDate: true },
    })
    const today = brtDateStr(new Date())
    const limit = brtDateStr(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000))

    let overdue = 0
    let overdueTotal = 0
    let dueSoon = 0
    let dueSoonTotal = 0
    for (const e of pending) {
      // Sem vencimento não entra: não há como dizer se atrasou. Resolvido em código, nunca com
      // `where: { dueDate: null }`.
      if (e.dueDate == null) continue
      const day = brtDateStr(e.dueDate)
      if (day < today) {
        overdue += 1
        overdueTotal += e.amount
      } else if (day <= limit) {
        dueSoon += 1
        dueSoonTotal += e.amount
      }
    }
    return {
      overdue,
      overdueTotal: round2(overdueTotal),
      dueSoon,
      dueSoonTotal: round2(dueSoonTotal),
    }
  }

  /**
   * Clientes cuja última tentativa falhou e que NÃO pagaram depois.
   *
   * Contar `Payment FAILED` cru daria um número inflado e não acionável: quem tentou de novo e
   * conseguiu não é problema de ninguém. Um alerta que o admin aprende a ignorar é pior que
   * nenhum alerta — é a mesma razão que fez `market-stock-alerts.ts` alertar no CRUZAMENTO do
   * limiar em vez de a cada venda.
   */
  private async countUnrecoveredPayers(since: Date): Promise<number> {
    const failed = await this.prisma.payment.findMany({
      where: { status: 'FAILED', createdAt: { gte: since } },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    if (failed.length === 0) return 0

    // Última falha por cliente — é ela que define se ainda há pendência.
    const lastFailure = new Map<string, Date>()
    for (const f of failed) {
      if (!lastFailure.has(f.userId)) lastFailure.set(f.userId, f.createdAt)
    }

    const paid = await this.prisma.payment.findMany({
      where: {
        status: 'PAID',
        userId: { in: [...lastFailure.keys()] },
        createdAt: { gte: since },
      },
      select: { userId: true, createdAt: true },
    })

    const recoveredAfter = new Map<string, Date>()
    for (const p of paid) {
      const prev = recoveredAfter.get(p.userId)
      if (prev == null || p.createdAt > prev) recoveredAfter.set(p.userId, p.createdAt)
    }

    let unrecovered = 0
    for (const [userId, failedAt] of lastFailure) {
      const success = recoveredAfter.get(userId)
      if (success == null || success < failedAt) unrecovered++
    }
    return unrecovered
  }

  /** Faixas 2, 4 e 6 — composição dos serviços existentes. */
  async getOverview(input: PeriodInput, compare = false): Promise<DashboardOverview> {
    const win = toWindow(input)
    const prev = compare ? previousWindow(win) : null

    const [revenue, previousRevenue, retention, liability, stock, result, payable] =
      await Promise.all([
        this.financial.getRevenue(win),
        prev ? this.financial.getRevenue(prev) : Promise.resolve(null),
        this.reports.getRetentionReport(win),
        this.reports.getCreditLiability(),
        this.computeStockAtCost(),
        this.computeResult(win),
        this.payableTotals(),
      ])

    const cestinhaGmv = revenue.byCondominium.reduce((s, c) => s + (c.cestinhaGmv ?? 0), 0)

    return {
      window: windowDescriptor(win),
      previous: prev ? windowDescriptor(prev) : undefined,
      result,
      revenue: {
        consolidated: revenue.totalConsolidated,
        credit: round2(revenue.total),
        byType: {
          combos: round2(revenue.byType.combos),
          avulso: round2(revenue.byType.avulso),
        },
        market: revenue.market.revenue,
        hook: revenue.hook.revenue,
        cestinhaGmv: round2(cestinhaGmv),
        purchases: revenue.purchases.total,
        deltaPct: previousRevenue
          ? percentDelta(revenue.totalConsolidated, previousRevenue.totalConsolidated)
          : null,
      },
      base: {
        activeClients: retention.autoRecharge.activeClients,
        newClients: retention.activation.registered,
        atRisk: retention.credit.atRisk,
        autoRechargeRate: retention.autoRecharge.rate,
      },
      position: {
        creditLiability: round2(liability.estLiabilityBRL),
        creditsOutstanding: liability.creditsOutstanding,
        stockAtCost: stock.value,
        stockUnitsWithoutCost: stock.unitsWithoutCost,
        // A terceira linha do balanço da Faixa 6, prevista desde a Fase 1 e que faltava: sem ela
        // a "posição" mostrava só o ativo (estoque) e o passivo de crédito, omitindo o que a
        // empresa deve a fornecedor e a prestador.
        payable: payable.total,
        payableOverdue: payable.overdue,
      },
    }
  }

  /**
   * Resultado do período pelo DRE, em regime de caixa.
   *
   * Isolado em try/catch: uma falha na apuração do resultado esconde a Faixa 2 e NÃO derruba o
   * painel inteiro — receita, base de clientes e posição continuam úteis sem ele.
   */
  private async computeResult(win: DateWindow): Promise<DashboardOverview['result']> {
    try {
      const { dre } = await this.dre.getDre(win, 'cash')
      return {
        netProfit: dre.netProfit,
        grossProfit: dre.grossProfit,
        grossMarginPct: dre.grossMarginPct,
        netMarginPct: dre.netMarginPct,
        operatingExpenses: dre.operatingExpenses,
        caveats: dre.caveats,
      }
    } catch (err) {
      this.fastify.log.warn({ err }, '[painel] resultado não apurado — faixa oculta')
      return undefined
    }
  }

  /**
   * Valor do estoque FIXO a custo de fornecimento.
   *
   * Só FIXED: capacidade diária (`dailyCapacity`) é uma promessa de produção do dia, não
   * mercadoria na prateleira — somá-la inventaria estoque que não existe.
   *
   * É POSIÇÃO, nunca resultado (decisão 10 do plano): variação de estoque não entra no CMV, porque
   * sem controle de lote a conta clássica ficaria pior que a aproximação atual.
   */
  private async computeStockAtCost(): Promise<{ value: number; unitsWithoutCost: number }> {
    const products = await this.prisma.product.findMany({
      where: { isActive: true, stockType: 'FIXED', stock: { gt: 0 } },
      select: { id: true, stock: true },
    })
    if (products.length === 0) return { value: 0, unitsWithoutCost: 0 }

    const costs = await loadUnitCosts(this.prisma, products.map((p) => p.id))
    let value = 0
    let unitsWithoutCost = 0
    for (const p of products) {
      const qty = p.stock ?? 0
      const cost = costs.get(p.id)
      // Produto sem custo na matriz não vira custo zero — é contado à parte e o total se declara
      // parcial. Zero apareceria como estoque de graça.
      if (!cost) {
        unitsWithoutCost += qty
        continue
      }
      value += cost.unitCost * qty
    }
    return { value: round2(value), unitsWithoutCost }
  }
}
