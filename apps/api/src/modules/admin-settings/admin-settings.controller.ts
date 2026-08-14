import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { UpdateSlotsSchema, UpdateAvulsoSchema, UpdatePedidoMinimoSchema, UpdateGanchoSchema, UpdateRestricoesSchema, CreateDeliveryBlockSchema } from './admin-settings.schema.js'
import { AdminSettingsService } from './admin-settings.service.js'
import { AdminBlocksService } from './admin-blocks.service.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

/** Erro de domínio lançado pelos services: `{ statusCode, message }`. */
function domainError(err: unknown): { statusCode: number; message: string } | null {
  if (err && typeof err === 'object' && 'statusCode' in err && 'message' in err) {
    const e = err as { statusCode: unknown; message: unknown }
    if (typeof e.statusCode === 'number' && typeof e.message === 'string') {
      return { statusCode: e.statusCode, message: e.message }
    }
  }
  return null
}

/** `?condominiumId=` — hex ObjectId; qualquer outra coisa é tratada como ausente (escopo global). */
function condoIdFromQuery(query: unknown): string | null {
  const raw = (query as { condominiumId?: unknown } | undefined)?.condominiumId
  return typeof raw === 'string' && /^[0-9a-fA-F]{24}$/.test(raw) ? raw : null
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
  private blocks: AdminBlocksService

  constructor(private fastify: FastifyInstance) {
    this.service = new AdminSettingsService(fastify)
    this.blocks = new AdminBlocksService(fastify)
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
   * GET /admin/settings/slots?condominiumId=
   * Sem `condominiumId`: o PADRÃO global de slots (com cutoffTime por slot).
   * Com `condominiumId`: os slots EFETIVOS daquele condomínio, com `timeCustom`/`activeCustom`
   * indicando o que foi personalizado e o que é herdado.
   */
  async getSlots(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    try {
      const condominiumId = condoIdFromQuery(request.query)
      const slots = await this.service.getDeliverySlots(condominiumId)
      return reply.status(200).send({ slots, condominiumId })
    } catch (err) {
      const domain = domainError(err)
      if (domain) return reply.status(domain.statusCode).send({ error: domain.message })
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * PATCH /admin/settings/slots
   *
   * Body global: { slots: [{ slotId, time?, cutoffTime?, label?, emoji?, isActive? }] } — edita o
   * padrão e propaga para os condomínios, preservando o que cada um personalizou.
   *
   * Body por condomínio: { condominiumId, slots: [{ slotId, time?, isActive? }] } — só horário de
   * entrega e ativação (o corte é global); `null` volta a herdar o padrão.
   *
   * 422 quando o horário informado inverteria a Regra A (entrega cairia em outro dia que o resto
   * da operação naquele corte) — ver lib/delivery-slots.
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
      const slots = await this.service.setDeliverySlots(body.slots, body.condominiumId)
      return reply.status(200).send({ ok: true, slots, condominiumId: body.condominiumId ?? null })
    } catch (err) {
      const domain = domainError(err)
      if (domain) return reply.status(domain.statusCode).send({ error: domain.message })
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

  /**
   * GET /admin/settings/restricoes-dias?condominiumId=
   * Sem `condominiumId`: o PADRÃO global. Com: o EFETIVO daquele condomínio + `source`, que diz
   * por seção se o valor veio do condomínio ('condo') ou do padrão ('global').
   */
  async getRestricoes(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    try {
      const condominiumId = condoIdFromQuery(request.query)
      const { blocked, limits, source } = await this.service.getRestricoes(condominiumId)
      return reply.status(200).send({
        diasBloqueados: blocked,
        limitePedidosDia: limits,
        source,
        condominiumId,
      })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * PATCH /admin/settings/restricoes-dias
   *
   * Body: { condominiumId?, diasBloqueados: {seg..dom:bool} | null, limitePedidosDia: {...} | null }
   *
   * Sem `condominiumId` grava o padrão global (os mapas são obrigatórios). Com `condominiumId`,
   * `null` em um mapa significa "voltar a herdar o padrão". Quando resolvido para um condomínio,
   * o limite conta apenas as entregas DAQUELE condomínio.
   */
  async setRestricoes(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    let body: ReturnType<typeof UpdateRestricoesSchema.parse>
    try {
      body = UpdateRestricoesSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }

    try {
      const { blocked, limits, source } = await this.service.setRestricoes(
        body.diasBloqueados,
        body.limitePedidosDia,
        body.condominiumId,
      )
      return reply.status(200).send({
        ok: true,
        diasBloqueados: blocked,
        limitePedidosDia: limits,
        source,
        condominiumId: body.condominiumId ?? null,
      })
    } catch (err) {
      const domain = domainError(err)
      if (domain) return reply.status(domain.statusCode).send({ error: domain.message })
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /admin/settings/bloqueios-data?condominiumId=&includePast=
   * Lista os bloqueios de data/período. Sem `condominiumId` traz todos (globais + de cada
   * condomínio); com, traz os daquele condomínio + os globais (que também valem lá).
   */
  async listBloqueiosData(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    try {
      const condominiumId = condoIdFromQuery(request.query)
      const includePast = (request.query as { includePast?: unknown } | undefined)?.includePast === 'true'
      const blocks = await this.blocks.listBlocks(condominiumId, includePast)
      return reply.status(200).send({ blocks })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /admin/settings/bloqueios-data/impacto?condominiumId=&startDate=&endDate=
   * Dry-run: o que já existe nessas datas. O admin usa para decidir entre só travar novos
   * pedidos ou cancelar o que existe com estorno.
   */
  async impactoBloqueioData(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    const q = request.query as { startDate?: string; endDate?: string } | undefined
    if (!q?.startDate || !q?.endDate) {
      return reply.status(400).send({ error: 'Informe startDate e endDate (AAAA-MM-DD).' })
    }

    try {
      const impact = await this.blocks.getImpact(
        condoIdFromQuery(request.query),
        q.startDate,
        q.endDate,
      )
      return reply.status(200).send(impact)
    } catch (err) {
      const domain = domainError(err)
      if (domain) return reply.status(domain.statusCode).send({ error: domain.message })
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * POST /admin/settings/bloqueios-data
   * Body: { condominiumId?, startDate, endDate, reason?, cancelExisting? }
   * Com `cancelExisting`, cancela os pedidos/Cestinhas do período estornando os créditos.
   */
  async createBloqueioData(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    let body: ReturnType<typeof CreateDeliveryBlockSchema.parse>
    try {
      body = CreateDeliveryBlockSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }

    try {
      const result = await this.blocks.createBlock(body)
      return reply.status(201).send({ ok: true, ...result })
    } catch (err) {
      const domain = domainError(err)
      if (domain) return reply.status(domain.statusCode).send({ error: domain.message })
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * DELETE /admin/settings/bloqueios-data/:id
   * Remove o bloqueio. Não ressuscita pedidos cancelados (o estorno já devolveu os créditos).
   */
  async deleteBloqueioData(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    try {
      await this.blocks.deleteBlock((request.params as { id: string }).id)
      return reply.status(200).send({ ok: true })
    } catch (err) {
      const domain = domainError(err)
      if (domain) return reply.status(domain.statusCode).send({ error: domain.message })
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
