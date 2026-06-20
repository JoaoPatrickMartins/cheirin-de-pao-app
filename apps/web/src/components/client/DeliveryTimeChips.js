import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function DeliveryTimeChips({ slots, value, onChange }) {
    return (_jsxs("div", { children: [_jsx("p", { style: {
                    fontFamily: 'var(--font-body)',
                    fontWeight: 700,
                    fontSize: 12.5,
                    color: 'var(--color-text-sec)',
                    margin: '0 0 9px 0',
                }, children: "Hor\u00E1rio de entrega" }), _jsx("div", { style: {
                    display: 'flex',
                    gap: 9,
                    marginBottom: 18,
                }, children: slots.map((slot) => {
                    const isActive = value === slot.time;
                    return (_jsx("button", { onClick: () => onChange(slot.time), style: {
                            flex: 1,
                            padding: '11px 0',
                            borderRadius: 13,
                            border: isActive
                                ? '1.5px solid var(--color-accent)'
                                : '1.5px solid var(--color-border)',
                            background: isActive ? 'var(--color-gold-soft)' : 'var(--color-surface)',
                            color: isActive ? 'var(--color-accent)' : 'var(--color-text)',
                            fontFamily: 'var(--font-body)',
                            fontWeight: 700,
                            fontSize: 14,
                            cursor: 'pointer',
                            transition: 'background .15s, border-color .15s, color .15s',
                            minHeight: 44,
                        }, children: slot.time }, slot.name));
                }) })] }));
}
