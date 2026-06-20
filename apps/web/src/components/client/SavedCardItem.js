import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Icon } from '../brand/Icon';
function renderBrandIcon(brand) {
    const b = brand.toLowerCase();
    if (b === 'visa') {
        return (_jsx("span", { style: {
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 12,
                color: '#1A1F71',
                background: 'var(--color-surface-2)',
                borderRadius: 4,
                padding: '2px 6px',
                letterSpacing: '0.02em',
                lineHeight: 1,
            }, children: "VISA" }));
    }
    if (b === 'master' || b === 'mastercard') {
        return (_jsxs("svg", { width: "32", height: "20", viewBox: "0 0 32 20", fill: "none", xmlns: "http://www.w3.org/2000/svg", children: [_jsx("circle", { cx: "10", cy: "10", r: "10", fill: "#EB001B" }), _jsx("circle", { cx: "22", cy: "10", r: "10", fill: "#F79E1B", opacity: "0.9" })] }));
    }
    if (b === 'elo') {
        return (_jsx("span", { style: {
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 12,
                color: 'var(--color-text)',
                background: 'var(--color-surface-2)',
                borderRadius: 4,
                padding: '2px 6px',
                letterSpacing: '0.02em',
                lineHeight: 1,
            }, children: "ELO" }));
    }
    // Outros: usar texto uppercase se reconhecível ou ícone genérico
    if (brand && brand.length > 0) {
        return (_jsx("span", { style: {
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 11,
                color: 'var(--color-text)',
                background: 'var(--color-surface-2)',
                borderRadius: 4,
                padding: '2px 6px',
                letterSpacing: '0.02em',
                lineHeight: 1,
                textTransform: 'uppercase',
            }, children: brand.slice(0, 6) }));
    }
    return _jsx(Icon, { name: "card", size: 20, color: "var(--color-text-ter)" });
}
export function SavedCardItem({ card, mode, selected = false, onSelect, onSetDefault, onRemove, isRemoving = false, }) {
    if (mode === 'select') {
        return (_jsxs("div", { role: "radio", "aria-checked": selected, tabIndex: 0, onClick: () => onSelect?.(card.id), onKeyDown: (e) => (e.key === 'Enter' || e.key === ' ') && onSelect?.(card.id), style: {
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                minHeight: 64,
                padding: 16,
                borderRadius: 22,
                background: 'var(--color-surface)',
                border: selected
                    ? '2px solid var(--color-accent)'
                    : '2px solid var(--color-border-2)',
                boxShadow: selected ? 'var(--shadow-strong)' : 'var(--shadow-soft)',
                cursor: 'pointer',
                transition: 'border 150ms ease-out, box-shadow 150ms ease-out',
                boxSizing: 'border-box',
            }, children: [_jsx("div", { style: { display: 'flex', alignItems: 'center', width: 36, flexShrink: 0 }, children: renderBrandIcon(card.brand) }), _jsxs("div", { style: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }, children: [_jsxs("span", { style: {
                                fontFamily: 'var(--font-body)',
                                fontSize: 15,
                                fontWeight: 400,
                                color: 'var(--color-text)',
                            }, children: ["\u2022\u2022\u2022\u2022 ", card.lastFour] }), _jsx("span", { style: {
                                fontFamily: 'var(--font-body)',
                                fontSize: 12.5,
                                color: 'var(--color-text-sec)',
                            }, children: card.expiresAt })] }), _jsx("div", { style: {
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        border: selected
                            ? '2px solid var(--color-accent)'
                            : '2px solid var(--color-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'border 150ms ease-out, background 150ms ease-out',
                    }, children: selected && (_jsx("div", { style: {
                            width: 13,
                            height: 13,
                            borderRadius: '50%',
                            background: 'var(--color-accent)',
                        } })) })] }));
    }
    // mode === 'manage'
    return (_jsxs("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: '12px 0',
        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, flex: 1 }, children: [_jsx("div", { style: { display: 'flex', alignItems: 'center', width: 36, flexShrink: 0 }, children: renderBrandIcon(card.brand) }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 2 }, children: [_jsxs("span", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 15,
                                            color: 'var(--color-text)',
                                        }, children: ["\u2022\u2022\u2022\u2022 ", card.lastFour] }), _jsx("span", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 12.5,
                                            color: 'var(--color-text-sec)',
                                        }, children: card.expiresAt })] })] }), _jsx("div", { children: card.isDefault ? (_jsx("span", { style: {
                                background: 'var(--color-good-soft)',
                                color: 'var(--color-good)',
                                borderRadius: 999,
                                fontSize: 12.5,
                                fontWeight: 600,
                                padding: '4px 10px',
                                fontFamily: 'var(--font-body)',
                                whiteSpace: 'nowrap',
                            }, children: "Padr\u00E3o" })) : (_jsx("button", { onClick: () => onSetDefault?.(card.id), style: {
                                background: 'none',
                                border: 'none',
                                color: 'var(--color-accent)',
                                fontFamily: 'var(--font-body)',
                                fontSize: 12.5,
                                fontWeight: 600,
                                cursor: 'pointer',
                                padding: 0,
                                minHeight: 44,
                                display: 'flex',
                                alignItems: 'center',
                                whiteSpace: 'nowrap',
                            }, children: "Definir como padr\u00E3o" })) })] }), _jsx("div", { children: _jsx("button", { onClick: () => !isRemoving && onRemove?.(card.id), disabled: isRemoving, style: {
                        background: 'none',
                        border: 'none',
                        color: isRemoving ? 'var(--color-text-ter)' : '#C0392B',
                        fontFamily: 'var(--font-body)',
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: isRemoving ? 'default' : 'pointer',
                        padding: 0,
                        minHeight: 44,
                        display: 'flex',
                        alignItems: 'center',
                    }, children: isRemoving ? 'Removendo...' : 'Remover' }) })] }));
}
