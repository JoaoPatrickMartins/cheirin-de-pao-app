import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { ScheduleBodySchema } from './schedules.schema.js'
import { SchedulesService } from './schedules.service.js'

function zodMessage(err: ZodError): string {
  return err.issues.map((e: { message: string }) => e.message).join(', ')
}

export class SchedulesController {
  private service: SchedulesService

  constructor(private fastify: FastifyInstance) {
    this.service = new SchedulesService(fastify)
  }

  async getMySchedule(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id
      const schedule = await this.service.getSchedule(userId)
      if (!schedule) {
        return reply.status(404).send({ error: 'Agenda não encontrada' })
      }
      return reply.status(200).send(schedule)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async updateMySchedule(request: FastifyRequest, reply: FastifyReply) {
    let body: ReturnType<typeof ScheduleBodySchema.parse>
    try {
      body = ScheduleBodySchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }

    try {
      const userId = request.user!.id

      // Buscar condominiumId do usuário autenticado
      const user = await this.fastify.prisma.user.findUnique({
        where: { id: userId },
        select: { condominiumId: true },
      })

      if (!user?.condominiumId) {
        return reply.status(400).send({ error: 'Usuário sem condomínio associado' })
      }

      const schedule = await this.service.upsertSchedule(userId, user.condominiumId, body)
      return reply.status(200).send(schedule)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
