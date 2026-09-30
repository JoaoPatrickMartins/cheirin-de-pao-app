import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { ReportAppBar, ReportScroll, ReportCard, SectionTitle, StatRow, LoadingText, ErrorText, fmtInt, fmtCredits, fmtBRL } from './RelShared'
import {
  PeriodPicker,
  periodQuery,
  type PeriodSelection,
} from '../../../components/admin/PeriodPicker'
import { downloadXlsx } from '../../../lib/xlsx'

interface CreditLiabilityReport {
  creditsOutstanding: number
  estPricePerCredit: number
  estLiabilityBRL: number
  clientsWithCredit: number
}

/** Movimentação do passivo (F7) — por que o saldo mudou. */
interface CreditMovementReport {
  window: { label: string; isPartial: boolean }
  issued: number
  settled: number
  net: number
  rows: Array<{ type: string; label: string; kind: 'in' | 'out'; credits: number; count: number }>
  inactive: { months: number; clients: number; credits: number; estBRL: number }
  caveats: string[]
}

export function RelPassivo({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<CreditLiabilityReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  // Movimentação (F7) na MESMA tela do saldo, de propósito: "devo R$ 7.500 em pão" e "o passivo
  // subiu R$ 3.000 este mês porque vendi combo" são a mesma pergunta em dois tempos, e separá-las
  // em duas telas obrigaria o admin a cruzar números de cabeça.
  const [sel, setSel] = useState<PeriodSelection>({ kind: 'preset', period: 'month' })
  const [mov, setMov] = useState<CreditMovementReport | null>(null)

  useEffect(() => {
    const run = async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch('/admin/reports/credit-liability')
        setData(res.ok ? ((await res.json()) as CreditLiabilityReport) : null)
      } catch {
        setData(null)
      } finally {
        setIsLoading(false)
      }
    }
    void run()
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch(`/admin/reports/credit-movement?${periodQuery(sel)}`)
        if (cancelled) return
        setMov(res.ok ? ((await res.json()) as CreditMovementReport) : null)
      } catch {
        if (!cancelled) setMov(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sel])

  // Duas abas porque as unidades são diferentes: pãezinhos e R$ na mesma coluna deixariam o
  // formato de moeda mentindo sobre a contagem de créditos.
  const onExport = data
    ? () =>
        void downloadXlsx('passivo-credito.xlsx', [
          {
            name: 'Passivo de crédito',
            notes: [`Passivo de crédito — posição em ${new Date().toLocaleDateString('pt-BR')}`],
            head: ['Métrica', 'Valor'],
            rows: [
              ['Créditos em circulação (pãezinhos)', data.creditsOutstanding],
              ['Clientes com saldo', data.clientsWithCredit],
            ],
            integer: [1],
          },
          {
            name: 'Em R$',
            head: ['Métrica', 'Valor'],
            rows: [
              ['Preço médio por crédito', data.estPricePerCredit],
              ['Passivo estimado', data.estLiabilityBRL],
            ],
            money: [1],
            footer: [
              'Valor ESTIMADO: créditos em circulação × preço médio histórico por crédito.',
              'É um SALDO (posição atual), não um fluxo de período.',
            ],
          },
          ...(mov
            ? [
                {
                  name: 'Movimentação',
                  notes: [`Movimentação do passivo — ${mov.window.label}`],
                  head: ['Movimento', 'Sentido', 'Pãezinhos', 'Lançamentos'],
                  rows: mov.rows.map((r) => [
                    r.label,
                    r.kind === 'in' ? 'Aumenta o passivo' : 'Reduz o passivo',
                    r.credits,
                    r.count,
                  ]),
                  integer: [3],
                  footer: [
                    `Emitido ${fmtCredits(mov.issued)} · liquidado ${fmtCredits(mov.settled)} · variação ${fmtCredits(mov.net)} pãezinhos.`,
                    ...mov.caveats,
                  ],
                },
                {
                  name: 'Crédito parado',
                  head: ['Métrica', 'Valor'],
                  rows: [
                    [`Clientes sem movimento há ${mov.inactive.months}+ meses`, mov.inactive.clients],
                    ['Pãezinhos parados', mov.inactive.credits],
                    ['Estimativa em R$', mov.inactive.estBRL],
                  ],
                  footer: [
                    'Crédito NÃO expira neste sistema: este saldo segue como dívida em pão por tempo indeterminado.',
                  ],
                },
              ]
            : []),
        ])
    : undefined

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="Passivo de crédito" onBack={onBack} onExport={onExport} />
      <ReportScroll>
        {isLoading ? (
          <LoadingText />
        ) : data ? (
          <>
            {/* Headline: valor estimado do passivo */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 18, padding: '18px 18px 16px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-sec)', margin: '0 0 4px' }}>
                Passivo de crédito (estimado em R$)
              </p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 4px' }}>
                {fmtBRL(data.estLiabilityBRL)}
              </p>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--color-text-ter)' }}>
                {fmtCredits(data.creditsOutstanding)} créditos (pães) em circulação
              </span>
            </div>

            <ReportCard>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <StatRow label="Créditos em circulação" value={fmtCredits(data.creditsOutstanding)} />
                <StatRow label="Clientes com saldo" value={fmtInt(data.clientsWithCredit)} />
                <StatRow label="Preço médio por crédito" value={fmtBRL(data.estPricePerCredit)} />
              </div>
            </ReportCard>

            <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-ter)', margin: 0 }}>
              O total de créditos em circulação é exato. O valor em R$ é uma estimativa, usando o preço médio histórico por crédito (R$ pagos ÷ créditos comprados).
            </p>

            {/* ── Movimentação (F7) — POR QUE o saldo acima mudou ─────────── */}
            <SectionTitle>Movimentação no período</SectionTitle>
            <PeriodPicker value={sel} onChange={setSel} />

            {mov && (
              <>
                <ReportCard>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <StatRow
                      label="Passivo emitido"
                      value={fmtCredits(mov.issued)}
                      sub="pão vendido, cortesia e estorno — a empresa passou a dever mais"
                    />
                    <StatRow
                      label="Passivo liquidado"
                      value={fmtCredits(mov.settled)}
                      sub="pão entregue e crédito gasto na Cestinha"
                    />
                    <StatRow
                      label={mov.net >= 0 ? 'Cresceu no período' : 'Diminuiu no período'}
                      value={fmtCredits(Math.abs(mov.net))}
                      sub={
                        mov.net >= 0
                          ? 'vendeu mais pão do que entregou — dívida maior, caixa antecipado'
                          : 'entregou mais do que vendeu — dívida menor'
                      }
                    />
                  </div>
                </ReportCard>

                {mov.rows.length > 0 && (
                  <ReportCard title="Por tipo de movimento">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                      {mov.rows.map((r) => (
                        <StatRow
                          key={r.type}
                          label={`${r.kind === 'in' ? '↑' : '↓'} ${r.label}`}
                          value={fmtCredits(r.credits)}
                          sub={`${fmtInt(r.count)} lançamento(s)`}
                        />
                      ))}
                    </div>
                  </ReportCard>
                )}

                {/* 🚩 A2 — nomear o problema já resolve 80% dele. */}
                {mov.inactive.credits > 0 && (
                  <ReportCard title={`Crédito parado há mais de ${mov.inactive.months} meses`}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <StatRow
                        label="Clientes sem nenhum movimento"
                        value={fmtInt(mov.inactive.clients)}
                        sub="não compram nem consomem desde então"
                      />
                      <StatRow
                        label="Pãezinhos parados"
                        value={fmtCredits(mov.inactive.credits)}
                        sub={`≈ ${fmtBRL(mov.inactive.estBRL)} de dívida que não se move`}
                      />
                    </div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: '11px 0 0', lineHeight: 1.45 }}>
                      <strong>Crédito não expira</strong> neste sistema — este saldo segue como dívida
                      em pão por tempo indeterminado. Definir validade é decisão de negócio (e exige
                      aviso ao cliente), não algo que o relatório resolva sozinho.
                    </p>
                  </ReportCard>
                )}
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
