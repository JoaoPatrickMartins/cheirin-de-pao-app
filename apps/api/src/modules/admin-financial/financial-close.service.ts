/**
 * financial-close.service — fechamento de mês com snapshot do DRE (A1 · achado do §16).
 *
 * O problema que este serviço existe para resolver está declarado no `schema.prisma`, e vale
 * repetir porque ele é a razão de o módulo inteiro não ser auditável sem isto:
 *
 *   > **O DRE de agosto muda sozinho quando o fornecedor sobe o preço em setembro.**
 *
 * Metade do CMV já estava certa — `PurchaseOrderItem.unitPrice` é snapshot do custo pago. A outra
 * metade não: `loadUnitCosts()` lê o custo de fornecimento de AGORA, sem dimensão histórica, e é
 * ela que alimenta o CMV da Cestinha, a margem por produto e o CMV do ponto de equilíbrio.
 *
 * ## O congelamento é do DRE inteiro, não só do custo
 *
 * Seria possível versionar `SupplierProduct.unitCost` e reconstruir o custo histórico. Não é o que
 * o plano escolheu, e por um motivo prático: o custo é só UMA das entradas que mudam. Despesa
 * lançada com atraso, estorno processado depois, alíquota de gateway reajustada — tudo isso move o
 * DRE de um mês já entregue. Congelar o RESULTADO cobre todas as fontes de deriva de uma vez.
 *
 * ## O mês corrente nunca fecha
 *
 * Fechar um mês em curso produziria um snapshot de um número que ainda ia mudar — o pior dos dois
 * mundos, porque ele passaria a parecer definitivo. `monthWindow().isPartial` é a trava.
 */
import { FastifyInstance } from 'fastify'
import { monthWindow, MONTH_RE } from '../../lib/date-range.js'
import type { DreRegime } from '../../lib/dre.js'
import { DreService } from './dre.service.js'
import {
  readFrozenDre,
  isMonthClosed,
  type CloseSnapshot,
  type FrozenDre,
} from './financial-close.snapshot.js'

export type { CloseSnapshot } from './financial-close.snapshot.js'

/** Erro com status HTTP — mesmo padrão de `ExpenseError`. */
export class CloseError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message)
    this.name = 'CloseError'
  }
}

export interface CloseStatus {
  month: string
  isClosed: boolean
  closedAt: string | null
  closedById: string | null
  notes: string | null
  reopenedAt: string | null
  /** `true` enquanto o mês não terminou — fechar é recusado. */
  isPartial: boolean
}

export class FinancialCloseService {
  private dre: DreService

  constructor(private fastify: FastifyInstance) {
    this.dre = new DreService(fastify)
  }

  private get prisma() {
    return this.fastify.prisma
  }

  private assertMonth(month: string) {
    if (!MONTH_RE.test(month)) throw new CloseError('month deve estar no formato YYYY-MM')
  }

  /** Estado do fechamento de um mês. */
  async getStatus(month: string, now: Date = new Date()): Promise<CloseStatus> {
    this.assertMonth(month)
    const [row, win] = [
      await this.prisma.financialClose.findUnique({ where: { month } }),
      monthWindow(month, now),
    ]
    return {
      month,
      isClosed: row != null,
      closedAt: row?.closedAt.toISOString() ?? null,
      closedById: row?.closedById ?? null,
      notes: row?.notes ?? null,
      reopenedAt: row?.reopenedAt?.toISOString() ?? null,
      isPartial: win.isPartial,
    }
  }

  /** Os meses já fechados, do mais recente para o mais antigo. */
  async list(limit = 24) {
    const rows = await this.prisma.financialClose.findMany({
      orderBy: { month: 'desc' },
      take: limit,
      // O snapshot NÃO vem na listagem: são vários DREs completos, e a lista só precisa do estado.
      select: { id: true, month: true, closedAt: true, closedById: true, notes: true, reopenedAt: true },
    })
    return rows.map((r) => ({
      ...r,
      closedAt: r.closedAt.toISOString(),
      reopenedAt: r.reopenedAt?.toISOString() ?? null,
    }))
  }

  /**
   * Fecha o mês: apura o DRE uma última vez e congela o resultado.
   *
   * Idempotente no sentido que importa — fechar duas vezes é recusado, não sobrescreve. Refazer um
   * fechamento exige reabrir antes, e a reabertura deixa rastro.
   */
  async close(month: string, closedById: string, notes?: string | null, now: Date = new Date()) {
    this.assertMonth(month)

    const existing = await this.prisma.financialClose.findUnique({ where: { month } })
    if (existing) throw new CloseError(`O mês ${month} já está fechado.`, 409)

    const win = monthWindow(month, now)
    if (win.isPartial) {
      throw new CloseError(
        `O mês ${month} ainda não terminou. Fechar agora congelaria um número que ainda vai mudar.`,
        409,
      )
    }

    // Apuração final. `getDre` devolve os dois regimes numa passada.
    const fresh = await this.dre.getDre(win, 'cash', { skipFrozen: true })
    const snapshot: CloseSnapshot = {
      cash: fresh.dre,
      accrual: fresh.alternate,
      bridge: fresh.bridge,
      version: 1,
    }

    return this.prisma.financialClose.create({
      data: {
        month,
        closedAt: now,
        closedById,
        snapshot: snapshot as unknown as object,
        notes: notes ?? null,
      },
    })
  }

  /**
   * Reabre o mês — apaga o congelamento e volta a recalcular.
   *
   * A reabertura é permitida (um lançamento esquecido é motivo legítimo), mas **não é silenciosa**:
   * o rastro vai para o log com quem reabriu e quando o mês fora fechado. Deixar reabrir sem
   * registro recriaria o problema original com uma camada a mais de confiança falsa — o número
   * pareceria fechado e não estaria.
   *
   * O registro fica no log e não numa coleção de histórico porque o que interessa auditar é que o
   * mês VOLTOU a ser recalculado; uma coleção de reaberturas é outro escopo, e o plano não pede.
   */
  async reopen(month: string, reopenedById: string, now: Date = new Date()) {
    this.assertMonth(month)
    const existing = await this.prisma.financialClose.findUnique({ where: { month } })
    if (!existing) throw new CloseError(`O mês ${month} não está fechado.`, 404)

    this.fastify.log.warn(
      `[financial-close] mês ${month} REABERTO por ${reopenedById} (fechado em ${existing.closedAt.toISOString()}) — o DRE volta a ser recalculado`,
    )

    await this.prisma.financialClose.update({
      where: { month },
      data: { reopenedAt: now, reopenedById },
    })
    await this.prisma.financialClose.delete({ where: { month } })
    return { month, reopened: true }
  }

  /**
   * O DRE congelado do mês, ou `null` quando ele não está fechado.
   *
   * A leitura mora em `financial-close.snapshot.ts`, compartilhada com o `DreService` — que a
   * consulta antes de recalcular. Duas leituras do mesmo snapshot divergiriam no primeiro ajuste
   * de formato.
   */
  async getFrozen(month: string, regime: DreRegime): Promise<FrozenDre | null> {
    if (!MONTH_RE.test(month)) return null
    return readFrozenDre(this.prisma, month, regime)
  }

  /**
   * Os meses fechados que cobrem uma data de competência — a trava do lançamento retroativo.
   *
   * Devolve o mês quando ele está fechado, `null` quando não. Quem chama decide se recusa.
   */
  async closedMonthOf(competenceDate: Date): Promise<string | null> {
    return isMonthClosed(this.prisma, competenceDate)
  }
}
