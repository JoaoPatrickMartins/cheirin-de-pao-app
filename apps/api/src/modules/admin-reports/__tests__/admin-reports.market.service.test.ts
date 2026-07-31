// Onda D (D3..D6) — a Cestinha nos relatórios. Antes: a taxa de entrega media só o pão, o ranking
// de condomínios ignorava a receita do mercadinho, o consumo de crédito não contava os pãezinhos
// gastos em Cestinha e a saúde do gateway não distinguia recusa de combo de recusa de Cestinha.
import { describe, it, expect, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { AdminReportsService } from '../admin-reports.service.js'

type Group = Record<string, unknown>

/**
 * Prisma mockado que despacha por MODELO + forma dos argumentos (nunca por ordem de chamada):
 * a Onda D acrescentou consultas no meio das existentes, e um mock posicional quebraria por
 * posição em vez de por comportamento.
 */
function makeFastify(over: {
  orderStatus?: Group[]
  marketStatus?: Group[]
  orderFail?: Group[]
  marketFail?: Group[]
  orderCancel?: Group[]
  marketCancel?: Group[]
  revBatch?: Array<{ _id: unknown; total?: number }>
  clientGroups?: Group[]
  breadGroups?: Group[]
  marketMoneyGroups?: Group[]
  marketBreadGroups?: Group[]
  paymentStatusGroups?: Group[]
  paymentMethodGroups?: Group[]
  paymentPurposeGroups?: Group[]
  deliverers?: Array<{ userId: string }>
  marketDeliverers?: Array<{ userId: string }>
  creditSold?: number
  creditConsumed?: number
} = {}) {
  const calls = {
    marketStatusWhere: null as unknown,
    creditConsumedWhere: null as unknown,
    purposeBy: null as unknown,
  }

  const prisma = {
    order: {
      groupBy: vi.fn().mockImplementation((args: { by: string[] }) => {
        if (args.by.includes('status')) return Promise.resolve(over.orderStatus ?? [])
        if (args.by.includes('failureReason')) return Promise.resolve(over.orderFail ?? [])
        if (args.by.includes('cancelReason')) return Promise.resolve(over.orderCancel ?? [])
        if (args.by.includes('condominiumId')) return Promise.resolve(over.breadGroups ?? [])
        return Promise.resolve([])
      }),
      findMany: vi.fn().mockResolvedValue(over.deliverers ?? []),
    },
    marketOrder: {
      groupBy: vi.fn().mockImplementation((args: { by: string[]; where?: unknown; _sum?: Group }) => {
        if (args.by.includes('status')) {
          calls.marketStatusWhere = args.where
          return Promise.resolve(over.marketStatus ?? [])
        }
        if (args.by.includes('failureReason')) return Promise.resolve(over.marketFail ?? [])
        if (args.by.includes('cancelReason')) return Promise.resolve(over.marketCancel ?? [])
        if (args.by.includes('condominiumId')) {
          return Promise.resolve(
            args._sum && 'breadQty' in args._sum
              ? (over.marketBreadGroups ?? [])
              : (over.marketMoneyGroups ?? []),
          )
        }
        return Promise.resolve([])
      }),
      findMany: vi.fn().mockResolvedValue(over.marketDeliverers ?? []),
    },
    payment: {
      groupBy: vi.fn().mockImplementation((args: { by: string[] }) => {
        if (args.by.includes('purpose')) {
          calls.purposeBy = args.by
          return Promise.resolve(over.paymentPurposeGroups ?? [])
        }
        if (args.by.includes('method')) return Promise.resolve(over.paymentMethodGroups ?? [])
        return Promise.resolve(over.paymentStatusGroups ?? [])
      }),
      findMany: vi.fn().mockImplementation((args: { distinct?: string[] }) =>
        Promise.resolve(args.distinct ? [{ userId: 'u1' }] : []),
      ),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockResolvedValue(over.clientGroups ?? []),
      aggregate: vi.fn().mockResolvedValue({ _sum: { creditBalance: 0 } }),
    },
    schedule: { findMany: vi.fn().mockResolvedValue([]) },
    creditTransaction: {
      aggregate: vi.fn().mockImplementation((args: { where?: { type?: unknown } }) => {
        const type = args.where?.type
        if (type && typeof type === 'object' && 'in' in type) {
          calls.creditConsumedWhere = type
          return Promise.resolve({ _sum: { quantity: -(over.creditConsumed ?? 0) } })
        }
        return Promise.resolve({ _sum: { quantity: over.creditSold ?? 0 } })
      }),
    },
    condominium: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'condo-1', name: 'Flores' },
        { id: 'condo-2', name: 'Jardins' },
      ]),
    },
    $runCommandRaw: vi.fn().mockResolvedValue({ cursor: { firstBatch: over.revBatch ?? [] } }),
  }

  return {
    service: new AdminReportsService({ prisma, log: { error: vi.fn(), warn: vi.fn() } } as unknown as FastifyInstance),
    calls,
  }
}

const st = (status: string, count: number) => ({ status, _count: count })

describe('getDeliveryReport — pão + Cestinha (D3)', () => {
  it('counts medem a operação inteira e byKind separa as duas populações', async () => {
    const { service } = makeFastify({
      orderStatus: [st('DELIVERED', 8), st('NOT_DELIVERED', 2), st('CANCELLED', 1), st('SCHEDULED', 3)],
      marketStatus: [st('DELIVERED', 4), st('NOT_DELIVERED', 1), st('SEPARATED', 2)],
    })
    const r = await service.getDeliveryReport('week')

    expect(r.counts).toEqual({ total: 21, delivered: 12, notDelivered: 3, cancelled: 1, inProgress: 5 })
    expect(r.byKind.bread).toMatchObject({ delivered: 8, notDelivered: 2, inProgress: 3 })
    expect(r.byKind.cestinha).toMatchObject({ delivered: 4, notDelivered: 1, inProgress: 2 })
    // 12/(12+3) = 0.8 — a taxa consolidada; a do pão isolada é 8/10.
    expect(r.deliveryRate).toBeCloseTo(0.8)
    expect(r.byKind.bread.deliveryRate).toBeCloseTo(0.8)
    expect(r.byKind.cestinha.deliveryRate).toBeCloseTo(0.8)
  })

  it('Cestinha aguardando pagamento fica FORA (nunca confirmou)', async () => {
    const { service, calls } = makeFastify()
    await service.getDeliveryReport('week')

    expect(calls.marketStatusWhere).toMatchObject({ status: { not: 'PENDING_PAYMENT' } })
  })

  it('motivos iguais nos dois lados somam numa linha só, ordenados por frequência', async () => {
    const { service } = makeFastify({
      orderFail: [{ failureReason: 'Cliente ausente', _count: 3 }, { failureReason: 'Endereço', _count: 1 }],
      marketFail: [{ failureReason: 'Cliente ausente', _count: 2 }],
      orderCancel: [{ cancelReason: 'Desistiu', _count: 1 }],
      marketCancel: [{ cancelReason: 'Pagamento não concluído no prazo', _count: 4 }],
    })
    const r = await service.getDeliveryReport('week')

    // "Cliente ausente" derruba a parada inteira — 3 do pão + 2 da Cestinha, uma linha.
    expect(r.failureReasons).toEqual([
      { reason: 'Cliente ausente', count: 5 },
      { reason: 'Endereço', count: 1 },
    ])
    expect(r.cancelReasons[0]).toEqual({ reason: 'Pagamento não concluído no prazo', count: 4 })
  })

  it('período sem nada → taxa 0, sem divisão por zero', async () => {
    const { service } = makeFastify()
    const r = await service.getDeliveryReport('day')
    expect(r.counts.total).toBe(0)
    expect(r.deliveryRate).toBe(0)
  })
})

describe('getCondominiumRanking — receita consolidada e D-1 (D4)', () => {
  it('revenue = crédito + dinheiro da Cestinha, com os recortes visíveis', async () => {
    const { service } = makeFastify({
      revBatch: [{ _id: 'condo-1', total: 100 }],
      marketMoneyGroups: [{ condominiumId: 'condo-1', _sum: { moneyAmount: 20, totalValue: 50 } }],
    })
    const r = await service.getCondominiumRanking('month')

    expect(r.items[0]).toMatchObject({
      condominiumId: 'condo-1',
      creditRevenue: 100,
      marketRevenue: 20,
      revenue: 120,
      cestinhaGmv: 50, // GMV é coluna própria — nunca somado à receita (D-2)
    })
  })

  it('breadsDelivered soma o pão vendido dentro da Cestinha (D-1)', async () => {
    const { service } = makeFastify({
      breadGroups: [{ condominiumId: 'condo-1', _sum: { quantity: 30 } }],
      marketBreadGroups: [{ condominiumId: 'condo-1', _sum: { breadQty: 12 } }],
    })
    const r = await service.getCondominiumRanking('month')

    expect(r.items[0].breadsDelivered).toBe(42)
  })

  it('condomínio que só movimenta Cestinha entra no ranking', async () => {
    const { service } = makeFastify({
      revBatch: [{ _id: 'condo-1', total: 100 }],
      marketMoneyGroups: [{ condominiumId: 'condo-2', _sum: { moneyAmount: 200, totalValue: 300 } }],
    })
    const r = await service.getCondominiumRanking('month')

    // Ordenado por receita consolidada: condo-2 (200) na frente de condo-1 (100).
    expect(r.items.map((i) => [i.condominiumId, i.revenue])).toEqual([
      ['condo-2', 200],
      ['condo-1', 100],
    ])
  })
})

describe('getRetentionReport — Cestinha consome crédito e ativa cliente (D5)', () => {
  it('creditsConsumed inclui MARKET_PURCHASE', async () => {
    const { service, calls } = makeFastify({ creditSold: 100, creditConsumed: 40 })
    const r = await service.getRetentionReport('month')

    expect(calls.creditConsumedWhere).toEqual({ in: ['DELIVERY', 'MARKET_PURCHASE'] })
    expect(r.repurchase.creditsConsumed).toBe(40)
    expect(r.repurchase.creditsSold).toBe(100)
  })

  it('withDelivery conta quem recebeu pão OU Cestinha, sem contar duas vezes', async () => {
    const { service } = makeFastify({
      deliverers: [{ userId: 'u1' }, { userId: 'u2' }],
      marketDeliverers: [{ userId: 'u2' }, { userId: 'u3' }], // u2 recebeu os dois
    })
    const r = await service.getRetentionReport('month')

    expect(r.activation.withDelivery).toBe(3)
  })
})

describe('getPaymentsReport — quebra por finalidade (D6)', () => {
  it('purpose null vira CREDITS e cada fluxo tem a sua taxa de aprovação', async () => {
    const { service } = makeFastify({
      paymentStatusGroups: [st('PAID', 9), st('FAILED', 3)],
      paymentPurposeGroups: [
        { purpose: null, status: 'PAID', _count: 7, _sum: { amount: 700 } },
        { purpose: null, status: 'FAILED', _count: 1, _sum: { amount: 100 } },
        { purpose: 'MARKET', status: 'PAID', _count: 2, _sum: { amount: 12 } },
        { purpose: 'MARKET', status: 'FAILED', _count: 2, _sum: { amount: 12 } },
      ],
    })
    const r = await service.getPaymentsReport('week')

    const byPurpose = new Map(r.byPurpose.map((p) => [p.purpose, p]))
    expect(byPurpose.get('CREDITS')).toMatchObject({ paid: 7, failed: 1, amount: 700 })
    expect(byPurpose.get('CREDITS')!.approvalRate).toBeCloseTo(7 / 8)
    // O fluxo novo aprova metade — e isso ficava escondido na média geral (9/12).
    expect(byPurpose.get('MARKET')).toMatchObject({ paid: 2, failed: 2, amount: 12 })
    expect(byPurpose.get('MARKET')!.approvalRate).toBeCloseTo(0.5)
    expect(r.approvalRate).toBeCloseTo(0.75)
  })

  it('só o valor dos PAID entra em amount — recusado não é dinheiro', async () => {
    const { service } = makeFastify({
      paymentPurposeGroups: [
        { purpose: 'MARKET', status: 'FAILED', _count: 3, _sum: { amount: 999 } },
        { purpose: 'MARKET', status: 'PENDING', _count: 1, _sum: { amount: 50 } },
      ],
    })
    const r = await service.getPaymentsReport('week')

    expect(r.byPurpose[0]).toMatchObject({ purpose: 'MARKET', failed: 3, pending: 1, amount: 0, approvalRate: 0 })
  })

  it('finalidade sem pagamento no período não aparece na lista', async () => {
    const { service } = makeFastify({
      paymentPurposeGroups: [{ purpose: null, status: 'PAID', _count: 1, _sum: { amount: 10 } }],
    })
    const r = await service.getPaymentsReport('week')

    expect(r.byPurpose.map((p) => p.purpose)).toEqual(['CREDITS'])
  })
})
