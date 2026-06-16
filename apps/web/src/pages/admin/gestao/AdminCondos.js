import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../lib/apiFetch';
import { Icon } from '../../../components/brand/Icon';
import { CondoForm } from './CondoForm';
// ------------------------------------------------------------------ helpers
function tipoLabel(tipo) {
    return tipo === 'SINGLE_ENTRANCE' ? 'Entrada única' : 'Blocos/Torres';
}
// ------------------------------------------------------------------ componente
export function AdminCondos({ onBack }) {
    const [sub, setSub] = useState(null);
    const [editId, setEditId] = useState(null);
    const [condos, setCondos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const fetchCondos = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await apiFetch('/admin/condominiums');
            if (res.ok) {
                setCondos((await res.json()));
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
        void fetchCondos();
    }, [fetchCondos]);
    if (sub === 'criar') {
        return (_jsx(CondoForm, { onBack: () => setSub(null), onSaved: () => {
                setSub(null);
                void fetchCondos();
            } }));
    }
    if (sub === 'editar' && editId) {
        return (_jsx(CondoForm, { id: editId, onBack: () => setSub(null), onSaved: () => {
                setSub(null);
                void fetchCondos();
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
                        }, children: "Condom\u00EDnios" })] }), _jsxs("div", { style: { overflow: 'auto', flex: 1, padding: '0 20px 24px' }, children: [_jsx(GoldBtn, { icon: "plus", onClick: () => setSub('criar'), children: "Adicionar condom\u00EDnio" }), isLoading ? (_jsx("div", { style: { paddingTop: 32, textAlign: 'center' }, children: _jsx("span", { style: { fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }, children: "Carregando..." }) })) : (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }, children: condos.map((c) => (_jsx(CondoCard, { condo: c, onClick: () => {
                                setEditId(c.id);
                                setSub('editar');
                            } }, c.id))) }))] })] }));
}
function CondoCard({ condo: c, onClick }) {
    const clienteCount = c._count?.users ?? 0;
    return (_jsxs("button", { type: "button", onClick: onClick, style: {
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-2)',
            borderRadius: 16,
            padding: 16,
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%',
        }, children: [_jsx("div", { style: {
                    width: 44,
                    height: 44,
                    borderRadius: 13,
                    background: 'var(--color-surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }, children: _jsx(Icon, { name: "building", size: 22, color: "var(--color-accent)" }) }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 15,
                            fontWeight: 700,
                            color: 'var(--color-text)',
                            margin: 0,
                            lineHeight: 1.3,
                            textAlign: 'left',
                        }, children: c.name }), _jsxs("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 12.5,
                            fontWeight: 500,
                            color: 'var(--color-text-ter)',
                            margin: '2px 0 0',
                            textAlign: 'left',
                        }, children: [tipoLabel(c.type), c.type === 'BLOCKS' && c.numBlocks ? ` · ${c.numBlocks} blocos` : '', clienteCount > 0 ? ` · ${clienteCount} cliente${clienteCount !== 1 ? 's' : ''}` : ''] })] }), _jsx(Icon, { name: "chevR", size: 18, color: "var(--color-text-ter)" })] }));
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
