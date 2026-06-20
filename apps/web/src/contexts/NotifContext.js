import { jsx as _jsx } from "react/jsx-runtime";
/**
 * NotifContext — contexto global de notificações para clientes
 *
 * Fornece unreadCount e refresh() para toda a subárvore do ClientLayout.
 * HomeScreen e NotificationsScreen consomem useNotif() e recebem o mesmo unreadCount sincronizado.
 *
 * Padrão crítico: refresh usa useCallback com deps [] — evita loop infinito em
 * NotificationsScreen que inclui refresh no array de deps do seu useEffect.
 *
 * Requirements: ACOMP-05 (badge sincronizado entre telas)
 */
import { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { apiFetch } from '../lib/apiFetch';
export const NotifContext = createContext({
    unreadCount: 0,
    refresh: () => { },
});
export function NotifProvider({ children }) {
    const [unreadCount, setUnreadCount] = useState(0);
    const refresh = useCallback(async () => {
        try {
            const res = await apiFetch('/notifications/unread-count');
            if (res.ok) {
                const data = (await res.json());
                setUnreadCount(data.count);
            }
        }
        catch {
            // mantém estado anterior — falha de rede não propaga exceção
        }
    }, []);
    useEffect(() => {
        void refresh();
    }, [refresh]);
    return (_jsx(NotifContext.Provider, { value: { unreadCount, refresh }, children: children }));
}
export function useNotif() {
    return useContext(NotifContext);
}
