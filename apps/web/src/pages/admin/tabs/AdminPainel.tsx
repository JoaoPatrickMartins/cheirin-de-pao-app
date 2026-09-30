import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { AdminHead } from '../../../components/admin/AdminHead'
import { KpiCard } from '../../../components/admin/KpiCard'
import { BarChart } from '../../../components/admin/BarChart'
import { BreadMark } from '../../../components/brand/BreadMark'
import { Icon } from '../../../components/brand/Icon'
import {
  PeriodPicker,
  periodQuery,
  type PeriodSelection,
} from '../../../components/admin/PeriodPicker'
import { PainelAlertas, type AlertTarget } from '../../../components/admin/painel/PainelAlertas'
import { PainelResultado } from '../../../components/admin/painel/PainelResultado'
import { PainelBase, SectionLabel } from '../../../components/admin/painel/PainelBase'
import { PainelPosicao } from '../../../components/admin/painel/PainelPosicao'
import type {
  DashboardAlerts,
  DashboardOverview,
} from '../../../components/admin/painel/painel-types'
import { fmtBRL } from '../../../components/admin/painel/painel-types'

/**
 * AdminPainel — a visão ponta a ponta do negócio (§15 do plano-financeiro-vendas).
 *
 * Antes desta reformulação o painel respondia a UMA pergunta ("como está hoje") e a respondia com
 * números de operação. Faltava tudo o que decide o negócio: resultado do período, base de
 * clientes, posição patrimonial — e faltava **período**, porque nada aqui tinha seletor.
 *
 * A tela virou composição de faixas, cada uma num componente próprio. Três fontes, buscadas em
 * paralelo e renderizadas progressivamente:
 *
 *   - `GET /admin/dashboard`          — operação (rápido; é o que pinta primeiro)
 *   - `GET /admin/dashboard/alerts`   — Faixa 0
 *   - `GET /admin/dashboard/overview` — Faixas 2, 4, 6 (mais pesado, cacheado)
 *
 * Cada faixa tolera a sua fonte faltando: um endpoint que falha esconde a faixa em vez de derrubar
 * o painel.
 */

type AdminTab = 'painel' | 'pedido' | 'separacao' | 'entregas' | 'clientes' | 'gestao'

interface DashboardData {
  breadsTodayCount: number
  breadsTodayProjected: number
  breadsTomorrowCount: number
  breadsTomorrowProjected: number
  breadsByWeekday: number[]
  /** Itens do mercadinho por dia — métrica PARALELA aos pães, nunca somada (D-1). */
  itemsByWeekday?: number[]
  revenueToday: number
  breadsTodayTrendPct: number
  revenueTrendPct: number
  clientsCount: number
  clientsNewCount: number
  condominiumsCount: number
  deliverySlots: Array<{ slotId: string; label: string; time: string; cutoffTime: string }>
  revenueByType: { combos: number; avulso: number }
  marketToday?: { revenue: number; gmv: number; orders: number }
  revenueTodayConsolidated?: number
  stuckCount: number
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
// breadsByWeekday vem indexado Seg..Dom; mapeia para o índice JS de getDay() (0=Dom)
const WEEKDAY_TO_JS = [1, 2, 3, 4, 5, 6, 0]

function buildBarChartData(series: number[], currentDayOfWeek: number) {
  const safe = series.length === 7 ? series : [0, 0, 0, 0, 0, 0, 0]
  return safe.map((value, i) => ({
    label: DAY_LABELS[WEEKDAY_TO_JS[i]],
    value,
    highlight: WEEKDAY_TO_JS[i] === currentDayOfWeek,
  }))
}

/** Badge de delta. Positivo (ou zero) = verde. */
function trendPill(pct: number | undefined): { text: string; tone: 'good' | 'neutral' } | undefined {
  if (pct === undefined || pct === null) return undefined
  return { text: `${pct >= 0 ? '+' : ''}${pct}%`, tone: pct >= 0 ? 'good' : 'neutral' }
}

export function AdminPainel({
  onNavigate,
}: {
  onNavigate: (tab: AdminTab, intent?: { segment: 'historico'; filter: 'parados' }) => void
}) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [alerts, setAlerts] = useState<DashboardAlerts | null>(null)
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isOverviewLoading, setIsOverviewLoading] = useState(true)
  const [sel, setSel] = useState<PeriodSelection>({ kind: 'preset', period: 'month' })
  const [compare, setCompare] = useState(true)

  // Operação e alertas não dependem do período: buscados uma vez, no mount.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [opRes, alertRes] = await Promise.allSettled([
        apiFetch('/admin/dashboard'),
        apiFetch('/admin/dashboard/alerts'),
      ])
      if (cancelled) return

      if (opRes.status === 'fulfilled' && opRes.value.ok) {
        setData((await opRes.value.json()) as DashboardData)
      }
      if (alertRes.status === 'fulfilled' && alertRes.value.ok) {
        setAlerts((await alertRes.value.json()) as DashboardAlerts)
      }
      setIsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // A visão geral refaz a cada troca de período/comparativo.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsOverviewLoading(true)
      try {
        const res = await apiFetch(`/admin/dashboard/overview?${periodQuery(sel, { compare })}`)
        if (cancelled) return
        setOverview(res.ok ? ((await res.json()) as DashboardOverview) : null)
      } catch {
        if (!cancelled) setOverview(null)
      } finally {
        if (!cancelled) setIsOverviewLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sel, compare])

  const currentDayOfWeek = new Date().getDay()
  const breadBars = buildBarChartData(data?.breadsByWeekday ?? [], currentDayOfWeek)
  const itemBars = buildBarChartData(data?.itemsByWeekday ?? [], currentDayOfWeek)
  const hasItems = itemBars.some((b) => b.value > 0)

  const onAlertNavigate = (t: AlertTarget) =>
    t.tab === 'entregas' ? onNavigate('entregas', t.intent) : onNavigate(t.tab)

  // ═══ Mix de canal (Fase 6) ═══
  // Era "Receita por tipo" e mostrava só combos × avulso — os dois canais que existiam quando o
  // card nasceu. Cestinha e gancho JÁ vinham no mesmo payload e simplesmente não eram desenhados,
  // então o card exibia um "total" menor que a receita da Faixa 2 logo acima, sem explicar por quê.
  // Agora são os quatro canais, e a soma fecha com o consolidado.
  const rev = overview?.revenue
  const mix = rev
    ? [
        { key: 'combos', label: 'Combos', value: rev.byType.combos, color: 'var(--color-gold)', opacity: 1 },
        { key: 'avulso', label: 'Compra personalizada', value: rev.byType.avulso, color: 'var(--color-accent)', opacity: 0.55 },
        { key: 'market', label: '🧺 Cestinha', value: rev.market, color: 'var(--color-good)', opacity: 1 },
        { key: 'hook', label: 'Gancho de porta', value: rev.hook, color: 'var(--color-espresso)', opacity: 0.75 },
      ].filter((c) => c.value > 0)
    : []
  const mixTotal = mix.reduce((s, c) => s + c.value, 0)

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 24 }}>
      <AdminHead
        sub={
          data
            ? `${data.condominiumsCount} ${data.condominiumsCount === 1 ? 'condomínio' : 'condomínios'} · ${data.clientsCount} clientes`
            : 'Cheirin de Pão · Operação'
        }
        titulo="Painel"
      />

      <div style={{ padding: '0 20px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
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
            {/* ═══ FAIXA 0 · alertas — nada a resolver, nada desenhado ═══ */}
            <PainelAlertas data={alerts} onNavigate={onAlertNavigate} />

            {/* ═══ FAIXA 1 · período ═══ */}
            <div style={{ marginBottom: 12 }}>
              <PeriodPicker
                value={sel}
                onChange={setSel}
                showCompare
                compare={compare}
                onCompareChange={setCompare}
              />
            </div>

            {/* ═══ FAIXA 2 · resultado ═══ */}
            <PainelResultado data={overview} isLoading={isOverviewLoading} />

            {/* ═══ FAIXA 3 · operação (não segue o período: é sempre hoje/amanhã) ═══ */}
            <SectionLabel>Operação · hoje</SectionLabel>
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
                value={
                  <>
                    {data?.breadsTodayCount ?? 0} <span style={{ fontSize: 19 }}>🥖</span>
                  </>
                }
                label="A entregar hoje"
                pill={trendPill(data?.breadsTodayTrendPct)}
                sub={
                  data && data.breadsTodayProjected > 0
                    ? `+${data.breadsTodayProjected} previstos (agenda)`
                    : 'vs. mesmo dia da semana anterior'
                }
              />
              <KpiCard
                icon="trend"
                value={fmtBRL(data?.revenueTodayConsolidated ?? data?.revenueToday ?? 0)}
                label="Receita de hoje"
                // D-2: o GMV aparece como contexto, jamais somado à receita.
                sub={
                  data?.marketToday && data.marketToday.gmv > 0
                    ? `🧺 ${fmtBRL(data.marketToday.gmv)} movimentados`
                    : undefined
                }
              />
            </div>

            {/* Card atalho — Pedido de amanhã */}
            <div
              style={{ borderRadius: 22, overflow: 'hidden', marginBottom: 12, cursor: 'pointer' }}
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
                      margin: '2px 0 0',
                      lineHeight: 1.2,
                    }}
                  >
                    Pedido de amanhã · {data?.breadsTomorrowCount ?? 0} pães
                    {data && data.breadsTomorrowProjected > 0
                      ? ` · +${data.breadsTomorrowProjected} previstos`
                      : ''}
                  </p>
                </div>

                <Icon name="chevR" size={20} color="#C7B595" stroke={2} />
              </div>
            </div>

            {/* ═══ FAIXA 4 · base e crescimento ═══ */}
            <PainelBase data={overview} />

            {/* ═══ FAIXA 5 · gráficos ═══ */}
            <SectionLabel>Volume da semana</SectionLabel>
            <div
              style={{
                background: 'var(--color-surface)',
                borderRadius: 22,
                padding: 18,
                border: '1px solid var(--color-border-2)',
                marginBottom: 12,
              }}
            >
              <ChartTitle>Pães por dia</ChartTitle>
              <BarChart data={breadBars} height={96} />

              {/* `itemsByWeekday` era calculado pela API e NUNCA lido pelo front — a Cestinha não
                  aparecia em gráfico nenhum. Série separada, nunca somada aos pães (D-1): "18 pães"
                  não pode ser 12 pães + 6 potes de geleia. */}
              {hasItems && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--color-border-2)' }}>
                  <ChartTitle>Itens da Cestinha por dia</ChartTitle>
                  <BarChart data={itemBars} height={72} />
                </div>
              )}
            </div>

            {/* ═══ FAIXA 5 · mix de canal — segue o período da Faixa 2, mesma fonte. ═══ */}
            {mix.length > 0 && mixTotal > 0 && (
              <div
                style={{
                  background: 'var(--color-surface)',
                  borderRadius: 22,
                  padding: 18,
                  border: '1px solid var(--color-border-2)',
                  marginBottom: 12,
                }}
              >
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
                    Mix de canal
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
                    {fmtBRL(mixTotal)}
                  </p>
                </div>

                <div style={{ height: 12, borderRadius: 99, overflow: 'hidden', marginBottom: 14, display: 'flex' }}>
                  {mix.map((c) => (
                    <div
                      key={c.key}
                      style={{
                        width: `${(c.value / mixTotal) * 100}%`,
                        background: c.color,
                        opacity: c.opacity,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {mix.map((c) => (
                    <Legend key={c.key} color={c.color} opacity={c.opacity} label={c.label} value={c.value} />
                  ))}
                </div>

                {/* O movimentado da Cestinha aparece como CONTEXTO, fora da barra: somá-lo à
                    receita contaria duas vezes a parte paga em pãezinhos (D-2). */}
                {(rev?.cestinhaGmv ?? 0) > 0 && (
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 11.5,
                      color: 'var(--color-text-ter)',
                      margin: '11px 0 0',
                      lineHeight: 1.4,
                    }}
                  >
                    🧺 {fmtBRL(rev!.cestinhaGmv)} movimentados em Cestinhas — a parte paga em
                    pãezinhos já foi faturada na compra do combo e não entra na barra.
                  </p>
                )}
              </div>
            )}

            {/* ═══ FAIXA 6 · posição ═══ */}
            <PainelPosicao data={overview} />

            {/* ═══ FAIXA 7 · atalhos ═══
                Os oito relatórios existiam e o painel não levava a nenhum — "o que foi construído
                não é encontrado" era o último item do diagnóstico do §15.2. Estes atalhos levam ao
                relatório que EXPLICA o número exibido acima, não a um menu genérico. */}
            <SectionLabel>Ver em detalhe</SectionLabel>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
                marginBottom: 12,
              }}
            >
              <ShortcutCard
                icon="trend"
                label="Vendas & performance"
                hint="Mais vendidos, ABC e ticket"
                onClick={() => onNavigate('gestao')}
              />
              <ShortcutCard
                icon="star"
                label="Clientes & LTV"
                hint="Quem sustenta o faturamento"
                onClick={() => onNavigate('gestao')}
              />
              <ShortcutCard
                icon="doc"
                label="DRE"
                hint="O resultado, linha a linha"
                onClick={() => onNavigate('gestao')}
              />
              <ShortcutCard
                icon="wallet"
                label="Financeiro"
                hint="Despesas, caixa e contas"
                onClick={() => onNavigate('gestao')}
              />
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ------------------------------------------------------------------ subcomponentes

/**
 * Atalho da Faixa 7.
 *
 * Leva à aba Gestão, de onde o hub correspondente é um toque. A navegação do admin não expõe
 * deep-link para subtela de hub — inventar um só para estes quatro cartões acrescentaria um segundo
 * caminho de navegação para manter em sincronia.
 */
function ShortcutCard({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: 'trend' | 'star' | 'doc' | 'wallet'
  label: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 6,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 16,
        padding: 14,
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
      }}
    >
      <Icon name={icon} size={19} color="var(--color-accent)" />
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13.5,
          fontWeight: 700,
          color: 'var(--color-text)',
          lineHeight: 1.25,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 11.5,
          fontWeight: 600,
          color: 'var(--color-text-ter)',
          lineHeight: 1.3,
        }}
      >
        {hint}
      </span>
    </button>
  )
}

function ChartTitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 12.5,
        fontWeight: 700,
        color: 'var(--color-text-sec)',
        margin: '0 0 12px',
      }}
    >
      {children}
    </p>
  )
}

function Legend({
  color,
  opacity,
  label,
  value,
}: {
  color: string
  opacity?: number
  label: string
  value: number
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div
          style={{ width: 11, height: 11, borderRadius: 3, background: color, opacity, flexShrink: 0 }}
        />
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: 'var(--color-text-sec)' }}>
          {label}
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
        {fmtBRL(value)}
      </span>
    </div>
  )
}
