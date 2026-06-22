// Saved Cards service unit tests — migração para Stripe
// Requisitos: CARD-01 (listar), CARD-04 (default), CARD-05 (remover), CARD-07 (cadastrar)
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

// ─── Mock StripeService ───────────────────────────────────────────────────────
const mockGetOrCreateCustomer = vi.fn()
const mockCreateSetupIntent = vi.fn()
const mockGetPaymentMethod = vi.fn()
const mockDetach = vi.fn()
const mockSetDefaultPM = vi.fn()

vi.mock('../../payments/stripe.service.js', () => {
  class MockStripeService {
    constructor(_fastify: unknown) {}
    getOrCreateCustomer = mockGetOrCreateCustomer
    createSetupIntent = mockCreateSetupIntent
    getPaymentMethod = mockGetPaymentMethod
    detachPaymentMethod = mockDetach
    setDefaultPaymentMethod = mockSetDefaultPM
  }
  return { StripeService: MockStripeService }
})

import { SavedCardsService } from '../saved-cards.service.js'
import { SavedCardsRepository } from '../saved-cards.repository.js'

// ─── Helper: mock fastify ───────────────────────────────────────────────────
function createMockFastify(): FastifyInstance {
  return {
    prisma: {
      savedCard: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(),
    },
    log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  } as unknown as FastifyInstance
}

function createService(fastify: FastifyInstance) {
  const repo = new SavedCardsRepository(fastify)
  return new SavedCardsService(fastify, repo)
}
type Mock = ReturnType<typeof vi.fn>

describe('SavedCardsService (Stripe) [CARD-01, CARD-04, CARD-05, CARD-07]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── listCards ─────────────────────────────────────────────────────────────
  describe('listCards [CARD-01]', () => {
    it('retorna apenas os cartões do userId correto', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      const cards = [{ id: 'card-1', userId: 'user-1', stripePaymentMethodId: 'pm_1' }]
      ;(fastify.prisma.savedCard.findMany as Mock).mockResolvedValueOnce(cards)

      const result = await service.listCards('user-1')

      expect(fastify.prisma.savedCard.findMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
      expect(result).toEqual(cards)
    })
  })

  // ── createSetupIntent ───────────────────────────────────────────────────────
  describe('createSetupIntent [CARD-07]', () => {
    it('lança 400 se já atingiu o limite de 3 cartões', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      ;(fastify.prisma.savedCard.count as Mock).mockResolvedValueOnce(3)

      await expect(service.createSetupIntent('user-1')).rejects.toMatchObject({ status: 400 })
      expect(mockCreateSetupIntent).not.toHaveBeenCalled()
    })

    it('retorna clientSecret do Stripe quando abaixo do limite', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      ;(fastify.prisma.savedCard.count as Mock).mockResolvedValueOnce(1)
      mockCreateSetupIntent.mockResolvedValueOnce({ clientSecret: 'seti_secret', customerId: 'cus_1' })

      const res = await service.createSetupIntent('user-1')
      expect(res).toEqual({ clientSecret: 'seti_secret', customerId: 'cus_1' })
    })
  })

  // ── addCard ───────────────────────────────────────────────────────────────
  describe('addCard [CARD-07]', () => {
    it('lança 404 se o PaymentMethod não pertence ao customer do usuário (anti-IDOR)', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      ;(fastify.prisma.savedCard.count as Mock).mockResolvedValueOnce(0)
      mockGetOrCreateCustomer.mockResolvedValueOnce('cus_1')
      mockGetPaymentMethod.mockResolvedValueOnce({ id: 'pm_x', type: 'card', customer: 'cus_OUTRO', card: { brand: 'visa' } })

      await expect(service.addCard({ userId: 'user-1', paymentMethodId: 'pm_x' })).rejects.toMatchObject({ status: 404 })
      expect(fastify.prisma.savedCard.create).not.toHaveBeenCalled()
    })

    it('persiste o cartão (isDefault no primeiro) com dados lidos do Stripe', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      ;(fastify.prisma.savedCard.count as Mock).mockResolvedValueOnce(0).mockResolvedValueOnce(0)
      mockGetOrCreateCustomer.mockResolvedValue('cus_1')
      mockGetPaymentMethod.mockResolvedValueOnce({
        id: 'pm_1', type: 'card', customer: 'cus_1',
        card: { brand: 'Visa', last4: '4242', exp_month: 5, exp_year: 2030 },
      })
      ;(fastify.prisma.savedCard.findFirst as Mock).mockResolvedValueOnce(null)
      ;(fastify.prisma.savedCard.create as Mock).mockResolvedValueOnce({ id: 'card-1' })

      await service.addCard({ userId: 'user-1', paymentMethodId: 'pm_1' })

      expect(fastify.prisma.savedCard.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          stripePaymentMethodId: 'pm_1',
          brand: 'visa',
          lastFour: '4242',
          expiresAt: '2030-05',
          isDefault: true,
        }),
      })
      expect(mockSetDefaultPM).toHaveBeenCalledWith('cus_1', 'pm_1')
    })

    it('é idempotente: devolve o registro existente sem recriar', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      ;(fastify.prisma.savedCard.count as Mock).mockResolvedValueOnce(1)
      mockGetOrCreateCustomer.mockResolvedValueOnce('cus_1')
      mockGetPaymentMethod.mockResolvedValueOnce({ id: 'pm_1', type: 'card', customer: 'cus_1', card: { brand: 'visa' } })
      ;(fastify.prisma.savedCard.findFirst as Mock).mockResolvedValueOnce({ id: 'card-existente' })

      const res = await service.addCard({ userId: 'user-1', paymentMethodId: 'pm_1' })
      expect(res).toEqual({ id: 'card-existente' })
      expect(fastify.prisma.savedCard.create).not.toHaveBeenCalled()
    })

    it('lança 400 quando já há 3 cartões', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      ;(fastify.prisma.savedCard.count as Mock).mockResolvedValueOnce(3)

      await expect(service.addCard({ userId: 'user-1', paymentMethodId: 'pm_1' })).rejects.toMatchObject({ status: 400 })
    })
  })

  // ── setDefault ──────────────────────────────────────────────────────────────
  describe('setDefault [CARD-04]', () => {
    it('lança 404 se cartão não pertence ao usuário (IDOR)', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      ;(fastify.prisma.savedCard.findUnique as Mock).mockResolvedValueOnce({ id: 'card-1', userId: 'outro' })

      await expect(service.setDefault('card-1', 'user-1')).rejects.toMatchObject({ status: 404 })
      expect(fastify.prisma.$transaction).not.toHaveBeenCalled()
    })

    it('usa $transaction e reflete o default no Stripe', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      ;(fastify.prisma.savedCard.findUnique as Mock).mockResolvedValueOnce({ id: 'card-1', userId: 'user-1', stripePaymentMethodId: 'pm_1' })
      ;(fastify.prisma.$transaction as Mock).mockResolvedValueOnce([{}, {}])
      mockGetOrCreateCustomer.mockResolvedValueOnce('cus_1')

      await service.setDefault('card-1', 'user-1')

      expect(fastify.prisma.$transaction).toHaveBeenCalledTimes(1)
      expect(mockSetDefaultPM).toHaveBeenCalledWith('cus_1', 'pm_1')
    })
  })

  // ── removeCard ────────────────────────────────────────────────────────────
  describe('removeCard [CARD-05]', () => {
    it('lança 404 com IDOR — não faz detach antes de validar ownership', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      ;(fastify.prisma.savedCard.findUnique as Mock).mockResolvedValueOnce({ id: 'card-1', userId: 'outro', stripePaymentMethodId: 'pm_1' })

      await expect(service.removeCard('card-1', 'user-1')).rejects.toMatchObject({ status: 404 })
      expect(mockDetach).not.toHaveBeenCalled()
    })

    it('faz detach no Stripe e depois apaga no Prisma', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      ;(fastify.prisma.savedCard.findUnique as Mock).mockResolvedValueOnce({ id: 'card-1', userId: 'user-1', stripePaymentMethodId: 'pm_1', isDefault: false })
      mockDetach.mockResolvedValueOnce(undefined)
      ;(fastify.prisma.savedCard.delete as Mock).mockResolvedValueOnce({})

      await service.removeCard('card-1', 'user-1')

      expect(mockDetach).toHaveBeenCalledWith('pm_1')
      expect(fastify.prisma.savedCard.delete).toHaveBeenCalledWith({ where: { id: 'card-1', userId: 'user-1' } })
    })

    it('apaga o registro local mesmo se o PaymentMethod já não existe no Stripe (404)', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      ;(fastify.prisma.savedCard.findUnique as Mock).mockResolvedValueOnce({ id: 'card-1', userId: 'user-1', stripePaymentMethodId: 'pm_1', isDefault: false })
      mockDetach.mockRejectedValueOnce({ statusCode: 404 })
      ;(fastify.prisma.savedCard.delete as Mock).mockResolvedValueOnce({})

      await service.removeCard('card-1', 'user-1')
      expect(fastify.prisma.savedCard.delete).toHaveBeenCalled()
    })

    it('propaga 502 sem apagar no Prisma se o detach falhar por outro motivo', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      ;(fastify.prisma.savedCard.findUnique as Mock).mockResolvedValueOnce({ id: 'card-1', userId: 'user-1', stripePaymentMethodId: 'pm_1', isDefault: false })
      mockDetach.mockRejectedValueOnce(new Error('Stripe down'))

      await expect(service.removeCard('card-1', 'user-1')).rejects.toMatchObject({ status: 502 })
      expect(fastify.prisma.savedCard.delete).not.toHaveBeenCalled()
    })

    it('desativa a recarga automática ao remover o cartão padrão', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      ;(fastify.prisma.savedCard.findUnique as Mock).mockResolvedValueOnce({ id: 'card-1', userId: 'user-1', stripePaymentMethodId: 'pm_1', isDefault: true })
      mockDetach.mockResolvedValueOnce(undefined)
      ;(fastify.prisma.savedCard.delete as Mock).mockResolvedValueOnce({})
      ;(fastify.prisma.user.findUnique as Mock).mockResolvedValueOnce({ id: 'user-1', autoRecharge: { active: true, comboId: 'c1' } })
      ;(fastify.prisma.user.update as Mock).mockResolvedValueOnce({})

      await service.removeCard('card-1', 'user-1')

      expect(fastify.prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { autoRecharge: expect.objectContaining({ active: false }) },
      })
    })
  })
})
