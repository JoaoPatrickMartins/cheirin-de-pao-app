import { useState } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'

// ------------------------------------------------------------------ tipos
interface EntregadorFormProps {
  onBack: () => void
  onSaved: () => void
}

// ------------------------------------------------------------------ componente
export function EntregadorForm({ onBack, onSaved }: EntregadorFormProps) {
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSalvar = async () => {
    setError(null)
    setIsSaving(true)
    try {
      const body = {
        name: nome.trim(),
        cpf: cpf.trim(),
        phone: telefone.trim(),
        email: email.trim(),
      }
      const res = await apiFetch('/admin/couriers', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (res.ok) {
        onSaved()
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        setError(err?.error ?? 'Não foi possível cadastrar. Tente novamente.')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  const isValid = nome.trim() !== '' && cpf.trim() !== ''

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
          Cadastrar entregador
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
          value={cpf}
          onChange={setCpf}
          placeholder="000.000.000-00"
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
          placeholder="joao@email.com"
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
          {isSaving ? 'Cadastrando...' : 'Cadastrar entregador'}
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
}

function FormField({ label, icon, value, onChange, placeholder, type = 'text' }: FormFieldProps) {
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
