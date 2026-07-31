// Onda F5 — quando o admin é avisado de estoque do mercadinho. A regra é CRUZAMENTO de limiar:
// avisa na reserva que fez o estoque cair na faixa crítica, e nunca mais. Sem isso, toda venda
// seguinte repetiria o mesmo aviso e o admin desligaria o toggle.
import { describe, it, expect } from 'vitest'
import { buildStockAlerts, stockAlertLabel, LOW_STOCK_THRESHOLD, type StockSnapshot } from '../market-stock-alerts.js'

const fixed = (over: Partial<StockSnapshot> = {}): StockSnapshot => ({
  productId: 'p1',
  name: 'Geleia',
  stockType: 'FIXED',
  availableAfter: 4,
  consumed: 2,
  ...over,
})

const daily = (over: Partial<StockSnapshot> = {}): StockSnapshot => ({
  productId: 'p2',
  name: 'Bolo de Fubá',
  stockType: 'DAILY',
  availableAfter: 0,
  consumed: 1,
  date: '2026-07-30',
  ...over,
})

describe('buildStockAlerts', () => {
  it('FIXED que CRUZOU o limiar agora → alerta LOW', () => {
    // 6 → 4: antes estava acima de 5, agora não.
    const alerts = buildStockAlerts([fixed({ availableAfter: 4, consumed: 2 })])
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({ kind: 'LOW', remaining: 4, name: 'Geleia' })
  })

  it('FIXED que JÁ estava abaixo do limiar → nenhum alerta (não repete)', () => {
    // 4 → 3: continua baixo, mas o cruzamento aconteceu numa venda anterior.
    expect(buildStockAlerts([fixed({ availableAfter: 3, consumed: 1 })])).toEqual([])
  })

  it('FIXED que zerou agora → OUT (tem precedência sobre LOW)', () => {
    const alerts = buildStockAlerts([fixed({ availableAfter: 0, consumed: 3 })])
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({ kind: 'OUT', remaining: 0 })
  })

  it('FIXED que já estava zerado → nenhum alerta', () => {
    expect(buildStockAlerts([fixed({ availableAfter: 0, consumed: 0 })])).toEqual([])
  })

  it('exatamente NO limiar conta como cruzamento (<=)', () => {
    const alerts = buildStockAlerts([fixed({ availableAfter: LOW_STOCK_THRESHOLD, consumed: 1 })])
    expect(alerts[0]?.kind).toBe('LOW')
  })

  it('DAILY esgotado no dia → OUT com a data', () => {
    const alerts = buildStockAlerts([daily({ availableAfter: 0, consumed: 2 })])
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({ kind: 'OUT', date: '2026-07-30' })
  })

  it('DAILY com poucas vagas NÃO gera LOW — capacidade do dia enchendo é o normal', () => {
    expect(buildStockAlerts([daily({ availableAfter: 2, consumed: 3 })])).toEqual([])
  })

  it('consumed = 0 nunca alerta — reprocessar a mesma reserva é silencioso', () => {
    expect(buildStockAlerts([fixed({ availableAfter: 0, consumed: 0 }), daily({ consumed: 0 })])).toEqual([])
  })

  it('vários produtos na mesma reserva → um alerta por produto, na ordem recebida', () => {
    const alerts = buildStockAlerts([
      fixed({ productId: 'a', name: 'Geleia', availableAfter: 0, consumed: 1 }),
      fixed({ productId: 'b', name: 'Café', availableAfter: 5, consumed: 2 }),
      fixed({ productId: 'c', name: 'Mel', availableAfter: 20, consumed: 1 }), // longe do limiar
    ])
    expect(alerts.map((a) => [a.name, a.kind])).toEqual([
      ['Geleia', 'OUT'],
      ['Café', 'LOW'],
    ])
  })
})

describe('stockAlertLabel', () => {
  it('OUT de produto FIXO — sem data', () => {
    expect(stockAlertLabel({ productId: 'a', name: 'Geleia', kind: 'OUT', remaining: 0 })).toBe('Geleia esgotou')
  })

  it('OUT de produto DAILY — DD/MM, sem ano', () => {
    expect(stockAlertLabel({ productId: 'b', name: 'Bolo', kind: 'OUT', remaining: 0, date: '2026-07-30' })).toBe(
      'Bolo esgotou para 30/07',
    )
  })

  it('LOW pluraliza a sobra', () => {
    expect(stockAlertLabel({ productId: 'a', name: 'Café', kind: 'LOW', remaining: 1 })).toBe('Café: resta 1')
    expect(stockAlertLabel({ productId: 'a', name: 'Café', kind: 'LOW', remaining: 3 })).toBe('Café: restam 3')
  })
})
