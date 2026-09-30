import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import {
  PeriodPicker,
  periodQuery,
  selectionSlug,
  type PeriodSelection,
} from '../../../components/admin/PeriodPicker'
import { ReportAppBar, ReportScroll, ReportCard, LoadingText, ErrorText, fmtInt, fmtBRL } from './RelShared'
import { downloadXlsx } from '../../../lib/xlsx'

type Period = 'day' | 'week' | 'month'

interface CondoItem {
  condominiumId: string
  condominiumName: string
  /** Receita consolidada: créditos + dinheiro novo da Cestinha (D-2). */
  revenue: number
  creditRevenue?: number
  marketRevenue?: number
  activeClients: number
  /** Inclui o pão vendido dentro da Cestinha (D-1). */
  breadsDelivered: number
  /** Valor movimentado em Cestinhas — não é receita (D-2). */
  cestinhaGmv?: number
}

interface CondominiumRankingReport {
  period?: Period
  window: { from: string; to: string; label: string; isPartial: boolean }
  items: CondoItem[]
}

export function RelCondominios({ onBack }: { onBack: () => void }) {
  const [sel, setSel] = useState<PeriodSelection>({ kind: 'preset', period: 'month' })
  const [data, setData] = useState<CondominiumRankingReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/admin/reports/condominiums?${periodQuery(sel)}`)
        setData(res.ok ? ((await res.json()) as CondominiumRankingReport) : null)
      } catch {
        setData(null)
      } finally {
        setIsLoading(false)
      }
    }
    void run()
  }, [sel])

  const items = data?.items ?? []
  const maxRevenue = Math.max(...items.map((i) => i.revenue), 1)

  const onExport =
    data && items.length > 0
      ? () =>
          void downloadXlsx(`condominios-${selectionSlug(sel)}.xlsx`, [
            {
              name: 'Condomínios',
              notes: [`Ranking de condomínios — ${data.window.label}`],
              head: [
                'Condomínio',
                'Receita total',
                'Receita créditos',
                'Receita Cestinha',
                'Movimentado Cestinha',
                'Clientes ativos',
                'Pães entregues',
              ],
              rows: items.map((c) => [
                c.condominiumName,
                c.revenue,
                c.creditRevenue ?? c.revenue,
                c.marketRevenue ?? 0,
                c.cestinhaGmv ?? 0,
                c.activeClients,
                c.breadsDelivered,
              ]),
              money: [1, 2, 3, 4],
              integer: [5, 6],
              footer: [
                'Receita total = créditos + dinheiro NOVO da Cestinha (D-2).',
                'Movimentado da Cestinha NUNCA entra na receita: a parte paga em pãezinhos já foi faturada na compra do combo.',
                ...(data.window.isPartial ? ['Período EM CURSO — números parciais.'] : []),
              ],
            },
          ])
      : undefined

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="Condomínios" onBack={onBack} onExport={onExport} />
      <ReportScroll>
        <PeriodPicker value={sel} onChange={setSel} />

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
                      {/* Composição da receita e o GMV ao lado: sem isso, um condomínio que subiu
                          no ranking por causa da Cestinha parece ter vendido mais crédito. */}
                      {(c.marketRevenue ?? 0) > 0 && ` · ${fmtBRL(c.marketRevenue ?? 0)} da Cestinha`}
                      {(c.cestinhaGmv ?? 0) > 0 && ` · 🧺 ${fmtBRL(c.cestinhaGmv ?? 0)} movimentados`}
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
