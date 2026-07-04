import { useState } from 'react'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../brand/Icon'

export interface LedgerRow {
  orderId: string
  userId: string
  clientName: string
  condominiumId: string
  condominiumName: string
  block: string
  apartment: string
  quantity: number
  slotId: string
  slotLabel: string
  type: string
  status: string
  scheduledDate: string
  courierId: string
  courierName: string
  separatedAt: string
  deliveredAt: string
  failedAt: string
  failureReason: string
  cancelReason: string
  deliveryNote: string
  refunded: boolean
  paymentId: string
  paymentAmount: number
  paymentStatus: string
}

export const STATUS_META: Record<string, { label: string; color: string; soft: string }> = {
  SCHEDULED: { label: 'Agendado', color: '#8A6A00', soft: 'var(--color-gold-soft)' },
  SEPARATED: { label: 'Separado', color: 'var(--color-accent)', soft: 'var(--color-surface-2)' },
  OUT_FOR_DELIVERY: { label: 'A caminho', color: '#8A6A00', soft: 'var(--color-gold-soft)' },
  DELIVERED: { label: 'Entregue', color: 'var(--color-good)', soft: 'var(--color-good-soft)' },
  NOT_DELIVERED: { label: 'Não entregue', color: 'var(--color-bad, #C2410C)', soft: 'rgba(194,65,12,0.12)' },
  CANCELLED: { label: 'Cancelado', color: 'var(--color-text-ter)', soft: 'var(--color-surface-2)' },
}

const ACTIVE = ['SCHEDULED', 'SEPARATED', 'OUT_FOR_DELIVERY']
const TERMINAL_REFUNDABLE = ['NOT_DELIVERED', 'CANCELLED']

// Passos do resolver: além da visão, um passo por desfecho e os dois estornos.
type Mode = 'view' | 'deliver' | 'fail' | 'cancel' | 'refund' | 'payment'

function fmt(dateStr: string) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return dateStr
  }
}

function fmtMoney(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Detalhe de um pedido com o "resolver": para um pedido ativo/parado, permite dar o
 * desfecho (entregue a posteriori / não entregue / cancelado) e, no mesmo passo,
 * devolver os pães ao saldo. Estorno de dinheiro (Stripe) é uma ação separada, só
 * quando há pagamento vinculado. Usado no histórico/parados da aba Entregas.
 */
export function OrderDetailSheet({ row, onClose, onChanged }: { row: LedgerRow; onClose: () => void; onChanged: () => void }) {
  const [mode, setMode] = useState<Mode>('view')
  const [reason, setReason] = useState('')
  const [refundCredits, setRefundCredits] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const meta = STATUS_META[row.status] ?? { label: row.status, color: 'var(--color-text-ter)', soft: 'var(--color-surface-2)' }
  const canResolve = ACTIVE.includes(row.status)
  const canRefund = TERMINAL_REFUNDABLE.includes(row.status) && !row.refunded
  const hasPayment = !!row.paymentId
  const canRefundPayment = hasPayment && row.paymentStatus === 'PAID'

  function goto(next: Mode) {
    setError('')
    setReason('')
    setRefundCredits(true)
    setMode(next)
  }

  // Resolve o pedido parado: desfecho + (opcional) devolução de pães, em uma chamada.
  async function resolve(outcome: 'DELIVERED' | 'NOT_DELIVERED' | 'CANCELLED') {
    setBusy(true)
    setError('')
    try {
      const body: Record<string, unknown> = { outcome }
      if (outcome === 'DELIVERED') {
        if (reason.trim()) body.reason = reason.trim()
      } else {
        body.reason = reason.trim()
        body.refundCredits = refundCredits
      }
      const res = await apiFetch(`/admin/orders/${row.orderId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Falha ao resolver o pedido')
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(false)
    }
  }

  // Estorno de pães de um pedido já terminal (não entregue/cancelado sem estorno).
  async function refund() {
    setBusy(true)
    setError('')
    try {
      const res = await apiFetch(`/admin/orders/${row.orderId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Falha ao estornar')
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(false)
    }
  }

  // Estorno de dinheiro (Stripe) do pagamento vinculado. Reusa o fluxo de Pagamentos,
  // que já debita os créditos correspondentes atomicamente no backend.
  async function refundPayment() {
    setBusy(true)
    setError('')
    try {
      const res = await apiFetch(`/admin/payments/${row.paymentId}/refund`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Falha ao estornar o pagamento')
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(false)
    }
  }

  const reasonRequired = mode === 'fail' || mode === 'cancel'
  const confirmDisabled = busy || (reasonRequired && !reason.trim())

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          padding: '20px 20px calc(24px + env(safe-area-inset-bottom))',
          width: '100%',
          maxWidth: 480,
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>{row.clientName}</p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)', margin: '3px 0 0' }}>
              {row.condominiumName} · {row.block ? `Bloco ${row.block} · ` : ''}Apto {row.apartment || '—'}
            </p>
          </div>
          <span style={{ padding: '4px 10px', borderRadius: 99, background: meta.soft, color: meta.color, fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {meta.label}
          </span>
        </div>

        {/* Detalhes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <DetailRow label="Pãezinhos" value={String(row.quantity)} />
          <DetailRow label="Turno" value={row.slotLabel} />
          <DetailRow label="Data de entrega" value={fmt(row.scheduledDate)} />
          {row.courierName && <DetailRow label="Entregador" value={row.courierName} />}
          {row.separatedAt && <DetailRow label="Separado em" value={fmt(row.separatedAt)} />}
          {row.deliveredAt && <DetailRow label="Entregue em" value={fmt(row.deliveredAt)} />}
          {row.failedAt && <DetailRow label="Não entregue em" value={fmt(row.failedAt)} />}
          {row.failureReason && <DetailRow label="Motivo" value={row.failureReason} />}
          {row.cancelReason && <DetailRow label="Motivo do cancelamento" value={row.cancelReason} />}
          {row.deliveryNote && <DetailRow label="Nota da entrega" value={row.deliveryNote} />}
          {row.refunded && <DetailRow label="Pães" value="Devolvidos ao saldo ✓" />}
          {hasPayment && (
            <DetailRow
              label="Pagamento"
              value={
                (row.paymentAmount ? fmtMoney(row.paymentAmount) : 'vinculado') +
                (row.paymentStatus === 'REFUNDED' ? ' · estornado' : '')
              }
            />
          )}
        </div>

        {error && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-bad, #C2410C)', margin: '0 0 12px' }}>{error}</p>
        )}

        {/* Campo de motivo/nota conforme o passo */}
        {mode !== 'view' && mode !== 'payment' && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              mode === 'fail'
                ? 'Motivo da não-entrega (cliente ausente, endereço...)'
                : mode === 'cancel'
                  ? 'Motivo do cancelamento'
                  : mode === 'deliver'
                    ? 'Observação (opcional) — ex.: entregue manualmente'
                    : 'Motivo do estorno (opcional)'
            }
            rows={3}
            style={{
              width: '100%',
              borderRadius: 12,
              border: '1px solid var(--color-border-2)',
              background: 'var(--color-surface-2)',
              padding: 12,
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--color-text)',
              resize: 'vertical',
              marginBottom: 12,
            }}
          />
        )}

        {/* Devolver pães — só nos desfechos de não-entrega/cancelamento */}
        {(mode === 'fail' || mode === 'cancel') && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={refundCredits} onChange={(e) => setRefundCredits(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--color-espresso)' }} />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text)' }}>
              Devolver {row.quantity} {row.quantity === 1 ? 'pão' : 'pães'} ao saldo
            </span>
          </label>
        )}

        {/* Aviso do estorno de dinheiro (dinheiro ≠ pães) */}
        {mode === 'payment' && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-sec)', margin: '0 0 12px', lineHeight: 1.45 }}>
            Estorna {row.paymentAmount ? fmtMoney(row.paymentAmount) : 'o valor pago'} no cartão/Pix e remove os créditos correspondentes.
            O valor pago pode ser menor que {row.quantity} {row.quantity === 1 ? 'pão' : 'pães'} (parte pode ter vindo do saldo) —
            não combine com “devolver pães” para as mesmas unidades.
          </p>
        )}

        {/* Ações */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mode === 'view' && (
            <>
              {canResolve && (
                <>
                  <ActionButton variant="good" label="Marcar como entregue" onClick={() => goto('deliver')} />
                  <ActionButton variant="danger" label="Registrar não entrega" onClick={() => goto('fail')} />
                  <ActionButton variant="dangerGhost" label="Cancelar pedido" onClick={() => goto('cancel')} />
                </>
              )}
              {canRefund && <ActionButton variant="primary" label="Devolver pães ao saldo" onClick={() => goto('refund')} />}
              {canRefundPayment && <ActionButton variant="ghost" label={`Estornar pagamento${row.paymentAmount ? ` (${fmtMoney(row.paymentAmount)})` : ''}`} onClick={() => goto('payment')} />}
              <ActionButton variant="ghost" label="Fechar" onClick={onClose} />
            </>
          )}
          {mode === 'deliver' && (
            <>
              <ActionButton variant="good" label={busy ? 'Salvando...' : 'Confirmar entrega'} onClick={() => resolve('DELIVERED')} disabled={busy} />
              <ActionButton variant="ghost" label="Voltar" onClick={() => goto('view')} disabled={busy} />
            </>
          )}
          {mode === 'fail' && (
            <>
              <ActionButton variant="danger" label={busy ? 'Salvando...' : 'Confirmar não entrega'} onClick={() => resolve('NOT_DELIVERED')} disabled={confirmDisabled} />
              <ActionButton variant="ghost" label="Voltar" onClick={() => goto('view')} disabled={busy} />
            </>
          )}
          {mode === 'cancel' && (
            <>
              <ActionButton variant="danger" label={busy ? 'Cancelando...' : 'Confirmar cancelamento'} onClick={() => resolve('CANCELLED')} disabled={confirmDisabled} />
              <ActionButton variant="ghost" label="Voltar" onClick={() => goto('view')} disabled={busy} />
            </>
          )}
          {mode === 'refund' && (
            <>
              <ActionButton variant="primary" label={busy ? 'Estornando...' : `Confirmar estorno (${row.quantity})`} onClick={refund} disabled={busy} />
              <ActionButton variant="ghost" label="Voltar" onClick={() => goto('view')} disabled={busy} />
            </>
          )}
          {mode === 'payment' && (
            <>
              <ActionButton variant="danger" label={busy ? 'Estornando...' : 'Confirmar estorno do pagamento'} onClick={refundPayment} disabled={busy} />
              <ActionButton variant="ghost" label="Voltar" onClick={() => goto('view')} disabled={busy} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function ActionButton({ label, onClick, variant, disabled }: { label: string; onClick: () => void; variant: 'primary' | 'danger' | 'dangerGhost' | 'good' | 'ghost'; disabled?: boolean }) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--color-espresso)', color: '#fff', border: 'none' },
    danger: { background: 'var(--color-bad, #C2410C)', color: '#fff', border: 'none' },
    dangerGhost: { background: 'none', color: 'var(--color-bad, #C2410C)', border: '1.5px solid var(--color-bad, #C2410C)' },
    good: { background: 'var(--color-good)', color: '#fff', border: 'none' },
    ghost: { background: 'none', color: 'var(--color-text)', border: '1.5px solid var(--color-border)' },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minHeight: 46,
        borderRadius: 999,
        fontFamily: 'var(--font-body)',
        fontWeight: 700,
        fontSize: 15,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.7 : 1,
        ...styles[variant],
      }}
    >
      {label}
    </button>
  )
}
