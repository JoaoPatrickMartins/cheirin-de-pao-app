// V-18 do plano do entregador: UM aviso de "entregue" por parada (pão + Cestinha), e o aviso de
// uma entrega feita pelo entregador leva ao comprovante quando a foto é visível ao cliente.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@onesignal/node-onesignal', () => ({
  createConfiguration: vi.fn().mockReturnValue({}),
  DefaultApi: vi.fn().mockImplementation(() => ({ createNotification: vi.fn().mockResolvedValue({}) })),
  Notification: vi.fn().mockImplementation(() => ({})),
}))
const pipeline = vi.hoisted(() => ({ moved: 0 }))
vi.mock('../../../lib/market-pipeline.js', () => ({
  propagateMarketStatusForOrder: vi.fn(async () => pipeline.moved),
  dispatchMarketForOrders: vi.fn(),
  assignMarketByCondoDay: vi.fn(),
}))
const notify = vi.hoisted(() => ({ notifyMarketDelivered: vi.fn(), notifyMarketNotDelivered: vi.fn(), notifyMarketCancelled: vi.fn() }))
vi.mock('../../market/market-notify.js', () => notify)
vi.mock('../../../lib/referral.js', () => ({ afterDelivery: vi.fn() }))

import { AdminOrdersService } from '../admin-orders.service.js'

function setup(order: Record<string, unknown>, settings: Array<{ key: string; value: string }> = []) {
  const prisma = {
    order: { findUnique: vi.fn().mockResolvedValue(order), update: vi.fn().mockResolvedValue({}) },
    user: { findUnique: vi.fn().mockResolvedValue({ oneSignalPlayerId: null, name: 'Maria' }), findMany: vi.fn().mockResolvedValue([]) },
    setting: { findMany: vi.fn().mockResolvedValue(settings) },
    notification: { create: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { prisma, service: new AdminOrdersService({ prisma, log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } } as any) }
}

const base = { id: 'o1', userId: 'u1', quantity: 4, status: 'OUT_FOR_DELIVERY', slotId: 'manha', condominiumId: 'c1', scheduledDate: new Date() }

beforeEach(() => {
  vi.clearAllMocks()
  pipeline.moved = 0
})

describe('aviso de entrega — um por parada', () => {
  it('pão + Cestinha: um aviso só, citando a Cestinha; o aviso separado da Cestinha não sai', async () => {
    pipeline.moved = 2
    const { prisma, service } = setup({ ...base, courierId: 'courier-01' })
    await service.updateOrderStatus('o1', 'DELIVERED')
    const created = prisma.notification.create.mock.calls.map((c) => c[0].data)
    const done = created.filter((d: { type: string }) => d.type === 'DELIVERY_DONE')
    expect(done).toHaveLength(1)
    expect(done[0].body).toBe('Seus 4 pães e a Cestinha foram entregues. Bom apetite!')
    expect(notify.notifyMarketDelivered).not.toHaveBeenCalled()
  })

  it('entrega do entregador com foto visível → o aviso leva ao comprovante', async () => {
    const { prisma, service } = setup({ ...base, courierId: 'courier-01' })
    await service.updateOrderStatus('o1', 'DELIVERED')
    const done = prisma.notification.create.mock.calls.map((c) => c[0].data).find((d: { type: string }) => d.type === 'DELIVERY_DONE')
    expect(done.actionRoute).toBe('/client/pedidos?comprovante=o1')
    expect(done.body).toBe('Seus 4 pães foram entregues. Bom apetite!')
  })

  it('foto escondida pelo admin, ou entrega sem entregador → aviso comum', async () => {
    const { prisma, service } = setup({ ...base, courierId: 'courier-01' }, [{ key: 'fotoClienteVisivel', value: 'false' }])
    await service.updateOrderStatus('o1', 'DELIVERED')
    const done = prisma.notification.create.mock.calls.map((c) => c[0].data).find((d: { type: string }) => d.type === 'DELIVERY_DONE')
    expect(done.actionRoute).toBe('/client/pedidos')

    const { prisma: p2, service: s2 } = setup({ ...base, courierId: null })
    await s2.updateOrderStatus('o1', 'DELIVERED')
    const done2 = p2.notification.create.mock.calls.map((c) => c[0].data).find((d: { type: string }) => d.type === 'DELIVERY_DONE')
    expect(done2.actionRoute).toBe('/client/pedidos')
  })
})
