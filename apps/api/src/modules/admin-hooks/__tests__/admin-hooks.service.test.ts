// AdminHooksService unit tests — gestão dos ganchos pelo Admin (coleção HookRequest).
import { describe, it, expect, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { AdminHooksService } from '../admin-hooks.service.js'

function makeFastify(
  opts: {
    hook?: { id: string; userId: string; status: string } | null // hookRequest.findUnique (deliver)
    user?: { role?: string; oneSignalPlayerId?: string | null } | null // user.findUnique (grant / oneSignal)
    count?: number // hookRequest.count (total na list, abertos no grant)
    hooks?: Array<Record<string, unknown>> // hookRequest.findMany (list)
    users?: Array<Record<string, unknown>> // user.findMany (batch da list)
    condos?: Array<{ id: string; name: string }>
  } = {},
) {
  const { hook = null, user = null, count = 0, hooks = [], users = [], condos = [] } = opts

  const hookUpdate = vi.fn().mockResolvedValue({})
  const hookCreate = vi.fn().mockResolvedValue({ id: 'h9' })
  const notificationCreate = vi.fn().mockResolvedValue({})
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      findMany: vi.fn().mockResolvedValue(users),
    },
    condominium: { findMany: vi.fn().mockResolvedValue(condos) },
    hookRequest: {
      count: vi.fn().mockResolvedValue(count),
      findMany: vi.fn().mockResolvedValue(hooks),
      findUnique: vi.fn().mockResolvedValue(hook),
      update: hookUpdate,
      create: hookCreate,
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
    hookUpdate,
    hookCreate,
    notificationCreate,
  }
}

describe('AdminHooksService.list', () => {
  it('status pending → where.status REQUESTED e resolve o nome do condomínio', async () => {
    const { fastify, prisma } = makeFastify({
      count: 1,
      hooks: [
        { id: 'h1', userId: 'u1', type: 'FREE', status: 'REQUESTED', reason: null, requestedAt: new Date(), deliveredAt: null },
      ],
      users: [{ id: 'u1', name: 'Ana', phone: null, apartment: '302', block: 'B', condominiumId: 'c1' }],
      condos: [{ id: 'c1', name: 'Residencial Sol' }],
    })
    const res = await new AdminHooksService(fastify).list({ status: 'pending' })
    const where = (prisma.hookRequest.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where
    expect(where.status).toBe('REQUESTED')
    expect(res.total).toBe(1)
    expect(res.items[0].type).toBe('FREE')
    expect(res.items[0].condominiumName).toBe('Residencial Sol')
  })

  it('status delivered → where.status DELIVERED', async () => {
    const { fastify, prisma } = makeFastify({ hooks: [], count: 0 })
    await new AdminHooksService(fastify).list({ status: 'delivered' })
    const where = (prisma.hookRequest.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where
    expect(where.status).toBe('DELIVERED')
  })

  it('type paid → where.type PAID', async () => {
    const { fastify, prisma } = makeFastify({ hooks: [], count: 0 })
    await new AdminHooksService(fastify).list({ type: 'paid' })
    const where = (prisma.hookRequest.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0].where
    expect(where.type).toBe('PAID')
  })

  it('sort location → ordena por condomínio → bloco → apartamento (numérico) sobre o conjunto completo', async () => {
    const at = new Date()
    const { fastify, prisma } = makeFastify({
      hooks: [
        { id: 'h1', userId: 'u1', type: 'FREE', status: 'REQUESTED', reason: null, requestedAt: at, deliveredAt: null },
        { id: 'h2', userId: 'u2', type: 'FREE', status: 'REQUESTED', reason: null, requestedAt: at, deliveredAt: null },
        { id: 'h3', userId: 'u3', type: 'FREE', status: 'REQUESTED', reason: null, requestedAt: at, deliveredAt: null },
        { id: 'h4', userId: 'u4', type: 'FREE', status: 'REQUESTED', reason: null, requestedAt: at, deliveredAt: null },
      ],
      users: [
        { id: 'u1', name: 'Ana', phone: null, apartment: '302', block: 'B', condominiumId: 'c1' },
        { id: 'u2', name: 'Bia', phone: null, apartment: '10', block: 'A', condominiumId: 'c1' },
        { id: 'u3', name: 'Caio', phone: null, apartment: '101', block: '2', condominiumId: 'c2' },
        { id: 'u4', name: 'Duda', phone: null, apartment: '2', block: 'A', condominiumId: 'c1' },
      ],
      condos: [
        { id: 'c1', name: 'Residencial Sol' },
        { id: 'c2', name: 'Alto do Bosque' },
      ],
    })
    const res = await new AdminHooksService(fastify).list({ status: 'pending', sort: 'location' })
    // Alto do Bosque (c2) antes de Residencial Sol (c1); dentro do c1: bloco A (apto 2, depois 10) antes do bloco B.
    expect(res.items.map((i) => i.userId)).toEqual(['u3', 'u4', 'u2', 'u1'])
    expect(res.total).toBe(4)
    // Carrega o conjunto completo (sem paginar no banco).
    const findManyArgs = (prisma.hookRequest.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(findManyArgs.skip).toBeUndefined()
    expect(findManyArgs.take).toBeUndefined()
  })
})

describe('AdminHooksService.markDelivered', () => {
  it('marca a entrega e cria a notificação in-app na transição REQUESTED→DELIVERED', async () => {
    const { fastify, hookUpdate, notificationCreate } = makeFastify({
      hook: { id: 'h1', userId: 'u1', status: 'REQUESTED' },
      user: { oneSignalPlayerId: null },
    })
    const res = await new AdminHooksService(fastify).markDelivered('h1', 'admin1')
    expect(res).toEqual({ ok: true })
    expect(hookUpdate).toHaveBeenCalledOnce()
    expect(hookUpdate.mock.calls[0][0].data.deliveredById).toBe('admin1')
    expect(notificationCreate).toHaveBeenCalledOnce()
  })

  it('é idempotente: já entregue não atualiza nem re-notifica', async () => {
    const { fastify, hookUpdate, notificationCreate } = makeFastify({
      hook: { id: 'h1', userId: 'u1', status: 'DELIVERED' },
    })
    const res = await new AdminHooksService(fastify).markDelivered('h1', 'admin1')
    expect(res).toEqual({ ok: true })
    expect(hookUpdate).not.toHaveBeenCalled()
    expect(notificationCreate).not.toHaveBeenCalled()
  })

  it('lança 422 quando o gancho não está na fila (ex.: aguardando pagamento)', async () => {
    const { fastify } = makeFastify({ hook: { id: 'h1', userId: 'u1', status: 'PENDING_PAYMENT' } })
    await expect(new AdminHooksService(fastify).markDelivered('h1', 'admin1')).rejects.toMatchObject({ statusCode: 422 })
  })

  it('lança 404 quando o gancho não existe', async () => {
    const { fastify } = makeFastify({ hook: null })
    await expect(new AdminHooksService(fastify).markDelivered('hX', 'admin1')).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('AdminHooksService.grant (bonificação)', () => {
  it('cria um HookRequest BONUS na fila quando o cliente não tem gancho em andamento', async () => {
    const { fastify, hookCreate } = makeFastify({ user: { role: 'CLIENT' }, count: 0 })
    const res = await new AdminHooksService(fastify).grant('admin1', 'u1', 'cortesia')
    expect(hookCreate).toHaveBeenCalledOnce()
    expect(hookCreate.mock.calls[0][0].data).toMatchObject({ type: 'BONUS', status: 'REQUESTED', grantedById: 'admin1' })
    expect(res.hookRequestId).toBe('h9')
  })

  it('lança 404 quando o alvo não é CLIENT', async () => {
    const { fastify } = makeFastify({ user: { role: 'ADMIN' } })
    await expect(new AdminHooksService(fastify).grant('admin1', 'u1')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('lança 422 quando o cliente já tem um gancho em andamento', async () => {
    const { fastify } = makeFastify({ user: { role: 'CLIENT' }, count: 1 })
    await expect(new AdminHooksService(fastify).grant('admin1', 'u1')).rejects.toMatchObject({ statusCode: 422 })
  })
})
