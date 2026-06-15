import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const formatBRL = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export default function ComboCard({ combo, selected, onSelect }) {
    return (_jsxs("div", { role: "button", tabIndex: 0, onClick: onSelect, onKeyDown: (e) => e.key === 'Enter' && onSelect(), style: {
            position: 'relative',
            background: 'var(--color-surface)',
            borderRadius: 22,
            padding: 18,
            border: selected
                ? '2px solid var(--color-accent)'
                : '2px solid var(--color-border-2)',
            boxShadow: selected ? 'var(--shadow-strong)' : 'var(--shadow-soft)',
            transition: 'border-color .15s, box-shadow .15s',
            cursor: 'pointer',
            marginTop: combo.tag ? 10 : 0,
        }, children: [combo.tag && (_jsx("span", { style: {
                    position: 'absolute',
                    top: -10,
                    left: 18,
                    background: 'var(--color-gold)',
                    color: 'var(--color-espresso)',
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 999,
                    padding: '3px 10px',
                    fontFamily: 'var(--font-body)',
                }, children: combo.tag })), _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("p", { style: {
                                    fontFamily: 'var(--font-display)',
                                    fontWeight: 700,
                                    fontSize: 18,
                                    letterSpacing: '-0.02em',
                                    color: 'var(--color-text)',
                                    margin: 0,
                                }, children: combo.name }), _jsxs("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 13,
                                    color: 'var(--color-text-sec)',
                                    margin: '2px 0 0 0',
                                }, children: [combo.quantity, " p\u00E3es"] })] }), _jsxs("div", { style: { textAlign: 'right', marginRight: 12 }, children: [combo.antes !== undefined && combo.antes > combo.price && (_jsx("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 13,
                                    color: 'var(--color-text-ter)',
                                    textDecoration: 'line-through',
                                    margin: '0 0 2px 0',
                                }, children: formatBRL(combo.antes) })), _jsx("p", { style: {
                                    fontFamily: 'var(--font-display)',
                                    fontWeight: 800,
                                    fontSize: 22,
                                    color: selected ? 'var(--color-accent)' : 'var(--color-text)',
                                    margin: 0,
                                    transition: 'color .15s',
                                }, children: formatBRL(combo.price) })] }), _jsx("div", { style: {
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
                        }, children: selected && (_jsx("div", { style: {
                                width: 13,
                                height: 13,
                                borderRadius: '50%',
                                background: 'var(--color-accent)',
                            } })) })] })] }));
}
