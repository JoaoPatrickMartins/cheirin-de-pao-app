// H-2 · "Marcar não entregue" (Onda 8 do entregador): corrige a parada inteira (pão + Cestinha) de
// entregue para não entregue SEM push, sem crédito e sem Indique e Ganhe, e fecha o problema
// reportado como CORRECTED.
import { describe, it, expect, vi } from 'vitest'
import { AdminOrdersService } from '../admin-orders.service.js'

const now = new Date('2026-10-02T12:00:00.000Z')
const day = new Date('2026-10-02T09:30:00.000Z')

function db(status = 'DELIVERED') {
  const order = { id: 'o1', userId: 'u1', courierId: 'k1', slotId: 'manha', scheduledDate: day, status }
  return {
    order: {
      findUnique: vi.fn(async () => order),
      findMany: vi.fn(async (_args: { where: Record<string, unknown> }) => [{ id: 'o1' }]),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    marketOrder: {
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => [{ id: 'm1' }]),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    courierReport: { updateMany: vi.fn(async () => ({ count: 1 })) },
    creditTransaction: { create: vi.fn(), createMany: vi.fn() },
    notification: { create: vi.fn() },
  }
}

describe('H-2 · correctNotDelivered', () => {
  it('corrige pão + Cestinha da parada, grava quem/quando/nota e fecha o reporte — sem push nem crédito', async () => {
    const prisma = db()
    const svc = new AdminOrdersService({ prisma, log: { warn: vi.fn(), error: vi.fn() } } as never)
    const detail = vi.spyOn(svc, 'getOrderDetail').mockResolvedValue({ id: 'o1' } as never)
    await svc.correctNotDelivered('o1', 'adm1', 'Saquinho voltou com o entregador', now)

    const scope = prisma.order.findMany.mock.calls[0][0].where
    expect(scope).toMatchObject({ userId: 'u1', courierId: 'k1', slotId: 'manha', status: 'DELIVERED' })
    const data = { failedAt: now, failureCode: 'CORRIGIDO_ADMIN', correctedAt: now, correctedById: 'adm1', correctionNote: 'Saquinho voltou com o entregador', status: 'NOT_DELIVERED' }
    expect(prisma.order.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['o1'] }, status: 'DELIVERED' }, data })
    expect(prisma.marketOrder.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['m1'] }, status: 'DELIVERED' }, data })
    expect(prisma.courierReport.updateMany).toHaveBeenCalledWith({
      where: { kind: 'STOP_ISSUE', status: 'OPEN', OR: [{ orderId: { in: ['o1', 'm1'] } }, { marketOrderId: { in: ['o1', 'm1'] } }] },
      data: { status: 'RESOLVED', resolution: 'CORRECTED', resolvedAt: now, resolvedById: 'adm1' },
    })
    expect(prisma.notification.create).not.toHaveBeenCalled()
    expect(prisma.creditTransaction.create).not.toHaveBeenCalled()
    expect(prisma.creditTransaction.createMany).not.toHaveBeenCalled()
    expect(detail).toHaveBeenCalledWith('o1', 'BREAD')
  })

  it('só entrega marcada como entregue: senão 409', async () => {
    const svc = new AdminOrdersService({ prisma: db('NOT_DELIVERED'), log: { warn: vi.fn() } } as never)
    await expect(svc.correctNotDelivered('o1', 'adm1', null, now)).rejects.toMatchObject({ statusCode: 409 })
  })
})
