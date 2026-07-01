import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { SegmentedControl } from '../../../components/admin/SegmentedControl'
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
  fmtPct,
} from './RelShared'
import { buildCsv, downloadCsv } from '../../../lib/csv'

type Period = 'day' | 'week' | 'month'

interface RetentionReport {
  period: Period
  autoRecharge: { enabled: number; activeClients: number; rate: number; byMode: { acabar: number; semanal: number } }
  credit: { zeroBalance: number; atRisk: number }
  activation: { registered: number; withSchedule: number; withPurchase: number; withDelivery: number }
  repurchase: { avgIntervalDays: number | null; repurchasingClients: number; creditsSold: number; creditsConsumed: number }
}

const PERIOD_TABS = [
  { key: 'day' as Period, label: 'Dia' },
  { key: 'week' as Period, label: 'Semana' },
  { key: 'month' as Period, label: 'Mês' },
]

const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0)

export function RelRetencao({ onBack }: { onBack: () => void }) {
  const [period, setPeriod] = useState<Period>('month')
  const [data, setData] = useState<RetentionReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/admin/reports/retention?period=${period}`)
        setData(res.ok ? ((await res.json()) as RetentionReport) : null)
      } catch {
        setData(null)
      } finally {
        setIsLoading(false)
      }
    }
    void run()
  }, [period])

  const a = data?.activation
  const reg = a?.registered ?? 0

  const onExport = data
    ? () =>
        downloadCsv(
          `recorrencia-${period}.csv`,
          buildCsv(
            ['Métrica', 'Valor'],
            [
              ['Recarga automática (%)', fmtPct(data.autoRecharge.rate)],
              ['Recarga automática (clientes)', data.autoRecharge.enabled],
              ['Clientes ativos', data.autoRecharge.activeClients],
              ['Clientes sem crédito', data.credit.zeroBalance],
              ['Sem crédito + agenda (risco)', data.credit.atRisk],
              ['Cadastros', a?.registered ?? 0],
              ['Montaram agenda', a?.withSchedule ?? 0],
              ['Fizeram 1ª compra', a?.withPurchase ?? 0],
              ['Receberam 1ª entrega', a?.withDelivery ?? 0],
              ['Intervalo médio de recompra (dias)', data.repurchase.avgIntervalDays ?? ''],
              ['Clientes recorrentes (180d)', data.repurchase.repurchasingClients],
              ['Créditos vendidos (período)', data.repurchase.creditsSold],
              ['Créditos consumidos (período)', data.repurchase.creditsConsumed],
            ],
          ),
        )
    : undefined

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="Recorrência & retenção" onBack={onBack} onExport={onExport} />
      <ReportScroll>
        <SegmentedControl tabs={PERIOD_TABS} value={period} onChange={setPeriod} />

        {isLoading ? (
          <LoadingText />
        ) : data ? (
          <>
            {/* KPIs de saúde */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <KpiCard
                icon="repeat"
                value={fmtPct(data.autoRecharge.rate)}
                label="Recarga automática"
                sub={`${fmtInt(data.autoRecharge.enabled)} de ${fmtInt(data.autoRecharge.activeClients)} ativos`}
              />
              <KpiCard
                icon="wallet"
                value={fmtInt(data.credit.zeroBalance)}
                label="Clientes sem crédito"
                pill={data.credit.atRisk > 0 ? { text: `${fmtInt(data.credit.atRisk)} em risco`, tone: 'gold' } : undefined}
                sub={`${fmtInt(data.credit.atRisk)} com agenda ativa`}
              />
            </div>

            <SectionTitle>Funil de ativação</SectionTitle>
            <ReportCard>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <StatRow label="Cadastros" value={fmtInt(reg)} pct={1} />
                <StatRow label="Montaram agenda" value={fmtInt(a?.withSchedule ?? 0)} pct={safeDiv(a?.withSchedule ?? 0, reg)} />
                <StatRow label="Fizeram 1ª compra" value={fmtInt(a?.withPurchase ?? 0)} pct={safeDiv(a?.withPurchase ?? 0, reg)} />
                <StatRow label="Receberam 1ª entrega" value={fmtInt(a?.withDelivery ?? 0)} pct={safeDiv(a?.withDelivery ?? 0, reg)} />
              </div>
            </ReportCard>

            <SectionTitle>Recompra & créditos</SectionTitle>
            <ReportCard>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <StatRow
                  label="Intervalo médio de recompra"
                  value={data.repurchase.avgIntervalDays != null ? `${data.repurchase.avgIntervalDays.toFixed(1).replace('.', ',')} dias` : '—'}
                />
                <StatRow label="Clientes recorrentes (180d)" value={fmtInt(data.repurchase.repurchasingClients)} />
                <StatRow label="Créditos vendidos (período)" value={fmtInt(data.repurchase.creditsSold)} />
                <StatRow label="Créditos consumidos (período)" value={fmtInt(data.repurchase.creditsConsumed)} />
              </div>
            </ReportCard>

            <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-ter)', margin: 0 }}>
              Recarga automática: {fmtInt(data.autoRecharge.byMode.acabar)} ao acabar · {fmtInt(data.autoRecharge.byMode.semanal)} semanal.
              Intervalo de recompra calculado sobre os últimos 180 dias.
            </p>
          </>
        ) : (
          <ErrorText />
        )}
      </ReportScroll>
    </div>
  )
}
