import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router';
import { Icon } from '../../components/brand/Icon';
import { useAuth } from '../../hooks/useAuth';
import { apiFetch } from '../../lib/apiFetch';
/** Strip non-digits from CPF string */
function stripCpf(cpf) {
    return cpf.replace(/\D/g, '');
}
/** Format raw digits as 000.000.000-00 */
function formatCpf(raw) {
    const digits = raw.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3)
        return digits;
    if (digits.length <= 6)
        return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9)
        return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}
/**
 * Admin form to register a courier with name, CPF, phone, email.
 * Requires ADMIN role — redirects to '/' if not authenticated as admin.
 * Calls POST /auth/couriers (apiFetch injects the admin bearer token automatically).
 */
export function CourierRegisterScreen() {
    const navigate = useNavigate();
    const auth = useAuth();
    // All hooks must be declared before any conditional returns (Rules of Hooks)
    const [nome, setNome] = useState('');
    const [cpfDisplay, setCpfDisplay] = useState('');
    const [telefone, setTelefone] = useState('');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    // Role guard — must be after all hooks
    if (!auth.isLoading && (!auth.user || auth.user.role !== 'ADMIN')) {
        return _jsx(Navigate, { to: "/", replace: true });
    }
    const handleCpfChange = (value) => {
        const digits = value.replace(/\D/g, '').slice(0, 11);
        setCpfDisplay(formatCpf(digits));
    };
    const handleSubmit = async () => {
        setError(null);
        setLoading(true);
        try {
            const res = await apiFetch('/auth/couriers', {
                method: 'POST',
                body: JSON.stringify({
                    name: nome,
                    cpf: stripCpf(cpfDisplay),
                    ...(telefone ? { phone: telefone } : {}),
                    ...(email ? { email } : {}),
                }),
            });
            if (!res.ok) {
                const err = (await res.json().catch(() => null));
                setError(err?.error ?? 'Algo deu errado. Verifique os dados e tente novamente.');
                return;
            }
            setSuccess(true);
        }
        catch {
            setError('Algo deu errado. Verifique sua conexão e tente novamente.');
        }
        finally {
            setLoading(false);
        }
    };
    const isValid = nome.trim() !== '' && stripCpf(cpfDisplay).length === 11;
    if (success) {
        return (_jsxs("div", { style: {
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100dvh',
                background: 'var(--color-app-bg)',
                padding: '4px 24px 24px',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
            }, children: [_jsx("div", { style: {
                        width: 56,
                        height: 56,
                        borderRadius: 'var(--radius-card)',
                        background: 'var(--color-good-soft)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }, children: _jsx(Icon, { name: "check", size: 28, color: "var(--color-good)" }) }), _jsx("p", { style: {
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700,
                        fontSize: 28,
                        color: 'var(--color-text)',
                        textAlign: 'center',
                        lineHeight: 1.1,
                        letterSpacing: '-0.03em',
                    }, children: "Entregador cadastrado com sucesso!" }), _jsx("button", { type: "button", onClick: () => navigate(-1), style: {
                        marginTop: 8,
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-accent)',
                        fontFamily: 'var(--font-body)',
                        fontSize: 15,
                        fontWeight: 700,
                        cursor: 'pointer',
                        minHeight: 44,
                    }, children: "Voltar" })] }));
    }
    return (_jsxs("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100dvh',
            background: 'var(--color-app-bg)',
            padding: '4px 24px 24px',
        }, children: [_jsx("button", { type: "button", "aria-label": "Voltar", onClick: () => navigate(-1), style: {
                    background: 'var(--color-surface-2)',
                    border: 'none',
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--color-text)',
                    flexShrink: 0,
                    padding: 3,
                    marginLeft: -3,
                }, children: _jsx(Icon, { name: "arrowL", size: 20 }) }), _jsx("div", { style: { height: 24 } }), _jsx("h1", { style: {
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 28,
                    lineHeight: 1.1,
                    letterSpacing: '-0.03em',
                    color: 'var(--color-text)',
                    margin: 0,
                }, children: "Cadastrar entregador" }), _jsx("p", { style: {
                    fontFamily: 'var(--font-body)',
                    fontSize: 15,
                    color: 'var(--color-text-sec)',
                    marginTop: 8,
                    marginBottom: 24,
                    lineHeight: 1.5,
                }, children: "Preencha os dados do entregador. O CPF \u00E9 obrigat\u00F3rio." }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 16 }, children: [_jsx(CourierField, { label: "Nome completo", icon: "user", value: nome, onChange: setNome, placeholder: "Ex.: Carlos Oliveira" }), _jsx(CourierField, { label: "CPF", icon: "card", value: cpfDisplay, onChange: handleCpfChange, placeholder: "000.000.000-00", type: "tel", autoComplete: "off" }), _jsx(CourierField, { label: "Celular", icon: "phone", value: telefone, onChange: setTelefone, placeholder: "(11) 9 0000-0000", type: "tel", autoComplete: "tel" }), _jsx(CourierField, { label: "E-mail", icon: "mail", value: email, onChange: setEmail, placeholder: "entregador@email.com", type: "email", autoComplete: "email" })] }), _jsx("div", { style: { flex: 1 } }), error && (_jsx("p", { style: {
                    fontSize: 12,
                    fontFamily: 'var(--font-body)',
                    fontWeight: 700,
                    color: 'var(--color-accent)',
                    marginBottom: 8,
                    lineHeight: 1.4,
                }, children: error })), _jsx(CourierSubmitBtn, { onClick: handleSubmit, disabled: !isValid || loading, children: loading ? 'Cadastrando...' : 'Cadastrar entregador' })] }));
}
function CourierField({ label, icon, value, onChange, placeholder, type = 'text', autoComplete }) {
    const [focused, setFocused] = useState(false);
    return (_jsxs("label", { style: { display: 'block' }, children: [label && (_jsx("div", { style: {
                    fontSize: 12,
                    fontFamily: 'var(--font-body)',
                    fontWeight: 700,
                    color: 'var(--color-text-sec)',
                    marginBottom: 7,
                    letterSpacing: '0.01em',
                }, children: label })), _jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'var(--color-surface-alt)',
                    border: `1.5px solid ${focused ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    borderRadius: 'var(--radius-field)',
                    padding: '12px 14px',
                    transition: 'border-color 0.15s ease',
                }, children: [_jsx(Icon, { name: icon, size: 18, color: "var(--color-text-ter)" }), _jsx("input", { type: type, value: value, onChange: (e) => onChange(e.target.value), onFocus: () => setFocused(true), onBlur: () => setFocused(false), placeholder: placeholder, autoComplete: autoComplete, style: {
                            flex: 1,
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            fontSize: 15,
                            fontFamily: 'var(--font-body)',
                            fontWeight: 400,
                            color: 'var(--color-text)',
                            minWidth: 0,
                        } })] })] }));
}
function CourierSubmitBtn({ onClick, disabled, children }) {
    const [hovered, setHovered] = useState(false);
    return (_jsx("button", { type: "button", onClick: disabled ? undefined : onClick, disabled: disabled, onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false), style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            minHeight: 44,
            backgroundColor: 'var(--color-espresso)',
            color: 'var(--color-primary-btn-text)',
            borderRadius: 'var(--radius-btn)',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            padding: '16px 22px',
            border: 'none',
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.45 : 1,
            transition: 'transform .15s, filter .15s',
            transform: hovered && !disabled ? 'translateY(-1px)' : 'translateY(0)',
            filter: hovered && !disabled ? 'brightness(1.05)' : 'none',
        }, children: children }));
}
