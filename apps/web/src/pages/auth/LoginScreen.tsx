import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { OtpInput } from '../../components/auth/OtpInput'
import { ResendTimer } from '../../components/auth/ResendTimer'
import { Icon } from '../../components/brand/Icon'
import { apiFetch } from '../../lib/apiFetch'

type Step = 'phone-entry' | 'otp'
type InputMode = 'phone' | 'email'

/**
 * LoginScreen — 2-step OTP login
 *
 * Step 1: phone or email entry → POST /auth/otp/send → advances to step 2
 * Step 2: OTP 4-digit entry → POST /auth/otp/verify → auth.login() → role-based redirect
 *
 * Design tokens: matches screens-onboarding.jsx LoginScreen with high fidelity (AUTH-04/05/08, UI-06)
 */
export function LoginScreen() {
  const auth = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('phone-entry')
  const [inputMode, setInputMode] = useState<InputMode>('phone')
  const [inputValue, setInputValue] = useState('')
  const [userId, setUserId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ──────────────── Step 1: Send OTP ────────────────

  const sendOtp = async () => {
    if (!inputValue.trim()) return
    setIsLoading(true)
    setError(null)
    try {
      const body =
        inputMode === 'phone'
          ? { phone: inputValue.trim() }
          : { email: inputValue.trim() }

      const res = await apiFetch('/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const data = (await res.json()) as { userId?: string; message?: string }
        setUserId(data.userId ?? '')
        setStep('otp')
      } else {
        const err = (await res.json()) as { error?: string }
        setError(err.error ?? 'Algo deu errado. Verifique sua conexão e tente novamente.')
      }
    } catch {
      setError('Algo deu errado. Verifique sua conexão e tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  // ──────────────── Step 2: Verify OTP ────────────────

  const verifyOtp = async (code: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const deviceId = (() => {
        try {
          return localStorage.getItem('device_id') ?? ''
        } catch {
          return ''
        }
      })()

      const res = await apiFetch('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ userId, code, deviceId }),
      })

      if (res.ok) {
        const data = (await res.json()) as {
          token: string
          user: { id: string; role: string; name: string }
        }
        auth.login(data.token, {
          id: data.user.id,
          role: data.user.role as 'CLIENT' | 'COURIER' | 'ADMIN',
          name: data.user.name,
        })
        // Role-based redirect (AUTH-08: admin → /admin)
        const roleRoutes: Record<string, string> = {
          ADMIN: '/admin',
          CLIENT: '/client',
          COURIER: '/courier',
        }
        navigate(roleRoutes[data.user.role] ?? '/client')
      } else if (res.status === 401) {
        const err = (await res.json()) as { error?: string }
        const errMsg = err.error ?? ''
        if (errMsg.toLowerCase().includes('expired')) {
          setError('Código expirado. Solicite um novo.')
        } else {
          setError('Código incorreto. Verifique e tente de novo.')
        }
      } else {
        setError('Algo deu errado. Verifique sua conexão e tente novamente.')
      }
    } catch {
      setError('Algo deu errado. Verifique sua conexão e tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  // ──────────────── Shared back button ────────────────

  const handleBack = () => {
    if (step === 'otp') {
      setStep('phone-entry')
      setError(null)
    } else {
      navigate('/')
    }
  }

  // ──────────────── Render ────────────────

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '8px 24px 24px',
        minHeight: '100dvh',
        backgroundColor: 'var(--color-app-bg)',
      }}
    >
      {/* Back button — 44px touch target wrapping 38px visual */}
      <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button
          onClick={handleBack}
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
      </div>

      {/* Content area — centered vertically */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {step === 'phone-entry' ? (
          <StepPhoneEntry
            inputMode={inputMode}
            inputValue={inputValue}
            isLoading={isLoading}
            error={error}
            onInputChange={(v) => {
              setInputValue(v)
              setError(null)
            }}
            onToggleMode={() => {
              setInputMode((m) => (m === 'phone' ? 'email' : 'phone'))
              setInputValue('')
              setError(null)
            }}
            onSubmit={sendOtp}
          />
        ) : (
          <StepOtp
            inputValue={inputValue}
            isLoading={isLoading}
            error={error}
            onComplete={verifyOtp}
            onResend={sendOtp}
          />
        )}
      </div>
    </div>
  )
}

// ──────────────── Sub-components ────────────────

interface StepPhoneEntryProps {
  inputMode: InputMode
  inputValue: string
  isLoading: boolean
  error: string | null
  onInputChange: (value: string) => void
  onToggleMode: () => void
  onSubmit: () => void
}

function StepPhoneEntry({
  inputMode,
  inputValue,
  isLoading,
  error,
  onInputChange,
  onToggleMode,
  onSubmit,
}: StepPhoneEntryProps) {
  const isPhone = inputMode === 'phone'
  const [focused, setFocused] = useState(false)

  const bodyText = isPhone
    ? 'Enviamos um código por SMS para confirmar seu número. Sem senha pra decorar.'
    : 'Enviamos um código por e-mail para confirmar seu endereço. Sem senha pra decorar.'

  return (
    <div>
      {/* Heading */}
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 28,
          letterSpacing: '-0.03em',
          color: 'var(--color-text)',
          lineHeight: 1.1,
          margin: 0,
          whiteSpace: 'pre-line',
        }}
      >
        {'Bom dia.\nVamos te identificar.'}
      </h1>

      {/* Body */}
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          fontWeight: 400,
          color: 'var(--color-text-sec)',
          marginTop: 12,
          marginBottom: 24,
          lineHeight: 1.5,
        }}
      >
        {bodyText}
      </p>

      {/* Input field */}
      <div style={{ position: 'relative' }}>
        <input
          type={isPhone ? 'tel' : 'email'}
          inputMode={isPhone ? 'tel' : 'email'}
          autoComplete={isPhone ? 'tel' : 'email'}
          placeholder={isPhone ? '+55 (11) 99999-9999' : 'seu@email.com'}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '12px 16px',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 400,
            color: 'var(--color-text)',
            background: 'var(--color-surface-alt)',
            border: `1.5px solid ${focused ? 'var(--color-accent)' : 'var(--color-border)'}`,
            borderRadius: 'var(--radius-field)',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s ease',
          }}
        />
      </div>

      {/* Error message */}
      {error && <ErrorMessage>{error}</ErrorMessage>}

      {/* Spacer */}
      <div style={{ height: 16 }} />

      {/* CTA button */}
      <PrimaryButton
        onClick={onSubmit}
        disabled={!inputValue.trim() || isLoading}
        loading={isLoading}
      >
        Enviar código
      </PrimaryButton>

      {/* Toggle input mode link */}
      <div
        style={{
          textAlign: 'center',
          marginTop: 16,
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          fontWeight: 400,
          color: 'var(--color-text-ter)',
        }}
      >
        ou entre com{' '}
        <button
          onClick={onToggleMode}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--color-accent)',
            cursor: 'pointer',
          }}
        >
          {isPhone ? 'e-mail' : 'telefone'}
        </button>
      </div>
    </div>
  )
}

interface StepOtpProps {
  inputValue: string
  isLoading: boolean
  error: string | null
  onComplete: (code: string) => void
  onResend: () => void
}

function StepOtp({ inputValue, isLoading, error, onComplete, onResend }: StepOtpProps) {
  return (
    <div>
      {/* Heading */}
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 28,
          letterSpacing: '-0.03em',
          color: 'var(--color-text)',
          lineHeight: 1.1,
          margin: 0,
        }}
      >
        Digite o código
      </h1>

      {/* Body */}
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          fontWeight: 400,
          color: 'var(--color-text-sec)',
          marginTop: 12,
          marginBottom: 28,
          lineHeight: 1.5,
        }}
      >
        Mandamos 4 dígitos para{' '}
        <strong style={{ fontWeight: 700, color: 'var(--color-text)' }}>{inputValue}</strong>.
      </p>

      {/* OTP input */}
      <OtpInput onComplete={onComplete} disabled={isLoading} />

      {/* Error message */}
      {error && <ErrorMessage>{error}</ErrorMessage>}

      {/* Spacer */}
      <div style={{ height: 24 }} />

      {/* Resend timer */}
      <ResendTimer onResend={onResend} />
    </div>
  )
}

// ──────────────── Primitive components ────────────────

interface PrimaryButtonProps {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  children: React.ReactNode
}

function PrimaryButton({ onClick, disabled = false, loading = false, children }: PrimaryButtonProps) {
  const [hovered, setHovered] = useState(false)
  const isDisabled = disabled || loading

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
        padding: '16px 24px',
        border: 'none',
        cursor: isDisabled ? 'default' : 'pointer',
        opacity: isDisabled ? 0.45 : 1,
        transition: 'transform 0.15s, filter 0.15s, opacity 0.15s',
        transform: hovered && !isDisabled ? 'translateY(-1px)' : 'translateY(0)',
        filter: hovered && !isDisabled ? 'brightness(1.05)' : 'none',
        boxSizing: 'border-box',
      }}
    >
      {loading ? 'Carregando...' : children}
    </button>
  )
}

interface ErrorMessageProps {
  children: React.ReactNode
}

function ErrorMessage({ children }: ErrorMessageProps) {
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
