// Rótulos de disponibilidade da lista de produtos (admin).
//
// O invariante de produto aqui: "Pausado" nunca é vermelho de erro, e a pill sempre diz o que
// desfaz a pausa — prazo, hora da volta, ou "até religar". Pausa sem essa informação vira um
// item que ninguém sabe por que está fora do ar.
import { describe, it, expect } from 'vitest'
import {
  availabilityBadge,
  hhmm,
  humanDuration,
  minutesUntil,
  storeHoursSummary,
  windowLabel,
  type ProductAvailability,
} from '../product-availability'

const NOW = new Date('2026-09-20T12:00:00.000Z')
const iso = (offsetMinutes: number) => new Date(NOW.getTime() + offsetMinutes * 60_000).toISOString()

describe('humanDuration', () => {
  it('cai a granularidade conforme o prazo cresce', () => {
    expect(humanDuration(0)).toBe('menos de 1 min')
    expect(humanDuration(12)).toBe('12 min')
    expect(humanDuration(60)).toBe('1h')
    expect(humanDuration(80)).toBe('1h20')
    expect(humanDuration(60 * 24)).toBe('1 dia')
    expect(humanDuration(60 * 24 * 3)).toBe('3 dias')
  })
})

describe('minutesUntil', () => {
  it('arredonda para cima e nunca fica negativo', () => {
    expect(minutesUntil(iso(30), NOW)).toBe(30)
    expect(minutesUntil(iso(-30), NOW)).toBe(0)
  })
})

describe('hhmm', () => {
  it('formata o instante com dois dígitos', () => {
    const d = new Date(2026, 8, 20, 9, 5)
    expect(hhmm(d.toISOString())).toBe('09:05')
  })
})

describe('windowLabel', () => {
  // `from` = reabre, `until` = fecha. O rótulo diz o VERBO porque a janela pode cruzar a
  // meia-noite: "22:00–20:00" leria ao contrário.
  it('descreve o horário pelas ações, não pelo intervalo', () => {
    expect(windowLabel('22:00', '20:00')).toBe('fecha 20:00 · reabre 22:00')
    expect(windowLabel('06:00', '20:00')).toBe('fecha 20:00 · reabre 06:00')
    expect(windowLabel(null, '20:00')).toBe('fecha 20:00')
    expect(windowLabel('06:00', null)).toBe('reabre 06:00')
    expect(windowLabel(null, null)).toBe('')
  })
})

describe('storeHoursSummary', () => {
  it('descreve quando a loja está FECHADA — que é o que o admin confere', () => {
    expect(storeHoursSummary('22:00', '20:00')).toBe('Fechado das 20:00 às 22:00 · aberto o resto do dia.')
    expect(storeHoursSummary('06:00', '20:00')).toBe('Fechado das 20:00 às 06:00 · aberto o resto do dia.')
    expect(storeHoursSummary(null, '20:00')).toBe('Fechado das 20:00 à meia-noite.')
    expect(storeHoursSummary('06:00', null)).toBe('Fechado da meia-noite às 06:00.')
    expect(storeHoursSummary(null, null)).toBe('Sempre aberto.')
  })
})

describe('availabilityBadge', () => {
  const a = (over: Partial<ProductAvailability>): ProductAvailability => ({
    state: 'ativo',
    reason: null,
    until: null,
    ...over,
  })

  it('pausa temporária mostra a contagem regressiva', () => {
    const b = availabilityBadge(a({ state: 'pausado', reason: 'temporaria', until: iso(12) }), NOW)
    expect(b.label).toBe('Pausado')
    expect(b.detail).toBe('12 min')
  })

  it('pausa por horário mostra a hora da volta', () => {
    const until = new Date(2026, 8, 20, 22, 0)
    const b = availabilityBadge(a({ state: 'pausado', reason: 'horario', until: until.toISOString() }), NOW)
    expect(b.detail).toBe('volta 22:00')
  })

  it('pausa sem prazo diz que depende do admin', () => {
    const b = availabilityBadge(a({ state: 'pausado', reason: 'manual' }), NOW)
    expect(b.detail).toBe('até religar')
  })

  it('pausado não usa a cor de erro', () => {
    const b = availabilityBadge(a({ state: 'pausado', reason: 'manual' }), NOW)
    expect(b.color).not.toContain('warn')
    expect(b.color).toBe('var(--color-accent)')
  })

  it('inativo, esgotado e ativo mantêm os rótulos históricos', () => {
    expect(availabilityBadge(a({ state: 'inativo' }), NOW).label).toBe('Inativo')
    expect(availabilityBadge(a({ state: 'esgotado' }), NOW).label).toBe('Esgotado')
    expect(availabilityBadge(a({ state: 'ativo' }), NOW).label).toBe('Ativo')
  })

  it('estoque baixo só aparece quando o produto está de fato ativo', () => {
    expect(availabilityBadge(a({ state: 'ativo' }), NOW, true).label).toBe('Baixo')
    // Pausado tem precedência: o admin precisa ver a decisão, não o nível do estoque.
    expect(availabilityBadge(a({ state: 'pausado', reason: 'manual' }), NOW, true).label).toBe('Pausado')
  })

  it('sem payload de disponibilidade degrada para "Ativo"', () => {
    expect(availabilityBadge(undefined, NOW).label).toBe('Ativo')
  })
})
