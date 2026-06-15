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
import { useEffect } from 'react';
import { apiFetch } from '../lib/apiFetch';
async function registerPlayerId(playerId) {
    try {
        await apiFetch('/users/push-token', {
            method: 'POST',
            body: JSON.stringify({ playerId }),
            headers: { 'Content-Type': 'application/json' },
        });
    }
    catch {
        // Silencioso — falha no registro não impede o uso do app
    }
}
export function useOneSignalRegister() {
    useEffect(() => {
        // Verificar se OneSignal está disponível no contexto do PWA
        if (typeof window === 'undefined')
            return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const OS = window.OneSignal;
        if (!OS)
            return;
        // Tentar registrar o player_id existente imediatamente
        try {
            const existingId = OS?.User?.PushSubscription?.id ?? null;
            if (existingId) {
                void registerPlayerId(existingId);
            }
        }
        catch {
            // Silencioso — SDK pode não estar inicializado completamente
        }
        // Listener para futuras mudanças de subscrição (ex: usuário concede permissão)
        const handleChange = (event) => {
            const id = event?.current?.id;
            if (id) {
                void registerPlayerId(id);
            }
        };
        try {
            OS?.User?.PushSubscription?.addEventListener?.('change', handleChange);
        }
        catch {
            // Silencioso — API pode não estar disponível em todos os contextos
        }
        // Cleanup: remover listener ao desmontar (T-04-06-04)
        return () => {
            try {
                OS?.User?.PushSubscription?.removeEventListener?.('change', handleChange);
            }
            catch {
                // Silencioso
            }
        };
    }, []);
}
