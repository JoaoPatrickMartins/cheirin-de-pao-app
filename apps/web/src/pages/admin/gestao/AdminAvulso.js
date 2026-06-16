import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { apiFetch } from '../../../lib/apiFetch';
import { Icon } from '../../../components/brand/Icon';
// ------------------------------------------------------------------ helpers
function formatBRL(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}
// ------------------------------------------------------------------ componente
export function AdminAvulso({ onBack }) {
    const [limite, setLimite] = useState(10);
    const [precoPorao, setPrecoPorao] = useState(0.5);
    const [referenceCombo, setReferenceCombo] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await apiFetch('/admin/settings/avulso');
                if (res.ok) {
                    const data = (await res.json());
                    setLimite(data.maxQuantity);
                    setPrecoPorao(data.pricePerBread);
                    if (data.referenceCombo)
                        setReferenceCombo(data.referenceCombo);
                }
            }
            catch {
                // falha silenciosa
            }
            finally {
                setIsLoading(false);
            }
        };
        void fetchSettings();
    }, []);
    const handleSalvar = async () => {
        setError(null);
        setIsSaving(true);
        try {
            const res = await apiFetch('/admin/settings/avulso', {
                method: 'PATCH',
                body: JSON.stringify({ maxQuantity: limite, pricePerBread: precoPorao }),
            });
            if (!res.ok) {
                setError('Não foi possível salvar. Tente novamente.');
            }
        }
        catch {
            setError('Erro de conexão. Tente novamente.');
        }
        finally {
            setIsSaving(false);
        }
    };
    // Cálculo da prévia
    const totalAvulso = precoPorao * limite;
    const comboPrecoPorPao = referenceCombo
        ? referenceCombo.price / referenceCombo.quantity
        : null;
    const avulsoMaisCaroPorPao = comboPrecoPorPao !== null && precoPorao > comboPrecoPorPao;
    const percentDiff = comboPrecoPorPao !== null && comboPrecoPorPao > 0
        ? Math.round(((precoPorao - comboPrecoPorPao) / comboPrecoPorPao) * 100)
        : null;
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
                        }, children: "Compra personalizada" })] }), _jsxs("div", { style: { overflow: 'auto', flex: 1, padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }, children: [_jsx("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 13.5,
                            color: 'var(--color-text-sec)',
                            lineHeight: 1.5,
                            margin: 0,
                        }, children: "O pre\u00E7o por p\u00E3o deve ficar acima do melhor combo para empurrar o cliente ao combo." }), isLoading ? (_jsx("div", { style: { textAlign: 'center', paddingTop: 32 }, children: _jsx("span", { style: { fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }, children: "Carregando..." }) })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                                    background: 'var(--color-surface)',
                                    border: '1px solid var(--color-border-2)',
                                    borderRadius: 16,
                                    padding: 18,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 0,
                                }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, children: [_jsxs("div", { children: [_jsx("p", { style: {
                                                            fontFamily: 'var(--font-body)',
                                                            fontSize: 14,
                                                            fontWeight: 700,
                                                            color: 'var(--color-text)',
                                                            margin: 0,
                                                        }, children: "Limite m\u00E1ximo" }), _jsx("p", { style: {
                                                            fontFamily: 'var(--font-body)',
                                                            fontSize: 11.5,
                                                            fontWeight: 600,
                                                            color: 'var(--color-text-ter)',
                                                            margin: '2px 0 0',
                                                        }, children: "A partir daqui, s\u00F3 via combo" })] }), _jsx(NumberStepper, { value: limite, min: 1, max: 100, onChange: setLimite })] }), _jsx("div", { style: {
                                            height: 1,
                                            background: 'var(--color-border-2)',
                                            margin: '14px 0',
                                        } }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, children: [_jsxs("div", { children: [_jsx("p", { style: {
                                                            fontFamily: 'var(--font-body)',
                                                            fontSize: 14,
                                                            fontWeight: 700,
                                                            color: 'var(--color-text)',
                                                            margin: 0,
                                                        }, children: "Pre\u00E7o por p\u00E3o" }), _jsx("p", { style: {
                                                            fontFamily: 'var(--font-body)',
                                                            fontSize: 11.5,
                                                            fontWeight: 600,
                                                            color: 'var(--color-text-ter)',
                                                            margin: '2px 0 0',
                                                        }, children: "Compra personalizada" })] }), _jsx(PriceStepper, { value: precoPorao, step: 0.05, min: 0.05, onChange: setPrecoPorao })] })] }), _jsxs("div", { style: {
                                    background: 'var(--color-espresso)',
                                    borderRadius: 16,
                                    padding: 16,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 10,
                                }, children: [_jsx("p", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 11.5,
                                            fontWeight: 700,
                                            color: '#E3AC3F',
                                            letterSpacing: '0.06em',
                                            margin: 0,
                                        }, children: "PR\u00C9VIA DO INCENTIVO" }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsxs("span", { style: {
                                                    fontFamily: 'var(--font-body)',
                                                    fontSize: 13.5,
                                                    color: '#C7B595',
                                                }, children: ["Avulso (at\u00E9 ", limite, " p\u00E3es)"] }), _jsx("span", { style: {
                                                    fontFamily: 'var(--font-display)',
                                                    fontSize: 16,
                                                    fontWeight: 800,
                                                    color: '#FAF5EC',
                                                }, children: formatBRL(totalAvulso) })] }), referenceCombo && (_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, children: [_jsxs("span", { style: {
                                                    fontFamily: 'var(--font-body)',
                                                    fontSize: 13.5,
                                                    color: '#C7B595',
                                                }, children: [referenceCombo.name, " (", referenceCombo.quantity, " p\u00E3es)"] }), _jsx("span", { style: {
                                                    fontFamily: 'var(--font-display)',
                                                    fontSize: 16,
                                                    fontWeight: 800,
                                                    color: '#E3AC3F',
                                                }, children: formatBRL(referenceCombo.price) })] })), percentDiff !== null && (_jsx("div", { style: {
                                            borderRadius: 12,
                                            background: avulsoMaisCaroPorPao
                                                ? 'rgba(227,172,63,0.16)'
                                                : 'rgba(176,112,42,0.16)',
                                            padding: '10px 12px',
                                            textAlign: 'center',
                                        }, children: _jsx("span", { style: {
                                                fontFamily: 'var(--font-body)',
                                                fontSize: 13.5,
                                                fontWeight: 700,
                                                color: avulsoMaisCaroPorPao ? '#E3AC3F' : '#C7B595',
                                            }, children: avulsoMaisCaroPorPao
                                                ? `Combo fica ${Math.abs(percentDiff)}% mais barato por pão`
                                                : 'Ajuste: o avulso precisa custar mais que o combo' }) }))] }), error && (_jsx("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: 'var(--color-accent)',
                                    margin: 0,
                                }, children: error })), _jsx("button", { type: "button", onClick: () => void handleSalvar(), disabled: isSaving, style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    width: '100%',
                                    minHeight: 44,
                                    background: 'var(--color-espresso)',
                                    color: '#FAF5EC',
                                    border: 'none',
                                    borderRadius: 14,
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 15,
                                    fontWeight: 700,
                                    cursor: isSaving ? 'default' : 'pointer',
                                    opacity: isSaving ? 0.6 : 1,
                                    letterSpacing: '-0.01em',
                                }, children: isSaving ? 'Salvando...' : 'Salvar configuração' })] }))] })] }));
}
function NumberStepper({ value, min, max, onChange }) {
    return (_jsxs("div", { style: {
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            overflow: 'hidden',
            flexShrink: 0,
        }, children: [_jsx("button", { type: "button", "aria-label": "Diminuir", onClick: () => onChange(Math.max(min, value - 1)), disabled: value <= min, style: {
                    width: 36,
                    height: 36,
                    border: 'none',
                    background: 'var(--color-surface)',
                    cursor: value <= min ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: value <= min ? 0.4 : 1,
                }, children: _jsx(Icon, { name: "minus", size: 16, color: "var(--color-text)" }) }), _jsx("span", { style: {
                    minWidth: 32,
                    textAlign: 'center',
                    fontFamily: 'var(--font-display)',
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'var(--color-text)',
                }, children: value }), _jsx("button", { type: "button", "aria-label": "Aumentar", onClick: () => onChange(Math.min(max, value + 1)), disabled: value >= max, style: {
                    width: 36,
                    height: 36,
                    border: 'none',
                    background: 'var(--color-surface)',
                    cursor: value >= max ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: value >= max ? 0.4 : 1,
                }, children: _jsx(Icon, { name: "plus", size: 16, color: "var(--color-text)" }) })] }));
}
function PriceStepper({ value, step, min, onChange }) {
    const decrement = () => {
        const next = Math.round((value - step) * 100) / 100;
        if (next >= min)
            onChange(next);
    };
    const increment = () => {
        const next = Math.round((value + step) * 100) / 100;
        onChange(next);
    };
    return (_jsxs("div", { style: {
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            overflow: 'hidden',
            flexShrink: 0,
        }, children: [_jsx("button", { type: "button", "aria-label": "Diminuir pre\u00E7o", onClick: decrement, disabled: value <= min, style: {
                    width: 36,
                    height: 36,
                    border: 'none',
                    background: 'var(--color-surface)',
                    cursor: value <= min ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: value <= min ? 0.4 : 1,
                }, children: _jsx(Icon, { name: "minus", size: 16, color: "var(--color-text)" }) }), _jsxs("span", { style: {
                    minWidth: 52,
                    textAlign: 'center',
                    fontFamily: 'var(--font-display)',
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--color-text)',
                }, children: ["R$ ", value.toFixed(2)] }), _jsx("button", { type: "button", "aria-label": "Aumentar pre\u00E7o", onClick: increment, style: {
                    width: 36,
                    height: 36,
                    border: 'none',
                    background: 'var(--color-surface)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }, children: _jsx(Icon, { name: "plus", size: 16, color: "var(--color-text)" }) })] }));
}
