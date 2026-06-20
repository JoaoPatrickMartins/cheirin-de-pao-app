// Payments service unit tests -- Wave 1 implementation (GREEN state)
// Requirements: CRED-01, CRED-11
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

// Mock mercadopago before any imports that use it
const mockPaymentCreate = vi.fn()

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
    search = vi.fn()
    create = vi.fn()
  }
  class MockCustomerCard {
    constructor(_client: unknown) {}
    create = vi.fn()
    remove = vi.fn()
  }
  class MockCardToken {
    constructor(_client: unknown) {}
    create = vi.fn()
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
  } as unknown as FastifyInstance
}

describe('PaymentsService [CRED-01, CRED-11]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createPix [CRED-01]', () => {
    it('createPix cria Payment com status PENDING no banco', async () => {
      mockPaymentCreate.mockResolvedValueOnce({
        id: 'mp-id-123',
        point_of_interaction: {
          transaction_data: {
            qr_code_base64: 'base64string',
            qr_code: 'pix-copy-paste-code',
          },
        },
      })

      const mockFastify = createMockFastify()
      ;(mockFastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'user-1',
        email: 'test@example.com',
      })
      ;(mockFastify.prisma.combo.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'combo-1',
        name: 'Combo Família',
        quantity: 30,
        price: 24.9,
      })
      ;(mockFastify.prisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'payment-1',
        status: 'PENDING',
        userId: 'user-1',
        amount: 24.9,
        method: 'PIX',
        mercadoPagoId: 'mp-id-123',
      })

      const service = new PaymentsService(mockFastify)
      const result = await service.createPix({ comboId: 'combo-1', userId: 'user-1' })

      expect(mockFastify.prisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
            method: 'PIX',
          }),
        })
      )
      expect(result).toHaveProperty('paymentId')
    })

    it('createPix retorna qr_code_base64 e qr_code do Mercado Pago', async () => {
      mockPaymentCreate.mockResolvedValueOnce({
        id: 'mp-id-456',
        point_of_interaction: {
          transaction_data: {
            qr_code_base64: 'MOCK_BASE64',
            qr_code: 'MOCK_COPY_PASTE',
          },
        },
      })

      const mockFastify = createMockFastify()
      ;(mockFastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'user-2',
        email: null,
      })
      ;(mockFastify.prisma.combo.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'combo-2',
        name: 'Combo Básico',
        quantity: 10,
        price: 10.0,
      })
      ;(mockFastify.prisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'payment-2',
        status: 'PENDING',
      })

      const service = new PaymentsService(mockFastify)
      const result = await service.createPix({ comboId: 'combo-2', userId: 'user-2' })

      expect(result.qr_code_base64).toBe('MOCK_BASE64')
      expect(result.qr_code).toBe('MOCK_COPY_PASTE')
    })

    it('createPix retorna paymentId para uso no polling', async () => {
      mockPaymentCreate.mockResolvedValueOnce({
        id: 'mp-id-789',
        point_of_interaction: {
          transaction_data: {
            qr_code_base64: 'base64',
            qr_code: 'code',
          },
        },
      })

      const mockFastify = createMockFastify()
      ;(mockFastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'user-3',
        email: 'user3@test.com',
      })
      ;(mockFastify.prisma.combo.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'combo-3',
        name: 'Combo Test',
        quantity: 15,
        price: 15.0,
      })
      ;(mockFastify.prisma.payment.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'payment-polling-id',
        status: 'PENDING',
      })

      const service = new PaymentsService(mockFastify)
      const result = await service.createPix({ comboId: 'combo-3', userId: 'user-3' })

      expect(result.paymentId).toBe('payment-polling-id')
    })
  })

  describe('getStatus [CRED-11]', () => {
    it('getStatus retorna status pending quando pagamento nao aprovado', async () => {
      const mockFastify = createMockFastify()
      ;(mockFastify.prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'pay-1',
        userId: 'user-1',
        status: 'PENDING',
      })

      const service = new PaymentsService(mockFastify)
      const result = await service.getStatus('pay-1', 'user-1')

      expect(result.status).toBe('pending')
      expect(result.creditBalance).toBeUndefined()
    })

    it('getStatus retorna creditBalance quando status e approved', async () => {
      const mockFastify = createMockFastify()
      ;(mockFastify.prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'pay-2',
        userId: 'user-2',
        status: 'PAID',
      })
      ;(mockFastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'user-2',
        creditBalance: 30,
      })

      const service = new PaymentsService(mockFastify)
      const result = await service.getStatus('pay-2', 'user-2')

      expect(result.status).toBe('approved')
      expect(result.creditBalance).toBe(30)
    })

    it('getStatus retorna status rejected quando pagamento rejeitado', async () => {
      const mockFastify = createMockFastify()
      ;(mockFastify.prisma.payment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 'pay-3',
        userId: 'user-3',
        status: 'FAILED',
      })

      const service = new PaymentsService(mockFastify)
      const result = await service.getStatus('pay-3', 'user-3')

      expect(result.status).toBe('rejected')
    })
  })
})
