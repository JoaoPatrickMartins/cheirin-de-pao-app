import { useState, useEffect, useRef } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { lookupCep } from '../../../lib/viacep'
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

/** Faz parse de "lat, long" (formato copiável do Google Maps). Retorna null se inválido. */
function parseCoords(s: string): { lat: number; lng: number } | null {
  const parts = s.split(',').map((x) => parseFloat(x.trim()))
  if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    return { lat: parts[0], lng: parts[1] }
  }
  return null
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
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'notfound'>('idle')
  const lastCepLookup = useRef('')
  const [coords, setCoords] = useState('')
  const [locApprox, setLocApprox] = useState(false)

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
            lat?: number | null
            lng?: number | null
            approxLocation?: boolean
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
          if (data.lat != null && data.lng != null) setCoords(`${data.lat}, ${data.lng}`)
          setLocApprox(Boolean(data.approxLocation))
        }
      } catch {
        // falha silenciosa
      } finally {
        setIsLoading(false)
      }
    }
    void fetchCondo()
  }, [id])

  // Auto-preenchimento de endereço pelo CEP via ViaCEP. Dispara quando o usuário completa
  // os 8 dígitos; preenche rua/cidade/UF (o número continua manual).
  const handleCepChange = (v: string) => {
    const masked = maskCEP(v)
    setCep(masked)
    const digits = onlyDigits(masked)
    if (digits.length !== 8) {
      setCepStatus('idle')
      return
    }
    if (digits === lastCepLookup.current) return
    lastCepLookup.current = digits
    setCepStatus('loading')
    void lookupCep(masked).then((addr) => {
      if (!addr) {
        setCepStatus('notfound')
        return
      }
      setCepStatus('idle')
      if (addr.street) setRua(addr.street)
      if (addr.city) setCidade(addr.city)
      if (addr.uf) setEstado(addr.uf)
    })
  }

  // Coordenadas manuais têm prioridade; ao informar coords válidas, a marca de
  // "localização aproximada" deixa de fazer sentido.
  const handleCoordsChange = (v: string) => {
    setCoords(v)
    if (parseCoords(v)) setLocApprox(false)
  }

  const handleSalvar = async () => {
    setError(null)
    setIsSaving(true)
    try {
      const parsedCoords = parseCoords(coords)
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
        // Coordenadas manuais (têm prioridade sobre a geocodificação do endereço).
        ...(parsedCoords ? { lat: parsedCoords.lat, lng: parsedCoords.lng } : {}),
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
              onChange={handleCepChange}
              placeholder="00000-000"
            />
          </div>
        </div>

        {cepStatus !== 'idle' && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 600,
              color: cepStatus === 'notfound' ? 'var(--color-warn)' : 'var(--color-text-ter)',
              margin: '-8px 0 0',
            }}
          >
            {cepStatus === 'loading'
              ? 'Buscando endereço pelo CEP…'
              : 'CEP não encontrado — preencha o endereço manualmente.'}
          </p>
        )}

        {/* Localização no mapa (coordenadas manuais — opcional) */}
        <div>
          <FormField
            label="Localização no mapa (lat, long)"
            icon="pin"
            value={coords}
            onChange={handleCoordsChange}
            placeholder="-21.7546, -41.3242"
          />
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 600,
              color: locApprox ? 'var(--color-warn)' : 'var(--color-text-ter)',
              margin: '6px 0 0',
              lineHeight: 1.45,
            }}
          >
            {locApprox
              ? '⚠ Localização aproximada (centro da cidade). Cole as coordenadas exatas do Google Maps para a rota ficar precisa.'
              : 'Opcional. No Google Maps, clique no local e copie as coordenadas. Em branco, localizamos pelo endereço.'}
          </p>
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
