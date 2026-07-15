import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { Icon } from '../../components/brand/Icon'
import { StepDots } from '../../components/auth/StepDots'
import { CondoSearch } from '../../components/auth/CondoSearch'
import { OtpInput } from '../../components/auth/OtpInput'
import { ResendTimer } from '../../components/auth/ResendTimer'
import { useAuth } from '../../hooks/useAuth'
import { apiFetch } from '../../lib/apiFetch'
import { PasswordCriteria, isPasswordStrong } from '../../components/auth/AuthUI'
import { isValidCpf } from '@cheirin-de-pao/shared'

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
  const digits = raw.replace(/\D/g, '').slice(0, 11)
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

const TOTAL_STEPS = 5

export function OnboardingScreen() {
  const navigate = useNavigate()
  const auth = useAuth()

  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
  const [condos, setCondos] = useState<Condo[]>([])
  const [condosLoading, setCondosLoading] = useState(false)
  const [selectedCondoId, setSelectedCondoId] = useState<string | null>(null)

  // Step 3 — Endereço
  const [bloco, setBloco] = useState<string | null>(null)
  const [apto, setApto] = useState('')

  // Step 4 — OTP
  const [otpCode, setOtpCode] = useState('')
  const [otpKey, setOtpKey] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)

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

  // Troca de condomínio invalida o bloco escolhido (opções mudam / some para SINGLE_ENTRANCE).
  useEffect(() => {
    setBloco(null)
  }, [selectedCondoId])

  const handleCpfChange = (value: string) => {
    // Only allow digits and formatting chars
    const digits = value.replace(/\D/g, '').slice(0, 11)
    setCpfDisplay(formatCpf(digits))
  }

  const handleBack = () => {
    setError(null)
    if (step === 0) {
      navigate('/')
    } else {
      setStep((s) => s - 1)
    }
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

  /** Step 3 CTA: register + send OTP */
  const handleStep3Submit = async () => {
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
      auth.login(accessToken, refreshToken, { ...user, creditBalance: user.creditBalance ?? 0 })
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

  // Step 0 CTA disabled until all fields filled
  const step0Valid = nome.trim() !== '' && isValidCpf(cpfDisplay) && dataNascimento.replace(/\D/g, '').length === 8

  // Step 1 CTA: telefone, e-mail, senha forte e confirmação coincidente
  const step1Valid =
    telefone.trim().length > 0 &&
    email.trim().length > 0 &&
    isPasswordStrong(senha) &&
    senha === confirmaSenha

  // Step 3 CTA disabled until apartment filled (and block if BLOCKS condo)
  const step3Valid = apto.trim() !== '' && (!isBlocksCondo || (bloco?.trim() ?? '') !== '')

  const otpDestination = email
  const otpChannelLabel = 'e-mail'

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
      <StepDots currentStep={step} totalSteps={TOTAL_STEPS} />

      {/* ─── Step 0: Seus dados ─── */}
      {step === 0 && (
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

          <div style={{ flex: 1 }} />

          {error && <ErrorText>{error}</ErrorText>}

          <PrimaryBtn
            onClick={handleStep0Continue}
            disabled={!step0Valid}
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
            <FieldRow
              label="Celular"
              icon="phone"
              value={telefone}
              onChange={(v) => setTelefone(formatPhone(v))}
              placeholder="(11) 90000-0000"
              type="tel"
              autoComplete="tel"
            />
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
              onSelect={(id) => {
                setSelectedCondoId(id)
                setBloco(null) // reset block when condo changes
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

          <FieldRow
            label="Apartamento"
            icon="pin"
            value={apto}
            onChange={setApto}
            placeholder="Ex.: 102"
            type="tel"
          />

          <div style={{ flex: 1 }} />

          {error && <ErrorText>{error}</ErrorText>}

          <PrimaryBtn
            onClick={handleStep3Submit}
            disabled={!step3Valid || loading}
            style={{ whiteSpace: 'nowrap' }}
          >
            {loading ? 'Enviando...' : 'Enviar código de confirmação'}
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
}

function FieldRow({ label, icon, value, onChange, placeholder, type = 'text', autoComplete }: FieldRowProps) {
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
