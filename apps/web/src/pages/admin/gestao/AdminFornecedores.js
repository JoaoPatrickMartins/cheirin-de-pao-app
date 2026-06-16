import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../lib/apiFetch';
import { Icon } from '../../../components/brand/Icon';
import { FornecedorForm } from './FornecedorForm';
// ------------------------------------------------------------------ helpers
function formatBRL(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}
// ------------------------------------------------------------------ componente
export function AdminFornecedores({ onBack }) {
    const [sub, setSub] = useState(null);
    const [editId, setEditId] = useState(null);
    const [fornecedores, setFornecedores] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const fetchFornecedores = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await apiFetch('/admin/suppliers');
            if (res.ok) {
                setFornecedores((await res.json()));
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
        void fetchFornecedores();
    }, [fetchFornecedores]);
    if (sub === 'criar') {
        return (_jsx(FornecedorForm, { onBack: () => setSub(null), onSaved: () => {
                setSub(null);
                void fetchFornecedores();
            } }));
    }
    if (sub === 'editar' && editId) {
        return (_jsx(FornecedorForm, { id: editId, onBack: () => setSub(null), onSaved: () => {
                setSub(null);
                void fetchFornecedores();
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
                        }, children: "Fornecedores" })] }), _jsxs("div", { style: { overflow: 'auto', flex: 1, padding: '0 20px 24px' }, children: [_jsx(GoldBtn, { icon: "plus", onClick: () => setSub('criar'), children: "Novo fornecedor" }), isLoading ? (_jsx("div", { style: { paddingTop: 32, textAlign: 'center' }, children: _jsx("span", { style: { fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }, children: "Carregando..." }) })) : (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }, children: fornecedores.map((f) => (_jsx(FornecedorCard, { fornecedor: f, formatBRL: formatBRL, onEdit: () => {
                                setEditId(f.id);
                                setSub('editar');
                            } }, f.id))) }))] })] }));
}
function FornecedorCard({ fornecedor: f, formatBRL, onEdit }) {
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
                            borderRadius: 13,
                            background: 'var(--color-surface-2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }, children: _jsx(Icon, { name: "factory", size: 22, color: "var(--color-accent)" }) }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx("p", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 15,
                                            fontWeight: 700,
                                            color: 'var(--color-text)',
                                            margin: 0,
                                            lineHeight: 1.3,
                                        }, children: f.name }), f.isPrincipal && (_jsx("span", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: 'var(--color-accent)',
                                            background: 'rgba(227,172,63,0.14)',
                                            borderRadius: 99,
                                            padding: '2px 8px',
                                            lineHeight: 1.4,
                                            flexShrink: 0,
                                        }, children: "Principal" }))] }), f.cnpj && (_jsx("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: 'var(--color-text-ter)',
                                    margin: '2px 0 0',
                                }, children: f.cnpj }))] }), _jsx("button", { type: "button", "aria-label": `Editar fornecedor ${f.name}`, onClick: onEdit, style: {
                            width: 36,
                            height: 36,
                            borderRadius: 11,
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-surface)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            flexShrink: 0,
                        }, children: _jsx(Icon, { name: "edit", size: 17, color: "var(--color-text-sec)" }) })] }), _jsxs("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: '1px solid var(--color-border-2)',
                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx(Icon, { name: "coin", size: 13, color: "var(--color-text-ter)" }), _jsxs("span", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: 'var(--color-text-sec)',
                                }, children: ["Pre\u00E7o por p\u00E3o: ", formatBRL(f.pricePerBread)] })] }), f.phone && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx(Icon, { name: "phone", size: 13, color: "var(--color-text-ter)" }), _jsx("span", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: 'var(--color-text-ter)',
                                }, children: f.phone })] })), f.email && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx(Icon, { name: "mail", size: 13, color: "var(--color-text-ter)" }), _jsx("span", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: 'var(--color-text-ter)',
                                }, children: f.email })] }))] })] }));
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
