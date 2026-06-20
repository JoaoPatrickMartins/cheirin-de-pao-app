import { useCallback, useEffect } from 'react'
import { apiFetch } from '../lib/apiFetch'
import { useAuth } from './useAuth'

/**
 * useCreditBalanceSync — mantém o creditBalance do AuthContext sempre alinhado
 * com o servidor (fonte de verdade), já que o valor salvo no login/localStorage
 * fica defasado quando o saldo muda por fora (ex.: admin concede créditos).
 *
 * Refaz o fetch de GET /client/profile:
 *   - ao montar (cobre refresh de página)
 *   - quando a aba volta a ficar visível / janela reganha foco (cobre troca de abas)
 *
 * Só roda para usuários CLIENT autenticados. Falha de rede é silenciosa —
 * mantém o último saldo conhecido.
 *
 * Retorna `refresh()` para forçar a sincronização manualmente (ex.: após uma
 * compra ou pull-to-refresh).
 */
export function useCreditBalanceSync(): { refresh: () => Promise<void> } {
  const { user, token, updateCreditBalance } = useAuth()

  const refresh = useCallback(async () => {
    if (!token || user?.role !== 'CLIENT') return
    try {
      const res = await apiFetch('/client/profile')
      if (!res.ok) return
      const data = (await res.json()) as { creditBalance?: number }
      if (typeof data.creditBalance === 'number') {
        updateCreditBalance(data.creditBalance)
      }
    } catch {
      // falha de rede — mantém saldo atual
    }
  }, [token, user?.role, updateCreditBalance])

  useEffect(() => {
    void refresh()

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])

  return { refresh }
}
