import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../lib/apiFetch';
import { Icon } from '../../../components/brand/Icon';
import { EntregadorForm } from './EntregadorForm';
// ------------------------------------------------------------------ componente
export function AdminEntregadores({ onBack }) {
    const [sub, setSub] = useState(null);
    const [entregadores, setEntregadores] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const fetchEntregadores = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await apiFetch('/admin/couriers');
            if (res.ok) {
                setEntregadores((await res.json()));
            }
        }
        catch {
            // falha silenciosa
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    useEffect(() => {
        void fetchEntregadores();
    }, [fetchEntregadores]);
    if (sub === 'criar') {
        return (_jsx(EntregadorForm, { onBack: () => setSub(null), onSaved: () => {
                setSub(null);
                void fetchEntregadores();
            } }));
    }
    return (_jsxs("div", { style: { flex: 1, display: 'flex', flexDirection: 'column' }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 20px 14px',
                }, children: [_jsx("button", { type: "button", "aria-label": "Voltar", onClick: onBack, style: {
                            background: 'var(--color-surface-2)',
                            border: 'none',
                            width: 36,
                            height: 36,
                            borderRadius: 11,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            flexShrink: 0,
                        }, children: _jsx(Icon, { name: "arrowL", size: 18, color: "var(--color-text)" }) }), _jsx("h2", { style: {
                            fontFamily: 'var(--font-display)',
                            fontSize: 20,
                            fontWeight: 700,
                            letterSpacing: '-0.02em',
                            color: 'var(--color-text)',
                            margin: 0,
                            flex: 1,
                        }, children: "Entregadores" })] }), _jsxs("div", { style: { overflow: 'auto', flex: 1, padding: '0 20px 24px' }, children: [_jsx(GoldBtn, { icon: "plus", onClick: () => setSub('criar'), children: "Cadastrar entregador" }), isLoading ? (_jsx("div", { style: { paddingTop: 32, textAlign: 'center' }, children: _jsx("span", { style: { fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }, children: "Carregando..." }) })) : (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }, children: entregadores.map((e) => (_jsx(EntregadorCard, { entregador: e, onToggle: (newActive) => {
                                setEntregadores((prev) => prev.map((x) => (x.id === e.id ? { ...x, isBlocked: !newActive } : x)));
                            } }, e.id))) }))] })] }));
}
function EntregadorCard({ entregador: e, onToggle }) {
    const [localActive, setLocalActive] = useState(!e.isBlocked);
    const handleToggle = async () => {
        const prev = localActive;
        const next = !prev;
        setLocalActive(next);
        onToggle(next);
        try {
            await apiFetch(`/admin/couriers/${e.id}/toggle`, { method: 'PATCH' });
        }
        catch {
            setLocalActive(prev);
            onToggle(prev);
        }
    };
    return (_jsxs("div", { style: {
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-2)',
            borderRadius: 16,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12 }, children: [_jsx("div", { style: {
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            background: 'var(--color-surface-2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            opacity: localActive ? 1 : 0.5,
                            transition: 'opacity 0.2s ease',
                        }, children: _jsx(Icon, { name: "user", size: 22, color: "var(--color-accent)" }) }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: 'var(--color-text)',
                                    margin: 0,
                                    lineHeight: 1.3,
                                }, children: e.name }), _jsx("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: 'var(--color-text-ter)',
                                    margin: '2px 0 0',
                                }, children: localActive ? 'Ativo' : 'Desativado' })] }), _jsx(SwitchToggle, { on: localActive, onChange: () => void handleToggle() })] }), (e.cpf || e.phone) && (_jsxs("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: '1px solid var(--color-border-2)',
                }, children: [e.cpf && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx(Icon, { name: "card", size: 13, color: "var(--color-text-ter)" }), _jsx("span", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: 'var(--color-text-ter)',
                                }, children: e.cpf })] })), e.phone && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx(Icon, { name: "phone", size: 13, color: "var(--color-text-ter)" }), _jsx("span", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: 'var(--color-text-ter)',
                                }, children: e.phone })] }))] }))] }));
}
function GoldBtn({ icon, onClick, children }) {
    return (_jsxs("button", { type: "button", onClick: onClick, style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            minHeight: 44,
            background: 'var(--color-gold)',
            color: 'var(--color-espresso)',
            border: 'none',
            borderRadius: 14,
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '-0.01em',
        }, children: [_jsx(Icon, { name: icon, size: 18, color: "var(--color-espresso)" }), children] }));
}
function SwitchToggle({ on, onChange }) {
    return (_jsx("button", { type: "button", role: "switch", "aria-checked": on, onClick: onChange, style: {
            width: 44,
            height: 26,
            borderRadius: 99,
            border: 'none',
            background: on ? 'var(--color-gold)' : 'var(--color-border)',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background 0.2s ease',
            flexShrink: 0,
            padding: 0,
        }, children: _jsx("span", { style: {
                position: 'absolute',
                top: 3,
                left: on ? 21 : 3,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            } }) }));
}
