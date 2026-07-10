import { useState, useEffect } from 'react'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../brand/Icon'

// ------------------------------------------------------------------ tipos
type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'
type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD'

interface PaymentDetail {
  id: string
  userName: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  mercadoPagoId?: string | null
  comboId?: string | null
  customQuantity?: number | null
  createdAt: string
}

interface PaymentDetailSheetProps {
  paymentId: string
  onBack: () => void
  onRefundSuccess: () => void
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
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))
}

function methodLabel(method: PaymentMethod): string {
  if (method === 'PIX') return 'Pix'
  if (method === 'CREDIT_CARD') return 'Cartão de crédito'
  return 'Cartão de débito'
}

// ------------------------------------------------------------------ componente
export function PaymentDetailSheet({ paymentId, onBack, onRefundSuccess }: PaymentDetailSheetProps) {
  const [payment, setPayment] = useState<PaymentDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [isRefunding, setIsRefunding] = useState(false)
  const [refundError, setRefundError] = useState<string | null>(null)
  const [refunded, setRefunded] = useState(false)

  useEffect(() => {
    const fetchPayment = async () => {
      try {
        const res = await apiFetch(`/admin/payments/${paymentId}`)
        if (res.ok) {
          setPayment((await res.json()) as PaymentDetail)
        }
      } catch {
        // falha silenciosa
      } finally {
        setIsLoading(false)
      }
    }
    void fetchPayment()
  }, [paymentId])

  const handleRefund = async () => {
    setIsRefunding(true)
    setRefundError(null)
    try {
      const res = await apiFetch(`/admin/payments/${paymentId}/refund`, { method: 'POST' })
      if (res.ok) {
        setRefunded(true)
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

  const isPaid = payment?.status === 'PAID' && !refunded

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
          }}
        >
          Pagamento
        </h2>
      </div>

      <div style={{ overflow: 'auto', flex: 1, padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {isLoading ? (
          <div style={{ paddingTop: 32, textAlign: 'center' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
              Carregando...
            </span>
          </div>
        ) : payment ? (
          <>
            {/* Card de dados */}
            <div
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-2)',
                borderRadius: 18,
                overflow: 'hidden',
              }}
            >
              {[
                { label: 'Cliente', value: payment.userName },
                { label: 'Valor', value: formatBRL(payment.amount) },
                { label: 'Método', value: methodLabel(payment.method) },
                { label: 'Data', value: formatDate(payment.createdAt) },
                ...(payment.mercadoPagoId ? [{ label: 'ID Mercado Pago', value: payment.mercadoPagoId }] : []),
                ...(payment.customQuantity ? [{ label: 'Qtd. avulso', value: `${payment.customQuantity} pães` }] : []),
              ].map((row, i, arr) => (
                <div
                  key={row.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '13px 16px',
                    borderBottom: i < arr.length - 1 ? '1px solid var(--color-border-2)' : 'none',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--color-text-sec)',
                    }}
                  >
                    {row.label}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: 'var(--color-text)',
                    }}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Botão estornar */}
            {isPaid && (
              <button
                type="button"
                onClick={() => setShowDialog(true)}
                style={{
                  width: '100%',
                  minHeight: 50,
                  background: 'var(--color-surface-2)',
                  border: 'none',
                  borderRadius: 14,
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--color-text-sec)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Icon name="refresh" size={17} color="var(--color-text-sec)" />
                Estornar pagamento
              </button>
            )}
          </>
        ) : (
          <div style={{ paddingTop: 32, textAlign: 'center' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
              Falha na conexão. Tente novamente.
            </span>
          </div>
        )}
      </div>

      {/* Dialog */}
      {showDialog && payment && (
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
          onClick={() => setShowDialog(false)}
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
              Estornar {formatBRL(payment.amount)}?
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
            {refundError && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--color-accent)', margin: 0 }}>
                {refundError}
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={() => void handleRefund()}
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
                onClick={() => setShowDialog(false)}
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
      )}
    </div>
  )
}
