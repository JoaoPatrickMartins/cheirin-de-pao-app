import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../hooks/useAuth';
import { apiFetch } from '../../lib/apiFetch';
import { CondoSearch } from '../../components/auth/CondoSearch';
import { SavedCardsList } from '../../components/client/SavedCardsList';
export function SettingsScreen() {
    const auth = useAuth();
    const navigate = useNavigate();
    const { user } = auth;
    const [name, setName] = useState(user?.name ?? '');
    const [birthDate, setBirthDate] = useState(user?.birthDate?.split('T')[0] ?? '');
    const [condos, setCondos] = useState([]);
    const [selectedCondo, setSelectedCondo] = useState(user?.condominiumId ? { id: user.condominiumId, name: user.condominiumName ?? '', type: '' } : null);
    const [apartment, setApartment] = useState(user?.apartment ?? '');
    const [block, setBlock] = useState(user?.block ?? '');
    const [showCondoDialog, setShowCondoDialog] = useState(false);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);
    // Cartões salvos
    const [savedCards, setSavedCards] = useState([]);
    const [loadingCards, setLoadingCards] = useState(true);
    const [cardError, setCardError] = useState(null);
    const [removingCardId, setRemovingCardId] = useState(null);
    const [cardToRemove, setCardToRemove] = useState(null);
    const [showRemoveDialog, setShowRemoveDialog] = useState(false);
    const showToast = (message, ok) => {
        setToast({ message, ok });
        setTimeout(() => setToast(null), 2500);
    };
    useEffect(() => {
        apiFetch('/condominiums')
            .then((res) => (res.ok ? res.json() : Promise.reject()))
            .then((data) => {
            setCondos(data);
            if (user?.condominiumId) {
                const found = data.find((c) => c.id === user.condominiumId);
                if (found)
                    setSelectedCondo({ id: found.id, name: found.name, type: found.type });
            }
        })
            .catch(() => { });
    }, []);
    useEffect(() => {
        apiFetch('/users/me/cards')
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((cards) => setSavedCards(cards))
            .catch(() => setCardError('Não foi possível carregar seus cartões. Tente novamente.'))
            .finally(() => setLoadingCards(false));
    }, []);
    const handleCondoSelect = (id) => {
        const found = condos.find((c) => c.id === id);
        if (found)
            setSelectedCondo({ id: found.id, name: found.name, type: found.type });
    };
    const handleSaveDados = async () => {
        setLoading(true);
        try {
            const res = await apiFetch('/client/profile', {
                method: 'PATCH',
                body: JSON.stringify({ name: name.trim(), birthDate: birthDate || undefined }),
            });
            if (res.ok) {
                auth.updateUser({ name: name.trim(), birthDate: birthDate || undefined });
                showToast('Dados salvos!', true);
            }
            else {
                showToast('Não foi possível salvar. Tente novamente.', false);
            }
        }
        catch {
            showToast('Não foi possível salvar. Tente novamente.', false);
        }
        finally {
            setLoading(false);
        }
    };
    const handleSaveEndereco = () => {
        if (!selectedCondo)
            return;
        if (selectedCondo.id !== user?.condominiumId) {
            setShowCondoDialog(true);
        }
        else {
            void doSaveEndereco();
        }
    };
    const doSaveEndereco = async () => {
        if (!selectedCondo)
            return;
        setLoading(true);
        try {
            const res = await apiFetch('/client/profile', {
                method: 'PATCH',
                body: JSON.stringify({
                    condominiumId: selectedCondo.id,
                    apartment: apartment.trim(),
                    block: block.trim() || undefined,
                }),
            });
            if (res.ok) {
                const data = (await res.json());
                const update = {
                    condominiumId: selectedCondo.id,
                    condominiumName: selectedCondo.name,
                    apartment: apartment.trim(),
                    block: block.trim() || undefined,
                    ...(data.scheduleDeactivated ? { condominiumJustChanged: true } : {}),
                };
                auth.updateUser(update);
                showToast('Endereço atualizado!', true);
            }
            else {
                showToast('Não foi possível salvar. Tente novamente.', false);
            }
        }
        catch {
            showToast('Não foi possível salvar. Tente novamente.', false);
        }
        finally {
            setLoading(false);
        }
    };
    const handleSetDefault = async (cardId) => {
        try {
            const res = await apiFetch(`/users/me/cards/${cardId}`, {
                method: 'PATCH',
                body: JSON.stringify({ isDefault: true }),
                headers: { 'Content-Type': 'application/json' },
            });
            if (res.ok) {
                setSavedCards((prev) => prev.map((c) => ({ ...c, isDefault: c.id === cardId })));
                showToast('Cartão padrão atualizado.', true);
            }
            else {
                showToast('Algo deu errado. Tente novamente.', false);
            }
        }
        catch {
            showToast('Algo deu errado. Tente novamente.', false);
        }
    };
    const handleRemovePress = (card) => {
        setCardToRemove(card);
        setShowRemoveDialog(true);
    };
    const handleRemoveConfirm = async () => {
        if (!cardToRemove)
            return;
        setRemovingCardId(cardToRemove.id);
        try {
            const res = await apiFetch(`/users/me/cards/${cardToRemove.id}`, { method: 'DELETE' });
            if (res.ok || res.status === 204) {
                setSavedCards((prev) => prev.filter((c) => c.id !== cardToRemove.id));
                showToast('Cartão removido.', true);
                setShowRemoveDialog(false);
                setCardToRemove(null);
            }
            else {
                showToast('Algo deu errado. Tente novamente.', false);
            }
        }
        catch {
            showToast('Algo deu errado. Tente novamente.', false);
        }
        finally {
            setRemovingCardId(null);
        }
    };
    const isBlocksCondo = selectedCondo?.type === 'BLOCKS';
    return (_jsxs("div", { style: {
            minHeight: '100dvh',
            background: 'var(--color-app-bg)',
            display: 'flex',
            flexDirection: 'column',
        }, children: [toast && (_jsx("div", { style: {
                    position: 'fixed',
                    top: 16,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 9999,
                    background: 'var(--color-espresso)',
                    color: 'var(--color-primary-btn-text)',
                    borderRadius: 12,
                    padding: '12px 16px',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 600,
                    fontSize: 14,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
                }, children: toast.message })), _jsx("div", { style: {
                    paddingTop: 'calc(6px + env(safe-area-inset-top))',
                    padding: '6px 20px 14px',
                }, children: _jsx("h1", { style: {
                        fontFamily: 'var(--font-display)',
                        fontSize: 21,
                        fontWeight: 600,
                        letterSpacing: '-0.02em',
                        color: 'var(--color-text)',
                        margin: 0,
                    }, children: "Perfil" }) }), _jsxs("div", { style: { flex: 1, overflowY: 'auto', padding: '0 16px', paddingBottom: 80 }, children: [_jsxs(SectionCard, { title: "Dados Pessoais", children: [_jsx(FieldLabel, { children: "Nome completo" }), _jsx("input", { type: "text", value: name, onChange: (e) => setName(e.target.value), style: inputStyle }), _jsx("div", { style: { height: 16 } }), _jsx(FieldLabel, { children: "Data de nascimento" }), _jsx("input", { type: "date", value: birthDate, onChange: (e) => setBirthDate(e.target.value), style: inputStyle }), _jsx("div", { style: { height: 16 } }), _jsx(FieldLabel, { children: "CPF" }), _jsx("input", { type: "text", value: user?.cpf ?? '', readOnly: true, style: {
                                    ...inputStyle,
                                    opacity: 0.7,
                                    background: 'var(--color-surface-2)',
                                    cursor: 'not-allowed',
                                } }), _jsx("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 12.5,
                                    color: 'var(--color-text-ter)',
                                    margin: '6px 0 0',
                                }, children: "O CPF n\u00E3o pode ser alterado." }), _jsx("div", { style: { height: 20 } }), _jsx(PrimaryButton, { onClick: handleSaveDados, loading: loading, children: "Salvar dados" })] }), _jsxs(SectionCard, { title: "Contato", children: [_jsx(ContactRow, { label: "Telefone", value: user?.phone ?? undefined, onEdit: () => navigate('/client/perfil/editar-contato') }), _jsx("div", { style: { height: 12 } }), _jsx(ContactRow, { label: "E-mail", value: user?.email ?? undefined, onEdit: () => navigate('/client/perfil/editar-contato') })] }), _jsxs(SectionCard, { title: "Cart\u00F5es", children: [_jsx(SavedCardsList, { cards: savedCards, loading: loadingCards, error: cardError, mode: "manage", onSetDefault: handleSetDefault, onRemove: (id) => handleRemovePress(savedCards.find((c) => c.id === id)), removingId: removingCardId }), !loadingCards && !cardError && savedCards.length > 0 && savedCards.length < 3 && (_jsx("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 12.5,
                                    color: 'var(--color-text-ter)',
                                    textAlign: 'center',
                                    marginTop: 16,
                                    marginBottom: 0,
                                }, children: "Adicione cart\u00F5es ao fazer uma compra na tela de Cr\u00E9ditos." }))] }), _jsxs(SectionCard, { title: "Condom\u00EDnio", children: [_jsx(CondoSearch, { condos: condos, selectedId: selectedCondo?.id ?? null, onSelect: handleCondoSelect }), _jsx("div", { style: { height: 16 } }), _jsx(FieldLabel, { children: "Apartamento" }), _jsx("input", { type: "text", value: apartment, onChange: (e) => setApartment(e.target.value), placeholder: "Ex: 101", style: inputStyle }), isBlocksCondo && (_jsxs(_Fragment, { children: [_jsx("div", { style: { height: 16 } }), _jsx(FieldLabel, { children: "Bloco / Torre" }), _jsx("input", { type: "text", value: block, onChange: (e) => setBlock(e.target.value), placeholder: "Ex: A", style: inputStyle })] })), _jsx("div", { style: { height: 20 } }), _jsx(PrimaryButton, { onClick: handleSaveEndereco, loading: loading, disabled: !selectedCondo || !apartment.trim(), children: "Salvar endere\u00E7o" })] }), _jsx(SectionCard, { title: "Conta", children: _jsx("button", { onClick: () => auth.logout(), style: {
                                color: '#C0392B',
                                background: 'none',
                                border: 'none',
                                minHeight: 44,
                                fontFamily: 'var(--font-body)',
                                fontSize: 15,
                                fontWeight: 600,
                                cursor: 'pointer',
                                width: '100%',
                            }, children: "Sair" }) })] }), showRemoveDialog && cardToRemove && (_jsx("div", { role: "dialog", "aria-modal": "true", onClick: () => {
                    setShowRemoveDialog(false);
                    setCardToRemove(null);
                    // WR-06: resetar removingCardId ao fechar pelo backdrop para evitar que o
                    // botão "Remover" fique travado no estado "Removendo..." indefinidamente
                    setRemovingCardId(null);
                }, style: {
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.45)',
                    zIndex: 100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 24,
                }, children: _jsxs("div", { onClick: (e) => e.stopPropagation(), style: {
                        background: 'var(--color-surface)',
                        borderRadius: 22,
                        padding: 24,
                        width: 'calc(100vw - 48px)',
                        maxWidth: 320,
                    }, children: [_jsx("h2", { style: {
                                fontFamily: 'var(--font-display)',
                                fontSize: 18,
                                fontWeight: 700,
                                color: 'var(--color-text)',
                                margin: '0 0 8px',
                            }, children: "Remover cart\u00E3o" }), _jsxs("p", { style: {
                                fontFamily: 'var(--font-body)',
                                fontSize: 15,
                                color: 'var(--color-text-sec)',
                                margin: '0 0 20px',
                                lineHeight: 1.5,
                            }, children: ["Tem certeza que deseja remover o cart\u00E3o \u2022\u2022\u2022\u2022 ", cardToRemove.lastFour, "? Esta a\u00E7\u00E3o n\u00E3o pode ser desfeita."] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: [_jsx("button", { onClick: () => {
                                        setShowRemoveDialog(false);
                                        setCardToRemove(null);
                                    }, style: {
                                        width: '100%',
                                        height: 52,
                                        background: 'transparent',
                                        color: 'var(--color-text)',
                                        borderRadius: 'var(--radius-btn)',
                                        fontFamily: 'var(--font-body)',
                                        fontSize: 15,
                                        fontWeight: 700,
                                        border: '1.5px solid var(--color-border)',
                                        cursor: 'pointer',
                                    }, children: "Manter cart\u00E3o" }), _jsx("button", { onClick: () => void handleRemoveConfirm(), disabled: removingCardId !== null, style: {
                                        width: '100%',
                                        height: 52,
                                        background: '#C0392B',
                                        color: '#FFFFFF',
                                        borderRadius: 'var(--radius-btn)',
                                        fontFamily: 'var(--font-body)',
                                        fontSize: 15,
                                        fontWeight: 700,
                                        border: 'none',
                                        cursor: removingCardId !== null ? 'not-allowed' : 'pointer',
                                        opacity: removingCardId !== null ? 0.7 : 1,
                                    }, children: removingCardId !== null ? 'Removendo...' : 'Remover cartão' })] })] }) })), showCondoDialog && (_jsx("div", { role: "dialog", "aria-modal": "true", onClick: () => setShowCondoDialog(false), style: {
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.45)',
                    zIndex: 100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 24,
                }, children: _jsxs("div", { onClick: (e) => e.stopPropagation(), style: {
                        background: 'var(--color-surface)',
                        borderRadius: 22,
                        padding: 24,
                        width: 'calc(100vw - 48px)',
                        maxWidth: 320,
                    }, children: [_jsx("h2", { style: {
                                fontFamily: 'var(--font-display)',
                                fontSize: 18,
                                fontWeight: 700,
                                color: 'var(--color-text)',
                                margin: '0 0 8px',
                            }, children: "Mudar de condom\u00EDnio" }), _jsx("p", { style: {
                                fontFamily: 'var(--font-body)',
                                fontSize: 15,
                                color: 'var(--color-text-sec)',
                                margin: '0 0 20px',
                                lineHeight: 1.5,
                            }, children: "Mudar de condom\u00EDnio vai desativar sua agenda semanal ativa. Voc\u00EA precisar\u00E1 reconfigurar a agenda no novo endere\u00E7o." }), _jsx("button", { onClick: () => setShowCondoDialog(false), style: {
                                width: '100%',
                                minHeight: 44,
                                background: 'transparent',
                                color: 'var(--color-text)',
                                borderRadius: 'var(--radius-btn)',
                                fontFamily: 'var(--font-body)',
                                fontSize: 15,
                                fontWeight: 700,
                                border: '1.5px solid var(--color-border)',
                                cursor: 'pointer',
                            }, children: "Cancelar" }), _jsx("button", { onClick: () => {
                                setShowCondoDialog(false);
                                void doSaveEndereco();
                            }, style: {
                                width: '100%',
                                minHeight: 44,
                                background: 'var(--color-espresso)',
                                color: 'var(--color-primary-btn-text)',
                                borderRadius: 'var(--radius-btn)',
                                fontFamily: 'var(--font-body)',
                                fontSize: 15,
                                fontWeight: 700,
                                border: 'none',
                                cursor: 'pointer',
                                marginTop: 8,
                            }, children: "Confirmar mudan\u00E7a" })] }) }))] }));
}
// ── Shared styles ──────────────────────────────────────────────────────────────
const inputStyle = {
    width: '100%',
    background: 'var(--color-surface)',
    border: '1.5px solid var(--color-border)',
    borderRadius: 'var(--radius-field)',
    padding: '12px 14px',
    fontFamily: 'var(--font-body)',
    fontSize: 15,
    color: 'var(--color-text)',
    outline: 'none',
    boxSizing: 'border-box',
};
// ── Sub-components ─────────────────────────────────────────────────────────────
function SectionCard({ title, children }) {
    return (_jsxs("div", { style: {
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-card)',
            padding: 24,
            boxShadow: 'var(--shadow-soft)',
            marginBottom: 24,
        }, children: [_jsx("h2", { style: {
                    fontFamily: 'var(--font-display)',
                    fontSize: 16,
                    fontWeight: 700,
                    color: 'var(--color-text)',
                    margin: '0 0 16px',
                    letterSpacing: '-0.01em',
                }, children: title }), children] }));
}
function FieldLabel({ children }) {
    return (_jsx("p", { style: {
            fontFamily: 'var(--font-body)',
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--color-text-sec)',
            margin: '0 0 8px',
        }, children: children }));
}
function ContactRow({ label, value, onEdit }) {
    return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, children: [_jsxs("div", { children: [_jsx("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: 'var(--color-text-sec)',
                            margin: '0 0 2px',
                        }, children: label }), _jsx("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 15,
                            color: value ? 'var(--color-text)' : 'var(--color-text-ter)',
                            margin: 0,
                        }, children: value ?? 'Não informado' })] }), _jsx("button", { onClick: onEdit, style: {
                    background: 'var(--color-surface-2)',
                    border: 'none',
                    borderRadius: 10,
                    padding: '8px 14px',
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--color-accent)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                }, children: "Editar contato" })] }));
}
function PrimaryButton({ onClick, loading = false, disabled = false, children }) {
    const isDisabled = disabled || loading;
    return (_jsx("button", { onClick: onClick, disabled: isDisabled, style: {
            background: 'var(--color-espresso)',
            color: 'var(--color-primary-btn-text)',
            borderRadius: 'var(--radius-btn)',
            height: 52,
            width: '100%',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 600,
            border: 'none',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            opacity: isDisabled ? 0.6 : 1,
            transition: 'opacity 0.15s',
        }, children: loading ? 'Salvando...' : children }));
}
