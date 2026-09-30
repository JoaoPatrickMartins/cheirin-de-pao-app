import { formatCredits, toMilli } from '@cheirin-de-pao/shared'
import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { Icon } from '../../../components/brand/Icon'
import {
  PeriodPicker,
  periodQuery,
  selectionLabel,
  selectionSlug,
  type PeriodSelection,
} from '../../../components/admin/PeriodPicker'
import { BarChart } from '../../../components/admin/BarChart'
import { downloadXlsx } from '../../../lib/xlsx'

// ------------------------------------------------------------------ tipos
type Period = 'day' | 'week' | 'month'

interface CondoRevenue {
  condominiumId: string
  condominiumName: string
  total: number
  /** Valor movimentado em Cestinhas — não é receita (D-2). */
  cestinhaGmv?: number
}

interface FinancialData {
  /** Preset usado — ausente quando a janela veio de mês/intervalo. */
  period?: Period
  /** Janela efetivamente apurada. `isPartial` = período ainda em curso. */
  window?: { from: string; to: string; label: string; isPartial: boolean }
  total: number
  byType: {
    combos: number
    avulso: number
  }
  /** Cestinha (Além do Pãozin) — D-2: receita nova ≠ valor movimentado. */
  market?: {
    revenue: number
    gmv: number
    moneyPart: number
    creditPart: number
    credits: number
    orders: number
    /** H9 — custo do que foi vendido e margem sobre o GMV. */
    cmv?: number
    margin?: number
    marginPct?: number
    /** Unidades sem custo cadastrado: enquanto > 0, a margem é parcial. */
    unitsWithoutCost?: number
  }
  /** Receita de crédito + receita da Cestinha. Sem GMV. */
  totalConsolidated?: number
  /** Dinheiro que saiu: compras ao fornecedor finalizadas no período (H9). */
  purchases?: { total: number; breadCost: number; itemsCost: number; orders: number }
  byCondominium: CondoRevenue[]
}

interface FinReceitaProps {
  onBack: () => void
}

// ------------------------------------------------------------------ helpers
function formatBRL(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

/** Linha "rótulo · valor" com uma dica embaixo — usada no card da Cestinha (D-2). */
function RevenueLine({
  label, value, hint, strong,
}: {
  label: string
  value: string
  hint: string
  strong?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: strong ? 700 : 600, color: 'var(--color-text-sec)', margin: 0 }}>
          {label}
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: '1px 0 0' }}>
          {hint}
        </p>
      </div>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: strong ? 15 : 14,
          fontWeight: strong ? 800 : 700,
          color: strong ? 'var(--color-text)' : 'var(--color-text-sec)',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    </div>
  )
}

/**
 * FinReceita — a tela de receita do Financeiro.
 *
 * Era o `AdminFinanceiro` inteiro. Com o DRE, despesas, contas a pagar e fluxo de caixa, o
 * Financeiro virou HUB (decisão 8 do plano-financeiro-vendas) e esta passou a ser um item dele.
 */
// ------------------------------------------------------------------ componente
export function FinReceita({ onBack }: FinReceitaProps) {
  const [sel, setSel] = useState<PeriodSelection>({ kind: 'preset', period: 'day' })
  const [data, setData] = useState<FinancialData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const res = await apiFetch(`/admin/financial?${periodQuery(sel)}`)
        if (res.ok) {
          setData((await res.json()) as FinancialData)
        }
      } catch {
        // falha silenciosa
      } finally {
        setIsLoading(false)
      }
    }
    void fetchData()
  }, [sel])

  // Montar dados do BarChart a partir de byCondominium
  const condominiums = data?.byCondominium ?? []

  const barData = condominiums.slice(0, 7).map((c, i, arr) => ({
    label: (c.condominiumName ?? '—').slice(0, 4),
    value: c.total,
    highlight: i === Math.min(arr.length - 2, arr.length - 1),
  }))

  const maxCondo = Math.max(...condominiums.map((c) => c.total), 1)
  const combosTotal = data?.byType?.combos ?? 0
  const avulsoTotal = data?.byType?.avulso ?? 0
  const totalTipo = combosTotal + avulsoTotal
  const market = data?.market
  const purchases = data?.purchases
  // O card grande mostra a receita CONSOLIDADA (crédito + dinheiro novo da Cestinha). O fallback
  // para `total` cobre uma resposta antiga/sem o campo, em vez de exibir R$ 0.
  const consolidado = data?.totalConsolidated ?? data?.total ?? 0

  // O rótulo vem da API (`window.label`), não de um mapa local: é o servidor que resolve a janela
  // em BRT e sabe se ela está FECHADA ou em curso. `selectionLabel` só cobre o instante antes da
  // primeira resposta chegar.
  const headerLabel = `Receita · ${data?.window?.label ?? selectionLabel(sel).toLowerCase()}`
  // Período em curso precisa se declarar: um parcial exibido sem ressalva é lido como fechamento.
  const isPartial = data?.window?.isPartial ?? true

  // A composição da Cestinha fica em aba própria porque GMV e receita NÃO podem sair na mesma
  // coluna de uma planilha: quem somar as duas conta a mesma nota duas vezes (D-2).
  const onExport = data
    ? () =>
        void downloadXlsx(`receita-${selectionSlug(sel)}.xlsx`, [
          {
            name: 'Receita',
            notes: [`Receita — ${data.window?.label ?? selectionLabel(sel)}`],
            head: ['Linha', 'Valor'],
            rows: [
              ['Créditos — combos', combosTotal],
              ['Créditos — compra personalizada', avulsoTotal],
              ['= Receita de créditos', data.total],
              ['🧺 Cestinha — dinheiro novo', market?.revenue ?? 0],
              ['Gancho de porta pago', (data.totalConsolidated ?? 0) - data.total - (market?.revenue ?? 0)],
              ['= Receita consolidada', consolidado],
            ],
            money: [1],
            footer: [
              'Receita consolidada = créditos + dinheiro NOVO da Cestinha + gancho pago. O GMV da Cestinha NÃO entra.',
              ...(isPartial ? ['Período EM CURSO — números parciais.'] : []),
            ],
          },
          ...(market
            ? [
                {
                  name: 'Cestinha',
                  head: ['Linha', 'Valor'],
                  rows: [
                    ['Receita nova (dinheiro que entrou)', market.revenue],
                    ['Valor movimentado (GMV)', market.gmv],
                    ['  parte em dinheiro', market.moneyPart],
                    ['  parte em pãezinhos', market.creditPart],
                    ['CMV (custo do vendido)', market.cmv ?? null],
                    ['Margem sobre o GMV', market.margin ?? null],
                  ],
                  money: [1],
                  footer: [
                    `Cestinhas confirmadas: ${market.orders} · pãezinhos usados como pagamento: ${formatCredits(toMilli(market.credits))}`,
                    'O GMV NUNCA é somado à receita: a parte paga em pãezinhos já foi faturada na compra do combo.',
                    ...((market.unitsWithoutCost ?? 0) > 0
                      ? [`Margem PARCIAL: ${market.unitsWithoutCost} unidade(s) vendida(s) sem custo cadastrado.`]
                      : []),
                  ],
                },
              ]
            : []),
          ...(purchases
            ? [
                {
                  name: 'Compras ao fornecedor',
                  head: ['Linha', 'Valor'],
                  rows: [
                    ['Pão', purchases.breadCost],
                    ['Produtos da Cestinha', purchases.itemsCost],
                    ['= Total comprado', purchases.total],
                  ],
                  money: [1],
                  footer: [`Pedidos finalizados no período: ${purchases.orders}`],
                },
              ]
            : []),
          {
            name: 'Por condomínio',
            head: ['Condomínio', 'Receita de créditos', 'Movimentado em Cestinhas'],
            rows: condominiums.map((c) => [c.condominiumName ?? '—', c.total, c.cestinhaGmv ?? 0]),
            money: [1, 2],
          },
        ])
    : undefined

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* AppBar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 20px 14px',
        }}
      >
        <button
          type="button"
          aria-label="Voltar"
          onClick={onBack}
          style={{
            background: 'var(--color-surface-2)',
            border: 'none',
            width: 36,
            height: 36,
            borderRadius: 11,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Icon name="arrowL" size={18} color="var(--color-text)" />
        </button>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--color-text)',
            margin: 0,
            flex: 1,
          }}
        >
          Financeiro
        </h2>
        {onExport && (
          <button
            type="button"
            aria-label="Exportar planilha"
            onClick={onExport}
            style={{
              background: 'var(--color-surface-2)',
              border: 'none',
              width: 36,
              height: 36,
              borderRadius: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Icon name="download" size={18} color="var(--color-text)" />
          </button>
        )}
      </div>

      {/* Conteúdo */}
      <div style={{ overflow: 'auto', flex: 1, padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Seletor de período — presets, meses fechados e intervalo */}
        <PeriodPicker value={sel} onChange={setSel} />

        {isLoading ? (
          <div style={{ paddingTop: 32, textAlign: 'center' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
              Carregando...
            </span>
          </div>
        ) : data ? (
          <>
            {/* Card receita total */}
            <div
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-2)',
                borderRadius: 18,
                padding: '18px 18px 14px',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--color-text-sec)',
                  margin: '0 0 4px',
                }}
              >
                {headerLabel}
                {/* Selo "em curso": distingue um mês fechado de um mês ainda correndo. Sem ele,
                    "setembro de 2026" com 20 dias apurados parece fechamento de setembro. */}
                {isPartial && (
                  <span
                    style={{
                      marginLeft: 6,
                      padding: '1px 6px',
                      borderRadius: 99,
                      background: 'var(--color-gold-soft)',
                      color: '#8A6A00',
                      fontSize: 10.5,
                      fontWeight: 700,
                    }}
                  >
                    em curso
                  </span>
                )}
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 34,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'var(--color-text)',
                  margin: market && market.revenue > 0 ? '0 0 2px' : '0 0 16px',
                }}
              >
                {formatBRL(consolidado)}
              </p>
              {/* D-2 — a composição fica explícita: sem ela, ninguém sabe se a Cestinha está
                  dentro do número, e o próximo a olhar somaria o GMV por cima. */}
              {market && market.revenue > 0 && (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-text-ter)', margin: '0 0 16px' }}>
                  {formatBRL(data.total ?? 0)} em créditos + {formatBRL(market.revenue)} na Cestinha
                </p>
              )}
              <BarChart data={barData.length > 0 ? barData : [{ label: '—', value: 0 }]} height={80} />
            </div>

            {/* Card da Cestinha — D-2: receita NOVA e valor movimentado são números diferentes, e o
                GMV nunca entra na receita (a parte paga em pãezinhos foi faturada na compra do
                combo). Só aparece quando houve movimento no período. */}
            {market && (market.gmv > 0 || market.revenue > 0) && (
              <div
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-2)',
                  borderRadius: 18,
                  padding: 18,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
                  <span style={{ fontSize: 14 }}>🧺</span>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                    Além do Pãozin
                  </p>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-ter)', marginLeft: 'auto' }}>
                    {market.orders} {market.orders === 1 ? 'Cestinha' : 'Cestinhas'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <RevenueLine
                    label="Receita nova (dinheiro)"
                    value={formatBRL(market.revenue)}
                    hint="entra no total acima"
                    strong
                  />
                  <RevenueLine
                    label="Movimentado (GMV)"
                    value={formatBRL(market.gmv)}
                    hint="valor dos pedidos — não é receita"
                  />
                  <RevenueLine
                    label="Pago em pãezinhos"
                    value={`${formatBRL(market.creditPart)}${market.credits > 0 ? ` · ${formatCredits(toMilli(market.credits))} 🥖` : ''}`}
                    hint="já faturado na compra dos créditos"
                  />
                  {/* H9 — margem sobre o MOVIMENTADO (não sobre a receita nova): o custo existe
                      independentemente de como o cliente pagou. */}
                  {market.cmv != null && (
                    <RevenueLine
                      label="Custo dos produtos (CMV)"
                      value={formatBRL(market.cmv)}
                      hint="custo esperado pela matriz de fornecimento"
                    />
                  )}
                  {market.margin != null && (
                    <RevenueLine
                      label={`Margem${market.marginPct != null ? ` · ${market.marginPct}%` : ''}`}
                      value={formatBRL(market.margin)}
                      hint={
                        (market.unitsWithoutCost ?? 0) > 0
                          ? `PARCIAL — ${market.unitsWithoutCost} un. sem custo cadastrado`
                          : 'movimentado − CMV'
                      }
                      strong
                    />
                  )}
                </div>
              </div>
            )}

            {/* Compras do período — o outro lado do caixa (H9). Fica em card próprio para não ser
                lido como receita negativa dentro do bloco da Cestinha. */}
            {purchases && purchases.total > 0 && (
              <div
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-2)',
                  borderRadius: 18,
                  padding: 18,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                    Compras ao fornecedor
                  </p>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, color: 'var(--color-text)' }}>
                    {formatBRL(purchases.total)}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <RevenueLine label="Pão" value={formatBRL(purchases.breadCost)} hint="pedidos do turno" />
                  <RevenueLine
                    label="Produtos do mercadinho"
                    value={formatBRL(purchases.itemsCost)}
                    hint="inclui reposição de estoque"
                  />
                </div>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: '10px 0 0' }}>
                  {purchases.orders} pedido{purchases.orders === 1 ? '' : 's'} finalizado
                  {purchases.orders === 1 ? '' : 's'} no período · custo pago, não estimado.
                </p>
              </div>
            )}

            {/* Card por tipo */}
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
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  margin: '0 0 14px',
                }}
              >
                Por tipo de compra
              </p>

              {/* Barra proporcional */}
              <div
                style={{
                  height: 10,
                  borderRadius: 99,
                  overflow: 'hidden',
                  background: 'var(--color-surface-2)',
                  marginBottom: 12,
                  display: 'flex',
                }}
              >
                {totalTipo > 0 && (
                  <>
                    <div
                      style={{
                        width: `${(combosTotal / totalTipo) * 100}%`,
                        background: 'var(--color-gold)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                    <div
                      style={{
                        flex: 1,
                        background: 'rgba(176,112,42,0.35)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </>
                )}
              </div>

              {/* Legenda */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--color-gold)', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-sec)' }}>
                      Combos
                    </span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                    {formatBRL(combosTotal)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(176,112,42,0.35)', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-sec)' }}>
                      Compra personalizada
                    </span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                    {formatBRL(avulsoTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Card por condomínio */}
            {condominiums.length > 0 && (
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
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--color-text)',
                    margin: '0 0 14px',
                  }}
                >
                  Por condomínio
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--color-text-ter)', margin: '-10px 0 12px' }}>
                  Receita de créditos · 🧺 = movimentado em Cestinhas
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {condominiums.map((c) => (
                    <div key={c.condominiumId} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'var(--color-text-sec)',
                          }}
                        >
                          {c.condominiumName}
                        </span>
                        <span
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: 13,
                            fontWeight: 700,
                            color: 'var(--color-text)',
                          }}
                        >
                          {formatBRL(c.total)}
                          {/* GMV ao lado, em cinza: o condomínio pode ter movimento de Cestinha
                              sem nenhuma receita de crédito no período. */}
                          {(c.cestinhaGmv ?? 0) > 0 && (
                            <span style={{ fontWeight: 600, color: 'var(--color-text-ter)' }}>
                              {' '}· 🧺 {formatBRL(c.cestinhaGmv ?? 0)}
                            </span>
                          )}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 6,
                          borderRadius: 99,
                          background: 'var(--color-surface-2)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${(c.total / maxCondo) * 100}%`,
                            background: 'var(--color-gold)',
                            borderRadius: 99,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ paddingTop: 32, textAlign: 'center' }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-ter)' }}>
              Falha na conexão. Tente novamente.
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
