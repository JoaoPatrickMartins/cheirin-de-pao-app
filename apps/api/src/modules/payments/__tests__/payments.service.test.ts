// Payments service unit tests -- Wave 0 stubs (RED state)
// Requirements: CRED-01, CRED-11
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

// import { PaymentsService } from '../payments.service.js'

function createMockFastify(overrides: Record<string, unknown> = {}): FastifyInstance {
  return {
    prisma: {
      payment: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
      user: { findUnique: vi.fn(), update: vi.fn() },
      creditTransaction: { create: vi.fn() },
      ...overrides,
    },
  } as unknown as FastifyInstance
}

describe('PaymentsService [CRED-01, CRED-11]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('createPix [CRED-01]', () => {
    it('TODO: createPix cria Payment com status PENDING no banco', () => { expect(true).toBe(false) })
    it('TODO: createPix retorna qr_code_base64 e qr_code do Mercado Pago', () => { expect(true).toBe(false) })
    it('TODO: createPix retorna paymentId para uso no polling', () => { expect(true).toBe(false) })
  })

  describe('getStatus [CRED-11]', () => {
    it('TODO: getStatus retorna status pending quando pagamento nao aprovado', () => { expect(true).toBe(false) })
    it('TODO: getStatus retorna creditBalance quando status e approved', () => { expect(true).toBe(false) })
    it('TODO: getStatus retorna status rejected quando pagamento rejeitado', () => { expect(true).toBe(false) })
  })
})
