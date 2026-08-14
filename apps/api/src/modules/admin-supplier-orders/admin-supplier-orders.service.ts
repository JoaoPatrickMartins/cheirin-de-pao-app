// admin-supplier-orders.service.ts — lógica de negócio para pedidos ao fornecedor
// Substitui o stub placeholder da Wave 0 (07-01-PLAN.md)
// Requirements: ADMO-05..09

import { FastifyInstance } from 'fastify'
import { wholeBreads } from '@cheirin-de-pao/shared'
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
import { buildBreadDemand, type MarketItemLine } from '../../lib/bread-demand.js'
import { buildProductDemand, loadSourcingOptions } from '../../lib/product-demand.js'
import { splitDemandBySupplier, type UnsourcedProduct } from '../../lib/supplier-split.js'
import { buildRestockCandidates, RESTOCK_COVER_DAYS, type RestockCandidate } from '../../lib/restock-demand.js'
import { SchedulesService } from '../schedules/schedules.service.js'
import {
  getGlobalDeliverySlots,
  listActiveCondoSlots,
  groupCondoSlotsByTime,
  minuteOfDay,
  type GlobalDeliverySlot,
} from '../../lib/delivery-slots.js'
import { NotificationsService } from '../notifications/notifications.service.js'
import { NotificationType } from '@prisma/client'

function createOsClient() {
  const configuration = OneSignal.createConfiguration({
    restApiKey: process.env.ONESIGNAL_REST_API_KEY!,
  })
  return new OneSignal.DefaultApi(configuration)
}

/** Setting key do split padrão (percentual do fornecedor principal). LEGADO — ver D-10. */
const SUPPLIER_SPLIT_KEY = 'supplierSplitPrincipalPct'
const BREAD_PRODUCT_KEY = 'breadProductId'

const round2 = (n: number) => Math.round(n * 100) / 100

/** Flag de risco de uma entrega prevista que pode não se materializar. */
export type RiskFlag = '' | 'no-credit' | 'blocked'

/**
 * Uma PARADA de entrega para o dia — pedido de pão, Cestinha, previsto da agenda, ou a combinação.
 *
 * Uma linha = uma visita física `(userId, slotId)` (D-5). `quantity` é o total de PÃES da parada
 * (pedido + Cestinha + previsto); os produtos do mercadinho ficam em `marketItems`, contados em
 * paralelo (D-1). `source` continua sendo o rótulo grosso ('order' = tem algo pago) para manter a
 * compatibilidade das telas; os números precisos vivem nos campos `bread*`.
 */
export interface DeliveryRow {
  condominiumId: string
  condominiumName: string
  userId: string
  name: string
  apartment: string
  block: string
  /** Total de PÃES da parada = confirmados (pedido + Cestinha) + previstos. */
  quantity: number
  slotId: string
  slotLabel: string
  type: 'SINGLE' | 'SCHEDULED'
  source: 'order' | 'projected'
  risk: RiskFlag
  /** Pães já pagos — é o que entra no pedido ao fornecedor. */
  breadConfirmed: number
  /** Pães previstos pela agenda, ainda não materializados. */
  breadProjected: number
  /** Recorte de `breadConfirmed` vindo da Cestinha (`MarketOrder.breadQty`). */
  breadFromMarket: number
  /** Pães confirmados de pedido avulso. */
  breadSingle: number
  /** Pães confirmados de pedido da agenda. */
  breadScheduled: number
  /** Produtos do mercadinho desta parada (não-pão). */
  marketItems: MarketItemLine[]
  marketItemCount: number
  marketOrderIds: string[]
  origin: 'bread' | 'market' | 'both'
}

/** Quebra por slot (turno) usada na lista e no detalhe. */
export interface SlotBreakdown {
  slotId: string
  label: string
  breads: number
  deliveries: number
  /** Itens do mercadinho do turno — métrica paralela aos pães (D-1). */
  items: number
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
   * _buildDeliveryRows — fonte única de verdade das entregas do dia (BRT).
   *
   * Delega a demanda para `buildBreadDemand` (`lib/bread-demand.ts`), que une pedidos de pão
   * (`Order`), **Cestinhas confirmadas** (`MarketOrder.breadQty` é pão — D-1) e os previstos da
   * agenda, já mesclados por PARADA `(userId, slotId)` (D-5). Aqui só resolvemos apresentação:
   * nome/apartamento/bloco, label do turno e a flag de risco.
   *
   * Tanto a lista (getDraft) quanto o detalhe (getCondominiumDetail), os dias em aberto
   * (getUpcomingDays), a geração do pedido (createQuick) e os avisos de corte derivam destas
   * linhas — então os números reconciliam entre todas as telas.
   *
   * Risco (só para previstos, que ainda dependem de saldo/conta ativa para virar pedido):
   * - 'blocked'  → cliente bloqueado
   * - 'no-credit'→ total previsto do cliente > saldo de créditos atual E SEM recarga automática
   *               ativa (com autoRecharge.active o sistema cobra/recarrega antes do corte → não é risco)
   */
  private async _buildDeliveryRows(slotId: string, deliveryDate: Date, condominiumId?: string): Promise<DeliveryRow[]> {
    const stops = await buildBreadDemand(this.prisma, slotId, deliveryDate, { condominiumId })
    if (stops.length === 0) return []

    // Carregar clientes (nome, ap/bloco, saldo, bloqueio) e condomínios (nome + slots) referenciados
    const userIds = [...new Set(stops.map((s) => s.userId))]
    const condoIds = [...new Set(stops.map((s) => s.condominiumId))]

    const [users, condos] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, apartment: true, block: true, creditMilli: true, isBlocked: true, autoRecharge: true },
      }),
      this.prisma.condominium.findMany({
        where: { id: { in: condoIds } },
        select: { id: true, name: true, deliverySlots: true },
      }),
    ])

    const userById = new Map(users.map((u) => [u.id, u]))
    const condoById = new Map(condos.map((c) => [c.id, c]))

    // Resolver label do slot por condomínio (deliverySlots embute slotId/name/label)
    const slotLabelFor = (condoId: string, sid: string): string => {
      const condo = condoById.get(condoId)
      const slot = condo?.deliverySlots?.find((s) => s.slotId === sid || s.name === sid)
      return slot?.label ?? fallbackSlotLabel(sid)
    }

    // Total previsto por usuário — base do flag 'no-credit' (saldo cobre tudo que vem?)
    const projTotalByUser = new Map<string, number>()
    for (const s of stops) {
      if (s.breadProjected > 0) {
        projTotalByUser.set(s.userId, (projTotalByUser.get(s.userId) ?? 0) + s.breadProjected)
      }
    }

    return stops.map((s) => {
      const u = userById.get(s.userId)
      // Risco só existe para a parte PREVISTA — o que já foi pago não corre risco de não materializar.
      // Recarga automática ativa cobre o saldo no corte (cobrança off_session antes de materializar),
      // então um previsto sem saldo deixa de ser risco 'no-credit'. Bloqueio segue valendo sempre.
      const autoRechargeActive = Boolean((u?.autoRecharge as { active?: boolean } | null)?.active)
      const risk: RiskFlag =
        s.breadProjected <= 0
          ? ''
          : u?.isBlocked
            ? 'blocked'
            : !autoRechargeActive &&
                (projTotalByUser.get(s.userId) ?? 0) > wholeBreads((u?.creditMilli ?? 0))
              ? 'no-credit'
              : ''
      return {
        condominiumId: s.condominiumId,
        condominiumName: condoById.get(s.condominiumId)?.name ?? s.condominiumId,
        userId: s.userId,
        name: u?.name ?? 'Cliente',
        apartment: u?.apartment ?? '',
        block: u?.block ?? '',
        quantity: s.breadConfirmed + s.breadProjected,
        slotId: s.slotId,
        slotLabel: slotLabelFor(s.condominiumId, s.slotId),
        // Rótulo de exibição da parada: agenda quando há pão de agenda; senão avulso
        // (parada só-Cestinha também cai em SINGLE — é uma compra pontual).
        type: s.breadScheduled > 0 || (s.breadProjected > 0 && s.breadConfirmed === 0) ? 'SCHEDULED' : 'SINGLE',
        source: s.hasConfirmed ? 'order' : 'projected',
        risk,
        breadConfirmed: s.breadConfirmed,
        breadProjected: s.breadProjected,
        breadFromMarket: s.breadFromMarket,
        breadSingle: s.breadSingle,
        breadScheduled: s.breadScheduled,
        marketItems: s.marketItems,
        marketItemCount: s.marketItemCount,
        marketOrderIds: s.marketOrderIds,
        origin: s.origin,
      }
    })
  }

  /**
   * Agrega paradas em quebra por turno, ordenada por label. `breads` é o total de pães
   * (confirmados + previstos) e `deliveries` conta PARADAS (D-5) — um cliente com pão + Cestinha
   * no mesmo turno conta 1. `items` é a métrica paralela dos produtos do mercadinho (D-1).
   */
  private _slotBreakdown(rows: DeliveryRow[]): SlotBreakdown[] {
    const map = new Map<string, SlotBreakdown>()
    for (const r of rows) {
      const cur = map.get(r.slotId) ?? { slotId: r.slotId, label: r.slotLabel, breads: 0, deliveries: 0, items: 0 }
      cur.breads += r.quantity
      cur.deliveries += 1
      cur.items += r.marketItemCount
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
      marketItemCount: number
      marketBreads: number
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
      // `deliveryCount` e `projectedDeliveries` contam PARADAS e são disjuntos por construção
      // (a parada tem algo pago, ou é puramente prevista) — o front soma os dois para "entregas".
      const confirmed = condoRows.filter((r) => r.source === 'order')
      const riskUsers = new Set(condoRows.filter((r) => r.risk !== '').map((r) => r.userId))
      return {
        condominiumId,
        name: condoRows[0]?.condominiumName ?? condominiumId,
        deliveryCount: confirmed.length,
        // Pães já pagos — inclui o pão vendido dentro da Cestinha (D-1).
        totalBreads: condoRows.reduce((s, r) => s + r.breadConfirmed, 0),
        projectedBreads: condoRows.reduce((s, r) => s + r.breadProjected, 0),
        projectedDeliveries: condoRows.length - confirmed.length,
        bySlot: this._slotBreakdown(condoRows),
        riskCount: riskUsers.size,
        // Métricas paralelas da Cestinha (D-1) — nunca somadas aos pães.
        marketItemCount: condoRows.reduce((s, r) => s + r.marketItemCount, 0),
        marketBreads: condoRows.reduce((s, r) => s + r.breadFromMarket, 0),
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
    byType: { single: number; scheduled: number; cestinha: number }
    marketItemCount: number
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
      marketItems: MarketItemLine[]
      marketItemCount: number
      breadFromMarket: number
      origin: 'bread' | 'market' | 'both'
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

    const confirmed = rows.filter((r) => r.source === 'order')
    const riskUsers = new Set(rows.filter((r) => r.risk !== '').map((r) => r.userId))

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
      materializedBreads: rows.reduce((s, r) => s + r.breadConfirmed, 0),
      projectedBreads: rows.reduce((s, r) => s + r.breadProjected, 0),
      deliveryCount: confirmed.length,
      projectedDeliveries: rows.length - confirmed.length,
      riskCount: riskUsers.size,
      bySlot: this._slotBreakdown(rows),
      // Quebra dos PÃES por origem — single + scheduled + cestinha = pães confirmados (D-1).
      // (previstos ficam fora: ainda não são pão de ninguém.)
      byType: {
        single: rows.reduce((s, r) => s + r.breadSingle, 0),
        scheduled: rows.reduce((s, r) => s + r.breadScheduled, 0),
        cestinha: rows.reduce((s, r) => s + r.breadFromMarket, 0),
      },
      marketItemCount: rows.reduce((s, r) => s + r.marketItemCount, 0),
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
        marketItems: r.marketItems,
        marketItemCount: r.marketItemCount,
        breadFromMarket: r.breadFromMarket,
        origin: r.origin,
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
    /**
     * Linhas do pedido. `productId` ausente = pão (compat com chamadas antigas do front, que só
     * sabiam pedir pão). Com `productId`, o custo vem da matriz de fornecimento (D-8) daquele
     * (fornecedor, produto) — não mais do `Supplier.pricePerUnit`, que é o preço do pão.
     */
    items: Array<{ supplierId: string; productId?: string; quantity: number }>
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

    const breadProductId = (await this.prisma.setting.findUnique({ where: { key: BREAD_PRODUCT_KEY } }))?.value ?? null

    // Resolve custo e nome de cada linha, validando fornecedor e o vínculo na matriz.
    const itemsWithPrice = await Promise.all(
      data.items.map(async (item) => {
        const supplier = await this.prisma.supplier.findUnique({ where: { id: item.supplierId } })
        if (!supplier) {
          throw { statusCode: 404, message: `Fornecedor ${item.supplierId} não encontrado` }
        }
        if (supplier.isActive === false) {
          throw { statusCode: 400, message: `Fornecedor ${supplier.name} está inativo` }
        }

        const productId = item.productId ?? breadProductId
        let unitPrice = supplier.pricePerUnit // fallback legado (D-10)
        let productName: string | null = null

        if (productId) {
          const link = await this.prisma.supplierProduct.findUnique({
            where: { supplierId_productId: { supplierId: item.supplierId, productId } },
          })
          const product = await this.prisma.product.findUnique({
            where: { id: productId },
            select: { name: true },
          })
          productName = product?.name ?? null
          if (link) {
            unitPrice = link.unitCost
          } else if (item.productId) {
            // Pedido explícito de um produto que este fornecedor NÃO fornece: barrar em vez de
            // inventar um custo. (Sem `item.productId`, a chamada é legada e o fallback vale.)
            throw {
              statusCode: 409,
              message: `${supplier.name} não fornece "${productName ?? productId}". Cadastre o produto no fornecedor primeiro.`,
            }
          }
        }

        return {
          supplierId: item.supplierId,
          productId: productId ?? null,
          productName,
          quantity: item.quantity,
          unitPrice,
          isBread: productId != null && productId === breadProductId,
        }
      }),
    )

    // `totalQuantity` continua sendo SÓ PÃES (o desperdício compara com pães entregues).
    const totalQuantity = itemsWithPrice.filter((i) => i.isBread).reduce((s, i) => s + i.quantity, 0)
    const totalItems = itemsWithPrice.filter((i) => !i.isBread).reduce((s, i) => s + i.quantity, 0)
    const totalValue = round2(itemsWithPrice.reduce((s, i) => s + i.quantity * i.unitPrice, 0))

    const order = await this.repository.create({
      date: deliveryDate,
      slotId: slot.slotId,
      slotLabel: slot.label,
      cutoffTime,
      totalQuantity,
      totalItems,
      totalValue,
      kind: 'DELIVERY_BATCH',
      items: itemsWithPrice.map(({ isBread: _isBread, ...rest }) => rest),
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
   * getRestockSuggestion — o que repor de inventário (`FIXED`) e de quem comprar (H8 / D-9).
   *
   * Junta três coisas que já existem e nunca se falavam: o ritmo de venda do produto
   * (`buildRestockCandidates`), a matriz de fornecimento (`loadSourcingOptions` — D-7/D-8) e o
   * motor de rateio (`splitDemandBySupplier`). Não cria nada; é o que a tela mostra antes de
   * confirmar.
   *
   * `unsourced` sai explícito (regra 4 do §3-B.4): produto que precisa de reposição e não tem
   * fornecedor cadastrado **não** pode desaparecer da tela em silêncio.
   */
  async getRestockSuggestion(coverDays?: number): Promise<{
    coverDays: number
    products: Array<
      RestockCandidate & {
        options: Array<{
          supplierId: string
          supplierName: string
          unitCost: number
          defaultSharePct: number
          isPreferred: boolean
          minOrderQty: number | null
          /** Quantidade sugerida DESTE fornecedor (rateio da sugestão pela matriz). */
          suggested: number
          belowMinimum: boolean
        }>
      }
    >
    unsourced: UnsourcedProduct[]
    totalQuantity: number
    totalValue: number
  }> {
    const candidates = await buildRestockCandidates(this.prisma, { coverDays })
    const options = await loadSourcingOptions(
      this.prisma,
      candidates.map((c) => c.productId),
    )
    // Rateia só o que tem quantidade a comprar — um produto crítico com sugestão 0 (sem base de
    // consumo e ainda fora da faixa) aparece na tela como contexto, não como linha de compra.
    const split = splitDemandBySupplier(
      candidates.map((c) => ({ productId: c.productId, productName: c.productName, qty: c.suggestedQty })),
      options,
    )
    const lineBy = new Map(split.lines.map((l) => [`${l.productId}|${l.supplierId}`, l]))

    return {
      coverDays: coverDays ?? RESTOCK_COVER_DAYS,
      products: candidates.map((c) => ({
        ...c,
        options: (options.get(c.productId) ?? []).map((o) => {
          const line = lineBy.get(`${c.productId}|${o.supplierId}`)
          return {
            supplierId: o.supplierId,
            supplierName: o.supplierName,
            unitCost: o.unitCost,
            defaultSharePct: o.defaultSharePct,
            isPreferred: o.isPreferred,
            minOrderQty: o.minOrderQty ?? null,
            suggested: line?.quantity ?? 0,
            belowMinimum: line?.belowMinimum ?? false,
          }
        }),
      })),
      unsourced: split.unsourced,
      totalQuantity: split.totalQuantity,
      totalValue: split.totalValue,
    }
  }

  /**
   * createRestock — pedido de REPOSIÇÃO de inventário (D-9), sem turno e sem data de entrega.
   *
   * Diferenças em relação ao `create` (que é `DELIVERY_BATCH`) e por que elas importam:
   * - **`slotId: null`.** Reposição não pertence a um turno. Isso também é o que mantém o RESTOCK
   *   fora do resto da operação de graça: `getGeneratedStatus`/`getSlotsStatus` filtram por
   *   `slotId` e o gate da Separação descarta `slotId` nulo — um pedido de geleia não pode fazer a
   *   tela dizer "pedido do turno gerado" nem abrir uma separação.
   * - **`totalQuantity: 0` SEMPRE.** Esse campo é "pães" e o `getWasteReport` compara ele com os
   *   pães entregues (decisão 4 da Onda H1–H7). Um RESTOCK de 20 potes de geleia ali dentro faria
   *   o relatório de desperdício acusar 20 pães jogados no lixo. As unidades vão em `totalItems`.
   * - **Só produto `FIXED`.** `DAILY` (pão, bolo) se compra pela demanda do turno; comprar
   *   "inventário" de um produto que reseta a capacidade todo dia não significa nada.
   *
   * Finaliza na hora, como o `create`: o admin não está redigindo um rascunho, está comprando —
   * e o histórico (`getHistory`) só lista FINALIZED, então um DRAFT ficaria invisível.
   */
  async createRestock(data: {
    items: Array<{ supplierId: string; productId: string; quantity: number }>
  }): Promise<{ id: string; totalItems: number; totalValue: number }> {
    const now = new Date()
    const breadProductId =
      (await this.prisma.setting.findUnique({ where: { key: BREAD_PRODUCT_KEY } }))?.value ?? null

    const itemsWithPrice = await Promise.all(
      data.items.map(async (item) => {
        const [supplier, product] = await Promise.all([
          this.prisma.supplier.findUnique({ where: { id: item.supplierId } }),
          this.prisma.product.findUnique({
            where: { id: item.productId },
            select: { name: true, stockType: true, isActive: true },
          }),
        ])
        if (!supplier) throw { statusCode: 404, message: `Fornecedor ${item.supplierId} não encontrado` }
        if (supplier.isActive === false) throw { statusCode: 400, message: `Fornecedor ${supplier.name} está inativo` }
        if (!product) throw { statusCode: 404, message: `Produto ${item.productId} não encontrado` }
        if (item.productId === breadProductId) {
          throw {
            statusCode: 400,
            message: 'O pão é comprado pela demanda do turno, não por reposição de estoque.',
          }
        }
        if (product.stockType !== 'FIXED') {
          throw {
            statusCode: 400,
            message: `"${product.name}" tem capacidade por dia, não estoque — peça pela demanda do turno.`,
          }
        }

        // D-8: o custo mora na relação (fornecedor, produto). Sem a linha, o fornecedor não
        // fornece este produto — barrar em vez de inventar um preço.
        const link = await this.prisma.supplierProduct.findUnique({
          where: { supplierId_productId: { supplierId: item.supplierId, productId: item.productId } },
        })
        if (!link) {
          throw {
            statusCode: 409,
            message: `${supplier.name} não fornece "${product.name}". Cadastre o produto no fornecedor primeiro.`,
          }
        }

        return {
          supplierId: item.supplierId,
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: link.unitCost,
        }
      }),
    )

    const totalItems = itemsWithPrice.reduce((s, i) => s + i.quantity, 0)
    const totalValue = round2(itemsWithPrice.reduce((s, i) => s + i.quantity * i.unitPrice, 0))

    const order = await this.repository.create({
      date: now,
      slotId: null,
      slotLabel: null,
      cutoffTime: now, // sem corte: reposição não depende de turno (campo obrigatório no modelo)
      totalQuantity: 0, // ver cabeçalho — NUNCA somar itens aqui
      totalItems,
      totalValue,
      kind: 'RESTOCK',
      items: itemsWithPrice,
    })
    await this.repository.finalize(order.id)

    return { id: order.id, totalItems, totalValue }
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
      totalItems: number
    }>
  > {
    const slots = (await getGlobalDeliverySlots(this.prisma)).filter((s) => s.isActive)
    const out = await Promise.all(
      slots.map(async (slot) => {
        const deliveryDate = targetDeliveryDate(slot.time, slot.cutoffTime)
        const { start, end } = brtDayRange(deliveryDate)
        const rows = await this._buildDeliveryRows(slot.slotId, deliveryDate)
        const totalBreads = rows.reduce((s, r) => s + r.quantity, 0)
        const totalItems = rows.reduce((s, r) => s + r.marketItemCount, 0)
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
          totalItems,
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
        items: number
        marketBreads: number
      }>
      totalBreads: number
      totalItems: number
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
            // breads = confirmados (o que será pedido, JÁ incluindo o pão da Cestinha — D-1);
            // projectedBreads = previstos (contexto).
            const breads = rows.reduce((s, r) => s + r.breadConfirmed, 0)
            const projectedBreads = rows.reduce((s, r) => s + r.breadProjected, 0)
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
              // Um turno com SÓ Cestinha (0 pães, N itens) tem entrega a fazer e precisa aparecer.
              hasOrders: rows.length > 0,
              items: rows.reduce((s, r) => s + r.marketItemCount, 0),
              marketBreads: rows.reduce((s, r) => s + r.breadFromMarket, 0),
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
          totalItems: slotStates.reduce((s, x) => s + x.items, 0),
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
  /**
   * getSplitPreview — o rateio PROPOSTO para um (turno, dia), sem criar nada.
   *
   * Alimenta o passo "Dividir" da tela: um card por produto, uma linha por fornecedor daquele
   * produto, já com a quantidade sugerida e o custo. O front NÃO reimplementa o motor de rateio —
   * duas implementações da mesma regra de arredondamento sempre divergem, e aí o que a tela mostra
   * deixa de ser o que o "Gerar direto" faria.
   */
  async getSplitPreview(slotId: string, dateStr?: string): Promise<{
    products: Array<{
      productId: string
      productName: string
      isBread: boolean
      demand: number
      options: Array<{
        supplierId: string
        supplierName: string
        unitCost: number
        defaultSharePct: number
        isPreferred: boolean
        minOrderQty: number | null
        /** Quantidade sugerida pelo rateio padrão. */
        suggested: number
      }>
    }>
    unsourced: UnsourcedProduct[]
    totalQuantity: number
    totalValue: number
  }> {
    const { deliveryDate } = await this._resolveSlot(slotId, dateStr)
    const demand = await buildProductDemand(this.prisma, slotId, deliveryDate)
    const options = await loadSourcingOptions(this.prisma, demand.map((d) => d.productId))
    const split = splitDemandBySupplier(demand, options)

    const suggestedBy = new Map<string, number>()
    for (const l of split.lines) suggestedBy.set(`${l.productId}|${l.supplierId}`, l.quantity)

    return {
      products: demand.map((d) => ({
        productId: d.productId,
        productName: d.productName,
        isBread: d.isBread,
        demand: d.qty,
        options: (options.get(d.productId) ?? []).map((o) => ({
          supplierId: o.supplierId,
          supplierName: o.supplierName,
          unitCost: o.unitCost,
          defaultSharePct: o.defaultSharePct,
          isPreferred: o.isPreferred,
          minOrderQty: o.minOrderQty ?? null,
          suggested: suggestedBy.get(`${d.productId}|${o.supplierId}`) ?? 0,
        })),
      })),
      unsourced: split.unsourced,
      totalQuantity: split.totalQuantity,
      totalValue: split.totalValue,
    }
  }

  async createQuick(
    slotId: string,
    dateStr?: string,
  ): Promise<{ id: string; unsourced?: UnsourcedProduct[] } | null> {
    const { deliveryDate } = await this._resolveSlot(slotId, dateStr)

    // Demanda de COMPRA por produto (H3): pão (Order + MarketOrder.breadQty) + produtos do
    // mercadinho. Só confirmada — previstos da agenda podem não materializar.
    const demand = await buildProductDemand(this.prisma, slotId, deliveryDate)
    if (demand.length === 0) return null

    // Rateio pela matriz de fornecimento (H4): cada produto entre os SEUS fornecedores, com a
    // fatia padrão de cada um. Substitui o percentual global aplicado ao único produto (D-7).
    const options = await loadSourcingOptions(this.prisma, demand.map((d) => d.productId))
    const split = splitDemandBySupplier(demand, options)

    if (split.lines.length === 0) {
      // Nada rateável: ou não há fornecedor cadastrado, ou a demanda toda ficou órfã.
      if (split.unsourced.length > 0) {
        throw {
          statusCode: 409,
          message: `Sem fornecedor cadastrado para: ${split.unsourced.map((u) => u.productName).join(', ')}.`,
        }
      }
      throw { statusCode: 400, message: 'Nenhum fornecedor ativo cadastrado' }
    }

    const created = await this.create({
      items: split.lines.map((l) => ({ supplierId: l.supplierId, productId: l.productId, quantity: l.quantity })),
      slotId,
      date: dateStr,
    })
    // Nunca omitir em silêncio o que ficou de fora (§3-B.4, regra 4) — o chamador avisa o admin.
    return split.unsourced.length > 0 ? { ...created, unsourced: split.unsourced } : created
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
          // Aviso ao admin — o pedido foi gerado AUTOMATICAMENTE (admin não gerou a tempo).
          if (res) {
            // §3-B.4 regra 4: a rede de segurança gera o que dá E DIZ o que ficou de fora.
            // Omitir seria pior que falhar — o admin acharia que comprou tudo.
            const missing = res.unsourced?.length
              ? ` ATENÇÃO: sem fornecedor cadastrado para ${res.unsourced.map((u) => `${u.qty}× ${u.productName}`).join(', ')} — não foi pedido.`
              : ''
            await new NotificationsService(this.fastify).notifyAdmins({
              type: NotificationType.ADMIN_AUTOGEN_DONE,
              title: 'Pedido gerado automaticamente',
              body: `O pedido ao fornecedor do turno ${slot.label} foi gerado automaticamente (rateio padrão).${missing}`,
              actionRoute: '/admin',
            })
          }
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
   * Avisa os admins no MINUTO EXATO do corte de cada turno ("chegou a hora de gerar o
   * pedido"), desde que o PurchaseOrder ainda não tenha sido gerado e haja pães esperados.
   * In-app + push respeitando o toggle ADMIN_CUTOFF_REACHED. Best-effort, 1× por minuto/turno.
   */
  async sendCutoffReachedNotifications(now: Date = new Date()): Promise<void> {
    await this._notifyAtCutoffOffset(now, 0, async (slot, expected) => {
      await new NotificationsService(this.fastify).notifyAdmins({
        type: NotificationType.ADMIN_CUTOFF_REACHED,
        title: 'Hora de gerar o pedido',
        body: `Corte do turno ${slot.label} chegou · ${expected} pães. Gere o pedido ao fornecedor.`,
        actionRoute: '/admin',
      })
    })
  }

  /**
   * Avisa os admins 15 min ANTES da geração automática (corte + delay - 15). Como a rede de
   * segurança gera em corte +60, o aviso sai em corte +45. Só dispara se o pedido ainda não
   * foi gerado e há pães esperados. Toggle ADMIN_AUTOGEN_WARNING. Best-effort.
   */
  async sendAutogenWarnings(now: Date = new Date(), delayMinutes = 60, leadMin = 15): Promise<void> {
    const offset = Math.max(0, delayMinutes - leadMin)
    await this._notifyAtCutoffOffset(now, offset, async (slot) => {
      await new NotificationsService(this.fastify).notifyAdmins({
        type: NotificationType.ADMIN_AUTOGEN_WARNING,
        title: 'Geração automática em 15 min',
        body: `Se você não gerar o pedido do turno ${slot.label} em 15 min, ele será gerado automaticamente.`,
        actionRoute: '/admin',
      })
    })
  }

  /**
   * Helper compartilhado: no MINUTO EXATO (corte + offsetMin) de cada turno, se o PurchaseOrder
   * do turno ainda não existe e há pães esperados (>0), executa `action(slot, expected)`.
   * Espelha os guards de sendCutoffReminders (idempotente por minuto).
   */
  private async _notifyAtCutoffOffset(
    now: Date,
    offsetMin: number,
    action: (slot: GlobalDeliverySlot, expected: number) => Promise<void>,
  ): Promise<void> {
    const [nh, nm] = nowHHMM(now).split(':').map(Number)
    const cur = nh * 60 + nm
    const slots = (await getGlobalDeliverySlots(this.prisma)).filter((s) => s.isActive)

    for (const slot of slots) {
      const [ch, cm] = slot.cutoffTime.split(':').map(Number)
      const target = (ch * 60 + cm + offsetMin + 1440) % 1440
      if (cur !== target) continue

      const deliveryDate = targetDeliveryDate(slot.time, slot.cutoffTime, now)
      const { start, end } = brtDayRange(deliveryDate)
      const po = await this.prisma.purchaseOrder.findFirst({
        where: { status: 'FINALIZED', slotId: slot.slotId, date: { gte: start, lte: end } },
        select: { id: true },
      })
      if (po) continue // já gerado — nada a avisar

      const rows = await this._buildDeliveryRows(slot.slotId, deliveryDate)
      const expected = rows.reduce((s, r) => s + r.quantity, 0)
      if (expected <= 0) continue

      try {
        await action(slot, expected)
      } catch (err) {
        this.fastify.log.warn({ err, slotId: slot.slotId }, '[supplier-orders] falha ao notificar corte — ignorado')
      }
    }
  }

  /**
   * Avisa os admins sobre ENTREGAS PENDENTES após o prazo do turno: no minuto exato de
   * (horário de entrega + bufferMin), conta os pedidos de HOJE naquele turno ainda não
   * finalizados (SCHEDULED/SEPARATED/OUT_FOR_DELIVERY) e, se houver, notifica.
   * Toggle ADMIN_DELIVERY_PENDING.
   *
   * O disparo é por HORÁRIO EFETIVO, não pelo horário do padrão global: condomínios que
   * compartilham o mesmo horário caem num aviso só, e um condomínio com horário próprio é
   * avisado no horário DELE. Sem personalização, isto é exatamente um aviso por turno cobrindo
   * a operação inteira — igual ao comportamento histórico. Quando o grupo é um subconjunto, o
   * aviso nomeia os condomínios (senão "3 entregas pendentes" não diria pendentes ONDE).
   */
  async sendDeliveryPendingReminders(now: Date = new Date(), bufferMin = 60): Promise<void> {
    const cur = minuteOfDay(nowHHMM(now))
    const groups = groupCondoSlotsByTime(await listActiveCondoSlots(this.prisma))
    const { start, end } = brtDayRange(now)

    for (const group of groups) {
      if (cur !== minuteOfDay(group.time, bufferMin)) continue

      // Pendências de pão E de Cestinha: uma parada só-Cestinha esquecida também precisa avisar.
      const scope = {
        slotId: group.slotId,
        condominiumId: { in: group.condominiumIds },
        scheduledDate: { gte: start, lte: end },
      }
      const [pending, pendingMarket] = await Promise.all([
        this.prisma.order.findMany({
          where: { ...scope, status: { in: ['SCHEDULED', 'SEPARATED', 'OUT_FOR_DELIVERY'] } },
          select: { userId: true, quantity: true },
        }),
        this.prisma.marketOrder.findMany({
          where: { ...scope, status: { in: ['SCHEDULED', 'SEPARATED', 'OUT_FOR_DELIVERY'] } },
          select: { userId: true, breadQty: true, items: { select: { qty: true } } },
        }),
      ])
      if (pending.length === 0 && pendingMarket.length === 0) continue

      // D-5: conta PARADAS, não pedidos — pão + Cestinha do mesmo cliente é uma visita.
      const stops = new Set<string>()
      for (const o of pending) stops.add(o.userId)
      for (const m of pendingMarket) stops.add(m.userId)
      const total = pending.reduce((s, o) => s + o.quantity, 0) + pendingMarket.reduce((s, m) => s + m.breadQty, 0)
      const items = pendingMarket.reduce((s, m) => s + m.items.reduce((n, i) => n + i.qty, 0), 0)
      const onde = group.coversAllCondos ? '' : ` em ${group.condominiumNames.join(', ')}`
      try {
        await new NotificationsService(this.fastify).notifyAdmins({
          type: NotificationType.ADMIN_DELIVERY_PENDING,
          title: 'Entregas pendentes',
          body: `${stops.size} entrega(s) do turno ${group.label}${onde} ainda não concluídas (${total} pães${items > 0 ? ` · ${items} itens` : ''}) após o prazo.`,
          actionRoute: '/admin',
        })
      } catch (err) {
        this.fastify.log.warn(
          { err, slotId: group.slotId, time: group.time },
          '[supplier-orders] falha no aviso de pendentes — ignorado',
        )
      }
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
  async getPdfBuffer(id: string, supplierId?: string): Promise<Buffer> {
    const data = await this._buildSupplierOrderData(id, supplierId)
    return generatePdf(data)
  }

  /**
   * getExcelBuffer — gera Buffer Excel do pedido ao fornecedor.
   *
   * @param supplierId quando informado, gera o documento SÓ daquele fornecedor (ver getPdfBuffer)
   * @throws { statusCode: 404 } se PurchaseOrder não existe
   */
  async getExcelBuffer(id: string, supplierId?: string): Promise<Buffer> {
    const data = await this._buildSupplierOrderData(id, supplierId)
    return generateExcel(data)
  }

  /** Fornecedores presentes num pedido — alimenta um botão de download por fornecedor. */
  async getOrderSuppliers(id: string): Promise<Array<{ supplierId: string; supplierName: string; quantity: number; total: number }>> {
    const orderWithItems = await this.repository.findByIdWithItems(id)
    if (!orderWithItems) throw { statusCode: 404, message: 'Pedido ao fornecedor não encontrado' }

    const ids = [...new Set(orderWithItems.items.map((i) => i.supplierId))]
    const suppliers = ids.length
      ? await this.prisma.supplier.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      : []
    const nameById = new Map(suppliers.map((s) => [s.id, s.name]))

    return ids
      .map((sid) => {
        const items = orderWithItems.items.filter((i) => i.supplierId === sid)
        return {
          supplierId: sid,
          supplierName: nameById.get(sid) ?? sid,
          quantity: items.reduce((s, i) => s + i.quantity, 0),
          total: round2(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)),
        }
      })
      .sort((a, b) => a.supplierName.localeCompare(b.supplierName, 'pt-BR'))
  }

  /**
   * _buildSupplierOrderData — dados do pedido no formato dos geradores de PDF/Excel.
   *
   * Com `supplierId`, filtra as linhas daquele fornecedor e preenche o cabeçalho com o nome/CNPJ
   * dele — é o documento ENVIÁVEL. Sem, devolve o consolidado (visão interna do admin).
   *
   * Isto conserta um problema que já existia antes da matriz: o documento único listava TODOS os
   * fornecedores com seus preços, então mandá-lo para um fornecedor mostrava o preço do concorrente.
   * Com N produtos ficaria pior.
   */
  private async _buildSupplierOrderData(id: string, supplierId?: string): Promise<SupplierOrderData> {
    const orderWithItems = await this.repository.findByIdWithItems(id)

    if (!orderWithItems) {
      throw { statusCode: 404, message: 'Pedido ao fornecedor não encontrado' }
    }

    const rows = supplierId
      ? orderWithItems.items.filter((i) => i.supplierId === supplierId)
      : orderWithItems.items
    if (supplierId && rows.length === 0) {
      throw { statusCode: 404, message: 'Este fornecedor não tem itens neste pedido' }
    }

    const breadProductId = (await this.prisma.setting.findUnique({ where: { key: BREAD_PRODUCT_KEY } }))?.value ?? null

    // Nomes de fornecedores e produtos em 2 queries (evita N+1 por item).
    const supplierIds = [...new Set(rows.map((i) => i.supplierId))]
    const productIds = [...new Set(rows.map((i) => i.productId).filter((p): p is string => !!p))]
    const [suppliers, products] = await Promise.all([
      supplierIds.length
        ? this.prisma.supplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, name: true, cnpj: true } })
        : Promise.resolve([]),
      productIds.length
        ? this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
    ])
    const supplierById = new Map(suppliers.map((s) => [s.id, s]))
    const productNameById = new Map(products.map((p) => [p.id, p.name]))

    const items = rows.map((item) => {
      const s = supplierById.get(item.supplierId)
      // Item legado (sem productId) é pão — mantém o rótulo legível no documento.
      const product =
        item.productName ??
        (item.productId ? productNameById.get(item.productId) : undefined) ??
        'Pão Francês'
      return {
        supplier: s?.name ?? item.supplierId,
        product,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: round2(item.quantity * item.unitPrice),
      }
    })
    // Pão primeiro (item principal da operação), depois por nome.
    items.sort((a, b) => {
      const aBread = a.product === 'Pão Francês'
      const bBread = b.product === 'Pão Francês'
      if (aBread !== bBread) return aBread ? -1 : 1
      return a.product.localeCompare(b.product, 'pt-BR')
    })

    const grandTotal = items.reduce((sum, item) => sum + item.quantity, 0)
    const grandTotalValue = items.reduce((sum, item) => sum + item.total, 0)
    const breadTotal = rows
      .filter((i) => (i.productId ?? breadProductId) === breadProductId)
      .reduce((s, i) => s + i.quantity, 0)

    // Formatar data BRT
    const dateFormatted = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(orderWithItems.date)

    const target = supplierId ? supplierById.get(supplierId) : undefined

    return {
      date: dateFormatted,
      slotLabel: orderWithItems.slotLabel ?? undefined,
      // Sem `kind` (pedidos antigos) = DELIVERY_BATCH, o único regime que existia.
      kind: orderWithItems.kind ?? 'DELIVERY_BATCH',
      supplier: target ? { name: target.name, cnpj: target.cnpj } : undefined,
      items,
      grandTotal,
      breadTotal,
      grandTotalBrl: `R$ ${grandTotalValue.toFixed(2).replace('.', ',')}`,
    }
  }
}
