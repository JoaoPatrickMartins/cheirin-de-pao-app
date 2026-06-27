import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { SetSeparatedSchema, ConcludeSeparationSchema } from './admin-separation.schema.js'
import { AdminSeparationService } from './admin-separation.service.js'

type ZodIssue = { message: string }
function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

/**
 * AdminSeparationController — handlers HTTP da etapa de separação.
 *
 * Segurança: role check inline ADMIN (padrão de admin-orders.controller).
 */
export class AdminSeparationController {
  private service: AdminSeparationService

  constructor(private fastify: FastifyInstance) {
    this.service = new AdminSeparationService(fastify)
  }

  /** GET /admin/separation/board?date=YYYY-MM-DD */
  async board(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    try {
      const { date, slotId } = request.query as { date?: string; slotId?: string }
      const data = await this.service.getBoard(date, slotId)
      return reply.status(200).send(data)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /** PATCH /admin/separation/orders/:id */
  async setSeparated(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    let body: ReturnType<typeof SetSeparatedSchema.parse>
    try {
      body = SetSeparatedSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }

    const { id: orderId } = request.params as { id: string }
    try {
      const result = await this.service.setSeparated(orderId, body.separated)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      if (e.statusCode === 422) return reply.status(422).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /** PATCH /admin/separation/conclude */
  async conclude(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    let body: ReturnType<typeof ConcludeSeparationSchema.parse>
    try {
      body = ConcludeSeparationSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }

    try {
      const result = await this.service.conclude(body.condominiumId, body.slotId, body.date)
      return reply.status(200).send({ ok: true, count: result.count })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
