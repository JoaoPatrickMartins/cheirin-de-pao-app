import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { ClientListQuerySchema, GrantCreditsSchema } from './admin-clients.schema.js'
import { AdminClientsService } from './admin-clients.service.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

/**
 * AdminClientsController — handler HTTP para gestão de clientes.
 *
 * T-07-03-01: Role check ADMIN inline no primeiro statement de cada handler.
 * T-07-03-04: blockToggle verifica role=CLIENT no service (não permite bloquear ADMIN/COURIER).
 * T-07-03-05: getDetail é somente leitura — retorna dados de Schedule e Orders.
 */
export class AdminClientsController {
  private service: AdminClientsService

  constructor(private fastify: FastifyInstance) {
    this.service = new AdminClientsService(fastify)
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    // T-07-03-01: role check inline
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    let query: ReturnType<typeof ClientListQuerySchema.parse>
    try {
      query = ClientListQuerySchema.parse(request.query)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Parâmetros inválidos.' })
    }

    try {
      const result = await this.service.list(query.condominiumId)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async getDetail(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    const { id } = request.params as { id: string }

    try {
      const result = await this.service.getDetail(id)
      // T-10-02-05: Flatten corrigido — campos do client no nível raiz com schedule e recentOrders
      return reply.status(200).send({ ...result.client, schedule: result.schedule, recentOrders: result.recentOrders })
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async grantCredits(request: FastifyRequest, reply: FastifyReply) {
    // T-10-02-01: Role check ADMIN inline
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    const { id } = request.params as { id: string }

    let body: ReturnType<typeof GrantCreditsSchema.parse>
    try {
      body = GrantCreditsSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Parâmetros inválidos.' })
    }

    try {
      // T-10-02-01: adminId extraído do JWT — nunca do body
      const result = await this.service.grantCredits(id, { ...body, adminId: request.user.id })
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      if (e.statusCode === 400) return reply.status(400).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async blockToggle(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    const { id } = request.params as { id: string }

    try {
      const result = await this.service.blockToggle(id)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
