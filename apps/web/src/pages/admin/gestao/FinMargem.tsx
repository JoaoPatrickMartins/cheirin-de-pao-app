import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import {
  PeriodPicker,
  periodQuery,
  selectionSlug,
  type PeriodSelection,
} from '../../../components/admin/PeriodPicker'
import { KpiCard } from '../../../components/admin/KpiCard'
import {
  ReportAppBar,
  ReportScroll,
  ReportCard,
  SectionTitle,
  StatRow,
  LoadingText,
  ErrorText,
  fmtInt,
  fmtBRL,
  fmtPct,
} from './RelShared'
import { downloadXlsx } from '../../../lib/xlsx'

/**
 * FinMargem — margem, ponto de equilíbrio e simulador (F8/F9/B3/D2 · Fase 7).
 *
 * Três perguntas, na ordem em que o dono as faz:
 *
 *   1. **Onde a margem está?** — por produto e por condomínio.
 *   2. **Quantos pães por dia pagam a operação?** — o ponto de equilíbrio, que é o único número
 *      deste módulo que serve de META. O DRE conta o que já foi; este diz onde o resultado zera.
 *   3. **E se...?** — o simulador, sem persistir nada.
 *
 * A tela insiste em duas ressalvas porque sem elas os números seriam lidos como mais exatos do que
 * são: a margem é de CONTRIBUIÇÃO (não tem rateio de despesa por produto) e o custo por condomínio
 * é RATEIO por pães entregues, não custo medido.
 */

interface ProductRow {
  productId: string
  name: string
  isBread: boolean
  qty: number
  revenue: number
  cost: number | null
  margin: number | null
  marginPct: number | null
  marginPerUnit: number | null
  belowCost: boolean
}

interface CondoRow {
  condominiumId: string
  condominiumName: string
  revenue: number
  breadsDelivered: number
  shareOfBreads: number
  allocatedCost: number
  contribution: number
  contributionPct: number
  activeClients: number
}

interface BreakEven {
  revenue: number
  variableCosts: number
  fixedCosts: number
  contributionMargin: number
  contributionMarginRatio: number
  breakEvenRevenue: number | null
  breakEvenBreads: number | null
  breakEvenBreadsPerDay: number | null
  gap: number | null
  safetyMargin: number | null
  result: number
  reached: boolean
  caveats: string[]
}

interface MarginReport {
  window: { from: string; to: string; label: string; isPartial: boolean }
  products: {
    rows: ProductRow[]
    revenue: number
    cost: number
    margin: number
    marginPct: number
    unitsWithoutCost: number
  }
  condominiums: { rows: CondoRow[]; allocatedTotal: number; breadsTotal: number }
  breakEven: BreakEven
  caveats: string[]
}

interface Simulation {
  base: BreakEven
  result: BreakEven
}

/** Os três eixos do simulador (D2), em pontos percentuais. */
const STEPS = [-20, -10, -5, 0, 5, 10, 20]

export function FinMargem({ onBack }: { onBack: () => void }) {
  const [sel, setSel] = useState<PeriodSelection>({ kind: 'preset', period: 'month' })
  const [data, setData] = useState<MarginReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Simulador — estado local, nada persiste.
  const [simOpen, setSimOpen] = useState(false)
  const [dRevenue, setDRevenue] = useState(0)
  const [dCogs, setDCogs] = useState(0)
  const [dFixed, setDFixed] = useState(0)
  const [sim, setSim] = useState<Simulation | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/admin/financial/margin?${periodQuery(sel)}`)
        if (cancelled) return
        setData(res.ok ? ((await res.json()) as MarginReport) : null)
      } catch {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sel])

  // O cenário é recalculado NO SERVIDOR, pela mesma função do relatório — é o que garante que
  // "nenhuma alteração" devolva exatamente o número da tela, em vez de um parecido.
  useEffect(() => {
    if (!simOpen) return
    let cancelled = false
    void (async () => {
      try {
        const q = new URLSearchParams(periodQuery(sel))
        q.set('revenue', String(dRevenue))
        q.set('cogs', String(dCogs))
        q.set('fixed', String(dFixed))
        const res = await apiFetch(`/admin/financial/simulate?${q.toString()}`)
        if (cancelled) return
        setSim(res.ok ? ((await res.json()) as Simulation) : null)
      } catch {
        if (!cancelled) setSim(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [simOpen, sel, dRevenue, dCogs, dFixed])

  const be = data?.breakEven
  const rows = data?.products.rows ?? []
  const maxMargin = Math.max(...rows.map((r) => r.margin ?? 0), 1)

  const onExport = data
    ? () =>
        void downloadXlsx(`margem-${selectionSlug(sel)}.xlsx`, [
          {
            name: 'Margem por produto',
            notes: [`Margem e ponto de equilíbrio — ${data.window.label}`],
            head: ['Produto', 'Unidades', 'Receita', 'Custo', 'Margem', '% da receita', 'Margem por unidade'],
            rows: rows.map((r) => [r.name, r.qty, r.revenue, r.cost, r.margin, r.marginPct, r.marginPerUnit]),
            integer: [1],
            money: [2, 3, 4, 6],
            percent: [5],
            footer: data.caveats,
          },
          {
            name: 'Por condomínio',
            head: ['Condomínio', 'Receita', 'Pães entregues', '% dos pães', 'Custo rateado', 'Contribuição', '% da receita'],
            rows: data.condominiums.rows.map((c) => [
              c.condominiumName,
              c.revenue,
              c.breadsDelivered,
              c.shareOfBreads,
              c.allocatedCost,
              c.contribution,
              c.contributionPct,
            ]),
            money: [1, 4, 5],
            integer: [2],
            percent: [3, 6],
            footer: [
              `Rateado no período: R$ ${data.condominiums.allocatedTotal.toFixed(2)} sobre ${data.condominiums.breadsTotal} pães entregues.`,
              'RATEIO por pães entregues, não custo medido. Despesa com centro de custo próprio fica fora dele.',
            ],
          },
          {
            name: 'Ponto de equilíbrio',
            head: ['Linha', 'Valor'],
            rows: [
              ['Receita', data.breakEven.revenue],
              ['(−) Custos variáveis', -data.breakEven.variableCosts],
              ['= Margem de contribuição', data.breakEven.contributionMargin],
              ['(−) Custos fixos', -data.breakEven.fixedCosts],
              ['= Resultado', data.breakEven.result],
              ['Receita de equilíbrio', data.breakEven.breakEvenRevenue],
              ['Pães necessários no período', data.breakEven.breakEvenBreads],
              ['Pães por dia', data.breakEven.breakEvenBreadsPerDay],
            ],
            money: [1],
            footer: data.breakEven.caveats,
          },
        ])
    : undefined

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="Margem & equilíbrio" onBack={onBack} onExport={onExport} />
      <ReportScroll>
        <PeriodPicker value={sel} onChange={setSel} />

        {isLoading ? (
          <LoadingText />
        ) : data && be ? (
          <>
            {/* Ressalvas ACIMA dos números, como no DRE. */}
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

            {/* ── Ponto de equilíbrio ────────────────────────────────────── */}
            <SectionTitle>Ponto de equilíbrio</SectionTitle>
            {be.breakEvenRevenue != null ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <KpiCard
                    icon="bag"
                    value={be.breakEvenBreadsPerDay != null ? fmtInt(be.breakEvenBreadsPerDay) : '—'}
                    label="Pães/dia para empatar"
                    sub={be.breakEvenBreads != null ? `${fmtInt(be.breakEvenBreads)} no período` : 'sem pão vendido'}
                  />
                  <KpiCard
                    icon="coin"
                    value={fmtBRL(be.breakEvenRevenue)}
                    label="Receita de equilíbrio"
                    pill={
                      be.reached
                        ? { text: 'atingido', tone: 'good' }
                        : { text: `faltam ${fmtBRL(Math.abs(be.gap ?? 0))}`, tone: 'gold' }
                    }
                  />
                </div>

                <ReportCard>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <StatRow label="Receita do período" value={fmtBRL(be.revenue)} />
                    <StatRow label="(−) Custos variáveis" value={fmtBRL(be.variableCosts)} sub="mercadoria + despesa que acompanha o volume" />
                    <StatRow
                      label="= Margem de contribuição"
                      value={`${fmtBRL(be.contributionMargin)} · ${fmtPct(be.contributionMarginRatio)}`}
                      pct={be.contributionMarginRatio}
                      sub="o que sobra de cada venda para pagar o custo fixo"
                    />
                    <StatRow label="(−) Custos fixos" value={fmtBRL(be.fixedCosts)} sub="existem mesmo com venda zero" />
                    <StatRow label="= Resultado" value={fmtBRL(be.result)} />
                    {be.safetyMargin != null && (
                      <StatRow
                        label="Margem de segurança"
                        value={fmtPct(be.safetyMargin)}
                        pct={be.safetyMargin}
                        sub="quanto a receita pode cair antes do prejuízo"
                      />
                    )}
                  </div>
                </ReportCard>
              </>
            ) : (
              <ReportCard>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-warn)', margin: 0, lineHeight: 1.45 }}>
                  {be.caveats[0]}
                </p>
              </ReportCard>
            )}

            {/* ── Simulador (D2) ─────────────────────────────────────────── */}
            <button
              type="button"
              onClick={() => setSimOpen((o) => !o)}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-2)',
                borderRadius: 14,
                padding: '13px 15px',
                fontFamily: 'var(--font-body)',
                fontSize: 13.5,
                fontWeight: 700,
                color: 'var(--color-text)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {simOpen ? '▾' : '▸'} Simular cenário — “e se...?”
            </button>

            {simOpen && (
              <ReportCard>
                <SimSlider label="Receita" value={dRevenue} onChange={setDRevenue} />
                <SimSlider label="Custo da mercadoria" value={dCogs} onChange={setDCogs} />
                <SimSlider label="Despesa fixa" value={dFixed} onChange={setDFixed} />

                {sim && (
                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 14,
                      borderTop: '1px solid var(--color-border-2)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 11,
                    }}
                  >
                    <SimCompare label="Resultado" before={sim.base.result} after={sim.result.result} />
                    <SimCompare
                      label="Receita de equilíbrio"
                      before={sim.base.breakEvenRevenue}
                      after={sim.result.breakEvenRevenue}
                      lowerIsBetter
                    />
                    <SimCompare
                      label="Pães/dia para empatar"
                      before={sim.base.breakEvenBreadsPerDay}
                      after={sim.result.breakEvenBreadsPerDay}
                      lowerIsBetter
                      unit="pães"
                    />
                    {sim.result.breakEvenRevenue == null && (
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 700, color: 'var(--color-warn)', margin: 0, lineHeight: 1.4 }}>
                        {sim.result.caveats[0]}
                      </p>
                    )}
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: 0, lineHeight: 1.4 }}>
                      Nada aqui é salvo. Com os três controles em zero, o cenário é idêntico ao
                      relatório acima.
                    </p>
                  </div>
                )}
              </ReportCard>
            )}

            {/* ── Margem por produto ─────────────────────────────────────── */}
            <SectionTitle>Margem por produto</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <KpiCard icon="percent" value={fmtPct(data.products.marginPct)} label="Margem dos produtos" sub={fmtBRL(data.products.margin)} />
              <KpiCard
                icon="factory"
                value={fmtBRL(data.products.cost)}
                label="Custo da mercadoria"
                pill={
                  data.products.unitsWithoutCost > 0
                    ? { text: 'parcial', tone: 'gold' }
                    : undefined
                }
                sub={`sobre ${fmtBRL(data.products.revenue)} vendidos`}
              />
            </div>

            {rows.length > 0 ? (
              <ReportCard>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                  {rows.map((r) => (
                    <div key={r.productId} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: 13,
                            fontWeight: r.isBread ? 700 : 600,
                            color: 'var(--color-text)',
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {r.belowCost ? '⚠ ' : ''}
                          {r.name}
                        </span>
                        <span
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: 13,
                            fontWeight: 700,
                            color: r.margin == null
                              ? 'var(--color-text-ter)'
                              : r.margin < 0
                                ? 'var(--color-warn)'
                                : 'var(--color-text)',
                            flexShrink: 0,
                          }}
                        >
                          {r.margin == null ? 'sem custo' : fmtBRL(r.margin)}
                        </span>
                      </div>
                      {r.margin != null && (
                        <div style={{ height: 6, borderRadius: 99, background: 'var(--color-surface-2)', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.max((r.margin / maxMargin) * 100, 0)}%`,
                              background: r.margin < 0 ? 'var(--color-warn)' : 'var(--color-gold)',
                              borderRadius: 99,
                            }}
                          />
                        </div>
                      )}
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)' }}>
                        {fmtInt(r.qty)} un · receita {fmtBRL(r.revenue)}
                        {r.marginPerUnit != null && ` · ${fmtBRL(r.marginPerUnit)}/un`}
                        {r.marginPct != null && ` · ${fmtPct(r.marginPct)}`}
                      </span>
                    </div>
                  ))}
                </div>
              </ReportCard>
            ) : (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-ter)', textAlign: 'center' }}>
                Sem venda no período.
              </p>
            )}

            {/* ── Margem por condomínio ──────────────────────────────────── */}
            {data.condominiums.rows.length > 0 && (
              <>
                <SectionTitle>Contribuição por condomínio</SectionTitle>
                <ReportCard>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {data.condominiums.rows.map((c) => (
                      <StatRow
                        key={c.condominiumId}
                        label={c.condominiumName}
                        value={fmtBRL(c.contribution)}
                        pct={Math.max(c.contributionPct, 0)}
                        sub={`receita ${fmtBRL(c.revenue)} − rateio ${fmtBRL(c.allocatedCost)} · ${fmtInt(c.breadsDelivered)} pães (${fmtPct(c.shareOfBreads)} do total)`}
                      />
                    ))}
                  </div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: '11px 0 0', lineHeight: 1.4 }}>
                    O custo é <strong>rateado</strong> por pães entregues, não medido. Despesa
                    lançada com condomínio próprio já está fora deste rateio.
                  </p>
                </ReportCard>
              </>
            )}
          </>
        ) : (
          <ErrorText />
        )}
      </ReportScroll>
    </div>
  )
}

// ------------------------------------------------------------------ subcomponentes

/** Um eixo do simulador: passos fixos em vez de campo livre — é um cenário, não uma planilha. */
function SimSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div style={{ marginBottom: 13 }}>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-sec)', margin: '0 0 7px' }}>
        {label}{' '}
        <span style={{ color: value === 0 ? 'var(--color-text-ter)' : 'var(--color-accent)' }}>
          {value > 0 ? '+' : ''}
          {value}%
        </span>
      </p>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {STEPS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            style={{
              minHeight: 32,
              padding: '0 10px',
              borderRadius: 99,
              border: `1px solid ${value === s ? 'transparent' : 'var(--color-border-2)'}`,
              background: value === s ? 'var(--color-espresso)' : 'var(--color-surface-2)',
              color: value === s ? '#FAF5EC' : 'var(--color-text-sec)',
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {s > 0 ? '+' : ''}
            {s}%
          </button>
        ))}
      </div>
    </div>
  )
}

/** Antes → depois de um número do cenário. */
function SimCompare({
  label,
  before,
  after,
  lowerIsBetter,
  unit,
}: {
  label: string
  before: number | null
  after: number | null
  lowerIsBetter?: boolean
  unit?: string
}) {
  const fmt = (v: number | null) =>
    v == null ? '—' : unit === 'pães' ? `${v.toLocaleString('pt-BR')} ${unit}` : fmtBRL(v)
  const improved =
    before != null && after != null && (lowerIsBetter ? after < before : after > before)
  const worsened =
    before != null && after != null && (lowerIsBetter ? after > before : after < before)

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-sec)' }}>
        {label}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', textDecoration: 'line-through' }}>
          {fmt(before)}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13.5,
            fontWeight: 800,
            color: improved ? 'var(--color-good)' : worsened ? 'var(--color-warn)' : 'var(--color-text)',
          }}
        >
          {fmt(after)}
        </span>
      </span>
    </div>
  )
}
