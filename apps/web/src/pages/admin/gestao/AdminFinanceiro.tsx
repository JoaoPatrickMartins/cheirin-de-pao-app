import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { SegmentedControl } from '../../../components/admin/SegmentedControl'
import { BarChart } from '../../../components/admin/BarChart'

// ------------------------------------------------------------------ tipos
type Period = 'day' | 'week' | 'month'

interface CondoRevenue {
  condominiumId: string
  condominiumName: string
  total: number
}

interface FinancialData {
  total: number
  byType: {
    combos: number
    avulso: number
  }
  byCondominium: CondoRevenue[]
}

interface AdminFinanceiroProps {
  onBack: () => void
}

const PERIOD_TABS = [
  { key: 'day' as Period, label: 'Dia' },
  { key: 'week' as Period, label: 'Semana' },
  { key: 'month' as Period, label: 'Mês' },
]

const PERIOD_LABELS: Record<Period, string> = {
  day: 'Receita · hoje',
  week: 'Receita · esta semana',
  month: 'Receita · este mês',
}

// ------------------------------------------------------------------ helpers
function formatBRL(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

// ------------------------------------------------------------------ componente
export function AdminFinanceiro({ onBack }: AdminFinanceiroProps) {
  const [period, setPeriod] = useState<Period>('day')
  const [data, setData] = useState<FinancialData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/admin/financial?period=${period}`)
        if (res.ok) {
          setData((await res.json()) as FinancialData)
        }
      } catch {
        // falha silenciosa
      } finally {
        setIsLoading(false)
      }
    }
    void fetchData()
  }, [period])

  // Montar dados do BarChart a partir de byCondominium
  const barData =
    data?.byCondominium.slice(0, 7).map((c, i, arr) => ({
      label: c.condominiumName.slice(0, 4),
      value: c.total,
      highlight: i === Math.min(arr.length - 2, arr.length - 1),
    })) ?? []

  const maxCondo = data ? Math.max(...(data.byCondominium.map((c) => c.total) || [1]), 1) : 1
  const totalTipo = data ? data.byType.combos + data.byType.avulso : 0

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
            flex: 1,
          }}
        >
          Financeiro
        </h2>
      </div>

      {/* Conteúdo */}
      <div style={{ overflow: 'auto', flex: 1, padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* SegmentedControl */}
        <SegmentedControl tabs={PERIOD_TABS} value={period} onChange={setPeriod} />

        {isLoading ? (
          <div style={{ paddingTop: 32, textAlign: 'center' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
              Carregando...
            </span>
          </div>
        ) : data ? (
          <>
            {/* Card receita total */}
            <div
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-2)',
                borderRadius: 18,
                padding: '18px 18px 14px',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--color-text-sec)',
                  margin: '0 0 4px',
                }}
              >
                {PERIOD_LABELS[period]}
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 34,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'var(--color-text)',
                  margin: '0 0 16px',
                }}
              >
                {formatBRL(data.total)}
              </p>
              <BarChart data={barData.length > 0 ? barData : [{ label: '—', value: 0 }]} height={80} />
            </div>

            {/* Card por tipo */}
            <div
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-2)',
                borderRadius: 18,
                padding: 18,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  margin: '0 0 14px',
                }}
              >
                Por tipo de compra
              </p>

              {/* Barra proporcional */}
              <div
                style={{
                  height: 10,
                  borderRadius: 99,
                  overflow: 'hidden',
                  background: 'var(--color-surface-2)',
                  marginBottom: 12,
                  display: 'flex',
                }}
              >
                {totalTipo > 0 && (
                  <>
                    <div
                      style={{
                        width: `${(data.byType.combos / totalTipo) * 100}%`,
                        background: 'var(--color-gold)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                    <div
                      style={{
                        flex: 1,
                        background: 'rgba(176,112,42,0.35)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </>
                )}
              </div>

              {/* Legenda */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--color-gold)', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-sec)' }}>
                      Combos
                    </span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                    {formatBRL(data.byType.combos)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(176,112,42,0.35)', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-sec)' }}>
                      Compra personalizada
                    </span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                    {formatBRL(data.byType.avulso)}
                  </span>
                </div>
              </div>
            </div>

            {/* Card por condomínio */}
            {data.byCondominium.length > 0 && (
              <div
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-2)',
                  borderRadius: 18,
                  padding: 18,
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--color-text)',
                    margin: '0 0 14px',
                  }}
                >
                  Por condomínio
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.byCondominium.map((c) => (
                    <div key={c.condominiumId} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'var(--color-text-sec)',
                          }}
                        >
                          {c.condominiumName}
                        </span>
                        <span
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: 13,
                            fontWeight: 700,
                            color: 'var(--color-text)',
                          }}
                        >
                          {formatBRL(c.total)}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 6,
                          borderRadius: 99,
                          background: 'var(--color-surface-2)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${(c.total / maxCondo) * 100}%`,
                            background: 'var(--color-gold)',
                            borderRadius: 99,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ paddingTop: 32, textAlign: 'center' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
              Falha na conexão. Tente novamente.
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
