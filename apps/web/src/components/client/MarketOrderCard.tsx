import { formatCredits, toMilli } from '@cheirin-de-pao/shared'
import { Icon } from '../brand/Icon'
import { InlineCancelConfirm, inlineCancelBtnStyle } from './InlineCancelConfirm'

export interface MarketOrderView {
  id: string
  status: string
  scheduledDate: string
  slotId: string
  deliveryTime: string | null
  breadQty: number
  items: { productId: string; name: string; qty: number; unitPrice: number }[]
  totalValue: number
  creditsApplied: number
  moneyAmount: number
  createdAt: string
  cancelable: boolean
  cancelReason: string | null
  refundedCredits: number | null
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Aguardando pagamento',
  SCHEDULED: 'Agendada',
  SEPARATED: 'Em separação',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DELIVERED: 'Entregue',
  NOT_DELIVERED: 'Não entregue',
  CANCELLED: 'Cancelada',
}

function statusTone(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'DELIVERED':
      return { bg: 'var(--color-good-soft)', fg: 'var(--color-good)' }
    case 'OUT_FOR_DELIVERY':
    case 'SEPARATED':
      return { bg: 'var(--color-gold-soft)', fg: 'var(--color-accent)' }
    case 'CANCELLED':
    case 'NOT_DELIVERED':
      return { bg: 'var(--color-surface-2)', fg: 'var(--color-text-ter)' }
    default:
      return { bg: 'var(--color-surface-2)', fg: 'var(--color-text-sec)' }
  }
}

function dateLabel(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(`${dateStr}T12:00:00`))
}

interface MarketOrderCardProps {
  order: MarketOrderView
  /** Confirmação embutida aberta para este pedido. */
  confirming: boolean
  busy: boolean
  error: string | null
  onAskCancel: () => void
  onConfirmCancel: () => void
  onBack: () => void
}

/**
 * MarketOrderCard — card de uma Cestinha ("Além do Pãozin") na lista de histórico do cliente.
 *
 * Mostra data, itens, split crédito/dinheiro e o cancelamento antes do corte (estorno tudo em
 * crédito). Vive na MESMA lista dos pedidos de pão (TrackingScreen › Histórico) e usa o mesmo
 * InlineCancelConfirm, para que a confirmação seja idêntica nos dois tipos de pedido.
 */
export function MarketOrderCard({
  order: o,
  confirming,
  busy,
  error,
  onAskCancel,
  onConfirmCancel,
  onBack,
}: MarketOrderCardProps) {
  const tone = statusTone(o.status)
  return (
    <div
      style={{
        padding: 14,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 'var(--radius-card)',
      }}
    >
      <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--color-gold-soft)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon name="basket" size={21} color="var(--color-accent)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14.5, color: 'var(--color-text)', margin: 0 }}>
              {dateLabel(o.scheduledDate)}
            </p>
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: 11.5,
                background: tone.bg,
                color: tone.fg,
                borderRadius: 99,
                padding: '3px 9px',
                flexShrink: 0,
              }}
            >
              {STATUS_LABEL[o.status] ?? o.status}
            </span>
          </div>
          {/* Itens */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {o.items.map((it, i) => (
              <span
                key={i}
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: 'var(--color-text-sec)',
                  background: 'var(--color-surface-2)',
                  borderRadius: 999,
                  padding: '2px 8px',
                }}
              >
                {it.qty}× {it.name}
              </span>
            ))}
            {o.breadQty > 0 && (
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: 'var(--color-accent)',
                  background: 'var(--color-gold-soft)',
                  borderRadius: 999,
                  padding: '2px 8px',
                }}
              >
                {o.breadQty} 🥖
              </span>
            )}
          </div>
          {/* Split pago */}
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '6px 0 0' }}>
            {o.creditsApplied > 0 ? `${formatCredits(toMilli(o.creditsApplied))} 🥖` : ''}
            {o.creditsApplied > 0 && o.moneyAmount > 0 ? ' + ' : ''}
            {o.moneyAmount > 0 ? `R$ ${o.moneyAmount.toFixed(2).replace('.', ',')}` : ''}
            {o.status === 'CANCELLED' && o.refundedCredits
              ? ` · estornado em ${formatCredits(toMilli(o.refundedCredits))} 🥖`
              : ''}
          </p>
        </div>
      </div>

      {/* Cancelar (antes do corte) */}
      {o.cancelable && !confirming && (
        <button onClick={onAskCancel} style={inlineCancelBtnStyle}>
          Cancelar Cestinha
        </button>
      )}
      {confirming && (
        <InlineCancelConfirm
          message="Cancelar esta Cestinha? Seus pãezinhos voltam para o saldo — inclusive a parte paga em dinheiro, convertida em pãezinhos."
          error={error}
          busy={busy}
          onConfirm={onConfirmCancel}
          onBack={onBack}
        />
      )}
    </div>
  )
}
