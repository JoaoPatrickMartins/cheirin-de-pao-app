import { useEffect, type ReactNode } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Ic } from '../brand/Icon'

/**
 * Mapa da rota (E9 do entregador, A2/A4 do admin) — tiles do OpenStreetMap (V-14).
 *
 * - Prédios numerados na ordem; feitos com ✓ verde; o próximo em dourado.
 * - Base (casinha), "você está aqui" (ponto verde com halo) e entregadores (iniciais) no admin.
 * - `path`: `route` desenha o traçado do OSRM; `points` liga os pontos em linha reta (sem
 *   traçado); `none` só os pontos.
 */
export interface MapStop {
  id: string
  lat: number
  lng: number
  n: number
  done?: boolean
  next?: boolean
  label?: string
}

export interface MapCourier {
  id: string
  lat: number
  lng: number
  initials: string
  stale?: boolean
}

export interface CourierMapProps {
  stops: MapStop[]
  base?: { lat: number; lng: number } | null
  me?: { lat: number; lng: number } | null
  geometry?: Array<[number, number]>
  path?: 'route' | 'points' | 'none'
  couriers?: MapCourier[]
  height?: number
  radius?: number
  /** Selo no canto (ex.: "~9,2 km · 4 prédios"). */
  label?: ReactNode
  dim?: boolean
  /** Muda para recentrar em "você está aqui". */
  centerKey?: number
  ariaLabel?: string
}

const svg = (path: string, color: string, size = 16, stroke = 3.2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`

function stopIcon(s: MapStop): L.DivIcon {
  const bg = s.done ? '#DCEBDF' : s.next ? '#E3AC3F' : '#1E1207'
  const fg = s.done ? '#3E7C53' : s.next ? '#1E1207' : '#E3AC3F'
  const inner = s.done ? svg(Ic.check, '#3E7C53') : String(s.n)
  return L.divIcon({
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `<div style="width:34px;height:34px;border-radius:10px;background:${bg};color:${fg};display:grid;place-items:center;font:800 15px 'Bricolage Grotesque Variable',sans-serif;box-shadow:0 3px 8px rgba(0,0,0,.3);border:2px solid ${s.done ? '#3E7C53' : '#E3AC3F'};opacity:${s.done ? 0.85 : 1}">${inner}</div>`,
  })
}

const baseIcon = L.divIcon({
  className: '',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  html: `<div style="width:34px;height:34px;border-radius:11px;background:#FAF5EC;border:2.5px solid #1E1207;display:grid;place-items:center;box-shadow:0 3px 8px rgba(0,0,0,.25)">${svg(Ic.home, '#1E1207', 18, 2.2)}</div>`,
})

const meIcon = L.divIcon({
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<div class="cdp-halo" style="width:22px;height:22px;border-radius:99px;background:#3E7C53;border:3.5px solid #fff;box-sizing:border-box"></div>`,
})

function courierIcon(c: MapCourier): L.DivIcon {
  const ring = c.stale ? '#A89A82' : '#3E7C53'
  return L.divIcon({
    className: '',
    iconSize: [48, 56],
    iconAnchor: [24, 52],
    html: `<div style="display:flex;flex-direction:column;align-items:center;opacity:${c.stale ? 0.6 : 1}"><div style="width:42px;height:42px;border-radius:99px;background:#1E1207;color:#E3AC3F;border:3px solid ${ring};display:grid;place-items:center;font:800 14px 'Bricolage Grotesque Variable',sans-serif;box-shadow:0 4px 10px rgba(0,0,0,.35)">${c.initials}</div><div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${ring}"></div></div>`,
  })
}

function Fit({ points, centerKey, me }: { points: Array<[number, number]>; centerKey?: number; me?: { lat: number; lng: number } | null }) {
  const map = useMap()
  const sig = points.map((p) => p.join(',')).join(';')
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [34, 34] })
    else if (points.length === 1) map.setView(points[0], 16)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, sig])
  useEffect(() => {
    if (centerKey && me) map.setView([me.lat, me.lng], 16)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerKey])
  return null
}

export function CourierMap({
  stops,
  base,
  me,
  geometry = [],
  path = 'route',
  couriers = [],
  height = 290,
  radius = 22,
  label,
  dim,
  centerKey,
  ariaLabel = 'Mapa da rota',
}: CourierMapProps) {
  const line: Array<[number, number]> = [...(base ? [[base.lat, base.lng] as [number, number]] : []), ...stops.map((s) => [s.lat, s.lng] as [number, number])]
  const all: Array<[number, number]> = [...line, ...(me ? [[me.lat, me.lng] as [number, number]] : []), ...couriers.map((c) => [c.lat, c.lng] as [number, number])]
  const center: [number, number] = all[0] ?? [-23.55, -46.63]
  const drawRoute = path === 'route' && geometry.length > 1
  const drawPoints = (path === 'points' || (path === 'route' && geometry.length <= 1)) && line.length > 1

  return (
    <div style={{ position: 'relative', zIndex: 0, isolation: 'isolate', height, borderRadius: radius, overflow: 'hidden', background: '#EFE6D3', border: '1px solid var(--color-border-2)' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: dim ? 0.6 : 1 }}>
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} aria-label={ariaLabel} zoomControl={false} attributionControl>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>' />
          {drawRoute && <Polyline positions={geometry} pathOptions={{ color: '#1E1207', weight: 7, opacity: 0.12 }} />}
          {drawRoute && <Polyline positions={geometry} pathOptions={{ color: '#E3AC3F', weight: 4.5, dashArray: '2 9', lineCap: 'round' }} />}
          {drawPoints && <Polyline positions={line} pathOptions={{ color: '#E3AC3F', weight: 4.5, dashArray: '1 12', lineCap: 'round', opacity: 0.8 }} />}
          {base && <Marker position={[base.lat, base.lng]} icon={baseIcon} title="Base" />}
          {stops.map((s) => (
            <Marker key={s.id} position={[s.lat, s.lng]} icon={stopIcon(s)} title={s.label} />
          ))}
          {me && <Marker position={[me.lat, me.lng]} icon={meIcon} title="Você está aqui" />}
          {couriers.map((c) => (
            <Marker key={c.id} position={[c.lat, c.lng]} icon={courierIcon(c)} title={c.initials} />
          ))}
          <Fit points={all} centerKey={centerKey} me={me} />
        </MapContainer>
      </div>
      {label && (
        <div
          style={{
            position: 'absolute',
            left: 12,
            bottom: 12,
            zIndex: 500,
            display: 'flex',
            gap: 7,
            alignItems: 'center',
            background: 'var(--color-surface)',
            borderRadius: 12,
            padding: '8px 12px',
            boxShadow: 'var(--shadow-soft)',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 800,
            color: 'var(--color-text)',
            pointerEvents: 'none',
          }}
        >
          {label}
        </div>
      )}
    </div>
  )
}
