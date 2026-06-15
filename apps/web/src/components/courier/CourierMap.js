import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
function createNumberedMarker(order) {
    return L.divIcon({
        html: `<div style="width:36px;height:36px;border-radius:12px;background:#1E1207;border:2px solid #E3AC3F;color:#E3AC3F;font-family:'Bricolage Grotesque Variable',serif;font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;">${order}</div>`,
        className: '',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
    });
}
function FitBounds({ waypoints }) {
    const map = useMap();
    useEffect(() => {
        if (waypoints.length > 0) {
            const bounds = L.latLngBounds(waypoints.map((w) => [w.lat, w.lng]));
            map.fitBounds(bounds, { padding: [20, 20] });
        }
    }, [map, waypoints]);
    return null;
}
export function CourierMap({ waypoints, geometry, distanceKm, durationMin }) {
    return (_jsx("div", { style: { position: 'relative' }, children: _jsxs("div", { style: {
                borderRadius: 22,
                overflow: 'hidden',
                height: 290,
                position: 'relative',
            }, children: [_jsxs(MapContainer, { center: [waypoints[0]?.lat ?? -23.5, waypoints[0]?.lng ?? -46.6], zoom: 13, style: { height: '100%', width: '100%' }, "aria-label": "Mapa de rota do entregador", zoomControl: false, children: [_jsx(TileLayer, { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: '\u00A9 <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>' }), _jsx(Polyline, { positions: geometry, color: "#E3AC3F", weight: 4, dashArray: "2 9", lineCap: "round" }), waypoints.map((wp) => (_jsx(Marker, { position: [wp.lat, wp.lng], icon: createNumberedMarker(wp.order), title: wp.name }, wp.order))), _jsx(FitBounds, { waypoints: waypoints })] }), _jsx("div", { style: {
                        position: 'absolute',
                        bottom: 12,
                        left: 12,
                        zIndex: 1000,
                        background: 'var(--color-surface)',
                        borderRadius: 8,
                        padding: '8px 12px',
                        boxShadow: 'var(--shadow-soft)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        pointerEvents: 'none',
                    }, children: _jsxs("span", { style: {
                            fontFamily: 'var(--font-body)',
                            fontSize: 12,
                            fontWeight: 700,
                            color: 'var(--color-text)',
                        }, children: ["~", distanceKm, " km \u00B7 ", waypoints.length, " ", waypoints.length === 1 ? 'parada' : 'paradas'] }) })] }) }));
}
