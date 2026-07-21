import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { usePaymentPolling } from '../../hooks/usePaymentPolling'
import { finalizePendingOrder, type PendingOrder } from '../../lib/finalizePendingOrder'

interface PixState {
  paymentId: string
  pixQrCodeUrl: string
  pixCopyPaste: string
  comboQuantity: number
  /** Quando presente, o pagamento cobre a diferença de um Pedido único:
   *  ao aprovar, o pedido é criado automaticamente. */
  pendingOrder?: PendingOrder
  /** Quando true, o pagamento é de um gancho adicional — ao aprovar não credita pães
   *  nem agenda pedido; segue para a tela de sucesso do gancho. */
  hookPurpose?: boolean
}

export function PixWaitingScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const { updateCreditBalance } = useAuth()

  const state = location.state as PixState | null

  if (!state?.paymentId) {
    navigate('/client/creditos', { replace: true })
    return null
  }

  const { paymentId, pixQrCodeUrl, pixCopyPaste, comboQuantity, pendingOrder, hookPurpose } = state
  return (
    <PixWaitingContent
      paymentId={paymentId}
      pixQrCodeUrl={pixQrCodeUrl}
      pixCopyPaste={pixCopyPaste}
      comboQuantity={comboQuantity}
      pendingOrder={pendingOrder}
      hookPurpose={hookPurpose}
      onCreditUpdate={updateCreditBalance}
      onNavigate={navigate}
    />
  )
}

interface ContentProps {
  paymentId: string
  pixQrCodeUrl: string
  pixCopyPaste: string
  comboQuantity: number
  pendingOrder?: PendingOrder
  hookPurpose?: boolean
  onCreditUpdate: (balance: number) => void
  onNavigate: ReturnType<typeof useNavigate>
}

function PixWaitingContent({
  paymentId,
  pixQrCodeUrl,
  pixCopyPaste,
  comboQuantity,
  pendingOrder,
  hookPurpose,
  onCreditUpdate,
  onNavigate,
}: ContentProps) {
  const [copied, setCopied] = useState(false)
  const [isApproved, setIsApproved] = useState(false)
  const [isRejected, setIsRejected] = useState(false)
  const [finalizeError, setFinalizeError] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)

  // Cria o pedido único após o Pix (idempotente por paymentId). O servidor também cria a Order
  // na aprovação do Pix, então esta é uma segunda via: se a 1ª tentativa falhar (rede/corrida),
  // espera um instante e tenta de novo antes de mostrar erro. Retentar NUNCA duplica o pedido.
  const runFinalize = async (): Promise<boolean> => {
    if (!pendingOrder) return false
    const order = pendingOrder
    setFinalizeError(null)
    let result = await finalizePendingOrder(order, paymentId)
    if (!result.ok) {
      await new Promise((r) => setTimeout(r, 1500))
      result = await finalizePendingOrder(order, paymentId)
    }
    if (result.ok) {
      if (result.creditBalance !== undefined) onCreditUpdate(result.creditBalance)
      onNavigate('/client/creditos/sucesso', {
        state: {
          kind: 'order',
          quantity: order.quantity,
          scheduledDate: order.scheduledDate,
          deliveryTime: order.deliveryTime,
        },
      })
      return true
    }
    setFinalizeError(result.message ?? 'Não foi possível agendar o pedido.')
    return false
  }

  const handleApproved = async (creditBalance: number) => {
    setIsApproved(true)

    // Gancho adicional: não credita pães nem agenda — segue para a tela de sucesso do gancho.
    if (hookPurpose) {
      onNavigate('/client/creditos/sucesso', { state: { kind: 'hook' } })
      return
    }

    onCreditUpdate(creditBalance)

    // Pedido único: cria a entrega agora que a diferença foi creditada.
    if (pendingOrder) {
      await runFinalize()
      return
    }

    onNavigate('/client/creditos/sucesso', { state: { quantity: comboQuantity } })
  }

  const handleRejected = () => {
    setIsRejected(true)
  }

  // Pix pode levar mais tempo (abrir o app do banco e pagar) → janela de ~2 min.
  const { isTimeout } = usePaymentPolling(
    isApproved || isRejected ? null : paymentId,
    handleApproved,
    handleRejected,
    { maxAttempts: 40, intervalMs: 3000 },
  )

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pixCopyPaste)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <div
      style={{
        minHeight: 'calc(100dvh - 56px - env(safe-area-inset-bottom))',
        background: 'var(--color-app-bg)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
      }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 21,
          color: 'var(--color-text)',
          letterSpacing: '-0.02em',
          margin: 0,
          alignSelf: 'flex-start',
        }}
      >
        Pix
      </h1>

      {/* QR Code (URL PNG do Stripe) */}
      <img
        src={pixQrCodeUrl}
        width={200}
        height={200}
        style={{ borderRadius: 12 }}
        alt="QR Code PIX"
      />

      {/* Código copia-e-cola */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p
          style={{
            fontFamily: 'monospace',
            fontSize: 12,
            wordBreak: 'break-all',
            background: 'var(--color-surface-2)',
            borderRadius: 10,
            padding: 12,
            margin: 0,
            color: 'var(--color-text-sec)',
          } as React.CSSProperties}
        >
          {pixCopyPaste}
        </p>
        <button
          onClick={handleCopy}
          style={{
            width: '100%',
            minHeight: 44,
            borderRadius: 'var(--radius-btn)',
            border: '1.5px solid var(--color-border)',
            background: copied ? 'var(--color-good-soft)' : 'var(--color-surface)',
            color: copied ? 'var(--color-good)' : 'var(--color-text)',
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            transition: 'all .15s',
          }}
        >
          {copied ? 'Copiado!' : 'Copiar código'}
        </button>
      </div>

      {/* Status area */}
      {finalizeError ? (
        <div
          style={{
            width: '100%',
            background: 'var(--color-gold-soft)',
            border: '1.5px solid var(--color-gold)',
            borderRadius: 16,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text)', margin: 0 }}>
            {finalizeError}
          </p>
          <button
            onClick={async () => {
              setIsRetrying(true)
              await runFinalize()
              setIsRetrying(false)
            }}
            disabled={isRetrying}
            style={{
              minHeight: 44,
              padding: '10px 20px',
              borderRadius: 'var(--radius-btn)',
              border: 'none',
              background: 'var(--color-espresso)',
              color: '#FAF5EC',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: 14,
              cursor: isRetrying ? 'default' : 'pointer',
              opacity: isRetrying ? 0.6 : 1,
              alignSelf: 'flex-start',
            }}
          >
            {isRetrying ? 'Agendando...' : 'Tentar agendar'}
          </button>
        </div>
      ) : isRejected ? (
        <div
          style={{
            width: '100%',
            background: 'var(--color-surface-2)',
            border: '1.5px solid var(--color-border)',
            borderRadius: 16,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--color-text)', margin: 0, textAlign: 'center' }}>
            Pagamento não aprovado. Isso pode ter sido um erro temporário do banco. Tente novamente.
          </p>
          <button
            onClick={() => onNavigate('/client/creditos')}
            style={{
              minHeight: 44,
              padding: '10px 24px',
              borderRadius: 'var(--radius-btn)',
              border: 'none',
              background: 'var(--color-espresso)',
              color: 'var(--color-primary-btn-text)',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
        </div>
      ) : isTimeout ? (
        <div
          style={{
            width: '100%',
            background: 'var(--color-gold-soft)',
            border: '1.5px solid var(--color-gold)',
            borderRadius: 16,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text)', margin: 0 }}>
            Não detectamos o pagamento ainda. Verifique o app do banco e tente novamente.
          </p>
          <button
            onClick={() => onNavigate('/client/home')}
            style={{
              minHeight: 44,
              padding: '10px 20px',
              borderRadius: 'var(--radius-btn)',
              border: 'none',
              background: 'var(--color-espresso)',
              color: '#FAF5EC',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            Verificar mais tarde
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              border: '3px solid var(--color-gold-soft)',
              borderTopColor: 'var(--color-gold)',
              borderRadius: '50%',
              animation: 'spin 800ms linear infinite',
            }}
          />
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--color-text-sec)',
              margin: 0,
            }}
          >
            Aguardando pagamento...
          </p>
        </div>
      )}
    </div>
  )
}
