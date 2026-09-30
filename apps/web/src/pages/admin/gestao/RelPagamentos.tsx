import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import {
  PeriodPicker,
  periodQuery,
  selectionSlug,
  type PeriodSelection,
} from '../../../components/admin/PeriodPicker'
import { KpiCard } from '../../../components/admin/KpiCard'
import { ReportAppBar, ReportScroll, ReportCard, SectionTitle, StatRow, LoadingText, ErrorText, fmtInt, fmtPct, fmtBRL } from './RelShared'
import { downloadXlsx } from '../../../lib/xlsx'

type Period = 'day' | 'week' | 'month'

interface PaymentsReport {
  period?: Period
  window: { from: string; to: string; label: string; isPartial: boolean }
  byStatus: { paid: number; pending: number; failed: number; refunded: number }
  approvalRate: number
  refundRate: number
  byMethod: Array<{ method: string; count: number; amount: number }>
  /** Por finalidade (D6): uma recusa de combo e uma de Cestinha não são o mesmo problema. */
  byPurpose?: Array<{
    purpose: 'CREDITS' | 'HOOK' | 'MARKET'
    paid: number
    failed: number
    pending: number
    refunded: number
    amount: number
    approvalRate: number
  }>
  recovered: number
}

const PURPOSE_LABEL: Record<string, string> = {
  CREDITS: 'Créditos / combos',
  HOOK: 'Gancho de porta',
  MARKET: '🧺 Cestinha',
}

const METHOD_LABEL: Record<string, string> = {
  PIX: 'Pix',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
}

export function RelPagamentos({ onBack }: { onBack: () => void }) {
  const [sel, setSel] = useState<PeriodSelection>({ kind: 'preset', period: 'month' })
  const [data, setData] = useState<PaymentsReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/admin/reports/payments?${periodQuery(sel)}`)
        setData(res.ok ? ((await res.json()) as PaymentsReport) : null)
      } catch {
        setData(null)
      } finally {
        setIsLoading(false)
      }
    }
    void run()
  }, [sel])

  const s = data?.byStatus

  const onExport =
    data && s
      ? () =>
          void downloadXlsx(`pagamentos-${selectionSlug(sel)}.xlsx`, [
            {
              name: 'Resumo',
              notes: [`Pagamentos — ${data.window.label}`],
              head: ['Métrica', 'Quantidade'],
              rows: [
                ['Aprovados', s.paid],
                ['Pendentes', s.pending],
                ['Falhos', s.failed],
                ['Estornados', s.refunded],
                ['Recuperados (falhou → pagou depois)', data.recovered],
              ],
              integer: [1],
              footer: data.window.isPartial ? ['Período EM CURSO — números parciais.'] : [],
            },
            {
              name: 'Taxas',
              head: ['Métrica', 'Taxa'],
              rows: [
                ['Taxa de aprovação', data.approvalRate],
                ['Taxa de estorno', data.refundRate],
              ],
              percent: [1],
            },
            {
              name: 'Por método',
              head: ['Método', 'Pagamentos', 'Valor aprovado'],
              rows: data.byMethod.map((m) => [METHOD_LABEL[m.method] ?? m.method, m.count, m.amount]),
              integer: [1],
              money: [2],
            },
            ...(data.byPurpose && data.byPurpose.length > 0
              ? [
                  {
                    name: 'Por finalidade',
                    head: ['Finalidade', 'Aprovados', 'Falhos', 'Pendentes', 'Estornados', 'Taxa de aprovação', 'Valor aprovado'],
                    rows: data.byPurpose.map((p) => [
                      PURPOSE_LABEL[p.purpose] ?? p.purpose,
                      p.paid,
                      p.failed,
                      p.pending,
                      p.refunded,
                      p.approvalRate,
                      p.amount,
                    ]),
                    integer: [1, 2, 3, 4],
                    percent: [5],
                    money: [6],
                    footer: ['Cada fluxo com a sua taxa: a média geral esconde um fluxo novo mal configurado.'],
                  },
                ]
              : []),
          ])
      : undefined

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="Pagamentos" onBack={onBack} onExport={onExport} />
      <ReportScroll>
        <PeriodPicker value={sel} onChange={setSel} />

        {isLoading ? (
          <LoadingText />
        ) : data && s ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <KpiCard icon="check" value={fmtPct(data.approvalRate)} label="Taxa de aprovação" sub={`${fmtInt(s.paid)} aprovados`} />
              <KpiCard
                icon="refresh"
                value={fmtPct(data.refundRate)}
                label="Taxa de estorno"
                pill={data.recovered > 0 ? { text: `${fmtInt(data.recovered)} recuperados`, tone: 'good' } : undefined}
                sub={`${fmtInt(s.refunded)} estornados`}
              />
            </div>

            <SectionTitle>Por status</SectionTitle>
            <ReportCard>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <StatRow label="Aprovados" value={fmtInt(s.paid)} />
                <StatRow label="Pendentes" value={fmtInt(s.pending)} />
                <StatRow label="Falhos" value={fmtInt(s.failed)} />
                <StatRow label="Estornados" value={fmtInt(s.refunded)} />
              </div>
            </ReportCard>

            {/* Por finalidade — o fluxo novo (Cestinha) pode estar reprovando muito e a média
                geral esconde isso. Só aparece quando há mais de uma finalidade no período. */}
            {data.byPurpose && data.byPurpose.length > 1 && (
              <>
                <SectionTitle>Por finalidade</SectionTitle>
                <ReportCard>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {data.byPurpose.map((p) => (
                      <StatRow
                        key={p.purpose}
                        label={`${PURPOSE_LABEL[p.purpose] ?? p.purpose} · ${fmtInt(p.paid)} ok / ${fmtInt(p.failed)} falhos`}
                        value={`${fmtPct(p.approvalRate)} · ${fmtBRL(p.amount)}`}
                      />
                    ))}
                  </div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: '10px 0 0' }}>
                    Taxa de aprovação e valor aprovado por fluxo de pagamento.
                  </p>
                </ReportCard>
              </>
            )}

            <SectionTitle>Mix por método (aprovados)</SectionTitle>
            <ReportCard>
              {data.byMethod.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {data.byMethod.map((m) => (
                    <StatRow key={m.method} label={`${METHOD_LABEL[m.method] ?? m.method} · ${fmtInt(m.count)}`} value={fmtBRL(m.amount)} />
                  ))}
                </div>
              ) : (
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>Sem pagamentos aprovados no período.</span>
              )}
            </ReportCard>

            {data.recovered > 0 && (
              <ReportCard>
                <StatRow label="Pagamentos recuperados (falhou → pagou depois)" value={fmtInt(data.recovered)} />
              </ReportCard>
            )}
          </>
        ) : (
          <ErrorText />
        )}
      </ReportScroll>
    </div>
  )
}
