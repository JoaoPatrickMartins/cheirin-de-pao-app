import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'

interface GanchoSettings {
  pedidoUnicoMin: number
  preco: number
}

interface AdminGanchoProps {
  onBack: () => void
}

function formatBRL(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

export function AdminGancho({ onBack }: AdminGanchoProps) {
  const [pedidoUnicoMin, setPedidoUnicoMin] = useState(10)
  const [preco, setPreco] = useState(5)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await apiFetch('/admin/settings/gancho')
        if (res.ok) {
          const data = (await res.json()) as GanchoSettings
          if (typeof data.pedidoUnicoMin === 'number' && data.pedidoUnicoMin > 0) setPedidoUnicoMin(data.pedidoUnicoMin)
          if (typeof data.preco === 'number' && data.preco >= 0) setPreco(data.preco)
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
      const res = await apiFetch('/admin/settings/gancho', {
        method: 'PATCH',
        body: JSON.stringify({ pedidoUnicoMin, preco }),
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
          Gancho de porta
        </h2>
      </div>

      <div style={{ overflow: 'auto', flex: 1, padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--color-text-sec)', lineHeight: 1.5, margin: 0 }}>
          O cliente ganha o gancho grátis (uma vez) ao comprar um combo ou fazer um pedido único a
          partir do mínimo abaixo. Depois disso, pode pedir um novo gancho pagando o valor definido.
        </p>

        {isLoading ? (
          <div style={{ textAlign: 'center', paddingTop: 32 }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>Carregando...</span>
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
              }}
            >
              {/* Mínimo do pedido único */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                    Mínimo do pedido único
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-ter)', margin: '2px 0 0' }}>
                    Pães no pedido único para dar direito ao gancho grátis
                  </p>
                </div>
                <NumberStepper
                  value={pedidoUnicoMin}
                  min={1}
                  max={50}
                  onChange={(v) => {
                    setSaved(false)
                    setPedidoUnicoMin(v)
                  }}
                />
              </div>

              <div style={{ height: 1, background: 'var(--color-border-2)', margin: '14px 0' }} />

              {/* Preço do gancho adicional */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                    Preço do gancho extra
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-ter)', margin: '2px 0 0' }}>
                    Reposição por defeito/perda (pago via Pix)
                  </p>
                </div>
                <PriceStepper
                  value={preco}
                  step={0.5}
                  min={0}
                  onChange={(v) => {
                    setSaved(false)
                    setPreco(v)
                  }}
                />
              </div>
            </div>

            {/* Prévia */}
            <div
              style={{
                background: 'var(--color-espresso)',
                borderRadius: 16,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 700, color: '#E3AC3F', letterSpacing: '0.06em', margin: 0 }}>
                COMO FICA
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: '#FAF5EC', margin: 0, lineHeight: 1.5 }}>
                Grátis ao comprar combo ou pedido único de {pedidoUnicoMin}+ pães. Gancho extra por{' '}
                <strong>{formatBRL(preco)}</strong>.
              </p>
            </div>

            {error && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--color-accent)', margin: 0 }}>{error}</p>
            )}
            {saved && !error && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--color-text-sec)', margin: 0 }}>
                Configuração salva.
              </p>
            )}

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
      <span style={{ minWidth: 32, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
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
      <span style={{ minWidth: 52, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
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
