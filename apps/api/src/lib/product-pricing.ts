/**
 * product-pricing.ts — promoção de um produto da Cestinha.
 *
 * Promoção aqui é **preço**, não enfeite: o cliente vê de onde veio o desconto (`de R$ 12,00`
 * riscado sobre `R$ 9,84`) e tudo que deriva do preço acompanha sozinho — o custo em pãezinhos
 * (`creditsForPrice`), o subtotal, o mínimo da Cestinha e o gatilho do gancho grátis. Nenhum
 * deles precisou saber que promoção existe: todos já liam `price`.
 *
 * Espelha a promoção de COMBO ([combo-pricing.ts]): mesmo enum `DiscountType`, mesma aritmética
 * (`lib/discount.ts`), mesmo `antes` no payload. As duas promoções do app falam a mesma língua.
 *
 * Vigência é DERIVADA de `now` na leitura, como pausa e novidade — sem cron, sem minuto perdido,
 * e o preço volta ao cheio sozinho quando o prazo vence.
 *
 * DIFERENÇA IMPORTANTE em relação ao combo: aqui o preço efetivo **nunca** chega a zero. Zero
 * quebraria a conversão em pãezinhos (crédito 0) e liberaria item grátis no carrinho.
 */

import { applyDiscount, type DiscountKind } from './discount.js'

/** Piso do preço efetivo. Abaixo disso a conta de crédito deixa de fazer sentido. */
export const MIN_EFFECTIVE_PRICE = 0.01

/** Desconto percentual máximo. 100% viraria item grátis; 90% já é agressivo o bastante. */
export const MAX_PERCENT_DISCOUNT = 90

/** Prazo padrão de uma promoção, em dias. Mais curto que o da novidade: preço tem fôlego menor. */
export const DEFAULT_PROMO_DAYS = 7

/** Os campos de promoção de um Product. Nullable: documentos antigos não os têm. */
export interface PromoFields {
  isPromo?: boolean | null
  promoType?: DiscountKind | null
  promoValue?: number | null
  promoUntil?: Date | null
  promoPriority?: boolean | null
}

/**
 * A promoção está valendo agora?
 *
 * Exige `promoValue > 0` além do flag: um desconto de zero gravado por engano não pode produzir
 * um "antes" riscado que não desconta nada — isso seria propaganda enganosa por bug.
 */
export function isPromoVigente(p: PromoFields, now: Date = new Date()): boolean {
  if (p.isPromo !== true) return false
  if (p.promoType == null || p.promoValue == null || !(p.promoValue > 0)) return false
  return p.promoUntil == null || p.promoUntil.getTime() > now.getTime()
}

/** Preço cobrado agora: com desconto quando a promoção vale, senão o cheio. Nunca abaixo do piso. */
export function effectiveProductPrice(price: number, p: PromoFields, now: Date = new Date()): number {
  if (!isPromoVigente(p, now)) return price
  const discounted = applyDiscount(price, p.promoType as DiscountKind, p.promoValue as number)
  return Math.max(MIN_EFFECTIVE_PRICE, discounted)
}

export interface PriceView {
  /** O que o cliente paga. */
  price: number
  /** O preço cheio, para o riscado. `null` quando não há desconto de verdade. */
  priceBefore: number | null
}

/**
 * Par (preço, antes) pronto para o payload do cliente.
 *
 * `priceBefore` só aparece quando o desconto **de fato** baixa o preço — um desconto que não
 * desconta nada nunca vira um riscado mentiroso no card.
 */
export function priceView(price: number, p: PromoFields, now: Date = new Date()): PriceView {
  const effective = effectiveProductPrice(price, p, now)
  return { price: effective, priceBefore: effective < price ? price : null }
}

/**
 * Valida um desconto na ESCRITA. Devolve mensagem pt-BR acionável, ou `null` se válido.
 *
 * O Zod barra formato; o que só dá para julgar aqui é a relação entre o desconto e o preço
 * daquele produto — R$ 3 de desconto é válido num item de R$ 12 e absurdo num de R$ 2.
 */
export function validatePromo(price: number, type: DiscountKind, value: number): string | null {
  if (!(value > 0)) return 'O desconto precisa ser maior que zero.'

  if (type === 'PERCENT') {
    if (value > MAX_PERCENT_DISCOUNT) {
      return `O desconto máximo é ${MAX_PERCENT_DISCOUNT}%.`
    }
  } else if (value >= price) {
    return 'O desconto não pode ser maior ou igual ao preço do produto.'
  }

  if (applyDiscount(price, type, value) < MIN_EFFECTIVE_PRICE) {
    return 'Com esse desconto o preço ficaria em zero. Reduza o desconto.'
  }
  return null
}

/** Instante de expiração da promoção daqui a `days` dias. */
export function promoExpiryFromNow(days: number = DEFAULT_PROMO_DAYS, now: Date = new Date()): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
}
