import { FastifyInstance } from 'fastify'
import { NotificationType } from '@prisma/client'
import { CourierRepository } from './courier.repository.js'
import { AdminOrdersService } from '../admin-orders/admin-orders.service.js'
import { getGlobalDeliverySlots } from '../../lib/delivery-slots.js'
import { addressToQuery, geocodeAddress, type AddressLike } from '../../lib/geocode.js'
import { nowHHMM, brtDayRange } from '../../lib/cutoff.js'
import { NotificationsService } from '../notifications/notifications.service.js'
import type { TodayOrdersResponse } from './courier.schema.js'

/**
 * Fuso horario do Brasil (UTC-3) — duplicado localmente de orders.service.ts
 * conforme Assumption A4 do CONTEXT-06 (aceitavel no MVP).
 */
const BRAZIL_OFFSET_HOURS = 3

/**
 * Ordena paradas por BLOCO (crescente) e, dentro do bloco, por APARTAMENTO (crescente),
 * ambos com localeCompare numérico pt-BR (assim "Bloco 2" vem antes de "Bloco 10" e
 * "Apto 20" antes de "Apto 101"). Condomínios sem bloco caem todos no mesmo grupo.
 */
function byBlockThenApartment(
  a: { block?: string | null; apartment?: string | null },
  b: { block?: string | null; apartment?: string | null },
): number {
  const ba = (a.block ?? '').trim()
  const bb = (b.block ?? '').trim()
  if (ba !== bb) return ba.localeCompare(bb, 'pt-BR', { numeric: true })
  return (a.apartment ?? '').localeCompare(b.apartment ?? '', 'pt-BR', { numeric: true })
}

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

  constructor(private fastify: FastifyInstance) {
    this.repository = new CourierRepository(fastify)
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
   * 3. Enrich: busca usuario e condominio para cada order
   * 4. Agrupa por condominiumId
   * 5. Ordena stops por apartmentSortKey (parseInt numerico, fallback 9999)
   * 6. Geocodifica enderecos via Nominatim com cache em memoria
   * 7. Calcula rota OSRM em try/catch independente — erro seta route: null
   *
   * @param courierId ID do entregador extraido do JWT
   */
  async getTodayOrders(courierId: string): Promise<TodayOrdersResponse> {
    const { start, end } = getTodayRange()
    const orders = await this.repository.findTodayByCourierId(courierId, start, end)
    const completedOrders = await this.repository.findTodayCompletedByCourierId(courierId, start, end)

    // Config de turnos (slot) — para rotular cada entrega como manhã/tarde + horário.
    const slotConfig = await getGlobalDeliverySlots(this.prisma)
    const slotById = new Map(slotConfig.map((s) => [s.slotId, s]))
    const slotLabelOf = (slotId: string | null | undefined): string => {
      if (!slotId) return 'Sem horário'
      return slotById.get(slotId)?.label ?? slotId.charAt(0).toUpperCase() + slotId.slice(1)
    }

    // Enrich: busca dados de usuario (com condominiumId, apartment, block) e condominio
    const enriched = await Promise.all(
      orders.map(async (order: Record<string, unknown>) => {
        const user = await this.prisma.user.findUnique({
          where: { id: order.userId as string },
          select: { id: true, name: true, condominiumId: true, apartment: true, block: true },
        })

        const condominium = user?.condominiumId
          ? await this.prisma.condominium.findUnique({
              where: { id: user.condominiumId },
              select: { id: true, name: true, address: true, lat: true, lng: true },
            })
          : null

        const addr = condominium?.address as AddressLike | undefined
        const sortKey = parseInt(user?.apartment ?? '9999', 10)
        return {
          orderId: order.id as string,
          userId: order.userId as string,
          condominiumId: user?.condominiumId ?? 'unknown',
          condominiumName: condominium?.name ?? 'Condominio desconhecido',
          address: addr ? `${addr.street}, ${addr.number}` : '',
          // Coordenadas persistidas no condomínio (preferenciais) + query completa p/ fallback.
          condoLat: condominium?.lat ?? null,
          condoLng: condominium?.lng ?? null,
          geoQuery: addr ? addressToQuery(addr) : '',
          apartment: user?.apartment ?? '',
          block: user?.block ?? null,
          clientName: user?.name ?? 'Cliente',
          quantity: order.quantity as number,
          status: order.status as string,
          slotId: (order.slotId as string | null) ?? '',
          sortKey: isNaN(sortKey) ? 9999 : sortKey,
        }
      }),
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
          stops: condo.stops.map((s) => ({
            orderId: s.orderId,
            apartment: s.apartment,
            block: s.block,
            clientName: s.clientName,
            quantity: s.quantity,
            status: s.status,
            sortKey: s.sortKey,
            slotId: s.slotId,
            slotLabel: slotLabelOf(s.slotId),
          })),
        }
      }),
    )

    const totalStops = enriched.length
    const totalBreads = enriched.reduce((sum, o) => sum + o.quantity, 0)

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

    // Calcular rota OSRM — try/catch independente; erro seta route: null (D-07)
    let route: TodayOrdersResponse['route'] = null
    try {
      const coordsWithLatLng = condos.filter((c) => c.lat !== null && c.lng !== null)
      if (coordsWithLatLng.length >= 2) {
        const coords = coordsWithLatLng.map((c) => `${c.lng},${c.lat}`).join(';')
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
        const osrmRes = await fetch(osrmUrl)
        const osrmData = await osrmRes.json() as {
          routes?: Array<{
            distance: number
            duration: number
            geometry: { coordinates: Array<[number, number]> }
          }>
        }

        if (osrmData.routes && osrmData.routes.length > 0) {
          const r = osrmData.routes[0]
          route = {
            distanceKm: (r.distance / 1000).toFixed(1),
            durationMin: Math.round(r.duration / 60),
            // OSRM retorna [lng, lat] (GeoJSON); Leaflet Polyline espera [lat, lng]
            geometry: (r.geometry?.coordinates ?? []).map(([lng, lat]) => [lat, lng] as [number, number]),
          }
        }
      }
    } catch (osrmErr) {
      this.fastify.log.warn(
        { courierId, err: osrmErr },
        '[courier] falha ao calcular rota OSRM — retornando null',
      )
      route = null
    }

    // ── Entregas concluídas do dia (aba "Realizadas") ─────────────────────────
    // Enriquece nome do cliente + condomínio e agrupa por condomínio, ordenado por
    // bloco/apartamento. Não precisa de geocodificação nem rota (já foram feitas).
    const completedEnriched = await Promise.all(
      completedOrders.map(async (order: Record<string, unknown>) => {
        const user = await this.prisma.user.findUnique({
          where: { id: order.userId as string },
          select: { name: true, condominiumId: true, apartment: true, block: true },
        })
        const condominium = user?.condominiumId
          ? await this.prisma.condominium.findUnique({
              where: { id: user.condominiumId },
              select: { name: true },
            })
          : null
        const status = order.status as string
        const completedAt =
          (order.deliveredAt as Date | null) ?? (order.failedAt as Date | null) ?? null
        return {
          orderId: order.id as string,
          condominiumId: user?.condominiumId ?? 'unknown',
          condominiumName: condominium?.name ?? 'Condominio desconhecido',
          apartment: user?.apartment ?? '',
          block: user?.block ?? null,
          clientName: user?.name ?? 'Cliente',
          quantity: order.quantity as number,
          status,
          slotId: (order.slotId as string | null) ?? '',
          slotLabel: slotLabelOf(order.slotId as string | null),
          completedAt: completedAt ? completedAt.toISOString() : null,
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
            clientName: s.clientName,
            quantity: s.quantity,
            status: s.status,
            slotId: s.slotId,
            slotLabel: s.slotLabel,
            completedAt: s.completedAt,
          })),
      }))
      .sort((a, b) => a.condominiumName.localeCompare(b.condominiumName, 'pt-BR'))

    return { condos, totalStops, totalBreads, route, slots, completed, completedTotal: completedEnriched.length }
  }

  /**
   * Confirma entrega de uma order pelo entregador.
   *
   * T-06-01: Valida que order.courierId === courierId do JWT antes de qualquer acao.
   * Delega transicao DELIVERED ao AdminOrdersService (que dispara push + persiste Notification).
   *
   * @throws { statusCode: 404 } se order nao encontrada
   * @throws { statusCode: 403 } se order.courierId !== courierId
   * @throws { statusCode: 422 } se transicao invalida (via AdminOrdersService)
   */
  async confirmDelivery(orderId: string, courierId: string): Promise<void> {
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

    // 3. Delegar transicao DELIVERED ao AdminOrdersService
    const adminOrdersService = new AdminOrdersService(this.fastify)
    await adminOrdersService.updateOrderStatus(orderId, 'DELIVERED')
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
  async markNotDelivered(orderId: string, courierId: string, reason?: string): Promise<void> {
    const order = await this.repository.findById(orderId)
    if (!order) {
      throw { statusCode: 404, message: 'Pedido nao encontrado' }
    }
    if (order.courierId !== courierId) {
      throw { statusCode: 403, message: 'Acesso negado: esta entrega nao pertence a voce' }
    }

    const adminOrdersService = new AdminOrdersService(this.fastify)
    await adminOrdersService.updateOrderStatus(orderId, 'NOT_DELIVERED', reason)
  }

  /**
   * Lembrete ao entregador no horário do turno: no MINUTO EXATO de `slot.time`, para cada
   * entregador com pedidos de HOJE naquele turno que ainda NÃO iniciou/concluiu nenhuma
   * entrega (nenhum DELIVERED/NOT_DELIVERED entre seus pedidos do turno), envia um push +
   * notificação in-app COURIER_PENDING_REMINDER. Best-effort; 1× por minuto/turno.
   */
  async sendCourierPendingReminders(now: Date = new Date()): Promise<void> {
    const [nh, nm] = nowHHMM(now).split(':').map(Number)
    const cur = nh * 60 + nm
    const slots = (await getGlobalDeliverySlots(this.prisma)).filter((s) => s.isActive)
    const { start, end } = brtDayRange(now)

    for (const slot of slots) {
      const [sh, sm] = slot.time.split(':').map(Number)
      if (cur !== (sh * 60 + sm)) continue

      // Pedidos do turno hoje que já têm entregador atribuído.
      const orders = await this.prisma.order.findMany({
        where: {
          slotId: slot.slotId,
          scheduledDate: { gte: start, lte: end },
          courierId: { not: null },
          status: { not: 'CANCELLED' },
        },
        select: { courierId: true, status: true },
      })
      if (orders.length === 0) continue

      // Agrupa por entregador: acted = já concluiu/tentou alguma; pending = ainda por fazer.
      const byCourier = new Map<string, { acted: boolean; pending: number }>()
      for (const o of orders) {
        if (!o.courierId) continue
        const agg = byCourier.get(o.courierId) ?? { acted: false, pending: 0 }
        if (o.status === 'DELIVERED' || o.status === 'NOT_DELIVERED') agg.acted = true
        else agg.pending += 1
        byCourier.set(o.courierId, agg)
      }

      const notifications = new NotificationsService(this.fastify)
      for (const [courierId, agg] of byCourier) {
        // Só lembra quem não começou nada E ainda tem entregas pendentes no turno.
        if (agg.acted || agg.pending === 0) continue
        const entregas = agg.pending === 1 ? '1 entrega' : `${agg.pending} entregas`
        try {
          await notifications.notifyUser(courierId, {
            type: NotificationType.COURIER_PENDING_REMINDER,
            title: 'Entregas a fazer',
            body: `Começou o turno ${slot.label} e você ainda tem ${entregas} para realizar.`,
            actionRoute: '/courier',
          })
        } catch (err) {
          this.fastify.log.warn({ err, courierId }, '[courier] falha no lembrete de entregas — ignorado')
        }
      }
    }
  }
}
