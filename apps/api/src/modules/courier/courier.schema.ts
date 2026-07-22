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

/** Body de PATCH /courier/orders/:id/not-delivered — motivo opcional da não-entrega. */
export const NotDeliveredBody = z.object({
  reason: z.string().max(500).optional(),
})

export type NotDeliveredBodyType = z.infer<typeof NotDeliveredBody>

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
      // Turno (slot) da entrega — deixa claro manhã/tarde por pedido (entregador pode
      // ter ambos os turnos no mesmo dia).
      slotId: string
      slotLabel: string
    }>
  }>
  totalStops: number
  totalBreads: number
  route: { distanceKm: string; durationMin: number; geometry: Array<[number, number]> } | null
  // Turnos presentes na rota de hoje (distintos, ordenados por horário) — usado no
  // cabeçalho do app do entregador para informar turno + horário.
  slots: Array<{ slotId: string; label: string; emoji: string; time: string }>
  // Entregas já concluídas hoje (DELIVERED/NOT_DELIVERED), agrupadas por condomínio e
  // ordenadas por bloco/apartamento — alimenta a aba "Realizadas".
  completed: Array<{
    condominiumId: string
    condominiumName: string
    stops: Array<{
      orderId: string
      apartment: string
      block: string | null
      clientName: string
      quantity: number
      status: string
      slotId: string
      slotLabel: string
      // Instante da conclusão (deliveredAt ou failedAt) em ISO 8601; null se ausente.
      completedAt: string | null
    }>
  }>
  completedTotal: number
}
