import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { KpiCard } from '../../../components/admin/KpiCard'
import { BarChart } from '../../../components/admin/BarChart'
import {
  ReportAppBar,
  ReportScroll,
  ReportCard,
  SectionTitle,
  StatRow,
  LoadingText,
  ErrorText,
  fmtBRL,
  fmtPct,
  fmtInt,
} from './RelShared'
import { downloadXlsx } from '../../../lib/xlsx'

/**
 * FinTendencia — dashboard financeiro consolidado (D4 · Fase 7).
 *
 * **Não é o DRE.** O DRE é o detalhe de UM mês; esta tela responde "está melhorando ou piorando",
 * que nenhuma outra respondia — todas mostram uma janela por vez.
 *
 * Duas decisões de interface carregam peso:
 *
 *   1. **O mês em curso é desenhado, mas nunca comparado.** Ele aparece na série com marca própria;
 *      medi-lo contra meses fechados mostraria uma queda que é só o calendário.
 *   2. **Saldos ficam separados da série.** Passivo de crédito e contas a pagar são a posição de
 *      hoje — o sistema não guarda snapshot mensal, e desenhá-los como seis barras iguais sugeriria
 *      uma estabilidade que não foi medida.
 */

interface TrendMonth {
  month: string
  label: string
  isPartial: boolean
  revenue: number
  cogs: number
  grossProfit: number
  grossMarginPct: number
  operatingExpenses: number
  netProfit: number
  netMarginPct: number
  cashflow: number
}

interface TrendReport {
  months: TrendMonth[]
  position: {
    creditLiability: number
    creditsOutstanding: number
    payable: number
    payableOverdue: number
  }
  summary: {
    month: string | null
    revenueDeltaPct: number | null
    netProfitDeltaPct: number | null
    netMarginDeltaPp: number | null
    profitableMonths: number
    closedMonths: number
  }
  caveats: string[]
}

/** As séries que a tela desenha, na ordem em que a pergunta é feita. */
const SERIES = [
  { key: 'revenue' as const, label: 'Receita' },
  { key: 'netProfit' as const, label: 'Resultado' },
  { key: 'cashflow' as const, label: 'Caixa' },
  { key: 'operatingExpenses' as const, label: 'Despesa operacional' },
]

export function FinTendencia({ onBack }: { onBack: () => void }) {
  const [months, setMonths] = useState(6)
  const [data, setData] = useState<TrendReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [serie, setSerie] = useState<(typeof SERIES)[number]['key']>('revenue')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/admin/financial/trend?months=${months}`)
        if (cancelled) return
        setData(res.ok ? ((await res.json()) as TrendReport) : null)
      } catch {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [months])

  const rows = data?.months ?? []
  const last = [...rows].reverse().find((m) => !m.isPartial) ?? null

  // O BarChart não desenha negativo; para resultado e caixa, a barra usa o módulo e o sinal vai no
  // rótulo da lista abaixo — que é onde o número exato é lido de qualquer forma.
  const bars = rows.map((m) => ({
    label: m.label,
    value: Math.abs(m[serie]),
    highlight: m.isPartial,
  }))
  const hasNegative = rows.some((m) => m[serie] < 0)

  const onExport = data
    ? () =>
        void downloadXlsx(`tendencia-${months}m.xlsx`, [
          {
            name: 'Tendência',
            notes: [`Tendência financeira — últimos ${months} meses`],
            head: [
              'Mês',
              'Em curso',
              'Receita',
              'CMV',
              'Lucro bruto',
              'Margem bruta',
              'Despesa operacional',
              'Resultado',
              'Margem líquida',
              'Caixa',
            ],
            rows: rows.map((m) => [
              m.month,
              m.isPartial ? 'Sim' : 'Não',
              m.revenue,
              m.cogs,
              m.grossProfit,
              m.grossMarginPct,
              m.operatingExpenses,
              m.netProfit,
              m.netMarginPct,
              m.cashflow,
            ]),
            money: [2, 3, 4, 6, 7, 9],
            percent: [5, 8],
            footer: data.caveats,
          },
          {
            name: 'Posição de hoje',
            head: ['Saldo', 'Valor'],
            rows: [
              ['Passivo de crédito (estimado)', data.position.creditLiability],
              ['Contas a pagar em aberto', data.position.payable],
              ['   das quais vencidas', data.position.payableOverdue],
            ],
            money: [1],
            footer: [
              `Créditos em circulação: ${data.position.creditsOutstanding} pãezinhos.`,
              'São SALDOS do momento, não séries: o sistema não guarda snapshot mensal deles.',
            ],
          },
        ])
    : undefined

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="Tendência" onBack={onBack} onExport={onExport} />
      <ReportScroll>
        {/* Janela da série — não é o PeriodPicker: aqui a unidade é SEMPRE o mês fechado. */}
        <div role="tablist" aria-label="Meses na série" style={{ display: 'flex', gap: 6 }}>
          {[3, 6, 12].map((n) => (
            <button
              key={n}
              type="button"
              role="tab"
              aria-selected={months === n}
              onClick={() => setMonths(n)}
              style={{
                minHeight: 36,
                padding: '0 15px',
                borderRadius: 99,
                border: `1px solid ${months === n ? 'transparent' : 'var(--color-border-2)'}`,
                background: months === n ? 'var(--color-espresso)' : 'var(--color-surface)',
                color: months === n ? '#FAF5EC' : 'var(--color-text-sec)',
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {n} meses
            </button>
          ))}
        </div>

        {isLoading ? (
          <LoadingText />
        ) : data && rows.length > 0 ? (
          <>
            <div
              style={{
                background: 'var(--color-gold-soft)',
                border: '1px solid var(--color-border-2)',
                borderRadius: 14,
                padding: '11px 13px',
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
              }}
            >
              {data.caveats.map((c) => (
                <p key={c} style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, color: '#6B5200', margin: 0, lineHeight: 1.4 }}>
                  {c}
                </p>
              ))}
            </div>

            {/* ── O último mês fechado contra a média dos anteriores ─────── */}
            {last && (
              <>
                <SectionTitle>Último mês fechado</SectionTitle>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <KpiCard
                    icon="coin"
                    value={fmtBRL(last.revenue)}
                    label="Receita"
                    sub={data.summary.revenueDeltaPct != null ? 'vs. média dos anteriores' : undefined}
                    pill={
                      data.summary.revenueDeltaPct != null
                        ? {
                            text: `${data.summary.revenueDeltaPct >= 0 ? '+' : ''}${data.summary.revenueDeltaPct.toFixed(1).replace('.', ',')}%`,
                            tone: data.summary.revenueDeltaPct >= 0 ? 'good' : 'neutral',
                          }
                        : undefined
                    }
                  />
                  <KpiCard
                    icon="trend"
                    value={fmtBRL(last.netProfit)}
                    label="Resultado"
                    sub={`margem ${fmtPct(last.netMarginPct)}`}
                    pill={
                      data.summary.netMarginDeltaPp != null
                        ? {
                            text: `${data.summary.netMarginDeltaPp >= 0 ? '+' : ''}${data.summary.netMarginDeltaPp.toFixed(1).replace('.', ',')} p.p.`,
                            tone: data.summary.netMarginDeltaPp >= 0 ? 'good' : 'neutral',
                          }
                        : undefined
                    }
                  />
                </div>
                <ReportCard>
                  <StatRow
                    label="Meses fechados no azul"
                    value={`${fmtInt(data.summary.profitableMonths)} de ${fmtInt(data.summary.closedMonths)}`}
                    pct={data.summary.closedMonths > 0 ? data.summary.profitableMonths / data.summary.closedMonths : 0}
                    sub="o mês em curso não entra na conta"
                  />
                </ReportCard>
              </>
            )}

            {/* ── A série ────────────────────────────────────────────────── */}
            <SectionTitle>Evolução</SectionTitle>
            <div role="tablist" aria-label="Série exibida" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
              {SERIES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={serie === s.key}
                  onClick={() => setSerie(s.key)}
                  style={{
                    minHeight: 34,
                    padding: '0 13px',
                    borderRadius: 99,
                    border: `1px solid ${serie === s.key ? 'transparent' : 'var(--color-border-2)'}`,
                    background: serie === s.key ? 'var(--color-espresso)' : 'var(--color-surface)',
                    color: serie === s.key ? '#FAF5EC' : 'var(--color-text-sec)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <ReportCard>
              <BarChart data={bars} height={112} />
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: '11px 0 0', lineHeight: 1.4 }}>
                A barra destacada é o mês <strong>em curso</strong> — ele ainda vai crescer.
                {hasNegative && ' Há meses negativos nesta série: a barra mostra o tamanho e a lista abaixo, o sinal.'}
              </p>
            </ReportCard>

            <ReportCard title="Mês a mês">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                {[...rows].reverse().map((m) => (
                  <div key={m.month} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)', textTransform: 'capitalize' }}>
                        {m.label}
                        {m.isPartial && (
                          <span
                            style={{
                              marginLeft: 6,
                              padding: '2px 6px',
                              borderRadius: 99,
                              background: 'var(--color-gold-soft)',
                              color: '#8A6A00',
                              fontSize: 10,
                              fontWeight: 800,
                              textTransform: 'none',
                            }}
                          >
                            em curso
                          </span>
                        )}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: 14,
                          fontWeight: 800,
                          color: m.netProfit < 0 ? 'var(--color-warn)' : 'var(--color-text)',
                          flexShrink: 0,
                        }}
                      >
                        {fmtBRL(m.netProfit)}
                      </span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-ter)' }}>
                      receita {fmtBRL(m.revenue)} · margem {fmtPct(m.netMarginPct)} · caixa{' '}
                      <span style={{ color: m.cashflow < 0 ? 'var(--color-warn)' : 'inherit' }}>
                        {fmtBRL(m.cashflow)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </ReportCard>

            {/* ── Posição (sem série) ────────────────────────────────────── */}
            <SectionTitle>Posição de hoje</SectionTitle>
            <ReportCard>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <StatRow
                  label="Passivo de crédito"
                  value={fmtBRL(data.position.creditLiability)}
                  sub={`${fmtInt(data.position.creditsOutstanding)} pãezinhos em circulação — estimado pelo preço médio histórico`}
                />
                <StatRow
                  label="Contas a pagar em aberto"
                  value={fmtBRL(data.position.payable)}
                  sub={
                    data.position.payableOverdue > 0
                      ? `${fmtBRL(data.position.payableOverdue)} já vencidos`
                      : 'nenhuma vencida'
                  }
                />
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: '11px 0 0', lineHeight: 1.4 }}>
                Estes dois são <strong>saldos do momento</strong>, não séries: o sistema não guarda
                snapshot mensal deles, e seis barras iguais sugeririam uma estabilidade que não foi
                medida.
              </p>
            </ReportCard>
          </>
        ) : (
          <ErrorText />
        )}
      </ReportScroll>
    </div>
  )
}
