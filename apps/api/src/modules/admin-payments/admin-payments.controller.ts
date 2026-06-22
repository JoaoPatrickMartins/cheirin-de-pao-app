import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { PaymentIdParamSchema } from './admin-payments.schema.js'
import { AdminPaymentsService } from './admin-payments.service.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

/**
 * AdminPaymentsController — handlers para GET/POST /admin/payments
 *
 * Segurança (T-07-05-01, T-07-05-02, T-07-05-03):
 * - preHandler: fastify.authenticate garante JWT válido (na rota)
 * - Inline role check request.user?.role !== 'ADMIN' → 403 (neste handler)
 * - Erro de API MP capturado separadamente com log.error → 502
 *
 * Padrão baseado em admin-orders.controller.ts.
 */
export class AdminPaymentsController {
  private service: AdminPaymentsService

  constructor(private fastify: FastifyInstance) {
    this.service = new AdminPaymentsService(fastify)
  }

  /**
   * GET /admin/payments
   *
   * Lista todos os pagamentos com status.
   * Apenas ADMIN pode acessar (T-07-05-01).
   */
  async list(request: FastifyRequest, reply: FastifyReply) {
    // 1. Role check inline — T-07-05-01
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    try {
      const result = await this.service.list()
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /admin/payments/:id
   *
   * Detalhe completo de um pagamento + User.
   * Apenas ADMIN pode acessar (T-07-05-01).
   */
  async getById(request: FastifyRequest, reply: FastifyReply) {
    // 1. Role check inline — T-07-05-01
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    // 2. Validação do param :id
    let params: ReturnType<typeof PaymentIdParamSchema.parse>
    try {
      params = PaymentIdParamSchema.parse(request.params)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Parâmetros inválidos.' })
    }

    try {
      const result = await this.service.getById(params.id)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * POST /admin/payments/:id/refund
   *
   * Estorna um pagamento via Stripe + debita créditos.
   * Apenas ADMIN pode acessar (T-07-05-01).
   * Erro da API MP capturado separadamente → 502 (não 500).
   */
  async refund(request: FastifyRequest, reply: FastifyReply) {
    // 1. Role check inline — T-07-05-01
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    // 2. Validação do param :id
    let params: ReturnType<typeof PaymentIdParamSchema.parse>
    try {
      params = PaymentIdParamSchema.parse(request.params)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Parâmetros inválidos.' })
    }

    try {
      const result = await this.service.refund(params.id)
      return reply.status(200).send({ ok: true, ...result })
    } catch (err) {
      const e = err as { statusCode?: number; message?: string; isMpError?: boolean }

      // Erro de negócio (400, 404) — retornar direto ao cliente
      if (e.statusCode === 400) return reply.status(400).send({ error: e.message })
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })

      // Erro da API do Stripe — 502 (não erro interno nosso)
      if (e.isMpError) {
        this.fastify.log.error({ err }, '[refund] erro na API do Stripe')
        return reply.status(502).send({
          error: 'Erro ao processar estorno no Stripe. Tente novamente.',
        })
      }

      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
