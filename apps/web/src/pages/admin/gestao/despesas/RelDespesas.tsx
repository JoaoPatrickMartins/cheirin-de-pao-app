import { useState, useEffect } from 'react'
import { apiFetch } from '../../../../lib/apiFetch'
import {
  PeriodPicker,
  periodQuery,
  selectionSlug,
  type PeriodSelection,
} from '../../../../components/admin/PeriodPicker'
import { downloadXlsx } from '../../../../lib/xlsx'
import { BarChart } from '../../../../components/admin/BarChart'
import {
  ReportAppBar,
  ReportScroll,
  ReportCard,
  StatRow,
  LoadingText,
  ErrorText,
  fmtBRL,
} from '../RelShared'
import { monthLabel } from './expense-types'

/**
 * RelDespesas — o relatório de despesas (F2 da Fase 2 do plano-financeiro-vendas).
 *
 * Distinta da lista de lançamentos de propósito: a lista responde "o que lancei em agosto"; esta
 * responde **"para onde o dinheiro está indo, e isso mudou?"**. Por isso tudo aqui traz
 * comparativo com a janela anterior equivalente, e o comparativo vem LIGADO por padrão — um gasto
 * sem "vs. o mês passado" não diz se subiu.
 */

interface CategoryRow {
  categoryId: string
  name: string
  emoji?: string | null
  isFixed: boolean
  total: number
  count: number
  avgPrevious: number | null
  deltaPct: number | null
}

interface ExpensesReport {
  window: { label: string; isPartial: boolean }
  previous?: { label: string }
  total: number
  deltaPct: number | null
  count: number
  fixed: number
  variable: number
  pending: number
  byGroup: Array<{ group: string; label: string; total: number; pctOfTotal: number; deltaPct: number | null }>
  byCategory: CategoryRow[]
  byPayee: Array<{ payee: string; total: number; count: number }>
  hookAcquisition: { freeDelivered: number; unitCost: number | null; cost: number | null }
  monthly: Array<{ month: string; total: number }>
}

/** Acima disto, o gasto da categoria é anomalia e ganha destaque. */
const ANOMALY_THRESHOLD = 1.4

export function RelDespesas({ onBack }: { onBack: () => void }) {
  const [sel, setSel] = useState<PeriodSelection>({ kind: 'preset', period: 'month' })
  const [data, setData] = useState<ExpensesReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/admin/reports/expenses?${periodQuery(sel)}`)
        if (cancelled) return
        setData(res.ok ? ((await res.json()) as ExpensesReport) : null)
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

  // A coluna "Grupo" saiu da aba de categorias: `CategoryRow` não carrega o grupo, e a versão
  // anterior repetia o rótulo do PRIMEIRO grupo com gasto em toda linha — um dado errado com
  // aparência de certo. O grupo do DRE tem aba própria, onde ele é de fato o recorte.
  // `deltaPct` vem em 0..100 da API; o formato de célula espera a TAXA (0..1).
  const onExport = data
    ? () =>
        void downloadXlsx(`despesas-${selectionSlug(sel)}.xlsx`, [
          {
            name: 'Resumo',
            notes: [`Despesas — ${data.window.label}`],
            head: ['Linha', 'Valor'],
            rows: [
              ['Total do período', data.total],
              ['Fixas', data.fixed],
              ['Variáveis', data.variable],
              ['A pagar (pendentes)', data.pending],
            ],
            money: [1],
            footer: [
              `Lançamentos: ${data.count}`,
              ...(data.previous ? [`Comparado com ${data.previous.label}.`] : []),
              'Apurado por COMPETÊNCIA (a que mês a despesa pertence), não por data de pagamento.',
              ...(data.window.isPartial ? ['Período EM CURSO — números parciais.'] : []),
            ],
          },
          {
            name: 'Por grupo do DRE',
            head: ['Grupo', 'Total', '% do total', 'Variação'],
            rows: data.byGroup.map((g) => [
              g.label,
              g.total,
              g.pctOfTotal / 100,
              g.deltaPct != null ? g.deltaPct / 100 : null,
            ]),
            money: [1],
            percent: [2, 3],
          },
          {
            name: 'Por categoria',
            head: ['Categoria', 'Tipo', 'Total', 'Lançamentos', 'Média anterior', 'Variação'],
            rows: data.byCategory.map((c) => [
              c.name,
              c.isFixed ? 'Fixa' : 'Variável',
              c.total,
              c.count,
              c.avgPrevious,
              c.deltaPct != null ? c.deltaPct / 100 : null,
            ]),
            money: [2, 4],
            integer: [3],
            percent: [5],
            footer: ['Média anterior divide pelos meses que EXISTEM no histórico, não por 3 fixo.'],
          },
          {
            name: 'Por recebedor',
            head: ['Recebedor', 'Total', 'Lançamentos'],
            rows: data.byPayee.map((p) => [p.payee, p.total, p.count]),
            money: [1],
            integer: [2],
          },
          {
            name: 'Série mensal',
            head: ['Mês', 'Total'],
            rows: data.monthly.map((m) => [monthLabel(m.month), m.total]),
            money: [1],
          },
          ...(data.hookAcquisition.cost != null
            ? [
                {
                  name: 'CAC via gancho',
                  head: ['Métrica', 'Valor'],
                  rows: [
                    ['Ganchos grátis entregues', data.hookAcquisition.freeDelivered],
                    ['Custo unitário', data.hookAcquisition.unitCost],
                    ['Custo total de aquisição', data.hookAcquisition.cost],
                  ],
                  money: [1],
                  footer: ['NÃO entra na soma das despesas: é custo de aquisição calculado, não lançamento.'],
                },
              ]
            : []),
        ])
    : undefined

  const chart =
    data && data.monthly.length > 1
      ? data.monthly.map((m) => ({
          label: monthLabel(m.month).slice(0, 3),
          value: m.total,
          highlight: m === data.monthly[data.monthly.length - 1],
        }))
      : null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="Relatório de despesas" onBack={onBack} onExport={onExport} />

      <ReportScroll>
        <PeriodPicker value={sel} onChange={setSel} closedMonths={4} />

        {isLoading ? (
          <LoadingText />
        ) : !data ? (
          <ErrorText />
        ) : data.count === 0 ? (
          <ReportCard>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              Nenhuma despesa em {data.window.label}
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '6px 0 0', lineHeight: 1.4 }}>
              Lance as despesas do período para o DRE deixar de mostrar apenas lucro bruto.
            </p>
          </ReportCard>
        ) : (
          <>
            {/* Total + comparativo */}
            <div
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-2)',
                borderRadius: 18,
                padding: 18,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--color-text-sec)',
                  margin: '0 0 2px',
                  textTransform: 'capitalize',
                }}
              >
                Despesas · {data.window.label}
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 30,
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    color: 'var(--color-text)',
                    margin: 0,
                  }}
                >
                  {fmtBRL(data.total)}
                </p>
                {data.deltaPct != null && (
                  <DeltaPill pct={data.deltaPct} label={data.previous?.label} />
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px 14px',
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: '1px solid var(--color-border-2)',
                }}
              >
                {/* Fixo × variável é o insumo do ponto de equilíbrio, não um enfeite. */}
                <Part label="Fixas" value={data.fixed} />
                <Part label="Variáveis" value={data.variable} />
                {data.pending > 0 && <Part label="A pagar" value={data.pending} tone="warn" />}
              </div>
            </div>

            {chart && (
              <ReportCard title="Evolução mensal">
                <BarChart data={chart} height={88} />
              </ReportCard>
            )}

            <ReportCard title="Por grupo do DRE">
              {data.byGroup.map((g) => (
                <StatRow
                  key={g.group}
                  label={g.label}
                  value={fmtBRL(g.total)}
                  pct={g.pctOfTotal / 100}
                  sub={
                    g.deltaPct != null
                      ? `${g.pctOfTotal}% do total · ${sign(g.deltaPct)} vs período anterior`
                      : `${g.pctOfTotal}% do total`
                  }
                />
              ))}
            </ReportCard>

            <ReportCard title="Por categoria">
              {data.byCategory.map((c) => {
                // Anomalia = bem acima da média dos meses anteriores. É o mesmo critério do
                // alerta do painel, exposto aqui para o admin ver o contexto e não só o aviso.
                const anomalous =
                  c.avgPrevious != null && c.avgPrevious > 0 && c.total > c.avgPrevious * ANOMALY_THRESHOLD
                return (
                  <StatRow
                    key={c.categoryId}
                    label={`${c.emoji ? `${c.emoji} ` : ''}${c.name}${c.isFixed ? ' · fixa' : ''}`}
                    value={fmtBRL(c.total)}
                    sub={
                      c.avgPrevious != null
                        ? `${c.count} lançamento(s) · média anterior ${fmtBRL(c.avgPrevious)}${
                            anomalous ? ' · ACIMA DO PADRÃO' : ''
                          }`
                        : `${c.count} lançamento(s)`
                    }
                  />
                )
              })}
            </ReportCard>

            {data.byPayee.length > 0 && (
              <ReportCard title="Para quem">
                {data.byPayee.map((p) => (
                  <StatRow
                    key={p.payee}
                    label={p.payee}
                    value={fmtBRL(p.total)}
                    sub={`${p.count} lançamento(s)`}
                  />
                ))}
              </ReportCard>
            )}

            {/* A3 — o custo que era invisível. Fora da soma de despesas de propósito: é custo
                DERIVADO da operação, não lançamento; somá-lo contaria duas vezes se um dia alguém
                lançar os ganchos como despesa. */}
            {data.hookAcquisition.freeDelivered > 0 && (
              <ReportCard title="Aquisição via gancho grátis">
                <StatRow
                  label={`${data.hookAcquisition.freeDelivered} gancho(s) entregue(s)`}
                  value={
                    data.hookAcquisition.cost != null
                      ? fmtBRL(data.hookAcquisition.cost)
                      : '— '
                  }
                  sub={
                    data.hookAcquisition.unitCost != null
                      ? `${fmtBRL(data.hookAcquisition.unitCost)} por unidade · não entra na soma acima`
                      : 'Informe o custo do gancho nas Configurações para calcular o CAC'
                  }
                />
              </ReportCard>
            )}
          </>
        )}
      </ReportScroll>
    </div>
  )
}

const sign = (pct: number) => `${pct >= 0 ? '+' : ''}${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

function Part({ label, value, tone }: { label: string; value: number; tone?: 'warn' }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--color-text-sec)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}{' '}
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          color: tone === 'warn' ? '#8A6A00' : 'var(--color-text)',
        }}
      >
        {fmtBRL(value)}
      </span>
    </span>
  )
}

function DeltaPill({ pct, label }: { pct: number; label?: string }) {
  // Numa DESPESA, subir é ruim — o verde/vermelho é o inverso do da receita.
  const good = pct <= 0
  return (
    <span
      title={label ? `vs ${label}` : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 9px',
        borderRadius: 99,
        background: good ? 'var(--color-good-soft)' : 'rgba(194,65,12,0.12)',
        color: good ? 'var(--color-good)' : 'var(--color-bad, #C2410C)',
        fontFamily: 'var(--font-body)',
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      {sign(pct)}
    </span>
  )
}
