import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import {
  ClientListQuerySchema,
  GrantCreditsSchema,
  RemoveCreditsSchema,
  UpdateClientSchema,
  CancelOrderSchema,
  ScheduleActiveSchema,
  BlockToggleSchema,
  AddNoteSchema,
} from './admin-clients.schema.js'
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
      const result = await this.service.list(query)
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
      // Flatten: campos do client no nível raiz + condomínio, agenda, pedidos e métricas.
      // O response schema da rota funciona como allowlist — campos sensíveis do User
      // (stripeCustomerId, oneSignalPlayerId, etc.) não são declarados, logo não vazam.
      return reply.status(200).send({
        ...result.client,
        condominiumName: result.condominium?.name ?? null,
        blockedByName: result.blockedByName,
        schedule: result.schedule,
        recentOrders: result.recentOrders,
        metrics: result.metrics,
      })
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async updateClient(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    const { id } = request.params as { id: string }

    let body: ReturnType<typeof UpdateClientSchema.parse>
    try {
      body = UpdateClientSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Parâmetros inválidos.' })
    }

    try {
      const updated = await this.service.updateClient(id, body)
      return reply.status(200).send({
        id: updated.id,
        name: updated.name,
        phone: updated.phone ?? null,
        email: updated.email ?? null,
        cpf: updated.cpf,
        birthDate: updated.birthDate ?? null,
        condominiumId: updated.condominiumId ?? null,
        apartment: updated.apartment ?? null,
        block: updated.block ?? null,
      })
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      if (e.statusCode === 409) return reply.status(409).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async creditHistory(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    const { id } = request.params as { id: string }
    const { limit } = request.query as { limit?: string }
    const take = Math.min(200, Math.max(1, Number(limit) || 50))
    try {
      const result = await this.service.getCreditHistory(id, take)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async payments(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    const { id } = request.params as { id: string }
    try {
      const result = await this.service.getPayments(id)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async paymentMethods(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    const { id } = request.params as { id: string }
    try {
      const result = await this.service.getPaymentMethods(id)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async orders(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    const { id } = request.params as { id: string }
    const { limit } = request.query as { limit?: string }
    const take = Math.min(200, Math.max(1, Number(limit) || 50))
    try {
      const result = await this.service.getOrders(id, take)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async cancelOrder(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    const { id, orderId } = request.params as { id: string; orderId: string }
    let body: ReturnType<typeof CancelOrderSchema.parse>
    try {
      body = CancelOrderSchema.parse(request.body ?? {})
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Parâmetros inválidos.' })
    }
    try {
      const result = await this.service.cancelOrder(id, orderId, body.refundCredits, request.user.id)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      if (e.statusCode === 422) return reply.status(422).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async setScheduleActive(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    const { id } = request.params as { id: string }
    let body: ReturnType<typeof ScheduleActiveSchema.parse>
    try {
      body = ScheduleActiveSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Parâmetros inválidos.' })
    }
    try {
      const result = await this.service.setScheduleActive(id, body.isActive)
      return reply.status(200).send(result)
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

  async removeCredits(request: FastifyRequest, reply: FastifyReply) {
    // Role check ADMIN inline
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    const { id } = request.params as { id: string }

    let body: ReturnType<typeof RemoveCreditsSchema.parse>
    try {
      body = RemoveCreditsSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Parâmetros inválidos.' })
    }

    try {
      // adminId extraído do JWT — nunca do body
      const result = await this.service.removeCredits(id, { ...body, adminId: request.user.id })
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      if (e.statusCode === 422) return reply.status(422).send({ error: e.message })
      if (e.statusCode === 400) return reply.status(400).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async blockToggle(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    const { id } = request.params as { id: string }

    let body: ReturnType<typeof BlockToggleSchema.parse>
    try {
      body = BlockToggleSchema.parse(request.body ?? {})
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Parâmetros inválidos.' })
    }

    try {
      const result = await this.service.blockToggle(id, body.reason, request.user.id)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async sessions(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    const { id } = request.params as { id: string }
    try {
      const result = await this.service.getSessions(id)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async revokeSession(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    const { id, sessionId } = request.params as { id: string; sessionId: string }
    try {
      const result = await this.service.revokeSession(id, sessionId)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async notes(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    const { id } = request.params as { id: string }
    try {
      const result = await this.service.getNotes(id)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async addNote(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    const { id } = request.params as { id: string }
    let body: ReturnType<typeof AddNoteSchema.parse>
    try {
      body = AddNoteSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Parâmetros inválidos.' })
    }
    try {
      const result = await this.service.addNote(id, body.body, request.user.id)
      return reply.status(201).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async deleteNote(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    const { id, noteId } = request.params as { id: string; noteId: string }
    try {
      const result = await this.service.deleteNote(id, noteId)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
