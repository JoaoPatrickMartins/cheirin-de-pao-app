import { z } from 'zod'

/**
 * Schema de validacao dos params de confirmacao de entrega.
 * T-06-01: orderId validado no schema; courierId extraido do JWT (nunca do body).
 * D-12: PATCH /courier/orders/:id/confirm — id vem da URL.
 */
export const ConfirmDeliveryParams = z.object({
  id: z.string().min(1, 'ID do pedido e obrigatorio'),
})

export type ConfirmDeliveryParamsType = z.infer<typeof ConfirmDeliveryParams>

/**
 * Tipo de resposta de GET /courier/orders/today.
 *
 * Agrupa ordens por condominio com paradas ordenadas por apartamento numerico.
 * route e null quando OSRM falha (graceful degradation — D-07).
 */
export type TodayOrdersResponse = {
  condos: Array<{
    condominiumId: string
    condominiumName: string
    address: string
    lat: number | null
    lng: number | null
    stops: Array<{
      orderId: string
      apartment: string
      block: string | null
      clientName: string
      quantity: number
      status: string
      sortKey: number
    }>
  }>
  totalStops: number
  totalBreads: number
  route: { distanceKm: string; durationMin: number; geometry: Array<[number, number]> } | null
}
