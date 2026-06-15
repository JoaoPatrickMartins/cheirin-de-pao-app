import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { UpdateOrderStatusSchema, AssignCourierSchema } from './admin-orders.schema.js'
import { AdminOrdersService } from './admin-orders.service.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

/**
 * AdminOrdersController — handler HTTP para operações de admin sobre pedidos.
 *
 * Segurança (T-05-01):
 * - preHandler: fastify.authenticate garante JWT válido (na rota)
 * - Inline role check request.user?.role !== 'ADMIN' → 403 (no handler)
 *
 * Padrão baseado em auth.controller.ts (registerCourier) e orders.controller.ts.
 */
export class AdminOrdersController {
  private service: AdminOrdersService

  constructor(private fastify: FastifyInstance) {
    this.service = new AdminOrdersService(fastify)
  }

  /**
   * PATCH /admin/orders/assign-courier
   *
   * Atribui entregador a orders em batch.
   * Apenas ADMIN pode acessar (T-06-04).
   * D-13: courierId e orderIds validados via AssignCourierSchema.
   */
  async assignCourier(request: FastifyRequest, reply: FastifyReply) {
    // 1. Role check inline — T-06-04
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    // 2. Validacao Zod do body
    let body: ReturnType<typeof AssignCourierSchema.parse>
    try {
      body = AssignCourierSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados invalidos.' })
    }

    // 3. Chamar service
    try {
      const result = await this.service.assignCourier(body.courierId, {
        orderIds: body.orderIds,
        condominiumId: body.condominiumId,
        date: body.date,
      })
      return reply.status(200).send({ ok: true, count: result.count })
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 400) return reply.status(400).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * PATCH /admin/orders/:id/status
   *
   * Atualiza status de um pedido com validação de transição.
   * Apenas ADMIN pode acessar (T-05-01).
   */
  async updateOrderStatus(request: FastifyRequest, reply: FastifyReply) {
    // 1. Role check inline — T-05-01
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    // 2. Validação Zod do body
    let body: ReturnType<typeof UpdateOrderStatusSchema.parse>
    try {
      body = UpdateOrderStatusSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }

    // 3. Params da rota
    const { id: orderId } = request.params as { id: string }

    // 4. Chamar service
    try {
      await this.service.updateOrderStatus(orderId, body.status)
      return reply.status(200).send({ ok: true })
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      if (e.statusCode === 422) return reply.status(422).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
