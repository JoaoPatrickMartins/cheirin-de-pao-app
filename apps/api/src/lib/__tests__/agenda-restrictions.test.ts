import { describe, it, expect, vi } from 'vitest'
import {
  parseDiasBloqueados,
  parseLimitePedidosDia,
  getAgendaRestrictions,
  isDayBlocked,
  nextDateForWeekday,
} from '../agenda-restrictions.js'
import { dayKeyOf } from '../cutoff.js'

describe('agenda-restrictions', () => {
  describe('parseDiasBloqueados', () => {
    it('marca só os dias com true (boolean ou "true")', () => {
      const r = parseDiasBloqueados(JSON.stringify({ ter: true, qua: 'true', sex: false }))
      expect(r.ter).toBe(true)
      expect(r.qua).toBe(true)
      expect(r.sex).toBe(false)
      expect(r.seg).toBe(false) // ausente → liberado
    })

    it('degrada para tudo liberado em JSON inválido/ausente', () => {
      const vazio = parseDiasBloqueados(undefined)
      const invalido = parseDiasBloqueados('{ nope')
      for (const r of [vazio, invalido]) {
        expect(Object.values(r).every((v) => v === false)).toBe(true)
      }
    })
  })

  describe('parseLimitePedidosDia', () => {
    it('clampa para inteiro >= 0; ausente/negativo/inválido → 0', () => {
      const r = parseLimitePedidosDia(JSON.stringify({ seg: 50, ter: -3, qua: 2.9, qui: 'x' }))
      expect(r.seg).toBe(50)
      expect(r.ter).toBe(0)
      expect(r.qua).toBe(2)
      expect(r.qui).toBe(0)
      expect(r.dom).toBe(0) // ausente
    })
  })

  describe('isDayBlocked', () => {
    it('true apenas quando o dia está marcado', () => {
      const blocked = parseDiasBloqueados(JSON.stringify({ ter: true }))
      expect(isDayBlocked(blocked, 'ter')).toBe(true)
      expect(isDayBlocked(blocked, 'seg')).toBe(false)
    })
  })

  describe('getAgendaRestrictions', () => {
    it('lê as duas chaves do Setting em paralelo', async () => {
      const prisma = {
        setting: {
          findUnique: vi.fn(({ where }: { where: { key: string } }) => {
            if (where.key === 'diasBloqueados') return Promise.resolve({ value: JSON.stringify({ ter: true, qua: true }) })
            if (where.key === 'limitePedidosDia') return Promise.resolve({ value: JSON.stringify({ seg: 40 }) })
            return Promise.resolve(null)
          }),
        },
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { blocked, limits } = await getAgendaRestrictions(prisma as any)
      expect(blocked.ter).toBe(true)
      expect(blocked.seg).toBe(false)
      expect(limits.seg).toBe(40)
      expect(limits.ter).toBe(0)
    })

    it('defaults quando as chaves não existem', async () => {
      const prisma = { setting: { findUnique: vi.fn().mockResolvedValue(null) } }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { blocked, limits } = await getAgendaRestrictions(prisma as any)
      expect(Object.values(blocked).every((v) => v === false)).toBe(true)
      expect(Object.values(limits).every((v) => v === 0)).toBe(true)
    })
  })

  describe('nextDateForWeekday', () => {
    // 2026-06-21 (meio-dia BRT = 15:00Z) é um domingo ('dom').
    const nowDom = new Date('2026-06-21T15:00:00Z')

    it('retorna hoje quando o dia já é o alvo (inclusive)', () => {
      const d = nextDateForWeekday('dom', nowDom)
      expect(dayKeyOf(d)).toBe('dom')
      expect(d.toISOString().slice(0, 10)).toBe('2026-06-21')
    })

    it('retorna a próxima ocorrência futura do dia da semana', () => {
      const seg = nextDateForWeekday('seg', nowDom)
      expect(dayKeyOf(seg)).toBe('seg')
      expect(seg.toISOString().slice(0, 10)).toBe('2026-06-22')

      const sab = nextDateForWeekday('sab', nowDom)
      expect(dayKeyOf(sab)).toBe('sab')
      expect(sab.toISOString().slice(0, 10)).toBe('2026-06-27')
    })
  })
})
