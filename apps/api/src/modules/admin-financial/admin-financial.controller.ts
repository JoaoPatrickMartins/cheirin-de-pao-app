import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { FinancialQuerySchema } from './admin-financial.schema.js'
import { AdminFinancialService } from './admin-financial.service.js'

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
 *
 * Padrão baseado em admin-orders.controller.ts.
 */
export class AdminFinancialController {
  private service: AdminFinancialService

  constructor(private fastify: FastifyInstance) {
    this.service = new AdminFinancialService(fastify)
  }

  /**
   * GET /admin/financial
   *
   * Retorna receita por período com breakdown por tipo e condomínio.
   * Apenas ADMIN pode acessar (T-07-05-01).
   */
  async getRevenue(request: FastifyRequest, reply: FastifyReply) {
    // 1. Role check inline — T-07-05-01
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    // 2. Validação Zod da querystring
    let query: ReturnType<typeof FinancialQuerySchema.parse>
    try {
      query = FinancialQuerySchema.parse(request.query)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Parâmetros inválidos.' })
    }

    // 3. Chamar service
    try {
      const result = await this.service.getRevenue(query.period, query.condominiumId)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
