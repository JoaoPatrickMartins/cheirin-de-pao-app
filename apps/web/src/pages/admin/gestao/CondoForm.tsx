import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { SegmentedControl } from '../../../components/admin/SegmentedControl'

// ------------------------------------------------------------------ tipos
type CondoTipo = 'SINGLE_ENTRANCE' | 'BLOCKS'

interface CondoFormProps {
  id?: string
  onBack: () => void
  onSaved: () => void
}

const TIPO_TABS = [
  { key: 'SINGLE_ENTRANCE' as CondoTipo, label: 'Entrada única' },
  { key: 'BLOCKS' as CondoTipo, label: 'Blocos/Torres' },
]

// ------------------------------------------------------------------ máscaras
function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/** Formata CEP para 00000-000. */
function maskCEP(value: string): string {
  const d = onlyDigits(value).slice(0, 8)
  return d.replace(/^(\d{5})(\d)/, '$1-$2')
}

// ------------------------------------------------------------------ componente
export function CondoForm({ id, onBack, onSaved }: CondoFormProps) {
  const [nome, setNome] = useState('')
  const [rua, setRua] = useState('')
  const [numero, setNumero] = useState('')
  const [complemento, setComplemento] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [cep, setCep] = useState('')
  const [tipo, setTipo] = useState<CondoTipo>('SINGLE_ENTRANCE')
  const [numBlocos, setNumBlocos] = useState('1')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(!!id)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const fetchCondo = async () => {
      try {
        const res = await apiFetch(`/admin/condominiums/${id}`)
        if (res.ok) {
          const data = (await res.json()) as {
            name: string
            address?: {
              street?: string | null
              number?: string | null
              complement?: string | null
              city?: string | null
              state?: string | null
              zip?: string | null
            } | null
            type: CondoTipo
            numBlocks?: number | null
          }
          setNome(data.name)
          setRua(data.address?.street ?? '')
          setNumero(data.address?.number ?? '')
          setComplemento(data.address?.complement ?? '')
          setCidade(data.address?.city ?? '')
          setEstado(data.address?.state ?? '')
          setCep(maskCEP(data.address?.zip ?? ''))
          setTipo(data.type)
          setNumBlocos(String(data.numBlocks ?? 1))
        }
      } catch {
        // falha silenciosa
      } finally {
        setIsLoading(false)
      }
    }
    void fetchCondo()
  }, [id])

  const handleSalvar = async () => {
    setError(null)
    setIsSaving(true)
    try {
      const body = {
        name: nome.trim(),
        address: {
          street: rua.trim(),
          number: numero.trim(),
          ...(complemento.trim() ? { complement: complemento.trim() } : {}),
          city: cidade.trim(),
          state: estado.trim().toUpperCase(),
          zip: onlyDigits(cep),
        },
        type: tipo,
        ...(tipo === 'BLOCKS' ? { numBlocks: Number(numBlocos) } : {}),
      }
      const res = await apiFetch(id ? `/admin/condominiums/${id}` : '/admin/condominiums', {
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
          {id ? 'Editar condomínio' : 'Novo condomínio'}
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
          icon="building"
          value={nome}
          onChange={setNome}
          placeholder="Ex.: Residencial das Flores"
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
              placeholder="Portaria, ponto de referência"
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

        {/* Tipo */}
        <div>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12.5,
              fontWeight: 700,
              color: 'var(--color-text-sec)',
              letterSpacing: '0.01em',
              marginBottom: 10,
            }}
          >
            Tipo de condomínio
          </div>
          <SegmentedControl tabs={TIPO_TABS} value={tipo} onChange={setTipo} />
        </div>

        {/* Número de blocos — condicional */}
        {tipo === 'BLOCKS' && (
          <FormField
            label="Número de blocos/torres"
            icon="building"
            type="number"
            value={numBlocos}
            onChange={setNumBlocos}
            placeholder="Ex.: 4"
          />
        )}

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
          {isSaving ? 'Salvando...' : 'Salvar condomínio'}
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
