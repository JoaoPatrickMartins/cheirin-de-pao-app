// ClientHookService unit tests — gancho de porta pelo cliente (coleção HookRequest).
import { describe, it, expect, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { ClientHookService } from '../client-hook.service.js'

interface LatestHook {
  id: string
  type: 'FREE' | 'PAID' | 'BONUS'
  status: 'PENDING_PAYMENT' | 'REQUESTED' | 'DELIVERED' | 'CANCELLED'
  reason: string | null
  requestedAt: Date | null
  deliveredAt: Date | null
  createdAt: Date
}

function makeFastify(
  opts: {
    user?: { role?: string; name?: string; apartment?: string | null; block?: string | null } | null
    comboPurchases?: number
    bigSingleOrders?: number
    totalHooks?: number
    openHooks?: number
    latestHook?: LatestHook | null
    existingHook?: { id: string; status: string; type: string } | null
    pedidoUnicoMin?: number
    preco?: number
  } = {},
) {
  const {
    user = { role: 'CLIENT', name: 'Ana', apartment: '10', block: null },
    comboPurchases = 0,
    bigSingleOrders = 0,
    totalHooks = 0,
    openHooks = 0,
    latestHook = null,
    existingHook = null,
    pedidoUnicoMin = 10,
    preco = 5,
  } = opts

  const hookCreate = vi.fn().mockResolvedValue({ id: 'h1', status: 'REQUESTED', type: 'FREE' })
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      findMany: vi.fn().mockResolvedValue([]), // admins (notifyAdmins)
    },
    setting: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { key: string } }) => {
        if (where.key === 'ganchoPedidoUnicoMin') return Promise.resolve({ value: String(pedidoUnicoMin) })
        if (where.key === 'ganchoPreco') return Promise.resolve({ value: String(preco) })
        return Promise.resolve(null)
      }),
    },
    payment: { count: vi.fn().mockResolvedValue(comboPurchases) },
    order: { count: vi.fn().mockResolvedValue(bigSingleOrders) },
    hookRequest: {
      // getStatus: 1ª chamada = total (where { userId }); 2ª = abertos (where tem status)
      count: vi
        .fn()
        .mockImplementation(({ where }: { where: { status?: unknown } }) =>
          Promise.resolve(where?.status ? openHooks : totalHooks),
        ),
      // getStatus usa findFirst para o "latest"; requestHook usa para o "existing"
      findFirst: vi.fn().mockResolvedValue(existingHook ?? latestHook),
      create: hookCreate,
    },
    notification: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
  }
  return {
    fastify: { prisma, log: { error: vi.fn(), warn: vi.fn() } } as unknown as FastifyInstance,
    prisma,
    hookCreate,
  }
}

describe('ClientHookService.getStatus', () => {
  it('needsConsent=true quando comprou combo e não tem gancho', async () => {
    const { fastify } = makeFastify({ comboPurchases: 1, totalHooks: 0 })
    const res = await new ClientHookService(fastify).getStatus('u1')
    expect(res.freeEligible).toBe(true)
    expect(res.hasHook).toBe(false)
    expect(res.needsConsent).toBe(true)
    expect(res.canRequestPaid).toBe(false)
  })

  it('needsConsent=true quando fez pedido único >= mínimo', async () => {
    const { fastify } = makeFastify({ comboPurchases: 0, bigSingleOrders: 1, totalHooks: 0 })
    const res = await new ClientHookService(fastify).getStatus('u1')
    expect(res.freeEligible).toBe(true)
    expect(res.needsConsent).toBe(true)
  })

  it('needsConsent=false quando não atende ao critério', async () => {
    const { fastify } = makeFastify({ comboPurchases: 0, bigSingleOrders: 0, totalHooks: 0 })
    const res = await new ClientHookService(fastify).getStatus('u1')
    expect(res.freeEligible).toBe(false)
    expect(res.needsConsent).toBe(false)
  })

  it('needsConsent=false e canRequestPaid=true quando já tem gancho entregue', async () => {
    const { fastify } = makeFastify({
      comboPurchases: 1,
      totalHooks: 1,
      openHooks: 0,
      latestHook: {
        id: 'h1',
        type: 'FREE',
        status: 'DELIVERED',
        reason: null,
        requestedAt: new Date('2026-07-01'),
        deliveredAt: new Date('2026-07-03'),
        createdAt: new Date('2026-07-01'),
      },
    })
    const res = await new ClientHookService(fastify).getStatus('u1')
    expect(res.hasHook).toBe(true)
    expect(res.needsConsent).toBe(false)
    expect(res.canRequestPaid).toBe(true)
  })

  it('canRequestPaid=false quando há gancho em andamento', async () => {
    const { fastify } = makeFastify({ totalHooks: 1, openHooks: 1 })
    const res = await new ClientHookService(fastify).getStatus('u1')
    expect(res.canRequestPaid).toBe(false)
  })

  it('lança 404 quando o usuário não é CLIENT', async () => {
    const { fastify } = makeFastify({ user: { role: 'ADMIN' } })
    await expect(new ClientHookService(fastify).getStatus('u1')).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('ClientHookService.requestHook (grátis)', () => {
  it('cria um HookRequest FREE quando elegível e sem gancho', async () => {
    const { fastify, hookCreate } = makeFastify({ comboPurchases: 1, existingHook: null })
    const res = await new ClientHookService(fastify).requestHook('u1')
    expect(hookCreate).toHaveBeenCalledOnce()
    expect(hookCreate.mock.calls[0][0].data).toMatchObject({ type: 'FREE', status: 'REQUESTED' })
    expect(res.hookRequestId).toBe('h1')
  })

  it('é idempotente: já tem gancho → devolve o atual sem criar outro', async () => {
    const { fastify, hookCreate } = makeFastify({
      existingHook: { id: 'hX', status: 'DELIVERED', type: 'FREE' },
    })
    const res = await new ClientHookService(fastify).requestHook('u1')
    expect(hookCreate).not.toHaveBeenCalled()
    expect(res.hookRequestId).toBe('hX')
  })

  it('lança 422 quando ainda não atende ao critério do grátis', async () => {
    const { fastify } = makeFastify({ comboPurchases: 0, bigSingleOrders: 0, existingHook: null })
    await expect(new ClientHookService(fastify).requestHook('u1')).rejects.toMatchObject({ statusCode: 422 })
  })
})

describe('ClientHookService.requestPaidHook (pago)', () => {
  it('lança 422 quando o cliente ainda não tem gancho', async () => {
    const { fastify } = makeFastify({ totalHooks: 0, openHooks: 0 })
    await expect(new ClientHookService(fastify).requestPaidHook('u1', 'defeito')).rejects.toMatchObject({
      statusCode: 422,
    })
  })

  it('lança 422 quando já há um gancho em andamento', async () => {
    const { fastify } = makeFastify({ totalHooks: 1, openHooks: 1 })
    await expect(new ClientHookService(fastify).requestPaidHook('u1', 'perda')).rejects.toMatchObject({
      statusCode: 422,
    })
  })
})
