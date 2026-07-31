// Onda G2 — desfecho FÍSICO de uma Cestinha não entregue.
//
// O furo que isto fecha: `NOT_DELIVERED` é status terminal, então a Cestinha saía do radar de
// "parados" (`getStuck` só olha status não-terminais) e o `resolveStuckMarketOrder` a recusava com
// 422. Não existia NENHUM caminho para devolver o estoque ou o crédito depois que o entregador
// marcava a falha — o prejuízo virava silêncio, com o produto "vendido" para sempre.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

const notifyUser = vi.fn().mockResolvedValue(undefined)
vi.mock('../../notifications/notifications.service.js', () => ({
  NotificationsService: class {
    constructor(_f: unknown) {}
    notifyUser = notifyUser
    notifyAdmins = vi.fn()
  },
}))

import { AdminMarketService } from '../admin-market.service.js'

interface OrderShape {
  id: string
  userId: string
  status: string
  breadQty: number
  creditsApplied: number
  moneyAmount: number
  scheduledDate: Date
  items: { productId: string; name: string; qty: number; unitPrice: number }[]
  lossResolvedAt: Date | null
  stockReturned: boolean | null
  lossReason: string | null
}

const order = (over: Partial<OrderShape> = {}): OrderShape => ({
  id: 'mo-1',
  userId: 'user-1',
  status: 'NOT_DELIVERED',
  breadQty: 4,
  creditsApplied: 3,
  moneyAmount: 12,
  scheduledDate: new Date('2026-07-28T15:00:00.000Z'),
  items: [{ productId: 'fixo', name: 'Geleia', qty: 2, unitPrice: 8 }],
  lossResolvedAt: null,
  stockReturned: null,
  lossReason: null,
  ...over,
})

function makeService(
  o: OrderShape | null,
  opts: { existingRefund?: boolean; productTypes?: Record<string, string>; avulsoUnit?: string } = {},
) {
  const { existingRefund = false, productTypes = { fixo: 'FIXED' }, avulsoUnit = '2' } = opts

  const productUpdate = vi.fn().mockResolvedValue({})
  const dailyUpdateMany = vi.fn().mockResolvedValue({ count: 1 })
  const userUpdate = vi.fn().mockResolvedValue({})
  const creditTransactionCreate = vi.fn().mockResolvedValue({})
  const marketOrderUpdate = vi.fn().mockResolvedValue({})

  const tx = {
    product: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(productTypes[where.id] ? { id: where.id, stockType: productTypes[where.id] } : null),
      ),
      update: productUpdate,
    },
    productDailyStock: { updateMany: dailyUpdateMany },
    user: { update: userUpdate },
    creditTransaction: { create: creditTransactionCreate },
    marketOrder: { update: marketOrderUpdate },
  }

  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue({ creditBalance: 40 }) },
    setting: { findUnique: vi.fn().mockResolvedValue({ key: 'avulsoUnit', value: avulsoUnit }) },
    marketOrder: { findUnique: vi.fn().mockResolvedValue(o) },
    creditTransaction: { findFirst: vi.fn().mockResolvedValue(existingRefund ? { id: 'tx-old' } : null) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: vi.fn().mockImplementation((cb: any) => cb(tx)),
  }

  return {
    service: new AdminMarketService({
      prisma,
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    } as unknown as FastifyInstance),
    productUpdate,
    dailyUpdateMany,
    userUpdate,
    creditTransactionCreate,
    marketOrderUpdate,
  }
}

describe('resolveNotDelivered', () => {
  beforeEach(() => vi.clearAllMocks())

  it('devolve estoque FIXO e estorna tudo em pãezinhos, marcando o desfecho', async () => {
    const { service, productUpdate, userUpdate, creditTransactionCreate, marketOrderUpdate } = makeService(order())
    const r = await service.resolveNotDelivered('mo-1', 'admin-1', {
      returnStock: true,
      refundCredits: true,
      reason: 'Produto voltou intacto',
    })

    // 3 créditos aplicados + ceil(12 / 2) da parte em dinheiro = 9 (DEC-36, a favor do cliente).
    expect(r).toMatchObject({ stockReturned: true, refundedCredits: 9, alreadyResolved: false })
    expect(productUpdate).toHaveBeenCalledWith({ where: { id: 'fixo' }, data: { stock: { increment: 2 } } })
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { creditBalance: { increment: 9 } } })
    expect(creditTransactionCreate.mock.calls[0][0].data).toMatchObject({
      type: 'MARKET_REFUND',
      quantity: 9,
      referenceId: 'mo-1',
      adminId: 'admin-1',
    })
    expect(marketOrderUpdate.mock.calls[0][0].data).toMatchObject({
      stockReturned: true,
      lossReason: 'Produto voltou intacto',
      lossResolvedBy: 'admin-1',
    })
  })

  it('NÃO reescreve o status nem o motivo original da falha', async () => {
    const { service, marketOrderUpdate } = makeService(order())
    await service.resolveNotDelivered('mo-1', 'admin-1', { returnStock: false, refundCredits: false })

    const data = marketOrderUpdate.mock.calls[0][0].data
    // O que o entregador escreveu na porta ("cliente ausente") é o registro do que aconteceu.
    expect(data).not.toHaveProperty('status')
    expect(data).not.toHaveProperty('failureReason')
    expect(data).not.toHaveProperty('failedAt')
  })

  it('perda real: sem devolver estoque e sem estornar — e isso fica registrado', async () => {
    const { service, productUpdate, userUpdate, marketOrderUpdate } = makeService(order())
    const r = await service.resolveNotDelivered('mo-1', 'admin-1', {
      returnStock: false,
      refundCredits: false,
      reason: 'Extraviado',
    })

    expect(r).toMatchObject({ stockReturned: false, refundedCredits: 0 })
    expect(productUpdate).not.toHaveBeenCalled()
    expect(userUpdate).not.toHaveBeenCalled()
    expect(marketOrderUpdate.mock.calls[0][0].data).toMatchObject({ stockReturned: false, lossReason: 'Extraviado' })
  })

  it('estoque DAILY não é liberado — o `reserved` é a capacidade de um dia já encerrado', async () => {
    const { service, productUpdate, dailyUpdateMany } = makeService(order({ items: [{ productId: 'diario', name: 'Bolo', qty: 3, unitPrice: 10 }] }), {
      productTypes: { diario: 'DAILY' },
    })
    await service.resolveNotDelivered('mo-1', 'admin-1', { returnStock: true, refundCredits: false })

    expect(productUpdate).not.toHaveBeenCalled()
    expect(dailyUpdateMany).not.toHaveBeenCalled()
  })

  it('idempotente: resolver de novo devolve o estado sem estornar duas vezes', async () => {
    const { service, userUpdate, productUpdate, marketOrderUpdate } = makeService(
      order({ lossResolvedAt: new Date('2026-07-29T10:00:00.000Z'), stockReturned: true }),
    )
    const r = await service.resolveNotDelivered('mo-1', 'admin-1', { returnStock: true, refundCredits: true })

    expect(r).toMatchObject({ alreadyResolved: true, refundedCredits: 0, stockReturned: true })
    expect(userUpdate).not.toHaveBeenCalled()
    expect(productUpdate).not.toHaveBeenCalled()
    expect(marketOrderUpdate).not.toHaveBeenCalled()
  })

  it('estorno já existente por outro caminho não credita de novo, mas o desfecho é gravado', async () => {
    const { service, userUpdate, marketOrderUpdate } = makeService(order(), { existingRefund: true })
    const r = await service.resolveNotDelivered('mo-1', 'admin-1', { returnStock: false, refundCredits: true })

    expect(r.refundedCredits).toBe(0)
    expect(userUpdate).not.toHaveBeenCalled()
    expect(marketOrderUpdate).toHaveBeenCalled()
  })

  it('avisa o cliente SÓ quando houve estorno de fato', async () => {
    const comEstorno = makeService(order())
    await comEstorno.service.resolveNotDelivered('mo-1', 'admin-1', { returnStock: false, refundCredits: true })
    expect(notifyUser).toHaveBeenCalledTimes(1)
    expect(notifyUser.mock.calls[0][1].body).toContain('9 pãezinhos')

    vi.clearAllMocks()
    const semEstorno = makeService(order())
    await semEstorno.service.resolveNotDelivered('mo-1', 'admin-1', { returnStock: true, refundCredits: false })
    // Sem estorno, um push só repetiria a má notícia que a Onda F3 já deu.
    expect(notifyUser).not.toHaveBeenCalled()
  })

  it('recusa (422) quem não está NOT_DELIVERED e 404 inexistente', async () => {
    const entregue = makeService(order({ status: 'DELIVERED' }))
    await expect(
      entregue.service.resolveNotDelivered('mo-1', 'admin-1', { returnStock: false, refundCredits: false }),
    ).rejects.toMatchObject({ statusCode: 422 })

    const inexistente = makeService(null)
    await expect(
      inexistente.service.resolveNotDelivered('nada', 'admin-1', { returnStock: false, refundCredits: false }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})
