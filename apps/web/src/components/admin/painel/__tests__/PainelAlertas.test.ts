// Faixa 0 do Painel — a regra é qual alerta aparece, em que ordem, e quando a faixa some.
import { describe, it, expect } from 'vitest'
import { buildAlertRows } from '../PainelAlertas'
import type { DashboardAlerts } from '../painel-types'

const zero: DashboardAlerts = {
  stuckOrders: 0,
  pendingHooks: 0,
  unresolvedMarketLoss: 0,
  lowStock: { low: 0, out: 0 },
  failedPayments: 0,
  generatedAt: '2026-09-21T12:00:00.000Z',
}

const withAll: DashboardAlerts = {
  stuckOrders: 2,
  pendingHooks: 3,
  unresolvedMarketLoss: 1,
  lowStock: { low: 4, out: 2 },
  failedPayments: 5,
  generatedAt: '2026-09-21T12:00:00.000Z',
}

describe('buildAlertRows', () => {
  it('nada pendente = nenhuma linha (a faixa não desenha)', () => {
    // Ausência de alerta É a informação: um "nenhum alerta" ocuparia a melhor dobra da tela.
    expect(buildAlertRows(zero)).toEqual([])
  })

  it('só monta linha para o que é maior que zero', () => {
    const rows = buildAlertRows({ ...zero, pendingHooks: 2 })
    expect(rows).toHaveLength(1)
    expect(rows[0].key).toBe('hooks')
  })

  it('ordena por urgência: parados primeiro, estoque baixo por último', () => {
    const keys = buildAlertRows(withAll).map((r) => r.key)
    expect(keys).toEqual(['stuck', 'loss', 'out', 'failed', 'hooks', 'low'])
  })

  it('separa esgotado (bad) de estoque baixo (warn) — urgências diferentes', () => {
    const rows = buildAlertRows(withAll)
    expect(rows.find((r) => r.key === 'out')?.tone).toBe('bad')
    expect(rows.find((r) => r.key === 'low')?.tone).toBe('warn')
  })

  it('flexiona singular e plural', () => {
    expect(buildAlertRows({ ...zero, stuckOrders: 1 })[0].title).toBe('1 pedido parado')
    expect(buildAlertRows({ ...zero, stuckOrders: 2 })[0].title).toBe('2 pedidos parados')
    expect(buildAlertRows({ ...zero, unresolvedMarketLoss: 1 })[0].title).toBe('1 Cestinha sem desfecho')
    expect(buildAlertRows({ ...zero, unresolvedMarketLoss: 3 })[0].title).toBe('3 Cestinhas sem desfecho')
  })

  it('pedido parado leva ao histórico de parados (deep-link que já existia)', () => {
    const row = buildAlertRows({ ...zero, stuckOrders: 1 })[0]
    expect(row.target).toEqual({ tab: 'entregas', intent: { segment: 'historico', filter: 'parados' } })
  })

  it('Cestinha sem desfecho não tem destino: ainda não há tela dedicada', () => {
    // Melhor um alerta sem link do que um link que leva ao lugar errado.
    expect(buildAlertRows({ ...zero, unresolvedMarketLoss: 2 })[0].target).toBeUndefined()
  })

  it('o detalhe de pagamento diz o critério, não só o número', () => {
    const row = buildAlertRows({ ...zero, failedPayments: 4 })[0]
    // Sem o critério, o admin não sabe que quem já pagou depois está fora da conta.
    expect(row.detail).toContain('Sem pagamento posterior')
  })
})
