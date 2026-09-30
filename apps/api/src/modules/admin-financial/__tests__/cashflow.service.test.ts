// cashflow.service — fluxo de caixa realizado (F5 da Fase 5).
//
// O que estes testes protegem:
//   1. Entrada é LÍQUIDA (bruto − taxa) — misturar bruto na série e líquido no total faria os dois
//      não fecharem.
//   2. A série é CONTÍNUA: dia sem movimento entra com zero, senão a linha do acumulado salta e a
//      distância entre pontos deixa de significar tempo.
//   3. O acumulado parte de ZERO — é variação do período, não saldo em conta.
//   4. Pedido ao fornecedor legado (sem `totalValue`) cai nos itens.
//   5. Dia parado não concorre a "pior dia".
import { describe, it, expect, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { CashflowService } from '../cashflow.service.js'

interface Over {
  payments?: Array<{
    amount: number
    method: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD'
    createdAt: Date
    gatewayFee?: number | null
    feeBasis?: string | null
  }>
  refunds?: number
  expenses?: Array<{ amount: number; paidAt: Date | null }>
  purchases?: Array<{ id: string; date: Date; totalValue: number | null }>
  purchaseItems?: Array<{ purchaseOrderId: string; quantity: number; unitPrice: number }>
  rates?: Array<{ key: string; value: string }>
}

function makeService(over: Over = {}) {
  const prisma = {
    setting: { findMany: vi.fn().mockResolvedValue(over.rates ?? [{ key: 'taxaPix', value: '1' }]) },
    payment: {
      findMany: vi.fn().mockResolvedValue(over.payments ?? []),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: over.refunds ?? 0 } }),
    },
    expense: { findMany: vi.fn().mockResolvedValue(over.expenses ?? []) },
    purchaseOrder: { findMany: vi.fn().mockResolvedValue(over.purchases ?? []) },
    purchaseOrderItem: { findMany: vi.fn().mockResolvedValue(over.purchaseItems ?? []) },
  }
  return new CashflowService({
    prisma,
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  } as unknown as FastifyInstance)
}

/** Instante UTC a partir de uma hora BRT. */
const brt = (iso: string) => new Date(`${iso}-03:00`)

/** Janela fechada de 3 dias BRT: 10, 11 e 12 de agosto. */
const JANELA = {
  startDate: brt('2026-08-10T00:00:00'),
  endDate: brt('2026-08-13T00:00:00'),
  label: '10/08/2026 a 12/08/2026',
  isPartial: false,
  spec: { kind: 'range' as const, from: '2026-08-10', to: '2026-08-12' },
}

describe('entradas são líquidas', () => {
  it('desconta a taxa estimada do bruto', async () => {
    const svc = makeService({
      payments: [{ amount: 100, method: 'PIX', createdAt: brt('2026-08-10T09:00:00') }],
    })
    const r = await svc.getReport(JANELA)

    expect(r.inflowGross).toBe(100)
    expect(r.gatewayFee).toBe(1) // 1%
    expect(r.inflow).toBe(99)
  })

  it('usa a taxa REAL quando o provedor informou', async () => {
    const svc = makeService({
      payments: [
        {
          amount: 100,
          method: 'PIX',
          createdAt: brt('2026-08-10T09:00:00'),
          gatewayFee: 0.6,
          feeBasis: 'GATEWAY',
        },
      ],
    })
    expect((await svc.getReport(JANELA)).inflow).toBe(99.4)
  })

  it('a série diária soma exatamente o total de entradas', async () => {
    // Se a série usasse bruto e o total líquido, os dois não fechariam e o gráfico contradiria o
    // cartão logo acima dele.
    const svc = makeService({
      payments: [
        { amount: 100, method: 'PIX', createdAt: brt('2026-08-10T09:00:00') },
        { amount: 200, method: 'PIX', createdAt: brt('2026-08-11T09:00:00') },
      ],
    })
    const r = await svc.getReport(JANELA)
    const somaSerie = r.daily.reduce((s, d) => s + d.inflow, 0)

    expect(Math.round(somaSerie * 100) / 100).toBe(r.inflow)
  })
})

describe('saídas', () => {
  it('soma despesas pagas, compras e estornos', async () => {
    const svc = makeService({
      expenses: [{ amount: 300, paidAt: brt('2026-08-10T12:00:00') }],
      purchases: [{ id: 'po-1', date: brt('2026-08-11T06:00:00'), totalValue: 500 }],
      refunds: 50,
    })
    const r = await svc.getReport(JANELA)

    expect(r.expensesPaid).toBe(300)
    expect(r.supplierPurchases).toBe(500)
    expect(r.refunds).toBe(50)
    expect(r.outflow).toBe(850)
  })

  it('pedido legado SEM totalValue cai nos itens', async () => {
    const svc = makeService({
      purchases: [{ id: 'po-legado', date: brt('2026-08-10T06:00:00'), totalValue: null }],
      purchaseItems: [
        { purchaseOrderId: 'po-legado', quantity: 100, unitPrice: 0.5 },
        { purchaseOrderId: 'po-legado', quantity: 10, unitPrice: 2 },
      ],
    })
    expect((await svc.getReport(JANELA)).supplierPurchases).toBe(70)
  })

  it('pedido sem total e sem item vira zero, não NaN', async () => {
    const svc = makeService({
      purchases: [{ id: 'po-vazio', date: brt('2026-08-10T06:00:00'), totalValue: null }],
      purchaseItems: [],
    })
    const r = await svc.getReport(JANELA)
    expect(r.supplierPurchases).toBe(0)
    expect(Number.isFinite(r.outflow)).toBe(true)
  })

  it('consulta itens só dos pedidos legados', async () => {
    const svc = makeService({
      purchases: [
        { id: 'po-novo', date: brt('2026-08-10T06:00:00'), totalValue: 100 },
        { id: 'po-legado', date: brt('2026-08-11T06:00:00'), totalValue: null },
      ],
      purchaseItems: [{ purchaseOrderId: 'po-legado', quantity: 10, unitPrice: 1 }],
    })
    const r = await svc.getReport(JANELA)
    expect(r.supplierPurchases).toBe(110)
  })
})

describe('série diária', () => {
  it('inclui dias SEM movimento', async () => {
    // Pular o dia vazio faria a linha do acumulado saltar no gráfico.
    const svc = makeService({
      payments: [{ amount: 100, method: 'PIX', createdAt: brt('2026-08-10T09:00:00') }],
    })
    const r = await svc.getReport(JANELA)

    expect(r.daily).toHaveLength(3)
    expect(r.daily.map((d) => d.day)).toEqual(['2026-08-10', '2026-08-11', '2026-08-12'])
    expect(r.daily[1]).toMatchObject({ inflow: 0, outflow: 0, net: 0 })
  })

  it('o acumulado parte de ZERO e soma o saldo de cada dia', async () => {
    const svc = makeService({
      payments: [
        { amount: 100, method: 'PIX', createdAt: brt('2026-08-10T09:00:00') },
        { amount: 100, method: 'PIX', createdAt: brt('2026-08-12T09:00:00') },
      ],
      expenses: [{ amount: 50, paidAt: brt('2026-08-11T09:00:00') }],
    })
    const r = await svc.getReport(JANELA)

    expect(r.daily.map((d) => d.cumulative)).toEqual([99, 49, 148])
  })

  it('o último acumulado é o caixa do período', async () => {
    const svc = makeService({
      payments: [{ amount: 100, method: 'PIX', createdAt: brt('2026-08-10T09:00:00') }],
      expenses: [{ amount: 30, paidAt: brt('2026-08-11T09:00:00') }],
    })
    const r = await svc.getReport(JANELA)
    expect(r.daily[r.daily.length - 1].cumulative).toBe(r.net)
  })

  it('agrupa pelo dia BRT, não pelo UTC', async () => {
    // 10/08 23:00 BRT = 11/08 02:00 UTC. Lido em UTC, a entrada cairia no dia seguinte.
    const svc = makeService({
      payments: [{ amount: 100, method: 'PIX', createdAt: brt('2026-08-10T23:00:00') }],
    })
    const r = await svc.getReport(JANELA)
    expect(r.daily[0].inflow).toBe(99)
    expect(r.daily[1].inflow).toBe(0)
  })
})

describe('melhor e pior dia', () => {
  it('ignora dias parados', async () => {
    // Um domingo sem movimento não é "o pior dia" — seria ruído lido como sinal.
    const svc = makeService({
      payments: [{ amount: 100, method: 'PIX', createdAt: brt('2026-08-10T09:00:00') }],
      expenses: [{ amount: 500, paidAt: brt('2026-08-12T09:00:00') }],
    })
    const r = await svc.getReport(JANELA)

    expect(r.bestDay?.day).toBe('2026-08-10')
    expect(r.worstDay?.day).toBe('2026-08-12')
  })

  it('período sem movimento nenhum devolve null', async () => {
    const r = await makeService().getReport(JANELA)
    expect(r.bestDay).toBeNull()
    expect(r.worstDay).toBeNull()
    expect(r.net).toBe(0)
  })
})

describe('caixa negativo', () => {
  it('aparece como negativo, não como zero', async () => {
    const svc = makeService({ expenses: [{ amount: 400, paidAt: brt('2026-08-10T09:00:00') }] })
    expect((await svc.getReport(JANELA)).net).toBe(-400)
  })
})
