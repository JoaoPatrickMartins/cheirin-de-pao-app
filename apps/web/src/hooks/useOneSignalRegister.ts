/**
 * useOneSignalRegister — registra o player_id do OneSignal no backend após autenticação
 *
 * Executa uma vez na montagem (dentro do ClientLayout — usuário já autenticado).
 * Envia o player_id via POST /users/push-token com o JWT disponível no localStorage.
 *
 * Threat model:
 * - T-04-06-03: player_id enviado ao backend que o associa ao userId do JWT — sem ganho em forjar
 * - T-04-06-04: cleanup function remove o listener (removeEventListener) — sem loop de listener
 *
 * Requirements: SCHED-01 (infra de push para notificações na Fase 5)
 */
import { useEffect } from 'react'
import { apiFetch } from '../lib/apiFetch'
import { oneSignalReady } from '../lib/onesignal'

async function registerPlayerId(playerId: string): Promise<void> {
  try {
    await apiFetch('/users/push-token', {
      method: 'POST',
      body: JSON.stringify({ playerId }),
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    // Silencioso — falha no registro não impede o uso do app
  }
}

export function useOneSignalRegister(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return

    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let OS: any = null

    const handleChange = (event: { current?: { id?: string | null } }) => {
      const id = event?.current?.id
      if (id) {
        void registerPlayerId(id)
      }
    }

    // Espera o init terminar antes de ler PushSubscription/anexar listener — sem isso, se o
    // hook montasse antes do SDK carregar, ele saía sem registrar nem escutar o opt-in futuro.
    void oneSignalReady.then(() => {
      if (cancelled) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      OS = (window as any).OneSignal
      if (!OS) return

      // Registra o player_id já existente (ex.: usuário que já havia concedido permissão).
      try {
        const existingId: string | null = OS?.User?.PushSubscription?.id ?? null
        if (existingId) void registerPlayerId(existingId)
      } catch {
        // Silencioso — SDK pode não estar completamente pronto
      }

      // Registra novos IDs quando a subscrição muda (ex.: usuário concede permissão agora).
      try {
        OS?.User?.PushSubscription?.addEventListener?.('change', handleChange)
      } catch {
        // Silencioso — API pode não estar disponível em todos os contextos
      }
    })

    // Cleanup: remover listener ao desmontar (T-04-06-04)
    return () => {
      cancelled = true
      try {
        OS?.User?.PushSubscription?.removeEventListener?.('change', handleChange)
      } catch {
        // Silencioso
      }
    }
  }, [])
}
