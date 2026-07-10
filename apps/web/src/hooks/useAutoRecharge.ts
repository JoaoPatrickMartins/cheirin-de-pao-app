import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/apiFetch'

export interface AutoRechargeStatus {
  active: boolean
  comboId: string | null
  comboName: string | null
  comboQuantity: number | null
  price: number | null
}

/**
 * Lê o status da recarga automática (GET /users/me/auto-recharge).
 * Usado para exibir o estado "ativada" (read-only) em Perfil, Combos e Agenda.
 */
export function useAutoRecharge() {
  const [status, setStatus] = useState<AutoRechargeStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiFetch('/users/me/auto-recharge')
      .then(async (r) => {
        if (r.ok && !cancelled) setStatus((await r.json()) as AutoRechargeStatus)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { status, loading }
}
