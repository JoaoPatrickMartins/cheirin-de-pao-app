import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLocation, useNavigate } from 'react-router';
import { Icon } from '../../components/brand/Icon';
export function PurchasedScreen() {
    const navigate = useNavigate();
    const location = useLocation();
    const state = location.state;
    const quantity = state?.quantity ?? 0;
    return (_jsxs("div", { style: {
            minHeight: 'calc(100dvh - 56px - env(safe-area-inset-bottom))',
            background: 'var(--color-app-bg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            gap: 20,
        }, children: [_jsxs("div", { style: {
                    width: 96,
                    height: 96,
                    borderRadius: '30%',
                    background: 'var(--color-good-soft)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: 'scaleIn 250ms ease-out both',
                }, children: [_jsx("style", { children: `@keyframes scaleIn { from { transform: scale(0.8) } to { transform: scale(1) } }` }), _jsx(Icon, { name: "check", size: 48, color: "var(--color-good)", stroke: 2.4 })] }), _jsxs("div", { style: { textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }, children: [_jsx("h1", { style: {
                            fontFamily: 'var(--font-display)',
                            fontWeight: 700,
                            fontSize: 26,
                            color: 'var(--color-text)',
                            letterSpacing: '-0.03em',
                            margin: 0,
                        }, children: "Cr\u00E9ditos na conta!" }), _jsxs("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 15,
                            color: 'var(--color-text-sec)',
                            margin: 0,
                        }, children: ["+", quantity, " p\u00E3es adicionados. Agora \u00E9 s\u00F3 deixar a agenda no jeito."] })] }), _jsxs("div", { style: { width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }, children: [_jsxs("button", { onClick: () => navigate('/client/agenda'), style: {
                            width: '100%',
                            minHeight: 52,
                            borderRadius: 'var(--radius-btn)',
                            border: 'none',
                            background: 'var(--color-accent)',
                            color: 'var(--color-primary-btn-text)',
                            fontFamily: 'var(--font-display)',
                            fontWeight: 700,
                            fontSize: 16,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                        }, children: [_jsx(Icon, { name: "calendar", size: 20, color: "var(--color-primary-btn-text)" }), "Montar minha agenda"] }), _jsx("button", { onClick: () => navigate('/client/home'), style: {
                            width: '100%',
                            minHeight: 52,
                            borderRadius: 'var(--radius-btn)',
                            border: '1.5px solid var(--color-border)',
                            background: 'transparent',
                            color: 'var(--color-text)',
                            fontFamily: 'var(--font-display)',
                            fontWeight: 600,
                            fontSize: 16,
                            cursor: 'pointer',
                        }, children: "Voltar ao in\u00EDcio" })] })] }));
}
