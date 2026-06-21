import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/apiFetch'

export interface TodayOrder {
  id: string
  status: 'SCHEDULED' | 'OUT_FOR_DELIVERY' | 'DELIVERED'
  quantity: number
  scheduledDate: string
  deliveryTime?: string
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
