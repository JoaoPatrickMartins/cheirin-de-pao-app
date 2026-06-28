import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import { SegmentedControl } from '../../../components/admin/SegmentedControl'
import { BarChart } from '../../../components/admin/BarChart'
import { KpiCard } from '../../../components/admin/KpiCard'
import { ReportAppBar, ReportScroll, ReportCard, LoadingText, ErrorText, fmtInt, fmtPct } from './RelShared'
import { buildCsv, downloadCsv } from '../../../lib/csv'

type Period = 'day' | 'week' | 'month'

interface AccessReport {
  period: Period
  access: { total: number; uniqueVisitors: number }
  logins: { total: number; uniqueClients: number }
  conversion: { rate: number; loginVisitors: number; accessVisitors: number }
  series: Array<{ day: string; accesses: number; accessVisitors: number; logins: number }>
}

const PERIOD_TABS = [
  { key: 'day' as Period, label: 'Dia' },
  { key: 'week' as Period, label: 'Semana' },
  { key: 'month' as Period, label: 'Mês' },
]

function formatDay(day: string): string {
  if (day.length < 10) return day
  return `${day.slice(8, 10)}/${day.slice(5, 7)}`
}

export function RelAcesso({ onBack }: { onBack: () => void }) {
  const [period, setPeriod] = useState<Period>('week')
  const [data, setData] = useState<AccessReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/admin/reports/access?period=${period}`)
        setData(res.ok ? ((await res.json()) as AccessReport) : null)
      } catch {
        setData(null)
      } finally {
        setIsLoading(false)
      }
    }
    void run()
  }, [period])

  const series = data?.series ?? []
  const accessBars = series.map((s, i) => ({ label: formatDay(s.day), value: s.accesses, highlight: i === series.length - 1 }))
  const loginBars = series.map((s, i) => ({ label: formatDay(s.day), value: s.logins, highlight: i === series.length - 1 }))
  const hasData = (data?.access.total ?? 0) > 0 || (data?.logins.total ?? 0) > 0

  const onExport = data
    ? () =>
        downloadCsv(
          `aquisicao-${period}.csv`,
          buildCsv(
            ['Dia', 'Acessos', 'Visitantes únicos', 'Logins de clientes'],
            series.map((s) => [s.day, s.accesses, s.accessVisitors, s.logins]),
          ),
        )
    : undefined

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="Aquisição" onBack={onBack} onExport={onExport} />
      <ReportScroll>
        <SegmentedControl tabs={PERIOD_TABS} value={period} onChange={setPeriod} />

        {isLoading ? (
          <LoadingText />
        ) : data ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <KpiCard icon="users" value={fmtInt(data.access.total)} label="Acessos" sub={`${fmtInt(data.access.uniqueVisitors)} visitantes únicos`} />
              <KpiCard icon="user" value={fmtInt(data.logins.total)} label="Logins de clientes" sub={`${fmtInt(data.logins.uniqueClients)} clientes únicos`} />
            </div>

            {/* Conversão */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 18, padding: '18px 18px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Icon name="percent" size={18} color="var(--color-accent)" stroke={2} />
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-sec)' }}>
                  Conversão acesso → login
                </span>
              </div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 8px' }}>
                {fmtPct(data.conversion.rate)}
              </p>
              <div style={{ height: 8, borderRadius: 99, overflow: 'hidden', background: 'var(--color-surface-2)', marginBottom: 8 }}>
                <div style={{ height: '100%', width: `${Math.min(data.conversion.rate * 100, 100)}%`, background: 'var(--color-gold)', borderRadius: 99, transition: 'width 0.3s ease' }} />
              </div>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--color-text-ter)' }}>
                {fmtInt(data.conversion.loginVisitors)} de {fmtInt(data.conversion.accessVisitors)} visitantes logaram
              </span>
            </div>

            <ReportCard title="Acessos por dia">
              <BarChart data={accessBars.length > 0 ? accessBars : [{ label: '—', value: 0 }]} height={80} />
            </ReportCard>

            <ReportCard title="Logins de clientes por dia">
              <BarChart data={loginBars.length > 0 ? loginBars : [{ label: '—', value: 0 }]} height={80} />
            </ReportCard>

            {!hasData && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--color-text-ter)', textAlign: 'center', margin: 0 }}>
                A coleta de acessos e logins começa a partir de agora — os números aparecem conforme o app é usado.
              </p>
            )}
          </>
        ) : (
          <ErrorText />
        )}
      </ReportScroll>
    </div>
  )
}
