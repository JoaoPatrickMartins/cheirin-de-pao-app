import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { ReportAppBar, ReportScroll, ReportCard, LoadingText, ErrorText } from './RelShared'

/**
 * FinAliquotas — as alíquotas usadas para ESTIMAR a taxa do gateway.
 *
 * Existiam como `Setting` desde a Fase 3 e só eram editáveis direto no banco. O efeito disso não é
 * pequeno: num negócio de ticket baixo e volume alto a taxa é uma linha grande do DRE, e todo
 * pagamento sem número real do provedor é deduzido por estas alíquotas.
 *
 * Duas coisas que a tela precisa deixar claras, e que não são óbvias:
 *
 *   1. **A estimativa vale só onde não há taxa real.** Onde o webhook gravou o número do provedor,
 *      ele prevalece — mexer aqui não reescreve aquele histórico.
 *   2. **A mudança é retroativa.** A estimativa é recalculada na leitura e nunca persistida, então
 *      ajustar a alíquota muda o DRE dos meses anteriores que dependiam dela. É o comportamento
 *      desejado (a alíquota certa é a que vale), mas precisa ser dito antes de salvar, não depois.
 */

interface Rates {
  pix: number
  creditCard: number
  debitCard: number
  isDefault: { pix: boolean; creditCard: boolean; debitCard: boolean }
}

const FIELDS = [
  { key: 'pix' as const, label: 'Pix', hint: 'Cobrado por transação recebida' },
  { key: 'creditCard' as const, label: 'Cartão de crédito', hint: 'A maior alíquota, e a que mais pesa' },
  { key: 'debitCard' as const, label: 'Cartão de débito', hint: 'Quando o provedor oferece' },
]

export function FinAliquotas({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<Rates | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch('/admin/settings/gateway-rates')
        if (cancelled) return
        if (res.ok) {
          const r = (await res.json()) as Rates
          setData(r)
          setDraft({
            pix: String(r.pix),
            creditCard: String(r.creditCard),
            debitCard: String(r.debitCard),
          })
        }
      } catch {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const parsed = (k: string) => Number((draft[k] ?? '').replace(',', '.'))
  const allValid = FIELDS.every((f) => {
    const v = parsed(f.key)
    return Number.isFinite(v) && v >= 0 && v <= 30
  })

  const save = async () => {
    setError(null)
    setSaved(false)
    setIsSaving(true)
    try {
      const res = await apiFetch('/admin/settings/gateway-rates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pix: parsed('pix'),
          creditCard: parsed('creditCard'),
          debitCard: parsed('debitCard'),
        }),
      })
      if (res.ok) {
        setData((await res.json()) as Rates)
        setSaved(true)
      } else {
        const e = (await res.json().catch(() => null)) as { error?: string } | null
        setError(e?.error ?? 'Não foi possível salvar. Tente novamente.')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  const anyDefault =
    data != null && (data.isDefault.pix || data.isDefault.creditCard || data.isDefault.debitCard)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="Alíquotas do gateway" onBack={onBack} />
      <ReportScroll>
        {isLoading ? (
          <LoadingText />
        ) : data ? (
          <>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-sec)', lineHeight: 1.5, margin: 0 }}>
              Usadas para <strong>estimar</strong> a taxa nos pagamentos em que o provedor não
              informou o número real. Onde a taxa real foi capturada, é ela que vale.
            </p>

            {anyDefault && (
              <div
                style={{
                  background: 'var(--color-gold-soft)',
                  border: '1px solid var(--color-border-2)',
                  borderRadius: 14,
                  padding: '11px 13px',
                }}
              >
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 700, color: '#6B5200', margin: 0, lineHeight: 1.45 }}>
                  Alguma alíquota ainda é a <strong>tabela pública de referência</strong>, não a que
                  você negociou. O DRE deduz a taxa em cima dela — vale conferir no extrato do
                  provedor.
                </p>
              </div>
            )}

            <ReportCard>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {FIELDS.map((f) => {
                  const v = parsed(f.key)
                  const invalid = !(Number.isFinite(v) && v >= 0 && v <= 30)
                  return (
                    <label key={f.key} style={{ display: 'block' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 700, color: 'var(--color-text)' }}>
                          {f.label}
                        </span>
                        {data.isDefault[f.key] && (
                          <span
                            style={{
                              padding: '2px 7px',
                              borderRadius: 99,
                              background: 'var(--color-gold-soft)',
                              color: '#8A6A00',
                              fontFamily: 'var(--font-body)',
                              fontSize: 10.5,
                              fontWeight: 800,
                            }}
                          >
                            padrão
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          background: 'var(--color-surface-alt, #FBF6EC)',
                          border: `1.5px solid ${invalid ? 'var(--color-warn)' : 'var(--color-border)'}`,
                          borderRadius: 14,
                          padding: '11px 14px',
                        }}
                      >
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min={0}
                          max={30}
                          value={draft[f.key] ?? ''}
                          onChange={(e) => {
                            setSaved(false)
                            setDraft((d) => ({ ...d, [f.key]: e.target.value }))
                          }}
                          style={{
                            flex: 1,
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            fontFamily: 'var(--font-body)',
                            fontSize: 16,
                            fontWeight: 600,
                            color: 'var(--color-text)',
                            minWidth: 0,
                          }}
                        />
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--color-text-ter)' }}>
                          %
                        </span>
                      </div>
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: invalid ? 'var(--color-warn)' : 'var(--color-text-ter)', margin: '5px 2px 0', lineHeight: 1.35 }}>
                        {invalid ? 'Informe um número entre 0 e 30.' : f.hint}
                      </p>
                    </label>
                  )
                })}
              </div>
            </ReportCard>

            <ReportCard>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--color-text-ter)', margin: 0, lineHeight: 1.5 }}>
                A estimativa é recalculada <strong>na leitura</strong> e nunca gravada no pagamento.
                Por isso mudar uma alíquota aqui <strong>também muda os relatórios de meses
                anteriores</strong> que dependiam dela — é proposital: a alíquota certa é a que vale.
                Pagamento com taxa real informada pelo provedor não é afetado.
              </p>
            </ReportCard>

            {error && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-warn)', margin: 0 }}>
                {error}
              </p>
            )}
            {saved && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-good)', margin: 0 }}>
                Alíquotas salvas.
              </p>
            )}

            <button
              type="button"
              onClick={() => void save()}
              disabled={!allValid || isSaving}
              style={{
                width: '100%',
                minHeight: 52,
                borderRadius: 16,
                border: 'none',
                background: 'var(--color-espresso)',
                color: '#FAF5EC',
                fontFamily: 'var(--font-body)',
                fontSize: 16,
                fontWeight: 700,
                cursor: !allValid || isSaving ? 'default' : 'pointer',
                opacity: !allValid || isSaving ? 0.5 : 1,
              }}
            >
              {isSaving ? 'Salvando...' : 'Salvar alíquotas'}
            </button>
          </>
        ) : (
          <ErrorText />
        )}
      </ReportScroll>
    </div>
  )
}
