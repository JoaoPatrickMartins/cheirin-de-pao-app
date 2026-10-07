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
  approxLocation: boolean
  /** Encaixe automático ainda não revisado (D-3/D-11). */
  flag: 'NOVO' | 'REENCAIXADO' | null
  kmAdded: number | null
}

/** GET /admin/default-route */
interface View {
  base: { endereco: string; lat: number; lng: number } | null
  voltaBase: boolean
  saved: { condominiumIds: string[]; km: number | null; durationMin: number | null; geometry: Array<[number, number]>; savedAt: string; savedByName: string | null } | null
  condos: Condo[]
  outside: Array<{ id: string; name: string }>
}

/** POST /admin/default-route/suggest */
interface Suggestion {
  condominiumIds: string[]
  km: number | null
  durationMin: number | null
  geometry: Array<[number, number]>
  computed: boolean
  deltaKm: number | null
}

type Metrics = { km: number | null; durationMin: number | null; geometry: Array<[number, number]> }

const kmSigned = (v: number) => `${v < 0 ? '−' : '+'}${km(Math.abs(v))} km`
const firstName = (n: string) => n.trim().split(/\s+/)[0]

/**
 * Rota padrão (plano-rota-padrao): uma ordem só com os condomínios ativos com localização, base das
 * rotas dos entregadores sem rota própria. Sugerir rota (comparação atual × sugerida, D-5), editar
 * arrastando (km ao soltar), encaixes automáticos para revisar (D-3/D-11) e os prédios fora do mapa
 * (D-6). Na 1ª vez, já abre com a sugestão (D-10). Visual e peças da A4 (D-8).
 */
export function DefaultRouteScreen({ onBack, onOpenCondos }: { onBack: () => void; onOpenCondos?: () => void }) {
  const [view, setView] = useState<View | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestError, setSuggestError] = useState(false)
  const [mapMode, setMapMode] = useState<'atual' | 'sugerida'>('sugerida')
  const [adjust, setAdjust] = useState<string[] | null>(null)
  const [preview, setPreview] = useState<Metrics | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedNote, setSavedNote] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const suggest = useCallback(async () => {
    setSuggesting(true)
    setSuggestError(false)
    setSavedNote(false)
    try {
      const res = await apiFetch('/admin/default-route/suggest', { method: 'POST' })
      const body = res.ok ? ((await res.json()) as Suggestion) : null
      if (!body || !body.computed) throw new Error()
      setSuggestion(body)
      setMapMode('sugerida')
    } catch {
      setSuggestError(true)
    } finally {
      setSuggesting(false)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch('/admin/default-route')
        const body = await res.json().catch(() => null)
        if (!res.ok) throw new Error((body as { error?: string } | null)?.error ?? 'Não foi possível carregar a rota padrão.')
        const data = body as View
        setView(data)
        // 1ª vez (D-10): já abre com a melhor rota calculada.
        if (!data.saved && data.condos.length > 0) void suggest()
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar a rota padrão.')
      }
    })()
  }, [suggest])

  const send = async (path: string, init: RequestInit, note = false) => {
    setBusy(true)
    setError(null)
    try {
      const res = await apiFetch(path, init)
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error((body as { error?: string } | null)?.error ?? 'Não foi possível salvar.')
      setView(body as View)
      setSuggestion(null)
      setAdjust(null)
      setPreview(null)
      setSavedNote(note)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setBusy(false)
    }
  }
  const save = (ids: string[]) => send('/admin/default-route', { method: 'PUT', body: JSON.stringify({ condominiumIds: ids }) }, true)

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

  const startAdjust = (ids: string[], m: Metrics) => {
    setSavedNote(false)
    setAdjust(ids)
    setPreview(m)
  }

  const condoById = new Map((view?.condos ?? []).map((c) => [c.id, c]))
  const names = new Map((view?.condos ?? []).map((c) => [c.id, c.name]))
  const mapStops = (ids: string[]) =>
    ids.flatMap((id, i) => {
      const c = condoById.get(id)
      return c && c.lat !== null && c.lng !== null ? [{ id, lat: c.lat, lng: c.lng, n: i + 1, label: c.name }] : []
    })
  const saved = view?.saved ?? null
  const flagged = (view?.condos ?? []).filter((c) => c.flag && saved?.condominiumIds.includes(c.id))
  const reference = suggestion ?? saved

  /** Selos de cada prédio: encaixe pendente e localização aproximada. */
  const tags = (id: string) => {
    const c = condoById.get(id)
    if (!c) return null
    return (
      <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {c.flag === 'NOVO' && (
          <CRTag icon="plus" tone="dark" size="sm">
            novo · encaixado
          </CRTag>
        )}
        {c.flag === 'REENCAIXADO' && (
          <CRTag icon="repeat" tone="dark" size="sm">
            reencaixado
          </CRTag>
        )}
        {c.approxLocation && (
          <CRTag tone="warn" size="sm">
            aproximado
          </CRTag>
        )}
      </span>
    )
  }
  /** Na comparação: o que subiu, desceu ou é novo em relação à rota salva. */
  const moves = (id: string) => {
    if (!saved || !suggestion) return tags(id)
    if (!saved.condominiumIds.includes(id)) {
      return (
        <CRTag icon="plus" tone="dark" size="sm">
          novo
        </CRTag>
      )
    }
    const before = saved.condominiumIds.filter((x) => suggestion.condominiumIds.includes(x)).indexOf(id)
    const now = suggestion.condominiumIds.filter((x) => saved.condominiumIds.includes(x)).indexOf(id)
    if (before === -1 || now === -1 || before === now) return tags(id)
    return (
      <CRTag icon="repeat" size="sm">
        {now < before ? `subiu ${before - now}` : `desceu ${now - before}`}
      </CRTag>
    )
  }

  const shownMap: Metrics & { ids: string[] } | null =
    suggestion && (mapMode === 'sugerida' || !saved)
      ? { ids: suggestion.condominiumIds, km: suggestion.km, durationMin: suggestion.durationMin, geometry: suggestion.geometry }
      : saved
        ? { ids: saved.condominiumIds, km: saved.km, durationMin: saved.durationMin, geometry: saved.geometry }
        : null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--color-app-bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 20px 14px' }}>
        <button type="button" aria-label="Voltar" onClick={onBack} style={{ background: 'var(--color-surface-2)', border: 'none', width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <Icon name="arrowL" size={20} color="var(--color-text)" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-ter)', fontWeight: 600 }}>Todos os turnos</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: 'var(--color-text)', letterSpacing: '-0.02em', margin: 0 }}>Rota padrão</h2>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loadError && (
          <CRNote icon="cloudOff" tone="danger">
            {loadError}
          </CRNote>
        )}
        {!view && !loadError && <div style={{ textAlign: 'center', padding: 32, fontFamily: 'var(--font-body)', color: 'var(--color-text-ter)' }}>Carregando…</div>}

        {view && !view.base && (
          <CRNote icon="alert" tone="gold">
            Sem base de saída: a rota começa no primeiro prédio. Defina a base em Rotas e comprovante.
          </CRNote>
        )}

        {view && view.condos.length === 0 && (
          <CRNote icon="building">
            Nenhum condomínio ativo com localização ainda. A rota padrão aparece quando houver um.
          </CRNote>
        )}

        {error && (
          <CRNote icon="alert" tone="danger">
            {error}
          </CRNote>
        )}

        {view && savedNote && (
          <CRNote icon="check" tone="good">
            Rota padrão salva. Vale para os entregadores sem rota própria a partir da próxima rota.
          </CRNote>
        )}

        {/* Encaixes automáticos para revisar (D-3/D-11) */}
        {view && saved && flagged.length > 0 && !suggestion && !adjust && (
          <div style={{ background: 'var(--color-surface)', border: '2px solid var(--color-gold)', borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'var(--font-body)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="spark" size={18} color="var(--color-accent)" aria-hidden="true" />
              <span style={{ flex: 1, fontWeight: 800, fontSize: 15, color: 'var(--color-text)' }}>{flagged.length === 1 ? '1 prédio entrou sozinho' : `${flagged.length} prédios entraram sozinhos`}</span>
            </div>
            {flagged.map((c) => (
              <div key={c.id} style={{ fontSize: 13.5, color: 'var(--color-text-sec)', lineHeight: 1.45 }}>
                <b style={{ color: 'var(--color-text)' }}>{c.name}</b> {c.flag === 'NOVO' ? 'entrou na' : 'mudou de endereço e foi para a'} posição {saved.condominiumIds.indexOf(c.id) + 1}
                {c.kmAdded !== null ? ` (${kmSigned(c.kmAdded)})` : ''}.
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" disabled={busy} style={{ ...btn('soft'), padding: '0 12px', whiteSpace: 'nowrap' }} onClick={() => void send('/admin/default-route/review', { method: 'POST' })}>
                Está bom assim
              </button>
              <button type="button" disabled={busy} style={{ ...btn('ghost'), padding: '0 12px', whiteSpace: 'nowrap' }} onClick={() => startAdjust(saved.condominiumIds, saved)}>
                <Icon name="grip" size={16} aria-hidden="true" />
                Ajustar
              </button>
            </div>
          </div>
        )}

        {/* Mapa: a rota salva, a sugerida ou as duas para comparar (D-5) */}
        {view && shownMap && !adjust && (
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 18, overflow: 'hidden' }}>
            {suggestion && saved && (
              <div role="tablist" aria-label="Rota no mapa" style={{ display: 'flex', gap: 4, background: 'var(--color-surface-2)', borderRadius: 13, padding: 4, margin: 10 }}>
                {(
                  [
                    ['atual', 'Atual', saved.km],
                    ['sugerida', 'Sugerida', suggestion.km],
                  ] as const
                ).map(([key, label, k]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={mapMode === key}
                    onClick={() => setMapMode(key)}
                    style={{ flex: 1, height: 38, borderRadius: 10, border: 'none', background: mapMode === key ? 'var(--color-surface)' : 'transparent', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 13, color: mapMode === key ? 'var(--color-text)' : 'var(--color-text-sec)', cursor: 'pointer' }}
                  >
                    {label} · {km(k)} km
                  </button>
                ))}
              </div>
            )}
            <CourierMap height={190} radius={0} stops={mapStops(shownMap.ids)} base={view.base} geometry={shownMap.geometry} />
            {!suggestion && saved && (
              <div style={{ padding: '12px 16px', fontFamily: 'var(--font-body)' }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--color-text-ter)' }}>
                  ROTA PADRÃO · {saved.condominiumIds.length} {saved.condominiumIds.length === 1 ? 'PRÉDIO' : 'PRÉDIOS'}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--color-text)' }}>
                  ~{km(saved.km)} km{saved.durationMin !== null ? ` · ~${fmtDuration(saved.durationMin)}` : ''}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--color-text-sec)', fontWeight: 700, marginTop: 2 }}>
                  salva em {shortDate(saved.savedAt)}
                  {saved.savedByName ? ` por ${firstName(saved.savedByName)}` : ''}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sugestão: 1ª vez (D-10) ou comparação com a salva (D-5) */}
        {view && suggestion && !adjust && (
          <div style={{ background: 'var(--color-surface)', border: '2px solid var(--color-gold)', borderRadius: 18, padding: 16, fontFamily: 'var(--font-body)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="spark" size={19} color="var(--color-accent)" aria-hidden="true" />
              <span style={{ flex: 1, fontWeight: 800, fontSize: 15.5, color: 'var(--color-text)' }}>{saved ? 'Rota sugerida' : 'Primeira sugestão'}</span>
              {suggestion.deltaKm !== null && suggestion.deltaKm !== 0 && (
                <CRTag tone={suggestion.deltaKm < 0 ? 'good' : 'warn'} size="sm">
                  {kmSigned(suggestion.deltaKm)}
                </CRTag>
              )}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--color-text)', marginTop: 6 }}>
              ~{km(suggestion.km)} km{suggestion.durationMin !== null ? ` · ~${fmtDuration(suggestion.durationMin)}` : ''}
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-sec)', marginTop: 2 }}>
              {saved
                ? suggestion.deltaKm === null
                  ? 'Compare no mapa: Atual × Sugerida.'
                  : suggestion.deltaKm < 0
                    ? `${km(Math.abs(suggestion.deltaKm))} km a menos que a atual, com os mesmos prédios.`
                    : 'A atual já está tão boa quanto a sugestão, ou melhor.'
                : `A melhor ordem para os ${suggestion.condominiumIds.length} condomínios ativos${view.base ? ', saindo da base' : ''}${view.base && view.voltaBase ? ' e voltando para ela' : ''}.`}
            </div>
            <div style={{ marginTop: 12 }}>
              <OrderList ids={suggestion.condominiumIds} names={names} highlight={moves} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              <button type="button" disabled={busy} style={btn('gold', true)} onClick={() => void save(suggestion.condominiumIds)}>
                <Icon name="check" size={17} aria-hidden="true" />
                Usar sugestão
              </button>
              <button type="button" disabled={busy} style={btn('ghost', true)} onClick={() => startAdjust(suggestion.condominiumIds, suggestion)}>
                <Icon name="grip" size={16} aria-hidden="true" />
                Editar antes de usar
              </button>
              {saved && (
                <button type="button" disabled={busy} style={btn('ghost', true)} onClick={() => setSuggestion(null)}>
                  Descartar
                </button>
              )}
            </div>
          </div>
        )}

        {/* 1ª vez: calculando ou mapa fora do ar */}
        {view && !saved && !suggestion && !adjust && view.condos.length > 0 && (
          suggestError ? (
            <>
              <CRNote icon="cloudOff" tone="danger">
                Não deu para calcular a rota agora: o mapa está fora do ar. Tente de novo em instantes ou monte a ordem à mão.
              </CRNote>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" disabled={suggesting} style={btn('gold')} onClick={() => void suggest()}>
                  <Icon name="refresh" size={16} aria-hidden="true" />
                  Tentar de novo
                </button>
                <button type="button" style={btn('ghost')} onClick={() => startAdjust(view.condos.map((c) => c.id), { km: null, durationMin: null, geometry: [] })}>
                  <Icon name="grip" size={16} aria-hidden="true" />
                  Montar à mão
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 24, fontFamily: 'var(--font-body)', color: 'var(--color-text-ter)' }}>Calculando a melhor rota…</div>
          )
        )}

        {/* Rota salva: ordem, Ajustar e Sugerir rota */}
        {view && saved && !suggestion && !adjust && (
          <>
            {suggestError && (
              <CRNote icon="cloudOff" tone="danger">
                Não deu para calcular a sugestão agora: o mapa está fora do ar. A rota salva continua valendo.
              </CRNote>
            )}
            <button type="button" disabled={suggesting || busy} style={btn('gold', true)} onClick={() => void suggest()}>
              <Icon name="spark" size={17} aria-hidden="true" />
              {suggesting ? 'Calculando…' : 'Sugerir rota'}
            </button>
            <CRLabel
              right={
                <button type="button" style={{ ...btn('ghost'), flex: 'none', minHeight: 36, fontSize: 13 }} onClick={() => startAdjust(saved.condominiumIds, saved)}>
                  <Icon name="grip" size={15} aria-hidden="true" />
                  Ajustar
                </button>
              }
            >
              Ordem
            </CRLabel>
            <OrderList ids={saved.condominiumIds} names={names} highlight={tags} />
          </>
        )}

        {/* Editar: arrastar com o km ao soltar */}
        {view && adjust && (
          <>
            <CRNote icon="grip" tone="gold">
              Arraste para mudar a ordem. O km e o tempo recalculam na hora.
            </CRNote>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={adjust} strategy={verticalListSortingStrategy}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {adjust.map((id, i) => (
                    <SortRow key={id} id={id} index={i} name={names.get(id) ?? 'Prédio'} extra={tags(id)} />
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
                  {kmSigned(preview.km - reference.km)} vs {suggestion ? 'sugestão' : 'rota salva'}
                </span>
              )}
            </div>
            <button type="button" disabled={busy} style={btn('primary', true)} onClick={() => void save(adjust)}>
              <Icon name="check" size={17} color="#fff" aria-hidden="true" />
              Salvar rota padrão
            </button>
            <button type="button" disabled={busy} style={btn('ghost', true)} onClick={() => setAdjust(null)}>
              Cancelar
            </button>
          </>
        )}

        {/* Fora do mapa (D-6) */}
        {view && view.outside.length > 0 && !adjust && (
          <>
            <CRLabel style={{ marginTop: 4 }}>Fora do mapa · {view.outside.length}</CRLabel>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 16, padding: '4px 0', fontFamily: 'var(--font-body)' }}>
              {view.outside.map((c, i) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: i ? '1px solid var(--color-border-2)' : 'none' }}>
                  <Icon name="pin" size={16} color="var(--color-text-ter)" aria-hidden="true" />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{c.name}</span>
                  <CRTag tone="danger" size="sm">
                    sem localização
                  </CRTag>
                </div>
              ))}
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-sec)', margin: '0 4px', lineHeight: 1.45 }}>
              Sem localização, ficam fora da rota padrão e vão para o fim da rota do dia. Com a localização corrigida, entram sozinhos.
            </div>
            {onOpenCondos && (
              <button type="button" style={btn('ghost', true)} onClick={onOpenCondos}>
                <Icon name="building" size={16} aria-hidden="true" />
                Corrigir em Condomínios
              </button>
            )}
          </>
        )}

        {view && !adjust && view.condos.length > 0 && (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-ter)', textAlign: 'center', lineHeight: 1.45, marginTop: 4 }}>
            Vale para todos os turnos: cada entregador usa só os prédios que tem no dia. Quem tem rota própria (Entregadores › Rota) continua com ela.
          </div>
        )}
      </div>
    </div>
  )
}
