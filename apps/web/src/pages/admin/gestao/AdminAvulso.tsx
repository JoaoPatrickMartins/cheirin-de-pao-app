import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'

// ------------------------------------------------------------------ tipos
interface AvulsoSettings {
  limit: number
  unitPrice: number
  referenceCombo?: {
    name: string
    price: number
    quantity: number
  } | null
}

interface AdminAvulsoProps {
  onBack: () => void
}

// ------------------------------------------------------------------ helpers
function formatBRL(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

// ------------------------------------------------------------------ componente
export function AdminAvulso({ onBack }: AdminAvulsoProps) {
  const [limite, setLimite] = useState(10)
  const [precoPorao, setPrecoPorao] = useState(0.5)
  const [referenceCombo, setReferenceCombo] = useState<AvulsoSettings['referenceCombo']>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await apiFetch('/admin/settings/avulso')
        if (res.ok) {
          const data = (await res.json()) as AvulsoSettings
          if (typeof data.limit === 'number' && data.limit > 0) setLimite(data.limit)
          if (typeof data.unitPrice === 'number' && data.unitPrice > 0) setPrecoPorao(data.unitPrice)
          if (data.referenceCombo) setReferenceCombo(data.referenceCombo)
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
      const res = await apiFetch('/admin/settings/avulso', {
        method: 'PATCH',
        body: JSON.stringify({ limit: limite, unitPrice: precoPorao }),
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

  // Cálculo da prévia
  const totalAvulso = precoPorao * limite
  const comboPrecoPorPao = referenceCombo
    ? referenceCombo.price / referenceCombo.quantity
    : null
  const avulsoMaisCaroPorPao = comboPrecoPorPao !== null && precoPorao > comboPrecoPorPao
  const percentDiff =
    comboPrecoPorPao !== null && comboPrecoPorPao > 0
      ? Math.round(((precoPorao - comboPrecoPorPao) / comboPrecoPorPao) * 100)
      : null

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
          Compra personalizada
        </h2>
      </div>

      {/* Conteúdo scrollável */}
      <div style={{ overflow: 'auto', flex: 1, padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Instrução */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13.5,
            color: 'var(--color-text-sec)',
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          O preço por pão deve ficar acima do melhor combo para empurrar o cliente ao combo.
        </p>

        {/* Card com steppers */}
        {isLoading ? (
          <div style={{ textAlign: 'center', paddingTop: 32 }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
              Carregando...
            </span>
          </div>
        ) : (
          <>
            <div
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-2)',
                borderRadius: 16,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
              }}
            >
              {/* Limite máximo */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--color-text)',
                      margin: 0,
                    }}
                  >
                    Limite máximo
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: 'var(--color-text-ter)',
                      margin: '2px 0 0',
                    }}
                  >
                    A partir daqui, só via combo
                  </p>
                </div>
                <NumberStepper
                  value={limite}
                  min={1}
                  max={100}
                  onChange={(v) => {
                    setSaved(false)
                    setLimite(v)
                  }}
                />
              </div>

              {/* Separador */}
              <div
                style={{
                  height: 1,
                  background: 'var(--color-border-2)',
                  margin: '14px 0',
                }}
              />

              {/* Preço por pão */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--color-text)',
                      margin: 0,
                    }}
                  >
                    Preço por pão
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: 'var(--color-text-ter)',
                      margin: '2px 0 0',
                    }}
                  >
                    Compra personalizada
                  </p>
                </div>
                <PriceStepper
                  value={precoPorao}
                  step={0.05}
                  min={0.05}
                  onChange={(v) => {
                    setSaved(false)
                    setPrecoPorao(v)
                  }}
                />
              </div>
            </div>

            {/* Card espresso — prévia do incentivo */}
            <div
              style={{
                background: 'var(--color-espresso)',
                borderRadius: 16,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: '#E3AC3F',
                  letterSpacing: '0.06em',
                  margin: 0,
                }}
              >
                PRÉVIA DO INCENTIVO
              </p>

              {/* Linha avulso */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 13.5,
                    color: '#C7B595',
                  }}
                >
                  Avulso (até {limite} pães)
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 16,
                    fontWeight: 800,
                    color: '#FAF5EC',
                  }}
                >
                  {formatBRL(totalAvulso)}
                </span>
              </div>

              {/* Linha combo (referência) */}
              {referenceCombo && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 13.5,
                      color: '#C7B595',
                    }}
                  >
                    {referenceCombo.name} ({referenceCombo.quantity} pães)
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 16,
                      fontWeight: 800,
                      color: '#E3AC3F',
                    }}
                  >
                    {formatBRL(referenceCombo.price)}
                  </span>
                </div>
              )}

              {/* Banner de resultado */}
              {percentDiff !== null && (
                <div
                  style={{
                    borderRadius: 12,
                    background: avulsoMaisCaroPorPao
                      ? 'rgba(227,172,63,0.16)'
                      : 'rgba(176,112,42,0.16)',
                    padding: '10px 12px',
                    textAlign: 'center',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: avulsoMaisCaroPorPao ? '#E3AC3F' : '#C7B595',
                    }}
                  >
                    {avulsoMaisCaroPorPao
                      ? `Combo fica ${Math.abs(percentDiff)}% mais barato por pão`
                      : 'Ajuste: o avulso precisa custar mais que o combo'}
                  </span>
                </div>
              )}
            </div>

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

            {/* Sucesso */}
            {saved && !error && (
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--color-text-sec)',
                  margin: 0,
                }}
              >
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

// ------------------------------------------------------------------ primitivas locais
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

interface PriceStepperProps {
  value: number
  step: number
  min: number
  onChange: (v: number) => void
}

function PriceStepper({ value, step, min, onChange }: PriceStepperProps) {
  const decrement = () => {
    const next = Math.round((value - step) * 100) / 100
    if (next >= min) onChange(next)
  }
  const increment = () => {
    const next = Math.round((value + step) * 100) / 100
    onChange(next)
  }

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
        aria-label="Diminuir preço"
        onClick={decrement}
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
          minWidth: 52,
          textAlign: 'center',
          fontFamily: 'var(--font-display)',
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--color-text)',
        }}
      >
        R$ {value.toFixed(2)}
      </span>
      <button
        type="button"
        aria-label="Aumentar preço"
        onClick={increment}
        style={{
          width: 36,
          height: 36,
          border: 'none',
          background: 'var(--color-surface)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="plus" size={16} color="var(--color-text)" />
      </button>
    </div>
  )
}
