import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { SegmentedControl } from '../../../components/admin/SegmentedControl'
import { ReportAppBar, ReportScroll, ReportCard, StatRow, LoadingText, ErrorText, fmtInt, fmtPct } from './RelShared'
import { buildCsv, downloadCsv } from '../../../lib/csv'

type Period = 'day' | 'week' | 'month'

interface WasteReport {
  period: Period
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

const PERIOD_TABS = [
  { key: 'day' as Period, label: 'Dia' },
  { key: 'week' as Period, label: 'Semana' },
  { key: 'month' as Period, label: 'Mês' },
]

export function RelDesperdicio({ onBack }: { onBack: () => void }) {
  const [period, setPeriod] = useState<Period>('month')
  const [data, setData] = useState<WasteReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/admin/reports/waste?period=${period}`)
        setData(res.ok ? ((await res.json()) as WasteReport) : null)
      } catch {
        setData(null)
      } finally {
        setIsLoading(false)
      }
    }
    void run()
  }, [period])

  // waste > 0 = sobra (desperdício); waste < 0 = faltou (ruptura)
  const shortage = (data?.waste ?? 0) < 0
  const headlineLabel = shortage ? 'Ruptura (faltou)' : 'Desperdício (sobra)'
  const headlineColor = shortage ? 'var(--color-warn, #B23A2E)' : 'var(--color-text)'

  const onExport = data
    ? () =>
        downloadCsv(
          `desperdicio-${period}.csv`,
          buildCsv(
            ['Métrica', 'Valor'],
            [
              ['Comprado do fornecedor (pães)', data.ordered],
              ['Entregue aos clientes (pães)', data.delivered],
              ['Diferença (pães)', data.waste],
              ['Taxa (%)', fmtPct(data.wasteRate)],
              ...(data.items
                ? ([
                    ['Itens comprometidos', data.items.committed],
                    ['Itens entregues', data.items.delivered],
                    ['Itens perdidos', data.items.lost],
                    ['Itens devolvidos ao estoque', data.items.returned],
                    ['Itens sem desfecho', data.items.pending],
                    ['Valor perdido (R$)', data.items.lostValue.toFixed(2)],
                    ['Taxa de perda de itens (%)', fmtPct(data.items.lossRate)],
                    ...data.items.byProduct.map(
                      (p) => [`Perda: ${p.productName}`, `${p.lost} un · R$ ${p.lostValue.toFixed(2)}`] as [string, string],
                    ),
                  ] as Array<[string, string | number]>)
                : []),
            ],
          ),
        )
    : undefined

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="Desperdício" onBack={onBack} onExport={onExport} />
      <ReportScroll>
        <SegmentedControl tabs={PERIOD_TABS} value={period} onChange={setPeriod} />

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
