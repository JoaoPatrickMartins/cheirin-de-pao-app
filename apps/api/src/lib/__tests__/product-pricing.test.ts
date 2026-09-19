// Promoção de um produto da Cestinha.
//
// Dois invariantes que este arquivo existe para proteger:
//  1. O preço efetivo NUNCA chega a zero — zero quebraria a conversão em pãezinhos e liberaria
//     item grátis no carrinho.
//  2. `priceBefore` só existe quando o desconto DE FATO baixa o preço — um riscado que não
//     desconta nada é propaganda enganosa por bug.
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PROMO_DAYS,
  MIN_EFFECTIVE_PRICE,
  effectiveProductPrice,
  isPromoVigente,
  priceView,
  promoExpiryFromNow,
  validatePromo,
  type PromoFields,
} from '../product-pricing.js'

const NOW = new Date('2026-09-20T12:00:00.000Z')
const emDias = (d: number) => new Date(NOW.getTime() + d * 86_400_000)

const promo = (over: Partial<PromoFields> = {}): PromoFields => ({
  isPromo: true,
  promoType: 'PERCENT',
  promoValue: 18,
  promoUntil: emDias(7),
  ...over,
})

describe('isPromoVigente', () => {
  it('vale dentro do prazo', () => {
    expect(isPromoVigente(promo(), NOW)).toBe(true)
  })

  it('vale sem prazo (até eu remover)', () => {
    expect(isPromoVigente(promo({ promoUntil: null }), NOW)).toBe(true)
  })

  it('não vale com prazo vencido', () => {
    expect(isPromoVigente(promo({ promoUntil: emDias(-1) }), NOW)).toBe(false)
  })

  it('não vale desligada, mesmo com desconto e prazo gravados', () => {
    expect(isPromoVigente(promo({ isPromo: false }), NOW)).toBe(false)
  })

  it('não vale sem tipo ou sem valor — nada de selo sem lastro', () => {
    expect(isPromoVigente(promo({ promoType: null }), NOW)).toBe(false)
    expect(isPromoVigente(promo({ promoValue: null }), NOW)).toBe(false)
    expect(isPromoVigente(promo({ promoValue: 0 }), NOW)).toBe(false)
  })

  it('produto sem nenhum campo (documento antigo) não é promoção', () => {
    expect(isPromoVigente({}, NOW)).toBe(false)
  })
})

describe('effectiveProductPrice', () => {
  it('aplica PERCENT e arredonda a 2 casas', () => {
    // 12,00 − 18% = 9,84
    expect(effectiveProductPrice(12, promo({ promoValue: 18 }), NOW)).toBe(9.84)
  })

  it('aplica FIXED', () => {
    expect(effectiveProductPrice(12, promo({ promoType: 'FIXED', promoValue: 3 }), NOW)).toBe(9)
  })

  it('devolve o preço cheio quando a promoção não vale', () => {
    expect(effectiveProductPrice(12, promo({ promoUntil: emDias(-1) }), NOW)).toBe(12)
    expect(effectiveProductPrice(12, {}, NOW)).toBe(12)
  })

  it('NUNCA chega a zero, mesmo com desconto absurdo gravado', () => {
    // Defesa em profundidade: `validatePromo` já barra isso na escrita.
    expect(effectiveProductPrice(10, promo({ promoType: 'FIXED', promoValue: 999 }), NOW)).toBe(
      MIN_EFFECTIVE_PRICE,
    )
    expect(effectiveProductPrice(10, promo({ promoValue: 100 }), NOW)).toBe(MIN_EFFECTIVE_PRICE)
  })
})

describe('priceView', () => {
  it('traz o riscado quando há desconto real', () => {
    expect(priceView(12, promo({ promoValue: 18 }), NOW)).toEqual({ price: 9.84, priceBefore: 12 })
  })

  it('sem promoção não traz riscado', () => {
    expect(priceView(12, {}, NOW)).toEqual({ price: 12, priceBefore: null })
  })

  it('promoção vencida não traz riscado', () => {
    expect(priceView(12, promo({ promoUntil: emDias(-1) }), NOW)).toEqual({
      price: 12,
      priceBefore: null,
    })
  })

  it('desconto que não desconta nada não vira riscado mentiroso', () => {
    // FIXED 0 já cai em `isPromoVigente` (valor não é > 0); aqui o caso de arredondamento.
    expect(priceView(0.01, promo({ promoValue: 1 }), NOW).priceBefore).toBeNull()
  })
})

describe('validatePromo', () => {
  it('aceita desconto saudável', () => {
    expect(validatePromo(12, 'PERCENT', 18)).toBeNull()
    expect(validatePromo(12, 'FIXED', 3)).toBeNull()
  })

  it('recusa valor zero ou negativo', () => {
    expect(validatePromo(12, 'PERCENT', 0)).toContain('maior que zero')
    expect(validatePromo(12, 'FIXED', -1)).toContain('maior que zero')
  })

  it('recusa percentual acima do teto', () => {
    expect(validatePromo(12, 'PERCENT', 91)).toContain('90%')
    expect(validatePromo(12, 'PERCENT', 90)).toBeNull()
  })

  it('recusa desconto fixo que zera ou inverte o preço', () => {
    expect(validatePromo(12, 'FIXED', 12)).toContain('maior ou igual ao preço')
    expect(validatePromo(12, 'FIXED', 20)).toContain('maior ou igual ao preço')
  })

  it('recusa desconto que deixaria o preço abaixo de um centavo', () => {
    // R$ 0,01 com 90% → R$ 0,00
    expect(validatePromo(0.01, 'PERCENT', 90)).toContain('zero')
  })
})

describe('promoExpiryFromNow', () => {
  it('usa 7 dias por padrão — mais curto que o da novidade', () => {
    expect(DEFAULT_PROMO_DAYS).toBe(7)
    expect(promoExpiryFromNow(undefined, NOW)).toEqual(emDias(7))
  })

  it('aceita outro prazo', () => {
    expect(promoExpiryFromNow(30, NOW)).toEqual(emDias(30))
  })
})
