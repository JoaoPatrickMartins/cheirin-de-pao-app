// Webhooks service unit tests — PAY-01 (HMAC, idempotency — T-03-01)
import { createHmac } from 'node:crypto'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { WebhooksService } from '../webhooks.service.js'

const TEST_SECRET = 'test-webhook-secret'

function buildValidSignature(dataId: string, xRequestId: string) {
  const ts = '1234567890'
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const v1 = createHmac('sha256', TEST_SECRET).update(manifest).digest('hex')
  return `ts=${ts},v1=${v1}`
}

function createMockFastify(overrides: Record<string, unknown> = {}): FastifyInstance {
  return {
    prisma: {
      payment: { findUnique: vi.fn(), update: vi.fn() },
      user: { update: vi.fn() },
      creditTransaction: { create: vi.fn() },
      combo: { findUnique: vi.fn() },
      $transaction: vi.fn().mockResolvedValue([{}, {}]),
      ...overrides,
    },
  } as unknown as FastifyInstance
}

describe('WebhooksService [PAY-01, T-03-01]', () => {
  let fastify: FastifyInstance
  let service: WebhooksService

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.MP_WEBHOOK_SECRET = TEST_SECRET
    fastify = createMockFastify()
    service = new WebhooksService(fastify)
  })

  describe('validateSignature [PAY-01 HMAC]', () => {
    it('assinatura invalida retorna false sem processar o evento', () => {
      expect(service.validateSignature('ts=123,v1=invalidsig', 'req-1', 'data-1')).toBe(false)
    })

    it('assinatura valida retorna true e permite processamento', () => {
      const sig = buildValidSignature('data-1', 'req-1')
      expect(service.validateSignature(sig, 'req-1', 'data-1')).toBe(true)
    })

    it('ausencia do header x-signature retorna false', () => {
      expect(service.validateSignature('', 'req-1', 'data-1')).toBe(false)
    })
  })

  describe('processPaymentApproved [T-03-01 idempotencia]', () => {
    it('webhook duplicado nao credita duas vezes (idempotencia via mercadoPagoId)', async () => {
      const payment = { id: 'pay-1', status: 'PAID', userId: 'u-1', customQuantity: 5, comboId: null }
      vi.mocked(fastify.prisma.payment.findUnique).mockResolvedValue(payment as never)

      await service.processApprovedPayment('mp-dup')

      expect(fastify.prisma.$transaction).not.toHaveBeenCalled()
    })

    it('primeiro webhook aprovado credita creditBalance via $transaction atomico', async () => {
      const payment = { id: 'pay-2', status: 'PENDING', userId: 'u-2', customQuantity: 3, comboId: null }
      vi.mocked(fastify.prisma.payment.findUnique).mockResolvedValue(payment as never)

      await service.processApprovedPayment('mp-new')

      expect(fastify.prisma.$transaction).toHaveBeenCalled()
    })

    it('webhook com status diferente de approved nao altera creditBalance', async () => {
      await service.processPayment({ action: 'payment.created', data: { id: 'mp-1' } })
      expect(fastify.prisma.payment.findUnique).not.toHaveBeenCalled()
    })
  })
})
