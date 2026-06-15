import { Icon } from '../brand/Icon'
import { StopRow, Stop } from './StopRow'

export interface CondoGroup {
  condominiumId: string
  condominiumName: string
  address: string
  lat: number | null
  lng: number | null
  stops: Stop[]
}

interface CondoAccordionProps {
  condo: CondoGroup
  order: number
  isOpen: boolean
  onToggle: () => void
  confirmedIds: Set<string>
  onConfirm: (stop: Stop) => void
}

export function CondoAccordion({
  condo,
  order,
  isOpen,
  onToggle,
  confirmedIds,
  onConfirm,
}: CondoAccordionProps) {
  const feitas = condo.stops.filter((s) => confirmedIds.has(s.orderId)).length
  const total = condo.stops.length
  const isAllDone = feitas === total && total > 0

  return (
    <div
      style={{
        borderRadius: 22,
        boxShadow: 'var(--shadow-soft)',
        overflow: 'hidden',
        background: 'var(--color-surface)',
      }}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          minHeight: 44,
          textAlign: 'left',
        }}
      >
        {/* Badge numérico */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: 'var(--color-gold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 15,
              fontWeight: 800,
              color: 'var(--color-espresso)',
            }}
          >
            {order}
          </span>
        </div>

        {/* Nome + subtítulo */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {condo.condominiumName}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-text-ter)',
              margin: 0,
            }}
          >
            {total === 1 ? '1 parada' : `${total} paradas`}
          </p>
        </div>

        {/* Pill de progresso */}
        {isAllDone ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 99,
              background: 'var(--color-good-soft)',
              color: 'var(--color-good)',
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            <Icon name="check" size={13} color="var(--color-good)" />
            Ok
          </div>
        ) : (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '3px 8px',
              borderRadius: 99,
              background: 'var(--color-gold-soft)',
              color: 'var(--color-accent)',
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {feitas}/{total}
          </div>
        )}

        {/* Chevron */}
        <div
          style={{
            flexShrink: 0,
            transform: `rotate(${isOpen ? 180 : 0}deg)`,
            transition: 'transform 0.2s',
          }}
        >
          <Icon name="chevD" size={18} color="var(--color-text-ter)" />
        </div>
      </button>

      {/* Conteúdo */}
      {isOpen && (
        <div style={{ borderTop: '1px solid var(--color-border-2)' }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: 'var(--color-text-ter)',
              padding: '8px 16px 4px',
              margin: 0,
              textTransform: 'uppercase',
            }}
          >
            ORDEM SUGERIDA NO PRÉDIO
          </p>
          {condo.stops.map((stop, idx) => (
            <StopRow
              key={stop.orderId}
              stop={stop}
              order={idx + 1}
              isConfirmed={confirmedIds.has(stop.orderId)}
              onPress={onConfirm}
            />
          ))}
        </div>
      )}
    </div>
  )
}
