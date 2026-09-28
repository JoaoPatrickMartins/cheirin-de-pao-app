import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import {
  PeriodPicker,
  periodQuery,
  selectionSlug,
  type PeriodSelection,
} from '../../../components/admin/PeriodPicker'
import { KpiCard } from '../../../components/admin/KpiCard'
import { BarChart } from '../../../components/admin/BarChart'
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
} from './RelShared'
import { downloadXlsx } from '../../../lib/xlsx'

/**
 * RelVendas — Vendas & performance (V1–V4, V6, V9 da Fase 6 do plano-financeiro-vendas).
 *
 * A tela tem uma responsabilidade que nenhum outro relatório do admin tem: **manter separadas as
 * duas bases**. `sales` é volume apurado pelo DIA DE ENTREGA; `channel`/`ticket`/`combos` são
 * receita apurada pela DATA DO PAGAMENTO. Num modelo pré-pago elas não fecham — o pão entregue
 * agora foi pago semanas atrás — e a tela precisa dizer isso, não disfarçar.
 *
 * Por isso as seções de volume e de receita nunca aparecem no mesmo cartão, e as ressalvas do
 * servidor ficam ACIMA dos números, no mesmo padrão que o DRE adotou.
 */

type AbcClass = 'A' | 'B' | 'C'

interface SalesLine {
  productId: string
  name: string
  isBread: boolean
  qty: number
  revenue: number
  avgUnitPrice: number
  share: number
  cumulativeShare: number
  abc: AbcClass
}

interface SalesReport {
  window: { from: string; to: string; label: string; isPartial: boolean }
  previous?: { label: string }
  sales: {
    days: string[]
    breads: { total: number; single: number; scheduled: number; fromMarket: number; unitPrice: number; revenue: number }
    items: { total: number; revenue: number }
    totalRevenue: number
    counts: { stops: number; clients: number; condominiums: number; breadOrders: number; marketOrders: number; days: number }
    lines: SalesLine[]
    byDay: Array<{ date: string; breads: number; items: number; revenue: number }>
    byWeekday: Array<{ day: string; label: string; breads: number; items: number; revenue: number; occurrences: number; avgRevenue: number }>
  }
  channel: {
    total: number
    deltaPct: number | null
    slices: Array<{ key: string; label: string; revenue: number; share: number; deltaPct: number | null }>
  }
  ticket: {
    credit: { orders: number; revenue: number; avg: number; deltaPct: number | null }
    market: { orders: number; revenue: number; avg: number }
    perClient: { orders: number; revenue: number; avg: number }
  }
  combos: Array<{
    comboId: string
    name: string
    quantity: number
    price: number
    orders: number
    revenue: number
    share: number
    pricePerCredit: number | null
  }>
  condominiums: Array<{
    condominiumId: string
    condominiumName: string
    revenue: number
    activeClients: number
    breadsDelivered: number
    revenuePerClient: number
    breadsPerClient: number
  }>
  caveats: string[]
}

const ABC_COLOR: Record<AbcClass, string> = {
  A: 'var(--color-gold)',
  B: 'var(--color-accent)',
  C: 'var(--color-border-2)',
}

const dayShort = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** Δ em pp/%, com o sinal e a cor certos. `null` vira "—" em vez de sumir. */
function DeltaTag({ value }: { value: number | null }) {
  if (value == null) {
    return (
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, color: 'var(--color-text-ter)' }}>
        —
      </span>
    )
  }
  const up = value >= 0
  return (
    <span
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 11,
        fontWeight: 700,
        color: up ? 'var(--color-good)' : 'var(--color-warn)',
        whiteSpace: 'nowrap',
      }}
    >
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(1).replace('.', ',')}%
    </span>
  )
}

export function RelVendas({ onBack }: { onBack: () => void }) {
  const [sel, setSel] = useState<PeriodSelection>({ kind: 'preset', period: 'month' })
  const [data, setData] = useState<SalesReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/admin/reports/sales?${periodQuery(sel)}`)
        if (cancelled) return
        setData(res.ok ? ((await res.json()) as SalesReport) : null)
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

  const s = data?.sales
  const lines = s?.lines ?? []
  const maxLineRevenue = Math.max(...lines.map((l) => l.revenue), 1)

  // A série diária pode ter 31 pontos; o BarChart fica ilegível com rótulo em todos. Mostra os
  // últimos 14, que é o que cabe num celular sem virar um borrão.
  const dayBars = (s?.byDay ?? []).slice(-14).map((d) => ({
    label: dayShort(d.date),
    value: d.revenue,
    highlight: false,
  }))
  const weekdayBars = (s?.byWeekday ?? []).map((w) => ({
    label: w.label.slice(0, 3),
    value: w.avgRevenue,
    highlight: w.avgRevenue === Math.max(...(s?.byWeekday ?? []).map((x) => x.avgRevenue), 0) && w.avgRevenue > 0,
  }))

  const onExport = data
    ? () =>
        void downloadXlsx(`vendas-${selectionSlug(sel)}.xlsx`, [
          {
            name: 'Itens vendidos',
            notes: [`Vendas & performance — ${data.window.label}`],
            head: ['Produto', 'Unidades', 'Preço médio', 'Receita', '% do total', 'Acumulado', 'Classe ABC'],
            rows: lines.map((l) => [
              l.name,
              l.qty,
              l.avgUnitPrice,
              l.revenue,
              l.share,
              l.cumulativeShare,
              l.abc,
            ]),
            integer: [1],
            money: [2, 3],
            percent: [4, 5],
            footer: data.caveats,
          },
          {
            name: 'Mix de canal',
            head: ['Canal', 'Receita', '% do total', 'Variação'],
            rows: data.channel.slices.map((c) => [
              c.label,
              c.revenue,
              c.share,
              c.deltaPct != null ? c.deltaPct / 100 : null,
            ]),
            money: [1],
            percent: [2, 3],
            footer: [
              `Receita consolidada do período: R$ ${data.channel.total.toFixed(2)}`,
              ...(data.previous ? [`Comparado com ${data.previous.label}.`] : []),
            ],
          },
          {
            name: 'Ticket médio',
            head: ['Base', 'Pedidos', 'Valor', 'Ticket médio'],
            rows: [
              ['Compra de crédito', data.ticket.credit.orders, data.ticket.credit.revenue, data.ticket.credit.avg],
              ['🧺 Cestinha (movimentado)', data.ticket.market.orders, data.ticket.market.revenue, data.ticket.market.avg],
              ['Por cliente comprador', data.ticket.perClient.orders, data.ticket.perClient.revenue, data.ticket.perClient.avg],
            ],
            integer: [1],
            money: [2, 3],
            footer: [
              'O ticket da Cestinha usa o valor MOVIMENTADO: um pedido pago metade em pãezinhos vale o que o cliente levou.',
            ],
          },
          {
            name: 'Por combo',
            head: ['Combo', 'Pãezinhos', 'Preço', 'Pedidos', 'Receita', '% da receita de combo', 'R$ por pãozinho'],
            rows: data.combos.map((c) => [c.name, c.quantity, c.price, c.orders, c.revenue, c.share, c.pricePerCredit]),
            integer: [1, 3],
            money: [2, 4, 6],
            percent: [5],
            footer: ['R$ por pãozinho é o que compara combos de tamanhos diferentes.'],
          },
          {
            name: 'Por condomínio',
            head: ['Condomínio', 'Receita', 'Clientes ativos', 'Pães entregues', 'Receita/cliente', 'Pães/cliente'],
            rows: data.condominiums.map((c) => [
              c.condominiumName,
              c.revenue,
              c.activeClients,
              c.breadsDelivered,
              c.revenuePerClient,
              c.breadsPerClient,
            ]),
            money: [1, 4],
            integer: [2, 3],
          },
          {
            name: 'Série diária',
            head: ['Dia', 'Pães', 'Itens', 'Valor vendido'],
            rows: (s?.byDay ?? []).map((d) => [d.date, d.breads, d.items, d.revenue]),
            integer: [1, 2],
            money: [3],
            footer: ['Série CONTÍNUA: dia sem venda entra com zero.'],
          },
          {
            name: 'Sazonalidade',
            head: ['Dia da semana', 'Ocorrências', 'Pães', 'Itens', 'Valor total', 'Média por ocorrência'],
            rows: (s?.byWeekday ?? []).map((w) => [w.label, w.occurrences, w.breads, w.items, w.revenue, w.avgRevenue]),
            integer: [1, 2, 3],
            money: [4, 5],
            footer: [
              'A média por ocorrência é o que compara os dias: um período de 10 dias tem 2 segundas e 1 sábado, e o total bruto premiaria o dia que repetiu mais.',
            ],
          },
        ])
    : undefined

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="Vendas & performance" onBack={onBack} onExport={onExport} />
      <ReportScroll>
        <PeriodPicker value={sel} onChange={setSel} />

        {isLoading ? (
          <LoadingText />
        ) : data && s ? (
          <>
            {/* As ressalvas vêm ACIMA dos números, como no DRE: um número lido antes da ressalva
                já formou opinião quando ela aparece. */}
            {data.caveats.length > 0 && (
              <div
                style={{
                  background: 'var(--color-gold-soft)',
                  border: '1px solid var(--color-border-2)',
                  borderRadius: 14,
                  padding: '11px 13px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5,
                }}
              >
                {data.caveats.map((c) => (
                  <p
                    key={c}
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: '#6B5200',
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    {c}
                  </p>
                ))}
              </div>
            )}

            {/* ── Receita (lado do dinheiro) ─────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <KpiCard
                icon="coin"
                value={fmtBRL(data.channel.total)}
                label="Receita do período"
                sub={data.previous ? `vs. ${data.previous.label}` : undefined}
                pill={
                  data.channel.deltaPct != null
                    ? {
                        text: `${data.channel.deltaPct >= 0 ? '+' : ''}${data.channel.deltaPct.toFixed(1).replace('.', ',')}%`,
                        // Não há tom "ruim" no KpiCard; queda sai em neutro, e a seta vermelha do
                        // mix de canal abaixo é quem carrega o sinal.
                        tone: data.channel.deltaPct >= 0 ? 'good' : 'neutral',
                      }
                    : undefined
                }
              />
              <KpiCard
                icon="card"
                value={fmtBRL(data.ticket.credit.avg)}
                label="Ticket de crédito"
                sub={`${fmtInt(data.ticket.credit.orders)} pedidos`}
              />
            </div>

            <SectionTitle>Mix de canal</SectionTitle>
            <ReportCard>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                {data.channel.slices.map((c) => (
                  <div key={c.key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-sec)' }}>
                        {c.label}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <DeltaTag value={c.deltaPct} />
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                          {fmtBRL(c.revenue)}
                        </span>
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: 'var(--color-surface-2)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${c.share * 100}%`, background: 'var(--color-gold)', borderRadius: 99 }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)' }}>
                      {(c.share * 100).toFixed(1).replace('.', ',')}% da receita
                    </span>
                  </div>
                ))}
              </div>
            </ReportCard>

            <SectionTitle>Ticket médio</SectionTitle>
            <ReportCard>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <StatRow
                  label="Compra de crédito"
                  value={fmtBRL(data.ticket.credit.avg)}
                  sub={`${fmtInt(data.ticket.credit.orders)} pedidos · ${fmtBRL(data.ticket.credit.revenue)}`}
                />
                <StatRow
                  label="🧺 Cestinha"
                  value={fmtBRL(data.ticket.market.avg)}
                  sub={`${fmtInt(data.ticket.market.orders)} pedidos · pelo valor movimentado`}
                />
                <StatRow
                  label="Por cliente comprador"
                  value={fmtBRL(data.ticket.perClient.avg)}
                  sub={`${fmtInt(data.ticket.perClient.orders)} clientes compraram no período`}
                />
              </div>
            </ReportCard>

            {data.combos.length > 0 && (
              <>
                <SectionTitle>Receita por combo</SectionTitle>
                <ReportCard>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {data.combos.map((c) => (
                      <StatRow
                        key={c.comboId}
                        label={`${c.name} · ${fmtInt(c.orders)} vendas`}
                        value={fmtBRL(c.revenue)}
                        pct={c.share}
                        sub={
                          c.pricePerCredit != null
                            ? `${fmtBRL(c.pricePerCredit)} por pãozinho · ${fmtInt(c.quantity)} pães`
                            : 'combo removido do cadastro'
                        }
                      />
                    ))}
                  </div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: '11px 0 0', lineHeight: 1.4 }}>
                    O <strong>R$ por pãozinho</strong> é o que compara combos de tamanhos diferentes:
                    o maior faturamento nem sempre é o melhor preço por unidade.
                  </p>
                </ReportCard>
              </>
            )}

            {/* ── Volume (lado da entrega) ───────────────────────────────── */}
            <SectionTitle>Volume entregue no período</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <KpiCard
                icon="bag"
                value={fmtInt(s.breads.total)}
                label="Pães vendidos"
                sub={`avulso ${fmtInt(s.breads.single)} · agenda ${fmtInt(s.breads.scheduled)} · Cestinha ${fmtInt(s.breads.fromMarket)}`}
              />
              <KpiCard
                icon="basket"
                value={fmtInt(s.items.total)}
                label="Itens da Cestinha"
                sub={`${fmtBRL(s.items.revenue)} em produtos`}
              />
            </div>
            <ReportCard>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <StatRow label="Paradas" value={fmtInt(s.counts.stops)} sub="cliente, turno e dia — pão e Cestinha juntos contam uma" />
                <StatRow label="Clientes atendidos" value={fmtInt(s.counts.clients)} sub={`em ${fmtInt(s.counts.condominiums)} condomínio(s)`} />
                <StatRow
                  label="Média por dia"
                  value={`${fmtInt(Math.round(s.breads.total / Math.max(s.counts.days, 1)))} pães`}
                  sub={`${fmtInt(s.counts.days)} dias no período`}
                />
              </div>
            </ReportCard>

            {dayBars.length > 1 && (
              <ReportCard title={`Valor vendido por dia${(s.byDay.length ?? 0) > 14 ? ' (últimos 14)' : ''}`}>
                <BarChart data={dayBars} />
              </ReportCard>
            )}

            {s.counts.days >= 7 && (
              <ReportCard title="Sazonalidade — média por dia da semana">
                <BarChart data={weekdayBars} />
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: '11px 0 0', lineHeight: 1.4 }}>
                  Média por ocorrência, não total: um período com duas segundas e um sábado premiaria
                  a segunda se comparasse o bruto.
                </p>
              </ReportCard>
            )}

            {/* ── Curva ABC ──────────────────────────────────────────────── */}
            {lines.length > 0 && (
              <>
                <SectionTitle>Mais vendidos e curva ABC</SectionTitle>
                <ReportCard>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                    {lines.map((l) => (
                      <div key={l.productId} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                            <span
                              aria-label={`Classe ${l.abc}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 18,
                                height: 18,
                                borderRadius: 5,
                                background: ABC_COLOR[l.abc],
                                color: l.abc === 'C' ? 'var(--color-text-ter)' : '#3A2A10',
                                fontFamily: 'var(--font-body)',
                                fontSize: 10.5,
                                fontWeight: 800,
                                flexShrink: 0,
                              }}
                            >
                              {l.abc}
                            </span>
                            <span
                              style={{
                                fontFamily: 'var(--font-body)',
                                fontSize: 13,
                                fontWeight: l.isBread ? 700 : 600,
                                color: 'var(--color-text)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {l.name}
                            </span>
                          </span>
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-text)', flexShrink: 0 }}>
                            {fmtBRL(l.revenue)}
                          </span>
                        </div>
                        <div style={{ height: 6, borderRadius: 99, background: 'var(--color-surface-2)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(l.revenue / maxLineRevenue) * 100}%`, background: ABC_COLOR[l.abc], borderRadius: 99 }} />
                        </div>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)' }}>
                          {fmtInt(l.qty)} un · {fmtBRL(l.avgUnitPrice)}/un ·{' '}
                          {(l.share * 100).toFixed(1).replace('.', ',')}% (acum.{' '}
                          {(l.cumulativeShare * 100).toFixed(0)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: '11px 0 0', lineHeight: 1.4 }}>
                    <strong>A</strong> = até 80% da receita · <strong>B</strong> = até 95% ·{' '}
                    <strong>C</strong> = a cauda. A linha que cruza o limiar pertence ao bloco que ela fecha.
                  </p>
                </ReportCard>
              </>
            )}

            {data.condominiums.length > 0 && (
              <>
                <SectionTitle>Performance por condomínio</SectionTitle>
                <ReportCard>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {data.condominiums.map((c) => (
                      <StatRow
                        key={c.condominiumId}
                        label={c.condominiumName}
                        value={fmtBRL(c.revenue)}
                        sub={`${fmtBRL(c.revenuePerClient)}/cliente · ${c.breadsPerClient.toFixed(1).replace('.', ',')} pães/cliente · ${fmtInt(c.activeClients)} ativos`}
                      />
                    ))}
                  </div>
                </ReportCard>
              </>
            )}

            {s.breads.total === 0 && s.items.total === 0 && data.channel.total === 0 && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-ter)', textAlign: 'center', paddingTop: 12 }}>
                Sem vendas no período.
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
