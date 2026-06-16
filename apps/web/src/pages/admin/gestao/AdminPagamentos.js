import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { apiFetch } from '../../../lib/apiFetch';
import { Icon } from '../../../components/brand/Icon';
import { PaymentDetailSheet } from '../../../components/admin/PaymentDetailSheet';
// ------------------------------------------------------------------ helpers
function formatBRL(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}
function formatDate(iso) {
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        timeZone: 'America/Sao_Paulo',
    }).format(new Date(iso));
}
function methodLabel(method) {
    if (method === 'PIX')
        return 'Pix';
    if (method === 'CREDIT_CARD')
        return 'Cartão';
    return 'Débito';
}
function typeLabel(payment) {
    if (payment.customQuantity)
        return `Avulso · ${payment.customQuantity} pães`;
    return 'Combo';
}
// ------------------------------------------------------------------ componente
export function AdminPagamentos({ onBack }) {
    const [sub, setSub] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [payments, setPayments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        const fetchPayments = async () => {
            try {
                const res = await apiFetch('/admin/payments');
                if (res.ok) {
                    setPayments((await res.json()));
                }
            }
            catch {
                // falha silenciosa
            }
            finally {
                setIsLoading(false);
            }
        };
        void fetchPayments();
    }, []);
    const handleRefundSuccess = (id) => {
        setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'REFUNDED' } : p)));
    };
    if (sub === 'detalhe' && selectedId) {
        return (_jsx(PaymentDetailSheet, { paymentId: selectedId, onBack: () => {
                setSub(null);
                setSelectedId(null);
            }, onRefundSuccess: () => handleRefundSuccess(selectedId) }));
    }
    return (_jsxs("div", { style: { flex: 1, display: 'flex', flexDirection: 'column' }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 20px 14px',
                }, children: [_jsx("button", { type: "button", "aria-label": "Voltar", onClick: onBack, style: {
                            background: 'var(--color-surface-2)',
                            border: 'none',
                            width: 36,
                            height: 36,
                            borderRadius: 11,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            flexShrink: 0,
                        }, children: _jsx(Icon, { name: "arrowL", size: 18, color: "var(--color-text)" }) }), _jsx("h2", { style: {
                            fontFamily: 'var(--font-display)',
                            fontSize: 20,
                            fontWeight: 700,
                            letterSpacing: '-0.02em',
                            color: 'var(--color-text)',
                            margin: 0,
                            flex: 1,
                        }, children: "Pagamentos" })] }), _jsx("div", { style: { overflow: 'auto', flex: 1, padding: '0 20px 24px' }, children: isLoading ? (_jsx("div", { style: { paddingTop: 32, textAlign: 'center' }, children: _jsx("span", { style: { fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }, children: "Carregando..." }) })) : (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 }, children: payments.map((p) => (_jsx(PaymentCard, { payment: p, formatBRL: formatBRL, formatDate: formatDate, methodLabel: methodLabel, typeLabel: typeLabel, onClick: () => {
                            setSelectedId(p.id);
                            setSub('detalhe');
                        }, onRefundSuccess: () => handleRefundSuccess(p.id) }, p.id))) })) })] }));
}
function PaymentCard({ payment: p, formatBRL, formatDate, methodLabel, typeLabel, onClick, onRefundSuccess, }) {
    const [showDialog, setShowDialog] = useState(false);
    const [isRefunding, setIsRefunding] = useState(false);
    const [refundError, setRefundError] = useState(null);
    const handleRefund = async () => {
        setIsRefunding(true);
        setRefundError(null);
        try {
            const res = await apiFetch(`/admin/payments/${p.id}/refund`, { method: 'POST' });
            if (res.ok) {
                setShowDialog(false);
                onRefundSuccess();
            }
            else {
                setRefundError('Falha no estorno. Tente novamente.');
            }
        }
        catch {
            setRefundError('Falha no estorno. Tente novamente.');
        }
        finally {
            setIsRefunding(false);
        }
    };
    return (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-2)',
                    borderRadius: 16,
                    padding: 15,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0,
                    cursor: 'pointer',
                }, role: "button", tabIndex: 0, onClick: onClick, onKeyDown: (e) => e.key === 'Enter' && onClick(), children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12 }, children: [_jsx("div", { style: {
                                    width: 42,
                                    height: 42,
                                    borderRadius: 12,
                                    background: 'var(--color-surface-2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }, children: _jsx(Icon, { name: "card", size: 20, color: "var(--color-accent)" }) }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("p", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 14.5,
                                            fontWeight: 700,
                                            color: 'var(--color-text)',
                                            margin: 0,
                                            lineHeight: 1.3,
                                        }, children: p.userName }), _jsxs("p", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 12,
                                            fontWeight: 500,
                                            color: 'var(--color-text-ter)',
                                            margin: '2px 0 0',
                                        }, children: [typeLabel(p), " \u00B7 ", methodLabel(p.method), " \u00B7 ", formatDate(p.createdAt)] })] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }, children: [_jsx("span", { style: {
                                            fontFamily: 'var(--font-display)',
                                            fontSize: 16,
                                            fontWeight: 800,
                                            color: 'var(--color-text)',
                                            textDecoration: p.status === 'REFUNDED' ? 'line-through' : 'none',
                                        }, children: formatBRL(p.amount) }), _jsx(StatusPill, { status: p.status })] })] }), p.status === 'PAID' && (_jsxs("button", { type: "button", onClick: (e) => {
                            e.stopPropagation();
                            setShowDialog(true);
                        }, style: {
                            width: '100%',
                            background: 'var(--color-surface-2)',
                            border: 'none',
                            borderRadius: 11,
                            padding: '9px 0',
                            fontFamily: 'var(--font-body)',
                            fontSize: 13,
                            fontWeight: 700,
                            color: 'var(--color-text-sec)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            marginTop: 12,
                        }, children: [_jsx(Icon, { name: "refresh", size: 15, color: "var(--color-text-sec)" }), "Estornar pagamento"] }))] }), showDialog && (_jsx(RefundDialog, { amount: p.amount, formatBRL: formatBRL, isRefunding: isRefunding, error: refundError, onConfirm: () => void handleRefund(), onCancel: () => {
                    setShowDialog(false);
                    setRefundError(null);
                } }))] }));
}
function StatusPill({ status }) {
    const config = {
        PAID: { bg: 'rgba(34,197,94,0.12)', color: 'var(--color-good)', label: 'Pago' },
        PENDING: { bg: 'rgba(227,172,63,0.14)', color: 'var(--color-accent)', label: 'Pendente' },
        FAILED: { bg: 'var(--color-surface-2)', color: 'var(--color-text-ter)', label: 'Falhou' },
        REFUNDED: { bg: 'var(--color-surface-2)', color: 'var(--color-text-ter)', label: 'Estornado' },
    };
    const c = config[status];
    return (_jsx("span", { style: {
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            fontWeight: 700,
            background: c.bg,
            color: c.color,
            borderRadius: 99,
            padding: '2px 8px',
            lineHeight: 1.4,
        }, children: c.label }));
}
function RefundDialog({ amount, formatBRL, isRefunding, error, onConfirm, onCancel }) {
    return (_jsx("div", { style: {
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '0 0 calc(20px + env(safe-area-inset-bottom))',
        }, onClick: onCancel, children: _jsxs("div", { role: "dialog", "aria-modal": "true", onClick: (e) => e.stopPropagation(), style: {
                background: 'var(--color-surface)',
                borderRadius: '20px 20px 0 0',
                padding: '24px 20px 20px',
                width: '100%',
                maxWidth: 480,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
            }, children: [_jsxs("h3", { style: {
                        fontFamily: 'var(--font-display)',
                        fontSize: 20,
                        fontWeight: 700,
                        color: 'var(--color-text)',
                        margin: 0,
                        letterSpacing: '-0.02em',
                    }, children: ["Estornar ", formatBRL(amount), "?"] }), _jsx("p", { style: {
                        fontFamily: 'var(--font-body)',
                        fontSize: 14,
                        color: 'var(--color-text-sec)',
                        margin: 0,
                        lineHeight: 1.5,
                    }, children: "Esta a\u00E7\u00E3o n\u00E3o pode ser desfeita. Os cr\u00E9ditos correspondentes ser\u00E3o removidos do saldo do cliente." }), error && (_jsx("p", { style: {
                        fontFamily: 'var(--font-body)',
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--color-accent)',
                        margin: 0,
                    }, children: error })), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 }, children: [_jsx("button", { type: "button", onClick: onConfirm, disabled: isRefunding, style: {
                                width: '100%',
                                minHeight: 50,
                                background: 'var(--color-espresso)',
                                color: '#FAF5EC',
                                border: 'none',
                                borderRadius: 14,
                                fontFamily: 'var(--font-body)',
                                fontSize: 15,
                                fontWeight: 700,
                                cursor: isRefunding ? 'default' : 'pointer',
                                opacity: isRefunding ? 0.6 : 1,
                            }, children: isRefunding ? 'Estornando...' : 'Confirmar estorno' }), _jsx("button", { type: "button", onClick: onCancel, disabled: isRefunding, style: {
                                width: '100%',
                                minHeight: 44,
                                background: 'transparent',
                                color: 'var(--color-text-sec)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 14,
                                fontFamily: 'var(--font-body)',
                                fontSize: 15,
                                fontWeight: 700,
                                cursor: isRefunding ? 'default' : 'pointer',
                            }, children: "Cancelar" })] })] }) }));
}
