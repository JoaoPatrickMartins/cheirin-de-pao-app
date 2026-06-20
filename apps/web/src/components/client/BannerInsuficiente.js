import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Icon } from '../brand/Icon';
export default function BannerInsuficiente({ saldo, requerido, onComprar, onAjustar, hideAjustar = false, }) {
    if (requerido <= saldo)
        return null;
    return (_jsxs("div", { style: {
            background: 'var(--color-gold-soft)',
            border: '1.5px solid var(--color-gold)',
            borderRadius: 16,
            padding: 13,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'flex-start', gap: 8 }, children: [_jsx(Icon, { name: "alert", size: 20, color: "var(--color-accent)" }), _jsxs("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 14,
                            color: 'var(--color-text)',
                            margin: 0,
                        }, children: ["Voc\u00EA tem ", _jsx("strong", { children: saldo }), " cr\u00E9ditos e precisa de", ' ', _jsx("strong", { children: requerido }), ". Compre mais ou ajuste a quantidade."] })] }), _jsxs("div", { style: { display: 'flex', gap: 10 }, children: [_jsx("button", { onClick: onComprar, style: {
                            minHeight: 44,
                            padding: '8px 16px',
                            borderRadius: 'var(--radius-btn)',
                            border: '1.5px solid var(--color-gold)',
                            background: 'var(--color-gold)',
                            color: 'var(--color-espresso)',
                            fontFamily: 'var(--font-body)',
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: 'pointer',
                        }, children: "Comprar mais" }), !hideAjustar && (_jsxs("button", { onClick: () => onAjustar(saldo), style: {
                            minHeight: 44,
                            padding: '8px 16px',
                            borderRadius: 'var(--radius-btn)',
                            border: '1.5px solid var(--color-border)',
                            background: 'transparent',
                            color: 'var(--color-text)',
                            fontFamily: 'var(--font-body)',
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: 'pointer',
                        }, children: ["Usar ", saldo] }))] })] }));
}
