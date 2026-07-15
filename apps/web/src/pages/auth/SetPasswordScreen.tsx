import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { apiFetch } from '../../lib/apiFetch'
import { roleRoutes } from '../../lib/roleRoutes'
import { LoadingScreen } from './LoadingScreen'
import {
  Heading,
  BodyText,
  PasswordField,
  PrimaryButton,
  ErrorMessage,
  PasswordCriteria,
  isPasswordStrong,
} from '../../components/auth/AuthUI'

/**
 * SetPasswordScreen — definição de senha obrigatória no 1º acesso.
 *
 * Acionada quando o login por OTP retorna hasPassword === false (contas existentes,
 * entregadores e admins no primeiro acesso). O usuário já está autenticado (tokens do
 * OTP); aqui ele define a senha via POST /auth/password/set e segue para o app.
 */
export function SetPasswordScreen() {
  const { user, isLoading, updateUser } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isLoading) return <LoadingScreen />
  // Sem sessão → precisa logar antes.
  if (!user) return <Navigate to="/login" replace />
  // Já tem senha → não precisa desta tela.
  if (user.hasPassword !== false) return <Navigate to={roleRoutes[user.role] ?? '/client'} replace />

  const strong = isPasswordStrong(password)
  const matches = password === confirm
  const canSubmit = strong && matches && !submitting

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await apiFetch('/auth/password/set', {
        method: 'POST',
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        updateUser({ hasPassword: true })
        // Hidrata o perfil do CLIENT (condomínio, apto etc.) — paridade com o login normal.
        if (user.role === 'CLIENT') {
          try {
            const pr = await apiFetch('/client/profile')
            if (pr.ok) updateUser(await pr.json())
          } catch {
            // segue mesmo sem o perfil; as telas buscam seus próprios dados
          }
        }
        navigate(roleRoutes[user.role] ?? '/client')
      } else {
        const err = (await res.json()) as { error?: string }
        setError(err.error ?? 'Algo deu errado. Tente novamente.')
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
        justifyContent: 'center',
        padding: '24px',
        minHeight: '100dvh',
        backgroundColor: 'var(--color-app-bg)',
      }}
    >
      <Heading>{'Crie sua senha.'}</Heading>
      <BodyText>
        Para deixar seu acesso mais seguro, defina uma senha. Nos próximos acessos você entra direto com e-mail e senha.
      </BodyText>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
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
          disabled={submitting}
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
          disabled={submitting}
        />
        {confirm.length > 0 && !matches && <ErrorMessage>As senhas não coincidem.</ErrorMessage>}

        {error && <ErrorMessage>{error}</ErrorMessage>}

        <div style={{ height: 20 }} />

        <PrimaryButton type="submit" disabled={!canSubmit} loading={submitting}>
          Definir senha
        </PrimaryButton>
      </form>
    </div>
  )
}
