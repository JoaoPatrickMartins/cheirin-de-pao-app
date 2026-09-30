import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ReferralBadge, type SignupReferral } from './ReferralCodeField'
import { BackButton, Btn, Consent, GoogleButton, InAppNotice, Notice, OrDivider, SocialKeyframes, Sub, Title } from './SocialAuthUI'
import { startSocial } from '../../lib/socialAuth'
import { isInAppBrowser } from '../../lib/inAppBrowser'

const SOCIAL_ERROR_TEXT: Record<string, string> = {
  cancelled: 'Você cancelou o login com o Google.',
  provider_error: 'Não foi possível falar com o Google. Tente de novo.',
}

/**
 * L2 — "Como você quer criar sua conta?" (entrada do cadastro, antes do passo 1).
 * Só aparece com o Google ligado; sem ele o cadastro abre direto no passo 1 (regra do handoff).
 */
export function RegisterChoice({
  referral,
  initialSocialError,
  onEmail,
}: {
  referral: SignupReferral
  initialSocialError?: string | null
  onEmail: () => void
}) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(() => SOCIAL_ERROR_TEXT[initialSocialError ?? ''] ?? null)
  const inApp = isInAppBrowser()
  const linked = referral.linked

  const continueWithGoogle = async () => {
    setLoading(true)
    setError(null)
    const started = await startSocial('google', 'register')
    if (!started.ok) {
      setLoading(false)
      setError(SOCIAL_ERROR_TEXT.provider_error)
      return
    }
    navigate('/entrar/social')
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', padding: '8px 24px 22px', background: 'var(--color-app-bg)', boxSizing: 'border-box' }}>
      <SocialKeyframes />
      <BackButton onClick={() => navigate('/')} />
      {linked && (
        <div style={{ marginTop: 18 }}>
          <ReferralBadge referrerName={linked.referrerName} welcomeBreads={linked.welcomeBreads} />
        </div>
      )}
      <div style={{ marginTop: linked ? 22 : 28 }}>
        <Title>Como você quer criar sua conta?</Title>
        <Sub>Crie em 1 minuto: a gente já puxa seu nome e e-mail, e você só completa o endereço.</Sub>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24 }}>
        {error && <Notice title="Não deu certo desta vez.">{error}</Notice>}
        {inApp ? <InAppNotice /> : <GoogleButton state={loading ? 'loading' : 'idle'} onClick={() => void continueWithGoogle()} />}
        <OrDivider label="ou" />
        <Btn variant="ghost" full size="lg" icon="mail" disabled={loading} onClick={onEmail}>
          Criar com e-mail
        </Btn>
        <Consent />
      </div>
      <div style={{ flex: 1, minHeight: 24 }} />
      <div style={{ textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--color-text-sec)' }}>
        Já tem conta?{' '}
        <button
          type="button"
          onClick={() => navigate('/login')}
          style={{ minHeight: 44, background: 'none', border: 'none', color: 'var(--color-accent)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
        >
          Entrar
        </button>
      </div>
    </div>
  )
}
