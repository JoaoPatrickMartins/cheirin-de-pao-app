// OrdersService unit tests — Fase 4 / Plano 04-03
// Requirements: SCHED-01 (pedido avulso com reserva atômica de créditos)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { brtDateStr, isPastCutoffForDelivery } from '../../../lib/cutoff.js'

/** A tarde de hoje (15:30/corte 10:00) já fechou? Usado para tornar o teste de "hoje" determinístico. */
function isPastCutoffTodayTarde(): boolean {
  return isPastCutoffForDelivery('15:30', '10:00', brtDateStr(new Date(), 0))
}

// ── helpers de mock ──────────────────────────────────────────────────────────

function makeFutureDateStr(daysAhead = 2): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return d.toISOString()
}

function makePastDateStr(daysAgo = 1): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString()
}

/** Cria um mock do fastify com prisma.$transaction controlável */
function makeFastifyMock(overrides: {
  creditBalance?: number
  transactionError?: unknown
  orderFindFirst?: unknown
  orderFindMany?: unknown[]
  condominiumId?: string
  deliverySlots?: { name: string; time: string; cutoffTime: string; isActive: boolean }[]
} = {}) {
  const {
    creditBalance = 10,
    transactionError,
    orderFindFirst = null,
    orderFindMany = [],
    condominiumId,
    deliverySlots = [],
  } = overrides

  const user = { id: 'user-01', creditBalance, condominiumId }
  const condominium = { findUnique: vi.fn().mockResolvedValue({ deliverySlots }) }

  // prisma.$transaction chama a função passada com um tx simulado
  const txUser = {
    findUnique: vi.fn().mockResolvedValue(user),
    update: vi.fn().mockResolvedValue(user),
  }
  const txOrder = {
    create: vi.fn().mockResolvedValue({
      id: 'order-01',
      scheduledDate: new Date(makeFutureDateStr()),
      quantity: 2,
    }),
  }
  const txCreditTransaction = {
    create: vi.fn().mockResolvedValue({}),
  }

  const transaction = transactionError
    ? vi.fn().mockRejectedValue(transactionError)
    : vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn({ user: txUser, order: txOrder, creditTransaction: txCreditTransaction })
      })

  const orderMock = {
    ...txOrder,
    findFirst: vi.fn().mockResolvedValue(orderFindFirst),
    findMany: vi.fn().mockResolvedValue(orderFindMany),
  }

  return {
    fastify: {
      prisma: { $transaction: transaction, user: txUser, order: orderMock, condominium },
      log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
    } as unknown,
    txUser,
    txOrder: orderMock,
    txCreditTransaction,
  }
}

// ── testes ───────────────────────────────────────────────────────────────────

describe('OrdersService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createSingleOrder reserva créditos e cria Order com type SINGLE e status SCHEDULED', async () => {
    const { fastify, txOrder, txCreditTransaction } = makeFastifyMock({ creditBalance: 10 })

    // Importar dinamicamente para evitar problemas de cache entre testes
    const { OrdersService } = await import('../orders.service.js')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new OrdersService(fastify as any)

    const scheduledDate = makeFutureDateStr(2)
    const result = await service.createSingleOrder('user-01', {
      quantity: 2,
      scheduledDate,
    })

    // Verifica que o Order foi criado dentro da transaction
    expect(txOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'SINGLE',
          status: 'SCHEDULED',
          quantity: 2,
          userId: 'user-01',
        }),
      }),
    )

    // Verifica que a CreditTransaction foi criada com quantidade negativa
    expect(txCreditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'DELIVERY',
          quantity: -2,
          userId: 'user-01',
        }),
      }),
    )

    // Verifica resultado retornado
    expect(result).toMatchObject({
      id: 'order-01',
      quantity: 2,
    })
  })

  it('createSingleOrder lança erro 400 quando saldo insuficiente', async () => {
    // transaction lança o erro de negócio (simulando o throw interno)
    const businessError = { statusCode: 400, message: 'Créditos insuficientes' }
    const { fastify } = makeFastifyMock({ transactionError: businessError })

    const { OrdersService } = await import('../orders.service.js')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new OrdersService(fastify as any)

    const scheduledDate = makeFutureDateStr(2)

    await expect(
      service.createSingleOrder('user-01', { quantity: 5, scheduledDate }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'Créditos insuficientes' })
  })

  it('createSingleOrder rejeita scheduledDate no passado', async () => {
    const { fastify } = makeFastifyMock({ creditBalance: 10 })

    const { OrdersService } = await import('../orders.service.js')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new OrdersService(fastify as any)

    const pastDate = makePastDateStr(1)

    await expect(
      service.createSingleOrder('user-01', { quantity: 2, scheduledDate: pastDate }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'Data inválida' })
  })

  it('createSingleOrder grava deliveryTime do slot escolhido quando o corte está aberto', async () => {
    const { fastify, txOrder } = makeFastifyMock({
      creditBalance: 10,
      condominiumId: 'condo-01',
      // tarde: corte é no próprio dia da entrega (15:30 > 10:00) → data futura está sempre aberta
      deliverySlots: [{ name: 'tarde', time: '15:30', cutoffTime: '10:00', isActive: true }],
    })

    const { OrdersService } = await import('../orders.service.js')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new OrdersService(fastify as any)

    await service.createSingleOrder('user-01', {
      quantity: 2,
      scheduledDate: makeFutureDateStr(5),
      deliveryTime: '15:30',
    })

    expect(txOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'SINGLE', deliveryTime: '15:30' }),
      }),
    )
  })

  it('createSingleOrder aceita HOJE no slot da tarde quando o corte ainda não passou', async () => {
    // tarde 15:30 / corte 10:00: entrega hoje fecha às 10:00 BRT de hoje.
    // Só validamos a aceitação quando o corte ainda não passou (antes das 10:00 BRT).
    const cutoffPast = isPastCutoffTodayTarde()
    if (cutoffPast) return // após o corte, este caminho não se aplica (coberto pelo teste de rejeição)

    const { fastify, txOrder } = makeFastifyMock({
      creditBalance: 10,
      condominiumId: 'condo-01',
      deliverySlots: [{ name: 'tarde', time: '15:30', cutoffTime: '10:00', isActive: true }],
    })

    const { OrdersService } = await import('../orders.service.js')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new OrdersService(fastify as any)

    await service.createSingleOrder('user-01', {
      quantity: 1,
      scheduledDate: brtDateStr(new Date(), 0),
      deliveryTime: '15:30',
    })

    expect(txOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deliveryTime: '15:30' }) }),
    )
  })

  it('createSingleOrder rejeita HOJE no slot da manhã (corte da manhã é sempre na véspera)', async () => {
    const { fastify } = makeFastifyMock({
      creditBalance: 10,
      condominiumId: 'condo-01',
      deliverySlots: [{ name: 'manha', time: '06:30', cutoffTime: '22:00', isActive: true }],
    })

    const { OrdersService } = await import('../orders.service.js')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new OrdersService(fastify as any)

    await expect(
      service.createSingleOrder('user-01', {
        quantity: 1,
        scheduledDate: brtDateStr(new Date(), 0),
        deliveryTime: '06:30',
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'Prazo de pedido encerrado para este horário' })
  })

  it('createSingleOrder rejeita HOJE quando o condomínio não tem slots (piso permanece amanhã)', async () => {
    const { fastify } = makeFastifyMock({ creditBalance: 10, condominiumId: 'condo-01', deliverySlots: [] })

    const { OrdersService } = await import('../orders.service.js')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new OrdersService(fastify as any)

    await expect(
      service.createSingleOrder('user-01', { quantity: 1, scheduledDate: brtDateStr(new Date(), 0) }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'Data inválida' })
  })

  it('createSingleOrder rejeita deliveryTime que não corresponde a um slot ativo', async () => {
    const { fastify } = makeFastifyMock({
      creditBalance: 10,
      condominiumId: 'condo-01',
      deliverySlots: [{ name: 'tarde', time: '15:30', cutoffTime: '10:00', isActive: true }],
    })

    const { OrdersService } = await import('../orders.service.js')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new OrdersService(fastify as any)

    await expect(
      service.createSingleOrder('user-01', {
        quantity: 2,
        scheduledDate: makeFutureDateStr(5),
        deliveryTime: '09:00',
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'Horário de entrega indisponível' })
  })

  // ── Casos 05-03a,b,c: getTodayOrder ──────────────────────────────────────

  it('05-03a: getTodayOrder chama prisma.order.findFirst com scheduledDate.gte e lte como instâncias de Date', async () => {
    const { fastify, txOrder } = makeFastifyMock({ orderFindFirst: null })

    const { OrdersService } = await import('../orders.service.js')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new OrdersService(fastify as any)

    await service.getTodayOrder('userId-abc')

    expect(txOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'userId-abc',
          scheduledDate: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      }),
    )

    const call = txOrder.findFirst.mock.calls[0][0]
    expect(call.where.scheduledDate.gte).not.toBeUndefined()
    expect(call.where.scheduledDate.lte).not.toBeUndefined()
    expect(call.where.scheduledDate.gte).toBeInstanceOf(Date)
    expect(call.where.scheduledDate.lte).toBeInstanceOf(Date)
  })

  it('05-03b: getTodayOrder retorna o order encontrado sem transformação', async () => {
    const fakeOrder = { id: 'order-today', status: 'SCHEDULED', quantity: 3 }
    const { fastify } = makeFastifyMock({ orderFindFirst: fakeOrder })

    const { OrdersService } = await import('../orders.service.js')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new OrdersService(fastify as any)

    const result = await service.getTodayOrder('userId-abc')

    expect(result).toEqual(fakeOrder)
  })

  it('05-03c: getTodayOrder retorna null quando findFirst retorna null', async () => {
    const { fastify } = makeFastifyMock({ orderFindFirst: null })

    const { OrdersService } = await import('../orders.service.js')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new OrdersService(fastify as any)

    const result = await service.getTodayOrder('userId-abc')

    expect(result).toBeNull()
  })

  // ── Casos 05-08a,b: getOrderHistory ──────────────────────────────────────

  it('05-08a: getOrderHistory chama findMany com scheduledDate.gte aproximadamente 30 dias atrás', async () => {
    const { fastify, txOrder } = makeFastifyMock({ orderFindMany: [] })

    const { OrdersService } = await import('../orders.service.js')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new OrdersService(fastify as any)

    const before = Date.now()
    await service.getOrderHistory('userId-abc', 30)
    const after = Date.now()

    expect(txOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'userId-abc',
          scheduledDate: expect.objectContaining({
            gte: expect.any(Date),
          }),
        }),
      }),
    )

    const call = txOrder.findMany.mock.calls[0][0]
    const gte = call.where.scheduledDate.gte as Date
    const expectedMs = 30 * 24 * 60 * 60 * 1000
    const diffFromBefore = before - gte.getTime()
    const diffFromAfter = after - gte.getTime()

    // gte deve ser aproximadamente 30 dias atrás (±1s de tolerância)
    expect(diffFromBefore).toBeGreaterThanOrEqual(expectedMs - 1000)
    expect(diffFromAfter).toBeLessThanOrEqual(expectedMs + 1000)
  })

  it('05-08b: getOrderHistory usa 30 como default quando days não é passado', async () => {
    const { fastify, txOrder } = makeFastifyMock({ orderFindMany: [] })

    const { OrdersService } = await import('../orders.service.js')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new OrdersService(fastify as any)

    const before = Date.now()
    await service.getOrderHistory('userId-abc')
    const after = Date.now()

    const call = txOrder.findMany.mock.calls[0][0]
    const gte = call.where.scheduledDate.gte as Date
    const expectedMs = 30 * 24 * 60 * 60 * 1000
    const diffFromBefore = before - gte.getTime()
    const diffFromAfter = after - gte.getTime()

    expect(diffFromBefore).toBeGreaterThanOrEqual(expectedMs - 1000)
    expect(diffFromAfter).toBeLessThanOrEqual(expectedMs + 1000)
  })

  it('getNextOrder busca a próxima entrega futura (gt fim de hoje, status SCHEDULED/OUT_FOR_DELIVERY, asc)', async () => {
    const future = { id: 'order-next', quantity: 2, status: 'SCHEDULED', scheduledDate: new Date() }
    const { fastify, txOrder } = makeFastifyMock({ orderFindFirst: future })

    const { OrdersService } = await import('../orders.service.js')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new OrdersService(fastify as any)

    const result = await service.getNextOrder('user-01')

    expect(result).toEqual(future)
    const call = txOrder.findFirst.mock.calls[0][0]
    expect(call.where.status).toEqual({ in: ['SCHEDULED', 'OUT_FOR_DELIVERY'] })
    expect(call.where.scheduledDate.gt).toBeInstanceOf(Date)
    expect(call.orderBy).toEqual({ scheduledDate: 'asc' })
  })
})

// ── cancelSingleOrder ──────────────────────────────────────────────────────────
// Cancelamento de pedido único pelo cliente, com estorno idempotente e gate de corte.

const FUTURE_5D = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)

/** Mock dedicado ao cancelamento (findUnique de order/user, condominium, creditTransaction, $transaction). */
function makeCancelMock(opts: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order?: any
  condominiumId?: string
  deliverySlots?: { slotId?: string; name: string; time: string; cutoffTime: string; isActive: boolean }[]
  existingRefund?: unknown
  creditBalance?: number
} = {}) {
  const {
    order = {
      id: 'order-01',
      userId: 'user-01',
      type: 'SINGLE',
      status: 'SCHEDULED',
      quantity: 2,
      scheduledDate: FUTURE_5D,
      slotId: 'tarde',
      deliveryTime: '15:30',
    },
    condominiumId = 'condo-01',
    // tarde: corte no próprio dia da entrega (15:30 > 10:00) → data futura está sempre aberta
    deliverySlots = [{ slotId: 'tarde', name: 'tarde', time: '15:30', cutoffTime: '10:00', isActive: true }],
    existingRefund = null,
    creditBalance = 8,
  } = opts

  const orderUpdate = vi.fn().mockResolvedValue({})
  const ctCreate = vi.fn().mockResolvedValue({})
  const userUpdate = vi.fn().mockResolvedValue({})

  const prisma = {
    order: { findUnique: vi.fn().mockResolvedValue(order), update: orderUpdate },
    user: {
      findUnique: vi.fn().mockResolvedValue({ condominiumId, creditBalance }),
      update: userUpdate,
    },
    condominium: { findUnique: vi.fn().mockResolvedValue({ deliverySlots }) },
    creditTransaction: { findFirst: vi.fn().mockResolvedValue(existingRefund), create: ctCreate },
    $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        order: { update: orderUpdate },
        creditTransaction: { create: ctCreate },
        user: { update: userUpdate },
      }),
    ),
  }

  return {
    fastify: { prisma, log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } } as unknown,
    orderUpdate,
    ctCreate,
    userUpdate,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function makeService(fastify: unknown): Promise<any> {
  const { OrdersService } = await import('../orders.service.js')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new OrdersService(fastify as any)
}

describe('OrdersService.cancelSingleOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('cancela pedido único aberto: marca CANCELLED + estorna a quantidade ao saldo', async () => {
    const { fastify, orderUpdate, ctCreate, userUpdate } = makeCancelMock({ creditBalance: 8 })
    const service = await makeService(fastify)

    const result = await service.cancelSingleOrder('user-01', 'order-01')

    expect(orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-01' },
        data: expect.objectContaining({ status: 'CANCELLED', cancelReason: 'Cancelado pelo cliente' }),
      }),
    )
    expect(ctCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'REFUND', quantity: 2, referenceId: 'order-01', userId: 'user-01' }),
      }),
    )
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { creditBalance: { increment: 2 } } }),
    )
    expect(result).toMatchObject({ id: 'order-01', status: 'CANCELLED', refundedCredits: 2, creditBalance: 8 })
  })

  it('é idempotente: com estorno já existente, não credita de novo (refundedCredits 0)', async () => {
    const { fastify, orderUpdate, ctCreate, userUpdate } = makeCancelMock({
      existingRefund: { id: 'ct-existing', type: 'REFUND', referenceId: 'order-01' },
    })
    const service = await makeService(fastify)

    const result = await service.cancelSingleOrder('user-01', 'order-01')

    expect(orderUpdate).toHaveBeenCalled() // status ainda é reafirmado
    expect(ctCreate).not.toHaveBeenCalled()
    expect(userUpdate).not.toHaveBeenCalled()
    expect(result).toMatchObject({ refundedCredits: 0 })
  })

  it('404 quando o pedido não existe', async () => {
    const { fastify } = makeCancelMock({ order: null })
    const service = await makeService(fastify)

    await expect(service.cancelSingleOrder('user-01', 'nope')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('404 quando o pedido é de outro usuário (não vaza pedido alheio)', async () => {
    const { fastify } = makeCancelMock({ order: { id: 'order-01', userId: 'outro', type: 'SINGLE', status: 'SCHEDULED', quantity: 2, scheduledDate: FUTURE_5D } })
    const service = await makeService(fastify)

    await expect(service.cancelSingleOrder('user-01', 'order-01')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('422 quando o pedido não é do tipo SINGLE', async () => {
    const { fastify } = makeCancelMock({ order: { id: 'order-01', userId: 'user-01', type: 'SCHEDULED', status: 'SCHEDULED', quantity: 2, scheduledDate: FUTURE_5D } })
    const service = await makeService(fastify)

    await expect(service.cancelSingleOrder('user-01', 'order-01')).rejects.toMatchObject({ statusCode: 422 })
  })

  it('422 quando o pedido não está mais SCHEDULED (já separado/entregue)', async () => {
    const { fastify } = makeCancelMock({ order: { id: 'order-01', userId: 'user-01', type: 'SINGLE', status: 'SEPARATED', quantity: 2, scheduledDate: FUTURE_5D } })
    const service = await makeService(fastify)

    await expect(service.cancelSingleOrder('user-01', 'order-01')).rejects.toMatchObject({ statusCode: 422 })
  })

  it('422 CUTOFF_PASSED quando o corte do pedido já passou', async () => {
    // manhã 06:30 / corte 22:00 → corte é na véspera; para entrega HOJE o corte (ontem 22:00) já passou.
    const { fastify, orderUpdate } = makeCancelMock({
      order: {
        id: 'order-01',
        userId: 'user-01',
        type: 'SINGLE',
        status: 'SCHEDULED',
        quantity: 2,
        scheduledDate: new Date(),
        slotId: 'manha',
        deliveryTime: '06:30',
      },
      deliverySlots: [{ slotId: 'manha', name: 'manha', time: '06:30', cutoffTime: '22:00', isActive: true }],
    })
    const service = await makeService(fastify)

    await expect(service.cancelSingleOrder('user-01', 'order-01')).rejects.toMatchObject({
      statusCode: 422,
      code: 'CUTOFF_PASSED',
    })
    expect(orderUpdate).not.toHaveBeenCalled()
  })
})
