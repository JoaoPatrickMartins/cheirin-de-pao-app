import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { ConfirmDeliveryParams } from './courier.schema.js'
import { CourierService } from './courier.service.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

/**
 * CourierController — HTTP handlers para o entregador.
 *
 * Seguranca:
 * - T-06-01/02: preHandler [authenticate, requireCourier] aplicado na rota
 * - courierId extraido SEMPRE de request.user.id (JWT) — NUNCA do body ou params
 */
export class CourierController {
  private service: CourierService

  constructor(private fastify: FastifyInstance) {
    this.service = new CourierService(fastify)
  }

  /**
   * GET /courier/orders/today
   *
   * Retorna ordens do dia agrupadas por condominio para o entregador logado.
   * courierId extraido de request.user.id (JWT).
   */
  async getTodayOrders(request: FastifyRequest, reply: FastifyReply) {
    try {
      // T-06-03: courierId do JWT — nunca de query params
      const courierId = request.user!.id
      const result = await this.service.getTodayOrders(courierId)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      if (e.statusCode === 403) return reply.status(403).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * PATCH /courier/orders/:id/confirm
   *
   * Confirma entrega de uma order.
   * courierId extraido de request.user.id (JWT) — NUNCA do body.
   * D-12: params validados via ConfirmDeliveryParams Zod schema.
   */
  async confirmDelivery(request: FastifyRequest, reply: FastifyReply) {
    // Validar params com Zod
    let params: ReturnType<typeof ConfirmDeliveryParams.parse>
    try {
      params = ConfirmDeliveryParams.parse(request.params)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados invalidos.' })
    }

    try {
      // T-06-01: courierId do JWT — nunca do body nem dos params
      const courierId = request.user!.id
      await this.service.confirmDelivery(params.id, courierId)
      return reply.status(200).send({ ok: true })
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 403) return reply.status(403).send({ error: e.message })
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      if (e.statusCode === 422) return reply.status(422).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
