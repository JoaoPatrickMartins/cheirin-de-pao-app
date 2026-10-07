// Onda 3 do app do entregador — não entrega com motivo padronizado, foto do comprovante
// (privada) e "seguir sem foto", respeitando a regra de cada entregador.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const storage = vi.hoisted(() => ({
  configured: true,
  uploadPrivateImage: vi.fn(async () => 'deliveries/0b9d8a2e-1c3f-4d5e-9a7b-123456789abc.jpg'),
}))
vi.mock('../../../lib/storage.js', () => ({
  isStorageConfigured: () => storage.configured,
  uploadPrivateImage: storage.uploadPrivateImage,
  StorageError: class StorageError extends Error {},
}))
vi.mock('../../../lib/referral.js', () => ({ afterDelivery: vi.fn() }))
vi.mock('../../market/market-notify.js', () => ({ notifyMarketDelivered: vi.fn(), notifyMarketNotDelivered: vi.fn() }))
vi.mock('../../../lib/market-pipeline.js', () => ({
  completeMarketStop: vi.fn().mockResolvedValue(1),
  propagateMarketStatusForOrder: vi.fn().mockResolvedValue(0),
}))

import { CourierService } from '../courier.service.js'

const day = new Date('2026-10-01T15:00:00Z')
const order = { id: '66f1a2b3c4d5e6f7a8b9c0d1', userId: 'u1', courierId: 'courier-01', quantity: 4, status: 'OUT_FOR_DELIVERY', slotId: 'manha', scheduledDate: day, condominiumId: 'c1', deliveredAt: null, failedAt: null }

function makePrisma(over: { courierRules?: unknown; proof?: Record<string, unknown> | null; orderStatus?: string } = {}) {
  let status = over.orderStatus ?? 'OUT_FOR_DELIVERY'
  const prisma = {
    order: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === order.id ? { ...order, status } : null)),
      update: vi.fn(async ({ data }: { data: { status?: string } }) => {
        if (data.status) status = data.status
        return {}
      }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    marketOrder: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === 'courier-01' ? { courierRules: over.courierRules ?? null } : { name: 'Maria', condominiumId: 'c1', apartment: '101', block: null, complement: null, oneSignalPlayerId: null },
      ),
      findMany: vi.fn().mockResolvedValue([]),
    },
    condominium: { findUnique: vi.fn().mockResolvedValue({ name: 'Jardins' }) },
    hookRequest: { findFirst: vi.fn().mockResolvedValue(null) },
    setting: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue(null) },
    notification: { create: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
    deliveryProof: {
      findUnique: vi.fn().mockResolvedValue(over.proof === undefined ? { id: 'p1', status: 'PENDING', required: true, outcome: 'DELIVERED', photoAt: null, note: null } : over.proof),
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ status: 'PENDING', required: true, outcome: 'DELIVERED', photoAt: null, note: null, ...data })),
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { prisma, service: new CourierService({ prisma, log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } } as any) }
}

beforeEach(() => {
  storage.configured = true
  storage.uploadPrivateImage.mockClear()
})

describe('markNotDelivered — motivo padronizado (M-4)', () => {
  it('grava o código, o texto do admin vira o rótulo, e o comprovante da não entrega fica PENDENTE (obrigatório por padrão)', async () => {
    const { prisma, service } = makePrisma()
    const summary = await service.markNotDelivered(order.id, 'courier-01', { failureCode: 'PORTARIA_NAO_LIBEROU', via: 'LIST' })
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'NOT_DELIVERED', failureReason: 'Portaria não liberou' }) }),
    )
    expect(prisma.order.update).toHaveBeenCalledWith({ where: { id: order.id }, data: { failureCode: 'PORTARIA_NAO_LIBEROU', confirmedVia: 'LIST' } })
    const proof = prisma.deliveryProof.upsert.mock.calls[0][0]
    expect(proof.where.courierId_userId_slotId_date_outcome.outcome).toBe('NOT_DELIVERED')
    expect(proof.create).toMatchObject({ status: 'PENDING', required: true })
    expect(summary.proofRequired).toBe(true)
  })

  it('motivo + detalhe: "Portaria não liberou — porteiro não atendeu"', async () => {
    const { prisma, service } = makePrisma()
    await service.markNotDelivered(order.id, 'courier-01', { failureCode: 'PORTARIA_NAO_LIBEROU', reason: 'porteiro não atendeu' })
    expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ failureReason: 'Portaria não liberou — porteiro não atendeu' }) }))
  })

  it('entregador sem foto obrigatória na não entrega → comprovante não obrigatório', async () => {
    const { service } = makePrisma({ courierRules: { fotoNaoEntrega: false } })
    const summary = await service.markNotDelivered(order.id, 'courier-01', { failureCode: 'CLIENTE_AUSENTE' })
    expect(summary.proofRequired).toBe(false)
  })

  it('parada já entregue → 409 (não marca não entregue por cima)', async () => {
    const { prisma, service } = makePrisma({ orderStatus: 'DELIVERED' })
    await expect(service.markNotDelivered(order.id, 'courier-01', { failureCode: 'CLIENTE_AUSENTE' })).rejects.toMatchObject({ statusCode: 409 })
    expect(prisma.order.update).not.toHaveBeenCalled()
  })

  // Onda 4 (T-7): a fila reenvia a mesma operação; a foto que subiu no meio não muda o id dela.
  it('reenvio atrasado da MESMA não entrega (fila offline) depois da foto → sucesso; outra operação → 409', async () => {
    const proof = { id: 'p1', status: 'OK', required: false, outcome: 'NOT_DELIVERED', photoAt: new Date(), note: null, lastClientOpId: 'op-fail-0001' }
    const { prisma, service } = makePrisma({ orderStatus: 'NOT_DELIVERED', proof })
    const summary = await service.markNotDelivered(order.id, 'courier-01', { failureCode: 'CLIENTE_AUSENTE', clientOpId: 'op-fail-0001' })
    expect(summary.status).toBe('NOT_DELIVERED')
    await expect(
      service.markNotDelivered(order.id, 'courier-01', { failureCode: 'CLIENTE_AUSENTE', clientOpId: 'op-fail-0002' }),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(prisma.order.update).not.toHaveBeenCalled()
  })
})

describe('foto do comprovante (E5)', () => {
  const file = { body: Buffer.from([0xff, 0xd8]), mimetype: 'image/jpeg' }

  it('sobe PRIVADA (deliveries/) e marca o comprovante como OK, sem trocar o id da operação do desfecho', async () => {
    const { prisma, service } = makePrisma()
    const view = await service.uploadProof('courier-01', order.id, 'DELIVERED', file)
    expect(storage.uploadPrivateImage).toHaveBeenCalledWith(file.body, 'image/jpeg', 'deliveries')
    expect(prisma.deliveryProof.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { status: 'OK', photoKey: 'deliveries/0b9d8a2e-1c3f-4d5e-9a7b-123456789abc.jpg', photoAt: expect.any(Date), note: null },
    })
    expect(view.status).toBe('OK')
  })

  it('armazenamento não configurado → 503 (o app segue com "sem foto")', async () => {
    storage.configured = false
    const { service } = makePrisma()
    await expect(service.uploadProof('courier-01', order.id, 'DELIVERED', file)).rejects.toMatchObject({ statusCode: 503 })
  })

  it('parada de outro entregador → 403; parada sem desfecho → 404', async () => {
    const { service } = makePrisma()
    await expect(service.uploadProof('outro', order.id, 'DELIVERED', file)).rejects.toMatchObject({ statusCode: 403 })
    const { service: s2 } = makePrisma({ proof: null })
    await expect(s2.uploadProof('courier-01', order.id, 'DELIVERED', file)).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('seguir sem foto', () => {
  it('pular quando a foto é obrigatória → 422', async () => {
    const { service } = makePrisma()
    await expect(service.skipProof('courier-01', order.id, 'DELIVERED', 'SKIPPED')).rejects.toMatchObject({ statusCode: 422 })
  })

  it('opcional: pular grava SKIPPED', async () => {
    const { prisma, service } = makePrisma({ proof: { id: 'p1', status: 'PENDING', required: false, outcome: 'DELIVERED', photoAt: null, note: null } })
    await service.skipProof('courier-01', order.id, 'DELIVERED', 'SKIPPED')
    expect(prisma.deliveryProof.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { status: 'SKIPPED', note: null } })
  })

  it('exceção da obrigatória: NONE com o motivo ("Local sem luz" / texto do "Outro")', async () => {
    const { prisma, service } = makePrisma()
    await service.skipProof('courier-01', order.id, 'DELIVERED', 'NONE', 'SEM_LUZ')
    expect(prisma.deliveryProof.update).toHaveBeenLastCalledWith({ where: { id: 'p1' }, data: { status: 'NONE', note: 'Local sem luz' } })
    await service.skipProof('courier-01', order.id, 'DELIVERED', 'NONE', 'OUTRO', 'celular travou')
    expect(prisma.deliveryProof.update).toHaveBeenLastCalledWith({ where: { id: 'p1' }, data: { status: 'NONE', note: 'celular travou' } })
  })

  it('foto já recebida não é sobrescrita por um "pular" atrasado da fila', async () => {
    const { prisma, service } = makePrisma({ proof: { id: 'p1', status: 'OK', required: false, outcome: 'DELIVERED', photoAt: day, note: null } })
    const view = await service.skipProof('courier-01', order.id, 'DELIVERED', 'SKIPPED')
    expect(view.status).toBe('OK')
    expect(prisma.deliveryProof.update).not.toHaveBeenCalled()
  })
})
