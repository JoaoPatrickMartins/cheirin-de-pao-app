// Aceitar ou recusar o turno (plano-termos-legais §5): recusa sem penalidade devolve as paradas
// para a divisão e avisa o admin; depois de iniciar a rota, não dá mais para recusar.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const notifyAdmins = vi.hoisted(() => vi.fn())
vi.mock('../../notifications/notifications.service.js', () => ({
  NotificationsService: class {
    notifyAdmins = notifyAdmins
  },
}))

import { CourierShiftService } from '../courier-shifts.js'

const now = new Date('2026-10-02T08:00:00.000Z') // 05:00 BRT
const offer = (over: Record<string, unknown> = {}) => ({ id: 'o1', courierId: 'k1', date: '2026-10-02', slotId: 'manha', status: 'OFFERED', stops: 18, offeredAt: now, ...over })

function setup(over: { offer?: unknown; offers?: unknown[]; run?: unknown; resolved?: number; marketResolved?: number; hooksResolved?: unknown[] } = {}) {
  const prisma = {
    courierShiftOffer: {
      findUnique: vi.fn().mockResolvedValue(over.offer === undefined ? offer() : over.offer),
      findMany: vi.fn().mockResolvedValue(over.offers ?? []),
      update: vi.fn().mockResolvedValue({}),
    },
    courierRun: { findUnique: vi.fn().mockResolvedValue(over.run ?? null) },
    order: { count: vi.fn().mockResolvedValue(over.resolved ?? 0), updateMany: vi.fn().mockResolvedValue({ count: 17 }) },
    marketOrder: { count: vi.fn().mockResolvedValue(over.marketResolved ?? 0), updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
    hookRequest: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), findMany: vi.fn().mockResolvedValue([]) },
    deliveryProof: { findMany: vi.fn().mockResolvedValue(over.hooksResolved ?? []) },
    user: { findUnique: vi.fn().mockResolvedValue({ name: 'Antônio Ribeiro' }) },
    setting: { findUnique: vi.fn().mockResolvedValue(null) },
  }
  return { prisma, service: new CourierShiftService({ prisma, log: { warn: vi.fn() } } as never) }
}

beforeEach(() => vi.clearAllMocks())

describe('turnos de hoje', () => {
  it('a oferta mais recente de cada turno, na ordem do horário, com rótulo e hora', async () => {
    const { service } = setup({
      offers: [
        offer({ id: 't2', slotId: 'tarde', status: 'ACCEPTED', stops: 5 }),
        offer({ id: 'm2', stops: 18, offeredAt: new Date('2026-10-02T08:30:00Z') }),
        offer({ id: 'm1', stops: 12 }),
      ],
    })
    const list = await service.today('k1', now)
    expect(list.map((s) => [s.id, s.label, s.time, s.status, s.stops])).toEqual([
      ['m2', 'Manhã', '06:30', 'OFFERED', 18],
      ['t2', 'Tarde', '15:30', 'ACCEPTED', 5],
    ])
  })
})

describe('aceitar', () => {
  it('OFFERED → ACCEPTED pelo botão; aceito de novo não regrava; recusado ou retirado → 409; de outro → 404', async () => {
    const { prisma, service } = setup()
    expect(await service.accept('k1', 'o1', now)).toEqual({ id: 'o1', status: 'ACCEPTED' })
    expect(prisma.courierShiftOffer.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { status: 'ACCEPTED', respondedAt: now, via: 'BUTTON' } })
    const again = setup({ offer: offer({ status: 'ACCEPTED' }) })
    await again.service.accept('k1', 'o1', now)
    expect(again.prisma.courierShiftOffer.update).not.toHaveBeenCalled()
    await expect(setup({ offer: offer({ status: 'DECLINED' }) }).service.accept('k1', 'o1', now)).rejects.toMatchObject({ statusCode: 409, code: 'DECLINED' })
    await expect(setup({ offer: offer({ status: 'WITHDRAWN' }) }).service.accept('k1', 'o1', now)).rejects.toMatchObject({ statusCode: 409, code: 'WITHDRAWN' })
    await expect(setup({ offer: offer({ courierId: 'outro' }) }).service.accept('k1', 'o1', now)).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('recusar (sem penalidade)', () => {
  it('gancho sozinho do turno (sem pão) volta para a fila com o motivo', async () => {
    const { prisma, service } = setup()
    prisma.hookRequest.findMany.mockResolvedValue([{ id: 'h9', userId: 'u9', routeSlotId: 'manha', routeCourierId: 'k1' }])
    Object.assign(prisma.order, { findMany: vi.fn().mockResolvedValue([]) })
    Object.assign(prisma.marketOrder, { findMany: vi.fn().mockResolvedValue([]) })
    await service.decline('k1', 'o1', null, now)
    expect(prisma.hookRequest.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['h9'] }, status: 'REQUESTED' },
      data: { routeDate: null, routeSlotId: null, routeCourierId: null, routeFailedAt: now, routeFailedReason: 'Entregador recusou o turno' },
    })
  })

  it('devolve pão, Cestinha e gancho do turno para a divisão, grava o motivo e avisa os admins', async () => {
    const { prisma, service } = setup({ offer: offer({ status: 'ACCEPTED' }) })
    expect(await service.decline('k1', 'o1', 'VEICULO', now)).toEqual({ id: 'o1', status: 'DECLINED', released: 19 })
    const scope = expect.objectContaining({ courierId: 'k1', slotId: 'manha', status: 'OUT_FOR_DELIVERY' })
    expect(prisma.order.updateMany).toHaveBeenCalledWith({ where: scope, data: { courierId: null, status: 'SEPARATED' } })
    expect(prisma.marketOrder.updateMany).toHaveBeenCalledWith({ where: scope, data: { courierId: null, status: 'SEPARATED' } })
    expect(prisma.hookRequest.updateMany).toHaveBeenCalledWith({ where: { routeCourierId: 'k1', routeDate: '2026-10-02', routeSlotId: 'manha', status: 'REQUESTED' }, data: { routeCourierId: null } })
    expect(prisma.courierShiftOffer.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { status: 'DECLINED', respondedAt: now, reason: 'VEICULO' } })
    expect(notifyAdmins).toHaveBeenCalledWith({
      type: 'ADMIN_SHIFT_DECLINED',
      title: 'Turno recusado',
      body: 'Antônio recusou o turno da manhã (problema no veículo). 18 paradas voltaram para a divisão.',
      actionRoute: '/admin',
      dedupeKey: 'shift-declined:o1',
    })
  })

  it('sem motivo também vale', async () => {
    const { service } = setup()
    await service.decline('k1', 'o1', null, now)
    expect(notifyAdmins.mock.calls[0][0].body).toBe('Antônio recusou o turno da manhã. 18 paradas voltaram para a divisão.')
  })

  it('rota iniciada ou com parada resolvida → 409 STARTED, nada é devolvido; turno de outro dia → 409 PAST', async () => {
    for (const s of [setup({ run: { status: 'STARTED' } }), setup({ resolved: 1 }), setup({ marketResolved: 1 })]) {
      await expect(s.service.decline('k1', 'o1', null, now)).rejects.toMatchObject({ statusCode: 409, code: 'STARTED' })
      expect(s.prisma.order.updateMany).not.toHaveBeenCalled()
    }
    await expect(setup({ offer: offer({ date: '2026-10-01' }) }).service.decline('k1', 'o1', null, now)).rejects.toMatchObject({ statusCode: 409, code: 'PAST' })
  })

  it('gancho sozinho resolvido no turno, sem a rota ter iniciado → 409 STARTED, nada é devolvido nem avisado', async () => {
    const s = setup({ hooksResolved: [{ hookRequestId: 'h9', courierId: 'k1', userId: 'u9', condominiumId: 'c1', slotId: 'manha', date: '2026-10-02', outcome: 'DELIVERED', status: 'OK', createdAt: now }] })
    await expect(s.service.decline('k1', 'o1', null, now)).rejects.toMatchObject({ statusCode: 409, code: 'STARTED' })
    expect(s.prisma.deliveryProof.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ courierId: { in: ['k1'] }, date: { gte: '2026-10-02', lte: '2026-10-02' }, slotId: 'manha' }) }))
    expect(s.prisma.order.updateMany).not.toHaveBeenCalled()
    expect(s.prisma.hookRequest.updateMany).not.toHaveBeenCalled()
    expect(s.prisma.courierShiftOffer.update).not.toHaveBeenCalled()
    expect(notifyAdmins).not.toHaveBeenCalled()
  })
})
