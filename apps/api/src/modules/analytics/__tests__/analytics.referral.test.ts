import { describe, it, expect, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { TrackEventSchema } from '../analytics.schema.js'
import { AnalyticsService } from '../analytics.service.js'

/**
 * Funil do Indique e Ganhe (V-21): o acesso pelo link leva o `ref`. Código adulterado é descartado
 * sem derrubar o evento — o acesso continua contando.
 */

function makeService() {
  const create = vi.fn().mockResolvedValue({})
  const fastify = { prisma: { analyticsEvent: { create } } } as unknown as FastifyInstance
  return { service: new AnalyticsService(fastify), create }
}

describe('analytics — ref do Indique e Ganhe', () => {
  it('grava o código normalizado em refCode', async () => {
    const { service, create } = makeService()
    await service.record(TrackEventSchema.parse({ type: 'access', visitorId: 'v1', ref: ' joao-7k2f ' }))
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: 'ACCESS', refCode: 'JOAO7K2F' }) })
  })

  it('sem ref (ou lixo) → refCode null', async () => {
    const { service, create } = makeService()
    await service.record(TrackEventSchema.parse({ type: 'access', visitorId: 'v1' }))
    await service.record(TrackEventSchema.parse({ type: 'access', visitorId: 'v1', ref: '<script>' }))
    expect(create.mock.calls.map(([arg]) => arg.data.refCode)).toEqual([null, null])
  })

  it('ref de tipo errado ou gigante não vira 400: é descartado', () => {
    expect(TrackEventSchema.parse({ type: 'access', visitorId: 'v1', ref: 'X'.repeat(200) }).ref).toBeUndefined()
    expect(TrackEventSchema.parse({ type: 'access', visitorId: 'v1', ref: 42 }).ref).toBeUndefined()
  })
})

// Login com Google (plano-login-social.md): o evento de login diz como a pessoa entrou.
describe('analytics — método do login', () => {
  it('grava o método só no evento de login', async () => {
    const { service, create } = makeService()
    await service.record(TrackEventSchema.parse({ type: 'login', visitorId: 'v1', role: 'CLIENT', method: 'google' }))
    await service.record(TrackEventSchema.parse({ type: 'access', visitorId: 'v1', method: 'google' }))
    expect(create.mock.calls.map(([arg]) => arg.data.method)).toEqual(['google', null])
  })

  it('método desconhecido é descartado, sem derrubar o evento', () => {
    expect(TrackEventSchema.parse({ type: 'login', visitorId: 'v1', method: 'facebook' }).method).toBeUndefined()
  })
})
