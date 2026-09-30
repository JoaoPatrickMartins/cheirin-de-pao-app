import { describe, it, expect } from 'vitest'
import { effectiveComboPrice, comboMargin } from '../combo-pricing.js'

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

// comboMargin — a conta da precificação assistida (D1). O formulário de combo roda a MESMA
// aritmética a cada tecla; travá-la aqui é o que impede as duas de divergirem.
describe('comboMargin', () => {
  it('calcula custo, margem, % e R$ por pãozinho', () => {
    // 30 pães a R$ 0,50 = R$ 15,00 de custo; vendido a R$ 25,00.
    expect(comboMargin(25, 30, 0.5)).toEqual({
      cost: 15,
      margin: 10,
      marginPct: 40,
      pricePerCredit: 0.83,
      breadUnitCost: 0.5,
      belowCost: false,
    })
  })

  it('devolve null — nunca custo zero — quando não há custo cadastrado', () => {
    // Custo zero renderizaria "100% de margem" no formulário, que é a mentira mais confortável
    // possível: o admin precificaria em cima dela.
    expect(comboMargin(25, 30, null)).toBeNull()
    expect(comboMargin(25, 30, undefined)).toBeNull()
  })

  it('devolve null para combo sem quantidade, em vez de dividir por zero', () => {
    expect(comboMargin(25, 0, 0.5)).toBeNull()
    expect(comboMargin(25, -1, 0.5)).toBeNull()
  })

  it('marca `belowCost` e devolve margem NEGATIVA quando o preço não cobre o pão', () => {
    const m = comboMargin(10, 30, 0.5)!
    expect(m.belowCost).toBe(true)
    expect(m.margin).toBe(-5)
    expect(m.marginPct).toBe(-50)
  })

  it('não quebra com preço zero — margem em % vira 0, não NaN', () => {
    const m = comboMargin(0, 10, 0.5)!
    expect(m.marginPct).toBe(0)
    expect(m.belowCost).toBe(true)
    expect(Number.isNaN(m.marginPct)).toBe(false)
  })

  it('arredonda a 2 casas em vez de arrastar lixo de float', () => {
    // 3 × 0,1 = 0,30000000000000004 em ponto flutuante.
    expect(comboMargin(1, 3, 0.1)!.cost).toBe(0.3)
  })
})
