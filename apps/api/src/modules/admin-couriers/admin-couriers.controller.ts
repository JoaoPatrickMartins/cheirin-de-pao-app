import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { CreateCourierSchema, UpdateCourierSchema } from './admin-couriers.schema.js'
import { AdminCouriersService } from './admin-couriers.service.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

/**
 * AdminCouriersController — handler HTTP para gestão de entregadores.
 *
 * T-07-03-01: Role check ADMIN inline no primeiro statement de cada handler.
 * T-07-03-02: P2002 (CPF duplicado) capturado → 409 Conflict.
 * preHandler: fastify.authenticate na rota garante JWT válido.
 */
export class AdminCouriersController {
  private service: AdminCouriersService

  constructor(private fastify: FastifyInstance) {
    this.service = new AdminCouriersService(fastify)
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    // T-07-03-01: role check inline
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

  async create(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    let body: ReturnType<typeof CreateCourierSchema.parse>
    try {
      body = CreateCourierSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }

    try {
      const result = await this.service.create(body)
      return reply.status(201).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      // T-07-03-02: P2002 Prisma — CPF duplicado
      const e = err as { statusCode?: number; message?: string; code?: string }
      if (e.code === 'P2002') {
        return reply.status(409).send({ error: 'CPF já cadastrado no sistema' })
      }
      if (e.statusCode === 400) return reply.status(400).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async toggle(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    const { id } = request.params as { id: string }

    try {
      const result = await this.service.toggle(id)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      if (e.statusCode === 400) return reply.status(400).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async updateCourier(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    const { id } = request.params as { id: string }

    let body: ReturnType<typeof UpdateCourierSchema.parse>
    try {
      body = UpdateCourierSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }

    try {
      const result = await this.service.updateCourier(id, body)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
