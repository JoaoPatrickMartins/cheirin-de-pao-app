import { describe, it, expect } from 'vitest'
import {
  custoComPaezinhos,
  toCents,
  fromCents,
  CREDIT_SCALE,
  toMilli,
  fromMilli,
  wholeBreads,
  creditsForPrice,
  moneyForCredits,
  formatCredits,
} from '../credits'

describe('custoComPaezinhos', () => {
  // Avulso R$ 1,20 · Fornão 60/59,99 (≈1,00/pão) · Fornalha 45/49,50 (1,10) · Fornin 30/34,50 (1,15)
  it('cobre 100% do valor em pãezinhos, mesmo em preço que não fecha em pão inteiro', () => {
    // R$ 1,80 = 1,5 🥖. Fornão (1,00/pão) → 1,50 · Fornalha (1,10) → 1,65 · Fornin (1,15) → 1,73.
    expect(custoComPaezinhos(1.8, 1.2, 1)).toBeCloseTo(1.5, 2)
    expect(custoComPaezinhos(1.8, 1.2, 1.1)).toBeCloseTo(1.65, 2)
    expect(custoComPaezinhos(1.8, 1.2, 1.15)).toBeCloseTo(1.73, 2)
  })

  it('entrega exatamente a economia anunciada do combo', () => {
    // Fornin custa R$ 1,15/pão contra R$ 1,20 do avulso = 4,2% de economia. O item de R$ 1,80
    // tem de sair com essa MESMA economia — era exatamente isso que o crédito inteiro quebrava.
    const custo = custoComPaezinhos(1.8, 1.2, 1.15)
    const economiaReal = (1 - custo / 1.8) * 100
    const economiaAnunciada = (1 - 1.15 / 1.2) * 100
    expect(economiaReal).toBeCloseTo(economiaAnunciada, 0)
  })

  it('fica sempre abaixo do preço em dinheiro', () => {
    for (const price of [1.8, 1.9, 2.5, 4.2, 12]) {
      for (const unit of [1, 1.1, 1.15]) {
        expect(custoComPaezinhos(price, 1.2, unit)).toBeLessThan(price)
      }
    }
  })

  it('em múltiplo exato, é o preço do combo puro', () => {
    expect(custoComPaezinhos(12, 1.2, 1.15)).toBeCloseTo(11.5, 2) // 10 🥖 × 1,15
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Onda A — mili-pão (1 pãozinho = 1000 milésimos)
// ─────────────────────────────────────────────────────────────────────────────

describe('conversão de milésimos', () => {
  it('vai e volta sem perder valor', () => {
    expect(toMilli(45)).toBe(45000)
    expect(toMilli(1.5)).toBe(1500)
    expect(fromMilli(43500)).toBe(43.5)
    expect(fromMilli(toMilli(2.375))).toBe(2.375)
  })

  it('wholeBreads devolve só os pãezinhos inteiros (o que a agenda pode entregar)', () => {
    expect(wholeBreads(45000)).toBe(45)
    expect(wholeBreads(43500)).toBe(43)
    expect(wholeBreads(999)).toBe(0)
    expect(wholeBreads(0)).toBe(0)
    expect(wholeBreads(-500)).toBe(0)
  })
})

describe('creditsForPrice', () => {
  it('cobre 100% do valor, inclusive em preço que não fecha em pãezinhos inteiros', () => {
    expect(creditsForPrice(1.8, 1.2)).toBe(1500) // 1,5 🥖
    expect(creditsForPrice(2.4, 1.2)).toBe(2000)
    expect(creditsForPrice(12, 1.2)).toBe(10000)
  })

  it('arredonda para baixo, a favor do cliente', () => {
    expect(creditsForPrice(1.9, 1.2)).toBe(1583) // 1,58333… → 1,583
    expect(moneyForCredits(1583, 1.2)).toBeLessThanOrEqual(1.9)
  })

  it('não cobra nada quando falta preço ou avulso', () => {
    expect(creditsForPrice(0, 1.2)).toBe(0)
    expect(creditsForPrice(5, 0)).toBe(0)
  })

  it('o resto em dinheiro desaparece (arredondado a 2 casas)', () => {
    for (const price of [1.8, 1.9, 2.5, 3.7, 12.4, 0.55]) {
      const milli = creditsForPrice(price, 1.2)
      expect(Math.round((price - moneyForCredits(milli, 1.2)) * 100) / 100).toBe(0)
    }
  })
})

describe('promessa do combo (a razão de existir do crédito fracionado)', () => {
  // Avulso R$ 1,20 e os 3 combos reais do print do usuário.
  const AVULSO = 1.2
  const COMBOS = [
    { name: 'Fornão', qtd: 60, preco: 59.99 },
    { name: 'Fornalha', qtd: 45, preco: 49.5 },
    { name: 'Fornin', qtd: 30, preco: 34.5 },
  ]
  const PRECOS = [1.8, 1.9, 2.5, 3.7, 12, 12.4, 49.9]

  it.each(COMBOS)('$name entrega exatamente a economia anunciada, em qualquer preço', (combo) => {
    const unitPrice = combo.preco / combo.qtd
    const economiaAnunciada = (1 - unitPrice / AVULSO) * 100

    for (const preco of PRECOS) {
      // O que o cliente gasta de dinheiro-equivalente pagando com crédito fracionado.
      const milli = creditsForPrice(preco, AVULSO)
      const custo = (milli / CREDIT_SCALE) * unitPrice
      const economiaReal = (1 - custo / preco) * 100

      // Tolerância de 0,1 pp cobre só o arredondamento para baixo do débito.
      expect(economiaReal).toBeGreaterThanOrEqual(economiaAnunciada - 0.1)
      // E nunca pode ficar mais caro que pagar em dinheiro — o bug que originou tudo isto.
      expect(custo).toBeLessThan(preco)
    }
  })

  it('com crédito INTEIRO o item barato invertia a promessa (regressão do bug original)', () => {
    // Fornin (R$ 1,15/pão), produto de R$ 1,80: arredondar para 2 🥖 custava R$ 2,30.
    expect(2 * 1.15).toBeGreaterThan(1.8)
    // Fracionado: 1,5 🥖 × 1,15 = R$ 1,725 → 4,2% de economia, acima dos 4% anunciados.
    const custo = (creditsForPrice(1.8, 1.2) / CREDIT_SCALE) * 1.15
    expect(custo).toBeCloseTo(1.725, 3)
    expect(custo).toBeLessThan(1.8)
  })
})

describe('formatCredits', () => {
  it('mostra inteiro sem casa decimal e fração com uma casa', () => {
    expect(formatCredits(45000)).toBe('45')
    expect(formatCredits(43500)).toBe('43,5')
    expect(formatCredits(1583)).toBe('1,6')
    expect(formatCredits(1500)).toBe('1,5')
    expect(formatCredits(0)).toBe('0')
  })

  it('arredonda a exibição sem alterar a cobrança', () => {
    // 1,583 🥖 é o débito real; a vitrine mostra 1,6 (a favor do cliente).
    expect(formatCredits(creditsForPrice(1.9, 1.2))).toBe('1,6')
  })
})

// Guarda de regressão do bug de float que originou a Onda 0, agora no modelo fracionado:
// `Math.floor(3.30 / 1.10)` devolve 2 em ponto flutuante. `creditsForPrice` conta em centavos
// inteiros, então um múltiplo exato do avulso nunca perde milésimo.
describe('creditsForPrice — múltiplos exatos nunca perdem valor (float)', () => {
  it.each([0.9, 1, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.5, 1.75, 2.5])(
    'avulso R$ %s',
    (avulso) => {
      for (let k = 1; k <= 300; k++) {
        const total = fromCents(k * toCents(avulso))
        expect(creditsForPrice(total, avulso)).toBe(k * CREDIT_SCALE)
      }
    },
  )
})
