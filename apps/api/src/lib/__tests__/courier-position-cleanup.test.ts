import { vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { clearStaleCourierPositions, RUN_POSITION_CLEARED } from '../courier-position-cleanup.js'

function mockPrisma(count: number) {
  const updateMany = vi.fn().mockResolvedValue({ count })
  return { prisma: { courierRun: { updateMany } } as unknown as Pick<PrismaClient, 'courierRun'>, updateMany }
}

describe('clearStaleCourierPositions', () => {
  it('apaga a posição e o ponto de partida só das rotas de dias anteriores (BRT) que ainda têm', async () => {
    const { prisma, updateMany } = mockPrisma(2)
    const now = new Date('2026-10-02T03:00:00.000Z') // 00:00 BRT de 02/10

    expect(await clearStaleCourierPositions(prisma, now)).toBe(2)
    expect(updateMany).toHaveBeenCalledWith({
      where: { date: { lt: '2026-10-02' }, OR: [{ lastPosAt: { not: null } }, { startLat: { not: null } }] },
      data: { startLat: null, startLng: null, lastLat: null, lastLng: null, lastPosAt: null },
    })
  })

  it('o que é apagado cobre todos os campos de localização da rota', () => {
    expect(Object.keys(RUN_POSITION_CLEARED).sort()).toEqual(['lastLat', 'lastLng', 'lastPosAt', 'startLat', 'startLng'])
  })
})
