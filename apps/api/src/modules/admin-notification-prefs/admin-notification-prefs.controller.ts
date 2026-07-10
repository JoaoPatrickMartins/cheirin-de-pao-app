import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { UpdatePrefsSchema } from './admin-notification-prefs.schema.js'
import { AdminNotificationPrefsService } from './admin-notification-prefs.service.js'

type ZodIssue = { message: string }
function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

/**
 * AdminNotificationPrefsController — toggles de notificação do admin autenticado.
 * Role check ADMIN inline; adminId sempre de request.user.id (JWT).
 */
export class AdminNotificationPrefsController {
  private service: AdminNotificationPrefsService

  constructor(private fastify: FastifyInstance) {
    this.service = new AdminNotificationPrefsService(fastify)
  }

  async get(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    try {
      const prefs = await this.service.getPrefs(request.user.id)
      return reply.status(200).send({ prefs })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    let patch: ReturnType<typeof UpdatePrefsSchema.parse>
    try {
      patch = UpdatePrefsSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Parâmetros inválidos.' })
    }
    try {
      const prefs = await this.service.setPrefs(request.user.id, patch)
      return reply.status(200).send({ prefs })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
