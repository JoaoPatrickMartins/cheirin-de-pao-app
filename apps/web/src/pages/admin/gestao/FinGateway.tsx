import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import {
  PeriodPicker,
  periodQuery,
  selectionSlug,
  type PeriodSelection,
} from '../../../components/admin/PeriodPicker'
import { downloadXlsx } from '../../../lib/xlsx'
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
 * FinGateway — conciliação de gateway (F6 da Fase 3 do plano-financeiro-vendas).
 *
 * Responde a pergunta que nenhuma tela respondia: **"faturei X, quanto caiu na conta?"** Antes
 * desta onda, todo número financeiro do admin era BRUTO e a diferença simplesmente não existia.
 *
 * A tela insiste na BASE de cada número — real (informada pelo provedor) × estimada pela alíquota
 * configurada. Exibir os dois misturados sem dizer qual é qual daria ao relatório uma precisão
 * que ele não tem.
 */

interface FeeSummary {
  gross: number
  fee: number
  net: number
  count: number
  realCount: number
  estimatedCount: number
  effectivePct: number
}

interface GatewayReport {
  window: { label: string; isPartial: boolean }
  total: FeeSummary
  rates: Record<string, number>
  byMethod: Array<{ method: string } & FeeSummary>
  byPurpose: Array<{ purpose: string } & FeeSummary>
  refunds: { amount: number; count: number }
}

const METHOD_LABEL: Record<string, string> = {
  PIX: 'Pix',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
}

const PURPOSE_LABEL: Record<string, string> = {
  CREDITS: 'Créditos / combos',
  HOOK: 'Gancho de porta',
  MARKET: '🧺 Cestinha',
}

export function FinGateway({ onBack }: { onBack: () => void }) {
  const [sel, setSel] = useState<PeriodSelection>({ kind: 'preset', period: 'month' })
  const [data, setData] = useState<GatewayReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/admin/financial/gateway?${periodQuery(sel)}`)
        if (cancelled) return
        setData(res.ok ? ((await res.json()) as GatewayReport) : null)
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

  // A coluna "Base" viaja junto na planilha pelo mesmo motivo que a tela insiste nela: uma taxa
  // estimada e uma informada pelo provedor não têm a mesma precisão, e sem a coluna as duas viram
  // o mesmo número na mão de quem abrir o arquivo.
  // `effectivePct` vem em 0..100 da API; o formato de célula espera a TAXA (0..1).
  const feeRow = (label: string, s: FeeSummary) => [
    label,
    s.gross,
    s.fee,
    s.net,
    s.effectivePct / 100,
    baseLabel(s),
  ]

  const onExport = data
    ? () =>
        void downloadXlsx(`gateway-${selectionSlug(sel)}.xlsx`, [
          {
            name: 'Conciliação',
            notes: [`Conciliação de gateway — ${data.window.label}`],
            head: ['Linha', 'Bruto', 'Taxa', 'Líquido', 'Taxa efetiva', 'Base'],
            rows: [feeRow('TOTAL', data.total)],
            money: [1, 2, 3],
            percent: [4],
            footer: [
              `Estornos no período: R$ ${data.refunds.amount.toFixed(2)} em ${data.refunds.count} pagamento(s).`,
              ...(data.window.isPartial ? ['Período EM CURSO — números parciais.'] : []),
            ],
          },
          {
            name: 'Por método',
            head: ['Método', 'Bruto', 'Taxa', 'Líquido', 'Taxa efetiva', 'Base'],
            rows: data.byMethod.map((m) => feeRow(METHOD_LABEL[m.method] ?? m.method, m)),
            money: [1, 2, 3],
            percent: [4],
          },
          {
            name: 'Por finalidade',
            head: ['Finalidade', 'Bruto', 'Taxa', 'Líquido', 'Taxa efetiva', 'Base'],
            rows: data.byPurpose.map((p) => feeRow(PURPOSE_LABEL[p.purpose] ?? p.purpose, p)),
            money: [1, 2, 3],
            percent: [4],
          },
          {
            name: 'Alíquotas',
            head: ['Método', 'Alíquota'],
            rows: Object.entries(data.rates).map(([k, v]) => [METHOD_LABEL[k] ?? k, v / 100]),
            percent: [1],
            footer: ['Alíquotas usadas para ESTIMAR a taxa dos pagamentos sem número real do provedor.'],
          },
        ])
    : undefined

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="Conciliação de gateway" onBack={onBack} onExport={onExport} />

      <ReportScroll>
        <PeriodPicker value={sel} onChange={setSel} />

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
                }}
              >
                Líquido recebido
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 32,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'var(--color-text)',
                  margin: 0,
                }}
              >
                {fmtBRL(data.total.net)}
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  color: 'var(--color-text-ter)',
                  margin: '4px 0 0',
                }}
              >
                {fmtBRL(data.total.gross)} bruto − {fmtBRL(data.total.fee)} de taxa ·{' '}
                {data.total.effectivePct}% efetivos
              </p>

              {/* Enquanto houver estimados, a linha é parcialmente estimativa — e a tela diz. */}
              {data.total.estimatedCount > 0 && (
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 11,
                    color: '#8A6A00',
                    background: 'var(--color-gold-soft)',
                    borderRadius: 8,
                    padding: '6px 9px',
                    margin: '10px 0 0',
                    lineHeight: 1.4,
                  }}
                >
                  {data.total.estimatedCount} de {data.total.count} pagamento(s) com taxa{' '}
                  <strong>estimada</strong> pela alíquota configurada. O provedor informou a taxa
                  real em {data.total.realCount}.
                </p>
              )}
            </div>

            <ReportCard title="Alíquotas em uso">
              {Object.entries(data.rates).map(([method, pct]) => (
                <StatRow
                  key={method}
                  label={METHOD_LABEL[method] ?? method}
                  value={`${pct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`}
                />
              ))}
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 11,
                  color: 'var(--color-text-ter)',
                  margin: '8px 0 0',
                  lineHeight: 1.4,
                }}
              >
                Usadas só onde o provedor não informou a taxa real. Ajuste em Configurações se a sua
                taxa negociada for outra.
              </p>
            </ReportCard>

            <ReportCard title="Por método">
              {data.byMethod.map((m) => (
                <StatRow
                  key={m.method}
                  label={`${METHOD_LABEL[m.method] ?? m.method} · ${m.count}`}
                  value={`${fmtBRL(m.net)}`}
                  sub={`${fmtBRL(m.gross)} − ${fmtBRL(m.fee)} · ${m.effectivePct}% · ${baseLabel(m)}`}
                />
              ))}
            </ReportCard>

            <ReportCard title="Por finalidade">
              {data.byPurpose.map((p) => (
                <StatRow
                  key={p.purpose}
                  label={`${PURPOSE_LABEL[p.purpose] ?? p.purpose} · ${p.count}`}
                  value={fmtBRL(p.net)}
                  sub={`${fmtBRL(p.gross)} − ${fmtBRL(p.fee)} · ${p.effectivePct}%`}
                />
              ))}
            </ReportCard>

            {data.refunds.count > 0 && (
              <ReportCard title="Estornos">
                <StatRow
                  label={`${data.refunds.count} estorno(s)`}
                  value={fmtBRL(data.refunds.amount)}
                  // Fora do total de propósito: o gateway normalmente não devolve a taxa de um
                  // pagamento estornado, então somar embaralharia duas coisas distintas.
                  sub="Fora do total acima — a taxa do pagamento estornado normalmente não volta"
                />
              </ReportCard>
            )}
          </>
        )}
      </ReportScroll>
    </div>
  )
}

/** "real", "estimada" ou "parcial" — a procedência do número, em uma palavra. */
function baseLabel(s: FeeSummary): string {
  if (s.estimatedCount === 0) return 'real'
  if (s.realCount === 0) return 'estimada'
  return `parcial (${s.realCount} real / ${s.estimatedCount} estimada)`
}
