// admin-separation.service.ts — etapa de separação (recebimento → conferência → cupom → conclusão)
//
// Lê os pedidos JÁ materializados (Order) de uma data de entrega e os agrupa por
// condomínio → turno → cliente, com o status de separação de cada um. Concluir um
// lote (condomínio + turno) move seus pedidos SCHEDULED → SEPARATED, liberando-os
// para a divisão de entregas (ver admin-orders: gate em getDivisionSuggestion).

import { FastifyInstance } from 'fastify'
import { AdminOrdersService } from '../admin-orders/admin-orders.service.js'
import { brtDateStr, brtNoonFromStr, brtDayRange } from '../../lib/cutoff.js'

const DEFAULT_SLOT_LABELS: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde' }

function fallbackSlotLabel(slotId: string): string {
  if (!slotId) return 'Sem horário'
  return DEFAULT_SLOT_LABELS[slotId] ?? slotId.charAt(0).toUpperCase() + slotId.slice(1)
}

/** Um pedido na tela de separação (um cupom = um pedido = um cliente/turno). */
export interface SeparationOrder {
  orderId: string
  userId: string
  name: string
  block: string
  apartment: string
  quantity: number
  slotId: string
  slotLabel: string
  type: 'SINGLE' | 'SCHEDULED'
  status: string
  separated: boolean
}

/** Um turno (lote físico) de um condomínio. */
export interface SeparationSlot {
  slotId: string
  slotLabel: string
  totalDeliveries: number
  separatedDeliveries: number
  totalBreads: number
  separatedBreads: number
  concluded: boolean
  orders: SeparationOrder[]
}

export interface SeparationCondo {
  condominiumId: string
  name: string
  totalDeliveries: number
  separatedDeliveries: number
  totalBreads: number
  separatedBreads: number
  slots: SeparationSlot[]
}

export interface SeparationBoard {
  date: string
  totalDeliveries: number
  separatedDeliveries: number
  totalBreads: number
  separatedBreads: number
  condominiums: SeparationCondo[]
}

export class AdminSeparationService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  /** Resolve a data alvo (YYYY-MM-DD BRT, default hoje) e sua janela de dia em UTC. */
  private resolveDate(dateStr?: string): { date: string; start: Date; end: Date } {
    const date = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : brtDateStr(new Date(), 0)
    const { start, end } = brtDayRange(brtNoonFromStr(date))
    return { date, start, end }
  }

  /**
   * getBoard — pedidos materializados da data de entrega, agrupados por
   * condomínio → turno → cliente, com contadores de separação.
   */
  async getBoard(dateStr?: string): Promise<SeparationBoard> {
    const { date, start, end } = this.resolveDate(dateStr)

    const orders = await this.prisma.order.findMany({
      where: {
        scheduledDate: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
        condominiumId: { not: null },
      },
      select: {
        id: true,
        userId: true,
        quantity: true,
        slotId: true,
        type: true,
        condominiumId: true,
        status: true,
      },
    })

    if (orders.length === 0) {
      return { date, totalDeliveries: 0, separatedDeliveries: 0, totalBreads: 0, separatedBreads: 0, condominiums: [] }
    }

    const userIds = [...new Set(orders.map((o) => o.userId))]
    const condoIds = [...new Set(orders.map((o) => o.condominiumId).filter((c): c is string => !!c))]

    const [users, condos] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, apartment: true, block: true },
      }),
      this.prisma.condominium.findMany({
        where: { id: { in: condoIds } },
        select: { id: true, name: true, deliverySlots: true },
      }),
    ])
    const userById = new Map(users.map((u) => [u.id, u]))
    const condoById = new Map(condos.map((c) => [c.id, c]))

    const slotLabelFor = (condoId: string, slotId: string): string => {
      const condo = condoById.get(condoId)
      const slot = condo?.deliverySlots?.find((s) => s.slotId === slotId || s.name === slotId)
      return slot?.label ?? fallbackSlotLabel(slotId)
    }

    // Agrupar condomínio → turno
    const condoMap = new Map<string, { condominiumId: string; name: string; slots: Map<string, SeparationSlot> }>()

    for (const o of orders) {
      const condoId = o.condominiumId as string
      const u = userById.get(o.userId)
      const slotId = o.slotId ?? ''
      const separated = o.status !== 'SCHEDULED'

      if (!condoMap.has(condoId)) {
        condoMap.set(condoId, { condominiumId: condoId, name: condoById.get(condoId)?.name ?? condoId, slots: new Map() })
      }
      const condo = condoMap.get(condoId)!

      if (!condo.slots.has(slotId)) {
        condo.slots.set(slotId, {
          slotId,
          slotLabel: slotLabelFor(condoId, slotId),
          totalDeliveries: 0,
          separatedDeliveries: 0,
          totalBreads: 0,
          separatedBreads: 0,
          concluded: false,
          orders: [],
        })
      }
      const slot = condo.slots.get(slotId)!

      slot.orders.push({
        orderId: o.id,
        userId: o.userId,
        name: u?.name ?? 'Cliente',
        block: u?.block ?? '',
        apartment: u?.apartment ?? '',
        quantity: o.quantity,
        slotId,
        slotLabel: slot.slotLabel,
        type: o.type,
        status: o.status,
        separated,
      })
      slot.totalDeliveries += 1
      slot.totalBreads += o.quantity
      if (separated) {
        slot.separatedDeliveries += 1
        slot.separatedBreads += o.quantity
      }
    }

    let totalDeliveries = 0
    let separatedDeliveries = 0
    let totalBreads = 0
    let separatedBreads = 0

    const condominiums: SeparationCondo[] = [...condoMap.values()]
      .map((c) => {
        const slots = [...c.slots.values()]
          .map((s) => {
            s.orders.sort((a, b) => {
              if (a.block !== b.block) return a.block.localeCompare(b.block, 'pt-BR', { numeric: true })
              if (a.apartment !== b.apartment) return a.apartment.localeCompare(b.apartment, 'pt-BR', { numeric: true })
              return a.name.localeCompare(b.name, 'pt-BR')
            })
            s.concluded = s.totalDeliveries > 0 && s.separatedDeliveries === s.totalDeliveries
            return s
          })
          .sort((a, b) => a.slotLabel.localeCompare(b.slotLabel, 'pt-BR'))

        const cTotalDel = slots.reduce((n, s) => n + s.totalDeliveries, 0)
        const cSepDel = slots.reduce((n, s) => n + s.separatedDeliveries, 0)
        const cTotalBreads = slots.reduce((n, s) => n + s.totalBreads, 0)
        const cSepBreads = slots.reduce((n, s) => n + s.separatedBreads, 0)

        totalDeliveries += cTotalDel
        separatedDeliveries += cSepDel
        totalBreads += cTotalBreads
        separatedBreads += cSepBreads

        return {
          condominiumId: c.condominiumId,
          name: c.name,
          totalDeliveries: cTotalDel,
          separatedDeliveries: cSepDel,
          totalBreads: cTotalBreads,
          separatedBreads: cSepBreads,
          slots,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

    return { date, totalDeliveries, separatedDeliveries, totalBreads, separatedBreads, condominiums }
  }

  /**
   * setSeparated — marca/desmarca um pedido como separado (idempotente).
   * Só alterna entre SCHEDULED e SEPARATED; reusa o state machine de AdminOrdersService
   * para registrar/limpar o marco separatedAt.
   */
  async setSeparated(orderId: string, separated: boolean): Promise<{ orderId: string; status: string }> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { status: true } })
    if (!order) {
      throw { statusCode: 404, message: 'Pedido não encontrado' }
    }

    const target = separated ? 'SEPARATED' : 'SCHEDULED'
    if (order.status === target) {
      return { orderId, status: target } // idempotente — já está no estado desejado
    }

    const canToggle =
      (order.status === 'SCHEDULED' && separated) || (order.status === 'SEPARATED' && !separated)
    if (!canToggle) {
      throw { statusCode: 422, message: `Não é possível alterar a separação de um pedido em ${order.status}` }
    }

    await new AdminOrdersService(this.fastify).updateOrderStatus(orderId, target)
    return { orderId, status: target }
  }

  /**
   * conclude — conclui a separação de um lote (condomínio + turno) de uma data.
   * Move todos os pedidos SCHEDULED do escopo para SEPARATED (idempotente: ignora os
   * que já estão separados). A partir daqui eles entram na divisão de entregas.
   */
  async conclude(condominiumId: string, slotId: string, dateStr?: string): Promise<{ count: number }> {
    const { start, end } = this.resolveDate(dateStr)
    const result = await this.prisma.order.updateMany({
      where: {
        condominiumId,
        // '' representa "sem turno" → casa com slotId nulo
        slotId: slotId === '' ? null : slotId,
        scheduledDate: { gte: start, lte: end },
        status: 'SCHEDULED',
      },
      data: { status: 'SEPARATED', separatedAt: new Date() },
    })
    return { count: result.count }
  }
}
