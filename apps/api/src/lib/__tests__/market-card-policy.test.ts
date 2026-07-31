import { describe, it, expect } from 'vitest'
import { isCardBelowMinimum, parseCartaoMinimo } from '../market-card-policy.js'

describe('parseCartaoMinimo', () => {
  it('vazio/inválido/negativo → 0 (regra desligada)', () => {
    expect(parseCartaoMinimo(null)).toBe(0)
    expect(parseCartaoMinimo(undefined)).toBe(0)
    expect(parseCartaoMinimo('abc')).toBe(0)
    expect(parseCartaoMinimo('-5')).toBe(0)
    expect(parseCartaoMinimo('0')).toBe(0)
  })
  it('positivo → número', () => {
    expect(parseCartaoMinimo('20')).toBe(20)
    expect(parseCartaoMinimo('20.50')).toBe(20.5)
  })
})

describe('isCardBelowMinimum', () => {
  it('regra desligada (cartaoMinimo <= 0) → nunca barra', () => {
    expect(isCardBelowMinimum(1, 0)).toBe(false)
    expect(isCardBelowMinimum(1, -1)).toBe(false)
  })
  it('sem dinheiro a pagar (moneyAmount <= 0) → nunca barra', () => {
    expect(isCardBelowMinimum(0, 20)).toBe(false)
  })
  it('abaixo do mínimo → barra (só Pix)', () => {
    expect(isCardBelowMinimum(19.99, 20)).toBe(true)
    expect(isCardBelowMinimum(3, 20)).toBe(true)
  })
  it('no mínimo ou acima → libera cartão', () => {
    expect(isCardBelowMinimum(20, 20)).toBe(false)
    expect(isCardBelowMinimum(50, 20)).toBe(false)
  })
})
