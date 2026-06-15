import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import { apiFetch } from '../../lib/apiFetch';
import { Icon } from '../../components/brand/Icon';
export function CreditHistoryScreen() {
    const navigate = useNavigate();
    const { token } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!token)
            return;
        const fetchHistory = async () => {
            try {
                const res = await apiFetch('/credits/history');
                if (res.ok) {
                    const data = (await res.json());
                    setTransactions(data);
                }
                else {
                    setError('Não foi possível carregar o extrato.');
                }
            }
            catch {
                setError('Erro de conexão. Tente novamente.');
            }
            finally {
                setIsLoading(false);
            }
        };
        void fetchHistory();
    }, [token]);
    const formatDate = (dateStr) => new Intl.DateTimeFormat('pt-BR').format(new Date(dateStr));
    return (_jsxs("div", { style: {
            minHeight: 'calc(100dvh - 56px - env(safe-area-inset-bottom))',
            background: 'var(--color-app-bg)',
        }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px 20px 14px',
                    gap: 12,
                }, children: [_jsx("button", { onClick: () => navigate(-1), "aria-label": "Voltar", style: {
                            width: 38,
                            height: 38,
                            borderRadius: 12,
                            background: 'var(--color-surface-2)',
                            border: 'none',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            flexShrink: 0,
                        }, children: _jsx(Icon, { name: "arrowL", size: 20 }) }), _jsx("h1", { style: {
                            fontFamily: 'var(--font-display)',
                            fontWeight: 700,
                            fontSize: 21,
                            color: 'var(--color-text)',
                            letterSpacing: '-0.02em',
                            margin: 0,
                        }, children: "Extrato de cr\u00E9ditos" })] }), _jsxs("div", { style: { padding: '0 20px 20px' }, children: [isLoading && (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: [1, 2, 3].map((n) => (_jsx("div", { style: {
                                height: 64,
                                borderRadius: 'var(--radius-card)',
                                background: 'var(--color-surface-2)',
                            } }, n))) })), error && (_jsx("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 14,
                            color: 'var(--color-accent)',
                            textAlign: 'center',
                        }, children: error })), !isLoading && !error && transactions.length === 0 && (_jsx("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 14,
                            color: 'var(--color-text-ter)',
                            textAlign: 'center',
                            marginTop: 40,
                        }, children: "Nenhuma transa\u00E7\u00E3o ainda." })), !isLoading && !error && transactions.length > 0 && (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: transactions.map((tx) => (_jsxs("div", { style: {
                                background: 'var(--color-surface)',
                                borderRadius: 'var(--radius-card)',
                                padding: '14px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                boxShadow: 'var(--shadow-soft)',
                            }, children: [_jsx("div", { style: {
                                        width: 36,
                                        height: 36,
                                        borderRadius: '50%',
                                        background: tx.type === 'PURCHASE' ? 'var(--color-gold-soft)' : 'var(--color-surface-2)',
                                        display: 'grid',
                                        placeItems: 'center',
                                        flexShrink: 0,
                                    }, children: _jsx(Icon, { name: tx.type === 'PURCHASE' ? 'arrowU' : 'chevD', size: 18, color: tx.type === 'PURCHASE' ? 'var(--color-gold)' : 'var(--color-accent)', stroke: 2.2 }) }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: {
                                                fontFamily: 'var(--font-body)',
                                                fontSize: 14,
                                                fontWeight: 700,
                                                color: 'var(--color-text)',
                                            }, children: tx.type === 'PURCHASE' ? 'Compra de créditos' : 'Entrega' }), _jsx("div", { style: {
                                                fontFamily: 'var(--font-body)',
                                                fontSize: 12,
                                                color: 'var(--color-text-ter)',
                                                marginTop: 2,
                                            }, children: formatDate(tx.createdAt) })] }), _jsx("div", { style: {
                                        fontFamily: 'var(--font-display)',
                                        fontWeight: 700,
                                        fontSize: 16,
                                        color: tx.type === 'PURCHASE' ? 'var(--color-gold)' : 'var(--color-accent)',
                                        letterSpacing: '-0.02em',
                                    }, children: tx.type === 'PURCHASE' ? `+${tx.quantity}` : `-${tx.quantity}` })] }, tx.id))) }))] })] }));
}
