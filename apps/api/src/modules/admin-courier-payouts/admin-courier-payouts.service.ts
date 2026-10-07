import type { FastifyInstance } from 'fastify'
import { NotificationType, type CourierPayout } from '@prisma/client'
import { payoutTotals, payWeekOf } from '@cheirin-de-pao/shared'
import { brtDateStr } from '../../lib/cutoff.js'
import { isMonthClosed } from '../admin-financial/financial-close.snapshot.js'
import { AdminExpensesService } from '../admin-expenses/admin-expenses.service.js'
import { NotificationsService } from '../notifications/notifications.service.js'
import {
  addDays,
  computeWeek,
  ensureLastClosedWeek,
  estimateView,
  expensesOf,
  materializeWeek,
  payoutsSince,
  payoutView,
  weekStateOf,
  type PayoutView,
  type WeekState,
} from './payouts.core.js'

/**
 * A8 · Pagamentos dos entregadores (plano do entregador, Onda 7). A proposta da semana fechada é
 * revisada pelo admin: editar (valor final + motivo), aprovar — vira até 2 despesas no Financeiro
 * (T-15) — ou descartar. Mês fechado no Financeiro bloqueia a aprovação (409).
 */

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000
/** "YYYY-MM-DD" → 00:00 BRT do dia (o mesmo do módulo de despesas). */
const dayToDate = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, dd) + BRT_OFFSET_MS)
}
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const money = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`

const OPEN = ['PENDING', 'EDITED'] as const
const ORDER: Record<string, number> = { PENDING: 0, EDITED: 0, ESTIMATE: 0, APPROVED: 1, DISCARDED: 2 }

const CATEGORIES = {
  remuneration: { name: 'Entregador', group: 'PEOPLE' as const, emoji: '🛵', sortOrder: 10 },
  fuel: { name: 'Combustível', group: 'OPERATION' as const, emoji: '⛽', sortOrder: 20 },
}

export interface WeekList {
  weekStart: string
  weekEnd: string
  state: WeekState
  since: string
  proposals: PayoutView[]
  totals: { count: number; open: number; estimated: number; final: number }
}

export class AdminCourierPayoutsService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  private async people(ids: string[]) {
    const rows = ids.length
      ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, courierPhotoUrl: true } })
      : []
    return new Map(rows.map((u) => [u.id, { name: u.name, photoUrl: u.courierPhotoUrl ?? null }]))
  }

  private async views(payouts: CourierPayout[], openRuns: Map<string, number> = new Map()): Promise<PayoutView[]> {
    const [who, expenses] = await Promise.all([this.people([...new Set(payouts.map((p) => p.courierId))]), expensesOf(this.prisma, payouts)])
    return payouts.map((p) => payoutView(p, who.get(p.courierId) ?? { name: 'Entregador', photoUrl: null }, expenses, openRuns.get(p.courierId) ?? 0))
  }

  /** Semana de pagamento. Sem `week`, a última semana fechada (a que está para aprovar). */
  async list(week: string | undefined, now: Date = new Date()): Promise<WeekList> {
    const today = brtDateStr(now)
    const since = await payoutsSince(this.prisma, now)
    const weekStart = payWeekOf(week ?? addDays(payWeekOf(today).weekStart, -7)).weekStart
    const { weekEnd } = payWeekOf(weekStart)
    const state = weekStateOf(weekStart, today, since)

    let proposals: PayoutView[] = []
    if (state === 'CLOSED') {
      const { payouts, calc } = await materializeWeek(this.prisma, weekStart)
      proposals = await this.views(payouts, new Map(calc.map((c) => [c.courierId, c.openRuns])))
    } else if (state === 'CURRENT') {
      proposals = (await computeWeek(this.prisma, weekStart)).map((c) => estimateView(c, weekStart))
    } else if (state === 'BEFORE_START') {
      proposals = await this.views(await this.prisma.courierPayout.findMany({ where: { weekStart } }))
    }
    proposals.sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name, 'pt-BR'))
    const live = proposals.filter((p) => p.status !== 'DISCARDED')
    const round2 = (n: number) => Math.round(n * 100) / 100
    return {
      weekStart,
      weekEnd,
      state,
      since,
      proposals,
      totals: {
        count: live.length,
        open: proposals.filter((p) => p.status === 'PENDING' || p.status === 'EDITED').length,
        estimated: round2(live.reduce((n, p) => n + p.estimated, 0)),
        final: round2(live.reduce((n, p) => n + p.final, 0)),
      },
    }
  }

  private async findOpen(id: string): Promise<CourierPayout> {
    const p = await this.prisma.courierPayout.findUnique({ where: { id } })
    if (!p) throw { statusCode: 404, message: 'Proposta não encontrada' }
    if (p.status === 'APPROVED') throw { statusCode: 409, message: 'Esta proposta já foi aprovada' }
    if (p.status === 'DISCARDED') throw { statusCode: 409, message: 'Esta proposta foi descartada' }
    return p
  }

  private async one(id: string): Promise<PayoutView> {
    const p = await this.prisma.courierPayout.findUniqueOrThrow({ where: { id } })
    return (await this.views([p]))[0]
  }

  /** Editar: valor final da remuneração e do combustível + motivo do ajuste. @throws 404 · 409 */
  async edit(id: string, body: { remunerationFinal: number; fuelFinal: number; adjustReason?: string | null }): Promise<PayoutView> {
    const p = await this.findOpen(id)
    await this.prisma.courierPayout.update({
      where: { id: p.id },
      data: {
        remunerationFinal: Math.round(body.remunerationFinal * 100) / 100,
        fuelFinal: Math.round(body.fuelFinal * 100) / 100,
        adjustReason: body.adjustReason?.trim() || null,
        status: 'EDITED',
      },
    })
    return this.one(id)
  }

  /** Descartar (não vira despesa). @throws 404 · 409 */
  async discard(id: string, reason: string): Promise<PayoutView> {
    const p = await this.findOpen(id)
    await this.prisma.courierPayout.update({ where: { id: p.id }, data: { status: 'DISCARDED', discardReason: reason.trim() } })
    return this.one(id)
  }

  private async categoryId(kind: keyof typeof CATEGORIES): Promise<string> {
    const c = CATEGORIES[kind]
    const found = await this.prisma.expenseCategory.findUnique({ where: { name: c.name }, select: { id: true } })
    if (found) return found.id
    // Apagada pelo admin e ainda não semeada de novo: recria com o padrão do seed.
    const created = await this.prisma.expenseCategory.create({ data: { name: c.name, group: c.group, isFixed: false, emoji: c.emoji, sortOrder: c.sortOrder } })
    return created.id
  }

  /**
   * Aprovar: cria a despesa do entregador e a do combustível (o que for > 0), competência = mês do
   * último dia da semana, favorecido = o entregador; pago agora (data + forma) ou a pagar
   * (vencimento). @throws 400 nada a pagar / sem vencimento · 404 · 409 já resolvida ou mês fechado
   */
  async approve(
    id: string,
    body: { paid: boolean; paidAt?: string; paymentMethod?: string | null; dueDate?: string },
    adminId: string,
    now: Date = new Date(),
  ): Promise<PayoutView> {
    const p = await this.findOpen(id)
    const prevStatus = p.status
    const t = payoutTotals(p)
    if (t.final <= 0) throw { statusCode: 400, message: 'Nada a pagar nesta proposta. Descarte-a.' }
    if (!body.paid && !body.dueDate) throw { statusCode: 400, message: 'Informe o vencimento do pagamento.' }
    const closed = await isMonthClosed(this.prisma, dayToDate(p.weekEnd))
    if (closed) {
      throw {
        statusCode: 409,
        message: `O mês ${closed} está FECHADO e não aceita novos lançamentos. Reabra o fechamento em Financeiro › Fechamento de mês para aprovar.`,
      }
    }
    const courier = await this.prisma.user.findUnique({ where: { id: p.courierId }, select: { name: true } })
    const name = (courier?.name ?? 'Entregador').slice(0, 80)
    const paidAt = body.paid ? body.paidAt ?? brtDateStr(now) : undefined
    const method = body.paymentMethod?.trim() || undefined

    // Reserva a proposta antes de lançar: dois cliques (ou dois admins) não geram despesa em dobro.
    const claimed = await this.prisma.courierPayout.updateMany({
      where: { id: p.id, status: { in: [...OPEN] } },
      data: {
        status: 'APPROVED',
        approvedAt: now,
        approvedById: adminId,
        paidAt: paidAt ? dayToDate(paidAt) : null,
        dueDate: body.paid ? null : dayToDate(body.dueDate!),
        paymentMethod: method ?? null,
      },
    })
    if (claimed.count === 0) throw { statusCode: 409, message: 'Esta proposta já foi resolvida' }

    const expenses = new AdminExpensesService(this.fastify)
    const created: string[] = []
    const period = `${ddmm(p.weekStart)}–${ddmm(p.weekEnd)}`
    try {
      const lines: Array<[keyof typeof CATEGORIES, number, string]> = [
        ['remuneration', t.remuneration, `Entregador · ${name} · ${period}`],
        ['fuel', t.fuel, `Combustível · ${name} · ${period}`],
      ]
      for (const [kind, amount, description] of lines) {
        if (!(amount > 0)) continue
        const e = await expenses.create(
          {
            categoryId: await this.categoryId(kind),
            description: description.slice(0, 140),
            amount,
            competenceDate: p.weekEnd,
            ...(paidAt ? { paidAt } : { dueDate: body.dueDate }),
            payee: name,
            ...(method ? { paymentMethod: method } : {}),
            notes: `Pagamento semanal do entregador (${period}), aprovado em Pagamentos.`,
          },
          adminId,
        )
        created.push(e.id)
      }
    } catch (err) {
      // Desfaz: a proposta volta a ser revisável e nada fica lançado pela metade.
      if (created.length) await this.prisma.expense.deleteMany({ where: { id: { in: created } } }).catch(() => {})
      await this.prisma.courierPayout
        .update({ where: { id: p.id }, data: { status: prevStatus, approvedAt: null, approvedById: null, paidAt: null, dueDate: null, paymentMethod: null } })
        .catch(() => {})
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 409 || e.statusCode === 400) throw { statusCode: e.statusCode, message: e.message }
      throw err
    }
    await this.prisma.courierPayout.update({ where: { id: p.id }, data: { expenseIds: created } })
    return this.one(id)
  }

  /** Histórico: aprovadas (pago / a pagar, pelas despesas) e descartadas, da mais recente. */
  async history(courierId?: string, limit = 30): Promise<PayoutView[]> {
    const rows = await this.prisma.courierPayout.findMany({
      where: { status: { in: ['APPROVED', 'DISCARDED'] }, ...(courierId ? { courierId } : {}) },
      orderBy: [{ weekStart: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
    })
    return this.views(rows)
  }

  /** Selo do card de Entregadores: propostas abertas (gera a semana passada antes de contar). */
  async summary(now: Date = new Date()): Promise<{ open: number }> {
    await this.ensureLastWeek(now)
    return { open: await this.prisma.courierPayout.count({ where: { status: { in: [...OPEN] } } }) }
  }

  private ensureLastWeek(now: Date): Promise<string | null> {
    return ensureLastClosedWeek(this.prisma, now, this.fastify.log)
  }

  /**
   * Aviso de segunda (cron das 8h): "Pagamento a aprovar" com as propostas abertas da semana que
   * fechou. Um por semana (dedupe pela chave). @returns quantas propostas avisou
   */
  async notifyPending(now: Date = new Date()): Promise<number> {
    const weekday = new Date(now.getTime() - BRT_OFFSET_MS).getUTCDay()
    if (weekday !== 1) return 0
    const week = await this.ensureLastWeek(now)
    if (!week) return 0
    const open = await this.prisma.courierPayout.findMany({ where: { weekStart: week, status: { in: [...OPEN] } } })
    if (open.length === 0) return 0
    const dedupeKey = `payout:${week}`
    const sent = await this.prisma.notification.findFirst({ where: { type: NotificationType.ADMIN_PAYOUT_PENDING, dedupeKey }, select: { id: true } })
    if (sent) return 0
    const total = open.reduce((n, p) => n + payoutTotals(p).final, 0)
    const { weekEnd } = payWeekOf(week)
    await new NotificationsService(this.fastify).notifyAdmins({
      type: NotificationType.ADMIN_PAYOUT_PENDING,
      title: 'Pagamento a aprovar',
      body: `${open.length === 1 ? '1 proposta' : `${open.length} propostas`} da semana ${ddmm(week)}–${ddmm(weekEnd)} · total estimado ${money(total)}.`,
      actionRoute: '/admin',
      dedupeKey,
    })
    return open.length
  }
}
