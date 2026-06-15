import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/apiFetch';
export function useNotifBadge() {
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
            // mantém estado anterior
        }
    }, []);
    useEffect(() => {
        void refresh();
    }, [refresh]);
    return { unreadCount, refresh };
}
