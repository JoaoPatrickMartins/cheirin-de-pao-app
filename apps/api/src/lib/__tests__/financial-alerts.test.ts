// financial-alerts.test.ts — as regras dos alertas financeiros (⭐C1 · escopo firmado).
//
// O que estes testes protegem não é a aritmética, é o SILÊNCIO. Um alerta que dispara toda semana
// vira ruído, é desligado no toggle, e aí o canal inteiro se perde — inclusive para o mês em que
// ele importava. Então cada teste de "dispara" tem um par de "NÃO dispara".
//
// E nada pode falar sobre número que ainda vai mudar: no dia 2 de um mês, qualquer comparação de
// margem ou resultado acusa desastre e está errada.
import { describe, it, expect } from 'vitest'
import {
  evaluateAlerts,
  MIN_ELAPSED_FOR_TREND,
  type AlertInputs,
} from '../financial-alerts.js'

const base: AlertInputs = {
  month: '2026-09',
  elapsed: 0.5,
  dueTomorrow: { count: 0, total: 0 },
  overdue: { count: 0, total: 0 },
  categories: [],
  grossMargin: { current: 0.6, previous: 0.6 },
  result: 1000,
  goal: null,
}

const typesOf = (i: Partial<AlertInputs>) =>
  evaluateAlerts({ ...base, ...i }).map((a) => a.type)

describe('evaluateAlerts — silêncio é o estado normal', () => {
  it('não dispara nada quando está tudo bem', () => {
    expect(evaluateAlerts(base)).toEqual([])
  })
})

describe('ADMIN_EXPENSE_DUE', () => {
  it('dispara para conta vencendo amanhã', () => {
    const [a] = evaluateAlerts({ ...base, dueTomorrow: { count: 2, total: 300 } })
    expect(a.type).toBe('ADMIN_EXPENSE_DUE')
    expect(a.body).toMatch(/2 vence/)
  })

  it('dispara para conta já vencida, com título diferente', () => {
    const [a] = evaluateAlerts({ ...base, overdue: { count: 1, total: 120 } })
    expect(a.title).toMatch(/vencida/i)
  })

  it('AGREGA tudo num aviso só — não um por conta', () => {
    // Três notificações para três contas do mesmo dia seria o caminho mais curto para o toggle
    // ser desligado.
    const alerts = evaluateAlerts({
      ...base,
      dueTomorrow: { count: 3, total: 300 },
      overdue: { count: 2, total: 200 },
    })
    expect(alerts).toHaveLength(1)
    expect(alerts[0].body).toMatch(/2 vencida/)
    expect(alerts[0].body).toMatch(/3 vence/)
  })

  it('usa chave de dedupe DIÁRIA, não por conta', () => {
    const [a] = evaluateAlerts({ ...base, overdue: { count: 1, total: 1 } })
    expect(a.dedupeKey).toBe('expense-due')
  })

  it('fala mesmo no comecinho do mês — é ação diária, não tendência', () => {
    expect(typesOf({ elapsed: 0.03, overdue: { count: 1, total: 50 } })).toContain(
      'ADMIN_EXPENSE_DUE',
    )
  })
})

describe('ADMIN_EXPENSE_ANOMALY', () => {
  const cat = (current: number, previousAvg: number) => [
    { categoryId: 'c1', name: 'Combustível', current, previousAvg },
  ]

  it('dispara acima de 40% da média', () => {
    const [a] = evaluateAlerts({ ...base, categories: cat(150, 100) })
    expect(a.type).toBe('ADMIN_EXPENSE_ANOMALY')
    expect(a.body).toMatch(/50%/)
  })

  it('dispara em 40% CRAVADOS — o plano diz "≥ 40% acima da média"', () => {
    expect(typesOf({ categories: cat(140, 100) })).toEqual(['ADMIN_EXPENSE_ANOMALY'])
  })

  it('NÃO dispara abaixo do limiar', () => {
    expect(typesOf({ categories: cat(139, 100) })).toEqual([])
  })

  it('NÃO dispara para categoria sem base de comparação', () => {
    // Categoria estreada este mês não é anomalia, é categoria nova.
    expect(typesOf({ categories: cat(9999, 0) })).toEqual([])
  })

  it('dedupe é por categoria E por mês — duas categorias podem alertar juntas', () => {
    const alerts = evaluateAlerts({
      ...base,
      categories: [
        { categoryId: 'c1', name: 'A', current: 300, previousAvg: 100 },
        { categoryId: 'c2', name: 'B', current: 300, previousAvg: 100 },
      ],
    })
    expect(alerts).toHaveLength(2)
    expect(new Set(alerts.map((a) => a.dedupeKey)).size).toBe(2)
    expect(alerts[0].dedupeKey).toContain('2026-09')
  })
})

describe('ADMIN_MARGIN_DROP', () => {
  it('dispara com queda de 5 pontos percentuais ou mais', () => {
    const [a] = evaluateAlerts({ ...base, grossMargin: { current: 0.55, previous: 0.6 } })
    expect(a.type).toBe('ADMIN_MARGIN_DROP')
    expect(a.body).toMatch(/5\.0 p\.p\./)
  })

  it('NÃO dispara com queda menor', () => {
    expect(typesOf({ grossMargin: { current: 0.57, previous: 0.6 } })).toEqual([])
  })

  it('NÃO dispara quando a margem SUBIU', () => {
    expect(typesOf({ grossMargin: { current: 0.7, previous: 0.6 } })).toEqual([])
  })

  it('NÃO dispara sem mês anterior de base', () => {
    expect(typesOf({ grossMargin: { current: 0.1, previous: null } })).toEqual([])
  })
})

describe('ADMIN_RESULT_NEGATIVE', () => {
  it('dispara com resultado negativo', () => {
    const [a] = evaluateAlerts({ ...base, result: -500 })
    expect(a.type).toBe('ADMIN_RESULT_NEGATIVE')
    expect(a.dedupeKey).toBe('result:2026-09')
  })

  it('NÃO dispara com resultado zero', () => {
    expect(typesOf({ result: 0 })).toEqual([])
  })
})

describe('ADMIN_GOAL_AT_RISK', () => {
  it('compara com o esperado ATÉ AQUI, não com a meta cheia', () => {
    // Metade do mês, meta 10.000 → esperado 5.000. Com 3.000 (60%), está em risco.
    const [a] = evaluateAlerts({ ...base, goal: { target: 10000, actual: 3000 } })
    expect(a.type).toBe('ADMIN_GOAL_AT_RISK')
    expect(a.body).toMatch(/60%/)
  })

  it('NÃO dispara quando está no ritmo, mesmo com 50% da meta cheia', () => {
    // É o alarme falso que a régua pro rata existe para evitar: no meio do mês, 50% é o esperado.
    expect(typesOf({ goal: { target: 10000, actual: 5000 } })).toEqual([])
  })

  it('NÃO dispara por uma folga pequena abaixo do ritmo', () => {
    // 95% do esperado ainda é ritmo, não risco.
    expect(typesOf({ goal: { target: 10000, actual: 4750 } })).toEqual([])
  })

  it('NÃO dispara sem meta definida', () => {
    expect(typesOf({ goal: null })).toEqual([])
    expect(typesOf({ goal: { target: 0, actual: 0 } })).toEqual([])
  })
})

describe('nada de tendência no começo do mês', () => {
  const ruim: Partial<AlertInputs> = {
    elapsed: MIN_ELAPSED_FOR_TREND - 0.01,
    grossMargin: { current: 0.1, previous: 0.6 },
    result: -9999,
    goal: { target: 10000, actual: 0 },
  }

  it('cala margem, resultado e meta antes do avanço mínimo', () => {
    // No dia 2 de um mês qualquer comparação acusa desastre — e estaria errada.
    expect(typesOf(ruim)).toEqual([])
  })

  it('mas NÃO cala contas a pagar, que é ação diária', () => {
    expect(typesOf({ ...ruim, overdue: { count: 1, total: 10 } })).toEqual(['ADMIN_EXPENSE_DUE'])
  })

  it('volta a falar assim que o mês avança o suficiente', () => {
    const t = typesOf({ ...ruim, elapsed: MIN_ELAPSED_FOR_TREND })
    expect(t).toContain('ADMIN_MARGIN_DROP')
    expect(t).toContain('ADMIN_RESULT_NEGATIVE')
    expect(t).toContain('ADMIN_GOAL_AT_RISK')
  })
})

describe('ordem e forma', () => {
  it('põe dinheiro que vai sair primeiro', () => {
    const t = typesOf({
      overdue: { count: 1, total: 10 },
      result: -1,
      grossMargin: { current: 0.1, previous: 0.6 },
    })
    expect(t[0]).toBe('ADMIN_EXPENSE_DUE')
  })

  it('todo alerta tem título, corpo e chave de dedupe', () => {
    const alerts = evaluateAlerts({
      ...base,
      overdue: { count: 1, total: 10 },
      result: -1,
      categories: [{ categoryId: 'c1', name: 'X', current: 300, previousAvg: 100 }],
    })
    for (const a of alerts) {
      expect(a.title.length).toBeGreaterThan(0)
      expect(a.body.length).toBeGreaterThan(0)
      expect(a.dedupeKey.length).toBeGreaterThan(0)
    }
  })
})
