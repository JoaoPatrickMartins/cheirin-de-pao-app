import { Icon } from '../brand/Icon'

export interface CompletedStop {
  orderId: string
  apartment: string
  block: string | null
  clientName: string
  quantity: number
  status: string
  slotId?: string
  slotLabel?: string
  completedAt: string | null
}

export interface CompletedCondo {
  condominiumId: string
  condominiumName: string
  stops: CompletedStop[]
}

/** Rótulo do bloco sem duplicar "Bloco" (o valor já pode contê-la). */
function blockLabel(block: string): string {
  const b = (block || '').trim()
  if (!b || b === '—') return ''
  return /^bloco\b/i.test(b) ? b : `Bloco ${b}`
}

/** Agrupa por bloco preservando a ordem recebida (já ordenada por bloco/apartamento). */
function groupByBlock(stops: CompletedStop[]): Array<{ block: string | null; stops: CompletedStop[] }> {
  const groups: Array<{ block: string | null; stops: CompletedStop[] }> = []
  for (const stop of stops) {
    const b = stop.block && stop.block.trim() ? stop.block.trim() : null
    const last = groups[groups.length - 1]
    if (last && last.block === b) last.stops.push(stop)
    else groups.push({ block: b, stops: [stop] })
  }
  return groups
}

function timeLabel(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(d)
}

function CompletedRow({ stop, showBlock }: { stop: CompletedStop; showBlock: boolean }) {
  const delivered = stop.status === 'DELIVERED'
  const title = showBlock && stop.block ? `${stop.block} — Apto ${stop.apartment}` : `Apto ${stop.apartment}`
  const time = timeLabel(stop.completedAt)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px' }}>
      {/* Status */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 9,
          background: delivered ? 'var(--color-good)' : 'var(--color-bad, #C2410C)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name={delivered ? 'check' : 'x'} size={16} color="#fff" />
      </div>

      {/* Texto */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--color-text)',
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </p>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--color-text-ter)',
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {stop.clientName}
        </p>
      </div>

      {/* Etiqueta de status + horário */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            fontWeight: 700,
            color: delivered ? 'var(--color-good)' : 'var(--color-bad, #C2410C)',
            background: delivered ? 'var(--color-good-soft)' : 'rgba(194,65,12,0.12)',
            borderRadius: 99,
            padding: '2px 8px',
          }}
        >
          {delivered ? 'Entregue' : 'Não entregue'}
        </span>
        {time && (
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, color: 'var(--color-text-ter)' }}>
            {time} · {stop.quantity} 🥖
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Lista somente-leitura das entregas concluídas do dia (entregues + não entregues),
 * agrupadas por condomínio e, dentro dele, por bloco (quando houver).
 */
export function CourierCompletedList({ condos }: { condos: CompletedCondo[] }) {
  const total = condos.reduce((n, c) => n + c.stops.length, 0)

  if (total === 0) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>
          Nenhuma entrega concluída
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--color-text-sec)', margin: 0 }}>
          As entregas confirmadas ou marcadas como não entregues aparecem aqui.
        </p>
      </div>
    )
  }

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {condos.map((condo) => {
        const groups = groupByBlock(condo.stops)
        const hasBlocks = groups.some((g) => g.block !== null)
        return (
          <div
            key={condo.condominiumId}
            style={{ borderRadius: 22, boxShadow: 'var(--shadow-soft)', overflow: 'hidden', background: 'var(--color-surface)' }}
          >
            <div style={{ padding: '14px 16px 4px' }}>
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  letterSpacing: '-0.02em',
                  margin: 0,
                }}
              >
                {condo.condominiumName}
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--color-text-ter)', margin: '2px 0 0' }}>
                {condo.stops.length === 1 ? '1 entrega' : `${condo.stops.length} entregas`}
              </p>
            </div>
            {hasBlocks
              ? groups.map((g) => (
                  <div key={g.block ?? '—'}>
                    <p style={captionStyle}>{g.block ? blockLabel(g.block) : 'Sem bloco'}</p>
                    {g.stops.map((stop) => (
                      <CompletedRow key={stop.orderId} stop={stop} showBlock={false} />
                    ))}
                  </div>
                ))
              : condo.stops.map((stop) => <CompletedRow key={stop.orderId} stop={stop} showBlock={true} />)}
          </div>
        )
      })}
    </div>
  )
}
