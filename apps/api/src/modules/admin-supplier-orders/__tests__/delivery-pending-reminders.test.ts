// sendDeliveryPendingReminders — aviso ao admin de entregas pendentes após o prazo do turno.
//
// O ponto sob teste é o DISPARO POR HORÁRIO EFETIVO: cada condomínio é avisado no horário DELE,
// não no do padrão global, e condomínios que compartilham o horário caem num aviso só.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AdminSupplierOrdersService } from '../admin-supplier-orders.service.js'

const notifyAdmins = vi.fn().mockResolvedValue({})
vi.mock('../../notifications/notifications.service.js', () => ({
  NotificationsService: vi.fn().mockImplementation(function () {
    return { notifyAdmins }
  }),
}))

const MANHA = { slotId: 'manha', name: 'manha', time: '06:30', cutoffTime: '22:00', isActive: true }
const TARDE = { slotId: 'tarde', name: 'tarde', time: '15:30', cutoffTime: '10:00', isActive: true }

/** Instante UTC de um "HH:MM" BRT em 2026-08-13. */
function at(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(Date.UTC(2026, 7, 13, h + 3, m, 0, 0))
}

function makeFastifyMock(opts: {
  condominiums: Array<{ id: string; name: string; deliverySlots: unknown[] }>
  orders?: Array<{ userId: string; quantity: number }>
}) {
  const orderFindMany = vi.fn().mockResolvedValue(opts.orders ?? [])
  const marketFindMany = vi.fn().mockResolvedValue([])
  const prisma = {
    setting: { findUnique: vi.fn().mockResolvedValue(null) }, // slots globais = DEFAULT
    condominium: { findMany: vi.fn().mockResolvedValue(opts.condominiums) },
    order: { findMany: orderFindMany },
    marketOrder: { findMany: marketFindMany },
  }
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fastify: { prisma, log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } } as any,
    orderFindMany,
  }
}

describe('sendDeliveryPendingReminders — disparo por horário efetivo', () => {
  beforeEach(() => {
    notifyAdmins.mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('sem personalização: um aviso por turno, cobrindo todos, sem nomear condomínios', async () => {
    const { fastify } = makeFastifyMock({
      condominiums: [
        { id: 'c1', name: 'Alfa', deliverySlots: [MANHA, TARDE] },
        { id: 'c2', name: 'Beta', deliverySlots: [MANHA, TARDE] },
      ],
      orders: [{ userId: 'u1', quantity: 4 }],
    })
    const service = new AdminSupplierOrdersService(fastify)
    // Manhã 06:30 + 60min de buffer → 07:30.
    await service.sendDeliveryPendingReminders(at('07:30'))

    expect(notifyAdmins).toHaveBeenCalledTimes(1)
    const body = notifyAdmins.mock.calls[0][0].body as string
    expect(body).toContain('turno Manhã')
    expect(body).not.toContain('Alfa') // cobre todos → não precisa dizer onde
  })

  it('não dispara fora do minuto exato', async () => {
    const { fastify } = makeFastifyMock({
      condominiums: [{ id: 'c1', name: 'Alfa', deliverySlots: [MANHA] }],
      orders: [{ userId: 'u1', quantity: 4 }],
    })
    const service = new AdminSupplierOrdersService(fastify)
    await service.sendDeliveryPendingReminders(at('07:29'))
    await service.sendDeliveryPendingReminders(at('07:31'))
    expect(notifyAdmins).not.toHaveBeenCalled()
  })

  it('condomínio com horário próprio é avisado no horário DELE, nomeado', async () => {
    const cedo = { ...MANHA, time: '05:00', timeCustom: true }
    const { fastify, orderFindMany } = makeFastifyMock({
      condominiums: [
        { id: 'c1', name: 'Alfa', deliverySlots: [MANHA] },
        { id: 'c2', name: 'Beta', deliverySlots: [cedo] },
      ],
      orders: [{ userId: 'u1', quantity: 3 }],
    })
    const service = new AdminSupplierOrdersService(fastify)

    // 05:00 + 60 = 06:00 → só o Beta.
    await service.sendDeliveryPendingReminders(at('06:00'))
    expect(notifyAdmins).toHaveBeenCalledTimes(1)
    expect(notifyAdmins.mock.calls[0][0].body).toContain('em Beta')
    // A consulta foi restrita àquele condomínio.
    expect(orderFindMany.mock.calls[0][0].where.condominiumId).toEqual({ in: ['c2'] })

    // 06:30 + 60 = 07:30 → só o Alfa (que também é o único do grupo → nomeado).
    notifyAdmins.mockClear()
    orderFindMany.mockClear()
    await service.sendDeliveryPendingReminders(at('07:30'))
    expect(notifyAdmins).toHaveBeenCalledTimes(1)
    expect(notifyAdmins.mock.calls[0][0].body).toContain('em Alfa')
    expect(orderFindMany.mock.calls[0][0].where.condominiumId).toEqual({ in: ['c1'] })
  })

  it('condomínios que compartilham o horário caem num aviso só', async () => {
    const cedo = { ...MANHA, time: '05:00', timeCustom: true }
    const { fastify, orderFindMany } = makeFastifyMock({
      condominiums: [
        { id: 'c1', name: 'Alfa', deliverySlots: [cedo] },
        { id: 'c2', name: 'Beta', deliverySlots: [cedo] },
      ],
      orders: [{ userId: 'u1', quantity: 3 }],
    })
    const service = new AdminSupplierOrdersService(fastify)
    await service.sendDeliveryPendingReminders(at('06:00'))

    expect(notifyAdmins).toHaveBeenCalledTimes(1)
    expect(orderFindMany.mock.calls[0][0].where.condominiumId).toEqual({ in: ['c1', 'c2'] })
    // Cobre todos os condomínios que têm o turno → volta a não nomear.
    expect(notifyAdmins.mock.calls[0][0].body).not.toContain('Alfa')
  })

  it('turno desligado num condomínio não gera aviso para ele', async () => {
    const semManha = { ...MANHA, isActive: false, activeCustom: true }
    const { fastify, orderFindMany } = makeFastifyMock({
      condominiums: [
        { id: 'c1', name: 'Alfa', deliverySlots: [MANHA] },
        { id: 'c2', name: 'Beta', deliverySlots: [semManha] },
      ],
      orders: [{ userId: 'u1', quantity: 3 }],
    })
    const service = new AdminSupplierOrdersService(fastify)
    await service.sendDeliveryPendingReminders(at('07:30'))

    expect(orderFindMany.mock.calls[0][0].where.condominiumId).toEqual({ in: ['c1'] })
  })

  it('sem pendências não notifica', async () => {
    const { fastify } = makeFastifyMock({
      condominiums: [{ id: 'c1', name: 'Alfa', deliverySlots: [MANHA] }],
      orders: [],
    })
    const service = new AdminSupplierOrdersService(fastify)
    await service.sendDeliveryPendingReminders(at('07:30'))
    expect(notifyAdmins).not.toHaveBeenCalled()
  })
})
