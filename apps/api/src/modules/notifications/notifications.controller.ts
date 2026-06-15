import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError, z } from 'zod'
import { NotificationsService } from './notifications.service.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

const SavePushTokenSchema = z.object({
  playerId: z.string().min(1, 'playerId obrigatório'),
})

/**
 * NotificationsController — HTTP handler para registro de push token.
 *
 * T-04-03-05: userId extraído de request.user.id (JWT) — nunca do body.
 * Isso garante que o cliente só pode atualizar seu próprio player_id.
 */
export class NotificationsController {
  private service: NotificationsService

  constructor(private fastify: FastifyInstance) {
    this.service = new NotificationsService(fastify)
  }

  async savePushToken(request: FastifyRequest, reply: FastifyReply) {
    let body: ReturnType<typeof SavePushTokenSchema.parse>
    try {
      body = SavePushTokenSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }

    try {
      // T-04-03-05: userId vem do JWT — nunca do body
      const userId = request.user!.id
      await this.service.savePushToken(userId, body.playerId)
      return reply.status(200).send({ ok: true })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
