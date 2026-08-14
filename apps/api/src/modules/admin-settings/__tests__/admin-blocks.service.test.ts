// AdminBlocksService unit tests — bloqueios de DATA/PERÍODO (feriado, férias, obra).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AdminBlocksService } from '../admin-blocks.service.js'

// O aviso ao cliente é best-effort e sai do caminho do teste.
vi.mock('../../notifications/notifications.service.js', () => ({
  NotificationsService: vi.fn().mockImplementation(function () {
    return { notifyUser: vi.fn().mockResolvedValue({}) }
  }),
}))

/** 2026-08-13 ao meio-dia BRT — "hoje" fixo para tornar as datas determinísticas. */
const NOW = new Date('2026-08-13T15:00:00Z')
const TODAY = '2026-08-13'
const D_PLUS_2 = '2026-08-15'
const D_PLUS_5 = '2026-08-18'

/** Date ao meio-dia BRT de uma data "YYYY-MM-DD" — como o app grava scheduledDate. */
function noon(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 15, 0, 0, 0))
}

function makeFastifyMock(
  opts: {
    orders?: Array<{ id: string; userId: string; quantity: number; scheduledDate: Date }>
    marketOrders?: Array<{
      id: string
      userId: string
      status: string
      breadQty: number
      creditsAppliedMilli: number | null
      moneyAmount: number
      scheduledDate: Date
      items: Array<{ productId: string; qty: number }>
    }>
    schedules?: Array<{ userId: string; days: unknown; weeklyQty: unknown; pausedAt: Date | null }>
    blocks?: Array<{ id: string; condominiumId: string | null; startDate: string; endDate: string; reason: string | null }>
    existingRefund?: boolean
    condominium?: { id: string; name: string } | null
  } = {},
) {
  const {
    orders = [],
    marketOrders = [],
    schedules = [],
    blocks = [],
    existingRefund = false,
    condominium = { id: 'condo-1', name: 'Vila Bela' },
  } = opts

  const orderUpdate = vi.fn().mockResolvedValue({})
  const creditTransactionCreate = vi.fn().mockResolvedValue({})
  const userUpdate = vi.fn().mockResolvedValue({})
  const blockCreate = vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 'block-new', condominiumId: null, reason: null, ...data }),
  )
  const blockDelete = vi.fn().mockResolvedValue({})
  const marketOrderUpdate = vi.fn().mockResolvedValue({})

  const prisma = {
    setting: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) =>
        Promise.resolve(where.key === 'avulsoUnit' ? { key: 'avulsoUnit', value: '1.20' } : null),
      ),
    },
    condominium: {
      findUnique: vi.fn().mockResolvedValue(condominium),
      // `listBlocks` resolve os nomes num único fetch; default vazio (só bloqueios globais).
      findMany: vi.fn().mockResolvedValue([]),
    },
    order: { findMany: vi.fn().mockResolvedValue(orders), update: orderUpdate },
    marketOrder: { findMany: vi.fn().mockResolvedValue(marketOrders), update: marketOrderUpdate },
    schedule: { findMany: vi.fn().mockResolvedValue(schedules) },
    creditTransaction: {
      findFirst: vi.fn().mockResolvedValue(existingRefund ? { id: 'ct-old' } : null),
      create: creditTransactionCreate,
    },
    user: { update: userUpdate },
    product: { update: vi.fn().mockResolvedValue({}) },
    productDailyStock: { update: vi.fn().mockResolvedValue({}), upsert: vi.fn().mockResolvedValue({}) },
    deliveryBlock: {
      findMany: vi.fn().mockResolvedValue(blocks),
      findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(blocks.find((b) => b.id === where.id) ?? null),
      ),
      create: blockCreate,
      delete: blockDelete,
    },
    $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        order: { update: orderUpdate },
        creditTransaction: { create: creditTransactionCreate },
        user: { update: userUpdate },
      }),
    ),
  }

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fastify: { prisma, log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } } as any,
    prisma,
    orderUpdate,
    creditTransactionCreate,
    userUpdate,
    blockCreate,
    blockDelete,
  }
}

describe('AdminBlocksService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getImpact', () => {
    it('conta pedidos, Cestinhas, clientes e o estorno previsto', async () => {
      const { fastify } = makeFastifyMock({
        orders: [
          { id: 'o1', userId: 'u1', quantity: 4, scheduledDate: noon(D_PLUS_2) },
          { id: 'o2', userId: 'u2', quantity: 2, scheduledDate: noon(D_PLUS_2) },
        ],
        marketOrders: [
          {
            id: 'm1', userId: 'u1', status: 'SCHEDULED', breadQty: 3,
            creditsAppliedMilli: 1500, moneyAmount: 0,
            scheduledDate: noon(D_PLUS_2), items: [{ productId: 'p1', qty: 2 }],
          },
        ],
      })
      const service = new AdminBlocksService(fastify)
      const impact = await service.getImpact('condo-1', D_PLUS_2, D_PLUS_2)

      expect(impact.orders).toBe(2)
      expect(impact.cestinhas).toBe(1)
      expect(impact.breads).toBe(9) // 4 + 2 do pão + 3 da Cestinha
      expect(impact.cestinhaItems).toBe(2)
      expect(impact.clients).toBe(2) // u1 aparece nos dois, conta 1x
      expect(impact.days).toBe(1)
      // 4 + 2 pães (6) + 1,5 🥖 da Cestinha
      expect(impact.refundableCredits).toBeCloseTo(7.5, 3)
    })

    it('conta os dias do período (inclusivo nas duas pontas)', async () => {
      const { fastify } = makeFastifyMock()
      const service = new AdminBlocksService(fastify)
      expect((await service.getImpact(null, D_PLUS_2, D_PLUS_5)).days).toBe(4)
      expect((await service.getImpact(null, TODAY, TODAY)).days).toBe(1)
    })

    it('recorta o passado: um período que começou antes de hoje conta a partir de hoje', async () => {
      const { fastify, prisma } = makeFastifyMock()
      const service = new AdminBlocksService(fastify)
      const impact = await service.getImpact(null, '2026-08-01', D_PLUS_2)

      expect(impact.days).toBe(3) // 13, 14, 15 — não os 12 dias desde 01/08
      // A janela consultada começa em HOJE, não na data pedida.
      const where = prisma.order.findMany.mock.calls[0][0].where
      expect(where.scheduledDate.gte.toISOString()).toBe('2026-08-13T03:00:00.000Z')
    })

    it('restringe ao condomínio quando o bloqueio é local, e não restringe quando é global', async () => {
      const { fastify, prisma } = makeFastifyMock()
      const service = new AdminBlocksService(fastify)

      await service.getImpact('condo-1', D_PLUS_2, D_PLUS_2)
      expect(prisma.order.findMany.mock.calls[0][0].where.condominiumId).toBe('condo-1')

      prisma.order.findMany.mockClear()
      await service.getImpact(null, D_PLUS_2, D_PLUS_2)
      expect(prisma.order.findMany.mock.calls[0][0].where.condominiumId).toBeUndefined()
    })

    it('conta agendas ativas que entregam em algum dia do período (pausadas fora)', async () => {
      // 2026-08-15 é um sábado.
      const { fastify } = makeFastifyMock({
        schedules: [
          { userId: 'u1', days: { manha: { sab: 2 } }, weeklyQty: null, pausedAt: null },
          { userId: 'u2', days: { manha: { seg: 2 } }, weeklyQty: null, pausedAt: null },
          { userId: 'u3', days: { manha: { sab: 5 } }, weeklyQty: null, pausedAt: new Date() },
        ],
      })
      const service = new AdminBlocksService(fastify)
      const impact = await service.getImpact(null, D_PLUS_2, D_PLUS_2)
      expect(impact.schedules).toBe(1) // só u1: u2 não entrega no sábado, u3 está pausado
    })

    it('recusa (422) período inválido', async () => {
      const { fastify } = makeFastifyMock()
      const service = new AdminBlocksService(fastify)
      await expect(service.getImpact(null, D_PLUS_5, D_PLUS_2)).rejects.toMatchObject({ statusCode: 422 })
      await expect(service.getImpact(null, '2026-07-01', '2026-07-10')).rejects.toMatchObject({ statusCode: 422 })
    })
  })

  describe('createBlock', () => {
    it('grava o bloqueio sem condominiumId quando é global', async () => {
      const { fastify, blockCreate } = makeFastifyMock()
      const service = new AdminBlocksService(fastify)
      await service.createBlock({ startDate: D_PLUS_2, endDate: D_PLUS_2, reason: 'Feriado' })

      // Chave AUSENTE (não null): é assim que `isSet: false` distingue o bloqueio global.
      const data = blockCreate.mock.calls[0][0].data
      expect(data).toEqual({ startDate: D_PLUS_2, endDate: D_PLUS_2, reason: 'Feriado' })
      expect('condominiumId' in data).toBe(false)
    })

    it('sem cancelExisting NÃO cancela nada, só grava', async () => {
      const { fastify, orderUpdate, creditTransactionCreate } = makeFastifyMock({
        orders: [{ id: 'o1', userId: 'u1', quantity: 4, scheduledDate: noon(D_PLUS_2) }],
      })
      const service = new AdminBlocksService(fastify)
      const res = await service.createBlock({ startDate: D_PLUS_2, endDate: D_PLUS_2 })

      expect(res.cancelled).toEqual({ orders: 0, cestinhas: 0, refundedCredits: 0 })
      expect(orderUpdate).not.toHaveBeenCalled()
      expect(creditTransactionCreate).not.toHaveBeenCalled()
    })

    it('com cancelExisting cancela o pedido e estorna os pãezins', async () => {
      const { fastify, orderUpdate, creditTransactionCreate, userUpdate } = makeFastifyMock({
        orders: [{ id: 'o1', userId: 'u1', quantity: 4, scheduledDate: noon(D_PLUS_2) }],
      })
      const service = new AdminBlocksService(fastify)
      const res = await service.createBlock({
        startDate: D_PLUS_2,
        endDate: D_PLUS_2,
        reason: 'Feriado',
        cancelExisting: true,
      })

      expect(res.cancelled.orders).toBe(1)
      expect(res.cancelled.refundedCredits).toBe(4)
      expect(orderUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'o1' },
          data: expect.objectContaining({ status: 'CANCELLED', cancelReason: expect.stringContaining('Feriado') }),
        }),
      )
      expect(creditTransactionCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'REFUND', quantityMilli: 4000 }) }),
      )
      expect(userUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: { creditMilli: { increment: 4000 } } }),
      )
    })

    it('estorno é idempotente: pedido já estornado é cancelado sem creditar de novo', async () => {
      const { fastify, orderUpdate, creditTransactionCreate } = makeFastifyMock({
        orders: [{ id: 'o1', userId: 'u1', quantity: 4, scheduledDate: noon(D_PLUS_2) }],
        existingRefund: true,
      })
      const service = new AdminBlocksService(fastify)
      const res = await service.createBlock({ startDate: D_PLUS_2, endDate: D_PLUS_2, cancelExisting: true })

      expect(orderUpdate).toHaveBeenCalled() // ainda cancela
      expect(creditTransactionCreate).not.toHaveBeenCalled() // mas não credita 2×
      expect(res.cancelled.refundedCredits).toBe(0)
    })

    it('uma falha isolada não aborta os demais cancelamentos', async () => {
      const { fastify, prisma } = makeFastifyMock({
        orders: [
          { id: 'o1', userId: 'u1', quantity: 2, scheduledDate: noon(D_PLUS_2) },
          { id: 'o2', userId: 'u2', quantity: 3, scheduledDate: noon(D_PLUS_2) },
        ],
      })
      let call = 0
      prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
        call++
        if (call === 1) throw new Error('falha transitória')
        return cb({
          order: { update: vi.fn().mockResolvedValue({}) },
          creditTransaction: { create: vi.fn().mockResolvedValue({}) },
          user: { update: vi.fn().mockResolvedValue({}) },
        })
      })

      const service = new AdminBlocksService(fastify)
      const res = await service.createBlock({ startDate: D_PLUS_2, endDate: D_PLUS_2, cancelExisting: true })

      expect(res.cancelled.orders).toBe(1) // o segundo passou
      expect(fastify.log.error).toHaveBeenCalled()
    })

    it('recusa (404) condomínio inexistente', async () => {
      const { fastify, blockCreate } = makeFastifyMock({ condominium: null })
      const service = new AdminBlocksService(fastify)
      await expect(
        service.createBlock({ condominiumId: 'nope', startDate: D_PLUS_2, endDate: D_PLUS_2 }),
      ).rejects.toMatchObject({ statusCode: 404 })
      expect(blockCreate).not.toHaveBeenCalled()
    })

    it('recusa (422) período no passado sem gravar', async () => {
      const { fastify, blockCreate } = makeFastifyMock()
      const service = new AdminBlocksService(fastify)
      await expect(
        service.createBlock({ startDate: '2026-07-01', endDate: '2026-07-05' }),
      ).rejects.toMatchObject({ statusCode: 422 })
      expect(blockCreate).not.toHaveBeenCalled()
    })
  })

  describe('listBlocks', () => {
    it('esconde períodos encerrados por padrão e inclui com includePast', async () => {
      const { fastify, prisma } = makeFastifyMock()
      const service = new AdminBlocksService(fastify)

      await service.listBlocks(null, false)
      expect(prisma.deliveryBlock.findMany.mock.calls[0][0].where.endDate).toEqual({ gte: TODAY })

      prisma.deliveryBlock.findMany.mockClear()
      await service.listBlocks(null, true)
      expect(prisma.deliveryBlock.findMany.mock.calls[0][0].where.endDate).toBeUndefined()
    })

    it('com condominiumId traz os do condomínio + os globais (null E chave ausente)', async () => {
      const { fastify, prisma } = makeFastifyMock()
      const service = new AdminBlocksService(fastify)
      await service.listBlocks('condo-1')

      expect(prisma.deliveryBlock.findMany.mock.calls[0][0].where.OR).toEqual([
        { condominiumId: 'condo-1' },
        { condominiumId: null },
        { condominiumId: { isSet: false } },
      ])
    })

    it('marca isPast e resolve o nome do condomínio', async () => {
      const { fastify, prisma } = makeFastifyMock({
        blocks: [
          { id: 'b1', condominiumId: 'condo-1', startDate: '2026-07-01', endDate: '2026-07-02', reason: null },
          { id: 'b2', condominiumId: null, startDate: D_PLUS_2, endDate: D_PLUS_2, reason: 'Feriado' },
        ],
      })
      prisma.condominium.findMany = vi.fn().mockResolvedValue([{ id: 'condo-1', name: 'Vila Bela' }])

      const service = new AdminBlocksService(fastify)
      const rows = await service.listBlocks(null, true)

      expect(rows[0]).toMatchObject({ id: 'b1', isPast: true, condominiumName: 'Vila Bela' })
      expect(rows[1]).toMatchObject({ id: 'b2', isPast: false, condominiumName: null })
    })
  })

  describe('deleteBlock', () => {
    it('remove o bloqueio existente', async () => {
      const { fastify, blockDelete } = makeFastifyMock({
        blocks: [{ id: 'b1', condominiumId: null, startDate: D_PLUS_2, endDate: D_PLUS_2, reason: null }],
      })
      const service = new AdminBlocksService(fastify)
      await service.deleteBlock('b1')
      expect(blockDelete).toHaveBeenCalledWith({ where: { id: 'b1' } })
    })

    it('404 em bloqueio inexistente', async () => {
      const { fastify, blockDelete } = makeFastifyMock()
      const service = new AdminBlocksService(fastify)
      await expect(service.deleteBlock('nope')).rejects.toMatchObject({ statusCode: 404 })
      expect(blockDelete).not.toHaveBeenCalled()
    })
  })
})
