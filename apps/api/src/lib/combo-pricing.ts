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
export type PromotionLike = {
  discountType: 'PERCENT' | 'FIXED'
  discountValue: number
} | null

/** Preço com desconto aplicado, arredondado a 2 casas e nunca negativo. */
export function effectiveComboPrice(price: number, promotion: PromotionLike): number {
  if (!promotion) return price
  const discounted =
    promotion.discountType === 'PERCENT'
      ? price * (1 - promotion.discountValue / 100)
      : price - promotion.discountValue
  return Math.max(0, Math.round(discounted * 100) / 100)
}
