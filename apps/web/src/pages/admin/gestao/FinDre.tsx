import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import {
  PeriodPicker,
  periodQuery,
  selectionSlug,
  type PeriodSelection,
} from '../../../components/admin/PeriodPicker'
import { downloadXlsx } from '../../../lib/xlsx'
import { ReportAppBar, ReportScroll, LoadingText, ErrorText } from './RelShared'

/**
 * FinDre — a Demonstração do Resultado (Fase 4 do plano-financeiro-vendas).
 *
 * A tela que o módulo inteiro existe para produzir. Três decisões de interface carregam peso:
 *
 *   1. **O regime é declarado no cabeçalho**, sempre. Um DRE que não diz se é caixa ou competência
 *      mente por omissão — e num modelo pré-pago os dois números divergem muito.
 *   2. **As ressalvas ficam ACIMA dos números**, não em rodapé. "Período em curso" ou "nenhuma
 *      despesa lançada" mudam como o resultado deve ser lido; embaixo, ninguém lê.
 *   3. **A ponte caixa × competência** está na mesma tela. A pergunta "por que os dois números são
 *      diferentes?" é inevitável, e deixá-la sem resposta vira desconfiança no relatório.
 */

type Regime = 'cash' | 'accrual'

interface DreLine {
  key: string
  label: string
  value: number
  isNegative?: boolean
  hint?: string
}

interface DreSection {
  key: string
  label: string
  lines: DreLine[]
  total: number
}

interface DreResult {
  regime: Regime
  window: { from: string; to: string; label: string; isPartial: boolean }
  grossRevenue: number
  deductions: number
  netRevenue: number
  cogs: number
  losses: number
  grossProfit: number
  operatingExpenses: number
  ebitda: number
  taxes: number
  netProfit: number
  grossMarginPct: number
  operatingMarginPct: number
  netMarginPct: number
  sections: DreSection[]
  caveats: string[]
}

interface DreResponse {
  regime: Regime
  dre: DreResult
  alternate: DreResult
  /** Presente = números CONGELADOS por um fechamento; ausente = apurados agora (A1). */
  closedAt?: string
  bridge: {
    cashResult: number
    accrualResult: number
    difference: number
    lines: Array<{ label: string; value: number; hint: string }>
  }
}

const fmtBRL = (v: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)

const REGIME_LABEL: Record<Regime, string> = {
  cash: 'Caixa',
  accrual: 'Competência',
}

const REGIME_HINT: Record<Regime, string> = {
  cash: 'Receita reconhecida no pagamento — é o que passou pelo banco.',
  accrual: 'Receita reconhecida na entrega — é o que o contador pede.',
}

export function FinDre({ onBack }: { onBack: () => void }) {
  // Nasce em MÊS FECHADO, não no mês corrente: "setembro até agora" não fecha com extrato nenhum.
  const [sel, setSel] = useState<PeriodSelection>({ kind: 'month', month: lastClosedMonth() })
  const [regime, setRegime] = useState<Regime>('cash')
  const [data, setData] = useState<DreResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showBridge, setShowBridge] = useState(false)
  // Fechamento de mês (A1). `null` enquanto carrega ou quando a janela não é um mês.
  const [closeStatus, setCloseStatus] = useState<{ isClosed: boolean; isPartial: boolean } | null>(null)
  const [isClosing, setIsClosing] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [isPackaging, setIsPackaging] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/admin/financial/dre?${periodQuery(sel)}&regime=${regime}`)
        if (cancelled) return
        setData(res.ok ? ((await res.json()) as DreResponse) : null)
      } catch {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sel, regime, reload])

  // Estado do fechamento — só faz sentido quando a janela é um MÊS: não existe "fechar 01/07 a
  // 15/08".
  useEffect(() => {
    if (sel.kind !== 'month') {
      setCloseStatus(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch(`/admin/financial/close?month=${sel.month}`)
        if (cancelled) return
        setCloseStatus(res.ok ? ((await res.json()) as { isClosed: boolean; isPartial: boolean }) : null)
      } catch {
        if (!cancelled) setCloseStatus(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sel, reload])

  const closeMonth = async () => {
    if (sel.kind !== 'month') return
    setCloseError(null)
    setIsClosing(true)
    try {
      const res = await apiFetch('/admin/financial/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: sel.month }),
      })
      if (res.ok) setReload((n) => n + 1)
      else {
        const e = (await res.json().catch(() => null)) as { error?: string } | null
        setCloseError(e?.error ?? 'Não foi possível fechar o mês.')
      }
    } catch {
      setCloseError('Erro de conexão. Tente novamente.')
    } finally {
      setIsClosing(false)
    }
  }

  const reopenMonth = async () => {
    if (sel.kind !== 'month') return
    setCloseError(null)
    setIsClosing(true)
    try {
      const res = await apiFetch(`/admin/financial/close/${sel.month}`, { method: 'DELETE' })
      if (res.ok) setReload((n) => n + 1)
      else setCloseError('Não foi possível reabrir o mês.')
    } catch {
      setCloseError('Erro de conexão. Tente novamente.')
    } finally {
      setIsClosing(false)
    }
  }

  /**
   * Baixa o pacote do contador (D3). Fica AQUI porque é daqui que o mês é fechado — quem acabou de
   * fechar agosto é quem vai mandá-lo ao contador no minuto seguinte.
   */
  const downloadPackage = async () => {
    if (sel.kind !== 'month') return
    setCloseError(null)
    setIsPackaging(true)
    try {
      const res = await apiFetch(`/admin/financial/accountant-package?month=${sel.month}`)
      if (!res.ok) {
        setCloseError('Não foi possível gerar o pacote.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `contador-${sel.month}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setCloseError('Erro de conexão ao gerar o pacote.')
    } finally {
      setIsPackaging(false)
    }
  }

  const dre = data?.dre ?? null

  const onExport =
    data && dre
      ? () =>
        void downloadXlsx(`dre-${selectionSlug(sel)}-${regime}.xlsx`, [
          {
            name: 'DRE',
            // O regime vai NO ARQUIVO, na primeira linha: uma planilha de DRE sem o regime
            // declarado é indistinguível da outra, e as duas têm números diferentes.
            notes: [
              `DRE · ${dre.window.label} · regime ${REGIME_LABEL[regime]}`,
              ...(data.closedAt
                ? [`MÊS FECHADO em ${new Date(data.closedAt).toLocaleDateString('pt-BR')} — números congelados.`]
                : []),
              ...(dre.window.isPartial ? ['ATENÇÃO: período EM CURSO — não é um fechamento.'] : []),
            ],
            head: ['Linha', 'Valor', '% da receita líquida'],
            rows: [
              ...dre.sections.flatMap((s) => [
                [s.label, null, null],
                ...s.lines.map((l) => [`    ${l.label}`, l.isNegative ? -l.value : l.value, null]),
              ]),
              ['Receita bruta', dre.grossRevenue, null],
              ['Receita líquida', dre.netRevenue, null],
              // `*MarginPct` já vem em 0..100 da API; o formato de célula espera a TAXA (0..1).
              ['Lucro bruto', dre.grossProfit, dre.grossMarginPct / 100],
              ['EBITDA', dre.ebitda, dre.operatingMarginPct / 100],
              ['Lucro líquido', dre.netProfit, dre.netMarginPct / 100],
            ],
            money: [1],
            percent: [2],
            footer: dre.caveats,
          },
          {
            name: 'Ponte caixa x competência',
            head: ['Linha', 'Valor'],
            rows: [
              ...data.bridge.lines.map((l) => [l.label, l.value]),
              ['Diferença entre os regimes', data.bridge.difference],
            ],
            money: [1],
            footer: [
              `Resultado em caixa: ${fmtBRL(data.bridge.cashResult)} · em competência: ${fmtBRL(data.bridge.accrualResult)}`,
              'A ponte existe para a diferença entre os dois números não virar desconfiança no relatório.',
            ],
          },
        ])
      : undefined

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <ReportAppBar title="DRE" onBack={onBack} onExport={onExport} />

      <ReportScroll>
        <PeriodPicker value={sel} onChange={setSel} closedMonths={6} />

        {/* Regime — declarado e alternável. */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-2)',
            borderRadius: 16,
            padding: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {(['cash', 'accrual'] as Regime[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRegime(r)}
                style={{
                  flex: 1,
                  minHeight: 38,
                  borderRadius: 10,
                  border: 'none',
                  background: regime === r ? 'var(--color-espresso)' : 'var(--color-surface-2)',
                  color: regime === r ? '#FAF5EC' : 'var(--color-text-sec)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {REGIME_LABEL[r]}
              </button>
            ))}
          </div>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11.5,
              color: 'var(--color-text-ter)',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {REGIME_HINT[regime]}
          </p>
        </div>

        {isLoading ? (
          <LoadingText />
        ) : !dre ? (
          <ErrorText />
        ) : (
          <>
            {/* ── Fechamento de mês (A1) ──────────────────────────────────
                Fica ACIMA dos números, junto das ressalvas, porque "este mês está fechado" é a
                ressalva mais importante que existe: ela diz se o número pode mudar amanhã. */}
            {sel.kind === 'month' && closeStatus && (
              <div
                style={{
                  background: data?.closedAt ? 'var(--color-good-soft)' : 'var(--color-surface)',
                  border: `1px solid ${data?.closedAt ? 'var(--color-good)' : 'var(--color-border-2)'}`,
                  borderRadius: 14,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 13,
                      fontWeight: 700,
                      color: data?.closedAt ? 'var(--color-good)' : 'var(--color-text)',
                      margin: 0,
                    }}
                  >
                    {data?.closedAt ? '🔒 Mês fechado' : closeStatus.isPartial ? 'Mês em curso' : 'Mês aberto'}
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 11.5,
                      color: 'var(--color-text-ter)',
                      margin: '2px 0 0',
                      lineHeight: 1.4,
                    }}
                  >
                    {data?.closedAt
                      ? `Números congelados em ${new Date(data.closedAt).toLocaleDateString('pt-BR')}. Não mudam mais, e o mês não aceita lançamento.`
                      : closeStatus.isPartial
                        ? 'Só dá para fechar depois que o mês terminar.'
                        : 'Enquanto aberto, estes números podem mudar se um custo de fornecedor for reajustado.'}
                  </p>
                </div>
                {!closeStatus.isPartial && (
                  <button
                    type="button"
                    onClick={() => void (data?.closedAt ? reopenMonth() : closeMonth())}
                    disabled={isClosing}
                    style={{
                      minHeight: 38,
                      padding: '0 14px',
                      borderRadius: 11,
                      border: data?.closedAt ? '1px solid var(--color-border-2)' : 'none',
                      background: data?.closedAt ? 'var(--color-surface)' : 'var(--color-espresso)',
                      color: data?.closedAt ? 'var(--color-text-sec)' : '#FAF5EC',
                      fontFamily: 'var(--font-body)',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: isClosing ? 'default' : 'pointer',
                      opacity: isClosing ? 0.5 : 1,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isClosing ? '...' : data?.closedAt ? 'Reabrir' : 'Fechar mês'}
                  </button>
                )}
              </div>
            )}

            {sel.kind === 'month' && (
              <button
                type="button"
                onClick={() => void downloadPackage()}
                disabled={isPackaging}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  width: '100%',
                  minHeight: 46,
                  borderRadius: 14,
                  border: '1px solid var(--color-border-2)',
                  background: 'var(--color-surface)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: 'var(--color-text-sec)',
                  cursor: isPackaging ? 'default' : 'pointer',
                  opacity: isPackaging ? 0.6 : 1,
                }}
              >
                <Icon name="download" size={17} color="var(--color-text-sec)" />
                {isPackaging ? 'Montando o pacote…' : 'Baixar pacote do contador (ZIP)'}
              </button>
            )}

            {closeError && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--color-warn)', margin: 0, lineHeight: 1.4 }}>
                {closeError}
              </p>
            )}

            {/* Ressalvas ACIMA dos números — elas mudam como o resultado deve ser lido. */}
            {dre.caveats.length > 0 && (
              <div
                style={{
                  background: 'var(--color-gold-soft)',
                  border: '1px solid rgba(227,172,63,0.45)',
                  borderRadius: 14,
                  padding: 13,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {dre.caveats.map((c) => (
                  <div key={c} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                    <Icon name="alert" size={14} color="#8A6A00" stroke={2.2} />
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 11.5,
                        color: '#8A6A00',
                        margin: 0,
                        lineHeight: 1.4,
                        flex: 1,
                      }}
                    >
                      {c}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Resultado em destaque */}
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
                Lucro líquido · {dre.window.label}
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 34,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color:
                    dre.netProfit >= 0 ? 'var(--color-text)' : 'var(--color-bad, #C2410C)',
                  margin: 0,
                }}
              >
                {fmtBRL(dre.netProfit)}
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  color: 'var(--color-text-ter)',
                  margin: '2px 0 0',
                }}
              >
                margem líquida {dre.netMarginPct}% · regime {REGIME_LABEL[regime].toLowerCase()}
              </p>
            </div>

            {/* A demonstração */}
            <div
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-2)',
                borderRadius: 18,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {dre.sections.map((section) => (
                <div key={section.key} style={{ marginBottom: 6 }}>
                  <SectionHeader label={section.label} total={section.total} />
                  {section.lines.map((line) => (
                    <Row
                      key={line.key}
                      label={line.label}
                      hint={line.hint}
                      value={line.isNegative ? -line.value : line.value}
                    />
                  ))}
                  {section.key === 'revenue' && (
                    <Subtotal label="= Receita bruta" value={dre.grossRevenue} />
                  )}
                  {section.key === 'deductions' && (
                    <Subtotal label="= Receita líquida" value={dre.netRevenue} strong />
                  )}
                  {(section.key === 'losses' ||
                    (section.key === 'cogs' && !dre.sections.some((s) => s.key === 'losses'))) && (
                    <Subtotal
                      label="= Lucro bruto"
                      value={dre.grossProfit}
                      pct={dre.grossMarginPct}
                      strong
                    />
                  )}
                  {section.key === 'opex' && (
                    <Subtotal
                      label="= EBITDA"
                      value={dre.ebitda}
                      pct={dre.operatingMarginPct}
                      strong
                    />
                  )}
                </div>
              ))}

              <div
                style={{
                  borderTop: '2px solid var(--color-border)',
                  marginTop: 4,
                  paddingTop: 10,
                }}
              >
                <Subtotal
                  label="= Lucro líquido"
                  value={dre.netProfit}
                  pct={dre.netMarginPct}
                  strong
                  big
                />
              </div>
            </div>

            {/* A ponte — recolhida, porque é explicação e não o número principal. */}
            {data && (
              <div
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-2)',
                  borderRadius: 18,
                  padding: 18,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowBridge((v) => !v)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--color-text)',
                        margin: 0,
                      }}
                    >
                      Caixa × competência
                    </p>
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 11.5,
                        color: 'var(--color-text-ter)',
                        margin: '1px 0 0',
                      }}
                    >
                      Diferença de {fmtBRL(Math.abs(data.bridge.difference))} entre os dois regimes
                    </p>
                  </div>
                  <Icon name={showBridge ? 'chevD' : 'chevR'} size={18} color="var(--color-text-ter)" />
                </button>

                {showBridge && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {data.bridge.lines.map((l, i) => (
                      <Row
                        key={l.label}
                        label={l.label}
                        hint={l.hint}
                        value={l.value}
                        strong={i === 0 || i === data.bridge.lines.length - 1}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </ReportScroll>
    </div>
  )
}

// ------------------------------------------------------------------ helpers

/** Último mês FECHADO em BRT ("AAAA-MM") — o padrão do DRE. */
function lastClosedMonth(): string {
  const [y, m] = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
    .format(new Date())
    .split('-')
    .map(Number)
  const d = new Date(Date.UTC(y, m - 2, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

// ------------------------------------------------------------------ subcomponentes

function SectionHeader({ label, total }: { label: string; total: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 10,
        margin: '10px 0 4px',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 11.5,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--color-text-ter)',
          margin: 0,
        }}
      >
        {label}
      </p>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 12.5,
          fontWeight: 700,
          color: 'var(--color-text-ter)',
        }}
      >
        {fmtBRL(total)}
      </span>
    </div>
  )
}

function Row({
  label,
  hint,
  value,
  strong,
}: {
  label: string
  hint?: string
  value: number
  strong?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        padding: '3px 0',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: strong ? 700 : 600,
            color: 'var(--color-text-sec)',
            margin: 0,
          }}
        >
          {label}
        </p>
        {hint && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 10.5,
              color: 'var(--color-text-ter)',
              margin: '1px 0 0',
              lineHeight: 1.35,
            }}
          >
            {hint}
          </p>
        )}
      </div>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: strong ? 14 : 13.5,
          fontWeight: strong ? 800 : 700,
          // Negativo em vermelho: num DRE, o sinal é a informação mais rápida de ler.
          color: value < 0 ? 'var(--color-bad, #C2410C)' : 'var(--color-text)',
          whiteSpace: 'nowrap',
        }}
      >
        {value < 0 ? `− ${fmtBRL(Math.abs(value))}` : fmtBRL(value)}
      </span>
    </div>
  )
}

function Subtotal({
  label,
  value,
  pct,
  strong,
  big,
}: {
  label: string
  value: number
  pct?: number
  strong?: boolean
  big?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 10,
        marginTop: 6,
        paddingTop: 6,
        borderTop: '1px solid var(--color-border-2)',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: big ? 14 : 13,
          fontWeight: strong ? 800 : 700,
          color: 'var(--color-text)',
          margin: 0,
        }}
      >
        {label}
        {pct != null && (
          <span style={{ fontWeight: 600, color: 'var(--color-text-ter)' }}> · {pct}%</span>
        )}
      </p>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: big ? 18 : 14.5,
          fontWeight: 800,
          color: value < 0 ? 'var(--color-bad, #C2410C)' : 'var(--color-text)',
          whiteSpace: 'nowrap',
        }}
      >
        {value < 0 ? `− ${fmtBRL(Math.abs(value))}` : fmtBRL(value)}
      </span>
    </div>
  )
}
