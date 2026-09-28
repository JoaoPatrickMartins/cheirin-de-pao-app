import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { PeriodQuerySchema, specFromQuery, REPORTS_DEFAULT_PERIOD } from './admin-reports.schema.js'
import { resolveWindow, type DateWindow } from '../../lib/date-range.js'
import { AdminReportsService } from './admin-reports.service.js'
import { SalesService } from './sales.service.js'
import { CustomersService } from './customers.service.js'
import { CreditMovementService } from './credit-movement.service.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

/**
 * AdminReportsController — handlers dos Relatórios do admin.
 *
 * Segurança: preHandler fastify.authenticate (na rota) + role check ADMIN inline.
 *
 * Onda Financeiro/DRE: os 8 handlers passaram a resolver uma JANELA (`DateWindow`) em vez de um
 * preset, então todos aceitam `?month=YYYY-MM` e `?from=&to=` além do `?period=` histórico. A
 * resolução ficou num único helper — antes havia quatro cópias do mesmo bloco de parse.
 */
export class AdminReportsController {
  private service: AdminReportsService
  private sales: SalesService
  private customers: CustomersService
  private creditMovement: CreditMovementService

  constructor(private fastify: FastifyInstance) {
    this.service = new AdminReportsService(fastify)
    this.sales = new SalesService(fastify)
    this.customers = new CustomersService(fastify)
    this.creditMovement = new CreditMovementService(fastify)
  }

  /**
   * Role check + resolução da janela. Devolve `null` quando já respondeu erro (403/400) —
   * o handler só precisa de `if (!win) return`.
   */
  private requireWindow(request: FastifyRequest, reply: FastifyReply): DateWindow | null {
    if (request.user?.role !== 'ADMIN') {
      reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
      return null
    }
    try {
      const query = PeriodQuerySchema.parse(request.query)
      return resolveWindow(specFromQuery(query, REPORTS_DEFAULT_PERIOD))
    } catch (err) {
      if (err instanceof ZodError) reply.status(400).send({ error: zodMessage(err) })
      // `RangeError` vem dos construtores de janela (to < from, mês inválido) — é erro de
      // chamada, não falha interna, então 400 e não 500.
      else if (err instanceof RangeError) reply.status(400).send({ error: err.message })
      else reply.status(400).send({ error: 'Parâmetros inválidos.' })
      return null
    }
  }

  /** Executa o relatório tratando a falha interna de forma uniforme. */
  private async run<T>(
    request: FastifyRequest,
    reply: FastifyReply,
    fn: (win: DateWindow) => Promise<T>,
  ) {
    const win = this.requireWindow(request, reply)
    if (!win) return
    try {
      return reply.status(200).send(await fn(win))
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /** GET /admin/reports/access — métricas de acesso, login e conversão. */
  async getAccess(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, (w) => this.service.getAccessReport(w))
  }

  /** GET /admin/reports/retention — saúde da recorrência. */
  async getRetention(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, (w) => this.service.getRetentionReport(w))
  }

  /** GET /admin/reports/condominiums — ranking de condomínios. */
  async getCondominiums(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, (w) => this.service.getCondominiumRanking(w))
  }

  /** GET /admin/reports/delivery — entregas & falhas. */
  async getDelivery(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, (w) => this.service.getDeliveryReport(w))
  }

  /** GET /admin/reports/waste — desperdício (pedido × entregue). */
  async getWaste(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, (w) => this.service.getWasteReport(w))
  }

  /** GET /admin/reports/schedule-profile — perfil da agenda + mix de pedidos. */
  async getScheduleProfile(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, (w) => this.service.getScheduleProfileReport(w))
  }

  /** GET /admin/reports/payments — aprovação, estorno, mix e recuperação. */
  async getPayments(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, (w) => this.service.getPaymentsReport(w))
  }

  /**
   * GET /admin/reports/sales — vendas & performance (V1–V4, V6, V9).
   *
   * Comparativo LIGADO por padrão, como no relatório de despesas: venda sem "vs. o período
   * anterior" não diz se subiu. `?compare=false` desliga.
   */
  async getSales(request: FastifyRequest, reply: FastifyReply) {
    const compare = (request.query as { compare?: unknown })?.compare !== 'false'
    return this.run(request, reply, (w) => this.sales.getSalesReport(w, compare))
  }

  /** GET /admin/reports/credit-movement — movimentação do passivo de crédito (F7). */
  async getCreditMovement(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, (w) => this.creditMovement.getReport(w))
  }

  /** GET /admin/reports/customers — top clientes, LTV e novos × recorrentes (V7/V8). */
  async getCustomers(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, (w) => this.customers.getCustomersReport(w))
  }

  /**
   * GET /admin/reports/credit-liability — passivo de crédito (receita diferida).
   *
   * Sem janela de propósito: é um SALDO (estado atual), não um fluxo de período.
   */
  async getCreditLiability(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    try {
      return reply.status(200).send(await this.service.getCreditLiability())
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
