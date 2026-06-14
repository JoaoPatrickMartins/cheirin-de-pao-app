// Webhooks service unit tests -- Wave 0 stubs (RED state)
// Requirements: PAY-01 (HMAC validation, idempotency — T-03-01)
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

// import { WebhooksService } from '../webhooks.service.js'

function createMockFastify(overrides: Record<string, unknown> = {}): FastifyInstance {
  return {
    prisma: {
      payment: { findUnique: vi.fn(), update: vi.fn() },
      user: { update: vi.fn() },
      creditTransaction: { create: vi.fn(), findFirst: vi.fn() },
      ...overrides,
    },
  } as unknown as FastifyInstance
}

describe('WebhooksService [PAY-01, T-03-01]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('validateSignature [PAY-01 HMAC]', () => {
    it('TODO: assinatura invalida retorna false sem processar o evento', () => { expect(true).toBe(false) })
    it('TODO: assinatura valida retorna true e permite processamento', () => { expect(true).toBe(false) })
    it('TODO: ausencia do header x-signature retorna false', () => { expect(true).toBe(false) })
  })

  describe('processPaymentApproved [T-03-01 idempotencia]', () => {
    it('TODO: webhook duplicado nao credita duas vezes (idempotencia via mercadoPagoId)', () => { expect(true).toBe(false) })
    it('TODO: primeiro webhook aprovado credita creditBalance via $transaction atomico', () => { expect(true).toBe(false) })
    it('TODO: webhook com status diferente de approved nao altera creditBalance', () => { expect(true).toBe(false) })
  })
})
