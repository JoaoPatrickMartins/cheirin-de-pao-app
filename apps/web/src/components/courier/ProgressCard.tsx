import { BreadMark } from '../brand/BreadMark'

interface ProgressCardProps {
  confirmed: number
  total: number
  totalBreads: number
  confirmedBreads: number
}

export function ProgressCard({ confirmed, total, totalBreads, confirmedBreads }: ProgressCardProps) {
  const pct = total > 0 ? (confirmed / total) * 100 : 0

  return (
    <div
      style={{
        position: 'relative',
        background: '#1E1207',
        borderRadius: 22,
        overflow: 'hidden',
        padding: '16px 20px',
      }}
    >
      {/* BreadMark decorativo */}
      <div
        style={{
          position: 'absolute',
          bottom: -40,
          right: -16,
          opacity: 0.12,
          pointerEvents: 'none',
        }}
      >
        <BreadMark size={130} color="#E3AC3F" />
      </div>

      {/* Linha principal */}
      <div style={{ display: 'flex', flexDirection: 'row', gap: 16, position: 'relative' }}>
        {/* Coluna esquerda */}
        <div style={{ flex: 1 }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 700,
              color: '#E3AC3F',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              margin: '0 0 4px',
            }}
          >
            PROGRESSO
          </p>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 26,
              color: '#FAF5EC',
              letterSpacing: '-0.02em',
              lineHeight: 1,
              margin: 0,
            }}
          >
            {confirmed}/{total} {total === 1 ? 'parada' : 'paradas'}
          </p>
        </div>

        {/* Coluna direita */}
        <div style={{ textAlign: 'right' }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 700,
              color: '#C7B595',
              margin: '0 0 4px',
            }}
          >
            Total de pães
          </p>
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 26,
              color: '#E3AC3F',
              letterSpacing: '-0.02em',
              lineHeight: 1,
              margin: 0,
            }}
          >
            {confirmedBreads}/{totalBreads}
          </p>
        </div>
      </div>

      {/* Barra de progresso */}
      <div
        style={{
          marginTop: 12,
          height: 6,
          borderRadius: 99,
          background: 'var(--color-surface-2)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: '#E3AC3F',
            borderRadius: 99,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  )
}
