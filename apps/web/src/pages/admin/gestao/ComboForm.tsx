import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'

// ------------------------------------------------------------------ tipos
interface ComboFormProps {
  id?: string
  onBack: () => void
  onSaved: () => void
}

// ------------------------------------------------------------------ componente
export function ComboForm({ id, onBack, onSaved }: ComboFormProps) {
  const [nome, setNome] = useState('')
  const [subtitulo, setSubtitulo] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [preco, setPreco] = useState('')
  const [tag, setTag] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(!!id)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const fetchCombo = async () => {
      try {
        const res = await apiFetch(`/admin/combos/${id}`)
        if (res.ok) {
          const data = (await res.json()) as {
            name: string
            quantity: number
            price: number
            tag?: string | null
            description?: string | null
          }
          setNome(data.name)
          setSubtitulo(data.description ?? '')
          setQuantidade(String(data.quantity))
          setPreco(String(data.price))
          setTag(data.tag ?? '')
        }
      } catch {
        // falha silenciosa
      } finally {
        setIsLoading(false)
      }
    }
    void fetchCombo()
  }, [id])

  const handleSalvar = async () => {
    setError(null)
    setIsSaving(true)
    try {
      const body = {
        name: nome.trim(),
        quantity: Number(quantidade),
        price: Number(preco),
        ...(subtitulo.trim() ? { description: subtitulo.trim() } : {}),
        ...(tag.trim() ? { tag: tag.trim() } : {}),
      }
      const res = await apiFetch(id ? `/admin/combos/${id}` : '/admin/combos', {
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
    nome.trim() !== '' && Number(quantidade) > 0 && Number(preco) > 0

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
          {id ? 'Editar combo' : 'Novo combo'}
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
          label="Nome do combo"
          icon="bag"
          value={nome}
          onChange={setNome}
          placeholder="Ex.: Combo da semana"
        />

        <FormField
          label="Subtítulo (opcional)"
          icon="bag"
          value={subtitulo}
          onChange={setSubtitulo}
          placeholder="Ex.: O equilíbrio da casa"
        />

        <FormField
          label="Quantidade de pães"
          icon="bag"
          type="number"
          value={quantidade}
          onChange={setQuantidade}
          placeholder="Ex.: 10"
        />

        <FormField
          label="Preço (R$)"
          icon="coin"
          type="number"
          value={preco}
          onChange={setPreco}
          placeholder="Ex.: 25.90"
          step="0.01"
        />

        <FormField
          label="Tag (opcional)"
          icon="percent"
          value={tag}
          onChange={setTag}
          placeholder="ex: Mais popular"
        />

        {/* Espaço flexível */}
        <div style={{ flex: 1 }} />

        {/* Erro */}
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

        {/* Botão salvar */}
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
          {isSaving ? 'Salvando...' : 'Salvar combo'}
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
