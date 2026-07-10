import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { apiFetch } from '../../lib/apiFetch'
import { OtpInput } from '../../components/auth/OtpInput'
import { ResendTimer } from '../../components/auth/ResendTimer'
import { Icon } from '../../components/brand/Icon'

export function ContactEditScreen() {
  const navigate = useNavigate()
  const auth = useAuth()

  const [step, setStep] = useState<0 | 1>(0)
  const [contactValue, setContactValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [otpCode, setOtpCode] = useState('')

  const handleRequestChange = async () => {
    if (!contactValue.trim()) return
    setLoading(true)
    setError(null)
    try {
      const body = { email: contactValue.trim() }
      const res = await apiFetch('/client/profile/contact/request-change', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setStep(1)
      } else if (res.status === 422) {
        setError('Este contato já está associado a outra conta.')
      } else {
        setError('Algo deu errado. Tente novamente.')
      }
    } catch {
      setError('Algo deu errado. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmChange = async (code: string) => {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/client/profile/contact/confirm-change', {
        method: 'POST',
        body: JSON.stringify({ code }),
      })
      if (res.ok) {
        auth.updateUser({ email: contactValue.trim() })
        navigate('/client/perfil')
      } else if (res.status === 401) {
        const data = (await res.json()) as { error?: string }
        const msg = data.error ?? ''
        if (msg.toLowerCase().includes('expirado') || msg.toLowerCase().includes('expir')) {
          setError('Código expirado. Solicite um novo.')
        } else {
          setError('Código incorreto. Verifique e tente de novo.')
        }
      } else {
        setError('Algo deu errado. Tente novamente.')
      }
    } catch {
      setError('Algo deu errado. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpComplete = (code: string) => {
    setOtpCode(code)
    void handleConfirmChange(code)
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--color-app-bg)',
        display: 'flex',
        flexDirection: 'column',
        padding: '8px 24px 24px',
      }}
    >
      {/* AppBar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          paddingTop: 'env(safe-area-inset-top)',
          marginBottom: 32,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          style={{
            background: 'var(--color-surface-2)',
            border: 'none',
            width: 38,
            height: 38,
            borderRadius: 12,
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            color: 'var(--color-text)',
            flexShrink: 0,
          }}
        >
          <Icon name="arrowL" size={20} />
        </button>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 21,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--color-text)',
            margin: 0,
          }}
        >
          Editar contato
        </h1>
      </div>

      {/* Step 1 */}
      <div
        style={{
          display: step === 0 ? 'block' : 'none',
          opacity: step === 0 ? 1 : 0,
          transform: step === 0 ? 'translateY(0)' : 'translateY(-8px)',
          transition: 'opacity 150ms ease-out, transform 150ms ease-out',
        }}
      >
        <StepIndicator current={1} total={2} />
        <h2 style={headingStyle}>Qual é o novo e-mail?</h2>
        <p style={subtitleStyle}>Você receberá um código de verificação por e-mail.</p>

        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="seu@email.com"
          value={contactValue}
          onChange={(e) => { setContactValue(e.target.value); setError(null) }}
          disabled={loading}
          style={{
            width: '100%',
            background: 'var(--color-surface-alt)',
            border: '1.5px solid var(--color-border)',
            borderRadius: 'var(--radius-field)',
            padding: '12px 14px',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            color: 'var(--color-text)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        {error && <ErrorText>{error}</ErrorText>}
        <div style={{ height: 20 }} />

        <ActionButton onClick={handleRequestChange} loading={loading} disabled={!contactValue.trim()}>
          Enviar código
        </ActionButton>
      </div>

      {/* Step 2 */}
      <div
        style={{
          display: step === 1 ? 'block' : 'none',
          opacity: step === 1 ? 1 : 0,
          transform: step === 1 ? 'translateY(0)' : 'translateY(-8px)',
          transition: 'opacity 150ms ease-out, transform 150ms ease-out',
        }}
      >
        <StepIndicator current={2} total={2} />
        <h2 style={headingStyle}>Confirme o código</h2>
        <p style={subtitleStyle}>
          Código enviado para{' '}
          <strong style={{ fontWeight: 700, color: 'var(--color-text)' }}>{contactValue}</strong>.
        </p>

        <OtpInput onComplete={handleOtpComplete} disabled={loading} />

        {error && <ErrorText>{error}</ErrorText>}
        <div style={{ height: 24 }} />

        <ResendTimer onResend={handleRequestChange} />
        <div style={{ height: 16 }} />

        <ActionButton
          onClick={() => { if (otpCode.length >= 4) void handleConfirmChange(otpCode) }}
          loading={loading}
          disabled={otpCode.length < 4}
        >
          Confirmar código
        </ActionButton>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const headingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 28,
  letterSpacing: '-0.03em',
  color: 'var(--color-text)',
  lineHeight: 1.1,
  margin: '0 0 8px',
}

const subtitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  fontWeight: 400,
  color: 'var(--color-text-sec)',
  margin: '0 0 24px',
  lineHeight: 1.5,
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <p
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 12.5,
        fontWeight: 600,
        color: 'var(--color-text-sec)',
        margin: '0 0 8px',
      }}
    >
      Passo {current} de {total}
    </p>
  )
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--color-accent)',
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 1.4,
      }}
    >
      {children}
    </p>
  )
}

interface ActionButtonProps {
  onClick: () => void
  loading?: boolean
  disabled?: boolean
  children: React.ReactNode
}

function ActionButton({ onClick, loading = false, disabled = false, children }: ActionButtonProps) {
  const isDisabled = disabled || loading
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        minHeight: 52,
        backgroundColor: 'var(--color-espresso)',
        color: 'var(--color-primary-btn-text)',
        borderRadius: 'var(--radius-btn)',
        fontFamily: 'var(--font-body)',
        fontSize: 15,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        border: 'none',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.45 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {loading ? 'Carregando...' : children}
    </button>
  )
}
