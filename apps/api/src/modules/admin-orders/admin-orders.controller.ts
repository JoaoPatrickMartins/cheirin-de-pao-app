import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import {
  UpdateOrderStatusSchema,
  AssignCourierSchema,
  ApproveDivisionSchema,
  LedgerQuerySchema,
  RefundOrderSchema,
} from './admin-orders.schema.js'
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
   * GET /admin/dashboard
   *
   * Retorna KPIs do painel admin: breadsTodayCount, revenueToday, clientsCount,
   * condominiumsCount, cutoffTime, revenueByType.
   * Apenas ADMIN pode acessar (T-07-06-01).
   */
  async dashboard(request: FastifyRequest, reply: FastifyReply) {
    // T-07-06-01: Role check inline
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    try {
      const data = await this.service.getDashboard()
      return reply.status(200).send(data)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /admin/orders/delivery-status
   *
   * Retorna entregas do dia agrupadas por condomínio.
   * Inclui orderIds para o frontend chamar assign-courier em batch.
   * Apenas ADMIN pode acessar (T-07-06-01).
   */
  async deliveryStatus(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    try {
      const { slotId, date } = request.query as { slotId?: string; date?: string }
      const data = await this.service.getDeliveryStatus(slotId, date)
      return reply.status(200).send(data)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /admin/orders/division-suggestion
   *
   * Retorna sugestão de divisão de entregas entre entregadores ativos.
   * Algoritmo greedy (D-10): balanceia pães totais entre entregadores.
   * Apenas ADMIN pode acessar (T-07-06-01).
   */
  async divisionSuggestion(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    try {
      const { slotId, date } = request.query as { slotId?: string; date?: string }
      const data = await this.service.getDivisionSuggestion(slotId, date)
      return reply.status(200).send(data)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
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
   * POST /admin/orders/approve-division
   *
   * Aprova a divisão sugerida: despacha os pedidos (SEPARATED → OUT_FOR_DELIVERY)
   * gravando o entregador de cada grupo. Apenas ADMIN (T-06-04).
   */
  async approveDivision(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    let body: ReturnType<typeof ApproveDivisionSchema.parse>
    try {
      body = ApproveDivisionSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Dados invalidos.' })
    }

    try {
      const result = await this.service.approveDivision(body.assignments)
      return reply.status(200).send({ ok: true, count: result.count })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /admin/orders — ledger (verificação geral + histórico + limbo).
   */
  async ledger(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    let query: ReturnType<typeof LedgerQuerySchema.parse>
    try {
      query = LedgerQuerySchema.parse(request.query)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Filtros inválidos.' })
    }
    try {
      const data = await this.service.getLedger(query)
      return reply.status(200).send(data)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /admin/orders/stuck — pedidos parados (limbo).
   */
  async stuck(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    try {
      const data = await this.service.getStuck()
      return reply.status(200).send(data)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * POST /admin/orders/:id/refund — estorna créditos de um pedido.
   */
  async refundOrder(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    let body: ReturnType<typeof RefundOrderSchema.parse>
    try {
      body = RefundOrderSchema.parse(request.body ?? {})
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    const { id: orderId } = request.params as { id: string }
    try {
      const result = await this.service.refundOrder(orderId, request.user.id, body.reason)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      if (e.statusCode === 409) return reply.status(409).send({ error: e.message })
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
      await this.service.updateOrderStatus(orderId, body.status, body.reason)
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
