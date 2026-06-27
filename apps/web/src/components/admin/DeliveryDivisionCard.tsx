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

export interface CondoItem {
  condominiumId: string
  condominiumName: string
  quantity: number
}

export interface Assignment {
  courierId: string
  courierName: string
  condos: CondoItem[]
}

export interface DeliveryDivisionCardProps {
  assignments: Assignment[]
  onAssignmentsChange: (next: Assignment[]) => void
  onApprove: () => Promise<void>
  isApproved: boolean
  isApproving: boolean
  /** IDs de condomínios já totalmente entregues — ficam travados ao reabrir a divisão. */
  lockedCondoIds?: Set<string>
}

interface SortableCondoProps {
  condo: CondoItem
  courierId: string
  disabled?: boolean
  locked?: boolean
}

function SortableCondo({ condo, courierId, disabled, locked }: SortableCondoProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: `${courierId}:${condo.condominiumId}`,
    disabled,
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        opacity: isDragging ? 0.5 : 1,
        transform: CSS.Transform.toString(transform),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '5px 0',
        cursor: disabled ? 'default' : 'grab',
        touchAction: disabled ? 'auto' : 'none',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12,
          color: 'var(--color-text-ter)',
        }}
      >
        {condo.condominiumName}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {locked && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              color: 'var(--color-good)',
              fontFamily: 'var(--font-body)',
              fontSize: 10.5,
              fontWeight: 700,
            }}
          >
            <Icon name="check" size={11} color="var(--color-good)" stroke={2.6} aria-hidden="true" />
            entregue
          </span>
        )}
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--color-text-sec)',
          }}
        >
          {condo.quantity} pães
        </span>
      </span>
    </div>
  )
}

interface CourierDropZoneProps {
  courierId: string
  children: ReactNode
  disabled?: boolean
}

// Registra o card do entregador como alvo de soltar (droppable).
// Necessário para conseguir arrastar condomínios para entregadores sem
// nenhum condomínio — que não têm chips arrastáveis para servir de alvo.
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
  lockedCondoIds,
}: DeliveryDivisionCardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [approveError, setApproveError] = useState(false)
  // Modo de edição após aprovação ("Reabrir divisão"). Antes de aprovar o DnD já está liberado.
  const [reopened, setReopened] = useState(false)
  const dndEnabled = !isApproved || reopened
  const isLocked = (condoId: string) => lockedCondoIds?.has(condoId) ?? false
  // Há algo a reabrir? Só se existir condomínio ainda NÃO entregue.
  const hasReopenable = assignments.some((a) => a.condos.some((c) => !isLocked(c.condominiumId)))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  function findOwner(dragId: string) {
    const [courierId, condominiumId] = dragId.split(':')
    return { courierId, condominiumId }
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

    const activeStr = String(active.id)
    const overStr = String(over.id)

    // over pode ser um courierId (drop zone) ou um item id (courierId:condominiumId)
    const targetCourierId = overStr.includes(':') ? overStr.split(':')[0] : overStr
    const { courierId: sourceCourierId, condominiumId } = findOwner(activeStr)

    // Condomínio já entregue não pode ser remanejado.
    if (isLocked(condominiumId)) return

    if (sourceCourierId === targetCourierId) return

    const next = assignments.map((a) => {
      if (a.courierId === sourceCourierId) {
        return { ...a, condos: a.condos.filter((c) => c.condominiumId !== condominiumId) }
      }
      if (a.courierId === targetCourierId) {
        const condo = assignments
          .find((a2) => a2.courierId === sourceCourierId)
          ?.condos.find((c) => c.condominiumId === condominiumId)
        if (!condo) return a
        return { ...a, condos: [...a.condos, condo] }
      }
      return a
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

  // Todos os IDs sortáveis (courierId:condominiumId) + courierId como drop zone
  const allSortableIds = assignments.flatMap((a) =>
    a.condos.map((c) => `${a.courierId}:${c.condominiumId}`),
  )

  const activeCondoItem = activeId
    ? (() => {
        const { courierId, condominiumId } = findOwner(activeId)
        return assignments.find((a) => a.courierId === courierId)?.condos.find((c) => c.condominiumId === condominiumId) ?? null
      })()
    : null

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 22,
        border: isApproved
          ? '1.5px solid var(--color-border-2)'
          : '1.5px solid var(--color-accent)',
        padding: 16,
        transition: 'border-color 0.2s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 14,
        }}
      >
        <Icon name="spark" size={20} color="var(--color-accent)" stroke={2} aria-hidden="true" />
        <span
          style={{
            flex: 1,
            fontFamily: 'var(--font-body)',
            fontSize: 14.5,
            fontWeight: 700,
            color: 'var(--color-text)',
          }}
        >
          Divisão sugerida
        </span>
        {isApproved && !reopened && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 99,
              background: 'var(--color-good-soft)',
              color: 'var(--color-good)',
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            <Icon name="check" size={13} color="var(--color-good)" stroke={2.6} aria-hidden="true" />
            Aprovada
          </span>
        )}
        {reopened && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 99,
              background: 'var(--color-gold-soft)',
              color: '#8A6A00',
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            <Icon name="edit" size={12} color="#8A6A00" stroke={2.2} aria-hidden="true" />
            Editando
          </span>
        )}
      </div>

      {/* Drag-and-drop context */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={allSortableIds} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {assignments.map((assignment) => (
              <CourierDropZone key={assignment.courierId} courierId={assignment.courierId} disabled={!dndEnabled}>
                {/* Entregador header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: assignment.condos.length > 0 ? 8 : 0,
                  }}
                >
                  {/* Avatar circular */}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'var(--color-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon name="user" size={18} color="var(--color-accent)" stroke={2} aria-hidden="true" />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 14,
                        fontWeight: 700,
                        color: 'var(--color-text)',
                        margin: 0,
                        lineHeight: 1.2,
                      }}
                    >
                      {assignment.courierName}
                    </p>
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 12,
                        color: 'var(--color-text-ter)',
                        margin: '2px 0 0',
                        lineHeight: 1.2,
                      }}
                    >
                      {assignment.condos.length > 0
                        ? assignment.condos.map((c) => c.condominiumName).join(', ')
                        : 'Sem condomínios atribuídos'}
                    </p>
                  </div>

                  {/* Total de pães */}
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'baseline',
                      gap: 4,
                      fontFamily: 'var(--font-display)',
                      fontSize: 15,
                      fontWeight: 800,
                      color: 'var(--color-gold)',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {totalForCourier(assignment)}
                    <span style={{ fontSize: 13 }}>🥖</span>
                  </span>
                </div>

                {/* Condomínios arrastáveis */}
                {assignment.condos.length > 0 && (
                  <div
                    style={{
                      borderTop: '1px solid var(--color-border-2)',
                      paddingTop: 6,
                    }}
                  >
                    {assignment.condos.map((condo) => (
                      <SortableCondo
                        key={condo.condominiumId}
                        condo={condo}
                        courierId={assignment.courierId}
                        disabled={!dndEnabled || isLocked(condo.condominiumId)}
                        locked={reopened && isLocked(condo.condominiumId)}
                      />
                    ))}
                  </div>
                )}
              </CourierDropZone>
            ))}
          </div>
        </SortableContext>

        {/* Overlay do item sendo arrastado */}
        <DragOverlay>
          {activeCondoItem ? (
            <div
              style={{
                background: 'var(--color-surface)',
                borderRadius: 8,
                padding: '6px 12px',
                border: '1.5px solid var(--color-accent)',
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--color-text)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              }}
            >
              {activeCondoItem.condominiumName}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Erro de aprovação */}
      {approveError && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12.5,
            color: 'var(--color-accent)',
            margin: '10px 0 0',
            textAlign: 'center',
          }}
        >
          Falha ao salvar. Tente novamente.
        </p>
      )}

      {/* Ações: aprovar (estado editável) ou reabrir (estado aprovado) */}
      {dndEnabled ? (
        <button
          onClick={() => void handleApprove()}
          disabled={isApproving}
          style={{
            width: '100%',
            marginTop: 12,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            border: 'none',
            borderRadius: 14,
            background: 'var(--color-gold)',
            color: '#1E1207',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 700,
            cursor: isApproving ? 'wait' : 'pointer',
            opacity: isApproving ? 0.6 : 1,
            transition: 'opacity 0.15s ease',
          }}
        >
          <Icon name="check" size={16} color="#1E1207" stroke={2.5} aria-hidden="true" />
          {isApproving ? 'Aprovando...' : 'Aprovar divisão'}
        </button>
      ) : (
        <button
          onClick={() => setReopened(true)}
          disabled={!hasReopenable}
          title={hasReopenable ? undefined : 'Todas as entregas já foram concluídas'}
          style={{
            width: '100%',
            marginTop: 12,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            border: '1.5px solid var(--color-border)',
            borderRadius: 14,
            background: 'transparent',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 700,
            cursor: hasReopenable ? 'pointer' : 'not-allowed',
            opacity: hasReopenable ? 1 : 0.5,
          }}
        >
          <Icon name="refresh" size={16} color="var(--color-text)" stroke={2.2} aria-hidden="true" />
          Reabrir divisão
        </button>
      )}
    </div>
  )
}
