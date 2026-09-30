import { describe, it, expect, vi, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { referralsRoute } from '../referrals.route.js'

/**
 * Teste pela ROTA (inject), não só pelo service: o `fast-json-stringify` descarta todo campo que
 * não está declarado no response schema. Um campo esquecido lá passaria no teste do service e
 * sumiria em produção (§13 do plano-indique-e-ganhe).
 */

const ON = [
  { key: 'indicacaoAtiva', value: 'true' },
  { key: 'indicacaoRecompensa', value: '5' },
  { key: 'indicacaoBonusIndicado', value: '3' },
]

async function build(opts: { settings?: Array<{ key: string; value: string }>; owner?: Record<string, unknown> | null } = {}) {
  const app = Fastify()
  const prisma = {
    setting: { findMany: vi.fn().mockResolvedValue(opts.settings ?? ON) },
    user: {
      findFirst: vi.fn().mockResolvedValue(
        opts.owner === undefined ? { id: 'ref1', name: 'João Martins', role: 'CLIENT', isBlocked: false } : opts.owner,
      ),
    },
  }
  app.decorate('prisma', prisma as unknown as FastifyInstance['prisma'])
  app.decorate('authenticate', async () => {})
  await app.register(referralsRoute)
  await app.ready()
  return { app, prisma }
}

let app: FastifyInstance | undefined
afterEach(async () => {
  await app?.close()
  app = undefined
})

describe('referralsRoute — rotas públicas', () => {
  it('GET /referrals/config devolve active + welcomeBreads', async () => {
    ;({ app } = await build())
    const res = await app.inject({ method: 'GET', url: '/referrals/config' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ active: true, welcomeBreads: 3 })
  })

  it('GET /referrals/config com o programa desligado → inativo e sem bônus', async () => {
    ;({ app } = await build({ settings: [{ key: 'indicacaoAtiva', value: 'false' }, { key: 'indicacaoBonusIndicado', value: '3' }] }))
    const res = await app.inject({ method: 'GET', url: '/referrals/config' })
    expect(res.json()).toEqual({ active: false, welcomeBreads: 0 })
  })

  it('GET /referrals/code/:code válido → nome curto e bônus passam pela serialização', async () => {
    let prisma
    ;({ app, prisma } = await build())
    const res = await app.inject({ method: 'GET', url: '/referrals/code/joao-7k2f' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ valid: true, referrerName: 'João M.', welcomeBreads: 3 })
    expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { referralCode: 'JOAO7K2F' } }))
  })

  it('GET /referrals/code/:code inválido → só { valid: false } (nada do dono vaza)', async () => {
    ;({ app } = await build({ owner: { id: 'ref1', name: 'João Martins', role: 'CLIENT', isBlocked: true } }))
    const res = await app.inject({ method: 'GET', url: '/referrals/code/JOAO7K2F' })
    expect(res.json()).toEqual({ valid: false })
  })
})
