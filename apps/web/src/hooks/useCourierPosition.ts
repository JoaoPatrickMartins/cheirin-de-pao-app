import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/apiFetch'

export interface LatLng {
  lat: number
  lng: number
}

/** Raio da chegada automática ao prédio (T-10). */
export const ARRIVAL_RADIUS_M = 80
/** A posição vai à operação no máximo a cada 60 s (T-9). */
export const POSITION_SEND_MS = 60_000

/** Distância em metros (haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export type PositionStatus = 'off' | 'on' | 'denied' | 'unavailable'

/**
 * Posição do entregador com a rota INICIADA e o app aberto: "você está aqui" no mapa, chegada ao
 * prédio e a última posição para o mapa ao vivo do admin (só a última, a cada 60 s). Fora da rota,
 * não liga o GPS.
 */
export function useCourierPosition({ active, runId }: { active: boolean; runId: string | null }): { position: LatLng | null; status: PositionStatus } {
  const [position, setPosition] = useState<LatLng | null>(null)
  const [status, setStatus] = useState<PositionStatus>('off')
  const lastSent = useRef(0)
  const runRef = useRef(runId)
  runRef.current = runId

  useEffect(() => {
    if (!active) {
      setStatus('off')
      return
    }
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined
    if (!geo) {
      setStatus('unavailable')
      return
    }
    const id = geo.watchPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude }
        setPosition(pos)
        setStatus('on')
        const now = Date.now()
        if (runRef.current && now - lastSent.current >= POSITION_SEND_MS) {
          lastSent.current = now
          void apiFetch(`/courier/runs/${runRef.current}/position`, { method: 'POST', body: JSON.stringify(pos) }).catch(() => {})
        }
      },
      (err) => setStatus(err.code === 1 ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    )
    return () => geo.clearWatch(id)
  }, [active])

  return { position, status }
}
