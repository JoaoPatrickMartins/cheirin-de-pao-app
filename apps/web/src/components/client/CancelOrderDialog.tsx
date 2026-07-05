import { useState } from 'react'
import { apiFetch } from '../../lib/apiFetch'

interface CancelResult {
  id: string
  status: 'CANCELLED'
  refundedCredits: number
  creditBalance: number
}

interface CancelOrderDialogProps {
  orderId: string | null
  quantity: number
  isOpen: boolean
  onClose: () => void
  /** Chamado após o cancelamento ser confirmado pelo servidor. */
  onCancelled: (result: CancelResult) => void
}

/**
 * CancelOrderDialog — confirmação de cancelamento de pedido único pelo cliente.
 *
 * Modelado em ConfirmDeliveryDialog (modal com backdrop, estados isLoading/error).
 * No sucesso, os pães voltam ao saldo (estorno idempotente no backend). Se o corte já
 * tiver passado (422), a mensagem do servidor é exibida — o cancelamento não é mais possível.
 */
export function CancelOrderDialog({
  orderId,
  quantity,
  isOpen,
  onClose,
  onCancelled,
}: CancelOrderDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !orderId) return null

  const paesLabel = quantity === 1 ? '1 pão' : `${quantity} pães`

  const close = () => {
    if (isLoading) return
    setError(null)
    onClose()
  }

  const handleConfirm = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/orders/${orderId}/cancel`, { method: 'PATCH' })
      if (res.ok) {
        const result = (await res.json()) as CancelResult
        setError(null)
        onCancelled(result)
        return
      }
      // 422 (corte passou / não cancelável), 404 etc. — mostra a mensagem do servidor.
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      setError(data?.error ?? 'Não foi possível cancelar. Tente novamente.')
    } catch {
      setError('Falha na conexão. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--color-surface)', borderRadius: 22, padding: 24, width: '100%', maxWidth: 320 }}
      >
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>
          Cancelar este pedido?
        </h2>

        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600, color: 'var(--color-text-sec)', margin: '0 0 20px' }}>
          Os {paesLabel} deste pedido voltam para o seu saldo e você pode usá-los quando quiser.
        </p>

        <button
          onClick={handleConfirm}
          disabled={isLoading}
          style={{
            width: '100%',
            minHeight: 44,
            background: 'var(--color-bad, #C2410C)',
            color: '#fff',
            borderRadius: 'var(--radius-btn)',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 700,
            border: 'none',
            cursor: isLoading ? 'wait' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          {isLoading ? 'Cancelando...' : 'Cancelar pedido'}
        </button>
        <button
          onClick={close}
          disabled={isLoading}
          style={{
            width: '100%',
            minHeight: 44,
            background: 'transparent',
            color: 'var(--color-text)',
            borderRadius: 'var(--radius-btn)',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 700,
            border: '1.5px solid var(--color-border)',
            cursor: 'pointer',
            marginTop: 8,
          }}
        >
          Manter pedido
        </button>

        {error !== null && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-destructive)', margin: '12px 0 0', textAlign: 'center' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
