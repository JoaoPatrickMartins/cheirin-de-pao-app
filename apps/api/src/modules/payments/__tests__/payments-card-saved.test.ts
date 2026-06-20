// Payments with saved card — TDD RED (Phase 12 Plan 01)
// Requirements: CARD-02, CARD-06
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

// ─── Mock mercadopago ───────────────────────────────────────────────────────
const mockPaymentCreate = vi.fn()
const mockCustomerSearch = vi.fn()
const mockCustomerCreate = vi.fn()
const mockCustomerCardCreate = vi.fn()
const mockCustomerCardDelete = vi.fn()
const mockCardTokenCreate = vi.fn()

vi.mock('mercadopago', () => {
  class MockMercadoPagoConfig {
    constructor(_opts: unknown) {}
  }
  class MockPayment {
    constructor(_client: unknown) {}
    create = mockPaymentCreate
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
    Payment: MockPayment,
    Customer: MockCustomer,
    CustomerCard: MockCustomerCard,
    CardToken: MockCardToken,
  }
})

import { PaymentsService } from '../payments.service.js'

// ─── Helper: mock fastify ───────────────────────────────────────────────────
function createMockFastify(overrides: Record<string, unknown> = {}): FastifyInstance {
  return {
    prisma: {
      payment: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      creditTransaction: {
        create: vi.fn(),
      },
      combo: {
        findUnique: vi.fn(),
      },
      setting: {
        findUnique: vi.fn(),
      },
      savedCard: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
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

// ─── Tests ─────────────────────────────────────────────────────────────────
describe('PaymentsService — cartão salvo [CARD-02, CARD-06]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Shared setup helpers
  function setupCombo(fastify: FastifyInstance) {
    ;(fastify.prisma.combo.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'combo-1',
      name: 'Combo Família',
      quantity: 30,
      price: 24.9,
    })
  }

  function setupPaymentCreate(fastify: FastifyInstance) {
    ;(fastify.prisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'payment-db-1',
      userId: 'user-1',
      amount: 24.9,
      method: 'CREDIT_CARD',
      status: 'PENDING',
      mercadoPagoId: 'mp-pay-1',
    })
  }

  // ── POST /payments/card com savedCardId ────────────────────────────────
  describe('createCard com savedCardId [CARD-06]', () => {
    it('chama CardToken.create e depois Payment.create quando savedCardId fornecido', async () => {
      const fastify = createMockFastify()
      const service = new PaymentsService(fastify)

      // User com mpCustomerId
      ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        mpCustomerId: 'mp-cust-1',
      })

      // SavedCard pertence ao user
      ;(fastify.prisma.savedCard.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'saved-card-1',
        userId: 'user-1',
        mpCardId: 'mp-card-1',
        brand: 'visa',
        lastFour: '1234',
        expiresAt: '2027-12',
        isDefault: true,
      })

      // CardToken.create retorna token
      mockCardTokenCreate.mockResolvedValueOnce({ id: 'token-xyz' })

      // Payment.create bem-sucedido
      mockPaymentCreate.mockResolvedValueOnce({
        id: 'mp-pay-1',
        status: 'pending',
      })

      setupCombo(fastify)
      setupPaymentCreate(fastify)

      await service.createCard({
        savedCardId: 'saved-card-1',
        securityCode: '123',
        installments: 1,
        payerEmail: 'test@example.com',
        comboId: 'combo-1',
        userId: 'user-1',
      })

      // Deve chamar CardToken.create com os campos corretos
      expect(mockCardTokenCreate).toHaveBeenCalledWith({
        body: {
          card_id: 'mp-card-1',
          customer_id: 'mp-cust-1',
          security_code: '123',
        },
      })

      // Deve chamar Payment.create (com o token gerado, não o securityCode)
      expect(mockPaymentCreate).toHaveBeenCalledTimes(1)
      const paymentBody = mockPaymentCreate.mock.calls[0][0].body
      expect(paymentBody.token).toBe('token-xyz')
      // securityCode NUNCA deve aparecer no corpo do Payment.create
      expect(JSON.stringify(paymentBody)).not.toContain('123')
      expect(JSON.stringify(paymentBody)).not.toContain('security_code')
    })

    it('lança 404 se savedCard não pertence ao userId (IDOR)', async () => {
      const fastify = createMockFastify()
      const service = new PaymentsService(fastify)

      ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        mpCustomerId: 'mp-cust-1',
      })

      // SavedCard pertence a OUTRO usuário
      ;(fastify.prisma.savedCard.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'saved-card-1',
        userId: 'other-user',
        mpCardId: 'mp-card-1',
      })

      setupCombo(fastify)

      await expect(
        service.createCard({
          savedCardId: 'saved-card-1',
          securityCode: '123',
          installments: 1,
          comboId: 'combo-1',
          userId: 'user-1',
        })
      ).rejects.toMatchObject({ status: 404 })

      expect(mockCardTokenCreate).not.toHaveBeenCalled()
      expect(mockPaymentCreate).not.toHaveBeenCalled()
    })
  })

  // ── POST /payments/card com saveCard:true ──────────────────────────────
  describe('createCard com saveCard:true [CARD-02]', () => {
    it('chama Customer.createCard e prisma.savedCard.create quando saveCard:true e count < 3', async () => {
      const fastify = createMockFastify()
      const service = new PaymentsService(fastify)

      ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        mpCustomerId: 'mp-cust-1',
      })

      mockPaymentCreate.mockResolvedValueOnce({
        id: 'mp-pay-1',
        status: 'approved',
      })

      setupCombo(fastify)
      setupPaymentCreate(fastify)

      // Count < 3
      ;(fastify.prisma.savedCard.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)

      // CustomerCard.create retorna card com dados
      mockCustomerCardCreate.mockResolvedValueOnce({
        id: 'mp-new-card-id',
        last_four_digits: '9999',
        expiration_month: 12,
        expiration_year: 2027,
        payment_method: { id: 'visa' },
      })

      ;(fastify.prisma.savedCard.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'new-saved-card',
      })

      await service.createCard({
        token: 'brick-token',
        paymentMethodId: 'visa',
        installments: 1,
        payerEmail: 'test@example.com',
        comboId: 'combo-1',
        userId: 'user-1',
        saveCard: true,
      })

      expect(mockCustomerCardCreate).toHaveBeenCalledTimes(1)
      expect(fastify.prisma.savedCard.create).toHaveBeenCalledTimes(1)
    })

    it('NÃO chama Customer.createCard quando saveCard:true e count >= 3', async () => {
      const fastify = createMockFastify()
      const service = new PaymentsService(fastify)

      ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        mpCustomerId: 'mp-cust-1',
      })

      mockPaymentCreate.mockResolvedValueOnce({
        id: 'mp-pay-1',
        status: 'approved',
      })

      setupCombo(fastify)
      setupPaymentCreate(fastify)

      // Count já é 3 — limite atingido
      ;(fastify.prisma.savedCard.count as ReturnType<typeof vi.fn>).mockResolvedValue(3)

      await service.createCard({
        token: 'brick-token',
        paymentMethodId: 'visa',
        installments: 1,
        payerEmail: 'test@example.com',
        comboId: 'combo-1',
        userId: 'user-1',
        saveCard: true,
      })

      expect(mockCustomerCardCreate).not.toHaveBeenCalled()
      expect(fastify.prisma.savedCard.create).not.toHaveBeenCalled()
    })

    it('securityCode nunca aparece nos argumentos de Payment.create', async () => {
      const fastify = createMockFastify()
      const service = new PaymentsService(fastify)

      ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        mpCustomerId: 'mp-cust-1',
      })

      ;(fastify.prisma.savedCard.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'saved-card-1',
        userId: 'user-1',
        mpCardId: 'mp-card-1',
        brand: 'visa',
        lastFour: '4321',
        expiresAt: '2028-06',
        isDefault: true,
      })

      mockCardTokenCreate.mockResolvedValueOnce({ id: 'token-secure' })
      mockPaymentCreate.mockResolvedValueOnce({
        id: 'mp-pay-1',
        status: 'pending',
      })

      setupCombo(fastify)
      setupPaymentCreate(fastify)

      await service.createCard({
        savedCardId: 'saved-card-1',
        securityCode: 'SECRET_CVV_999',
        installments: 1,
        comboId: 'combo-1',
        userId: 'user-1',
      })

      // Verificar que Payment.create não contém o CVV em nenhum campo
      const paymentCallArgs = JSON.stringify(mockPaymentCreate.mock.calls[0])
      expect(paymentCallArgs).not.toContain('SECRET_CVV_999')
      expect(paymentCallArgs).not.toContain('security_code')
    })
  })
})
