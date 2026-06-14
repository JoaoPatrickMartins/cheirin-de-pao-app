import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { CardPayment } from '@mercadopago/sdk-react'
import { apiFetch } from '../../lib/apiFetch'

interface CardState {
  comboId?: string
  customQuantity?: number
  amount: number
}

export function CardPaymentScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state as CardState | null) ?? { amount: 0 }
  const { comboId, customQuantity, amount } = state

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (formData: Record<string, unknown>) => {
    setError(null)
    try {
      const res = await apiFetch('/payments/card', {
        method: 'POST',
        body: JSON.stringify({
          token: formData.token,
          installments: formData.installments,
          issuerId: formData.issuer_id,
          comboId,
          customQuantity,
        }),
      })

      if (res.ok) {
        // fire-and-forget: salvar token para compra recorrente (D-06)
        apiFetch('/users/me/card-token', {
          method: 'PUT',
          body: JSON.stringify({ token: formData.token }),
        }).catch(() => {})

        const comboQty = customQuantity ?? 1
        navigate('/client/creditos/sucesso', { state: { quantity: comboQty } })
      } else {
        const err = (await res.json()) as { error?: string }
        setError(err.error ?? 'Erro no pagamento. Tente novamente.')
      }
    } catch {
      setError('Algo deu errado. Verifique sua conexão e tente novamente.')
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
        gap: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => navigate('/client/creditos')}
          style={{
            minHeight: 44,
            width: 44,
            borderRadius: 'var(--radius-btn)',
            border: '1.5px solid var(--color-border)',
            background: 'var(--color-surface)',
            cursor: 'pointer',
            fontSize: 18,
          }}
        >
          ←
        </button>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 21,
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          Pagamento com cartão
        </h1>
      </div>

      <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: 0 }}>
        Pagamento processado com segurança pelo Mercado Pago
      </p>

      {isLoading && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text-sec)' }}>
          Carregando formulário de pagamento...
        </p>
      )}

      {error && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-accent)' }}>
          {error}
        </p>
      )}

      <div style={{ borderRadius: 16, overflow: 'hidden', maxWidth: 390 }}>
        <CardPayment
          initialization={{ amount }}
          onSubmit={handleSubmit as unknown as Parameters<typeof CardPayment>[0]['onSubmit']}
          onError={(err) => setError((err as { message?: string })?.message ?? 'Erro no pagamento.')}
          onReady={() => setIsLoading(false)}
        />
      </div>
    </div>
  )
}
