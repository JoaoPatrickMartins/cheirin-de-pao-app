import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { apiFetch } from '../../../lib/apiFetch';
import { AdminHead } from '../../../components/admin/AdminHead';
import { StepBar } from '../../../components/admin/StepBar';
import { Icon } from '../../../components/brand/Icon';
import StepperInline from '../../../components/client/StepperInline';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getTomorrowLabel() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dia = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', timeZone: 'America/Sao_Paulo' }).format(tomorrow);
    const mes = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'America/Sao_Paulo' }).format(tomorrow);
    return `${dia} ${mes}`;
}
function formatCurrency(value) {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDate(date) {
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'long',
        timeZone: 'America/Sao_Paulo',
    }).format(date);
}
// ---------------------------------------------------------------------------
// Sub-componente: Spinner inline
// ---------------------------------------------------------------------------
function Spinner() {
    return (_jsx("div", { style: { display: 'flex', justifyContent: 'center', padding: '40px 0' }, children: _jsx("div", { style: {
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '3px solid var(--color-border)',
                borderTopColor: 'var(--color-accent)',
                animation: 'spin 0.8s linear infinite',
            } }) }));
}
function Footer({ label, totalLabel, totalValue, ctaLabel, ctaIcon, onCta, isLoading }) {
    return (_jsxs("div", { style: {
            position: 'sticky',
            bottom: 0,
            background: 'var(--color-app-bg)',
            borderTop: '1px solid var(--color-border-2)',
            padding: '12px 20px 16px',
        }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                }, children: [_jsx("span", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: 'var(--color-text-sec)',
                        }, children: totalLabel }), _jsx("span", { style: {
                            fontFamily: 'var(--font-display)',
                            fontSize: 22,
                            fontWeight: 800,
                            letterSpacing: '-0.02em',
                            color: 'var(--color-text)',
                        }, children: typeof totalValue === 'number' ? `${totalValue} pães` : totalValue })] }), _jsxs("button", { onClick: onCta, disabled: !!isLoading, style: {
                    width: '100%',
                    padding: '14px 20px',
                    borderRadius: 16,
                    border: 'none',
                    background: 'var(--color-accent)',
                    color: '#fff',
                    fontFamily: 'var(--font-body)',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: isLoading ? 'wait' : 'pointer',
                    opacity: isLoading ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    minHeight: 44,
                }, "aria-label": ctaLabel, children: [ctaIcon && _jsx(Icon, { name: ctaIcon, size: 18, color: "#fff", stroke: 2.1 }), ctaLabel] }), label && (_jsx("p", { style: {
                    fontFamily: 'var(--font-body)',
                    fontSize: 11,
                    color: 'var(--color-text-ter)',
                    textAlign: 'center',
                    margin: '6px 0 0',
                }, children: label }))] }));
}
// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------
export function AdminPedido() {
    const [step, setStep] = useState(0);
    // Dados do draft
    const [draftData, setDraftData] = useState(null);
    const [cutoff, setCutoff] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    // Step 1 — quantidades ajustadas
    const [adjustedQts, setAdjustedQts] = useState({});
    // Step 2 — fornecedores e divisão
    const [suppliers, setSuppliers] = useState(null);
    const [split, setSplit] = useState({ p: 0, r: 0 });
    const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);
    // Step 2 -> 3 — confirmar pedido
    const [isCreating, setIsCreating] = useState(false);
    const [orderId, setOrderId] = useState(null);
    // Step 3 — download
    const [isDownloading, setIsDownloading] = useState(null);
    // ---------------------------------------------------------------------------
    // Busca inicial: draft + cutoff
    // ---------------------------------------------------------------------------
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [draftRes, cutoffRes] = await Promise.all([
                    apiFetch('/admin/supplier-orders/draft'),
                    apiFetch('/admin/settings/cutoff'),
                ]);
                if (draftRes.ok) {
                    setDraftData((await draftRes.json()));
                }
                if (cutoffRes.ok) {
                    setCutoff((await cutoffRes.json()));
                }
            }
            catch {
                // falha silenciosa
            }
            finally {
                setIsLoading(false);
            }
        };
        void fetchData();
    }, []);
    // ---------------------------------------------------------------------------
    // Totais derivados
    // ---------------------------------------------------------------------------
    const draftTotal = draftData ? draftData.reduce((sum, c) => sum + c.totalBreads, 0) : 0;
    const adjustedTotal = draftData
        ? draftData.reduce((sum, c) => sum + (adjustedQts[c.condominiumId] ?? c.totalBreads), 0)
        : 0;
    const principal = suppliers?.find((s) => s.isPrincipal) ?? null;
    const reserva = suppliers?.find((s) => !s.isPrincipal) ?? null;
    const splitTotal = split.p + split.r;
    // ---------------------------------------------------------------------------
    // Handlers de navegação
    // ---------------------------------------------------------------------------
    function goToStep1() {
        // Inicializa adjustedQts com valores do draft
        if (draftData) {
            const initial = {};
            draftData.forEach((c) => { initial[c.condominiumId] = c.totalBreads; });
            setAdjustedQts(initial);
        }
        setStep(1);
    }
    async function goToStep2() {
        setIsLoadingSuppliers(true);
        try {
            const res = await apiFetch('/admin/suppliers');
            if (res.ok) {
                const data = (await res.json());
                setSuppliers(data);
                // divisão inicial 75/25
                const p = Math.round(adjustedTotal * 0.75);
                const r = adjustedTotal - p;
                setSplit({ p, r });
            }
        }
        catch {
            // falha silenciosa — manter step 1
        }
        finally {
            setIsLoadingSuppliers(false);
        }
        setStep(2);
    }
    async function finalizarPedido() {
        if (!principal || !reserva)
            return;
        // Validar que pelo menos um tem quantidade > 0
        if (split.p === 0 && split.r === 0)
            return;
        setIsCreating(true);
        try {
            const items = [
                { supplierId: principal.id, quantity: split.p },
                { supplierId: reserva.id, quantity: split.r },
            ].filter((item) => item.quantity > 0);
            const res = await apiFetch('/admin/supplier-orders', {
                method: 'POST',
                body: JSON.stringify({ items }),
            });
            if (res.ok) {
                const data = (await res.json());
                setOrderId(data.id);
                setStep(3);
            }
        }
        catch {
            // falha silenciosa
        }
        finally {
            setIsCreating(false);
        }
    }
    async function downloadFile(type) {
        if (!orderId)
            return;
        setIsDownloading(type);
        try {
            const endpoint = type === 'pdf'
                ? `/admin/supplier-orders/${orderId}/pdf`
                : `/admin/supplier-orders/${orderId}/excel`;
            const res = await apiFetch(endpoint);
            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = type === 'pdf' ? 'pedido.pdf' : 'pedido.xlsx';
                a.click();
                URL.revokeObjectURL(url);
            }
        }
        catch {
            // falha silenciosa
        }
        finally {
            setIsDownloading(null);
        }
    }
    function resetToStart() {
        setStep(0);
        setOrderId(null);
        setAdjustedQts({});
        setSplit({ p: 0, r: 0 });
        setSuppliers(null);
    }
    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------
    const tomorrowLabel = getTomorrowLabel();
    return (_jsxs("div", { style: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }, children: [_jsx(AdminHead, { sub: `Para amanhã · ${tomorrowLabel}`, titulo: "Pedido ao fornecedor" }), _jsx(StepBar, { step: step, onStepClick: (i) => setStep(i) }), step === 0 && (_jsxs("div", { style: { flex: 1, display: 'flex', flexDirection: 'column' }, children: [_jsx("div", { style: { flex: 1, padding: '0 20px', overflowY: 'auto' }, children: isLoading ? (_jsx(Spinner, {})) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                                        background: 'var(--color-surface)',
                                        borderRadius: 18,
                                        padding: 16,
                                        border: '1px solid var(--color-border-2)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 14,
                                        marginBottom: 20,
                                    }, children: [_jsx("div", { style: {
                                                width: 44,
                                                height: 44,
                                                borderRadius: 12,
                                                background: 'var(--color-gold-soft)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                color: 'var(--color-accent)',
                                            }, children: _jsx(Icon, { name: "scissors", size: 22, color: "var(--color-accent)", stroke: 2 }) }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsxs("p", { style: {
                                                        fontFamily: 'var(--font-body)',
                                                        fontSize: 14.5,
                                                        fontWeight: 700,
                                                        color: 'var(--color-text)',
                                                        margin: '0 0 2px',
                                                    }, children: ["Hor\u00E1rio de corte \u00B7 ", cutoff?.cutoffTime ?? '20:00'] }), _jsx("p", { style: {
                                                        fontFamily: 'var(--font-body)',
                                                        fontSize: 12,
                                                        color: 'var(--color-text-ter)',
                                                        margin: 0,
                                                    }, children: "Ap\u00F3s o corte, pedidos do dia s\u00E3o bloqueados" })] }), _jsx("span", { style: {
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                padding: '4px 10px',
                                                borderRadius: 99,
                                                background: cutoff?.isOpen !== false ? 'var(--color-good-soft)' : 'var(--color-surface-2)',
                                                color: cutoff?.isOpen !== false ? 'var(--color-good)' : 'var(--color-text-sec)',
                                                fontFamily: 'var(--font-body)',
                                                fontSize: 12,
                                                fontWeight: 700,
                                                whiteSpace: 'nowrap',
                                                flexShrink: 0,
                                            }, children: cutoff?.isOpen !== false ? 'Aberto' : 'Encerrado' })] }), _jsx("p", { style: {
                                        fontFamily: 'var(--font-body)',
                                        fontSize: 12.5,
                                        fontWeight: 700,
                                        color: 'var(--color-text-sec)',
                                        letterSpacing: '0.04em',
                                        margin: '4px 2px 9px',
                                    }, children: "CONSOLIDADO POR CONDOM\u00CDNIO" }), !draftData || draftData.length === 0 ? (_jsxs("div", { style: { textAlign: 'center', padding: '32px 0' }, children: [_jsx("p", { style: {
                                                fontFamily: 'var(--font-display)',
                                                fontSize: 18,
                                                fontWeight: 700,
                                                color: 'var(--color-text)',
                                                margin: '0 0 8px',
                                            }, children: "Sem pedidos hoje" }), _jsx("p", { style: {
                                                fontFamily: 'var(--font-body)',
                                                fontSize: 14,
                                                color: 'var(--color-text-sec)',
                                                margin: 0,
                                            }, children: "Nenhum cliente agendou entrega para amanh\u00E3." })] })) : (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 }, children: draftData.map((condo) => (_jsxs("div", { style: {
                                            background: 'var(--color-surface)',
                                            borderRadius: 16,
                                            padding: 14,
                                            border: '1px solid var(--color-border-2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 12,
                                        }, children: [_jsx("div", { style: {
                                                    width: 42,
                                                    height: 42,
                                                    borderRadius: 12,
                                                    background: 'var(--color-surface-2)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0,
                                                    color: 'var(--color-accent)',
                                                }, children: _jsx(Icon, { name: "building", size: 20, color: "var(--color-accent)", stroke: 2 }) }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("p", { style: {
                                                            fontFamily: 'var(--font-body)',
                                                            fontSize: 14.5,
                                                            fontWeight: 700,
                                                            color: 'var(--color-text)',
                                                            margin: '0 0 2px',
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                        }, children: condo.name }), _jsxs("p", { style: {
                                                            fontFamily: 'var(--font-body)',
                                                            fontSize: 12,
                                                            color: 'var(--color-text-ter)',
                                                            margin: 0,
                                                        }, children: [condo.deliveryCount, " entregas"] })] }), _jsx("span", { style: {
                                                    fontFamily: 'var(--font-display)',
                                                    fontSize: 18,
                                                    fontWeight: 800,
                                                    color: 'var(--color-text)',
                                                }, children: condo.totalBreads })] }, condo.condominiumId))) }))] })) }), !isLoading && draftData && draftData.length > 0 && (_jsx(Footer, { label: "", totalLabel: "Total necess\u00E1rio", totalValue: draftTotal, ctaLabel: "Encerrar corte e gerar pedido", ctaIcon: "scissors", onCta: goToStep1 }))] })), step === 1 && (_jsxs("div", { style: { flex: 1, display: 'flex', flexDirection: 'column' }, children: [_jsxs("div", { style: { flex: 1, padding: '0 20px', overflowY: 'auto' }, children: [_jsx("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 13.5,
                                    color: 'var(--color-text-sec)',
                                    lineHeight: 1.5,
                                    marginBottom: 16,
                                    marginTop: 0,
                                }, children: "Ajuste as quantidades antes de fechar \u2014 margem de seguran\u00E7a, arredondamento, etc." }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 }, children: (draftData ?? []).map((condo) => (_jsxs("div", { style: {
                                        background: 'var(--color-surface)',
                                        borderRadius: 16,
                                        padding: 14,
                                        border: '1px solid var(--color-border-2)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                    }, children: [_jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("p", { style: {
                                                        fontFamily: 'var(--font-body)',
                                                        fontSize: 14,
                                                        fontWeight: 700,
                                                        color: 'var(--color-text)',
                                                        margin: '0 0 2px',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                    }, children: condo.name }), _jsxs("p", { style: {
                                                        fontFamily: 'var(--font-body)',
                                                        fontSize: 11.5,
                                                        color: 'var(--color-text-ter)',
                                                        margin: 0,
                                                    }, children: ["base ", condo.totalBreads, " p\u00E3es"] })] }), _jsx(StepperInline, { value: adjustedQts[condo.condominiumId] ?? condo.totalBreads, min: 0, max: 400, onChange: (v) => setAdjustedQts((prev) => ({ ...prev, [condo.condominiumId]: v })) })] }, condo.condominiumId))) })] }), _jsx(Footer, { label: "", totalLabel: "Total ajustado", totalValue: adjustedTotal, ctaLabel: "Escolher fornecedores", onCta: goToStep2, isLoading: isLoadingSuppliers })] })), step === 2 && (_jsxs("div", { style: { flex: 1, display: 'flex', flexDirection: 'column' }, children: [_jsxs("div", { style: { flex: 1, padding: '0 20px', overflowY: 'auto' }, children: [_jsx("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 13.5,
                                    color: 'var(--color-text-sec)',
                                    lineHeight: 1.5,
                                    marginBottom: 16,
                                    marginTop: 0,
                                }, children: "Comece pelo fornecedor principal e divida o restante se quiser." }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: [principal && (_jsxs("div", { style: {
                                            background: 'var(--color-surface)',
                                            borderRadius: 18,
                                            border: '1px solid var(--color-border-2)',
                                            overflow: 'hidden',
                                        }, children: [_jsxs("div", { style: {
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 12,
                                                    padding: '14px 14px 12px',
                                                }, children: [_jsx("div", { style: {
                                                            width: 40,
                                                            height: 40,
                                                            borderRadius: 11,
                                                            background: 'var(--color-surface-2)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            flexShrink: 0,
                                                        }, children: _jsx(Icon, { name: "factory", size: 20, color: "var(--color-accent)", stroke: 2 }) }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("p", { style: {
                                                                    fontFamily: 'var(--font-body)',
                                                                    fontSize: 14.5,
                                                                    fontWeight: 700,
                                                                    color: 'var(--color-text)',
                                                                    margin: '0 0 2px',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap',
                                                                }, children: principal.name }), _jsxs("p", { style: {
                                                                    fontFamily: 'var(--font-body)',
                                                                    fontSize: 12,
                                                                    color: 'var(--color-text-ter)',
                                                                    margin: 0,
                                                                }, children: [formatCurrency(principal.pricePerUnit), "/p\u00E3o"] })] }), _jsx("span", { style: {
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            padding: '4px 10px',
                                                            borderRadius: 99,
                                                            background: 'var(--color-gold-soft)',
                                                            color: '#8A6A00',
                                                            fontFamily: 'var(--font-body)',
                                                            fontSize: 12,
                                                            fontWeight: 700,
                                                            whiteSpace: 'nowrap',
                                                            flexShrink: 0,
                                                        }, children: "Principal" })] }), _jsxs("div", { style: {
                                                    borderTop: '1px solid var(--color-border-2)',
                                                    padding: '12px 14px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: 12,
                                                }, children: [_jsx(StepperInline, { value: split.p, min: 0, max: splitTotal, onChange: (v) => setSplit({ p: v, r: splitTotal - v }) }), _jsx("span", { style: {
                                                            fontFamily: 'var(--font-display)',
                                                            fontSize: 16,
                                                            fontWeight: 800,
                                                            color: 'var(--color-text)',
                                                        }, children: formatCurrency(split.p * principal.pricePerUnit) })] })] })), reserva && (_jsxs("div", { style: {
                                            background: 'var(--color-surface)',
                                            borderRadius: 18,
                                            border: '1px solid var(--color-border-2)',
                                            overflow: 'hidden',
                                        }, children: [_jsxs("div", { style: {
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 12,
                                                    padding: '14px 14px 12px',
                                                }, children: [_jsx("div", { style: {
                                                            width: 40,
                                                            height: 40,
                                                            borderRadius: 11,
                                                            background: 'var(--color-surface-2)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            flexShrink: 0,
                                                        }, children: _jsx(Icon, { name: "factory", size: 20, color: "var(--color-text-sec)", stroke: 2 }) }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("p", { style: {
                                                                    fontFamily: 'var(--font-body)',
                                                                    fontSize: 14.5,
                                                                    fontWeight: 700,
                                                                    color: 'var(--color-text)',
                                                                    margin: '0 0 2px',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap',
                                                                }, children: reserva.name }), _jsxs("p", { style: {
                                                                    fontFamily: 'var(--font-body)',
                                                                    fontSize: 12,
                                                                    color: 'var(--color-text-ter)',
                                                                    margin: 0,
                                                                }, children: [formatCurrency(reserva.pricePerUnit), "/p\u00E3o"] })] }), _jsx("span", { style: {
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            padding: '4px 10px',
                                                            borderRadius: 99,
                                                            background: 'var(--color-surface-2)',
                                                            color: 'var(--color-text-sec)',
                                                            fontFamily: 'var(--font-body)',
                                                            fontSize: 12,
                                                            fontWeight: 700,
                                                            whiteSpace: 'nowrap',
                                                            flexShrink: 0,
                                                        }, children: "Reserva" })] }), _jsxs("div", { style: {
                                                    borderTop: '1px solid var(--color-border-2)',
                                                    padding: '12px 14px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: 12,
                                                }, children: [_jsx(StepperInline, { value: split.r, min: 0, max: splitTotal, onChange: (v) => setSplit({ p: splitTotal - v, r: v }) }), _jsx("span", { style: {
                                                            fontFamily: 'var(--font-display)',
                                                            fontSize: 16,
                                                            fontWeight: 800,
                                                            color: 'var(--color-text)',
                                                        }, children: formatCurrency(split.r * reserva.pricePerUnit) })] })] }))] })] }), _jsxs("div", { style: {
                            position: 'sticky',
                            bottom: 0,
                            background: 'var(--color-app-bg)',
                            borderTop: '1px solid var(--color-border-2)',
                            padding: '12px 20px 16px',
                        }, children: [_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'baseline',
                                    justifyContent: 'space-between',
                                    marginBottom: 12,
                                }, children: [_jsxs("span", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 13.5,
                                            fontWeight: 700,
                                            color: 'var(--color-text-sec)',
                                        }, children: [splitTotal, " p\u00E3es"] }), _jsx("span", { style: {
                                            fontFamily: 'var(--font-display)',
                                            fontSize: 22,
                                            fontWeight: 800,
                                            letterSpacing: '-0.02em',
                                            color: 'var(--color-text)',
                                        }, children: formatCurrency(split.p * (principal?.pricePerUnit ?? 0) +
                                            split.r * (reserva?.pricePerUnit ?? 0)) })] }), _jsxs("button", { onClick: () => void finalizarPedido(), disabled: isCreating || (split.p === 0 && split.r === 0), style: {
                                    width: '100%',
                                    padding: '14px 20px',
                                    borderRadius: 16,
                                    border: 'none',
                                    background: 'var(--color-accent)',
                                    color: '#fff',
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 15,
                                    fontWeight: 700,
                                    cursor: isCreating ? 'wait' : 'pointer',
                                    opacity: isCreating || (split.p === 0 && split.r === 0) ? 0.6 : 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    minHeight: 44,
                                }, children: [_jsx(Icon, { name: "check", size: 18, color: "#fff", stroke: 2.1 }), "Finalizar pedido"] })] })] })), step === 3 && (_jsxs("div", { style: { flex: 1, overflowY: 'auto', padding: '0 20px 24px' }, children: [_jsx("div", { style: {
                            width: 72,
                            height: 72,
                            borderRadius: '28%',
                            background: 'var(--color-good-soft)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '24px auto 14px',
                        }, children: _jsx(Icon, { name: "check", size: 36, color: "var(--color-good)", stroke: 2.6 }) }), _jsx("p", { style: {
                            fontFamily: 'var(--font-display)',
                            fontSize: 22,
                            fontWeight: 700,
                            letterSpacing: '-0.02em',
                            color: 'var(--color-text)',
                            textAlign: 'center',
                            margin: '0 0 6px',
                        }, children: "Pedido gerado" }), _jsxs("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 13.5,
                            color: 'var(--color-text-sec)',
                            textAlign: 'center',
                            margin: '0 0 24px',
                        }, children: ["Salvo no hist\u00F3rico \u00B7 ", formatDate(new Date())] }), principal && reserva && (_jsxs("div", { style: {
                            background: 'var(--color-surface)',
                            borderRadius: 18,
                            border: '1px solid var(--color-border-2)',
                            padding: 16,
                            marginBottom: 16,
                        }, children: [_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    paddingBottom: 12,
                                    borderBottom: '1px solid var(--color-border-2)',
                                }, children: [_jsxs("div", { children: [_jsx("p", { style: {
                                                    fontFamily: 'var(--font-body)',
                                                    fontSize: 13.5,
                                                    fontWeight: 700,
                                                    color: 'var(--color-text)',
                                                    margin: 0,
                                                }, children: principal.name }), _jsxs("p", { style: {
                                                    fontFamily: 'var(--font-body)',
                                                    fontSize: 12,
                                                    color: 'var(--color-text-ter)',
                                                    margin: 0,
                                                }, children: [split.p, " p\u00E3es \u00D7 ", formatCurrency(principal.pricePerUnit)] })] }), _jsx("span", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 13.5,
                                            fontWeight: 700,
                                            color: 'var(--color-text)',
                                        }, children: formatCurrency(split.p * principal.pricePerUnit) })] }), _jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    paddingTop: 12,
                                    paddingBottom: 12,
                                    borderBottom: '1px solid var(--color-border-2)',
                                }, children: [_jsxs("div", { children: [_jsx("p", { style: {
                                                    fontFamily: 'var(--font-body)',
                                                    fontSize: 13.5,
                                                    fontWeight: 700,
                                                    color: 'var(--color-text)',
                                                    margin: 0,
                                                }, children: reserva.name }), _jsxs("p", { style: {
                                                    fontFamily: 'var(--font-body)',
                                                    fontSize: 12,
                                                    color: 'var(--color-text-ter)',
                                                    margin: 0,
                                                }, children: [split.r, " p\u00E3es \u00D7 ", formatCurrency(reserva.pricePerUnit)] })] }), _jsx("span", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 13.5,
                                            fontWeight: 700,
                                            color: 'var(--color-text)',
                                        }, children: formatCurrency(split.r * reserva.pricePerUnit) })] }), _jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    paddingTop: 12,
                                }, children: [_jsx("span", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 13.5,
                                            fontWeight: 700,
                                            color: 'var(--color-text-sec)',
                                        }, children: "Total do pedido" }), _jsx("span", { style: {
                                            fontFamily: 'var(--font-display)',
                                            fontSize: 20,
                                            fontWeight: 800,
                                            color: 'var(--color-accent)',
                                        }, children: formatCurrency(split.p * principal.pricePerUnit +
                                            split.r * reserva.pricePerUnit) })] })] })), _jsxs("div", { style: { display: 'flex', gap: 10, marginBottom: 10 }, children: [_jsxs("button", { onClick: () => void downloadFile('pdf'), disabled: isDownloading === 'pdf', style: {
                                    flex: 1,
                                    padding: '12px 16px',
                                    borderRadius: 14,
                                    border: '1.5px solid var(--color-border)',
                                    background: 'var(--color-surface)',
                                    color: 'var(--color-text)',
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 14,
                                    fontWeight: 700,
                                    cursor: isDownloading === 'pdf' ? 'wait' : 'pointer',
                                    opacity: isDownloading === 'pdf' ? 0.6 : 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    minHeight: 44,
                                }, children: [_jsx(Icon, { name: "download", size: 17, color: "var(--color-text)", stroke: 2 }), "PDF"] }), _jsxs("button", { onClick: () => void downloadFile('excel'), disabled: isDownloading === 'excel', style: {
                                    flex: 1,
                                    padding: '12px 16px',
                                    borderRadius: 14,
                                    border: '1.5px solid var(--color-border)',
                                    background: 'var(--color-surface)',
                                    color: 'var(--color-text)',
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 14,
                                    fontWeight: 700,
                                    cursor: isDownloading === 'excel' ? 'wait' : 'pointer',
                                    opacity: isDownloading === 'excel' ? 0.6 : 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    minHeight: 44,
                                }, children: [_jsx(Icon, { name: "download", size: 17, color: "var(--color-text)", stroke: 2 }), "Excel"] })] }), _jsx("button", { onClick: resetToStart, style: {
                            width: '100%',
                            padding: '12px 16px',
                            borderRadius: 14,
                            border: '1.5px solid var(--color-border)',
                            background: 'transparent',
                            color: 'var(--color-text-sec)',
                            fontFamily: 'var(--font-body)',
                            fontSize: 14,
                            fontWeight: 700,
                            cursor: 'pointer',
                            minHeight: 44,
                        }, children: "Voltar ao in\u00EDcio" })] })), _jsx("style", { children: `@keyframes spin { to { transform: rotate(360deg); } }` })] }));
}
