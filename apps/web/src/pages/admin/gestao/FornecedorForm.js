import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { apiFetch } from '../../../lib/apiFetch';
import { Icon } from '../../../components/brand/Icon';
// ------------------------------------------------------------------ componente
export function FornecedorForm({ id, onBack, onSaved }) {
    const [nome, setNome] = useState('');
    const [cnpj, setCnpj] = useState('');
    const [telefone, setTelefone] = useState('');
    const [email, setEmail] = useState('');
    const [precoPorPao, setPrecoPorPao] = useState('');
    const [isPrincipal, setIsPrincipal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(!!id);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!id)
            return;
        const fetchFornecedor = async () => {
            try {
                const res = await apiFetch(`/admin/suppliers/${id}`);
                if (res.ok) {
                    const data = (await res.json());
                    setNome(data.name);
                    setCnpj(data.cnpj ?? '');
                    setTelefone(data.phone ?? '');
                    setEmail(data.email ?? '');
                    setPrecoPorPao(String(data.pricePerBread));
                    setIsPrincipal(data.isPrincipal);
                }
            }
            catch {
                // falha silenciosa
            }
            finally {
                setIsLoading(false);
            }
        };
        void fetchFornecedor();
    }, [id]);
    const handleSalvar = async () => {
        setError(null);
        setIsSaving(true);
        try {
            const body = {
                name: nome.trim(),
                ...(cnpj.trim() ? { cnpj: cnpj.trim() } : {}),
                ...(telefone.trim() ? { phone: telefone.trim() } : {}),
                ...(email.trim() ? { email: email.trim() } : {}),
                pricePerBread: Number(precoPorPao),
                isPrincipal,
            };
            const res = await apiFetch(id ? `/admin/suppliers/${id}` : '/admin/suppliers', {
                method: id ? 'PATCH' : 'POST',
                body: JSON.stringify(body),
            });
            if (res.ok) {
                onSaved();
            }
            else {
                const err = (await res.json().catch(() => null));
                setError(err?.error ?? 'Não foi possível salvar. Tente novamente.');
            }
        }
        catch {
            setError('Erro de conexão. Tente novamente.');
        }
        finally {
            setIsSaving(false);
        }
    };
    const isValid = nome.trim() !== '' && Number(precoPorPao) > 0;
    if (isLoading) {
        return (_jsx("div", { style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }, children: _jsx("span", { style: { fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }, children: "Carregando..." }) }));
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
                        }, children: id ? 'Editar fornecedor' : 'Novo fornecedor' })] }), _jsxs("div", { style: {
                    overflow: 'auto',
                    flex: 1,
                    padding: '0 20px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                }, children: [_jsx(FormField, { label: "Nome", icon: "factory", value: nome, onChange: setNome, placeholder: "Padaria Estrela" }), _jsx(FormField, { label: "CNPJ", icon: "building", value: cnpj, onChange: setCnpj, placeholder: "00.000.000/0001-00" }), _jsx(FormField, { label: "Telefone", icon: "phone", type: "tel", value: telefone, onChange: setTelefone, placeholder: "(11) 99999-9999" }), _jsx(FormField, { label: "E-mail", icon: "mail", type: "email", value: email, onChange: setEmail, placeholder: "contato@padaria.com" }), _jsx(FormField, { label: "Pre\u00E7o por p\u00E3o (R$)", icon: "coin", type: "number", value: precoPorPao, onChange: setPrecoPorPao, placeholder: "0.45", step: "0.01" }), _jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'var(--color-surface-alt, #FBF6EC)',
                            border: '1.5px solid var(--color-border)',
                            borderRadius: 14,
                            padding: '12px 14px',
                        }, children: [_jsx("span", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 14.5,
                                    fontWeight: 700,
                                    color: 'var(--color-text)',
                                }, children: "Fornecedor principal" }), _jsx(SwitchToggle, { on: isPrincipal, onChange: () => setIsPrincipal((p) => !p) })] }), _jsx("div", { style: { flex: 1 } }), error && (_jsx("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 12,
                            fontWeight: 700,
                            color: 'var(--color-accent)',
                            margin: 0,
                        }, children: error })), _jsx("button", { type: "button", onClick: () => void handleSalvar(), disabled: !isValid || isSaving, style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            minHeight: 52,
                            background: 'var(--color-espresso)',
                            color: '#FAF5EC',
                            border: 'none',
                            borderRadius: 16,
                            fontFamily: 'var(--font-body)',
                            fontSize: 16,
                            fontWeight: 700,
                            cursor: !isValid || isSaving ? 'default' : 'pointer',
                            opacity: !isValid || isSaving ? 0.5 : 1,
                            letterSpacing: '-0.01em',
                        }, children: isSaving ? 'Salvando...' : 'Salvar fornecedor' })] })] }));
}
function FormField({ label, icon, value, onChange, placeholder, type = 'text', step }) {
    const [focused, setFocused] = useState(false);
    return (_jsxs("label", { style: { display: 'block' }, children: [_jsx("div", { style: {
                    fontFamily: 'var(--font-body)',
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: 'var(--color-text-sec)',
                    letterSpacing: '0.01em',
                    marginBottom: 7,
                }, children: label }), _jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'var(--color-surface-alt, #FBF6EC)',
                    border: `1.5px solid ${focused ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    borderRadius: 14,
                    padding: '12px 14px',
                    transition: 'border-color 0.15s ease',
                }, children: [_jsx(Icon, { name: icon, size: 18, color: "var(--color-text-ter)" }), _jsx("input", { type: type, value: value, step: step, onChange: (e) => onChange(e.target.value), onFocus: () => setFocused(true), onBlur: () => setFocused(false), placeholder: placeholder, style: {
                            flex: 1,
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            fontFamily: 'var(--font-body)',
                            fontSize: 15,
                            fontWeight: 500,
                            color: 'var(--color-text)',
                            minWidth: 0,
                        } })] })] }));
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
