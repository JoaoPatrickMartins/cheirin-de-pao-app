/**
 * discount.ts — a conta de desconto, em um lugar só.
 *
 * Existem duas promoções no sistema: a de COMBO (model `Promotion`, cobrada em
 * `payments.resolveAmount`) e a de PRODUTO da Cestinha (campos no `Product`). As duas usam o mesmo
 * enum `DiscountType` e a mesma aritmética — e aritmética de preço duplicada é exatamente o tipo
 * de código que diverge em silêncio até alguém cobrar errado.
 *
 * O piso fica com o chamador: o combo aceita zerar (`effectiveComboPrice`), o produto não
 * (preço zero quebraria a conversão em pãezinhos e liberaria item grátis).
 */

export type DiscountKind = 'PERCENT' | 'FIXED'

/** Preço com o desconto aplicado, arredondado a 2 casas. Pode dar <= 0 — quem chama decide o piso. */
export function applyDiscount(price: number, type: DiscountKind, value: number): number {
  const discounted = type === 'PERCENT' ? price * (1 - value / 100) : price - value
  return Math.round(discounted * 100) / 100
}
