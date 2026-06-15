import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Icon } from '../brand/Icon';
import { StopRow } from './StopRow';
export function CondoAccordion({ condo, order, isOpen, onToggle, confirmedIds, onConfirm, }) {
    const feitas = condo.stops.filter((s) => confirmedIds.has(s.orderId)).length;
    const total = condo.stops.length;
    const isAllDone = feitas === total && total > 0;
    return (_jsxs("div", { style: {
            borderRadius: 22,
            boxShadow: 'var(--shadow-soft)',
            overflow: 'hidden',
            background: 'var(--color-surface)',
        }, children: [_jsxs("button", { onClick: onToggle, "aria-expanded": isOpen, style: {
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    minHeight: 44,
                    textAlign: 'left',
                }, children: [_jsx("div", { style: {
                            width: 36,
                            height: 36,
                            borderRadius: 12,
                            background: 'var(--color-gold)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }, children: _jsx("span", { style: {
                                fontFamily: 'var(--font-display)',
                                fontSize: 15,
                                fontWeight: 800,
                                color: 'var(--color-espresso)',
                            }, children: order }) }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("p", { style: {
                                    fontFamily: 'var(--font-display)',
                                    fontSize: 18,
                                    fontWeight: 700,
                                    color: 'var(--color-text)',
                                    letterSpacing: '-0.02em',
                                    margin: 0,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }, children: condo.condominiumName }), _jsx("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: 'var(--color-text-ter)',
                                    margin: 0,
                                }, children: total === 1 ? '1 parada' : `${total} paradas` })] }), isAllDone ? (_jsxs("div", { style: {
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            borderRadius: 99,
                            background: 'var(--color-good-soft)',
                            color: 'var(--color-good)',
                            fontFamily: 'var(--font-body)',
                            fontSize: 12,
                            fontWeight: 700,
                            flexShrink: 0,
                        }, children: [_jsx(Icon, { name: "check", size: 13, color: "var(--color-good)" }), "Ok"] })) : (_jsxs("div", { style: {
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 8px',
                            borderRadius: 99,
                            background: 'var(--color-gold-soft)',
                            color: 'var(--color-accent)',
                            fontFamily: 'var(--font-body)',
                            fontSize: 12,
                            fontWeight: 700,
                            flexShrink: 0,
                        }, children: [feitas, "/", total] })), _jsx("div", { style: {
                            flexShrink: 0,
                            transform: `rotate(${isOpen ? 180 : 0}deg)`,
                            transition: 'transform 0.2s',
                        }, children: _jsx(Icon, { name: "chevD", size: 18, color: "var(--color-text-ter)" }) })] }), isOpen && (_jsxs("div", { style: { borderTop: '1px solid var(--color-border-2)' }, children: [_jsx("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 12,
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            color: 'var(--color-text-ter)',
                            padding: '8px 16px 4px',
                            margin: 0,
                            textTransform: 'uppercase',
                        }, children: "ORDEM SUGERIDA NO PR\u00C9DIO" }), condo.stops.map((stop, idx) => (_jsx(StopRow, { stop: stop, order: idx + 1, isConfirmed: confirmedIds.has(stop.orderId), onPress: onConfirm }, stop.orderId)))] }))] }));
}
