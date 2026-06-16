import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { UpdateCutoffSchema, UpdateAvulsoSchema } from './admin-settings.schema.js'
import { AdminSettingsService } from './admin-settings.service.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

/**
 * AdminSettingsController — handlers para configurações globais do admin.
 *
 * Segurança (T-07-02-01, T-07-02-05):
 * - preHandler: fastify.authenticate garante JWT válido (na rota)
 * - Inline role check request.user?.role !== 'ADMIN' → 403 (no handler)
 */
export class AdminSettingsController {
  private service: AdminSettingsService

  constructor(private fastify: FastifyInstance) {
    this.service = new AdminSettingsService(fastify)
  }

  /**
   * GET /admin/settings/cutoff
   * Retorna o horário de corte configurado.
   */
  async getCutoff(request: FastifyRequest, reply: FastifyReply) {
    // T-07-02-01: Role check inline
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    try {
      const cutoffTime = await this.service.getCutoffTime()
      return reply.status(200).send({ cutoffTime })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * PATCH /admin/settings/cutoff
   * Atualiza o horário de corte. Body: { cutoffTime: 'HH:MM' }
   * T-07-02-02: Zod regex valida formato antes de upsert.
   */
  async setCutoff(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    let body: ReturnType<typeof UpdateCutoffSchema.parse>
    try {
      body = UpdateCutoffSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }

    try {
      await this.service.setCutoffTime(body.cutoffTime)
      return reply.status(200).send({ ok: true, cutoffTime: body.cutoffTime })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /admin/settings/avulso
   * Retorna a configuração de compra avulsa.
   */
  async getAvulso(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    try {
      const config = await this.service.getAvulsoConfig()
      return reply.status(200).send(config)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * PATCH /admin/settings/avulso
   * Atualiza a configuração de compra avulsa. Body: { limit: number, unitPrice: number }
   */
  async setAvulso(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    let body: ReturnType<typeof UpdateAvulsoSchema.parse>
    try {
      body = UpdateAvulsoSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }

    try {
      await this.service.setAvulsoConfig(body.limit, body.unitPrice)
      return reply.status(200).send({ ok: true, limit: body.limit, unitPrice: body.unitPrice })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
