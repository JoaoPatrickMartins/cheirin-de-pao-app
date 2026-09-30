/**
 * financial-close.snapshot — o formato do DRE congelado e o leitor dele (A1).
 *
 * Módulo separado do `financial-close.service` por uma razão estrutural, não estética: o serviço de
 * fechamento **precisa** do `DreService` (para apurar o número final antes de congelar) e o
 * `DreService` **precisa** consultar o congelado (para não recalcular um mês fechado). Os dois num
 * arquivo só produziriam um ciclo de importação.
 *
 * Aqui não entra nada além dos tipos puros de `lib/dre.ts` e do Prisma — é o que mantém a ponta de
 * baixo do grafo livre de ciclo.
 */
import type { PrismaClient } from '@prisma/client'
import type { DreRegime, DreResult, DreBridge } from '../../lib/dre.js'

/**
 * O que é gravado em `FinancialClose.snapshot`.
 *
 * Guarda os DOIS regimes e a ponte — não só o regime pedido no momento do fechamento —, porque a
 * tela alterna entre eles sem nova requisição; congelar um lado só faria o outro voltar a ser
 * recalculado (e a divergir do que foi fechado).
 */
export interface CloseSnapshot {
  cash: DreResult
  accrual: DreResult
  bridge: DreBridge
  /** Versão do formato. Snapshot antigo com formato novo precisa ser detectável, não adivinhado. */
  version: 1
}

/** O payload do DRE quando ele vem congelado. Estruturalmente igual ao `DreResponse`. */
export interface FrozenDre {
  regime: DreRegime
  dre: DreResult
  alternate: DreResult
  bridge: DreBridge
  /** Instante do fechamento — presente só quando o número veio do snapshot. */
  closedAt: string
}

/**
 * O DRE congelado do mês, ou `null` quando ele não está fechado.
 *
 * O regime pedido escolhe qual lado do snapshot vai em `dre` e qual vai em `alternate`.
 */
export async function readFrozenDre(
  prisma: Pick<PrismaClient, 'financialClose'>,
  month: string,
  regime: DreRegime,
): Promise<FrozenDre | null> {
  const row = await prisma.financialClose.findUnique({ where: { month } })
  if (!row) return null

  const snap = row.snapshot as unknown as CloseSnapshot | null
  // Formato desconhecido não é "quase certo": melhor recalcular do que servir um payload que a
  // tela vai ler errado.
  if (!snap || snap.version !== 1 || !snap.cash || !snap.accrual) return null

  return {
    regime,
    dre: regime === 'cash' ? snap.cash : snap.accrual,
    alternate: regime === 'cash' ? snap.accrual : snap.cash,
    bridge: snap.bridge,
    closedAt: row.closedAt.toISOString(),
  }
}

/**
 * O mês BRT ("YYYY-MM") de uma data de competência.
 *
 * Aqui, e não em quem chama, porque errar o fuso nesta conversão faria uma despesa de 31/08 23h BRT
 * cair em setembro — a armadilha que o §13 documenta.
 */
export function brtMonthOf(at: Date): string {
  const brt = new Date(at.getTime() - 3 * 60 * 60 * 1000)
  return `${brt.getUTCFullYear()}-${String(brt.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * O mês fechado que cobre esta competência, ou `null` — a trava do lançamento retroativo.
 *
 * Data ausente ou inválida devolve `null` (não bloqueia) em vez de estourar. `competenceDate` é
 * obrigatório no schema, então isso só acontece com documento legado ou malformado — e nesse caso
 * impedir a edição seria o pior dos desfechos: trancaria justamente o registro que precisa de
 * conserto, sem que ninguém consiga dizer a que mês ele pertence.
 */
export async function isMonthClosed(
  prisma: Pick<PrismaClient, 'financialClose'>,
  competenceDate: Date | null | undefined,
): Promise<string | null> {
  if (!(competenceDate instanceof Date) || Number.isNaN(competenceDate.getTime())) return null
  const month = brtMonthOf(competenceDate)
  const row = await prisma.financialClose.findUnique({ where: { month } })
  return row ? month : null
}
