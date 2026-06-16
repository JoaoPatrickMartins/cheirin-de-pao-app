import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { apiFetch } from '../../../lib/apiFetch';
import { AdminHead } from '../../../components/admin/AdminHead';
import { Icon } from '../../../components/brand/Icon';
import { ClientDetailView } from '../../../components/admin/ClientDetailView';
// ------------------------------------------------------------------ helpers
function formatDataCurta(iso) {
    if (!iso)
        return '—';
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        timeZone: 'America/Sao_Paulo',
    }).format(new Date(iso));
}
// ------------------------------------------------------------------ componente
export function AdminClientes() {
    const [sub, setSub] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [filtroCondominio, setFiltroCondominio] = useState(null);
    const [clientes, setClientes] = useState([]);
    const [condominios, setCondominios] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    // Buscar condomínios na montagem (apenas uma vez)
    useEffect(() => {
        const fetchCondos = async () => {
            try {
                const res = await apiFetch('/admin/condominiums');
                if (res.ok) {
                    setCondominios((await res.json()));
                }
            }
            catch {
                // falha silenciosa
            }
        };
        void fetchCondos();
    }, []);
    // Buscar clientes sempre que filtroCondominio mudar
    useEffect(() => {
        setIsLoading(true);
        const fetchClientes = async () => {
            try {
                const url = filtroCondominio
                    ? `/admin/clients?condominiumId=${filtroCondominio}`
                    : '/admin/clients';
                const res = await apiFetch(url);
                if (res.ok) {
                    setClientes((await res.json()));
                }
            }
            catch {
                // falha silenciosa
            }
            finally {
                setIsLoading(false);
            }
        };
        void fetchClientes();
    }, [filtroCondominio]);
    // Sub-tela: detalhe do cliente
    if (sub === 'detalhe' && selectedId) {
        return (_jsx(ClientDetailView, { clienteId: selectedId, onBack: () => {
                setSub(null);
                setSelectedId(null);
            } }));
    }
    // Nome do condomínio a partir do id
    function nomeCondominio(condominiumId) {
        const condo = condominios.find((c) => c.id === condominiumId);
        return condo?.name ?? '—';
    }
    return (_jsxs("div", { style: {
            flex: 1,
            overflowY: 'auto',
            paddingBottom: 24,
        }, children: [_jsx(AdminHead, { sub: `${clientes.length} cadastrados`, titulo: "Clientes" }), _jsx("div", { style: {
                    display: 'flex',
                    gap: 8,
                    overflowX: 'auto',
                    paddingBottom: 4,
                    padding: '0 20px 4px',
                    scrollbarWidth: 'none',
                }, children: [{ id: null, name: 'Todos' }, ...condominios].map((condo) => {
                    const isAtivo = filtroCondominio === condo.id;
                    return (_jsx("button", { onClick: () => setFiltroCondominio(condo.id), style: {
                            padding: '8px 14px',
                            borderRadius: 999,
                            fontFamily: 'var(--font-body)',
                            fontSize: 12.5,
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            flexShrink: 0,
                            border: isAtivo
                                ? '1.5px solid var(--color-accent)'
                                : '1.5px solid var(--color-border)',
                            background: isAtivo
                                ? 'var(--color-gold-soft)'
                                : 'var(--color-surface)',
                            color: isAtivo
                                ? 'var(--color-accent)'
                                : 'var(--color-text-sec)',
                            minHeight: 44,
                            display: 'flex',
                            alignItems: 'center',
                        }, children: condo.name }, condo.id ?? '__todos__'));
                }) }), _jsx("div", { style: {
                    padding: '12px 20px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                }, children: isLoading ? (_jsx("div", { style: {
                        display: 'flex',
                        justifyContent: 'center',
                        padding: '40px 0',
                    }, children: _jsx("div", { style: {
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            border: '3px solid var(--color-border)',
                            borderTopColor: 'var(--color-accent)',
                            animation: 'spin 0.8s linear infinite',
                        } }) })) : clientes.length === 0 ? (
                /* Empty state */
                _jsxs("div", { style: { padding: '40px 0', textAlign: 'center' }, children: [_jsx("p", { style: {
                                fontFamily: 'var(--font-display)',
                                fontSize: 18,
                                fontWeight: 700,
                                color: 'var(--color-text)',
                                margin: '0 0 8px',
                            }, children: "Nenhum cliente encontrado" }), _jsx("p", { style: {
                                fontFamily: 'var(--font-body)',
                                fontSize: 14,
                                color: 'var(--color-text-sec)',
                                margin: 0,
                            }, children: "Tente filtrar por outro condom\u00EDnio." })] })) : (clientes.map((c) => {
                    const condoNome = nomeCondominio(c.condominiumId);
                    const ultimaCompra = c.lastPurchaseAt
                        ? `últ. ${formatDataCurta(c.lastPurchaseAt)}`
                        : 'sem compras';
                    const linhaSecundaria = `${condoNome} · ${c.apartment}${c.block ? ` bl ${c.block}` : ''} · ${ultimaCompra}`;
                    return (_jsxs("div", { onClick: () => {
                            setSelectedId(c.id);
                            setSub('detalhe');
                        }, role: "button", "aria-label": `Ver detalhes de ${c.name}`, style: {
                            background: 'var(--color-surface)',
                            borderRadius: 18,
                            border: '1px solid var(--color-border-2)',
                            padding: 14,
                            cursor: 'pointer',
                            opacity: c.isBlocked ? 0.6 : 1,
                            transition: 'opacity 0.15s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                        }, children: [_jsx("div", { style: {
                                    width: 44,
                                    height: 44,
                                    borderRadius: 12,
                                    background: 'var(--color-surface-2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    color: 'var(--color-accent)',
                                }, children: _jsx(Icon, { name: "user", size: 22, stroke: 1.9, color: "var(--color-accent)" }) }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsxs("div", { style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 5,
                                        }, children: [_jsx("span", { style: {
                                                    fontFamily: 'var(--font-body)',
                                                    fontSize: 14.5,
                                                    fontWeight: 700,
                                                    color: 'var(--color-text)',
                                                }, children: c.name }), c.isBlocked && (_jsx(Icon, { name: "ban", size: 14, stroke: 1.9, color: "var(--color-accent)" }))] }), _jsx("p", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 12,
                                            color: 'var(--color-text-ter)',
                                            margin: '2px 0 0',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }, children: linhaSecundaria })] }), _jsxs("div", { style: {
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-end',
                                    flexShrink: 0,
                                }, children: [_jsx("span", { style: {
                                            fontFamily: 'var(--font-display)',
                                            fontSize: 17,
                                            fontWeight: 800,
                                            color: c.creditBalance > 0
                                                ? 'var(--color-text)'
                                                : 'var(--color-text-ter)',
                                            lineHeight: 1,
                                        }, children: c.creditBalance }), _jsx("span", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 10.5,
                                            color: 'var(--color-text-ter)',
                                            marginTop: 2,
                                        }, children: "cr\u00E9ditos" })] })] }, c.id));
                })) })] }));
}
