import { Icon } from '../brand/Icon'
import { CRTag, CR_BODY, CR_DISPLAY } from './kit'
import { brtTime, type SlotRoute } from '../../lib/courierApi'

export interface RouteLine {
  route: SlotRoute
  /** Paradas do turno hoje (ativas + resolvidas) e quantas já foram resolvidas. */
  total: number
  done: number
}

/** "☀️ Manhã · 06:30" */
export function TurnoChip({ route, dark = false }: { route: Pick<SlotRoute, 'emoji' | 'label' | 'time'>; dark?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 10px',
        borderRadius: 999,
        background: dark ? 'rgba(227,172,63,0.16)' : 'var(--color-gold-soft)',
        color: dark ? 'var(--color-gold)' : 'var(--color-amber-ink)',
        fontFamily: CR_BODY,
        fontSize: 12.5,
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      {route.emoji ? `${route.emoji} ` : ''}
      {route.label || 'Sem turno'}
      {route.time ? ` · ${route.time}` : ''}
    </span>
  )
}

function Line({ line, last, onStart }: { line: RouteLine; last: boolean; onStart?: (slotId: string) => void }) {
  const { route, total, done } = line
  const km = route.route?.distanceKm ? `~${route.route.distanceKm.replace('.', ',')} km` : null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: last ? 'none' : '1px solid var(--color-border-2)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <TurnoChip route={route} />
          {route.reorderedToday && (
            <CRTag icon="repeat" size="sm">
              ordem alterada hoje
            </CRTag>
          )}
        </div>
        <div style={{ marginTop: 7, fontSize: 14, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 7 }}>
          {route.state === 'pronta' && (
            <>
              <Icon name="clock" size={16} color="var(--color-text-sec)" aria-hidden="true" />
              <span>
                Pronta · {total} {total === 1 ? 'parada' : 'paradas'}
                {km ? ` · ${km}` : ''}
              </span>
            </>
          )}
          {route.state === 'em_rota' && (
            <>
              <span style={{ width: 9, height: 9, borderRadius: 99, background: 'var(--color-good)', boxShadow: '0 0 0 4px var(--color-good-soft)', flexShrink: 0 }} />
              <span>
                Em rota{brtTime(route.run?.startedAt) ? ` desde ${brtTime(route.run?.startedAt)}` : ''} · {done}/{total}
              </span>
            </>
          )}
          {route.state === 'encerrada' && (
            <>
              <Icon name="check" size={16} color="var(--color-good)" stroke={2.8} aria-hidden="true" />
              <span>Encerrada{brtTime(route.run?.endedAt) ? ` às ${brtTime(route.run?.endedAt)}` : ''}</span>
            </>
          )}
        </div>
      </div>
      {route.state === 'pronta' && onStart && done < total && (
        <button
          type="button"
          onClick={() => onStart(route.slotId)}
          aria-label={`Iniciar rota · ${route.label}`}
          style={{
            height: 44,
            padding: '0 14px',
            borderRadius: 14,
            border: 'none',
            background: 'var(--color-espresso)',
            color: 'var(--color-app-bg)',
            fontWeight: 800,
            fontSize: 14,
            fontFamily: CR_BODY,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Icon name="play" size={15} color="var(--color-gold)" stroke={2.4} aria-hidden="true" />
          Iniciar
        </button>
      )}
    </div>
  )
}

/** E1 · "Rota de hoje": data, total do Além do Pãozin e o estado de cada turno (com Iniciar). */
export function RouteTodayCard({
  dateLabel,
  extraLine,
  lines,
  onStart,
}: {
  dateLabel: string
  extraLine?: string | null
  lines: RouteLine[]
  onStart?: (slotId: string) => void
}) {
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 18, padding: '14px 16px 6px', fontFamily: CR_BODY }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--color-text-ter)', textTransform: 'uppercase' }}>Rota de hoje</div>
      <div style={{ fontFamily: CR_DISPLAY, fontWeight: 700, fontSize: 19, color: 'var(--color-text)', letterSpacing: '-0.02em', marginTop: 3 }}>{dateLabel}</div>
      {extraLine && <div style={{ fontSize: 13, color: 'var(--color-text-sec)', marginTop: 5, fontWeight: 600 }}>{extraLine}</div>}
      <div style={{ marginTop: 4 }}>
        {lines.map((l, i) => (
          <Line key={l.route.slotId || 'sem-turno'} line={l} last={i === lines.length - 1} onStart={onStart} />
        ))}
      </div>
      {lines.length === 0 && <div style={{ height: 8 }} />}
    </div>
  )
}
