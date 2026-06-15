import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/apiFetch';
export function useOrderTracking() {
    const [order, setOrder] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        const fetchOrder = async () => {
            try {
                const res = await apiFetch('/orders/today');
                if (res.ok) {
                    setOrder((await res.json()));
                }
                else if (res.status === 404) {
                    setOrder(null);
                }
            }
            catch {
                // mantém estado anterior em falha de rede
            }
            finally {
                setIsLoading(false);
            }
        };
        void fetchOrder();
        const id = setInterval(() => { void fetchOrder(); }, 30_000);
        return () => clearInterval(id);
    }, []);
    return { order, isLoading };
}
