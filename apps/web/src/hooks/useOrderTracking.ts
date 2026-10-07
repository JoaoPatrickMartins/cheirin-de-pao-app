import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/apiFetch'

// Espelha o enum OrderStatus do backend (Prisma). Inclui estados intermediários
// (SEPARATED, NOT_DELIVERED) que NÃO são "entregue" — consumidores devem tratar o
// default como "agendado", nunca como "entregue".
export type OrderStatus =
  | 'SCHEDULED'
  | 'SEPARATED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'NOT_DELIVERED'
  | 'CANCELLED'

export interface TodayOrder {
  id: string
  status: OrderStatus
  quantity: number
  scheduledDate: string
  deliveryTime?: string
  deliveredAt?: string | null
  failedAt?: string | null
  /** Motivo da não entrega na linguagem do cliente — completa "Tentamos entregar, mas ___". */
  failureText?: string | null
  /** Selo do comprovante (foto) — só com a função ligada pelo admin, por 90 dias. */
  proof?: { available: boolean; expired: boolean }
  /** Quando o entregador INICIOU a rota do turno (D-7). null = ainda não saiu. */
  onTheWayAt?: string | null
  /** Quem traz o pão — só com a rota iniciada. */
  courier?: { firstName: string; photoUrl: string | null } | null
}

/**
 * useOrderTracking — busca a entrega de hoje (GET /orders/today).
 *
 * Com `fallbackToNext: true`, quando não há entrega hoje, busca a PRÓXIMA entrega
 * futura (GET /orders/next) — usado pelo card da Home. `isToday` indica a origem.
 */
export function useOrderTracking(
  opts: { fallbackToNext?: boolean } = {},
): { order: TodayOrder | null; isToday: boolean; isLoading: boolean } {
  const { fallbackToNext = false } = opts
  const [order, setOrder] = useState<TodayOrder | null>(null)
  const [isToday, setIsToday] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await apiFetch('/orders/today')
        if (res.ok) {
          setOrder((await res.json()) as TodayOrder)
          setIsToday(true)
          return
        }
        // Sem entrega hoje → opcionalmente buscar a próxima futura
        if (res.status === 404 && fallbackToNext) {
          const next = await apiFetch('/orders/next')
          if (next.ok) {
            setOrder((await next.json()) as TodayOrder)
            setIsToday(false)
            return
          }
        }
        setOrder(null)
        setIsToday(false)
      } catch {
        // mantém estado anterior em falha de rede
      } finally {
        setIsLoading(false)
      }
    }

    void fetchOrder()
    const id = setInterval(() => { void fetchOrder() }, 30_000)
    return () => clearInterval(id)
  }, [fallbackToNext])

  return { order, isToday, isLoading }
}
