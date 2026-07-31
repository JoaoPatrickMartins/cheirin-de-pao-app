import { describe, it, expect } from 'vitest'
import { refundableCredits, refundableCreditsMilli } from '../market-reversal.js'

/**
 * `reverseMarketOrder` precisa do Prisma; aqui cobre-se só a matemática do estorno
 * (`refundableCredits`), que é o que a UI mostra antes de confirmar e o que a transação grava.
 *
 * Os pedidos são descritos pelo campo CANÔNICO (`creditsAppliedMilli`) — desde a limpeza dos
 * legados (31/07/2026) é o único que a aplicação lê.
 */
describe('refundableCredits', () => {
  it('devolve só os créditos aplicados quando o pedido morreu aguardando Pix', () => {
    // PENDING_PAYMENT = dinheiro nunca capturado.
    expect(refundableCredits({ status: 'PENDING_PAYMENT', creditsAppliedMilli: 3000, moneyAmount: 5 }, 1.2)).toBe(3)
  })

  it('converte a parte em dinheiro PROPORCIONALMENTE, nunca para o pãozinho inteiro', () => {
    // R$ 0,60 com avulso R$ 1,20 = meio pãozinho. Arredondar para 1 🥖 devolveria R$ 1,20 por
    // R$ 0,60 pagos — brecha de dinheiro (ver o teste de neutralidade no fim do arquivo).
    expect(refundableCredits({ status: 'SCHEDULED', creditsAppliedMilli: 1000, moneyAmount: 0.6 }, 1.2)).toBe(1.5)
    expect(refundableCredits({ status: 'SCHEDULED', creditsAppliedMilli: 0, moneyAmount: 1.3 }, 1.2)).toBeCloseTo(1.083, 3)
  })

  it('não perde pãozinho quando a parte em dinheiro é múltiplo exato do avulso', () => {
    expect(refundableCredits({ status: 'DELIVERED', creditsAppliedMilli: 0, moneyAmount: 3.3 }, 1.1)).toBe(3)
    expect(refundableCredits({ status: 'DELIVERED', creditsAppliedMilli: 2000, moneyAmount: 9.1 }, 1.3)).toBe(9)
  })

  it('ignora a parte em dinheiro quando não houve nenhuma', () => {
    expect(refundableCredits({ status: 'SCHEDULED', creditsAppliedMilli: 4000, moneyAmount: 0 }, 1.2)).toBe(4)
  })

  it('não estoura com avulso não configurado', () => {
    expect(refundableCredits({ status: 'SCHEDULED', creditsAppliedMilli: 2000, moneyAmount: 5 }, 0)).toBe(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Onda C — crédito fracionado no estorno
// ─────────────────────────────────────────────────────────────────────────────

describe('refundableCredits com crédito fracionado', () => {
  it('devolve EXATAMENTE o que foi debitado, sem arredondar para cima', () => {
    // Compra de R$ 1,80 paga 100% em crédito: 1,5 🥖 saem, 1,5 🥖 voltam.
    const order = { status: 'SCHEDULED', creditsAppliedMilli: 1500, moneyAmount: 0 }
    expect(refundableCreditsMilli(order, 1.2)).toBe(1500)
    expect(refundableCredits(order, 1.2)).toBe(1.5)
  })

  it('nunca arredonda para cima: 1,5 🥖 debitados devolvem 1,5, não 2', () => {
    const order = { status: 'SCHEDULED', creditsAppliedMilli: 1500, moneyAmount: 0 }
    expect(refundableCredits(order, 1.2)).not.toBe(2)
  })

  it('pedido sem o canônico gravado devolve zero de crédito (não inventa saldo)', () => {
    const order = { status: 'SCHEDULED', creditsAppliedMilli: null, moneyAmount: 0 }
    expect(refundableCreditsMilli(order, 1.2)).toBe(0)
  })

  it('soma crédito e dinheiro sem inflar nada', () => {
    // 1,5 🥖 debitados + R$ 0,60 pagos (= 0,5 🥖) → 2 🥖. Com o `ceil` antigo dava 2,5.
    const order = { status: 'DELIVERED', creditsAppliedMilli: 1500, moneyAmount: 0.6 }
    expect(refundableCredits(order, 1.2)).toBe(2)
  })

  it('devolve fração menor que um pãozinho', () => {
    const order = { status: 'SCHEDULED', creditsAppliedMilli: 400, moneyAmount: 0 }
    expect(refundableCreditsMilli(order, 1.2)).toBe(400)
    expect(refundableCredits(order, 1.2)).toBe(0.4)
  })
})

describe('neutralidade do ciclo comprar-cancelar (fecha a brecha de dinheiro)', () => {
  const AVULSO = 1.2

  /** Devolve o valor em R$ do que o cliente recebe de volta, ao preço avulso. */
  const valorDevolvido = (creditsAppliedMilli: number, moneyAmount: number) =>
    refundableCredits({ status: 'DELIVERED', creditsAppliedMilli, moneyAmount }, AVULSO) *
    AVULSO

  it.each([
    // [créditos debitados (mili), dinheiro pago, valor total pago em R$]
    [1000, 0.6, 1.8],
    [0, 0.1, 0.1],
    [0, 1.19, 1.19],
    [2000, 0.05, 2.45],
    [1500, 0, 1.8],
  ])('debitado %i mili + R$ %s → devolve exatamente o que entrou', (milli, money, pagoEmReais) => {
    // O cliente entregou `milli` de crédito (valendo milli/1000 × avulso) + `money` em dinheiro.
    expect(valorDevolvido(milli, money)).toBeCloseTo(pagoEmReais, 2)
  })

  it('pagar centavos e cancelar NÃO gera crédito de graça (a falha que existia)', () => {
    // Antes: R$ 0,10 pagos devolviam 1 🥖 = R$ 1,20 → R$ 1,10 de lucro por ciclo, repetível.
    const devolvido = refundableCredits(
      { status: 'DELIVERED', creditsAppliedMilli: 0, moneyAmount: 0.1 },
      AVULSO,
    )
    expect(devolvido).toBeLessThan(0.1)
    expect(devolvido * AVULSO).toBeCloseTo(0.1, 2)
  })
})
