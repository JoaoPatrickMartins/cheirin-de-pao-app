import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { SegmentedControl } from '../../../components/admin/SegmentedControl'
import { ReportAppBar, ReportScroll, ReportCard, LoadingText, ErrorText, fmtInt, fmtBRL } from './RelShared'
import { buildCsv, downloadCsv } from '../../../lib/csv'

type Period = 'day' | 'week' | 'month'

interface CondoItem {
  condominiumId: string
  condominiumName: string
  revenue: number
  activeClients: number
  breadsDelivered: number
}

interface CondominiumRankingReport {
  period: Period
  items: CondoItem[]
}

const PERIOD_TABS = [
  { key: 'day' as Period, label: 'Dia' },
  { key: 'week' as Period, label: 'Semana' },
  { key: 'month' as Period, label: 'Mês' },
]

export function RelCondominios({ onBack }: { onBack: () => void }) {
  const [period, setPeriod] = useState<Period>('month')
  const [data, setData] = useState<CondominiumRankingReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/admin/reports/condominiums?period=${period}`)
        setData(res.ok ? ((await res.json()) as CondominiumRankingReport) : null)
      } catch {
        setData(null)
      } finally {
        setIsLoading(false)
      }
    }
    void run()
  }, [period])

  const items = data?.items ?? []
  const maxRevenue = Math.max(...items.map((i) => i.revenue), 1)

  const onExport =
    data && items.length > 0
      ? () =>
          downloadCsv(
            `condominios-${period}.csv`,
            buildCsv(
              ['Condomínio', 'Receita (R$)', 'Clientes ativos', 'Pães entregues'],
              items.map((c) => [c.condominiumName, c.revenue.toFixed(2), c.activeClients, c.breadsDelivered]),
            ),
          )
      : undefined

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="Condomínios" onBack={onBack} onExport={onExport} />
      <ReportScroll>
        <SegmentedControl tabs={PERIOD_TABS} value={period} onChange={setPeriod} />

        {isLoading ? (
          <LoadingText />
        ) : data ? (
          items.length > 0 ? (
            <ReportCard title="Ranking por receita">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {items.map((c, idx) => (
                  <div key={c.condominiumId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {idx + 1}. {c.condominiumName}
                      </span>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', flexShrink: 0 }}>
                        {fmtBRL(c.revenue)}
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: 'var(--color-surface-2)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(c.revenue / maxRevenue) * 100}%`, background: 'var(--color-gold)', borderRadius: 99, transition: 'width 0.3s ease' }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-ter)' }}>
                      {fmtInt(c.activeClients)} clientes ativos · {fmtInt(c.breadsDelivered)} pães entregues
                    </span>
                  </div>
                ))}
              </div>
            </ReportCard>
          ) : (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-ter)', textAlign: 'center', paddingTop: 24 }}>
              Sem dados de condomínios no período.
            </p>
          )
        ) : (
          <ErrorText />
        )}
      </ReportScroll>
    </div>
  )
}
