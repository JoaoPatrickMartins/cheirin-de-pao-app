import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BreadMark } from '../brand/BreadMark';
export function ProgressCard({ confirmed, total, totalBreads, confirmedBreads }) {
    const pct = total > 0 ? (confirmed / total) * 100 : 0;
    return (_jsxs("div", { style: {
            position: 'relative',
            background: '#1E1207',
            borderRadius: 22,
            overflow: 'hidden',
            padding: '16px 20px',
        }, children: [_jsx("div", { style: {
                    position: 'absolute',
                    bottom: -40,
                    right: -16,
                    opacity: 0.12,
                    pointerEvents: 'none',
                }, children: _jsx(BreadMark, { size: 130, color: "#E3AC3F" }) }), _jsxs("div", { style: { display: 'flex', flexDirection: 'row', gap: 16, position: 'relative' }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: '#E3AC3F',
                                    letterSpacing: '0.06em',
                                    textTransform: 'uppercase',
                                    margin: '0 0 4px',
                                }, children: "PROGRESSO" }), _jsxs("p", { style: {
                                    fontFamily: 'var(--font-display)',
                                    fontWeight: 800,
                                    fontSize: 26,
                                    color: '#FAF5EC',
                                    letterSpacing: '-0.02em',
                                    lineHeight: 1,
                                    margin: 0,
                                }, children: [confirmed, "/", total, " ", total === 1 ? 'parada' : 'paradas'] })] }), _jsxs("div", { style: { textAlign: 'right' }, children: [_jsx("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: '#C7B595',
                                    margin: '0 0 4px',
                                }, children: "Total de p\u00E3es" }), _jsxs("p", { style: {
                                    fontFamily: 'var(--font-display)',
                                    fontWeight: 800,
                                    fontSize: 26,
                                    color: '#E3AC3F',
                                    letterSpacing: '-0.02em',
                                    lineHeight: 1,
                                    margin: 0,
                                }, children: [confirmedBreads, "/", totalBreads] })] })] }), _jsx("div", { style: {
                    marginTop: 12,
                    height: 6,
                    borderRadius: 99,
                    background: 'var(--color-surface-2)',
                    overflow: 'hidden',
                }, children: _jsx("div", { style: {
                        height: '100%',
                        width: `${pct}%`,
                        background: '#E3AC3F',
                        borderRadius: 99,
                        transition: 'width 0.3s ease',
                    } }) })] }));
}
