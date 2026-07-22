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
      // 422: dia bloqueado / limite de pedidos do dia atingido (restrições do admin).
      if (e.statusCode === 422) {
        return reply.status(422).send({ error: e.message ?? 'Não é possível agendar neste dia' })
      }
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /orders/availability?days=14 — disponibilidade por data para a régua do pedido único.
   * Retorna, a partir de hoje (BRT), para cada data: se o dia está bloqueado e se o limite de
   * pedidos daquele dia já foi atingido (full). userId vem do JWT (rota autenticada).
   */
  async getAvailability(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as { days?: string }
      const parsed = query.days ? parseInt(query.days, 10) : 14
      const days = Number.isFinite(parsed) ? Math.min(60, Math.max(1, parsed)) : 14
      const availability = await this.service.getOrderAvailability(days)
      return reply.status(200).send({ availability })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * PATCH /orders/:id/cancel — cancela um pedido único do próprio cliente.
   *
   * userId vem do JWT. Devolve os pães ao saldo (estorno idempotente) enquanto o corte
   * do pedido não passou; após o corte responde 422 com code CUTOFF_PASSED.
   */
  async cancelSingleOrder(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id
      const { id } = request.params as { id: string }
      const result = await this.service.cancelSingleOrder(userId, id)
      return reply.status(200).send(result)
    } catch (err) {
      const e = err as { statusCode?: number; code?: string; message?: string }
      if (e.statusCode === 404) {
        return reply.status(404).send({ error: e.message ?? 'Pedido não encontrado' })
      }
      if (e.statusCode === 422) {
        return reply.status(422).send({ error: e.message ?? 'Pedido não pode ser cancelado', code: e.code })
      }
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /orders/today — retorna o pedido do dia atual em BRT.
   *
   * T-05-05: userId extraído de request.user.id (JWT) — nunca de query params.
   * Retorna 404 se não há pedido hoje.
   */
  async getTodayOrder(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id
      const order = await this.service.getTodayOrder(userId)
      if (!order) return reply.status(404).send({ error: 'Nenhuma entrega hoje' })
      return reply.status(200).send(order)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /orders/next — retorna a próxima entrega futura (de amanhã em diante).
   * Fallback do card da Home quando não há entrega hoje. 404 se não houver futura.
   */
  async getNextOrder(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id
      const order = await this.service.getNextOrder(userId)
      if (!order) return reply.status(404).send({ error: 'Nenhuma entrega futura' })
      return reply.status(200).send(order)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /orders/history?days=30 — retorna histórico dos últimos N dias.
   *
   * T-05-05: userId extraído de request.user.id (JWT) — nunca de query params.
   * Query param `days` é opcional; default 30.
   */
  async getOrderHistory(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id
      const query = request.query as { days?: string }
      const days = query.days ? parseInt(query.days, 10) : 30
      const history = await this.service.getOrderHistory(userId, days)
      return reply.status(200).send(history)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
