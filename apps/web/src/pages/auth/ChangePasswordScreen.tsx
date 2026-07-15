import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../../components/brand/Icon'
import { LoadingScreen } from './LoadingScreen'
import {
  Heading,
  BodyText,
  PasswordField,
  PrimaryButton,
  ErrorMessage,
  PasswordCriteria,
  isPasswordStrong,
  LinkButton,
} from '../../components/auth/AuthUI'

/**
 * ChangePasswordScreen — troca de senha estando logado (exige a senha atual).
 * Rota top-level (/change-password) acessível a qualquer papel a partir do perfil.
 */
export function ChangePasswordScreen() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()

  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (isLoading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />

  const canSubmit = !!current && isPasswordStrong(password) && password === confirm && !submitting

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await apiFetch('/auth/password/change', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: current, newPassword: password }),
      })
      if (res.ok) {
        setDone(true)
        setTimeout(() => navigate(-1), 1200)
      } else {
        const err = (await res.json()) as { error?: string }
        setError(err.error ?? 'Não foi possível trocar a senha. Tente novamente.')
      }
    } catch {
      setError('Algo deu errado. Verifique sua conexão e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

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
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Heading>{'Trocar senha.'}</Heading>
        <BodyText>Confirme sua senha atual e escolha uma nova.</BodyText>

        {done ? (
          <p
            role="status"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--color-success, #2e7d32)',
              textAlign: 'center',
            }}
          >
            Senha alterada com sucesso!
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <PasswordField
              autoComplete="current-password"
              placeholder="Senha atual"
              value={current}
              onChange={(v) => {
                setCurrent(v)
                setError(null)
              }}
              disabled={submitting}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <LinkButton onClick={() => navigate('/forgot-password')}>Esqueci minha senha</LinkButton>
            </div>

            <PasswordField
              autoComplete="new-password"
              placeholder="Nova senha"
              value={password}
              onChange={(v) => {
                setPassword(v)
                setError(null)
              }}
              disabled={submitting}
            />
            <PasswordCriteria password={password} />

            <div style={{ height: 12 }} />

            <PasswordField
              autoComplete="new-password"
              placeholder="Confirme a nova senha"
              value={confirm}
              onChange={(v) => {
                setConfirm(v)
                setError(null)
              }}
              disabled={submitting}
            />
            {confirm.length > 0 && password !== confirm && <ErrorMessage>As senhas não coincidem.</ErrorMessage>}

            {error && <ErrorMessage>{error}</ErrorMessage>}

            <div style={{ height: 20 }} />

            <PrimaryButton type="submit" disabled={!canSubmit} loading={submitting}>
              Trocar senha
            </PrimaryButton>
          </form>
        )}
      </div>
    </div>
  )
}
