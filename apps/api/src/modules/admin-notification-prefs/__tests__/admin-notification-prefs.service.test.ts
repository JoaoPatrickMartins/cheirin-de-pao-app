// AdminNotificationPrefsService unit tests — toggles de notificação por admin.
import { describe, it, expect, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { AdminNotificationPrefsService } from '../admin-notification-prefs.service.js'
import { ADMIN_NOTIFICATION_TYPES, DEFAULT_OFF_ADMIN_NOTIFICATION_TYPES } from '../admin-notification-prefs.schema.js'

function makeFastify(stored: Record<string, boolean> | null) {
  const update = vi.fn().mockResolvedValue({})
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue({ adminNotificationPrefs: stored }),
      update,
    },
  }
  return {
    fastify: { prisma, log: { error: vi.fn(), warn: vi.fn() } } as unknown as FastifyInstance,
    update,
  }
}

describe('AdminNotificationPrefsService.getPrefs', () => {
  it('devolve o mapa completo com default=true quando não há preferências gravadas', async () => {
    const { fastify } = makeFastify(null)
    const prefs = await new AdminNotificationPrefsService(fastify).getPrefs('a1')
    expect(Object.keys(prefs).sort()).toEqual([...ADMIN_NOTIFICATION_TYPES].sort())
    for (const t of ADMIN_NOTIFICATION_TYPES) {
      expect(prefs[t]).toBe(!DEFAULT_OFF_ADMIN_NOTIFICATION_TYPES.has(t))
    }
  })

  it('Indique e Ganhe (D-14): "recompensada" nasce desligada; "analisar" e "novo condomínio", ligadas', async () => {
    const { fastify } = makeFastify(null)
    const prefs = await new AdminNotificationPrefsService(fastify).getPrefs('a1')
    expect(prefs.ADMIN_REFERRAL_REWARDED).toBe(false)
    expect(prefs.ADMIN_REFERRAL_REVIEW).toBe(true)
    expect(prefs.ADMIN_CONDO_INTEREST).toBe(true)
  })

  it('tipo que nasce desligado só liga com true gravado', async () => {
    const on = makeFastify({ ADMIN_REFERRAL_REWARDED: true })
    expect((await new AdminNotificationPrefsService(on.fastify).getPrefs('a1')).ADMIN_REFERRAL_REWARDED).toBe(true)
    const off = makeFastify({ ADMIN_REFERRAL_REWARDED: false })
    expect((await new AdminNotificationPrefsService(off.fastify).getPrefs('a1')).ADMIN_REFERRAL_REWARDED).toBe(false)
  })

  it('reflete apenas as chaves desligadas (false) e mantém o resto ligado', async () => {
    const { fastify } = makeFastify({ ADMIN_ORDER_PLACED: false })
    const prefs = await new AdminNotificationPrefsService(fastify).getPrefs('a1')
    expect(prefs.ADMIN_ORDER_PLACED).toBe(false)
    expect(prefs.ADMIN_DELIVERY_DONE).toBe(true)
  })
})

describe('AdminNotificationPrefsService.setPrefs', () => {
  it('faz merge com o que já existe (não zera chaves não enviadas)', async () => {
    const { fastify, update } = makeFastify({ ADMIN_ORDER_PLACED: false })
    const res = await new AdminNotificationPrefsService(fastify).setPrefs('a1', { ADMIN_DELIVERY_DONE: false })
    const saved = update.mock.calls[0][0].data.adminNotificationPrefs
    expect(saved).toEqual({ ADMIN_ORDER_PLACED: false, ADMIN_DELIVERY_DONE: false })
    // retorno é o mapa COMPLETO preenchido
    expect(res.ADMIN_ORDER_PLACED).toBe(false)
    expect(res.ADMIN_DELIVERY_DONE).toBe(false)
    expect(res.ADMIN_HOOK_REQUESTED).toBe(true)
  })
})
