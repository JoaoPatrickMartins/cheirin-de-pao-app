import { Icon } from '../brand/Icon'

export interface Stop {
  orderId: string
  apartment: string
  block: string | null
  clientName: string
  quantity: number
  status: string
  sortKey: number
}

interface StopRowProps {
  stop: Stop
  order: number
  isConfirmed: boolean
  isNotDelivered?: boolean
  onPress: (stop: Stop) => void
}

export function StopRow({ stop, order, isConfirmed, isNotDelivered = false, onPress }: StopRowProps) {
  const resolved = isConfirmed || isNotDelivered
  return (
    <button
      onClick={() => !resolved && onPress(stop)}
      disabled={resolved}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 16px',
        minHeight: 44,
        width: '100%',
        border: 'none',
        background: 'transparent',
        cursor: resolved ? 'default' : 'pointer',
        textAlign: 'left',
      }}
    >
      {/* Número de ordem */}
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 99,
          background: 'var(--color-surface-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 12,
            fontWeight: 800,
            color: 'var(--color-text-sec)',
            lineHeight: 1,
          }}
        >
          {order}
        </span>
      </div>

      {/* Checkbox / status */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 9,
          border: `2px solid ${isConfirmed ? 'var(--color-good)' : isNotDelivered ? 'var(--color-bad, #C2410C)' : 'var(--color-border)'}`,
          background: isConfirmed ? 'var(--color-good)' : isNotDelivered ? 'var(--color-bad, #C2410C)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.15s',
        }}
      >
        {isConfirmed && <Icon name="check" size={16} color="#fff" />}
        {isNotDelivered && <Icon name="x" size={16} color="#fff" />}
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
            textDecoration: resolved ? 'line-through' : 'none',
            opacity: resolved ? 0.5 : 1,
            transition: 'opacity 0.15s',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {stop.block ? `${stop.block} — Apto ${stop.apartment}` : `Apto ${stop.apartment}`}
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

      {/* Quantidade */}
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 15,
          fontWeight: 800,
          color: 'var(--color-accent)',
          marginLeft: 'auto',
          flexShrink: 0,
        }}
      >
        {stop.quantity}x
      </span>
    </button>
  )
}
