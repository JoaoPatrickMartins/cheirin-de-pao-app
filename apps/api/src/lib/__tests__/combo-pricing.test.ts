import { describe, it, expect } from 'vitest'
import { effectiveComboPrice } from '../combo-pricing.js'

describe('effectiveComboPrice', () => {
  it('retorna o preço cheio quando não há promoção', () => {
    expect(effectiveComboPrice(99.9, null)).toBe(99.9)
  })

  it('aplica desconto PERCENT e arredonda a 2 casas', () => {
    // 99,90 - 15% = 84,915 → 84,92
    expect(effectiveComboPrice(99.9, { discountType: 'PERCENT', discountValue: 15 })).toBe(84.92)
  })

  it('aplica desconto FIXED', () => {
    expect(effectiveComboPrice(50, { discountType: 'FIXED', discountValue: 10 })).toBe(40)
  })

  it('nunca retorna preço negativo', () => {
    expect(effectiveComboPrice(10, { discountType: 'FIXED', discountValue: 999 })).toBe(0)
    expect(effectiveComboPrice(10, { discountType: 'PERCENT', discountValue: 150 })).toBe(0)
  })
})
