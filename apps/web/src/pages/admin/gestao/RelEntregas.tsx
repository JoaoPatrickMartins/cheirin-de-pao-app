import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import {
  PeriodPicker,
  periodQuery,
  selectionSlug,
  type PeriodSelection,
} from '../../../components/admin/PeriodPicker'
import { KpiCard } from '../../../components/admin/KpiCard'
import { ReportAppBar, ReportScroll, ReportCard, SectionTitle, StatRow, LoadingText, ErrorText, fmtInt, fmtPct } from './RelShared'
import { downloadXlsx } from '../../../lib/xlsx'

type Period = 'day' | 'week' | 'month'

interface DeliveryCounts {
  total: number
  delivered: number
  notDelivered: number
  cancelled: number
  inProgress: number
}

interface DeliveryReport {
  period?: Period
  window: { from: string; to: string; label: string; isPartial: boolean }
  counts: DeliveryCounts
  deliveryRate: number
  /** Pão × Cestinha (D3) — a taxa consolidada esconde de onde vem a falha. */
  byKind?: {
    bread: DeliveryCounts & { deliveryRate: number }
    cestinha: DeliveryCounts & { deliveryRate: number }
  }
  failureReasons: Array<{ reason: string; count: number }>
  cancelReasons: Array<{ reason: string; count: number }>
  /** A10: motivos padronizados do app do entregador (pão + Cestinha por código). */
  failureCodes?: Array<{ code: string; label: string; count: number }>
  /** A10: paradas sem foto (exceção "Não consigo tirar a foto"), por motivo. */
  noPhoto?: { count: number; byReason: Array<{ label: string; count: number }> }
}

export function RelEntregas({ onBack }: { onBack: () => void }) {
  const [sel, setSel] = useState<PeriodSelection>({ kind: 'preset', period: 'month' })
  const [data, setData] = useState<DeliveryReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/admin/reports/delivery?${periodQuery(sel)}`)
        setData(res.ok ? ((await res.json()) as DeliveryReport) : null)
      } catch {
        setData(null)
      } finally {
        setIsLoading(false)
      }
    }
    void run()
  }, [sel])

  const c = data?.counts
  const finalized = (c?.delivered ?? 0) + (c?.notDelivered ?? 0)

  const onExport =
    data && c
      ? () =>
          void downloadXlsx(`entregas-${selectionSlug(sel)}.xlsx`, [
            {
              name: 'Resumo',
              notes: [`Entregas & falhas — ${data.window.label}`],
              head: ['Status', 'Pedidos'],
              rows: [
                ['Entregues', c.delivered],
                ['Não entregues', c.notDelivered],
                ['Cancelados', c.cancelled],
                ['Em andamento', c.inProgress],
                ['Total', c.total],
              ],
              integer: [1],
              footer: [
                `Taxa de entrega: ${fmtPct(data.deliveryRate)}`,
                'A unidade contada é o PEDIDO, não a parada: pão e Cestinha do mesmo cliente podem falhar de forma independente.',
                ...(data.window.isPartial ? ['Período EM CURSO — números parciais.'] : []),
              ],
            },
            ...(data.byKind
              ? [
                  {
                    name: 'Por tipo',
                    head: ['Tipo', 'Entregues', 'Não entregues', 'Cancelados', 'Em andamento', 'Taxa de entrega'],
                    rows: [
                      ['Pão', data.byKind.bread.delivered, data.byKind.bread.notDelivered, data.byKind.bread.cancelled, data.byKind.bread.inProgress, data.byKind.bread.deliveryRate],
                      ['Cestinha', data.byKind.cestinha.delivered, data.byKind.cestinha.notDelivered, data.byKind.cestinha.cancelled, data.byKind.cestinha.inProgress, data.byKind.cestinha.deliveryRate],
                    ],
                    integer: [1, 2, 3, 4],
                    percent: [5],
                    footer: ['Cestinha aguardando pagamento não entra (nunca confirmou).'],
                  },
                ]
              : []),
            {
              name: 'Motivos',
              head: ['Tipo', 'Motivo', 'Ocorrências'],
              rows: [
                ...(data.failureCodes ?? []).map((r) => ['Não-entrega (padronizado)', r.label, r.count]),
                ...(data.noPhoto?.byReason ?? []).map((r) => ['Sem foto', r.label, r.count]),
                ...data.failureReasons.map((r) => ['Não-entrega', r.reason, r.count]),
                ...data.cancelReasons.map((r) => ['Cancelamento', r.reason, r.count]),
              ],
              integer: [2],
            },
          ])
      : undefined

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="Entregas & falhas" onBack={onBack} onExport={onExport} />
      <ReportScroll>
        <PeriodPicker value={sel} onChange={setSel} />

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

            {/* A10: motivos padronizados (o app do entregador escolhe de uma lista). */}
            {(data.failureCodes?.length ?? 0) > 0 && (
              <ReportCard title="Motivos de não entrega">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(() => {
                    const codes = data.failureCodes ?? []
                    const tot = codes.reduce((n, r) => n + r.count, 0)
                    const max = Math.max(1, ...codes.map((r) => r.count))
                    return codes.map((r, i) => (
                      <div key={r.code} role="group" aria-label={`${r.label}: ${r.count}`}>
                        <div style={{ display: 'flex', fontFamily: 'var(--font-body)', fontSize: 13.5, marginBottom: 4 }}>
                          <span style={{ flex: 1, fontWeight: 700, color: 'var(--color-text)' }}>{r.label}</span>
                          <b style={{ color: 'var(--color-text)' }}>{fmtInt(r.count)}</b>
                          <span style={{ width: 44, textAlign: 'right', color: 'var(--color-text-sec)', fontWeight: 600 }}>{tot > 0 ? `${Math.round((r.count / tot) * 100)}%` : ''}</span>
                        </div>
                        <div style={{ height: 8, borderRadius: 99, background: 'var(--color-surface-2)' }}>
                          <div style={{ height: '100%', width: `${(r.count / max) * 100}%`, borderRadius: 99, background: i === 0 ? 'var(--color-warn)' : 'var(--color-accent)' }} />
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              </ReportCard>
            )}

            {data.noPhoto && data.noPhoto.count > 0 && (
              <ReportCard>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontFamily: 'var(--font-body)' }}>
                  <Icon name="ban" size={19} color="var(--color-warn)" aria-hidden="true" />
                  <div style={{ flex: 1, fontSize: 13.5, color: 'var(--color-text)' }}>
                    <b>
                      {fmtInt(data.noPhoto.count)} {data.noPhoto.count === 1 ? 'entrega sem foto' : 'entregas sem foto'}
                    </b>{' '}
                    no período
                    {data.noPhoto.byReason[0] ? ` · ${fmtInt(data.noPhoto.byReason[0].count)} “${data.noPhoto.byReason[0].label.toLowerCase()}”` : ''}
                  </div>
                </div>
              </ReportCard>
            )}

            {data.failureReasons.length > 0 && !(data.failureCodes?.length ?? 0) && (
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
