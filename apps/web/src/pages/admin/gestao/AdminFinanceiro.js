import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { apiFetch } from '../../../lib/apiFetch';
import { Icon } from '../../../components/brand/Icon';
import { SegmentedControl } from '../../../components/admin/SegmentedControl';
import { BarChart } from '../../../components/admin/BarChart';
const PERIOD_TABS = [
    { key: 'day', label: 'Dia' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mês' },
];
const PERIOD_LABELS = {
    day: 'Receita · hoje',
    week: 'Receita · esta semana',
    month: 'Receita · este mês',
};
// ------------------------------------------------------------------ helpers
function formatBRL(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}
// ------------------------------------------------------------------ componente
export function AdminFinanceiro({ onBack }) {
    const [period, setPeriod] = useState('day');
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const res = await apiFetch(`/admin/financial?period=${period}`);
                if (res.ok) {
                    setData((await res.json()));
                }
            }
            catch {
                // falha silenciosa
            }
            finally {
                setIsLoading(false);
            }
        };
        void fetchData();
    }, [period]);
    // Montar dados do BarChart a partir de byCondominium
    const barData = data?.byCondominium.slice(0, 7).map((c, i, arr) => ({
        label: c.condominiumName.slice(0, 4),
        value: c.total,
        highlight: i === Math.min(arr.length - 2, arr.length - 1),
    })) ?? [];
    const maxCondo = data ? Math.max(...(data.byCondominium.map((c) => c.total) || [1]), 1) : 1;
    const totalTipo = data ? data.byType.combos + data.byType.avulso : 0;
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
                        }, children: "Financeiro" })] }), _jsxs("div", { style: { overflow: 'auto', flex: 1, padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }, children: [_jsx(SegmentedControl, { tabs: PERIOD_TABS, value: period, onChange: setPeriod }), isLoading ? (_jsx("div", { style: { paddingTop: 32, textAlign: 'center' }, children: _jsx("span", { style: { fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }, children: "Carregando..." }) })) : data ? (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                                    background: 'var(--color-surface)',
                                    border: '1px solid var(--color-border-2)',
                                    borderRadius: 18,
                                    padding: '18px 18px 14px',
                                }, children: [_jsx("p", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 12.5,
                                            fontWeight: 600,
                                            color: 'var(--color-text-sec)',
                                            margin: '0 0 4px',
                                        }, children: PERIOD_LABELS[period] }), _jsx("p", { style: {
                                            fontFamily: 'var(--font-display)',
                                            fontSize: 34,
                                            fontWeight: 800,
                                            letterSpacing: '-0.02em',
                                            color: 'var(--color-text)',
                                            margin: '0 0 16px',
                                        }, children: formatBRL(data.total) }), _jsx(BarChart, { data: barData.length > 0 ? barData : [{ label: '—', value: 0 }], height: 80 })] }), _jsxs("div", { style: {
                                    background: 'var(--color-surface)',
                                    border: '1px solid var(--color-border-2)',
                                    borderRadius: 18,
                                    padding: 18,
                                }, children: [_jsx("p", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color: 'var(--color-text)',
                                            margin: '0 0 14px',
                                        }, children: "Por tipo de compra" }), _jsx("div", { style: {
                                            height: 10,
                                            borderRadius: 99,
                                            overflow: 'hidden',
                                            background: 'var(--color-surface-2)',
                                            marginBottom: 12,
                                            display: 'flex',
                                        }, children: totalTipo > 0 && (_jsxs(_Fragment, { children: [_jsx("div", { style: {
                                                        width: `${(data.byType.combos / totalTipo) * 100}%`,
                                                        background: 'var(--color-gold)',
                                                        transition: 'width 0.3s ease',
                                                    } }), _jsx("div", { style: {
                                                        flex: 1,
                                                        background: 'rgba(176,112,42,0.35)',
                                                        transition: 'width 0.3s ease',
                                                    } })] })) }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { width: 10, height: 10, borderRadius: 3, background: 'var(--color-gold)', flexShrink: 0 } }), _jsx("span", { style: { fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-sec)' }, children: "Combos" })] }), _jsx("span", { style: { fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }, children: formatBRL(data.byType.combos) })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { width: 10, height: 10, borderRadius: 3, background: 'rgba(176,112,42,0.35)', flexShrink: 0 } }), _jsx("span", { style: { fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-sec)' }, children: "Compra personalizada" })] }), _jsx("span", { style: { fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }, children: formatBRL(data.byType.avulso) })] })] })] }), data.byCondominium.length > 0 && (_jsxs("div", { style: {
                                    background: 'var(--color-surface)',
                                    border: '1px solid var(--color-border-2)',
                                    borderRadius: 18,
                                    padding: 18,
                                }, children: [_jsx("p", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color: 'var(--color-text)',
                                            margin: '0 0 14px',
                                        }, children: "Por condom\u00EDnio" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 }, children: data.byCondominium.map((c) => (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 4 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsx("span", { style: {
                                                                fontFamily: 'var(--font-body)',
                                                                fontSize: 13,
                                                                fontWeight: 600,
                                                                color: 'var(--color-text-sec)',
                                                            }, children: c.condominiumName }), _jsx("span", { style: {
                                                                fontFamily: 'var(--font-body)',
                                                                fontSize: 13,
                                                                fontWeight: 700,
                                                                color: 'var(--color-text)',
                                                            }, children: formatBRL(c.total) })] }), _jsx("div", { style: {
                                                        height: 6,
                                                        borderRadius: 99,
                                                        background: 'var(--color-surface-2)',
                                                        overflow: 'hidden',
                                                    }, children: _jsx("div", { style: {
                                                            height: '100%',
                                                            width: `${(c.total / maxCondo) * 100}%`,
                                                            background: 'var(--color-gold)',
                                                            borderRadius: 99,
                                                            transition: 'width 0.3s ease',
                                                        } }) })] }, c.condominiumId))) })] }))] })) : (_jsx("div", { style: { paddingTop: 32, textAlign: 'center' }, children: _jsx("span", { style: { fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }, children: "Falha na conex\u00E3o. Tente novamente." }) }))] })] }));
}
