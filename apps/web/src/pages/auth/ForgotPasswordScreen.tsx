import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { OtpInput } from '../../components/auth/OtpInput'
import { ResendTimer } from '../../components/auth/ResendTimer'
import { Icon } from '../../components/brand/Icon'
import { apiFetch } from '../../lib/apiFetch'
import {
  Heading,
  BodyText,
  TextField,
  PasswordField,
  PrimaryButton,
  ErrorMessage,
  PasswordCriteria,
  isPasswordStrong,
  readDeviceId,
} from '../../components/auth/AuthUI'

type Step = 'email' | 'reset'

interface AuthResponse {
  accessToken: string
  refreshToken: string
  hasPassword?: boolean
  user: { id: string; role: string; name: string; creditBalance?: number }
}

const roleRoutes: Record<string, string> = { ADMIN: '/admin', CLIENT: '/client', COURIER: '/courier' }

/**
 * ForgotPasswordScreen — recuperação de senha via OTP.
 *
 * step 'email' : e-mail → POST /auth/otp/send → step 'reset'
 * step 'reset' : código de 4 dígitos + nova senha → POST /auth/password/reset (atômico) → loga
 */
export function ForgotPasswordScreen() {
  const auth = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        setStep('reset')
      } else {
        const err = (await res.json()) as { error?: string }
        setError(err.error ?? 'Não foi possível enviar o código. Tente novamente.')
      }
    } catch {
      setError('Algo deu errado. Verifique sua conexão e tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const reset = async () => {
    if (code.length !== 4 || !isPasswordStrong(password) || password !== confirm) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/auth/password/reset', {
        method: 'POST',
        body: JSON.stringify({ userId, code, deviceId: readDeviceId(), newPassword: password }),
      })
      if (res.ok) {
        const data = (await res.json()) as AuthResponse
        auth.login(data.accessToken, data.refreshToken, {
          id: data.user.id,
          role: data.user.role as 'CLIENT' | 'COURIER' | 'ADMIN',
          name: data.user.name,
          creditBalance: data.user.creditBalance ?? 0,
          hasPassword: true,
        })
        navigate(roleRoutes[data.user.role] ?? '/client')
      } else if (res.status === 401) {
        const err = (await res.json()) as { error?: string }
        const msg = (err.error ?? '').toLowerCase()
        setError(msg.includes('expir') ? 'Código expirado. Solicite um novo.' : 'Código incorreto. Verifique e tente de novo.')
      } else {
        const err = (await res.json()) as { error?: string }
        setError(err.error ?? 'Algo deu errado. Tente novamente.')
      }
    } catch {
      setError('Algo deu errado. Verifique sua conexão e tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBack = () => {
    if (step === 'reset') {
      setStep('email')
      setError(null)
    } else {
      navigate('/login')
    }
  }

  const canReset = code.length === 4 && isPasswordStrong(password) && password === confirm && !isLoading

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

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {step === 'email' ? (
          <div>
            <Heading>{'Recuperar acesso.'}</Heading>
            <BodyText>Enviamos um código de 4 dígitos para o seu e-mail. Depois é só criar uma nova senha.</BodyText>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                void sendOtp()
              }}
            >
              <TextField
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(v) => {
                  setEmail(v)
                  setError(null)
                }}
                disabled={isLoading}
              />
              {error && <ErrorMessage>{error}</ErrorMessage>}
              <div style={{ height: 16 }} />
              <PrimaryButton type="submit" disabled={!email.trim() || isLoading} loading={isLoading}>
                Enviar código
              </PrimaryButton>
            </form>
          </div>
        ) : (
          <div>
            <Heading>{'Nova senha.'}</Heading>
            <BodyText>
              Digite o código enviado para{' '}
              <strong style={{ fontWeight: 700, color: 'var(--color-text)' }}>{email}</strong> e crie sua nova senha.
            </BodyText>

            <OtpInput onComplete={setCode} disabled={isLoading} />

            <div style={{ height: 20 }} />

            <form
              onSubmit={(e) => {
                e.preventDefault()
                void reset()
              }}
            >
              <PasswordField
                autoComplete="new-password"
                placeholder="Nova senha"
                value={password}
                onChange={(v) => {
                  setPassword(v)
                  setError(null)
                }}
                disabled={isLoading}
              />
              <PasswordCriteria password={password} />

              <div style={{ height: 12 }} />

              <PasswordField
                autoComplete="new-password"
                placeholder="Confirme a senha"
                value={confirm}
                onChange={(v) => {
                  setConfirm(v)
                  setError(null)
                }}
                disabled={isLoading}
              />
              {confirm.length > 0 && password !== confirm && <ErrorMessage>As senhas não coincidem.</ErrorMessage>}

              {error && <ErrorMessage>{error}</ErrorMessage>}

              <div style={{ height: 20 }} />

              <PrimaryButton type="submit" disabled={!canReset} loading={isLoading}>
                Redefinir senha
              </PrimaryButton>
            </form>

            <div style={{ height: 20 }} />
            <ResendTimer onResend={sendOtp} />
          </div>
        )}
      </div>
    </div>
  )
}
