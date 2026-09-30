import { describe, it, expect, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { firstDeliveryDayByUser, isFirstDelivery } from '../first-delivery.js'

/** Date a partir de um dia BRT ao meio-dia — a convenção de `scheduledDate`. */
const brtNoon = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 15, 0, 0, 0))
}

/** Date numa hora BRT arbitrária — pedido de pão não garante meio-dia. */
const brtAt = (dateStr: string, hhmm: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [h, min] = hhmm.split(':').map(Number)
  return new Date(Date.UTC(y, m - 1, d, h + 3, min, 0, 0))
}

type GroupRow = { userId: string; _min: { scheduledDate: Date | null } }

function makePrisma(orders: GroupRow[] = [], marketOrders: GroupRow[] = []) {
  const orderGroupBy = vi.fn().mockResolvedValue(orders)
  const marketGroupBy = vi.fn().mockResolvedValue(marketOrders)
  const prisma = {
    order: { groupBy: orderGroupBy },
    marketOrder: { groupBy: marketGroupBy },
  } as unknown as PrismaClient
  return { prisma, orderGroupBy, marketGroupBy }
}

describe('first-delivery', () => {
  describe('firstDeliveryDayByUser', () => {
    it('devolve o dia BRT do pedido de pão mais antigo', async () => {
      const { prisma } = makePrisma([{ userId: 'u1', _min: { scheduledDate: brtNoon('2026-09-10') } }])

      const map = await firstDeliveryDayByUser(prisma, ['u1'])

      expect(map.get('u1')).toBe('2026-09-10')
    })

    it('usa a Cestinha quando ela é mais antiga que o pedido de pão', async () => {
      const { prisma } = makePrisma(
        [{ userId: 'u1', _min: { scheduledDate: brtNoon('2026-09-10') } }],
        [{ userId: 'u1', _min: { scheduledDate: brtNoon('2026-09-04') } }],
      )

      const map = await firstDeliveryDayByUser(prisma, ['u1'])

      expect(map.get('u1')).toBe('2026-09-04')
    })

    it('mantém o pão quando ele é o mais antigo', async () => {
      const { prisma } = makePrisma(
        [{ userId: 'u1', _min: { scheduledDate: brtNoon('2026-09-04') } }],
        [{ userId: 'u1', _min: { scheduledDate: brtNoon('2026-09-10') } }],
      )

      const map = await firstDeliveryDayByUser(prisma, ['u1'])

      expect(map.get('u1')).toBe('2026-09-04')
    })

    it('cliente sem pedido válido fica FORA do mapa (ausência = não é estreia)', async () => {
      const { prisma } = makePrisma([{ userId: 'u1', _min: { scheduledDate: brtNoon('2026-09-10') } }])

      const map = await firstDeliveryDayByUser(prisma, ['u1', 'u2'])

      expect(map.has('u2')).toBe(false)
    })

    it('ignora linha de agregação sem data', async () => {
      const { prisma } = makePrisma([{ userId: 'u1', _min: { scheduledDate: null } }])

      const map = await firstDeliveryDayByUser(prisma, ['u1'])

      expect(map.has('u1')).toBe(false)
    })

    it('não consulta o banco com lista vazia', async () => {
      const { prisma, orderGroupBy, marketGroupBy } = makePrisma()

      const map = await firstDeliveryDayByUser(prisma, [])

      expect(map.size).toBe(0)
      expect(orderGroupBy).not.toHaveBeenCalled()
      expect(marketGroupBy).not.toHaveBeenCalled()
    })

    it('deduplica os ids antes de consultar', async () => {
      const { prisma, orderGroupBy } = makePrisma()

      await firstDeliveryDayByUser(prisma, ['u1', 'u1', 'u2'])

      expect(orderGroupBy.mock.calls[0][0].where.userId.in).toEqual(['u1', 'u2'])
    })

    // O selo migra quando a estreia é cancelada: o pedido cancelado não pode entrar na agregação,
    // senão o cliente é entregue pela primeira vez sem ninguém perceber.
    it('exclui pedido de pão CANCELLED da agregação', async () => {
      const { prisma, orderGroupBy } = makePrisma()

      await firstDeliveryDayByUser(prisma, ['u1'])

      expect(orderGroupBy.mock.calls[0][0].where.status).toEqual({ not: 'CANCELLED' })
    })

    // PENDING_PAYMENT de fora: carrinho abandonado é varrido pelo cron e não pode queimar a estreia.
    it('só considera Cestinha em status confirmado', async () => {
      const { prisma, marketGroupBy } = makePrisma()

      await firstDeliveryDayByUser(prisma, ['u1'])

      const statuses = marketGroupBy.mock.calls[0][0].where.status.in
      expect(statuses).not.toContain('PENDING_PAYMENT')
      expect(statuses).not.toContain('CANCELLED')
      expect(statuses).toContain('DELIVERED')
    })
  })

  describe('isFirstDelivery', () => {
    it('marca a entrega que cai no dia da estreia', () => {
      expect(isFirstDelivery('2026-09-10', brtNoon('2026-09-10'))).toBe(true)
    })

    it('não marca entrega de outro dia', () => {
      expect(isFirstDelivery('2026-09-10', brtNoon('2026-09-11'))).toBe(false)
    })

    // Pão e Cestinha do mesmo dia estreiam juntos, mesmo com horas diferentes no `scheduledDate`.
    it('marca o dia inteiro, não o timestamp', () => {
      expect(isFirstDelivery('2026-09-10', brtAt('2026-09-10', '06:30'))).toBe(true)
      expect(isFirstDelivery('2026-09-10', brtAt('2026-09-10', '23:45'))).toBe(true)
    })

    it('sem dia de estreia conhecido, nunca marca', () => {
      expect(isFirstDelivery(undefined, brtNoon('2026-09-10'))).toBe(false)
    })
  })
})
