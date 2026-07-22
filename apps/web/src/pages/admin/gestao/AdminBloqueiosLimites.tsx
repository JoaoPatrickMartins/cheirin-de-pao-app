import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'

// ------------------------------------------------------------------ tipos
type Weekday = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom'
type DiasBloqueados = Record<Weekday, boolean>
type LimitePedidosDia = Record<Weekday, number>

interface RestricoesSettings {
  diasBloqueados: DiasBloqueados
  limitePedidosDia: LimitePedidosDia
}

interface AdminBloqueiosLimitesProps {
  onBack: () => void
}

const DAYS: Array<{ label: string; key: Weekday }> = [
  { label: 'Segunda', key: 'seg' },
  { label: 'Terça', key: 'ter' },
  { label: 'Quarta', key: 'qua' },
  { label: 'Quinta', key: 'qui' },
  { label: 'Sexta', key: 'sex' },
  { label: 'Sábado', key: 'sab' },
  { label: 'Domingo', key: 'dom' },
]

const DEFAULT_BLOQUEADOS: DiasBloqueados = { seg: false, ter: false, qua: false, qui: false, sex: false, sab: false, dom: false }
const DEFAULT_LIMITES: LimitePedidosDia = { seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 }

// ------------------------------------------------------------------ componente
export function AdminBloqueiosLimites({ onBack }: AdminBloqueiosLimitesProps) {
  const [bloqueados, setBloqueados] = useState<DiasBloqueados>(DEFAULT_BLOQUEADOS)
  const [limites, setLimites] = useState<LimitePedidosDia>(DEFAULT_LIMITES)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await apiFetch('/admin/settings/restricoes-dias')
        if (res.ok) {
          const data = (await res.json()) as RestricoesSettings
          if (data.diasBloqueados && typeof data.diasBloqueados === 'object') {
            setBloqueados({ ...DEFAULT_BLOQUEADOS, ...data.diasBloqueados })
          }
          if (data.limitePedidosDia && typeof data.limitePedidosDia === 'object') {
            setLimites({ ...DEFAULT_LIMITES, ...data.limitePedidosDia })
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
      const res = await apiFetch('/admin/settings/restricoes-dias', {
        method: 'PATCH',
        body: JSON.stringify({ diasBloqueados: bloqueados, limitePedidosDia: limites }),
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

  const toggleBloqueio = (key: Weekday) => {
    setSaved(false)
    setBloqueados((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const setLimite = (key: Weekday, v: number) => {
    setSaved(false)
    setLimites((prev) => ({ ...prev, [key]: v }))
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
          Bloqueios e limites
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
            <div>
              <p style={sectionTitle}>Dias da semana</p>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12.5,
                  color: 'var(--color-text-ter)',
                  lineHeight: 1.5,
                  margin: '0 0 10px',
                }}
              >
                Bloqueie os dias em que não há entrega — vale para pedido único e agenda semanal.
                Defina também o limite de pedidos por dia (0 = sem limite).
              </p>

              <div style={{ ...cardStyle, gap: 0 }}>
                {DAYS.map(({ label, key }, idx) => {
                  const blocked = bloqueados[key]
                  return (
                    <div key={key}>
                      {idx > 0 && <div style={{ height: 1, background: 'var(--color-border-2)', margin: '14px 0' }} />}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ ...rowTitle, margin: 0 }}>{label}</p>
                          <p style={rowHint}>{blocked ? 'Bloqueado — sem entregas' : 'Aceita entregas'}</p>
                        </div>
                        <Toggle checked={blocked} onChange={() => toggleBloqueio(key)} label={`Bloquear ${label}`} />
                      </div>

                      {/* Limite de pedidos — desabilitado quando o dia está bloqueado */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          marginTop: 10,
                          opacity: blocked ? 0.4 : 1,
                        }}
                      >
                        <p style={{ ...rowHint, margin: 0 }}>
                          Limite de pedidos {limites[key] === 0 ? '(sem limite)' : ''}
                        </p>
                        <NumberStepper
                          value={limites[key]}
                          min={0}
                          max={999}
                          disabled={blocked}
                          onChange={(v) => setLimite(key, v)}
                        />
                      </div>
                    </div>
                  )
                })}
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
                Configuração salva. Clientes com agenda em dias bloqueados foram avisados.
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

// ------------------------------------------------------------------ Toggle
interface ToggleProps {
  checked: boolean
  onChange: () => void
  label: string
}

function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      style={{
        position: 'relative',
        width: 46,
        height: 28,
        borderRadius: 999,
        border: 'none',
        background: checked ? 'var(--color-accent)' : 'var(--color-border)',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 0.15s ease',
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 21 : 3,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.15s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        }}
      />
    </button>
  )
}

// ------------------------------------------------------------------ NumberStepper
interface NumberStepperProps {
  value: number
  min: number
  max: number
  step?: number
  disabled?: boolean
  onChange: (v: number) => void
}

function NumberStepper({ value, min, max, step = 1, disabled = false, onChange }: NumberStepperProps) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const decDisabled = disabled || value <= min
  const incDisabled = disabled || value >= max
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
        onClick={() => onChange(clamp(value - step))}
        disabled={decDisabled}
        style={{
          width: 36,
          height: 36,
          border: 'none',
          background: 'var(--color-surface)',
          cursor: decDisabled ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: decDisabled ? 0.4 : 1,
        }}
      >
        <Icon name="minus" size={16} color="var(--color-text)" />
      </button>
      <span
        style={{
          minWidth: 38,
          textAlign: 'center',
          fontFamily: 'var(--font-display)',
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--color-text)',
        }}
      >
        {value === 0 ? '∞' : value}
      </span>
      <button
        type="button"
        aria-label="Aumentar"
        onClick={() => onChange(clamp(value + step))}
        disabled={incDisabled}
        style={{
          width: 36,
          height: 36,
          border: 'none',
          background: 'var(--color-surface)',
          cursor: incDisabled ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: incDisabled ? 0.4 : 1,
        }}
      >
        <Icon name="plus" size={16} color="var(--color-text)" />
      </button>
    </div>
  )
}
