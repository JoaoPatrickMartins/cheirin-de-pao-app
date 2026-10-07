import { useCallback, useEffect, useState } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../brand/Icon'
import { CourierMap } from '../courier/CourierMap'
import { CRLabel, CRNote, CRTag } from '../courier/kit'
import { fmtDuration } from '../../lib/courierApi'
import { OrderList, SortRow, btn, km, shortDate } from './route-kit'

interface Condo {
  id: string
  name: string
  lat: number | null
  lng: number | null
}

/** GET /admin/couriers/:id/routes/:slotId */
interface RouteView {
  courier: { id: string; name: string }
  slot: { slotId: string; label: string; emoji: string; time: string }
  base: { endereco: string; lat: number; lng: number } | null
  condos: Condo[]
  saved: { condominiumIds: string[]; km: number | null; durationMin: number | null; geometry: Array<[number, number]>; acceptedAt: string } | null
  suggestion: {
    condominiumIds: string[]
    km: number | null
    durationMin: number | null
    geometry: Array<[number, number]>
    reason: 'FIRST' | 'NEW_CONDO'
    newIds: string[]
    createdAt: string
    deltaKm: number | null
  } | null
  changes: Array<{ runId: string; date: string; condominiumIds: string[]; km: number | null; description: string }>
  /** Sem rota própria: o turno segue a rota padrão (plano-rota-padrao). Ausente numa API antiga. */
  followsDefault?: boolean
  /** A rota padrão com os prédios deste entregador/turno. null = não há rota padrão. */
  defaultOrder?: { condominiumIds: string[]; km: number | null; durationMin: number | null; geometry: Array<[number, number]> } | null
}

const firstName = (n: string) => n.trim().split(/\s+/)[0]

function dayTitle(date: string): string {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const [, m, d] = date.split('-')
  if (date === today) return `Hoje · ${d}/${m}`
  const w = new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  return `${w.charAt(0).toUpperCase()}${w.slice(1)} · ${d}/${m}`
}

/**
 * A4 · Rota do entregador num turno: rota salva, sugestão (Usar · Manter · Ajustar), ajuste por
 * arrastar com o km recalculado ao soltar, e as ordens que o entregador usou (Adotar). Com rota
 * padrão: "Segue a rota padrão" (sem rota própria) ou "Rota própria" + "Voltar à rota padrão".
 */
export function CourierRouteScreen({
  courierId,
  slotId: initialSlot,
  slots,
  onBack,
}: {
  courierId: string
  slotId: string
  /** Turnos para trocar dentro da tela (opcional). */
  slots?: Array<{ slotId: string; label: string; emoji?: string }>
  onBack: () => void
}) {
  const [slotId, setSlotId] = useState(initialSlot)
  const [view, setView] = useState<RouteView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [savedNote, setSavedNote] = useState<'saved' | 'reset' | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [adjust, setAdjust] = useState<string[] | null>(null)
  const [preview, setPreview] = useState<{ km: number | null; durationMin: number | null; geometry: Array<[number, number]> } | null>(null)
  const [openChange, setOpenChange] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await apiFetch(`/admin/couriers/${courierId}/routes/${encodeURIComponent(slotId)}`)
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error((body as { error?: string } | null)?.error ?? 'Não foi possível carregar a rota.')
      setView(body as RouteView)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a rota.')
    }
  }, [courierId, slotId])

  useEffect(() => {
    setView(null)
    setAdjust(null)
    setSavedNote(null)
    setConfirmReset(false)
    void load()
  }, [load])

  const act = async (path: string, init: RequestInit, note: 'saved' | 'reset' = 'saved') => {
    setBusy(true)
    setError(null)
    try {
      const res = await apiFetch(path, init)
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error((body as { error?: string } | null)?.error ?? 'Não foi possível salvar.')
      setView(body as RouteView)
      setAdjust(null)
      setPreview(null)
      setConfirmReset(false)
      setSavedNote(note)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setBusy(false)
    }
  }
  const base = `/admin/couriers/${courierId}/routes/${encodeURIComponent(slotId)}`

  const recalc = async (ids: string[]) => {
    try {
      const res = await apiFetch('/admin/routes/preview', { method: 'POST', body: JSON.stringify({ condominiumIds: ids }) })
      if (res.ok) setPreview(await res.json())
    } catch {
      // segue com o km anterior
    }
  }

  const onDragEnd = (e: DragEndEvent) => {
    if (!adjust || !e.over || e.active.id === e.over.id) return
    const next = arrayMove(adjust, adjust.indexOf(String(e.active.id)), adjust.indexOf(String(e.over.id)))
    setAdjust(next)
    void recalc(next)
  }

  const names = new Map((view?.condos ?? []).map((c) => [c.id, c.name]))
  const coords = new Map((view?.condos ?? []).map((c) => [c.id, c]))
  const mapStops = (ids: string[]) =>
    ids.flatMap((id, i) => {
      const c = coords.get(id)
      return c && c.lat !== null && c.lng !== null ? [{ id, lat: c.lat, lng: c.lng, n: i + 1, label: c.name }] : []
    })
  const sug = view?.suggestion ?? null
  const saved = view?.saved ?? null
  const follows = view?.followsDefault ?? false
  const def = view?.defaultOrder ?? null
  const reference = sug ?? saved ?? (follows ? def : null)
  const moves = (id: string) => {
    if (!saved || !sug) return null
    if (sug.newIds.includes(id)) return <CRTag icon="plus" tone="dark" size="sm">novo</CRTag>
    const before = saved.condominiumIds.filter((x) => sug.condominiumIds.includes(x)).indexOf(id)
    const now = sug.condominiumIds.filter((x) => saved.condominiumIds.includes(x)).indexOf(id)
    if (before === -1 || now === -1 || before === now) return null
    return <CRTag icon="repeat" size="sm">{now < before ? `subiu ${before - now}` : `desceu ${now - before}`}</CRTag>
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--color-app-bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 20px 14px' }}>
        <button type="button" aria-label="Voltar" onClick={onBack} style={{ background: 'var(--color-surface-2)', border: 'none', width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <Icon name="arrowL" size={20} color="var(--color-text)" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          {view && <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-ter)', fontWeight: 600 }}>{view.courier.name}</div>}
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: 'var(--color-text)', letterSpacing: '-0.02em', margin: 0 }}>
            Rota{view ? ` · ${view.slot.emoji ? `${view.slot.emoji} ` : ''}${view.slot.label}` : ''}
          </h2>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {slots && slots.length > 1 && (
          <div role="tablist" aria-label="Turno" style={{ display: 'flex', gap: 4, background: 'var(--color-surface-2)', borderRadius: 13, padding: 4 }}>
            {slots.map((s) => (
              <button
                key={s.slotId}
                type="button"
                role="tab"
                aria-selected={s.slotId === slotId}
                onClick={() => setSlotId(s.slotId)}
                style={{ flex: 1, height: 38, borderRadius: 10, border: 'none', background: s.slotId === slotId ? 'var(--color-surface)' : 'transparent', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 13, color: s.slotId === slotId ? 'var(--color-text)' : 'var(--color-text-sec)', cursor: 'pointer' }}
              >
                {s.emoji ? `${s.emoji} ` : ''}
                {s.label}
              </button>
            ))}
          </div>
        )}

        {error && (
          <CRNote icon="alert" tone="danger">
            {error}
          </CRNote>
        )}
        {!view && !error && <div style={{ textAlign: 'center', padding: 32, fontFamily: 'var(--font-body)', color: 'var(--color-text-ter)' }}>Carregando…</div>}

        {view && !adjust && (follows || (saved && def)) && (
          <div style={{ display: 'flex' }}>
            {follows ? (
              <CRTag icon="route" tone="gold">
                Segue a rota padrão
              </CRTag>
            ) : (
              <CRTag icon="user">Rota própria</CRTag>
            )}
          </div>
        )}

        {view && savedNote && (
          <CRNote icon="check" tone="good">
            {savedNote === 'reset'
              ? `Pronto: ${firstName(view.courier.name)} · ${view.slot.label} volta a seguir a rota padrão a partir da próxima rota.`
              : `Rota salva. Vale a partir da próxima rota para ${firstName(view.courier.name)} · ${view.slot.label}.`}
          </CRNote>
        )}

        {view && !reference && !follows && !adjust && (
          <CRNote icon="route">Ainda não há rota para este turno. A primeira sugestão aparece quando a divisão de entregas for aprovada, ou monte a rota padrão em Rotas e comprovante.</CRNote>
        )}

        {view && follows && !adjust && (def && def.condominiumIds.length > 0 ? (
          <>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 18, overflow: 'hidden' }}>
              <CourierMap height={170} radius={0} stops={mapStops(def.condominiumIds)} base={view.base} geometry={def.geometry} />
              <div style={{ padding: '12px 16px', fontFamily: 'var(--font-body)' }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--color-text-ter)' }}>SEGUE A ROTA PADRÃO</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--color-text)' }}>
                  ~{km(def.km)} km{def.durationMin !== null ? ` · ~${fmtDuration(def.durationMin)}` : ''}
                </div>
              </div>
            </div>
            <CRLabel
              right={
                <button
                  type="button"
                  style={{ ...btn('ghost'), flex: 'none', minHeight: 36, fontSize: 13 }}
                  onClick={() => {
                    setAdjust(def.condominiumIds)
                    setPreview({ km: def.km, durationMin: def.durationMin, geometry: def.geometry })
                  }}
                >
                  <Icon name="grip" size={15} aria-hidden="true" />
                  Ajustar
                </button>
              }
            >
              Ordem da rota padrão
            </CRLabel>
            <OrderList ids={def.condominiumIds} names={names} />
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-sec)', textAlign: 'center', lineHeight: 1.45 }}>
              Com os prédios que {firstName(view.courier.name)} atendeu neste turno nos últimos 30 dias. Ajustar cria uma rota própria só para {firstName(view.courier.name)}.
            </div>
          </>
        ) : (
          <CRNote icon="route">
            Ainda sem entregas neste turno. {firstName(view.courier.name)} segue a rota padrão.
          </CRNote>
        ))}

        {view && saved && !adjust && (
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 18, overflow: 'hidden' }}>
            <CourierMap height={170} radius={0} stops={mapStops(saved.condominiumIds)} base={view.base} geometry={saved.geometry} />
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-body)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--color-text-ter)' }}>{def ? 'ROTA PRÓPRIA' : 'ROTA SALVA'}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--color-text)' }}>
                  ~{km(saved.km)} km{saved.durationMin !== null ? ` · ~${fmtDuration(saved.durationMin)}` : ''}
                </div>
              </div>
              <span style={{ fontSize: 12.5, color: 'var(--color-text-sec)', fontWeight: 700 }}>desde {shortDate(saved.acceptedAt)}</span>
            </div>
          </div>
        )}

        {view && sug && !adjust && (
          <div style={{ background: 'var(--color-surface)', border: '2px solid var(--color-gold)', borderRadius: 18, padding: 16, fontFamily: 'var(--font-body)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="spark" size={19} color="var(--color-accent)" aria-hidden="true" />
              <span style={{ flex: 1, fontWeight: 800, fontSize: 15.5, color: 'var(--color-text)' }}>{sug.reason === 'FIRST' ? 'Primeira sugestão' : 'Sugestão nova'}</span>
              {sug.deltaKm !== null && sug.deltaKm !== 0 && (
                <CRTag tone={sug.deltaKm < 0 ? 'good' : 'warn'} size="sm">
                  {sug.deltaKm < 0 ? '−' : '+'}
                  {km(Math.abs(sug.deltaKm))} km
                </CRTag>
              )}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--color-text)', marginTop: 6 }}>
              ~{km(sug.km)} km{sug.durationMin !== null ? ` · ~${fmtDuration(sug.durationMin)}` : ''}
            </div>
            {sug.reason === 'NEW_CONDO' && sug.newIds.length > 0 && (
              <div style={{ fontSize: 13, color: 'var(--color-text-sec)', marginTop: 2 }}>
                Motivo: <b>{sug.newIds.map((id) => names.get(id) ?? 'prédio novo').join(', ')}</b> entrou na rota em {shortDate(sug.createdAt)}.
              </div>
            )}
            {sug.reason === 'NEW_CONDO' && (
              <CRNote icon="alert" style={{ marginTop: 10 }}>
                Até você decidir, o dia usa a rota salva com o prédio novo na posição sugerida.
              </CRNote>
            )}
            <div style={{ marginTop: 12 }}>
              <OrderList ids={sug.condominiumIds} names={names} highlight={moves} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              <button type="button" disabled={busy} style={btn('gold', true)} onClick={() => void act(`${base}/accept`, { method: 'POST' })}>
                <Icon name="check" size={17} aria-hidden="true" />
                Usar sugestão
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                {saved && (
                  <button type="button" disabled={busy} style={btn('ghost')} onClick={() => void act(`${base}/keep`, { method: 'POST' })}>
                    Manter a atual
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  style={btn('ghost')}
                  onClick={() => {
                    setAdjust(sug.condominiumIds)
                    setPreview({ km: sug.km, durationMin: sug.durationMin, geometry: sug.geometry })
                  }}
                >
                  <Icon name="grip" size={16} aria-hidden="true" />
                  Ajustar
                </button>
              </div>
            </div>
          </div>
        )}

        {view && saved && !sug && !adjust && (
          <>
            <CRLabel
              right={
                <button
                  type="button"
                  style={{ ...btn('ghost'), flex: 'none', minHeight: 36, fontSize: 13 }}
                  onClick={() => {
                    setAdjust(saved.condominiumIds)
                    setPreview({ km: saved.km, durationMin: saved.durationMin, geometry: saved.geometry })
                  }}
                >
                  <Icon name="grip" size={15} aria-hidden="true" />
                  Ajustar
                </button>
              }
            >
              Ordem salva
            </CRLabel>
            <OrderList ids={saved.condominiumIds} names={names} />
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-sec)', textAlign: 'center' }}>Nenhuma sugestão nova. A rota está em dia.</div>
          </>
        )}

        {view && adjust && (
          <>
            <CRNote icon="grip" tone="gold">
              Arraste para mudar a ordem. O km e a hora prevista recalculam na hora.
            </CRNote>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={adjust} strategy={verticalListSortingStrategy}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {adjust.map((id, i) => (
                    <SortRow key={id} id={id} index={i} name={names.get(id) ?? 'Prédio'} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, background: 'var(--color-surface-2)', fontFamily: 'var(--font-body)' }}>
              <Icon name="route" size={18} color="var(--color-accent)" aria-hidden="true" />
              <span style={{ flex: 1, fontWeight: 800, fontSize: 14.5 }}>
                ~{km(preview?.km ?? null)} km{preview?.durationMin != null ? ` · ~${fmtDuration(preview.durationMin)}` : ''}
              </span>
              {preview?.km != null && reference?.km != null && preview.km !== reference.km && (
                <span style={{ fontSize: 12.5, color: 'var(--color-text-sec)', fontWeight: 700 }}>
                  {preview.km > reference.km ? '+' : '−'}
                  {km(Math.abs(preview.km - reference.km))} km vs {sug ? 'sugestão' : saved ? 'rota salva' : 'rota padrão'}
                </span>
              )}
            </div>
            <button type="button" disabled={busy} style={btn('primary', true)} onClick={() => void act(base, { method: 'PUT', body: JSON.stringify({ condominiumIds: adjust }) })}>
              <Icon name="check" size={17} color="#fff" aria-hidden="true" />
              Salvar rota
            </button>
            <button type="button" disabled={busy} style={btn('ghost', true)} onClick={() => setAdjust(null)}>
              Cancelar
            </button>
          </>
        )}

        {view && saved && def && !follows && !adjust && (confirmReset ? (
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <CRNote icon="alert" tone="gold">
              A rota própria de {firstName(view.courier.name)} · {view.slot.label} sai, e o turno passa a seguir a rota padrão
              {def.km !== null ? ` (~${km(def.km)} km com os prédios deste turno)` : ''}. A ordem própria se perde.
            </CRNote>
            <button type="button" disabled={busy} style={btn('primary', true)} onClick={() => void act(`${base}/reset`, { method: 'POST' }, 'reset')}>
              Voltar à rota padrão
            </button>
            <button type="button" disabled={busy} style={btn('ghost', true)} onClick={() => setConfirmReset(false)}>
              Cancelar
            </button>
          </div>
        ) : (
          <button type="button" style={btn('ghost', true)} onClick={() => setConfirmReset(true)}>
            <Icon name="route" size={16} aria-hidden="true" />
            Voltar à rota padrão
          </button>
        ))}

        {view && view.changes.length > 0 && !adjust && (
          <>
            <CRLabel style={{ marginTop: 4 }}>Alterações do entregador</CRLabel>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 16, fontFamily: 'var(--font-body)' }}>
              {view.changes.map((c, i) => (
                <div key={c.runId} style={{ padding: '12px 16px', borderTop: i ? '1px solid var(--color-border-2)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="repeat" size={16} color="var(--color-accent)" aria-hidden="true" />
                    <span style={{ flex: 1, fontWeight: 800, fontSize: 14.5, color: 'var(--color-text)' }}>{dayTitle(c.date)}</span>
                    {c.km !== null && <span style={{ fontSize: 12.5, color: 'var(--color-text-sec)', fontWeight: 700 }}>~{km(c.km)} km</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-sec)', margin: '3px 0 8px 24px' }}>{c.description}</div>
                  {openChange === c.runId && (
                    <div style={{ margin: '0 0 8px 24px' }}>
                      <OrderList ids={c.condominiumIds} names={names} />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginLeft: 24 }}>
                    <button type="button" style={{ ...btn('ghost'), flex: 'none', minHeight: 36, fontSize: 13 }} onClick={() => setOpenChange(openChange === c.runId ? null : c.runId)}>
                      {openChange === c.runId ? 'Esconder ordem' : 'Ver ordem'}
                    </button>
                    <button type="button" disabled={busy} style={{ ...btn('soft'), flex: 'none', minHeight: 36, fontSize: 13 }} onClick={() => void act(`${base}/adopt/${c.runId}`, { method: 'POST' })}>
                      {def ? 'Adotar como rota própria' : 'Adotar como rota padrão'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
