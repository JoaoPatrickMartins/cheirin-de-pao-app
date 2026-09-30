import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { Icon } from '../../components/brand/Icon'
import { StepDots } from '../../components/auth/StepDots'
import { CondoSearch } from '../../components/auth/CondoSearch'
import { CondoWaitlist } from '../../components/auth/CondoWaitlist'
import { OtpInput } from '../../components/auth/OtpInput'
import { ResendTimer } from '../../components/auth/ResendTimer'
import { useAuth } from '../../hooks/useAuth'
import { apiFetch } from '../../lib/apiFetch'
import { PasswordCriteria, isPasswordStrong } from '../../components/auth/AuthUI'
import {
  ReferralBadge,
  ReferralCodeField,
  ReferralCodeToggle,
  useSignupReferral,
} from '../../components/auth/ReferralCodeField'
import { clearStoredReferral } from '../../lib/referral'
import { RegisterChoice } from '../../components/auth/RegisterChoice'
import { SocialSignupStep, type SocialSignupNotice } from '../../components/auth/SocialSignupStep'
import { useFinishAuth } from '../../lib/finishAuth'
import {
  claimSocial,
  clearPendingFlow,
  completeSocialSignup,
  fetchSocialProviders,
  readPendingFlow,
  startSocial,
} from '../../lib/socialAuth'
import {
  isValidCpf,
  isValidBrMobile,
  COMPLEMENT_MAX_LENGTH,
  apartmentFieldLabel,
  apartmentFieldPlaceholder,
} from '@cheirin-de-pao/shared'

interface Condo {
  id: string
  name: string
  type: string
  neighborhood: string
  numBlocks?: number | null
}

/** Strip non-digits from CPF string */
function stripCpf(cpf: string): string {
  return cpf.replace(/\D/g, '')
}

/** Format raw 11-digit CPF string as 000.000.000-00 */
function formatCpf(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

/** Format raw 8-digit date string as DD/MM/AAAA */
function formatDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

/** Convert DD/MM/AAAA to ISO 8601, undefined if incomplete */
function parseBirthDate(display: string): string | undefined {
  const digits = display.replace(/\D/g, '')
  if (digits.length !== 8) return undefined
  return `${digits.slice(4)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}T00:00:00.000Z`
}

/** Format BR mobile as (00) 00000-0000 (mesma máscara do cadastro de entregador/fornecedor) */
function formatPhone(raw: string): string {
  let all = raw.replace(/\D/g, '')
  // Alguns clientes colam/digitam com o código do país 55 na frente. Removemos
  // esse prefixo ANTES de cortar em 11 dígitos — senão o "55" viraria o DDD e os
  // dois últimos dígitos reais seriam descartados. Só removemos quando é
  // claramente prefixo (12–13 dígitos), preservando quem tem DDD 55 (11 dígitos).
  if (all.length > 11 && all.startsWith('55')) all = all.slice(2)
  const digits = all.slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

/**
 * Gera os identificadores de bloco a partir da quantidade. Como o sistema não
 * sabe se o condomínio nomeia por letra ou número, cada opção traz as duas
 * formas correspondentes ("1 ou A", "2 ou B"…) — é o mesmo bloco nos dois
 * esquemas, então basta uma opção por bloco.
 */
function blockOptions(numBlocks: number): string[] {
  const count = Math.min(Math.max(numBlocks, 0), 26)
  return Array.from({ length: count }, (_, i) => `${i + 1} ou ${String.fromCharCode(65 + i)}`)
}

// Dois roteiros (plano-login-social.md §9.3). E-mail: os 5 passos de sempre. Google: "Quase lá" (5)
// → condomínio (2) → endereço (3), sem senha e sem código — o e-mail já vem verificado.
const EMAIL_STEPS = [0, 1, 2, 3, 4]
const GOOGLE_STEPS = [5, 2, 3]
const QUASE_LA = 5

// Rascunho do "Quase lá" enquanto a pessoa refaz o Google (a volta recarrega a página).
const SOCIAL_DRAFT_KEY = 'cdp_social_signup_draft'

type SignupMode = 'loading' | 'choice' | 'email' | 'google'
type SocialPrefill = { name: string; email: string }

export function OnboardingScreen() {
  const navigate = useNavigate()
  const auth = useAuth()
  const finishAuth = useFinishAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const navState = (location.state ?? null) as { prefill?: SocialPrefill; emailSignup?: boolean; socialError?: string } | null

  // choice = L2 ("Como você quer criar sua conta?"), só com o Google ligado.
  const [mode, setMode] = useState<SignupMode>(() =>
    searchParams.get('modo') === 'google' ? 'google' : navState?.emailSignup ? 'email' : 'loading',
  )
  const [googleOn, setGoogleOn] = useState(false)
  const [prefill, setPrefill] = useState<SocialPrefill | null>(navState?.prefill ?? null)
  const [socialFlow, setSocialFlow] = useState(() => readPendingFlow())
  const [socialNotice, setSocialNotice] = useState<SocialSignupNotice>(null)
  const [restarting, setRestarting] = useState(false)

  const [step, setStep] = useState(() => (searchParams.get('modo') === 'google' ? QUASE_LA : 0))
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const steps = mode === 'google' ? GOOGLE_STEPS : EMAIL_STEPS
  const stepIndex = Math.max(0, steps.indexOf(step))

  // Step 0 — Dados
  const [nome, setNome] = useState('')
  const [cpfDisplay, setCpfDisplay] = useState('') // formatted display value
  const [dataNascimento, setDataNascimento] = useState('')

  // Step 1 — Contato + senha (OTP só por e-mail; telefone é coletado p/ avisos de
  // entrega e OTP por WhatsApp futuro)
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmaSenha, setConfirmaSenha] = useState('')

  // Step 2 — Condomínio
  // Lista de espera (C8): sub-tela do passo, aberta por "Meu condomínio não está aqui" com o termo buscado.
  const [waitlistFor, setWaitlistFor] = useState<string | null>(null)
  const [condos, setCondos] = useState<Condo[]>([])
  const [condosLoading, setCondosLoading] = useState(false)
  const [selectedCondoId, setSelectedCondoId] = useState<string | null>(null)

  // Step 3 — Endereço
  const [bloco, setBloco] = useState<string | null>(null)
  // Complemento do bloco ("Lado A"): opcional, curto e só existe em condomínio com blocos.
  const [complemento, setComplemento] = useState('')
  const [apto, setApto] = useState('')

  // Step 4 — OTP
  const [otpCode, setOtpCode] = useState('')
  const [otpKey, setOtpKey] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)

  // Indique e Ganhe (C4) — código do link ou digitado. Nunca bloqueia o cadastro.
  const referral = useSignupReferral()

  // Provedores: com o Google ligado, o cadastro abre na escolha (L2); sem ele, no passo 1.
  useEffect(() => {
    let alive = true
    void fetchSocialProviders().then((p) => {
      if (!alive) return
      setGoogleOn(p.google)
      setMode((m) => (m === 'loading' ? (p.google ? 'choice' : 'email') : m))
    })
    return () => {
      alive = false
    }
  }, [])

  // Roteiro Google: nome/e-mail vêm do retorno; num reload, busca de novo com o segredo guardado.
  useEffect(() => {
    if (mode !== 'google' || prefill) return
    if (!socialFlow) {
      setMode('choice')
      setStep(0)
      return
    }
    let alive = true
    void claimSocial(socialFlow).then((res) => {
      if (!alive) return
      if (res?.status === 'NEEDS_SIGNUP') setPrefill({ name: res.prefill.name, email: res.prefill.email })
      else if (res?.status === 'LOGGED_IN') {
        clearPendingFlow()
        finishAuth(res, 'google', { replace: true })
      } else setSocialNotice('expired')
    })
    return () => {
      alive = false
    }
  }, [mode, prefill, socialFlow, finishAuth])

  // Nome do Google preenchido (editável); volta o rascunho digitado antes de refazer o Google.
  useEffect(() => {
    if (mode !== 'google' || !prefill) return
    let draft: { nome?: string; cpf?: string; nasc?: string; tel?: string } | null = null
    try {
      draft = JSON.parse(sessionStorage.getItem(SOCIAL_DRAFT_KEY) ?? 'null')
      sessionStorage.removeItem(SOCIAL_DRAFT_KEY)
    } catch {
      draft = null
    }
    setNome((cur) => cur || draft?.nome || prefill.name)
    if (draft?.cpf) setCpfDisplay(draft.cpf)
    if (draft?.nasc) setDataNascimento(draft.nasc)
    if (draft?.tel) setTelefone(draft.tel)
  }, [mode, prefill])

  const selectedCondo = condos.find((c) => c.id === selectedCondoId) ?? null
  const isBlocksCondo = selectedCondo?.type === 'BLOCKS'
  // Opções de bloco vindas de numBlocks; sem esse dado, cai para input de texto livre.
  const blockChoices = isBlocksCondo && selectedCondo?.numBlocks ? blockOptions(selectedCondo.numBlocks) : []
  const useBlockSelect = blockChoices.length > 0

  // Load condos when reaching step 2
  useEffect(() => {
    if (step !== 2) return
    setCondosLoading(true)
    apiFetch('/condominiums')
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load condominiums')
        const data = (await res.json()) as Condo[]
        setCondos(data)
      })
      .catch(() => {
        setCondos([])
      })
      .finally(() => setCondosLoading(false))
  }, [step])

  // Troca de condomínio invalida o bloco escolhido (opções mudam / some para SINGLE_ENTRANCE)
  // e, junto com ele, o complemento — "Lado A" só faz sentido dentro do bloco de origem.
  useEffect(() => {
    setBloco(null)
    setComplemento('')
  }, [selectedCondoId])

  const handleCpfChange = (value: string) => {
    // Only allow digits and formatting chars
    const digits = value.replace(/\D/g, '').slice(0, 11)
    setCpfDisplay(formatCpf(digits))
    if (socialNotice === 'cpfTaken') setSocialNotice(null)
  }

  const handleBack = () => {
    setError(null)
    if (stepIndex > 0) {
      setStep(steps[stepIndex - 1])
      return
    }
    // Primeiro passo: volta para a escolha (L2) quando o Google está ligado.
    if (mode === 'google') {
      clearPendingFlow()
      setSocialFlow(null)
      setPrefill(null)
      setSocialNotice(null)
      setMode('choice')
      setStep(0)
    } else if (googleOn) {
      setMode('choice')
    } else {
      navigate('/')
    }
  }

  /** Roteiro Google, passo 3: cria a conta (sem senha, sem código) e entra. */
  const handleSocialComplete = async () => {
    setError(null)
    const birthDate = parseBirthDate(dataNascimento)
    if (!socialFlow || !birthDate) {
      setSocialNotice('expired')
      setStep(QUASE_LA)
      return
    }
    setLoading(true)
    const res = await completeSocialSignup(socialFlow, {
      name: nome.trim(),
      cpf: stripCpf(cpfDisplay),
      birthDate,
      phone: telefone,
      condominiumId: selectedCondoId!,
      apartment: apto,
      ...(isBlocksCondo && bloco ? { block: bloco } : {}),
      ...(isBlocksCondo && complemento.trim() ? { complement: complemento.trim() } : {}),
      ...referral.payload(),
    })
    setLoading(false)
    if (res.ok) {
      if (res.result.status === 'LOGGED_IN') {
        clearStoredReferral()
        clearPendingFlow()
        finishAuth(res.result, 'google', { replace: true })
        return
      }
      // O fluxo venceu ou foi usado em outra aba: refaz o Google sem perder o que foi digitado.
      setSocialNotice('expired')
      setStep(QUASE_LA)
      return
    }
    if (res.status === 409 && /CPF/i.test(res.error)) {
      setSocialNotice('cpfTaken')
      setStep(QUASE_LA)
      return
    }
    if (res.status === 409 && /telefone/i.test(res.error)) {
      setSocialNotice('telTaken')
      setStep(QUASE_LA)
      return
    }
    setError(res.error)
  }

  const restartGoogle = async () => {
    setRestarting(true)
    try {
      sessionStorage.setItem(SOCIAL_DRAFT_KEY, JSON.stringify({ nome, cpf: cpfDisplay, nasc: dataNascimento, tel: telefone }))
    } catch {
      // sem storage o rascunho se perde — a pessoa digita de novo
    }
    const started = await startSocial('google', 'register')
    if (!started.ok) {
      setRestarting(false)
      setError(started.error)
      return
    }
    navigate('/entrar/social')
  }

  const handleStep0Continue = () => {
    setError(null)
    setStep(1)
  }

  const handleStep1Continue = () => {
    setError(null)
    setStep(2)
  }

  const handleStep2Continue = () => {
    setError(null)
    setStep(3)
  }

  /** Step 3 CTA: register + send OTP (roteiro Google: cria a conta direto) */
  const handleStep3Submit = async () => {
    if (mode === 'google') return handleSocialComplete()
    setError(null)
    setLoading(true)
    try {
      const rawCpf = stripCpf(cpfDisplay)

      const regRes = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: nome,
          cpf: rawCpf,
          birthDate: parseBirthDate(dataNascimento),
          phone: telefone,
          email,
          password: senha,
          condominiumId: selectedCondoId!,
          apartment: apto,
          ...(isBlocksCondo && bloco ? { block: bloco } : {}),
          ...(isBlocksCondo && complemento.trim() ? { complement: complemento.trim() } : {}),
          ...referral.payload(),
        }),
      })

      if (regRes.status === 409) {
        setError('Esse CPF já tem uma conta. Faça login ou recupere o acesso.')
        return
      }

      if (!regRes.ok) {
        const err = (await regRes.json().catch(() => null)) as { error?: string } | null
        setError(err?.error ?? 'Algo deu errado. Verifique sua conexão e tente novamente.')
        return
      }

      const { userId: uid } = (await regRes.json()) as { userId: string }
      setUserId(uid)
      // O código do link já foi usado — não pode ficar para um próximo cadastro neste aparelho.
      clearStoredReferral()

      // Send OTP (sempre por e-mail neste primeiro momento)
      const otpRes = await apiFetch('/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })

      if (!otpRes.ok) {
        setError('Não foi possível enviar o código. Tente novamente.')
        return
      }

      setOtpCode('')
      setOtpKey((k) => k + 1)
      setStep(4)
    } catch {
      setError('Algo deu errado. Verifique sua conexão e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  /** Step 4: verify OTP */
  const handleOtpComplete = async (code: string) => {
    if (!userId) return
    if (loading) return // guard contra dupla submissão (OtpInput.onComplete + botão)
    setError(null)
    setLoading(true)
    try {
      let deviceId: string
      try {
        deviceId = localStorage.getItem('device_id') ?? crypto.randomUUID()
      } catch {
        deviceId = crypto.randomUUID()
      }

      const res = await apiFetch('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ userId, code, deviceId }),
      })

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        const msg = err?.error ?? ''
        if (msg.toLowerCase().includes('expir')) {
          setError('Código expirado. Solicite um novo.')
        } else {
          setError('Código incorreto. Verifique e tente de novo.')
        }
        setOtpCode('')
        setOtpKey((k) => k + 1)
        return
      }

      const { accessToken, refreshToken, user } = (await res.json()) as {
        accessToken: string
        refreshToken: string
        user: { id: string; role: 'CLIENT' | 'COURIER' | 'ADMIN'; name: string; creditBalance?: number }
      }
      auth.login(accessToken, refreshToken, { ...user, creditBalance: user.creditBalance ?? 0 }, 'otp')
      navigate('/client')
    } catch {
      setError('Algo deu errado. Verifique sua conexão e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!userId) return
    setError(null)
    await apiFetch('/auth/otp/send', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }).catch(() => null)
  }

  // CPF só é válido com 11 dígitos + dígitos verificadores módulo-11 (fonte única no shared).
  const cpfDigits = cpfDisplay.replace(/\D/g, '')
  const cpfComplete = cpfDigits.length === 11
  const cpfInvalid = cpfComplete && !isValidCpf(cpfDisplay)

  // Celular: mostra o aviso só quando o campo já está completo (11 dígitos) porém
  // inválido — mesmo padrão do CPF, para não alarmar enquanto o cliente digita.
  const phoneComplete = telefone.replace(/\D/g, '').length === 11
  const phoneInvalid = phoneComplete && !isValidBrMobile(telefone)

  // Step 0 CTA disabled until all fields filled
  const step0Valid = nome.trim() !== '' && isValidCpf(cpfDisplay) && dataNascimento.replace(/\D/g, '').length === 8

  // Step 1 CTA: telefone válido, e-mail, senha forte e confirmação coincidente
  const step1Valid =
    isValidBrMobile(telefone) &&
    email.trim().length > 0 &&
    isPasswordStrong(senha) &&
    senha === confirmaSenha

  // Step 3 CTA disabled until apartment filled (and block if BLOCKS condo)
  const step3Valid = apto.trim() !== '' && (!isBlocksCondo || (bloco?.trim() ?? '') !== '')

  const otpDestination = email
  const otpChannelLabel = 'e-mail'

  // C8 — lista de espera: toma a tela inteira (o handoff não mostra os passos nela), já com o que o
  // cadastro sabe. Voltar devolve à busca; "Voltar ao início" vai para a abertura do app.
  // L2 — escolha (Google / e-mail). Enquanto os provedores não respondem, só o fundo (sem piscar).
  if (mode === 'loading') return <div style={{ minHeight: '100dvh', background: 'var(--color-app-bg)' }} />
  if (mode === 'choice') {
    return (
      <RegisterChoice
        referral={referral}
        initialSocialError={navState?.socialError ?? null}
        onEmail={() => {
          setMode('email')
          setStep(0)
        }}
      />
    )
  }

  if (waitlistFor !== null) {
    return (
      <CondoWaitlist
        initial={{ condoName: waitlistFor, contactName: nome.trim(), contact: (mode === 'google' ? prefill?.email ?? '' : email).trim() }}
        onBack={() => setWaitlistFor(null)}
        onDone={() => navigate('/')}
      />
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100dvh',
        background: 'var(--color-app-bg)',
        padding: '4px 24px 24px',
        overflow: 'hidden',
      }}
    >
      {/* Back button */}
      <button
        type="button"
        aria-label="Voltar"
        onClick={handleBack}
        style={{
          background: 'var(--color-surface-2)',
          border: 'none',
          width: 38,
          height: 38,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--color-text)',
          flexShrink: 0,
          // 44px touch target
          padding: 3,
          marginLeft: -3,
        }}
      >
        <Icon name="arrowL" size={20} />
      </button>

      {/* Step dots */}
      <StepDots currentStep={stepIndex} totalSteps={steps.length} />

      {/* ─── Roteiro Google, passo 1: Quase lá (L4) ─── */}
      {step === QUASE_LA && mode === 'google' && (
        prefill ? (
          <SocialSignupStep
            email={prefill.email}
            name={nome}
            cpf={cpfDisplay}
            birthDate={dataNascimento}
            phone={telefone}
            onName={setNome}
            onCpf={handleCpfChange}
            onBirthDate={(v) => setDataNascimento(formatDate(v))}
            onPhone={(v) => {
              setTelefone(formatPhone(v))
              if (socialNotice === 'telTaken') setSocialNotice(null)
            }}
            referral={referral}
            notice={socialNotice}
            restarting={restarting}
            onRestartGoogle={() => void restartGoogle()}
            onLoginInstead={() => {
              clearPendingFlow()
              navigate('/login')
            }}
            onContinue={() => {
              setError(null)
              setStep(2)
            }}
          />
        ) : socialNotice === 'expired' ? (
          <SocialSignupStep
            email=""
            name={nome}
            cpf={cpfDisplay}
            birthDate={dataNascimento}
            phone={telefone}
            onName={setNome}
            onCpf={handleCpfChange}
            onBirthDate={(v) => setDataNascimento(formatDate(v))}
            onPhone={(v) => setTelefone(formatPhone(v))}
            referral={referral}
            notice="expired"
            restarting={restarting}
            onRestartGoogle={() => void restartGoogle()}
            onLoginInstead={() => navigate('/login')}
            onContinue={() => undefined}
          />
        ) : (
          <div style={{ flex: 1 }} />
        )
      )}

      {/* ─── Step 0: Seus dados ─── */}
      {step === 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Veio pelo link: o selo fica ACIMA do título; "Trocar" abre o campo com o código. */}
          {referral.linked && !referral.fieldOpen && (
            <div style={{ marginBottom: 18 }}>
              <ReferralBadge
                referrerName={referral.linked.referrerName}
                welcomeBreads={referral.linked.welcomeBreads}
                onChange={referral.openField}
              />
            </div>
          )}
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 28,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              color: 'var(--color-text)',
              margin: 0,
            }}
          >
            Seus dados
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              color: 'var(--color-text-sec)',
              marginTop: 8,
              marginBottom: 24,
              lineHeight: 1.5,
            }}
          >
            Precisamos disso uma única vez, pra deixar sua conta pronta.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FieldRow
              label="Nome completo"
              icon="user"
              value={nome}
              onChange={setNome}
              placeholder="Ex.: Marina Ribeiro"
            />
            <div>
              <FieldRow
                label="CPF"
                icon="card"
                value={cpfDisplay}
                onChange={handleCpfChange}
                placeholder="000.000.000-00"
                type="tel"
                autoComplete="off"
              />
              {cpfInvalid && (
                <div
                  style={{
                    fontSize: 12,
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-warn)',
                    marginTop: 6,
                  }}
                >
                  CPF inválido. Confira os números.
                </div>
              )}
            </div>
            <FieldRow
              label="Data de nascimento"
              icon="calendar"
              value={dataNascimento}
              onChange={(v) => setDataNascimento(formatDate(v))}
              placeholder="DD / MM / AAAA"
              type="tel"
            />
          </div>

          {/* Sem link: "Tenho um código de indicação" abaixo dos campos. Programa desligado: nada. */}
          {referral.active && (referral.fieldOpen || !referral.linked) && (
            <div style={{ marginTop: 18 }}>
              {referral.fieldOpen ? (
                <ReferralCodeField referral={referral} />
              ) : (
                <ReferralCodeToggle onOpen={referral.openField} />
              )}
            </div>
          )}

          <div style={{ flex: 1 }} />

          {error && <ErrorText>{error}</ErrorText>}

          {/* O código nunca bloqueia o Continuar — só a conferência em andamento. */}
          <PrimaryBtn
            onClick={handleStep0Continue}
            disabled={!step0Valid || referral.status === 'validating'}
          >
            Continuar
          </PrimaryBtn>
        </div>
      )}

      {/* ─── Step 1: Como falamos com você? ─── */}
      {step === 1 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 28,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              color: 'var(--color-text)',
              margin: 0,
            }}
          >
            Como falamos com você?
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              color: 'var(--color-text-sec)',
              marginTop: 8,
              marginBottom: 24,
              lineHeight: 1.5,
            }}
          >
            Precisamos do seu e-mail e do seu celular. Enviamos o código de acesso
            por <strong style={{ color: 'var(--color-text)' }}>e-mail</strong> e usamos o celular
            para os avisos de entrega.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FieldRow
              label="E-mail"
              icon="mail"
              value={email}
              onChange={setEmail}
              placeholder="voce@email.com"
              type="email"
              autoComplete="email"
            />
            <div>
              <FieldRow
                label="Celular"
                icon="phone"
                value={telefone}
                onChange={(v) => setTelefone(formatPhone(v))}
                placeholder="(11) 90000-0000"
                type="tel"
                autoComplete="tel"
              />
              {phoneInvalid && (
                <div
                  style={{
                    fontSize: 12,
                    fontFamily: 'var(--font-body)',
                    color: 'var(--color-warn)',
                    marginTop: 6,
                  }}
                >
                  Celular inválido. Confira o DDD e o número.
                </div>
              )}
            </div>
            <div>
              <FieldRow
                label="Senha"
                icon="lock"
                value={senha}
                onChange={setSenha}
                placeholder="Crie uma senha"
                type="password"
                autoComplete="new-password"
              />
              <PasswordCriteria password={senha} />
            </div>
            <FieldRow
              label="Confirme a senha"
              icon="lock"
              value={confirmaSenha}
              onChange={setConfirmaSenha}
              placeholder="Repita a senha"
              type="password"
              autoComplete="new-password"
            />
            {confirmaSenha.length > 0 && senha !== confirmaSenha && (
              <ErrorText>As senhas não coincidem.</ErrorText>
            )}
          </div>

          <div style={{ flex: 1 }} />

          {error && <ErrorText>{error}</ErrorText>}

          <PrimaryBtn
            onClick={handleStep1Continue}
            disabled={!step1Valid}
          >
            Continuar
          </PrimaryBtn>
        </div>
      )}

      {/* ─── Step 2: Onde você mora? ─── */}
      {step === 2 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 28,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              color: 'var(--color-text)',
              margin: 0,
            }}
          >
            Onde você mora?
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              color: 'var(--color-text-sec)',
              marginTop: 8,
              marginBottom: 16,
              lineHeight: 1.5,
            }}
          >
            Entregamos só nos condomínios parceiros já cadastrados.
          </p>

          {condosLoading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 15, color: 'var(--color-text-ter)' }}>Carregando...</span>
            </div>
          ) : (
            <CondoSearch
              condos={condos}
              selectedId={selectedCondoId}
              onNotListed={(query) => setWaitlistFor(query)}
              onSelect={(id) => {
                setSelectedCondoId(id)
                setBloco(null) // reset block when condo changes
                setComplemento('')
              }}
            />
          )}

          <div style={{ paddingTop: 16 }}>
            {error && <ErrorText>{error}</ErrorText>}

            <PrimaryBtn
              onClick={handleStep2Continue}
              disabled={selectedCondoId === null}
            >
              Continuar
            </PrimaryBtn>
          </div>
        </div>
      )}

      {/* ─── Step 3: Seu endereço ─── */}
      {step === 3 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 28,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              color: 'var(--color-text)',
              margin: 0,
            }}
          >
            Seu endereço
          </h1>
          {selectedCondo && (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                color: 'var(--color-text-sec)',
                marginTop: 8,
                marginBottom: 24,
                lineHeight: 1.5,
              }}
            >
              {selectedCondo.name} · {selectedCondo.neighborhood}
            </p>
          )}

          {/* Bloco/Torre — só para condomínios BLOCKS. Select quando numBlocks é
              conhecido; senão cai para input de texto livre. */}
          {isBlocksCondo &&
            (useBlockSelect ? (
              <SelectRow
                label="Bloco / Torre"
                icon="pin"
                value={bloco ?? ''}
                onChange={(v) => setBloco(v || null)}
                placeholder="Selecione o bloco"
                options={blockChoices}
              />
            ) : (
              <FieldRow
                label="Bloco / Torre"
                icon="pin"
                value={bloco ?? ''}
                onChange={(v) => setBloco(v || null)}
                placeholder="Ex.: A ou 1"
              />
            ))}

          {/* Complemento — subdivisão do bloco ("Lado A"). Opcional e curto: entra no cupom
              impresso e na parada do entregador, onde não há espaço para endereço livre. */}
          {isBlocksCondo && (
            <FieldRow
              label="Complemento (opcional)"
              icon="pin"
              value={complemento}
              onChange={(v) => setComplemento(v.slice(0, COMPLEMENT_MAX_LENGTH))}
              placeholder="Ex.: Lado A"
              maxLength={COMPLEMENT_MAX_LENGTH}
            />
          )}

          {/* Em entrada única o endereço pode ser casa/lote ("25A"), então o campo aceita
              texto — teclado numérico travaria a letra no celular. */}
          <FieldRow
            label={apartmentFieldLabel(selectedCondo?.type)}
            icon="pin"
            value={apto}
            onChange={setApto}
            placeholder={apartmentFieldPlaceholder(selectedCondo?.type)}
          />

          <div style={{ flex: 1 }} />

          {error && <ErrorText>{error}</ErrorText>}

          <PrimaryBtn
            onClick={handleStep3Submit}
            disabled={!step3Valid || loading}
            style={{ whiteSpace: 'nowrap' }}
          >
            {mode === 'google'
              ? loading ? 'Criando conta…' : 'Criar conta e ver meu pão'
              : loading ? 'Enviando...' : 'Enviar código de confirmação'}
          </PrimaryBtn>
        </div>
      )}

      {/* ─── Step 4: Confirme seu cadastro (OTP) ─── */}
      {step === 4 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 28,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              color: 'var(--color-text)',
              margin: 0,
            }}
          >
            Confirme seu cadastro
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              color: 'var(--color-text-sec)',
              marginTop: 8,
              marginBottom: 24,
              lineHeight: 1.5,
            }}
          >
            Enviamos 4 dígitos por{' '}
            <strong style={{ color: 'var(--color-text)' }}>{otpChannelLabel}</strong> para{' '}
            <strong style={{ color: 'var(--color-text)' }}>{otpDestination}</strong>.
          </p>

          <OtpInput
            key={otpKey}
            onComplete={(code) => { setOtpCode(code); void handleOtpComplete(code) }}
          />

          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <ResendTimer onResend={handleResend} />
          </div>

          <div style={{ flex: 1 }} />

          {error && <ErrorText>{error}</ErrorText>}

          <PrimaryBtn
            onClick={() => {
              if (otpCode.length === 4) void handleOtpComplete(otpCode)
            }}
            disabled={otpCode.length < 4 || loading}
          >
            {loading ? 'Verificando...' : 'Criar conta e ver meu pão'}
          </PrimaryBtn>
        </div>
      )}
    </div>
  )
}

/* ─── Internal sub-components ─── */

interface FieldRowProps {
  label?: string
  icon: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  autoComplete?: string
  maxLength?: number
}

function FieldRow({ label, icon, value, onChange, placeholder, type = 'text', autoComplete, maxLength }: FieldRowProps) {
  const [focused, setFocused] = useState(false)
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword ? (visible ? 'text' : 'password') : type
  return (
    <label style={{ display: 'block' }}>
      {label && (
        <div
          style={{
            fontSize: 12,
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            color: 'var(--color-text-sec)',
            marginBottom: 7,
            letterSpacing: '0.01em',
          }}
        >
          {label}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--color-surface-alt)',
          border: `1.5px solid ${focused ? 'var(--color-accent)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-field)',
          padding: '12px 14px',
          transition: 'border-color 0.15s ease',
        }}
      >
        <Icon name={icon} size={18} color="var(--color-text-ter)" />
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          maxLength={maxLength}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 15,
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            color: 'var(--color-text)',
            minWidth: 0,
          }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-sec)',
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 700,
              padding: '2px 4px',
              flexShrink: 0,
            }}
          >
            {visible ? 'Ocultar' : 'Mostrar'}
          </button>
        )}
      </div>
    </label>
  )
}

interface SelectRowProps {
  label?: string
  icon: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  options: string[]
}

function SelectRow({ label, icon, value, onChange, placeholder, options }: SelectRowProps) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} style={{ display: 'block', position: 'relative' }}>
      {label && (
        <div
          style={{
            fontSize: 12,
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            color: 'var(--color-text-sec)',
            marginBottom: 7,
            letterSpacing: '0.01em',
          }}
        >
          {label}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--color-surface-alt)',
          border: `1.5px solid ${open ? 'var(--color-accent)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-field)',
          padding: '12px 14px',
          transition: 'border-color 0.15s ease',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <Icon name={icon} size={18} color="var(--color-text-ter)" />
        <span
          style={{
            flex: 1,
            fontSize: 15,
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            color: value ? 'var(--color-text)' : 'var(--color-text-ter)',
            minWidth: 0,
          }}
        >
          {value || placeholder || 'Selecione'}
        </span>
        <span
          style={{
            display: 'inline-flex',
            transition: 'transform 0.18s ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <Icon name="chevD" size={16} color="var(--color-text-ter)" />
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 20,
            background: 'var(--color-surface)',
            border: '1.5px solid var(--color-border)',
            borderRadius: 'var(--radius-field)',
            boxShadow: 'var(--shadow-strong)',
            padding: 6,
            maxHeight: 260,
            overflowY: 'auto',
          }}
        >
          {options.map((opt) => {
            const selected = opt === value
            const active = selected || hovered === opt
            return (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(opt)
                  setOpen(false)
                }}
                onMouseEnter={() => setHovered(opt)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: active ? 'var(--color-surface-2)' : 'transparent',
                  border: 'none',
                  borderRadius: 10,
                  padding: '11px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 15,
                  fontFamily: 'var(--font-body)',
                  fontWeight: selected ? 700 : 400,
                  color: selected ? 'var(--color-accent)' : 'var(--color-text)',
                  transition: 'background 0.12s ease',
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>{opt}</span>
                {selected && <Icon name="check" size={16} color="var(--color-accent)" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface PrimaryBtnProps {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
  style?: React.CSSProperties
}

function PrimaryBtn({ onClick, disabled, children, style }: PrimaryBtnProps) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        minHeight: 44,
        backgroundColor: 'var(--color-espresso)',
        color: 'var(--color-primary-btn-text)',
        borderRadius: 'var(--radius-btn)',
        fontFamily: 'var(--font-body)',
        fontSize: 15,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        padding: '16px 22px',
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'transform .15s, filter .15s',
        transform: hovered && !disabled ? 'translateY(-1px)' : 'translateY(0)',
        filter: hovered && !disabled ? 'brightness(1.05)' : 'none',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 12,
        fontFamily: 'var(--font-body)',
        fontWeight: 700,
        color: 'var(--color-accent)',
        marginBottom: 8,
        lineHeight: 1.4,
      }}
    >
      {children}
    </p>
  )
}
