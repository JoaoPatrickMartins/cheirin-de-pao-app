import { describe, it, expect, vi } from 'vitest'
import {
  resolveCondoMinimums,
  getGlobalMinimums,
  getMinimumsForCondo,
  getMinimumsForUser,
  parseMinimoUnico,
  parseMinimoCestinha,
  parseAgendaMinimos,
  coerceAgendaMinimos,
  paesLabel,
  DEFAULT_MIN_CESTINHA,
  type OrderMinimums,
} from '../order-minimums.js'

const AGENDA_2 = { seg: 2, ter: 2, qua: 2, qui: 2, sex: 2, sab: 2, dom: 2 }
const GLOBAL: OrderMinimums = { unico: 2, agenda: AGENDA_2, cestinha: 15 }

const ZERO_AGENDA = { seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 }

/** `setting.findUnique` mockado a partir de um mapa chave → value (ausente = null). */
const settingsBy = (values: Record<string, string>) =>
  vi.fn().mockImplementation(({ where }: { where: { key: string } }) =>
    Promise.resolve(values[where.key] != null ? { key: where.key, value: values[where.key] } : null),
  )

describe('order-minimums', () => {
  describe('parseMinimoUnico', () => {
    it('faz parse e clampa para [1..20]', () => {
      expect(parseMinimoUnico('5')).toBe(5)
      expect(parseMinimoUnico('99')).toBe(20)
      expect(parseMinimoUnico('0')).toBe(1)
      expect(parseMinimoUnico('-3')).toBe(1)
    })

    it('degrada para 1 em valor ausente/inválido (comportamento histórico)', () => {
      expect(parseMinimoUnico(null)).toBe(1)
      expect(parseMinimoUnico(undefined)).toBe(1)
      expect(parseMinimoUnico('abc')).toBe(1)
    })
  })

  describe('parseMinimoCestinha', () => {
    it('faz parse de decimais e trata negativo como 0', () => {
      expect(parseMinimoCestinha('15.00')).toBe(15)
      expect(parseMinimoCestinha('29.9')).toBe(29.9)
      expect(parseMinimoCestinha('-1')).toBe(0)
    })

    it('`0` é válido e significa "sem mínimo"', () => {
      expect(parseMinimoCestinha('0')).toBe(0)
    })

    it('degrada para o default do seed quando ausente/inválido', () => {
      expect(parseMinimoCestinha(null)).toBe(DEFAULT_MIN_CESTINHA)
      expect(parseMinimoCestinha('abc')).toBe(DEFAULT_MIN_CESTINHA)
    })
  })

  describe('parseAgendaMinimos / coerceAgendaMinimos', () => {
    it('clampa cada dia para [0..12] inteiro', () => {
      const r = parseAgendaMinimos(JSON.stringify({ seg: 3, ter: 20, qua: -5, qui: 2.9 }))
      expect(r.seg).toBe(3)
      expect(r.ter).toBe(12) // teto
      expect(r.qua).toBe(0) // negativo → 0
      expect(r.qui).toBe(2) // floor
      expect(r.dom).toBe(0) // ausente → 0
    })

    it('degrada para todos 0 em JSON inválido/ausente', () => {
      expect(parseAgendaMinimos('{invalido')).toEqual(ZERO_AGENDA)
      expect(parseAgendaMinimos(null)).toEqual(ZERO_AGENDA)
    })

    it('coerce aplica a mesma regra a partir de um objeto (override do Prisma)', () => {
      expect(coerceAgendaMinimos({ seg: 4, ter: '3' })).toMatchObject({ seg: 4, ter: 3, qua: 0 })
      expect(coerceAgendaMinimos(null)).toEqual(ZERO_AGENDA)
    })
  })

  describe('resolveCondoMinimums', () => {
    it('herda o global quando não há override', () => {
      const r = resolveCondoMinimums(GLOBAL, null)
      expect(r).toMatchObject({ unico: 2, cestinha: 15 })
      expect(r.agenda.seg).toBe(2)
      expect(r.source).toEqual({ unico: 'global', agenda: 'global', cestinha: 'global' })
    })

    it('herda cada mínimo independentemente', () => {
      const r = resolveCondoMinimums(GLOBAL, { pedidoMinimoUnicoOverride: 5 })
      expect(r.unico).toBe(5)
      expect(r.cestinha).toBe(15) // herdado
      expect(r.agenda.seg).toBe(2) // herdado
      expect(r.source).toEqual({ unico: 'condo', agenda: 'global', cestinha: 'global' })
    })

    it('override da agenda substitui o mapa INTEIRO (não faz merge)', () => {
      const r = resolveCondoMinimums(GLOBAL, { pedidoMinimoAgendaOverride: { seg: 5 } })
      expect(r.agenda.seg).toBe(5)
      expect(r.agenda.ter).toBe(0) // o global exigia 2; o condo não exige nada
      expect(r.source.agenda).toBe('condo')
    })

    it('trata override de agenda vazio ({}) como personalização (sem mínimo no condo)', () => {
      const r = resolveCondoMinimums(GLOBAL, { pedidoMinimoAgendaOverride: {} })
      expect(r.agenda).toEqual(ZERO_AGENDA)
      expect(r.source.agenda).toBe('condo')
    })

    it('cestinha 0 é override VÁLIDO — desliga o mínimo naquele condomínio', () => {
      const r = resolveCondoMinimums(GLOBAL, { marketMinimoCestinhaOverride: 0 })
      expect(r.cestinha).toBe(0)
      expect(r.source.cestinha).toBe('condo')
    })

    it('clampa o override do pedido único ao piso 1 e ao teto 20', () => {
      expect(resolveCondoMinimums(GLOBAL, { pedidoMinimoUnicoOverride: 0 }).unico).toBe(1)
      expect(resolveCondoMinimums(GLOBAL, { pedidoMinimoUnicoOverride: 99 }).unico).toBe(20)
      expect(resolveCondoMinimums(GLOBAL, { pedidoMinimoUnicoOverride: 4.7 }).unico).toBe(4)
    })

    it('clampa o override da Cestinha a >= 0', () => {
      expect(resolveCondoMinimums(GLOBAL, { marketMinimoCestinhaOverride: -5 }).cestinha).toBe(0)
    })

    it('degrada para herança em override inválido (null, string, array, NaN)', () => {
      for (const bad of [null, undefined, 'x', [1, 2], NaN]) {
        const r = resolveCondoMinimums(GLOBAL, {
          pedidoMinimoUnicoOverride: bad,
          pedidoMinimoAgendaOverride: bad,
          marketMinimoCestinhaOverride: bad,
        })
        expect(r).toMatchObject({ unico: 2, cestinha: 15 })
        expect(r.agenda.seg).toBe(2)
        expect(r.source).toEqual({ unico: 'global', agenda: 'global', cestinha: 'global' })
      }
    })
  })

  describe('getGlobalMinimums', () => {
    it('lê as três chaves e aplica os parses', async () => {
      const setting = { findUnique: settingsBy({
        pedidoMinimoUnico: '3',
        pedidoMinimoAgenda: JSON.stringify({ seg: 4 }),
        marketMinimoCestinha: '20.50',
      }) }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await getGlobalMinimums({ setting } as any)
      expect(r).toMatchObject({ unico: 3, cestinha: 20.5 })
      expect(r.agenda.seg).toBe(4)
    })

    it('devolve os defaults quando nenhuma chave existe', async () => {
      const setting = { findUnique: settingsBy({}) }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await getGlobalMinimums({ setting } as any)
      expect(r).toMatchObject({ unico: 1, cestinha: DEFAULT_MIN_CESTINHA })
      expect(r.agenda).toEqual(ZERO_AGENDA)
    })
  })

  describe('getMinimumsForCondo', () => {
    const settingMock = () => ({
      findUnique: settingsBy({ pedidoMinimoUnico: '2', marketMinimoCestinha: '15' }),
    })

    it('sem condominiumId devolve o padrão global e NÃO consulta o condomínio', async () => {
      const setting = settingMock()
      const condominium = { findUnique: vi.fn() }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await getMinimumsForCondo({ setting, condominium } as any, null)
      expect(condominium.findUnique).not.toHaveBeenCalled()
      expect(r.unico).toBe(2)
      expect(r.source).toEqual({ unico: 'global', agenda: 'global', cestinha: 'global' })
    })

    it('aplica o override do condomínio', async () => {
      const setting = settingMock()
      const condominium = {
        findUnique: vi.fn().mockResolvedValue({ pedidoMinimoUnicoOverride: 6 }),
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await getMinimumsForCondo({ setting, condominium } as any, 'c1')
      expect(r.unico).toBe(6)
      expect(r.source.unico).toBe('condo')
      expect(r.cestinha).toBe(15) // herdado
    })

    it('condomínio inexistente cai na herança', async () => {
      const setting = settingMock()
      const condominium = { findUnique: vi.fn().mockResolvedValue(null) }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await getMinimumsForCondo({ setting, condominium } as any, 'sumiu')
      expect(r.unico).toBe(2)
      expect(r.source.unico).toBe('global')
    })
  })

  describe('getMinimumsForUser', () => {
    it('resolve pelo condomínio do cliente', async () => {
      const setting = { findUnique: settingsBy({}) }
      const condominium = {
        findUnique: vi.fn().mockResolvedValue({ marketMinimoCestinhaOverride: 30 }),
      }
      const user = { findUnique: vi.fn().mockResolvedValue({ condominiumId: 'c1' }) }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await getMinimumsForUser({ setting, condominium, user } as any, 'u1')
      expect(condominium.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'c1' } }))
      expect(r.cestinha).toBe(30)
    })

    it('cliente sem condomínio devolve o padrão global', async () => {
      const setting = { findUnique: settingsBy({}) }
      const condominium = { findUnique: vi.fn() }
      const user = { findUnique: vi.fn().mockResolvedValue({ condominiumId: null }) }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await getMinimumsForUser({ setting, condominium, user } as any, 'u1')
      expect(condominium.findUnique).not.toHaveBeenCalled()
      expect(r.cestinha).toBe(DEFAULT_MIN_CESTINHA)
    })
  })

  describe('paesLabel', () => {
    it('usa o singular só no 1', () => {
      expect(paesLabel(1)).toBe('1 pão')
      expect(paesLabel(5)).toBe('5 pães')
    })
  })
})
