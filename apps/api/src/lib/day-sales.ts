/**
 * day-sales.ts — o que foi VENDIDO para um dia de entrega, agregado no geral.
 *
 * Irmão de `product-demand.ts`, com o recorte trocado: aquele responde "o que eu preciso
 * comprar" (por TURNO, só quantidade, porque o fornecedor não quer saber de preço de venda);
 * este responde "o que eu já vendi para este dia até agora" (o DIA inteiro, com R$), que é o
 * relatório que o admin abre a partir da tela do dia na aba Pedidos.
 *
 * "Geral, não por condomínio" é a decisão central: as telas de compra e separação já quebram
 * tudo por condomínio, e nenhuma responde "quantos bolos saíram hoje". Aqui o condomínio só
 * aparece como contagem.
 *
 * Duas fontes, as MESMAS da compra — para o total de pães reconciliar com o card do dia:
 *   1. `Order`       — pedidos de pão não cancelados (avulso ou agenda).
 *   2. `MarketOrder` — Cestinhas confirmadas: `breadQty` é PÃO (D-1) e soma nos contadores de
 *      pão; `items[]` são os produtos, contados e valorizados em paralelo.
 *
 * Fora de propósito:
 *   - Previstos da agenda: não foram vendidos, ninguém pagou. (A compra os mostra como contexto;
 *     um relatório de vendas que os somasse estaria inventando receita.)
 *   - Cestinha `PENDING_PAYMENT`: o dinheiro não entrou e o sweep do cron pode cancelar.
 *     Mesmo conjunto de status do `bread-demand`/Separação, então os números reconciliam.
 *
 * VENDIDO ≠ ENTREGUE: `NOT_DELIVERED` continua aqui — foi vendido e cobrado; o que aconteceu com
 * a mercadoria é assunto do desfecho de perda (`lossResolvedAt`), não deste relatório.
 *
 * Duas diferenças DELIBERADAS em relação a `upcoming-days`, que consulta turno a turno e por isso
 * enxerga só o que tem `slotId` conhecido e `condominiumId` preenchido: aqui o relatório é
 * COMPLETO e inclui os dois casos, agrupando o que não tem turno num balde "Sem turno". É o único
 * ponto em que o total daqui pode passar do número do card do dia — e é intencional: um pedido
 * órfão de turno existe, foi pago, e sumir dele no relatório é pior do que a divergência.
 */
import type { PrismaClient } from '@prisma/client'
import {
  buildPeriodSales,
  singleDayWindow,
  BREAD_LINE_FALLBACK_ID,
  type PeriodSalesLine,
  type SalesSlotQty,
} from './period-sales.js'

export { BREAD_LINE_FALLBACK_ID }

/** Quanto de um produto saiu num turno. */
export type DaySalesSlotQty = SalesSlotQty

/** Uma linha do relatório: um produto, com o quanto e o quanto rendeu. */
export type DaySalesLine = PeriodSalesLine

/** O relatório de um dia. */
export interface DaySales {
  /** Dia de entrega (YYYY-MM-DD, BRT). */
  date: string
  /** Instante da apuração — o "até o momento" do título. Vendas continuam entrando até o corte. */
  generatedAt: string
  breads: {
    /** Pães vendidos = `single + scheduled + fromMarket + fromItems`. */
    total: number
    single: number
    scheduled: number
    fromMarket: number
    /** Pão que veio como item de Cestinha — sempre 0 no fluxo normal (ver o cabeçalho). */
    fromItems: number
    /** `Setting.avulsoUnit` — 0 quando não configurado. */
    unitPrice: number
    /** `total × unitPrice`. Valor de TABELA: o pão da agenda foi pago em pãezinhos de combo. */
    revenue: number
  }
  /** Produtos da Cestinha — métrica paralela aos pães (D-1), nunca somada a eles. */
  items: { total: number; revenue: number }
  /** `breads.revenue + items.revenue`. */
  totalRevenue: number
  /** Como a Cestinha foi paga — o recorte que de fato virou caixa no dia. */
  cash: { money: number; creditsMilli: number }
  counts: {
    /** Paradas `(cliente, turno)` — pão + Cestinha do mesmo cliente/turno = 1 (D-5). */
    stops: number
    clients: number
    condominiums: number
    breadOrders: number
    marketOrders: number
  }
  slots: Array<{ slotId: string; label: string; breads: number; items: number; revenue: number }>
  /** Pão primeiro; depois os produtos por receita decrescente (desempate por nome). */
  lines: DaySalesLine[]
}

/**
 * buildDaySales — o relatório de vendas de um dia de entrega, geral.
 *
 * **É uma chamada de um dia só a {@link buildPeriodSales}.** A agregação foi para
 * `period-sales.ts` quando a Fase 6 pediu o mesmo relatório sobre um intervalo: manter as duas
 * implementações lado a lado faria a tela do dia e a do período responderem números diferentes
 * para o MESMO dia no primeiro ajuste de regra — e ninguém saberia qual das duas acreditar.
 *
 * O que sobra aqui é só o recorte: a janela de um dia e os campos que a tela do dia consome.
 *
 * @param dateStr dia de entrega BRT no formato YYYY-MM-DD
 * @param now instante da apuração (injetável para teste)
 */
export async function buildDaySales(
  prisma: PrismaClient,
  dateStr: string,
  now: Date = new Date(),
): Promise<DaySales> {
  const period = await buildPeriodSales(prisma, singleDayWindow(dateStr, now), now)

  return {
    date: dateStr,
    generatedAt: period.generatedAt,
    breads: period.breads,
    items: period.items,
    totalRevenue: period.totalRevenue,
    cash: period.cash,
    // `days` e as séries por dia/dia-da-semana não entram: num relatório de UM dia elas seriam
    // sempre uma linha só, e o payload da tela do dia não muda de forma por causa disso.
    counts: {
      stops: period.counts.stops,
      clients: period.counts.clients,
      condominiums: period.counts.condominiums,
      breadOrders: period.counts.breadOrders,
      marketOrders: period.counts.marketOrders,
    },
    slots: period.slots,
    lines: period.lines,
  }
}
