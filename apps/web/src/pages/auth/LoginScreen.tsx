import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { OtpInput } from '../../components/auth/OtpInput'
import { OtpVerifying } from '../../components/auth/OtpVerifying'
import { ResendTimer } from '../../components/auth/ResendTimer'
import { Icon } from '../../components/brand/Icon'
import { apiFetch } from '../../lib/apiFetch'
import { useFinishAuth, type AuthSessionResponse } from '../../lib/finishAuth'
import { fetchSocialProviders, startSocial } from '../../lib/socialAuth'
import { isInAppBrowser } from '../../lib/inAppBrowser'
import {
  GoogleButton,
  InAppNotice,
  OrDivider,
  Consent,
  Notice,
  Field,
  ShowToggle,
  Btn,
  TextLink,
  SocialKeyframes,
} from '../../components/auth/SocialAuthUI'
import { getGreeting } from '../../lib/greeting'
import {
  Heading,
  BodyText,
  TextField,
  PrimaryButton,
  LinkButton,
  ErrorMessage,
  readDeviceId,
} from '../../components/auth/AuthUI'

type Step = 'password' | 'otp-email' | 'otp-code'

type AuthResponse = AuthSessionResponse

// Aviso ao voltar do Google (V-6): cancelou ou o Google falhou — a pessoa segue por aqui.
const SOCIAL_ERROR_TEXT: Record<string, string> = {
  cancelled: 'Você cancelou o login com o Google.',
  provider_error: 'Não foi possível falar com o Google. Tente de novo.',
}

/**
 * LoginScreen — login primário por e-mail + senha, com OTP como método alternativo.
 *
 * step 'password'  : "Continuar com o Google" (quando ligado) + e-mail e senha → POST /auth/login
 *                    links: "Entrar com código" (OTP) e "Esqueci minha senha"
 * step 'otp-email' : e-mail → POST /auth/otp/send → step 'otp-code'
 * step 'otp-code'  : código de 4 dígitos → POST /auth/otp/verify → finishAuth
 *
 * Design tokens: alta fidelidade com o handoff (AUTH-04/05/08, UI-06).
 */
export function LoginScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const finishAuth = useFinishAuth()

  const [step, setStep] = useState<Step>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [userId, setUserId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ──────────────── Google ────────────────
  const [googleOn, setGoogleOn] = useState(false)
  const [socialLoading, setSocialLoading] = useState(false)
  const [socialError, setSocialError] = useState<string | null>(
    () => SOCIAL_ERROR_TEXT[(location.state as { socialError?: string } | null)?.socialError ?? ''] ?? null,
  )
  const inApp = isInAppBrowser()

  useEffect(() => {
    let alive = true
    void fetchSocialProviders().then((p) => {
      if (alive) setGoogleOn(p.google)
    })
    return () => {
      alive = false
    }
  }, [])

  const continueWithGoogle = async () => {
    setSocialLoading(true)
    setSocialError(null)
    setError(null)
    const started = await startSocial('google', 'login')
    if (!started.ok) {
      setSocialLoading(false)
      setSocialError(SOCIAL_ERROR_TEXT.provider_error)
      return
    }
    // A tela de retorno abre o Google e fica esperando (L3a).
    navigate('/entrar/social')
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
        finishAuth((await res.json()) as AuthResponse, 'password')
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
        finishAuth((await res.json()) as AuthResponse, 'otp')
      } else if (res.status === 401) {
        const err = (await res.json()) as { error?: string }
        const errMsg = (err.error ?? '').toLowerCase()
        setError(errMsg.includes('expir') ? 'Código expirado. Solicite um novo.' : 'Código incorreto. Verifique e tente de novo.')
      } else if (res.status === 403) {
        // Conta bloqueada — mesma mensagem do servidor que o login por senha já exibe.
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        setError(err.error ?? 'Conta bloqueada. Fale com o suporte.')
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

      {/* Passo e-mail + senha segue o handoff (L1, topo); os passos do código seguem centralizados. */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: step === 'password' ? 'flex-start' : 'center' }}>
        {step === 'password' && (
          <StepPassword
            email={email}
            password={password}
            isLoading={isLoading}
            error={error}
            googleOn={googleOn}
            inApp={inApp}
            socialLoading={socialLoading}
            socialError={socialError}
            onGoogle={() => void continueWithGoogle()}
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
  googleOn: boolean
  inApp: boolean
  socialLoading: boolean
  socialError: string | null
  onGoogle: () => void
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: () => void
  onUseOtp: () => void
  onForgot: () => void
}

// L1 do handoff: saudação → [aviso] → Google → "ou com e-mail" → e-mail/senha → Entrar → links →
// consentimento. Sem o Google ligado fica como antes (sem divisor nem consentimento).
function StepPassword({
  email,
  password,
  isLoading,
  error,
  googleOn,
  inApp,
  socialLoading,
  socialError,
  onGoogle,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onUseOtp,
  onForgot,
}: StepPasswordProps) {
  const [show, setShow] = useState(false)
  const busy = isLoading || socialLoading
  const canSubmit = !!email.trim() && !!password && !busy

  return (
    <div style={{ marginTop: 22 }}>
      <SocialKeyframes />
      <Heading>{`${getGreeting()}.\nBora entrar.`}</Heading>
      <BodyText>
        {googleOn
          ? 'O jeito mais rápido é com um toque. Se preferir, use seu e-mail — com senha ou com um código.'
          : 'Entre com seu e-mail e senha. Prefere não decorar senha? Dá pra entrar com um código no e-mail.'}
      </BodyText>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: -2 }}>
        {socialError && <Notice title="Não deu certo desta vez.">{socialError}</Notice>}
        {googleOn && (inApp ? <InAppNotice /> : <GoogleButton state={socialLoading ? 'loading' : isLoading ? 'disabled' : 'idle'} onClick={onGoogle} />)}
        {googleOn && <OrDivider />}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (canSubmit) onSubmit()
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <Field
            label="E-mail"
            icon="mail"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="voce@email.com"
            value={email}
            onChange={onEmailChange}
            disabled={busy}
          />
          <Field
            label="Senha"
            icon="lock"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Sua senha"
            value={password}
            onChange={onPasswordChange}
            disabled={busy}
            action={<ShowToggle on={show} onClick={() => setShow(!show)} />}
          />

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <Btn type="submit" full size="lg" disabled={!canSubmit} loading={isLoading}>
            {isLoading ? 'Entrando…' : 'Entrar'}
          </Btn>
        </form>

        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: -6, opacity: socialLoading ? 0.45 : 1 }}>
          <TextLink onClick={onForgot}>Esqueci minha senha</TextLink>
          <TextLink onClick={onUseOtp}>Entrar com código no e-mail</TextLink>
        </div>

        {googleOn && <Consent />}
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

