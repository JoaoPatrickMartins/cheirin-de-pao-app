import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { CreateCondominiumSchema, UpdateCondominiumSchema, SlotUpdateSchema } from './admin-condominiums.schema.js'
import { AdminCondominiumsService } from './admin-condominiums.service.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

/**
 * AdminCondominiumsController — handlers HTTP para CRUD de condomínios.
 *
 * Segurança (T-07-02-01, T-07-02-03, T-07-02-05):
 * - preHandler: fastify.authenticate garante JWT válido (na rota)
 * - Inline role check request.user?.role !== 'ADMIN' → 403 (no handler)
 * - Zod parse do body antes de qualquer chamada ao banco
 */
export class AdminCondominiumsController {
  private service: AdminCondominiumsService

  constructor(private fastify: FastifyInstance) {
    this.service = new AdminCondominiumsService(fastify)
  }

  /**
   * GET /admin/condominiums
   * Lista todos os condomínios (admin vê tudo, sem filtro).
   */
  async list(request: FastifyRequest, reply: FastifyReply) {
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
   * POST /admin/condominiums
   * Cria um novo condomínio com validação Zod.
   */
  async create(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    let body: ReturnType<typeof CreateCondominiumSchema.parse>
    try {
      body = CreateCondominiumSchema.parse(request.body)
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
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 400) return reply.status(400).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * PATCH /admin/condominiums/:id
   * Atualiza campos parcialmente de um condomínio.
   */
  async update(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    const { id } = request.params as { id: string }

    let body: ReturnType<typeof UpdateCondominiumSchema.parse>
    try {
      body = UpdateCondominiumSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }

    try {
      const result = await this.service.update(id, body)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * PATCH /admin/condominiums/:id/slots/:slotName
   * Atualiza campos de um slot individual (manha ou tarde) via read-modify-write.
   */
  async updateSlot(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    const { id, slotName } = request.params as { id: string; slotName: string }

    let body: ReturnType<typeof SlotUpdateSchema.parse>
    try {
      body = SlotUpdateSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }

    try {
      const updated = await this.service.updateSlot(id, slotName, body)
      return reply.send(updated)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * DELETE /admin/condominiums/:id
   * Remove um condomínio.
   */
  async remove(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    const { id } = request.params as { id: string }

    try {
      await this.service.remove(id)
      return reply.status(200).send({ ok: true })
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
