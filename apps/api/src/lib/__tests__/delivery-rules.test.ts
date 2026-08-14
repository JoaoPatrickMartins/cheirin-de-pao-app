import { describe, it, expect, vi } from 'vitest'
import {
  resolveCondoRules,
  getRulesForCondo,
  listBlocksOverlapping,
  findBlockForDate,
  getDateBlock,
  blockedDateMessage,
  isValidDateStr,
  validateBlockRange,
  type DeliveryBlockRow,
} from '../delivery-rules.js'
import { parseDiasBloqueados, parseLimitePedidosDia } from '../agenda-restrictions.js'

const GLOBAL = {
  blocked: parseDiasBloqueados(JSON.stringify({ dom: true })),
  limits: parseLimitePedidosDia(JSON.stringify({ ter: 1 })),
}

describe('delivery-rules', () => {
  describe('resolveCondoRules', () => {
    it('herda o global quando não há override', () => {
      const r = resolveCondoRules(GLOBAL, null)
      expect(r.blocked.dom).toBe(true)
      expect(r.limits.ter).toBe(1)
      expect(r.source).toEqual({ blocked: 'global', limits: 'global' })
    })

    it('herda cada seção independentemente', () => {
      const r = resolveCondoRules(GLOBAL, { dayLimitOverride: { qua: 30 } })
      // bloqueios seguem globais...
      expect(r.blocked.dom).toBe(true)
      expect(r.source.blocked).toBe('global')
      // ...e os limites vêm do condomínio (substituem o mapa INTEIRO, não fazem merge)
      expect(r.limits.qua).toBe(30)
      expect(r.limits.ter).toBe(0)
      expect(r.source.limits).toBe('condo')
    })

    it('override substitui o mapa inteiro, incluindo desbloquear um dia bloqueado no global', () => {
      const r = resolveCondoRules(GLOBAL, { blockedDaysOverride: { seg: true } })
      expect(r.blocked.seg).toBe(true)
      expect(r.blocked.dom).toBe(false) // o global bloqueava domingo; o condo não
      expect(r.source.blocked).toBe('condo')
    })

    it('trata override vazio ({}) como personalização (tudo liberado no condo)', () => {
      const r = resolveCondoRules(GLOBAL, { blockedDaysOverride: {} })
      expect(r.blocked.dom).toBe(false)
      expect(r.source.blocked).toBe('condo')
    })

    it('degrada para herança em override inválido (escalar, array, null)', () => {
      for (const bad of [null, undefined, 42, 'x', [1, 2]]) {
        const r = resolveCondoRules(GLOBAL, { blockedDaysOverride: bad, dayLimitOverride: bad })
        expect(r.blocked.dom).toBe(true)
        expect(r.limits.ter).toBe(1)
        expect(r.source).toEqual({ blocked: 'global', limits: 'global' })
      }
    })

    it('coage valores sujos do override (negativo/decimal/string)', () => {
      const r = resolveCondoRules(GLOBAL, {
        blockedDaysOverride: { seg: 'true', ter: 1 },
        dayLimitOverride: { seg: -5, ter: 2.9, qua: '7' },
      })
      expect(r.blocked.seg).toBe(true)
      expect(r.blocked.ter).toBe(false) // só true/"true" bloqueia
      expect(r.limits.seg).toBe(0)
      expect(r.limits.ter).toBe(2)
      expect(r.limits.qua).toBe(7)
    })
  })

  describe('getRulesForCondo', () => {
    const settingStub = {
      findUnique: vi.fn(({ where }: { where: { key: string } }) =>
        Promise.resolve(
          where.key === 'diasBloqueados'
            ? { value: JSON.stringify({ dom: true }) }
            : { value: JSON.stringify({ ter: 1 }) },
        ),
      ),
    }

    it('sem condominiumId devolve o padrão global puro sem ler condomínio', async () => {
      const condominium = { findUnique: vi.fn() }
      const prisma = { setting: settingStub, condominium }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await getRulesForCondo(prisma as any, null)
      expect(r.blocked.dom).toBe(true)
      expect(r.source.blocked).toBe('global')
      expect(condominium.findUnique).not.toHaveBeenCalled()
    })

    it('aplica o override do condomínio', async () => {
      const prisma = {
        setting: settingStub,
        condominium: {
          findUnique: vi.fn().mockResolvedValue({
            blockedDaysOverride: { sab: true },
            dayLimitOverride: null,
          }),
        },
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await getRulesForCondo(prisma as any, 'c1')
      expect(r.blocked.sab).toBe(true)
      expect(r.blocked.dom).toBe(false)
      expect(r.source).toEqual({ blocked: 'condo', limits: 'global' })
      expect(r.limits.ter).toBe(1) // limites herdados
    })

    it('condomínio inexistente cai na herança (não lança)', async () => {
      const prisma = {
        setting: settingStub,
        condominium: { findUnique: vi.fn().mockResolvedValue(null) },
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await getRulesForCondo(prisma as any, 'nope')
      expect(r.blocked.dom).toBe(true)
      expect(r.source.blocked).toBe('global')
    })
  })

  describe('listBlocksOverlapping', () => {
    it('busca por sobreposição de intervalo e inclui os globais (null E chave ausente)', async () => {
      const findMany = vi.fn().mockResolvedValue([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await listBlocksOverlapping({ deliveryBlock: { findMany } } as any, 'c1', '2026-08-10', '2026-08-20')

      const where = findMany.mock.calls[0][0].where
      expect(where.startDate).toEqual({ lte: '2026-08-20' })
      expect(where.endDate).toEqual({ gte: '2026-08-10' })
      expect(where.OR).toEqual([
        { condominiumId: 'c1' },
        { condominiumId: null },
        { condominiumId: { isSet: false } },
      ])
    })

    it('sem condominiumId busca só os bloqueios globais', async () => {
      const findMany = vi.fn().mockResolvedValue([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await listBlocksOverlapping({ deliveryBlock: { findMany } } as any, null, '2026-08-10', '2026-08-10')
      expect(findMany.mock.calls[0][0].where.OR).toEqual([
        { condominiumId: null },
        { condominiumId: { isSet: false } },
      ])
    })

    it('normaliza condominiumId/reason ausentes para null', async () => {
      const findMany = vi.fn().mockResolvedValue([
        { id: 'b1', startDate: '2026-08-10', endDate: '2026-08-10' },
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = await listBlocksOverlapping({ deliveryBlock: { findMany } } as any, 'c1', '2026-08-10', '2026-08-10')
      expect(rows[0]).toEqual({
        id: 'b1',
        condominiumId: null,
        startDate: '2026-08-10',
        endDate: '2026-08-10',
        reason: null,
      })
    })
  })

  describe('findBlockForDate', () => {
    const globalBlock: DeliveryBlockRow = {
      id: 'g', condominiumId: null, startDate: '2026-12-24', endDate: '2026-12-26', reason: 'Feriado',
    }
    const condoBlock: DeliveryBlockRow = {
      id: 'c', condominiumId: 'c1', startDate: '2026-12-25', endDate: '2026-12-25', reason: 'Portaria fechada',
    }

    it('cobre as duas pontas do intervalo (inclusivo)', () => {
      expect(findBlockForDate([globalBlock], '2026-12-24')?.id).toBe('g')
      expect(findBlockForDate([globalBlock], '2026-12-26')?.id).toBe('g')
      expect(findBlockForDate([globalBlock], '2026-12-23')).toBeNull()
      expect(findBlockForDate([globalBlock], '2026-12-27')).toBeNull()
    })

    it('prefere o bloqueio do condomínio ao global quando os dois cobrem a data', () => {
      expect(findBlockForDate([globalBlock, condoBlock], '2026-12-25')?.id).toBe('c')
      expect(findBlockForDate([globalBlock, condoBlock], '2026-12-24')?.id).toBe('g')
    })

    it('lista vazia → null', () => {
      expect(findBlockForDate([], '2026-12-25')).toBeNull()
    })
  })

  describe('getDateBlock', () => {
    it('consulta a data como intervalo de um dia', async () => {
      const findMany = vi.fn().mockResolvedValue([
        { id: 'b1', condominiumId: 'c1', startDate: '2026-08-13', endDate: '2026-08-15', reason: null },
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hit = await getDateBlock({ deliveryBlock: { findMany } } as any, 'c1', '2026-08-14')
      expect(hit?.id).toBe('b1')
      expect(findMany.mock.calls[0][0].where.startDate).toEqual({ lte: '2026-08-14' })
    })
  })

  describe('blockedDateMessage', () => {
    it('data única com motivo', () => {
      const msg = blockedDateMessage({
        id: 'b', condominiumId: null, startDate: '2026-12-25', endDate: '2026-12-25', reason: 'Natal',
      })
      expect(msg).toBe('Não há entregas nesta data (Natal). Período bloqueado: 25/12.')
    })

    it('período sem motivo', () => {
      const msg = blockedDateMessage({
        id: 'b', condominiumId: null, startDate: '2026-12-24', endDate: '2027-01-02', reason: null,
      })
      expect(msg).toBe('Não há entregas nesta data. Período bloqueado: 24/12 a 02/01.')
    })
  })

  describe('isValidDateStr', () => {
    it('aceita datas reais e recusa formato/calendário inválidos', () => {
      expect(isValidDateStr('2026-08-13')).toBe(true)
      expect(isValidDateStr('2028-02-29')).toBe(true) // ano bissexto
      expect(isValidDateStr('2026-02-31')).toBe(false)
      expect(isValidDateStr('2026-13-01')).toBe(false)
      expect(isValidDateStr('13/08/2026')).toBe(false)
      expect(isValidDateStr('2026-8-1')).toBe(false)
      expect(isValidDateStr('')).toBe(false)
    })
  })

  describe('validateBlockRange', () => {
    // 2026-08-13 ao meio-dia BRT.
    const now = new Date('2026-08-13T15:00:00Z')

    it('aceita hoje, futuro e período que começou no passado mas termina no futuro', () => {
      expect(validateBlockRange('2026-08-13', '2026-08-13', now)).toBeNull()
      expect(validateBlockRange('2026-09-01', '2026-09-10', now)).toBeNull()
      expect(validateBlockRange('2026-08-01', '2026-08-20', now)).toBeNull()
    })

    it('recusa período inteiramente no passado', () => {
      expect(validateBlockRange('2026-08-01', '2026-08-12', now)).toMatch(/já passou/)
    })

    it('recusa fim antes do início', () => {
      expect(validateBlockRange('2026-09-10', '2026-09-01', now)).toMatch(/anterior/)
    })

    it('recusa data malformada', () => {
      expect(validateBlockRange('10/09/2026', '2026-09-10', now)).toMatch(/AAAA-MM-DD/)
    })
  })
})
