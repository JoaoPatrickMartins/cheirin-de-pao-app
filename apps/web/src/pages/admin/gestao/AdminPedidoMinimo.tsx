import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'

// ------------------------------------------------------------------ tipos
type WeekdayMinimums = {
  seg: number
  ter: number
  qua: number
  qui: number
  sex: number
  sab: number
  dom: number
}

interface PedidoMinimoSettings {
  unico: number
  agenda: WeekdayMinimums
}

interface AdminPedidoMinimoProps {
  onBack: () => void
}

const DAYS: Array<{ label: string; key: keyof WeekdayMinimums }> = [
  { label: 'Segunda', key: 'seg' },
  { label: 'Terça', key: 'ter' },
  { label: 'Quarta', key: 'qua' },
  { label: 'Quinta', key: 'qui' },
  { label: 'Sexta', key: 'sex' },
  { label: 'Sábado', key: 'sab' },
  { label: 'Domingo', key: 'dom' },
]

const DEFAULT_AGENDA: WeekdayMinimums = { seg: 1, ter: 1, qua: 1, qui: 1, sex: 1, sab: 1, dom: 1 }

// ------------------------------------------------------------------ componente
export function AdminPedidoMinimo({ onBack }: AdminPedidoMinimoProps) {
  const [unico, setUnico] = useState(1)
  const [agenda, setAgenda] = useState<WeekdayMinimums>(DEFAULT_AGENDA)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await apiFetch('/admin/settings/pedido-minimo')
        if (res.ok) {
          const data = (await res.json()) as PedidoMinimoSettings
          if (typeof data.unico === 'number' && data.unico >= 1) setUnico(data.unico)
          if (data.agenda && typeof data.agenda === 'object') {
            setAgenda({ ...DEFAULT_AGENDA, ...data.agenda })
          }
        }
      } catch {
        // falha silenciosa
      } finally {
        setIsLoading(false)
      }
    }
    void fetchSettings()
  }, [])

  const handleSalvar = async () => {
    setError(null)
    setSaved(false)
    setIsSaving(true)
    try {
      const res = await apiFetch('/admin/settings/pedido-minimo', {
        method: 'PATCH',
        body: JSON.stringify({ unico, agenda }),
      })
      if (res.ok) {
        setSaved(true)
      } else {
        setError('Não foi possível salvar. Tente novamente.')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  const setDay = (key: keyof WeekdayMinimums, v: number) => {
    setSaved(false)
    setAgenda((prev) => ({ ...prev, [key]: v }))
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* AppBar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px 14px' }}>
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
          Pedido mínimo
        </h2>
      </div>

      {/* Conteúdo scrollável */}
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
        {isLoading ? (
          <div style={{ textAlign: 'center', paddingTop: 32 }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
              Carregando...
            </span>
          </div>
        ) : (
          <>
            {/* ---------------- Pedido único ---------------- */}
            <div>
              <p style={sectionTitle}>Pedido único</p>
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <p style={rowTitle}>Mínimo por pedido</p>
                    <p style={rowHint}>Menos que isso não é aceito no pedido único</p>
                  </div>
                  <NumberStepper
                    value={unico}
                    min={1}
                    max={20}
                    onChange={(v) => {
                      setSaved(false)
                      setUnico(v)
                    }}
                  />
                </div>
              </div>
            </div>

            {/* ---------------- Agenda semanal ---------------- */}
            <div>
              <p style={sectionTitle}>Agenda semanal</p>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12.5,
                  color: 'var(--color-text-ter)',
                  lineHeight: 1.5,
                  margin: '0 0 10px',
                }}
              >
                Mínimo por dia da semana. Vale por turno: se o cliente pedir naquele dia, precisa ser
                pelo menos esse valor. Use 0 para não exigir mínimo no dia.
              </p>
              <div style={{ ...cardStyle, gap: 0 }}>
                {DAYS.map(({ label, key }, idx) => (
                  <div key={key}>
                    {idx > 0 && <div style={{ height: 1, background: 'var(--color-border-2)', margin: '12px 0' }} />}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <p style={{ ...rowTitle, margin: 0 }}>{label}</p>
                      <NumberStepper value={agenda[key]} min={0} max={12} onChange={(v) => setDay(key, v)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Erro */}
            {error && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--color-accent)', margin: 0 }}>
                {error}
              </p>
            )}

            {/* Sucesso */}
            {saved && !error && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--color-text-sec)', margin: 0 }}>
                Configuração salva e aplicada aos novos pedidos.
              </p>
            )}

            {/* Botão salvar */}
            <button
              type="button"
              onClick={() => void handleSalvar()}
              disabled={isSaving}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                minHeight: 44,
                background: 'var(--color-espresso)',
                color: '#FAF5EC',
                border: 'none',
                borderRadius: 14,
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                fontWeight: 700,
                cursor: isSaving ? 'default' : 'pointer',
                opacity: isSaving ? 0.6 : 1,
                letterSpacing: '-0.01em',
              }}
            >
              {isSaving ? 'Salvando...' : 'Salvar configuração'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ estilos compartilhados
const sectionTitle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 12.5,
  fontWeight: 700,
  color: 'var(--color-text-sec)',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  margin: '0 0 9px',
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-2)',
  borderRadius: 16,
  padding: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const rowTitle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--color-text)',
  margin: 0,
}

const rowHint: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 11.5,
  fontWeight: 600,
  color: 'var(--color-text-ter)',
  margin: '2px 0 0',
}

// ------------------------------------------------------------------ primitiva local
interface NumberStepperProps {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}

function NumberStepper({ value, min, max, onChange }: NumberStepperProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        aria-label="Diminuir"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        style={{
          width: 36,
          height: 36,
          border: 'none',
          background: 'var(--color-surface)',
          cursor: value <= min ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: value <= min ? 0.4 : 1,
        }}
      >
        <Icon name="minus" size={16} color="var(--color-text)" />
      </button>
      <span
        style={{
          minWidth: 32,
          textAlign: 'center',
          fontFamily: 'var(--font-display)',
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--color-text)',
        }}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label="Aumentar"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        style={{
          width: 36,
          height: 36,
          border: 'none',
          background: 'var(--color-surface)',
          cursor: value >= max ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: value >= max ? 0.4 : 1,
        }}
      >
        <Icon name="plus" size={16} color="var(--color-text)" />
      </button>
    </div>
  )
}
