import { useState } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'

// ------------------------------------------------------------------ tipos
/** Dados iniciais do entregador em modo edição (vindos da lista — não há GET /:id). */
interface EntregadorFormInitial {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  cpf?: string | null
}

interface EntregadorFormProps {
  /** Se presente, o formulário entra em modo edição (PATCH). Ausente = cadastro (POST). */
  entregador?: EntregadorFormInitial
  onBack: () => void
  onSaved: () => void
}

// ------------------------------------------------------------------ máscaras + validação
function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/** Formata CPF para 000.000.000-00 conforme o usuário digita. */
function maskCPF(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

/** Formata telefone para (00) 0000-0000 ou (00) 00000-0000. */
function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length <= 2) return d.replace(/^(\d{0,2})/, '($1')
  if (d.length <= 6) return d.replace(/^(\d{2})(\d{0,4})/, '($1) $2')
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
}

/** Validação completa de CPF (11 dígitos + dígitos verificadores). */
function isValidCPF(value: string): boolean {
  const d = onlyDigits(value)
  if (d.length !== 11) return false
  if (/^(\d)\1{10}$/.test(d)) return false // rejeita sequências repetidas

  const calcDigit = (length: number): number => {
    let sum = 0
    for (let i = 0; i < length; i++) {
      sum += Number(d[i]) * (length + 1 - i)
    }
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }

  return calcDigit(9) === Number(d[9]) && calcDigit(10) === Number(d[10])
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

// ------------------------------------------------------------------ componente
export function EntregadorForm({ entregador, onBack, onSaved }: EntregadorFormProps) {
  const isEdit = !!entregador
  const [nome, setNome] = useState(entregador?.name ?? '')
  const [cpf, setCpf] = useState(entregador?.cpf ? maskCPF(entregador.cpf) : '')
  const [telefone, setTelefone] = useState(entregador?.phone ? maskPhone(entregador.phone) : '')
  const [email, setEmail] = useState(entregador?.email ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSalvar = async () => {
    setError(null)
    setIsSaving(true)
    try {
      // Em edição o CPF é imutável — não é enviado no PATCH.
      const body = {
        name: nome.trim(),
        ...(isEdit ? {} : { cpf: onlyDigits(cpf) }),
        ...(telefone.trim() ? { phone: onlyDigits(telefone) } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
      }
      const res = await apiFetch(isEdit ? `/admin/couriers/${entregador.id}` : '/admin/couriers', {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      })
      if (res.ok) {
        onSaved()
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        setError(
          err?.error ??
            (isEdit
              ? 'Não foi possível salvar. Tente novamente.'
              : 'Não foi possível cadastrar. Tente novamente.'),
        )
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  const isValid =
    nome.trim() !== '' &&
    (isEdit || isValidCPF(cpf)) &&
    (email.trim() === '' || isValidEmail(email.trim()))

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* AppBar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 20px 14px',
        }}
      >
        <button
          type="button"
          aria-label="Voltar"
          onClick={onBack}
          style={{
            background: 'var(--color-surface-2)',
            border: 'none',
            width: 36,
            height: 36,
            borderRadius: 11,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Icon name="arrowL" size={18} color="var(--color-text)" />
        </button>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--color-text)',
            margin: 0,
          }}
        >
          {isEdit ? 'Editar entregador' : 'Cadastrar entregador'}
        </h2>
      </div>

      {/* Campos */}
      <div
        style={{
          overflow: 'auto',
          flex: 1,
          padding: '0 20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <FormField
          label="Nome completo"
          icon="user"
          value={nome}
          onChange={setNome}
          placeholder="Ex.: João Silva"
        />

        <FormField
          label="CPF"
          icon="card"
          type="tel"
          value={cpf}
          onChange={(v) => setCpf(maskCPF(v))}
          placeholder="000.000.000-00"
          // CPF é imutável após o cadastro — bloqueado em modo edição.
          disabled={isEdit}
          error={!isEdit && cpf.trim() !== '' && !isValidCPF(cpf) ? 'CPF inválido' : undefined}
        />

        <FormField
          label="Telefone"
          icon="phone"
          type="tel"
          value={telefone}
          onChange={(v) => setTelefone(maskPhone(v))}
          placeholder="(11) 99999-9999"
        />

        <FormField
          label="E-mail"
          icon="mail"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="joao@email.com"
          error={email.trim() !== '' && !isValidEmail(email.trim()) ? 'E-mail inválido' : undefined}
        />

        <div style={{ flex: 1 }} />

        {error && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--color-accent)',
              margin: 0,
            }}
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleSalvar()}
          disabled={!isValid || isSaving}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            minHeight: 52,
            background: 'var(--color-espresso)',
            color: '#FAF5EC',
            border: 'none',
            borderRadius: 16,
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            fontWeight: 700,
            cursor: !isValid || isSaving ? 'default' : 'pointer',
            opacity: !isValid || isSaving ? 0.5 : 1,
            letterSpacing: '-0.01em',
          }}
        >
          {isSaving
            ? isEdit
              ? 'Salvando...'
              : 'Cadastrando...'
            : isEdit
              ? 'Salvar'
              : 'Cadastrar entregador'}
        </button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ FormField
interface FormFieldProps {
  label: string
  icon: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  error?: string
  disabled?: boolean
}

function FormField({ label, icon, value, onChange, placeholder, type = 'text', error, disabled }: FormFieldProps) {
  const [focused, setFocused] = useState(false)

  return (
    <label style={{ display: 'block' }}>
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12.5,
          fontWeight: 700,
          color: 'var(--color-text-sec)',
          letterSpacing: '0.01em',
          marginBottom: 7,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--color-surface-alt, #FBF6EC)',
          border: `1.5px solid ${error || focused ? 'var(--color-accent)' : 'var(--color-border)'}`,
          borderRadius: 14,
          padding: '12px 14px',
          transition: 'border-color 0.15s ease',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={18} color="var(--color-text-ter)" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 500,
            color: 'var(--color-text)',
            minWidth: 0,
            cursor: disabled ? 'not-allowed' : 'text',
          }}
        />
      </div>
      {error && (
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11.5,
            fontWeight: 600,
            color: 'var(--color-accent)',
            marginTop: 5,
          }}
        >
          {error}
        </div>
      )}
    </label>
  )
}
