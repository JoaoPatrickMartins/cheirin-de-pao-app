import { describe, it, expect } from 'vitest'
import {
  nowHHMM,
  dayKeyOf,
  targetDeliveryDate,
  isPastCutoffForDelivery,
  isSlotCutoffPast,
  nextDeliveryDateStr,
} from '../cutoff.js'

describe('cutoff util (BRT / Regra A)', () => {
  describe('nowHHMM', () => {
    it('converte UTC para HH:MM BRT (UTC-3)', () => {
      // 2026-06-22T01:00:00Z = 22:00 BRT
      expect(nowHHMM(new Date('2026-06-22T01:00:00Z'))).toBe('22:00')
      // 2026-06-21T13:00:00Z = 10:00 BRT
      expect(nowHHMM(new Date('2026-06-21T13:00:00Z'))).toBe('10:00')
    })
  })

  describe('targetDeliveryDate (Regra A)', () => {
    it('manhã (slot 06:30, corte 22:00) → entrega AMANHÃ', () => {
      // agora = 22:00 BRT de domingo 21/06/2026
      const now = new Date('2026-06-22T01:00:00Z')
      const d = targetDeliveryDate('06:30', '22:00', now)
      // dia alvo = segunda 22/06 → 'seg'
      expect(dayKeyOf(d)).toBe('seg')
      expect(d.toISOString().slice(0, 10)).toBe('2026-06-22')
    })

    it('tarde (slot 15:30, corte 10:00) → entrega HOJE', () => {
      // agora = 10:00 BRT de domingo 21/06/2026
      const now = new Date('2026-06-21T13:00:00Z')
      const d = targetDeliveryDate('15:30', '10:00', now)
      // dia alvo = domingo 21/06 → 'dom'
      expect(dayKeyOf(d)).toBe('dom')
      expect(d.toISOString().slice(0, 10)).toBe('2026-06-21')
    })
  })

  describe('isPastCutoffForDelivery', () => {
    it('manhã: corte é na véspera 22:00; bloqueia após esse instante', () => {
      // entrega seg 22/06 → corte 22:00 do dia 21/06 = 2026-06-22T01:00Z
      expect(isPastCutoffForDelivery('06:30', '22:00', '2026-06-22', new Date('2026-06-21T20:00:00Z'))).toBe(false)
      expect(isPastCutoffForDelivery('06:30', '22:00', '2026-06-22', new Date('2026-06-22T02:00:00Z'))).toBe(true)
    })

    it('tarde: corte é no mesmo dia 10:00; bloqueia após esse instante', () => {
      // entrega 22/06 → corte 10:00 do dia 22/06 = 2026-06-22T13:00Z
      expect(isPastCutoffForDelivery('15:30', '10:00', '2026-06-22', new Date('2026-06-22T12:00:00Z'))).toBe(false)
      expect(isPastCutoffForDelivery('15:30', '10:00', '2026-06-22', new Date('2026-06-22T14:00:00Z'))).toBe(true)
    })
  })

  describe('nextDeliveryDateStr', () => {
    it('próxima entrega é AMANHÃ quando o horário do slot já passou hoje', () => {
      // 20:46 BRG de 21/06 — tarde 15:30 já passou → próxima é amanhã 22/06
      const now = new Date('2026-06-22T01:00:00Z')
      expect(nextDeliveryDateStr('15:30', now)).toBe('2026-06-22')
    })

    it('próxima entrega é HOJE quando o horário do slot ainda está à frente', () => {
      // 10:00 BRT de 21/06 — tarde 15:30 ainda à frente → entrega hoje 21/06
      const now = new Date('2026-06-21T13:00:00Z')
      expect(nextDeliveryDateStr('15:30', now)).toBe('2026-06-21')
    })
  })

  describe('lock por próxima ocorrência (banner)', () => {
    // tarde 15:30 / corte 10:00; manhã 06:30 / corte 22:00
    it('às 20:46 nenhum slot está locked (tarde de hoje já passou → próxima é amanhã; manhã ainda no prazo)', () => {
      const t = new Date('2026-06-21T23:46:00Z') // 20:46 BRT
      const tardeNext = nextDeliveryDateStr('15:30', t)
      const manhaNext = nextDeliveryDateStr('06:30', t)
      expect(isPastCutoffForDelivery('15:30', '10:00', tardeNext, t)).toBe(false)
      expect(isPastCutoffForDelivery('06:30', '22:00', manhaNext, t)).toBe(false)
    })

    it('às 22:30 a manhã de amanhã fica locked (passou o corte 22:00) e a tarde segue aberta', () => {
      const t = new Date('2026-06-22T01:30:00Z') // 22:30 BRT do dia 21
      const tardeNext = nextDeliveryDateStr('15:30', t)
      const manhaNext = nextDeliveryDateStr('06:30', t)
      expect(isPastCutoffForDelivery('06:30', '22:00', manhaNext, t)).toBe(true)
      expect(isPastCutoffForDelivery('15:30', '10:00', tardeNext, t)).toBe(false)
    })
  })

  describe('isSlotCutoffPast', () => {
    it('compara hora BRT atual com cutoffTime', () => {
      const now = new Date('2026-06-21T13:00:00Z') // 10:00 BRT
      expect(isSlotCutoffPast('10:00', now)).toBe(true)
      expect(isSlotCutoffPast('22:00', now)).toBe(false)
    })
  })
})
