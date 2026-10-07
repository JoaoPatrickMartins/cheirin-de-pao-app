import { useEffect, useState } from 'react'
import { CRBig, CRChoice, CRLabel, CRNote, CRSheet, CRSpin, CR_DISPLAY } from './kit'
import { fmtDuration, type RouteBase, type SlotRoute } from '../../lib/courierApi'

/** Permissão de localização sem pedir (o pedido vem do toque em "Minha localização"). */
async function geoPermission(): Promise<PermissionState | 'unsupported'> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return 'unsupported'
  try {
    return (await navigator.permissions?.query({ name: 'geolocation' as PermissionName }))?.state ?? 'prompt'
  } catch {
    return 'prompt'
  }
}

function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    )
  })
}

/**
 * E8 · Iniciar rota: o turno (paradas, km, duração, horário da entrega — V-12), o ponto de partida
 * (base ou minha localização) e os avisos (cliente vê "saiu para entrega"; localização só durante a
 * rota).
 */
export function StartRunSheet({
  route,
  stops,
  base,
  onStart,
  onClose,
}: {
  route: SlotRoute
  stops: number
  base: RouteBase | null
  onStart: (mode: 'BASE' | 'GPS', pos?: { lat: number; lng: number }) => Promise<string | null>
  onClose: () => void
}) {
  const [mode, setMode] = useState<'BASE' | 'GPS'>(base ? 'BASE' : 'GPS')
  const [perm, setPerm] = useState<PermissionState | 'unsupported'>('prompt')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const noLoc = perm === 'denied' || perm === 'unsupported'

  useEffect(() => {
    void geoPermission().then((p) => {
      setPerm(p)
      if (p === 'denied' || p === 'unsupported') setMode('BASE')
    })
  }, [])

  const start = async () => {
    setBusy(true)
    setError(null)
    let pos: { lat: number; lng: number } | undefined
    if (mode === 'GPS') {
      pos = (await currentPosition()) ?? undefined
      if (!pos) {
        setPerm('denied')
        setMode('BASE')
        setBusy(false)
        setError('Não conseguimos sua localização. A rota pode começar pela base.')
        return
      }
    }
    const err = await onStart(pos ? 'GPS' : 'BASE', pos)
    setBusy(false)
    if (err) setError(err)
  }

  const km = route.route?.distanceKm ? `~${route.route.distanceKm.replace('.', ',')} km` : null
  const dur = route.route?.durationMin ? fmtDuration(route.route.durationMin) : null

  return (
    <CRSheet title="Iniciar rota" onClose={onClose} busy={busy}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 18, background: 'var(--color-espresso)', color: 'var(--color-app-bg)' }}>
        <span style={{ fontSize: 28 }} aria-hidden="true">
          {route.emoji}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 19 }}>
            {route.label || 'Turno'} · {stops} {stops === 1 ? 'parada' : 'paradas'}
          </div>
          <div style={{ fontSize: 13.5, color: '#C7B595', fontWeight: 600 }}>{[km, dur, route.time ? `entrega ${route.time}` : null].filter(Boolean).join(' · ')}</div>
        </div>
      </div>
      <CRLabel style={{ marginTop: 18 }}>Ponto de partida</CRLabel>
      <div role="radiogroup" aria-label="Ponto de partida" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <CRChoice icon="home" on={mode === 'BASE'} onClick={() => setMode('BASE')} note={base ? base.endereco : 'Sem base cadastrada: a rota começa no primeiro prédio'}>
          {base ? 'Base' : 'Primeiro prédio da rota'}
        </CRChoice>
        <CRChoice icon="locate" on={mode === 'GPS'} disabled={noLoc} onClick={() => setMode('GPS')} note={noLoc ? 'Localização desligada no celular' : 'Onde você está agora'}>
          Minha localização
        </CRChoice>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        <CRNote icon="bell" tone="gold">
          Ao iniciar, seus clientes veem que o pão saiu para entrega.
        </CRNote>
        {noLoc ? (
          <CRNote icon="alert" tone="danger">
            Sem permissão de localização: a rota começa na base e a operação não vê sua posição no mapa ao vivo.
          </CRNote>
        ) : (
          <CRNote icon="pin">Sua localização é compartilhada com a operação só durante a rota.</CRNote>
        )}
        {error && (
          <CRNote icon="cloudOff" tone="danger">
            {error}
          </CRNote>
        )}
      </div>
      <div style={{ height: 18 }} />
      <CRBig icon={busy ? undefined : 'play'} h={62} disabled={busy} onClick={() => void start()} right={busy ? <CRSpin color="var(--color-gold)" /> : null}>
        {busy ? 'Iniciando…' : 'Iniciar rota'}
      </CRBig>
    </CRSheet>
  )
}
