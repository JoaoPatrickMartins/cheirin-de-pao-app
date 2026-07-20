import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { UpdateSlotsSchema, UpdateAvulsoSchema, UpdatePedidoMinimoSchema, UpdateGanchoSchema } from './admin-settings.schema.js'
import { AdminSettingsService } from './admin-settings.service.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

/**
 * AdminSettingsController — handlers para configurações globais do admin.
 *
 * Segurança (T-07-02-01, T-07-02-05):
 * - preHandler: fastify.authenticate garante JWT válido (na rota)
 * - Inline role check request.user?.role !== 'ADMIN' → 403 (no handler)
 */
export class AdminSettingsController {
  private service: AdminSettingsService

  constructor(private fastify: FastifyInstance) {
    this.service = new AdminSettingsService(fastify)
  }

  /**
   * GET /settings/cutoff-status
   * Autenticado — retorna o status de corte POR SLOT do condomínio do cliente:
   * { slots: [{ name, time, cutoffTime, isPast }] }. Sem condomínio → slots vazio.
   */
  async cutoffStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user?.id
      if (!userId) return reply.status(401).send({ error: 'Não autorizado' })

      const user = await this.fastify.prisma.user.findUnique({
        where: { id: userId },
        select: { condominiumId: true },
      })
      if (!user?.condominiumId) {
        return reply.status(200).send({ slots: [] })
      }

      const data = await this.service.getCutoffStatusByCondo(user.condominiumId)
      return reply.status(200).send(data)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /admin/settings/slots
   * Retorna a config global de slots de entrega (com cutoffTime por slot).
   */
  async getSlots(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    try {
      const slots = await this.service.getDeliverySlots()
      return reply.status(200).send({ slots })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * PATCH /admin/settings/slots
   * Edita a config global de slots e propaga para todos os condomínios.
   * Body: { slots: [{ slotId, cutoffTime?, label?, emoji?, isActive? }] }
   * `time`/`name`/`slotId` NÃO são editáveis (read-only — ver Etapa B).
   */
  async setSlots(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    let body: ReturnType<typeof UpdateSlotsSchema.parse>
    try {
      body = UpdateSlotsSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }

    try {
      const slots = await this.service.setDeliverySlots(body.slots)
      return reply.status(200).send({ ok: true, slots })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /admin/settings/avulso
   * Retorna a configuração de compra avulsa.
   */
  async getAvulso(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    try {
      const config = await this.service.getAvulsoConfig()
      return reply.status(200).send(config)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * PATCH /admin/settings/avulso
   * Atualiza a configuração de compra avulsa. Body: { limit: number, unitPrice: number }
   */
  async setAvulso(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    let body: ReturnType<typeof UpdateAvulsoSchema.parse>
    try {
      body = UpdateAvulsoSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }

    try {
      await this.service.setAvulsoConfig(body.limit, body.unitPrice)
      return reply.status(200).send({ ok: true, limit: body.limit, unitPrice: body.unitPrice })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /admin/settings/pedido-minimo
   * Retorna os pedidos mínimos (agenda por dia + pedido único).
   */
  async getPedidoMinimo(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    try {
      const config = await this.service.getPedidoMinimoConfig()
      return reply.status(200).send(config)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * PATCH /admin/settings/pedido-minimo
   * Atualiza os pedidos mínimos. Body: { unico: number, agenda: {seg..dom: number} }
   */
  async setPedidoMinimo(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    let body: ReturnType<typeof UpdatePedidoMinimoSchema.parse>
    try {
      body = UpdatePedidoMinimoSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }

    try {
      await this.service.setPedidoMinimoConfig(body.unico, body.agenda)
      return reply.status(200).send({ ok: true, unico: body.unico, agenda: body.agenda })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /admin/settings/gancho
   * Retorna a config do gancho (mínimo do pedido único + preço do gancho adicional).
   */
  async getGancho(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    try {
      const config = await this.service.getGanchoConfig()
      return reply.status(200).send(config)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * PATCH /admin/settings/gancho
   * Atualiza a config do gancho. Body: { pedidoUnicoMin: number, preco: number }
   */
  async setGancho(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    let body: ReturnType<typeof UpdateGanchoSchema.parse>
    try {
      body = UpdateGanchoSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }

    try {
      await this.service.setGanchoConfig(body.pedidoUnicoMin, body.preco)
      return reply.status(200).send({ ok: true, pedidoUnicoMin: body.pedidoUnicoMin, preco: body.preco })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
