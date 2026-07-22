import { describe, it, expect, vi } from 'vitest'
import { countCommittedDeliveries } from '../schedule-projection.js'
import { brtNoonFromStr } from '../cutoff.js'

// 2026-06-22 é uma segunda-feira ('seg').
const SEG = brtNoonFromStr('2026-06-22')

function makePrisma(matCount: number) {
  return {
    order: {
      count: vi.fn().mockResolvedValue(matCount),
      // Nenhuma order materializada da agenda → nada a descontar da projeção.
      findMany: vi.fn().mockResolvedValue([]),
    },
    schedule: {
      findMany: vi.fn().mockResolvedValue([
        {
          userId: 'u1',
          condominiumId: 'c1',
          days: { manha: { seg: 2, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 } },
        },
        {
          userId: 'u2',
          condominiumId: 'c1',
          days: { manha: { seg: 3, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 } },
        },
      ]),
    },
  }
}

describe('countCommittedDeliveries', () => {
  it('soma materializadas (Orders) + previstas pendentes (1 por linha de agenda)', async () => {
    const prisma = makePrisma(3)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const total = await countCommittedDeliveries(prisma as any, SEG)
    // 3 materializadas + 2 previstas (u1, u2 têm seg > 0) = 5
    expect(total).toBe(5)
  })

  it('excludeUserId remove as entregas previstas daquele usuário', async () => {
    const prisma = makePrisma(3)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const total = await countCommittedDeliveries(prisma as any, SEG, { excludeUserId: 'u1' })
    // projeção sem u1 → 1 (u2); materializadas mockadas em 3 → 4
    expect(total).toBe(4)
    // o filtro de materializadas por userId é aplicado no where do count
    expect(prisma.order.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: { not: 'u1' } }) }),
    )
  })
})
