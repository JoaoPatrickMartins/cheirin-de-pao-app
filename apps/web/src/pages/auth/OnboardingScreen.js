import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '../../components/brand/Icon';
import { StepDots } from '../../components/auth/StepDots';
import { ChannelSelector } from '../../components/auth/ChannelSelector';
import { CondoSearch } from '../../components/auth/CondoSearch';
import { OtpInput } from '../../components/auth/OtpInput';
import { ResendTimer } from '../../components/auth/ResendTimer';
import { useAuth } from '../../hooks/useAuth';
import { apiFetch } from '../../lib/apiFetch';
/** Strip non-digits from CPF string */
function stripCpf(cpf) {
    return cpf.replace(/\D/g, '');
}
/** Format raw 11-digit CPF string as 000.000.000-00 */
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
/** Format raw 8-digit date string as DD/MM/AAAA */
function formatDate(raw) {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2)
        return digits;
    if (digits.length <= 4)
        return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}
/** Convert DD/MM/AAAA to ISO 8601, undefined if incomplete */
function parseBirthDate(display) {
    const digits = display.replace(/\D/g, '');
    if (digits.length !== 8)
        return undefined;
    return `${digits.slice(4)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}T00:00:00.000Z`;
}
const TOTAL_STEPS = 5;
export function OnboardingScreen() {
    const navigate = useNavigate();
    const auth = useAuth();
    const [step, setStep] = useState(0);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    // Step 0 — Dados
    const [nome, setNome] = useState('');
    const [cpfDisplay, setCpfDisplay] = useState(''); // formatted display value
    const [dataNascimento, setDataNascimento] = useState('');
    // Step 1 — Contato
    const [telefone, setTelefone] = useState('');
    const [email, setEmail] = useState('');
    const [canal, setCanal] = useState('sms');
    // Step 2 — Condomínio
    const [condos, setCondos] = useState([]);
    const [condosLoading, setCondosLoading] = useState(false);
    const [selectedCondoId, setSelectedCondoId] = useState(null);
    // Step 3 — Endereço
    const [bloco, setBloco] = useState(null);
    const [apto, setApto] = useState('');
    // Step 4 — OTP
    const [otpCode, setOtpCode] = useState('');
    const [otpKey, setOtpKey] = useState(0);
    const [userId, setUserId] = useState(null);
    const selectedCondo = condos.find((c) => c.id === selectedCondoId) ?? null;
    const isBlocksCondo = selectedCondo?.type === 'BLOCKS';
    // Auto-select channel based on contact info
    useEffect(() => {
        const hasPhone = telefone.trim().length > 0;
        const hasEmail = email.trim().length > 0;
        if (hasPhone && !hasEmail)
            setCanal('sms');
        else if (hasEmail && !hasPhone)
            setCanal('email');
        // both → keep current selection
    }, [telefone, email]);
    // Load condos when reaching step 2
    useEffect(() => {
        if (step !== 2)
            return;
        setCondosLoading(true);
        apiFetch('/condominiums')
            .then(async (res) => {
            if (!res.ok)
                throw new Error('Failed to load condominiums');
            const data = (await res.json());
            setCondos(data);
        })
            .catch(() => {
            setCondos([]);
        })
            .finally(() => setCondosLoading(false));
    }, [step]);
    const handleCpfChange = (value) => {
        // Only allow digits and formatting chars
        const digits = value.replace(/\D/g, '').slice(0, 11);
        setCpfDisplay(formatCpf(digits));
    };
    const handleBack = () => {
        setError(null);
        if (step === 0) {
            navigate('/');
        }
        else {
            setStep((s) => s - 1);
        }
    };
    const handleStep0Continue = () => {
        setError(null);
        setStep(1);
    };
    const handleStep1Continue = () => {
        setError(null);
        setStep(2);
    };
    const handleStep2Continue = () => {
        setError(null);
        setStep(3);
    };
    /** Step 3 CTA: register + send OTP */
    const handleStep3Submit = async () => {
        setError(null);
        setLoading(true);
        try {
            const rawCpf = stripCpf(cpfDisplay);
            const regRes = await apiFetch('/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    name: nome,
                    cpf: rawCpf,
                    birthDate: parseBirthDate(dataNascimento),
                    ...(telefone ? { phone: telefone } : {}),
                    ...(email ? { email } : {}),
                    channel: canal,
                    condominiumId: selectedCondoId,
                    apartment: apto,
                    ...(isBlocksCondo && bloco ? { block: bloco } : {}),
                }),
            });
            if (regRes.status === 409) {
                setError('Esse CPF já tem uma conta. Faça login ou recupere o acesso.');
                return;
            }
            if (!regRes.ok) {
                const err = (await regRes.json().catch(() => null));
                setError(err?.error ?? 'Algo deu errado. Verifique sua conexão e tente novamente.');
                return;
            }
            const { userId: uid } = (await regRes.json());
            setUserId(uid);
            // Send OTP
            const otpBody = canal === 'sms' ? { phone: telefone } : { email };
            const otpRes = await apiFetch('/auth/otp/send', {
                method: 'POST',
                body: JSON.stringify(otpBody),
            });
            if (!otpRes.ok) {
                setError('Não foi possível enviar o código. Tente novamente.');
                return;
            }
            setOtpCode('');
            setOtpKey((k) => k + 1);
            setStep(4);
        }
        catch {
            setError('Algo deu errado. Verifique sua conexão e tente novamente.');
        }
        finally {
            setLoading(false);
        }
    };
    /** Step 4: verify OTP */
    const handleOtpComplete = async (code) => {
        if (!userId)
            return;
        if (loading)
            return; // guard contra dupla submissão (OtpInput.onComplete + botão)
        setError(null);
        setLoading(true);
        try {
            let deviceId;
            try {
                deviceId = localStorage.getItem('device_id') ?? crypto.randomUUID();
            }
            catch {
                deviceId = crypto.randomUUID();
            }
            const res = await apiFetch('/auth/otp/verify', {
                method: 'POST',
                body: JSON.stringify({ userId, code, deviceId }),
            });
            if (!res.ok) {
                const err = (await res.json().catch(() => null));
                const msg = err?.error ?? '';
                if (msg.toLowerCase().includes('expir')) {
                    setError('Código expirado. Solicite um novo.');
                }
                else {
                    setError('Código incorreto. Verifique e tente de novo.');
                }
                setOtpCode('');
                setOtpKey((k) => k + 1);
                return;
            }
            const { token, user } = (await res.json());
            auth.login(token, { ...user, creditBalance: user.creditBalance ?? 0 });
            navigate('/client');
        }
        catch {
            setError('Algo deu errado. Verifique sua conexão e tente novamente.');
        }
        finally {
            setLoading(false);
        }
    };
    const handleResend = async () => {
        if (!userId)
            return;
        setError(null);
        const otpBody = canal === 'sms' ? { phone: telefone } : { email };
        await apiFetch('/auth/otp/send', {
            method: 'POST',
            body: JSON.stringify(otpBody),
        }).catch(() => null);
    };
    // Step 0 CTA disabled until all fields filled
    const step0Valid = nome.trim() !== '' && cpfDisplay.trim() !== '' && dataNascimento.replace(/\D/g, '').length === 8;
    // Step 1 CTA disabled until at least one contact field
    const step1Valid = telefone.trim().length > 0 || email.trim().length > 0;
    // Step 3 CTA disabled until apartment filled (and block if BLOCKS condo)
    const step3Valid = apto.trim() !== '';
    const otpDestination = canal === 'sms' ? telefone : email;
    const otpChannelLabel = canal === 'sms' ? 'SMS' : 'e-mail';
    return (_jsxs("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100dvh',
            background: 'var(--color-app-bg)',
            padding: '4px 24px 24px',
            overflow: 'hidden',
        }, children: [_jsx("button", { type: "button", "aria-label": "Voltar", onClick: handleBack, style: {
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
                    // 44px touch target
                    padding: 3,
                    marginLeft: -3,
                }, children: _jsx(Icon, { name: "arrowL", size: 20 }) }), _jsx(StepDots, { currentStep: step, totalSteps: TOTAL_STEPS }), step === 0 && (_jsxs("div", { style: { flex: 1, display: 'flex', flexDirection: 'column' }, children: [_jsx("h1", { style: {
                            fontFamily: 'var(--font-display)',
                            fontWeight: 700,
                            fontSize: 28,
                            lineHeight: 1.1,
                            letterSpacing: '-0.03em',
                            color: 'var(--color-text)',
                            margin: 0,
                        }, children: "Seus dados" }), _jsx("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 15,
                            color: 'var(--color-text-sec)',
                            marginTop: 8,
                            marginBottom: 24,
                            lineHeight: 1.5,
                        }, children: "Precisamos disso uma \u00FAnica vez, pra deixar sua conta pronta." }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 16 }, children: [_jsx(FieldRow, { label: "Nome completo", icon: "user", value: nome, onChange: setNome, placeholder: "Ex.: Marina Ribeiro" }), _jsx(FieldRow, { label: "CPF", icon: "card", value: cpfDisplay, onChange: handleCpfChange, placeholder: "000.000.000-00", type: "tel", autoComplete: "off" }), _jsx(FieldRow, { label: "Data de nascimento", icon: "calendar", value: dataNascimento, onChange: (v) => setDataNascimento(formatDate(v)), placeholder: "DD / MM / AAAA", type: "tel" })] }), _jsx("div", { style: { flex: 1 } }), error && _jsx(ErrorText, { children: error }), _jsx(PrimaryBtn, { onClick: handleStep0Continue, disabled: !step0Valid, children: "Continuar" })] })), step === 1 && (_jsxs("div", { style: { flex: 1, display: 'flex', flexDirection: 'column' }, children: [_jsx("h1", { style: {
                            fontFamily: 'var(--font-display)',
                            fontWeight: 700,
                            fontSize: 28,
                            lineHeight: 1.1,
                            letterSpacing: '-0.03em',
                            color: 'var(--color-text)',
                            margin: 0,
                        }, children: "Como falamos com voc\u00EA?" }), _jsxs("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 15,
                            color: 'var(--color-text-sec)',
                            marginTop: 8,
                            marginBottom: 24,
                            lineHeight: 1.5,
                        }, children: ["Informe telefone ", _jsx("strong", { style: { color: 'var(--color-text)' }, children: "ou" }), " e-mail (pelo menos um). \u00C9 por a\u00ED que enviamos o c\u00F3digo e os avisos de entrega."] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 16 }, children: [_jsx(FieldRow, { label: "Celular", icon: "phone", value: telefone, onChange: setTelefone, placeholder: "(11) 9 0000-0000", type: "tel", autoComplete: "tel" }), _jsx(FieldRow, { label: "E-mail", icon: "mail", value: email, onChange: setEmail, placeholder: "voce@email.com", type: "email", autoComplete: "email" })] }), _jsx("div", { style: { marginTop: 16 }, children: _jsx(ChannelSelector, { phone: telefone, email: email, selected: canal, onChange: setCanal }) }), _jsx("div", { style: { flex: 1 } }), error && _jsx(ErrorText, { children: error }), _jsx(PrimaryBtn, { onClick: handleStep1Continue, disabled: !step1Valid, children: "Continuar" })] })), step === 2 && (_jsxs("div", { style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }, children: [_jsx("h1", { style: {
                            fontFamily: 'var(--font-display)',
                            fontWeight: 700,
                            fontSize: 28,
                            lineHeight: 1.1,
                            letterSpacing: '-0.03em',
                            color: 'var(--color-text)',
                            margin: 0,
                        }, children: "Onde voc\u00EA mora?" }), _jsx("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 15,
                            color: 'var(--color-text-sec)',
                            marginTop: 8,
                            marginBottom: 16,
                            lineHeight: 1.5,
                        }, children: "Entregamos s\u00F3 nos condom\u00EDnios parceiros j\u00E1 cadastrados." }), condosLoading ? (_jsx("div", { style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }, children: _jsx("span", { style: { fontSize: 15, color: 'var(--color-text-ter)' }, children: "Carregando..." }) })) : (_jsx(CondoSearch, { condos: condos, selectedId: selectedCondoId, onSelect: (id) => {
                            setSelectedCondoId(id);
                            setBloco(null); // reset block when condo changes
                        } })), _jsxs("div", { style: { paddingTop: 16 }, children: [error && _jsx(ErrorText, { children: error }), _jsx(PrimaryBtn, { onClick: handleStep2Continue, disabled: selectedCondoId === null, children: "Continuar" })] })] })), step === 3 && (_jsxs("div", { style: { flex: 1, display: 'flex', flexDirection: 'column' }, children: [_jsx("h1", { style: {
                            fontFamily: 'var(--font-display)',
                            fontWeight: 700,
                            fontSize: 28,
                            lineHeight: 1.1,
                            letterSpacing: '-0.03em',
                            color: 'var(--color-text)',
                            margin: 0,
                        }, children: "Seu endere\u00E7o" }), selectedCondo && (_jsxs("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 15,
                            color: 'var(--color-text-sec)',
                            marginTop: 8,
                            marginBottom: 24,
                            lineHeight: 1.5,
                        }, children: [selectedCondo.name, " \u00B7 ", selectedCondo.neighborhood] })), isBlocksCondo && (_jsx(FieldRow, { label: "Bloco / Torre", icon: "pin", value: bloco ?? '', onChange: (v) => setBloco(v || null), placeholder: "Ex.: Bloco A" })), _jsx(FieldRow, { label: "Apartamento", icon: "pin", value: apto, onChange: setApto, placeholder: "Ex.: 102", type: "tel" }), _jsx("div", { style: { flex: 1 } }), error && _jsx(ErrorText, { children: error }), _jsx(PrimaryBtn, { onClick: handleStep3Submit, disabled: !step3Valid || loading, style: { whiteSpace: 'nowrap' }, children: loading ? 'Enviando...' : 'Enviar código de confirmação' })] })), step === 4 && (_jsxs("div", { style: { flex: 1, display: 'flex', flexDirection: 'column' }, children: [_jsx("h1", { style: {
                            fontFamily: 'var(--font-display)',
                            fontWeight: 700,
                            fontSize: 28,
                            lineHeight: 1.1,
                            letterSpacing: '-0.03em',
                            color: 'var(--color-text)',
                            margin: 0,
                        }, children: "Confirme seu cadastro" }), _jsxs("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 15,
                            color: 'var(--color-text-sec)',
                            marginTop: 8,
                            marginBottom: 24,
                            lineHeight: 1.5,
                        }, children: ["Enviamos 4 d\u00EDgitos por", ' ', _jsx("strong", { style: { color: 'var(--color-text)' }, children: otpChannelLabel }), " para", ' ', _jsx("strong", { style: { color: 'var(--color-text)' }, children: otpDestination }), "."] }), _jsx(OtpInput, { onComplete: (code) => { setOtpCode(code); void handleOtpComplete(code); } }, otpKey), _jsx("div", { style: { marginTop: 16, textAlign: 'center' }, children: _jsx(ResendTimer, { onResend: handleResend }) }), _jsx("div", { style: { flex: 1 } }), error && _jsx(ErrorText, { children: error }), _jsx(PrimaryBtn, { onClick: () => {
                            if (otpCode.length === 4)
                                void handleOtpComplete(otpCode);
                        }, disabled: otpCode.length < 4 || loading, children: loading ? 'Verificando...' : 'Criar conta e ver meu pão' })] }))] }));
}
function FieldRow({ label, icon, value, onChange, placeholder, type = 'text', autoComplete }) {
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
function PrimaryBtn({ onClick, disabled, children, style }) {
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
            ...style,
        }, children: children }));
}
function ErrorText({ children }) {
    return (_jsx("p", { style: {
            fontSize: 12,
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            color: 'var(--color-accent)',
            marginBottom: 8,
            lineHeight: 1.4,
        }, children: children }));
}
