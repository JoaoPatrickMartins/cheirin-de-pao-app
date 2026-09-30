// break-even.test.ts — ponto de equilíbrio e margem de contribuição (F9 da Fase 7).
//
// Aritmética PURA, então os testes cobrem a conta inteira e, sobretudo, os casos em que o ponto de
// equilíbrio NÃO EXISTE. São eles que decidem se a tela informa ou mente:
//   - sem receita, não há mix do qual derivar nada;
//   - com margem de contribuição ≤ 0, nenhum volume paga o fixo — e uma meta gigante sugeriria
//     que pagaria;
//   - sem despesa fixa lançada, o ponto sai zero por falta de dado, não por saúde do negócio.
import { describe, it, expect } from 'vitest'
import { computeBreakEven, simulate, type BreakEvenInputs } from '../break-even.js'

/** Caso-base: R$ 10.000 de receita, 40% de custo variável, R$ 3.000 de fixo → lucro de R$ 3.000. */
const base: BreakEvenInputs = {
  revenue: 10000,
  cogs: 3500,
  fixedExpenses: 3000,
  variableExpenses: 500,
  breads: 5000,
  days: 30,
}

describe('computeBreakEven', () => {
  it('decompõe fixo × variável e fecha com o resultado', () => {
    const r = computeBreakEven(base)
    expect(r.variableCosts).toBe(4000) // 3500 CMV + 500 variável
    expect(r.contributionMargin).toBe(6000) // 10000 − 4000
    expect(r.contributionMarginRatio).toBe(0.6)
    expect(r.result).toBe(3000) // 6000 de contribuição − 3000 de fixo
  })

  it('calcula a receita de equilíbrio pela razão de contribuição', () => {
    const r = computeBreakEven(base)
    // 3000 de fixo ÷ 0,60 = 5000 de receita para zerar.
    expect(r.breakEvenRevenue).toBe(5000)
    expect(r.gap).toBe(5000)
    expect(r.reached).toBe(true)
  })

  it('converte a meta em pães e em pães/dia pelo mix atual', () => {
    const r = computeBreakEven(base)
    // R$ 2,00 por pão (10000/5000) → 2500 pães no período → 84/dia (arredonda para cima).
    expect(r.breakEvenBreads).toBe(2500)
    expect(r.breakEvenBreadsPerDay).toBe(84)
  })

  it('arredonda a meta PARA CIMA — meio pão não paga conta', () => {
    const r = computeBreakEven({ ...base, fixedExpenses: 3001 })
    expect(r.breakEvenBreads).toBe(Math.ceil(r.breakEvenRevenue! / 2))
    expect(Number.isInteger(r.breakEvenBreads)).toBe(true)
  })

  it('mede a margem de segurança quando o ponto já foi ultrapassado', () => {
    const r = computeBreakEven(base)
    // A receita pode cair 50% (de 10.000 para 5.000) antes do prejuízo.
    expect(r.safetyMargin).toBe(0.5)
  })

  it('não devolve margem de segurança quando o ponto ainda não foi atingido', () => {
    const r = computeBreakEven({ ...base, fixedExpenses: 9000 })
    expect(r.reached).toBe(false)
    expect(r.gap).toBeLessThan(0)
    // "Quanto posso cair" não existe para quem ainda está abaixo da linha.
    expect(r.safetyMargin).toBeNull()
  })

  it('não inventa ponto de equilíbrio quando não houve receita', () => {
    const r = computeBreakEven({ ...base, revenue: 0, cogs: 0, breads: 0 })
    expect(r.breakEvenRevenue).toBeNull()
    expect(r.breakEvenBreads).toBeNull()
    expect(r.gap).toBeNull()
    expect(r.caveats[0]).toMatch(/Sem receita/)
  })

  it('não inventa ponto de equilíbrio quando a margem de contribuição é negativa', () => {
    // Vende a 10.000 e gasta 12.000 de variável: cada venda aprofunda o prejuízo.
    const r = computeBreakEven({ ...base, cogs: 12000 })
    expect(r.contributionMargin).toBeLessThan(0)
    expect(r.breakEvenRevenue).toBeNull()
    expect(r.caveats[0]).toMatch(/PREÇO/)
  })

  it('trata margem de contribuição EXATAMENTE zero como sem ponto de equilíbrio', () => {
    const r = computeBreakEven({ ...base, cogs: 9500, variableExpenses: 500 })
    expect(r.contributionMargin).toBe(0)
    expect(r.breakEvenRevenue).toBeNull()
  })

  it('avisa quando não há despesa fixa lançada, em vez de comemorar', () => {
    const r = computeBreakEven({ ...base, fixedExpenses: 0 })
    expect(r.breakEvenRevenue).toBe(0)
    expect(r.reached).toBe(true)
    // O ponto é zero por FALTA DE DADO — a ressalva impede a leitura de que a operação se paga.
    expect(r.caveats[0]).toMatch(/Nenhuma despesa FIXA/)
  })

  it('declara sempre em cima de que base o fixo × variável foi separado', () => {
    expect(computeBreakEven(base).caveats.join(' ')).toMatch(/isFixed/)
  })

  it('declara que a meta em pães depende do mix atual', () => {
    expect(computeBreakEven(base).caveats.join(' ')).toMatch(/MIX atual/)
  })

  it('não divide por zero quando o período tem 0 dias', () => {
    const r = computeBreakEven({ ...base, days: 0 })
    expect(Number.isFinite(r.breakEvenBreadsPerDay!)).toBe(true)
  })

  it('não converte para pães quando nenhum pão foi vendido', () => {
    // Um período só de Cestinha tem receita, mas nenhum pão do qual derivar preço médio.
    const r = computeBreakEven({ ...base, breads: 0 })
    expect(r.breakEvenRevenue).toBe(5000)
    expect(r.breakEvenBreads).toBeNull()
    expect(r.breakEvenBreadsPerDay).toBeNull()
  })
})

describe('simulate', () => {
  it('sem alteração, devolve exatamente o mesmo resultado do relatório', () => {
    // É o contrato que impede o simulador e o relatório de divergirem.
    expect(simulate(base, {})).toEqual(computeBreakEven(base))
  })

  it('receita +10% com o mesmo custo derruba o ponto de equilíbrio', () => {
    const r = simulate(base, { deltaRevenuePct: 10 })
    expect(r.revenue).toBe(11000)
    expect(r.contributionMargin).toBe(7000)
    expect(r.breakEvenRevenue!).toBeLessThan(computeBreakEven(base).breakEvenRevenue!)
    expect(r.result).toBe(4000)
  })

  it('CMV +5% come margem e empurra o ponto de equilíbrio para cima', () => {
    const r = simulate(base, { deltaCogsPct: 5 })
    expect(r.variableCosts).toBe(4175) // 3500×1,05 + 500
    expect(r.breakEvenRevenue!).toBeGreaterThan(computeBreakEven(base).breakEvenRevenue!)
  })

  it('despesa fixa a mais sobe o ponto de equilíbrio proporcionalmente', () => {
    const r = simulate(base, { deltaFixedPct: 100 })
    expect(r.fixedCosts).toBe(6000)
    expect(r.breakEvenRevenue).toBe(10000) // 6000 ÷ 0,60
    expect(r.result).toBe(0) // exatamente no ponto
  })

  it('combina os três eixos numa passada', () => {
    const r = simulate(base, { deltaRevenuePct: -20, deltaCogsPct: 10, deltaFixedPct: 10 })
    expect(r.revenue).toBe(8000)
    expect(r.fixedCosts).toBe(3300)
    expect(r.variableCosts).toBe(4350) // 3850 + 500
  })

  it('leva o cenário ao ponto de não haver equilíbrio e diz isso', () => {
    const r = simulate(base, { deltaCogsPct: 200 })
    expect(r.breakEvenRevenue).toBeNull()
    expect(r.caveats[0]).toMatch(/PREÇO/)
  })
})
