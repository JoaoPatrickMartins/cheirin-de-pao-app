import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useOrderTracking } from '../../hooks/useOrderTracking';
import { apiFetch } from '../../lib/apiFetch';
import { Icon } from '../../components/brand/Icon';
import { BreadMark } from '../../components/brand/BreadMark';
const STATUSES = ['SCHEDULED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
const STEPS = [
    {
        key: 'SCHEDULED',
        label: 'Agendado',
        desc: 'Pedido confirmado e créditos reservados',
    },
    {
        key: 'OUT_FOR_DELIVERY',
        label: 'Saiu para entrega',
        desc: 'O entregador está a caminho do seu condomínio',
    },
    {
        key: 'DELIVERED',
        label: 'Entregue',
        desc: 'Pãezinhos na sua porta. Bom dia!',
    },
];
function getStepState(stepKey, orderStatus) {
    const statusIndex = STATUSES.indexOf(orderStatus);
    const stepIndex = STATUSES.indexOf(stepKey);
    if (stepIndex < statusIndex)
        return 'done';
    if (stepIndex === statusIndex)
        return 'cur';
    return 'future';
}
function formatHeroDate(dateStr) {
    const date = new Date(dateStr);
    const dayName = new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        timeZone: 'America/Sao_Paulo',
    }).format(date);
    const dayNum = new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        timeZone: 'America/Sao_Paulo',
    }).format(date);
    const monthShort = new Intl.DateTimeFormat('pt-BR', {
        month: 'short',
        timeZone: 'America/Sao_Paulo',
    })
        .format(date)
        .replace('.', '');
    return `${dayName.toUpperCase()} · ${dayNum} ${monthShort.toUpperCase()}`;
}
function formatQty(qty) {
    return qty === 1 ? '1 pãozinho' : `${qty} pãezinhos`;
}
function formatHistoryDate(dateStr) {
    return new Intl.DateTimeFormat('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        timeZone: 'America/Sao_Paulo',
    }).format(new Date(dateStr));
}
function formatHistoryTime(dateStr) {
    return new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
    }).format(new Date(dateStr));
}
function Pill({ children, tone, dot, ariaLive }) {
    const toneStyles = {
        good: { background: 'var(--color-good-soft)', color: 'var(--color-good)' },
        neutral: { background: 'var(--color-surface-2)', color: 'var(--color-text-sec)' },
    };
    return (_jsxs("div", { "aria-live": ariaLive, style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 8px',
            borderRadius: 99,
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 11.5,
            ...toneStyles[tone],
        }, children: [dot && (_jsx("div", { style: {
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--color-good)',
                    flexShrink: 0,
                } })), children] }));
}
function StatusPill({ status }) {
    if (status === 'OUT_FOR_DELIVERY')
        return _jsx(Pill, { tone: "good", dot: true, children: "A caminho" });
    if (status === 'DELIVERED')
        return _jsx(Pill, { tone: "neutral", children: "Entregue" });
    return _jsx(Pill, { tone: "neutral", children: "Agendado" });
}
function HeroCard({ order }) {
    return (_jsxs("div", { style: {
            background: 'var(--color-espresso)',
            borderRadius: 'var(--radius-card)',
            padding: 20,
            overflow: 'hidden',
            position: 'relative',
            marginBottom: 18,
        }, children: [_jsx("div", { style: {
                    position: 'absolute',
                    top: -36,
                    right: -20,
                    opacity: 0.13,
                    pointerEvents: 'none',
                }, children: _jsx(BreadMark, { size: 150, color: "#E3AC3F" }) }), _jsx("p", { style: {
                    fontFamily: 'var(--font-body)',
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: '#E3AC3F',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    margin: '0 0 6px',
                }, children: formatHeroDate(order.scheduledDate) }), _jsx("p", { style: {
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 30,
                    color: '#FAF5EC',
                    letterSpacing: '-0.02em',
                    margin: 0,
                    lineHeight: 1.0,
                }, children: formatQty(order.quantity) }), _jsx("p", { style: {
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    color: '#C7B595',
                    margin: '4px 0 0',
                }, children: "Entrega no seu condom\u00EDnio" })] }));
}
function Timeline({ order }) {
    return (_jsx("div", { role: "list", style: { paddingLeft: 6, position: 'relative', marginBottom: 18 }, children: STEPS.map((step, i) => {
            const state = getStepState(step.key, order.status);
            const isLast = i === STEPS.length - 1;
            const prevDone = i > 0 && getStepState(STEPS[i - 1].key, order.status) === 'done';
            return (_jsxs("div", { role: "listitem", style: { display: 'flex', gap: 16, paddingBottom: isLast ? 0 : 26 }, children: [_jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }, children: [_jsxs("div", { style: {
                                    width: 34,
                                    height: 34,
                                    borderRadius: 99,
                                    background: state !== 'future' ? 'var(--color-accent)' : 'var(--color-surface)',
                                    border: `2px solid ${state !== 'future' ? 'var(--color-accent)' : 'var(--color-border)'}`,
                                    display: 'grid',
                                    placeItems: 'center',
                                    zIndex: 1,
                                    flexShrink: 0,
                                }, children: [state === 'done' && (_jsx(Icon, { name: "check", size: 18, color: "var(--color-app-bg)", stroke: 2.6, "aria-hidden": "true" })), state === 'cur' && (_jsx("div", { style: {
                                            width: 11,
                                            height: 11,
                                            borderRadius: '50%',
                                            background: '#FBF3E4',
                                        } })), state === 'future' && (_jsx("div", { style: { width: 11, height: 11, borderRadius: '50%', background: 'transparent' } }))] }), !isLast && (_jsx("div", { style: {
                                    width: 2.5,
                                    flex: 1,
                                    minHeight: 38,
                                    margin: '2px 0',
                                    background: prevDone ? 'var(--color-accent)' : 'var(--color-border)',
                                } }))] }), _jsxs("div", { style: { flex: 1, paddingTop: 4 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, children: [_jsx("span", { style: {
                                            fontFamily: 'var(--font-display)',
                                            fontWeight: 700,
                                            fontSize: 16.5,
                                            letterSpacing: '-0.01em',
                                            color: state !== 'future' ? 'var(--color-text)' : 'var(--color-text-ter)',
                                        }, children: step.label }), state === 'cur' && (_jsx(Pill, { tone: "good", dot: true, ariaLive: "polite", children: "agora" }))] }), _jsx("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 13,
                                    color: 'var(--color-text-sec)',
                                    margin: '4px 0 0',
                                    lineHeight: 1.45,
                                }, children: step.desc })] })] }, step.key));
        }) }));
}
export function TrackingScreen() {
    const navigate = useNavigate();
    const { order } = useOrderTracking();
    const [history, setHistory] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await apiFetch('/orders/history?days=30');
                if (res.ok) {
                    setHistory((await res.json()));
                }
            }
            catch {
                // mantém lista vazia
            }
            finally {
                setIsLoadingHistory(false);
            }
        };
        void fetchHistory();
    }, []);
    const visibleHistory = history.filter((o) => o.status !== 'CANCELLED');
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
                        }, children: "Sua entrega" })] }), _jsxs("div", { style: { padding: '0 20px 24px' }, children: [order && _jsx(HeroCard, { order: order }), order && _jsx(Timeline, { order: order }), order && (_jsxs("div", { style: {
                            display: 'flex',
                            gap: 12,
                            padding: '14px 16px',
                            background: 'var(--color-surface)',
                            borderRadius: 16,
                            border: '1px solid var(--color-border-2)',
                            marginBottom: 18,
                        }, children: [_jsx("div", { style: {
                                    width: 44,
                                    height: 44,
                                    borderRadius: 99,
                                    background: 'var(--color-surface-2)',
                                    display: 'grid',
                                    placeItems: 'center',
                                    flexShrink: 0,
                                }, children: _jsx(Icon, { name: "user", size: 22, color: "var(--color-accent)" }) }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("p", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 12,
                                            fontWeight: 600,
                                            color: 'var(--color-text-ter)',
                                            margin: '0 0 2px',
                                        }, children: "Seu entregador" }), _jsx("p", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 14.5,
                                            fontWeight: 700,
                                            color: 'var(--color-text)',
                                            margin: 0,
                                        }, children: "A definir" })] }), _jsx("button", { "aria-label": "Ligar para o entregador", style: {
                                    width: 40,
                                    height: 40,
                                    borderRadius: 12,
                                    background: 'var(--color-gold-soft)',
                                    border: 'none',
                                    display: 'grid',
                                    placeItems: 'center',
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                    padding: 2,
                                }, children: _jsx(Icon, { name: "phone", size: 19, color: "var(--color-accent)" }) })] })), _jsx("h2", { style: {
                            fontFamily: 'var(--font-display)',
                            fontWeight: 700,
                            fontSize: 16,
                            letterSpacing: '-0.02em',
                            color: 'var(--color-text)',
                            margin: '18px 0 10px',
                        }, children: "Hist\u00F3rico" }), isLoadingHistory && (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: [1, 2, 3].map((n) => (_jsx("div", { style: { height: 64, borderRadius: 'var(--radius-card)', background: 'var(--color-surface-2)' } }, n))) })), !isLoadingHistory && visibleHistory.length === 0 && (_jsxs("div", { style: { textAlign: 'center', paddingTop: 32 }, children: [_jsx(Icon, { name: "clock", size: 48, color: "var(--color-text-ter)" }), _jsx("p", { style: {
                                    fontFamily: 'var(--font-display)',
                                    fontWeight: 700,
                                    fontSize: 16,
                                    color: 'var(--color-text-sec)',
                                    margin: '12px 0 6px',
                                }, children: "Nenhuma entrega ainda" }), _jsx("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 13,
                                    color: 'var(--color-text-ter)',
                                    lineHeight: 1.5,
                                    margin: 0,
                                }, children: "Seus pedidos dos \u00FAltimos 30 dias aparecem aqui. Configure sua agenda para come\u00E7ar." })] })), !isLoadingHistory && visibleHistory.length > 0 && (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: visibleHistory.map((o) => {
                            const dateLabel = formatHistoryDate(o.scheduledDate);
                            const timeLabel = formatHistoryTime(o.scheduledDate);
                            const typeLabel = o.type === 'SINGLE' ? 'Pedido único' : 'Agendamento';
                            return (_jsxs("div", { "aria-label": `${dateLabel}, ${o.status === 'DELIVERED' ? 'Entregue' : o.status === 'OUT_FOR_DELIVERY' ? 'A caminho' : 'Agendado'}`, style: {
                                    display: 'flex',
                                    gap: 13,
                                    padding: 14,
                                    background: 'var(--color-surface)',
                                    borderRadius: 'var(--radius-card)',
                                    alignItems: 'center',
                                }, children: [_jsx("div", { style: {
                                            width: 44,
                                            height: 44,
                                            borderRadius: 13,
                                            background: 'var(--color-surface-2)',
                                            display: 'grid',
                                            placeItems: 'center',
                                            flexShrink: 0,
                                        }, children: _jsx(Icon, { name: o.type === 'SINGLE' ? 'bag' : 'calendar', size: 21, color: "var(--color-accent)" }) }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("p", { style: {
                                                    fontFamily: 'var(--font-body)',
                                                    fontWeight: 700,
                                                    fontSize: 14.5,
                                                    color: 'var(--color-text)',
                                                    margin: 0,
                                                }, children: dateLabel }), _jsxs("p", { style: {
                                                    fontFamily: 'var(--font-body)',
                                                    fontSize: 12.5,
                                                    color: 'var(--color-text-ter)',
                                                    margin: '1px 0 0',
                                                }, children: [typeLabel, " \u00B7 ", timeLabel, " \u00B7 ", o.quantity, " p\u00E3es"] })] }), _jsx(StatusPill, { status: o.status })] }, o.id));
                        }) }))] })] }));
}
