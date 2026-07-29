/**
 * market-stock-alerts.ts — quando avisar o admin que um produto do mercadinho está acabando.
 *
 * A regra central é **cruzamento de limiar**, não "está abaixo do limiar": o alerta dispara na
 * reserva que FEZ o estoque cair para a faixa crítica, e nunca mais. Sem isso, cada Cestinha
 * vendida depois do 5º item repetiria o mesmo aviso — e o admin desliga o toggle no terceiro dia.
 * Como o cruzamento é derivado de (disponível depois, consumido agora), a idempotência não precisa
 * de estado persistido: reprocessar a mesma reserva com `consumed = 0` não gera alerta.
 *
 * Assimetria proposital entre os dois tipos de estoque (mesma semântica da flag `lowStock` da
 * listagem de produtos, que é FIXED-only):
 * - **FIXED** (geleia, café) — inventário absoluto. `LOW` é acionável: comprar reposição (D-9).
 * - **DAILY** (bolo) — capacidade que reseta todo dia. "Restam 3 vagas" é o funcionamento normal
 *   de um produto que vende bem; só o esgotamento do dia (`OUT`) é notícia, porque aí a próxima
 *   Cestinha perde a venda e o admin pode aumentar a capacidade.
 */

/** Abaixo ou igual a isto, um produto de estoque FIXO entra em "estoque baixo". */
export const LOW_STOCK_THRESHOLD = 5

/** `OUT` = zerou agora · `LOW` = entrou na faixa crítica agora (só FIXED). */
export type StockAlertKind = 'OUT' | 'LOW'

export interface StockAlert {
  productId: string
  name: string
  kind: StockAlertKind
  /** Unidades que sobraram (FIXED: estoque · DAILY: vagas do dia). */
  remaining: number
  /** Só em DAILY: dia (YYYY-MM-DD) cuja capacidade esgotou. */
  date?: string
}

/** Estado de um produto DEPOIS de uma reserva, com o quanto essa reserva consumiu. */
export interface StockSnapshot {
  productId: string
  name: string
  stockType: string
  /** Disponível DEPOIS da reserva — FIXED: `stock` · DAILY: `dailyCapacity - reserved`. */
  availableAfter: number
  /** Unidades consumidas por ESTA reserva (0 = nada mudou → nenhum alerta). */
  consumed: number
  /** Dia da reserva (YYYY-MM-DD) — usado só nos produtos DAILY. */
  date?: string
}

/**
 * Filtra os snapshots que cruzaram um limiar nesta reserva.
 *
 * `OUT` tem precedência sobre `LOW` (zerar é a notícia); um produto só aparece uma vez.
 */
export function buildStockAlerts(rows: StockSnapshot[]): StockAlert[] {
  const alerts: StockAlert[] = []

  for (const row of rows) {
    if (row.consumed <= 0) continue
    const before = row.availableAfter + row.consumed
    const isDaily = row.stockType !== 'FIXED'

    if (row.availableAfter <= 0 && before > 0) {
      alerts.push({
        productId: row.productId,
        name: row.name,
        kind: 'OUT',
        remaining: Math.max(0, row.availableAfter),
        ...(isDaily && row.date ? { date: row.date } : {}),
      })
      continue
    }

    // "Estoque baixo" só faz sentido em inventário absoluto (ver cabeçalho).
    if (isDaily) continue
    if (row.availableAfter <= LOW_STOCK_THRESHOLD && before > LOW_STOCK_THRESHOLD) {
      alerts.push({ productId: row.productId, name: row.name, kind: 'LOW', remaining: row.availableAfter })
    }
  }

  return alerts
}

/** Texto curto de um alerta, para o corpo da notificação do admin. */
export function stockAlertLabel(a: StockAlert): string {
  if (a.kind === 'OUT') {
    return a.date ? `${a.name} esgotou para ${brDay(a.date)}` : `${a.name} esgotou`
  }
  return `${a.name}: resta${a.remaining === 1 ? '' : 'm'} ${a.remaining}`
}

/** YYYY-MM-DD → DD/MM (o ano nunca é útil num aviso de estoque). */
function brDay(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return m && d ? `${d}/${m}` : dateStr
}
