import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { BreadMark } from '../../components/brand/BreadMark'
import { Icon } from '../../components/brand/Icon'
import { OtpInput } from '../../components/auth/OtpInput'
import { ResendTimer } from '../../components/auth/ResendTimer'
import {
  BackButton,
  Btn,
  Field,
  Notice,
  OrDivider,
  ProviderTile,
  ShowToggle,
  SocialKeyframes,
  Sub,
  TextLink,
  Title,
} from '../../components/auth/SocialAuthUI'
import {
  claimSocial,
  clearPendingFlow,
  currentDisplayMode,
  goToProvider,
  linkWithPassword,
  readPendingFlow,
  sendLinkCode,
  startSocial,
  verifyLinkCode,
  type ClaimResponse,
  type LinkFieldError,
  type PendingSocialFlow,
  type SocialErrorCode,
  type SocialOrigin,
} from '../../lib/socialAuth'
import { useFinishAuth } from '../../lib/finishAuth'
import { setFlash } from '../../lib/flash'
import { supportWhatsappUrl } from '../../lib/support'

/**
 * /entrar/social — retorno do login com Google (handoff L3a/L3b/L3c/L6).
 *
 * - Chegou aqui logo depois do `start` (sem `?flow=`): abre o Google e fica em "Conectando…".
 *   No iPhone com o app instalado o Google abre numa janela do Safari; esta tela continua viva por
 *   trás e busca o resultado a cada poucos segundos e sempre que o app volta para a tela.
 * - Voltou do Google (`?flow=<id>`): busca o resultado com o segredo guardado neste aparelho. Se o
 *   segredo não está aqui (janela do Safari) ou o contexto é outro (app × navegador), mostra
 *   "Pode voltar ao app" — quem busca é o app.
 */

const POLL_MS = 2500
const POLL_FOR_MS = 10 * 60 * 1000 // depois disso, só busca quando o app volta para a tela
const LINKED_FLASH = 'Google conectado! Da próxima vez é só um toque.'

type ErrorKind = 'cancel' | 'blocked' | 'role' | 'expired' | 'provider' | 'taken' | 'email' | 'other'

type View =
  | { kind: 'connecting' }
  | { kind: 'return-to-app' }
  | { kind: 'error'; error: ErrorKind }
  | { kind: 'link'; maskedEmail: string; canUsePassword: boolean }

const ERROR_KIND: Record<SocialErrorCode, ErrorKind> = {
  cancelled: 'cancel',
  blocked: 'blocked',
  not_client: 'role',
  expired: 'expired',
  provider_error: 'provider',
  already_linked: 'taken',
  email_unverified: 'email',
  provider_taken: 'other',
}

// Textos do handoff (SA_ERRORS) — sem o Facebook (V-1) e com os dois estados novos (V-4).
const ERRORS: Record<
  ErrorKind,
  { icon: string; tone: 'neutral' | 'danger' | 'gold'; title: string; text: string; cta: string; ctaIcon?: string; secondary?: string }
> = {
  cancel: { icon: 'x', tone: 'neutral', title: 'Tudo bem.', text: 'Você pode entrar de outro jeito: com e-mail e senha ou com um código no e-mail.', cta: 'Voltar ao login' },
  blocked: { icon: 'ban', tone: 'danger', title: 'Conta bloqueada.', text: 'Fale com o suporte que a gente vê com você o que aconteceu.', cta: 'Falar com o suporte', ctaIcon: 'chat', secondary: 'Voltar ao login' },
  role: { icon: 'truck', tone: 'neutral', title: 'Essa conta entra com e-mail e senha.', text: 'Contas de entregador e da equipe não usam o Google. Entre com o e-mail e a senha de sempre.', cta: 'Entrar com e-mail' },
  expired: { icon: 'clock', tone: 'gold', title: 'Demorou um pouquinho.', text: 'A conexão com o Google expirou. Tente de novo — é só um toque.', cta: 'Tentar de novo', ctaIcon: 'refresh', secondary: 'Voltar ao login' },
  provider: { icon: 'alert', tone: 'gold', title: 'Não deu certo desta vez.', text: 'Não foi possível falar com o Google agora. Tente de novo em instantes, ou entre com seu e-mail.', cta: 'Tentar de novo', ctaIcon: 'refresh', secondary: 'Voltar ao login' },
  taken: { icon: 'link', tone: 'gold', title: 'Essa conta Google já está ligada a outro cadastro.', text: 'Para usar esta conta Google aqui, desconecte-a do outro cadastro primeiro — ou conecte outra conta Google.', cta: 'Voltar para Minha conta' },
  email: { icon: 'mail', tone: 'gold', title: 'Esse e-mail do Google ainda não foi confirmado.', text: 'Confirme o e-mail na sua conta Google ou crie a conta com seu e-mail — leva 1 minuto.', cta: 'Criar com e-mail', secondary: 'Voltar ao login' },
  other: { icon: 'link', tone: 'gold', title: 'Você já tem uma conta Google conectada.', text: 'Para trocar, desconecte a atual em Minha conta e conecte a nova.', cta: 'Voltar para Minha conta' },
}

const ORIGIN_PATH: Record<SocialOrigin, string> = {
  login: '/login',
  register: '/register',
  account: '/client/perfil/conta',
}

function launchedKey(flowId: string) {
  return `cdp_social_launched_${flowId}`
}

function wasLaunched(flowId: string): boolean {
  try {
    return sessionStorage.getItem(launchedKey(flowId)) === '1'
  } catch {
    return false
  }
}

function markLaunched(flowId: string): void {
  try {
    sessionStorage.setItem(launchedKey(flowId), '1')
  } catch {
    // sem storage: um reload reabriria o Google — aceitável
  }
}

function initialView(flow: PendingSocialFlow | null, flowParam: string | null, errorParam: string | null): View {
  if (errorParam) return { kind: 'error', error: errorParam === 'provider_error' ? 'provider' : 'expired' }
  // O segredo não está neste armazenamento (janela do Safari no iPhone) ou é de outro fluxo.
  if (flowParam && (!flow || flow.flowId !== flowParam)) return { kind: 'return-to-app' }
  if (!flow) return { kind: 'error', error: 'expired' }
  // Começou no app instalado e voltou no navegador (ou o contrário): quem busca é o outro contexto.
  if (flowParam && flow.displayMode !== currentDisplayMode()) return { kind: 'return-to-app' }
  return { kind: 'connecting' }
}

export function SocialReturnScreen() {
  const navigate = useNavigate()
  const finishAuth = useFinishAuth()
  const [params] = useSearchParams()
  const flowParam = params.get('flow')
  const errorParam = params.get('erro')

  const [flow, setFlow] = useState<PendingSocialFlow | null>(() => readPendingFlow())
  const [view, setView] = useState<View>(() => initialView(readPendingFlow(), flowParam, errorParam))
  const origin: SocialOrigin = flow?.origin ?? 'login'
  const settled = useRef(false)

  const backToOrigin = useCallback(
    (state?: Record<string, unknown>) => navigate(ORIGIN_PATH[origin], { replace: true, state }),
    [navigate, origin],
  )

  // Erro vindo direto da URL: o fluxo daqui não vale mais.
  useEffect(() => {
    if (errorParam) clearPendingFlow()
  }, [errorParam])

  const handleResult = useCallback(
    (res: ClaimResponse) => {
      if (res.status === 'PENDING') return
      settled.current = true
      switch (res.status) {
        case 'LOGGED_IN':
          clearPendingFlow()
          finishAuth(res, 'google', { replace: true })
          return
        case 'NEEDS_SIGNUP':
          // O fluxo continua guardado: o cadastro "Quase lá" usa o mesmo segredo no /complete.
          navigate('/register?modo=google', { replace: true, state: { prefill: res.prefill } })
          return
        case 'NEEDS_LINK':
          setView({ kind: 'link', maskedEmail: res.maskedEmail, canUsePassword: res.canUsePassword })
          return
        case 'LINKED':
          clearPendingFlow()
          setFlash(LINKED_FLASH)
          navigate('/client/perfil/conta', { replace: true })
          return
        case 'ERROR': {
          clearPendingFlow()
          // Cancelou ou o Google falhou saindo do login/cadastro: volta para lá com o aviso (V-6).
          if ((res.code === 'cancelled' || res.code === 'provider_error') && origin !== 'account') {
            backToOrigin({ socialError: res.code })
            return
          }
          if (res.code === 'cancelled' && origin === 'account') {
            backToOrigin()
            return
          }
          setView({ kind: 'error', error: ERROR_KIND[res.code] ?? 'provider' })
        }
      }
    },
    [backToOrigin, finishAuth, navigate, origin],
  )

  // Chegou aqui logo depois do start: abre o Google uma vez só (um reload não reabre).
  useEffect(() => {
    if (view.kind !== 'connecting' || !flow || flowParam) return
    if (wasLaunched(flow.flowId)) return
    markLaunched(flow.flowId)
    goToProvider(flow.authUrl)
  }, [view.kind, flow, flowParam])

  // Busca o resultado: agora, a cada poucos segundos e sempre que o app volta para a tela.
  useEffect(() => {
    if (view.kind !== 'connecting' || !flow) return
    let stopped = false
    let busy = false
    const startedAt = Date.now()

    const tick = async () => {
      if (stopped || busy || settled.current) return
      busy = true
      const res = await claimSocial(flow)
      busy = false
      if (stopped || !res || res.status === 'PENDING') return
      stopped = true
      handleResult(res)
    }

    void tick()
    const interval = setInterval(() => {
      if (Date.now() - startedAt > POLL_FOR_MS) clearInterval(interval)
      else void tick()
    }, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      stopped = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [view.kind, flow, handleResult])

  const cancel = () => {
    clearPendingFlow()
    backToOrigin()
  }

  const retry = async () => {
    const started = await startSocial('google', origin)
    if (!started.ok) {
      setView({ kind: 'error', error: 'provider' })
      return
    }
    settled.current = false
    setFlow(started.flow)
    markLaunched(started.flow.flowId)
    setView({ kind: 'connecting' })
    goToProvider(started.flow.authUrl)
  }

  if (view.kind === 'return-to-app') return <ReturnToApp />

  if (view.kind === 'error') {
    const e = view.error
    const onPrimary = () => {
      if (e === 'blocked') window.open(supportWhatsappUrl(), '_blank', 'noopener')
      else if (e === 'expired' || e === 'provider') void retry()
      else if (e === 'taken' || e === 'other') navigate('/client/perfil/conta', { replace: true })
      else if (e === 'email') navigate('/register', { replace: true, state: { emailSignup: true } })
      else navigate('/login', { replace: true })
    }
    const onBack = () => {
      if (e === 'taken' || e === 'other') navigate('/client/perfil/conta', { replace: true })
      else navigate('/login', { replace: true })
    }
    return <SocialError kind={e} onPrimary={onPrimary} onBack={onBack} />
  }

  if (view.kind === 'link' && flow) {
    return (
      <FoundAccount
        flow={flow}
        maskedEmail={view.maskedEmail}
        canUsePassword={view.canUsePassword}
        onResult={(res) => {
          if (res.status === 'LOGGED_IN') setFlash(LINKED_FLASH)
          handleResult(res)
        }}
        onRestart={() => {
          clearPendingFlow()
          backToOrigin()
        }}
        onBack={cancel}
      />
    )
  }

  return <Connecting onCancel={cancel} />
}

/* ===== L3a — Conectando (no app, enquanto espera o retorno) ===== */
function Connecting({ onCancel }: { onCancel: () => void }) {
  return (
    <Screen>
      <SocialKeyframes />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 22 }}>
        <div style={{ position: 'relative', width: 112, height: 112 }}>
          <div
            style={{
              width: 112,
              height: 112,
              borderRadius: '30%',
              background: 'var(--color-espresso)',
              display: 'grid',
              placeItems: 'center',
              animation: 'saBreath 2.2s ease-in-out infinite',
              boxShadow: 'var(--shadow-strong)',
            }}
          >
            <BreadMark size={70} color="var(--color-gold)" />
          </div>
          <div style={{ position: 'absolute', right: -8, bottom: -8, boxShadow: 'var(--shadow-soft)', borderRadius: 14 }}>
            <ProviderTile size={42} radius={14} />
          </div>
        </div>
        <div role="status" aria-live="polite">
          <Title size={24}>Conectando com o Google…</Title>
          <Sub>Termine na janela que abriu. A gente te espera aqui e entra sozinho.</Sub>
        </div>
      </div>
      <Btn variant="soft" full onClick={onCancel}>
        Cancelar
      </Btn>
    </Screen>
  )
}

/* ===== L3b — "Pode voltar ao app" (janela do Safari no iPhone — é uma página, não o app) ===== */
function ReturnToApp() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center', background: 'var(--color-app-bg)' }}>
      <BreadMark size={40} color="var(--color-gold)" />
      <div style={{ width: 84, height: 84, borderRadius: 999, background: 'var(--color-good-soft)', color: 'var(--color-good)', display: 'grid', placeItems: 'center', marginTop: 26 }}>
        <Icon name="check" size={40} stroke={2.6} />
      </div>
      <div role="status" style={{ marginTop: 22 }}>
        <Title size={30}>Pronto!</Title>
        <Sub style={{ maxWidth: 290 }}>Pode voltar ao app Cheirin de Pão — ele já está te esperando.</Sub>
      </div>
      <div
        style={{
          marginTop: 26,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 14px',
          borderRadius: 999,
          background: 'var(--color-surface-2)',
          fontFamily: 'var(--font-body)',
          fontSize: 12.5,
          color: 'var(--color-text-sec)',
          fontWeight: 600,
        }}
      >
        <Icon name="arrowU" size={14} stroke={2.4} />
        <span>
          Toque em <b style={{ color: 'var(--color-text)' }}>OK</b> no canto da tela
        </span>
      </div>
    </div>
  )
}

/* ===== L3c — Erros de retorno ===== */
function SocialError({ kind, onPrimary, onBack }: { kind: ErrorKind; onPrimary: () => void; onBack: () => void }) {
  const e = ERRORS[kind]
  const tone = {
    neutral: ['var(--color-surface-2)', 'var(--color-text-sec)'],
    danger: ['var(--color-warn-soft)', 'var(--color-warn)'],
    gold: ['var(--color-gold-soft)', 'var(--color-accent)'],
  }[e.tone]
  return (
    <Screen>
      <SocialKeyframes />
      <BackButton onClick={onBack} />
      <div role="alert" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 40 }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: tone[0], color: tone[1], display: 'grid', placeItems: 'center', marginBottom: 22 }}>
          <Icon name={e.icon} size={30} stroke={2.1} />
        </div>
        <Title>{e.title}</Title>
        <Sub>{e.text}</Sub>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Btn full size="lg" icon={e.ctaIcon} onClick={onPrimary}>
          {e.cta}
        </Btn>
        {e.secondary && (
          <TextLink center onClick={onBack}>
            {e.secondary}
          </TextLink>
        )}
      </div>
    </Screen>
  )
}

/* ===== L6 — "Encontramos sua conta" (confirmar com senha ou código antes de conectar — D-2) ===== */
function FoundAccount({
  flow,
  maskedEmail,
  canUsePassword,
  onResult,
  onRestart,
  onBack,
}: {
  flow: PendingSocialFlow
  maskedEmail: string
  canUsePassword: boolean
  onResult: (res: ClaimResponse) => void
  onRestart: () => void
  onBack: () => void
}) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'pick' | 'code'>('pick')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fieldError, setFieldError] = useState<LinkFieldError | null>(null)
  const [networkError, setNetworkError] = useState(false)
  const [code, setCode] = useState('')
  const [otpKey, setOtpKey] = useState(0)
  const [codeSent, setCodeSent] = useState(false)

  const tooMany = fieldError?.reason === 'too_many'

  const requestCode = async () => {
    setBusy(true)
    setNetworkError(false)
    const sent = await sendLinkCode(flow)
    setBusy(false)
    if (!sent.ok) {
      setNetworkError(true)
      return
    }
    setFieldError(null)
    setCode('')
    setOtpKey((k) => k + 1)
    setCodeSent(true)
  }

  const goCode = () => {
    setMode('code')
    setFieldError(null)
    void requestCode()
  }

  const confirmPassword = async () => {
    if (!password || busy) return
    setBusy(true)
    setNetworkError(false)
    const res = await linkWithPassword(flow, password)
    setBusy(false)
    if (res.ok) return onResult(res.result)
    if (res.field) setFieldError(res.field)
    else setNetworkError(true)
  }

  const confirmCode = async (value: string) => {
    if (value.length !== 4 || busy) return
    setBusy(true)
    setNetworkError(false)
    const res = await verifyLinkCode(flow, value)
    setBusy(false)
    if (res.ok) return onResult(res.result)
    if (res.field) {
      setFieldError(res.field)
      setCode('')
      setOtpKey((k) => k + 1)
    } else setNetworkError(true)
  }

  const head = (sub: React.ReactNode) => (
    <>
      <div style={{ position: 'relative', width: 64, height: 64, marginBottom: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--color-gold-soft)', color: 'var(--color-accent)', display: 'grid', placeItems: 'center' }}>
          <Icon name="shield" size={30} stroke={2} />
        </div>
        <div style={{ position: 'absolute', right: -8, bottom: -6 }}>
          <ProviderTile size={30} radius={10} />
        </div>
      </div>
      <Title>{mode === 'code' ? 'Digite o código.' : 'Encontramos sua conta.'}</Title>
      <Sub style={{ marginBottom: 22 }}>{sub}</Sub>
    </>
  )

  const tooManyNotice = (
    <Notice tone="danger" title="Muitas tentativas por agora.">
      Por segurança, comece de novo daqui a pouco.
    </Notice>
  )

  if (mode === 'code') {
    return (
      <Screen scroll>
        <SocialKeyframes />
        <BackButton onClick={() => { setMode('pick'); setFieldError(null) }} />
        <div style={{ marginTop: 24 }}>
          {head(
            <>
              Enviamos 4 dígitos para <b style={{ color: 'var(--color-text)' }}>{maskedEmail}</b>, o e-mail da sua conta. É só pra confirmar que é você.
            </>,
          )}
          <OtpInput key={otpKey} disabled={busy || tooMany || !codeSent} onComplete={(v) => { setCode(v); void confirmCode(v) }} />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {fieldError?.reason === 'code_wrong' && (
              <Notice tone="danger" title="Código não confere.">
                Confira os números no e-mail. Você ainda tem {fieldError.attemptsLeft} {fieldError.attemptsLeft === 1 ? 'tentativa' : 'tentativas'}.
              </Notice>
            )}
            {(fieldError?.reason === 'code_expired' || fieldError?.reason === 'no_code') && (
              <Notice title="Esse código expirou.">Códigos valem por 10 minutos. Mandamos um novo num toque.</Notice>
            )}
            {tooMany && tooManyNotice}
            {networkError && <Notice tone="danger">Não conseguimos falar com o servidor. Verifique sua conexão.</Notice>}
            {!fieldError && codeSent && (
              <div style={{ textAlign: 'center' }}>
                <ResendTimer onResend={() => void requestCode()} />
              </div>
            )}
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 24 }} />
        {tooMany ? (
          <Btn full size="lg" onClick={onRestart}>Começar de novo</Btn>
        ) : fieldError?.reason === 'code_expired' || fieldError?.reason === 'no_code' ? (
          <Btn full size="lg" icon="refresh" loading={busy} onClick={() => void requestCode()}>Enviar um novo código</Btn>
        ) : (
          <Btn full size="lg" loading={busy} disabled={code.length !== 4} onClick={() => void confirmCode(code)}>
            {busy ? 'Conectando…' : 'Confirmar e conectar'}
          </Btn>
        )}
      </Screen>
    )
  }

  return (
    <Screen scroll>
      <SocialKeyframes />
      <BackButton onClick={onBack} />
      <div style={{ marginTop: 24 }}>
        {head(
          <>
            Já existe uma conta com <b style={{ color: 'var(--color-text)' }}>{maskedEmail}</b>. Confirme que é você para conectar o Google. Seus pãezins e pedidos continuam lá.
          </>,
        )}
        {tooMany ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tooManyNotice}
            <Btn full size="lg" onClick={onRestart}>Começar de novo</Btn>
          </div>
        ) : canUsePassword ? (
          <form
            onSubmit={(ev) => {
              ev.preventDefault()
              void confirmPassword()
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <Field
              label="Confirmar com minha senha"
              icon="lock"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(v) => { setPassword(v); setFieldError(null) }}
              placeholder="Senha da sua conta"
              disabled={busy}
              action={<ShowToggle on={show} onClick={() => setShow(!show)} />}
              error={fieldError?.reason === 'password_wrong' ? 'Senha não confere. Tente de novo — ou receba um código no e-mail.' : null}
            />
            {networkError && <Notice tone="danger">Não conseguimos falar com o servidor. Verifique sua conexão.</Notice>}
            <Btn type="submit" full size="lg" loading={busy} disabled={!password}>
              {busy ? 'Conectando…' : 'Confirmar e conectar'}
            </Btn>
            <div style={{ textAlign: 'center', marginTop: -4 }}>
              <TextLink onClick={() => navigate('/forgot-password')}>Esqueci minha senha</TextLink>
            </div>
            <OrDivider label="ou" />
            <Btn variant="ghost" full size="lg" icon="mail" disabled={busy} onClick={goCode}>
              Receber código no e-mail
            </Btn>
          </form>
        ) : (
          <Btn full size="lg" icon="mail" onClick={goCode}>
            Receber código no e-mail
          </Btn>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 20 }} />
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', textAlign: 'center', lineHeight: 1.5, marginTop: 16 }}>
        Não é você?{' '}
        <a href={supportWhatsappUrl()} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', fontWeight: 700 }}>
          Fale com o suporte
        </a>
      </div>
    </Screen>
  )
}

function Screen({ children, scroll }: { children: React.ReactNode; scroll?: boolean }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        padding: '8px 24px 24px',
        background: 'var(--color-app-bg)',
        overflowY: scroll ? 'auto' : undefined,
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  )
}
