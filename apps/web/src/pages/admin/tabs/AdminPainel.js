import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { apiFetch } from '../../../lib/apiFetch';
import { AdminHead } from '../../../components/admin/AdminHead';
import { KpiCard } from '../../../components/admin/KpiCard';
import { BarChart } from '../../../components/admin/BarChart';
import { BreadMark } from '../../../components/brand/BreadMark';
import { Icon } from '../../../components/brand/Icon';
const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
function buildBarChartData(currentDayOfWeek) {
    // Seg a Dom (índices 1..7, mas JS usa 0=Dom)
    // Exibir 7 colunas: Seg, Ter, Qua, Qui, Sex, Sáb, Dom
    const orderedDays = [1, 2, 3, 4, 5, 6, 0]; // Seg..Dom
    return orderedDays.map((dayIndex) => ({
        label: DAY_LABELS[dayIndex],
        value: 1, // valor uniforme — sem dados históricos por dia no dashboard atual
        highlight: dayIndex === currentDayOfWeek,
    }));
}
export function AdminPainel({ onNavigate }) {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await apiFetch('/admin/dashboard');
                if (res.ok) {
                    setData((await res.json()));
                }
            }
            catch {
                // falha silenciosa — mantém estado anterior
            }
            finally {
                setIsLoading(false);
            }
        };
        void fetchData();
    }, []);
    const currentDayOfWeek = new Date().getDay();
    const barData = buildBarChartData(currentDayOfWeek);
    const totalReceita = data ? data.revenueByType.combos + data.revenueByType.avulso : 0;
    const combosPercent = totalReceita > 0 ? (data.revenueByType.combos / totalReceita) * 100 : 50;
    const avulsoPercent = totalReceita > 0 ? (data.revenueByType.avulso / totalReceita) * 100 : 50;
    function formatCurrency(value) {
        return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return (_jsxs("div", { style: {
            flex: 1,
            overflowY: 'auto',
            paddingBottom: 24,
        }, children: [_jsx(AdminHead, { sub: "Cheirin de P\u00E3o \u00B7 Opera\u00E7\u00E3o", titulo: "Painel" }), _jsx("div", { style: { padding: '0 20px' }, children: isLoading ? (
                /* Loading state simples */
                _jsx("div", { style: {
                        display: 'flex',
                        justifyContent: 'center',
                        padding: '40px 0',
                    }, children: _jsx("div", { style: {
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            border: '3px solid var(--color-border)',
                            borderTopColor: 'var(--color-accent)',
                            animation: 'spin 0.8s linear infinite',
                        } }) })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: 12,
                                marginBottom: 12,
                            }, children: [_jsx(KpiCard, { icon: "bag", value: data?.breadsTodayCount ?? 0, label: "P\u00E3es hoje", pill: { text: '+12%', tone: 'good' } }), _jsx(KpiCard, { icon: "trend", value: formatCurrency(data?.revenueToday ?? 0), label: "Receita do dia", pill: { text: '+8%', tone: 'good' } }), _jsx(KpiCard, { icon: "users", value: data?.clientsCount ?? 0, label: "Clientes", pill: { text: '+3', tone: 'good' } }), _jsx(KpiCard, { icon: "building", value: data?.condominiumsCount ?? 0, label: "Condom\u00EDnios" })] }), _jsx("div", { style: {
                                borderRadius: 22,
                                overflow: 'hidden',
                                marginBottom: 12,
                                cursor: 'pointer',
                            }, onClick: () => onNavigate('pedido'), role: "button", "aria-label": "Ir para pedido", children: _jsxs("div", { style: {
                                    position: 'relative',
                                    background: 'var(--color-espresso)',
                                    padding: '16px 18px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    overflow: 'hidden',
                                }, children: [_jsx("div", { style: {
                                            position: 'absolute',
                                            bottom: -40,
                                            right: -16,
                                            opacity: 0.12,
                                            pointerEvents: 'none',
                                        }, children: _jsx(BreadMark, { size: 120, color: "#E3AC3F" }) }), _jsx("div", { style: {
                                            width: 44,
                                            height: 44,
                                            borderRadius: 12,
                                            background: 'rgba(227,172,63,0.16)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#E3AC3F',
                                            flexShrink: 0,
                                        }, children: _jsx(Icon, { name: "factory", size: 22, color: "#E3AC3F", stroke: 2 }) }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsxs("p", { style: {
                                                    fontFamily: 'var(--font-body)',
                                                    fontSize: 11.5,
                                                    fontWeight: 700,
                                                    color: '#E3AC3F',
                                                    letterSpacing: '0.05em',
                                                    margin: 0,
                                                    lineHeight: 1.2,
                                                }, children: ["CORTE ", data?.cutoffTime ?? '20:00', " \u00B7 ABERTO"] }), _jsxs("p", { style: {
                                                    fontFamily: 'var(--font-display)',
                                                    fontSize: 16,
                                                    fontWeight: 700,
                                                    color: '#FAF5EC',
                                                    marginTop: 2,
                                                    margin: '2px 0 0',
                                                    lineHeight: 1.2,
                                                }, children: ["Pedido de amanh\u00E3 \u00B7 ", data?.breadsTodayCount ?? 0, " p\u00E3es"] })] }), _jsx(Icon, { name: "chevR", size: 20, color: "#C7B595", stroke: 2 })] }) }), _jsxs("div", { style: {
                                background: 'var(--color-surface)',
                                borderRadius: 22,
                                padding: 18,
                                border: '1px solid var(--color-border-2)',
                                marginBottom: 12,
                            }, children: [_jsx("p", { style: {
                                        fontFamily: 'var(--font-display)',
                                        fontSize: 15,
                                        fontWeight: 700,
                                        color: 'var(--color-text)',
                                        margin: '0 0 14px',
                                    }, children: "Fornadas por dia" }), _jsx(BarChart, { data: barData, height: 96 })] }), _jsxs("div", { style: {
                                background: 'var(--color-surface)',
                                borderRadius: 22,
                                padding: 18,
                                border: '1px solid var(--color-border-2)',
                            }, children: [_jsxs("div", { style: {
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'baseline',
                                        marginBottom: 12,
                                    }, children: [_jsx("p", { style: {
                                                fontFamily: 'var(--font-display)',
                                                fontSize: 15,
                                                fontWeight: 700,
                                                color: 'var(--color-text)',
                                                margin: 0,
                                            }, children: "Receita por tipo \u00B7 hoje" }), _jsx("p", { style: {
                                                fontFamily: 'var(--font-display)',
                                                fontSize: 15,
                                                fontWeight: 800,
                                                color: 'var(--color-text)',
                                                margin: 0,
                                            }, children: formatCurrency(totalReceita) })] }), _jsxs("div", { style: {
                                        height: 12,
                                        borderRadius: 99,
                                        overflow: 'hidden',
                                        marginBottom: 14,
                                        display: 'flex',
                                    }, children: [_jsx("div", { style: {
                                                width: `${combosPercent}%`,
                                                background: 'var(--color-gold)',
                                                transition: 'width 0.3s ease',
                                            } }), _jsx("div", { style: {
                                                width: `${avulsoPercent}%`,
                                                background: 'var(--color-accent)',
                                                opacity: 0.5,
                                                transition: 'width 0.3s ease',
                                            } })] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx("div", { style: {
                                                                width: 11,
                                                                height: 11,
                                                                borderRadius: 3,
                                                                background: 'var(--color-gold)',
                                                                flexShrink: 0,
                                                            } }), _jsx("span", { style: {
                                                                fontFamily: 'var(--font-body)',
                                                                fontSize: 13.5,
                                                                color: 'var(--color-text-sec)',
                                                            }, children: "Combos" })] }), _jsx("span", { style: {
                                                        fontFamily: 'var(--font-body)',
                                                        fontSize: 13.5,
                                                        fontWeight: 700,
                                                        color: 'var(--color-text)',
                                                    }, children: formatCurrency(data?.revenueByType.combos ?? 0) })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx("div", { style: {
                                                                width: 11,
                                                                height: 11,
                                                                borderRadius: 3,
                                                                background: 'var(--color-accent)',
                                                                opacity: 0.5,
                                                                flexShrink: 0,
                                                            } }), _jsx("span", { style: {
                                                                fontFamily: 'var(--font-body)',
                                                                fontSize: 13.5,
                                                                color: 'var(--color-text-sec)',
                                                            }, children: "Compra personalizada" })] }), _jsx("span", { style: {
                                                        fontFamily: 'var(--font-body)',
                                                        fontSize: 13.5,
                                                        fontWeight: 700,
                                                        color: 'var(--color-text)',
                                                    }, children: formatCurrency(data?.revenueByType.avulso ?? 0) })] })] })] })] })) }), _jsx("style", { children: `@keyframes spin { to { transform: rotate(360deg); } }` })] }));
}
