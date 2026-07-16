import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { OtpInput } from '../../components/auth/OtpInput'
import { OtpVerifying } from '../../components/auth/OtpVerifying'
import { ResendTimer } from '../../components/auth/ResendTimer'
import { Icon } from '../../components/brand/Icon'
import { apiFetch } from '../../lib/apiFetch'
import { roleRoutes } from '../../lib/roleRoutes'
import {
  Heading,
  BodyText,
  TextField,
  PasswordField,
  PrimaryButton,
  LinkButton,
  ErrorMessage,
  readDeviceId,
} from '../../components/auth/AuthUI'

type Step = 'password' | 'otp-email' | 'otp-code'

interface AuthResponse {
  accessToken: string
  refreshToken: string
  hasPassword?: boolean
  user: { id: string; role: string; name: string; creditBalance?: number }
}

/**
 * LoginScreen — login primário por e-mail + senha, com OTP como método alternativo.
 *
 * step 'password'  : e-mail + senha → POST /auth/login → finishAuth
 *                    links: "Entrar com código" (OTP) e "Esqueci minha senha"
 * step 'otp-email' : e-mail → POST /auth/otp/send → step 'otp-code'
 * step 'otp-code'  : código de 4 dígitos → POST /auth/otp/verify → finishAuth
 *
 * Design tokens: alta fidelidade com o handoff (AUTH-04/05/08, UI-06).
 */
export function LoginScreen() {
  const auth = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [userId, setUserId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pós-autenticação comum a login e OTP: guarda sessão e redireciona.
  const finishAuth = (data: AuthResponse) => {
    auth.login(data.accessToken, data.refreshToken, {
      id: data.user.id,
      role: data.user.role as 'CLIENT' | 'COURIER' | 'ADMIN',
      name: data.user.name,
      creditBalance: data.user.creditBalance ?? 0,
      hasPassword: data.hasPassword,
    })

    // 1º acesso sem senha (login por OTP): força a definição de senha antes de entrar.
    if (data.hasPassword === false) {
      navigate('/set-password')
      return
    }

    if (data.user.role === 'CLIENT') {
      apiFetch('/client/profile')
        .then((pr) => {
          if (pr.ok) pr.json().then((profile) => auth.updateUser(profile)).catch(() => {})
        })
        .catch(() => {})
    }
    navigate(roleRoutes[data.user.role] ?? '/client')
  }

  // ──────────────── Login por senha ────────────────

  const login = async () => {
    if (!email.trim() || !password) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password, deviceId: readDeviceId() }),
      })
      if (res.ok) {
        finishAuth((await res.json()) as AuthResponse)
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

  // ──────────────── OTP: enviar ────────────────

  const sendOtp = async () => {
    if (!email.trim()) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      })
      if (res.ok) {
        const data = (await res.json()) as { userId?: string }
        setUserId(data.userId ?? '')
        setStep('otp-code')
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

  // ──────────────── OTP: verificar ────────────────

  const verifyOtp = async (code: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ userId, code, deviceId: readDeviceId() }),
      })
      if (res.ok) {
        finishAuth((await res.json()) as AuthResponse)
      } else if (res.status === 401) {
        const err = (await res.json()) as { error?: string }
        const errMsg = (err.error ?? '').toLowerCase()
        setError(errMsg.includes('expir') ? 'Código expirado. Solicite um novo.' : 'Código incorreto. Verifique e tente de novo.')
      } else {
        setError('Algo deu errado. Verifique sua conexão e tente novamente.')
      }
    } catch {
      setError('Algo deu errado. Verifique sua conexão e tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  // ──────────────── Navegação / back ────────────────

  const handleBack = () => {
    if (step === 'otp-code') {
      setStep('otp-email')
      setError(null)
    } else if (step === 'otp-email') {
      setStep('password')
      setError(null)
    } else {
      navigate('/')
    }
  }

  const goToOtp = () => {
    setStep('otp-email')
    setError(null)
  }

  const backToPassword = () => {
    setStep('password')
    setError(null)
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {step === 'password' && (
          <StepPassword
            email={email}
            password={password}
            isLoading={isLoading}
            error={error}
            onEmailChange={(v) => {
              setEmail(v)
              setError(null)
            }}
            onPasswordChange={(v) => {
              setPassword(v)
              setError(null)
            }}
            onSubmit={login}
            onUseOtp={goToOtp}
            onForgot={() => navigate('/forgot-password')}
          />
        )}

        {step === 'otp-email' && (
          <StepOtpEmail
            email={email}
            isLoading={isLoading}
            error={error}
            onEmailChange={(v) => {
              setEmail(v)
              setError(null)
            }}
            onSubmit={sendOtp}
            onUsePassword={backToPassword}
          />
        )}

        {step === 'otp-code' && (
          <StepOtpCode
            email={email}
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

interface StepPasswordProps {
  email: string
  password: string
  isLoading: boolean
  error: string | null
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: () => void
  onUseOtp: () => void
  onForgot: () => void
}

function StepPassword({
  email,
  password,
  isLoading,
  error,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onUseOtp,
  onForgot,
}: StepPasswordProps) {
  const canSubmit = !!email.trim() && !!password && !isLoading

  return (
    <div>
      <Heading>{'Bom dia.\nBora entrar.'}</Heading>
      <BodyText>Entre com seu e-mail e senha. Prefere não decorar senha? Dá pra entrar com um código no e-mail.</BodyText>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (canSubmit) onSubmit()
        }}
      >
        <TextField
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="seu@email.com"
          value={email}
          onChange={onEmailChange}
          disabled={isLoading}
        />
        <div style={{ height: 12 }} />
        <PasswordField
          autoComplete="current-password"
          placeholder="Sua senha"
          value={password}
          onChange={onPasswordChange}
          disabled={isLoading}
        />

        {error && <ErrorMessage>{error}</ErrorMessage>}

        <div style={{ height: 16 }} />

        <PrimaryButton type="submit" disabled={!canSubmit} loading={isLoading}>
          Entrar
        </PrimaryButton>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20, alignItems: 'center' }}>
        <LinkButton onClick={onForgot}>Esqueci minha senha</LinkButton>
        <LinkButton onClick={onUseOtp}>Entrar com código no e-mail</LinkButton>
      </div>
    </div>
  )
}

interface StepOtpEmailProps {
  email: string
  isLoading: boolean
  error: string | null
  onEmailChange: (value: string) => void
  onSubmit: () => void
  onUsePassword: () => void
}

function StepOtpEmail({ email, isLoading, error, onEmailChange, onSubmit, onUsePassword }: StepOtpEmailProps) {
  const canSubmit = !!email.trim() && !isLoading

  return (
    <div>
      <Heading>{'Entrar com código.'}</Heading>
      <BodyText>Enviamos um código de 4 dígitos por e-mail. Sem senha pra decorar.</BodyText>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (canSubmit) onSubmit()
        }}
      >
        <TextField
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="seu@email.com"
          value={email}
          onChange={onEmailChange}
          disabled={isLoading}
        />

        {error && <ErrorMessage>{error}</ErrorMessage>}

        <div style={{ height: 16 }} />

        <PrimaryButton type="submit" disabled={!canSubmit} loading={isLoading}>
          Enviar código
        </PrimaryButton>
      </form>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
        <LinkButton onClick={onUsePassword}>Entrar com e-mail e senha</LinkButton>
      </div>
    </div>
  )
}

interface StepOtpCodeProps {
  email: string
  isLoading: boolean
  error: string | null
  onComplete: (code: string) => void
  onResend: () => void
}

function StepOtpCode({ email, isLoading, error, onComplete, onResend }: StepOtpCodeProps) {
  return (
    <div>
      <Heading>Digite o código</Heading>
      <BodyText>
        Mandamos 4 dígitos para{' '}
        <strong style={{ fontWeight: 700, color: 'var(--color-text)' }}>{email}</strong>.
      </BodyText>

      {isLoading ? (
        <OtpVerifying />
      ) : (
        <>
          <OtpInput onComplete={onComplete} />

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <div style={{ height: 24 }} />

          <ResendTimer onResend={onResend} />
        </>
      )}
    </div>
  )
}

