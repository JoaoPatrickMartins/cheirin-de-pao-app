import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { apiFetch } from '../../lib/apiFetch';
export function ConfirmDeliveryDialog({ stop, isOpen, onClose, onConfirmed, }) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    if (!isOpen || !stop)
        return null;
    const handleConfirm = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await apiFetch(`/courier/orders/${stop.orderId}/confirm`, { method: 'PATCH' });
            if (res.ok) {
                onConfirmed(stop.orderId);
            }
            else {
                setError('Falha na conexão. Tente novamente.');
            }
        }
        catch {
            setError('Falha na conexão. Tente novamente.');
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleBackdropClick = () => {
        if (!isLoading)
            onClose();
    };
    return (_jsx("div", { role: "dialog", "aria-modal": "true", onClick: handleBackdropClick, style: {
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
        }, children: _jsxs("div", { onClick: (e) => e.stopPropagation(), style: {
                background: 'var(--color-surface)',
                borderRadius: 22,
                padding: 24,
                width: '100%',
                maxWidth: 320,
            }, children: [_jsx("h2", { style: {
                        fontFamily: 'var(--font-display)',
                        fontSize: 18,
                        fontWeight: 700,
                        color: 'var(--color-text)',
                        margin: '0 0 8px',
                    }, children: "Confirmar entrega?" }), _jsxs("p", { style: {
                        fontFamily: 'var(--font-body)',
                        fontSize: 15,
                        fontWeight: 700,
                        color: 'var(--color-text-sec)',
                        margin: '0 0 20px',
                    }, children: [stop.quantity === 1 ? '1 pão' : `${stop.quantity} pães`, " para ", stop.clientName, " \u00B7 Apartamento ", stop.apartment] }), _jsx("button", { onClick: onClose, disabled: isLoading, style: {
                        width: '100%',
                        minHeight: 44,
                        background: 'transparent',
                        color: 'var(--color-text)',
                        borderRadius: 'var(--radius-btn)',
                        fontFamily: 'var(--font-body)',
                        fontSize: 15,
                        fontWeight: 700,
                        border: '1.5px solid var(--color-border)',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        opacity: isLoading ? 0.5 : 1,
                        transition: 'opacity 0.15s',
                    }, children: "Cancelar" }), _jsx("button", { onClick: handleConfirm, disabled: isLoading, style: {
                        width: '100%',
                        minHeight: 44,
                        background: 'var(--color-espresso)',
                        color: 'var(--color-primary-btn-text)',
                        borderRadius: 'var(--radius-btn)',
                        fontFamily: 'var(--font-body)',
                        fontSize: 15,
                        fontWeight: 700,
                        border: 'none',
                        cursor: isLoading ? 'wait' : 'pointer',
                        opacity: isLoading ? 0.6 : 1,
                        marginTop: 8,
                        transition: 'opacity 0.15s',
                    }, children: isLoading ? 'Confirmando...' : 'Confirmar entrega' }), error !== null && (_jsx("p", { style: {
                        fontFamily: 'var(--font-body)',
                        fontSize: 12,
                        color: 'var(--color-destructive)',
                        margin: '8px 0 0',
                        textAlign: 'center',
                    }, children: error }))] }) }));
}
