import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import '@fastify/multipart' // augmenta FastifyRequest com .file()
import { ZodError } from 'zod'
import { CreateCourierSchema, UpdateCourierSchema, TimeOffSchema } from './admin-couriers.schema.js'
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

  /** Erros esperados das telas novas (400/404/503); o resto vira 500. */
  private sendError(reply: FastifyReply, err: unknown) {
    if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
    const e = err as { statusCode?: number; message?: string }
    if (e.statusCode && [400, 404, 503].includes(e.statusCode)) return reply.status(e.statusCode).send({ error: e.message })
    this.fastify.log.error(err)
    return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
  }

  /** POST /admin/couriers/photo — foto do crachá (multipart `file`) → { url }. */
  async uploadPhoto(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    try {
      const file = await request.file()
      if (!file) return reply.status(400).send({ error: 'Envie a foto.' })
      const body = await file.toBuffer()
      return reply.status(201).send(await this.service.uploadPhoto(body, file.mimetype))
    } catch (err) {
      if ((err as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') return reply.status(400).send({ error: 'Imagem acima do limite de 5 MB.' })
      return this.sendError(reply, err)
    }
  }

  /** GET /admin/couriers/:id/time-offs */
  async listTimeOffs(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    try {
      const { id } = request.params as { id: string }
      return reply.status(200).send(await this.service.listTimeOffs(id))
    } catch (err) {
      return this.sendError(reply, err)
    }
  }

  /** POST /admin/couriers/:id/time-offs — devolve a folga e as rotas aprovadas que ela atinge. */
  async addTimeOff(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    try {
      const { id } = request.params as { id: string }
      const body = TimeOffSchema.parse(request.body ?? {})
      return reply.status(201).send(await this.service.addTimeOff(id, body, request.user.id))
    } catch (err) {
      return this.sendError(reply, err)
    }
  }

  /** DELETE /admin/couriers/:id/time-offs/:timeOffId */
  async deleteTimeOff(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    try {
      const { id, timeOffId } = request.params as { id: string; timeOffId: string }
      await this.service.deleteTimeOff(id, timeOffId)
      return reply.status(204).send()
    } catch (err) {
      return this.sendError(reply, err)
    }
  }
}
