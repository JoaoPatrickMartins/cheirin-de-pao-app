// admin-separation.service.ts — etapa de separação (recebimento → conferência → cupom → conclusão)
//
// Lê os pedidos JÁ materializados (Order) de uma data de entrega e os agrupa por
// condomínio → turno → cliente, com o status de separação de cada um. Concluir um
// lote (condomínio + turno) move seus pedidos SCHEDULED → SEPARATED, liberando-os
// para a divisão de entregas (ver admin-orders: gate em getDivisionSuggestion).

import { FastifyInstance } from 'fastify'
import { compareUnits } from '@cheirin-de-pao/shared'
import { AdminOrdersService } from '../admin-orders/admin-orders.service.js'
import { brtDateStr, brtNoonFromStr, brtDayRange } from '../../lib/cutoff.js'
import { separateMarketOrders } from '../../lib/market-pipeline.js'
import { CONFIRMED_MARKET_STATUSES } from '../../lib/bread-demand.js'

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
  /** Complemento do bloco ("Lado A"); '' quando não há. Vai impresso no cupom. */
  complement: string
  apartment: string
  quantity: number
  slotId: string
  slotLabel: string
  type: 'SINGLE' | 'SCHEDULED'
  status: string
  separated: boolean
  // Mini market ("Além do Pãozin") que pega carona nesta parada.
  marketOrderId?: string // presente em parada SÓ-market (sem pedido de pão)
  /**
   * Ids de TODAS as Cestinhas desta parada — o cliente pode ter comprado mais de uma vez
   * para o mesmo turno, e todas são mescladas numa linha só. O toggle de separação precisa
   * da lista inteira: usar só `marketOrderId` (a primeira) deixaria as outras em SCHEDULED.
   */
  marketOrderIds: string[]
  marketItems: { name: string; qty: number }[]
  marketItemCount: number
}

/**
 * Uma linha da lista consolidada de produtos do mercadinho a separar — "quanto pegar da prateleira".
 * Sem isto o operador tinha que somar os chips de cada parada na mão para saber quantos bolos pegar.
 */
export interface MarketPickItem {
  productId: string
  name: string
  qty: number
}

/** Um turno (lote físico) de um condomínio. */
export interface SeparationSlot {
  slotId: string
  slotLabel: string
  totalDeliveries: number
  separatedDeliveries: number
  totalBreads: number
  separatedBreads: number
  totalItems: number
  separatedItems: number
  concluded: boolean
  orders: SeparationOrder[]
  /** Produtos a separar neste lote (condomínio + turno), agregados por produto. */
  marketPicklist: MarketPickItem[]
}

export interface SeparationCondo {
  condominiumId: string
  name: string
  totalDeliveries: number
  separatedDeliveries: number
  totalBreads: number
  separatedBreads: number
  totalItems: number
  separatedItems: number
  slots: SeparationSlot[]
}

export interface SeparationBoard {
  date: string
  totalDeliveries: number
  separatedDeliveries: number
  totalBreads: number
  separatedBreads: number
  totalItems: number
  separatedItems: number
  condominiums: SeparationCondo[]
  /** Produtos a separar no DIA inteiro, agregados por produto — o que tirar da prateleira. */
  marketPicklist: MarketPickItem[]
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
  async getBoard(dateStr?: string, slotId?: string): Promise<SeparationBoard> {
    const { date, start, end } = this.resolveDate(dateStr)
    const empty: SeparationBoard = { date, totalDeliveries: 0, separatedDeliveries: 0, totalBreads: 0, separatedBreads: 0, totalItems: 0, separatedItems: 0, condominiums: [], marketPicklist: [] }

    const allOrders = await this.prisma.order.findMany({
      where: {
        scheduledDate: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
        condominiumId: { not: null },
        // Pipeline por turno: quando informado, mostra só o slot selecionado.
        ...(slotId ? { slotId } : {}),
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

    // MarketOrders (Cestinha) confirmados do dia — pegam carona nas mesmas paradas.
    const allMarket = await this.prisma.marketOrder.findMany({
      where: {
        scheduledDate: { gte: start, lte: end },
        status: { in: [...CONFIRMED_MARKET_STATUSES] },
        ...(slotId ? { slotId } : {}),
      },
      select: {
        id: true,
        userId: true,
        condominiumId: true,
        slotId: true,
        status: true,
        breadQty: true,
        // productId entra para agregar a lista de separação por produto (não só por nome).
        items: { select: { productId: true, name: true, qty: true } },
      },
    })

    // Gate progressivo: um turno só entra na Separação depois que sua COMPRA é finalizada.
    // (O pedido pode já estar materializado pelo cron, mas só aparece aqui após o corte.)
    //
    // D-3: o gate aceita `PurchaseOrder` FINALIZED **ou** Cestinha confirmada no turno. Sem essa
    // segunda porta, um turno 100% Cestinha (só produtos, sem pão) nunca gera pedido ao fornecedor,
    // logo nunca tem PO, logo nunca aparece aqui — e a Cestinha ficava presa em SCHEDULED para
    // sempre, com crédito debitado e estoque reservado, sem ninguém ser avisado.
    const finalizedPOs = await this.prisma.purchaseOrder.findMany({
      where: { status: 'FINALIZED', date: { gte: start, lte: end }, ...(slotId ? { slotId } : {}) },
      select: { slotId: true },
    })
    const openSlots = new Set(finalizedPOs.map((p) => p.slotId).filter((s): s is string => !!s))
    for (const m of allMarket) {
      if (m.slotId) openSlots.add(m.slotId)
    }
    if (openSlots.size === 0) return empty

    // Mantém só pedidos de turnos abertos para separação
    const orders = allOrders.filter((o) => o.slotId != null && openSlots.has(o.slotId))
    const marketOrders = allMarket.filter((m) => m.slotId && openSlots.has(m.slotId))

    if (orders.length === 0 && marketOrders.length === 0) return empty

    const userIds = [...new Set([...orders.map((o) => o.userId), ...marketOrders.map((m) => m.userId)])]
    const condoIds = [
      ...new Set(
        [...orders.map((o) => o.condominiumId), ...marketOrders.map((m) => m.condominiumId)].filter(
          (c): c is string => !!c,
        ),
      ),
    ]

    const [users, condos] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, apartment: true, block: true, complement: true },
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
          totalItems: 0,
          separatedItems: 0,
          concluded: false,
          orders: [],
          marketPicklist: [],
        })
      }
      const slot = condo.slots.get(slotId)!

      slot.orders.push({
        orderId: o.id,
        userId: o.userId,
        name: u?.name ?? 'Cliente',
        block: u?.block ?? '',
        complement: u?.complement ?? '',
        apartment: u?.apartment ?? '',
        quantity: o.quantity,
        slotId,
        slotLabel: slot.slotLabel,
        type: o.type,
        status: o.status,
        separated,
        marketOrderIds: [],
        marketItems: [],
        marketItemCount: 0,
      })
      slot.totalDeliveries += 1
      slot.totalBreads += o.quantity
      if (separated) {
        slot.separatedDeliveries += 1
        slot.separatedBreads += o.quantity
      }
    }

    // ── Cestinha pega carona: mescla os MarketOrder por (condo, slot, cliente) ──
    for (const mo of marketOrders) {
      const condoId = mo.condominiumId as string
      const moSlotId = mo.slotId ?? ''
      const items = mo.items.map((i) => ({ name: i.name, qty: i.qty }))
      const itemCount = items.reduce((n, i) => n + i.qty, 0)
      const separated = mo.status !== 'SCHEDULED'

      if (!condoMap.has(condoId)) {
        condoMap.set(condoId, { condominiumId: condoId, name: condoById.get(condoId)?.name ?? condoId, slots: new Map() })
      }
      const condo = condoMap.get(condoId)!
      if (!condo.slots.has(moSlotId)) {
        condo.slots.set(moSlotId, {
          slotId: moSlotId,
          slotLabel: slotLabelFor(condoId, moSlotId),
          totalDeliveries: 0,
          separatedDeliveries: 0,
          totalBreads: 0,
          separatedBreads: 0,
          totalItems: 0,
          separatedItems: 0,
          concluded: false,
          orders: [],
          marketPicklist: [],
        })
      }
      const slot = condo.slots.get(moSlotId)!

      // Lista consolidada do lote: agrega por produto o que sair da prateleira para este
      // (condomínio, turno) — independente de quantas paradas o pedido virou.
      for (const it of mo.items) {
        const line = slot.marketPicklist.find((p) => p.productId === it.productId)
        if (line) line.qty += it.qty
        else slot.marketPicklist.push({ productId: it.productId, name: it.name, qty: it.qty })
      }

      const existing = slot.orders.find((r) => r.userId === mo.userId)

      if (existing) {
        // Parada combinada: anexa itens do market + soma os pães da cestinha aos pães.
        existing.marketOrderIds.push(mo.id)
        existing.marketItems.push(...items)
        existing.marketItemCount += itemCount
        existing.quantity += mo.breadQty
        slot.totalBreads += mo.breadQty
        slot.totalItems += itemCount
        if (existing.separated) {
          slot.separatedBreads += mo.breadQty
          slot.separatedItems += itemCount
        }
      } else {
        // Parada SÓ-market: cliente sem pedido de pão neste turno.
        const u = userById.get(mo.userId)
        slot.orders.push({
          orderId: '',
          marketOrderId: mo.id,
          marketOrderIds: [mo.id],
          userId: mo.userId,
          name: u?.name ?? 'Cliente',
          block: u?.block ?? '',
          complement: u?.complement ?? '',
          apartment: u?.apartment ?? '',
          quantity: mo.breadQty,
          slotId: moSlotId,
          slotLabel: slot.slotLabel,
          type: 'SINGLE',
          status: mo.status,
          separated,
          marketItems: items,
          marketItemCount: itemCount,
        })
        slot.totalDeliveries += 1
        slot.totalBreads += mo.breadQty
        slot.totalItems += itemCount
        if (separated) {
          slot.separatedDeliveries += 1
          slot.separatedBreads += mo.breadQty
          slot.separatedItems += itemCount
        }
      }
    }

    let totalDeliveries = 0
    let separatedDeliveries = 0
    let totalBreads = 0
    let separatedBreads = 0
    let totalItems = 0
    let separatedItems = 0

    const condominiums: SeparationCondo[] = [...condoMap.values()]
      .map((c) => {
        const slots = [...c.slots.values()]
          .map((s) => {
            // bloco → complemento → apartamento: a pilha de cupons sai na mesma ordem em que
            // o entregador percorre o prédio (o complemento separa fisicamente os lados).
            s.orders.sort((a, b) => compareUnits(a, b) || a.name.localeCompare(b.name, 'pt-BR'))
            s.concluded = s.totalDeliveries > 0 && s.separatedDeliveries === s.totalDeliveries
            s.marketPicklist.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
            return s
          })
          .sort((a, b) => a.slotLabel.localeCompare(b.slotLabel, 'pt-BR'))

        const cTotalDel = slots.reduce((n, s) => n + s.totalDeliveries, 0)
        const cSepDel = slots.reduce((n, s) => n + s.separatedDeliveries, 0)
        const cTotalBreads = slots.reduce((n, s) => n + s.totalBreads, 0)
        const cSepBreads = slots.reduce((n, s) => n + s.separatedBreads, 0)
        const cTotalItems = slots.reduce((n, s) => n + s.totalItems, 0)
        const cSepItems = slots.reduce((n, s) => n + s.separatedItems, 0)

        totalDeliveries += cTotalDel
        separatedDeliveries += cSepDel
        totalBreads += cTotalBreads
        separatedBreads += cSepBreads
        totalItems += cTotalItems
        separatedItems += cSepItems

        return {
          condominiumId: c.condominiumId,
          name: c.name,
          totalDeliveries: cTotalDel,
          separatedDeliveries: cSepDel,
          totalBreads: cTotalBreads,
          separatedBreads: cSepBreads,
          totalItems: cTotalItems,
          separatedItems: cSepItems,
          slots,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

    // Lista do DIA: soma as listas dos lotes por produto — é o que sai da prateleira no total.
    const boardPicklist: MarketPickItem[] = []
    for (const c of condominiums) {
      for (const s of c.slots) {
        for (const p of s.marketPicklist) {
          const line = boardPicklist.find((x) => x.productId === p.productId)
          if (line) line.qty += p.qty
          else boardPicklist.push({ ...p })
        }
      }
    }
    boardPicklist.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

    return { date, totalDeliveries, separatedDeliveries, totalBreads, separatedBreads, totalItems, separatedItems, condominiums, marketPicklist: boardPicklist }
  }

  /**
   * setSeparated — marca/desmarca um pedido como separado (idempotente).
   * Só alterna entre SCHEDULED e SEPARATED; reusa o state machine de AdminOrdersService
   * para registrar/limpar o marco separatedAt.
   *
   * A Cestinha da MESMA parada (cliente, condomínio, turno, dia) acompanha o pedido — quem
   * separa a sacola do cliente separa tudo o que vai nela. Isso sai de graça:
   * `updateOrderStatus` chama `propagateMarketStatusForOrder` com esse mesmo escopo.
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
   * setMarketSeparated — toggle da separação de uma parada SÓ-Cestinha (cliente sem pedido
   * de pão no turno). Recebe todos os ids da parada porque um cliente pode ter mais de uma
   * Cestinha no mesmo turno e a tela as mostra numa linha única.
   */
  async setMarketSeparated(
    marketOrderIds: string[],
    separated: boolean,
  ): Promise<{ count: number; status: string }> {
    const target = separated ? 'SEPARATED' : 'SCHEDULED'
    const found = await this.prisma.marketOrder.findMany({
      where: { id: { in: marketOrderIds } },
      select: { id: true, status: true },
    })
    if (found.length === 0) {
      throw { statusCode: 404, message: 'Cestinha não encontrada' }
    }

    // Só SCHEDULED ↔ SEPARATED. Em rota/entregue/cancelada a separação não se mexe mais.
    const blocked = found.find((m) => m.status !== 'SCHEDULED' && m.status !== 'SEPARATED')
    if (blocked) {
      throw {
        statusCode: 422,
        message: `Não é possível alterar a separação de uma cestinha em ${blocked.status}`,
      }
    }

    const count = await this.toggleMarketOrders(
      found.map((m) => m.id),
      separated,
    )
    return { count, status: target }
  }

  /** SCHEDULED ↔ SEPARATED em lote nos MarketOrder informados (guardado por status → idempotente). */
  private async toggleMarketOrders(ids: string[], separated: boolean): Promise<number> {
    if (ids.length === 0) return 0
    const r = await this.prisma.marketOrder.updateMany({
      where: { id: { in: ids }, status: separated ? 'SCHEDULED' : 'SEPARATED' },
      data: separated
        ? { status: 'SEPARATED', separatedAt: new Date() }
        : { status: 'SCHEDULED', separatedAt: null },
    })
    return r.count
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
    // A Cestinha pega carona: separa também os MarketOrder do mesmo (condo, slot, dia).
    const marketCount = await separateMarketOrders(this.prisma, condominiumId, slotId, start, end)
    return { count: result.count + marketCount }
  }
}
