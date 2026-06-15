import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { apiFetch } from '../../lib/apiFetch';
import { Icon } from '../../components/brand/Icon';
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const formatBRL = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export function AutoBuyScreen() {
    const navigate = useNavigate();
    const [isOn, setIsOn] = useState(false);
    const [mode, setMode] = useState('acabar');
    const [weekday, setWeekday] = useState('Seg');
    const [combos, setCombos] = useState([]);
    const [selectedComboId, setSelectedComboId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState(false);
    useEffect(() => {
        const load = async () => {
            try {
                const res = await apiFetch('/combos');
                if (res.ok) {
                    const data = (await res.json());
                    setCombos(data);
                    if (data.length > 0)
                        setSelectedComboId(data[0].id);
                }
            }
            catch {
                // combos são opcionais para carregar a tela
            }
            finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);
    const handleSave = async () => {
        if (!selectedComboId)
            return;
        setIsSaving(true);
        setError(null);
        try {
            const body = {
                mode,
                comboId: selectedComboId,
                active: isOn,
            };
            if (mode === 'semanal')
                body.weekday = weekday;
            const res = await apiFetch('/users/me/auto-recharge', {
                method: 'PUT',
                body: JSON.stringify(body),
            });
            if (res.ok) {
                setSaved(true);
                setTimeout(() => navigate(-1), 1200);
            }
            else {
                const err = (await res.json());
                setError(err.error ?? 'Não foi possível salvar. Tente novamente.');
            }
        }
        catch {
            setError('Algo deu errado. Verifique sua conexão e tente novamente.');
        }
        finally {
            setIsSaving(false);
        }
    };
    const selectedCombo = combos.find((c) => c.id === selectedComboId);
    const ctaLabel = isOn && selectedCombo
        ? `Ativar — ${selectedCombo.name} (${formatBRL(selectedCombo.price)})`
        : 'Salvar';
    return (_jsxs("div", { style: {
            minHeight: 'calc(100dvh - 56px - env(safe-area-inset-bottom))',
            background: 'var(--color-app-bg)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
        }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsx("h1", { style: {
                            fontFamily: 'var(--font-display)',
                            fontWeight: 700,
                            fontSize: 21,
                            color: 'var(--color-text)',
                            letterSpacing: '-0.02em',
                            margin: 0,
                        }, children: "Compra autom\u00E1tica" }), _jsx("button", { onClick: () => setIsOn(!isOn), "aria-label": isOn ? 'desativar compra automática' : 'ativar compra automática', style: {
                            width: 52,
                            height: 30,
                            borderRadius: 999,
                            border: 'none',
                            background: isOn ? 'var(--color-accent)' : 'var(--color-border)',
                            cursor: 'pointer',
                            position: 'relative',
                            transition: 'background .2s',
                            padding: 0,
                        }, children: _jsx("div", { style: {
                                position: 'absolute',
                                top: 3,
                                left: isOn ? 25 : 3,
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                background: 'white',
                                transition: 'left .2s',
                                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                            } }) })] }), isOn && (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 }, children: [_jsx("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontWeight: 600,
                                    fontSize: 12.5,
                                    letterSpacing: '0.04em',
                                    color: 'var(--color-text-sec)',
                                    margin: 0,
                                }, children: "QUANDO COMPRAR?" }), [
                                { value: 'acabar', label: 'Quando estiver acabando' },
                                { value: 'semanal', label: 'Toda semana' },
                            ].map((opt) => (_jsxs("button", { onClick: () => setMode(opt.value), style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: '14px 16px',
                                    borderRadius: 16,
                                    border: mode === opt.value
                                        ? '2px solid var(--color-accent)'
                                        : '2px solid var(--color-border-2)',
                                    background: 'var(--color-surface)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    minHeight: 44,
                                }, children: [_jsx("div", { style: {
                                            width: 26,
                                            height: 26,
                                            borderRadius: '50%',
                                            border: mode === opt.value
                                                ? '2px solid var(--color-accent)'
                                                : '2px solid var(--color-border)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }, children: mode === opt.value && (_jsx("div", { style: {
                                                width: 13,
                                                height: 13,
                                                borderRadius: '50%',
                                                background: 'var(--color-accent)',
                                            } })) }), _jsx("span", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontWeight: 600,
                                            fontSize: 14,
                                            color: 'var(--color-text)',
                                        }, children: opt.label })] }, opt.value)))] }), mode === 'semanal' && (_jsxs("div", { children: [_jsx("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontWeight: 600,
                                    fontSize: 12.5,
                                    letterSpacing: '0.04em',
                                    color: 'var(--color-text-sec)',
                                    margin: '0 0 10px 0',
                                }, children: "DIA DA SEMANA" }), _jsx("div", { style: { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }, children: WEEKDAYS.map((day) => (_jsx("button", { onClick: () => setWeekday(day), style: {
                                        minHeight: 44,
                                        padding: '8px 14px',
                                        borderRadius: 'var(--radius-btn)',
                                        border: weekday === day
                                            ? '1.5px solid var(--color-accent)'
                                            : '1.5px solid var(--color-border)',
                                        background: weekday === day ? 'var(--color-accent)' : 'var(--color-surface)',
                                        color: weekday === day
                                            ? 'var(--color-primary-btn-text)'
                                            : 'var(--color-text)',
                                        fontFamily: 'var(--font-body)',
                                        fontWeight: 600,
                                        fontSize: 13,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                    }, children: day }, day))) })] })), !isLoading && combos.length > 0 && (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 }, children: [_jsx("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontWeight: 600,
                                    fontSize: 12.5,
                                    letterSpacing: '0.04em',
                                    color: 'var(--color-text-sec)',
                                    margin: 0,
                                }, children: "QUAL COMBO?" }), combos.map((combo) => (_jsxs("button", { onClick: () => setSelectedComboId(combo.id), style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: '14px 16px',
                                    borderRadius: 16,
                                    border: selectedComboId === combo.id
                                        ? '2px solid var(--color-accent)'
                                        : '2px solid var(--color-border-2)',
                                    background: 'var(--color-surface)',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    minHeight: 44,
                                }, children: [_jsx("div", { style: {
                                            width: 22,
                                            height: 22,
                                            borderRadius: '50%',
                                            border: selectedComboId === combo.id
                                                ? '2px solid var(--color-accent)'
                                                : '2px solid var(--color-border)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }, children: selectedComboId === combo.id && (_jsx("div", { style: {
                                                width: 11,
                                                height: 11,
                                                borderRadius: '50%',
                                                background: 'var(--color-accent)',
                                            } })) }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("p", { style: {
                                                    fontFamily: 'var(--font-body)',
                                                    fontWeight: 600,
                                                    fontSize: 14,
                                                    color: 'var(--color-text)',
                                                    margin: 0,
                                                }, children: combo.name }), _jsxs("p", { style: {
                                                    fontFamily: 'var(--font-body)',
                                                    fontSize: 13,
                                                    color: 'var(--color-text-sec)',
                                                    margin: 0,
                                                }, children: [combo.quantity, " p\u00E3es"] })] }), _jsx("p", { style: {
                                            fontFamily: 'var(--font-display)',
                                            fontWeight: 700,
                                            fontSize: 16,
                                            color: 'var(--color-accent)',
                                            margin: 0,
                                        }, children: formatBRL(combo.price) })] }, combo.id)))] })), _jsx("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 13,
                            color: 'var(--color-text-sec)',
                            margin: 0,
                        }, children: "Cobramos no Pix salvo. Voc\u00EA recebe um aviso a cada compra autom\u00E1tica." })] })), error && (_jsx("p", { style: { color: 'var(--color-accent)', fontSize: 14, margin: 0 }, children: error })), saved && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx(Icon, { name: "check", size: 18, color: "var(--color-good)" }), _jsx("p", { style: { fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-good)', margin: 0 }, children: "Prefer\u00EAncia salva!" })] })), _jsx("button", { onClick: handleSave, disabled: isSaving || (isOn && !selectedComboId), style: {
                    width: '100%',
                    minHeight: 52,
                    borderRadius: 'var(--radius-btn)',
                    border: 'none',
                    background: 'var(--color-accent)',
                    color: 'var(--color-primary-btn-text)',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 16,
                    cursor: isSaving || (isOn && !selectedComboId) ? 'default' : 'pointer',
                    opacity: isSaving || (isOn && !selectedComboId) ? 0.7 : 1,
                    marginTop: 'auto',
                }, children: isSaving ? 'Salvando...' : ctaLabel })] }));
}
