import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../brand/Icon'
import { CourierMap } from '../courier/CourierMap'
import { CRAvatar, CRLabel, CRNote, CRProof, CRTag, crInitials, type CRProofState } from '../courier/kit'
import { brtTime } from '../../lib/courierApi'

/** GET /admin/couriers/live */
export interface LiveData {
  date: string
  base: { endereco: string; lat: number; lng: number } | null
  routes: Array<{
    courierId: string
    courierName: string
    slotId: string
    slotLabel: string
    slotEmoji: string
    state: 'pronta' | 'em_rota' | 'encerrada'
    startedAt: string | null
    endedAt: string | null
    etaEnd: string | null
    done: number
    total: number
    noPhoto: number
    reordered: boolean
    lastPos: { lat: number; lng: number; at: string; stale: boolean } | null
  }>
  stops: Array<{
    key: string
    courierId: string
    slotId: string
    condominiumName: string
    clientName: string
    apartment: string
    block: string | null
    status: 'pendente' | 'entregue' | 'nao_entregue'
    time: string | null
    failureLabel: string | null
    proof: CRProofState | null
    noPhoto: boolean
    noPhotoNote: string | null
  }>
  condos: Array<{ id: string; name: string; lat: number | null; lng: number | null; done: boolean }>
}

/** Consulta a cada 30 s com a aba aberta (T-9). */
export const LIVE_POLL_MS = 30_000

type Filter = 'todas' | 'pendentes' | 'semFoto'

const minutesAgo = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
const shortName = (n: string) => {
  const p = n.trim().split(/\s+/)
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0]
}

/**
 * A2 · Entregas de hoje: mapa ao vivo (posição só com a rota iniciada), um card por rota com
 * progresso, término previsto, "sem foto" e "ordem alterada", e as paradas com os filtros
 * Todas · Pendentes · Sem foto.
 */
export function LiveRoutesCard({ onOpenRoute }: { onOpenRoute: (courierId: string, slotId: string) => void }) {
  const [data, setData] = useState<LiveData | null>(null)
  const [filter, setFilter] = useState<Filter>('todas')

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/couriers/live')
      if (res.ok) setData((await res.json()) as LiveData)
    } catch {
      // mantém o último retrato
    }
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, LIVE_POLL_MS)
    return () => clearInterval(t)
  }, [load])

  if (!data || data.routes.length === 0) return null

  const enRoute = data.routes.filter((r) => r.state === 'em_rota')
  const allEnded = data.routes.every((r) => r.state === 'encerrada')
  const stale = enRoute.filter((r) => r.lastPos?.stale)
  const status = enRoute.length > 0 ? `${enRoute.length} em rota` : allEnded ? 'todas encerradas' : 'nenhuma rota iniciada'
  const stops = data.stops.filter((s) => (filter === 'pendentes' ? s.status === 'pendente' : filter === 'semFoto' ? s.noPhoto : true))
  const counts = { todas: data.stops.length, pendentes: data.stops.filter((s) => s.status === 'pendente').length, semFoto: data.stops.filter((s) => s.noPhoto).length }
  const mapStops = data.condos.flatMap((c, i) => (c.lat !== null && c.lng !== null ? [{ id: c.id, lat: c.lat, lng: c.lng, n: i + 1, done: c.done, label: c.name }] : []))
  const couriers = enRoute.flatMap((r) => (r.lastPos ? [{ id: `${r.courierId}|${r.slotId}`, lat: r.lastPos.lat, lng: r.lastPos.lng, initials: crInitials(r.courierName), stale: r.lastPos.stale }] : []))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18, fontFamily: 'var(--font-body)' }}>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px' }}>
          <span style={{ width: 9, height: 9, borderRadius: 99, background: enRoute.length ? 'var(--color-good)' : 'var(--color-text-ter)' }} />
          <span style={{ flex: 1, fontWeight: 800, fontSize: 15, color: 'var(--color-text)' }}>Mapa ao vivo</span>
          <span style={{ fontSize: 12.5, color: 'var(--color-text-sec)', fontWeight: 700 }}>{status}</span>
        </div>
        {mapStops.length > 0 && <CourierMap height={230} radius={0} stops={mapStops} couriers={couriers} base={data.base} path="none" ariaLabel="Mapa ao vivo das entregas" />}
        {stale.map((r) => (
          <CRNote key={`${r.courierId}|${r.slotId}`} icon="cloudOff" tone="gold" style={{ margin: 12 }}>
            <b>
              {shortName(r.courierName)} sem posição há {minutesAgo(r.lastPos!.at)} min.
            </b>{' '}
            App fechado ou sem sinal. A última posição aparece esmaecida.
          </CRNote>
        ))}
        {enRoute.length === 0 && !allEnded && (
          <div style={{ padding: 14, fontSize: 13.5, color: 'var(--color-text-sec)' }}>
            As posições aparecem quando o entregador toca em <b>Iniciar rota</b>.
          </div>
        )}
      </div>

      <CRLabel style={{ marginTop: 4 }}>Rotas de hoje</CRLabel>
      {data.routes.map((r) => (
        <button
          key={`${r.courierId}|${r.slotId}`}
          type="button"
          onClick={() => onOpenRoute(r.courierId, r.slotId)}
          aria-label={`Rota de ${r.courierName} · ${r.slotLabel}`}
          style={{ textAlign: 'left', background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 18, padding: 14, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <CRAvatar name={r.courierName} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--color-text)' }}>
                {shortName(r.courierName)}{' '}
                <span style={{ fontWeight: 600, color: 'var(--color-text-sec)', fontSize: 13 }}>
                  · {r.slotEmoji} {r.slotLabel}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: r.state === 'em_rota' ? 'var(--color-good)' : 'var(--color-text-sec)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                {r.state === 'pronta' && (
                  <>
                    <Icon name="clock" size={13} aria-hidden="true" />
                    Não iniciada
                  </>
                )}
                {r.state === 'em_rota' && (
                  <>
                    <span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--color-good)' }} />
                    Em rota{brtTime(r.startedAt) ? ` desde ${brtTime(r.startedAt)}` : ''}
                    {r.etaEnd ? ` · término ~${r.etaEnd}` : ''}
                  </>
                )}
                {r.state === 'encerrada' && (
                  <>
                    <Icon name="check" size={13} stroke={2.8} aria-hidden="true" />
                    Encerrada{brtTime(r.endedAt) ? ` ${brtTime(r.endedAt)}` : ''}
                  </>
                )}
              </div>
            </div>
            <CRTag tone={r.done === r.total ? 'good' : 'gold'}>
              {r.done}/{r.total}
            </CRTag>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: 'var(--color-surface-2)', marginTop: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${r.total ? (r.done / r.total) * 100 : 0}%`, background: r.done === r.total ? 'var(--color-good)' : 'var(--color-gold)' }} />
          </div>
          {(r.reordered || r.noPhoto > 0 || r.lastPos) && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {r.reordered && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <CRTag icon="repeat">ordem alterada hoje</CRTag>
                  <b style={{ fontSize: 12.5, color: 'var(--color-accent)' }}>ver</b>
                </span>
              )}
              {r.noPhoto > 0 && (
                <CRTag icon="ban" tone="danger">
                  {r.noPhoto} sem foto
                </CRTag>
              )}
              {r.lastPos && (
                <CRTag icon={r.lastPos.stale ? 'cloudOff' : 'pin'} tone={r.lastPos.stale ? 'warn' : 'neutral'}>
                  {r.lastPos.stale ? 'última posição' : 'posição'} há {minutesAgo(r.lastPos.at)} min
                </CRTag>
              )}
            </div>
          )}
        </button>
      ))}

      <CRLabel style={{ marginTop: 4 }}>Paradas</CRLabel>
      <div role="radiogroup" aria-label="Filtrar paradas" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(
          [
            ['todas', 'Todas'],
            ['pendentes', 'Pendentes'],
            ['semFoto', 'Sem foto'],
          ] as const
        ).map(([k, l]) => {
          const on = filter === k
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setFilter(k)}
              style={{ height: 36, padding: '0 12px', borderRadius: 99, display: 'inline-flex', alignItems: 'center', gap: 6, background: on ? 'var(--color-text)' : 'var(--color-surface)', color: on ? 'var(--color-app-bg)' : 'var(--color-text)', border: `1.5px solid ${on ? 'var(--color-text)' : 'var(--color-border)'}`, fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
            >
              {k === 'semFoto' && <Icon name="ban" size={13} stroke={2.4} aria-hidden="true" />}
              {l} <span style={{ opacity: 0.6 }}>{counts[k]}</span>
            </button>
          )
        })}
      </div>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 16 }}>
        {stops.length === 0 && <div style={{ padding: 14, fontSize: 13.5, color: 'var(--color-text-sec)' }}>Nenhuma parada neste filtro.</div>}
        {stops.map((s, i) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: i ? '1px solid var(--color-border-2)' : 'none' }}>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 99,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                background: s.status === 'entregue' ? 'var(--color-good-soft)' : s.status === 'nao_entregue' ? 'var(--color-warn-soft)' : 'var(--color-surface-2)',
                color: s.status === 'entregue' ? 'var(--color-good)' : s.status === 'nao_entregue' ? 'var(--color-warn)' : 'var(--color-text-ter)',
              }}
            >
              <Icon name={s.status === 'entregue' ? 'check' : s.status === 'nao_entregue' ? 'x' : 'clock'} size={15} stroke={2.6} aria-hidden="true" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>
                {s.clientName}
                {s.apartment ? ` · Apto ${s.apartment}` : ''}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-ter)' }}>{s.condominiumName}</div>
              {s.status !== 'pendente' && (
                <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                  {s.failureLabel && (
                    <CRTag icon="x" tone="danger" size="sm">
                      {s.failureLabel}
                    </CRTag>
                  )}
                  <CRProof state={s.proof} />
                  {s.noPhotoNote && <span style={{ fontSize: 12, color: 'var(--color-text-sec)' }}>{s.noPhotoNote}</span>}
                </div>
              )}
            </div>
            <span style={{ fontSize: 13, color: 'var(--color-text-sec)', fontWeight: 700 }}>{s.time ?? '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
