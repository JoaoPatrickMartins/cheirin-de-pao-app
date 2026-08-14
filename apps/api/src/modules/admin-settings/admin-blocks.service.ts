import type { FastifyInstance } from 'fastify'
import { NotificationType } from '@prisma/client'
import { toMilli, fromMilli } from '@cheirin-de-pao/shared'
import { brtDateStr, brtDayRange, brtNoonFromStr, dayKeyOf } from '../../lib/cutoff.js'
import { validateBlockRange, type DeliveryBlockRow } from '../../lib/delivery-rules.js'
import { reverseMarketOrder, refundableCreditsMilli } from '../../lib/market-reversal.js'
import { CONFIRMED_MARKET_STATUSES } from '../../lib/bread-demand.js'
import { NotificationsService } from '../notifications/notifications.service.js'

/**
 * admin-blocks.service.ts — CRUD dos bloqueios de DATA/PERÍODO (`DeliveryBlock`).
 *
 * Complementa o bloqueio por dia da semana (recorrente) com datas pontuais: feriado, férias da
 * padaria (global) ou obra/portaria fechada (de um condomínio).
 *
 * O fluxo de criação é em DOIS PASSOS de propósito — bloquear uma data que já tem pedidos
 * materializados é uma decisão de negócio, não um efeito colateral:
 *   1. `getImpact` (dry-run) responde "o que existe nessas datas".
 *   2. `createBlock({ cancelExisting })` grava o bloqueio e, se o admin pediu, cancela os
 *      pedidos com estorno de créditos e devolução de estoque.
 *
 * Sem `cancelExisting`, o bloqueio só impede pedidos NOVOS (mesmo comportamento do bloqueio por
 * dia da semana) e o que já existe segue de pé para o admin resolver na mão.
 */

/** O que existe nas datas de um bloqueio — a prévia que o admin confirma. */
export interface BlockImpact {
  /** Dias do período que ainda estão por vir (o passado não é cancelável). */
  days: number
  orders: number
  breads: number
  cestinhas: number
  cestinhaItems: number
  /** Clientes distintos com pedido e/ou Cestinha no período. */
  clients: number
  /** Agendas ativas que entregam em algum dia da semana coberto pelo período. */
  schedules: number
  /** Pãezinhos que voltariam para os clientes se `cancelExisting` for usado. */
  refundableCredits: number
}

export interface CreateBlockResult {
  block: DeliveryBlockRow
  cancelled: { orders: number; cestinhas: number; refundedCredits: number }
  notified: number
}

/** Status de `Order` que ainda ocupam uma entrega (e portanto são canceláveis). */
const LIVE_ORDER_STATUSES = ['SCHEDULED', 'SEPARATED', 'OUT_FOR_DELIVERY'] as const

export class AdminBlocksService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * Bloqueios visíveis para o admin. Sem `condominiumId` lista TODOS (globais + de todos os
   * condomínios) — é a visão da tela "Padrão". Com `condominiumId`, os daquele condomínio + os
   * globais (que também valem lá).
   *
   * Por padrão esconde o que já terminou; `includePast` traz o histórico.
   */
  async listBlocks(
    condominiumId?: string | null,
    includePast = false,
  ): Promise<Array<DeliveryBlockRow & { condominiumName: string | null; isPast: boolean }>> {
    const today = brtDateStr(new Date(), 0)
    const rows = await this.prisma.deliveryBlock.findMany({
      where: {
        ...(condominiumId
          ? { OR: [{ condominiumId }, { condominiumId: null }, { condominiumId: { isSet: false } }] }
          : {}),
        ...(includePast ? {} : { endDate: { gte: today } }),
      },
      orderBy: { startDate: 'asc' },
    })

    // Nomes dos condomínios num único fetch (a lista de condos é pequena).
    const condoIds = [...new Set(rows.map((r) => r.condominiumId).filter((v): v is string => !!v))]
    const condos = condoIds.length
      ? await this.prisma.condominium.findMany({
          where: { id: { in: condoIds } },
          select: { id: true, name: true },
        })
      : []
    const nameById = new Map(condos.map((c) => [c.id, c.name]))

    return rows.map((r) => ({
      id: r.id,
      condominiumId: r.condominiumId ?? null,
      startDate: r.startDate,
      endDate: r.endDate,
      reason: r.reason ?? null,
      condominiumName: r.condominiumId ? (nameById.get(r.condominiumId) ?? null) : null,
      isPast: r.endDate < today,
    }))
  }

  /**
   * Prévia de impacto de um bloqueio. Só olha do dia de HOJE em diante — o que já passou não é
   * cancelável (e cancelar retroativamente estornaria pão já entregue).
   *
   * @throws { statusCode: 422 } período inválido
   */
  async getImpact(
    condominiumId: string | null | undefined,
    startDate: string,
    endDate: string,
  ): Promise<BlockImpact> {
    const invalid = validateBlockRange(startDate, endDate)
    if (invalid) throw { statusCode: 422, message: invalid }

    const today = brtDateStr(new Date(), 0)
    const effectiveStart = startDate < today ? today : startDate
    const { orders, marketOrders, days } = await this.findAffected(
      condominiumId,
      effectiveStart,
      endDate,
    )

    const avulsoUnit = await this.getAvulsoUnit()
    const clients = new Set<string>([
      ...orders.map((o) => o.userId),
      ...marketOrders.map((m) => m.userId),
    ])

    // Pãezinhos que voltariam: os do pão (quantity) + o estorno da Cestinha (crédito aplicado +
    // parte em dinheiro convertida) — mesma conta do estorno real, para a prévia não mentir.
    const refundMilli =
      orders.reduce((s, o) => s + toMilli(o.quantity), 0) +
      marketOrders.reduce((s, m) => s + refundableCreditsMilli(m, avulsoUnit), 0)

    return {
      days,
      orders: orders.length,
      breads: orders.reduce((s, o) => s + o.quantity, 0) + marketOrders.reduce((s, m) => s + m.breadQty, 0),
      cestinhas: marketOrders.length,
      cestinhaItems: marketOrders.reduce((s, m) => s + m.items.reduce((n, i) => n + i.qty, 0), 0),
      clients: clients.size,
      schedules: (await this.scheduleUserIdsInRange(condominiumId, effectiveStart, endDate)).length,
      refundableCredits: fromMilli(refundMilli),
    }
  }

  /**
   * Cria o bloqueio. Com `cancelExisting`, cancela no mesmo passo os pedidos e Cestinhas das
   * datas cobertas (estorno de créditos + devolução de estoque) e avisa os clientes.
   *
   * O bloqueio é gravado ANTES dos cancelamentos: se algo falhar no meio, o pior caso é um
   * pedido não cancelado numa data que já está corretamente bloqueada — nunca o inverso.
   *
   * @throws { statusCode: 422 } período inválido
   * @throws { statusCode: 404 } condomínio inexistente
   */
  async createBlock(input: {
    condominiumId?: string | null
    startDate: string
    endDate: string
    reason?: string
    cancelExisting?: boolean
  }): Promise<CreateBlockResult> {
    const invalid = validateBlockRange(input.startDate, input.endDate)
    if (invalid) throw { statusCode: 422, message: invalid }

    if (input.condominiumId) {
      const exists = await this.prisma.condominium.findUnique({
        where: { id: input.condominiumId },
        select: { id: true },
      })
      if (!exists) throw { statusCode: 404, message: 'Condomínio não encontrado' }
    }

    const created = await this.prisma.deliveryBlock.create({
      data: {
        ...(input.condominiumId ? { condominiumId: input.condominiumId } : {}),
        startDate: input.startDate,
        endDate: input.endDate,
        ...(input.reason ? { reason: input.reason } : {}),
      },
    })
    const block: DeliveryBlockRow = {
      id: created.id,
      condominiumId: created.condominiumId ?? null,
      startDate: created.startDate,
      endDate: created.endDate,
      reason: created.reason ?? null,
    }

    const cancelled = input.cancelExisting
      ? await this.cancelInRange(block)
      : { orders: 0, cestinhas: 0, refundedCredits: 0 }

    const notified = await this.notifyAffected(block, input.cancelExisting === true)

    this.fastify.log.info(
      { block, cancelled, notified },
      '[admin-blocks] bloqueio de data criado',
    )
    return { block, cancelled, notified }
  }

  /**
   * Remove um bloqueio. NÃO ressuscita pedidos cancelados — o estorno já devolveu os créditos e
   * o cliente pede de novo se quiser (recriar a Order sem novo débito duplicaria o crédito).
   *
   * @throws { statusCode: 404 } bloqueio inexistente
   */
  async deleteBlock(id: string): Promise<void> {
    const existing = await this.prisma.deliveryBlock.findUnique({ where: { id }, select: { id: true } })
    if (!existing) throw { statusCode: 404, message: 'Bloqueio não encontrado' }
    await this.prisma.deliveryBlock.delete({ where: { id } })
    this.fastify.log.info({ id }, '[admin-blocks] bloqueio de data removido')
  }

  // ---------------------------------------------------------------- internos

  /** Preço do pão avulso — converte a parte em dinheiro da Cestinha em pãezinhos no estorno. */
  private async getAvulsoUnit(): Promise<number> {
    const row = await this.prisma.setting.findUnique({ where: { key: 'avulsoUnit' } })
    const parsed = row ? parseFloat(row.value) : 0
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }

  /** Janela UTC que cobre os dias BRT de `startDate` até `endDate` (inclusive nas duas pontas). */
  private rangeWindow(startDate: string, endDate: string): { start: Date; end: Date; days: number } {
    const start = brtDayRange(brtNoonFromStr(startDate)).start
    const end = brtDayRange(brtNoonFromStr(endDate)).end
    const days = Math.max(
      0,
      Math.round(
        (brtNoonFromStr(endDate).getTime() - brtNoonFromStr(startDate).getTime()) / 86_400_000,
      ) + 1,
    )
    return { start, end, days }
  }

  /**
   * Pedidos e Cestinhas "vivos" nas datas do período. Bloqueio de condomínio filtra por ele;
   * bloqueio global pega todos.
   */
  private async findAffected(
    condominiumId: string | null | undefined,
    startDate: string,
    endDate: string,
  ) {
    const { start, end, days } = this.rangeWindow(startDate, endDate)
    const scope = condominiumId ? { condominiumId } : {}

    const [orders, marketOrders] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          ...scope,
          status: { in: [...LIVE_ORDER_STATUSES] },
          scheduledDate: { gte: start, lte: end },
        },
        select: { id: true, userId: true, quantity: true, scheduledDate: true },
      }),
      this.prisma.marketOrder.findMany({
        where: {
          ...scope,
          status: { in: [...CONFIRMED_MARKET_STATUSES] },
          scheduledDate: { gte: start, lte: end },
        },
        select: {
          id: true,
          userId: true,
          status: true,
          breadQty: true,
          creditsAppliedMilli: true,
          moneyAmount: true,
          scheduledDate: true,
          items: { select: { productId: true, qty: true } },
        },
      }),
    ])

    return { orders, marketOrders, days }
  }

  /**
   * Cancela pedidos e Cestinhas do período, estornando créditos. Do dia de HOJE em diante — o que
   * já passou não é tocado.
   *
   * Cada item é independente: uma falha isolada é logada e o laço continua (melhor cancelar 9 de
   * 10 do que abortar tudo). O estorno é idempotente por `referenceId`.
   */
  private async cancelInRange(block: DeliveryBlockRow) {
    const today = brtDateStr(new Date(), 0)
    const startDate = block.startDate < today ? today : block.startDate
    if (block.endDate < today) return { orders: 0, cestinhas: 0, refundedCredits: 0 }

    const { orders, marketOrders } = await this.findAffected(
      block.condominiumId,
      startDate,
      block.endDate,
    )
    const avulsoUnit = await this.getAvulsoUnit()
    const reason = block.reason
      ? `Data bloqueada pela operação — ${block.reason}`
      : 'Data bloqueada pela operação'

    let refundedMilli = 0
    let cancelledOrders = 0
    for (const order of orders) {
      try {
        const existingRefund = await this.prisma.creditTransaction.findFirst({
          where: { type: 'REFUND', referenceId: order.id },
          select: { id: true },
        })
        await this.prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason },
          })
          if (!existingRefund) {
            await tx.creditTransaction.create({
              data: {
                userId: order.userId,
                type: 'REFUND',
                quantityMilli: toMilli(order.quantity),
                referenceId: order.id,
                description: `Data bloqueada — ${order.quantity} ${order.quantity === 1 ? 'pãozin' : 'pãezins'} devolvidos`,
                reason,
              },
            })
            await tx.user.update({
              where: { id: order.userId },
              data: { creditMilli: { increment: toMilli(order.quantity) } },
            })
          }
        })
        if (!existingRefund) refundedMilli += toMilli(order.quantity)
        cancelledOrders++
      } catch (err) {
        this.fastify.log.error(
          { orderId: order.id, err },
          '[admin-blocks] falha ao cancelar pedido de data bloqueada',
        )
      }
    }

    let cancelledMarket = 0
    for (const mo of marketOrders) {
      try {
        // reverseMarketOrder já é idempotente por MARKET_REFUND e devolve o estoque.
        const refunded = await reverseMarketOrder(this.prisma, mo, {
          status: 'CANCELLED',
          reason,
          refundCredits: true,
          returnStock: true,
          avulsoUnit,
          description: 'Cestinha cancelada — data bloqueada pela operação',
        })
        refundedMilli += toMilli(refunded)
        cancelledMarket++
      } catch (err) {
        this.fastify.log.error(
          { marketOrderId: mo.id, err },
          '[admin-blocks] falha ao cancelar Cestinha de data bloqueada',
        )
      }
    }

    return {
      orders: cancelledOrders,
      cestinhas: cancelledMarket,
      refundedCredits: fromMilli(refundedMilli),
    }
  }

  /**
   * Avisa (in-app + push best-effort) os clientes afetados: quem tinha pedido/Cestinha nas datas
   * e quem tem agenda ativa em algum dia da semana coberto. Um aviso por cliente.
   *
   * Nunca quebra o fluxo — o bloqueio já está gravado quando isso roda.
   */
  private async notifyAffected(block: DeliveryBlockRow, cancelled: boolean): Promise<number> {
    try {
      const today = brtDateStr(new Date(), 0)
      const startDate = block.startDate < today ? today : block.startDate
      if (block.endDate < today) return 0

      const { orders, marketOrders } = await this.findAffected(
        block.condominiumId,
        startDate,
        block.endDate,
      )
      const affected = new Set<string>([
        ...orders.map((o) => o.userId),
        ...marketOrders.map((m) => m.userId),
      ])

      // Clientes com agenda ativa nos dias da semana cobertos — também deixam de receber.
      const scheduleUsers = await this.scheduleUserIdsInRange(block.condominiumId, startDate, block.endDate)
      for (const id of scheduleUsers) affected.add(id)
      if (affected.size === 0) return 0

      const periodo = this.formatPeriod(block)
      const motivo = block.reason ? ` (${block.reason})` : ''
      const body = cancelled
        ? `Não haverá entrega em ${periodo}${motivo}. Os pãezins dos pedidos desse período voltaram para o seu saldo.`
        : `Não haverá entrega em ${periodo}${motivo}. Confira sua agenda e seus pedidos.`

      const notifications = new NotificationsService(this.fastify)
      let sent = 0
      for (const userId of affected) {
        try {
          await notifications.notifyUser(userId, {
            type: NotificationType.RECONFIGURE,
            title: 'Sem entrega nesse período',
            body,
            actionRoute: '/client/agenda',
          })
          sent++
        } catch (err) {
          this.fastify.log.warn(
            { userId, err },
            '[admin-blocks] falha ao notificar cliente de data bloqueada',
          )
        }
      }
      return sent
    } catch (err) {
      this.fastify.log.warn({ err }, '[admin-blocks] falha ao avisar clientes — ignorado')
      return 0
    }
  }

  /**
   * userIds com agenda ativa que entrega em algum dia da semana coberto pelo período.
   *
   * Agendas NÃO são canceladas (a agenda é do cliente) — o corte simplesmente não gera nessas
   * datas. Isto serve para (a) contar afetados na prévia e (b) avisar quem vai ficar sem pão.
   */
  private async scheduleUserIdsInRange(
    condominiumId: string | null | undefined,
    startDate: string,
    endDate: string,
  ): Promise<string[]> {
    const { days } = this.rangeWindow(startDate, endDate)
    const covered = new Set<string>()
    for (let i = 0; i < Math.min(days, 7); i++) {
      covered.add(dayKeyOf(brtNoonFromStr(brtDateStr(brtNoonFromStr(startDate), i))))
    }

    const schedules = await this.prisma.schedule.findMany({
      where: { isActive: true, ...(condominiumId ? { condominiumId } : {}) },
      select: { userId: true, days: true, weeklyQty: true, pausedAt: true },
    })

    const out: string[] = []
    for (const s of schedules) {
      if (s.pausedAt) continue
      const buckets: Array<Record<string, unknown>> = []
      if (s.days && typeof s.days === 'object') {
        buckets.push(...Object.values(s.days as Record<string, Record<string, unknown>>))
      }
      if (s.weeklyQty && typeof s.weeklyQty === 'object') {
        buckets.push(s.weeklyQty as Record<string, unknown>)
      }
      const hit = buckets.some(
        (wq) => wq && [...covered].some((d) => Number((wq as Record<string, unknown>)[d] ?? 0) > 0),
      )
      if (hit) out.push(s.userId)
    }
    return out
  }

  /** "25/12" ou "24/12 a 02/01" — mesma formatação da mensagem ao cliente. */
  private formatPeriod(block: DeliveryBlockRow): string {
    const fmt = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`
    return block.startDate === block.endDate
      ? fmt(block.startDate)
      : `${fmt(block.startDate)} a ${fmt(block.endDate)}`
  }
}
