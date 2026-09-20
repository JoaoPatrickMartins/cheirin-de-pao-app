/**
 * Cálculo do preço efetivo de um combo considerando a promoção ativa.
 *
 * Fonte única da verdade: usado tanto na listagem de combos do cliente
 * (GET /combos) quanto na cobrança (payments.resolveAmount), para que o
 * preço exibido seja exatamente o preço cobrado.
 *
 * Promoção é a Promotion com isActive=true mais recente do combo
 * (discountType PERCENT|FIXED, discountValue). null = sem promoção.
 */
import { applyDiscount } from './discount.js'

export type PromotionLike = {
  discountType: 'PERCENT' | 'FIXED'
  discountValue: number
} | null

/**
 * Preço com desconto aplicado, arredondado a 2 casas e nunca negativo.
 *
 * A aritmética mora em `lib/discount.ts`, compartilhada com a promoção de PRODUTO da Cestinha —
 * são a mesma conta e não podem divergir. O piso de zero é daqui: o combo pode chegar a grátis,
 * o produto não.
 */
export function effectiveComboPrice(price: number, promotion: PromotionLike): number {
  if (!promotion) return price
  return Math.max(0, applyDiscount(price, promotion.discountType, promotion.discountValue))
}

/**
 * Economia do combo vs. comprar a mesma quantidade no avulso.
 *
 * cheio  = avulsoUnit × quantidade   (quanto custaria avulso)
 * savings = cheio − price            (economia em R$, 2 casas)
 * percent = savings / cheio × 100    (economia %, inteiro)
 *
 * Retorna null quando não há economia positiva (ou o avulso não está configurado),
 * para o card simplesmente não exibir a tag. `price` deve ser o preço efetivo já
 * exibido (com desconto de promoção, quando houver), para o valor ser verdadeiro.
 */
export function comboEconomy(
  price: number,
  quantity: number,
  avulsoUnit: number,
): { savings: number; percent: number } | null {
  const cheio = avulsoUnit * quantity
  if (!(cheio > 0)) return null
  const savings = Math.round((cheio - price) * 100) / 100
  if (!(savings > 0)) return null
  const percent = Math.round((savings / cheio) * 100)
  if (percent <= 0) return null
  return { savings, percent }
}
