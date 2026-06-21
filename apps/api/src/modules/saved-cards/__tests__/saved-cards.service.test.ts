// Saved Cards service unit tests — TDD RED (Phase 12 Plan 01)
// Requirements: CARD-01, CARD-04, CARD-05, CARD-06
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

// ─── Mock mercadopago ───────────────────────────────────────────────────────
const mockCustomerSearch = vi.fn()
const mockCustomerCreate = vi.fn()
const mockCustomerCardCreate = vi.fn()
const mockCustomerCardDelete = vi.fn()
const mockCardTokenCreate = vi.fn()

vi.mock('mercadopago', () => {
  class MockMercadoPagoConfig {
    constructor(_opts: unknown) {}
  }
  class MockCustomer {
    constructor(_client: unknown) {}
    search = mockCustomerSearch
    create = mockCustomerCreate
  }
  class MockCustomerCard {
    constructor(_client: unknown) {}
    create = mockCustomerCardCreate
    remove = mockCustomerCardDelete
  }
  class MockCardToken {
    constructor(_client: unknown) {}
    create = mockCardTokenCreate
  }
  return {
    MercadoPagoConfig: MockMercadoPagoConfig,
    Customer: MockCustomer,
    CustomerCard: MockCustomerCard,
    CardToken: MockCardToken,
  }
})

import { SavedCardsService } from '../saved-cards.service.js'
import { SavedCardsRepository } from '../saved-cards.repository.js'

// ─── Helper: mock fastify ───────────────────────────────────────────────────
function createMockFastify(overrides: Record<string, unknown> = {}): FastifyInstance {
  return {
    prisma: {
      savedCard: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
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
      ...overrides,
    },
    log: {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
  } as unknown as FastifyInstance
}

// ─── Helper: create service ─────────────────────────────────────────────────
function createService(fastify: FastifyInstance) {
  const repo = new SavedCardsRepository(fastify)
  return new SavedCardsService(fastify, repo)
}

// ─── Tests ─────────────────────────────────────────────────────────────────
describe('SavedCardsService [CARD-01, CARD-04, CARD-05, CARD-06]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── listCards ─────────────────────────────────────────────────────────────
  describe('listCards [CARD-01]', () => {
    it('retorna apenas os cartões do userId correto', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      const userId = 'user-1'
      const cards = [
        { id: 'card-1', userId, mpCardId: 'mp-1', brand: 'visa', lastFour: '1234', expiresAt: '2027-12', isDefault: true },
      ]
      ;(fastify.prisma.savedCard.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce(cards)

      const result = await service.listCards(userId)

      expect(fastify.prisma.savedCard.findMany).toHaveBeenCalledWith({ where: { userId } })
      expect(result).toEqual(cards)
    })

    it('nunca retorna cartões de outro usuário (query usa userId)', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      ;(fastify.prisma.savedCard.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([])

      await service.listCards('user-A')

      const call = (fastify.prisma.savedCard.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(call.where.userId).toBe('user-A')
      // Nunca busca sem filtro de userId
      expect(call.where).not.toHaveProperty('id')
    })
  })

  // ── getOrCreateMpCustomer ─────────────────────────────────────────────────
  describe('getOrCreateMpCustomer [CARD-01]', () => {
    it('retorna mpCustomerId existente sem criar novo (idempotente)', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      const userId = 'user-1'
      ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: userId,
        email: 'test@example.com',
        mpCustomerId: 'existing-mp-customer-id',
      })

      const customerId = await service.getOrCreateMpCustomer(userId)

      expect(customerId).toBe('existing-mp-customer-id')
      expect(mockCustomerSearch).not.toHaveBeenCalled()
      expect(mockCustomerCreate).not.toHaveBeenCalled()
    })

    it('busca no MP antes de criar quando mpCustomerId é null', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      const userId = 'user-1'
      ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: userId,
        email: 'test@example.com',
        mpCustomerId: null,
      })
      mockCustomerSearch.mockResolvedValueOnce({ results: [{ id: 'found-mp-id' }] })
      ;(fastify.prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce({})

      const customerId = await service.getOrCreateMpCustomer(userId)

      expect(mockCustomerSearch).toHaveBeenCalledWith({ options: { email: 'test@example.com' } })
      expect(mockCustomerCreate).not.toHaveBeenCalled()
      expect(customerId).toBe('found-mp-id')
    })

    it('cria MP Customer apenas se não existe no search', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      const userId = 'user-1'
      ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: userId,
        email: 'new@example.com',
        mpCustomerId: null,
      })
      mockCustomerSearch.mockResolvedValueOnce({ results: [] })
      mockCustomerCreate.mockResolvedValueOnce({ id: 'new-mp-id' })
      ;(fastify.prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce({})

      const customerId = await service.getOrCreateMpCustomer(userId)

      expect(mockCustomerCreate).toHaveBeenCalledWith({ body: { email: 'new@example.com' } })
      expect(customerId).toBe('new-mp-id')
    })
  })

  // ── setDefault ────────────────────────────────────────────────────────────
  describe('setDefault [CARD-04]', () => {
    it('usa $transaction com updateMany + update (operação atômica)', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      const userId = 'user-1'
      const cardId = 'card-1'
      ;(fastify.prisma.savedCard.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: cardId,
        userId,
      })
      ;(fastify.prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{}, {}])

      await service.setDefault(cardId, userId)

      expect(fastify.prisma.$transaction).toHaveBeenCalledTimes(1)
    })

    it('lança 404 se cartão não pertence ao usuário (IDOR)', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      ;(fastify.prisma.savedCard.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'card-1',
        userId: 'other-user',
      })

      await expect(service.setDefault('card-1', 'user-1')).rejects.toMatchObject({
        status: 404,
      })
      expect(fastify.prisma.$transaction).not.toHaveBeenCalled()
    })
  })

  // ── removeCard ────────────────────────────────────────────────────────────
  describe('removeCard [CARD-05]', () => {
    it('lança 404 com IDOR — não chama Customer.removeCard antes de validar ownership', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      ;(fastify.prisma.savedCard.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'card-1',
        userId: 'other-user',
        mpCardId: 'mp-card-1',
      })
      ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'user-1',
        mpCustomerId: 'mp-cust-1',
      })

      await expect(service.removeCard('card-1', 'user-1')).rejects.toMatchObject({
        status: 404,
      })
      expect(mockCustomerCardDelete).not.toHaveBeenCalled()
    })

    it('remove no MP e depois no Prisma em caso de sucesso', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      const userId = 'user-1'
      ;(fastify.prisma.savedCard.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'card-1',
        userId,
        mpCardId: 'mp-card-1',
      })
      ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: userId,
        mpCustomerId: 'mp-cust-1',
      })
      mockCustomerCardDelete.mockResolvedValueOnce({})
      ;(fastify.prisma.savedCard.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({})

      await service.removeCard('card-1', userId)

      expect(mockCustomerCardDelete).toHaveBeenCalledWith({
        customerId: 'mp-cust-1',
        cardId: 'mp-card-1',
      })
      expect(fastify.prisma.savedCard.delete).toHaveBeenCalledWith({ where: { id: 'card-1', userId } })
    })

    it('remove o registro local quando o cartão já não existe no MP (404 not_found)', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      const userId = 'user-1'
      ;(fastify.prisma.savedCard.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'card-1',
        userId,
        mpCardId: 'mp-card-1',
      })
      ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: userId,
        mpCustomerId: 'mp-cust-1',
      })
      // MP responde 404 — cartão órfão; deve seguir e apagar localmente
      mockCustomerCardDelete.mockRejectedValueOnce({ status: 404, error: 'not_found', message: 'card not found' })
      ;(fastify.prisma.savedCard.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce({})

      await service.removeCard('card-1', userId)

      expect(fastify.prisma.savedCard.delete).toHaveBeenCalledWith({ where: { id: 'card-1', userId } })
    })

    it('propaga erro do MP sem deletar no Prisma se MP falhar', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      const userId = 'user-1'
      ;(fastify.prisma.savedCard.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'card-1',
        userId,
        mpCardId: 'mp-card-1',
      })
      ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: userId,
        mpCustomerId: 'mp-cust-1',
      })
      mockCustomerCardDelete.mockRejectedValueOnce(new Error('MP API error'))

      await expect(service.removeCard('card-1', userId)).rejects.toMatchObject({ error: expect.any(String), status: 502 })
      expect(fastify.prisma.savedCard.delete).not.toHaveBeenCalled()
    })
  })

  // ── createCardWithSaved [CARD-06] ─────────────────────────────────────────
  describe('createCardWithSaved [CARD-06]', () => {
    it('lança 404 quando savedCard.userId !== userId (IDOR)', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      ;(fastify.prisma.savedCard.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'card-1',
        userId: 'other-user',
        mpCardId: 'mp-card-1',
      })
      ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'user-1',
        mpCustomerId: 'mp-cust-1',
      })

      await expect(
        service.createCardWithSaved({ savedCardId: 'card-1', securityCode: '123', userId: 'user-1' })
      ).rejects.toMatchObject({ status: 404 })
      expect(mockCardTokenCreate).not.toHaveBeenCalled()
    })

    it('lança 400 quando user.mpCustomerId é null', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      const userId = 'user-1'
      ;(fastify.prisma.savedCard.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'card-1',
        userId,
        mpCardId: 'mp-card-1',
      })
      ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: userId,
        mpCustomerId: null,
      })

      await expect(
        service.createCardWithSaved({ savedCardId: 'card-1', securityCode: '123', userId })
      ).rejects.toMatchObject({ status: 400 })
      expect(mockCardTokenCreate).not.toHaveBeenCalled()
    })

    it('chama CardToken.create com card_id, customer_id e security_code corretos', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      const userId = 'user-1'
      ;(fastify.prisma.savedCard.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'card-1',
        userId,
        mpCardId: 'mp-card-1',
      })
      ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: userId,
        mpCustomerId: 'mp-cust-1',
      })
      mockCardTokenCreate.mockResolvedValueOnce({ id: 'token-abc' })

      const result = await service.createCardWithSaved({
        savedCardId: 'card-1',
        securityCode: '456',
        userId,
      })

      expect(mockCardTokenCreate).toHaveBeenCalledWith({
        body: {
          card_id: 'mp-card-1',
          customer_id: 'mp-cust-1',
          security_code: '456',
        },
      })
      expect(result).toMatchObject({ token: 'token-abc' })
    })
  })

  // ── Limite de 3 cartões ───────────────────────────────────────────────────
  describe('Limite de 3 cartões [CARD-06]', () => {
    it('lança 400 se count >= 3 antes de criar card no MP', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      const userId = 'user-1'
      ;(fastify.prisma.savedCard.count as ReturnType<typeof vi.fn>).mockResolvedValueOnce(3)

      await expect(
        service.saveNewCard({
          userId,
          mpCustomerId: 'mp-cust-1',
          mpCardId: 'mp-new-card',
          brand: 'visa',
          lastFour: '9999',
          expiresAt: '2028-06',
        })
      ).rejects.toMatchObject({ status: 400 })
      expect(mockCustomerCardCreate).not.toHaveBeenCalled()
    })

    it('salva cartão com isDefault=true se for o primeiro (count === 0)', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      const userId = 'user-1'
      ;(fastify.prisma.savedCard.count as ReturnType<typeof vi.fn>).mockResolvedValueOnce(0)
      ;(fastify.prisma.savedCard.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 'new-card' })

      await service.saveNewCard({
        userId,
        mpCustomerId: 'mp-cust-1',
        mpCardId: 'mp-new-card',
        brand: 'visa',
        lastFour: '9999',
        expiresAt: '2028-06',
      })

      expect(fastify.prisma.savedCard.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isDefault: true }),
        })
      )
    })

    it('salva cartão com isDefault=false se não for o primeiro (count > 0)', async () => {
      const fastify = createMockFastify()
      const service = createService(fastify)
      const userId = 'user-1'
      ;(fastify.prisma.savedCard.count as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1)
      ;(fastify.prisma.savedCard.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 'new-card' })

      await service.saveNewCard({
        userId,
        mpCustomerId: 'mp-cust-1',
        mpCardId: 'mp-new-card',
        brand: 'master',
        lastFour: '1111',
        expiresAt: '2029-01',
      })

      expect(fastify.prisma.savedCard.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isDefault: false }),
        })
      )
    })
  })
})
