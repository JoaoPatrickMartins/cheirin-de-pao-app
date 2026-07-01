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
  refunded: boolean
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

function fmt(dateStr: string) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return dateStr
  }
}

/**
 * Detalhe de um pedido com ações: marcar "não entregue" (com motivo) e estornar crédito.
 * Usado no histórico/parados da aba Entregas.
 */
export function OrderDetailSheet({ row, onClose, onChanged }: { row: LedgerRow; onClose: () => void; onChanged: () => void }) {
  const [mode, setMode] = useState<'view' | 'fail' | 'refund'>('view')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const meta = STATUS_META[row.status] ?? { label: row.status, color: 'var(--color-text-ter)', soft: 'var(--color-surface-2)' }
  const canFail = ACTIVE.includes(row.status)
  const canRefund = TERMINAL_REFUNDABLE.includes(row.status) && !row.refunded

  async function markNotDelivered() {
    setBusy(true)
    setError('')
    try {
      const res = await apiFetch(`/admin/orders/${row.orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'NOT_DELIVERED', reason: reason.trim() || undefined }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Falha ao marcar não entregue')
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(false)
    }
  }

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
          {row.refunded && <DetailRow label="Crédito" value="Estornado ✓" />}
        </div>

        {error && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-bad, #C2410C)', margin: '0 0 12px' }}>{error}</p>
        )}

        {/* Motivo (quando em fail/refund) */}
        {(mode === 'fail' || mode === 'refund') && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={mode === 'fail' ? 'Motivo da não-entrega (cliente ausente, endereço...)' : 'Motivo do estorno (opcional)'}
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

        {/* Ações */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mode === 'view' && (
            <>
              {canFail && <ActionButton variant="danger" label="Marcar não entregue" onClick={() => setMode('fail')} />}
              {canRefund && <ActionButton variant="primary" label="Estornar crédito" onClick={() => setMode('refund')} />}
              <ActionButton variant="ghost" label="Fechar" onClick={onClose} />
            </>
          )}
          {mode === 'fail' && (
            <>
              <ActionButton variant="danger" label={busy ? 'Salvando...' : 'Confirmar não entregue'} onClick={markNotDelivered} disabled={busy} />
              <ActionButton variant="ghost" label="Voltar" onClick={() => setMode('view')} disabled={busy} />
            </>
          )}
          {mode === 'refund' && (
            <>
              <ActionButton variant="primary" label={busy ? 'Estornando...' : `Confirmar estorno (${row.quantity})`} onClick={refund} disabled={busy} />
              <ActionButton variant="ghost" label="Voltar" onClick={() => setMode('view')} disabled={busy} />
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

function ActionButton({ label, onClick, variant, disabled }: { label: string; onClick: () => void; variant: 'primary' | 'danger' | 'ghost'; disabled?: boolean }) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--color-espresso)', color: '#fff', border: 'none' },
    danger: { background: 'var(--color-bad, #C2410C)', color: '#fff', border: 'none' },
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
