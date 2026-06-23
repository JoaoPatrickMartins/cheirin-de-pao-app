import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { AdminHead } from '../../../components/admin/AdminHead'
import { KpiCard } from '../../../components/admin/KpiCard'
import { BarChart } from '../../../components/admin/BarChart'
import { BreadMark } from '../../../components/brand/BreadMark'
import { Icon } from '../../../components/brand/Icon'

type AdminTab = 'painel' | 'pedido' | 'entregas' | 'clientes' | 'gestao'

interface DashboardData {
  breadsTodayCount: number
  revenueToday: number
  clientsCount: number
  condominiumsCount: number
  deliverySlots: Array<{ slotId: string; label: string; time: string; cutoffTime: string }>
  revenueByType: {
    combos: number
    avulso: number
  }
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function buildBarChartData(currentDayOfWeek: number) {
  // Seg a Dom (índices 1..7, mas JS usa 0=Dom)
  // Exibir 7 colunas: Seg, Ter, Qua, Qui, Sex, Sáb, Dom
  const orderedDays = [1, 2, 3, 4, 5, 6, 0] // Seg..Dom
  return orderedDays.map((dayIndex) => ({
    label: DAY_LABELS[dayIndex],
    value: 1, // valor uniforme — sem dados históricos por dia no dashboard atual
    highlight: dayIndex === currentDayOfWeek,
  }))
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
  const barData = buildBarChartData(currentDayOfWeek)

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
                label="Pães hoje"
                pill={{ text: '+12%', tone: 'good' }}
              />
              <KpiCard
                icon="trend"
                value={formatCurrency(data?.revenueToday ?? 0)}
                label="Receita do dia"
                pill={{ text: '+8%', tone: 'good' }}
              />
              <KpiCard
                icon="users"
                value={data?.clientsCount ?? 0}
                label="Clientes"
                pill={{ text: '+3', tone: 'good' }}
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
                    Pedido de amanhã · {data?.breadsTodayCount ?? 0} pães
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
