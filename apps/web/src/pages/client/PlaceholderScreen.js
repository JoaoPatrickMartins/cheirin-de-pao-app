import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLocation } from 'react-router';
import { Icon } from '../../components/brand/Icon';
function detectIcon(pathname) {
    if (pathname.includes('agenda'))
        return 'calendar';
    return 'bag';
}
function detectTitle(pathname) {
    if (pathname.includes('agenda'))
        return 'Agenda';
    if (pathname.includes('pedidos'))
        return 'Pedidos';
    return 'Em breve';
}
export function PlaceholderScreen() {
    const location = useLocation();
    const icon = detectIcon(location.pathname);
    const title = detectTitle(location.pathname);
    return (_jsxs("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 'calc(100dvh - 56px - env(safe-area-inset-bottom))',
            padding: 32,
            textAlign: 'center',
        }, children: [_jsx(Icon, { name: icon, size: 48, stroke: 1.5, color: "var(--color-text-ter)" }), _jsx("h2", { style: {
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 20,
                    color: 'var(--color-text-sec)',
                    margin: '16px 0 8px',
                    letterSpacing: '-0.02em',
                }, children: title }), _jsx("p", { style: {
                    fontFamily: 'var(--font-body)',
                    fontSize: 14,
                    color: 'var(--color-text-ter)',
                    lineHeight: 1.5,
                    margin: 0,
                    maxWidth: 260,
                }, children: "Em breve \u2014 dispon\u00EDvel na pr\u00F3xima atualiza\u00E7\u00E3o" })] }));
}
