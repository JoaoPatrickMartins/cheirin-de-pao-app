/**
 * Retry de transação do Mongo em conflito de escrita (P2034).
 *
 * Duas transações que tocam o MESMO documento ao mesmo tempo: o Mongo aborta uma delas com
 * `WriteConflict`, e o Prisma devolve P2034 pedindo para repetir. Repetir é seguro quando a
 * transação é guardada por status (um `updateMany` que só casa no estado de origem): na volta, o
 * perdedor já lê o estado novo e sai sem efeito. É o molde do crédito de compra
 * (`claimAndCreditPurchase`) e da recompensa de indicação (`rewardReferral`).
 *
 * Extraído de `payments.repository.ts` para os dois usarem o mesmo laço.
 */

/** Tentativas padrão — a mesma que o crédito de compra usava. */
export const WRITE_CONFLICT_ATTEMPTS = 3

/** Conflito de escrita entre transações do Mongo (P2034) — o Prisma pede para repetir a transação. */
export function isWriteConflict(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'P2034'
  )
}

/**
 * Roda `fn` e, se ela falhar com P2034, repete — até `attempts` vezes no total, com espera
 * crescente (50 ms, 100 ms…). Qualquer outro erro, ou o P2034 da última tentativa, sobe intacto.
 *
 * `fn` deve abrir a transação INTEIRA a cada chamada (é a transação que se repete, não um passo).
 */
export async function withWriteConflictRetry<T>(
  fn: () => Promise<T>,
  attempts: number = WRITE_CONFLICT_ATTEMPTS,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (!isWriteConflict(err) || attempt >= attempts) throw err
      await new Promise((resolve) => setTimeout(resolve, 50 * attempt))
    }
  }
}
