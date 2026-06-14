import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError, z } from 'zod'
import { CreatePixPaymentSchema, CreateCardPaymentSchema } from './payments.schema.js'
import { PaymentsService } from './payments.service.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

const GetStatusParamsSchema = z.object({
  id: z.string(),
})

export class PaymentsController {
  private service: PaymentsService

  constructor(private fastify: FastifyInstance) {
    this.service = new PaymentsService(fastify)
  }

  async createPix(request: FastifyRequest, reply: FastifyReply) {
    let body: ReturnType<typeof CreatePixPaymentSchema.parse>
    try {
      body = CreatePixPaymentSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    try {
      const userId = request.user!.id
      const result = await this.service.createPix({ ...body, userId })
      return reply.status(201).send(result)
    } catch (err) {
      if (err && typeof err === 'object' && 'error' in err && 'status' in err) {
        const e = err as { error: string; status: number }
        return reply.status(e.status).send({ error: e.error })
      }
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async createCard(request: FastifyRequest, reply: FastifyReply) {
    let body: ReturnType<typeof CreateCardPaymentSchema.parse>
    try {
      body = CreateCardPaymentSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    try {
      const userId = request.user!.id
      const result = await this.service.createCard({ ...body, userId })
      return reply.status(201).send(result)
    } catch (err) {
      if (err && typeof err === 'object' && 'error' in err && 'status' in err) {
        const e = err as { error: string; status: number }
        return reply.status(e.status).send({ error: e.error })
      }
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async getStatus(request: FastifyRequest, reply: FastifyReply) {
    let params: ReturnType<typeof GetStatusParamsSchema.parse>
    try {
      params = GetStatusParamsSchema.parse(request.params)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Parâmetros inválidos.' })
    }
    try {
      const userId = request.user!.id
      const result = await this.service.getStatus(params.id, userId)
      return reply.status(200).send(result)
    } catch (err) {
      if (err && typeof err === 'object' && 'error' in err && 'status' in err) {
        const e = err as { error: string; status: number }
        return reply.status(e.status).send({ error: e.error })
      }
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
