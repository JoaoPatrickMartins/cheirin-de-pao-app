import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BreadMark } from '../brand/BreadMark';
export function AdminHead({ sub, titulo }) {
    return (_jsxs("div", { style: {
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '4px 20px 14px',
        }, children: [_jsx("div", { style: {
                    width: 42,
                    height: 42,
                    borderRadius: 13,
                    background: 'var(--color-espresso)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }, children: _jsx(BreadMark, { size: 27, color: "#E3AC3F" }) }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 1 }, children: [_jsx("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: 'var(--color-text-ter)',
                            margin: 0,
                            lineHeight: 1.2,
                        }, children: sub }), _jsx("h1", { style: {
                            fontFamily: 'var(--font-display)',
                            fontSize: 20,
                            fontWeight: 700,
                            letterSpacing: '-0.02em',
                            color: 'var(--color-text)',
                            margin: 0,
                            lineHeight: 1.2,
                        }, children: titulo })] })] }));
}
