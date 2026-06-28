import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { ReportQuerySchema } from './admin-reports.schema.js'
import { AdminReportsService } from './admin-reports.service.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

/**
 * AdminReportsController — handlers dos Relatórios do admin.
 *
 * Segurança: preHandler fastify.authenticate (na rota) + role check ADMIN inline.
 */
export class AdminReportsController {
  private service: AdminReportsService

  constructor(private fastify: FastifyInstance) {
    this.service = new AdminReportsService(fastify)
  }

  /**
   * GET /admin/reports/access — métricas de acesso, login e conversão.
   */
  async getAccess(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    let query: ReturnType<typeof ReportQuerySchema.parse>
    try {
      query = ReportQuerySchema.parse(request.query)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Parâmetros inválidos.' })
    }

    try {
      const result = await this.service.getAccessReport(query.period)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /admin/reports/retention — saúde da recorrência (recarga automática,
   * churn por esgotamento, recompra & autonomia, funil de ativação).
   */
  async getRetention(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    let query: ReturnType<typeof ReportQuerySchema.parse>
    try {
      query = ReportQuerySchema.parse(request.query)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Parâmetros inválidos.' })
    }
    try {
      const result = await this.service.getRetentionReport(query.period)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /admin/reports/credit-liability — passivo de crédito (receita diferida).
   */
  async getCreditLiability(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    try {
      const result = await this.service.getCreditLiability()
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /admin/reports/condominiums — ranking de condomínios.
   */
  async getCondominiums(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    let query: ReturnType<typeof ReportQuerySchema.parse>
    try {
      query = ReportQuerySchema.parse(request.query)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Parâmetros inválidos.' })
    }
    try {
      const result = await this.service.getCondominiumRanking(query.period)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /** Helper: role check + parse period; retorna o period ou null (já respondeu erro). */
  private async requirePeriod(request: FastifyRequest, reply: FastifyReply): Promise<'day' | 'week' | 'month' | null> {
    if (request.user?.role !== 'ADMIN') {
      reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
      return null
    }
    try {
      return ReportQuerySchema.parse(request.query).period
    } catch (err) {
      if (err instanceof ZodError) reply.status(400).send({ error: zodMessage(err) })
      else reply.status(400).send({ error: 'Parâmetros inválidos.' })
      return null
    }
  }

  /** GET /admin/reports/delivery — entregas & falhas. */
  async getDelivery(request: FastifyRequest, reply: FastifyReply) {
    const period = await this.requirePeriod(request, reply)
    if (!period) return
    try {
      return reply.status(200).send(await this.service.getDeliveryReport(period))
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /** GET /admin/reports/waste — desperdício (pedido × entregue). */
  async getWaste(request: FastifyRequest, reply: FastifyReply) {
    const period = await this.requirePeriod(request, reply)
    if (!period) return
    try {
      return reply.status(200).send(await this.service.getWasteReport(period))
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /** GET /admin/reports/schedule-profile — perfil da agenda + mix de pedidos. */
  async getScheduleProfile(request: FastifyRequest, reply: FastifyReply) {
    const period = await this.requirePeriod(request, reply)
    if (!period) return
    try {
      return reply.status(200).send(await this.service.getScheduleProfileReport(period))
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /** GET /admin/reports/payments — aprovação, estorno, mix e recuperação. */
  async getPayments(request: FastifyRequest, reply: FastifyReply) {
    const period = await this.requirePeriod(request, reply)
    if (!period) return
    try {
      return reply.status(200).send(await this.service.getPaymentsReport(period))
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
