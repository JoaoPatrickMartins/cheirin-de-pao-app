import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Icon } from '../brand/Icon';
function Pill({ text, tone }) {
    const styles = {
        good: { bg: 'var(--color-good-soft)', color: 'var(--color-good)' },
        gold: { bg: 'var(--color-gold-soft)', color: '#8A6A00' },
        neutral: { bg: 'var(--color-surface-2)', color: 'var(--color-text-sec)' },
    };
    const s = styles[tone];
    return (_jsx("span", { style: {
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 8px',
            borderRadius: 99,
            background: s.bg,
            color: s.color,
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            fontWeight: 700,
            whiteSpace: 'nowrap',
        }, children: text }));
}
export function KpiCard({ icon, value, label, pill }) {
    return (_jsxs("div", { style: {
            background: 'var(--color-surface)',
            borderRadius: 22,
            padding: 16,
            border: '1px solid var(--color-border-2)',
        }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }, children: [_jsx(Icon, { name: icon, size: 20, color: "var(--color-accent)", stroke: 2 }), pill && _jsx(Pill, { text: pill.text, tone: pill.tone })] }), _jsx("p", { style: {
                    fontFamily: 'var(--font-display)',
                    fontSize: 26,
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    color: 'var(--color-text)',
                    margin: '12px 0 0',
                    lineHeight: 1,
                }, children: value }), _jsx("p", { style: {
                    fontFamily: 'var(--font-body)',
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: 'var(--color-text-sec)',
                    margin: '4px 0 0',
                    lineHeight: 1.2,
                }, children: label })] }));
}
