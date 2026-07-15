/**
 * useOneSignalDeepLink — navega para telas internas quando o usuário toca em push notifications
 *
 * Executa dentro do ClientLayout (usuário já autenticado — useNavigate disponível).
 * Escuta eventos de clique em notificações OneSignal e redireciona conforme additionalData.screen.
 *
 * Threat model:
 * - T-08-09: additionalData.screen manipulado — apenas navega para rotas internas (/client/creditos, /client/pedidos, /client/home);
 *   nenhuma ação destrutiva possível via deep link; risco mínimo (accept)
 *
 * Requirements: CRED-11 (deep link push → tela de créditos)
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { oneSignalReady } from '../lib/onesignal'

export function useOneSignalDeepLink(): void {
  const navigate = useNavigate()

  useEffect(() => {
    if (typeof window === 'undefined') return

    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let OS: any = null

    const handleClick = (event: {
      notification?: { additionalData?: { screen?: string } }
    }) => {
      try {
        const screen = event?.notification?.additionalData?.screen
        if (!screen) return
        // Rotas absolutas (admin/entregador e novos pushes do cliente) navegam direto.
        if (screen.startsWith('/')) {
          navigate(screen)
        } else if (screen === 'creditos') {
          navigate('/client/creditos')
        } else if (screen === 'pedidos') {
          navigate('/client/pedidos')
        } else if (screen === 'home') {
          navigate('/client/home')
        }
      } catch {
        // Silencioso — falha no deep link não impede uso do app
      }
    }

    // Espera o init terminar antes de anexar o listener de clique.
    void oneSignalReady.then(() => {
      if (cancelled) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      OS = (window as any).OneSignal
      if (!OS) return
      try {
        OS?.Notifications?.addEventListener?.('click', handleClick)
      } catch {
        // Silencioso — API pode não estar disponível em todos os contextos
      }
    })

    // Cleanup: remover listener ao desmontar (T-04-06-04)
    return () => {
      cancelled = true
      try {
        OS?.Notifications?.removeEventListener?.('click', handleClick)
      } catch {
        // Silencioso
      }
    }
  }, [navigate])
}
