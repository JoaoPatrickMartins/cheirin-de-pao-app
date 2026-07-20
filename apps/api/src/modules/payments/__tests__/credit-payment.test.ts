// creditForPayment unit tests — ponto único de fulfillment (foco no ramo HOOK).
import { describe, it, expect, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { creditForPayment, type CreditablePayment } from '../credit-payment.js'

function makeFastify(opts: { hook?: { id: string; status: string } | null } = {}) {
  const { hook = null } = opts
  const hookUpdate = vi.fn().mockResolvedValue({})
  const paymentUpdate = vi.fn().mockResolvedValue({})
  const creditTxCreate = vi.fn().mockResolvedValue({})
  const prisma = {
    hookRequest: {
      findFirst: vi.fn().mockResolvedValue(hook),
      update: hookUpdate,
    },
    payment: { update: paymentUpdate },
    user: {
      findUnique: vi.fn().mockResolvedValue({ name: 'Ana', apartment: '10', block: null }),
      findMany: vi.fn().mockResolvedValue([]), // notifyAdmins
      update: vi.fn().mockResolvedValue({}),
    },
    creditTransaction: { create: creditTxCreate },
    combo: { findUnique: vi.fn().mockResolvedValue({ quantity: 10 }) },
    $transaction: vi.fn().mockImplementation((ops: unknown) => (Array.isArray(ops) ? Promise.all(ops) : ops)),
    notification: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
  }
  return {
    fastify: { prisma, log: { warn: vi.fn(), error: vi.fn() } } as unknown as FastifyInstance,
    hookUpdate,
    paymentUpdate,
    creditTxCreate,
  }
}

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
