import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { apiFetch } from '../../lib/apiFetch';
import { Icon } from '../../components/brand/Icon';
function getTone(type) {
    if (['DELIVERY_EVE', 'DELIVERY_DONE', 'OUT_FOR_DELIVERY'].includes(type))
        return 'good';
    if (['LOW_CREDIT'].includes(type))
        return 'gold';
    return 'neutral';
}
function getIcon(type) {
    if (type === 'DELIVERY_EVE')
        return 'bell';
    if (type === 'DELIVERY_DONE')
        return 'check';
    if (type === 'OUT_FOR_DELIVERY')
        return 'truck';
    if (type === 'LOW_CREDIT')
        return 'alert';
    return 'repeat';
}
const TONE_ICON_STYLES = {
    good: { icon: 'var(--color-good)', bg: 'var(--color-good-soft)' },
    gold: { icon: 'var(--color-accent)', bg: 'var(--color-gold-soft)' },
    neutral: { icon: 'var(--color-text-sec)', bg: 'var(--color-surface-2)' },
};
const CTA_CONFIG = {
    LOW_CREDIT: { label: 'Comprar créditos', path: '/client/creditos' },
    DELIVERY_DONE: { label: 'Acompanhar', path: '/client/pedidos' },
    RECONFIGURE: { label: 'Ajustar agenda', path: '/client/agenda' },
};
function formatTimestamp(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffH = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffH < 1)
        return 'agora';
    if (diffH < 24)
        return `${diffH}h atrás`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7)
        return `${diffD}d atrás`;
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date);
}
export function NotificationsScreen() {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRead, setIsRead] = useState(false);
    useEffect(() => {
        const load = async () => {
            try {
                const res = await apiFetch('/notifications/me');
                if (res.ok) {
                    setNotifications((await res.json()));
                }
            }
            catch {
                // mantém lista vazia
            }
            finally {
                setIsLoading(false);
            }
            apiFetch('/notifications/read-all', { method: 'PATCH' })
                .then(() => setIsRead(true))
                .catch(() => { });
        };
        void load();
    }, []);
    return (_jsxs("div", { style: {
            minHeight: 'calc(100dvh - 56px - env(safe-area-inset-bottom))',
            background: 'var(--color-app-bg)',
        }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px 20px 14px',
                    gap: 12,
                }, children: [_jsx("button", { onClick: () => navigate(-1), "aria-label": "Voltar", style: {
                            width: 40,
                            height: 40,
                            borderRadius: 12,
                            background: 'var(--color-surface-2)',
                            border: 'none',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            flexShrink: 0,
                        }, children: _jsx(Icon, { name: "arrowL", size: 20 }) }), _jsx("h1", { style: {
                            fontFamily: 'var(--font-display)',
                            fontWeight: 700,
                            fontSize: 21,
                            color: 'var(--color-text)',
                            letterSpacing: '-0.02em',
                            margin: 0,
                        }, children: "Notifica\u00E7\u00F5es" })] }), _jsxs("div", { style: { padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }, children: [isLoading && (_jsx(_Fragment, { children: [1, 2, 3].map((n) => (_jsx("div", { style: { height: 80, borderRadius: 'var(--radius-card)', background: 'var(--color-surface-2)' } }, n))) })), !isLoading && notifications.length === 0 && (_jsxs("div", { style: { textAlign: 'center', paddingTop: 48 }, children: [_jsx(Icon, { name: "bell", size: 48, color: "var(--color-text-ter)" }), _jsx("p", { style: {
                                    fontFamily: 'var(--font-display)',
                                    fontWeight: 700,
                                    fontSize: 16,
                                    color: 'var(--color-text-sec)',
                                    margin: '12px 0 6px',
                                }, children: "Tudo tranquilo por aqui" }), _jsx("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 13,
                                    color: 'var(--color-text-ter)',
                                    lineHeight: 1.5,
                                    margin: 0,
                                }, children: "As notifica\u00E7\u00F5es sobre suas entregas e cr\u00E9ditos aparecem aqui." })] })), !isLoading &&
                        notifications.map((n) => {
                            const tone = getTone(n.type);
                            const iconName = getIcon(n.type);
                            const { icon: iconColor, bg: iconBg } = TONE_ICON_STYLES[tone];
                            const cta = CTA_CONFIG[n.type];
                            const read = isRead || n.isRead;
                            return (_jsxs("div", { "aria-label": `${n.title}: ${n.body}`, style: {
                                    background: 'var(--color-surface)',
                                    borderRadius: 'var(--radius-card)',
                                    padding: 15,
                                    border: read
                                        ? '1px solid var(--color-border-2)'
                                        : '1.5px solid var(--color-accent)',
                                    display: 'flex',
                                    gap: 13,
                                    position: 'relative',
                                }, children: [_jsx("div", { style: {
                                            width: 42,
                                            height: 42,
                                            borderRadius: 12,
                                            background: iconBg,
                                            display: 'grid',
                                            placeItems: 'center',
                                            flexShrink: 0,
                                        }, children: _jsx(Icon, { name: iconName, size: 20, color: iconColor }) }), _jsxs("div", { style: { flex: 1 }, children: [_jsxs("div", { style: {
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    justifyContent: 'space-between',
                                                    gap: 8,
                                                }, children: [_jsx("p", { style: {
                                                            fontFamily: 'var(--font-body)',
                                                            fontWeight: 700,
                                                            fontSize: 14.5,
                                                            color: 'var(--color-text)',
                                                            margin: 0,
                                                            lineHeight: 1.25,
                                                        }, children: n.title }), _jsx("span", { style: {
                                                            fontFamily: 'var(--font-body)',
                                                            fontSize: 11,
                                                            fontWeight: 600,
                                                            color: 'var(--color-text-ter)',
                                                            flexShrink: 0,
                                                            marginTop: 2,
                                                        }, children: formatTimestamp(n.createdAt) })] }), _jsx("p", { style: {
                                                    fontFamily: 'var(--font-body)',
                                                    fontSize: 13,
                                                    color: 'var(--color-text-sec)',
                                                    margin: '3px 0 0',
                                                    lineHeight: 1.45,
                                                }, children: n.body }), cta && (_jsx("button", { onClick: () => navigate(cta.path), style: {
                                                    marginTop: 10,
                                                    borderRadius: 11,
                                                    padding: '8px 14px',
                                                    fontFamily: 'var(--font-body)',
                                                    fontWeight: 700,
                                                    fontSize: 13,
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    background: tone === 'gold' ? 'var(--color-gold)' : 'var(--color-surface-2)',
                                                    color: tone === 'gold' ? 'var(--color-app-bg)' : 'var(--color-text)',
                                                }, children: cta.label }))] })] }, n.id));
                        })] })] }));
}
