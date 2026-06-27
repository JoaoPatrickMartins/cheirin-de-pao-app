// admin-supplier-orders.service.ts — lógica de negócio para pedidos ao fornecedor
// Substitui o stub placeholder da Wave 0 (07-01-PLAN.md)
// Requirements: ADMO-05..09

import { FastifyInstance } from 'fastify'
import { AdminSupplierOrdersRepository } from './admin-supplier-orders.repository.js'
import { generatePdf } from './pdf-generator.js'
import { generateExcel } from './excel-generator.js'
import type { SupplierOrderData } from './pdf-generator.js'
import { brtDateStr, brtNoonFromStr, brtDayRange } from '../../lib/cutoff.js'
import { projectScheduleDetailForDate } from '../../lib/schedule-projection.js'
import { SchedulesService } from '../schedules/schedules.service.js'

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
  private async _buildDeliveryRows(condominiumId?: string): Promise<DeliveryRow[]> {
    // Amanhã em BRT — usa helpers de cutoff (corrige bug de cálculo por dia UTC, que
    // entre 21:00–23:59 BRT apontava para o dia errado, inclusive no corte das 22:00).
    const now = new Date()
    const tomorrowNoonBrt = brtNoonFromStr(brtDateStr(now, 1))
    const { start: startOfTomorrow, end: endOfTomorrow } = brtDayRange(tomorrowNoonBrt)

    // Pedidos JÁ materializados para amanhã (não cancelados)
    const orders = await this.prisma.order.findMany({
      where: {
        scheduledDate: { gte: startOfTomorrow, lte: endOfTomorrow },
        status: { not: 'CANCELLED' },
        condominiumId: condominiumId ?? { not: null },
      },
      select: { userId: true, quantity: true, slotId: true, type: true, condominiumId: true },
    })

    // Previstos pela agenda (por usuário e slot, ainda não materializados)
    let projected = await projectScheduleDetailForDate(this.prisma, tomorrowNoonBrt)
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
  async getDraft(): Promise<
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
    const rows = await this._buildDeliveryRows()

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
  async getCondominiumDetail(condominiumId: string): Promise<{
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
    const rows = await this._buildDeliveryRows(condominiumId)

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
  }): Promise<{ id: string }> {
    // Data de entrega = amanhã ao meio-dia BRT. Corrige o bug de gravar meia-noite UTC,
    // que em BRT (UTC-3) caía no dia anterior (pedido de amanhã aparecia como "hoje").
    const deliveryDate = brtNoonFromStr(brtDateStr(new Date(), 1))

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
      cutoffTime,
      totalQuantity,
      items: itemsWithPrice,
    })

    // Fecha o ciclo do corte:
    // 1) finaliza o pedido (DRAFT → FINALIZED) — passa a aparecer no histórico de compras
    await this.repository.finalize(order.id)

    // 2) materializa os pedidos por cliente do dia alvo (idempotente) — alimenta a Separação.
    //    Best-effort: uma falha aqui NÃO invalida o pedido ao fornecedor já criado.
    try {
      const schedules = new SchedulesService(this.fastify)
      await schedules.materializeOrdersForDate(deliveryDate)
    } catch (err) {
      this.fastify.log.warn(
        { err, orderId: order.id },
        '[supplier-orders] falha ao materializar pedidos no corte — ignorado',
      )
    }

    return { id: order.id }
  }

  /**
   * getGeneratedStatus — informa se o pedido ao fornecedor de AMANHÃ já foi gerado
   * (FINALIZED). Usado pela aba Compra para travar a tela como "já gerado" e evitar
   * geração duplicada.
   */
  async getGeneratedStatus(): Promise<{
    generated: boolean
    orderId: string
    totalQuantity: number
    date: string
  }> {
    const deliveryDate = brtNoonFromStr(brtDateStr(new Date(), 1))
    const { start, end } = brtDayRange(deliveryDate)
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { status: 'FINALIZED', date: { gte: start, lte: end } },
      orderBy: { createdAt: 'desc' },
    })
    return {
      generated: !!po,
      orderId: po?.id ?? '',
      totalQuantity: po?.totalQuantity ?? 0,
      date: po ? po.date.toISOString() : '',
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
