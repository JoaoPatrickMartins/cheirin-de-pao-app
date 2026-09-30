/**
 * break-even.ts — ponto de equilíbrio e margem de contribuição (F9 da Fase 7).
 *
 * PURO: só aritmética, testável sem banco. Quem coleta é `margin.service.ts`.
 *
 * Responde a pergunta que o DRE não responde: **"quantos pães por dia pagam a operação?"**. O DRE
 * conta o que já aconteceu; o ponto de equilíbrio diz onde o resultado vira zero — e por isso é o
 * único número deste módulo que serve de META.
 *
 * ## A separação fixo × variável é a premissa inteira
 *
 * Todo o cálculo depende de `ExpenseCategory.isFixed`, e é por isso que aquela flag existe no
 * schema desde a Fase 1. Custo FIXO existe mesmo com venda zero (aluguel, pró-labore, software);
 * VARIÁVEL acompanha o volume (CMV, combustível, embalagem, taxa de gateway). Classificar errado
 * não dá erro nenhum — só um ponto de equilíbrio errado, e ninguém percebe. Por isso o resultado
 * carrega `caveats` dizendo em cima de que base ele foi calculado.
 *
 * ## Por que a razão, e não só o valor por unidade
 *
 * O negócio vende pão (unidade) e Cestinha (item, com preços muito diferentes). Uma margem de
 * contribuição "por unidade" que misturasse as duas seria uma média sem significado. Então o motor
 * calcula os dois: a **razão** (margem de contribuição ÷ receita), que é robusta e vale para o mix
 * inteiro, e a conversão em **pães/dia**, que é a leitura que o dono usa — declarada como derivada
 * do mix ATUAL, porque é isso que ela é.
 */

const round2 = (n: number) => Math.round(n * 100) / 100

export interface BreakEvenInputs {
  /** Receita do período (R$). */
  revenue: number
  /** Custo da mercadoria vendida no período (R$) — variável por natureza. */
  cogs: number
  /** Despesa de categoria `isFixed: true` (R$). Existe mesmo com venda zero. */
  fixedExpenses: number
  /** Despesa de categoria `isFixed: false` (R$). Acompanha o volume. */
  variableExpenses: number
  /** Pães vendidos no período — a unidade em que a meta é lida. */
  breads: number
  /** Dias do período. Divisor da meta diária. */
  days: number
}

export interface BreakEven {
  revenue: number
  /** `cogs + variableExpenses` — tudo que só existe porque houve venda. */
  variableCosts: number
  fixedCosts: number
  /** `revenue − variableCosts`. O que sobra para pagar o fixo. */
  contributionMargin: number
  /** `contributionMargin / revenue` (0..1). A régua que vale para o mix inteiro. */
  contributionMarginRatio: number
  /** Receita em que o resultado é zero. `null` quando não existe ponto de equilíbrio. */
  breakEvenRevenue: number | null
  /** A mesma meta convertida em pães, pelo preço médio do mix ATUAL. */
  breakEvenBreads: number | null
  /** ...e por dia. É o número que o dono leva para a operação. */
  breakEvenBreadsPerDay: number | null
  /** `revenue − breakEvenRevenue`. Positivo = passou do ponto; negativo = falta. */
  gap: number | null
  /**
   * Margem de segurança (0..1): quanto a receita pode cair antes de dar prejuízo. `null` quando o
   * ponto de equilíbrio não existe ou ainda não foi atingido.
   */
  safetyMargin: number | null
  /** Resultado do período pela mesma decomposição: `contributionMargin − fixedCosts`. */
  result: number
  reached: boolean
  caveats: string[]
}

/**
 * computeBreakEven — o ponto de equilíbrio a partir da decomposição fixo × variável.
 *
 * Os dois casos em que o ponto de equilíbrio **não existe** devolvem `null` em vez de um número
 * inventado, e dizem por quê em `caveats`:
 *
 *   1. **Sem receita.** Não há mix do qual derivar preço médio nem razão de contribuição.
 *   2. **Margem de contribuição ≤ 0.** Cada venda adicional aprofunda o prejuízo: não existe
 *      volume que pague o fixo, e exibir uma meta gigante sugeriria que existe. O problema aqui é
 *      de PREÇO, não de volume — e é isso que a ressalva diz.
 */
export function computeBreakEven(input: BreakEvenInputs): BreakEven {
  const revenue = round2(input.revenue)
  const variableCosts = round2(input.cogs + input.variableExpenses)
  const fixedCosts = round2(input.fixedExpenses)
  const contributionMargin = round2(revenue - variableCosts)
  const ratio = revenue > 0 ? contributionMargin / revenue : 0
  const result = round2(contributionMargin - fixedCosts)

  const caveats: string[] = []
  if (fixedCosts === 0) {
    caveats.push(
      'Nenhuma despesa FIXA lançada no período: o ponto de equilíbrio sai zero porque não há custo fixo a cobrir, não porque a operação se paga sozinha. Marque as categorias fixas em Financeiro › Categorias de despesa.',
    )
  }
  caveats.push(
    'Fixo × variável vem de `isFixed` na categoria da despesa. Uma categoria classificada errado muda o ponto de equilíbrio sem dar nenhum aviso.',
  )

  const base = {
    revenue,
    variableCosts,
    fixedCosts,
    contributionMargin,
    contributionMarginRatio: Math.round(ratio * 10000) / 10000,
    result,
  }

  if (revenue <= 0) {
    return {
      ...base,
      breakEvenRevenue: null,
      breakEvenBreads: null,
      breakEvenBreadsPerDay: null,
      gap: null,
      safetyMargin: null,
      reached: false,
      caveats: [
        'Sem receita no período: não há mix de venda do qual derivar a margem de contribuição.',
        ...caveats,
      ],
    }
  }

  if (contributionMargin <= 0) {
    return {
      ...base,
      breakEvenRevenue: null,
      breakEvenBreads: null,
      breakEvenBreadsPerDay: null,
      gap: null,
      safetyMargin: null,
      reached: false,
      caveats: [
        'A margem de contribuição está ZERO ou negativa: cada venda a mais aumenta o prejuízo, e nenhum volume cobre o custo fixo. O problema é de PREÇO ou de custo variável, não de volume.',
        ...caveats,
      ],
    }
  }

  const breakEvenRevenue = round2(fixedCosts / ratio)
  const gap = round2(revenue - breakEvenRevenue)
  const reached = revenue >= breakEvenRevenue

  // A conversão para pães usa o preço médio do mix ATUAL. Declarada como derivada, porque é: mude
  // o mix (mais Cestinha, menos pão) e a mesma receita-alvo sai com outro número de pães.
  const avgBreadRevenue = input.breads > 0 ? revenue / input.breads : 0
  const breakEvenBreads = avgBreadRevenue > 0 ? Math.ceil(breakEvenRevenue / avgBreadRevenue) : null
  const days = Math.max(input.days, 1)

  if (breakEvenBreads != null) {
    caveats.push(
      'A meta em pães/dia é derivada do MIX atual (receita ÷ pães vendidos). Mudando o mix — mais Cestinha, menos pão —, a mesma receita-alvo sai com outro número de pães.',
    )
  }

  return {
    ...base,
    breakEvenRevenue,
    breakEvenBreads,
    breakEvenBreadsPerDay: breakEvenBreads != null ? Math.ceil(breakEvenBreads / days) : null,
    gap,
    // Só faz sentido depois do ponto de equilíbrio: antes dele não há "quanto posso cair".
    safetyMargin: reached ? Math.round((gap / revenue) * 10000) / 10000 : null,
    reached,
    caveats,
  }
}

/**
 * Simulador (D2) — o resultado quando um parâmetro muda, sobre a MESMA decomposição.
 *
 * Existe para responder "e se o pão subir R$ 0,05?" sem persistir nada. Reusa
 * {@link computeBreakEven} de propósito: um simulador com aritmética própria daria, no cenário
 * "não muda nada", um número diferente do relatório — e aí nenhum dos dois serve.
 *
 * @param deltaRevenuePct variação percentual da receita (ex.: `10` = +10%)
 * @param deltaCogsPct variação percentual do CMV
 * @param deltaFixedPct variação percentual da despesa fixa
 */
export function simulate(
  input: BreakEvenInputs,
  scenario: { deltaRevenuePct?: number; deltaCogsPct?: number; deltaFixedPct?: number },
): BreakEven {
  const f = (v: number, pct: number | undefined) => v * (1 + (pct ?? 0) / 100)
  return computeBreakEven({
    ...input,
    revenue: f(input.revenue, scenario.deltaRevenuePct),
    cogs: f(input.cogs, scenario.deltaCogsPct),
    fixedExpenses: f(input.fixedExpenses, scenario.deltaFixedPct),
    // O volume acompanha a receita: subir o preço sem vender mais é `deltaRevenuePct` com
    // `breads` intacto, e é isso que o chamador controla passando um `input` já ajustado.
    breads: input.breads,
  })
}
