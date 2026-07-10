import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/apiFetch'

export function useNotifBadge(): { unreadCount: number; refresh: () => void } {
  const [unreadCount, setUnreadCount] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch('/notifications/unread-count')
      if (res.ok) {
        const data = (await res.json()) as { count: number }
        setUnreadCount(data.count)
      }
    } catch {
      // mantém estado anterior
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { unreadCount, refresh }
}
