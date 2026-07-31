/**
 * market-card-policy.ts — política de pagamento com cartão da Cestinha.
 *
 * O admin configura um valor mínimo (R$, setting `marketCartaoMinimo`) para liberar o cartão
 * de crédito na parte EM DINHEIRO do pedido (após descontar os pãezinhos). Abaixo desse valor
 * a parte em dinheiro só pode ser paga via Pix. `cartaoMinimo <= 0` desliga a regra (cartão
 * sempre liberado) — é o default, mantendo o comportamento anterior.
 */

/** Chave do Setting global. */
export const MARKET_CARTAO_MIN_KEY = 'marketCartaoMinimo'

/** Parse defensivo do valor (R$) — inválido/negativo → 0 (regra desligada). */
export function parseCartaoMinimo(raw: string | null | undefined): number {
  const n = raw == null ? 0 : parseFloat(raw)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * true quando a parte em dinheiro deve ser barrada no cartão (só Pix): há dinheiro a pagar
 * (`moneyAmount > 0`), a regra está ativa (`cartaoMinimo > 0`) e o valor está abaixo do mínimo.
 */
export function isCardBelowMinimum(moneyAmount: number, cartaoMinimo: number): boolean {
  return cartaoMinimo > 0 && moneyAmount > 0 && moneyAmount < cartaoMinimo
}
