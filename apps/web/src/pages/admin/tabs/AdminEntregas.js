import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { apiFetch } from '../../../lib/apiFetch';
import { AdminHead } from '../../../components/admin/AdminHead';
import { SegmentedControl } from '../../../components/admin/SegmentedControl';
import { ProgressBar } from '../../../components/admin/ProgressBar';
import { DeliveryDivisionCard, } from '../../../components/admin/DeliveryDivisionCard';
import { Icon } from '../../../components/brand/Icon';
const TABS = [
    { key: 'hoje', label: 'Hoje' },
    { key: 'historico', label: 'Histórico' },
];
function formatDateLong(dateStr) {
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    }
    catch {
        return dateStr;
    }
}
function formatDateShort() {
    const d = new Date();
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
}
export function AdminEntregas() {
    const [segment, setSegment] = useState('hoje');
    // Estado aba Hoje
    const [assignments, setAssignments] = useState([]);
    const [deliveryStatus, setDeliveryStatus] = useState([]);
    const [isLoadingHoje, setIsLoadingHoje] = useState(true);
    const [isApproved, setIsApproved] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    // Estado aba Histórico
    const [history, setHistory] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    useEffect(() => {
        if (segment === 'hoje') {
            void fetchHojeData();
        }
        else {
            void fetchHistory();
        }
    }, [segment]);
    async function fetchHojeData() {
        setIsLoadingHoje(true);
        try {
            // Buscar divisão sugerida
            const divRes = await apiFetch('/admin/orders/division-suggestion');
            if (divRes.ok) {
                const divData = (await divRes.json());
                setAssignments(divData);
            }
            // Buscar status de entregas do dia
            const statusRes = await apiFetch('/admin/orders/delivery-status');
            if (statusRes.ok) {
                const statusData = (await statusRes.json());
                setDeliveryStatus(statusData);
            }
        }
        catch {
            // falha silenciosa — mantém estado anterior
        }
        finally {
            setIsLoadingHoje(false);
        }
    }
    async function fetchHistory() {
        if (history.length > 0)
            return;
        setIsLoadingHistory(true);
        try {
            const res = await apiFetch('/admin/supplier-orders');
            if (res.ok) {
                const data = (await res.json());
                setHistory(data);
            }
        }
        catch {
            // falha silenciosa
        }
        finally {
            setIsLoadingHistory(false);
        }
    }
    async function handleApprove() {
        setIsApproving(true);
        try {
            // Para cada entregador com condominios, buscar orderIds via delivery-status e chamar assign-courier
            const assignmentsWithCondos = assignments.filter((a) => a.condos.length > 0);
            for (const assignment of assignmentsWithCondos) {
                const condoIds = assignment.condos.map((c) => c.condominiumId);
                const orderIds = deliveryStatus
                    .filter((ds) => condoIds.includes(ds.condominiumId))
                    .flatMap((ds) => ds.orderIds);
                if (orderIds.length === 0)
                    continue;
                const res = await apiFetch('/admin/orders/assign-courier', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ courierId: assignment.courierId, orderIds }),
                });
                if (!res.ok) {
                    throw new Error(`Falha ao atribuir entregador ${assignment.courierId}`);
                }
            }
            setIsApproved(true);
        }
        finally {
            setIsApproving(false);
        }
    }
    function renderHoje() {
        if (isLoadingHoje) {
            return (_jsx("div", { style: { display: 'flex', justifyContent: 'center', padding: '40px 0' }, children: _jsx("div", { style: {
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        border: '3px solid var(--color-border)',
                        borderTopColor: 'var(--color-accent)',
                        animation: 'spin 0.8s linear infinite',
                    } }) }));
        }
        if (assignments.length === 0) {
            return (_jsxs("div", { style: { textAlign: 'center', padding: '40px 20px' }, children: [_jsx("p", { style: {
                            fontFamily: 'var(--font-display)',
                            fontSize: 18,
                            fontWeight: 700,
                            color: 'var(--color-text)',
                            margin: '0 0 8px',
                        }, children: "Aguardando o corte" }), _jsx("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 13.5,
                            color: 'var(--color-text-sec)',
                            margin: 0,
                            lineHeight: 1.5,
                        }, children: "A divis\u00E3o de entregadores ficar\u00E1 dispon\u00EDvel ap\u00F3s o pedido ser confirmado." })] }));
        }
        return (_jsxs(_Fragment, { children: [_jsx(DeliveryDivisionCard, { assignments: assignments, onAssignmentsChange: setAssignments, onApprove: handleApprove, isApproved: isApproved, isApproving: isApproving }), deliveryStatus.length > 0 && (_jsxs("div", { style: { marginTop: 20 }, children: [_jsx("p", { style: {
                                fontFamily: 'var(--font-body)',
                                fontSize: 12.5,
                                fontWeight: 700,
                                color: 'var(--color-text-sec)',
                                letterSpacing: '0.04em',
                                margin: '0 0 10px',
                            }, children: "AGENDADAS VS REALIZADAS" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 }, children: deliveryStatus.map((item) => {
                                const isComplete = item.delivered >= item.scheduled && item.scheduled > 0;
                                const pct = item.scheduled > 0 ? item.delivered / item.scheduled : 0;
                                return (_jsxs("div", { style: {
                                        background: 'var(--color-surface)',
                                        borderRadius: 18,
                                        padding: 15,
                                        border: '1px solid var(--color-border-2)',
                                    }, children: [_jsxs("div", { style: {
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                marginBottom: 10,
                                            }, children: [_jsx("span", { style: {
                                                        fontFamily: 'var(--font-body)',
                                                        fontSize: 14.5,
                                                        fontWeight: 700,
                                                        color: 'var(--color-text)',
                                                    }, children: item.condominiumName }), isComplete ? (_jsxs("span", { style: {
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 4,
                                                        padding: '3px 8px',
                                                        borderRadius: 99,
                                                        background: 'var(--color-good-soft)',
                                                        color: 'var(--color-good)',
                                                        fontFamily: 'var(--font-body)',
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                    }, children: [_jsx(Icon, { name: "check", size: 13, color: "var(--color-good)", stroke: 2.6, "aria-hidden": "true" }), "Completo"] })) : (_jsxs("span", { style: {
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        padding: '3px 8px',
                                                        borderRadius: 99,
                                                        background: 'var(--color-gold-soft)',
                                                        color: '#8A6A00',
                                                        fontFamily: 'var(--font-body)',
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                    }, children: [item.delivered, "/", item.scheduled] }))] }), _jsx(ProgressBar, { value: item.delivered, max: item.scheduled, color: isComplete ? 'var(--color-good)' : 'var(--color-gold)' })] }, item.condominiumId));
                            }) })] }))] }));
    }
    function renderHistorico() {
        if (isLoadingHistory) {
            return (_jsx("div", { style: { display: 'flex', justifyContent: 'center', padding: '40px 0' }, children: _jsx("div", { style: {
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        border: '3px solid var(--color-border)',
                        borderTopColor: 'var(--color-accent)',
                        animation: 'spin 0.8s linear infinite',
                    } }) }));
        }
        if (history.length === 0) {
            return (_jsx("p", { style: {
                    fontFamily: 'var(--font-body)',
                    fontSize: 13.5,
                    color: 'var(--color-text-sec)',
                    textAlign: 'center',
                    padding: '40px 0',
                }, children: "Nenhum hist\u00F3rico encontrado." }));
        }
        return (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 }, children: history.map((item) => {
                const delivered = item.delivered ?? 0;
                const total = item.total ?? item.totalBreads ?? 0;
                const pct = total > 0 ? Math.round((delivered / total) * 100) : 0;
                const isComplete = pct >= 100;
                return (_jsxs("div", { style: {
                        background: 'var(--color-surface)',
                        borderRadius: 18,
                        padding: 15,
                        border: '1px solid var(--color-border-2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                    }, children: [_jsx("div", { style: {
                                width: 42,
                                height: 42,
                                borderRadius: 12,
                                background: 'var(--color-surface-2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }, children: _jsx(Icon, { name: "truck", size: 20, color: "var(--color-accent)", stroke: 2, "aria-hidden": "true" }) }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("p", { style: {
                                        fontFamily: 'var(--font-body)',
                                        fontSize: 14.5,
                                        fontWeight: 700,
                                        color: 'var(--color-text)',
                                        margin: 0,
                                        lineHeight: 1.2,
                                    }, children: formatDateLong(item.date) }), _jsxs("p", { style: {
                                        fontFamily: 'var(--font-body)',
                                        fontSize: 12,
                                        color: 'var(--color-text-ter)',
                                        margin: '3px 0 0',
                                    }, children: [delivered, " de ", total, " entregues"] })] }), _jsxs("span", { style: {
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '3px 8px',
                                borderRadius: 99,
                                background: isComplete ? 'var(--color-good-soft)' : 'var(--color-surface-2)',
                                color: isComplete ? 'var(--color-good)' : 'var(--color-text-sec)',
                                fontFamily: 'var(--font-body)',
                                fontSize: 11,
                                fontWeight: 700,
                                flexShrink: 0,
                            }, children: [pct, "%"] })] }, item._id));
            }) }));
    }
    return (_jsxs("div", { style: {
            flex: 1,
            overflowY: 'auto',
            paddingBottom: 24,
        }, children: [_jsx(AdminHead, { sub: `Controle do dia · ${formatDateShort()}`, titulo: "Entregas" }), _jsxs("div", { style: { padding: '0 20px' }, children: [_jsx("div", { style: { marginBottom: 16 }, children: _jsx(SegmentedControl, { tabs: TABS, value: segment, onChange: setSegment }) }), segment === 'hoje' ? renderHoje() : renderHistorico()] }), _jsx("style", { children: `@keyframes spin { to { transform: rotate(360deg); } }` })] }));
}
