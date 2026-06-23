// Payments service unit tests — migração para Stripe (Pix + getStatus)
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

// ─── Mock StripeService ───────────────────────────────────────────────────────
const mockGetOrCreateCustomer = vi.fn()
const mockCreatePixPayment = vi.fn()
const mockChargeOffSession = vi.fn()
const mockCreateCardIntent = vi.fn()

vi.mock('../stripe.service.js', () => {
  class MockStripeService {
    constructor(_fastify: unknown) {}
    getOrCreateCustomer = mockGetOrCreateCustomer
    createPixPayment = mockCreatePixPayment
    chargeOffSession = mockChargeOffSession
    createCardIntent = mockCreateCardIntent
  }
  return { StripeService: MockStripeService }
})

import { PaymentsService } from '../payments.service.js'
type Mock = ReturnType<typeof vi.fn>

function createMockFastify(): FastifyInstance {
  return {
    prisma: {
      payment: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
      user: { findUnique: vi.fn(), update: vi.fn() },
      creditTransaction: { create: vi.fn() },
      combo: { findUnique: vi.fn() },
      promotion: { findFirst: vi.fn().mockResolvedValue(null) },
      setting: { findUnique: vi.fn() },
      savedCard: { findUnique: vi.fn() },
      $transaction: vi.fn(),
    },
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  } as unknown as FastifyInstance
}

describe('PaymentsService (Stripe)', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('createPix', () => {
    it('cria PaymentIntent Pix, persiste PENDING e retorna copia-e-cola', async () => {
      const fastify = createMockFastify()
      ;(fastify.prisma.combo.findUnique as Mock).mockResolvedValueOnce({ id: 'combo-1', name: 'Combo', quantity: 30, price: 24.9 })
      mockGetOrCreateCustomer.mockResolvedValueOnce('cus_1')
      mockCreatePixPayment.mockResolvedValueOnce({
        paymentIntent: { id: 'pi_1' }, qrCode: 'COPIA_E_COLA', qrCodeImageUrl: 'https://qr.png', expiresAt: 123,
      })
      ;(fastify.prisma.payment.create as Mock).mockResolvedValueOnce({ id: 'payment-1', status: 'PENDING' })

      const service = new PaymentsService(fastify)
      const result = await service.createPix({ comboId: 'combo-1', userId: 'user-1' })

      expect(fastify.prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING', method: 'PIX', stripePaymentIntentId: 'pi_1' }) }),
      )
      expect(result.paymentId).toBe('payment-1')
      expect(result.pixCopyPaste).toBe('COPIA_E_COLA')
    })

    it('cobra o preço com desconto quando o combo está em promoção ativa', async () => {
      const fastify = createMockFastify()
      ;(fastify.prisma.combo.findUnique as Mock).mockResolvedValueOnce({ id: 'combo-1', name: 'Combo Novo', quantity: 100, price: 99.9 })
      ;(fastify.prisma.promotion.findFirst as Mock).mockResolvedValueOnce({ comboId: 'combo-1', discountType: 'PERCENT', discountValue: 15, isActive: true })
      mockGetOrCreateCustomer.mockResolvedValueOnce('cus_1')
      mockCreatePixPayment.mockResolvedValueOnce({
        paymentIntent: { id: 'pi_1' }, qrCode: 'X', qrCodeImageUrl: 'https://qr.png', expiresAt: 123,
      })
      ;(fastify.prisma.payment.create as Mock).mockResolvedValueOnce({ id: 'payment-1', status: 'PENDING' })

      const service = new PaymentsService(fastify)
      await service.createPix({ comboId: 'combo-1', userId: 'user-1' })

      // 99,90 - 15% = 84,92
      expect(mockCreatePixPayment).toHaveBeenCalledWith(expect.objectContaining({ amount: 84.92 }))
      expect(fastify.prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amount: 84.92 }) }),
      )
    })
  })

  describe('createCard (cartão salvo, off_session, sem CVV)', () => {
    it('lança 404 se o cartão salvo é de outro usuário (IDOR)', async () => {
      const fastify = createMockFastify()
      ;(fastify.prisma.combo.findUnique as Mock).mockResolvedValueOnce({ id: 'combo-1', name: 'Combo', quantity: 30, price: 24.9 })
      mockGetOrCreateCustomer.mockResolvedValueOnce('cus_1')
      ;(fastify.prisma.savedCard.findUnique as Mock).mockResolvedValueOnce({ id: 'card-1', userId: 'outro', stripePaymentMethodId: 'pm_1' })

      const service = new PaymentsService(fastify)
      await expect(service.createCard({ savedCardId: 'card-1', comboId: 'combo-1', userId: 'user-1' })).rejects.toMatchObject({ status: 404 })
      expect(mockChargeOffSession).not.toHaveBeenCalled()
    })

    it('cobra off_session e credita sincronamente quando succeeded', async () => {
      const fastify = createMockFastify()
      ;(fastify.prisma.combo.findUnique as Mock).mockResolvedValueOnce({ id: 'combo-1', name: 'Combo', quantity: 30, price: 24.9 })
      mockGetOrCreateCustomer.mockResolvedValueOnce('cus_1')
      ;(fastify.prisma.savedCard.findUnique as Mock).mockResolvedValueOnce({ id: 'card-1', userId: 'user-1', stripePaymentMethodId: 'pm_1' })
      mockChargeOffSession.mockResolvedValueOnce({ id: 'pi_2', status: 'succeeded' })
      ;(fastify.prisma.payment.create as Mock).mockResolvedValueOnce({ id: 'payment-2' })
      ;(fastify.prisma.$transaction as Mock).mockResolvedValueOnce([{}, {}])
      ;(fastify.prisma.payment.update as Mock).mockResolvedValueOnce({})

      const service = new PaymentsService(fastify)
      const result = await service.createCard({ savedCardId: 'card-1', comboId: 'combo-1', userId: 'user-1' })

      expect(mockChargeOffSession).toHaveBeenCalledWith(expect.objectContaining({ paymentMethodId: 'pm_1', customerId: 'cus_1' }))
      expect(result.status).toBe('approved')
      expect(fastify.prisma.payment.update).toHaveBeenCalledWith({ where: { id: 'payment-2' }, data: { status: 'PAID' } })
    })
  })

  describe('createCard (cartão novo)', () => {
    it('cria PaymentIntent e devolve clientSecret para confirmar no front', async () => {
      const fastify = createMockFastify()
      ;(fastify.prisma.combo.findUnique as Mock).mockResolvedValueOnce({ id: 'combo-1', name: 'Combo', quantity: 30, price: 24.9 })
      mockGetOrCreateCustomer.mockResolvedValueOnce('cus_1')
      mockCreateCardIntent.mockResolvedValueOnce({ id: 'pi_3', client_secret: 'pi_3_secret' })
      ;(fastify.prisma.payment.create as Mock).mockResolvedValueOnce({ id: 'payment-3' })

      const service = new PaymentsService(fastify)
      const result = await service.createCard({ comboId: 'combo-1', saveCard: true, userId: 'user-1' })

      expect(result.clientSecret).toBe('pi_3_secret')
      expect(result.status).toBe('pending')
    })
  })

  describe('getStatus', () => {
    it('pending quando não aprovado', async () => {
      const fastify = createMockFastify()
      ;(fastify.prisma.payment.findUnique as Mock).mockResolvedValueOnce({ id: 'pay-1', userId: 'user-1', status: 'PENDING' })
      const service = new PaymentsService(fastify)
      const result = await service.getStatus('pay-1', 'user-1')
      expect(result.status).toBe('pending')
    })

    it('approved + creditBalance quando PAID', async () => {
      const fastify = createMockFastify()
      ;(fastify.prisma.payment.findUnique as Mock).mockResolvedValueOnce({ id: 'pay-2', userId: 'user-2', status: 'PAID' })
      ;(fastify.prisma.user.findUnique as Mock).mockResolvedValueOnce({ id: 'user-2', creditBalance: 30 })
      const service = new PaymentsService(fastify)
      const result = await service.getStatus('pay-2', 'user-2')
      expect(result.status).toBe('approved')
      expect(result.creditBalance).toBe(30)
    })

    it('rejected quando FAILED', async () => {
      const fastify = createMockFastify()
      ;(fastify.prisma.payment.findUnique as Mock).mockResolvedValueOnce({ id: 'pay-3', userId: 'user-3', status: 'FAILED' })
      const service = new PaymentsService(fastify)
      const result = await service.getStatus('pay-3', 'user-3')
      expect(result.status).toBe('rejected')
    })

    it('lança 404 se pagamento é de outro usuário', async () => {
      const fastify = createMockFastify()
      ;(fastify.prisma.payment.findUnique as Mock).mockResolvedValueOnce({ id: 'pay-4', userId: 'outro', status: 'PENDING' })
      const service = new PaymentsService(fastify)
      await expect(service.getStatus('pay-4', 'user-4')).rejects.toMatchObject({ status: 404 })
    })
  })
})
