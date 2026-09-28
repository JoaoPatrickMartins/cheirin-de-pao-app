import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import {
  PeriodPicker,
  periodQuery,
  selectionSlug,
  type PeriodSelection,
} from '../../../components/admin/PeriodPicker'
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
  fmtBRL,
  fmtPct,
} from './RelShared'
import { downloadXlsx } from '../../../lib/xlsx'

/**
 * RelClientes — Top clientes, LTV e novos × recorrentes (V7/V8 da Fase 6).
 *
 * A tela existe para duas leituras que o ranking de condomínios não alcança:
 *
 *   1. **Quem sustenta o faturamento** — e o quanto disso está concentrado em poucos. Concentração
 *      alta não é elogio: é risco de receita.
 *   2. **Campeão do mês × cliente fiel** — por isso a receita do período e o LTV aparecem na MESMA
 *      linha. Um cliente que fez uma compra grande e sumiu e outro que compra todo mês há um ano
 *      podem ocupar a mesma posição no ranking do mês, e só o LTV os distingue.
 */

interface TopCustomer {
  userId: string
  name: string
  condominiumName: string | null
  revenue: number
  orders: number
  avgTicket: number
  ltv: number
  share: number
  isNew: boolean
}

interface CustomersReport {
  window: { from: string; to: string; label: string; isPartial: boolean }
  buyers: number
  revenue: number
  newCustomers: { clients: number; revenue: number; share: number }
  returning: { clients: number; revenue: number; share: number }
  concentration: { top5: number; top10: number }
  top: TopCustomer[]
  caveats: string[]
}

export function RelClientes({ onBack }: { onBack: () => void }) {
  const [sel, setSel] = useState<PeriodSelection>({ kind: 'preset', period: 'month' })
  const [data, setData] = useState<CustomersReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/admin/reports/customers?${periodQuery(sel)}`)
        if (cancelled) return
        setData(res.ok ? ((await res.json()) as CustomersReport) : null)
      } catch {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sel])

  const top = data?.top ?? []
  const maxRevenue = Math.max(...top.map((c) => c.revenue), 1)

  const onExport = data
    ? () =>
        void downloadXlsx(`clientes-${selectionSlug(sel)}.xlsx`, [
          {
            name: 'Top clientes',
            notes: [`Clientes & LTV — ${data.window.label}`],
            head: ['Cliente', 'Condomínio', 'Receita no período', 'Pedidos', 'Ticket médio', 'LTV (desde sempre)', '% da receita', 'Novo'],
            rows: top.map((c) => [
              c.name,
              c.condominiumName ?? '',
              c.revenue,
              c.orders,
              c.avgTicket,
              c.ltv,
              c.share,
              c.isNew ? 'Sim' : 'Não',
            ]),
            money: [2, 4, 5],
            integer: [3],
            percent: [6],
            footer: data.caveats,
          },
          {
            name: 'Novos x base',
            head: ['Grupo', 'Clientes', 'Receita', '% da receita'],
            rows: [
              ['Novos no período', data.newCustomers.clients, data.newCustomers.revenue, data.newCustomers.share],
              ['Base existente', data.returning.clients, data.returning.revenue, data.returning.share],
              ['TOTAL', data.buyers, data.revenue, 1],
            ],
            integer: [1],
            money: [2],
            percent: [3],
          },
          {
            name: 'Concentração',
            head: ['Recorte', 'Fatia da receita'],
            rows: [
              ['5 maiores clientes', data.concentration.top5],
              ['10 maiores clientes', data.concentration.top10],
            ],
            percent: [1],
            footer: ['Concentração alta é risco de receita, não elogio: a saída de um cliente derruba o mês.'],
          },
        ])
    : undefined

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="Clientes & LTV" onBack={onBack} onExport={onExport} />
      <ReportScroll>
        <PeriodPicker value={sel} onChange={setSel} />

        {isLoading ? (
          <LoadingText />
        ) : data ? (
          data.buyers > 0 ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <KpiCard
                  icon="users"
                  value={fmtInt(data.buyers)}
                  label="Clientes que compraram"
                  sub={`${fmtBRL(data.revenue)} no período`}
                />
                <KpiCard
                  icon="spark"
                  value={fmtInt(data.newCustomers.clients)}
                  label="Novos no período"
                  sub={`${fmtBRL(data.newCustomers.revenue)} · ${fmtPct(data.newCustomers.share)} da receita`}
                />
              </div>

              <SectionTitle>De onde vem a receita</SectionTitle>
              <ReportCard>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <StatRow
                    label="Clientes novos"
                    value={fmtBRL(data.newCustomers.revenue)}
                    pct={data.newCustomers.share}
                    sub={`${fmtInt(data.newCustomers.clients)} cliente(s)`}
                  />
                  <StatRow
                    label="Base existente"
                    value={fmtBRL(data.returning.revenue)}
                    pct={data.returning.share}
                    sub={`${fmtInt(data.returning.clients)} cliente(s)`}
                  />
                </div>
              </ReportCard>

              <SectionTitle>Concentração</SectionTitle>
              <ReportCard>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <StatRow label="5 maiores clientes" value={fmtPct(data.concentration.top5)} pct={data.concentration.top5} />
                  <StatRow label="10 maiores clientes" value={fmtPct(data.concentration.top10)} pct={data.concentration.top10} />
                </div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: '11px 0 0', lineHeight: 1.4 }}>
                  Quanto da receita depende de poucos clientes. Concentração alta é <strong>risco</strong>:
                  a saída de um deles derruba o mês.
                </p>
              </ReportCard>

              <SectionTitle>Top clientes</SectionTitle>
              <ReportCard>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {top.map((c, idx) => (
                    <div key={c.userId} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: 'var(--color-text)',
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {idx + 1}. {c.name}
                          {c.isNew && (
                            <span
                              style={{
                                marginLeft: 6,
                                padding: '2px 6px',
                                borderRadius: 99,
                                background: 'var(--color-good-soft)',
                                color: 'var(--color-good)',
                                fontSize: 10,
                                fontWeight: 800,
                              }}
                            >
                              novo
                            </span>
                          )}
                        </span>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', flexShrink: 0 }}>
                          {fmtBRL(c.revenue)}
                        </span>
                      </div>
                      <div style={{ height: 6, borderRadius: 99, background: 'var(--color-surface-2)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(c.revenue / maxRevenue) * 100}%`, background: 'var(--color-gold)', borderRadius: 99 }} />
                      </div>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-ter)' }}>
                        {fmtInt(c.orders)} pedido(s) · {fmtBRL(c.avgTicket)} de ticket · LTV {fmtBRL(c.ltv)}
                        {c.condominiumName ? ` · ${c.condominiumName}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: '12px 0 0', lineHeight: 1.4 }}>
                  <strong>LTV</strong> é a receita acumulada desde sempre. Ela ao lado da receita do
                  período é o que separa o cliente fiel de quem fez uma compra grande e sumiu.
                </p>
              </ReportCard>

              {data.caveats.length > 0 && (
                <ReportCard>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {data.caveats.map((c) => (
                      <p key={c} style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: 0, lineHeight: 1.4 }}>
                        {c}
                      </p>
                    ))}
                  </div>
                </ReportCard>
              )}
            </>
          ) : (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-ter)', textAlign: 'center', paddingTop: 24 }}>
              Nenhum cliente comprou no período.
            </p>
          )
        ) : (
          <ErrorText />
        )}
      </ReportScroll>
    </div>
  )
}
