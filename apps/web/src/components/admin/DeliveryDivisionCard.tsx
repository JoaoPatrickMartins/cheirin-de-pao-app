import { useState, type ReactNode } from 'react'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Icon } from '../brand/Icon'

export interface BlockBreakdown {
  block: string
  quantity: number
  orderIds: string[]
}

/**
 * Unidade atribuível a um entregador: um condomínio INTEIRO (`block === null`, traz
 * `blocks` para poder "dividir") ou um BLOCO específico (`block !== null`, já atômico).
 */
export interface DeliveryUnit {
  condominiumId: string
  condominiumName: string
  block: string | null
  quantity: number
  orderIds: string[]
  blocks: BlockBreakdown[]
}

export interface Assignment {
  courierId: string
  courierName: string
  condos: DeliveryUnit[]
}

export interface DeliveryDivisionCardProps {
  assignments: Assignment[]
  onAssignmentsChange: (next: Assignment[]) => void
  onApprove: () => Promise<void>
  isApproved: boolean
  isApproving: boolean
  /** Chaves de unidades já totalmente entregues — `${condominiumId}|${block ?? '*'}`. */
  lockedUnitKeys?: Set<string>
}

/** Rótulo do bloco sem duplicar "Bloco" (o valor já pode contê-la). */
function blockLabel(block: string): string {
  const b = (block || '').trim()
  if (!b) return 'Sem bloco'
  return /^bloco\b/i.test(b) ? b : `Bloco ${b}`
}

/** Chave estável de uma unidade dentro de um entregador (id do DnD + key React). */
function unitKey(courierId: string, u: DeliveryUnit): string {
  return `${courierId}|${u.condominiumId}|${u.block ?? '*'}`
}
/** Chave de travamento (independe do entregador). */
function lockKeyOf(u: DeliveryUnit): string {
  return `${u.condominiumId}|${u.block ?? '*'}`
}
/** Rótulo de exibição de uma unidade. */
function unitLabel(u: DeliveryUnit): string {
  return u.block !== null ? `${u.condominiumName} · ${blockLabel(u.block)}` : u.condominiumName
}

/** Afordância de arraste — seis pontinhos (grip). */
function GripDots({ faded }: { faded?: boolean }) {
  const c = faded ? 'var(--color-border)' : 'var(--color-text-ter)'
  return (
    <span aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 3px)', gap: 3, flexShrink: 0, opacity: faded ? 0.7 : 1 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} style={{ width: 3, height: 3, borderRadius: 99, background: c }} />
      ))}
    </span>
  )
}

interface SortableUnitProps {
  unit: DeliveryUnit
  courierId: string
  disabled?: boolean
  locked?: boolean
  canExplode?: boolean
  canCollapse?: boolean
  onExplode?: () => void
  onCollapse?: () => void
}

function SortableUnit({ unit, courierId, disabled, locked, canExplode, canCollapse, onExplode, onCollapse }: SortableUnitProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: unitKey(courierId, unit),
    disabled,
  })
  const isBlock = unit.block !== null
  const stop = (e: React.PointerEvent) => e.stopPropagation()

  return (
    <div style={{ marginLeft: isBlock ? 16 : 0 }}>
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '9px 11px',
          background: locked ? 'var(--color-good-soft)' : 'var(--color-surface)',
          borderRadius: 13,
          border: `1px solid ${isDragging ? 'var(--color-accent)' : 'var(--color-border-2)'}`,
          boxShadow: isDragging ? '0 10px 26px rgba(30,18,7,0.16)' : 'var(--shadow-soft)',
          opacity: isDragging ? 0.95 : 1,
          transform: CSS.Transform.toString(transform),
          cursor: disabled ? 'default' : 'grab',
          touchAction: disabled ? 'auto' : 'none',
        }}
      >
        {!disabled && <GripDots />}

        {/* Badge: prédio (condomínio inteiro) x pino (bloco) */}
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: isBlock ? 'var(--color-surface-2)' : 'var(--color-gold-soft)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name={isBlock ? 'pin' : 'building'} size={15} color={isBlock ? 'var(--color-text-sec)' : 'var(--color-accent)'} stroke={2} aria-hidden="true" />
        </span>

        {/* Texto: bloco em destaque + condomínio de origem (contexto) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13.5,
              fontWeight: 700,
              color: 'var(--color-text)',
              margin: 0,
              lineHeight: 1.25,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {isBlock ? blockLabel(unit.block as string) : unit.condominiumName}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11.5,
              fontWeight: isBlock ? 700 : 500,
              color: 'var(--color-text-ter)',
              margin: '1px 0 0',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {isBlock
              ? unit.condominiumName
              : unit.blocks.length >= 2
                ? `Condomínio inteiro · ${unit.blocks.length} blocos`
                : 'Condomínio inteiro'}
          </p>
        </div>

        {/* Direita: ação (dividir/recolher) + pill de quantidade */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          {locked ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--color-good)', fontFamily: 'var(--font-body)', fontSize: 10.5, fontWeight: 700 }}>
              <Icon name="check" size={11} color="var(--color-good)" stroke={2.6} aria-hidden="true" />
              entregue
            </span>
          ) : (
            <>
              {canExplode && onExplode && (
                <button onPointerDown={stop} onClick={onExplode} title="Dividir este condomínio por blocos" style={miniBtnStyle}>
                  <Icon name="scissors" size={12} color="var(--color-accent)" stroke={2.2} aria-hidden="true" />
                  dividir
                </button>
              )}
              {canCollapse && onCollapse && (
                <button onPointerDown={stop} onClick={onCollapse} title="Recolher os blocos neste condomínio" style={miniBtnStyle}>
                  <Icon name="repeat" size={12} color="var(--color-text-sec)" stroke={2.2} aria-hidden="true" />
                  recolher
                </button>
              )}
            </>
          )}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 3,
              padding: '3px 9px',
              borderRadius: 99,
              background: 'var(--color-gold-soft)',
              fontFamily: 'var(--font-display)',
              fontSize: 12.5,
              fontWeight: 800,
              color: 'var(--color-espresso)',
              whiteSpace: 'nowrap',
            }}
          >
            {unit.quantity}
            <span style={{ fontSize: 10 }}>🥖</span>
          </span>
        </div>
      </div>
    </div>
  )
}

const miniBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  padding: '3px 8px',
  borderRadius: 99,
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  fontFamily: 'var(--font-body)',
  fontSize: 10.5,
  fontWeight: 700,
  color: 'var(--color-text-sec)',
  cursor: 'pointer',
}

interface CourierDropZoneProps {
  courierId: string
  children: ReactNode
  disabled?: boolean
}

function CourierDropZone({ courierId, children, disabled }: CourierDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: courierId, disabled })
  return (
    <div
      ref={setNodeRef}
      style={{
        background: 'var(--color-surface-2)',
        borderRadius: 14,
        padding: 12,
        border: isOver && !disabled ? '1.5px solid var(--color-accent)' : '1.5px solid transparent',
        transition: 'border-color 0.15s ease',
      }}
    >
      {children}
    </div>
  )
}

export function DeliveryDivisionCard({
  assignments,
  onAssignmentsChange,
  onApprove,
  isApproved,
  isApproving,
  lockedUnitKeys,
}: DeliveryDivisionCardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [approveError, setApproveError] = useState(false)
  const [reopened, setReopened] = useState(false)
  const dndEnabled = !isApproved || reopened
  const isLocked = (u: DeliveryUnit) => lockedUnitKeys?.has(lockKeyOf(u)) ?? false
  const hasReopenable = assignments.some((a) => a.condos.some((c) => !isLocked(c)))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  // Índice unitKey → { courierId, unit } + conjunto de courierIds (drop zones)
  const unitIndex = new Map<string, { courierId: string; unit: DeliveryUnit }>()
  assignments.forEach((a) => a.condos.forEach((u) => unitIndex.set(unitKey(a.courierId, u), { courierId: a.courierId, unit: u })))
  const courierIds = new Set(assignments.map((a) => a.courierId))

  // Um condomínio está "dividido" quando tem unidades de bloco em >1 entregador.
  function isCondoSplit(condominiumId: string): boolean {
    const couriers = assignments.filter((a) =>
      a.condos.some((u) => u.condominiumId === condominiumId && u.block !== null),
    )
    return couriers.length > 1
  }

  function handleDragStart(event: DragStartEvent) {
    if (!dndEnabled) return
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    if (!dndEnabled) return
    const { active, over } = event
    if (!over) return

    const src = unitIndex.get(String(active.id))
    if (!src) return
    const overStr = String(over.id)
    const targetCourierId = courierIds.has(overStr) ? overStr : unitIndex.get(overStr)?.courierId
    if (!targetCourierId) return
    if (isLocked(src.unit)) return
    if (src.courierId === targetCourierId) return

    const moved = src.unit
    const next = assignments.map((a) => {
      if (a.courierId === src.courierId) {
        return { ...a, condos: a.condos.filter((c) => unitKey(a.courierId, c) !== unitKey(src.courierId, moved)) }
      }
      if (a.courierId === targetCourierId) {
        return { ...a, condos: [...a.condos, moved] }
      }
      return a
    })
    onAssignmentsChange(next)
  }

  // Explode um condomínio inteiro nas suas unidades de bloco (dentro do mesmo entregador).
  function explode(courierId: string, unit: DeliveryUnit) {
    const key = unitKey(courierId, unit)
    const next = assignments.map((a) => {
      if (a.courierId !== courierId) return a
      const others = a.condos.filter((c) => unitKey(courierId, c) !== key)
      const blockUnits: DeliveryUnit[] = unit.blocks.map((b) => ({
        condominiumId: unit.condominiumId,
        condominiumName: unit.condominiumName,
        block: b.block,
        quantity: b.quantity,
        orderIds: b.orderIds,
        blocks: [],
      }))
      return { ...a, condos: [...others, ...blockUnits] }
    })
    onAssignmentsChange(next)
  }

  // Recolhe os blocos de um condomínio (todos no mesmo entregador) numa unidade inteira.
  function collapse(condominiumId: string) {
    const owner = assignments.find((a) =>
      a.condos.some((u) => u.condominiumId === condominiumId && u.block !== null),
    )
    if (!owner) return
    const blockUnits = owner.condos.filter((u) => u.condominiumId === condominiumId && u.block !== null)
    if (blockUnits.length === 0) return
    const blocks: BlockBreakdown[] = blockUnits
      .map((u) => ({ block: u.block as string, quantity: u.quantity, orderIds: u.orderIds }))
      .sort((a, b) => a.block.localeCompare(b.block, 'pt-BR', { numeric: true }))
    const merged: DeliveryUnit = {
      condominiumId,
      condominiumName: blockUnits[0].condominiumName,
      block: null,
      quantity: blockUnits.reduce((s, u) => s + u.quantity, 0),
      orderIds: blockUnits.flatMap((u) => u.orderIds),
      blocks,
    }
    const next = assignments.map((a) => {
      if (a.courierId !== owner.courierId) return a
      const rest = a.condos.filter((u) => !(u.condominiumId === condominiumId && u.block !== null))
      return { ...a, condos: [...rest, merged] }
    })
    onAssignmentsChange(next)
  }

  function totalForCourier(a: Assignment) {
    return a.condos.reduce((sum, c) => sum + c.quantity, 0)
  }

  async function handleApprove() {
    setApproveError(false)
    try {
      await onApprove()
      setReopened(false)
    } catch {
      setApproveError(true)
    }
  }

  const allSortableIds = assignments.flatMap((a) => a.condos.map((c) => unitKey(a.courierId, c)))
  const activeUnit = activeId ? unitIndex.get(activeId)?.unit ?? null : null

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 22,
        border: isApproved ? '1.5px solid var(--color-border-2)' : '1.5px solid var(--color-accent)',
        padding: 16,
        transition: 'border-color 0.2s ease',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Icon name="spark" size={20} color="var(--color-accent)" stroke={2} aria-hidden="true" />
        <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)' }}>
          Divisão sugerida
        </span>
        {isApproved && !reopened && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 99, background: 'var(--color-good-soft)', color: 'var(--color-good)', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700 }}>
            <Icon name="check" size={13} color="var(--color-good)" stroke={2.6} aria-hidden="true" />
            Aprovada
          </span>
        )}
        {reopened && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 99, background: 'var(--color-gold-soft)', color: '#8A6A00', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700 }}>
            <Icon name="edit" size={12} color="#8A6A00" stroke={2.2} aria-hidden="true" />
            Editando
          </span>
        )}
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={allSortableIds} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {assignments.map((assignment) => (
              <CourierDropZone key={assignment.courierId} courierId={assignment.courierId} disabled={!dndEnabled}>
                {/* Entregador header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: assignment.condos.length > 0 ? 8 : 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name="user" size={18} color="var(--color-accent)" stroke={2} aria-hidden="true" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0, lineHeight: 1.2 }}>
                      {assignment.courierName}
                    </p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '2px 0 0', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {assignment.condos.length > 0 ? assignment.condos.map((c) => unitLabel(c)).join(', ') : 'Sem entregas atribuídas'}
                    </p>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4, fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, color: 'var(--color-gold)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {totalForCourier(assignment)}
                    <span style={{ fontSize: 13 }}>🥖</span>
                  </span>
                </div>

                {/* Unidades arrastáveis (condomínio inteiro ou bloco) */}
                {assignment.condos.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--color-border-2)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {assignment.condos.map((unit) => {
                      const locked = isLocked(unit)
                      const canExplode = dndEnabled && !locked && unit.block === null && unit.blocks.length >= 2
                      const canCollapse = dndEnabled && !locked && unit.block !== null && !isCondoSplit(unit.condominiumId)
                      return (
                        <SortableUnit
                          key={unitKey(assignment.courierId, unit)}
                          unit={unit}
                          courierId={assignment.courierId}
                          disabled={!dndEnabled || locked}
                          locked={reopened && locked}
                          canExplode={canExplode}
                          canCollapse={canCollapse}
                          onExplode={() => explode(assignment.courierId, unit)}
                          onCollapse={() => collapse(unit.condominiumId)}
                        />
                      )
                    })}
                  </div>
                )}
              </CourierDropZone>
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeUnit ? (
            <div style={{ background: 'var(--color-surface)', borderRadius: 8, padding: '6px 12px', border: '1.5px solid var(--color-accent)', fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--color-text)', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
              {unitLabel(activeUnit)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {approveError && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-accent)', margin: '10px 0 0', textAlign: 'center' }}>
          Falha ao salvar. Tente novamente.
        </p>
      )}

      {dndEnabled ? (
        <button
          onClick={() => void handleApprove()}
          disabled={isApproving}
          style={{ width: '100%', marginTop: 12, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 'none', borderRadius: 14, background: 'var(--color-espresso)', color: '#FAF5EC', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, cursor: isApproving ? 'wait' : 'pointer', opacity: isApproving ? 0.6 : 1, transition: 'opacity 0.15s ease' }}
        >
          <Icon name="check" size={16} color="#FAF5EC" stroke={2.5} aria-hidden="true" />
          {isApproving ? 'Aprovando...' : 'Aprovar divisão'}
        </button>
      ) : (
        <button
          onClick={() => setReopened(true)}
          disabled={!hasReopenable}
          title={hasReopenable ? undefined : 'Todas as entregas já foram concluídas'}
          style={{ width: '100%', marginTop: 12, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: '1.5px solid var(--color-border)', borderRadius: 14, background: 'transparent', color: 'var(--color-text)', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, cursor: hasReopenable ? 'pointer' : 'not-allowed', opacity: hasReopenable ? 1 : 0.5 }}
        >
          <Icon name="refresh" size={16} color="var(--color-text)" stroke={2.2} aria-hidden="true" />
          Reabrir divisão
        </button>
      )}
    </div>
  )
}
