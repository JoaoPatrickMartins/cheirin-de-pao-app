import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function StepperInline({ min, max, value, onChange }) {
    const atMin = value <= min;
    const atMax = value >= max;
    const btnStyle = (disabled) => ({
        width: 34,
        height: 34,
        minHeight: 34,
        borderRadius: 11,
        border: '1.5px solid var(--color-border)',
        background: 'var(--color-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        fontSize: 18,
        fontWeight: 700,
        color: 'var(--color-espresso)',
        flexShrink: 0,
    });
    return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12 }, children: [_jsx("button", { "aria-label": "diminuir", disabled: atMin, style: btnStyle(atMin), onClick: () => { if (!atMin)
                    onChange(value - 1); }, children: "\u2212" }), _jsx("span", { style: {
                    fontFamily: 'var(--font-display)',
                    fontSize: 18,
                    fontWeight: 800,
                    color: value > 0 ? 'var(--color-accent)' : 'var(--color-text-ter)',
                    minWidth: 24,
                    textAlign: 'center',
                }, children: value }), _jsx("button", { "aria-label": "aumentar", disabled: atMax, style: btnStyle(atMax), onClick: () => { if (!atMax)
                    onChange(value + 1); }, children: "+" })] }));
}
