/**
 * admin-expenses.service — registro e gestão de despesas (Fase 1 do plano-financeiro-vendas).
 *
 * É o módulo que destrava DRE, fluxo de caixa, contas a pagar, ponto de equilíbrio e CAC: antes
 * dele a única saída de dinheiro que o sistema conhecia era `PurchaseOrder` (compra de mercadoria).
 *
 * Três decisões do plano moram aqui:
 *   - **decisão 4** — categorias em tabela cadastrável; o `ExpenseGroup` amarra a linha do DRE.
 *   - **decisão 9** — imposto é despesa registrada, nunca calculada.
 *   - **decisão 11** — recorrência materializada ao abrir o mês (ver `lib/expense-recurrence.ts`).
 */
import { FastifyInstance } from 'fastify'
import type {
  ExpenseCreate,
  ExpenseUpdate,
  ExpenseCategoryCreate,
  ExpenseCategoryUpdate,
  ExpenseRecurrenceCreate,
  ExpenseRecurrenceUpdate,
  ExpenseImportRow,
  ExpenseGroup,
} from '@cheirin-de-pao/shared'
import { materializeRecurrences } from '../../lib/expense-recurrence.js'
import { monthWindow, type DateWindow } from '../../lib/date-range.js'
import { isMonthClosed } from '../admin-financial/financial-close.snapshot.js'

const round2 = (n: number) => Math.round(n * 100) / 100
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000

/** "YYYY-MM-DD" (BRT) → instante UTC de 00:00 BRT daquele dia. */
function parseDateOnlyBrt(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + BRT_OFFSET_MS)
}

/** Instante → "YYYY-MM-DD" no calendário BRT. */
function toDateOnlyBrt(at: Date): string {
  const s = new Date(at.getTime() - BRT_OFFSET_MS)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${s.getUTCFullYear()}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())}`
}

/** Erro de regra de negócio — o controller o traduz em 400/404 em vez de 500. */
export class ExpenseError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 409 = 400,
  ) {
    super(message)
    this.name = 'ExpenseError'
  }
}

export interface ExpenseListFilters {
  /** Mês de competência "YYYY-MM". Quando presente, materializa as recorrências antes de listar. */
  month?: string
  window?: DateWindow
  categoryId?: string
  group?: ExpenseGroup
  status?: 'PENDING' | 'PAID' | 'CANCELLED'
  condominiumId?: string
  supplierId?: string
}

export class AdminExpensesService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  // ── Categorias ──────────────────────────────────────────────────────────

  async listCategories(includeInactive = false) {
    return this.prisma.expenseCategory.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
  }

  async createCategory(data: ExpenseCategoryCreate) {
    const existing = await this.prisma.expenseCategory.findUnique({ where: { name: data.name } })
    if (existing) throw new ExpenseError('Já existe uma categoria com esse nome', 409)

    return this.prisma.expenseCategory.create({
      data: {
        name: data.name,
        group: data.group,
        isFixed: data.isFixed,
        emoji: data.emoji,
        sortOrder: data.sortOrder ?? 0,
      },
    })
  }

  async updateCategory(id: string, data: ExpenseCategoryUpdate) {
    const current = await this.prisma.expenseCategory.findUnique({ where: { id } })
    if (!current) throw new ExpenseError('Categoria não encontrada', 404)

    if (data.name != null && data.name !== current.name) {
      const clash = await this.prisma.expenseCategory.findUnique({ where: { name: data.name } })
      if (clash) throw new ExpenseError('Já existe uma categoria com esse nome', 409)
    }

    return this.prisma.expenseCategory.update({ where: { id }, data })
  }

  /**
   * Desativa a categoria em vez de apagar quando há lançamento — soft delete.
   *
   * Apagar a categoria de uma despesa já lançada quebraria o histórico: o DRE de um mês fechado
   * perderia a linha, e o relatório de despesas exibiria "categoria desconhecida" retroativamente.
   */
  async deleteCategory(id: string): Promise<{ deleted: boolean; deactivated: boolean }> {
    const category = await this.prisma.expenseCategory.findUnique({ where: { id } })
    if (!category) throw new ExpenseError('Categoria não encontrada', 404)

    const inUse = await this.prisma.expense.count({ where: { categoryId: id } })
    if (inUse > 0) {
      await this.prisma.expenseCategory.update({ where: { id }, data: { isActive: false } })
      return { deleted: false, deactivated: true }
    }

    await this.prisma.expenseCategory.delete({ where: { id } })
    return { deleted: true, deactivated: false }
  }

  // ── Lançamentos ─────────────────────────────────────────────────────────

  /**
   * Lista despesas do mês/janela, com as recorrências do mês já materializadas.
   *
   * A materialização acontece AQUI (e não num cron) por decisão 11 — e só quando o filtro é de
   * mês: numa janela arbitrária não existe "a parcela daquele mês" para gerar.
   */
  async list(filters: ExpenseListFilters, adminId: string) {
    if (filters.month != null) {
      // Mês FECHADO não materializa recorrência (A1): abrir um mês já entregue ao contador faria
      // nascer uma parcela de aluguel dentro dele, e a lista passaria a divergir do DRE congelado
      // pelo simples ato de VISUALIZAR — o efeito colateral mais traiçoeiro possível.
      const closed = await this.prisma.financialClose.findUnique({
        where: { month: filters.month },
        select: { id: true },
      })
      if (!closed) await materializeRecurrences(this.prisma, filters.month, adminId)
    }

    const win = filters.window ?? (filters.month != null ? monthWindow(filters.month) : null)

    const categoryIds = filters.group != null ? await this.categoryIdsOfGroup(filters.group) : null
    // Grupo sem categoria nenhuma: devolve lista vazia em vez de ignorar o filtro (ignorar faria a
    // tela mostrar TODAS as despesas, o oposto do que o admin pediu).
    if (categoryIds != null && categoryIds.length === 0) return []

    const expenses = await this.prisma.expense.findMany({
      where: {
        ...(win ? { competenceDate: { gte: win.startDate, lt: win.endDate } } : {}),
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.condominiumId ? { condominiumId: filters.condominiumId } : {}),
        ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
      },
      orderBy: [{ competenceDate: 'desc' }, { createdAt: 'desc' }],
    })

    return this.decorate(expenses)
  }

  /** Ids das categorias de um grupo — o filtro por grupo do DRE precisa disso. */
  private async categoryIdsOfGroup(group: ExpenseGroup): Promise<string[]> {
    const rows = await this.prisma.expenseCategory.findMany({
      where: { group },
      select: { id: true },
    })
    return rows.map((r) => r.id)
  }

  /**
   * Anexa nome/grupo da categoria e nome do fornecedor.
   *
   * Feito em UMA consulta por coleção, não com `include` por linha: a lista do mês pode ter
   * centenas de lançamentos e o Mongo não faz join barato.
   */
  private async decorate<
    T extends { categoryId: string; supplierId?: string | null; condominiumId?: string | null },
  >(expenses: T[]) {
    if (expenses.length === 0) return []

    const catIds = [...new Set(expenses.map((e) => e.categoryId))]
    const supIds = [...new Set(expenses.map((e) => e.supplierId).filter((v): v is string => !!v))]
    const condoIds = [...new Set(expenses.map((e) => e.condominiumId).filter((v): v is string => !!v))]

    const [cats, sups, condos] = await Promise.all([
      this.prisma.expenseCategory.findMany({
        where: { id: { in: catIds } },
        select: { id: true, name: true, group: true, emoji: true, isFixed: true },
      }),
      supIds.length > 0
        ? this.prisma.supplier.findMany({ where: { id: { in: supIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
      condoIds.length > 0
        ? this.prisma.condominium.findMany({ where: { id: { in: condoIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
    ])

    const catMap = new Map(cats.map((c) => [c.id, c]))
    const supMap = new Map(sups.map((s) => [s.id, s.name]))
    const condoMap = new Map(condos.map((c) => [c.id, c.name]))

    return expenses.map((e) => {
      const cat = catMap.get(e.categoryId)
      return {
        ...e,
        categoryName: cat?.name ?? '—',
        categoryGroup: cat?.group ?? 'OTHER',
        categoryEmoji: cat?.emoji ?? null,
        categoryIsFixed: cat?.isFixed ?? false,
        supplierName: e.supplierId ? (supMap.get(e.supplierId) ?? null) : null,
        condominiumName: e.condominiumId ? (condoMap.get(e.condominiumId) ?? null) : null,
      }
    })
  }

  /**
   * Trava do lançamento retroativo (A1): mês FECHADO não recebe nem perde lançamento.
   *
   * Sem isto, o fechamento seria decorativo — o DRE congelado continuaria certo, mas a lista de
   * despesas e o relatório de despesas mostrariam um mês diferente daquele que foi ao contador, e
   * aí nenhum dos dois números seria confiável. Reabrir o mês é o caminho legítimo, e ele deixa
   * rastro.
   */
  private async assertMonthOpen(competenceDate: Date | null | undefined, action: string) {
    const closed = await isMonthClosed(this.prisma, competenceDate)
    if (closed) {
      throw new ExpenseError(
        `O mês ${closed} está FECHADO e não aceita ${action}. Reabra o fechamento em Financeiro › Fechamento de mês para editar.`,
        409,
      )
    }
  }

  async create(data: ExpenseCreate, createdById: string) {
    await this.assertCategoryExists(data.categoryId)
    await this.assertMonthOpen(parseDateOnlyBrt(data.competenceDate), 'novos lançamentos')

    return this.prisma.expense.create({
      data: {
        categoryId: data.categoryId,
        description: data.description,
        amount: round2(data.amount),
        competenceDate: parseDateOnlyBrt(data.competenceDate),
        dueDate: data.dueDate != null ? parseDateOnlyBrt(data.dueDate) : null,
        paidAt: data.paidAt != null ? parseDateOnlyBrt(data.paidAt) : null,
        // Status DERIVADO de `paidAt`, nunca recebido do cliente: uma despesa PAID sem data de
        // pagamento sumiria do fluxo de caixa e apareceria no DRE — dois relatórios discordando
        // sobre o mesmo lançamento.
        status: data.paidAt != null ? 'PAID' : 'PENDING',
        supplierId: data.supplierId,
        payee: data.payee,
        paymentMethod: data.paymentMethod,
        condominiumId: data.condominiumId,
        receiptUrl: data.receiptUrl,
        notes: data.notes,
        createdById,
      },
    })
  }

  async update(id: string, data: ExpenseUpdate, updatedById: string) {
    const current = await this.prisma.expense.findUnique({ where: { id } })
    if (!current) throw new ExpenseError('Despesa não encontrada', 404)
    if (data.categoryId != null) await this.assertCategoryExists(data.categoryId)

    // Os DOIS meses são checados: o de origem (a despesa sairia de um mês fechado) e o de destino
    // (ela entraria num). Checar só um deixaria a outra metade da mudança passar.
    await this.assertMonthOpen(current.competenceDate, 'edição de lançamento')
    if (data.competenceDate != null) {
      await this.assertMonthOpen(parseDateOnlyBrt(data.competenceDate), 'edição de lançamento')
    }

    const amountChanged = data.amount != null && round2(data.amount) !== current.amount

    // `paidAt` explicitamente null = "desmarcar como paga" → volta a PENDING e entra em contas a
    // pagar. Distinguir `null` de `undefined` é o que permite desfazer um pagamento registrado
    // por engano sem cancelar a despesa.
    const paidAtGiven = 'paidAt' in data
    const nextPaidAt = paidAtGiven
      ? data.paidAt != null
        ? parseDateOnlyBrt(data.paidAt)
        : null
      : current.paidAt

    const status =
      data.status === 'CANCELLED' ? 'CANCELLED' : nextPaidAt != null ? 'PAID' : 'PENDING'

    return this.prisma.expense.update({
      where: { id },
      data: {
        ...(data.categoryId != null ? { categoryId: data.categoryId } : {}),
        ...(data.description != null ? { description: data.description } : {}),
        ...(data.amount != null ? { amount: round2(data.amount) } : {}),
        ...(data.competenceDate != null
          ? { competenceDate: parseDateOnlyBrt(data.competenceDate) }
          : {}),
        ...('dueDate' in data
          ? { dueDate: data.dueDate != null ? parseDateOnlyBrt(data.dueDate) : null }
          : {}),
        ...(paidAtGiven ? { paidAt: nextPaidAt } : {}),
        ...('supplierId' in data ? { supplierId: data.supplierId } : {}),
        ...('payee' in data ? { payee: data.payee } : {}),
        ...('paymentMethod' in data ? { paymentMethod: data.paymentMethod } : {}),
        ...('condominiumId' in data ? { condominiumId: data.condominiumId } : {}),
        ...('receiptUrl' in data ? { receiptUrl: data.receiptUrl } : {}),
        ...('notes' in data ? { notes: data.notes } : {}),
        status,
        // Auditoria (A4): guarda o valor anterior só quando ele mudou de fato. Registrar em toda
        // edição encheria o campo de ruído e esconderia a alteração que importa.
        updatedById,
        ...(amountChanged ? { previousAmount: current.amount } : {}),
      },
    })
  }

  /** Marca como paga na data informada (ou hoje) — o atalho do contas a pagar. */
  async markPaid(id: string, paidAt: string | undefined, updatedById: string) {
    const current = await this.prisma.expense.findUnique({ where: { id } })
    if (!current) throw new ExpenseError('Despesa não encontrada', 404)
    if (current.status === 'CANCELLED') {
      throw new ExpenseError('Despesa cancelada não pode ser marcada como paga')
    }

    return this.prisma.expense.update({
      where: { id },
      data: {
        paidAt: paidAt != null ? parseDateOnlyBrt(paidAt) : new Date(),
        status: 'PAID',
        updatedById,
      },
    })
  }

  /**
   * Remove o lançamento.
   *
   * Parcela de recorrência é CANCELADA, não apagada: apagar faria a próxima abertura do mês
   * materializá-la de novo (o índice único ficaria livre), e a despesa "excluída" reapareceria.
   */
  async remove(id: string, updatedById: string): Promise<{ deleted: boolean; cancelled: boolean }> {
    const current = await this.prisma.expense.findUnique({ where: { id } })
    if (!current) throw new ExpenseError('Despesa não encontrada', 404)
    await this.assertMonthOpen(current.competenceDate, 'exclusão de lançamento')

    if (current.recurrenceId != null) {
      await this.prisma.expense.update({
        where: { id },
        data: { status: 'CANCELLED', updatedById },
      })
      return { deleted: false, cancelled: true }
    }

    await this.prisma.expense.delete({ where: { id } })
    return { deleted: true, cancelled: false }
  }

  /** Contas a pagar (F4): PENDING, das mais atrasadas para as mais distantes. */
  async listPayable(daysAhead = 30) {
    const horizon = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
    const expenses = await this.prisma.expense.findMany({
      where: {
        status: 'PENDING',
        // Sem vencimento não entra no horizonte: não há como dizer se está atrasada. Ela continua
        // visível na lista do mês.
        dueDate: { not: null, lte: horizon },
      },
      orderBy: { dueDate: 'asc' },
    })

    const decorated = await this.decorate(expenses)
    const todayStr = toDateOnlyBrt(new Date())
    const rows = decorated.map((e) => ({
      ...e,
      // Atraso comparado por DIA BRT, não por instante: uma conta que vence hoje às 23h não está
      // atrasada às 10h da manhã.
      isOverdue: e.dueDate != null && toDateOnlyBrt(e.dueDate) < todayStr,
      /** De onde a linha vem — o front usa para saber qual endpoint de pagamento chamar (B5). */
      sourceKind: 'EXPENSE' as const,
    }))

    const purchases = await this.payablePurchases(horizon, todayStr)

    // Ordena o conjunto inteiro por vencimento: misturar as duas origens e deixar as compras no
    // fim faria a conta mais atrasada do mês aparecer embaixo.
    return [...rows, ...purchases].sort((a, b) => {
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
      const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
      return da - db
    })
  }

  /**
   * Compras ao fornecedor FINALIZADAS e ainda não pagas (B5).
   *
   * Entram em contas a pagar com a mesma forma de uma despesa, para a tela não precisar de dois
   * layouts. O que as distingue é `sourceKind`, que diz ao front qual endpoint chamar ao pagar.
   *
   * **Não viram `Expense`.** Criar um lançamento espelho faria o DRE e o fluxo de caixa contarem a
   * mesma compra duas vezes — uma por `PurchaseOrder`, outra pelo espelho. A compra continua sendo
   * a fonte única; contas a pagar apenas a exibe enquanto `paidAt` está vazio.
   *
   * ## Fornecimento próprio fica FORA
   *
   * Fornecedor marcado `isSelfSupply` é a própria casa. Não há a quem pagar, e o custo real dela já
   * entra pelas DESPESAS (farinha, gás, mão de obra) — listá-la aqui cobraria duas vezes a mesma
   * coisa e, na prática, enchia a fila de lotes diários de centavos que escondiam a conta de
   * verdade.
   *
   * O corte é por ITEM, não por pedido, porque o rateio da matriz põe itens de fornecedores
   * DIFERENTES no mesmo `PurchaseOrder` (o split 75/25). Numa compra mista, o que entra é só a
   * parte de terceiro; se sobrar zero, o pedido não aparece.
   */
  private async payablePurchases(horizon: Date, todayStr: string) {
    const orders = await this.prisma.purchaseOrder.findMany({
      // Nunca `paidAt: null` no Mongo: pedido anterior ao campo não tem a chave e não seria
      // encontrado. Busca as finalizadas do horizonte e resolve o "não pago" em código.
      where: { status: 'FINALIZED', date: { lte: horizon } },
      select: { id: true, date: true, totalValue: true, paidAt: true, slotLabel: true },
      orderBy: { date: 'asc' },
    })
    const unpaid = orders.filter((o) => o.paidAt == null)
    if (unpaid.length === 0) return []

    const totals = await this.purchaseValues(unpaid)

    return unpaid
      // Pedido inteiramente de fornecimento próprio some (valor 0). O `> 0` também descarta pedido
      // sem item nenhum, que nunca foi conta a pagar de ninguém.
      .filter((o) => (totals.get(o.id) ?? 0) > 0)
      .map((o) => ({
      id: o.id,
      categoryId: '',
      description: `Compra ao fornecedor${o.slotLabel ? ` · ${o.slotLabel}` : ''}`,
      amount: round2(totals.get(o.id) ?? 0),
      competenceDate: o.date,
      // O vencimento é a data da compra: o sistema não conhece o prazo negociado com o fornecedor,
      // e inventar "30 dias" esconderia atraso real.
      dueDate: o.date,
      paidAt: null,
      status: 'PENDING' as const,
      categoryName: 'Compra ao fornecedor',
      categoryGroup: 'COGS' as const,
      categoryEmoji: null,
      categoryIsFixed: false,
      supplierName: null,
      condominiumName: null,
      payee: null,
        isOverdue: toDateOnlyBrt(o.date) < todayStr,
        sourceKind: 'PURCHASE' as const,
      }))
  }

  /**
   * Quanto de cada compra é DEVIDO A TERCEIRO.
   *
   * Sem nenhum fornecedor de fornecimento próprio cadastrado, usa `totalValue` (um campo por
   * pedido) e só cai nos itens para os pedidos antigos que não o têm — o caminho barato de sempre.
   *
   * Havendo fornecimento próprio, `totalValue` deixa de servir: ele é o valor CHEIO do pedido, e o
   * que se deve é só a fatia de terceiro. Aí a soma passa a vir dos itens, filtrando por fornecedor.
   */
  private async purchaseValues(
    orders: Array<{ id: string; totalValue: number | null }>,
  ): Promise<Map<string, number>> {
    const selfSuppliers = await this.prisma.supplier.findMany({
      where: { isSelfSupply: true },
      select: { id: true },
    })
    const selfIds = new Set(selfSuppliers.map((s) => s.id))

    const out = new Map<string, number>()
    const missing: string[] = []
    for (const o of orders) {
      // Com fornecimento próprio em jogo, nenhum pedido pode confiar no total cheio.
      if (o.totalValue != null && selfIds.size === 0) out.set(o.id, o.totalValue)
      else missing.push(o.id)
    }
    if (missing.length === 0) return out

    const items = await this.prisma.purchaseOrderItem.findMany({
      where: { purchaseOrderId: { in: missing } },
      select: { purchaseOrderId: true, supplierId: true, quantity: true, unitPrice: true },
    })
    for (const it of items) {
      if (selfIds.has(it.supplierId)) continue
      const prev = out.get(it.purchaseOrderId) ?? 0
      out.set(it.purchaseOrderId, round2(prev + it.quantity * it.unitPrice))
    }
    return out
  }

  /** Marca uma compra ao fornecedor como PAGA (B5) — a saída de caixa acontece aqui. */
  async markPurchasePaid(id: string, paidAt?: string) {
    const order = await this.prisma.purchaseOrder.findUnique({ where: { id } })
    if (!order) throw new ExpenseError('Compra não encontrada', 404)
    if (order.status !== 'FINALIZED') {
      throw new ExpenseError('Só compra finalizada pode ser paga', 409)
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { paidAt: paidAt != null ? parseDateOnlyBrt(paidAt) : new Date() },
    })
  }

  // ── Recorrências ────────────────────────────────────────────────────────

  async listRecurrences(includeInactive = false) {
    const rows = await this.prisma.expenseRecurrence.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { dayOfMonth: 'asc' },
    })
    return this.decorate(rows)
  }

  async createRecurrence(data: ExpenseRecurrenceCreate) {
    await this.assertCategoryExists(data.categoryId)
    return this.prisma.expenseRecurrence.create({
      data: {
        categoryId: data.categoryId,
        description: data.description,
        amount: round2(data.amount),
        dayOfMonth: data.dayOfMonth,
        supplierId: data.supplierId,
        payee: data.payee,
        condominiumId: data.condominiumId,
        startsAt: parseDateOnlyBrt(`${data.startsAt}-01`),
        endsAt: data.endsAt != null ? parseDateOnlyBrt(`${data.endsAt}-01`) : null,
      },
    })
  }

  async updateRecurrence(id: string, data: ExpenseRecurrenceUpdate) {
    const current = await this.prisma.expenseRecurrence.findUnique({ where: { id } })
    if (!current) throw new ExpenseError('Recorrência não encontrada', 404)
    if (data.categoryId != null) await this.assertCategoryExists(data.categoryId)

    return this.prisma.expenseRecurrence.update({
      where: { id },
      data: {
        ...(data.categoryId != null ? { categoryId: data.categoryId } : {}),
        ...(data.description != null ? { description: data.description } : {}),
        ...(data.amount != null ? { amount: round2(data.amount) } : {}),
        ...(data.dayOfMonth != null ? { dayOfMonth: data.dayOfMonth } : {}),
        ...('supplierId' in data ? { supplierId: data.supplierId } : {}),
        ...('payee' in data ? { payee: data.payee } : {}),
        ...('condominiumId' in data ? { condominiumId: data.condominiumId } : {}),
        ...(data.startsAt != null ? { startsAt: parseDateOnlyBrt(`${data.startsAt}-01`) } : {}),
        ...(data.endsAt != null ? { endsAt: parseDateOnlyBrt(`${data.endsAt}-01`) } : {}),
        ...(data.isActive != null ? { isActive: data.isActive } : {}),
      },
    })
  }

  /**
   * Desativa a recorrência em vez de apagar quando já gerou parcela.
   *
   * As parcelas guardam `recurrenceId`; apagar a recorrência deixaria referência órfã no histórico
   * e o relatório não saberia mais dizer que aquele aluguel era fixo.
   */
  async removeRecurrence(id: string): Promise<{ deleted: boolean; deactivated: boolean }> {
    const current = await this.prisma.expenseRecurrence.findUnique({ where: { id } })
    if (!current) throw new ExpenseError('Recorrência não encontrada', 404)

    const generated = await this.prisma.expense.count({ where: { recurrenceId: id } })
    if (generated > 0) {
      await this.prisma.expenseRecurrence.update({ where: { id }, data: { isActive: false } })
      return { deleted: false, deactivated: true }
    }

    await this.prisma.expenseRecurrence.delete({ where: { id } })
    return { deleted: true, deactivated: false }
  }

  // ── Importação em massa (E2) ────────────────────────────────────────────

  /**
   * Importa linhas de CSV, resolvendo a categoria por NOME.
   *
   * Existe porque sem histórico não há comparativo nem média: um DRE que nasce com um único mês
   * não responde "o gasto subiu?". E **nunca cria categoria implicitamente** — a linha volta como
   * erro. Categoria criada por digitação errada numa planilha viraria uma linha do DRE.
   *
   * Importa o que dá e relata o que não deu: falhar tudo por causa de uma linha obrigaria o admin
   * a recomeçar uma planilha de 200 lançamentos por um acento.
   */
  async importRows(
    rows: ExpenseImportRow[],
    createdById: string,
  ): Promise<{ imported: number; errors: Array<{ line: number; message: string }> }> {
    const categories = await this.prisma.expenseCategory.findMany({
      select: { id: true, name: true },
    })
    // Casamento por nome normalizado (sem caixa nem espaço nas pontas) — "Aluguel " e "aluguel"
    // são a mesma categoria para quem digitou a planilha.
    const byName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]))

    const errors: Array<{ line: number; message: string }> = []
    const data: Array<Parameters<typeof this.prisma.expense.create>[0]['data']> = []

    rows.forEach((row, i) => {
      const categoryId = byName.get(row.categoryName.trim().toLowerCase())
      if (categoryId == null) {
        errors.push({ line: i + 1, message: `Categoria "${row.categoryName}" não cadastrada` })
        return
      }
      data.push({
        categoryId,
        description: row.description,
        amount: round2(row.amount),
        competenceDate: parseDateOnlyBrt(row.competenceDate),
        dueDate: row.dueDate != null ? parseDateOnlyBrt(row.dueDate) : null,
        paidAt: row.paidAt != null ? parseDateOnlyBrt(row.paidAt) : null,
        status: row.paidAt != null ? 'PAID' : 'PENDING',
        payee: row.payee,
        paymentMethod: row.paymentMethod,
        notes: row.notes,
        createdById,
      })
    })

    let imported = 0
    if (data.length > 0) {
      const result = await this.prisma.expense.createMany({ data })
      imported = result.count
    }

    return { imported, errors }
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const cat = await this.prisma.expenseCategory.findUnique({ where: { id: categoryId } })
    if (!cat) throw new ExpenseError('Categoria não encontrada', 404)
  }
}
