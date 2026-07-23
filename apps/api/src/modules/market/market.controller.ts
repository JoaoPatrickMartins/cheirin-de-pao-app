import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { UpdateCartSchema, MarketCheckoutSchema } from '@cheirin-de-pao/shared'
import { MarketService } from './market.service.js'
import { MarketCheckoutService } from './market-checkout.service.js'
import { MarketOrdersService } from './market-orders.service.js'

type ZodIssue = { message: string }
function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

/**
 * MarketController — leituras do catálogo + Cestinha do próprio usuário (JWT).
 * userId sempre de request.user.id (nunca do body).
 */
export class MarketController {
  private service: MarketService
  private checkoutService: MarketCheckoutService
  private ordersService: MarketOrdersService

  constructor(private fastify: FastifyInstance) {
    this.service = new MarketService(fastify)
    this.checkoutService = new MarketCheckoutService(fastify)
    this.ordersService = new MarketOrdersService(fastify)
  }

  private handleError(reply: FastifyReply, err: unknown) {
    // Erros de negócio { statusCode, message } → status próprio; o resto → 500.
    const e = err as { statusCode?: number; message?: string }
    if (e.statusCode && e.message) return reply.status(e.statusCode).send({ error: e.message })
    this.fastify.log.error(err)
    return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
  }

  async catalog(_request: FastifyRequest, reply: FastifyReply) {
    try {
      return reply.status(200).send(await this.service.getCatalog())
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  async getCart(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id
      return reply.status(200).send(await this.service.getCart(userId))
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  async updateCart(request: FastifyRequest, reply: FastifyReply) {
    let body: ReturnType<typeof UpdateCartSchema.parse>
    try {
      body = UpdateCartSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    try {
      const userId = request.user!.id
      return reply.status(200).send(await this.service.updateCart(userId, body))
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  async checkout(request: FastifyRequest, reply: FastifyReply) {
    let body: ReturnType<typeof MarketCheckoutSchema.parse>
    try {
      body = MarketCheckoutSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    try {
      const userId = request.user!.id
      return reply.status(201).send(await this.checkoutService.checkout(userId, body))
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  // ── Acompanhamento / histórico (C7) ──
  async ordersToday(request: FastifyRequest, reply: FastifyReply) {
    try {
      return reply.status(200).send(await this.ordersService.getToday(request.user!.id))
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  async ordersNext(request: FastifyRequest, reply: FastifyReply) {
    try {
      return reply.status(200).send(await this.ordersService.getNext(request.user!.id))
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  async ordersHistory(request: FastifyRequest, reply: FastifyReply) {
    try {
      return reply.status(200).send(await this.ordersService.getHistory(request.user!.id))
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  async cancelOrder(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }
      return reply.status(200).send(await this.ordersService.cancelOrder(request.user!.id, id))
    } catch (err) {
      return this.handleError(reply, err)
    }
  }
}
