import { FastifyInstance } from 'fastify'
import { brtDateStr, brtDayRange, isPastCutoffForDelivery } from '../../lib/cutoff.js'
import { reverseMarketOrder } from '../../lib/market-reversal.js'
import { notifyAdminMarketOrderCancelled } from './market-notify.js'

const AVULSO_KEY = 'avulsoUnit'
// Estados considerados "em aberto" (aparecem no acompanhamento; canceláveis antes do corte).
const OPEN_STATUSES = ['PENDING_PAYMENT', 'SCHEDULED'] as const

interface MarketOrderView {
  id: string
  status: string
  scheduledDate: string
  slotId: string
  deliveryTime: string | null
  breadQty: number
  items: { productId: string; name: string; qty: number; unitPrice: number }[]
  totalValue: number
  creditsApplied: number
  moneyAmount: number
  createdAt: string
  cancelable: boolean
  cancelReason: string | null
  /** Créditos devolvidos (só quando CANCELLED) — para "estornado em X pãezinhos". */
  refundedCredits: number | null
}

/**
 * MarketOrdersService — acompanhamento/histórico (C7) e cancelamento da Cestinha pelo cliente.
 * Cancelamento só antes do corte; estorno é **tudo em crédito** (inclusive a parte em dinheiro,
 * `ceil` a favor do cliente — DEC-36), idempotente por `referenceId`. Sem estorno no gateway.
 */
export class MarketOrdersService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  private async getAvulsoUnit(): Promise<number> {
    const s = await this.prisma.setting.findUnique({ where: { key: AVULSO_KEY } })
    const v = s ? parseFloat(s.value) : 0
    return Number.isFinite(v) && v > 0 ? v : 0
  }

  /** Slots ativos do condomínio do usuário (para o gate de corte). */
  private async userSlots(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { condominiumId: true } })
    if (!u?.condominiumId) return []
    const condo = await this.prisma.condominium.findUnique({
      where: { id: u.condominiumId },
      select: { deliverySlots: true },
    })
    return condo?.deliverySlots ?? []
  }

  private cutoffPassed(order: { slotId: string; deliveryTime: string | null; scheduledDate: Date }, slots: { slotId?: string | null; name: string; time: string; cutoffTime: string }[]): boolean {
    const slot =
      slots.find((s) => (s.slotId ?? s.name) === order.slotId) ??
      (order.deliveryTime ? slots.find((s) => s.time === order.deliveryTime) : undefined)
    const deliveryDateStr = brtDateStr(order.scheduledDate)
    // Sem slot resolvível (legado): permite só antes do dia da entrega.
    if (!slot) return Date.now() >= order.scheduledDate.getTime()
    return isPastCutoffForDelivery(slot.time, slot.cutoffTime, deliveryDateStr)
  }

  private serialize(
    order: {
      id: string
      status: string
      scheduledDate: Date
      slotId: string
      deliveryTime: string | null
      breadQty: number
      items: { productId: string; name: string; qty: number; unitPrice: number }[]
      totalValue: number
      creditsApplied: number
      moneyAmount: number
      createdAt: Date
      cancelReason: string | null
    },
    slots: Parameters<MarketOrdersService['cutoffPassed']>[1],
    refundedById: Map<string, number>,
  ): MarketOrderView {
    const isOpen = (OPEN_STATUSES as readonly string[]).includes(order.status)
    const cancelable = isOpen && !this.cutoffPassed(order, slots)
    return {
      id: order.id,
      status: order.status,
      scheduledDate: brtDateStr(order.scheduledDate),
      slotId: order.slotId,
      deliveryTime: order.deliveryTime,
      breadQty: order.breadQty,
      items: order.items.map((i) => ({ productId: i.productId, name: i.name, qty: i.qty, unitPrice: i.unitPrice })),
      totalValue: order.totalValue,
      creditsApplied: order.creditsApplied,
      moneyAmount: order.moneyAmount,
      createdAt: order.createdAt.toISOString(),
      cancelable,
      cancelReason: order.cancelReason,
      refundedCredits: order.status === 'CANCELLED' ? refundedById.get(order.id) ?? 0 : null,
    }
  }

  // Estornos MARKET_REFUND por pedido (para exibir "estornado em X pãezinhos").
  private async refundsFor(orderIds: string[]): Promise<Map<string, number>> {
    if (orderIds.length === 0) return new Map()
    const txs = await this.prisma.creditTransaction.findMany({
      where: { type: 'MARKET_REFUND', referenceId: { in: orderIds } },
      select: { referenceId: true, quantity: true },
    })
    const map = new Map<string, number>()
    for (const t of txs) {
      if (!t.referenceId) continue
      map.set(t.referenceId, (map.get(t.referenceId) ?? 0) + t.quantity)
    }
    return map
  }

  private async view(orders: Parameters<MarketOrdersService['serialize']>[0][], userId: string): Promise<MarketOrderView[]> {
    const slots = await this.userSlots(userId)
    const refunds = await this.refundsFor(orders.filter((o) => o.status === 'CANCELLED').map((o) => o.id))
    return orders.map((o) => this.serialize(o, slots, refunds))
  }

  // ── Acompanhamento / histórico (C7) ──────────────────────────────────────────
  async getToday(userId: string): Promise<MarketOrderView[]> {
    const { start, end } = brtDayRange(new Date())
    const orders = await this.prisma.marketOrder.findMany({
      where: { userId, scheduledDate: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
      orderBy: { scheduledDate: 'asc' },
    })
    return this.view(orders, userId)
  }

  async getNext(userId: string): Promise<MarketOrderView[]> {
    const { end } = brtDayRange(new Date())
    const orders = await this.prisma.marketOrder.findMany({
      where: { userId, scheduledDate: { gt: end }, status: { in: ['SCHEDULED', 'OUT_FOR_DELIVERY', 'SEPARATED', 'PENDING_PAYMENT'] } },
      orderBy: { scheduledDate: 'asc' },
    })
    return this.view(orders, userId)
  }

  async getHistory(userId: string, days = 30): Promise<MarketOrderView[]> {
    const since = new Date()
    since.setDate(since.getDate() - days)
    const orders = await this.prisma.marketOrder.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { scheduledDate: 'desc' },
    })
    return this.view(orders, userId)
  }

  // ── Cancelamento + estorno (MKT-30/31/32) ────────────────────────────────────
  async cancelOrder(userId: string, orderId: string): Promise<MarketOrderView> {
    const order = await this.prisma.marketOrder.findUnique({ where: { id: orderId } })
    if (!order || order.userId !== userId) throw { statusCode: 404, message: 'Pedido não encontrado' }

    if (order.status === 'CANCELLED') {
      // Idempotente: já cancelado → devolve a visão atual.
      return (await this.view([order], userId))[0]
    }
    if (!(OPEN_STATUSES as readonly string[]).includes(order.status)) {
      throw { statusCode: 422, message: 'Este pedido não pode mais ser cancelado' }
    }

    const slots = await this.userSlots(userId)
    if (this.cutoffPassed(order, slots)) {
      throw {
        statusCode: 422,
        code: 'CUTOFF_PASSED',
        message: 'O horário de corte deste pedido já passou; o cancelamento não está mais disponível.',
      }
    }

    // Estoque + estorno tudo-em-crédito + status terminal, na lib compartilhada com o admin
    // (`lib/market-reversal.ts`) — a matemática do estorno não pode viver em dois lugares.
    const avulsoUnit = await this.getAvulsoUnit()
    const refundedCredits = await reverseMarketOrder(this.prisma, order, {
      status: 'CANCELLED',
      reason: 'Cancelado pelo cliente',
      refundCredits: true,
      returnStock: true,
      avulsoUnit,
    })

    // F4 — avisa os admins, paridade com o cancelamento do pedido único de pão. Só quando o
    // pedido estava CONFIRMADO: um `PENDING_PAYMENT` desistido nunca entrou na operação (não foi
    // à fornada nem à separação), então avisar seria ruído — mesma regra do sweep.
    if (order.status !== 'PENDING_PAYMENT') {
      await notifyAdminMarketOrderCancelled(this.fastify, order, { refundedCredits })
    }

    const updated = await this.prisma.marketOrder.findUnique({ where: { id: orderId } })
    return (await this.view([updated!], userId))[0]
  }
}
