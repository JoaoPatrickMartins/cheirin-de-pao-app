import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function BarChart({ data, height = 96 }) {
    const max = Math.max(...data.map((d) => d.value), 1);
    return (_jsx("div", { style: {
            display: 'flex',
            alignItems: 'flex-end',
            gap: 8,
            height,
        }, children: data.map((item, i) => {
            const barHeight = Math.max((item.value / max) * (height - 20), 4);
            return (_jsxs("div", { style: {
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    height: '100%',
                    justifyContent: 'flex-end',
                }, children: [_jsx("div", { style: {
                            flex: 1,
                            display: 'flex',
                            alignItems: 'flex-end',
                            width: '100%',
                        }, children: _jsx("div", { style: {
                                width: '100%',
                                height: barHeight,
                                background: item.highlight ? 'var(--color-gold)' : 'var(--color-surface-2)',
                                borderRadius: 7,
                                transition: 'height 0.3s ease',
                            } }) }), _jsx("span", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 10.5,
                            fontWeight: 600,
                            color: 'var(--color-text-ter)',
                            lineHeight: 1,
                            whiteSpace: 'nowrap',
                        }, children: item.label })] }, i));
        }) }));
}
