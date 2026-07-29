import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { SegmentedControl } from '../../../components/admin/SegmentedControl'
import { KpiCard } from '../../../components/admin/KpiCard'
import { ReportAppBar, ReportScroll, ReportCard, SectionTitle, StatRow, LoadingText, ErrorText, fmtInt, fmtPct } from './RelShared'
import { buildCsv, downloadCsv } from '../../../lib/csv'

type Period = 'day' | 'week' | 'month'

interface DeliveryCounts {
  total: number
  delivered: number
  notDelivered: number
  cancelled: number
  inProgress: number
}

interface DeliveryReport {
  period: Period
  counts: DeliveryCounts
  deliveryRate: number
  /** Pão × Cestinha (D3) — a taxa consolidada esconde de onde vem a falha. */
  byKind?: {
    bread: DeliveryCounts & { deliveryRate: number }
    cestinha: DeliveryCounts & { deliveryRate: number }
  }
  failureReasons: Array<{ reason: string; count: number }>
  cancelReasons: Array<{ reason: string; count: number }>
}

const PERIOD_TABS = [
  { key: 'day' as Period, label: 'Dia' },
  { key: 'week' as Period, label: 'Semana' },
  { key: 'month' as Period, label: 'Mês' },
]

export function RelEntregas({ onBack }: { onBack: () => void }) {
  const [period, setPeriod] = useState<Period>('month')
  const [data, setData] = useState<DeliveryReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/admin/reports/delivery?period=${period}`)
        setData(res.ok ? ((await res.json()) as DeliveryReport) : null)
      } catch {
        setData(null)
      } finally {
        setIsLoading(false)
      }
    }
    void run()
  }, [period])

  const c = data?.counts
  const finalized = (c?.delivered ?? 0) + (c?.notDelivered ?? 0)

  const onExport =
    data && c
      ? () =>
          downloadCsv(
            `entregas-${period}.csv`,
            buildCsv(
              ['Métrica', 'Valor'],
              [
                ['Taxa de entrega (%)', fmtPct(data.deliveryRate)],
                ['Entregues', c.delivered],
                ['Não entregues', c.notDelivered],
                ['Cancelados', c.cancelled],
                ['Em andamento', c.inProgress],
                ['Total', c.total],
                ...(data.byKind
                  ? ([
                      ['Pão — entregues', data.byKind.bread.delivered],
                      ['Pão — não entregues', data.byKind.bread.notDelivered],
                      ['Pão — taxa de entrega (%)', fmtPct(data.byKind.bread.deliveryRate)],
                      ['Cestinha — entregues', data.byKind.cestinha.delivered],
                      ['Cestinha — não entregues', data.byKind.cestinha.notDelivered],
                      ['Cestinha — taxa de entrega (%)', fmtPct(data.byKind.cestinha.deliveryRate)],
                    ] as Array<[string, string | number]>)
                  : []),
                ...data.failureReasons.map((r) => [`Falha: ${r.reason}`, r.count] as [string, number]),
                ...data.cancelReasons.map((r) => [`Cancelamento: ${r.reason}`, r.count] as [string, number]),
              ],
            ),
          )
      : undefined

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="Entregas & falhas" onBack={onBack} onExport={onExport} />
      <ReportScroll>
        <SegmentedControl tabs={PERIOD_TABS} value={period} onChange={setPeriod} />

        {isLoading ? (
          <LoadingText />
        ) : data && c ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <KpiCard icon="truck" value={fmtPct(data.deliveryRate)} label="Taxa de entrega" sub={`${fmtInt(c.delivered)} de ${fmtInt(finalized)} finalizadas`} />
              <KpiCard icon="ban" value={fmtInt(c.notDelivered + c.cancelled)} label="Falhas + cancelamentos" sub={`${fmtInt(c.inProgress)} em andamento`} />
            </div>

            <SectionTitle>Pedidos por status</SectionTitle>
            <ReportCard>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <StatRow label="Entregues" value={fmtInt(c.delivered)} />
                <StatRow label="Não entregues" value={fmtInt(c.notDelivered)} />
                <StatRow label="Cancelados" value={fmtInt(c.cancelled)} />
                <StatRow label="Em andamento" value={fmtInt(c.inProgress)} />
              </div>
            </ReportCard>

            {/* Pão × Cestinha — só quando existe Cestinha no período, para a tela não ganhar um
                card vazio em quem ainda não vende pelo mercadinho. */}
            {data.byKind && data.byKind.cestinha.total > 0 && (
              <ReportCard title="Por tipo de pedido">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <StatRow
                    label="🥖 Pão"
                    value={`${fmtPct(data.byKind.bread.deliveryRate)} · ${fmtInt(data.byKind.bread.delivered)}/${fmtInt(data.byKind.bread.delivered + data.byKind.bread.notDelivered)}`}
                  />
                  <StatRow
                    label="🧺 Cestinha"
                    value={`${fmtPct(data.byKind.cestinha.deliveryRate)} · ${fmtInt(data.byKind.cestinha.delivered)}/${fmtInt(data.byKind.cestinha.delivered + data.byKind.cestinha.notDelivered)}`}
                  />
                </div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: '10px 0 0' }}>
                  Taxa de entrega e finalizadas por tipo. Cestinha aguardando pagamento não entra.
                </p>
              </ReportCard>
            )}

            {data.failureReasons.length > 0 && (
              <ReportCard title="Motivos de não-entrega">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.failureReasons.map((r) => (
                    <StatRow key={r.reason} label={r.reason} value={fmtInt(r.count)} />
                  ))}
                </div>
              </ReportCard>
            )}

            {data.cancelReasons.length > 0 && (
              <ReportCard title="Motivos de cancelamento">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.cancelReasons.map((r) => (
                    <StatRow key={r.reason} label={r.reason} value={fmtInt(r.count)} />
                  ))}
                </div>
              </ReportCard>
            )}

            {c.total === 0 && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--color-text-ter)', textAlign: 'center', margin: 0 }}>
                Sem pedidos no período.
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
