import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/apiFetch';
import { BreadMark } from '../../components/brand/BreadMark';
import { Icon } from '../../components/brand/Icon';
import { useAuth } from '../../hooks/useAuth';
import { ProgressCard } from '../../components/courier/ProgressCard';
import { SegmentedControl } from '../../components/courier/SegmentedControl';
import { CondoAccordion } from '../../components/courier/CondoAccordion';
import { ConfirmDeliveryDialog } from '../../components/courier/ConfirmDeliveryDialog';
import { CourierRouteView } from './CourierRouteView';
function getTodayLabel() {
    const now = new Date();
    const day = new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        timeZone: 'America/Sao_Paulo',
    }).format(now);
    const month = new Intl.DateTimeFormat('pt-BR', {
        month: 'short',
        timeZone: 'America/Sao_Paulo',
    })
        .format(now)
        .replace('.', '');
    return `${day} ${month}`;
}
export function CourierScreen() {
    const { user, logout } = useAuth();
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [tab, setTab] = useState('list');
    const [openAccordion, setOpenAccordion] = useState(0);
    const [confirmedIds, setConfirmedIds] = useState(new Set());
    const [selectedStop, setSelectedStop] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await apiFetch('/courier/orders/today');
                if (res.ok) {
                    setData((await res.json()));
                }
            }
            catch {
                // mantém estado anterior em falha de rede
            }
            finally {
                setIsLoading(false);
            }
        };
        void fetchData();
    }, []);
    const confirmedCount = confirmedIds.size;
    const confirmedBreads = data
        ? data.condos.flatMap((c) => c.stops).filter((s) => confirmedIds.has(s.orderId)).reduce((sum, s) => sum + s.quantity, 0)
        : 0;
    const todayLabel = getTodayLabel();
    const courierName = user?.name ?? 'Entregador';
    return (_jsxs("div", { style: {
            background: 'var(--color-app-bg)',
            minHeight: '100vh',
            paddingBottom: 24,
        }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 20px 12px',
                }, children: [_jsx("div", { style: {
                            width: 42,
                            height: 42,
                            borderRadius: 13,
                            background: '#1E1207',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                        }, children: _jsx(BreadMark, { size: 27, color: "#E3AC3F", "aria-label": "Cheirin de P\u00E3o" }) }), _jsxs("div", { style: { textAlign: 'right' }, children: [_jsx("button", { onClick: logout, "aria-label": "Sair", style: {
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 4,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    marginBottom: 4,
                                    marginLeft: 'auto',
                                }, children: _jsx(Icon, { name: "logout", size: 22, color: "var(--color-text-ter)" }) }), _jsxs("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: 'var(--color-text-ter)',
                                    margin: 0,
                                }, children: ["Rota de hoje \u00B7 ", todayLabel] }), _jsxs("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: 'var(--color-text)',
                                    margin: 0,
                                }, children: ["Ol\u00E1, ", courierName] })] })] }), _jsx("div", { style: { margin: '0 20px 12px' }, children: _jsx(SegmentedControl, { value: tab, onChange: setTab }) }), data && (_jsx("div", { style: { margin: '0 20px' }, children: _jsx(ProgressCard, { confirmed: confirmedCount, total: data.totalStops, totalBreads: data.totalBreads, confirmedBreads: confirmedBreads }) })), isLoading && (_jsx("div", { style: {
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '40px 20px',
                }, children: _jsx("p", { style: {
                        fontFamily: 'var(--font-body)',
                        fontSize: 15,
                        color: 'var(--color-text-sec)',
                    }, children: "Carregando entregas..." }) })), !isLoading && data && tab === 'list' && (_jsx("div", { style: {
                    padding: '12px 20px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                }, children: data.condos.length === 0 ? (_jsxs("div", { style: {
                        padding: '40px 0',
                        textAlign: 'center',
                    }, children: [_jsx("p", { style: {
                                fontFamily: 'var(--font-display)',
                                fontSize: 18,
                                fontWeight: 700,
                                color: 'var(--color-text)',
                                margin: '0 0 8px',
                            }, children: "Sem entregas hoje" }), _jsx("p", { style: {
                                fontFamily: 'var(--font-body)',
                                fontSize: 15,
                                color: 'var(--color-text-sec)',
                                margin: 0,
                            }, children: "N\u00E3o h\u00E1 pedidos atribu\u00EDdos a voc\u00EA para hoje." })] })) : (data.condos.map((condo, index) => (_jsx(CondoAccordion, { condo: condo, order: index + 1, isOpen: openAccordion === index, onToggle: () => setOpenAccordion(openAccordion === index ? -1 : index), confirmedIds: confirmedIds, onConfirm: (stop) => {
                        setSelectedStop(stop);
                        setDialogOpen(true);
                    } }, condo.condominiumId)))) })), !isLoading && data && tab === 'route' && (_jsx("div", { style: { padding: '12px 20px 0' }, children: _jsx(CourierRouteView, { condos: data.condos, route: data.route }) })), _jsx(ConfirmDeliveryDialog, { stop: selectedStop, isOpen: dialogOpen, onClose: () => {
                    setDialogOpen(false);
                    setSelectedStop(null);
                }, onConfirmed: (id) => {
                    setConfirmedIds((prev) => new Set([...prev, id]));
                    setDialogOpen(false);
                    setSelectedStop(null);
                } })] }));
}
