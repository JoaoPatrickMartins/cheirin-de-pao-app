import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import { apiFetch } from '../../lib/apiFetch';
import ComboCard from '../../components/client/ComboCard';
import QuantityStepper from '../../components/client/QuantityStepper';
import BannerInsuficiente from '../../components/client/BannerInsuficiente';
const formatBRL = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export function CombosScreen() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [tab, setTab] = useState('combos');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [combos, setCombos] = useState([]);
    const [pricing, setPricing] = useState(null);
    const [selectedCombo, setSelectedCombo] = useState(null);
    const [customQty, setCustomQty] = useState(1);
    const [paymentMethod, setPaymentMethod] = useState('pix');
    const [isBuying, setIsBuying] = useState(false);
    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const [combosRes, pricingRes] = await Promise.all([
                    apiFetch('/combos'),
                    apiFetch('/pricing'),
                ]);
                if (combosRes.ok) {
                    const data = (await combosRes.json());
                    setCombos(data);
                    if (data.length > 0)
                        setSelectedCombo(data[0]);
                }
                if (pricingRes.ok) {
                    const data = (await pricingRes.json());
                    setPricing(data);
                }
            }
            catch {
                setError('Não foi possível carregar os combos. Tente novamente.');
            }
            finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);
    const handleComprar = async () => {
        if (isBuying)
            return;
        setIsBuying(true);
        setError(null);
        try {
            if (paymentMethod === 'card') {
                const amount = tab === 'combos' && selectedCombo
                    ? selectedCombo.price
                    : (pricing?.avulsoUnit ?? 0) * customQty;
                navigate('/client/creditos/cartao', {
                    state: { comboId: selectedCombo?.id, customQuantity: customQty, amount },
                });
                return;
            }
            const body = tab === 'combos' && selectedCombo
                ? { comboId: selectedCombo.id }
                : { customQuantity: customQty };
            const res = await apiFetch('/payments/pix', {
                method: 'POST',
                body: JSON.stringify(body),
            });
            if (res.ok) {
                const { paymentId, qr_code_base64: qrCodeBase64, qr_code: qrCode } = (await res.json());
                const comboQuantity = selectedCombo?.quantity ?? customQty;
                navigate('/client/creditos/pix', {
                    state: { paymentId, qrCodeBase64, qrCode, comboQuantity },
                });
            }
            else {
                const err = (await res.json());
                setError(err.error ?? 'Algo deu errado. Tente novamente.');
            }
        }
        catch {
            setError('Algo deu errado. Verifique sua conexão e tente novamente.');
        }
        finally {
            setIsBuying(false);
        }
    };
    const creditBalance = user?.creditBalance ?? 0;
    const requiredCredits = tab === 'combos' ? (selectedCombo?.quantity ?? 0) : customQty;
    const bestComboUnit = combos.length > 0 ? Math.min(...combos.map((c) => c.price / c.quantity)) : null;
    const avulsoUnit = pricing?.avulsoUnit ?? 0;
    const economia = bestComboUnit !== null && avulsoUnit > bestComboUnit
        ? Math.round(((avulsoUnit - bestComboUnit) / avulsoUnit) * 100)
        : 0;
    const ctaLabel = tab === 'combos'
        ? selectedCombo
            ? `Comprar ${selectedCombo.name}`
            : 'Selecione um combo'
        : `Comprar ${customQty} ${customQty === 1 ? 'pão' : 'pães'}`;
    return (_jsxs("div", { style: {
            minHeight: 'calc(100dvh - 56px - env(safe-area-inset-bottom))',
            background: 'var(--color-app-bg)',
            display: 'flex',
            flexDirection: 'column',
        }, children: [_jsxs("div", { style: { padding: '20px 20px 0' }, children: [_jsx("h1", { style: {
                            fontFamily: 'var(--font-display)',
                            fontWeight: 700,
                            fontSize: 21,
                            color: 'var(--color-text)',
                            letterSpacing: '-0.02em',
                            margin: '0 0 16px 0',
                        }, children: "Cr\u00E9ditos" }), _jsx("div", { style: {
                            display: 'flex',
                            background: 'var(--color-surface-2)',
                            borderRadius: 14,
                            padding: 4,
                            gap: 6,
                            marginBottom: 20,
                        }, children: ['combos', 'avulso'].map((t) => (_jsx("button", { onClick: () => setTab(t), style: {
                                flex: 1,
                                minHeight: 44,
                                borderRadius: 11,
                                border: 'none',
                                background: tab === t ? 'var(--color-surface)' : 'transparent',
                                boxShadow: tab === t ? 'var(--shadow-soft)' : 'none',
                                fontFamily: 'var(--font-body)',
                                fontWeight: 600,
                                fontSize: 14,
                                color: tab === t ? 'var(--color-text)' : 'var(--color-text-sec)',
                                cursor: 'pointer',
                                transition: 'background .15s, box-shadow .15s',
                            }, children: t === 'combos' ? 'Combos' : 'Compra personalizada' }, t))) })] }), _jsxs("div", { style: { flex: 1, padding: '0 20px', paddingBottom: 116, overflowY: 'auto' }, children: [error && (_jsx("p", { style: { color: 'var(--color-accent)', fontSize: 14, marginBottom: 12 }, children: error })), isLoading ? (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: [0, 1, 2].map((i) => (_jsx("div", { style: { height: 90, borderRadius: 22, background: 'var(--color-surface-2)' } }, i))) })) : tab === 'combos' ? (combos.length === 0 ? (_jsx("div", { style: {
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 12,
                            padding: '40px 0',
                        }, children: _jsx("p", { style: { color: 'var(--color-text-ter)', fontSize: 15, textAlign: 'center' }, children: "Nenhum combo dispon\u00EDvel no momento." }) })) : (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: [creditBalance < requiredCredits && requiredCredits > 0 && (_jsx(BannerInsuficiente, { saldo: creditBalance, requerido: requiredCredits, onComprar: () => setTab('combos'), onAjustar: (qtd) => setCustomQty(qtd) })), combos.map((combo) => (_jsx(ComboCard, { combo: combo, selected: selectedCombo?.id === combo.id, onSelect: () => setSelectedCombo(combo) }, combo.id))), _jsx("div", { style: {
                                    background: 'var(--color-good-soft)',
                                    borderRadius: 12,
                                    padding: '10px 14px',
                                    marginTop: 4,
                                }, children: _jsx("p", { style: {
                                        fontFamily: 'var(--font-body)',
                                        fontSize: 13,
                                        color: 'var(--color-good)',
                                        margin: 0,
                                    }, children: "\u2713 Cr\u00E9ditos n\u00E3o expiram. Pause quando viajar." }) })] }))) : (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 20 }, children: [creditBalance < customQty && (_jsx(BannerInsuficiente, { saldo: creditBalance, requerido: customQty, onComprar: () => setTab('combos'), onAjustar: (qtd) => setCustomQty(qtd) })), _jsx("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontWeight: 600,
                                    fontSize: 12.5,
                                    letterSpacing: '0.04em',
                                    color: 'var(--color-text-sec)',
                                    margin: 0,
                                }, children: "QUANTOS P\u00C3ES?" }), _jsx("div", { style: { display: 'flex', justifyContent: 'center' }, children: _jsx(QuantityStepper, { min: 1, max: pricing ? pricing.avulsoLimite - 1 : 29, value: customQty, onChange: setCustomQty }) }), pricing && (_jsxs("div", { style: { textAlign: 'center' }, children: [_jsxs("p", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 15,
                                            color: 'var(--color-text-sec)',
                                            margin: 0,
                                        }, children: [formatBRL(pricing.avulsoUnit), " por p\u00E3o"] }), economia > 0 && (_jsxs("p", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 13,
                                            color: 'var(--color-accent)',
                                            margin: '4px 0 0 0',
                                            fontWeight: 600,
                                        }, children: [economia, "% mais barato por p\u00E3o nos combos"] }))] })), _jsx("div", { style: {
                                    background: 'var(--color-good-soft)',
                                    borderRadius: 12,
                                    padding: '10px 14px',
                                }, children: _jsx("p", { style: {
                                        fontFamily: 'var(--font-body)',
                                        fontSize: 13,
                                        color: 'var(--color-good)',
                                        margin: 0,
                                    }, children: "\u2713 Cr\u00E9ditos n\u00E3o expiram. Pause quando viajar." }) })] }))] }), !isLoading && (_jsxs("div", { style: {
                    position: 'fixed',
                    bottom: 'calc(56px + env(safe-area-inset-bottom))',
                    left: 0,
                    right: 0,
                    padding: '10px 20px 12px',
                    background: 'var(--color-app-bg)',
                    borderTop: '1px solid var(--color-border-2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                }, children: [_jsx("div", { style: { display: 'flex', gap: 8 }, children: ['pix', 'card'].map((m) => (_jsx("button", { onClick: () => setPaymentMethod(m), style: {
                                flex: 1,
                                minHeight: 36,
                                borderRadius: 'var(--radius-btn)',
                                border: paymentMethod === m
                                    ? '1.5px solid var(--color-accent)'
                                    : '1.5px solid var(--color-border)',
                                background: paymentMethod === m ? 'var(--color-surface)' : 'transparent',
                                color: paymentMethod === m ? 'var(--color-accent)' : 'var(--color-text-sec)',
                                fontFamily: 'var(--font-body)',
                                fontWeight: 600,
                                fontSize: 13,
                                cursor: 'pointer',
                                transition: 'all .15s',
                            }, children: m === 'pix' ? 'Pix' : 'Cartão' }, m))) }), _jsx("button", { onClick: handleComprar, disabled: isBuying || (tab === 'combos' && !selectedCombo), style: {
                            width: '100%',
                            minHeight: 52,
                            borderRadius: 'var(--radius-btn)',
                            border: 'none',
                            background: 'var(--color-accent)',
                            color: 'var(--color-primary-btn-text)',
                            fontFamily: 'var(--font-display)',
                            fontWeight: 700,
                            fontSize: 16,
                            cursor: isBuying || (tab === 'combos' && !selectedCombo) ? 'default' : 'pointer',
                            opacity: isBuying || (tab === 'combos' && !selectedCombo) ? 0.7 : 1,
                        }, children: isBuying ? 'Processando...' : ctaLabel })] }))] }));
}
