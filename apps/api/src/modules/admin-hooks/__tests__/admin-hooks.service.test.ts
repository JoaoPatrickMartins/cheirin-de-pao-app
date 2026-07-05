// AdminHooksService unit tests — gestão das solicitações de gancho pelo Admin.
import { describe, it, expect, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { AdminHooksService } from '../admin-hooks.service.js'

function makeFastify(opts: {
  user?: {
    id?: string
    role?: string
    hookRequestedAt?: Date | null
    hookDeliveredAt?: Date | null
    oneSignalPlayerId?: string | null
  } | null
  clients?: Array<Record<string, unknown>>
  total?: number
  condos?: Array<{ id: string; name: string }>
} = {}) {
  const {
    user = { id: 'u1', role: 'CLIENT', hookRequestedAt: new Date('2026-07-01'), hookDeliveredAt: null, oneSignalPlayerId: null },
    clients = [],
    total = clients.length,
    condos = [],
  } = opts

  const userUpdate = vi.fn().mockResolvedValue({})
  const notificationCreate = vi.fn().mockResolvedValue({})
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      update: userUpdate,
      count: vi.fn().mockResolvedValue(total),
      findMany: vi.fn().mockResolvedValue(clients),
    },
    condominium: {
      findMany: vi.fn().mockResolvedValue(condos),
    },
    notification: {
      create: notificationCreate,
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
  }
  return {
    fastify: { prisma, log: { error: vi.fn(), warn: vi.fn() } } as unknown as FastifyInstance,
    prisma,
    userUpdate,
    notificationCreate,
  }
}

describe('AdminHooksService.list', () => {
  it('filtra pendentes (hookDeliveredAt: null) e resolve o nome do condomínio', async () => {
    const { fastify, prisma } = makeFastify({
      clients: [
        { id: 'u1', name: 'Ana', phone: null, apartment: '302', block: 'B', condominiumId: 'c1', hookRequestedAt: new Date(), hookDeliveredAt: null },
      ],
      total: 1,
      condos: [{ id: 'c1', name: 'Residencial Sol' }],
    })
    const res = await new AdminHooksService(fastify).list({ status: 'pending' })
    const where = (prisma.user.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where
    expect(where.hookRequestedAt).toEqual({ not: null })
    // "Pendente" = campo não setado (Prisma-Mongo isSet: false casa o campo ausente)
    expect(where.hookDeliveredAt).toEqual({ isSet: false })
    expect(res.total).toBe(1)
    expect(res.items[0].condominiumName).toBe('Residencial Sol')
  })

  it('filtra entregues (hookDeliveredAt: { not: null })', async () => {
    const { fastify, prisma } = makeFastify({ clients: [], total: 0 })
    await new AdminHooksService(fastify).list({ status: 'delivered' })
    const where = (prisma.user.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where
    expect(where.hookDeliveredAt).toEqual({ not: null })
  })
})

describe('AdminHooksService.markDelivered', () => {
  it('marca a entrega e cria a notificação in-app na transição pendente→entregue', async () => {
    const { fastify, userUpdate, notificationCreate } = makeFastify({
      user: { id: 'u1', role: 'CLIENT', hookRequestedAt: new Date(), hookDeliveredAt: null, oneSignalPlayerId: null },
    })
    const res = await new AdminHooksService(fastify).markDelivered('u1', 'admin1')
    expect(res).toEqual({ ok: true })
    expect(userUpdate).toHaveBeenCalledOnce()
    expect(userUpdate.mock.calls[0][0].data.hookDeliveredById).toBe('admin1')
    expect(notificationCreate).toHaveBeenCalledOnce()
  })

  it('é idempotente: já entregue não atualiza nem re-notifica', async () => {
    const { fastify, userUpdate, notificationCreate } = makeFastify({
      user: { id: 'u1', role: 'CLIENT', hookRequestedAt: new Date(), hookDeliveredAt: new Date(), oneSignalPlayerId: null },
    })
    const res = await new AdminHooksService(fastify).markDelivered('u1', 'admin1')
    expect(res).toEqual({ ok: true })
    expect(userUpdate).not.toHaveBeenCalled()
    expect(notificationCreate).not.toHaveBeenCalled()
  })

  it('lança 422 quando o cliente não solicitou o gancho', async () => {
    const { fastify } = makeFastify({ user: { id: 'u1', role: 'CLIENT', hookRequestedAt: null } })
    await expect(new AdminHooksService(fastify).markDelivered('u1', 'admin1')).rejects.toMatchObject({ statusCode: 422 })
  })

  it('lança 404 quando o usuário não é CLIENT', async () => {
    const { fastify } = makeFastify({ user: { id: 'u1', role: 'COURIER', hookRequestedAt: new Date() } })
    await expect(new AdminHooksService(fastify).markDelivered('u1', 'admin1')).rejects.toMatchObject({ statusCode: 404 })
  })
})
