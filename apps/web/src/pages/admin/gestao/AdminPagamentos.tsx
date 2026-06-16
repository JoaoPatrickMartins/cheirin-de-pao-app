import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { PaymentDetailSheet } from '../../../components/admin/PaymentDetailSheet'

// ------------------------------------------------------------------ tipos
type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'
type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD'

interface Payment {
  id: string
  userId: string
  userName: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  comboId?: string | null
  customQuantity?: number | null
  createdAt: string
}

type SubTelaSub = null | 'detalhe'

interface AdminPagamentosProps {
  onBack: () => void
}

// ------------------------------------------------------------------ helpers
function formatBRL(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))
}

function methodLabel(method: PaymentMethod): string {
  if (method === 'PIX') return 'Pix'
  if (method === 'CREDIT_CARD') return 'Cartão'
  return 'Débito'
}

function typeLabel(payment: Payment): string {
  if (payment.customQuantity) return `Avulso · ${payment.customQuantity} pães`
  return 'Combo'
}

// ------------------------------------------------------------------ componente
export function AdminPagamentos({ onBack }: AdminPagamentosProps) {
  const [sub, setSub] = useState<SubTelaSub>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const res = await apiFetch('/admin/payments')
        if (res.ok) {
          setPayments((await res.json()) as Payment[])
        }
      } catch {
        // falha silenciosa
      } finally {
        setIsLoading(false)
      }
    }
    void fetchPayments()
  }, [])

  const handleRefundSuccess = (id: string) => {
    setPayments((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'REFUNDED' as PaymentStatus } : p)),
    )
  }

  if (sub === 'detalhe' && selectedId) {
    return (
      <PaymentDetailSheet
        paymentId={selectedId}
        onBack={() => {
          setSub(null)
          setSelectedId(null)
        }}
        onRefundSuccess={() => handleRefundSuccess(selectedId)}
      />
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* AppBar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 20px 14px',
        }}
      >
        <button
          type="button"
          aria-label="Voltar"
          onClick={onBack}
          style={{
            background: 'var(--color-surface-2)',
            border: 'none',
            width: 36,
            height: 36,
            borderRadius: 11,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Icon name="arrowL" size={18} color="var(--color-text)" />
        </button>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--color-text)',
            margin: 0,
            flex: 1,
          }}
        >
          Pagamentos
        </h2>
      </div>

      {/* Lista */}
      <div style={{ overflow: 'auto', flex: 1, padding: '0 20px 24px' }}>
        {isLoading ? (
          <div style={{ paddingTop: 32, textAlign: 'center' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
              Carregando...
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {payments.map((p) => (
              <PaymentCard
                key={p.id}
                payment={p}
                formatBRL={formatBRL}
                formatDate={formatDate}
                methodLabel={methodLabel}
                typeLabel={typeLabel}
                onClick={() => {
                  setSelectedId(p.id)
                  setSub('detalhe')
                }}
                onRefundSuccess={() => handleRefundSuccess(p.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ PaymentCard
interface PaymentCardProps {
  payment: Payment
  formatBRL: (v: number) => string
  formatDate: (iso: string) => string
  methodLabel: (m: PaymentMethod) => string
  typeLabel: (p: Payment) => string
  onClick: () => void
  onRefundSuccess: () => void
}

function PaymentCard({
  payment: p,
  formatBRL,
  formatDate,
  methodLabel,
  typeLabel,
  onClick,
  onRefundSuccess,
}: PaymentCardProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [isRefunding, setIsRefunding] = useState(false)
  const [refundError, setRefundError] = useState<string | null>(null)

  const handleRefund = async () => {
    setIsRefunding(true)
    setRefundError(null)
    try {
      const res = await apiFetch(`/admin/payments/${p.id}/refund`, { method: 'POST' })
      if (res.ok) {
        setShowDialog(false)
        onRefundSuccess()
      } else {
        setRefundError('Falha no estorno. Tente novamente.')
      }
    } catch {
      setRefundError('Falha no estorno. Tente novamente.')
    } finally {
      setIsRefunding(false)
    }
  }

  return (
    <>
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-2)',
          borderRadius: 16,
          padding: 15,
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          cursor: 'pointer',
        }}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => e.key === 'Enter' && onClick()}
      >
        {/* Linha principal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Avatar */}
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: 'var(--color-surface-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon name="card" size={20} color="var(--color-accent)" />
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 14.5,
                fontWeight: 700,
                color: 'var(--color-text)',
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {p.userName}
            </p>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--color-text-ter)',
                margin: '2px 0 0',
              }}
            >
              {typeLabel(p)} · {methodLabel(p.method)} · {formatDate(p.createdAt)}
            </p>
          </div>

          {/* Coluna direita */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--color-text)',
                textDecoration: p.status === 'REFUNDED' ? 'line-through' : 'none',
              }}
            >
              {formatBRL(p.amount)}
            </span>
            <StatusPill status={p.status} />
          </div>
        </div>

        {/* Botão estornar (apenas PAID) */}
        {p.status === 'PAID' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowDialog(true)
            }}
            style={{
              width: '100%',
              background: 'var(--color-surface-2)',
              border: 'none',
              borderRadius: 11,
              padding: '9px 0',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--color-text-sec)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginTop: 12,
            }}
          >
            <Icon name="refresh" size={15} color="var(--color-text-sec)" />
            Estornar pagamento
          </button>
        )}
      </div>

      {/* Dialog de confirmação */}
      {showDialog && (
        <RefundDialog
          amount={p.amount}
          formatBRL={formatBRL}
          isRefunding={isRefunding}
          error={refundError}
          onConfirm={() => void handleRefund()}
          onCancel={() => {
            setShowDialog(false)
            setRefundError(null)
          }}
        />
      )}
    </>
  )
}

// ------------------------------------------------------------------ StatusPill
interface StatusPillProps {
  status: PaymentStatus
}

function StatusPill({ status }: StatusPillProps) {
  const config: Record<PaymentStatus, { bg: string; color: string; label: string }> = {
    PAID: { bg: 'rgba(34,197,94,0.12)', color: 'var(--color-good)', label: 'Pago' },
    PENDING: { bg: 'rgba(227,172,63,0.14)', color: 'var(--color-accent)', label: 'Pendente' },
    FAILED: { bg: 'var(--color-surface-2)', color: 'var(--color-text-ter)', label: 'Falhou' },
    REFUNDED: { bg: 'var(--color-surface-2)', color: 'var(--color-text-ter)', label: 'Estornado' },
  }
  const c = config[status]
  return (
    <span
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 11,
        fontWeight: 700,
        background: c.bg,
        color: c.color,
        borderRadius: 99,
        padding: '2px 8px',
        lineHeight: 1.4,
      }}
    >
      {c.label}
    </span>
  )
}

// ------------------------------------------------------------------ RefundDialog
interface RefundDialogProps {
  amount: number
  formatBRL: (v: number) => string
  isRefunding: boolean
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}

function RefundDialog({ amount, formatBRL, isRefunding, error, onConfirm, onCancel }: RefundDialogProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0 0 calc(20px + env(safe-area-inset-bottom))',
      }}
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          borderRadius: '20px 20px 0 0',
          padding: '24px 20px 20px',
          width: '100%',
          maxWidth: 480,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--color-text)',
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          Estornar {formatBRL(amount)}?
        </h3>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            color: 'var(--color-text-sec)',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Esta ação não pode ser desfeita. Os créditos correspondentes serão removidos do saldo do cliente.
        </p>

        {error && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-accent)',
              margin: 0,
            }}
          >
            {error}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isRefunding}
            style={{
              width: '100%',
              minHeight: 50,
              background: 'var(--color-espresso)',
              color: '#FAF5EC',
              border: 'none',
              borderRadius: 14,
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              fontWeight: 700,
              cursor: isRefunding ? 'default' : 'pointer',
              opacity: isRefunding ? 0.6 : 1,
            }}
          >
            {isRefunding ? 'Estornando...' : 'Confirmar estorno'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isRefunding}
            style={{
              width: '100%',
              minHeight: 44,
              background: 'transparent',
              color: 'var(--color-text-sec)',
              border: '1px solid var(--color-border)',
              borderRadius: 14,
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              fontWeight: 700,
              cursor: isRefunding ? 'default' : 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
