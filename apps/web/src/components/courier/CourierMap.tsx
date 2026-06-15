import { useEffect } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface CourierMapProps {
  waypoints: Array<{ lat: number; lng: number; name: string; order: number }>
  geometry: Array<[number, number]>
  distanceKm: string
  durationMin: number
}

function createNumberedMarker(order: number): L.DivIcon {
  return L.divIcon({
    html: `<div style="width:36px;height:36px;border-radius:12px;background:#1E1207;border:2px solid #E3AC3F;color:#E3AC3F;font-family:'Bricolage Grotesque Variable',serif;font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;">${order}</div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
}

function FitBounds({ waypoints }: { waypoints: Array<{ lat: number; lng: number }> }) {
  const map = useMap()
  useEffect(() => {
    if (waypoints.length > 0) {
      const bounds = L.latLngBounds(waypoints.map((w) => [w.lat, w.lng] as [number, number]))
      map.fitBounds(bounds, { padding: [20, 20] })
    }
  }, [map, waypoints])
  return null
}

export function CourierMap({ waypoints, geometry, distanceKm, durationMin }: CourierMapProps) {
  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          borderRadius: 22,
          overflow: 'hidden',
          height: 290,
          position: 'relative',
        }}
      >
        <MapContainer
          center={[waypoints[0]?.lat ?? -23.5, waypoints[0]?.lng ?? -46.6]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          aria-label="Mapa de rota do entregador"
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <Polyline
            positions={geometry}
            color="#E3AC3F"
            weight={4}
            dashArray="2 9"
            lineCap="round"
          />
          {waypoints.map((wp) => (
            <Marker
              key={wp.order}
              position={[wp.lat, wp.lng]}
              icon={createNumberedMarker(wp.order)}
              title={wp.name}
            />
          ))}
          <FitBounds waypoints={waypoints} />
        </MapContainer>

        {/* Tooltip de distância/tempo — overlay absoluto no canto inferior esquerdo */}
        <div
          style={{
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
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-text)',
            }}
          >
            ~{distanceKm} km · {waypoints.length} {waypoints.length === 1 ? 'parada' : 'paradas'}
          </span>
        </div>
      </div>
    </div>
  )
}
