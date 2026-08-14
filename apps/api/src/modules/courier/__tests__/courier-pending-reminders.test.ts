// sendCourierPendingReminders — lembrete ao entregador no horário de início do turno.
//
// O ponto sob teste é o DISPARO POR HORÁRIO EFETIVO: o entregador de um condomínio que entrega
// 05:00 é lembrado às 05:00, e não às 06:30 (quando a rota já deveria estar terminando).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CourierService } from '../courier.service.js'

const notifyUser = vi.fn().mockResolvedValue({})
vi.mock('../../notifications/notifications.service.js', () => ({
  NotificationsService: vi.fn().mockImplementation(function () {
    return { notifyUser }
  }),
}))

const MANHA = { slotId: 'manha', name: 'manha', time: '06:30', cutoffTime: '22:00', isActive: true }

/** Instante UTC de um "HH:MM" BRT em 2026-08-13. */
function at(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(Date.UTC(2026, 7, 13, h + 3, m, 0, 0))
}

function makeFastifyMock(opts: {
  condominiums: Array<{ id: string; name: string; deliverySlots: unknown[] }>
  orders?: Array<{ courierId: string | null; status: string }>
}) {
  const orderFindMany = vi.fn().mockResolvedValue(opts.orders ?? [])
  const prisma = {
    setting: { findUnique: vi.fn().mockResolvedValue(null) }, // slots globais = DEFAULT
    condominium: { findMany: vi.fn().mockResolvedValue(opts.condominiums) },
    order: { findMany: orderFindMany },
    marketOrder: { findMany: vi.fn().mockResolvedValue([]) },
  }
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fastify: { prisma, log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } } as any,
    orderFindMany,
  }
}

describe('sendCourierPendingReminders — disparo por horário efetivo', () => {
  beforeEach(() => {
    notifyUser.mockClear()
  })

  it('lembra no horário do padrão quando o condomínio herda', async () => {
    const { fastify } = makeFastifyMock({
      condominiums: [{ id: 'c1', name: 'Alfa', deliverySlots: [MANHA] }],
      orders: [{ courierId: 'cour-1', status: 'SCHEDULED' }],
    })
    const service = new CourierService(fastify)

    await service.sendCourierPendingReminders(at('06:29'))
    expect(notifyUser).not.toHaveBeenCalled()

    await service.sendCourierPendingReminders(at('06:30'))
    expect(notifyUser).toHaveBeenCalledTimes(1)
    expect(notifyUser.mock.calls[0][0]).toBe('cour-1')
    expect(notifyUser.mock.calls[0][1].body).toContain('turno Manhã')
  })

  it('condomínio que entrega mais cedo lembra o entregador no horário DELE', async () => {
    const cedo = { ...MANHA, time: '05:00', timeCustom: true }
    const { fastify, orderFindMany } = makeFastifyMock({
      condominiums: [
        { id: 'c1', name: 'Alfa', deliverySlots: [MANHA] },
        { id: 'c2', name: 'Beta', deliverySlots: [cedo] },
      ],
      orders: [{ courierId: 'cour-2', status: 'SCHEDULED' }],
    })
    const service = new CourierService(fastify)

    await service.sendCourierPendingReminders(at('05:00'))
    expect(notifyUser).toHaveBeenCalledTimes(1)
    // A rota consultada é só a do condomínio que começou agora.
    expect(orderFindMany.mock.calls[0][0].where.condominiumId).toEqual({ in: ['c2'] })

    notifyUser.mockClear()
    orderFindMany.mockClear()
    await service.sendCourierPendingReminders(at('06:30'))
    expect(orderFindMany.mock.calls[0][0].where.condominiumId).toEqual({ in: ['c1'] })
  })

  it('não lembra quem já começou a rota (tem entrega concluída no turno)', async () => {
    const { fastify } = makeFastifyMock({
      condominiums: [{ id: 'c1', name: 'Alfa', deliverySlots: [MANHA] }],
      orders: [
        { courierId: 'cour-1', status: 'DELIVERED' },
        { courierId: 'cour-1', status: 'SCHEDULED' },
        { courierId: 'cour-2', status: 'SCHEDULED' },
      ],
    })
    const service = new CourierService(fastify)
    await service.sendCourierPendingReminders(at('06:30'))

    expect(notifyUser).toHaveBeenCalledTimes(1)
    expect(notifyUser.mock.calls[0][0]).toBe('cour-2') // cour-1 já agiu
  })

  it('sem rota atribuída não notifica', async () => {
    const { fastify } = makeFastifyMock({
      condominiums: [{ id: 'c1', name: 'Alfa', deliverySlots: [MANHA] }],
      orders: [],
    })
    const service = new CourierService(fastify)
    await service.sendCourierPendingReminders(at('06:30'))
    expect(notifyUser).not.toHaveBeenCalled()
  })
})
