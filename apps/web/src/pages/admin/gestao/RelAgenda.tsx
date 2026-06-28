import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { SegmentedControl } from '../../../components/admin/SegmentedControl'
import { KpiCard } from '../../../components/admin/KpiCard'
import { BarChart } from '../../../components/admin/BarChart'
import { ReportAppBar, ReportScroll, ReportCard, SectionTitle, LoadingText, ErrorText, fmtInt } from './RelShared'
import { buildCsv, downloadCsv } from '../../../lib/csv'

type Period = 'day' | 'week' | 'month'

interface ScheduleProfileReport {
  period: Period
  activeSchedules: number
  totalWeeklyBreads: number
  avgWeeklyBreads: number
  byWeekday: Array<{ day: string; qty: number }>
  orderMix: { single: number; scheduled: number }
}

const PERIOD_TABS = [
  { key: 'day' as Period, label: 'Dia' },
  { key: 'week' as Period, label: 'Semana' },
  { key: 'month' as Period, label: 'Mês' },
]

export function RelAgenda({ onBack }: { onBack: () => void }) {
  const [period, setPeriod] = useState<Period>('month')
  const [data, setData] = useState<ScheduleProfileReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/admin/reports/schedule-profile?period=${period}`)
        setData(res.ok ? ((await res.json()) as ScheduleProfileReport) : null)
      } catch {
        setData(null)
      } finally {
        setIsLoading(false)
      }
    }
    void run()
  }, [period])

  const maxWd = Math.max(...(data?.byWeekday ?? []).map((d) => d.qty), 1)
  const bars = (data?.byWeekday ?? []).map((d) => ({ label: d.day, value: d.qty, highlight: d.qty === maxWd && d.qty > 0 }))
  const single = data?.orderMix.single ?? 0
  const scheduled = data?.orderMix.scheduled ?? 0
  const mixTotal = single + scheduled

  const onExport = data
    ? () =>
        downloadCsv(
          `agenda-${period}.csv`,
          buildCsv(
            ['Item', 'Valor'],
            [
              ['Agendas ativas', data.activeSchedules],
              ['Pães/semana (total)', data.totalWeeklyBreads],
              ['Pães/semana por cliente', data.avgWeeklyBreads.toFixed(1)],
              ...data.byWeekday.map((d) => [`Dia: ${d.day}`, d.qty] as [string, number]),
              ['Pedidos recorrentes (período)', scheduled],
              ['Pedidos únicos (período)', single],
            ],
          ),
        )
    : undefined

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="Perfil da agenda" onBack={onBack} onExport={onExport} />
      <ReportScroll>
        <SegmentedControl tabs={PERIOD_TABS} value={period} onChange={setPeriod} />

        {isLoading ? (
          <LoadingText />
        ) : data ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <KpiCard icon="calendar" value={fmtInt(data.activeSchedules)} label="Agendas ativas" sub={`${fmtInt(data.totalWeeklyBreads)} pães/semana`} />
              <KpiCard icon="bag" value={data.avgWeeklyBreads.toFixed(1).replace('.', ',')} label="Pães/semana por cliente" />
            </div>

            <ReportCard title="Pães por dia da semana">
              <BarChart data={bars.length > 0 ? bars : [{ label: '—', value: 0 }]} height={90} />
            </ReportCard>

            <SectionTitle>Pedidos: único × recorrente (período)</SectionTitle>
            <ReportCard>
              <div style={{ height: 10, borderRadius: 99, overflow: 'hidden', background: 'var(--color-surface-2)', marginBottom: 12, display: 'flex' }}>
                {mixTotal > 0 && (
                  <>
                    <div style={{ width: `${(scheduled / mixTotal) * 100}%`, background: 'var(--color-gold)' }} />
                    <div style={{ flex: 1, background: 'rgba(176,112,42,0.35)' }} />
                  </>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--color-gold)' }} />
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-sec)' }}>Recorrente (agenda)</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{fmtInt(scheduled)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(176,112,42,0.35)' }} />
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-sec)' }}>Único (avulso)</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{fmtInt(single)}</span>
                </div>
              </div>
            </ReportCard>
          </>
        ) : (
          <ErrorText />
        )}
      </ReportScroll>
    </div>
  )
}
