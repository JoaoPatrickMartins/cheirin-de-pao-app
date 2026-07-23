import { Icon } from '../brand/Icon'

export interface Stop {
  orderId: string
  apartment: string
  block: string | null
  clientName: string
  quantity: number
  status: string
  sortKey: number
  slotId?: string
  slotLabel?: string
  // Mini market ("Além do Pãozin"): itens que acompanham a parada. `marketOrderId` só é
  // preenchido em parada SÓ-market (sem pedido de pão) — a confirmação usa rota própria.
  marketOrderId?: string
  marketItems?: { name: string; qty: number }[]
  marketItemCount?: number
}

/** Chave estável de rastreio de uma parada (pão OU só-market). */
export function stopKey(stop: Stop): string {
  return stop.orderId || stop.marketOrderId || ''
}

interface StopRowProps {
  stop: Stop
  order: number
  isConfirmed: boolean
  isNotDelivered?: boolean
  // Mostra o turno por parada — usado quando a rota mistura manhã e tarde.
  showSlot?: boolean
  // Mostra o bloco no título — desligado quando a parada já está sob um subtítulo de bloco.
  showBlock?: boolean
  onPress: (stop: Stop) => void
}

export function StopRow({ stop, order, isConfirmed, isNotDelivered = false, showSlot = false, showBlock = true, onPress }: StopRowProps) {
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
          {showBlock && stop.block ? `${stop.block} — Apto ${stop.apartment}` : `Apto ${stop.apartment}`}
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
        {/* Chips dos itens da Cestinha (Além do Pãozin) que acompanham esta parada. */}
        {stop.marketItems && stop.marketItems.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
            {stop.marketItems.map((it, i) => (
              <span
                key={i}
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--color-espresso)',
                  background: 'var(--color-gold-soft)',
                  borderRadius: 999,
                  padding: '2px 8px',
                }}
              >
                {it.qty}× {it.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Turno (quando a rota mistura manhã e tarde) */}
      {showSlot && stop.slotLabel && (
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--color-text-sec)',
            background: 'var(--color-surface-2)',
            borderRadius: 99,
            padding: '2px 8px',
            flexShrink: 0,
          }}
        >
          {stop.slotLabel}
        </span>
      )}

      {/* Quantidade — pães (ex.: 8 🥖); parada só-market (0 pães) mostra a cestinha. */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontFamily: 'var(--font-display)',
          fontSize: 15,
          fontWeight: 800,
          color: 'var(--color-accent)',
          marginLeft: showSlot && stop.slotLabel ? 0 : 'auto',
          flexShrink: 0,
        }}
      >
        {stop.quantity > 0 ? (
          <>
            {stop.quantity}
            <span style={{ fontSize: 15, lineHeight: 1 }} aria-hidden="true">🥖</span>
          </>
        ) : (
          <span style={{ fontSize: 15, lineHeight: 1 }} aria-hidden="true">🧺</span>
        )}
      </span>
    </button>
  )
}
