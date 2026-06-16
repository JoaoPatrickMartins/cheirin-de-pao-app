import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../lib/apiFetch';
import { Icon } from '../../../components/brand/Icon';
import { ComboForm } from './ComboForm';
// ------------------------------------------------------------------ helpers
function formatBRL(cents) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents);
}
function precoComDesconto(price, discount) {
    if (discount.type === 'PERCENT') {
        return price * (1 - discount.value / 100);
    }
    return Math.max(0, price - discount.value);
}
// ------------------------------------------------------------------ componente
export function AdminCombos({ onBack }) {
    const [sub, setSub] = useState(null);
    const [editId, setEditId] = useState(null);
    const [combos, setCombos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const fetchCombos = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await apiFetch('/admin/combos');
            if (res.ok) {
                setCombos((await res.json()));
            }
        }
        catch {
            // falha silenciosa
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    useEffect(() => {
        void fetchCombos();
    }, [fetchCombos]);
    if (sub === 'criar') {
        return (_jsx(ComboForm, { onBack: () => setSub(null), onSaved: () => {
                setSub(null);
                void fetchCombos();
            } }));
    }
    if (sub === 'editar' && editId) {
        return (_jsx(ComboForm, { id: editId, onBack: () => setSub(null), onSaved: () => {
                setSub(null);
                void fetchCombos();
            } }));
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
                        }, children: "Combos e promo\u00E7\u00F5es" })] }), _jsxs("div", { style: { overflow: 'auto', flex: 1, padding: '0 20px 24px' }, children: [_jsx(GoldBtn, { icon: "plus", onClick: () => setSub('criar'), children: "Novo combo" }), isLoading ? (_jsx("div", { style: { paddingTop: 32, textAlign: 'center' }, children: _jsx("span", { style: { fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }, children: "Carregando..." }) })) : (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }, children: combos.map((combo) => (_jsx(ComboCard, { combo: combo, onEdit: () => {
                                setEditId(combo.id);
                                setSub('editar');
                            }, onTogglePromo: () => void togglePromo(combo, combos, setCombos) }, combo.id))) }))] })] }));
}
// ------------------------------------------------------------------ toggle otimista
async function togglePromo(combo, combos, setCombos) {
    const prevActive = combo.discount?.active ?? false;
    const newActive = !prevActive;
    // Atualização otimista
    setCombos((prev) => prev.map((c) => c.id === combo.id
        ? { ...c, discount: c.discount ? { ...c.discount, active: newActive } : { type: 'PERCENT', value: 15, active: newActive } }
        : c));
    try {
        await apiFetch(`/admin/combos/${combo.id}/promotion`, {
            method: 'PATCH',
            body: JSON.stringify({ active: newActive }),
        });
    }
    catch {
        // Reverter em caso de erro
        setCombos((prev) => prev.map((c) => c.id === combo.id
            ? { ...c, discount: c.discount ? { ...c.discount, active: prevActive } : null }
            : c));
    }
}
function ComboCard({ combo, onEdit, onTogglePromo }) {
    const promoAtiva = combo.discount?.active === true;
    return (_jsxs("div", { style: {
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-2)',
            borderRadius: 16,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12 }, children: [_jsx("div", { style: {
                            width: 44,
                            height: 44,
                            borderRadius: 13,
                            background: 'var(--color-surface-2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }, children: _jsx(Icon, { name: "bag", size: 22, color: "var(--color-accent)" }) }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsxs("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: 'var(--color-text)',
                                    margin: 0,
                                    lineHeight: 1.3,
                                }, children: [combo.name, combo.tag && (_jsxs("span", { style: {
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: 'var(--color-accent)',
                                            marginLeft: 6,
                                        }, children: ["\u00B7 ", combo.tag] }))] }), _jsxs("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 12.5,
                                    fontWeight: 600,
                                    color: 'var(--color-text-sec)',
                                    margin: '2px 0 0',
                                }, children: [combo.quantity, " p\u00E3es \u00B7", ' ', promoAtiva && combo.discount ? (_jsxs(_Fragment, { children: [_jsx("span", { style: { textDecoration: 'line-through', color: 'var(--color-text-ter)' }, children: formatBRL(combo.price) }), ' ', _jsx("span", { style: { color: 'var(--color-good)', fontWeight: 700 }, children: formatBRL(precoComDesconto(combo.price, combo.discount)) })] })) : (_jsx("span", { children: formatBRL(combo.price) }))] })] }), _jsx("button", { type: "button", "aria-label": `Editar combo ${combo.name}`, onClick: onEdit, style: {
                            width: 36,
                            height: 36,
                            borderRadius: 11,
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-surface)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            flexShrink: 0,
                        }, children: _jsx(Icon, { name: "edit", size: 17, color: "var(--color-text-sec)" }) })] }), _jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: '1px solid var(--color-border-2)',
                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx(Icon, { name: "percent", size: 17, color: "var(--color-text-sec)" }), _jsxs("span", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: 'var(--color-text-sec)',
                                }, children: ["Promo\u00E7\u00E3o ", combo.discount?.value ?? 15, "% OFF"] })] }), _jsx(SwitchToggle, { on: promoAtiva, onChange: onTogglePromo })] })] }));
}
function GoldBtn({ icon, onClick, children }) {
    return (_jsxs("button", { type: "button", onClick: onClick, style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            minHeight: 44,
            background: 'var(--color-gold)',
            color: 'var(--color-espresso)',
            border: 'none',
            borderRadius: 14,
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '-0.01em',
        }, children: [_jsx(Icon, { name: icon, size: 18, color: "var(--color-espresso)" }), children] }));
}
function SwitchToggle({ on, onChange }) {
    return (_jsx("button", { type: "button", role: "switch", "aria-checked": on, onClick: onChange, style: {
            width: 44,
            height: 26,
            borderRadius: 99,
            border: 'none',
            background: on ? 'var(--color-gold)' : 'var(--color-border)',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background 0.2s ease',
            flexShrink: 0,
            padding: 0,
        }, children: _jsx("span", { style: {
                position: 'absolute',
                top: 3,
                left: on ? 21 : 3,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            } }) }));
}
