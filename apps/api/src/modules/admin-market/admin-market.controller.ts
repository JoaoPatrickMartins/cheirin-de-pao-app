import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import '@fastify/multipart' // augmenta FastifyRequest com .file()
import { ZodError } from 'zod'
import {
  CreateProductSchema,
  UpdateProductSchema,
  CreateCategorySchema,
  UpdateCategorySchema,
} from '@cheirin-de-pao/shared'
import {
  SetStockSchema,
  SetMarketConfigSchema,
  MarketOrderFiltersSchema,
  CancelMarketOrderSchema,
  ResolveNotDeliveredSchema,
} from './admin-market.schema.js'
import { AdminMarketService } from './admin-market.service.js'
import { uploadProductImage, StorageError } from '../../lib/storage.js'

type ZodIssue = { message: string }
function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

/**
 * AdminMarketController — handlers do mini market (admin). Role ADMIN inline (per D-11);
 * Zod valida o body; erros de negócio chegam como { statusCode, message }.
 */
export class AdminMarketController {
  private service: AdminMarketService

  constructor(private fastify: FastifyInstance) {
    this.service = new AdminMarketService(fastify)
  }

  private denyNonAdmin(request: FastifyRequest, reply: FastifyReply): boolean {
    if (request.user?.role !== 'ADMIN') {
      reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
      return true
    }
    return false
  }

  private handleError(reply: FastifyReply, err: unknown) {
    this.fastify.log.error(err)
    const e = err as { statusCode?: number; message?: string }
    if (e.statusCode && e.message) return reply.status(e.statusCode).send({ error: e.message })
    return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
  }

  // ── Produtos ──
  async listProducts(request: FastifyRequest, reply: FastifyReply) {
    if (this.denyNonAdmin(request, reply)) return
    try {
      return reply.status(200).send(await this.service.listProducts())
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  async getProduct(request: FastifyRequest, reply: FastifyReply) {
    if (this.denyNonAdmin(request, reply)) return
    const { id } = request.params as { id: string }
    try {
      return reply.status(200).send(await this.service.getProduct(id))
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  async createProduct(request: FastifyRequest, reply: FastifyReply) {
    if (this.denyNonAdmin(request, reply)) return
    let body: ReturnType<typeof CreateProductSchema.parse>
    try {
      body = CreateProductSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    try {
      return reply.status(201).send(await this.service.createProduct(body))
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  async updateProduct(request: FastifyRequest, reply: FastifyReply) {
    if (this.denyNonAdmin(request, reply)) return
    const { id } = request.params as { id: string }
    let body: ReturnType<typeof UpdateProductSchema.parse>
    try {
      body = UpdateProductSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    try {
      return reply.status(200).send(await this.service.updateProduct(id, body))
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  async removeProduct(request: FastifyRequest, reply: FastifyReply) {
    if (this.denyNonAdmin(request, reply)) return
    const { id } = request.params as { id: string }
    try {
      await this.service.removeProduct(id)
      return reply.status(200).send({ ok: true })
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  async setStock(request: FastifyRequest, reply: FastifyReply) {
    if (this.denyNonAdmin(request, reply)) return
    const { id } = request.params as { id: string }
    let body: ReturnType<typeof SetStockSchema.parse>
    try {
      body = SetStockSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    try {
      return reply.status(200).send(await this.service.setStock(id, body))
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  /** POST /admin/market/upload — recebe uma imagem (multipart) e devolve a URL pública (S3). */
  async uploadImage(request: FastifyRequest, reply: FastifyReply) {
    if (this.denyNonAdmin(request, reply)) return
    try {
      const file = await request.file()
      if (!file) return reply.status(400).send({ error: 'Nenhum arquivo enviado.' })
      const buffer = await file.toBuffer()
      const url = await uploadProductImage(buffer, file.mimetype)
      return reply.status(201).send({ url })
    } catch (err) {
      if (err instanceof StorageError) return reply.status(400).send({ error: err.message })
      return this.handleError(reply, err)
    }
  }

  // ── Categorias ──
  async listCategories(request: FastifyRequest, reply: FastifyReply) {
    if (this.denyNonAdmin(request, reply)) return
    try {
      return reply.status(200).send(await this.service.listCategories())
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  async createCategory(request: FastifyRequest, reply: FastifyReply) {
    if (this.denyNonAdmin(request, reply)) return
    let body: ReturnType<typeof CreateCategorySchema.parse>
    try {
      body = CreateCategorySchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    try {
      return reply.status(201).send(await this.service.createCategory(body))
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  async updateCategory(request: FastifyRequest, reply: FastifyReply) {
    if (this.denyNonAdmin(request, reply)) return
    const { id } = request.params as { id: string }
    let body: ReturnType<typeof UpdateCategorySchema.parse>
    try {
      body = UpdateCategorySchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    try {
      return reply.status(200).send(await this.service.updateCategory(id, body))
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  async removeCategory(request: FastifyRequest, reply: FastifyReply) {
    if (this.denyNonAdmin(request, reply)) return
    const { id } = request.params as { id: string }
    try {
      await this.service.removeCategory(id)
      return reply.status(200).send({ ok: true })
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  // ── Config ──
  async getConfig(request: FastifyRequest, reply: FastifyReply) {
    if (this.denyNonAdmin(request, reply)) return
    try {
      return reply.status(200).send(await this.service.getConfig())
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  async setConfig(request: FastifyRequest, reply: FastifyReply) {
    if (this.denyNonAdmin(request, reply)) return
    let body: ReturnType<typeof SetMarketConfigSchema.parse>
    try {
      body = SetMarketConfigSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    try {
      return reply.status(200).send(await this.service.setConfig(body.minimo, body.cartaoMinimo))
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  // ── Cestinhas (MarketOrder) ──
  async listOrders(request: FastifyRequest, reply: FastifyReply) {
    if (this.denyNonAdmin(request, reply)) return
    let filters: ReturnType<typeof MarketOrderFiltersSchema.parse>
    try {
      filters = MarketOrderFiltersSchema.parse(request.query)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Filtros inválidos.' })
    }
    try {
      return reply.status(200).send(await this.service.listOrders(filters))
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  async getOrder(request: FastifyRequest, reply: FastifyReply) {
    if (this.denyNonAdmin(request, reply)) return
    const { id } = request.params as { id: string }
    try {
      return reply.status(200).send(await this.service.getOrder(id))
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  async cancelOrder(request: FastifyRequest, reply: FastifyReply) {
    if (this.denyNonAdmin(request, reply)) return
    let body: ReturnType<typeof CancelMarketOrderSchema.parse>
    try {
      body = CancelMarketOrderSchema.parse(request.body ?? {})
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    const { id } = request.params as { id: string }
    try {
      return reply.status(200).send(await this.service.cancelOrderAsAdmin(id, request.user!.id, body))
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  /**
   * GET /admin/market/stock-outlook
   *
   * Comprometido por produto e por dia (G1) — o que preparar/comprar nos próximos dias.
   */
  async stockOutlook(request: FastifyRequest, reply: FastifyReply) {
    if (this.denyNonAdmin(request, reply)) return
    const { days } = request.query as { days?: string }
    const parsed = days ? Number(days) : undefined
    try {
      return reply
        .status(200)
        .send(await this.service.getStockOutlook(Number.isFinite(parsed) ? parsed : undefined))
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  /**
   * POST /admin/market/orders/:id/resolve-loss
   *
   * Desfecho físico de uma Cestinha não entregue (G2): o item voltou à prateleira? o cliente recebe
   * os pãezinhos de volta? Sem isto, a perda ficava sem caminho nenhum depois do NOT_DELIVERED.
   */
  async resolveLoss(request: FastifyRequest, reply: FastifyReply) {
    if (this.denyNonAdmin(request, reply)) return
    let body: ReturnType<typeof ResolveNotDeliveredSchema.parse>
    try {
      body = ResolveNotDeliveredSchema.parse(request.body ?? {})
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    const { id } = request.params as { id: string }
    try {
      return reply.status(200).send(await this.service.resolveNotDelivered(id, request.user!.id, body))
    } catch (err) {
      return this.handleError(reply, err)
    }
  }
}
