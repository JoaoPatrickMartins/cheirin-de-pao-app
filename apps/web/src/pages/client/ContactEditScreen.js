import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import { apiFetch } from '../../lib/apiFetch';
import { OtpInput } from '../../components/auth/OtpInput';
import { ResendTimer } from '../../components/auth/ResendTimer';
import { Icon } from '../../components/brand/Icon';
export function ContactEditScreen() {
    const navigate = useNavigate();
    const auth = useAuth();
    const [step, setStep] = useState(0);
    const [channel, setChannel] = useState('sms');
    const [contactValue, setContactValue] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const handleRequestChange = async () => {
        if (!contactValue.trim())
            return;
        setLoading(true);
        setError(null);
        try {
            const body = channel === 'sms' ? { phone: contactValue.trim() } : { email: contactValue.trim() };
            const res = await apiFetch('/client/profile/contact/request-change', {
                method: 'POST',
                body: JSON.stringify(body),
            });
            if (res.ok) {
                setStep(1);
            }
            else if (res.status === 422) {
                setError('Este contato já está associado a outra conta.');
            }
            else {
                setError('Algo deu errado. Tente novamente.');
            }
        }
        catch {
            setError('Algo deu errado. Tente novamente.');
        }
        finally {
            setLoading(false);
        }
    };
    const handleConfirmChange = async (code) => {
        if (loading)
            return;
        setLoading(true);
        setError(null);
        try {
            const res = await apiFetch('/client/profile/contact/confirm-change', {
                method: 'POST',
                body: JSON.stringify({ code }),
            });
            if (res.ok) {
                auth.updateUser(channel === 'sms' ? { phone: contactValue.trim() } : { email: contactValue.trim() });
                navigate('/client/perfil');
            }
            else if (res.status === 401) {
                const data = (await res.json());
                const msg = data.error ?? '';
                if (msg.toLowerCase().includes('expirado') || msg.toLowerCase().includes('expir')) {
                    setError('Código expirado. Solicite um novo.');
                }
                else {
                    setError('Código incorreto. Verifique e tente de novo.');
                }
            }
            else {
                setError('Algo deu errado. Tente novamente.');
            }
        }
        catch {
            setError('Algo deu errado. Tente novamente.');
        }
        finally {
            setLoading(false);
        }
    };
    const handleOtpComplete = (code) => {
        setOtpCode(code);
        void handleConfirmChange(code);
    };
    return (_jsxs("div", { style: {
            minHeight: '100dvh',
            background: 'var(--color-app-bg)',
            display: 'flex',
            flexDirection: 'column',
            padding: '8px 24px 24px',
        }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    paddingTop: 'env(safe-area-inset-top)',
                    marginBottom: 32,
                }, children: [_jsx("button", { onClick: () => navigate(-1), "aria-label": "Voltar", style: {
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
                        }, children: _jsx(Icon, { name: "arrowL", size: 20 }) }), _jsx("h1", { style: {
                            fontFamily: 'var(--font-display)',
                            fontSize: 21,
                            fontWeight: 600,
                            letterSpacing: '-0.02em',
                            color: 'var(--color-text)',
                            margin: 0,
                        }, children: "Editar contato" })] }), _jsxs("div", { style: {
                    display: step === 0 ? 'block' : 'none',
                    opacity: step === 0 ? 1 : 0,
                    transform: step === 0 ? 'translateY(0)' : 'translateY(-8px)',
                    transition: 'opacity 150ms ease-out, transform 150ms ease-out',
                }, children: [_jsx(StepIndicator, { current: 1, total: 2 }), _jsx("h2", { style: headingStyle, children: "Qual \u00E9 o novo contato?" }), _jsx("p", { style: subtitleStyle, children: "Voc\u00EA receber\u00E1 um c\u00F3digo de verifica\u00E7\u00E3o." }), _jsx(ChannelToggle, { selected: channel, onChange: setChannel }), _jsx("div", { style: { height: 16 } }), _jsx("input", { type: channel === 'sms' ? 'tel' : 'email', inputMode: channel === 'sms' ? 'tel' : 'email', autoComplete: channel === 'sms' ? 'tel' : 'email', placeholder: channel === 'sms' ? '+55 (11) 99999-9999' : 'seu@email.com', value: contactValue, onChange: (e) => { setContactValue(e.target.value); setError(null); }, disabled: loading, style: {
                            width: '100%',
                            background: 'var(--color-surface-alt)',
                            border: '1.5px solid var(--color-border)',
                            borderRadius: 'var(--radius-field)',
                            padding: '12px 14px',
                            fontFamily: 'var(--font-body)',
                            fontSize: 15,
                            color: 'var(--color-text)',
                            outline: 'none',
                            boxSizing: 'border-box',
                        } }), error && _jsx(ErrorText, { children: error }), _jsx("div", { style: { height: 20 } }), _jsx(ActionButton, { onClick: handleRequestChange, loading: loading, disabled: !contactValue.trim(), children: "Enviar c\u00F3digo" })] }), _jsxs("div", { style: {
                    display: step === 1 ? 'block' : 'none',
                    opacity: step === 1 ? 1 : 0,
                    transform: step === 1 ? 'translateY(0)' : 'translateY(-8px)',
                    transition: 'opacity 150ms ease-out, transform 150ms ease-out',
                }, children: [_jsx(StepIndicator, { current: 2, total: 2 }), _jsx("h2", { style: headingStyle, children: "Confirme o c\u00F3digo" }), _jsxs("p", { style: subtitleStyle, children: ["C\u00F3digo enviado para", ' ', _jsx("strong", { style: { fontWeight: 700, color: 'var(--color-text)' }, children: contactValue }), "."] }), _jsx(OtpInput, { onComplete: handleOtpComplete, disabled: loading }), error && _jsx(ErrorText, { children: error }), _jsx("div", { style: { height: 24 } }), _jsx(ResendTimer, { onResend: handleRequestChange }), _jsx("div", { style: { height: 16 } }), _jsx(ActionButton, { onClick: () => { if (otpCode.length >= 4)
                            void handleConfirmChange(otpCode); }, loading: loading, disabled: otpCode.length < 4, children: "Confirmar c\u00F3digo" })] })] }));
}
// ── Sub-components ─────────────────────────────────────────────────────────────
const headingStyle = {
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: 28,
    letterSpacing: '-0.03em',
    color: 'var(--color-text)',
    lineHeight: 1.1,
    margin: '0 0 8px',
};
const subtitleStyle = {
    fontFamily: 'var(--font-body)',
    fontSize: 15,
    fontWeight: 400,
    color: 'var(--color-text-sec)',
    margin: '0 0 24px',
    lineHeight: 1.5,
};
function StepIndicator({ current, total }) {
    return (_jsxs("p", { style: {
            fontFamily: 'var(--font-body)',
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--color-text-sec)',
            margin: '0 0 8px',
        }, children: ["Passo ", current, " de ", total] }));
}
function ChannelToggle({ selected, onChange, }) {
    return (_jsx("div", { style: { display: 'flex', gap: 8 }, children: ['sms', 'email'].map((ch) => (_jsx("button", { onClick: () => onChange(ch), style: {
                flex: 1,
                minHeight: 44,
                borderRadius: 'var(--radius-field)',
                border: `1.5px solid ${selected === ch ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: selected === ch ? 'var(--color-surface)' : 'transparent',
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                fontWeight: selected === ch ? 700 : 500,
                color: selected === ch ? 'var(--color-accent)' : 'var(--color-text-sec)',
                cursor: 'pointer',
                transition: 'border-color 0.15s, color 0.15s',
            }, children: ch === 'sms' ? 'SMS' : 'E-mail' }, ch))) }));
}
function ErrorText({ children }) {
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
function ActionButton({ onClick, loading = false, disabled = false, children }) {
    const isDisabled = disabled || loading;
    return (_jsx("button", { onClick: onClick, disabled: isDisabled, style: {
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
            border: 'none',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            opacity: isDisabled ? 0.45 : 1,
            transition: 'opacity 0.15s',
        }, children: loading ? 'Carregando...' : children }));
}
