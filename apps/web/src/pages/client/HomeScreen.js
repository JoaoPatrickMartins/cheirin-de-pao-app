import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import { CreditBalanceCard } from '../../components/client/CreditBalanceCard';
import { Icon } from '../../components/brand/Icon';
import { useOrderTracking } from '../../hooks/useOrderTracking';
import { useNotif } from '../../contexts/NotifContext';
import { useSchedule } from '../../hooks/useSchedule';
import BannerInsuficiente from '../../components/client/BannerInsuficiente';
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
// Mapa de índice do dia da semana (getDay()) para chave de WeeklyQty
const DAY_KEY_MAP = {
    0: 'dom',
    1: 'seg',
    2: 'ter',
    3: 'qua',
    4: 'qui',
    5: 'sex',
    6: 'sab',
};
// Abreviações exibidas nos cards de próximas entregas
const DAY_ABBR = {
    seg: 'Seg',
    ter: 'Ter',
    qua: 'Qua',
    qui: 'Qui',
    sex: 'Sex',
    sab: 'Sáb',
    dom: 'Dom',
};
function getGreeting() {
    const hours = new Date().getHours();
    if (hours < 12)
        return 'Bom dia';
    if (hours < 18)
        return 'Boa tarde';
    return 'Boa noite';
}
export function HomeScreen() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { order } = useOrderTracking();
    const { unreadCount } = useNotif();
    const [isCutoff, setIsCutoff] = useState(false);
    const creditBalance = user?.creditBalance ?? 0;
    // Dados reais de agendamento para NextDays (GET /schedules/me via useSchedule)
    const { weeklyQty, isLoading: scheduleLoading } = useSchedule(creditBalance);
    // Próximos 5 dias a partir de amanhã (BRT)
    const nextDays = Array.from({ length: 5 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i + 1);
        const key = DAY_KEY_MAP[d.getDay()];
        return {
            abbr: DAY_ABBR[key],
            dayNum: d.getDate(),
            qty: weeklyQty?.[key] ?? 0,
            key,
        };
    });
    const hasSchedule = Object.values(weeklyQty).some((v) => v > 0);
    useEffect(() => {
        // Verificar status de corte ao montar — endpoint público, sem token
        fetch(`${API_BASE_URL}/settings/cutoff-status`)
            .then((res) => res.json())
            .then((data) => {
            setIsCutoff(data.isCutoff === true);
        })
            .catch(() => {
            // Falha silenciosa — não exibe banner em caso de erro de rede
            setIsCutoff(false);
        });
    }, []);
    const firstName = user?.name?.split(' ')[0] ?? 'você';
    const greeting = getGreeting();
    const quickActions = [
        { label: 'Comprar créditos', icon: 'coin', path: '/client/creditos' },
        { label: 'Minha agenda', icon: 'calendar', path: '/client/agenda' },
        { label: 'Histórico', icon: 'clock', path: '/client/creditos/extrato' },
        { label: 'Configurações', icon: 'settings', path: '/client/settings' },
    ];
    return (_jsxs("div", { style: {
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
        }, children: [isCutoff && (_jsxs("div", { style: {
                    background: 'var(--color-surface-2)',
                    border: '1.5px solid var(--color-accent)',
                    borderRadius: 10,
                    margin: '12px 16px 0',
                    padding: '12px 16px',
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                }, children: [_jsx(Icon, { name: "clock", size: 18, color: "var(--color-gold)" }), _jsx("span", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 13.5,
                            fontWeight: 600,
                            color: 'var(--color-text)',
                        }, children: "Prazo de agendamento encerrado para amanh\u00E3" })] })), _jsxs("div", { style: {
                    paddingTop: 8,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                }, children: [_jsxs("div", { children: [_jsx("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: 'var(--color-text-ter)',
                                    margin: '0 0 4px',
                                    letterSpacing: '0.01em',
                                }, children: "Condom\u00EDnio" }), _jsxs("h1", { style: {
                                    fontFamily: 'var(--font-display)',
                                    fontWeight: 700,
                                    fontSize: 22,
                                    color: 'var(--color-text)',
                                    letterSpacing: '-0.02em',
                                    margin: 0,
                                    lineHeight: 1.15,
                                }, children: [greeting, ", ", firstName] })] }), _jsxs("button", { onClick: () => navigate('/client/notificacoes'), "aria-label": unreadCount > 0 ? `Notificações (${unreadCount} não lidas)` : 'Notificações', style: {
                            position: 'relative',
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border-2)',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            flexShrink: 0,
                        }, children: [_jsx(Icon, { name: "bell", size: 20, color: "var(--color-accent)" }), unreadCount > 0 && (_jsx("div", { style: {
                                    position: 'absolute',
                                    top: 9,
                                    right: 9,
                                    width: 7,
                                    height: 7,
                                    borderRadius: '50%',
                                    background: 'var(--color-gold)',
                                } }))] })] }), _jsx(CreditBalanceCard, { creditBalance: creditBalance, isLoading: false }), _jsxs("div", { onClick: () => navigate('/client/pedidos'), role: "button", tabIndex: 0, onKeyDown: (e) => e.key === 'Enter' && navigate('/client/pedidos'), "aria-label": "Ver entrega de hoje", style: {
                    background: order ? 'var(--color-espresso)' : 'var(--color-surface)',
                    borderRadius: 'var(--radius-card)',
                    padding: '16px',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-soft)',
                    position: 'relative',
                    overflow: 'hidden',
                    opacity: order?.status === 'DELIVERED' ? 0.85 : 1,
                }, children: [!order && (_jsxs(_Fragment, { children: [_jsx("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 12.5,
                                    fontWeight: 600,
                                    color: 'var(--color-text-ter)',
                                    letterSpacing: '0.04em',
                                    margin: '0 0 8px',
                                    textTransform: 'uppercase',
                                }, children: "ENTREGA DE HOJE" }), _jsx("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 14,
                                    color: 'var(--color-text-sec)',
                                    margin: 0,
                                }, children: "Nenhuma entrega agendada" })] })), order && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12 }, children: [_jsx(Icon, { name: order.status === 'SCHEDULED'
                                            ? 'calendar'
                                            : order.status === 'OUT_FOR_DELIVERY'
                                                ? 'truck'
                                                : 'check', size: 24, color: "#E3AC3F" }), _jsxs("div", { children: [_jsx("p", { style: {
                                                    fontFamily: 'var(--font-body)',
                                                    fontSize: 11.5,
                                                    fontWeight: 700,
                                                    color: '#E3AC3F',
                                                    letterSpacing: '0.06em',
                                                    textTransform: 'uppercase',
                                                    margin: '0 0 2px',
                                                }, children: order.status === 'SCHEDULED'
                                                    ? 'AGENDADO'
                                                    : order.status === 'OUT_FOR_DELIVERY'
                                                        ? 'SAINDO DO FORNO'
                                                        : 'ENTREGUE' }), _jsxs("p", { style: {
                                                    fontFamily: 'var(--font-display)',
                                                    fontWeight: 700,
                                                    fontSize: 16,
                                                    color: '#FAF5EC',
                                                    margin: 0,
                                                    letterSpacing: '-0.01em',
                                                }, children: [order.quantity === 1 ? '1 pãozinho' : `${order.quantity} pãezinhos`, order.status === 'SCHEDULED' ? ' · Hoje' : ''] })] })] }), _jsxs("div", { style: {
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    padding: '3px 8px',
                                    borderRadius: 99,
                                    fontFamily: 'var(--font-body)',
                                    fontWeight: 700,
                                    fontSize: 11.5,
                                    background: order.status === 'OUT_FOR_DELIVERY'
                                        ? 'var(--color-good-soft)'
                                        : 'var(--color-surface-2)',
                                    color: order.status === 'OUT_FOR_DELIVERY'
                                        ? 'var(--color-good)'
                                        : 'var(--color-text-sec)',
                                }, children: [order.status === 'OUT_FOR_DELIVERY' && (_jsx("div", { style: { width: 6, height: 6, borderRadius: '50%', background: 'var(--color-good)', flexShrink: 0 } })), order.status === 'SCHEDULED'
                                        ? 'Agendado'
                                        : order.status === 'OUT_FOR_DELIVERY'
                                            ? 'A caminho'
                                            : 'Entregue hoje'] })] }))] }), creditBalance === 0 && (_jsx(BannerInsuficiente, { saldo: 0, requerido: 1, onComprar: () => navigate('/client/creditos'), onAjustar: () => { }, hideAjustar: true })), _jsxs("div", { style: {
                    background: 'var(--color-surface)',
                    borderRadius: 'var(--radius-card)',
                    padding: '16px',
                    boxShadow: 'var(--shadow-soft)',
                }, children: [_jsx("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: 'var(--color-text-ter)',
                            letterSpacing: '0.04em',
                            margin: '0 0 14px',
                            textTransform: 'uppercase',
                        }, children: "A\u00C7\u00D5ES R\u00C1PIDAS" }), _jsx("div", { style: {
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: 8,
                        }, children: quickActions.map((action) => (_jsxs("button", { onClick: () => navigate(action.path), style: {
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 6,
                                padding: '8px 4px',
                                minHeight: 44,
                            }, children: [_jsx("div", { style: {
                                        width: 40,
                                        height: 40,
                                        borderRadius: 12,
                                        background: 'var(--color-surface-2)',
                                        display: 'grid',
                                        placeItems: 'center',
                                        flexShrink: 0,
                                    }, children: _jsx(Icon, { name: action.icon, size: 20, color: "var(--color-accent)", stroke: 2 }) }), _jsx("span", { style: {
                                        fontFamily: 'var(--font-body)',
                                        fontSize: 10.5,
                                        fontWeight: 600,
                                        color: 'var(--color-text-sec)',
                                        textAlign: 'center',
                                        lineHeight: 1.2,
                                    }, children: action.label })] }, action.path))) })] }), _jsxs("div", { style: {
                    background: 'var(--color-surface)',
                    borderRadius: 'var(--radius-card)',
                    padding: '16px',
                    boxShadow: 'var(--shadow-soft)',
                }, children: [_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 12,
                        }, children: [_jsx("p", { style: {
                                    fontFamily: 'var(--font-display)',
                                    fontSize: 16,
                                    fontWeight: 700,
                                    color: 'var(--color-text)',
                                    letterSpacing: '-0.01em',
                                    margin: 0,
                                }, children: "Pr\u00F3ximas entregas" }), _jsx("button", { onClick: () => navigate('/client/agenda'), style: {
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: 'var(--color-accent)',
                                    padding: 0,
                                }, children: "Editar agenda" })] }), scheduleLoading ? (
                    /* Placeholder durante carregamento */
                    _jsx("div", { style: { display: 'flex', gap: 8 }, children: [0, 1, 2, 3, 4].map((i) => (_jsx("div", { style: {
                                flex: 1,
                                height: 70,
                                borderRadius: 16,
                                background: 'var(--color-surface-2)',
                            } }, i))) })) : !hasSchedule ? (
                    /* Sem agendamento configurado */
                    _jsx("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 14,
                            color: 'var(--color-text-sec)',
                            margin: 0,
                        }, children: "Configure sua agenda para ver as pr\u00F3ximas entregas" })) : (
                    /* Cards dos próximos 5 dias com dados reais do weeklyQty */
                    _jsx("div", { style: { display: 'flex', gap: 8 }, children: nextDays.map((day) => (_jsxs("div", { style: {
                                flex: 1,
                                borderRadius: 16,
                                padding: '12px 0',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 6,
                                background: 'var(--color-surface-2)',
                            }, children: [_jsx("span", { style: {
                                        fontFamily: 'var(--font-body)',
                                        fontSize: 11.5,
                                        fontWeight: 600,
                                        color: 'var(--color-text-ter)',
                                    }, children: day.abbr }), _jsx("span", { style: {
                                        fontFamily: 'var(--font-display)',
                                        fontSize: 20,
                                        fontWeight: 800,
                                        color: 'var(--color-text)',
                                        lineHeight: 1,
                                    }, children: day.dayNum }), day.qty > 0 ? (_jsx("div", { style: {
                                        background: 'var(--color-gold)',
                                        borderRadius: 99,
                                        padding: '2px 6px',
                                    }, children: _jsxs("span", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 10.5,
                                            fontWeight: 700,
                                            color: 'var(--color-espresso)',
                                        }, children: [day.qty, " p\u00E3o"] }) })) : (_jsx("span", { style: {
                                        fontFamily: 'var(--font-body)',
                                        fontSize: 10.5,
                                        fontWeight: 600,
                                        color: 'var(--color-text-ter)',
                                    }, children: "folga" }))] }, day.key + day.dayNum))) }))] })] }));
}
