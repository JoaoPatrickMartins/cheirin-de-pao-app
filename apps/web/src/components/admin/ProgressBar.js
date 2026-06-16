import { jsx as _jsx } from "react/jsx-runtime";
export function ProgressBar({ value, max, color }) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    const fillColor = color ?? (pct >= 100 ? 'var(--color-good)' : 'var(--color-gold)');
    return (_jsx("div", { style: {
            height: 7,
            borderRadius: 99,
            overflow: 'hidden',
            background: 'var(--color-surface-2)',
            width: '100%',
        }, children: _jsx("div", { style: {
                height: '100%',
                width: `${pct}%`,
                background: fillColor,
                borderRadius: 99,
                transition: 'width 0.3s ease',
            } }) }));
}
