// Webhooks service unit tests — PAY-01 (HMAC) + fluxo crítico de crédito (T-03-01)
// Garante que SÓ pagamento aprovado no Mercado Pago credita o cliente.
import { createHmac } from 'node:crypto'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

// Mock do SDK do Mercado Pago — paymentApi.get devolve o status "real" do MP.
const mockPaymentGet = vi.fn()
vi.mock('mercadopago', () => {
  class MockMercadoPagoConfig {
    constructor(_opts: unknown) {}
  }
  class MockPayment {
    constructor(_client: unknown) {}
    get = mockPaymentGet
  }
  return { MercadoPagoConfig: MockMercadoPagoConfig, Payment: MockPayment }
})

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

  describe('reconcilePayment — credita SOMENTE se aprovado no MP [T-03-01]', () => {
    it('APROVADO (customQuantity): credita a quantidade e marca PAID', async () => {
      vi.mocked(fastify.prisma.payment.findUnique).mockResolvedValue({
        id: 'pay-1', status: 'PENDING', userId: 'u-1', customQuantity: 5, comboId: null,
      } as never)
      mockPaymentGet.mockResolvedValue({ status: 'approved' })

      await service.reconcilePayment('mp-1')

      expect(fastify.prisma.creditTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'u-1', quantity: 5, type: 'PURCHASE' }) }),
      )
      expect(fastify.prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u-1' }, data: { creditBalance: { increment: 5 } },
      })
      expect(fastify.prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' }, data: { status: 'PAID' },
      })
    })

    it('APROVADO (combo): credita a quantidade do combo', async () => {
      vi.mocked(fastify.prisma.payment.findUnique).mockResolvedValue({
        id: 'pay-c', status: 'PENDING', userId: 'u-c', customQuantity: null, comboId: 'combo-1',
      } as never)
      vi.mocked(fastify.prisma.combo.findUnique).mockResolvedValue({ id: 'combo-1', quantity: 30 } as never)
      mockPaymentGet.mockResolvedValue({ status: 'approved' })

      await service.reconcilePayment('mp-c')

      expect(fastify.prisma.creditTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'u-c', quantity: 30 }) }),
      )
      expect(fastify.prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-c' }, data: { status: 'PAID' },
      })
    })

    it('REJEITADO: NAO credita e marca FAILED', async () => {
      vi.mocked(fastify.prisma.payment.findUnique).mockResolvedValue({
        id: 'pay-r', status: 'PENDING', userId: 'u-r', customQuantity: 5, comboId: null,
      } as never)
      mockPaymentGet.mockResolvedValue({ status: 'rejected' })

      await service.reconcilePayment('mp-r')

      expect(fastify.prisma.$transaction).not.toHaveBeenCalled()
      expect(fastify.prisma.creditTransaction.create).not.toHaveBeenCalled()
      expect(fastify.prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-r' }, data: { status: 'FAILED' },
      })
    })

    it('CANCELADO: NAO credita e marca FAILED', async () => {
      vi.mocked(fastify.prisma.payment.findUnique).mockResolvedValue({
        id: 'pay-x', status: 'PENDING', userId: 'u-x', customQuantity: 5, comboId: null,
      } as never)
      mockPaymentGet.mockResolvedValue({ status: 'cancelled' })

      await service.reconcilePayment('mp-x')

      expect(fastify.prisma.$transaction).not.toHaveBeenCalled()
      expect(fastify.prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-x' }, data: { status: 'FAILED' },
      })
    })

    it('PENDENTE (in_process): NAO credita e NAO altera o status local', async () => {
      vi.mocked(fastify.prisma.payment.findUnique).mockResolvedValue({
        id: 'pay-p', status: 'PENDING', userId: 'u-p', customQuantity: 5, comboId: null,
      } as never)
      mockPaymentGet.mockResolvedValue({ status: 'in_process' })

      await service.reconcilePayment('mp-p')

      expect(fastify.prisma.$transaction).not.toHaveBeenCalled()
      expect(fastify.prisma.payment.update).not.toHaveBeenCalled()
    })

    it('idempotencia: pagamento ja PAID nao consulta o MP nem credita de novo', async () => {
      vi.mocked(fastify.prisma.payment.findUnique).mockResolvedValue({
        id: 'pay-d', status: 'PAID', userId: 'u-d', customQuantity: 5, comboId: null,
      } as never)

      await service.reconcilePayment('mp-d')

      expect(mockPaymentGet).not.toHaveBeenCalled()
      expect(fastify.prisma.$transaction).not.toHaveBeenCalled()
      expect(fastify.prisma.payment.update).not.toHaveBeenCalled()
    })

    it('pagamento inexistente: no-op (nem consulta o MP)', async () => {
      vi.mocked(fastify.prisma.payment.findUnique).mockResolvedValue(null as never)

      await service.reconcilePayment('mp-none')

      expect(mockPaymentGet).not.toHaveBeenCalled()
      expect(fastify.prisma.$transaction).not.toHaveBeenCalled()
    })

    it('aprovado mas combo inexistente (sem quantidade): NAO credita', async () => {
      vi.mocked(fastify.prisma.payment.findUnique).mockResolvedValue({
        id: 'pay-nq', status: 'PENDING', userId: 'u-nq', customQuantity: null, comboId: 'combo-ghost',
      } as never)
      vi.mocked(fastify.prisma.combo.findUnique).mockResolvedValue(null as never)
      mockPaymentGet.mockResolvedValue({ status: 'approved' })

      await service.reconcilePayment('mp-nq')

      expect(fastify.prisma.$transaction).not.toHaveBeenCalled()
      expect(fastify.prisma.payment.update).not.toHaveBeenCalled()
    })
  })

  describe('processPayment — roteamento por action', () => {
    it('payment.updated dispara a reconciliacao', async () => {
      vi.mocked(fastify.prisma.payment.findUnique).mockResolvedValue(null as never)
      await service.processPayment({ action: 'payment.updated', data: { id: 'mp-1' } })
      expect(fastify.prisma.payment.findUnique).toHaveBeenCalledWith({ where: { mercadoPagoId: 'mp-1' } })
    })

    it('payment.created dispara a reconciliacao (cartao aprovado na hora)', async () => {
      vi.mocked(fastify.prisma.payment.findUnique).mockResolvedValue(null as never)
      await service.processPayment({ action: 'payment.created', data: { id: 'mp-2' } })
      expect(fastify.prisma.payment.findUnique).toHaveBeenCalled()
    })

    it('action que nao e de pagamento e ignorada', async () => {
      await service.processPayment({ action: 'merchant_order.updated', data: { id: 'mo-1' } })
      expect(fastify.prisma.payment.findUnique).not.toHaveBeenCalled()
    })

    it('data.id ausente e ignorado', async () => {
      await service.processPayment({ action: 'payment.updated', data: { id: '' } })
      expect(fastify.prisma.payment.findUnique).not.toHaveBeenCalled()
    })
  })
})
