/**
 * expenses-report.service — o relatório de despesas (F2 da Fase 2 do plano-financeiro-vendas).
 *
 * A lista de despesas responde "o que lancei em agosto". Este relatório responde outra coisa:
 * **"para onde o dinheiro está indo, e isso mudou?"** — por grupo do DRE, por categoria, por
 * recebedor, e fixo × variável.
 *
 * O recorte **fixo × variável** não é enfeite de layout: é o insumo do ponto de equilíbrio (F9).
 * Sem separar o custo que existe com venda zero, break-even não sai.
 */
import { FastifyInstance } from 'fastify'
import { EXPENSE_GROUP_LABEL, type ExpenseGroup } from '@cheirin-de-pao/shared'
import { getGanchoConfig } from '../../lib/gancho-config.js'
import {
  toWindow,
  previousWindow,
  percentDelta,
  presetOf,
  windowDescriptor,
  type PeriodInput,
  type ReportPeriod,
  type WindowDescriptor,
} from '../../lib/date-range.js'

const round2 = (n: number) => Math.round(n * 100) / 100

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000

/** "AAAA-MM" do mês BRT de um instante. */
function monthKeyBrt(at: Date): string {
  const s = new Date(at.getTime() - BRT_OFFSET_MS)
  return `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, '0')}`
}

export interface ExpensesReport {
  period?: ReportPeriod
  window: WindowDescriptor
  previous?: WindowDescriptor

  total: number
  /** Variação vs janela anterior equivalente. `null` quando a base é zero. */
  deltaPct: number | null
  /** Quantos lançamentos entraram. */
  count: number

  /** Despesa que existe mesmo com venda zero — o insumo do ponto de equilíbrio. */
  fixed: number
  variable: number

  /** Ainda não paga (competência sem saída de caixa). */
  pending: number

  byGroup: Array<{
    group: ExpenseGroup
    label: string
    total: number
    pctOfTotal: number
    deltaPct: number | null
  }>
  byCategory: Array<{
    categoryId: string
    name: string
    group: ExpenseGroup
    emoji?: string | null
    isFixed: boolean
    total: number
    count: number
    /**
     * Gasto médio dos 3 meses anteriores. É a base do alerta de anomalia (C1) e o que permite
     * ler "subiu" sem abrir outro relatório.
     */
    avgPrevious: number | null
    deltaPct: number | null
  }>
  byPayee: Array<{ payee: string; total: number; count: number }>

  /**
   * Custo de aquisição via gancho grátis (A3).
   *
   * O gancho `FREE`/`BONUS` é o maior investimento de aquisição do produto e não aparecia em
   * número nenhum — só o `ganchoPreco` (o que se COBRA pelo extra) existia. Fica aqui, e não nas
   * despesas, porque não é lançamento: é custo DERIVADO da operação, calculado dos ganchos
   * efetivamente entregues no período.
   *
   * `cost` é `null` quando `ganchoCusto` não foi informado — CAC inventado é pior que CAC ausente.
   */
  hookAcquisition: {
    freeDelivered: number
    unitCost: number | null
    cost: number | null
  }
  /** Série mensal dentro da janela — só faz sentido quando ela cobre mais de um mês. */
  monthly: Array<{ month: string; total: number }>
}

/** Só o que este serviço precisa de um lançamento. */
interface Row {
  categoryId: string
  amount: number
  competenceDate: Date
  status: string
  payee: string | null
  supplierId: string | null
}

export class ExpensesReportService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  async getReport(input: PeriodInput, compare = true): Promise<ExpensesReport> {
    const win = toWindow(input)
    const prev = compare ? previousWindow(win) : null

    // Janela dos 3 meses anteriores ao início — base do "gasto médio" por categoria.
    const baselineStart = new Date(win.startDate.getTime() - 92 * 24 * 60 * 60 * 1000)

    const [rows, prevRows, baselineRows, categories, hookAcquisition] = await Promise.all([
      this.load(win.startDate, win.endDate),
      prev ? this.load(prev.startDate, prev.endDate) : Promise.resolve([]),
      this.load(baselineStart, win.startDate),
      this.prisma.expenseCategory.findMany({
        select: { id: true, name: true, group: true, emoji: true, isFixed: true },
      }),
      this.hookAcquisitionCost(win.startDate, win.endDate),
    ])

    const catById = new Map(categories.map((c) => [c.id, c]))
    const total = round2(rows.reduce((s, r) => s + r.amount, 0))
    const prevTotal = round2(prevRows.reduce((s, r) => s + r.amount, 0))

    // ── Fixo × variável ────────────────────────────────────────────────────
    let fixed = 0
    let pending = 0
    for (const r of rows) {
      if (catById.get(r.categoryId)?.isFixed) fixed += r.amount
      if (r.status === 'PENDING') pending += r.amount
    }
    fixed = round2(fixed)

    // ── Por grupo ──────────────────────────────────────────────────────────
    const groupTotals = sumBy(rows, (r) => catById.get(r.categoryId)?.group ?? 'OTHER')
    const prevGroupTotals = sumBy(prevRows, (r) => catById.get(r.categoryId)?.group ?? 'OTHER')

    const byGroup = [...groupTotals.entries()]
      .map(([group, value]) => ({
        group: group as ExpenseGroup,
        label: EXPENSE_GROUP_LABEL[group as ExpenseGroup] ?? group,
        total: round2(value),
        pctOfTotal: total > 0 ? Math.round((value / total) * 1000) / 10 : 0,
        deltaPct: compare ? percentDelta(value, prevGroupTotals.get(group) ?? 0) : null,
      }))
      .sort((a, b) => b.total - a.total)

    // ── Por categoria ──────────────────────────────────────────────────────
    const catTotals = sumBy(rows, (r) => r.categoryId)
    const catCounts = countBy(rows, (r) => r.categoryId)
    const prevCatTotals = sumBy(prevRows, (r) => r.categoryId)
    const baselineTotals = sumBy(baselineRows, (r) => r.categoryId)
    // Meses distintos na baseline: dividir por 3 fixo daria média errada numa base recém-criada.
    const baselineMonths = new Set(baselineRows.map((r) => monthKeyBrt(r.competenceDate))).size

    const byCategory = [...catTotals.entries()]
      .map(([categoryId, value]) => {
        const cat = catById.get(categoryId)
        const baseline = baselineTotals.get(categoryId)
        return {
          categoryId,
          name: cat?.name ?? 'Categoria removida',
          group: (cat?.group ?? 'OTHER') as ExpenseGroup,
          emoji: cat?.emoji ?? null,
          isFixed: cat?.isFixed ?? false,
          total: round2(value),
          count: catCounts.get(categoryId) ?? 0,
          avgPrevious:
            baseline != null && baselineMonths > 0 ? round2(baseline / baselineMonths) : null,
          deltaPct: compare ? percentDelta(value, prevCatTotals.get(categoryId) ?? 0) : null,
        }
      })
      .sort((a, b) => b.total - a.total)

    // ── Por recebedor ──────────────────────────────────────────────────────
    // Fornecedor cadastrado e nome livre convivem (o entregador não é `Supplier`), então a chave é
    // o nome resolvido — é o que o admin reconhece na tela.
    const supplierNames = await this.supplierNames(rows)
    const payeeKey = (r: Row) =>
      (r.supplierId != null ? supplierNames.get(r.supplierId) : r.payee) ?? ''
    const payeeTotals = sumBy(
      rows.filter((r) => payeeKey(r) !== ''),
      payeeKey,
    )
    const payeeCounts = countBy(
      rows.filter((r) => payeeKey(r) !== ''),
      payeeKey,
    )

    const byPayee = [...payeeTotals.entries()]
      .map(([payee, value]) => ({
        payee,
        total: round2(value),
        count: payeeCounts.get(payee) ?? 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15)

    // ── Série mensal ───────────────────────────────────────────────────────
    const monthTotals = sumBy(rows, (r) => monthKeyBrt(r.competenceDate))
    const monthly = [...monthTotals.entries()]
      .map(([month, value]) => ({ month, total: round2(value) }))
      .sort((a, b) => a.month.localeCompare(b.month))

    return {
      period: presetOf(win),
      window: windowDescriptor(win),
      previous: prev ? windowDescriptor(prev) : undefined,
      total,
      deltaPct: compare ? percentDelta(total, prevTotal) : null,
      count: rows.length,
      fixed,
      variable: round2(total - fixed),
      pending: round2(pending),
      byGroup,
      byCategory,
      byPayee,
      monthly,
      hookAcquisition,
    }
  }

  /**
   * Custo dos ganchos concedidos de graça no período (A3).
   *
   * Conta pela ENTREGA (`deliveredAt`), não pela solicitação: o custo existe quando a peça sai do
   * estoque e vai para a porta do cliente.
   */
  private async hookAcquisitionCost(
    start: Date,
    end: Date,
  ): Promise<ExpensesReport['hookAcquisition']> {
    const [freeDelivered, config] = await Promise.all([
      this.prisma.hookRequest.count({
        where: {
          type: { in: ['FREE', 'BONUS'] },
          status: 'DELIVERED',
          deliveredAt: { gte: start, lt: end },
        },
      }),
      getGanchoConfig(this.prisma),
    ])

    // `custo` 0 significa "não informado" (ver gancho-config). Devolver zero aqui faria a aquisição
    // parecer gratuita, que é exatamente a ilusão que este número existe para desfazer.
    const unitCost = config.custo > 0 ? config.custo : null
    return {
      freeDelivered,
      unitCost,
      cost: unitCost != null ? round2(freeDelivered * unitCost) : null,
    }
  }

  /**
   * Lançamentos por COMPETÊNCIA na janela.
   *
   * Competência, e não pagamento: a pergunta do relatório é "quanto custou o mês", e uma conta de
   * agosto paga em setembro é custo de agosto. `CANCELLED` fica fora — existe para preservar o
   * histórico da parcela de recorrência, não para contar como gasto.
   */
  private async load(start: Date, end: Date): Promise<Row[]> {
    return this.prisma.expense.findMany({
      where: {
        status: { in: ['PENDING', 'PAID'] },
        competenceDate: { gte: start, lt: end },
      },
      select: {
        categoryId: true,
        amount: true,
        competenceDate: true,
        status: true,
        payee: true,
        supplierId: true,
      },
    })
  }

  private async supplierNames(rows: Row[]): Promise<Map<string, string>> {
    const ids = [...new Set(rows.map((r) => r.supplierId).filter((v): v is string => v != null))]
    if (ids.length === 0) return new Map()
    const suppliers = await this.prisma.supplier.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    })
    return new Map(suppliers.map((s) => [s.id, s.name]))
  }
}

function sumBy<T extends { amount: number }>(rows: T[], keyOf: (row: T) => string): Map<string, number> {
  const out = new Map<string, number>()
  for (const r of rows) out.set(keyOf(r), (out.get(keyOf(r)) ?? 0) + r.amount)
  return out
}

function countBy<T>(rows: T[], keyOf: (row: T) => string): Map<string, number> {
  const out = new Map<string, number>()
  for (const r of rows) out.set(keyOf(r), (out.get(keyOf(r)) ?? 0) + 1)
  return out
}
