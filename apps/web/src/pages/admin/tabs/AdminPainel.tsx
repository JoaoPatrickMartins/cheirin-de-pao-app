import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { AdminHead } from '../../../components/admin/AdminHead'
import { KpiCard } from '../../../components/admin/KpiCard'
import { BarChart } from '../../../components/admin/BarChart'
import { BreadMark } from '../../../components/brand/BreadMark'
import { Icon } from '../../../components/brand/Icon'

type AdminTab = 'painel' | 'pedido' | 'separacao' | 'entregas' | 'clientes' | 'gestao'

interface DashboardData {
  breadsTodayCount: number
  breadsTodayProjected: number
  breadsTomorrowCount: number
  breadsTomorrowProjected: number
  breadsByWeekday: number[]
  revenueToday: number
  breadsTodayTrendPct: number
  revenueTrendPct: number
  clientsCount: number
  clientsNewCount: number
  condominiumsCount: number
  deliverySlots: Array<{ slotId: string; label: string; time: string; cutoffTime: string }>
  revenueByType: {
    combos: number
    avulso: number
  }
  stuckCount: number
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
// breadsByWeekday vem indexado Seg..Dom; mapeia para o índice JS de getDay() (0=Dom)
const WEEKDAY_TO_JS = [1, 2, 3, 4, 5, 6, 0]

function buildBarChartData(breadsByWeekday: number[], currentDayOfWeek: number) {
  const series = breadsByWeekday.length === 7 ? breadsByWeekday : [0, 0, 0, 0, 0, 0, 0]
  return series.map((value, i) => ({
    label: DAY_LABELS[WEEKDAY_TO_JS[i]],
    value,
    highlight: WEEKDAY_TO_JS[i] === currentDayOfWeek,
  }))
}

// Formata um delta percentual em badge ("+12%" / "-5%"); positivo (ou zero) = verde.
function trendPill(pct: number | undefined): { text: string; tone: 'good' | 'neutral' } | undefined {
  if (pct === undefined || pct === null) return undefined
  return { text: `${pct >= 0 ? '+' : ''}${pct}%`, tone: pct >= 0 ? 'good' : 'neutral' }
}

export function AdminPainel({ onNavigate }: { onNavigate: (tab: AdminTab) => void }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiFetch('/admin/dashboard')
        if (res.ok) {
          setData((await res.json()) as DashboardData)
        }
      } catch {
        // falha silenciosa — mantém estado anterior
      } finally {
        setIsLoading(false)
      }
    }
    void fetchData()
  }, [])

  const currentDayOfWeek = new Date().getDay()
  const barData = buildBarChartData(data?.breadsByWeekday ?? [], currentDayOfWeek)

  const totalReceita = data ? data.revenueByType.combos + data.revenueByType.avulso : 0
  const combosPercent = totalReceita > 0 ? (data!.revenueByType.combos / totalReceita) * 100 : 50
  const avulsoPercent = totalReceita > 0 ? (data!.revenueByType.avulso / totalReceita) * 100 : 50

  function formatCurrency(value: number) {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        paddingBottom: 24,
      }}
    >
      <AdminHead sub="Cheirin de Pão · Operação" titulo="Painel" />

      <div style={{ padding: '0 20px' }}>
        {isLoading ? (
          /* Loading state simples */
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '40px 0',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '3px solid var(--color-border)',
                borderTopColor: 'var(--color-accent)',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          </div>
        ) : (
          <>
            {/* Alerta — pedidos no limbo (sem desfecho) */}
            {data && data.stuckCount > 0 && (
              <button
                onClick={() => onNavigate('entregas')}
                aria-label="Ver pedidos parados"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  textAlign: 'left',
                  background: 'rgba(194,65,12,0.10)',
                  border: '1px solid rgba(194,65,12,0.30)',
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 12,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 11,
                    background: 'rgba(194,65,12,0.16)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="alert" size={20} color="var(--color-bad, #C2410C)" stroke={2.2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, fontWeight: 700, color: 'var(--color-bad, #C2410C)', margin: 0, lineHeight: 1.25 }}>
                    {data.stuckCount} pedido{data.stuckCount > 1 ? 's' : ''} parado{data.stuckCount > 1 ? 's' : ''}
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-sec)', margin: '2px 0 0', lineHeight: 1.3 }}>
                    Data passada sem desfecho — verifique em Entregas › Histórico › Parados
                  </p>
                </div>
                <Icon name="chevR" size={18} color="var(--color-bad, #C2410C)" stroke={2} />
              </button>
            )}

            {/* Grade 2x2 de KpiCards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                marginBottom: 12,
              }}
            >
              <KpiCard
                icon="bag"
                value={data?.breadsTodayCount ?? 0}
                label="Pães a entregar hoje"
                pill={trendPill(data?.breadsTodayTrendPct)}
                sub={data && data.breadsTodayProjected > 0 ? `+${data.breadsTodayProjected} previstos (agenda)` : undefined}
              />
              <KpiCard
                icon="trend"
                value={formatCurrency(data?.revenueToday ?? 0)}
                label="Receita do dia"
                pill={trendPill(data?.revenueTrendPct)}
              />
              <KpiCard
                icon="users"
                value={data?.clientsCount ?? 0}
                label="Clientes"
                pill={data && data.clientsNewCount > 0 ? { text: `+${data.clientsNewCount}`, tone: 'good' } : undefined}
              />
              <KpiCard
                icon="building"
                value={data?.condominiumsCount ?? 0}
                label="Condomínios"
              />
            </div>

            {/* Card atalho — Pedido de amanhã */}
            <div
              style={{
                borderRadius: 22,
                overflow: 'hidden',
                marginBottom: 12,
                cursor: 'pointer',
              }}
              onClick={() => onNavigate('pedido')}
              role="button"
              aria-label="Ir para pedido"
            >
              <div
                style={{
                  position: 'relative',
                  background: 'var(--color-espresso)',
                  padding: '16px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  overflow: 'hidden',
                }}
              >
                {/* BreadMark decorativo */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: -40,
                    right: -16,
                    opacity: 0.12,
                    pointerEvents: 'none',
                  }}
                >
                  <BreadMark size={120} color="#E3AC3F" />
                </div>

                {/* Ícone avatar */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: 'rgba(227,172,63,0.16)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#E3AC3F',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="factory" size={22} color="#E3AC3F" stroke={2} />
                </div>

                {/* Textos */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: '#E3AC3F',
                      letterSpacing: '0.05em',
                      margin: 0,
                      lineHeight: 1.2,
                    }}
                  >
                    {data && data.deliverySlots.length > 0
                      ? `CORTE · ${data.deliverySlots.map((s) => `${s.label} ${s.cutoffTime}`).join(' · ')}`
                      : 'CORTE · ABERTO'}
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 16,
                      fontWeight: 700,
                      color: '#FAF5EC',
                      marginTop: 2,
                      margin: '2px 0 0',
                      lineHeight: 1.2,
                    }}
                  >
                    Pedido de amanhã · {data?.breadsTomorrowCount ?? 0} pães
                    {data && data.breadsTomorrowProjected > 0 ? ` · +${data.breadsTomorrowProjected} previstos` : ''}
                  </p>
                </div>

                {/* Chevron */}
                <Icon name="chevR" size={20} color="#C7B595" stroke={2} />
              </div>
            </div>

            {/* Card — Fornadas por dia */}
            <div
              style={{
                background: 'var(--color-surface)',
                borderRadius: 22,
                padding: 18,
                border: '1px solid var(--color-border-2)',
                marginBottom: 12,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  margin: '0 0 14px',
                }}
              >
                Fornadas por dia
              </p>
              <BarChart data={barData} height={96} />
            </div>

            {/* Card — Receita por tipo */}
            <div
              style={{
                background: 'var(--color-surface)',
                borderRadius: 22,
                padding: 18,
                border: '1px solid var(--color-border-2)',
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 12,
                }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'var(--color-text)',
                    margin: 0,
                  }}
                >
                  Receita por tipo · hoje
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 15,
                    fontWeight: 800,
                    color: 'var(--color-text)',
                    margin: 0,
                  }}
                >
                  {formatCurrency(totalReceita)}
                </p>
              </div>

              {/* Barra proporcional */}
              <div
                style={{
                  height: 12,
                  borderRadius: 99,
                  overflow: 'hidden',
                  marginBottom: 14,
                  display: 'flex',
                }}
              >
                <div
                  style={{
                    width: `${combosPercent}%`,
                    background: 'var(--color-gold)',
                    transition: 'width 0.3s ease',
                  }}
                />
                <div
                  style={{
                    width: `${avulsoPercent}%`,
                    background: 'var(--color-accent)',
                    opacity: 0.5,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              {/* Legenda */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div
                      style={{
                        width: 11,
                        height: 11,
                        borderRadius: 3,
                        background: 'var(--color-gold)',
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 13.5,
                        color: 'var(--color-text-sec)',
                      }}
                    >
                      Combos
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: 'var(--color-text)',
                    }}
                  >
                    {formatCurrency(data?.revenueByType.combos ?? 0)}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div
                      style={{
                        width: 11,
                        height: 11,
                        borderRadius: 3,
                        background: 'var(--color-accent)',
                        opacity: 0.5,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 13.5,
                        color: 'var(--color-text-sec)',
                      }}
                    >
                      Compra personalizada
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: 'var(--color-text)',
                    }}
                  >
                    {formatCurrency(data?.revenueByType.avulso ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* CSS para animação de spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
