// date-range — a fundação de período do módulo Financeiro/DRE.
//
// O que estes testes protegem, em ordem de importância:
//   1. `getDateRange` NÃO mudou. Os 8 relatórios já entregues dependem dela.
//   2. Mês fechado é fechado (não vai até "agora") e mês em curso se declara parcial.
//   3. `previousWindow` compara coisas comparáveis — é onde o painel errava antes.
//   4. Virada de mês/ano e fevereiro não produzem janela invertida nem sobreposta.
import { describe, it, expect } from 'vitest'
import {
  getDateRange,
  presetWindow,
  monthWindow,
  rangeWindow,
  resolveWindow,
  toWindow,
  previousWindow,
  percentDelta,
  monthKey,
} from '../date-range.js'

/** Instante UTC a partir de uma hora BRT — o fuso é fixo em −3h (sem horário de verão). */
const brt = (iso: string) => new Date(`${iso}-03:00`)

describe('presetWindow — atalhos legados', () => {
  it('day começa na meia-noite BRT e termina agora', () => {
    const now = brt('2026-08-15T14:30:00')
    const w = presetWindow('day', now)

    expect(w.startDate.toISOString()).toBe('2026-08-15T03:00:00.000Z') // 00:00 BRT
    expect(w.endDate).toBe(now)
    expect(w.isPartial).toBe(true)
    expect(w.label).toBe('hoje')
  })

  it('week começa na segunda-feira BRT', () => {
    // 2026-08-15 é um sábado → a segunda é 2026-08-10.
    const w = presetWindow('week', brt('2026-08-15T14:30:00'))
    expect(w.startDate.toISOString()).toBe('2026-08-10T03:00:00.000Z')
  })

  it('week num domingo volta 6 dias, não avança para a segunda seguinte', () => {
    // 2026-08-16 é domingo — o caso que um `weekday - 1` ingênuo joga para o futuro.
    const w = presetWindow('week', brt('2026-08-16T10:00:00'))
    expect(w.startDate.toISOString()).toBe('2026-08-10T03:00:00.000Z')
  })

  it('month começa no dia 1 BRT', () => {
    const w = presetWindow('month', brt('2026-08-15T14:30:00'))
    expect(w.startDate.toISOString()).toBe('2026-08-01T03:00:00.000Z')
  })

  it('resolve a virada de mês pelo calendário BRT, não pelo UTC', () => {
    // 31/08 23:00 BRT = 01/09 02:00 UTC. Lido em UTC, o dia viraria setembro e a despesa/receita
    // cairia no mês errado — a armadilha registrada no plano.
    const w = presetWindow('month', brt('2026-08-31T23:00:00'))
    expect(w.startDate.toISOString()).toBe('2026-08-01T03:00:00.000Z')
  })
})

describe('getDateRange — retrocompatibilidade (os 8 relatórios dependem disto)', () => {
  it('devolve exatamente startDate/endDate, sem campos extras', () => {
    const r = getDateRange('week')
    expect(Object.keys(r).sort()).toEqual(['endDate', 'startDate'])
  })

  it('concorda com presetWindow nos três presets', () => {
    for (const p of ['day', 'week', 'month'] as const) {
      const legacy = getDateRange(p)
      const w = presetWindow(p, legacy.endDate)
      expect(legacy.startDate.getTime()).toBe(w.startDate.getTime())
    }
  })
})

describe('monthWindow — o que o DRE precisa', () => {
  it('mês encerrado devolve janela FECHADA (dia 1 ao dia 1 seguinte)', () => {
    const w = monthWindow('2026-08', brt('2026-09-20T10:00:00'))

    expect(w.startDate.toISOString()).toBe('2026-08-01T03:00:00.000Z')
    expect(w.endDate.toISOString()).toBe('2026-09-01T03:00:00.000Z')
    expect(w.isPartial).toBe(false)
    expect(w.label).toBe('agosto de 2026')
  })

  it('mês em curso fecha em agora e se declara parcial', () => {
    const now = brt('2026-09-20T10:00:00')
    const w = monthWindow('2026-09', now)

    expect(w.endDate.getTime()).toBe(now.getTime())
    expect(w.isPartial).toBe(true)
  })

  it('dezembro fecha em 1º de janeiro do ano seguinte', () => {
    const w = monthWindow('2026-12', brt('2027-02-01T00:00:00'))
    expect(w.endDate.toISOString()).toBe('2027-01-01T03:00:00.000Z')
  })

  it('mês no futuro devolve janela VAZIA, nunca invertida', () => {
    // Janela invertida faria todo `gte/lte` do Prisma devolver zero em silêncio.
    const w = monthWindow('2027-03', brt('2026-09-20T10:00:00'))
    expect(w.endDate.getTime()).toBe(w.startDate.getTime())
    expect(w.endDate.getTime()).toBeGreaterThanOrEqual(w.startDate.getTime())
  })

  it('rejeita formato inválido', () => {
    expect(() => monthWindow('2026-13')).toThrow(/YYYY-MM/)
    expect(() => monthWindow('08-2026')).toThrow(/YYYY-MM/)
    expect(() => monthWindow('2026-00')).toThrow(/YYYY-MM/)
  })
})

describe('rangeWindow — `to` é inclusivo', () => {
  it('inclui o dia final inteiro', () => {
    const w = rangeWindow('2026-07-01', '2026-08-15', brt('2026-09-01T00:00:00'))

    expect(w.startDate.toISOString()).toBe('2026-07-01T03:00:00.000Z')
    // Fecha na meia-noite BRT do dia 16 — quem pede "até 15/08" quer o dia 15 completo.
    expect(w.endDate.toISOString()).toBe('2026-08-16T03:00:00.000Z')
    expect(w.label).toBe('01/07/2026 a 15/08/2026')
  })

  it('aceita from === to (um único dia)', () => {
    const w = rangeWindow('2026-08-15', '2026-08-15', brt('2026-09-01T00:00:00'))
    expect(w.endDate.getTime() - w.startDate.getTime()).toBe(24 * 60 * 60 * 1000)
  })

  it('marca parcial quando o intervalo avança sobre o futuro', () => {
    const w = rangeWindow('2026-09-01', '2026-09-30', brt('2026-09-20T10:00:00'))
    expect(w.isPartial).toBe(true)
  })

  it('rejeita to anterior a from e formato inválido', () => {
    expect(() => rangeWindow('2026-08-15', '2026-08-14')).toThrow(/posterior/)
    expect(() => rangeWindow('15/08/2026', '2026-08-16')).toThrow(/YYYY-MM-DD/)
  })
})

describe('previousWindow — comparar coisas comparáveis', () => {
  it('preset day compara com o MESMO dia da semana (o bug do painel)', () => {
    // O painel comparava hoje com ontem: toda segunda despencava contra o domingo.
    const now = brt('2026-08-17T14:00:00') // segunda
    const prev = previousWindow(presetWindow('day', now))

    expect(prev.startDate.toISOString()).toBe('2026-08-10T03:00:00.000Z') // segunda anterior
    expect(prev.endDate.toISOString()).toBe(new Date(now.getTime() - 7 * 86400000).toISOString())
    expect(prev.label).toBe('mesmo dia da semana anterior')
  })

  it('preset week volta uma semana mantendo o avanço', () => {
    const w = presetWindow('week', brt('2026-08-15T14:00:00'))
    const prev = previousWindow(w)

    expect(prev.startDate.toISOString()).toBe('2026-08-03T03:00:00.000Z')
    expect(w.endDate.getTime() - w.startDate.getTime()).toBe(
      prev.endDate.getTime() - prev.startDate.getTime(),
    )
  })

  it('mês EM CURSO compara month-to-date × month-to-date', () => {
    // 20 dias de setembro contra agosto INTEIRO daria −35% de mentira.
    const w = presetWindow('month', brt('2026-09-20T12:00:00'))
    const prev = previousWindow(w)

    expect(prev.startDate.toISOString()).toBe('2026-08-01T03:00:00.000Z')
    expect(prev.endDate.toISOString()).toBe('2026-08-20T15:00:00.000Z') // mesmo ponto de avanço
    expect(prev.isPartial).toBe(true)
    expect(prev.label).toContain('mesmo ponto')
  })

  it('mês FECHADO compara com o mês anterior inteiro', () => {
    const prev = previousWindow(monthWindow('2026-08', brt('2026-09-20T10:00:00')))

    expect(prev.startDate.toISOString()).toBe('2026-07-01T03:00:00.000Z')
    expect(prev.endDate.toISOString()).toBe('2026-08-01T03:00:00.000Z')
    expect(prev.isPartial).toBe(false)
    expect(prev.label).toBe('julho de 2026')
  })

  it('janeiro fechado compara com dezembro do ano anterior', () => {
    const prev = previousWindow(monthWindow('2026-01', brt('2026-03-01T10:00:00')))

    expect(prev.startDate.toISOString()).toBe('2025-12-01T03:00:00.000Z')
    expect(prev.label).toBe('dezembro de 2025')
  })

  it('mês curto não transborda para dentro do mês atual', () => {
    // 31 de março em curso → fevereiro tem 28 dias. Sem o clamp, o "mesmo ponto" avançaria
    // para dentro de março e as duas janelas do comparativo se sobreporiam.
    const w = presetWindow('month', brt('2026-03-31T23:00:00'))
    const prev = previousWindow(w)

    expect(prev.startDate.toISOString()).toBe('2026-02-01T03:00:00.000Z')
    expect(prev.endDate.getTime()).toBeLessThanOrEqual(w.startDate.getTime())
  })

  it('intervalo volta o mesmo número de dias, imediatamente antes', () => {
    const w = rangeWindow('2026-08-01', '2026-08-10', brt('2026-09-01T00:00:00'))
    const prev = previousWindow(w)

    expect(prev.endDate.getTime()).toBe(w.startDate.getTime())
    expect(prev.endDate.getTime() - prev.startDate.getTime()).toBe(
      w.endDate.getTime() - w.startDate.getTime(),
    )
    expect(prev.startDate.toISOString()).toBe('2026-07-22T03:00:00.000Z')
  })

  it('nunca sobrepõe a janela atual', () => {
    const windows = [
      presetWindow('day', brt('2026-08-17T14:00:00')),
      presetWindow('week', brt('2026-08-17T14:00:00')),
      presetWindow('month', brt('2026-09-20T12:00:00')),
      monthWindow('2026-08', brt('2026-09-20T10:00:00')),
      rangeWindow('2026-08-01', '2026-08-10', brt('2026-09-01T00:00:00')),
    ]
    for (const w of windows) {
      expect(previousWindow(w).endDate.getTime()).toBeLessThanOrEqual(w.startDate.getTime())
    }
  })
})

describe('toWindow / resolveWindow', () => {
  it('toWindow aceita preset cru (o caminho dos 8 relatórios)', () => {
    const now = brt('2026-08-15T14:00:00')
    expect(toWindow('day', now).startDate.getTime()).toBe(presetWindow('day', now).startDate.getTime())
  })

  it('toWindow devolve a própria janela quando já resolvida', () => {
    const w = monthWindow('2026-08', brt('2026-09-20T10:00:00'))
    expect(toWindow(w)).toBe(w)
  })

  it('resolveWindow cobre as três formas', () => {
    const now = brt('2026-09-20T10:00:00')
    expect(resolveWindow({ kind: 'preset', period: 'month' }, now).isPartial).toBe(true)
    expect(resolveWindow({ kind: 'month', month: '2026-08' }, now).isPartial).toBe(false)
    expect(resolveWindow({ kind: 'range', from: '2026-08-01', to: '2026-08-10' }, now).label).toBe(
      '01/08/2026 a 10/08/2026',
    )
  })
})

describe('percentDelta', () => {
  it('calcula a variação com 1 casa', () => {
    expect(percentDelta(110, 100)).toBe(10)
    expect(percentDelta(90, 100)).toBe(-10)
    expect(percentDelta(1234, 1000)).toBe(23.4)
  })

  it('devolve null quando a base é zero (0 → 10 não é "+1000%")', () => {
    expect(percentDelta(10, 0)).toBeNull()
    expect(percentDelta(0, 0)).toBeNull()
  })

  it('usa o módulo da base para não inverter o sinal num prejuízo', () => {
    // Prejuízo de 100 que vira prejuízo de 50 é MELHORA: +50%, não −50%.
    expect(percentDelta(-50, -100)).toBe(50)
  })
})

describe('monthKey', () => {
  it('normaliza mês fora da faixa', () => {
    expect(monthKey(2026, 7)).toBe('2026-08')
    expect(monthKey(2026, -1)).toBe('2025-12')
    expect(monthKey(2026, 12)).toBe('2027-01')
  })
})
