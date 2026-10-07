import { describe, it, expect } from 'vitest'
import { clampOccurredAt } from '../courier-stop.js'
import { resolveCourierRules, DEFAULT_COURIER_RULES } from '../../../lib/courier-profile.js'

describe('clampOccurredAt (horário real da fila offline)', () => {
  const now = new Date('2026-10-01T12:00:00Z') // 09:00 BRT
  it('sem valor ou inválido → null', () => {
    expect(clampOccurredAt(undefined, now)).toBeNull()
    expect(clampOccurredAt('ontem', now)).toBeNull()
  })
  it('no futuro → agora', () => {
    expect(clampOccurredAt('2026-10-01T13:00:00Z', now)).toEqual(now)
  })
  it('antes do início do dia BRT → início do dia', () => {
    expect(clampOccurredAt('2026-09-30T20:00:00Z', now)).toEqual(new Date('2026-10-01T03:00:00Z'))
  })
  it('dentro do dia → o próprio horário', () => {
    expect(clampOccurredAt('2026-10-01T08:31:00Z', now)).toEqual(new Date('2026-10-01T08:31:00Z'))
  })
})

describe('resolveCourierRules', () => {
  it('sem a chave: foto obrigatória nos dois desfechos, reordenar e recados desligados (V-17)', () => {
    expect(resolveCourierRules(null)).toEqual({ fotoEntrega: true, fotoNaoEntrega: true, podeReordenar: false, podeRecados: false })
    expect(resolveCourierRules(undefined)).toEqual(DEFAULT_COURIER_RULES)
  })
  it('usa o que foi gravado; tipo errado cai no padrão', () => {
    expect(resolveCourierRules({ fotoEntrega: false, podeRecados: true, podeReordenar: 'sim' })).toEqual({
      fotoEntrega: false,
      fotoNaoEntrega: true,
      podeReordenar: false,
      podeRecados: true,
    })
  })
})
