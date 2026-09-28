// Helpers de data do módulo de despesas.
//
// Lógica pura e de erro silencioso: um mês trocado por fuso não quebra a tela, só mostra a despesa
// no mês errado — e ninguém percebe até o DRE não fechar.
import { describe, it, expect } from 'vitest'
import { shiftMonth, monthLabel, toDateInput, fmtDayShort, fmtBRL } from '../expense-types'

describe('shiftMonth', () => {
  it('anda para frente e para trás', () => {
    expect(shiftMonth('2026-08', 1)).toBe('2026-09')
    expect(shiftMonth('2026-08', -1)).toBe('2026-07')
  })

  it('atravessa a virada de ano nos dois sentidos', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })

  it('aceita salto maior que 12 meses', () => {
    expect(shiftMonth('2026-08', 12)).toBe('2027-08')
    expect(shiftMonth('2026-08', -14)).toBe('2025-06')
  })

  it('mantém o zero à esquerda', () => {
    expect(shiftMonth('2026-10', -1)).toBe('2026-09')
    expect(shiftMonth('2026-09', -8)).toBe('2026-01')
  })
})

describe('monthLabel', () => {
  it('formata em pt-BR com inicial maiúscula', () => {
    expect(monthLabel('2026-08')).toBe('Agosto de 2026')
    expect(monthLabel('2026-03')).toBe('Março de 2026')
    expect(monthLabel('2026-12')).toBe('Dezembro de 2026')
  })
})

describe('toDateInput — ISO → AAAA-MM-DD em BRT', () => {
  it('converte no calendário BRT, não no do navegador', () => {
    // 00:00 BRT = 03:00 UTC. O campo `<input type="date">` precisa do dia BRT.
    expect(toDateInput('2026-08-15T03:00:00.000Z')).toBe('2026-08-15')
  })

  it('não empurra para o dia seguinte no fim do dia BRT', () => {
    // 31/08 23:00 BRT = 01/09 02:00 UTC. Lido em UTC, a despesa mudaria de mês.
    expect(toDateInput('2026-09-01T02:00:00.000Z')).toBe('2026-08-31')
  })

  it('nulo e vazio viram string vazia (campo em branco)', () => {
    expect(toDateInput(null)).toBe('')
    expect(toDateInput(undefined)).toBe('')
  })
})

describe('fmtDayShort', () => {
  it('formata DD/MM em BRT', () => {
    expect(fmtDayShort('2026-08-15T03:00:00.000Z')).toBe('15/08')
  })

  it('sem data, mostra travessão em vez de "Invalid Date"', () => {
    expect(fmtDayShort(null)).toBe('—')
    expect(fmtDayShort(undefined)).toBe('—')
  })
})

describe('fmtBRL', () => {
  // O `Intl` separa "R$" do número com espaço NÃO separável (U+00A0). Normalizar na assertiva é o
  // certo: trocar a função por concatenação manual perderia o agrupamento de milhar do locale.
  const norm = (s: string) => s.replace(/ /g, ' ')

  it('formata em reais pt-BR', () => {
    expect(norm(fmtBRL(1234.5))).toBe('R$ 1.234,50')
    expect(norm(fmtBRL(0))).toBe('R$ 0,00')
  })

  it('agrupa milhar e mantém duas casas', () => {
    expect(norm(fmtBRL(1_000_000))).toBe('R$ 1.000.000,00')
    expect(norm(fmtBRL(0.5))).toBe('R$ 0,50')
  })
})
