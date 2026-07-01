import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { ReportAppBar, ReportScroll, ReportCard, StatRow, LoadingText, ErrorText, fmtInt, fmtBRL } from './RelShared'
import { buildCsv, downloadCsv } from '../../../lib/csv'

interface CreditLiabilityReport {
  creditsOutstanding: number
  estPricePerCredit: number
  estLiabilityBRL: number
  clientsWithCredit: number
}

export function RelPassivo({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<CreditLiabilityReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch('/admin/reports/credit-liability')
        setData(res.ok ? ((await res.json()) as CreditLiabilityReport) : null)
      } catch {
        setData(null)
      } finally {
        setIsLoading(false)
      }
    }
    void run()
  }, [])

  const onExport = data
    ? () =>
        downloadCsv(
          'passivo-credito.csv',
          buildCsv(
            ['Métrica', 'Valor'],
            [
              ['Créditos em circulação', data.creditsOutstanding],
              ['Clientes com saldo', data.clientsWithCredit],
              ['Preço médio por crédito (R$)', data.estPricePerCredit.toFixed(2)],
              ['Passivo estimado (R$)', data.estLiabilityBRL.toFixed(2)],
            ],
          ),
        )
    : undefined

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="Passivo de crédito" onBack={onBack} onExport={onExport} />
      <ReportScroll>
        {isLoading ? (
          <LoadingText />
        ) : data ? (
          <>
            {/* Headline: valor estimado do passivo */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 18, padding: '18px 18px 16px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-sec)', margin: '0 0 4px' }}>
                Passivo de crédito (estimado em R$)
              </p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 4px' }}>
                {fmtBRL(data.estLiabilityBRL)}
              </p>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--color-text-ter)' }}>
                {fmtInt(data.creditsOutstanding)} créditos (pães) em circulação
              </span>
            </div>

            <ReportCard>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <StatRow label="Créditos em circulação" value={fmtInt(data.creditsOutstanding)} />
                <StatRow label="Clientes com saldo" value={fmtInt(data.clientsWithCredit)} />
                <StatRow label="Preço médio por crédito" value={fmtBRL(data.estPricePerCredit)} />
              </div>
            </ReportCard>

            <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-ter)', margin: 0 }}>
              O total de créditos em circulação é exato. O valor em R$ é uma estimativa, usando o preço médio histórico por crédito (R$ pagos ÷ créditos comprados).
            </p>
          </>
        ) : (
          <ErrorText />
        )}
      </ReportScroll>
    </div>
  )
}
