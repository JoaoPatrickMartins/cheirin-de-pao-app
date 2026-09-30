// creditForPayment unit tests — ponto único de fulfillment (ramos HOOK e CREDITS).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

vi.mock('../notify-credit-purchase.js', () => ({ notifyAdminsCreditPurchase: vi.fn() }))

import { creditForPayment, type CreditablePayment } from '../credit-payment.js'
import { notifyAdminsCreditPurchase } from '../notify-credit-purchase.js'

function makeFastify(opts: { hook?: { id: string; status: string } | null; paymentStatus?: string } = {}) {
  const { hook = null } = opts
  // Status "no banco" do pagamento — a trava de claimAndCreditPurchase lê este, não o objeto
  // que o chamador carregou antes.
  let paymentStatus = opts.paymentStatus ?? 'PENDING'
  const hookUpdate = vi.fn().mockResolvedValue({})
  const paymentUpdate = vi.fn().mockResolvedValue({})
  const paymentUpdateMany = vi.fn().mockImplementation(
    ({ where, data }: { where: { status: { in: string[] } }; data: { status: string } }) => {
      if (!where.status.in.includes(paymentStatus)) return Promise.resolve({ count: 0 })
      paymentStatus = data.status
      return Promise.resolve({ count: 1 })
    },
  )
  const creditTxCreate = vi.fn().mockResolvedValue({})
  const userUpdate = vi.fn().mockResolvedValue({})
  const prisma: Record<string, unknown> = {
    hookRequest: {
      findFirst: vi.fn().mockResolvedValue(hook),
      update: hookUpdate,
    },
    payment: { update: paymentUpdate, updateMany: paymentUpdateMany },
    user: {
      findUnique: vi.fn().mockResolvedValue({ name: 'Ana', apartment: '10', block: null }),
      findMany: vi.fn().mockResolvedValue([]), // notifyAdmins
      update: userUpdate,
    },
    creditTransaction: { create: creditTxCreate },
    combo: { findUnique: vi.fn().mockResolvedValue({ quantity: 10 }) },
    notification: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
  }
  // Transação interativa: o callback recebe o próprio mock como `tx`.
  const transaction = vi.fn().mockImplementation((arg: unknown) =>
    typeof arg === 'function' ? arg(prisma) : Array.isArray(arg) ? Promise.all(arg) : arg,
  )
  prisma.$transaction = transaction
  return {
    fastify: { prisma, log: { warn: vi.fn(), error: vi.fn() } } as unknown as FastifyInstance,
    hookUpdate,
    paymentUpdate,
    paymentUpdateMany,
    creditTxCreate,
    userUpdate,
    transaction,
  }
}

beforeEach(() => vi.clearAllMocks())

const hookPayment: CreditablePayment = {
  id: 'p1',
  userId: 'u1',
  amount: 5,
  status: 'PENDING',
  comboId: null,
  customQuantity: null,
  purpose: 'HOOK',
}

describe('creditForPayment — ramo HOOK', () => {
  it('promove o HookRequest PENDING_PAYMENT→REQUESTED e marca o pagamento PAID (sem creditar pães)', async () => {
    const { fastify, hookUpdate, paymentUpdate, creditTxCreate } = makeFastify({
      hook: { id: 'h1', status: 'PENDING_PAYMENT' },
    })
    await creditForPayment(fastify, hookPayment)
    expect(hookUpdate).toHaveBeenCalledOnce()
    expect(hookUpdate.mock.calls[0][0].data.status).toBe('REQUESTED')
    expect(paymentUpdate).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { status: 'PAID' } })
    expect(creditTxCreate).not.toHaveBeenCalled() // não credita pães
  })

  it('idempotente: pagamento já PAID não faz nada', async () => {
    const { fastify, hookUpdate, paymentUpdate } = makeFastify({ hook: { id: 'h1', status: 'PENDING_PAYMENT' } })
    await creditForPayment(fastify, { ...hookPayment, status: 'PAID' })
    expect(hookUpdate).not.toHaveBeenCalled()
    expect(paymentUpdate).not.toHaveBeenCalled()
  })

  it('se o HookRequest já está REQUESTED, apenas garante o pagamento PAID (não re-promove)', async () => {
    const { fastify, hookUpdate, paymentUpdate } = makeFastify({ hook: { id: 'h1', status: 'REQUESTED' } })
    await creditForPayment(fastify, hookPayment)
    expect(hookUpdate).not.toHaveBeenCalled()
    expect(paymentUpdate).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { status: 'PAID' } })
  })
})

const creditsPayment: CreditablePayment = {
  id: 'p2',
  userId: 'u1',
  amount: 24.9,
  status: 'PENDING',
  comboId: 'c1',
  customQuantity: null,
  purpose: null,
}

describe('creditForPayment — ramo CREDITS (compra de pães)', () => {
  it('marca PAID e credita na MESMA transação, uma vez, e avisa o admin', async () => {
    const { fastify, paymentUpdateMany, creditTxCreate, userUpdate } = makeFastify()
    await creditForPayment(fastify, creditsPayment)

    expect(paymentUpdateMany).toHaveBeenCalledWith({
      where: { id: 'p2', status: { in: ['PENDING', 'FAILED'] } },
      data: { status: 'PAID' },
    })
    expect(creditTxCreate).toHaveBeenCalledOnce()
    expect(creditTxCreate.mock.calls[0][0].data).toMatchObject({
      type: 'PURCHASE',
      quantityMilli: 10_000,
      referenceId: 'p2',
    })
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { creditMilli: { increment: 10_000 } },
    })
    expect(notifyAdminsCreditPurchase).toHaveBeenCalledOnce()
  })

  it('corrida perdida: outro caminho já marcou PAID — não credita nem avisa', async () => {
    // O objeto do chamador foi lido antes e ainda diz PENDING; no banco já está PAID.
    const { fastify, creditTxCreate, userUpdate } = makeFastify({ paymentStatus: 'PAID' })
    await creditForPayment(fastify, creditsPayment)

    expect(creditTxCreate).not.toHaveBeenCalled()
    expect(userUpdate).not.toHaveBeenCalled()
    expect(notifyAdminsCreditPurchase).not.toHaveBeenCalled()
  })

  it('webhook e pull chegando juntos com o mesmo objeto PENDING creditam uma vez só', async () => {
    const { fastify, creditTxCreate, userUpdate } = makeFastify()
    await Promise.all([
      creditForPayment(fastify, { ...creditsPayment }),
      creditForPayment(fastify, { ...creditsPayment }),
    ])

    expect(creditTxCreate).toHaveBeenCalledOnce()
    expect(userUpdate).toHaveBeenCalledOnce()
    expect(notifyAdminsCreditPurchase).toHaveBeenCalledOnce()
  })

  it('não reabre pagamento estornado: REFUNDED fica fora da trava', async () => {
    const { fastify, creditTxCreate } = makeFastify({ paymentStatus: 'REFUNDED' })
    await creditForPayment(fastify, { ...creditsPayment, status: 'REFUNDED' })
    expect(creditTxCreate).not.toHaveBeenCalled()
  })

  it('pagamento FAILED que depois aprova (cliente refez com outro cartão) credita', async () => {
    const { fastify, creditTxCreate } = makeFastify({ paymentStatus: 'FAILED' })
    await creditForPayment(fastify, { ...creditsPayment, status: 'FAILED' })
    expect(creditTxCreate).toHaveBeenCalledOnce()
  })

  it('conflito de escrita (P2034): repete a transação e, na volta, sai sem creditar', async () => {
    const { fastify, transaction, creditTxCreate } = makeFastify({ paymentStatus: 'PAID' })
    transaction.mockRejectedValueOnce({ code: 'P2034' })

    await expect(creditForPayment(fastify, creditsPayment)).resolves.toBeUndefined()
    expect(transaction).toHaveBeenCalledTimes(2)
    expect(creditTxCreate).not.toHaveBeenCalled()
  })

  it('erro que não é conflito de escrita não é engolido', async () => {
    const { fastify, transaction } = makeFastify()
    transaction.mockRejectedValueOnce({ code: 'P2025' })

    await expect(creditForPayment(fastify, creditsPayment)).rejects.toMatchObject({ code: 'P2025' })
    expect(transaction).toHaveBeenCalledOnce()
  })
})
