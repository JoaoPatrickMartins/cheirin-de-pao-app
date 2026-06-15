import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { CourierMap } from '../../components/courier/CourierMap';
function formatEstimatedTime(baseMinutes) {
    const now = new Date();
    const total = now.getHours() * 60 + now.getMinutes() + Math.round(baseMinutes);
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
export function CourierRouteView({ condos, route }) {
    if (route === null) {
        return (_jsx("div", { style: { padding: '20px 0' }, children: _jsxs("div", { style: {
                    background: 'var(--color-surface)',
                    borderRadius: 22,
                    padding: 24,
                    boxShadow: 'var(--shadow-soft)',
                    textAlign: 'center',
                }, children: [_jsx("p", { style: {
                            fontFamily: 'var(--font-display)',
                            fontSize: 18,
                            fontWeight: 700,
                            color: 'var(--color-text)',
                            margin: '0 0 8px',
                        }, children: "Rota indispon\u00EDvel" }), _jsx("p", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 15,
                            color: 'var(--color-text-sec)',
                            margin: 0,
                        }, children: "O c\u00E1lculo da rota est\u00E1 temporariamente indispon\u00EDvel. Use a aba Lista para as paradas." })] }) }));
    }
    const waypoints = condos
        .filter((c) => c.lat !== null && c.lng !== null)
        .map((c, i) => ({
        lat: c.lat,
        lng: c.lng,
        name: c.condominiumName,
        order: i + 1,
    }));
    const minutesPerStop = waypoints.length > 0 ? route.durationMin / waypoints.length : 0;
    const condosWithCoords = condos.filter((c) => c.lat !== null && c.lng !== null);
    return (_jsxs("div", { children: [_jsx("div", { style: { paddingBottom: 12 }, children: _jsx(CourierMap, { waypoints: waypoints, geometry: route.geometry, distanceKm: route.distanceKm, durationMin: route.durationMin }) }), _jsx("p", { style: {
                    fontFamily: 'var(--font-body)',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    color: 'var(--color-text-ter)',
                    margin: 0,
                    padding: '12px 0 8px',
                }, children: "ORDEM DE PARADAS" }), _jsx("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                }, children: condosWithCoords.map((condo, index) => {
                    const estimatedTime = formatEstimatedTime(minutesPerStop * index);
                    return (_jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '12px 16px',
                            background: 'var(--color-surface)',
                            borderRadius: 16,
                            border: '1px solid var(--color-border-2)',
                        }, children: [_jsx("div", { style: {
                                    width: 32,
                                    height: 32,
                                    borderRadius: 8,
                                    background: '#E3AC3F',
                                    color: '#1E1207',
                                    fontFamily: 'var(--font-display)',
                                    fontSize: 15,
                                    fontWeight: 800,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }, children: index + 1 }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("p", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 15,
                                            fontWeight: 700,
                                            color: 'var(--color-text)',
                                            margin: 0,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }, children: condo.condominiumName }), _jsxs("p", { style: {
                                            fontFamily: 'var(--font-body)',
                                            fontSize: 12,
                                            color: 'var(--color-text-ter)',
                                            margin: 0,
                                        }, children: [condo.stops.length, " ", condo.stops.length === 1 ? 'parada' : 'paradas'] })] }), _jsx("p", { style: {
                                    fontFamily: 'var(--font-body)',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: 'var(--color-text-sec)',
                                    margin: 0,
                                    flexShrink: 0,
                                }, children: estimatedTime })] }, condo.condominiumId));
                }) })] }));
}
