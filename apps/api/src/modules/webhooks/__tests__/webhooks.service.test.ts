// Webhooks service unit tests — migração para Stripe (processEvent)
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type Stripe from 'stripe'

// StripeService só é usado para constructEvent (não exercitado aqui) — mock leve
vi.mock('../../payments/stripe.service.js', () => {
  class MockStripeService {
    constructor(_fastify: unknown) {}
    constructWebhookEvent = vi.fn()
  }
  return { StripeService: MockStripeService }
})

import { WebhooksService } from '../webhooks.service.js'
type Mock = ReturnType<typeof vi.fn>

function createMockFastify(): FastifyInstance {
  return {
    prisma: {
      payment: { findUnique: vi.fn(), update: vi.fn() },
      user: { update: vi.fn() },
      creditTransaction: { create: vi.fn() },
      combo: { findUnique: vi.fn() },
      $transaction: vi.fn(),
    },
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  } as unknown as FastifyInstance
}

const evt = (type: string, object: unknown) => ({ type, data: { object } }) as unknown as Stripe.Event

describe('WebhooksService (Stripe).processEvent', () => {
  beforeEach(() => vi.clearAllMocks())

  it('payment_intent.succeeded → credita e marca PAID (combo)', async () => {
    const fastify = createMockFastify()
    ;(fastify.prisma.payment.findUnique as Mock).mockResolvedValueOnce({
      id: 'pay-1', userId: 'user-1', status: 'PENDING', comboId: 'combo-1', customQuantity: null,
    })
    ;(fastify.prisma.combo.findUnique as Mock).mockResolvedValueOnce({ id: 'combo-1', quantity: 30 })
    ;(fastify.prisma.$transaction as Mock).mockResolvedValueOnce([{}, {}])
    ;(fastify.prisma.payment.update as Mock).mockResolvedValueOnce({})

    const service = new WebhooksService(fastify)
    await service.processEvent(evt('payment_intent.succeeded', { id: 'pi_1' }))

    expect(fastify.prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(fastify.prisma.payment.update).toHaveBeenCalledWith({ where: { id: 'pay-1' }, data: { status: 'PAID' } })
  })

  it('payment_intent.succeeded → idempotente: não credita se já PAID', async () => {
    const fastify = createMockFastify()
    ;(fastify.prisma.payment.findUnique as Mock).mockResolvedValueOnce({ id: 'pay-1', status: 'PAID' })

    const service = new WebhooksService(fastify)
    await service.processEvent(evt('payment_intent.succeeded', { id: 'pi_1' }))

    expect(fastify.prisma.$transaction).not.toHaveBeenCalled()
    expect(fastify.prisma.payment.update).not.toHaveBeenCalled()
  })

  it('payment_intent.succeeded → no-op se pagamento não existe', async () => {
    const fastify = createMockFastify()
    ;(fastify.prisma.payment.findUnique as Mock).mockResolvedValueOnce(null)

    const service = new WebhooksService(fastify)
    await service.processEvent(evt('payment_intent.succeeded', { id: 'pi_x' }))

    expect(fastify.prisma.$transaction).not.toHaveBeenCalled()
  })

  it('payment_intent.payment_failed → marca FAILED quando PENDING', async () => {
    const fastify = createMockFastify()
    ;(fastify.prisma.payment.findUnique as Mock).mockResolvedValueOnce({ id: 'pay-2', status: 'PENDING' })
    ;(fastify.prisma.payment.update as Mock).mockResolvedValueOnce({})

    const service = new WebhooksService(fastify)
    await service.processEvent(evt('payment_intent.payment_failed', { id: 'pi_2' }))

    expect(fastify.prisma.payment.update).toHaveBeenCalledWith({ where: { id: 'pay-2' }, data: { status: 'FAILED' } })
  })

  it('charge.refunded → marca REFUNDED', async () => {
    const fastify = createMockFastify()
    ;(fastify.prisma.payment.findUnique as Mock).mockResolvedValueOnce({ id: 'pay-3', status: 'PAID' })
    ;(fastify.prisma.payment.update as Mock).mockResolvedValueOnce({})

    const service = new WebhooksService(fastify)
    await service.processEvent(evt('charge.refunded', { payment_intent: 'pi_3' }))

    expect(fastify.prisma.payment.update).toHaveBeenCalledWith({ where: { id: 'pay-3' }, data: { status: 'REFUNDED' } })
  })

  it('evento desconhecido → ignorado', async () => {
    const fastify = createMockFastify()
    const service = new WebhooksService(fastify)
    await service.processEvent(evt('invoice.paid', {}))
    expect(fastify.prisma.payment.findUnique).not.toHaveBeenCalled()
  })
})
