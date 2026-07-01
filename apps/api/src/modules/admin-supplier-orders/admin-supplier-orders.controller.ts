// admin-supplier-orders.controller.ts — handlers HTTP para pedido ao fornecedor
// Padrão baseado em admin-orders.controller.ts
// Requirements: ADMO-05..09
// T-07-04-01: role check ADMIN inline no controller (padrão existente do projeto)
// T-07-04-02: endpoints PDF/Excel protegidos por authenticate preHandler

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { CreateSupplierOrderSchema } from './admin-supplier-orders.schema.js'
import { AdminSupplierOrdersService } from './admin-supplier-orders.service.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

/**
 * AdminSupplierOrdersController — handlers para o fluxo de pedido ao fornecedor.
 *
 * Segurança:
 * - preHandler: fastify.authenticate garante JWT válido (na rota)
 * - Inline role check request.user?.role !== 'ADMIN' → 403 (em cada handler)
 */
export class AdminSupplierOrdersController {
  private service: AdminSupplierOrdersService

  constructor(private fastify: FastifyInstance) {
    this.service = new AdminSupplierOrdersService(fastify)
  }

  /**
   * GET /admin/supplier-orders/draft
   *
   * Retorna lista de condomínios com totais de pães para o dia seguinte.
   * T-07-04-01: role check ADMIN
   */
  async getDraft(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    const { slotId, date } = request.query as { slotId?: string; date?: string }
    if (!slotId) return reply.status(400).send({ error: 'slotId é obrigatório' })

    try {
      const draft = await this.service.getDraft(slotId, date)
      return reply.status(200).send(draft)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 400) return reply.status(400).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /admin/supplier-orders/generated-status
   *
   * Informa se o pedido ao fornecedor de amanhã já foi gerado (FINALIZED).
   */
  async generatedStatus(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    const { slotId, date } = request.query as { slotId?: string; date?: string }
    if (!slotId) return reply.status(400).send({ error: 'slotId é obrigatório' })
    try {
      const status = await this.service.getGeneratedStatus(slotId, date)
      return reply.status(200).send(status)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 400) return reply.status(400).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /admin/supplier-orders/slots-status
   *
   * Estado de cada turno (data de entrega, tem pedidos, compra finalizada) — para a
   * aba Compra abrir no turno certo e mostrar a data correta.
   */
  async slotsStatus(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    try {
      const data = await this.service.getSlotsStatus()
      return reply.status(200).send({ slots: data })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /admin/supplier-orders/upcoming-days
   *
   * Próximos N dias de entrega, cada um com seus turnos e estado — alimenta a pré-tela "Dias".
   */
  async upcomingDays(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    const { days } = request.query as { days?: string }
    const n = Math.min(31, Math.max(1, Number(days) || 7))
    try {
      const data = await this.service.getUpcomingDays(n)
      return reply.status(200).send({ days: data })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /admin/supplier-orders/default-split — percentual do principal no split padrão.
   */
  async getDefaultSplit(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    try {
      const principalPercent = await this.service.getDefaultSplitPercent()
      return reply.status(200).send({ principalPercent })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * PATCH /admin/supplier-orders/default-split — define o percentual do principal (0–100).
   */
  async setDefaultSplit(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    const { principalPercent } = (request.body ?? {}) as { principalPercent?: number }
    if (typeof principalPercent !== 'number' || !Number.isFinite(principalPercent)) {
      return reply.status(400).send({ error: 'principalPercent deve ser um número (0–100)' })
    }
    try {
      const saved = await this.service.setDefaultSplitPercent(principalPercent)
      return reply.status(200).send({ principalPercent: saved })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * POST /admin/supplier-orders/quick
   *
   * "Gerar direto": cria o pedido do turno com a quantidade esperada e o split padrão.
   */
  async createQuick(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    const { slotId, date } = (request.body ?? {}) as { slotId?: string; date?: string }
    if (!slotId) return reply.status(400).send({ error: 'slotId é obrigatório' })
    try {
      const result = await this.service.createQuick(slotId, date)
      if (!result) return reply.status(409).send({ error: 'Nenhum pão a pedir para este turno.' })
      return reply.status(201).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 400) return reply.status(400).send({ error: e.message })
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /admin/supplier-orders/draft/:condominiumId
   *
   * Detalhamento por cliente das entregas de um condomínio para amanhã.
   * T-07-04-01: role check ADMIN
   */
  async getCondominiumDetail(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    const { condominiumId } = request.params as { condominiumId: string }
    const { slotId, date } = request.query as { slotId?: string; date?: string }
    if (!slotId) return reply.status(400).send({ error: 'slotId é obrigatório' })

    try {
      const detail = await this.service.getCondominiumDetail(condominiumId, slotId, date)
      return reply.status(200).send(detail)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 400) return reply.status(400).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * POST /admin/supplier-orders
   *
   * Cria PurchaseOrder DRAFT + items.
   * T-07-04-01: role check ADMIN
   * T-07-04-03: body validado por Zod
   */
  async create(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    let body: ReturnType<typeof CreateSupplierOrderSchema.parse>
    try {
      body = CreateSupplierOrderSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }

    try {
      const result = await this.service.create(body)
      return reply.status(201).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 400) return reply.status(400).send({ error: e.message })
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * PATCH /admin/supplier-orders/:id/finalize
   *
   * Finaliza pedido (DRAFT → FINALIZED).
   * T-07-04-04: idempotência — retorna 400 se já FINALIZED
   */
  async finalize(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    const { id } = request.params as { id: string }

    try {
      await this.service.finalize(id)
      return reply.status(200).send({ ok: true })
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      if (e.statusCode === 400) return reply.status(400).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /admin/supplier-orders
   *
   * Histórico de pedidos FINALIZED.
   */
  async getHistory(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    try {
      const history = await this.service.getHistory()
      return reply.status(200).send(history)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /admin/supplier-orders/:id/pdf
   *
   * Download PDF do pedido.
   * T-07-04-01: role check ADMIN
   * T-07-04-02: sem token = 401 (preHandler authenticate)
   */
  async getPdf(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    const { id } = request.params as { id: string }

    try {
      const buffer = await this.service.getPdfBuffer(id)
      // Usar reply.header().send() — não reply.status(200).send()
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', 'attachment; filename="pedido.pdf"')
        .send(buffer)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  /**
   * GET /admin/supplier-orders/:id/excel
   *
   * Download Excel (.xlsx) do pedido.
   * T-07-04-01: role check ADMIN
   * T-07-04-02: sem token = 401 (preHandler authenticate)
   */
  async getExcel(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    const { id } = request.params as { id: string }

    try {
      const buffer = await this.service.getExcelBuffer(id)
      return reply
        .header(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        .header('Content-Disposition', 'attachment; filename="pedido.xlsx"')
        .send(buffer)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
