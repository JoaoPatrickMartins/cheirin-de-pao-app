import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import {
  PeriodPicker,
  periodQuery,
  selectionSlug,
  type PeriodSelection,
} from '../../../components/admin/PeriodPicker'
import { ReportAppBar, ReportScroll, ReportCard, StatRow, LoadingText, ErrorText, fmtInt, fmtPct } from './RelShared'
import { downloadXlsx } from '../../../lib/xlsx'

type Period = 'day' | 'week' | 'month'

interface WasteReport {
  period?: Period
  window: { from: string; to: string; label: string; isPartial: boolean }
  ordered: number
  delivered: number
  waste: number
  wasteRate: number
  /** Itens do mercadinho (G4) — série SEPARADA da do pão (D-1). */
  items?: {
    committed: number
    delivered: number
    lost: number
    returned: number
    pending: number
    lostValue: number
    lossRate: number
    byProduct: Array<{ productId: string; productName: string; lost: number; lostValue: number }>
  }
}

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

export function RelDesperdicio({ onBack }: { onBack: () => void }) {
  const [sel, setSel] = useState<PeriodSelection>({ kind: 'preset', period: 'month' })
  const [data, setData] = useState<WasteReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/admin/reports/waste?${periodQuery(sel)}`)
        setData(res.ok ? ((await res.json()) as WasteReport) : null)
      } catch {
        setData(null)
      } finally {
        setIsLoading(false)
      }
    }
    void run()
  }, [sel])

  // waste > 0 = sobra (desperdício); waste < 0 = faltou (ruptura)
  const shortage = (data?.waste ?? 0) < 0
  const headlineLabel = shortage ? 'Ruptura (faltou)' : 'Desperdício (sobra)'
  const headlineColor = shortage ? 'var(--color-warn, #B23A2E)' : 'var(--color-text)'

  // Pão e item em abas SEPARADAS pelo mesmo motivo que a tela os separa (D-1): comparar potes de
  // geleia com pães comprados não significa nada, e numa planilha as duas séries na mesma coluna
  // convidam exatamente essa soma.
  const onExport = data
    ? () =>
        void downloadXlsx(`desperdicio-${selectionSlug(sel)}.xlsx`, [
          {
            name: 'Pão',
            notes: [`Desperdício — ${data.window.label}`],
            head: ['Métrica', 'Valor'],
            rows: [
              ['Comprado do fornecedor (pães)', data.ordered],
              ['Entregue aos clientes (pães)', data.delivered],
              ['Diferença (pães)', data.waste],
            ],
            integer: [1],
            footer: [
              'Diferença positiva = sobra (desperdício); negativa = faltou (ruptura).',
              `Taxa: ${fmtPct(data.wasteRate)}`,
              ...(data.window.isPartial ? ['Período EM CURSO — números parciais.'] : []),
            ],
          },
          ...(data.items
            ? [
                {
                  name: 'Itens da Cestinha',
                  head: ['Métrica', 'Unidades'],
                  rows: [
                    ['Comprometidos', data.items.committed],
                    ['Entregues', data.items.delivered],
                    ['Perdidos', data.items.lost],
                    ['Devolvidos ao estoque', data.items.returned],
                    ['Sem desfecho', data.items.pending],
                  ],
                  integer: [1],
                  footer: [
                    `Valor perdido: R$ ${data.items.lostValue.toFixed(2)} — custo pela matriz de fornecimento.`,
                    `Taxa de perda: ${fmtPct(data.items.lossRate)} — perdidos sobre o que saiu para entrega.`,
                  ],
                },
                {
                  name: 'Perda por produto',
                  head: ['Produto', 'Unidades perdidas', 'Valor perdido'],
                  rows: data.items.byProduct.map((p) => [p.productName, p.lost, p.lostValue]),
                  integer: [1],
                  money: [2],
                },
              ]
            : []),
        ])
    : undefined

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="Desperdício" onBack={onBack} onExport={onExport} />
      <ReportScroll>
        <PeriodPicker value={sel} onChange={setSel} />

        {isLoading ? (
          <LoadingText />
        ) : data ? (
          <>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 18, padding: '18px 18px 16px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-sec)', margin: '0 0 4px' }}>
                {headlineLabel}
              </p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', color: headlineColor, margin: '0 0 4px' }}>
                {fmtInt(Math.abs(data.waste))} pães
              </p>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--color-text-ter)' }}>
                {fmtPct(Math.abs(data.wasteRate))} do que foi comprado
              </span>
            </div>

            <ReportCard>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <StatRow label="Comprado do fornecedor" value={`${fmtInt(data.ordered)} pães`} />
                <StatRow label="Entregue aos clientes" value={`${fmtInt(data.delivered)} pães`} />
                <StatRow label={shortage ? 'Faltou' : 'Sobrou'} value={`${fmtInt(Math.abs(data.waste))} pães`} />
              </div>
            </ReportCard>

            <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-ter)', margin: 0 }}>
              Compara pedidos finalizados ao fornecedor (por data) com pães efetivamente entregues (por data agendada) no período.
              Os dois lados incluem o pão vendido dentro da Cestinha.
            </p>

            {/* Itens do mercadinho — série SEPARADA (D-1): comparar potes de geleia com pães
                comprados não significa nada. Aqui a pergunta é "do que saiu, quanto se perdeu". */}
            {data.items && data.items.committed > 0 && (
              <ReportCard title="🧺 Itens do mercadinho">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <StatRow label="Comprometidos" value={`${fmtInt(data.items.committed)} un`} />
                  <StatRow label="Entregues" value={`${fmtInt(data.items.delivered)} un`} />
                  <StatRow
                    label="Perdidos"
                    value={`${fmtInt(data.items.lost)} un · ${fmtBRL(data.items.lostValue)}`}
                  />
                  {data.items.returned > 0 && (
                    <StatRow label="Voltaram ao estoque" value={`${fmtInt(data.items.returned)} un`} />
                  )}
                  {data.items.pending > 0 && (
                    <StatRow label="Sem desfecho (a resolver)" value={`${fmtInt(data.items.pending)} un`} />
                  )}
                  <StatRow label="Taxa de perda" value={`${fmtPct(data.items.lossRate)}%`} />
                </div>
                {data.items.byProduct.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--color-border-2)', marginTop: 12, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {data.items.byProduct.map((p) => (
                      <StatRow key={p.productId} label={p.productName} value={`${fmtInt(p.lost)} un · ${fmtBRL(p.lostValue)}`} />
                    ))}
                  </div>
                )}
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: '10px 0 0', lineHeight: 1.45 }}>
                  Perda = entrega que falhou e foi resolvida como "não voltou" (aba Cestinhas → Não
                  entregues). Enquanto ninguém dá o desfecho, as unidades ficam em "sem desfecho" —
                  não são contadas como prejuízo.
                </p>
              </ReportCard>
            )}
          </>
        ) : (
          <ErrorText />
        )}
      </ReportScroll>
    </div>
  )
}
