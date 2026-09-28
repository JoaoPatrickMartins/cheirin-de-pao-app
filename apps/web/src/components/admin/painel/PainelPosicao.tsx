import type { DashboardOverview } from './painel-types'
import { fmtBRL, fmtInt } from './painel-types'
import { SectionLabel } from './PainelBase'

/**
 * Faixa 6 do Painel — posição patrimonial.
 *
 * Diferente da Faixa 2: aquela é FLUXO (o que entrou e saiu no período), esta é SALDO (onde o
 * negócio está agora, independente de período). Por isso não reage ao seletor de período — e o
 * rótulo diz isso, senão o admin trocaria o mês e estranharia o número parado.
 *
 * O passivo de crédito é a linha mais importante e a menos intuitiva: cada combo vendido é dinheiro
 * no caixa **e** pão a entregar. Um mês de campanha infla a receita e o passivo junto.
 *
 * Contas a pagar entrou junto com o módulo de despesas — é o que a empresa deve a fornecedor e a
 * prestador, e sem ela a faixa mostrava só o ativo e o passivo de crédito.
 */

interface PainelPosicaoProps {
  data: DashboardOverview | null
}

export function PainelPosicao({ data }: PainelPosicaoProps) {
  if (!data) return null
  const { position } = data

  // Nada a mostrar ainda (base nova, sem crédito em circulação nem estoque cadastrado).
  if (
    position.creditLiability <= 0 &&
    position.stockAtCost <= 0 &&
    position.creditsOutstanding <= 0 &&
    (position.payable ?? 0) <= 0
  ) {
    return null
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <SectionLabel>Posição · hoje</SectionLabel>
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-2)',
          borderRadius: 22,
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <Row
          label="Passivo de crédito"
          hint={`${fmtInt(position.creditsOutstanding)} 🥖 em circulação — pão já vendido, ainda não entregue`}
          value={fmtBRL(position.creditLiability)}
          strong
        />
        <Row
          label="Estoque a custo"
          hint={
            position.stockUnitsWithoutCost > 0
              ? `PARCIAL — ${fmtInt(position.stockUnitsWithoutCost)} un. sem custo cadastrado`
              : 'produtos de estoque fixo, pela matriz de fornecimento'
          }
          value={fmtBRL(position.stockAtCost)}
        />
        {/* A terceira linha do balanço, prevista desde a Fase 1. Sem ela a Faixa 6 mostrava só o
            ativo e o passivo de crédito, omitindo o que a empresa deve a fornecedor e prestador. */}
        {(position.payable ?? 0) > 0 && (
          <Row
            label="Contas a pagar"
            hint={
              (position.payableOverdue ?? 0) > 0
                ? `${fmtBRL(position.payableOverdue ?? 0)} JÁ VENCIDOS`
                : 'em aberto, nenhuma vencida'
            }
            value={fmtBRL(position.payable ?? 0)}
          />
        )}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 10.5,
            color: 'var(--color-text-ter)',
            margin: '2px 0 0',
          }}
        >
          Saldo atual — não muda com o período selecionado.
        </p>
      </div>
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
  hint: string
  value: string
  strong?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
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
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            color: 'var(--color-text-ter)',
            margin: '1px 0 0',
            lineHeight: 1.3,
          }}
        >
          {hint}
        </p>
      </div>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: strong ? 16 : 14,
          fontWeight: strong ? 800 : 700,
          color: 'var(--color-text)',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    </div>
  )
}
