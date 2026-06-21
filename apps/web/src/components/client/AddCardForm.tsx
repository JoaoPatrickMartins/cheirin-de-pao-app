import { useState, useEffect } from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import type { Appearance } from '@stripe/stripe-js'
import { stripePromise } from '../../lib/stripe'
import { apiFetch } from '../../lib/apiFetch'

interface AddCardFormProps {
  submitLabel: string
  /** Chamado com o PaymentMethod salvo (pm_...). Retorna mensagem de erro, ou null em sucesso. */
  onSubmit: (paymentMethodId: string) => Promise<string | null>
  note?: string
}

const appearance: Appearance = {
  theme: 'flat',
  variables: {
    colorPrimary: '#C2410C',
    colorText: '#241608',
    colorBackground: '#FFFFFF',
    fontFamily: 'Hanken Grotesk, system-ui, sans-serif',
    borderRadius: '12px',
    fontSizeBase: '15px',
  },
}

/**
 * Cadastro de cartão via Stripe Elements (SAQ-A: o cartão é coletado no iframe do Stripe,
 * o PAN nunca toca nosso backend). Fluxo:
 *  1. pede um SetupIntent ao backend (clientSecret)
 *  2. monta o PaymentElement dentro de <Elements>
 *  3. confirmSetup salva o cartão no Customer (usage off_session) e devolve o pm_...
 *  4. onSubmit(pm) persiste o SavedCard (ou paga, conforme o chamador)
 */
export function AddCardForm({ submitLabel, onSubmit, note }: AddCardFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [initError, setInitError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      try {
        const res = await apiFetch('/users/me/cards/setup-intent', { method: 'POST' })
        const data = (await res.json()) as { clientSecret?: string; error?: string }
        if (cancelled) return
        if (res.ok && data.clientSecret) setClientSecret(data.clientSecret)
        else setInitError(data.error ?? 'Não foi possível iniciar o cadastro do cartão.')
      } catch {
        if (!cancelled) setInitError('Não foi possível iniciar o cadastro do cartão.')
      }
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [])

  if (initError) {
    return <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#C0392B' }}>{initError}</p>
  }
  if (!clientSecret) {
    return (
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text-ter)' }}>
        Carregando formulário seguro…
      </p>
    )
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance, locale: 'pt-BR' }}>
      <CardFormInner submitLabel={submitLabel} onSubmit={onSubmit} note={note} />
    </Elements>
  )
}

function CardFormInner({ submitLabel, onSubmit, note }: AddCardFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [saving, setSaving] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!stripe || !elements || saving) return
    setSaving(true)
    setError(null)

    const { error: confirmErr, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
    })

    if (confirmErr) {
      setError(confirmErr.message ?? 'Confira os dados do cartão e tente novamente.')
      setSaving(false)
      return
    }

    const pm = setupIntent?.payment_method
    const paymentMethodId = typeof pm === 'string' ? pm : pm?.id
    if (!paymentMethodId) {
      setError('Não foi possível salvar o cartão. Tente novamente.')
      setSaving(false)
      return
    }

    const msg = await onSubmit(paymentMethodId)
    if (msg) setError(msg)
    setSaving(false)
  }

  return (
    <div>
      {note && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '0 0 16px' }}>
          {note}
        </p>
      )}

      <PaymentElement onReady={() => setReady(true)} options={{ layout: 'tabs' }} />

      {error && (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#C0392B', margin: '16px 0 0' }}>{error}</p>
      )}

      <div style={{ height: 20 }} />
      <button
        onClick={() => void handleSubmit()}
        disabled={saving || !ready || !stripe}
        style={{
          width: '100%',
          height: 52,
          background: 'var(--color-espresso)',
          color: 'var(--color-primary-btn-text)',
          borderRadius: 'var(--radius-btn)',
          border: 'none',
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          fontWeight: 600,
          cursor: saving || !ready ? 'not-allowed' : 'pointer',
          opacity: saving || !ready ? 0.6 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        {saving ? 'Processando…' : ready ? submitLabel : 'Carregando…'}
      </button>
    </div>
  )
}
