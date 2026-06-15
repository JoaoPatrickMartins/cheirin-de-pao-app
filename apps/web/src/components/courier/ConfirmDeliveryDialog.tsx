import { useState } from 'react'
import { apiFetch } from '../../lib/apiFetch'
import { Stop } from './StopRow'

interface ConfirmDeliveryDialogProps {
  stop: Stop | null
  isOpen: boolean
  onClose: () => void
  onConfirmed: (orderId: string) => void
}

export function ConfirmDeliveryDialog({
  stop,
  isOpen,
  onClose,
  onConfirmed,
}: ConfirmDeliveryDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !stop) return null

  const handleConfirm = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/courier/orders/${stop.orderId}/confirm`, { method: 'PATCH' })
      if (res.ok) {
        onConfirmed(stop.orderId)
      } else {
        setError('Falha na conexão. Tente novamente.')
      }
    } catch {
      setError('Falha na conexão. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackdropClick = () => {
    if (!isLoading) onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={handleBackdropClick}
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
        style={{
          background: 'var(--color-surface)',
          borderRadius: 22,
          padding: 24,
          width: '100%',
          maxWidth: 320,
        }}
      >
        {/* Título */}
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--color-text)',
            margin: '0 0 8px',
          }}
        >
          Confirmar entrega?
        </h2>

        {/* Corpo */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--color-text-sec)',
            margin: '0 0 20px',
          }}
        >
          {stop.quantity === 1 ? '1 pão' : `${stop.quantity} pães`} para {stop.clientName} ·
          Apartamento {stop.apartment}
        </p>

        {/* Botão cancelar */}
        <button
          onClick={onClose}
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
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.5 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          Cancelar
        </button>

        {/* Botão confirmar */}
        <button
          onClick={handleConfirm}
          disabled={isLoading}
          style={{
            width: '100%',
            minHeight: 44,
            background: 'var(--color-espresso)',
            color: 'var(--color-primary-btn-text)',
            borderRadius: 'var(--radius-btn)',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 700,
            border: 'none',
            cursor: isLoading ? 'wait' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
            marginTop: 8,
            transition: 'opacity 0.15s',
          }}
        >
          {isLoading ? 'Confirmando...' : 'Confirmar entrega'}
        </button>

        {/* Erro inline */}
        {error !== null && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              color: 'var(--color-destructive)',
              margin: '8px 0 0',
              textAlign: 'center',
            }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
