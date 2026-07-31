// Onda F1 — o sweep do cron cancela uma Cestinha presa em PENDING_PAYMENT (Pix expirado,
// abandonado ou recusado), devolve estoque e estorna crédito. Até a Onda F fazia isso EM SILÊNCIO:
// o cliente descobria sozinho que o pedido tinha caído. Estes testes fixam duas coisas — que o
// aviso sai, e que ele sai UMA vez só (o cron roda a cada minuto, sem trava de execução).
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

const notifyUser = vi.fn().mockResolvedValue(undefined)
const notifyAdmins = vi.fn().mockResolvedValue(undefined)
vi.mock('../../notifications/notifications.service.js', () => ({
  NotificationsService: class {
    constructor(_fastify: unknown) {}
    notifyUser = notifyUser
    notifyAdmins = notifyAdmins
  },
}))

import { MarketCheckoutService } from '../market-checkout.service.js'

interface StuckOrder {
  id: string
  userId: string
  status: string
  creditsApplied: number
  scheduledDate: Date
  items: { productId: string; qty: number }[]
}

/** `claimCounts` = resultado do updateMany de claim, na ordem das chamadas (1 = ganhou a corrida). */
function mockFastify(orders: StuckOrder[], claimCounts: number[] = []) {
  const byId = new Map(orders.map((o) => [o.id, o]))
  let claimCall = 0
  const claimUpdateMany = vi.fn().mockImplementation(() => {
    const count = claimCounts[claimCall] ?? 1
    claimCall += 1
    return Promise.resolve({ count })
  })
  const creditTransactionCreate = vi.fn().mockResolvedValue({})
  const userUpdate = vi.fn().mockResolvedValue({})

  const tx = {
    marketOrder: { updateMany: claimUpdateMany },
    product: {
      findUnique: vi.fn().mockResolvedValue({ id: 'prod-1', stockType: 'FIXED' }),
      update: vi.fn().mockResolvedValue({}),
    },
    productDailyStock: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    user: { update: userUpdate },
    creditTransaction: { create: creditTransactionCreate },
  }

  const prisma = {
    marketOrder: {
      findMany: vi.fn().mockResolvedValue(
        orders.map((o) => ({ id: o.id, userId: o.userId, scheduledDate: o.scheduledDate })),
      ),
      findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(byId.get(where.id) ?? null),
      ),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: vi.fn().mockImplementation((cb: any) => cb(tx)),
    setting: { findUnique: vi.fn().mockResolvedValue(null) },
  }

  const fastify = {
    prisma,
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  } as unknown as FastifyInstance

  return { fastify, claimUpdateMany, creditTransactionCreate, userUpdate }
}

const stuck = (over: Partial<StuckOrder> = {}): StuckOrder => ({
  id: 'mo-1',
  userId: 'user-1',
  status: 'PENDING_PAYMENT',
  creditsApplied: 3,
  scheduledDate: new Date('2026-07-30T15:00:00.000Z'),
  items: [{ productId: 'prod-1', qty: 2 }],
  ...over,
})

describe('MarketCheckoutService.sweepStuckPayments — aviso ao cliente (F1)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('libera o pedido e avisa o cliente, dizendo quantos pãezinhos voltaram', async () => {
    const { fastify } = mockFastify([stuck()])
    const res = await new MarketCheckoutService(fastify).sweepStuckPayments()

    expect(res.released).toBe(1)
    expect(notifyUser).toHaveBeenCalledTimes(1)
    const [userId, payload] = notifyUser.mock.calls[0]
    expect(userId).toBe('user-1')
    expect(payload.type).toBe('MARKET_ORDER_CANCELLED')
    expect(payload.body).toContain('3 pãezinhos')
    expect(payload.body).toContain('30/07') // dia da entrega que caiu
    expect(payload.actionRoute).toBe('/client/pedidos')
  })

  it('sem crédito aplicado (100% Pix) → avisa que nada foi cobrado', async () => {
    const { fastify, creditTransactionCreate } = mockFastify([stuck({ creditsApplied: 0 })])
    await new MarketCheckoutService(fastify).sweepStuckPayments()

    expect(creditTransactionCreate).not.toHaveBeenCalled()
    expect(notifyUser.mock.calls[0][1].body).toContain('Nada foi cobrado')
  })

  it('NÃO avisa o admin — pedido que morreu esperando pagamento nunca entrou na operação', async () => {
    const { fastify } = mockFastify([stuck()])
    await new MarketCheckoutService(fastify).sweepStuckPayments()
    expect(notifyAdmins).not.toHaveBeenCalled()
  })

  it('perdeu a corrida do claim (sweep concorrente) → nada de estorno nem de aviso', async () => {
    const { fastify, creditTransactionCreate, userUpdate } = mockFastify([stuck()], [0])
    const res = await new MarketCheckoutService(fastify).sweepStuckPayments()

    expect(res.released).toBe(0)
    expect(notifyUser).not.toHaveBeenCalled()
    expect(creditTransactionCreate).not.toHaveBeenCalled()
    expect(userUpdate).not.toHaveBeenCalled()
  })

  it('pedido já CANCELLED → não reabre transação nem avisa de novo', async () => {
    const { fastify, claimUpdateMany } = mockFastify([stuck({ status: 'CANCELLED' })])
    const res = await new MarketCheckoutService(fastify).sweepStuckPayments()

    expect(res.released).toBe(0)
    expect(claimUpdateMany).not.toHaveBeenCalled()
    expect(notifyUser).not.toHaveBeenCalled()
  })

  it('vários pedidos presos → um aviso por pedido, cada um para o seu cliente', async () => {
    const { fastify } = mockFastify([
      stuck({ id: 'mo-1', userId: 'user-1' }),
      stuck({ id: 'mo-2', userId: 'user-2', creditsApplied: 1 }),
    ])
    const res = await new MarketCheckoutService(fastify).sweepStuckPayments()

    expect(res.released).toBe(2)
    expect(notifyUser.mock.calls.map((c) => c[0])).toEqual(['user-1', 'user-2'])
    expect(notifyUser.mock.calls[1][1].body).toContain('1 pãozinho')
  })

  it('falha ao notificar não desfaz a liberação (best-effort)', async () => {
    notifyUser.mockRejectedValueOnce(new Error('OneSignal fora'))
    const { fastify } = mockFastify([stuck()])
    const res = await new MarketCheckoutService(fastify).sweepStuckPayments()
    expect(res.released).toBe(1)
  })
})
