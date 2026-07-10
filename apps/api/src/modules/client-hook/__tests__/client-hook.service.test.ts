// ClientHookService unit tests — solicitação do gancho de porta pelo cliente.
import { describe, it, expect, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { ClientHookService } from '../client-hook.service.js'

function makeFastify(opts: {
  user?: { role?: string; hookRequestedAt?: Date | null; hookDeliveredAt?: Date | null } | null
  ordersCount?: number
} = {}) {
  const { user = { role: 'CLIENT', hookRequestedAt: null, hookDeliveredAt: null }, ordersCount = 0 } = opts
  const update = vi.fn().mockResolvedValue({ hookRequestedAt: new Date('2026-07-04') })
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      update,
    },
    order: {
      count: vi.fn().mockResolvedValue(ordersCount),
    },
  }
  return {
    fastify: { prisma, log: { error: vi.fn(), warn: vi.fn() } } as unknown as FastifyInstance,
    update,
  }
}

describe('ClientHookService.getStatus', () => {
  it('needsConsent=true quando já pediu ao menos 1 vez e ainda não solicitou o gancho', async () => {
    const { fastify } = makeFastify({ user: { role: 'CLIENT', hookRequestedAt: null }, ordersCount: 1 })
    const res = await new ClientHookService(fastify).getStatus('u1')
    expect(res.hasOrdered).toBe(true)
    expect(res.needsConsent).toBe(true)
  })

  it('needsConsent=false quando ainda não fez nenhum pedido', async () => {
    const { fastify } = makeFastify({ user: { role: 'CLIENT', hookRequestedAt: null }, ordersCount: 0 })
    const res = await new ClientHookService(fastify).getStatus('u1')
    expect(res.hasOrdered).toBe(false)
    expect(res.needsConsent).toBe(false)
  })

  it('needsConsent=false quando o gancho já foi solicitado', async () => {
    const { fastify } = makeFastify({ user: { role: 'CLIENT', hookRequestedAt: new Date() }, ordersCount: 3 })
    const res = await new ClientHookService(fastify).getStatus('u1')
    expect(res.needsConsent).toBe(false)
  })

  it('lança 404 quando o usuário não é CLIENT', async () => {
    const { fastify } = makeFastify({ user: { role: 'ADMIN', hookRequestedAt: null } })
    await expect(new ClientHookService(fastify).getStatus('u1')).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('ClientHookService.requestHook', () => {
  it('grava hookRequestedAt quando ainda não solicitado', async () => {
    const { fastify, update } = makeFastify({ user: { role: 'CLIENT', hookRequestedAt: null } })
    const res = await new ClientHookService(fastify).requestHook('u1')
    expect(update).toHaveBeenCalledOnce()
    expect(res.hookRequestedAt).toBeInstanceOf(Date)
  })

  it('é idempotente: não regrava se já solicitado', async () => {
    const existing = new Date('2026-07-01')
    const { fastify, update } = makeFastify({ user: { role: 'CLIENT', hookRequestedAt: existing } })
    const res = await new ClientHookService(fastify).requestHook('u1')
    expect(update).not.toHaveBeenCalled()
    expect(res.hookRequestedAt).toBe(existing)
  })
})
