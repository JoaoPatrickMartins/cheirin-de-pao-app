/**
 * dre.service — reúne os insumos da Demonstração do Resultado (Fase 4).
 *
 * Como o painel, este serviço **compõe** e não reagrega: receita vem de `AdminFinancialService`,
 * perdas de `AdminReportsService`, taxa de `GatewayService`. É o que garante que o DRE e as telas
 * de onde ele tira os números nunca discordem — se agregasse por conta própria, divergiriam no
 * primeiro ajuste de regra.
 *
 * A aritmética do resultado mora em `lib/dre.ts`, pura e testável sem banco. Aqui fica só a
 * coleta.
 */
import { FastifyInstance } from 'fastify'
import type { ExpenseStatus } from '@prisma/client'
import {
  buildDre,
  buildBridge,
  accrualCreditRevenue,
  type DreInputs,
  type DreRegime,
  type DreResult,
  type DreBridge,
} from '../../lib/dre.js'
import { toWindow, type PeriodInput, type DateWindow } from '../../lib/date-range.js'
import { AdminFinancialService } from './admin-financial.service.js'
import { AdminReportsService } from '../admin-reports/admin-reports.service.js'
import { GatewayService } from './gateway.service.js'
import { readFrozenDre } from './financial-close.snapshot.js'

const round2 = (n: number) => Math.round(n * 100) / 100

export interface DreResponse {
  /** O regime pedido — e o que a tela deve declarar no cabeçalho. */
  regime: DreRegime
  dre: DreResult
  /**
   * A ponte caixa × competência. Sempre presente: é ela que impede a divergência entre os dois
   * números de virar desconfiança no relatório.
   */
  bridge: DreBridge
  /** O outro regime, para a tela alternar sem nova requisição. */
  alternate: DreResult
  /**
   * Instante do FECHAMENTO, quando o mês está fechado (A1). Presente = estes números vieram de um
   * snapshot congelado e não vão mudar mais; ausente = foram apurados agora.
   *
   * A tela precisa dizer qual dos dois é: um número recalculado exibido com cara de fechamento é
   * exatamente o defeito que o fechamento existe para corrigir.
   */
  closedAt?: string
}

export class DreService {
  private financial: AdminFinancialService
  private reports: AdminReportsService
  private gateway: GatewayService

  constructor(private fastify: FastifyInstance) {
    this.financial = new AdminFinancialService(fastify)
    this.reports = new AdminReportsService(fastify)
    this.gateway = new GatewayService(fastify)
  }

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * @param input janela do DRE
   * @param regime regime contábil pedido
   * @param options `skipFrozen` ignora o snapshot e força a reapuração — usado SÓ pelo próprio
   *   fechamento, que precisa do número fresco para congelar. Qualquer outro caminho que passasse
   *   `true` aqui reintroduziria a deriva que o fechamento existe para eliminar.
   */
  async getDre(
    input: PeriodInput,
    regime: DreRegime = 'cash',
    options: { skipFrozen?: boolean } = {},
  ): Promise<DreResponse> {
    const win = toWindow(input)

    // Mês FECHADO lê do snapshot e não recalcula (A1). É isto que torna o DRE auditável: o número
    // que foi ao contador continua sendo o exibido, independente do que mudou no cadastro depois.
    // Vale para todo mundo que compõe este serviço — painel e tendência incluídos —, e é por isso
    // que a checagem mora aqui e não no controller.
    if (!options.skipFrozen && win.spec.kind === 'month') {
      const frozen = await readFrozenDre(this.prisma, win.spec.month, regime)
      if (frozen) return frozen
    }

    const inputs = await this.collect(win)

    const cash = buildDre(inputs.cash, 'cash', win)
    const accrual = buildDre(inputs.accrual, 'accrual', win)

    return {
      regime,
      dre: regime === 'cash' ? cash : accrual,
      alternate: regime === 'cash' ? accrual : cash,
      bridge: buildBridge(cash, accrual),
    }
  }

  /**
   * Coleta os insumos dos dois regimes numa passada.
   *
   * Os blocos que NÃO variam com o regime (CMV, perdas, taxa) são buscados uma vez e reusados —
   * é o que torna a ponte um identidade exata em vez de aproximação.
   */
  private async collect(win: DateWindow): Promise<{ cash: DreInputs; accrual: DreInputs }> {
    const [revenue, waste, fees, liability, expensesCash, expensesAccrual, marketAccrual, hookAccrual] =
      await Promise.all([
        this.financial.getRevenue(win),
        this.reports.getWasteReport(win),
        this.gateway.getFeeTotal(win),
        this.reports.getCreditLiability(),
        this.expensesByGroup(win, 'cash'),
        this.expensesByGroup(win, 'accrual'),
        this.marketRevenueOnDelivery(win),
        this.hookRevenueOnDelivery(win),
      ])

    const refunds = await this.refundsTotal(win)
    const creditAccrual = await accrualCreditRevenue(this.prisma, win, liability.estPricePerCredit)

    /** Tudo que é igual nos dois regimes (ver as simplificações declaradas em `lib/dre.ts`). */
    const shared = {
      refunds,
      gatewayFee: fees.fee,
      gatewayEstimatedCount: fees.estimatedCount,
      breadCost: revenue.purchases.breadCost,
      marketCmv: revenue.market.cmv,
      unitsWithoutCost: revenue.market.unitsWithoutCost,
      itemLoss: waste.items.lostValue,

      creditRevenueCash: round2(revenue.total),
      combosCash: round2(revenue.byType.combos),
      avulsoCash: round2(revenue.byType.avulso),
      marketRevenueCash: revenue.market.revenue,
      hookRevenueCash: revenue.hook.revenue,

      creditRevenueAccrual: creditAccrual,
      marketRevenueAccrual: marketAccrual,
      hookRevenueAccrual: hookAccrual,
    }

    return {
      cash: { ...shared, expensesByGroup: expensesCash.byGroup, expensesUnpaid: 0 },
      accrual: {
        ...shared,
        expensesByGroup: expensesAccrual.byGroup,
        expensesUnpaid: expensesAccrual.unpaid,
      },
    }
  }

  /**
   * Despesas do período somadas por grupo do DRE.
   *
   * O regime escolhe a data e o filtro:
   *   - **caixa** → `paidAt` na janela (só o que saiu do banco);
   *   - **competência** → `competenceDate` na janela, pagas ou não.
   *
   * `CANCELLED` fica fora dos dois: ela existe para preservar o histórico da parcela de
   * recorrência, não para contar como gasto.
   */
  private async expensesByGroup(
    win: DateWindow,
    regime: DreRegime,
  ): Promise<{ byGroup: Record<string, number>; unpaid: number }> {
    const where =
      regime === 'cash'
        ? { status: 'PAID' as const, paidAt: { gte: win.startDate, lt: win.endDate } }
        : {
            status: { in: ['PENDING', 'PAID'] as ExpenseStatus[] },
            competenceDate: { gte: win.startDate, lt: win.endDate },
          }

    const expenses = await this.prisma.expense.findMany({
      where,
      select: { categoryId: true, amount: true, status: true },
    })
    if (expenses.length === 0) return { byGroup: {}, unpaid: 0 }

    const categories = await this.prisma.expenseCategory.findMany({
      where: { id: { in: [...new Set(expenses.map((e) => e.categoryId))] } },
      select: { id: true, group: true },
    })
    const groupOf = new Map(categories.map((c) => [c.id, c.group as string]))

    const byGroup: Record<string, number> = {}
    let unpaid = 0
    for (const e of expenses) {
      // Categoria apagada não derruba a demonstração: o valor vai para OTHER em vez de sumir, que
      // faria o total do DRE não bater com a lista de despesas.
      const group = groupOf.get(e.categoryId) ?? 'OTHER'
      byGroup[group] = round2((byGroup[group] ?? 0) + e.amount)
      if (e.status === 'PENDING') unpaid = round2(unpaid + e.amount)
    }
    return { byGroup, unpaid }
  }

  /** Estornos do período — pela data em que o estorno foi registrado. */
  private async refundsTotal(win: DateWindow): Promise<number> {
    const agg = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: 'REFUNDED', updatedAt: { gte: win.startDate, lte: win.endDate } },
    })
    return round2(agg._sum.amount ?? 0)
  }

  /**
   * Competência da Cestinha: a parte em DINHEIRO das Cestinhas ENTREGUES no período.
   *
   * Só a parte em dinheiro, pela mesma razão do caixa (D-2): o que o cliente pagou em pãezinhos já
   * foi reconhecido quando aqueles créditos forem consumidos — e eles são consumidos por
   * `MARKET_PURCHASE`, que `accrualCreditRevenue` já conta. Somar os dois contaria duas vezes.
   */
  private async marketRevenueOnDelivery(win: DateWindow): Promise<number> {
    const agg = await this.prisma.marketOrder.aggregate({
      _sum: { moneyAmount: true },
      where: { status: 'DELIVERED', deliveredAt: { gte: win.startDate, lte: win.endDate } },
    })
    return round2(agg._sum.moneyAmount ?? 0)
  }

  /** Competência do gancho: ganchos PAGOS cuja entrega física ocorreu no período. */
  private async hookRevenueOnDelivery(win: DateWindow): Promise<number> {
    const hooks = await this.prisma.hookRequest.findMany({
      where: {
        type: 'PAID',
        status: 'DELIVERED',
        deliveredAt: { gte: win.startDate, lte: win.endDate },
        paymentId: { not: null },
      },
      select: { paymentId: true },
    })
    const ids = hooks.map((h) => h.paymentId).filter((id): id is string => id != null)
    if (ids.length === 0) return 0

    const agg = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      where: { id: { in: ids }, status: 'PAID' },
    })
    return round2(agg._sum.amount ?? 0)
  }
}
