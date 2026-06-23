import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'

// ------------------------------------------------------------------ tipos
interface FornecedorFormProps {
  id?: string
  onBack: () => void
  onSaved: () => void
}

// ------------------------------------------------------------------ máscaras + validação
function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/** Formata para 00.000.000/0000-00 conforme o usuário digita. */
function maskCNPJ(value: string): string {
  const d = onlyDigits(value).slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

/** Formata telefone para (00) 0000-0000 ou (00) 00000-0000. */
function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length <= 2) return d.replace(/^(\d{0,2})/, '($1')
  if (d.length <= 6) return d.replace(/^(\d{2})(\d{0,4})/, '($1) $2')
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
}

/** Validação completa de CNPJ (14 dígitos + dígitos verificadores). */
function isValidCNPJ(value: string): boolean {
  const d = onlyDigits(value)
  if (d.length !== 14) return false
  if (/^(\d)\1{13}$/.test(d)) return false // rejeita sequências repetidas

  const calcDigit = (base: string): number => {
    let factor = base.length - 7
    let sum = 0
    for (let i = 0; i < base.length; i++) {
      sum += Number(base[i]) * factor
      factor = factor === 2 ? 9 : factor - 1
    }
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }

  const firstDigit = calcDigit(d.slice(0, 12))
  if (firstDigit !== Number(d[12])) return false
  const secondDigit = calcDigit(d.slice(0, 13))
  return secondDigit === Number(d[13])
}

/** Formata CEP para 00000-000. */
function maskCEP(value: string): string {
  const d = onlyDigits(value).slice(0, 8)
  return d.replace(/^(\d{5})(\d)/, '$1-$2')
}

/** Máscara de moeda baseada em centavos: "45" → "0,45", "455" → "4,55". */
function maskCurrency(value: string): string {
  const d = onlyDigits(value)
  if (!d) return ''
  return (parseInt(d, 10) / 100).toFixed(2).replace('.', ',')
}

/** Converte o valor mascarado para número em reais. "4,55" → 4.55 */
function parseCurrency(masked: string): number {
  const d = onlyDigits(masked)
  return d ? parseInt(d, 10) / 100 : 0
}

/** Formata um número de reais para exibição com vírgula. 0.45 → "0,45" */
function formatCurrencyFromNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2).replace('.', ',') : ''
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

// ------------------------------------------------------------------ componente
export function FornecedorForm({ id, onBack, onSaved }: FornecedorFormProps) {
  const [nome, setNome] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [precoPorPao, setPrecoPorPao] = useState('')
  const [rua, setRua] = useState('')
  const [numero, setNumero] = useState('')
  const [complemento, setComplemento] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [cep, setCep] = useState('')
  const [isPrincipal, setIsPrincipal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(!!id)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const fetchFornecedor = async () => {
      try {
        const res = await apiFetch(`/admin/suppliers/${id}`)
        if (res.ok) {
          const data = (await res.json()) as {
            name: string
            cnpj?: string | null
            phone?: string | null
            email?: string | null
            pricePerUnit: number
            isPrincipal: boolean
            address?: {
              street?: string | null
              number?: string | null
              complement?: string | null
              city?: string | null
              state?: string | null
              zip?: string | null
            } | null
          }
          setNome(data.name)
          setCnpj(maskCNPJ(data.cnpj ?? ''))
          setTelefone(maskPhone(data.phone ?? ''))
          setEmail(data.email ?? '')
          setPrecoPorPao(formatCurrencyFromNumber(data.pricePerUnit))
          setRua(data.address?.street ?? '')
          setNumero(data.address?.number ?? '')
          setComplemento(data.address?.complement ?? '')
          setCidade(data.address?.city ?? '')
          setEstado(data.address?.state ?? '')
          setCep(data.address?.zip ?? '')
          setIsPrincipal(data.isPrincipal)
        }
      } catch {
        // falha silenciosa
      } finally {
        setIsLoading(false)
      }
    }
    void fetchFornecedor()
  }, [id])

  const handleSalvar = async () => {
    setError(null)
    setIsSaving(true)
    try {
      const body = {
        name: nome.trim(),
        ...(cnpj.trim() ? { cnpj: onlyDigits(cnpj) } : {}),
        ...(telefone.trim() ? { phone: onlyDigits(telefone) } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
        pricePerUnit: parseCurrency(precoPorPao),
        isPrincipal,
        address: {
          street: rua.trim(),
          number: numero.trim(),
          ...(complemento.trim() ? { complement: complemento.trim() } : {}),
          city: cidade.trim(),
          state: estado.trim().toUpperCase(),
          zip: cep.trim(),
        },
      }
      const res = await apiFetch(id ? `/admin/suppliers/${id}` : '/admin/suppliers', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      })
      if (res.ok) {
        onSaved()
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        setError(err?.error ?? 'Não foi possível salvar. Tente novamente.')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  const isValid =
    nome.trim() !== '' &&
    isValidCNPJ(cnpj) &&
    (email.trim() === '' || isValidEmail(email.trim())) &&
    parseCurrency(precoPorPao) > 0 &&
    rua.trim() !== '' &&
    numero.trim() !== '' &&
    cidade.trim() !== '' &&
    estado.trim().length === 2 &&
    cep.trim() !== ''

  if (isLoading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
          Carregando...
        </span>
      </div>
    )
  }

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
          {id ? 'Editar fornecedor' : 'Novo fornecedor'}
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
          label="Nome"
          icon="factory"
          value={nome}
          onChange={setNome}
          placeholder="Padaria Estrela"
        />

        <FormField
          label="CNPJ"
          icon="building"
          type="tel"
          value={cnpj}
          onChange={(v) => setCnpj(maskCNPJ(v))}
          placeholder="00.000.000/0001-00"
          error={cnpj.trim() !== '' && !isValidCNPJ(cnpj) ? 'CNPJ inválido' : undefined}
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
          placeholder="contato@padaria.com"
          error={email.trim() !== '' && !isValidEmail(email.trim()) ? 'E-mail inválido' : undefined}
        />

        <FormField
          label="Preço por pão"
          icon="coin"
          type="tel"
          prefix="R$"
          value={precoPorPao}
          onChange={(v) => setPrecoPorPao(maskCurrency(v))}
          placeholder="0,45"
        />

        {/* Endereço */}
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--color-text-sec)',
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            marginTop: 4,
          }}
        >
          Endereço
        </div>

        <FormField
          label="Rua"
          icon="pin"
          value={rua}
          onChange={setRua}
          placeholder="Rua das Flores"
        />

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <FormField
              label="Número"
              icon="home"
              value={numero}
              onChange={setNumero}
              placeholder="123"
            />
          </div>
          <div style={{ flex: 1 }}>
            <FormField
              label="Complemento"
              icon="edit"
              value={complemento}
              onChange={setComplemento}
              placeholder="Sala 2"
            />
          </div>
        </div>

        <FormField
          label="Cidade"
          icon="building"
          value={cidade}
          onChange={setCidade}
          placeholder="São Paulo"
        />

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <FormField
              label="Estado (UF)"
              icon="pin"
              value={estado}
              onChange={(v) => setEstado(v.toUpperCase().slice(0, 2))}
              placeholder="SP"
            />
          </div>
          <div style={{ flex: 1 }}>
            <FormField
              label="CEP"
              icon="mail"
              type="tel"
              value={cep}
              onChange={(v) => setCep(maskCEP(v))}
              placeholder="00000-000"
            />
          </div>
        </div>

        {/* Switch Fornecedor principal */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--color-surface-alt, #FBF6EC)',
            border: '1.5px solid var(--color-border)',
            borderRadius: 14,
            padding: '12px 14px',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14.5,
              fontWeight: 700,
              color: 'var(--color-text)',
            }}
          >
            Fornecedor principal
          </span>
          <SwitchToggle on={isPrincipal} onChange={() => setIsPrincipal((p) => !p)} />
        </div>

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
          {isSaving ? 'Salvando...' : 'Salvar fornecedor'}
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
  step?: string
  error?: string
  prefix?: string
}

function FormField({ label, icon, value, onChange, placeholder, type = 'text', step, error, prefix }: FormFieldProps) {
  const [focused, setFocused] = useState(false)
  const borderColor = error
    ? 'var(--color-accent)'
    : focused
      ? 'var(--color-accent)'
      : 'var(--color-border)'

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
          border: `1.5px solid ${borderColor}`,
          borderRadius: 14,
          padding: '12px 14px',
          transition: 'border-color 0.15s ease',
        }}
      >
        <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={18} color="var(--color-text-ter)" />
        {prefix && (
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--color-text-sec)',
            }}
          >
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value}
          step={step}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
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

// ------------------------------------------------------------------ SwitchToggle
interface SwitchToggleProps {
  on: boolean
  onChange: () => void
}

function SwitchToggle({ on, onChange }: SwitchToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      style={{
        width: 44,
        height: 26,
        borderRadius: 99,
        border: 'none',
        background: on ? 'var(--color-gold)' : 'var(--color-border)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s ease',
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  )
}
