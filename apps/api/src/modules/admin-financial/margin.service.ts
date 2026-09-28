/**
 * margin.service — Margem por produto e por condomínio, e ponto de equilíbrio (F8/F9/B3 · Fase 7).
 *
 * **Compõe**, como o DRE: as unidades vendidas vêm de `lib/period-sales.ts`, a receita e o CMV de
 * `AdminFinancialService`, o ranking de `AdminReportsService`, a aritmética do equilíbrio de
 * `lib/break-even.ts` (pura). Nada é reagregado aqui.
 *
 * ## Onde a margem realmente está — e o que este relatório NÃO sabe
 *
 * A margem calculada é de **contribuição**: receita − custo da mercadoria. Não há rateio de
 * despesa operacional por produto, e não deveria haver: distribuir aluguel por bolo vendido é uma
 * escolha arbitrária que muda o "vencedor" conforme o critério. O que existe é o rateio **por
 * condomínio** (B3), porque ali há um driver defensável — pães entregues —, e mesmo esse viaja
 * declarado como rateio, não como custo medido.
 *
 * ## O pão é o caso especial, e é o caso principal
 *
 * A receita do pão no relatório de vendas é valorizada ao preço de TABELA (`avulsoUnit`), porque o
 * pão da agenda foi pago em pãezinhos de combo, em outra data. A margem do pão herda isso: ela
 * responde "quanto sobra por pão ao preço de tabela", não "quanto entrou de dinheiro por pão". A
 * ressalva viaja no payload — sem ela, o número seria lido como margem realizada.
 */
import { FastifyInstance } from 'fastify'
import type { ExpenseStatus } from '@prisma/client'
import {
  toWindow,
  presetOf,
  windowDescriptor,
  type PeriodInput,
  type ReportPeriod,
  type WindowDescriptor,
  type DateWindow,
} from '../../lib/date-range.js'
import { buildPeriodSales } from '../../lib/period-sales.js'
import { loadUnitCosts } from '../../lib/product-cost.js'
import { computeBreakEven, type BreakEven, type BreakEvenInputs } from '../../lib/break-even.js'
import { AdminFinancialService } from './admin-financial.service.js'
import { AdminReportsService } from '../admin-reports/admin-reports.service.js'

const round2 = (n: number) => Math.round(n * 100) / 100

export interface ProductMarginRow {
  productId: string
  name: string
  isBread: boolean
  qty: number
  revenue: number
  /** `qty × custo unitário`. `null` quando o produto não tem custo cadastrado. */
  cost: number | null
  margin: number | null
  /** Margem sobre a receita da linha (0..1). */
  marginPct: number | null
  /** Margem por unidade vendida — a régua que compara produtos de preços diferentes. */
  marginPerUnit: number | null
  /** `true` quando o produto vendeu abaixo do custo no período. */
  belowCost: boolean
}

export interface CondoMarginRow {
  condominiumId: string
  condominiumName: string
  revenue: number
  breadsDelivered: number
  /** Fatia dos pães entregues — o driver do rateio (B3). */
  shareOfBreads: number
  /** Despesa indireta RATEADA por pães entregues. Não é custo medido: é rateio. */
  allocatedCost: number
  /** `revenue − allocatedCost`. Contribuição depois do rateio. */
  contribution: number
  contributionPct: number
  activeClients: number
}

export interface MarginReport {
  period?: ReportPeriod
  window: WindowDescriptor
  products: {
    rows: ProductMarginRow[]
    revenue: number
    cost: number
    margin: number
    marginPct: number
    /** Unidades vendidas sem custo cadastrado. Enquanto > 0, a margem é PARCIAL. */
    unitsWithoutCost: number
  }
  condominiums: {
    rows: CondoMarginRow[]
    /** O montante que foi rateado — despesa sem centro de custo declarado. */
    allocatedTotal: number
    /** Pães entregues no total, o denominador do rateio. */
    breadsTotal: number
  }
  breakEven: BreakEven
  /**
   * Os insumos CRUS do ponto de equilíbrio.
   *
   * Viajam no payload para o simulador (D2) poder mexer em cada eixo separadamente. Sem eles, ele
   * teria de reconstruir a decomposição a partir dos totais — e `variableCosts` já é `cogs +
   * despesa variável` somados, então "subir o CMV em 5%" acabaria subindo também o combustível.
   */
  breakEvenInputs: BreakEvenInputs
  caveats: string[]
}

export class MarginService {
  private financial: AdminFinancialService
  private reports: AdminReportsService

  constructor(private fastify: FastifyInstance) {
    this.financial = new AdminFinancialService(fastify)
    this.reports = new AdminReportsService(fastify)
  }

  private get prisma() {
    return this.fastify.prisma
  }

  async getMarginReport(input: PeriodInput): Promise<MarginReport> {
    const win = toWindow(input)

    const [sales, revenue, condos, expenses] = await Promise.all([
      buildPeriodSales(this.prisma, win),
      this.financial.getRevenue(win),
      this.reports.getCondominiumRanking(win),
      this.expensesSplit(win),
    ])

    // ── Margem por produto (F8) ──────────────────────────────────────────────
    const costs = await loadUnitCosts(
      this.prisma,
      sales.lines.map((l) => l.productId),
    )

    let totalRevenue = 0
    let totalCost = 0
    let unitsWithoutCost = 0

    const rows: ProductMarginRow[] = sales.lines.map((l) => {
      const unitCost = costs.get(l.productId)?.unitCost ?? null
      totalRevenue += l.revenue

      if (unitCost == null) {
        // Sem custo cadastrado a linha NÃO vira margem de 100%: ela sai com `null` e as unidades
        // entram no contador que torna a margem total declaradamente parcial.
        unitsWithoutCost += l.qty
        return {
          productId: l.productId,
          name: l.name,
          isBread: l.isBread,
          qty: l.qty,
          revenue: l.revenue,
          cost: null,
          margin: null,
          marginPct: null,
          marginPerUnit: null,
          belowCost: false,
        }
      }

      const cost = round2(l.qty * unitCost)
      const margin = round2(l.revenue - cost)
      totalCost += cost
      return {
        productId: l.productId,
        name: l.name,
        isBread: l.isBread,
        qty: l.qty,
        revenue: l.revenue,
        cost,
        margin,
        marginPct: l.revenue > 0 ? Math.round((margin / l.revenue) * 10000) / 10000 : 0,
        marginPerUnit: l.qty > 0 ? round2(margin / l.qty) : 0,
        belowCost: margin < 0,
      }
    })

    // Ordena pela margem em R$ — a pergunta é "onde a margem está", não "o que vende mais".
    // Produto sem custo vai para o fim: ele não tem posição legítima neste ranking.
    rows.sort((a, b) => {
      if ((a.margin == null) !== (b.margin == null)) return a.margin == null ? 1 : -1
      return (b.margin ?? 0) - (a.margin ?? 0)
    })

    const productMargin = round2(totalRevenue - totalCost)

    // ── Margem por condomínio com rateio (B3) ────────────────────────────────
    const breadsTotal = condos.items.reduce((s, c) => s + c.breadsDelivered, 0)
    const allocatedTotal = expenses.indirect

    const condoRows: CondoMarginRow[] = condos.items.map((c) => {
      // O driver é pães entregues. Sem pão entregue no período, o condomínio não recebe rateio —
      // e não recebe custo nenhum, em vez de receber uma fatia igualitária que não corresponde a
      // esforço nenhum.
      const share = breadsTotal > 0 ? c.breadsDelivered / breadsTotal : 0
      const allocated = round2(allocatedTotal * share)
      const contribution = round2(c.revenue - allocated)
      return {
        condominiumId: c.condominiumId,
        condominiumName: c.condominiumName,
        revenue: c.revenue,
        breadsDelivered: c.breadsDelivered,
        shareOfBreads: Math.round(share * 10000) / 10000,
        allocatedCost: allocated,
        contribution,
        contributionPct: c.revenue > 0 ? Math.round((contribution / c.revenue) * 10000) / 10000 : 0,
        activeClients: c.activeClients,
      }
    })
    condoRows.sort((a, b) => b.contribution - a.contribution)

    // ── Ponto de equilíbrio (F9) ─────────────────────────────────────────────
    const cogs = round2(revenue.purchases.breadCost + revenue.market.cmv)
    const breakEvenInputs: BreakEvenInputs = {
      revenue: revenue.totalConsolidated,
      cogs,
      fixedExpenses: expenses.fixed,
      variableExpenses: expenses.variable,
      breads: sales.breads.total,
      days: sales.counts.days,
    }
    const breakEven = computeBreakEven(breakEvenInputs)

    // ── Ressalvas ────────────────────────────────────────────────────────────
    const caveats: string[] = [
      'Margem de CONTRIBUIÇÃO: receita − custo da mercadoria. Não há rateio de despesa operacional por produto — distribuir aluguel por bolo vendido trocaria o "vencedor" conforme o critério escolhido.',
      `O pão é valorizado ao preço do avulso (R$ ${sales.breads.unitPrice.toFixed(2)}): a margem dele é "quanto sobra por pão ao preço de tabela", não o dinheiro que entrou — o pão da agenda foi pago em pãezinhos, em outra data.`,
      'O custo unitário vem da matriz de fornecimento e é o custo ESPERADO de hoje, não o pago em cada compra.',
    ]
    if (unitsWithoutCost > 0) {
      caveats.unshift(
        `Margem PARCIAL: ${unitsWithoutCost} unidade(s) vendida(s) de produto sem custo cadastrado ficaram fora da conta.`,
      )
    }
    if (win.isPartial) caveats.unshift('Período EM CURSO — os números ainda vão mudar.')
    if (allocatedTotal > 0) {
      caveats.push(
        'O custo por condomínio é RATEIO por pães entregues, não custo medido: despesa lançada com centro de custo próprio já está fora deste rateio.',
      )
    }

    return {
      period: presetOf(win),
      window: windowDescriptor(win),
      products: {
        rows,
        revenue: round2(totalRevenue),
        cost: round2(totalCost),
        margin: productMargin,
        marginPct: totalRevenue > 0 ? Math.round((productMargin / totalRevenue) * 10000) / 10000 : 0,
        unitsWithoutCost,
      },
      condominiums: { rows: condoRows, allocatedTotal, breadsTotal },
      breakEven,
      breakEvenInputs,
      caveats,
    }
  }

  /**
   * Despesa do período separada em fixa × variável, e a parcela RATEÁVEL.
   *
   * Apura por COMPETÊNCIA (`competenceDate`), igual ao relatório de despesas: o ponto de equilíbrio
   * pergunta "o que este mês custa para existir", não "o que saiu do banco neste mês".
   *
   * `indirect` exclui despesa que JÁ tem `condominiumId` — ela é custo direto daquele condomínio e
   * ratear de novo a contaria duas vezes. (O custo direto não é somado de volta por ora: o rateio
   * responde "quanto do indireto cabe a cada um", e misturar as duas naturezas na mesma coluna
   * esconderia qual é qual.)
   */
  private async expensesSplit(
    win: DateWindow,
  ): Promise<{ fixed: number; variable: number; indirect: number }> {
    const expenses = await this.prisma.expense.findMany({
      where: {
        status: { in: ['PENDING', 'PAID'] as ExpenseStatus[] },
        competenceDate: { gte: win.startDate, lt: win.endDate },
      },
      select: { categoryId: true, amount: true, condominiumId: true },
    })
    if (expenses.length === 0) return { fixed: 0, variable: 0, indirect: 0 }

    const categories = await this.prisma.expenseCategory.findMany({
      where: { id: { in: [...new Set(expenses.map((e) => e.categoryId))] } },
      select: { id: true, isFixed: true },
    })
    const isFixedById = new Map(categories.map((c) => [c.id, c.isFixed]))

    let fixed = 0
    let variable = 0
    let indirect = 0
    for (const e of expenses) {
      // Categoria apagada cai em VARIÁVEL: tratá-la como fixa inflaria o ponto de equilíbrio, que
      // é o erro mais caro dos dois (uma meta inalcançável desmotiva e é ignorada).
      if (isFixedById.get(e.categoryId) === true) fixed += e.amount
      else variable += e.amount
      // Nunca `where: { condominiumId: null }` no Mongo — resolvido em código.
      if (e.condominiumId == null) indirect += e.amount
    }

    return { fixed: round2(fixed), variable: round2(variable), indirect: round2(indirect) }
  }
}
