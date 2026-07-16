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
