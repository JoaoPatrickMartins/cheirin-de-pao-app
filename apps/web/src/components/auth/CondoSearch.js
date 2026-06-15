import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Icon } from '../brand/Icon';
/**
 * Searchable condominium list with empty state.
 * Filters by name (case-insensitive). Shows empty state when no condos match.
 */
export function CondoSearch({ condos, selectedId, onSelect }) {
    const [query, setQuery] = useState('');
    const [focused, setFocused] = useState(false);
    const filtered = condos.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
    const isEmpty = filtered.length === 0;
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }, children: [_jsx("label", { style: { display: 'block' }, children: _jsxs("div", { style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        background: 'var(--color-surface-alt)',
                        border: `1.5px solid ${focused ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        borderRadius: 'var(--radius-field)',
                        padding: '12px 14px',
                        transition: 'border-color 0.15s ease',
                    }, children: [_jsx(Icon, { name: "building", size: 18, color: "var(--color-text-ter)" }), _jsx("input", { type: "text", value: query, onChange: (e) => setQuery(e.target.value), onFocus: () => setFocused(true), onBlur: () => setFocused(false), placeholder: "Buscar condom\u00EDnio", style: {
                                flex: 1,
                                border: 'none',
                                outline: 'none',
                                background: 'transparent',
                                fontSize: 15,
                                fontFamily: 'var(--font-body)',
                                fontWeight: 400,
                                color: 'var(--color-text)',
                                minWidth: 0,
                            } })] }) }), _jsx("div", { style: {
                    flex: 1,
                    overflowY: 'auto',
                    marginTop: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                }, children: isEmpty ? (
                /* Empty state */
                _jsxs("div", { style: {
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        padding: '24px 16px',
                    }, children: [_jsx(Icon, { name: "building", size: 28, color: "var(--color-text-ter)" }), _jsxs("p", { style: {
                                fontSize: 12,
                                fontFamily: 'var(--font-body)',
                                fontWeight: 700,
                                color: 'var(--color-text-ter)',
                                lineHeight: 1.5,
                                marginTop: 10,
                            }, children: ["Seu condom\u00EDnio ainda n\u00E3o \u00E9 parceiro.", _jsx("br", {}), "Avise a gente que levamos o cheirin at\u00E9 a\u00ED!"] })] })) : (filtered.map((condo) => {
                    const isSelected = selectedId === condo.id;
                    const typeLabel = condo.type === 'BLOCKS' ? 'blocos/torres' : 'entrada única';
                    return (_jsxs("div", { role: "button", tabIndex: 0, onClick: () => onSelect(condo.id), onKeyDown: (e) => e.key === 'Enter' && onSelect(condo.id), style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: 13,
                            padding: 16,
                            borderRadius: 'var(--radius-card)',
                            border: `1.5px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                            background: 'var(--color-surface)',
                            cursor: 'pointer',
                            boxShadow: 'var(--shadow-soft)',
                        }, children: [_jsx("div", { style: {
                                    width: 42,
                                    height: 42,
                                    borderRadius: 12,
                                    background: 'var(--color-surface-2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }, children: _jsx(Icon, { name: "building", size: 20, color: "var(--color-accent)" }) }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontWeight: 700,
                                            fontSize: 15,
                                            color: 'var(--color-text)',
                                        }, children: condo.name }), _jsxs("div", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 12,
                                            color: 'var(--color-text-ter)',
                                            marginTop: 1,
                                        }, children: [condo.neighborhood, " \u00B7 ", typeLabel] })] }), isSelected && (_jsx(Icon, { name: "check", size: 20, color: "var(--color-accent)" }))] }, condo.id));
                })) })] }));
}
