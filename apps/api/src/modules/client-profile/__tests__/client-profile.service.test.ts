// ClientProfileService unit tests — Wave 0 stubs
// Requirements: CONF-02, CONF-03, CONF-04, CONF-05, CONF-06
import { describe, it, expect, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { ClientProfileService } from '../client-profile.service.js'

function createMockFastify(overrides: Record<string, unknown> = {}): FastifyInstance {
  return {
    prisma: {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({}),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      condominium: { findUnique: vi.fn().mockResolvedValue(null) },
      schedule: { findFirst: vi.fn().mockResolvedValue(null), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      otpCode: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn(), update: vi.fn() },
      ...overrides,
    },
  } as unknown as FastifyInstance
}

describe('ClientProfileService', () => {
  it.todo('getProfile retorna dados completos do cliente') // CONF-02/03/05
  it.todo('updateProfile com novo condominiumId desativa schedules ativos') // CONF-06
  it.todo('requestContactChange retorna 422 se contato pertence a outra conta') // CONF-04

  describe('onboarding', () => {
    it('getOnboardingStatus: completed=false quando onboardingCompletedAt ausente', async () => {
      const fastify = createMockFastify()
      ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'u1',
        onboardingCompletedAt: null,
      })
      const service = new ClientProfileService(fastify)

      const result = await service.getOnboardingStatus('u1')

      expect(result).toEqual({ completed: false, onboardingCompletedAt: null })
    })

    it('getOnboardingStatus: completed=true quando já concluído', async () => {
      const at = new Date('2026-02-01T10:00:00.000Z')
      const fastify = createMockFastify()
      ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'u1',
        onboardingCompletedAt: at,
      })
      const service = new ClientProfileService(fastify)

      const result = await service.getOnboardingStatus('u1')

      expect(result).toEqual({ completed: true, onboardingCompletedAt: at.toISOString() })
    })

    it('getOnboardingStatus: 404 quando usuário não existe', async () => {
      const service = new ClientProfileService(createMockFastify())
      const result = await service.getOnboardingStatus('missing')
      expect(result).toEqual({ error: 'Usuário não encontrado', status: 404 })
    })

    it('completeOnboarding: grava via update por id quando ainda não concluído', async () => {
      const fastify = createMockFastify()
      ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'u1',
        onboardingCompletedAt: null,
      })
      ;(fastify.prisma.user.update as ReturnType<typeof vi.fn>).mockImplementation(
        ({ data }: { data: { onboardingCompletedAt: Date } }) =>
          Promise.resolve({ id: 'u1', onboardingCompletedAt: data.onboardingCompletedAt }),
      )
      const service = new ClientProfileService(fastify)

      const result = await service.completeOnboarding('u1')

      expect((result as { completed: boolean }).completed).toBe(true)
      expect((result as { onboardingCompletedAt: string }).onboardingCompletedAt).toBeTruthy()
      const updateCall = (fastify.prisma.user.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
      // Escrita por id único (sem where frágil de null) → sempre persiste.
      expect(updateCall.where).toEqual({ id: 'u1' })
      expect(updateCall.data.onboardingCompletedAt).toBeInstanceOf(Date)
    })

    it('completeOnboarding: idempotente — preserva data original e NÃO regrava', async () => {
      const original = new Date('2026-01-01T00:00:00.000Z')
      const fastify = createMockFastify()
      ;(fastify.prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'u1',
        onboardingCompletedAt: original,
      })
      const service = new ClientProfileService(fastify)

      const result = await service.completeOnboarding('u1')

      expect(result).toEqual({ completed: true, onboardingCompletedAt: original.toISOString() })
      expect(fastify.prisma.user.update as ReturnType<typeof vi.fn>).not.toHaveBeenCalled()
    })

    it('completeOnboarding: 404 quando usuário não existe', async () => {
      const service = new ClientProfileService(createMockFastify())
      const result = await service.completeOnboarding('missing')
      expect(result).toEqual({ error: 'Usuário não encontrado', status: 404 })
    })
  })
})
