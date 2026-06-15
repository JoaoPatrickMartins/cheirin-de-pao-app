import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { CreateOrderSchema } from './orders.schema.js'
import { OrdersService } from './orders.service.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

/**
 * OrdersController — HTTP handler para pedidos avulsos.
 *
 * T-04-03-01: userId extraído de request.user.id (JWT) — nunca do body.
 */
export class OrdersController {
  private service: OrdersService

  constructor(private fastify: FastifyInstance) {
    this.service = new OrdersService(fastify)
  }

  async createSingleOrder(request: FastifyRequest, reply: FastifyReply) {
    let body: ReturnType<typeof CreateOrderSchema.parse>
    try {
      body = CreateOrderSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }

    try {
      // T-04-03-01: userId vem do JWT — não aceita userId externo
      const userId = request.user!.id
      const order = await this.service.createSingleOrder(userId, body)
      return reply.status(201).send({
        orderId: order.id,
        scheduledDate: order.scheduledDate,
        quantity: order.quantity,
      })
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 400) {
        return reply.status(400).send({ error: e.message ?? 'Requisição inválida' })
      }
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
