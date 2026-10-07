import { useMemo, useState } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CourierMap, type MapStop } from '../../components/courier/CourierMap'
import { CondoGroup } from '../../components/courier/CondoAccordion'
import { stopKey } from '../../components/courier/StopRow'
import { NavAppSheet } from '../../components/courier/NavAppSheet'
import { Icon } from '../../components/brand/Icon'
import { CRBig, CRIconBtn, CRLabel, CRNote, CRTag, CR_BODY, CR_DISPLAY } from '../../components/courier/kit'
import { ARRIVAL_RADIUS_M, distanceMeters, type LatLng, type PositionStatus } from '../../hooks/useCourierPosition'
import { getPreferredNavApp, navUrl, NAV_APP_LABELS, setPreferredNavApp, type NavApp } from '../../lib/navLinks'
import { resetDayOrder, saveDayOrder, type RouteBase, type RouteCondo, type SlotRoute } from '../../lib/courierApi'

export type { SlotRoute }

export interface CourierRouteViewProps {
  /** Prédios com paradas ATIVAS (os já feitos só aparecem em `routeCondos`). */
  condos: CondoGroup[]
  routes: SlotRoute[]
  routeCondos?: RouteCondo[]
  base?: RouteBase | null
  slots: Array<{ slotId: string; label: string; emoji: string; time: string }>
  /** Paradas resolvidas nesta sessão (confirmadas, não entregues, guardadas na fila). */
  resolvedKeys?: Set<string>
  canReorder?: boolean
  me?: LatLng | null
  positionStatus?: PositionStatus
  /** "Lista do prédio": volta para a Lista com o prédio aberto. */
  onOpenCondo?: (condominiumId: string, slotId: string) => void
  onEnd?: (slotId: string) => void
  /** Depois de salvar/voltar a ordem (recarrega a rota). */
  onReordered?: () => void
}

interface RouteRow {
  id: string
  name: string
  lat: number | null
  lng: number | null
  address: string
  pending: number
  breads: number
  cestinhas: number
  done: boolean
  eta: string | null
}

function SortableRow({ row, index }: { row: RouteRow; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--color-surface)',
        borderRadius: 16,
        border: `1.5px solid ${isDragging ? 'var(--color-gold)' : 'var(--color-border-2)'}`,
        padding: '0 14px',
        minHeight: 62,
        boxShadow: isDragging ? 'var(--shadow-strong)' : 'none',
        zIndex: isDragging ? 2 : 0,
        position: 'relative',
        fontFamily: CR_BODY,
      }}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Arrastar ${row.name}`}
        style={{ color: 'var(--color-text-ter)', display: 'grid', placeItems: 'center', width: 32, height: 44, border: 'none', background: 'none', cursor: 'grab', touchAction: 'none' }}
      >
        <Icon name="grip" size={22} stroke={3.4} aria-hidden="true" />
      </button>
      <OrderNumber n={index + 1} done={false} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--color-text)' }}>{row.name}</div>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-ter)', fontWeight: 600 }}>
          {row.pending} {row.pending === 1 ? 'parada' : 'paradas'}
        </div>
      </div>
    </div>
  )
}

function OrderNumber({ n, done }: { n: number; done: boolean }) {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        background: done ? 'var(--color-good-soft)' : 'var(--color-gold)',
        color: done ? 'var(--color-good)' : 'var(--color-espresso)',
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        fontFamily: CR_DISPLAY,
        fontWeight: 800,
        fontSize: 15,
      }}
    >
      {done ? <Icon name="check" size={16} stroke={3} aria-hidden="true" /> : n}
    </div>
  )
}

/** E9 · Aba Rota do entregador. */
export function CourierRouteView({
  condos,
  routes,
  routeCondos = [],
  base = null,
  slots,
  resolvedKeys = new Set(),
  canReorder = false,
  me = null,
  positionStatus = 'off',
  onOpenCondo,
  onEnd,
  onReordered,
}: CourierRouteViewProps) {
  const initial = routes.find((r) => r.state === 'em_rota') ?? routes.find((r) => r.state === 'pronta') ?? routes[0]
  const [selectedSlotId, setSelectedSlotId] = useState(initial?.slotId ?? '')
  const current = routes.find((r) => r.slotId === selectedSlotId) ?? routes[0]
  const [reordering, setReordering] = useState(false)
  const [draft, setDraft] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [navFor, setNavFor] = useState<RouteRow | null>(null)
  const [centerKey, setCenterKey] = useState(0)
  const [navApp, setNavApp] = useState<NavApp | null>(() => getPreferredNavApp())
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const rows: RouteRow[] = useMemo(() => {
    if (!current) return []
    const etaOf = new Map((current.eta ?? []).map((e) => [e.condominiumId, e.time]))
    return current.condominiumIds.map((id) => {
      const active = condos.find((c) => c.condominiumId === id)
      const info = routeCondos.find((c) => c.condominiumId === id)
      const stops = (active?.stops ?? []).filter((s) => (s.slotId ?? '') === current.slotId && !resolvedKeys.has(stopKey(s)))
      return {
        id,
        name: active?.condominiumName ?? info?.condominiumName ?? 'Prédio',
        lat: active?.lat ?? info?.lat ?? null,
        lng: active?.lng ?? info?.lng ?? null,
        address: active?.address ?? '',
        pending: stops.length,
        breads: stops.reduce((n, s) => n + s.quantity, 0),
        cestinhas: stops.filter((s) => (s.marketItems?.length ?? 0) > 0).length,
        done: stops.length === 0,
        eta: etaOf.get(id) ?? null,
      }
    })
  }, [current, condos, routeCondos, resolvedKeys])

  if (!current) {
    return <CRNote icon="route">Sem rota para mostrar hoje.</CRNote>
  }

  const enRoute = current.state === 'em_rota'
  const allDone = rows.length > 0 && rows.every((r) => r.done)
  const nextIdx = enRoute ? rows.findIndex((r) => !r.done) : -1
  const next = nextIdx >= 0 ? rows[nextIdx] : null
  const arrived = !!(next && me && next.lat !== null && next.lng !== null && distanceMeters(me, { lat: next.lat, lng: next.lng }) <= ARRIVAL_RADIUS_M)
  const located = rows.filter((r) => r.lat !== null && r.lng !== null)
  const mapStops: MapStop[] = rows.flatMap((r, i) =>
    r.lat !== null && r.lng !== null ? [{ id: r.id, lat: r.lat, lng: r.lng, n: i + 1, done: r.done, next: i === nextIdx, label: r.name }] : [],
  )
  const noPath = !current.route && located.length >= 2
  const kmLabel = current.route?.distanceKm ? `~${current.route.distanceKm.replace('.', ',')} km · ` : ''
  const showReorder = canReorder && !allDone && current.state !== 'encerrada'

  const openNav = (row: RouteRow) => {
    const app = navApp ?? getPreferredNavApp()
    if (!app) {
      setNavFor(row)
      return
    }
    window.open(navUrl(app, { lat: row.lat, lng: row.lng, address: row.address }), '_blank', 'noopener')
  }

  const saveOrder = async () => {
    setSaving(true)
    setError(null)
    const r = await saveDayOrder(current.slotId, draft)
    setSaving(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    setReordering(false)
    onReordered?.()
  }

  const resetOrder = async () => {
    setSaving(true)
    setError(null)
    const r = await resetDayOrder(current.slotId)
    setSaving(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    setReordering(false)
    onReordered?.()
  }

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    setDraft((d) => arrayMove(d, d.indexOf(String(e.active.id)), d.indexOf(String(e.over!.id))))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: CR_BODY }}>
      {routes.length > 1 && (
        <div role="tablist" aria-label="Turno da rota" style={{ display: 'flex', gap: 6 }}>
          {routes.map((r) => {
            const meta = slots.find((s) => s.slotId === r.slotId)
            const on = r.slotId === current.slotId
            const state = r.state === 'em_rota' ? 'em rota' : r.state === 'encerrada' ? 'encerrada' : 'pronta'
            return (
              <button
                key={r.slotId || 'sem-turno'}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setSelectedSlotId(r.slotId)
                  setReordering(false)
                }}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 13,
                  border: `2px solid ${on ? 'var(--color-text)' : 'var(--color-border)'}`,
                  background: on ? 'var(--color-text)' : 'var(--color-surface)',
                  color: on ? 'var(--color-app-bg)' : 'var(--color-text)',
                  fontWeight: 800,
                  fontSize: 14,
                  fontFamily: CR_BODY,
                  cursor: 'pointer',
                }}
              >
                {meta ? `${meta.emoji ? `${meta.emoji} ` : ''}${meta.label}` : r.label || 'Sem turno'} · {state}
              </button>
            )
          })}
        </div>
      )}

      {current.reorderedToday && !reordering && (
        <CRNote icon="repeat" tone="gold">
          Ordem alterada hoje. Amanhã volta a rota padrão.
        </CRNote>
      )}
      {enRoute && positionStatus === 'denied' && (
        <CRNote icon="locate" tone="danger">
          Localização desligada — o mapa não mostra onde você está.
        </CRNote>
      )}
      {noPath && (
        <CRNote icon="route">Não conseguimos traçar o caminho agora. Os pontos seguem na ordem da rota.</CRNote>
      )}

      {located.length > 0 ? (
        <div style={{ position: 'relative' }}>
          <CourierMap
            height={reordering ? 220 : 290}
            stops={mapStops}
            base={base}
            me={enRoute ? me : null}
            geometry={current.route?.geometry ?? []}
            path={current.route ? 'route' : 'points'}
            dim={reordering}
            centerKey={centerKey}
            label={
              <>
                <Icon name="route" size={16} color="var(--color-accent)" aria-hidden="true" />
                {kmLabel}
                {rows.length} {rows.length === 1 ? 'prédio' : 'prédios'}
              </>
            }
          />
          {enRoute && me && (
            <div style={{ position: 'absolute', right: 12, top: 12, zIndex: 500 }}>
              <CRIconBtn icon="locate" label="Centralizar em mim" onClick={() => setCenterKey((k) => k + 1)} />
            </div>
          )}
        </div>
      ) : (
        <CRNote icon="pin">Não foi possível localizar os endereços no mapa. Use a aba Lista para as paradas.</CRNote>
      )}

      {current.state === 'pronta' && (
        <CRNote icon="route">{base ? `Esta é a sua rota salva. O traçado começa na base — ${base.endereco}.` : 'Esta é a sua rota salva. O traçado começa no primeiro prédio.'}</CRNote>
      )}

      {next && !reordering && (
        <div
          style={{
            background: arrived ? 'var(--color-good)' : 'var(--color-surface)',
            color: arrived ? '#fff' : 'var(--color-text)',
            borderRadius: 22,
            padding: 16,
            boxShadow: 'var(--shadow-soft)',
            border: arrived ? 'none' : '1px solid var(--color-border-2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 13,
                background: arrived ? 'rgba(255,255,255,0.2)' : 'var(--color-gold)',
                color: arrived ? '#fff' : 'var(--color-espresso)',
                display: 'grid',
                placeItems: 'center',
                fontFamily: CR_DISPLAY,
                fontWeight: 800,
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              {arrived ? <Icon name="pin" size={22} color="#fff" aria-hidden="true" /> : nextIdx + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: arrived ? 'rgba(255,255,255,0.8)' : 'var(--color-text-ter)' }}>
                {arrived ? 'VOCÊ CHEGOU' : 'PRÓXIMA PARADA'}
              </div>
              <div style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                {arrived ? `Você chegou ao ${next.name}` : next.name}
              </div>
            </div>
            {!arrived && next.eta && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11.5, color: 'var(--color-text-ter)', fontWeight: 700 }}>previsto</div>
                <div style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 18 }}>{next.eta}</div>
              </div>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10, color: arrived ? 'rgba(255,255,255,0.92)' : 'var(--color-text-sec)' }}>
            {next.pending} {next.pending === 1 ? 'porta' : 'portas'} · {next.breads} {next.breads === 1 ? 'pão' : 'pães'}
            {next.cestinhas ? ` · ${next.cestinhas} Cestinha${next.cestinhas > 1 ? 's' : ''}` : ''}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {arrived ? (
              <CRBig variant="light" icon="list" style={{ flex: 1, background: '#fff', color: 'var(--color-good)', border: 'none' }} onClick={() => onOpenCondo?.(next.id, current.slotId)}>
                Abrir lista do prédio
              </CRBig>
            ) : (
              <>
                <CRBig icon="navigate" style={{ flex: 1.1 }} onClick={() => openNav(next)}>
                  Navegar
                </CRBig>
                <CRBig variant="ghost" icon="list" style={{ flex: 1, fontSize: 15 }} onClick={() => onOpenCondo?.(next.id, current.slotId)}>
                  Lista do prédio
                </CRBig>
              </>
            )}
          </div>
          {!arrived && navApp && (
            <button
              type="button"
              onClick={() => {
                setPreferredNavApp(null)
                setNavApp(null)
                setNavFor(next)
              }}
              style={{ marginTop: 10, background: 'none', border: 'none', padding: 0, fontFamily: CR_BODY, fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-ter)', cursor: 'pointer' }}
            >
              Abre no {NAV_APP_LABELS[navApp]} · trocar
            </button>
          )}
        </div>
      )}

      {allDone && current.state !== 'encerrada' && (
        <div style={{ background: 'var(--color-good-soft)', borderRadius: 22, padding: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 34 }} aria-hidden="true">
            🥖
          </div>
          <div style={{ fontFamily: CR_DISPLAY, fontWeight: 800, fontSize: 22, color: 'var(--color-text)', marginTop: 4 }}>Tudo entregue!</div>
          <div style={{ fontSize: 14, color: 'var(--color-text-sec)', marginTop: 4, marginBottom: 14 }}>
            Confira o resumo e encerre a rota{current.label ? ` da ${current.label.toLowerCase()}` : ''}.
          </div>
          <CRBig variant="gold" icon="flag" onClick={() => onEnd?.(current.slotId)}>
            Encerrar rota
          </CRBig>
        </div>
      )}

      <CRLabel
        style={{ marginTop: 4 }}
        right={
          showReorder && !reordering ? (
            <button
              type="button"
              onClick={() => {
                setDraft(current.condominiumIds)
                setReordering(true)
              }}
              style={{ height: 36, padding: '0 12px', borderRadius: 11, border: '1.5px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontWeight: 800, fontSize: 13, fontFamily: CR_BODY, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}
            >
              <Icon name="grip" size={15} stroke={3} aria-hidden="true" />
              Reordenar
            </button>
          ) : null
        }
      >
        Ordem de paradas
      </CRLabel>

      {reordering ? (
        <>
          <CRNote icon="alert" tone="gold">
            <b>Essa ordem vale só para hoje.</b> A operação vê a mudança e pode adotar como rota padrão.
          </CRNote>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={draft} strategy={verticalListSortingStrategy}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {draft.map((id, i) => {
                  const row = rows.find((r) => r.id === id)
                  return row ? <SortableRow key={id} row={row} index={i} /> : null
                })}
              </div>
            </SortableContext>
          </DndContext>
          {error && (
            <CRNote icon="cloudOff" tone="danger">
              {error}
            </CRNote>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CRBig icon="check" disabled={saving} onClick={() => void saveOrder()}>
              Salvar ordem de hoje
            </CRBig>
            <CRBig variant="ghost" icon="refresh" disabled={saving} onClick={() => void resetOrder()}>
              Voltar à rota padrão
            </CRBig>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r, i) => (
            <div
              key={r.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: 'var(--color-surface)',
                borderRadius: 16,
                border: '1.5px solid var(--color-border-2)',
                padding: '0 14px',
                minHeight: 62,
                opacity: r.done ? 0.6 : 1,
              }}
            >
              <OrderNumber n={i + 1} done={r.done} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--color-text)', textDecoration: r.done ? 'line-through' : 'none' }}>{r.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--color-text-ter)', fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}>
                  {r.done ? 'tudo resolvido' : `${r.pending} ${r.pending === 1 ? 'parada' : 'paradas'}`}
                  {(r.lat === null || r.lng === null) && (
                    <CRTag icon="pin" tone="warn" size="sm">
                      sem mapa
                    </CRTag>
                  )}
                </div>
              </div>
              <span style={{ fontSize: 14, color: r.done ? 'var(--color-good)' : 'var(--color-text-sec)', fontWeight: 800 }}>{r.done ? 'feito' : r.eta ?? ''}</span>
            </div>
          ))}
        </div>
      )}

      {navFor && (
        <NavAppSheet
          onClose={() => setNavFor(null)}
          onOpen={(app) => {
            setNavApp(getPreferredNavApp())
            window.open(navUrl(app, { lat: navFor.lat, lng: navFor.lng, address: navFor.address }), '_blank', 'noopener')
            setNavFor(null)
          }}
        />
      )}
    </div>
  )
}
