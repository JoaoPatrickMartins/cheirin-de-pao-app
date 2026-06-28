import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { SegmentedControl } from '../../../components/admin/SegmentedControl'
import { KpiCard } from '../../../components/admin/KpiCard'
import { ReportAppBar, ReportScroll, ReportCard, SectionTitle, StatRow, LoadingText, ErrorText, fmtInt, fmtPct, fmtBRL } from './RelShared'
import { buildCsv, downloadCsv } from '../../../lib/csv'

type Period = 'day' | 'week' | 'month'

interface PaymentsReport {
  period: Period
  byStatus: { paid: number; pending: number; failed: number; refunded: number }
  approvalRate: number
  refundRate: number
  byMethod: Array<{ method: string; count: number; amount: number }>
  recovered: number
}

const PERIOD_TABS = [
  { key: 'day' as Period, label: 'Dia' },
  { key: 'week' as Period, label: 'Semana' },
  { key: 'month' as Period, label: 'Mês' },
]

const METHOD_LABEL: Record<string, string> = {
  PIX: 'Pix',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
}

export function RelPagamentos({ onBack }: { onBack: () => void }) {
  const [period, setPeriod] = useState<Period>('month')
  const [data, setData] = useState<PaymentsReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/admin/reports/payments?period=${period}`)
        setData(res.ok ? ((await res.json()) as PaymentsReport) : null)
      } catch {
        setData(null)
      } finally {
        setIsLoading(false)
      }
    }
    void run()
  }, [period])

  const s = data?.byStatus

  const onExport =
    data && s
      ? () =>
          downloadCsv(
            `pagamentos-${period}.csv`,
            buildCsv(
              ['Métrica', 'Valor'],
              [
                ['Taxa de aprovação (%)', fmtPct(data.approvalRate)],
                ['Taxa de estorno (%)', fmtPct(data.refundRate)],
                ['Aprovados', s.paid],
                ['Pendentes', s.pending],
                ['Falhos', s.failed],
                ['Estornados', s.refunded],
                ['Recuperados', data.recovered],
                ...data.byMethod.map(
                  (m) => [`Método: ${METHOD_LABEL[m.method] ?? m.method}`, `${m.count} · R$ ${m.amount.toFixed(2)}`] as [string, string],
                ),
              ],
            ),
          )
      : undefined

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="Pagamentos" onBack={onBack} onExport={onExport} />
      <ReportScroll>
        <SegmentedControl tabs={PERIOD_TABS} value={period} onChange={setPeriod} />

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
