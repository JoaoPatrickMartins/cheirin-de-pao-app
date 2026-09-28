/**
 * budget.service — metas mensais e realizado × previsto (F11 · Fase 7).
 *
 * O conceito de META não existia no sistema. O admin sabia o que aconteceu — DRE, relatórios,
 * fluxo de caixa — e nunca o que *deveria* ter acontecido. Sem essa segunda metade, um mês ruim só
 * é reconhecido depois de fechado, quando já não há o que fazer.
 *
 * ## O ritmo é o que torna a meta útil no meio do mês
 *
 * Comparar 10 dias de realizado com a meta do mês inteiro dá sempre "30% da meta" e não informa
 * nada. Por isso todo item traz `expectedToDate` — a meta PRO RATA pelos dias decorridos — e
 * `paceStatus` diz se o ritmo dá conta. É a diferença entre "faltam R$ 7.000" (inútil no dia 10)
 * e "no ritmo atual, fecha 12% abaixo" (acionável).
 *
 * ## Despesa e receita têm sinais opostos, de propósito
 *
 * Receita ACIMA da meta é bom; despesa acima da meta é ruim. `isGood` resolve isso no servidor em
 * vez de deixar cada tela inventar a sua regra — foi assim que o comparativo do painel acabou
 * pintando de verde uma alta de custo, antes desta onda.
 */
import { FastifyInstance } from 'fastify'
import type { ExpenseStatus } from '@prisma/client'
import { monthWindow, MONTH_RE } from '../../lib/date-range.js'
import { AdminFinancialService } from './admin-financial.service.js'

const round2 = (n: number) => Math.round(n * 100) / 100

export type BudgetKind = 'REVENUE' | 'EXPENSE'

export interface BudgetInput {
  month: string
  kind: BudgetKind
  /** `null` = meta do tipo inteiro (receita do mês, ou teto total de despesa). */
  categoryId?: string | null
  amount: number
  notes?: string | null
}

export interface BudgetLine {
  id: string | null
  month: string
  kind: BudgetKind
  categoryId: string | null
  /** Nome da categoria, ou o rótulo do total quando `categoryId` é nulo. */
  label: string
  /** A meta. */
  target: number
  /** O realizado no mês. */
  actual: number
  /** Meta PRO RATA pelos dias decorridos — a régua que vale no meio do mês. */
  expectedToDate: number
  /** `actual − target`. Positivo = acima da meta (bom em receita, ruim em despesa). */
  variance: number
  /** `actual / target` (0..1+). `null` quando a meta é zero. */
  attainment: number | null
  /** `true` quando o desvio é FAVORÁVEL — receita acima, despesa abaixo. */
  isGood: boolean
  /** Ritmo contra o esperado até aqui. `on_track` também cobre o mês já fechado. */
  paceStatus: 'on_track' | 'at_risk' | 'no_target'
  /** Projeção do fechamento mantendo o ritmo atual. `null` no mês já fechado. */
  projected: number | null
}

export interface BudgetReport {
  month: string
  /** Fração do mês já decorrida (0..1). 1 quando o mês fechou. */
  elapsed: number
  isPartial: boolean
  revenue: BudgetLine
  expenseTotal: BudgetLine
  /** Uma linha por categoria COM meta definida. Categoria sem meta não vira linha vazia. */
  expenseByCategory: BudgetLine[]
  /** Categorias que gastaram no mês e ainda NÃO têm meta — o convite a definir uma. */
  categoriesWithoutTarget: Array<{ categoryId: string; name: string; actual: number }>
  caveats: string[]
}

export class BudgetService {
  private financial: AdminFinancialService

  constructor(private fastify: FastifyInstance) {
    this.financial = new AdminFinancialService(fastify)
  }

  private get prisma() {
    return this.fastify.prisma
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async list(month: string) {
    this.assertMonth(month)
    return this.prisma.budget.findMany({ where: { month }, orderBy: { kind: 'asc' } })
  }

  /**
   * Cria ou atualiza a meta de (mês, tipo, categoria).
   *
   * Comporta-se como upsert porque definir meta é ação repetida: o admin ajusta o número do mês
   * várias vezes, e um POST que falhasse com "já existe" o obrigaria a caçar o id antes de editar.
   *
   * **Não usa `prisma.upsert`** por dois motivos que se somam: o `where` composto do Prisma não
   * aceita `categoryId` nulo (e a meta do tipo inteiro é exatamente a de categoria nula), e
   * procurar com `where: { categoryId: null }` é a armadilha do Mongo que a casa proíbe — documento
   * sem a chave não seria encontrado. Então a busca traz as metas do mês/tipo (punhado de linhas) e
   * o casamento é resolvido em CÓDIGO. A trava contra duplicata continua sendo o índice único.
   */
  async upsert(data: BudgetInput, createdById?: string) {
    this.assertMonth(data.month)
    if (!(data.amount >= 0)) throw { statusCode: 400, message: 'O valor da meta não pode ser negativo' }

    const categoryId = data.categoryId ?? null

    if (categoryId != null) {
      const exists = await this.prisma.expenseCategory.findUnique({ where: { id: categoryId } })
      if (!exists) throw { statusCode: 404, message: 'Categoria de despesa não encontrada' }
      if (data.kind !== 'EXPENSE') {
        throw { statusCode: 400, message: 'Meta por categoria só existe para despesa' }
      }
    }

    const siblings = await this.prisma.budget.findMany({
      where: { month: data.month, kind: data.kind },
      select: { id: true, categoryId: true },
    })
    const existing = siblings.find((b) => (b.categoryId ?? null) === categoryId)

    if (existing) {
      return this.prisma.budget.update({
        where: { id: existing.id },
        data: { amount: round2(data.amount), notes: data.notes ?? null },
      })
    }

    return this.prisma.budget.create({
      data: {
        month: data.month,
        kind: data.kind,
        // Gravado SEMPRE, com valor ou com null explícito: sem a chave presente, o índice único do
        // Mongo não enxerga o documento e deixaria passar uma segunda meta para o mesmo alvo.
        categoryId,
        amount: round2(data.amount),
        notes: data.notes ?? null,
        createdById: createdById ?? null,
      },
    })
  }

  async remove(id: string) {
    const existing = await this.prisma.budget.findUnique({ where: { id } })
    if (!existing) throw { statusCode: 404, message: 'Meta não encontrada' }
    return this.prisma.budget.delete({ where: { id } })
  }

  // ── Realizado × meta ───────────────────────────────────────────────────────

  async getReport(month: string, now: Date = new Date()): Promise<BudgetReport> {
    this.assertMonth(month)
    const win = monthWindow(month, now)

    const [budgets, revenue, expenses] = await Promise.all([
      this.prisma.budget.findMany({ where: { month } }),
      this.financial.getRevenue(win),
      this.expensesByCategory(win),
    ])

    // Fração decorrida do mês. No mês fechado é 1; no mês corrente é o avanço real, que é o que
    // torna `expectedToDate` comparável com o realizado parcial.
    const monthStart = win.startDate.getTime()
    const fullEnd = monthWindow(month, new Date(win.startDate.getTime() + 62 * 86400000)).endDate.getTime()
    const elapsed = win.isPartial
      ? Math.min(Math.max((win.endDate.getTime() - monthStart) / (fullEnd - monthStart), 0), 1)
      : 1

    const targetOf = (kind: BudgetKind, categoryId: string | null) =>
      budgets.find((b) => b.kind === kind && (b.categoryId ?? null) === categoryId) ?? null

    const line = (
      kind: BudgetKind,
      categoryId: string | null,
      label: string,
      actual: number,
    ): BudgetLine => {
      const b = targetOf(kind, categoryId)
      const target = round2(b?.amount ?? 0)
      const expectedToDate = round2(target * elapsed)
      const variance = round2(actual - target)
      // Receita acima da meta é bom; despesa acima da meta é ruim. Resolver isso aqui impede cada
      // tela de inventar a própria regra de cor.
      const isGood = kind === 'REVENUE' ? variance >= 0 : variance <= 0
      const onTrack = kind === 'REVENUE' ? actual >= expectedToDate : actual <= expectedToDate

      return {
        id: b?.id ?? null,
        month,
        kind,
        categoryId,
        label,
        target,
        actual: round2(actual),
        expectedToDate,
        variance,
        attainment: target > 0 ? Math.round((actual / target) * 10000) / 10000 : null,
        isGood,
        paceStatus: target <= 0 ? 'no_target' : onTrack ? 'on_track' : 'at_risk',
        // Mantido o ritmo, onde o mês fecha. No mês encerrado não há o que projetar.
        projected: win.isPartial && elapsed > 0 ? round2(actual / elapsed) : null,
      }
    }

    const expenseTotalActual = expenses.reduce((s, e) => s + e.actual, 0)
    const withTarget = expenses.filter((e) => targetOf('EXPENSE', e.categoryId) != null)

    // Categoria que tem META mas não teve gasto continua sendo linha: "gastei zero do que planejei"
    // é informação, e some se a lista vier só do realizado.
    const budgetedOnly = budgets
      .filter((b) => b.kind === 'EXPENSE' && b.categoryId != null)
      .filter((b) => !expenses.some((e) => e.categoryId === b.categoryId))

    const budgetedNames = budgetedOnly.length > 0
      ? await this.prisma.expenseCategory.findMany({
          where: { id: { in: budgetedOnly.map((b) => b.categoryId as string) } },
          select: { id: true, name: true },
        })
      : []
    const nameById = new Map(budgetedNames.map((c) => [c.id, c.name]))

    const expenseByCategory = [
      ...withTarget.map((e) => line('EXPENSE', e.categoryId, e.name, e.actual)),
      ...budgetedOnly.map((b) =>
        line('EXPENSE', b.categoryId, nameById.get(b.categoryId as string) ?? 'Categoria removida', 0),
      ),
    ].sort((a, b) => b.target - a.target)

    const caveats = [
      'A meta é comparada com a despesa por COMPETÊNCIA e a receita por DATA DO PAGAMENTO — as mesmas bases do relatório de despesas e da tela de Receita.',
    ]
    if (win.isPartial) {
      caveats.unshift(
        `Mês EM CURSO (${Math.round(elapsed * 100)}% decorrido): compare com "esperado até aqui", não com a meta cheia.`,
      )
    }
    if (budgets.length === 0) {
      caveats.push('Nenhuma meta definida para este mês — defina uma para o comparativo existir.')
    }

    return {
      month,
      elapsed: Math.round(elapsed * 10000) / 10000,
      isPartial: win.isPartial,
      revenue: line('REVENUE', null, 'Receita do mês', revenue.totalConsolidated),
      expenseTotal: line('EXPENSE', null, 'Despesa total', expenseTotalActual),
      expenseByCategory,
      categoriesWithoutTarget: expenses
        .filter((e) => targetOf('EXPENSE', e.categoryId) == null)
        .map((e) => ({ categoryId: e.categoryId, name: e.name, actual: round2(e.actual) }))
        .sort((a, b) => b.actual - a.actual),
      caveats,
    }
  }

  /** Realizado do mês por categoria, por COMPETÊNCIA. `CANCELLED` fica fora. */
  private async expensesByCategory(win: { startDate: Date; endDate: Date }) {
    const expenses = await this.prisma.expense.findMany({
      where: {
        status: { in: ['PENDING', 'PAID'] as ExpenseStatus[] },
        competenceDate: { gte: win.startDate, lt: win.endDate },
      },
      select: { categoryId: true, amount: true },
    })
    if (expenses.length === 0) return []

    const ids = [...new Set(expenses.map((e) => e.categoryId))]
    const categories = await this.prisma.expenseCategory.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    })
    const nameById = new Map(categories.map((c) => [c.id, c.name]))

    const byCategory = new Map<string, number>()
    for (const e of expenses) {
      byCategory.set(e.categoryId, (byCategory.get(e.categoryId) ?? 0) + e.amount)
    }

    return [...byCategory.entries()].map(([categoryId, actual]) => ({
      categoryId,
      name: nameById.get(categoryId) ?? 'Categoria removida',
      actual,
    }))
  }

  private assertMonth(month: string) {
    if (!MONTH_RE.test(month)) {
      throw { statusCode: 400, message: 'month deve estar no formato YYYY-MM' }
    }
  }
}
