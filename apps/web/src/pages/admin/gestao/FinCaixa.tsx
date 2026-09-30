import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import {
  PeriodPicker,
  periodQuery,
  selectionSlug,
  type PeriodSelection,
} from '../../../components/admin/PeriodPicker'
import { downloadXlsx } from '../../../lib/xlsx'
import { BarChart } from '../../../components/admin/BarChart'
import {
  ReportAppBar,
  ReportScroll,
  ReportCard,
  StatRow,
  LoadingText,
  ErrorText,
  fmtBRL,
} from './RelShared'

/**
 * FinCaixa — fluxo de caixa realizado (F5 da Fase 5 do plano-financeiro-vendas).
 *
 * Existe ao lado do DRE porque responde outra pergunta: o DRE diz se o período deu **lucro**;
 * este diz **quando o dinheiro entrou e saiu**. Num modelo pré-pago os dois divergem muito, e é
 * o caixa que paga a conta do mês.
 *
 * A tela insiste em duas coisas: as entradas são **líquidas** (é o que o extrato mostra), e o
 * acumulado parte de **zero** — é a variação do período, não o saldo bancário. Exibir um "saldo"
 * que o sistema não conhece seria inventar número.
 */

interface CashflowReport {
  window: { label: string; isPartial: boolean }
  inflow: number
  inflowGross: number
  gatewayFee: number
  refunds: number
  outflow: number
  expensesPaid: number
  supplierPurchases: number
  net: number
  daily: Array<{ day: string; inflow: number; outflow: number; net: number; cumulative: number }>
  bestDay: { day: string; net: number } | null
  worstDay: { day: string; net: number } | null
}

const dayShort = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

export function FinCaixa({ onBack }: { onBack: () => void }) {
  const [sel, setSel] = useState<PeriodSelection>({ kind: 'preset', period: 'month' })
  const [data, setData] = useState<CashflowReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/admin/financial/cashflow?${periodQuery(sel)}`)
        if (cancelled) return
        setData(res.ok ? ((await res.json()) as CashflowReport) : null)
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

  const onExport = data
    ? () =>
        void downloadXlsx(`caixa-${selectionSlug(sel)}.xlsx`, [
          {
            name: 'Resumo',
            notes: [`Fluxo de caixa — ${data.window.label}`],
            head: ['Linha', 'Valor'],
            rows: [
              ['Entradas (bruto)', data.inflowGross],
              ['(−) Taxa de gateway', -data.gatewayFee],
              ['(−) Estornos', -data.refunds],
              ['= Entradas (líquido)', data.inflow],
              ['(−) Despesas pagas', -data.expensesPaid],
              ['(−) Compras ao fornecedor', -data.supplierPurchases],
              ['= Variação do período', data.net],
            ],
            money: [1],
            footer: [
              'Entradas pelo LÍQUIDO — é o que o extrato bancário mostra.',
              'O acumulado parte de ZERO: é a VARIAÇÃO do período, não o saldo em conta (o sistema não conhece o extrato).',
              ...(data.window.isPartial ? ['Período EM CURSO — números parciais.'] : []),
            ],
          },
          {
            name: 'Série diária',
            head: ['Dia', 'Entradas (líq.)', 'Saídas', 'Saldo do dia', 'Acumulado'],
            rows: data.daily.map((d) => [d.day, d.inflow, d.outflow, d.net, d.cumulative]),
            money: [1, 2, 3, 4],
            footer: ['Série CONTÍNUA: dia sem movimento entra com zero, senão o acumulado salta no gráfico.'],
          },
        ])
    : undefined

  // O gráfico mostra o SALDO DO DIA, não o acumulado: é onde o padrão semanal aparece (segunda
  // forte, domingo parado), e é a leitura que muda decisão de compra.
  const chart =
    data && data.daily.length > 0
      ? data.daily.slice(-31).map((d) => ({
          label: dayShort(d.day).slice(0, 2),
          value: Math.max(d.net, 0),
          highlight: d.day === data.bestDay?.day,
        }))
      : null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="Fluxo de caixa" onBack={onBack} onExport={onExport} />

      <ReportScroll>
        <PeriodPicker value={sel} onChange={setSel} closedMonths={4} />

        {isLoading ? (
          <LoadingText />
        ) : !data ? (
          <ErrorText />
        ) : (
          <>
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
                Caixa gerado · {data.window.label}
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 30,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: data.net >= 0 ? 'var(--color-text)' : 'var(--color-bad, #C2410C)',
                  margin: 0,
                }}
              >
                {data.net < 0 ? `− ${fmtBRL(Math.abs(data.net))}` : fmtBRL(data.net)}
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 11.5,
                  color: 'var(--color-text-ter)',
                  margin: '4px 0 0',
                  lineHeight: 1.4,
                }}
              >
                Variação do período, não saldo em conta — o sistema não conhece o extrato.
              </p>
            </div>

            {chart && (
              <ReportCard title="Saldo por dia">
                <BarChart data={chart} height={92} />
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 11,
                    color: 'var(--color-text-ter)',
                    margin: '8px 0 0',
                  }}
                >
                  Só os dias positivos são desenhados. {data.daily.length > 31 && 'Últimos 31 dias. '}
                  {data.bestDay && `Melhor dia: ${dayShort(data.bestDay.day)} (${fmtBRL(data.bestDay.net)}).`}
                </p>
              </ReportCard>
            )}

            <ReportCard title="Entradas">
              <StatRow
                label="Líquido recebido"
                value={fmtBRL(data.inflow)}
                sub="é o que o extrato mostra"
              />
              <StatRow label="Bruto faturado" value={fmtBRL(data.inflowGross)} />
              <StatRow label="Taxa de gateway" value={`− ${fmtBRL(data.gatewayFee)}`} />
            </ReportCard>

            <ReportCard title="Saídas">
              <StatRow label="Despesas pagas" value={fmtBRL(data.expensesPaid)} />
              <StatRow
                label="Compras ao fornecedor"
                value={fmtBRL(data.supplierPurchases)}
                sub="pedidos finalizados no período"
              />
              {data.refunds > 0 && (
                <StatRow
                  label="Estornos"
                  value={fmtBRL(data.refunds)}
                  sub="dinheiro devolvido ao cliente"
                />
              )}
              <StatRow label="Total de saídas" value={fmtBRL(data.outflow)} />
            </ReportCard>

            {data.worstDay && data.worstDay.net < 0 && (
              <ReportCard title="Pior dia">
                <StatRow
                  label={dayShort(data.worstDay.day)}
                  value={`− ${fmtBRL(Math.abs(data.worstDay.net))}`}
                  sub="maior saída líquida do período"
                />
              </ReportCard>
            )}
          </>
        )}
      </ReportScroll>
    </div>
  )
}
