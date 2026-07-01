import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { TrackEventSchema } from './analytics.schema.js'
import { AnalyticsService } from './analytics.service.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

/**
 * AnalyticsController — POST /analytics/event (rota pública).
 *
 * Best-effort: nunca deve quebrar a experiência do cliente. Erros de persistência
 * são logados e respondidos com 202 (aceito) para não vazar detalhes nem gerar ruído
 * no app — o evento de analytics é "fire and forget".
 */
export class AnalyticsController {
  private service: AnalyticsService

  constructor(private fastify: FastifyInstance) {
    this.service = new AnalyticsService(fastify)
  }

  async track(request: FastifyRequest, reply: FastifyReply) {
    let body: ReturnType<typeof TrackEventSchema.parse>
    try {
      body = TrackEventSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }

    try {
      await this.service.record({ ...body, userAgent: request.headers['user-agent'] })
    } catch (err) {
      // Não falha o cliente por causa de analytics — apenas registra.
      this.fastify.log.warn({ err }, '[analytics] falha ao registrar evento — ignorado')
    }

    return reply.status(202).send({ ok: true })
  }
}
