import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../brand/Icon'

interface MarketOrderView {
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

/**
 * MarketOrdersSection — C7: as Cestinhas ("Além do Pãozin") do cliente no acompanhamento/
 * histórico. Seção auto-contida (não toca no fluxo do pão): lista as Cestinhas dos últimos 30
 * dias com status, itens e cancelamento antes do corte (estorno tudo em crédito). Some quando
 * não há Cestinha alguma.
 */
export function MarketOrdersSection() {
  const [orders, setOrders] = useState<MarketOrderView[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch('/market/orders/history')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MarketOrderView[]) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }, [])

  const cancel = async (id: string) => {
    setBusyId(id)
    setError(null)
    try {
      const res = await apiFetch(`/market/orders/${id}/cancel`, { method: 'POST' })
      if (res.ok) {
        const updated = (await res.json()) as MarketOrderView
        setOrders((prev) => prev.map((o) => (o.id === id ? updated : o)))
        setConfirmId(null)
      } else {
        const e = (await res.json().catch(() => null)) as { error?: string } | null
        setError(e?.error ?? 'Não foi possível cancelar. Tente novamente.')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setBusyId(null)
    }
  }

  if (loading || orders.length === 0) return null

  return (
    <div style={{ marginTop: 18 }}>
      <h2
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 16,
          letterSpacing: '-0.02em',
          color: 'var(--color-text)',
          margin: '0 0 10px',
        }}
      >
        <Icon name="basket" size={18} color="var(--color-accent)" stroke={2} />
        Suas Cestinhas
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {orders.map((o) => {
          const tone = statusTone(o.status)
          const confirming = confirmId === o.id
          return (
            <div
              key={o.id}
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
                    {o.creditsApplied > 0 ? `${o.creditsApplied} 🥖` : ''}
                    {o.creditsApplied > 0 && o.moneyAmount > 0 ? ' + ' : ''}
                    {o.moneyAmount > 0 ? `R$ ${o.moneyAmount.toFixed(2).replace('.', ',')}` : ''}
                    {o.status === 'CANCELLED' && o.refundedCredits ? ` · estornado em ${o.refundedCredits} 🥖` : ''}
                  </p>
                </div>
              </div>

              {/* Cancelar (antes do corte) */}
              {o.cancelable && !confirming && (
                <button
                  onClick={() => { setConfirmId(o.id); setError(null) }}
                  style={cancelBtnStyle}
                >
                  Cancelar Cestinha
                </button>
              )}
              {confirming && (
                <div style={{ marginTop: 12, background: 'var(--color-surface-2)', borderRadius: 12, padding: 12 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text)', margin: '0 0 10px', lineHeight: 1.45 }}>
                    Cancelar esta Cestinha? Seus pãezinhos voltam para o saldo — inclusive a parte paga em dinheiro, convertida em pãezinhos.
                  </p>
                  {error && (
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-accent)', margin: '0 0 8px' }}>{error}</p>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => cancel(o.id)}
                      disabled={busyId === o.id}
                      style={{ flex: 1, minHeight: 42, borderRadius: 'var(--radius-btn)', border: 'none', background: 'var(--color-bad, #C2410C)', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', opacity: busyId === o.id ? 0.7 : 1 }}
                    >
                      {busyId === o.id ? 'Cancelando...' : 'Sim, cancelar'}
                    </button>
                    <button
                      onClick={() => { setConfirmId(null); setError(null) }}
                      disabled={busyId === o.id}
                      style={{ flex: 1, minHeight: 42, borderRadius: 'var(--radius-btn)', border: '1.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const cancelBtnStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  marginTop: 12,
  padding: '7px 12px',
  background: 'transparent',
  color: 'var(--color-bad, #C2410C)',
  border: '1.5px solid var(--color-bad, #C2410C)',
  borderRadius: 'var(--radius-btn)',
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
}
