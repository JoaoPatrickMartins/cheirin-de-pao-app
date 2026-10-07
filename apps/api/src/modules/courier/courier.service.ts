import { FastifyInstance } from 'fastify'
import { NotificationType } from '@prisma/client'
import { compareUnits, readCondoAccess } from '@cheirin-de-pao/shared'
import { CourierRepository } from './courier.repository.js'
import { AdminOrdersService } from '../admin-orders/admin-orders.service.js'
import {
  getGlobalDeliverySlots,
  listActiveCondoSlots,
  groupCondoSlotsByTime,
  minuteOfDay,
} from '../../lib/delivery-slots.js'
import { addressToQuery, geocodeAddress, type AddressLike } from '../../lib/geocode.js'
import { nowHHMM, brtDayRange, brtDateStr, brtNoonFromStr } from '../../lib/cutoff.js'
import { isHookOnly, pendingHookOnlyStops, resolvedHookOnlyStops } from '../../lib/hook-stops.js'
import { AdminHooksService } from '../admin-hooks/admin-hooks.service.js'
import { notifyMarketDelivered, notifyMarketNotDelivered } from '../market/market-notify.js'
import { completeMarketStop } from '../../lib/market-pipeline.js'
import { afterDelivery } from '../../lib/referral.js'
import { NotificationsService } from '../notifications/notifications.service.js'
import {
  normalizeStopCode,
  matchesStopCode,
  STOP_CODE_LENGTH,
  LEGACY_STOP_CODE_LENGTH,
  FAILURE_LABELS,
  NO_PHOTO_LABELS,
  isFailureCode,
  type FailureCode,
  type NoPhotoReason,
} from '@cheirin-de-pao/shared'
import { uploadPrivateImage, isStorageConfigured, StorageError } from '../../lib/storage.js'
import { resolveCourierRules } from '../../lib/courier-profile.js'
import { firstDeliveryDayByUser } from '../../lib/first-delivery.js'
import type { TodayOrdersResponse } from './courier.schema.js'
import { getRouteConfig } from '../../lib/route-config.js'
import { computeEtas } from '../../lib/route-engine.js'
import { metricsForOrder, resolveDayRoute, type PlanCondo } from './courier-plan.js'
import { CourierRunService } from './courier-runs.js'
import { returnHookToQueue } from './courier-ops.js'
import {
  buildStopSummary,
  clampOccurredAt,
  lastClientOpId,
  recordStopOutcome,
  resolveStopByKey,
  saveProofPhoto,
  skipProof,
  type HookStopState,
  type ProofView,
  type StopScope,
  type StopSummary,
} from './courier-stop.js'

/** Opções da confirmação vindas do app (T-7, T-17). */
export interface ConfirmOpts {
  via?: 'SCAN' | 'CODE' | 'LIST'
  /** Id da operação na fila offline: reenviar a mesma operação não vira "já confirmada". */
  clientOpId?: string
  /** Horário real do desfecho (fila offline), em ISO. */
  occurredAt?: string
}

/** Não entrega (E6): motivo padronizado + texto (obrigatório em "Outro"). */
export interface NotDeliveredOpts extends ConfirmOpts {
  failureCode?: string
  reason?: string
}

/**
 * Motivo padronizado + texto gravado em `failureReason` (o que o admin lê no aviso e no detalhe).
 * O app antigo manda só `reason`: vira "Outro" com o texto dele.
 */
function normalizeFailure(opts: NotDeliveredOpts): { code: FailureCode; reason: string | null } {
  const text = opts.reason?.trim() || null
  const code: FailureCode = isFailureCode(opts.failureCode) ? opts.failureCode : 'OUTRO'
  if (code === 'OUTRO') return { code, reason: text }
  return { code, reason: text ? `${FAILURE_LABELS[code]} — ${text}` : FAILURE_LABELS[code] }
}

/**
 * Fuso horario do Brasil (UTC-3) — duplicado localmente de orders.service.ts
 * conforme Assumption A4 do CONTEXT-06 (aceitavel no MVP).
 */
const BRAZIL_OFFSET_HOURS = 3

/**
 * Ordena paradas por BLOCO → COMPLEMENTO → APARTAMENTO (crescente), todos com
 * localeCompare numérico pt-BR (assim "Bloco 2" vem antes de "Bloco 10" e "Apto 20" antes
 * de "Apto 101"). Condomínios sem bloco caem todos no mesmo grupo. O complemento entra no
 * meio porque marca uma separação física ("Lado A"/"Lado B") — sem ele o entregador
 * atravessaria o bloco a cada parada. Ver `compareUnits` no shared.
 */
const byBlockThenApartment = compareUnits

/**
 * Retorna o intervalo de "hoje" em UTC-3 como par de datas UTC.
 * Identico a getTodayRange de orders.service.ts.
 */
function getTodayRange(): { start: Date; end: Date } {
  const nowUTC = Date.now()
  const nowBrazil = nowUTC - BRAZIL_OFFSET_HOURS * 60 * 60 * 1000
  const todayBrazil = new Date(nowBrazil)
  const year = todayBrazil.getUTCFullYear()
  const month = todayBrazil.getUTCMonth()
  const day = todayBrazil.getUTCDate()
  const start = new Date(Date.UTC(year, month, day, BRAZIL_OFFSET_HOURS, 0, 0, 0))
  const end = new Date(Date.UTC(year, month, day + 1, BRAZIL_OFFSET_HOURS - 1, 59, 59, 999))
  return { start, end }
}

/**
 * CourierService — logica de negocio para o entregador.
 *
 * Responsabilidades:
 * - getTodayOrders: lista ordens do dia agrupadas por condominio, ordenadas por
 *   apartamento numerico ASC, com geocodificacao Nominatim e rota OSRM (COUR-01/03/04)
 * - confirmDelivery: valida ownership e delega transicao DELIVERED ao AdminOrdersService (COUR-02)
 *
 * Seguranca:
 * - T-06-01: confirmDelivery valida order.courierId === courierId do JWT antes de delegar
 * - T-06-03: getTodayOrders filtra por courierId via repository — nao expoe orders de outros
 */
export class CourierService {
  private repository: CourierRepository

  /**
   * Cache de geocodificacao em memoria por endereco.
   * Evita chamadas repetidas ao Nominatim para o mesmo condominio durante a sessao.
   * D-06: geocodificacao dinamica via Nominatim sem campo lat/lng no schema.
   */
  private geocodeCache = new Map<string, { lat: number; lng: number } | null>()

  private runs: CourierRunService

  constructor(private fastify: FastifyInstance) {
    this.repository = new CourierRepository(fastify)
    this.runs = new CourierRunService(fastify)
  }

  private get prisma() {
    return this.fastify.prisma
  }

  /**
   * Retorna as ordens do dia para o entregador agrupadas por condominio.
   *
   * Fluxo:
   * 1. Calcula range BRT de hoje
   * 2. Busca ordens via repository (courierId filter)
   * 3. Carrega em LOTE os clientes e os condomínios das paradas (uma consulta por coleção)
   * 4. Agrupa por condominiumId
   * 5. Ordena stops por bloco → complemento → apartamento
   * 6. Geocodifica enderecos via Nominatim com cache em memoria (só sem lat/lng salvo)
   * 7. Calcula UMA rota OSRM por turno, cada uma em try/catch próprio — erro seta route: null
   *
   * @param courierId ID do entregador extraido do JWT
   */
  async getTodayOrders(courierId: string): Promise<TodayOrdersResponse> {
    const { start, end } = getTodayRange()
    const orders = await this.repository.findTodayByCourierId(courierId, start, end)
    const completedOrders = await this.repository.findTodayCompletedByCourierId(courierId, start, end)

    // Cestinha (MarketOrder) que pega carona: em rota (ativa) e concluída hoje.
    const marketActive = await this.repository.findTodayMarketByCourierId(courierId, start, end)
    const marketCompleted = await this.repository.findTodayCompletedMarketByCourierId(courierId, start, end)
    type MarketAgg = {
      userId: string
      items: { name: string; qty: number }[]
      breadQty: number
      /** TODAS as Cestinhas da parada — o desfecho vale para o conjunto, não só para a primeira. */
      marketOrderIds: string[]
      status: string
      slotId: string | null
      completedAt: Date | null
    }
    /**
     * Chave de uma parada: cliente + TURNO. Agrupar só por cliente misturava os turnos — a
     * Cestinha da tarde entrava na parada da manhã (itens no lugar errado, pães contados duas
     * vezes) e uma parada só-Cestinha da tarde desaparecia da rota quando o cliente tinha pão na
     * manhã. Nas concluídas o desfecho também entra na chave: entregue e não entregue do mesmo
     * cliente viram linhas distintas, em vez de uma linha só com o status da primeira.
     */
    const stopKeyOf = (userId: string, slotId: string | null | undefined) => `${userId}|${slotId ?? ''}`
    const aggMarket = (rows: typeof marketCompleted, splitByStatus = false): Map<string, MarketAgg> => {
      const map = new Map<string, MarketAgg>()
      for (const m of rows) {
        const key = splitByStatus ? `${stopKeyOf(m.userId, m.slotId)}|${m.status}` : stopKeyOf(m.userId, m.slotId)
        const cur = map.get(key)
        const items = m.items.map((i) => ({ name: i.name, qty: i.qty }))
        const completedAt = ('deliveredAt' in m ? (m.deliveredAt as Date | null) : null) ?? ('failedAt' in m ? (m.failedAt as Date | null) : null) ?? null
        if (cur) {
          cur.items.push(...items)
          cur.breadQty += m.breadQty
          cur.marketOrderIds.push(m.id)
          // Mais recente vence — é quando a parada de fato terminou.
          if (completedAt && (!cur.completedAt || completedAt > cur.completedAt)) cur.completedAt = completedAt
        } else {
          map.set(key, { userId: m.userId, items, breadQty: m.breadQty, marketOrderIds: [m.id], status: m.status, slotId: m.slotId, completedAt })
        }
      }
      return map
    }
    const marketActiveByStop = aggMarket(marketActive as unknown as typeof marketCompleted)
    const marketCompletedByStop = aggMarket(marketCompleted, true)
    const breadStopsActive = new Set(
      orders.map((o: Record<string, unknown>) => stopKeyOf(o.userId as string, o.slotId as string | null)),
    )
    const breadStopsCompleted = new Set(
      completedOrders.map(
        (o: Record<string, unknown>) => `${stopKeyOf(o.userId as string, o.slotId as string | null)}|${o.status as string}`,
      ),
    )

    // Config de turnos (slot) — para rotular cada entrega como manhã/tarde + horário.
    const slotConfig = await getGlobalDeliverySlots(this.prisma)
    const slotById = new Map(slotConfig.map((s) => [s.slotId, s]))
    const slotLabelOf = (slotId: string | null | undefined): string => {
      if (!slotId) return 'Sem horário'
      return slotById.get(slotId)?.label ?? slotId.charAt(0).toUpperCase() + slotId.slice(1)
    }

    // Paradas SÓ de gancho (plano-gancho-sozinho-na-rota): o gancho na rota deste entregador
    // hoje, sem pão nem Cestinha do cliente no turno — e as que ele já resolveu hoje.
    const today = brtDateStr(start)
    const [hookOnlyActive, hookOnlyDone] = await Promise.all([
      pendingHookOnlyStops(this.prisma, { courierIds: [courierId], date: today }),
      resolvedHookOnlyStops(this.prisma, [courierId], today, today),
    ])

    // Clientes e condomínios de TODAS as paradas (ativas e concluídas) num lote só. Antes eram
    // dois findUnique por parada, repetidos nas concluídas — 150 paradas davam 300+ consultas a
    // cada abertura da tela, o que pesava justamente onde o sinal é ruim.
    const userIds = [
      ...new Set([
        ...orders.map((o: Record<string, unknown>) => o.userId as string),
        ...completedOrders.map((o: Record<string, unknown>) => o.userId as string),
        ...[...marketActiveByStop.values()].map((m) => m.userId),
        ...[...marketCompletedByStop.values()].map((m) => m.userId),
        ...hookOnlyActive.map((h) => h.userId),
        ...hookOnlyDone.map((h) => h.userId),
      ]),
    ]
    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, condominiumId: true, apartment: true, block: true, complement: true, courierMessagesOff: true },
          })
        : []
    const userById = new Map(users.map((u) => [u.id, u]))
    // Selos da parada (E7): 1ª entrega, já tem gancho, gancho enviado nesta rota (A7).
    const [firstDays, hooksDone, hooksOnRoute] =
      userIds.length > 0
        ? await Promise.all([
            firstDeliveryDayByUser(this.prisma, userIds),
            this.prisma.hookRequest.findMany({ where: { userId: { in: userIds }, status: 'DELIVERED' }, select: { userId: true } }),
            this.prisma.hookRequest.findMany({
              where: { userId: { in: userIds }, status: 'REQUESTED', routeDate: today },
              select: { id: true, userId: true, routeSlotId: true },
            }),
          ])
        : [new Map<string, string>(), [], []]
    const hasHook = new Set(hooksDone.map((h) => h.userId))
    const hookOnRoute = new Map(hooksOnRoute.map((h) => [`${h.userId}|${h.routeSlotId ?? ''}`, h.id]))
    const badgesOf = (userId: string, slotId: string) => {
      const hookId = hookOnRoute.get(`${userId}|${slotId}`)
      return {
        isFirstOrder: firstDays.get(userId) === today,
        hasHook: hasHook.has(userId),
        hookToDeliver: hookId ? { id: hookId } : null,
        messagesOff: userById.get(userId)?.courierMessagesOff === true,
      }
    }
    const condoIds = [...new Set(users.map((u) => u.condominiumId).filter((id): id is string => !!id))]
    const condominiums =
      condoIds.length > 0
        ? await this.prisma.condominium.findMany({
            where: { id: { in: condoIds } },
            select: { id: true, name: true, address: true, lat: true, lng: true, courierAccess: true },
          })
        : []
    const condoById = new Map(condominiums.map((c) => [c.id, c]))

    /** Dados do cliente + condomínio de uma parada (o que antes vinha dos findUnique). */
    const placeOf = (userId: string) => {
      const user = userById.get(userId)
      const condominium = user?.condominiumId ? condoById.get(user.condominiumId) : undefined
      const addr = condominium?.address as AddressLike | undefined
      const sortKey = parseInt(user?.apartment ?? '9999', 10)
      return {
        condominiumId: user?.condominiumId ?? 'unknown',
        condominiumName: condominium?.name ?? 'Condominio desconhecido',
        address: addr ? `${addr.street}, ${addr.number}` : '',
        // Coordenadas persistidas no condomínio (preferenciais) + query completa p/ fallback.
        condoLat: condominium?.lat ?? null,
        condoLng: condominium?.lng ?? null,
        geoQuery: addr ? addressToQuery(addr) : '',
        apartment: user?.apartment ?? '',
        block: user?.block ?? null,
        complement: user?.complement ?? null,
        clientName: user?.name ?? 'Cliente',
        sortKey: isNaN(sortKey) ? 9999 : sortKey,
      }
    }

    const enriched = orders.map((order: Record<string, unknown>) => {
      // Cestinha do mesmo cliente NESTE turno: soma os pães da cestinha + anexa os itens.
      const mk = marketActiveByStop.get(stopKeyOf(order.userId as string, order.slotId as string | null))
      const marketItems = mk?.items ?? []
      return {
        ...placeOf(order.userId as string),
        orderId: order.id as string,
        userId: order.userId as string,
        quantity: (order.quantity as number) + (mk?.breadQty ?? 0),
        status: order.status as string,
        slotId: (order.slotId as string | null) ?? '',
        marketOrderId: undefined as string | undefined, // parada combinada confirma pelo orderId do pão
        marketOrderIds: mk?.marketOrderIds ?? [],
        marketItems,
        marketItemCount: marketItems.reduce((n, i) => n + i.qty, 0),
        hookId: undefined as string | undefined,
      }
    })

    // Paradas SÓ-market ativas (cliente sem pedido de pão NESTE turno).
    const marketOnlyActive = [...marketActiveByStop.entries()]
      .filter(([key]) => !breadStopsActive.has(key))
      .map(([, mk]) => ({
        ...placeOf(mk.userId),
        orderId: '',
        userId: mk.userId,
        quantity: mk.breadQty,
        status: mk.status,
        slotId: mk.slotId ?? '',
        // O id endereça a parada; o backend aplica o desfecho ao escopo todo (completeMarketStop).
        marketOrderId: mk.marketOrderIds[0] as string | undefined,
        marketOrderIds: mk.marketOrderIds,
        marketItems: mk.items,
        marketItemCount: mk.items.reduce((n, i) => n + i.qty, 0),
        hookId: undefined as string | undefined,
      }))
    enriched.push(...marketOnlyActive)

    // Paradas só de gancho: sem pão e sem itens — o gancho é a entrega (endereçada pelo `hookId`).
    enriched.push(
      ...hookOnlyActive.map((h) => ({
        ...placeOf(h.userId),
        orderId: '',
        userId: h.userId,
        quantity: 0,
        status: 'OUT_FOR_DELIVERY',
        slotId: h.slotId,
        marketOrderId: undefined as string | undefined,
        marketOrderIds: [] as string[],
        marketItems: [] as Array<{ name: string; qty: number }>,
        marketItemCount: 0,
        hookId: h.hookId as string | undefined,
      })),
    )

    // Agrupar por condominiumId
    const condoMap = new Map<
      string,
      {
        condominiumId: string
        condominiumName: string
        address: string
        geoQuery: string
        lat: number | null
        lng: number | null
        stops: typeof enriched
      }
    >()

    for (const item of enriched) {
      if (!condoMap.has(item.condominiumId)) {
        condoMap.set(item.condominiumId, {
          condominiumId: item.condominiumId,
          condominiumName: item.condominiumName,
          address: item.address,
          geoQuery: item.geoQuery,
          // Coordenadas salvas no condomínio (preferenciais); null dispara fallback abaixo.
          lat: item.condoLat,
          lng: item.condoLng,
          stops: [],
        })
      }
      condoMap.get(item.condominiumId)!.stops.push(item)
    }

    // Coordenadas + ordenar stops por sortKey ASC
    const condos = await Promise.all(
      Array.from(condoMap.values()).map(async (condo) => {
        // Ordenar stops por BLOCO e depois APARTAMENTO, ambos ASC (COUR-04)
        condo.stops.sort(byBlockThenApartment)

        // Usa as coordenadas salvas no condomínio; só geocodifica ao vivo (fallback,
        // com cache) quando o condomínio ainda não tem lat/lng persistidos.
        if ((condo.lat == null || condo.lng == null) && condo.geoQuery) {
          const cached = this.geocodeCache.get(condo.geoQuery)
          const coords = cached !== undefined ? cached : await geocodeAddress(condo.geoQuery)
          if (cached === undefined) this.geocodeCache.set(condo.geoQuery, coords)
          condo.lat = coords?.lat ?? null
          condo.lng = coords?.lng ?? null
        }

        return {
          condominiumId: condo.condominiumId,
          condominiumName: condo.condominiumName,
          address: condo.address,
          lat: condo.lat,
          lng: condo.lng,
          access: readCondoAccess(condoById.get(condo.condominiumId)?.courierAccess),
          stops: condo.stops.map((s) => ({
            orderId: s.orderId,
            apartment: s.apartment,
            block: s.block,
            complement: s.complement,
            clientName: s.clientName,
            quantity: s.quantity,
            status: s.status,
            sortKey: s.sortKey,
            slotId: s.slotId,
            slotLabel: slotLabelOf(s.slotId),
            ...(s.marketOrderId ? { marketOrderId: s.marketOrderId } : {}),
            marketOrderIds: s.marketOrderIds,
            marketItems: s.marketItems,
            marketItemCount: s.marketItemCount,
            ...badgesOf(s.userId, s.slotId),
            // Na parada só de gancho o gancho é a própria entrega, não um selo a mais.
            ...(s.hookId ? { hookId: s.hookId, hookToDeliver: null } : {}),
          })),
        }
      }),
    )

    const totalStops = enriched.length
    const totalBreads = enriched.reduce((sum, o) => sum + o.quantity, 0)
    const totalItems = enriched.reduce((sum, o) => sum + o.marketItemCount, 0)

    // Turnos distintos presentes na rota de hoje, ordenados por horário de entrega.
    // Alimenta o cabeçalho do app (informa manhã/tarde + horário do dia).
    const slotIdsPresent = Array.from(new Set(enriched.map((o) => o.slotId).filter(Boolean)))
    const slots = slotIdsPresent
      .map((slotId) => {
        const cfg = slotById.get(slotId)
        return {
          slotId,
          label: cfg?.label ?? slotLabelOf(slotId),
          emoji: cfg?.emoji ?? '',
          time: cfg?.time ?? '',
        }
      })
      .sort((a, b) => a.time.localeCompare(b.time))

    // A rota de cada turno sai depois das concluídas: o mapa mostra também os prédios já feitos.
    const routeSlotIds = slots.map((s) => s.slotId)
    if (enriched.some((o) => !o.slotId)) routeSlotIds.push('')

    // ── Entregas concluídas do dia (aba "Realizadas") ─────────────────────────
    // Enriquece nome do cliente + condomínio e agrupa por condomínio, ordenado por
    // bloco/apartamento. Não precisa de geocodificação nem rota (já foram feitas).
    const completedEnriched = completedOrders.map((order: Record<string, unknown>) => {
      const status = order.status as string
      const completedAt =
        (order.deliveredAt as Date | null) ?? (order.failedAt as Date | null) ?? null
      // Casa a Cestinha do MESMO turno e do MESMO desfecho do pão. Uma Cestinha que teve
      // desfecho diferente não é escondida aqui — vira a própria linha em marketOnlyCompleted.
      const mk = marketCompletedByStop.get(`${stopKeyOf(order.userId as string, order.slotId as string | null)}|${status}`)
      const marketItems = mk?.items ?? []
      const place = placeOf(order.userId as string)
      return {
        userId: order.userId as string,
        orderId: order.id as string,
        condominiumId: place.condominiumId,
        condominiumName: place.condominiumName,
        apartment: place.apartment,
        block: place.block,
        complement: place.complement,
        clientName: place.clientName,
        quantity: (order.quantity as number) + (mk?.breadQty ?? 0),
        status,
        slotId: (order.slotId as string | null) ?? '',
        slotLabel: slotLabelOf(order.slotId as string | null),
        completedAt: completedAt ? completedAt.toISOString() : null,
        marketOrderId: undefined as string | undefined,
        marketOrderIds: mk?.marketOrderIds ?? [],
        marketItems,
        marketItemCount: marketItems.reduce((n, i) => n + i.qty, 0),
        hookId: undefined as string | undefined,
      }
    })

    // Paradas SÓ-market concluídas (sem pão no mesmo turno com o mesmo desfecho).
    const marketOnlyCompleted = [...marketCompletedByStop.entries()]
      .filter(([key]) => !breadStopsCompleted.has(key))
      .map(([, mk]) => {
        const place = placeOf(mk.userId)
        return {
          userId: mk.userId,
          orderId: '',
          condominiumId: place.condominiumId,
          condominiumName: place.condominiumName,
          apartment: place.apartment,
          block: place.block,
          complement: place.complement,
          clientName: place.clientName,
          quantity: mk.breadQty,
          status: mk.status,
          slotId: mk.slotId ?? '',
          slotLabel: slotLabelOf(mk.slotId),
          completedAt: mk.completedAt ? mk.completedAt.toISOString() : null,
          marketOrderId: mk.marketOrderIds[0] as string | undefined,
          marketOrderIds: mk.marketOrderIds,
          marketItems: mk.items,
          marketItemCount: mk.items.reduce((n, i) => n + i.qty, 0),
          hookId: undefined as string | undefined,
        }
      })
    completedEnriched.push(...marketOnlyCompleted)

    // Paradas só de gancho já resolvidas hoje (o desfecho vem do comprovante).
    completedEnriched.push(
      ...hookOnlyDone.map((h) => {
        const place = placeOf(h.userId)
        return {
          userId: h.userId,
          orderId: '',
          condominiumId: place.condominiumId,
          condominiumName: place.condominiumName,
          apartment: place.apartment,
          block: place.block,
          complement: place.complement,
          clientName: place.clientName,
          quantity: 0,
          status: h.outcome as string,
          slotId: h.slotId,
          slotLabel: slotLabelOf(h.slotId),
          completedAt: h.at.toISOString() as string | null,
          marketOrderId: undefined as string | undefined,
          marketOrderIds: [] as string[],
          marketItems: [] as Array<{ name: string; qty: number }>,
          marketItemCount: 0,
          hookId: h.hookId as string | undefined,
        }
      }),
    )

    const completedMap = new Map<
      string,
      { condominiumId: string; condominiumName: string; stops: typeof completedEnriched }
    >()
    for (const item of completedEnriched) {
      if (!completedMap.has(item.condominiumId)) {
        completedMap.set(item.condominiumId, {
          condominiumId: item.condominiumId,
          condominiumName: item.condominiumName,
          stops: [],
        })
      }
      completedMap.get(item.condominiumId)!.stops.push(item)
    }

    // Comprovante das paradas concluídas (aba Realizadas) + regras do entregador (a tela decide
    // se a foto é obrigatória ou se mostra "Pular").
    const completedRefs = completedEnriched.flatMap((s) => [s.orderId, ...s.marketOrderIds].filter(Boolean))
    const [proofs, courierRow, reports] = await Promise.all([
      this.prisma.deliveryProof.findMany({
        where: { courierId, date: brtDateStr(start) },
        select: { userId: true, slotId: true, outcome: true, status: true },
      }),
      this.prisma.user.findUnique({ where: { id: courierId }, select: { courierRules: true } }),
      // E11: problema já reportado na parada (some o "Reportar problema", fica o selo).
      completedRefs.length > 0
        ? this.prisma.courierReport.findMany({
            where: { courierId, kind: 'STOP_ISSUE', OR: [{ orderId: { in: completedRefs } }, { marketOrderId: { in: completedRefs } }] },
            select: { orderId: true, marketOrderId: true },
          })
        : Promise.resolve([] as Array<{ orderId: string | null; marketOrderId: string | null }>),
    ])
    const reportedRefs = new Set(reports.flatMap((r) => [r.orderId, r.marketOrderId].filter((x): x is string => !!x)))
    const proofByStop = new Map(proofs.map((p) => [`${p.userId}|${p.slotId}|${p.outcome}`, p.status]))
    const rules = resolveCourierRules(courierRow?.courierRules)

    const completed = Array.from(completedMap.values())
      .map((c) => ({
        condominiumId: c.condominiumId,
        condominiumName: c.condominiumName,
        stops: c.stops
          .sort(byBlockThenApartment)
          .map((s) => ({
            orderId: s.orderId,
            apartment: s.apartment,
            block: s.block,
            complement: s.complement,
            clientName: s.clientName,
            quantity: s.quantity,
            status: s.status,
            slotId: s.slotId,
            slotLabel: s.slotLabel,
            completedAt: s.completedAt,
            ...(s.marketOrderId ? { marketOrderId: s.marketOrderId } : {}),
            marketOrderIds: s.marketOrderIds,
            marketItems: s.marketItems,
            marketItemCount: s.marketItemCount,
            ...(s.hookId ? { hookId: s.hookId } : {}),
            proofStatus: proofByStop.get(`${s.userId}|${s.slotId}|${s.status}`) ?? null,
            reported: [s.orderId, ...s.marketOrderIds].some((id) => !!id && reportedRefs.has(id)),
          })),
      }))
      .sort((a, b) => a.condominiumName.localeCompare(b.condominiumName, 'pt-BR'))

    const { routes, base, routeCondos } = await this.slotRoutes({ courierId, start, condos, completedEnriched, condoById, routeSlotIds, slots })

    return { condos, totalStops, totalBreads, totalItems, routes, slots, completed, completedTotal: completedEnriched.length, rules, base, routeCondos }
  }

  /**
   * UMA rota por turno, na ordem do dia (rota salva → sugestão → ordem do entregador, D-5), com o
   * estado da rota (pronta · em rota · encerrada), o traçado e a hora prevista de cada prédio. Os
   * prédios já feitos entram (o mapa marca como feitos). Falha no plano → a ordem de chegada e só
   * o traçado, como antes: a lista nunca depende disso.
   */
  private async slotRoutes(input: {
    courierId: string
    start: Date
    condos: TodayOrdersResponse['condos']
    completedEnriched: Array<{ condominiumId: string; condominiumName: string; slotId: string; hookId?: string }>
    condoById: Map<string, { id: string; name: string; lat: number | null; lng: number | null }>
    routeSlotIds: string[]
    slots: TodayOrdersResponse['slots']
  }): Promise<Pick<TodayOrdersResponse, 'routes' | 'base' | 'routeCondos'>> {
    const now = new Date()
    const date = brtDateStr(input.start)
    const cfg = await getRouteConfig(this.prisma)
    // Prédios de todas as rotas: os ativos (com a coordenada já geocodificada) + os só concluídos.
    const info = new Map<string, PlanCondo & { name: string }>()
    for (const c of input.condos) info.set(c.condominiumId, { id: c.condominiumId, name: c.condominiumName, lat: c.lat, lng: c.lng })
    for (const s of input.completedEnriched) {
      if (info.has(s.condominiumId)) continue
      const row = input.condoById.get(s.condominiumId)
      info.set(s.condominiumId, { id: s.condominiumId, name: s.condominiumName, lat: row?.lat ?? null, lng: row?.lng ?? null })
    }
    info.delete('unknown')

    const routes: TodayOrdersResponse['routes'] = []
    for (const slotId of input.routeSlotIds) {
      const meta = input.slots.find((s) => s.slotId === slotId)
      const active = input.condos.filter((c) => c.stops.some((s) => (s.slotId ?? '') === slotId))
      const activeIds = active.map((c) => c.condominiumId).filter((id) => info.has(id))
      const doneIds = input.completedEnriched.filter((s) => s.slotId === slotId).map((s) => s.condominiumId)
      const ids = [...new Set([...activeIds, ...doneIds])].filter((id) => info.has(id))
      const condos = ids.map((id) => info.get(id)!)
      const doors = new Map(active.map((c) => [c.condominiumId, c.stops.filter((s) => (s.slotId ?? '') === slotId).length]))
      // Prédio que só tem gancho no turno entra no traçado do dia, mas não mexe na rota salva.
      const withBread = new Set([
        ...active.filter((c) => c.stops.some((s) => (s.slotId ?? '') === slotId && !s.hookId)).map((c) => c.condominiumId),
        ...input.completedEnriched.filter((s) => s.slotId === slotId && !s.hookId).map((s) => s.condominiumId),
      ])

      let order = ids
      let metrics = { km: null as number | null, durationMin: null as number | null, geometry: [] as Array<[number, number]>, legSeconds: [] as number[] }
      let run: Awaited<ReturnType<typeof resolveDayRoute>>['run'] = null
      let reorderedToday = false
      try {
        if (slotId) {
          const day = await resolveDayRoute(this.fastify, {
            courierId: input.courierId,
            slotId,
            date,
            condos,
            suggestFrom: condos.filter((c) => withBread.has(c.id)),
            slotLabel: meta?.label,
            config: cfg,
          })
          order = day.order
          metrics = day.metrics
          run = day.run
          reorderedToday = day.reorderedToday
        } else {
          metrics = await metricsForOrder(this.prisma, order, condos, cfg)
        }
      } catch (err) {
        this.fastify.log.warn({ err, courierId: input.courierId, slotId }, '[courier] falha ao montar a rota do turno — seguindo sem ordem salva')
        try {
          metrics = await metricsForOrder(this.prisma, order, condos, cfg)
        } catch {
          // segue sem traçado
        }
      }

      const state: TodayOrdersResponse['routes'][number]['state'] =
        run?.status === 'STARTED' ? 'em_rota' : run?.status === 'ENDED' ? 'encerrada' : 'pronta'
      const etas = computeEtas({
        order,
        legSeconds: metrics.legSeconds,
        hasBase: !!cfg.base,
        locatedIds: new Set(condos.filter((c) => c.lat !== null && c.lng !== null).map((c) => c.id)),
        doorsByCondo: doors,
        minPerDoor: cfg.minPorPorta,
        startAt: run?.status === 'STARTED' && run.startedAt ? run.startedAt : now,
        now,
        doneIds: new Set(ids.filter((id) => !activeIds.includes(id))),
      })
      routes.push({
        slotId,
        label: meta?.label ?? '',
        emoji: meta?.emoji ?? '',
        time: meta?.time ?? '',
        condominiumIds: order,
        route: metrics.km !== null ? { distanceKm: metrics.km.toFixed(1), durationMin: metrics.durationMin ?? 0, geometry: metrics.geometry } : null,
        state,
        run: run
          ? { id: run.id, startedAt: run.startedAt?.toISOString() ?? null, endedAt: run.endedAt?.toISOString() ?? null, startMode: run.startMode ?? null }
          : null,
        reorderedToday,
        eta: order.map((id) => ({ condominiumId: id, time: etas.get(id) ?? null })),
      })
    }
    return {
      routes,
      base: cfg.base ? { endereco: cfg.base.endereco, lat: cfg.base.lat, lng: cfg.base.lng } : null,
      routeCondos: [...info.values()].map((c) => ({ condominiumId: c.id, condominiumName: c.name, lat: c.lat, lng: c.lng })),
    }
  }

  /**
   * Confirma entrega de uma order pelo entregador e devolve o RESUMO da parada (pop-up do scan,
   * E4). O resumo vem do servidor — com a lista do aparelho velha, o apto continua certo.
   *
   * T-06-01: Valida que order.courierId === courierId do JWT antes de qualquer acao.
   * Delega transicao DELIVERED ao AdminOrdersService (que dispara push + persiste Notification).
   *
   * Parada já resolvida:
   * - mesma operação reenviada pela fila offline (mesmo `clientOpId`) → sucesso silencioso;
   * - leitura NOVA de um cupom já entregue/não entregue → 409 com o resumo ("Já confirmada às 06:42").
   *
   * @throws { statusCode: 404 } se order nao encontrada
   * @throws { statusCode: 403 } se order.courierId !== courierId
   * @throws { statusCode: 409, summary } se a parada já tem desfecho
   * @throws { statusCode: 422 } se transicao invalida (via AdminOrdersService)
   */
  async confirmDelivery(orderId: string, courierId: string, opts: ConfirmOpts = {}): Promise<StopSummary> {
    // 1. Buscar order — 404 se nao encontrada
    const order = await this.repository.findById(orderId)
    if (!order) {
      throw { statusCode: 404, message: 'Pedido nao encontrado' }
    }

    // 2. T-06-01: Validar ownership — 403 se courierId diferente
    if (order.courierId !== courierId) {
      throw {
        statusCode: 403,
        message: 'Acesso negado: esta entrega nao pertence a voce',
      }
    }

    const scope: StopScope = { courierId, userId: order.userId, slotId: order.slotId ?? '', scheduledDate: order.scheduledDate }
    if (order.status === 'DELIVERED' || order.status === 'NOT_DELIVERED') {
      return this.alreadyResolved(scope, order, order.status, opts, 'DELIVERED')
    }

    // 3. Delegar transicao DELIVERED ao AdminOrdersService
    const adminOrdersService = new AdminOrdersService(this.fastify)
    await adminOrdersService.updateOrderStatus(orderId, 'DELIVERED')

    // 4. Como foi confirmada + horário real (fila offline). Só grava se houver o que gravar.
    const occurredAt = clampOccurredAt(opts.occurredAt)
    if (opts.via || occurredAt) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { ...(opts.via ? { confirmedVia: opts.via } : {}), ...(occurredAt ? { deliveredAt: occurredAt } : {}) },
      })
    }

    const fresh = (await this.repository.findById(orderId)) ?? order
    const summary = await buildStopSummary(this.prisma, scope, fresh, 'DELIVERED')
    await recordStopOutcome(this.prisma, scope, 'DELIVERED', {
      condominiumId: fresh.condominiumId ?? summary.condominiumId,
      orderId,
      marketOrderIds: summary.marketOrderIds,
      required: summary.proofRequired,
      confirmedVia: opts.via,
      clientOpId: opts.clientOpId,
    })
    // Turno não iniciado: a 1ª confirmação inicia a rota (o cliente recebe o "a caminho").
    await this.runs.ensureStarted(courierId, scope.slotId)
    return summary
  }

  /**
   * Parada que já tem desfecho. Reenvio da MESMA operação pela fila offline devolve o resumo como
   * sucesso; qualquer outra leitura é 409 com o resumo (o pop-up mostra "Já confirmada às HH:MM").
   */
  private async alreadyResolved(
    scope: StopScope,
    bread: { id: string; quantity: number; status: string; deliveredAt: Date | null; failedAt: Date | null } | null,
    outcome: 'DELIVERED' | 'NOT_DELIVERED',
    opts: ConfirmOpts,
    requested: 'DELIVERED' | 'NOT_DELIVERED',
    hookOnly: HookStopState | null = null,
  ): Promise<StopSummary> {
    const summary = await buildStopSummary(this.prisma, scope, bread, requested, hookOnly)
    if (outcome === requested && opts.clientOpId && (await lastClientOpId(this.prisma, scope, requested)) === opts.clientOpId) {
      return summary
    }
    throw {
      statusCode: 409,
      message: hookOnly
        ? outcome === 'DELIVERED'
          ? 'Esse gancho já foi entregue'
          : 'Esse gancho já foi marcado como não entregue'
        : outcome === 'DELIVERED'
          ? 'Essa entrega já foi confirmada'
          : 'Essa parada já foi marcada como não entregue',
      summary,
    }
  }

  /**
   * Busca as paradas de HOJE do entregador pelo código curto do cupom (E3 · T-1): 6 caracteres
   * (cupom novo) ou 4 (cupom impresso antes da virada). A busca é restrita às paradas do próprio
   * entregador no dia — é isso que torna seguro um sufixo tão curto. Um código que casa com mais
   * de uma parada devolve todas, e o app pede para o entregador escolher.
   *
   * @throws { statusCode: 400 } código fora do formato
   */
  async lookupStopsByCode(courierId: string, rawCode: string): Promise<Array<{ kind: 'BREAD' | 'MARKET'; id: string; summary: StopSummary }>> {
    const code = normalizeStopCode(rawCode)
    if ((code.length !== STOP_CODE_LENGTH && code.length !== LEGACY_STOP_CODE_LENGTH) || !/^[0-9A-F]+$/.test(code)) {
      throw { statusCode: 400, message: 'Código inválido. Ele fica embaixo do QR do cupom.' }
    }
    const { start, end } = getTodayRange()
    const inRoute = { courierId, scheduledDate: { gte: start, lte: end }, status: { in: ['OUT_FOR_DELIVERY', 'DELIVERED', 'NOT_DELIVERED'] as Array<'OUT_FOR_DELIVERY' | 'DELIVERED' | 'NOT_DELIVERED'> } }
    const [orders, markets] = await Promise.all([
      this.prisma.order.findMany({
        where: inRoute,
        select: { id: true, userId: true, slotId: true, scheduledDate: true, quantity: true, status: true, deliveredAt: true, failedAt: true },
      }),
      this.prisma.marketOrder.findMany({
        where: inRoute,
        select: { id: true, userId: true, slotId: true, scheduledDate: true },
      }),
    ])
    const breadByStop = new Map(orders.map((o) => [`${o.userId}|${o.slotId ?? ''}`, o]))

    // Uma entrada por PARADA: o cupom de uma Cestinha de parada combinada aponta para o pão.
    const stops = new Map<string, { kind: 'BREAD' | 'MARKET'; id: string; scope: StopScope; bread: (typeof orders)[number] | null }>()
    for (const o of orders) {
      if (!matchesStopCode(code, o.id)) continue
      const key = `${o.userId}|${o.slotId ?? ''}`
      stops.set(key, { kind: 'BREAD', id: o.id, scope: { courierId, userId: o.userId, slotId: o.slotId ?? '', scheduledDate: o.scheduledDate }, bread: o })
    }
    for (const m of markets) {
      if (!matchesStopCode(code, m.id)) continue
      const key = `${m.userId}|${m.slotId}`
      if (stops.has(key)) continue
      const bread = breadByStop.get(key) ?? null
      stops.set(key, {
        kind: bread ? 'BREAD' : 'MARKET',
        id: bread ? bread.id : m.id,
        scope: { courierId, userId: m.userId, slotId: m.slotId, scheduledDate: m.scheduledDate },
        bread,
      })
    }
    return Promise.all(
      [...stops.values()].map(async (s) => ({
        kind: s.kind,
        id: s.id,
        summary: await buildStopSummary(this.prisma, s.scope, s.bread, 'DELIVERED'),
      })),
    )
  }

  /**
   * Marca uma entrega como NÃO entregue (cliente ausente, endereço, etc.).
   *
   * Valida ownership (order.courierId === courierId do JWT) e delega a transição
   * NOT_DELIVERED ao AdminOrdersService, que registra failedAt + failureReason.
   * O crédito permanece debitado (estorno é decisão manual do admin).
   *
   * @throws { statusCode: 404 } se order nao encontrada
   * @throws { statusCode: 403 } se order.courierId !== courierId
   * @throws { statusCode: 422 } se transicao invalida
   */
  async markNotDelivered(orderId: string, courierId: string, opts: NotDeliveredOpts = {}): Promise<StopSummary> {
    const order = await this.repository.findById(orderId)
    if (!order) {
      throw { statusCode: 404, message: 'Pedido nao encontrado' }
    }
    if (order.courierId !== courierId) {
      throw { statusCode: 403, message: 'Acesso negado: esta entrega nao pertence a voce' }
    }

    const scope: StopScope = { courierId, userId: order.userId, slotId: order.slotId ?? '', scheduledDate: order.scheduledDate }
    if (order.status === 'DELIVERED' || order.status === 'NOT_DELIVERED') {
      return this.alreadyResolved(scope, order, order.status, opts, 'NOT_DELIVERED')
    }

    const { code, reason } = normalizeFailure(opts)
    const adminOrdersService = new AdminOrdersService(this.fastify)
    await adminOrdersService.updateOrderStatus(orderId, 'NOT_DELIVERED', reason ?? undefined)

    // Motivo padronizado (M-4) + como foi registrada + horário real (fila offline).
    const occurredAt = clampOccurredAt(opts.occurredAt)
    await this.prisma.order.update({
      where: { id: orderId },
      data: { failureCode: code, ...(opts.via ? { confirmedVia: opts.via } : {}), ...(occurredAt ? { failedAt: occurredAt } : {}) },
    })

    const fresh = (await this.repository.findById(orderId)) ?? order
    const summary = await buildStopSummary(this.prisma, scope, fresh, 'NOT_DELIVERED')
    // A Cestinha da parada acompanhou a transição (market-pipeline) — leva o mesmo motivo.
    if (summary.marketOrderIds.length > 0) {
      await this.prisma.marketOrder.updateMany({ where: { id: { in: summary.marketOrderIds } }, data: { failureCode: code } })
    }
    await recordStopOutcome(this.prisma, scope, 'NOT_DELIVERED', {
      condominiumId: fresh.condominiumId ?? summary.condominiumId,
      orderId,
      marketOrderIds: summary.marketOrderIds,
      required: summary.proofRequired,
      confirmedVia: opts.via,
      clientOpId: opts.clientOpId,
    })
    // Gancho enviado nesta rota: sem entrega, ele não foi deixado — volta para a fila (A7).
    await returnHookToQueue(this.prisma, { userId: scope.userId, date: brtDateStr(scope.scheduledDate), slotId: scope.slotId }, new Date(), reason)
    // Turno não iniciado: a 1ª confirmação inicia a rota (o cliente recebe o "a caminho").
    await this.runs.ensureStarted(courierId, scope.slotId)
    return summary
  }

  /**
   * Confirma a entrega de uma parada SÓ-market (MarketOrder sem pedido de pão). Paradas
   * combinadas (pão + Cestinha) são confirmadas pelo orderId do pão, que já propaga ao
   * MarketOrder (ver market-pipeline). Aqui é só para o caso puro só-market.
   *
   * O id recebido ENDEREÇA a parada; o desfecho é aplicado ao escopo inteiro dela (todas as
   * Cestinhas do cliente naquele condomínio/turno/dia com este entregador). O app mostra uma
   * parada por cliente — confirmar só o id enviado deixava as outras Cestinhas em rota.
   */
  async confirmMarketDelivery(marketOrderId: string, courierId: string, opts: ConfirmOpts = {}): Promise<StopSummary> {
    const mo = await this.repository.findMarketById(marketOrderId)
    if (!mo) throw { statusCode: 404, message: 'Pedido nao encontrado' }
    if (mo.courierId !== courierId) {
      throw { statusCode: 403, message: 'Acesso negado: esta entrega nao pertence a voce' }
    }
    const scope: StopScope = { courierId, userId: mo.userId, slotId: mo.slotId, scheduledDate: mo.scheduledDate }
    if (mo.status === 'DELIVERED' || mo.status === 'NOT_DELIVERED') {
      return this.alreadyResolved(scope, null, mo.status, opts, 'DELIVERED')
    }
    if (mo.status !== 'OUT_FOR_DELIVERY') {
      throw { statusCode: 422, message: `Transição inválida: ${mo.status} → DELIVERED` }
    }

    const moved = await completeMarketStop(this.prisma, { ...mo, courierId }, 'DELIVERED')
    if (moved > 0) {
      await notifyMarketDelivered(this.fastify, mo.userId) // MKT-35
      // Indique e Ganhe — só quando ESTA chamada moveu a Cestinha (reexecução não reavalia). Nunca lança.
      await afterDelivery(this.fastify, mo.userId)
    }

    let summary = await buildStopSummary(this.prisma, scope, null, 'DELIVERED')
    const occurredAt = clampOccurredAt(opts.occurredAt)
    if ((opts.via || occurredAt) && summary.marketOrderIds.length > 0) {
      await this.prisma.marketOrder.updateMany({
        where: { id: { in: summary.marketOrderIds } },
        data: { ...(opts.via ? { confirmedVia: opts.via } : {}), ...(occurredAt ? { deliveredAt: occurredAt } : {}) },
      })
      if (occurredAt) summary = { ...summary, deliveredAt: occurredAt.toISOString() }
    }
    await recordStopOutcome(this.prisma, scope, 'DELIVERED', {
      condominiumId: mo.condominiumId,
      orderId: null,
      marketOrderIds: summary.marketOrderIds,
      required: summary.proofRequired,
      confirmedVia: opts.via,
      clientOpId: opts.clientOpId,
    })
    // Turno não iniciado: a 1ª confirmação inicia a rota (o cliente recebe o "a caminho").
    await this.runs.ensureStarted(courierId, scope.slotId)
    return summary
  }

  async markMarketNotDelivered(marketOrderId: string, courierId: string, opts: NotDeliveredOpts = {}): Promise<StopSummary> {
    const mo = await this.repository.findMarketById(marketOrderId)
    if (!mo) throw { statusCode: 404, message: 'Pedido nao encontrado' }
    if (mo.courierId !== courierId) {
      throw { statusCode: 403, message: 'Acesso negado: esta entrega nao pertence a voce' }
    }
    const scope: StopScope = { courierId, userId: mo.userId, slotId: mo.slotId, scheduledDate: mo.scheduledDate }
    if (mo.status === 'DELIVERED' || mo.status === 'NOT_DELIVERED') {
      return this.alreadyResolved(scope, null, mo.status, opts, 'NOT_DELIVERED')
    }
    if (mo.status !== 'OUT_FOR_DELIVERY') {
      throw { statusCode: 422, message: `Transição inválida: ${mo.status} → NOT_DELIVERED` }
    }

    const { code, reason } = normalizeFailure(opts)
    const moved = await completeMarketStop(this.prisma, { ...mo, courierId }, 'NOT_DELIVERED', reason ?? undefined)
    if (moved > 0) await notifyMarketNotDelivered(this.fastify, mo, { reason: reason ?? undefined }) // F3

    let summary = await buildStopSummary(this.prisma, scope, null, 'NOT_DELIVERED')
    const occurredAt = clampOccurredAt(opts.occurredAt)
    if (summary.marketOrderIds.length > 0) {
      await this.prisma.marketOrder.updateMany({
        where: { id: { in: summary.marketOrderIds } },
        data: { failureCode: code, ...(opts.via ? { confirmedVia: opts.via } : {}), ...(occurredAt ? { failedAt: occurredAt } : {}) },
      })
      if (occurredAt) summary = { ...summary, failedAt: occurredAt.toISOString() }
    }
    await recordStopOutcome(this.prisma, scope, 'NOT_DELIVERED', {
      condominiumId: mo.condominiumId,
      orderId: null,
      marketOrderIds: summary.marketOrderIds,
      required: summary.proofRequired,
      confirmedVia: opts.via,
      clientOpId: opts.clientOpId,
    })
    // Gancho enviado nesta rota: sem entrega, ele não foi deixado — volta para a fila (A7).
    await returnHookToQueue(this.prisma, { userId: scope.userId, date: brtDateStr(scope.scheduledDate), slotId: scope.slotId }, new Date(), reason)
    // Turno não iniciado: a 1ª confirmação inicia a rota (o cliente recebe o "a caminho").
    await this.runs.ensureStarted(courierId, scope.slotId)
    return summary
  }

  // ── Parada só de gancho (plano-gancho-sozinho-na-rota) ─────────────────────

  /**
   * A parada só de gancho que o entregador vai resolver. Pendente = o gancho está na rota dele hoje
   * e o cliente não tem pão nem Cestinha no turno. Já resolvida = o comprovante dele com o gancho
   * (o que volta para a fila perde `routeCourierId`, então o dono sai do comprovante).
   *
   * @throws 404 gancho desconhecido ou fora da rota de hoje · 403 de outro entregador
   * @throws 422 o cliente passou a ter pão no turno — o gancho vai junto com ele
   */
  private async hookStop(hookId: string, courierId: string, now: Date = new Date()) {
    const hook = await this.prisma.hookRequest.findUnique({
      where: { id: hookId },
      select: { id: true, userId: true, status: true, routeDate: true, routeSlotId: true, routeCourierId: true, deliveredAt: true },
    })
    if (!hook) throw { statusCode: 404, message: 'Gancho não encontrado' }
    const today = brtDateStr(now)
    if (hook.status === 'REQUESTED' && hook.routeDate === today) {
      if (hook.routeCourierId !== courierId) throw { statusCode: 403, message: 'Acesso negado: este gancho não está na sua rota' }
      if (!(await isHookOnly(this.prisma, { userId: hook.userId, routeDate: today, routeSlotId: hook.routeSlotId }))) {
        throw { statusCode: 422, message: 'O gancho vai junto com o pão desta parada' }
      }
      const scope: StopScope = { courierId, userId: hook.userId, slotId: hook.routeSlotId ?? '', scheduledDate: brtNoonFromStr(today) }
      return { hook, scope, resolved: null }
    }
    const proof = await this.prisma.deliveryProof.findFirst({
      where: { hookRequestId: hookId, courierId },
      orderBy: { updatedAt: 'desc' },
      select: { slotId: true, date: true, outcome: true, createdAt: true },
    })
    if (proof) {
      const scope: StopScope = { courierId, userId: hook.userId, slotId: proof.slotId, scheduledDate: brtNoonFromStr(proof.date) }
      const outcome = proof.outcome === 'DELIVERED' ? 'DELIVERED' : 'NOT_DELIVERED'
      const state: HookStopState = {
        id: hook.id,
        status: outcome,
        deliveredAt: outcome === 'DELIVERED' ? hook.deliveredAt ?? proof.createdAt : null,
        failedAt: outcome === 'NOT_DELIVERED' ? proof.createdAt : null,
      }
      return { hook, scope, resolved: state }
    }
    // Entregue por outro caminho (o admin marcou na fila): 409 com o resumo, como a parada de pão.
    if (hook.status === 'DELIVERED') {
      const scope: StopScope = { courierId, userId: hook.userId, slotId: hook.routeSlotId ?? '', scheduledDate: brtNoonFromStr(hook.routeDate ?? today) }
      return { hook, scope, resolved: { id: hook.id, status: 'DELIVERED', deliveredAt: hook.deliveredAt, failedAt: null } as HookStopState }
    }
    throw { statusCode: 404, message: 'Este gancho não está na sua rota de hoje' }
  }

  /**
   * Confirma a parada só de gancho: o gancho fica entregue pelo entregador ("Seu gancho chegou!"
   * para o cliente), o desfecho entra no comprovante (com a regra de foto do entregador) e a rota
   * do turno inicia se ainda não começou. Mesmas respostas da parada de pão.
   */
  async confirmHookStop(hookId: string, courierId: string, opts: ConfirmOpts = {}): Promise<StopSummary> {
    const { hook, scope, resolved } = await this.hookStop(hookId, courierId)
    if (resolved) return this.alreadyResolved(scope, null, resolved.status as 'DELIVERED' | 'NOT_DELIVERED', opts, 'DELIVERED', resolved)

    await new AdminHooksService(this.fastify).markDelivered(hook.id, courierId, 'COURIER')
    const occurredAt = clampOccurredAt(opts.occurredAt)
    if (occurredAt) await this.prisma.hookRequest.update({ where: { id: hook.id }, data: { deliveredAt: occurredAt } })

    const summary = await buildStopSummary(this.prisma, scope, null, 'DELIVERED', {
      id: hook.id,
      status: 'DELIVERED',
      deliveredAt: occurredAt ?? new Date(),
      failedAt: null,
    })
    await recordStopOutcome(this.prisma, scope, 'DELIVERED', {
      condominiumId: summary.condominiumId,
      orderId: null,
      marketOrderIds: [],
      hookRequestId: hook.id,
      required: summary.proofRequired,
      confirmedVia: opts.via,
      clientOpId: opts.clientOpId,
    })
    await this.runs.ensureStarted(courierId, scope.slotId)
    return summary
  }

  /**
   * Parada só de gancho não entregue (D-13): o gancho volta para a fila com o motivo, que o card do
   * admin mostra. O cliente não é avisado — ele não esperava nada neste turno.
   */
  async markHookNotDelivered(hookId: string, courierId: string, opts: NotDeliveredOpts = {}): Promise<StopSummary> {
    const { hook, scope, resolved } = await this.hookStop(hookId, courierId)
    if (resolved) return this.alreadyResolved(scope, null, resolved.status as 'DELIVERED' | 'NOT_DELIVERED', opts, 'NOT_DELIVERED', resolved)

    const { reason } = normalizeFailure(opts)
    const at = clampOccurredAt(opts.occurredAt) ?? new Date()
    await returnHookToQueue(this.prisma, { userId: hook.userId, date: brtDateStr(scope.scheduledDate), slotId: scope.slotId }, at, reason)

    const summary = await buildStopSummary(this.prisma, scope, null, 'NOT_DELIVERED', { id: hook.id, status: 'NOT_DELIVERED', deliveredAt: null, failedAt: at })
    await recordStopOutcome(this.prisma, scope, 'NOT_DELIVERED', {
      condominiumId: summary.condominiumId,
      orderId: null,
      marketOrderIds: [],
      hookRequestId: hook.id,
      required: summary.proofRequired,
      confirmedVia: opts.via,
      clientOpId: opts.clientOpId,
    })
    await this.runs.ensureStarted(courierId, scope.slotId)
    return summary
  }

  // ── Comprovante (foto) — E5 ───────────────────────────────────────────────

  /**
   * Foto da entrega/não entrega (privada no S3, T-4). `key` é o id do pão ou de uma Cestinha da
   * parada. Repetir substitui a anterior — o reenvio da fila offline não duplica.
   *
   * @throws { statusCode: 503 } armazenamento não configurado (R-1): o app marca "sem foto"
   * @throws { statusCode: 400 } imagem inválida (tipo/tamanho)
   */
  async uploadProof(
    courierId: string,
    key: string,
    outcome: 'DELIVERED' | 'NOT_DELIVERED',
    file: { body: Buffer; mimetype: string },
  ): Promise<ProofView> {
    const { scope } = await resolveStopByKey(this.prisma, courierId, key)
    if (!isStorageConfigured()) throw { statusCode: 503, message: 'Armazenamento de fotos indisponível.' }
    let photoKey: string
    try {
      photoKey = await uploadPrivateImage(file.body, file.mimetype, 'deliveries')
    } catch (err) {
      if (err instanceof StorageError) throw { statusCode: 400, message: err.message }
      throw err
    }
    return saveProofPhoto(this.prisma, scope, outcome, photoKey)
  }

  /**
   * Seguir sem foto. `NONE` (exceção da foto obrigatória) exige motivo; `SKIPPED` só vale para
   * quem não é obrigado.
   */
  async skipProof(
    courierId: string,
    key: string,
    outcome: 'DELIVERED' | 'NOT_DELIVERED',
    mode: 'NONE' | 'SKIPPED',
    reasonCode?: NoPhotoReason,
    text?: string,
  ): Promise<ProofView> {
    const { scope } = await resolveStopByKey(this.prisma, courierId, key)
    const note =
      mode === 'NONE' && reasonCode
        ? reasonCode === 'OUTRO'
          ? text?.trim() || NO_PHOTO_LABELS.OUTRO
          : NO_PHOTO_LABELS[reasonCode]
        : null
    return skipProof(this.prisma, scope, outcome, mode, note)
  }

  /**
   * Lembrete ao entregador no horário do turno: no MINUTO EXATO do horário de entrega, para cada
   * entregador com pedidos de HOJE naquele turno que ainda NÃO iniciou/concluiu nenhuma
   * entrega (nenhum DELIVERED/NOT_DELIVERED entre seus pedidos do turno), envia um push +
   * notificação in-app COURIER_PENDING_REMINDER. Best-effort; 1× por minuto/turno.
   *
   * O disparo é por HORÁRIO EFETIVO de cada condomínio, não pelo horário do padrão global: um
   * condomínio que entrega 05:00 lembra o entregador às 05:00, não às 06:30 (quando a rota já
   * deveria estar terminando). Condomínios com o mesmo horário caem no mesmo passo, então sem
   * personalização isto é idêntico ao comportamento histórico — um lembrete por turno.
   */
  async sendCourierPendingReminders(now: Date = new Date()): Promise<void> {
    const cur = minuteOfDay(nowHHMM(now))
    const groups = groupCondoSlotsByTime(await listActiveCondoSlots(this.prisma))
    const { start, end } = brtDayRange(now)

    for (const group of groups) {
      if (cur !== minuteOfDay(group.time)) continue

      // Paradas do turno hoje que já têm entregador atribuído — pão E Cestinha. Sem a Cestinha,
      // um entregador com rota 100% de paradas só-Cestinha nunca recebia o lembrete.
      const scope = {
        slotId: group.slotId,
        condominiumId: { in: group.condominiumIds },
        scheduledDate: { gte: start, lte: end },
        courierId: { not: null },
      }
      const [orders, marketOrders] = await Promise.all([
        this.prisma.order.findMany({
          where: { ...scope, status: { not: 'CANCELLED' as const } },
          select: { courierId: true, status: true },
        }),
        this.prisma.marketOrder.findMany({
          where: { ...scope, status: { notIn: ['CANCELLED', 'PENDING_PAYMENT'] as const } },
          select: { courierId: true, status: true },
        }),
      ])
      if (orders.length === 0 && marketOrders.length === 0) continue

      // Agrupa por entregador: acted = já concluiu/tentou alguma; pending = ainda por fazer.
      const byCourier = new Map<string, { acted: boolean; pending: number }>()
      for (const o of [...orders, ...marketOrders]) {
        if (!o.courierId) continue
        const agg = byCourier.get(o.courierId) ?? { acted: false, pending: 0 }
        if (o.status === 'DELIVERED' || o.status === 'NOT_DELIVERED') agg.acted = true
        else agg.pending += 1
        byCourier.set(o.courierId, agg)
      }

      // Rota iniciada no turno também conta como "já começou" (Onda 5, §6 do plano do entregador).
      const startedRuns = await this.prisma.courierRun.findMany({
        where: { date: brtDateStr(now), slotId: group.slotId, status: { in: ['STARTED', 'ENDED'] }, courierId: { in: [...byCourier.keys()] } },
        select: { courierId: true },
      })
      const started = new Set(startedRuns.map((r) => r.courierId))

      const notifications = new NotificationsService(this.fastify)
      for (const [courierId, agg] of byCourier) {
        // Só lembra quem não começou nada (nem iniciou a rota) E ainda tem entregas pendentes.
        if (agg.acted || started.has(courierId) || agg.pending === 0) continue
        const entregas = agg.pending === 1 ? '1 entrega' : `${agg.pending} entregas`
        try {
          await notifications.notifyUser(courierId, {
            type: NotificationType.COURIER_PENDING_REMINDER,
            title: 'Entregas a fazer',
            body: `Começou o turno ${group.label} e você ainda tem ${entregas} para realizar.`,
            actionRoute: '/courier',
          })
        } catch (err) {
          this.fastify.log.warn({ err, courierId }, '[courier] falha no lembrete de entregas — ignorado')
        }
      }
    }
  }
}
