import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import { OtpInput } from '../../components/auth/OtpInput';
import { ResendTimer } from '../../components/auth/ResendTimer';
import { Icon } from '../../components/brand/Icon';
import { apiFetch } from '../../lib/apiFetch';
/**
 * LoginScreen — 2-step OTP login
 *
 * Step 1: phone or email entry → POST /auth/otp/send → advances to step 2
 * Step 2: OTP 4-digit entry → POST /auth/otp/verify → auth.login() → role-based redirect
 *
 * Design tokens: matches screens-onboarding.jsx LoginScreen with high fidelity (AUTH-04/05/08, UI-06)
 */
export function LoginScreen() {
    const auth = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState('phone-entry');
    const [inputMode, setInputMode] = useState('phone');
    const [inputValue, setInputValue] = useState('');
    const [userId, setUserId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    // ──────────────── Step 1: Send OTP ────────────────
    const sendOtp = async () => {
        if (!inputValue.trim())
            return;
        setIsLoading(true);
        setError(null);
        try {
            const body = inputMode === 'phone'
                ? { phone: inputValue.trim() }
                : { email: inputValue.trim() };
            const res = await apiFetch('/auth/otp/send', {
                method: 'POST',
                body: JSON.stringify(body),
            });
            if (res.ok) {
                const data = (await res.json());
                setUserId(data.userId ?? '');
                setStep('otp');
            }
            else {
                const err = (await res.json());
                setError(err.error ?? 'Algo deu errado. Verifique sua conexão e tente novamente.');
            }
        }
        catch {
            setError('Algo deu errado. Verifique sua conexão e tente novamente.');
        }
        finally {
            setIsLoading(false);
        }
    };
    // ──────────────── Step 2: Verify OTP ────────────────
    const verifyOtp = async (code) => {
        setIsLoading(true);
        setError(null);
        try {
            const deviceId = (() => {
                try {
                    return localStorage.getItem('device_id') ?? '';
                }
                catch {
                    return '';
                }
            })();
            const res = await apiFetch('/auth/otp/verify', {
                method: 'POST',
                body: JSON.stringify({ userId, code, deviceId }),
            });
            if (res.ok) {
                const data = (await res.json());
                auth.login(data.token, {
                    id: data.user.id,
                    role: data.user.role,
                    name: data.user.name,
                    creditBalance: data.user.creditBalance ?? 0,
                });
                // Fetch full profile for CLIENT and persist in AuthContext (CONF-01)
                if (data.user.role === 'CLIENT') {
                    apiFetch('/client/profile').then((pr) => {
                        if (pr.ok)
                            pr.json().then((profile) => auth.updateUser(profile)).catch(() => { });
                    }).catch(() => { });
                }
                // Role-based redirect (AUTH-08: admin → /admin)
                const roleRoutes = {
                    ADMIN: '/admin',
                    CLIENT: '/client',
                    COURIER: '/courier',
                };
                navigate(roleRoutes[data.user.role] ?? '/client');
            }
            else if (res.status === 401) {
                const err = (await res.json());
                const errMsg = err.error ?? '';
                if (errMsg.toLowerCase().includes('expir')) {
                    setError('Código expirado. Solicite um novo.');
                }
                else {
                    setError('Código incorreto. Verifique e tente de novo.');
                }
            }
            else {
                setError('Algo deu errado. Verifique sua conexão e tente novamente.');
            }
        }
        catch {
            setError('Algo deu errado. Verifique sua conexão e tente novamente.');
        }
        finally {
            setIsLoading(false);
        }
    };
    // ──────────────── Shared back button ────────────────
    const handleBack = () => {
        if (step === 'otp') {
            setStep('phone-entry');
            setError(null);
        }
        else {
            navigate('/');
        }
    };
    // ──────────────── Render ────────────────
    return (_jsxs("div", { style: {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '8px 24px 24px',
            minHeight: '100dvh',
            backgroundColor: 'var(--color-app-bg)',
        }, children: [_jsx("div", { style: { width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }, children: _jsx("button", { onClick: handleBack, "aria-label": "Voltar", style: {
                        background: 'var(--color-surface-2)',
                        border: 'none',
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                        color: 'var(--color-text)',
                        flexShrink: 0,
                    }, children: _jsx(Icon, { name: "arrowL", size: 20 }) }) }), _jsx("div", { style: {
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                }, children: step === 'phone-entry' ? (_jsx(StepPhoneEntry, { inputMode: inputMode, inputValue: inputValue, isLoading: isLoading, error: error, onInputChange: (v) => {
                        setInputValue(v);
                        setError(null);
                    }, onToggleMode: () => {
                        setInputMode((m) => (m === 'phone' ? 'email' : 'phone'));
                        setInputValue('');
                        setError(null);
                    }, onSubmit: sendOtp })) : (_jsx(StepOtp, { inputValue: inputValue, isLoading: isLoading, error: error, onComplete: verifyOtp, onResend: sendOtp })) })] }));
}
function StepPhoneEntry({ inputMode, inputValue, isLoading, error, onInputChange, onToggleMode, onSubmit, }) {
    const isPhone = inputMode === 'phone';
    const [focused, setFocused] = useState(false);
    const bodyText = isPhone
        ? 'Enviamos um código por SMS para confirmar seu número. Sem senha pra decorar.'
        : 'Enviamos um código por e-mail para confirmar seu endereço. Sem senha pra decorar.';
    return (_jsxs("div", { children: [_jsx("h1", { style: {
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 28,
                    letterSpacing: '-0.03em',
                    color: 'var(--color-text)',
                    lineHeight: 1.1,
                    margin: 0,
                    whiteSpace: 'pre-line',
                }, children: 'Bom dia.\nVamos te identificar.' }), _jsx("p", { style: {
                    fontFamily: 'var(--font-body)',
                    fontSize: 15,
                    fontWeight: 400,
                    color: 'var(--color-text-sec)',
                    marginTop: 12,
                    marginBottom: 24,
                    lineHeight: 1.5,
                }, children: bodyText }), _jsx("div", { style: { position: 'relative' }, children: _jsx("input", { type: isPhone ? 'tel' : 'email', inputMode: isPhone ? 'tel' : 'email', autoComplete: isPhone ? 'tel' : 'email', placeholder: isPhone ? '+55 (11) 99999-9999' : 'seu@email.com', value: inputValue, onChange: (e) => onInputChange(e.target.value), onFocus: () => setFocused(true), onBlur: () => setFocused(false), disabled: isLoading, style: {
                        width: '100%',
                        padding: '12px 16px',
                        fontFamily: 'var(--font-body)',
                        fontSize: 15,
                        fontWeight: 400,
                        color: 'var(--color-text)',
                        background: 'var(--color-surface-alt)',
                        border: `1.5px solid ${focused ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        borderRadius: 'var(--radius-field)',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s ease',
                    } }) }), error && _jsx(ErrorMessage, { children: error }), _jsx("div", { style: { height: 16 } }), _jsx(PrimaryButton, { onClick: onSubmit, disabled: !inputValue.trim() || isLoading, loading: isLoading, children: "Enviar c\u00F3digo" }), _jsxs("div", { style: {
                    textAlign: 'center',
                    marginTop: 16,
                    fontFamily: 'var(--font-body)',
                    fontSize: 15,
                    fontWeight: 400,
                    color: 'var(--color-text-ter)',
                }, children: ["ou entre com", ' ', _jsx("button", { onClick: onToggleMode, style: {
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            fontFamily: 'var(--font-body)',
                            fontSize: 15,
                            fontWeight: 700,
                            color: 'var(--color-accent)',
                            cursor: 'pointer',
                        }, children: isPhone ? 'e-mail' : 'telefone' })] })] }));
}
function StepOtp({ inputValue, isLoading, error, onComplete, onResend }) {
    return (_jsxs("div", { children: [_jsx("h1", { style: {
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 28,
                    letterSpacing: '-0.03em',
                    color: 'var(--color-text)',
                    lineHeight: 1.1,
                    margin: 0,
                }, children: "Digite o c\u00F3digo" }), _jsxs("p", { style: {
                    fontFamily: 'var(--font-body)',
                    fontSize: 15,
                    fontWeight: 400,
                    color: 'var(--color-text-sec)',
                    marginTop: 12,
                    marginBottom: 28,
                    lineHeight: 1.5,
                }, children: ["Mandamos 4 d\u00EDgitos para", ' ', _jsx("strong", { style: { fontWeight: 700, color: 'var(--color-text)' }, children: inputValue }), "."] }), _jsx(OtpInput, { onComplete: onComplete, disabled: isLoading }), error && _jsx(ErrorMessage, { children: error }), _jsx("div", { style: { height: 24 } }), _jsx(ResendTimer, { onResend: onResend })] }));
}
function PrimaryButton({ onClick, disabled = false, loading = false, children }) {
    const [hovered, setHovered] = useState(false);
    const isDisabled = disabled || loading;
    return (_jsx("button", { onClick: onClick, disabled: isDisabled, onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false), style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            minHeight: 52,
            backgroundColor: 'var(--color-espresso)',
            color: 'var(--color-primary-btn-text)',
            borderRadius: 'var(--radius-btn)',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            padding: '16px 24px',
            border: 'none',
            cursor: isDisabled ? 'default' : 'pointer',
            opacity: isDisabled ? 0.45 : 1,
            transition: 'transform 0.15s, filter 0.15s, opacity 0.15s',
            transform: hovered && !isDisabled ? 'translateY(-1px)' : 'translateY(0)',
            filter: hovered && !isDisabled ? 'brightness(1.05)' : 'none',
            boxSizing: 'border-box',
        }, children: loading ? 'Carregando...' : children }));
}
function ErrorMessage({ children }) {
    return (_jsx("p", { role: "alert", style: {
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--color-accent)',
            marginTop: 8,
            textAlign: 'center',
            lineHeight: 1.4,
        }, children: children }));
}
