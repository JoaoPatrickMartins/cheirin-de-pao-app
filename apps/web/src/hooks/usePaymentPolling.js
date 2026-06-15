import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/apiFetch';
export function usePaymentPolling(paymentId, onApproved, onRejected) {
    const [attempts, setAttempts] = useState(0);
    const MAX_ATTEMPTS = 5;
    useEffect(() => {
        if (!paymentId || attempts >= MAX_ATTEMPTS)
            return;
        const id = setInterval(async () => {
            try {
                const res = await apiFetch(`/payments/${paymentId}/status`);
                const data = (await res.json());
                if (data.status === 'approved') {
                    clearInterval(id);
                    onApproved(data.creditBalance ?? 0);
                }
                else if (data.status === 'rejected') {
                    clearInterval(id);
                    onRejected?.();
                }
                else {
                    setAttempts((a) => a + 1);
                }
            }
            catch {
                setAttempts((a) => a + 1);
            }
        }, 3000);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paymentId, attempts]);
    return { isTimeout: attempts >= MAX_ATTEMPTS, attempts };
}
