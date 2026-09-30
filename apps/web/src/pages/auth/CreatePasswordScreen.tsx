import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@cheirin-de-pao/shared'
import { useAuth } from '../../hooks/useAuth'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../../components/brand/Icon'
import { LoadingScreen } from './LoadingScreen'
import { BackButton, Btn, Field, Notice, ShowToggle, Sub, Title } from '../../components/auth/SocialAuthUI'

/**
 * /create-password — "Criar senha" para quem entra pelo Google (handoff L8, variante de "Trocar
 * senha" sem a senha atual). Opcional (D-4): a conta continua entrando pelo Google e pelo código.
 *
 * Critérios: os do app (PasswordSchema — 8 a 72, maiúscula, minúscula e número), com o visual do L8.
 * O handoff mostrava só "letras e números", mais fraco que a API aceita (V-2 do plano).
 */
export function CreatePasswordScreen() {
  const { user, isLoading, updateUser } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [phase, setPhase] = useState<'form' | 'saving' | 'done'>('form')
  const [error, setError] = useState<string | null>(null)

  if (isLoading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  // Já tem senha: o caminho é trocar, não criar.
  if (user.hasPassword !== false && phase !== 'done') return <Navigate to="/change-password" replace />

  const criteria: [string, boolean][] = [
    [`Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`, password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH],
    ['Uma letra maiúscula e uma minúscula', /[A-Z]/.test(password) && /[a-z]/.test(password)],
    ['Pelo menos um número', /\d/.test(password)],
    ['As duas senhas iguais', !!password && password === confirm],
  ]
  const ok = criteria.every(([, met]) => met)
  const mismatch = confirm.length > 0 && password !== confirm && confirm.length >= password.length

  const back = () => navigate('/client/perfil/conta')

  const save = async () => {
    if (!ok || phase === 'saving') return
    setPhase('saving')
    setError(null)
    try {
      const res = await apiFetch('/auth/password/set', { method: 'POST', body: JSON.stringify({ password }) })
      if (res.ok) {
        updateUser({ hasPassword: true, mustSetPassword: false })
        setPhase('done')
        return
      }
      const err = (await res.json().catch(() => null)) as { error?: string } | null
      setError(err?.error ?? 'Não foi possível criar a senha. Tente de novo.')
    } catch {
      setError('Algo deu errado. Verifique sua conexão e tente novamente.')
    }
    setPhase('form')
  }

  if (phase === 'done') {
    return (
      <Screen>
        <div role="status" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 40 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--color-good-soft)', color: 'var(--color-good)', display: 'grid', placeItems: 'center', marginBottom: 22 }}>
            <Icon name="check" size={32} stroke={2.6} />
          </div>
          <Title>Senha criada.</Title>
          <Sub>Agora você entra do jeito que preferir: com o Google, com e-mail e senha ou com código no e-mail.</Sub>
        </div>
        <Btn full size="lg" onClick={back}>
          Voltar para Minha conta
        </Btn>
      </Screen>
    )
  }

  const saving = phase === 'saving'
  return (
    <Screen>
      <BackButton onClick={back} />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ marginTop: 24 }}>
          <Title>Criar senha.</Title>
          <Sub style={{ marginBottom: 24 }}>Opcional. Com senha, você também entra com e-mail e senha. O Google continua funcionando.</Sub>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field
              label="Nova senha"
              icon="lock"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(v) => { setPassword(v); setError(null) }}
              placeholder="Crie uma senha"
              disabled={saving}
              maxLength={PASSWORD_MAX_LENGTH}
              action={<ShowToggle on={show} onClick={() => setShow(!show)} />}
            />
            <Field
              label="Confirme a nova senha"
              icon="lock"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={(v) => { setConfirm(v); setError(null) }}
              placeholder="Repita a senha"
              disabled={saving}
              maxLength={PASSWORD_MAX_LENGTH}
              error={mismatch ? 'As senhas não estão iguais.' : null}
            />
          </div>
          <ul aria-label="Critérios da senha" style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, margin: '16px 0 0', padding: 0 }}>
            {criteria.map(([label, met]) => (
              <li
                key={label}
                style={{ display: 'flex', alignItems: 'center', gap: 9, fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: met ? 'var(--color-good)' : 'var(--color-text-ter)' }}
              >
                <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: 99, background: met ? 'var(--color-good-soft)' : 'var(--color-surface-2)', display: 'grid', placeItems: 'center' }}>
                  <Icon name={met ? 'check' : 'minus'} size={12} stroke={2.8} />
                </span>
                {label}
              </li>
            ))}
          </ul>
          {error && (
            <div style={{ marginTop: 16 }}>
              <Notice tone="danger">{error}</Notice>
            </div>
          )}
        </div>
        <div style={{ flex: 1, minHeight: 24 }} />
        <Btn type="submit" full size="lg" loading={saving} disabled={!ok}>
          {saving ? 'Criando senha…' : 'Criar senha'}
        </Btn>
      </form>
    </Screen>
  )
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', padding: '8px 24px 24px', background: 'var(--color-app-bg)', boxSizing: 'border-box' }}>
      {children}
    </div>
  )
}
