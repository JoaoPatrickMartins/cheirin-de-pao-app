import { FastifyInstance } from 'fastify'
import { CourierRepository } from './courier.repository.js'
import { AdminOrdersService } from '../admin-orders/admin-orders.service.js'
import type { TodayOrdersResponse } from './courier.schema.js'

/**
 * Fuso horario do Brasil (UTC-3) — duplicado localmente de orders.service.ts
 * conforme Assumption A4 do CONTEXT-06 (aceitavel no MVP).
 */
const BRAZIL_OFFSET_HOURS = 3

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
              select: { id: true, name: true, address: true },
            })
          : null

        const sortKey = parseInt(user?.apartment ?? '9999', 10)
        return {
          orderId: order.id as string,
          userId: order.userId as string,
          condominiumId: user?.condominiumId ?? 'unknown',
          condominiumName: condominium?.name ?? 'Condominio desconhecido',
          address: condominium?.address ?? '',
          apartment: user?.apartment ?? '',
          block: user?.block ?? null,
          clientName: user?.name ?? 'Cliente',
          quantity: order.quantity as number,
          status: order.status as string,
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
          lat: null,
          lng: null,
          stops: [],
        })
      }
      condoMap.get(item.condominiumId)!.stops.push(item)
    }

    // Geocodificar enderecos via Nominatim e ordenar stops por sortKey ASC
    const condos = await Promise.all(
      Array.from(condoMap.values()).map(async (condo) => {
        // Ordenar stops por apartamento numerico ASC (COUR-04)
        condo.stops.sort((a, b) => a.sortKey - b.sortKey)

        // Geocodificacao com cache — D-06, T-06-05: encodeURIComponent elimina risco de injecao
        if (condo.address) {
          const cached = this.geocodeCache.get(condo.address)
          if (cached !== undefined) {
            condo.lat = cached?.lat ?? null
            condo.lng = cached?.lng ?? null
          } else {
            try {
              const url = `https://api.nominatim.openstreetmap.org/search?q=${encodeURIComponent(condo.address)}&format=json&limit=1`
              const res = await fetch(url, {
                headers: {
                  'User-Agent': 'CheirimdePao-app/1.0 (contato@cheirindepao.com.br)',
                },
              })
              const data = await res.json() as Array<{ lat: string; lon: string }>
              if (data.length > 0) {
                const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
                this.geocodeCache.set(condo.address, coords)
                condo.lat = coords.lat
                condo.lng = coords.lng
              } else {
                this.geocodeCache.set(condo.address, null)
              }
            } catch {
              this.geocodeCache.set(condo.address, null)
            }
          }
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
          })),
        }
      }),
    )

    const totalStops = enriched.length
    const totalBreads = enriched.reduce((sum, o) => sum + o.quantity, 0)

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

    return { condos, totalStops, totalBreads, route }
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
}
