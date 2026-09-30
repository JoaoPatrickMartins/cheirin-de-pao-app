import { vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { cleanupExpiredSocialFlows } from '../social-flow-cleanup.js'

function mockPrisma(count: number) {
  const deleteMany = vi.fn().mockResolvedValue({ count })
  return { prisma: { socialLoginFlow: { deleteMany } } as unknown as Pick<PrismaClient, 'socialLoginFlow'>, deleteMany }
}

describe('cleanupExpiredSocialFlows', () => {
  it('apaga só os fluxos com expiresAt no passado', async () => {
    const { prisma, deleteMany } = mockPrisma(3)
    const now = new Date('2026-09-30T12:00:00.000Z')

    const removed = await cleanupExpiredSocialFlows(prisma, now)

    expect(removed).toBe(3)
    expect(deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lt: now } } })
  })

  it('devolve 0 quando não há nada vencido', async () => {
    const { prisma } = mockPrisma(0)
    expect(await cleanupExpiredSocialFlows(prisma)).toBe(0)
  })
})
