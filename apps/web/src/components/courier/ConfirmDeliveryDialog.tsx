import { useState } from 'react'
import { apiFetch } from '../../lib/apiFetch'
import { Stop } from './StopRow'

interface ConfirmDeliveryDialogProps {
  stop: Stop | null
  isOpen: boolean
  onClose: () => void
  onConfirmed: (orderId: string) => void
  onNotDelivered: (orderId: string) => void
}

export function ConfirmDeliveryDialog({
  stop,
  isOpen,
  onClose,
  onConfirmed,
  onNotDelivered,
}: ConfirmDeliveryDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'menu' | 'fail'>('menu')
  const [reason, setReason] = useState('')

  if (!isOpen || !stop) return null

  const reset = () => {
    setMode('menu')
    setReason('')
    setError(null)
  }

  const handleConfirm = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/courier/orders/${stop.orderId}/confirm`, { method: 'PATCH' })
      if (res.ok) {
        reset()
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

  const handleNotDelivered = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/courier/orders/${stop.orderId}/not-delivered`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      })
      if (res.ok) {
        reset()
        onNotDelivered(stop.orderId)
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
    if (!isLoading) {
      reset()
      onClose()
    }
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
        style={{ background: 'var(--color-surface)', borderRadius: 22, padding: 24, width: '100%', maxWidth: 320 }}
      >
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>
          {mode === 'menu' ? 'Confirmar entrega?' : 'Não foi entregue'}
        </h2>

        <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700, color: 'var(--color-text-sec)', margin: '0 0 20px' }}>
          {stop.quantity === 1 ? '1 pão' : `${stop.quantity} pães`} para {stop.clientName} · Apartamento {stop.apartment}
        </p>

        {mode === 'menu' ? (
          <>
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
              }}
            >
              {isLoading ? 'Confirmando...' : 'Confirmar entrega'}
            </button>
            <button
              onClick={() => setMode('fail')}
              disabled={isLoading}
              style={{
                width: '100%',
                minHeight: 44,
                background: 'transparent',
                color: 'var(--color-bad, #C2410C)',
                borderRadius: 'var(--radius-btn)',
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                fontWeight: 700,
                border: '1.5px solid var(--color-bad, #C2410C)',
                cursor: 'pointer',
                marginTop: 8,
              }}
            >
              Não consegui entregar
            </button>
            <button
              onClick={() => {
                reset()
                onClose()
              }}
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
              Cancelar
            </button>
          </>
        ) : (
          <>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo (cliente ausente, portão fechado, endereço...)"
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
            <button
              onClick={handleNotDelivered}
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
              {isLoading ? 'Salvando...' : 'Confirmar não entrega'}
            </button>
            <button
              onClick={() => setMode('menu')}
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
              Voltar
            </button>
          </>
        )}

        {error !== null && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-destructive)', margin: '8px 0 0', textAlign: 'center' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
