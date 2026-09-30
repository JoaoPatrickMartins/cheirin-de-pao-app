import type { DashboardOverview } from './painel-types'
import { fmtBRL } from './painel-types'

/**
 * Faixa 2 do Painel — resultado do período.
 *
 * A faixa que não existia: o painel mostrava apenas "receita do dia" e nunca respondia "como vai o
 * mês". Aqui a receita é a CONSOLIDADA (crédito + Cestinha em dinheiro + gancho pago) com variação
 * contra a janela anterior EQUIVALENTE — mês contra mês no mesmo ponto de avanço, não contra o mês
 * inteiro.
 *
 * O RESULTADO (lucro e margem) vem do DRE em regime de caixa, sem alternância — o painel é
 * leitura rápida, não análise contábil; quem quer competência abre o DRE. O caixa (Fase 5) ainda
 * não entrou.
 *
 * Cada bloco só aparece quando tem número: um "R$ 0,00" de resultado seria lido como prejuízo, e
 * esqueleto de KPI vazio ocupa a melhor dobra da tela sem informar nada.
 */

interface PainelResultadoProps {
  data: DashboardOverview | null
  isLoading: boolean
}

export function PainelResultado({ data, isLoading }: PainelResultadoProps) {
  if (isLoading && !data) {
    return (
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-2)',
          borderRadius: 22,
          padding: 18,
          marginBottom: 12,
        }}
      >
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-ter)', margin: 0 }}>
          Apurando o período…
        </p>
      </div>
    )
  }
  if (!data) return null

  const { revenue, window, result } = data
  const delta = revenue.deltaPct

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-2)',
        borderRadius: 22,
        padding: 18,
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--color-text-sec)',
            margin: 0,
            textTransform: 'capitalize',
          }}
        >
          Receita · {window.label}
        </p>
        {/* Um período em curso exibido sem ressalva é lido como fechamento. */}
        {window.isPartial && (
          <span
            style={{
              padding: '1px 6px',
              borderRadius: 99,
              background: 'var(--color-gold-soft)',
              color: '#8A6A00',
              fontFamily: 'var(--font-body)',
              fontSize: 10.5,
              fontWeight: 700,
            }}
          >
            em curso
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
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
          {fmtBRL(revenue.consolidated)}
        </p>
        {delta != null && <DeltaPill pct={delta} label={data.previous?.label} />}
      </div>

      {/* A composição é explícita de propósito: sem ela ninguém sabe se a Cestinha e o gancho estão
          dentro do número — e o próximo a olhar somaria o GMV por cima. */}
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
        <Part label="Créditos" value={revenue.credit} />
        {revenue.market > 0 && <Part label="🧺 Cestinha" value={revenue.market} />}
        {revenue.hook > 0 && <Part label="Gancho" value={revenue.hook} />}
        {revenue.purchases > 0 && <Part label="Compras" value={-revenue.purchases} />}
      </div>

      {/* Resultado — só quando o DRE apurou. Um "R$ 0,00" aqui seria lido como prejuízo. */}
      {result && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--color-border-2)',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--color-text-sec)',
                margin: 0,
              }}
            >
              Resultado do período
            </p>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 10.5,
                color: 'var(--color-text-ter)',
                margin: '1px 0 0',
              }}
            >
              margem bruta {result.grossMarginPct}% · líquida {result.netMarginPct}% · regime caixa
            </p>
          </div>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 20,
              fontWeight: 800,
              color:
                result.netProfit >= 0 ? 'var(--color-good)' : 'var(--color-bad, #C2410C)',
              whiteSpace: 'nowrap',
            }}
          >
            {result.netProfit < 0
              ? `− ${fmtBRL(Math.abs(result.netProfit))}`
              : fmtBRL(result.netProfit)}
          </span>
        </div>
      )}

      {/* Ressalva mais importante do DRE, repassada: sem despesa lançada, "resultado" é lucro
          bruto com outro nome — a leitura otimista que engana quem só olha o painel. */}
      {result?.caveats.some((c) => c.includes('lucro bruto')) && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 10.5,
            color: '#8A6A00',
            background: 'var(--color-gold-soft)',
            borderRadius: 8,
            padding: '5px 8px',
            margin: '8px 0 0',
            lineHeight: 1.35,
          }}
        >
          Nenhuma despesa lançada no período — este é o lucro bruto, não o lucro real.
        </p>
      )}

      {/* GMV como contexto, jamais somado (D-2): a parte paga em pãezinhos já foi faturada quando
          o cliente comprou o combo. */}
      {revenue.cestinhaGmv > 0 && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            color: 'var(--color-text-ter)',
            margin: '8px 0 0',
          }}
        >
          🧺 {fmtBRL(revenue.cestinhaGmv)} movimentados em Cestinhas — não é receita
        </p>
      )}
    </div>
  )
}

function Part({ label, value }: { label: string; value: number }) {
  const negative = value < 0
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
          color: negative ? 'var(--color-bad, #C2410C)' : 'var(--color-text)',
        }}
      >
        {negative ? `− ${fmtBRL(Math.abs(value))}` : fmtBRL(value)}
      </span>
    </span>
  )
}

function DeltaPill({ pct, label }: { pct: number; label?: string }) {
  const good = pct >= 0
  return (
    <span
      title={label ? `vs ${label}` : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 9px',
        borderRadius: 99,
        background: good ? 'rgba(34,120,66,0.12)' : 'rgba(194,65,12,0.12)',
        color: good ? 'var(--color-good, #227842)' : 'var(--color-bad, #C2410C)',
        fontFamily: 'var(--font-body)',
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      {good ? '+' : ''}
      {pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
    </span>
  )
}
