import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'

// ------------------------------------------------------------------ tipos
interface FornecedorFormProps {
  id?: string
  onBack: () => void
  onSaved: () => void
}

// ------------------------------------------------------------------ componente
export function FornecedorForm({ id, onBack, onSaved }: FornecedorFormProps) {
  const [nome, setNome] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [precoPorPao, setPrecoPorPao] = useState('')
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
            pricePerBread: number
            isPrincipal: boolean
          }
          setNome(data.name)
          setCnpj(data.cnpj ?? '')
          setTelefone(data.phone ?? '')
          setEmail(data.email ?? '')
          setPrecoPorPao(String(data.pricePerBread))
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
        ...(cnpj.trim() ? { cnpj: cnpj.trim() } : {}),
        ...(telefone.trim() ? { phone: telefone.trim() } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
        pricePerBread: Number(precoPorPao),
        isPrincipal,
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

  const isValid = nome.trim() !== '' && Number(precoPorPao) > 0

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
          value={cnpj}
          onChange={setCnpj}
          placeholder="00.000.000/0001-00"
        />

        <FormField
          label="Telefone"
          icon="phone"
          type="tel"
          value={telefone}
          onChange={setTelefone}
          placeholder="(11) 99999-9999"
        />

        <FormField
          label="E-mail"
          icon="mail"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="contato@padaria.com"
        />

        <FormField
          label="Preço por pão (R$)"
          icon="coin"
          type="number"
          value={precoPorPao}
          onChange={setPrecoPorPao}
          placeholder="0.45"
          step="0.01"
        />

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
}

function FormField({ label, icon, value, onChange, placeholder, type = 'text', step }: FormFieldProps) {
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
          border: `1.5px solid ${focused ? 'var(--color-accent)' : 'var(--color-border)'}`,
          borderRadius: 14,
          padding: '12px 14px',
          transition: 'border-color 0.15s ease',
        }}
      >
        <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={18} color="var(--color-text-ter)" />
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
