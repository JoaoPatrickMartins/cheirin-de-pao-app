import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/apiFetch';
import { Icon } from '../brand/Icon';
const GRANT_MOTIVOS = ['Acerto', 'Bonificação', 'Compensação', 'Promoção'];
// ------------------------------------------------------------------ helpers
const DIAS_PT = {
    MON: 'Seg',
    TUE: 'Ter',
    WED: 'Qua',
    THU: 'Qui',
    FRI: 'Sex',
    SAT: 'Sáb',
    SUN: 'Dom',
};
function formatDataLonga(iso) {
    if (!iso)
        return 'Sem compras';
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: 'America/Sao_Paulo',
    }).format(new Date(iso));
}
function resumoAgendamento(schedule) {
    if (!schedule || !schedule.isActive)
        return 'Sem agendamento';
    const entries = Object.entries(schedule.weeklyQty).filter(([, qty]) => qty > 0);
    if (entries.length === 0)
        return 'Sem agendamento';
    const dias = entries.map(([dia]) => DIAS_PT[dia] ?? dia).join(', ');
    const qtdExemplo = entries[0][1];
    return `${dias} — ${qtdExemplo} pão${qtdExemplo !== 1 ? 's' : ''}`;
}
function iniciais(nome) {
    return nome
        .split(' ')
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('');
}
// ------------------------------------------------------------------ componente
export function ClientDetailView({ clienteId, onBack }) {
    const [cliente, setCliente] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isBlocking, setIsBlocking] = useState(false);
    const [showDialog, setShowDialog] = useState(false);
    const [blockError, setBlockError] = useState(null);
    const [showGrantModal, setShowGrantModal] = useState(false);
    const [grantQty, setGrantQty] = useState(1);
    const [grantMotivo, setGrantMotivo] = useState(null);
    const [grantLoading, setGrantLoading] = useState(false);
    const [toast, setToast] = useState(null);
    useEffect(() => {
        const fetchCliente = async () => {
            try {
                const res = await apiFetch(`/admin/clients/${clienteId}`);
                if (res.ok) {
                    setCliente((await res.json()));
                }
            }
            catch {
                // falha silenciosa
            }
            finally {
                setIsLoading(false);
            }
        };
        void fetchCliente();
    }, [clienteId]);
    async function handleGrant() {
        if (!grantMotivo || grantQty < 1 || !cliente)
            return;
        setGrantLoading(true);
        try {
            const res = await apiFetch(`/admin/clients/${cliente.id}/grant-credits`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity: grantQty, reason: grantMotivo }),
            });
            if (res.ok) {
                const updated = (await res.json());
                setCliente((prev) => prev ? { ...prev, creditBalance: updated.creditBalance } : prev);
                setShowGrantModal(false);
                setGrantQty(1);
                setGrantMotivo(null);
                setToast({ message: `${grantQty} crédito(s) adicionado(s) a ${cliente.name}`, ok: true });
                setTimeout(() => setToast(null), 2500);
            }
        }
        catch {
            // silencioso
        }
        finally {
            setGrantLoading(false);
        }
    }
    async function handleConfirmarBloqueio() {
        if (!cliente || isBlocking)
            return;
        setIsBlocking(true);
        setBlockError(null);
        try {
            const res = await apiFetch(`/admin/clients/${cliente.id}/block`, {
                method: 'PATCH',
            });
            if (res.ok) {
                const updated = (await res.json());
                setCliente((prev) => prev ? { ...prev, isBlocked: updated.isBlocked } : prev);
                setShowDialog(false);
            }
            else {
                setBlockError('Não foi possível alterar. Tente novamente.');
            }
        }
        catch {
            setBlockError('Não foi possível alterar. Tente novamente.');
        }
        finally {
            setIsBlocking(false);
        }
    }
    useEffect(() => {
        if (!showGrantModal)
            return;
        const handler = (e) => { if (e.key === 'Escape')
            setShowGrantModal(false); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [showGrantModal]);
    return (_jsxs("div", { style: {
            flex: 1,
            overflowY: 'auto',
            paddingBottom: 32,
            background: 'var(--color-app-bg)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100%',
        }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '14px 20px 10px',
                    flexShrink: 0,
                }, children: [_jsx("button", { onClick: onBack, "aria-label": "Voltar", style: {
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '8px 8px 8px 0',
                            display: 'flex',
                            alignItems: 'center',
                            color: 'var(--color-text)',
                            minHeight: 44,
                        }, children: _jsx(Icon, { name: "arrowL", size: 22, stroke: 2, color: "var(--color-text)" }) }), _jsx("h1", { style: {
                            fontFamily: 'var(--font-display)',
                            fontSize: 20,
                            fontWeight: 700,
                            letterSpacing: '-0.02em',
                            color: 'var(--color-text)',
                            margin: 0,
                        }, children: "Cliente" })] }), isLoading ? (_jsx("div", { style: {
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '60px 20px',
                }, children: _jsx("div", { style: {
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        border: '3px solid var(--color-border)',
                        borderTopColor: 'var(--color-accent)',
                        animation: 'spin 0.8s linear infinite',
                    } }) })) : !cliente ? (_jsx("div", { style: { padding: '40px 20px', textAlign: 'center' }, children: _jsx("p", { style: {
                        fontFamily: 'var(--font-body)',
                        fontSize: 15,
                        color: 'var(--color-text-sec)',
                    }, children: "Falha na conex\u00E3o. Tente novamente." }) })) : (_jsxs("div", { style: { padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsxs("div", { style: {
                            background: 'var(--color-surface)',
                            borderRadius: 22,
                            border: '1px solid var(--color-border-2)',
                            padding: '20px 16px',
                            textAlign: 'center',
                        }, children: [_jsx("div", { style: {
                                    width: 64,
                                    height: 64,
                                    borderRadius: '50%',
                                    background: 'var(--color-surface-2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto 12px',
                                    color: 'var(--color-accent)',
                                }, children: _jsx("span", { style: {
                                        fontFamily: 'var(--font-display)',
                                        fontSize: 20,
                                        fontWeight: 700,
                                        color: 'var(--color-accent)',
                                    }, children: iniciais(cliente.name) }) }), _jsx("p", { style: {
                                    fontFamily: 'var(--font-display)',
                                    fontSize: 20,
                                    fontWeight: 700,
                                    color: 'var(--color-text)',
                                    margin: '0 0 4px',
                                    letterSpacing: '-0.02em',
                                }, children: cliente.name }), _jsxs("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 13,
                                    color: 'var(--color-text-sec)',
                                    margin: '0 0 10px',
                                }, children: [cliente.block ? `Bl ${cliente.block} · ` : '', "Ap ", cliente.apartment] }), cliente.isBlocked && (_jsxs("div", { style: {
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    background: 'var(--color-gold-soft)',
                                    border: '1px solid var(--color-border-2)',
                                    borderRadius: 999,
                                    padding: '4px 10px',
                                }, children: [_jsx(Icon, { name: "ban", size: 13, stroke: 2, color: "var(--color-accent)", "aria-hidden": "true" }), _jsx("span", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 12,
                                            fontWeight: 700,
                                            color: 'var(--color-accent)',
                                        }, children: "Bloqueado" })] }))] }), _jsxs("div", { style: {
                            background: 'var(--color-surface)',
                            borderRadius: 22,
                            border: '1px solid var(--color-border-2)',
                            overflow: 'hidden',
                        }, children: [_jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: '14px 16px',
                                }, children: [_jsx(Icon, { name: "wallet", size: 20, stroke: 1.9, color: "var(--color-accent)", "aria-hidden": "true" }), _jsx("span", { style: {
                                            flex: 1,
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 14,
                                            fontWeight: 700,
                                            color: 'var(--color-text-sec)',
                                        }, children: "Saldo de cr\u00E9ditos" }), _jsxs("span", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 14,
                                            fontWeight: 700,
                                            color: 'var(--color-text)',
                                        }, children: [cliente.creditBalance, " p\u00E3es"] })] }), _jsx("div", { style: { padding: '0 16px 14px' }, children: _jsx("button", { onClick: () => setShowGrantModal(true), "aria-label": "Adicionar cr\u00E9ditos", style: {
                                        background: 'none',
                                        border: '1.5px solid var(--color-border)',
                                        borderRadius: 999,
                                        padding: '6px 14px',
                                        fontFamily: 'var(--font-body)',
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: 'var(--color-text)',
                                        cursor: 'pointer',
                                        minHeight: 36,
                                    }, children: "+ Adicionar cr\u00E9ditos" }) }), _jsx("div", { style: { height: 1, background: 'var(--color-border-2)' } }), _jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: '14px 16px',
                                }, children: [_jsx(Icon, { name: "clock", size: 20, stroke: 1.9, color: "var(--color-accent)", "aria-hidden": "true" }), _jsx("span", { style: {
                                            flex: 1,
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 14,
                                            fontWeight: 700,
                                            color: 'var(--color-text-sec)',
                                        }, children: "\u00DAltima compra" }), _jsx("span", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 14,
                                            fontWeight: 700,
                                            color: 'var(--color-text)',
                                            textAlign: 'right',
                                            maxWidth: 140,
                                        }, children: formatDataLonga(cliente.recentOrders && cliente.recentOrders.length > 0
                                            ? cliente.recentOrders[0].scheduledDate
                                            : null) })] }), _jsx("div", { style: { height: 1, background: 'var(--color-border-2)' } }), _jsxs("div", { style: {
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    padding: '14px 16px',
                                }, children: [_jsx(Icon, { name: "calendar", size: 20, stroke: 1.9, color: "var(--color-accent)", "aria-hidden": "true" }), _jsx("span", { style: {
                                            flex: 1,
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 14,
                                            fontWeight: 700,
                                            color: 'var(--color-text-sec)',
                                        }, children: "Agendamento" }), _jsx("span", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 14,
                                            fontWeight: 700,
                                            color: 'var(--color-text)',
                                            textAlign: 'right',
                                            maxWidth: 160,
                                        }, children: resumoAgendamento(cliente.schedule) })] })] }), _jsx("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 12,
                            color: 'var(--color-text-ter)',
                            lineHeight: 1.5,
                            margin: 0,
                            marginBottom: 14,
                        }, children: "O admin apenas visualiza os dados do cliente \u2014 n\u00E3o edita o cadastro." }), _jsxs("button", { onClick: () => setShowDialog(true), disabled: isBlocking, style: {
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            padding: '14px 20px',
                            borderRadius: 16,
                            border: cliente.isBlocked
                                ? 'none'
                                : '1.5px solid var(--color-border)',
                            background: cliente.isBlocked ? 'var(--color-gold)' : 'transparent',
                            color: cliente.isBlocked ? '#1E1207' : 'var(--color-text)',
                            fontFamily: 'var(--font-body)',
                            fontSize: 15,
                            fontWeight: 700,
                            cursor: isBlocking ? 'wait' : 'pointer',
                            opacity: isBlocking ? 0.6 : 1,
                            minHeight: 44,
                        }, children: [_jsx(Icon, { name: cliente.isBlocked ? 'check' : 'ban', size: 18, stroke: 2, color: cliente.isBlocked ? '#1E1207' : 'var(--color-text)', "aria-hidden": "true" }), cliente.isBlocked ? 'Desbloquear cliente' : 'Bloquear cliente'] }), blockError && (_jsx("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 13,
                            color: 'var(--color-warn)',
                            margin: 0,
                            textAlign: 'center',
                        }, children: blockError }))] })), toast && (_jsx("div", { role: "status", style: {
                    position: 'fixed',
                    top: 16,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 9999,
                    background: 'var(--color-espresso)',
                    color: '#fff',
                    borderRadius: 20,
                    padding: '10px 20px',
                    fontSize: 14,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                }, children: toast.message })), showGrantModal && (_jsxs(_Fragment, { children: [_jsx("div", { onClick: () => setShowGrantModal(false), style: {
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.5)',
                            zIndex: 50,
                        } }), _jsxs("div", { role: "dialog", "aria-modal": "true", "aria-labelledby": "modal-grant-title", onClick: (e) => e.stopPropagation(), style: {
                            position: 'fixed',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: 'var(--color-app-bg)',
                            borderRadius: '20px 20px 0 0',
                            padding: `24px 20px calc(32px + env(safe-area-inset-bottom, 0px))`,
                            maxHeight: '80vh',
                            overflowY: 'auto',
                            zIndex: 51,
                        }, children: [_jsx("div", { style: {
                                    width: 36,
                                    height: 4,
                                    borderRadius: 999,
                                    background: 'var(--color-border)',
                                    margin: '0 auto 20px',
                                } }), _jsx("h2", { id: "modal-grant-title", style: {
                                    fontFamily: 'var(--font-display)',
                                    fontWeight: 700,
                                    fontSize: 19,
                                    color: 'var(--color-text)',
                                    margin: '0 0 20px',
                                    letterSpacing: '-0.01em',
                                }, children: "Adicionar Cr\u00E9ditos" }), _jsx("label", { style: {
                                    display: 'block',
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: 'var(--color-text-sec)',
                                    marginBottom: 8,
                                }, children: "Quantidade" }), _jsx("input", { type: "number", min: "1", 
                                // eslint-disable-next-line jsx-a11y/no-autofocus
                                autoFocus: true, value: grantQty, onChange: (e) => setGrantQty(Number(e.target.value)), style: {
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '12px 14px',
                                    borderRadius: 12,
                                    border: '1.5px solid var(--color-border)',
                                    background: 'var(--color-surface)',
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: 'var(--color-text)',
                                    marginBottom: 20,
                                } }), _jsx("label", { style: {
                                    display: 'block',
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: 'var(--color-text-sec)',
                                    marginBottom: 10,
                                }, children: "Motivo" }), _jsx("div", { style: { display: 'flex', flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 24 }, children: GRANT_MOTIVOS.map((m) => (_jsx("button", { "aria-pressed": grantMotivo === m, onClick: () => setGrantMotivo(m), style: {
                                        minHeight: 44,
                                        padding: '8px 16px',
                                        borderRadius: 999,
                                        fontWeight: 700,
                                        fontSize: 13,
                                        cursor: 'pointer',
                                        fontFamily: 'var(--font-body)',
                                        border: grantMotivo === m ? 'none' : '1.5px solid var(--color-border)',
                                        background: grantMotivo === m ? 'var(--color-gold)' : 'transparent',
                                        color: grantMotivo === m ? '#1E1207' : 'var(--color-text)',
                                    }, children: m }, m))) }), _jsxs("div", { style: { display: 'flex', gap: 12, marginTop: 24 }, children: [_jsx("button", { onClick: () => setShowGrantModal(false), style: {
                                            flex: 1,
                                            minHeight: 44,
                                            borderRadius: 999,
                                            border: '1.5px solid var(--color-border)',
                                            background: 'none',
                                            fontFamily: 'var(--font-body)',
                                            fontWeight: 700,
                                            fontSize: 15,
                                            color: 'var(--color-text)',
                                            cursor: 'pointer',
                                        }, children: "Descartar" }), _jsx("button", { onClick: () => { void handleGrant(); }, disabled: !grantMotivo || grantQty < 1 || grantLoading, style: {
                                            flex: 1,
                                            minHeight: 44,
                                            borderRadius: 999,
                                            border: 'none',
                                            background: 'var(--color-accent)',
                                            fontFamily: 'var(--font-body)',
                                            fontWeight: 700,
                                            fontSize: 15,
                                            color: '#1E1207',
                                            cursor: !grantMotivo || grantQty < 1 || grantLoading ? 'not-allowed' : 'pointer',
                                            opacity: !grantMotivo || grantQty < 1 ? 0.45 : 1,
                                        }, children: grantLoading ? 'Confirmando...' : 'Adicionar créditos' })] })] })] })), showDialog && cliente && (_jsx("div", { role: "dialog", "aria-modal": "true", "aria-labelledby": "dialog-title", style: {
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.4)',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    zIndex: 100,
                    padding: '0 0 env(safe-area-inset-bottom, 0px)',
                }, onClick: (e) => {
                    if (e.target === e.currentTarget)
                        setShowDialog(false);
                }, children: _jsxs("div", { style: {
                        background: 'var(--color-surface)',
                        borderRadius: '20px 20px 0 0',
                        padding: '24px 20px 32px',
                        width: '100%',
                        maxWidth: 480,
                    }, children: [_jsx("h2", { id: "dialog-title", style: {
                                fontFamily: 'var(--font-display)',
                                fontSize: 18,
                                fontWeight: 700,
                                color: 'var(--color-text)',
                                margin: '0 0 8px',
                                letterSpacing: '-0.02em',
                            }, children: cliente.isBlocked
                                ? `Desbloquear ${cliente.name}?`
                                : `Bloquear ${cliente.name}?` }), _jsx("p", { style: {
                                fontFamily: 'var(--font-body)',
                                fontSize: 14,
                                color: 'var(--color-text-sec)',
                                margin: '0 0 24px',
                                lineHeight: 1.5,
                            }, children: cliente.isBlocked
                                ? 'O cliente voltará a poder fazer pedidos e acessar o app.'
                                : 'O cliente não poderá fazer pedidos ou acessar o app.' }), blockError && (_jsx("p", { style: {
                                fontFamily: 'var(--font-body)',
                                fontSize: 13,
                                color: 'var(--color-warn)',
                                margin: '0 0 12px',
                                textAlign: 'center',
                            }, children: blockError })), _jsxs("div", { style: { display: 'flex', gap: 10 }, children: [_jsx("button", { onClick: () => { setShowDialog(false); setBlockError(null); }, style: {
                                        flex: 1,
                                        padding: '13px 0',
                                        borderRadius: 14,
                                        border: '1.5px solid var(--color-border)',
                                        background: 'transparent',
                                        fontFamily: 'var(--font-body)',
                                        fontSize: 15,
                                        fontWeight: 700,
                                        color: 'var(--color-text)',
                                        cursor: 'pointer',
                                        minHeight: 44,
                                    }, children: "Cancelar" }), _jsx("button", { onClick: () => { void handleConfirmarBloqueio(); }, disabled: isBlocking, style: {
                                        flex: 1,
                                        padding: '13px 0',
                                        borderRadius: 14,
                                        border: 'none',
                                        background: cliente.isBlocked
                                            ? 'var(--color-gold)'
                                            : 'var(--color-accent)',
                                        fontFamily: 'var(--font-body)',
                                        fontSize: 15,
                                        fontWeight: 700,
                                        color: cliente.isBlocked ? '#1E1207' : '#FFFFFF',
                                        cursor: isBlocking ? 'wait' : 'pointer',
                                        opacity: isBlocking ? 0.6 : 1,
                                        minHeight: 44,
                                    }, children: isBlocking ? '...' : cliente.isBlocked ? 'Confirmar' : 'Confirmar bloqueio' })] })] }) }))] }));
}
