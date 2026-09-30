import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { FinancialQuerySchema, FINANCIAL_DEFAULT_PERIOD } from './admin-financial.schema.js'
import { specFromQuery } from '../../lib/period-query.js'
import { resolveWindow } from '../../lib/date-range.js'
import { AdminFinancialService } from './admin-financial.service.js'
import { GatewayService } from './gateway.service.js'
import { DreService } from './dre.service.js'
import { CashflowService } from './cashflow.service.js'
import { MarginService } from './margin.service.js'
import { BudgetService, type BudgetKind } from './budget.service.js'
import { FinancialCloseService, CloseError } from './financial-close.service.js'
import { AccountantPackageService } from './accountant-package.service.js'
import {
  TrendService,
  DEFAULT_TREND_MONTHS,
  MAX_TREND_MONTHS,
  type TrendReport,
} from './trend.service.js'
import type { DreRegime } from '../../lib/dre.js'
import { simulate } from '../../lib/break-even.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

/**
 * AdminFinancialController — handler HTTP para GET /admin/financial
 *
 * Segurança (T-07-05-01, T-07-05-04):
 * - preHandler: fastify.authenticate garante JWT válido (na rota)
 * - Inline role check request.user?.role !== 'ADMIN' → 403 (neste handler)
 */
export class AdminFinancialController {
  private service: AdminFinancialService
  private gateway: GatewayService
  private dre: DreService
  private cashflow: CashflowService
  private margin: MarginService
  private budget: BudgetService
  private trend: TrendService
  private close: FinancialCloseService
  private accountant: AccountantPackageService
  /**
   * Cache da tendência (D4). TTL longo — 5 min — porque cada mês da série custa um DRE completo e
   * dado mensal fechado praticamente não muda. Mesmo desenho do cache do painel: em memória, com
   * a chave carregando o bucket de tempo, e limpo em vez de crescer.
   */
  private trendCache = new Map<string, { at: number; payload: TrendReport }>()

  constructor(private fastify: FastifyInstance) {
    this.service = new AdminFinancialService(fastify)
    this.gateway = new GatewayService(fastify)
    this.dre = new DreService(fastify)
    this.cashflow = new CashflowService(fastify)
    this.margin = new MarginService(fastify)
    this.budget = new BudgetService(fastify)
    this.trend = new TrendService(fastify)
    this.close = new FinancialCloseService(fastify)
    this.accountant = new AccountantPackageService(fastify)
  }

  /** Role check + janela resolvida. `null` = já respondeu erro. */
  private requireWindow(request: FastifyRequest, reply: FastifyReply, fallback: 'day' | 'week' | 'month') {
    if (request.user?.role !== 'ADMIN') {
      reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
      return null
    }
    try {
      return resolveWindow(specFromQuery(FinancialQuerySchema.parse(request.query), fallback))
    } catch (err) {
      if (err instanceof ZodError) reply.status(400).send({ error: zodMessage(err) })
      else if (err instanceof RangeError) reply.status(400).send({ error: err.message })
      else reply.status(400).send({ error: 'Parâmetros inválidos.' })
      return null
    }
  }

  /** Erro de serviço com `statusCode` vira a resposta certa; o resto é 500. */
  private fail(reply: FastifyReply, err: unknown) {
    if (err instanceof CloseError) return reply.status(err.statusCode).send({ error: err.message })
    const e = err as { statusCode?: number; message?: string }
    if (e?.statusCode) return reply.status(e.statusCode).send({ error: e.message })
    this.fastify.log.error(err)
    return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
  }

  /**
   * GET /admin/financial
   *
   * Receita do período com quebra por tipo, Cestinha, compras e condomínio.
   * Aceita `period` (histórico), `month` (competência) ou `from`/`to` (intervalo).
   */
  async getRevenue(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    let query: ReturnType<typeof FinancialQuerySchema.parse>
    try {
      query = FinancialQuerySchema.parse(request.query)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Parâmetros inválidos.' })
    }

    // Erro de janela (to anterior a from, mês inválido) é erro de CHAMADA: 400, não 500.
    let window
    try {
      window = resolveWindow(specFromQuery(query, FINANCIAL_DEFAULT_PERIOD))
    } catch (err) {
      const message = err instanceof RangeError ? err.message : 'Parâmetros inválidos.'
      return reply.status(400).send({ error: message })
    }

    try {
      const result = await this.service.getRevenue(window, query.condominiumId)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /admin/financial/gateway — conciliação de gateway (F6).
   *
   * Responde "faturei X, quanto caiu na conta?". Cada linha declara se a taxa é real (informada
   * pelo provedor) ou estimada pela alíquota configurada.
   */
  async getGateway(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    let query: ReturnType<typeof FinancialQuerySchema.parse>
    try {
      query = FinancialQuerySchema.parse(request.query)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Parâmetros inválidos.' })
    }

    let window
    try {
      window = resolveWindow(specFromQuery(query, FINANCIAL_DEFAULT_PERIOD))
    } catch (err) {
      return reply
        .status(400)
        .send({ error: err instanceof RangeError ? err.message : 'Parâmetros inválidos.' })
    }

    try {
      return reply.status(200).send(await this.gateway.getReport(window))
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /admin/financial/dre — Demonstração do Resultado (Fase 4).
   *
   * `regime` é `cash` por padrão (decisão 1): é o número que o dono reconcilia com o extrato e o
   * que ele já via antes. A resposta traz SEMPRE o outro regime em `alternate` e a ponte entre os
   * dois em `bridge` — a divergência entre eles é esperada num modelo pré-pago, e explicá-la é o
   * que impede que vire desconfiança no relatório.
   */
  async getDre(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    let query: ReturnType<typeof FinancialQuerySchema.parse>
    try {
      query = FinancialQuerySchema.parse(request.query)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Parâmetros inválidos.' })
    }

    const rawRegime = (request.query as { regime?: unknown })?.regime
    if (rawRegime != null && rawRegime !== 'cash' && rawRegime !== 'accrual') {
      return reply.status(400).send({ error: 'regime deve ser "cash" ou "accrual"' })
    }
    const regime: DreRegime = rawRegime === 'accrual' ? 'accrual' : 'cash'

    let window
    try {
      // O DRE nasce em MÊS, não no preset do resto do financeiro: "setembro até agora" não fecha
      // com extrato nenhum, e um DRE parcial exibido como fechamento é pior que nenhum.
      window = resolveWindow(specFromQuery(query, 'month'))
    } catch (err) {
      return reply
        .status(400)
        .send({ error: err instanceof RangeError ? err.message : 'Parâmetros inválidos.' })
    }

    try {
      return reply.status(200).send(await this.dre.getDre(window, regime))
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /** GET /admin/financial/cashflow — fluxo de caixa realizado (F5). */
  async getCashflow(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    let query: ReturnType<typeof FinancialQuerySchema.parse>
    try {
      query = FinancialQuerySchema.parse(request.query)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Parâmetros inválidos.' })
    }

    let window
    try {
      window = resolveWindow(specFromQuery(query, 'month'))
    } catch (err) {
      return reply
        .status(400)
        .send({ error: err instanceof RangeError ? err.message : 'Parâmetros inválidos.' })
    }

    try {
      return reply.status(200).send(await this.cashflow.getReport(window))
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /admin/financial/margin — margem por produto e por condomínio + ponto de equilíbrio (F8/F9/B3).
   *
   * Nasce em MÊS, como o DRE: margem e ponto de equilíbrio de "este mês até agora" comparam uma
   * receita parcial com uma despesa fixa CHEIA (o aluguel do mês inteiro já está lançado), e o
   * resultado pareceria pior do que é.
   */
  async getMargin(request: FastifyRequest, reply: FastifyReply) {
    const win = this.requireWindow(request, reply, 'month')
    if (!win) return
    try {
      return reply.status(200).send(await this.margin.getMarginReport(win))
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  /**
   * GET /admin/financial/simulate — simulador de cenário (D2).
   *
   * Não persiste nada: recebe as três variações, roda a MESMA aritmética do relatório e devolve os
   * dois cenários lado a lado. Ter o cenário-base no payload é o que permite à tela mostrar o
   * antes e o depois sem uma segunda requisição — e prova que, sem alteração, os dois são iguais.
   */
  async getSimulation(request: FastifyRequest, reply: FastifyReply) {
    const win = this.requireWindow(request, reply, 'month')
    if (!win) return

    const q = request.query as Record<string, unknown>
    const pct = (raw: unknown): number | undefined => {
      if (raw == null || raw === '') return undefined
      const n = Number(raw)
      // Cenário sem limite não ajuda a decidir e produz números absurdos na tela.
      return Number.isFinite(n) && n >= -100 && n <= 500 ? n : undefined
    }

    try {
      const report = await this.margin.getMarginReport(win)
      const scenario = {
        deltaRevenuePct: pct(q.revenue),
        deltaCogsPct: pct(q.cogs),
        deltaFixedPct: pct(q.fixed),
      }
      return reply.status(200).send({
        window: report.window,
        base: report.breakEven,
        scenario,
        result: simulate(report.breakEvenInputs, scenario),
      })
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  /**
   * GET /admin/financial/trend?months=6 — dashboard consolidado de tendência (D4).
   *
   * Cacheado por 5 minutos: a série compõe um DRE por mês, e o dono abre esta tela repetidamente.
   */
  async getTrend(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    const raw = (request.query as { months?: unknown })?.months
    const parsed = raw == null || raw === '' ? DEFAULT_TREND_MONTHS : Number(raw)
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_TREND_MONTHS) {
      return reply.status(400).send({ error: `months deve estar entre 1 e ${MAX_TREND_MONTHS}` })
    }
    const months = Math.trunc(parsed)

    const TTL = 5 * 60_000
    const key = `${months}|${Math.floor(Date.now() / TTL)}`
    const hit = this.trendCache.get(key)
    if (hit && Date.now() - hit.at < TTL) {
      return reply.status(200).send(hit.payload)
    }

    try {
      const payload = await this.trend.getTrend(months)
      if (this.trendCache.size > 8) this.trendCache.clear()
      this.trendCache.set(key, { at: Date.now(), payload })
      return reply.status(200).send(payload)
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  // ── Fechamento de mês (A1) ─────────────────────────────────────────────────

  /** GET /admin/financial/close — meses já fechados. */
  async listCloses(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    try {
      const month = (request.query as { month?: string })?.month
      // Com `month`, responde o ESTADO daquele mês (o que a tela do DRE consulta para saber se
      // pode oferecer o botão de fechar); sem ele, a lista dos fechados.
      return reply
        .status(200)
        .send(month ? await this.close.getStatus(month) : await this.close.list())
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  /** POST /admin/financial/close — congela o DRE do mês. */
  async createClose(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    const body = request.body as { month?: string; notes?: string | null }
    try {
      const saved = await this.close.close(body?.month ?? '', request.user.id, body?.notes ?? null)
      return reply.status(201).send({ ok: true, month: saved.month, closedAt: saved.closedAt })
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  /** DELETE /admin/financial/close/:month — reabre o mês (com rastro no log). */
  async deleteClose(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    const { month } = request.params as { month: string }
    try {
      return reply.status(200).send(await this.close.reopen(month, request.user.id))
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  /**
   * GET /admin/financial/accountant-package?month=YYYY-MM — o ZIP do contador (D3).
   *
   * Responde `application/zip`. Comprovante que não pôde ser baixado NÃO some: entra no
   * `MANIFESTO.txt` com o motivo e a URL de origem.
   */
  async getAccountantPackage(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    const month = (request.query as { month?: string })?.month ?? currentMonthBrt()
    try {
      const { buffer, filename } = await this.accountant.build(month)
      return reply
        .header('Content-Type', 'application/zip')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(buffer)
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  // ── Metas (F11) ────────────────────────────────────────────────────────────

  /** GET /admin/financial/budget?month=YYYY-MM — realizado × meta. */
  async getBudget(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    const month = (request.query as { month?: string })?.month ?? currentMonthBrt()
    try {
      return reply.status(200).send(await this.budget.getReport(month))
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  /** POST /admin/financial/budget — define (ou redefine) uma meta. */
  async putBudget(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    const body = request.body as {
      month?: string
      kind?: string
      categoryId?: string | null
      amount?: number
      notes?: string | null
    }
    if (body?.kind !== 'REVENUE' && body?.kind !== 'EXPENSE') {
      return reply.status(400).send({ error: 'kind deve ser "REVENUE" ou "EXPENSE"' })
    }
    if (typeof body.amount !== 'number' || !Number.isFinite(body.amount)) {
      return reply.status(400).send({ error: 'amount deve ser um número' })
    }
    try {
      const saved = await this.budget.upsert(
        {
          month: body.month ?? '',
          kind: body.kind as BudgetKind,
          categoryId: body.categoryId ?? null,
          amount: body.amount,
          notes: body.notes ?? null,
        },
        request.user?.id,
      )
      return reply.status(200).send(saved)
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  /** DELETE /admin/financial/budget/:id — remove a meta. */
  async deleteBudget(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    const { id } = request.params as { id: string }
    try {
      await this.budget.remove(id)
      return reply.status(204).send()
    } catch (err) {
      return this.fail(reply, err)
    }
  }
}

/** Mês corrente em BRT ("YYYY-MM") — o default de `GET /admin/financial/budget`. */
function currentMonthBrt(): string {
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return `${brt.getUTCFullYear()}-${String(brt.getUTCMonth() + 1).padStart(2, '0')}`
}
