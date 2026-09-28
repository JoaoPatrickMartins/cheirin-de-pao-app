/**
 * financial-alerts.service — coleta e dispara os alertas financeiros (⭐C1 · escopo firmado).
 *
 * As REGRAS moram em `lib/financial-alerts.ts`, puras. Aqui fica a coleta (compondo DRE, despesas e
 * metas), a deduplicação e o envio pelo canal que já existia.
 *
 * ## A deduplicação é a parte que faz o alerta sobreviver
 *
 * O job roda todo dia. Sem dedupe, uma conta atrasada notificaria o dono 30 vezes e um mês no
 * vermelho, 25 — e o resultado previsível é o toggle desligado, perdendo o canal inteiro,
 * inclusive para o mês em que ele importava. Cada alerta carrega uma `dedupeKey`, e a janela de
 * silêncio é consultada na própria coleção `Notification`: nada de estado novo para dessincronizar.
 *
 * ## Falhar aqui não pode derrubar nada
 *
 * É um cron de aviso. Toda a execução é best-effort e o erro é logado, nunca propagado — o mesmo
 * tratamento que os outros jobs do `plugins/cron.ts` recebem.
 */
import { FastifyInstance } from 'fastify'
import type { ExpenseStatus } from '@prisma/client'
import { monthWindow, monthKey } from '../../lib/date-range.js'
import { brtDateStr } from '../../lib/cutoff.js'
import { evaluateAlerts, type FinancialAlert, type AlertInputs } from '../../lib/financial-alerts.js'
import { NotificationsService } from '../notifications/notifications.service.js'
import { DreService } from './dre.service.js'

const round2 = (n: number) => Math.round(n * 100) / 100

/** Meses anteriores usados como base da média de anomalia. */
const ANOMALY_LOOKBACK_MONTHS = 3

/**
 * Janela de silêncio por tipo, em horas.
 *
 * Contas a pagar renova a cada dia (é uma ação diária). Os demais só voltam a falar no mês
 * seguinte — a chave de dedupe deles já carrega o mês, então a janela larga é uma segunda trava.
 */
const SILENCE_HOURS: Record<string, number> = {
  ADMIN_EXPENSE_DUE: 20,
  ADMIN_EXPENSE_ANOMALY: 24 * 25,
  ADMIN_MARGIN_DROP: 24 * 25,
  ADMIN_RESULT_NEGATIVE: 24 * 25,
  ADMIN_GOAL_AT_RISK: 24 * 25,
}

export class FinancialAlertsService {
  private notifications: NotificationsService
  private dre: DreService

  constructor(private fastify: FastifyInstance) {
    this.notifications = new NotificationsService(fastify)
    this.dre = new DreService(fastify)
  }

  private get prisma() {
    return this.fastify.prisma
  }

  /** Coleta, avalia e envia. Devolve os alertas efetivamente enviados (os demais foram calados). */
  async run(now: Date = new Date()): Promise<FinancialAlert[]> {
    const inputs = await this.collect(now)
    const candidates = evaluateAlerts(inputs)

    const sent: FinancialAlert[] = []
    for (const alert of candidates) {
      try {
        if (await this.wasRecentlySent(alert, now)) continue
        await this.notifications.notifyAdmins({
          type: alert.type,
          title: alert.title,
          body: alert.body,
          actionRoute: ROUTE_BY_TYPE[alert.type],
          // Campo próprio, nunca dentro do corpo: `body` é lido na tela e enviado no push.
          dedupeKey: alert.dedupeKey,
        })
        sent.push(alert)
      } catch (err) {
        this.fastify.log.warn({ err, type: alert.type }, '[financial-alerts] falha ao enviar — ignorado')
      }
    }
    return sent
  }

  /**
   * Já foi enviado dentro da janela de silêncio?
   *
   * Filtra por `dedupeKey`, não só por tipo: dois alertas de anomalia em categorias diferentes são
   * o mesmo `type` e precisam poder sair os dois.
   */
  private async wasRecentlySent(alert: FinancialAlert, now: Date): Promise<boolean> {
    const hours = SILENCE_HOURS[alert.type] ?? 24
    const since = new Date(now.getTime() - hours * 60 * 60 * 1000)
    const found = await this.prisma.notification.findFirst({
      where: {
        type: alert.type,
        createdAt: { gte: since },
        dedupeKey: alert.dedupeKey,
      },
      select: { id: true },
    })
    return found != null
  }

  /** Reúne os insumos das regras, compondo o que já existe. */
  private async collect(now: Date): Promise<AlertInputs> {
    const month = monthKey(
      new Date(now.getTime() - 3 * 60 * 60 * 1000).getUTCFullYear(),
      new Date(now.getTime() - 3 * 60 * 60 * 1000).getUTCMonth(),
    )
    const win = monthWindow(month, now)

    // Fração decorrida do mês — a mesma conta do relatório de metas.
    const monthEnd = monthWindow(month, new Date(win.startDate.getTime() + 62 * 86400000)).endDate
    const elapsed = Math.min(
      Math.max(
        (win.endDate.getTime() - win.startDate.getTime()) /
          (monthEnd.getTime() - win.startDate.getTime()),
        0,
      ),
      1,
    )

    const prevMonth = monthKey(
      Number(month.slice(0, 4)),
      Number(month.slice(5, 7)) - 2, // -1 para 0-based, -1 para o mês anterior
    )

    const [payable, categories, dreNow, drePrev, goal] = await Promise.all([
      this.payableBuckets(now),
      this.categoryAnomalyInputs(month),
      this.dre.getDre(win, 'cash'),
      this.dre.getDre(monthWindow(prevMonth, now), 'cash'),
      this.revenueGoal(month),
    ])

    return {
      month,
      elapsed,
      dueTomorrow: payable.dueTomorrow,
      overdue: payable.overdue,
      categories,
      grossMargin: {
        current: dreNow.dre.grossMarginPct / 100,
        // Mês anterior sem receita não serve de base: a "queda" seria só o mês ter começado.
        previous: drePrev.dre.grossRevenue > 0 ? drePrev.dre.grossMarginPct / 100 : null,
      },
      result: dreNow.dre.netProfit,
      goal,
    }
  }

  /** Contas vencendo AMANHÃ e já vencidas, por dia BRT — a mesma régua de `listPayable`. */
  private async payableBuckets(now: Date) {
    const pending = await this.prisma.expense.findMany({
      where: { status: 'PENDING' as ExpenseStatus },
      select: { amount: true, dueDate: true },
    })
    const today = brtDateStr(now)
    const tomorrow = brtDateStr(new Date(now.getTime() + 24 * 60 * 60 * 1000))

    const dueTomorrow = { count: 0, total: 0 }
    const overdue = { count: 0, total: 0 }
    for (const e of pending) {
      if (e.dueDate == null) continue
      const day = brtDateStr(e.dueDate)
      if (day < today) {
        overdue.count += 1
        overdue.total += e.amount
      } else if (day === tomorrow) {
        dueTomorrow.count += 1
        dueTomorrow.total += e.amount
      }
    }
    return {
      dueTomorrow: { ...dueTomorrow, total: round2(dueTomorrow.total) },
      overdue: { ...overdue, total: round2(overdue.total) },
    }
  }

  /**
   * Gasto do mês por categoria e a média dos meses anteriores.
   *
   * A média divide pelos meses que EXISTEM no histórico, não por 3 fixo — mesma regra do relatório
   * de despesas. Dividir por 3 quando só há 1 mês de base produziria uma média artificialmente
   * baixa e, com ela, uma enxurrada de falsas anomalias no começo da operação.
   */
  private async categoryAnomalyInputs(month: string) {
    const current = monthWindow(month)
    const y = Number(month.slice(0, 4))
    const m = Number(month.slice(5, 7)) - 1
    const firstPrev = monthWindow(monthKey(y, m - ANOMALY_LOOKBACK_MONTHS))

    const [curRows, prevRows, categories] = await Promise.all([
      this.prisma.expense.findMany({
        where: {
          status: { in: ['PENDING', 'PAID'] as ExpenseStatus[] },
          competenceDate: { gte: current.startDate, lt: current.endDate },
        },
        select: { categoryId: true, amount: true },
      }),
      this.prisma.expense.findMany({
        where: {
          status: { in: ['PENDING', 'PAID'] as ExpenseStatus[] },
          competenceDate: { gte: firstPrev.startDate, lt: current.startDate },
        },
        select: { categoryId: true, amount: true, competenceDate: true },
      }),
      this.prisma.expenseCategory.findMany({ select: { id: true, name: true } }),
    ])

    const nameById = new Map(categories.map((c) => [c.id, c.name]))
    const curBy = new Map<string, number>()
    for (const e of curRows) curBy.set(e.categoryId, (curBy.get(e.categoryId) ?? 0) + e.amount)

    // Soma por (categoria, mês) para saber em quantos meses a categoria de fato apareceu.
    const prevBy = new Map<string, Map<string, number>>()
    for (const e of prevRows) {
      const k = brtDateStr(e.competenceDate).slice(0, 7)
      const byMonth = prevBy.get(e.categoryId) ?? new Map<string, number>()
      byMonth.set(k, (byMonth.get(k) ?? 0) + e.amount)
      prevBy.set(e.categoryId, byMonth)
    }

    return [...curBy.entries()].map(([categoryId, cur]) => {
      const byMonth = prevBy.get(categoryId)
      const months = byMonth ? byMonth.size : 0
      const total = byMonth ? [...byMonth.values()].reduce((s, v) => s + v, 0) : 0
      return {
        categoryId,
        name: nameById.get(categoryId) ?? 'Categoria removida',
        current: round2(cur),
        previousAvg: months > 0 ? round2(total / months) : 0,
      }
    })
  }

  /** Meta de RECEITA do mês e o realizado, quando a meta existe. */
  private async revenueGoal(month: string): Promise<AlertInputs['goal']> {
    const budgets = await this.prisma.budget.findMany({
      where: { month, kind: 'REVENUE' },
      select: { categoryId: true, amount: true },
    })
    // Resolvido em código: `where: { categoryId: null }` não encontra documento sem a chave.
    const target = budgets.find((b) => (b.categoryId ?? null) === null)
    if (!target || !(target.amount > 0)) return null

    const win = monthWindow(month)
    const agg = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: 'PAID', createdAt: { gte: win.startDate, lt: win.endDate } },
    })
    return { target: target.amount, actual: round2(agg._sum.amount ?? 0) }
  }
}

/**
 * Separador invisível da chave de dedupe no corpo da notificação.
 *
 * Um caractere de largura zero: o admin nunca o vê, e a execução seguinte reconhece "este mesmo
 * aviso" sem precisar de coluna nova em `Notification` nem de coleção de controle.
 */
const DEDUPE_MARK = '​#'

/** Para onde cada alerta leva ao ser tocado. */
const ROUTE_BY_TYPE: Record<string, string> = {
  ADMIN_EXPENSE_DUE: '/admin/gestao/financeiro/contas-pagar',
  ADMIN_EXPENSE_ANOMALY: '/admin/gestao/financeiro/rel-despesas',
  ADMIN_MARGIN_DROP: '/admin/gestao/financeiro/margem',
  ADMIN_RESULT_NEGATIVE: '/admin/gestao/financeiro/dre',
  ADMIN_GOAL_AT_RISK: '/admin/gestao/financeiro/metas',
}
