// OrdersService unit tests — Fase 4 / Plano 04-03
// Requirements: SCHED-01 (pedido avulso com reserva atômica de créditos)
import { describe, it, expect, vi, beforeEach } from 'vitest'

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
} = {}) {
  const { creditBalance = 10, transactionError } = overrides

  const user = { id: 'user-01', creditBalance }

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

  return {
    fastify: {
      prisma: { $transaction: transaction, user: txUser },
      log: { error: vi.fn() },
    } as unknown,
    txUser,
    txOrder,
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
})
