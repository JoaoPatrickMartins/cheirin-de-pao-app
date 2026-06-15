import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from 'react-router';
import { BreadMark } from '../brand/BreadMark';
export function CreditBalanceCard({ creditBalance, isLoading = false }) {
    const navigate = useNavigate();
    return (_jsxs("div", { style: {
            borderRadius: 'var(--radius-card)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-soft)',
        }, children: [_jsxs("div", { style: {
                    background: 'linear-gradient(135deg, #1E1207, #2E1D0D)',
                    padding: '22px 22px 20px',
                    position: 'relative',
                    overflow: 'hidden',
                }, children: [_jsx("div", { style: {
                            position: 'absolute',
                            bottom: -50,
                            right: -30,
                            opacity: 0.1,
                            pointerEvents: 'none',
                        }, children: _jsx(BreadMark, { size: 200, color: "#E3AC3F" }) }), _jsx("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: '#C7B595',
                            letterSpacing: '0.04em',
                            margin: '0 0 8px',
                            textTransform: 'uppercase',
                        }, children: "SEUS CR\u00C9DITOS" }), isLoading ? (_jsx("div", { style: {
                            width: 120,
                            height: 52,
                            borderRadius: 8,
                            background: 'rgba(255,255,255,0.15)',
                        } })) : (_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 8,
                        }, children: [_jsx("span", { "data-testid": "credit-balance", style: {
                                    fontFamily: 'var(--font-display)',
                                    fontWeight: 800,
                                    fontSize: 52,
                                    color: '#FAF5EC',
                                    lineHeight: 1,
                                    letterSpacing: '-0.03em',
                                }, children: creditBalance }), _jsx("span", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontWeight: 700,
                                    fontSize: 16,
                                    color: '#E3AC3F',
                                    lineHeight: 1,
                                }, children: "p\u00E3es" })] })), !isLoading && creditBalance > 0 && (_jsxs("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 12.5,
                            color: '#9A876B',
                            margin: '8px 0 0',
                        }, children: ["Rende ~", Math.floor(creditBalance), " dias no seu ritmo atual"] })), !isLoading && creditBalance === 0 && (_jsx("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 12.5,
                            color: '#9A876B',
                            margin: '8px 0 0',
                        }, children: "Adicione cr\u00E9ditos para come\u00E7ar" }))] }), _jsxs("div", { style: {
                    background: 'var(--color-surface)',
                    padding: '12px',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                }, children: [_jsx("button", { onClick: () => navigate('/client/creditos'), style: {
                            flex: 1,
                            minHeight: 44,
                            background: 'var(--color-gold)',
                            color: 'var(--color-espresso)',
                            borderRadius: 'var(--radius-btn)',
                            fontFamily: 'var(--font-body)',
                            fontSize: 15,
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: '13px 18px',
                            transition: 'transform 0.15s, filter 0.15s',
                        }, children: "Comprar cr\u00E9ditos" }), _jsx("button", { onClick: () => navigate('/client/creditos/extrato'), style: {
                            flexShrink: 0,
                            minHeight: 44,
                            background: 'var(--color-surface-2)',
                            color: 'var(--color-text)',
                            borderRadius: 'var(--radius-btn)',
                            fontFamily: 'var(--font-body)',
                            fontSize: 15,
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: '13px 18px',
                            transition: 'transform 0.15s, filter 0.15s',
                        }, children: "Extrato" })] })] }));
}
