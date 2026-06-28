// admin-supplier-orders.service.ts — lógica de negócio para pedidos ao fornecedor
// Substitui o stub placeholder da Wave 0 (07-01-PLAN.md)
// Requirements: ADMO-05..09

import { FastifyInstance } from 'fastify'
import * as OneSignal from '@onesignal/node-onesignal'
import { AdminSupplierOrdersRepository } from './admin-supplier-orders.repository.js'
import { generatePdf } from './pdf-generator.js'
import { generateExcel } from './excel-generator.js'
import type { SupplierOrderData } from './pdf-generator.js'
import {
  brtDayRange,
  targetDeliveryDate,
  brtNoonFromStr,
  brtDateStr,
  isPastCutoffForDelivery,
  cutoffInstantForDelivery,
  nowHHMM,
} from '../../lib/cutoff.js'
import { projectScheduleDetailForDate } from '../../lib/schedule-projection.js'
import { SchedulesService } from '../schedules/schedules.service.js'
import { getGlobalDeliverySlots, type GlobalDeliverySlot } from '../../lib/delivery-slots.js'

function createOsClient() {
  const configuration = OneSignal.createConfiguration({
    restApiKey: process.env.ONESIGNAL_REST_API_KEY!,
  })
  return new OneSignal.DefaultApi(configuration)
}

/** Setting key do split padrão (percentual do fornecedor principal). */
const SUPPLIER_SPLIT_KEY = 'supplierSplitPrincipalPct'

/** Flag de risco de uma entrega prevista que pode não se materializar. */
export type RiskFlag = '' | 'no-credit' | 'blocked'

/** Uma linha de entrega para amanhã — materializada (Order) ou prevista (agenda). */
export interface DeliveryRow {
  condominiumId: string
  condominiumName: string
  userId: string
  name: string
  apartment: string
  block: string
  quantity: number
  slotId: string
  slotLabel: string
  type: 'SINGLE' | 'SCHEDULED'
  source: 'order' | 'projected'
  risk: RiskFlag
}

/** Quebra por slot (turno) usada na lista e no detalhe. */
export interface SlotBreakdown {
  slotId: string
  label: string
  breads: number
  deliveries: number
}

const DEFAULT_SLOT_LABELS: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde' }

function fallbackSlotLabel(slotId: string): string {
  if (!slotId) return 'Sem horário'
  return DEFAULT_SLOT_LABELS[slotId] ?? slotId.charAt(0).toUpperCase() + slotId.slice(1)
}

/**
 * AdminSupplierOrdersService — lógica do fluxo de pedido ao fornecedor.
 *
 * Responsabilidades:
 * - getDraft: calcular totais de pães por condomínio para o dia seguinte
 * - create: criar PurchaseOrder DRAFT + items em $transaction
 * - finalize: mudar status DRAFT → FINALIZED (T-07-04-04: idempotência)
 * - getHistory: listar pedidos FINALIZED
 * - getPdfBuffer: gerar PDF do pedido
 * - getExcelBuffer: gerar Excel do pedido
 */
export class AdminSupplierOrdersService {
  private repository: AdminSupplierOrdersRepository

  constructor(private fastify: FastifyInstance) {
    this.repository = new AdminSupplierOrdersRepository(fastify)
  }

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * Resolve o turno (slot) pelo slotId e calcula sua data de entrega.
   * - Com `dateStr` (YYYY-MM-DD): usa aquele dia (meio-dia BRT) — usado pela pré-tela de dias.
   * - Sem `dateStr`: próxima entrega pela Regra A (HOJE se o horário do slot ainda está à
   *   frente do corte, senão AMANHÃ) — comportamento legado.
   */
  private async _resolveSlot(
    slotId: string,
    dateStr?: string,
  ): Promise<{ slot: GlobalDeliverySlot; deliveryDate: Date }> {
    const slots = await getGlobalDeliverySlots(this.prisma)
    const slot = slots.find((s) => s.slotId === slotId)
    if (!slot) {
      throw { statusCode: 400, message: `Turno inválido: ${slotId}` }
    }
    const deliveryDate = dateStr ? brtNoonFromStr(dateStr) : targetDeliveryDate(slot.time, slot.cutoffTime)
    return { slot, deliveryDate }
  }

  /** Instante do corte (ISO) de um slot para a data de entrega informada (Regra A). */
  private _cutoffAtIso(slotTime: string, cutoffTime: string, deliveryDateStr: string): string {
    const [y, mo, d] = deliveryDateStr.slice(0, 10).split('-').map(Number)
    const [ch, cm] = cutoffTime.split(':').map(Number)
    const sameDay = slotTime > cutoffTime
    const cutoffDayOffset = sameDay ? 0 : -1
    // BRT → UTC: soma 3h
    return new Date(Date.UTC(y, mo - 1, d + cutoffDayOffset, ch + 3, cm, 0, 0)).toISOString()
  }

  /**
   * _buildDeliveryRows — fonte única de verdade das entregas de amanhã (BRT).
   *
   * Une pedidos JÁ materializados (Order) com previstos da agenda (ainda não materializados),
   * resolvendo nome/apartamento/bloco do cliente, label do slot e flag de risco. Tanto a lista
   * (getDraft) quanto o detalhe (getCondominiumDetail) derivam destas linhas — assim os números
   * sempre reconciliam (ex.: os chips ☀/☾ somam o total do card).
   *
   * Risco (só para previstos, que ainda dependem de saldo/conta ativa para virar pedido):
   * - 'blocked'  → cliente bloqueado
   * - 'no-credit'→ total previsto do cliente > saldo de créditos atual
   */
  private async _buildDeliveryRows(slotId: string, deliveryDate: Date, condominiumId?: string): Promise<DeliveryRow[]> {
    const { start: startOfDay, end: endOfDay } = brtDayRange(deliveryDate)

    // Pedidos JÁ materializados deste turno para a data (não cancelados)
    const orders = await this.prisma.order.findMany({
      where: {
        scheduledDate: { gte: startOfDay, lte: endOfDay },
        status: { not: 'CANCELLED' },
        slotId,
        condominiumId: condominiumId ?? { not: null },
      },
      select: { userId: true, quantity: true, slotId: true, type: true, condominiumId: true },
    })

    // Previstos pela agenda — APENAS deste turno, ainda não materializados
    let projected = await projectScheduleDetailForDate(this.prisma, deliveryDate)
    projected = projected.filter((p) => p.slotId === slotId)
    if (condominiumId) projected = projected.filter((p) => p.condominiumId === condominiumId)

    // Carregar clientes (nome, ap/bloco, saldo, bloqueio) e condomínios (nome + slots) referenciados
    const userIds = [...new Set([...orders.map((o) => o.userId), ...projected.map((p) => p.userId)])]
    const condoIds = [
      ...new Set([
        ...orders.map((o) => o.condominiumId).filter((c): c is string => !!c),
        ...projected.map((p) => p.condominiumId),
      ]),
    ]

    const [users, condos] = await Promise.all([
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, apartment: true, block: true, creditBalance: true, isBlocked: true },
          })
        : Promise.resolve([]),
      condoIds.length
        ? this.prisma.condominium.findMany({
            where: { id: { in: condoIds } },
            select: { id: true, name: true, deliverySlots: true },
          })
        : Promise.resolve([]),
    ])

    const userById = new Map(users.map((u) => [u.id, u]))
    const condoById = new Map(condos.map((c) => [c.id, c]))

    // Resolver label do slot por condomínio (deliverySlots embute slotId/name/label)
    const slotLabelFor = (condoId: string, slotId: string): string => {
      const condo = condoById.get(condoId)
      const slot = condo?.deliverySlots?.find((s) => s.slotId === slotId || s.name === slotId)
      return slot?.label ?? fallbackSlotLabel(slotId)
    }

    // Total previsto por usuário — base do flag 'no-credit' (saldo cobre tudo que vem?)
    const projTotalByUser = new Map<string, number>()
    for (const p of projected) projTotalByUser.set(p.userId, (projTotalByUser.get(p.userId) ?? 0) + p.quantity)

    const rows: DeliveryRow[] = []

    for (const o of orders) {
      if (!o.condominiumId) continue
      const u = userById.get(o.userId)
      const slotId = o.slotId ?? ''
      rows.push({
        condominiumId: o.condominiumId,
        condominiumName: condoById.get(o.condominiumId)?.name ?? o.condominiumId,
        userId: o.userId,
        name: u?.name ?? 'Cliente',
        apartment: u?.apartment ?? '',
        block: u?.block ?? '',
        quantity: o.quantity,
        slotId,
        slotLabel: slotLabelFor(o.condominiumId, slotId),
        type: o.type,
        source: 'order',
        risk: '', // já é um pedido real (pago) — não está em risco de não materializar
      })
    }

    for (const p of projected) {
      const u = userById.get(p.userId)
      const risk: RiskFlag = u?.isBlocked
        ? 'blocked'
        : (projTotalByUser.get(p.userId) ?? 0) > (u?.creditBalance ?? 0)
          ? 'no-credit'
          : ''
      rows.push({
        condominiumId: p.condominiumId,
        condominiumName: condoById.get(p.condominiumId)?.name ?? p.condominiumId,
        userId: p.userId,
        name: u?.name ?? 'Cliente',
        apartment: u?.apartment ?? '',
        block: u?.block ?? '',
        quantity: p.quantity,
        slotId: p.slotId,
        slotLabel: slotLabelFor(p.condominiumId, p.slotId),
        type: 'SCHEDULED',
        source: 'projected',
        risk,
      })
    }

    return rows
  }

  /** Agrega linhas em quebra por slot (turno), ordenada por label. */
  private _slotBreakdown(rows: DeliveryRow[]): SlotBreakdown[] {
    const map = new Map<string, SlotBreakdown>()
    for (const r of rows) {
      const cur = map.get(r.slotId) ?? { slotId: r.slotId, label: r.slotLabel, breads: 0, deliveries: 0 }
      cur.breads += r.quantity
      cur.deliveries += 1
      map.set(r.slotId, cur)
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }

  /**
   * getDraft — retorna lista de condomínios com totais de pães para o dia seguinte (BRT).
   *
   * Agrupa as linhas de entrega por condomínio. Mantém os campos originais
   * (deliveryCount/totalBreads/projected*) e acrescenta `bySlot` (chips ☀/☾) e `riskCount`.
   */
  async getDraft(slotId: string, dateStr?: string): Promise<
    Array<{
      condominiumId: string
      name: string
      deliveryCount: number
      totalBreads: number
      projectedBreads: number
      projectedDeliveries: number
      bySlot: SlotBreakdown[]
      riskCount: number
    }>
  > {
    const { deliveryDate } = await this._resolveSlot(slotId, dateStr)
    const rows = await this._buildDeliveryRows(slotId, deliveryDate)

    const byCondo = new Map<string, DeliveryRow[]>()
    for (const r of rows) {
      const list = byCondo.get(r.condominiumId) ?? []
      list.push(r)
      byCondo.set(r.condominiumId, list)
    }

    const result = [...byCondo.entries()].map(([condominiumId, condoRows]) => {
      const mat = condoRows.filter((r) => r.source === 'order')
      const proj = condoRows.filter((r) => r.source === 'projected')
      const riskUsers = new Set(proj.filter((r) => r.risk !== '').map((r) => r.userId))
      return {
        condominiumId,
        name: condoRows[0]?.condominiumName ?? condominiumId,
        deliveryCount: mat.length,
        totalBreads: mat.reduce((s, r) => s + r.quantity, 0),
        projectedBreads: proj.reduce((s, r) => s + r.quantity, 0),
        projectedDeliveries: new Set(proj.map((r) => r.userId)).size,
        bySlot: this._slotBreakdown(condoRows),
        riskCount: riskUsers.size,
      }
    })

    return result.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }

  /**
   * getCondominiumDetail — detalhamento por cliente de um condomínio para amanhã.
   *
   * Lista cada entrega (materializada ou prevista) com cliente, ap/bloco, slot, tipo
   * (avulso/agenda), origem (confirmado/previsto) e flag de risco. Inclui quebra por slot,
   * por tipo e contadores — base da tela de detalhe da aba Pedido.
   */
  async getCondominiumDetail(condominiumId: string, slotId: string, dateStr?: string): Promise<{
    condominiumId: string
    name: string
    totalBreads: number
    materializedBreads: number
    projectedBreads: number
    deliveryCount: number
    projectedDeliveries: number
    riskCount: number
    bySlot: SlotBreakdown[]
    byType: { single: number; scheduled: number }
    deliveries: Array<{
      userId: string
      name: string
      apartment: string
      block: string
      quantity: number
      slotId: string
      slotLabel: string
      type: 'SINGLE' | 'SCHEDULED'
      source: 'order' | 'projected'
      risk: RiskFlag
    }>
  }> {
    const { deliveryDate } = await this._resolveSlot(slotId, dateStr)
    const rows = await this._buildDeliveryRows(slotId, deliveryDate, condominiumId)

    // Nome do condomínio — buscar mesmo se não houver linhas (estado vazio)
    let name = rows[0]?.condominiumName
    if (!name) {
      const condo = await this.prisma.condominium.findUnique({
        where: { id: condominiumId },
        select: { name: true },
      })
      name = condo?.name ?? condominiumId
    }

    const mat = rows.filter((r) => r.source === 'order')
    const proj = rows.filter((r) => r.source === 'projected')
    const riskUsers = new Set(proj.filter((r) => r.risk !== '').map((r) => r.userId))

    // Ordenar entregas: bloco, depois apartamento (numérico quando possível), depois nome
    const deliveries = [...rows].sort((a, b) => {
      if (a.block !== b.block) return a.block.localeCompare(b.block, 'pt-BR', { numeric: true })
      if (a.apartment !== b.apartment) return a.apartment.localeCompare(b.apartment, 'pt-BR', { numeric: true })
      return a.name.localeCompare(b.name, 'pt-BR')
    })

    return {
      condominiumId,
      name,
      totalBreads: rows.reduce((s, r) => s + r.quantity, 0),
      materializedBreads: mat.reduce((s, r) => s + r.quantity, 0),
      projectedBreads: proj.reduce((s, r) => s + r.quantity, 0),
      deliveryCount: mat.length,
      projectedDeliveries: new Set(proj.map((r) => r.userId)).size,
      riskCount: riskUsers.size,
      bySlot: this._slotBreakdown(rows),
      byType: {
        single: rows.filter((r) => r.type === 'SINGLE').reduce((s, r) => s + r.quantity, 0),
        scheduled: rows.filter((r) => r.type === 'SCHEDULED').reduce((s, r) => s + r.quantity, 0),
      },
      deliveries: deliveries.map((r) => ({
        userId: r.userId,
        name: r.name,
        apartment: r.apartment,
        block: r.block,
        quantity: r.quantity,
        slotId: r.slotId,
        slotLabel: r.slotLabel,
        type: r.type,
        source: r.source,
        risk: r.risk,
      })),
    }
  }

  /**
   * create — cria PurchaseOrder DRAFT + PurchaseOrderItems em $transaction.
   *
   * T-07-04-03: verifica Supplier existe via findUnique antes de criar.
   *
   * @returns { id: string } ID do PurchaseOrder criado
   */
  async create(data: {
    items: Array<{ supplierId: string; quantity: number }>
    cutoffTime?: string
    slotId: string
    date?: string
  }): Promise<{ id: string }> {
    // Resolve o turno e sua data de entrega. Com `date` o pedido é para aquele dia; sem, Regra A.
    const { slot, deliveryDate } = await this._resolveSlot(data.slotId, data.date)

    // Horário de corte — default 20:00 BRT
    const cutoffTime = data.cutoffTime
      ? new Date(data.cutoffTime)
      : new Date(new Date().setUTCHours(23, 0, 0, 0)) // 20:00 BRT = 23:00 UTC

    // Resolver preços dos fornecedores e validar existência
    const itemsWithPrice = await Promise.all(
      data.items.map(async (item) => {
        const supplier = await this.prisma.supplier.findUnique({
          where: { id: item.supplierId },
        })
        if (!supplier) {
          throw { statusCode: 404, message: `Fornecedor ${item.supplierId} não encontrado` }
        }
        return {
          supplierId: item.supplierId,
          quantity: item.quantity,
          unitPrice: supplier.pricePerUnit,
        }
      }),
    )

    const totalQuantity = itemsWithPrice.reduce((sum, item) => sum + item.quantity, 0)

    const order = await this.repository.create({
      date: deliveryDate,
      slotId: slot.slotId,
      slotLabel: slot.label,
      cutoffTime,
      totalQuantity,
      items: itemsWithPrice,
    })

    // Fecha o ciclo do corte DESTE turno:
    // 1) finaliza o pedido (DRAFT → FINALIZED) — passa a aparecer no histórico de compras
    await this.repository.finalize(order.id)

    // 2) materializa os pedidos por cliente APENAS deste turno (idempotente) — alimenta a Separação.
    //    Best-effort: uma falha aqui NÃO invalida o pedido ao fornecedor já criado.
    try {
      const schedules = new SchedulesService(this.fastify)
      await schedules.materializeOrdersForSlot(deliveryDate, slot.slotId)
    } catch (err) {
      this.fastify.log.warn(
        { err, orderId: order.id, slotId: slot.slotId },
        '[supplier-orders] falha ao materializar pedidos do turno no corte — ignorado',
      )
    }

    return { id: order.id }
  }

  /**
   * getGeneratedStatus — informa se o pedido ao fornecedor de AMANHÃ já foi gerado
   * (FINALIZED). Usado pela aba Compra para travar a tela como "já gerado" e evitar
   * geração duplicada.
   */
  async getGeneratedStatus(slotId: string, dateStr?: string): Promise<{
    generated: boolean
    orderId: string
    totalQuantity: number
    date: string
    slotLabel: string
  }> {
    const { slot, deliveryDate } = await this._resolveSlot(slotId, dateStr)
    const { start, end } = brtDayRange(deliveryDate)
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { status: 'FINALIZED', slotId: slot.slotId, date: { gte: start, lte: end } },
      orderBy: { createdAt: 'desc' },
    })
    return {
      generated: !!po,
      orderId: po?.id ?? '',
      totalQuantity: po?.totalQuantity ?? 0,
      date: po ? po.date.toISOString() : '',
      slotLabel: slot.label,
    }
  }

  /**
   * getSlotsStatus — para cada turno ativo: data de entrega (Regra A), se há pedidos
   * (materializados + previstos) e se a compra já foi finalizada. Ordenado pelo PRÓXIMO
   * corte (data de entrega + horário). A aba Compra usa isto para abrir já no turno certo
   * (o próximo com pedido e ainda não finalizado) e exibir a data correta de cada turno.
   */
  async getSlotsStatus(): Promise<
    Array<{
      slotId: string
      label: string
      emoji: string
      time: string
      cutoffTime: string
      deliveryDate: string
      hasOrders: boolean
      generated: boolean
      totalBreads: number
    }>
  > {
    const slots = (await getGlobalDeliverySlots(this.prisma)).filter((s) => s.isActive)
    const out = await Promise.all(
      slots.map(async (slot) => {
        const deliveryDate = targetDeliveryDate(slot.time, slot.cutoffTime)
        const { start, end } = brtDayRange(deliveryDate)
        const rows = await this._buildDeliveryRows(slot.slotId, deliveryDate)
        const totalBreads = rows.reduce((s, r) => s + r.quantity, 0)
        const po = await this.prisma.purchaseOrder.findFirst({
          where: { status: 'FINALIZED', slotId: slot.slotId, date: { gte: start, lte: end } },
          select: { id: true },
        })
        return {
          slotId: slot.slotId,
          label: slot.label,
          emoji: slot.emoji,
          time: slot.time,
          cutoffTime: slot.cutoffTime,
          deliveryDate: deliveryDate.toISOString(),
          hasOrders: rows.length > 0,
          generated: !!po,
          totalBreads,
        }
      }),
    )
    // Próximo corte primeiro: por data de entrega, depois por horário do turno.
    return out.sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate) || a.time.localeCompare(b.time))
  }

  /**
   * getUpcomingDays — próximos N dias de entrega (BRT), cada um com seus turnos e estado.
   *
   * Para cada dia (hoje..hoje+N-1) × cada slot ativo: total de pães (confirmados + previstos),
   * entregas, clientes em risco, se a compra já foi gerada (FINALIZED) e se o corte já passou.
   * Alimenta a pré-tela "Dias em aberto". O front decide colapsar dias vazios / passados.
   *
   * Nota de performance: reexecuta a projeção da agenda por dia (refetch de schedules).
   * Aceitável para a tela do admin; otimizável com 1 fetch se necessário.
   */
  async getUpcomingDays(
    days = 7,
    now: Date = new Date(),
  ): Promise<
    Array<{
      date: string
      slots: Array<{
        slotId: string
        label: string
        emoji: string
        time: string
        cutoffTime: string
        cutoffAt: string
        deliveryDate: string
        breads: number
        projectedBreads: number
        deliveries: number
        riskCount: number
        generated: boolean
        pastCutoff: boolean
        hasOrders: boolean
      }>
      totalBreads: number
      hasOrders: boolean
      allGenerated: boolean
      anyPending: boolean
    }>
  > {
    const slots = (await getGlobalDeliverySlots(this.prisma)).filter((s) => s.isActive)
    const dayStrs = Array.from({ length: Math.max(1, days) }, (_, i) => brtDateStr(now, i))

    return Promise.all(
      dayStrs.map(async (dateStr) => {
        const deliveryDate = brtNoonFromStr(dateStr)
        const { start, end } = brtDayRange(deliveryDate)

        const slotStates = await Promise.all(
          slots.map(async (slot) => {
            const rows = await this._buildDeliveryRows(slot.slotId, deliveryDate)
            // breads = confirmados (o que será pedido); projectedBreads = previstos (contexto).
            const breads = rows.filter((r) => r.source === 'order').reduce((s, r) => s + r.quantity, 0)
            const projectedBreads = rows.filter((r) => r.source === 'projected').reduce((s, r) => s + r.quantity, 0)
            const riskUsers = new Set(rows.filter((r) => r.risk !== '').map((r) => r.userId))
            const po = await this.prisma.purchaseOrder.findFirst({
              where: { status: 'FINALIZED', slotId: slot.slotId, date: { gte: start, lte: end } },
              select: { id: true },
            })
            return {
              slotId: slot.slotId,
              label: slot.label,
              emoji: slot.emoji,
              time: slot.time,
              cutoffTime: slot.cutoffTime,
              cutoffAt: this._cutoffAtIso(slot.time, slot.cutoffTime, dateStr),
              deliveryDate: deliveryDate.toISOString(),
              breads,
              projectedBreads,
              deliveries: rows.length,
              riskCount: riskUsers.size,
              generated: !!po,
              pastCutoff: isPastCutoffForDelivery(slot.time, slot.cutoffTime, dateStr, now),
              hasOrders: rows.length > 0,
            }
          }),
        )

        slotStates.sort((a, b) => a.time.localeCompare(b.time))
        const withOrders = slotStates.filter((x) => x.hasOrders)
        return {
          date: dateStr,
          slots: slotStates,
          // Total do dia = confirmados (o que será pedido). Previstos ficam por turno.
          totalBreads: slotStates.reduce((s, x) => s + x.breads, 0),
          hasOrders: withOrders.length > 0,
          allGenerated: withOrders.length > 0 && withOrders.every((x) => x.generated),
          anyPending: withOrders.some((x) => !x.generated && !x.pastCutoff),
        }
      }),
    )
  }

  /**
   * createQuick — "Gerar direto": cria o pedido ao fornecedor de um turno usando a quantidade
   * CONFIRMADA (pedidos materializados — não inclui previstos) e o split padrão (principal leva
   * tudo, ou 75/25 quando há fornecedor reserva). Reusa create() — que finaliza e materializa.
   *
   * No corte os previstos já viram confirmados (createOrdersAtCutoff roda antes), então a rede
   * de segurança pede o total real. Retorna null quando não há nada confirmado a pedir.
   * Reusado pela rede de segurança no corte (autoGenerateAtCutoff).
   */
  async createQuick(slotId: string, dateStr?: string): Promise<{ id: string } | null> {
    const { deliveryDate } = await this._resolveSlot(slotId, dateStr)

    const rows = await this._buildDeliveryRows(slotId, deliveryDate)
    // Só confirmados (source 'order'): previstos não entram no pedido ao fornecedor.
    const total = rows.filter((r) => r.source === 'order').reduce((s, r) => s + r.quantity, 0)
    if (total <= 0) return null

    // Split padrão configurável: principal leva tudo; principalPct% quando há reserva.
    const suppliers = await this.prisma.supplier.findMany()
    const principal = suppliers.find((s) => s.isPrincipal) ?? suppliers[0]
    if (!principal) throw { statusCode: 400, message: 'Nenhum fornecedor cadastrado' }
    const reserva = suppliers.find((s) => !s.isPrincipal && s.id !== principal.id)

    const pct = await this.getDefaultSplitPercent()
    const p = reserva ? Math.round((total * pct) / 100) : total
    const r = total - p
    const items = [
      { supplierId: principal.id, quantity: p },
      ...(reserva && r > 0 ? [{ supplierId: reserva.id, quantity: r }] : []),
    ].filter((it) => it.quantity > 0)

    return this.create({ items, slotId, date: dateStr })
  }

  /**
   * autoGenerateAtCutoff — rede de segurança: passada a JANELA MANUAL (`delayMinutes` após o corte
   * de cada turno), se o admin NÃO gerou o pedido ao fornecedor, gera automaticamente com o split
   * padrão. Disparado pelo cron a cada minuto (após createOrdersAtCutoff materializar as orders).
   *
   * A janela dá `delayMinutes` (default 60) ao admin para gerar manualmente após o corte; só então
   * a rede de segurança assume. Examina os dias candidatos HOJE/AMANHÃ (BRT) usando o INSTANTE
   * ABSOLUTO do corte (robusto à meia-noite) — então, diferente do antigo casamento de minuto
   * exato, também RECUPERA cortes cujo minuto foi perdido (servidor fora do ar) e sobrevive a
   * restart: a cada minuto, se já passou corte + janela e não há pedido, gera.
   *
   * Idempotente: só gera se não houver PurchaseOrder FINALIZED para o turno + data.
   */
  async autoGenerateAtCutoff(now: Date = new Date(), delayMinutes = 60): Promise<void> {
    const delayMs = delayMinutes * 60_000
    const candidates = [brtDateStr(now, 0), brtDateStr(now, 1)]
    const slots = (await getGlobalDeliverySlots(this.prisma)).filter((s) => s.isActive)
    for (const slot of slots) {
      for (const deliveryStr of candidates) {
        // Só assume após o corte + janela manual; antes disso o admin ainda pode gerar na mão.
        const cutoffAt = cutoffInstantForDelivery(slot.time, slot.cutoffTime, deliveryStr).getTime()
        if (now.getTime() < cutoffAt + delayMs) continue

        const deliveryDate = brtNoonFromStr(deliveryStr)
        const { start, end } = brtDayRange(deliveryDate)
        const existing = await this.prisma.purchaseOrder.findFirst({
          where: { status: 'FINALIZED', slotId: slot.slotId, date: { gte: start, lte: end } },
          select: { id: true },
        })
        if (existing) continue
        try {
          const res = await this.createQuick(slot.slotId, deliveryStr)
          this.fastify.log.info(
            { slotId: slot.slotId, deliveryStr, orderId: res?.id ?? null },
            res
              ? '[supplier-orders] rede de segurança gerou pedido (janela manual encerrada)'
              : '[supplier-orders] corte sem pães — nada a gerar',
          )
        } catch (err) {
          this.fastify.log.error(
            { err, slotId: slot.slotId },
            '[supplier-orders] falha na rede de segurança no corte — ignorado',
          )
        }
      }
    }
  }

  /** Percentual do fornecedor principal no split padrão (Setting; default 75). */
  async getDefaultSplitPercent(): Promise<number> {
    const row = await this.prisma.setting.findUnique({ where: { key: SUPPLIER_SPLIT_KEY } })
    const n = row ? Number(row.value) : NaN
    return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n) : 75
  }

  /** Define o percentual do fornecedor principal no split padrão (0–100). */
  async setDefaultSplitPercent(percent: number): Promise<number> {
    const pct = Math.max(0, Math.min(100, Math.round(percent)))
    await this.prisma.setting.upsert({
      where: { key: SUPPLIER_SPLIT_KEY },
      create: { key: SUPPLIER_SPLIT_KEY, value: String(pct) },
      update: { value: String(pct) },
    })
    return pct
  }

  /**
   * sendCutoffReminders — push T-LEAD_MIN antes do corte de cada turno, avisando os admins
   * quando ainda há pedido pendente (não gerado) com pães esperados. Best-effort, idempotente
   * por minuto (só dispara no minuto exato T-30). Disparado pelo cron a cada minuto.
   */
  async sendCutoffReminders(now: Date = new Date()): Promise<void> {
    const LEAD_MIN = 30
    const [nh, nm] = nowHHMM(now).split(':').map(Number)
    const cur = nh * 60 + nm
    const slots = (await getGlobalDeliverySlots(this.prisma)).filter((s) => s.isActive)

    for (const slot of slots) {
      const [ch, cm] = slot.cutoffTime.split(':').map(Number)
      const target = (ch * 60 + cm - LEAD_MIN + 1440) % 1440
      if (cur !== target) continue

      const deliveryDate = targetDeliveryDate(slot.time, slot.cutoffTime, now)
      const { start, end } = brtDayRange(deliveryDate)
      const po = await this.prisma.purchaseOrder.findFirst({
        where: { status: 'FINALIZED', slotId: slot.slotId, date: { gte: start, lte: end } },
        select: { id: true },
      })
      if (po) continue // já gerado — nada a lembrar

      // Total esperado (confirmados + previstos) — heads-up do que vem no corte.
      const rows = await this._buildDeliveryRows(slot.slotId, deliveryDate)
      const expected = rows.reduce((s, r) => s + r.quantity, 0)
      if (expected <= 0) continue

      if (!process.env.ONESIGNAL_APP_ID) continue
      const admins = await this.prisma.user.findMany({
        where: { role: 'ADMIN', oneSignalPlayerId: { not: null } },
        select: { id: true, oneSignalPlayerId: true },
      })
      if (admins.length === 0) continue

      const osClient = createOsClient()
      for (const admin of admins) {
        try {
          const notification = new OneSignal.Notification()
          notification.app_id = process.env.ONESIGNAL_APP_ID!
          notification.include_subscription_ids = [admin.oneSignalPlayerId!]
          notification.headings = { pt: 'Cheirin de Pão — corte fechando' }
          notification.contents = {
            pt: `Corte da ${slot.label} fecha em ${LEAD_MIN} min · ${expected} pães ainda não pedidos.`,
          }
          notification.url = '/admin'
          await osClient.createNotification(notification)
        } catch (err) {
          this.fastify.log.warn({ err, slotId: slot.slotId }, '[supplier-orders] falha no push de corte — ignorado')
        }
      }
      this.fastify.log.info(
        { slotId: slot.slotId, admins: admins.length, expected },
        '[supplier-orders] push T-30 de corte enviado',
      )
    }
  }

  /**
   * finalize — muda status DRAFT → FINALIZED.
   *
   * T-07-04-04: verifica status=DRAFT antes de finalizar — retorna 400 se já FINALIZED.
   *
   * @throws { statusCode: 404 } se PurchaseOrder não existe
   * @throws { statusCode: 400 } se status já é FINALIZED
   */
  async finalize(id: string): Promise<void> {
    const order = await this.repository.findById(id)

    if (!order) {
      throw { statusCode: 404, message: 'Pedido ao fornecedor não encontrado' }
    }

    if (order.status === 'FINALIZED') {
      throw { statusCode: 400, message: 'Pedido já foi finalizado' }
    }

    await this.repository.finalize(id)
  }

  /**
   * getHistory — retorna histórico de pedidos FINALIZED.
   */
  async getHistory() {
    return this.repository.findHistory()
  }

  /**
   * getPdfBuffer — gera Buffer PDF do pedido ao fornecedor.
   *
   * T-07-04-01: autenticação e role check ficam no controller.
   *
   * @throws { statusCode: 404 } se PurchaseOrder não existe
   */
  async getPdfBuffer(id: string): Promise<Buffer> {
    const data = await this._buildSupplierOrderData(id)
    return generatePdf(data)
  }

  /**
   * getExcelBuffer — gera Buffer Excel do pedido ao fornecedor.
   *
   * @throws { statusCode: 404 } se PurchaseOrder não existe
   */
  async getExcelBuffer(id: string): Promise<Buffer> {
    const data = await this._buildSupplierOrderData(id)
    return generateExcel(data)
  }

  /**
   * _buildSupplierOrderData — helper privado que busca dados do pedido
   * e formata para o SupplierOrderData usado pelos geradores.
   */
  private async _buildSupplierOrderData(id: string): Promise<SupplierOrderData> {
    const orderWithItems = await this.repository.findByIdWithItems(id)

    if (!orderWithItems) {
      throw { statusCode: 404, message: 'Pedido ao fornecedor não encontrado' }
    }

    // Buscar nomes dos fornecedores para cada item
    const items = await Promise.all(
      orderWithItems.items.map(async (item) => {
        const supplier = await this.prisma.supplier.findUnique({
          where: { id: item.supplierId },
          select: { name: true, pricePerUnit: true },
        })
        return {
          supplier: supplier?.name ?? item.supplierId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
        }
      }),
    )

    const grandTotal = items.reduce((sum, item) => sum + item.quantity, 0)
    const grandTotalValue = items.reduce((sum, item) => sum + item.total, 0)

    // Formatar data BRT
    const dateFormatted = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(orderWithItems.date)

    return {
      date: dateFormatted,
      items,
      grandTotal,
      grandTotalBrl: `R$ ${grandTotalValue.toFixed(2).replace('.', ',')}`,
    }
  }
}
