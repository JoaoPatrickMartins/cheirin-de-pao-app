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

/** Margem de um combo — o que a precificação assistida (D1) exibe ao vivo no formulário. */
export interface ComboMargin {
  /** `quantity × breadUnitCost` — o que os pães daquele combo custam para a casa. */
  cost: number
  /** `price − cost`, em R$. Negativo quando o combo é vendido no prejuízo. */
  margin: number
  /** Margem sobre o PREÇO (markup sobre receita), 1 casa. */
  marginPct: number
  /** Quanto a casa recebe por pãozinho vendido — a régua que compara combos de tamanhos diferentes. */
  pricePerCredit: number
  /** Custo unitário usado. Repetido aqui para a tela não precisar recalcular. */
  breadUnitCost: number
  /** `true` quando o preço não cobre nem o custo do pão. Avisa, não bloqueia (P-13). */
  belowCost: boolean
}

/**
 * comboMargin — margem do combo a partir do custo do PÃO (D1 · precificação assistida).
 *
 * `null` quando não há custo de pão cadastrado, **nunca zero**: custo zero renderizaria margem de
 * 100% no formulário, que é a mentira mais confortável possível — a mesma disciplina de
 * `productMargin` em `product-cost.ts`.
 *
 * O custo considerado é só o do pão. Não há rateio de despesa operacional aqui, e isso é
 * deliberado: a margem exibida é de CONTRIBUIÇÃO (preço − custo da mercadoria), que é a conta que
 * cabe num formulário de cadastro. Quem quer o resultado depois da operação lê o DRE.
 */
export function comboMargin(
  price: number,
  quantity: number,
  breadUnitCost: number | null | undefined,
): ComboMargin | null {
  if (breadUnitCost == null || !(quantity > 0)) return null
  const cost = Math.round(quantity * breadUnitCost * 100) / 100
  const margin = Math.round((price - cost) * 100) / 100
  return {
    cost,
    margin,
    marginPct: price > 0 ? Math.round((margin / price) * 1000) / 10 : 0,
    pricePerCredit: Math.round((price / quantity) * 100) / 100,
    breadUnitCost,
    belowCost: price < cost,
  }
}
