import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/apiFetch'

export interface TodayOrder {
  id: string
  status: 'SCHEDULED' | 'OUT_FOR_DELIVERY' | 'DELIVERED'
  quantity: number
  scheduledDate: string
}

export function useOrderTracking(): { order: TodayOrder | null; isLoading: boolean } {
  const [order, setOrder] = useState<TodayOrder | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await apiFetch('/orders/today')
        if (res.ok) {
          setOrder((await res.json()) as TodayOrder)
        } else if (res.status === 404) {
          setOrder(null)
        }
      } catch {
        // mantém estado anterior em falha de rede
      } finally {
        setIsLoading(false)
      }
    }

    void fetchOrder()
    const id = setInterval(() => { void fetchOrder() }, 30_000)
    return () => clearInterval(id)
  }, [])

  return { order, isLoading }
}
