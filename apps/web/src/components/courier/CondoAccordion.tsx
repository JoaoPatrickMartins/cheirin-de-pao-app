import { Icon } from '../brand/Icon'
import { StopRow, Stop, stopKey } from './StopRow'

/** Rótulo do bloco sem duplicar "Bloco" (o valor já pode contê-la). */
function blockLabel(block: string): string {
  const b = (block || '').trim()
  if (!b || b === '—') return ''
  return /^bloco\b/i.test(b) ? b : `Bloco ${b}`
}

/**
 * Agrupa paradas por bloco preservando a ordem já recebida (backend ordena por
 * bloco → apartamento). Paradas sem bloco caem num grupo com block === null.
 */
function groupByBlock(stops: Stop[]): Array<{ block: string | null; stops: Stop[] }> {
  const groups: Array<{ block: string | null; stops: Stop[] }> = []
  for (const stop of stops) {
    const b = stop.block && stop.block.trim() ? stop.block.trim() : null
    const last = groups[groups.length - 1]
    if (last && last.block === b) last.stops.push(stop)
    else groups.push({ block: b, stops: [stop] })
  }
  return groups
}

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
  notDeliveredIds?: Set<string>
  // Repassa para as paradas exibirem o turno (quando a rota mistura manhã e tarde).
  showSlot?: boolean
  onConfirm: (stop: Stop) => void
}

export function CondoAccordion({
  condo,
  order,
  isOpen,
  onToggle,
  confirmedIds,
  notDeliveredIds = new Set(),
  showSlot = false,
  onConfirm,
}: CondoAccordionProps) {
  // "Resolvidas" = entregues OU marcadas como não entregues (ambas saem da fila de ação)
  const feitas = condo.stops.filter((s) => confirmedIds.has(stopKey(s)) || notDeliveredIds.has(stopKey(s))).length
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
      {isOpen && (() => {
        const groups = groupByBlock(condo.stops)
        const hasBlocks = groups.some((g) => g.block !== null)
        const captionStyle: React.CSSProperties = {
          fontFamily: 'var(--font-body)',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.04em',
          color: 'var(--color-text-ter)',
          padding: '8px 16px 4px',
          margin: 0,
          textTransform: 'uppercase',
        }
        const renderStops = (stops: Stop[]) =>
          stops.map((stop, idx) => (
            <StopRow
              key={stopKey(stop) || `${stop.apartment}-${idx}`}
              stop={stop}
              order={idx + 1}
              isConfirmed={confirmedIds.has(stopKey(stop))}
              isNotDelivered={notDeliveredIds.has(stopKey(stop))}
              showSlot={showSlot}
              showBlock={!hasBlocks}
              onPress={onConfirm}
            />
          ))
        return (
          <div style={{ borderTop: '1px solid var(--color-border-2)' }}>
            {hasBlocks ? (
              // Condomínio com blocos: um subtítulo por bloco (crescente), apartamentos
              // crescentes sob cada bloco.
              groups.map((g) => (
                <div key={g.block ?? '—'}>
                  <p style={captionStyle}>{g.block ? blockLabel(g.block) : 'Sem bloco'}</p>
                  {renderStops(g.stops)}
                </div>
              ))
            ) : (
              <>
                <p style={captionStyle}>ORDEM SUGERIDA NO PRÉDIO</p>
                {renderStops(condo.stops)}
              </>
            )}
          </div>
        )
      })()}
    </div>
  )
}
