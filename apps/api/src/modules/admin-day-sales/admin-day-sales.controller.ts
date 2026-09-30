// admin-day-sales.controller.ts — handlers HTTP do relatório de itens vendidos do dia.
//
// Segurança (padrão do projeto):
// - preHandler: fastify.authenticate garante JWT válido (na rota)
// - Inline role check request.user?.role !== 'ADMIN' → 403 (em cada handler)

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { AdminDaySalesService } from './admin-day-sales.service.js'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export class AdminDaySalesController {
  private service: AdminDaySalesService

  constructor(private fastify: FastifyInstance) {
    this.service = new AdminDaySalesService(fastify)
  }

  /** Erro do service → resposta. 400 é do usuário (data malformada); o resto é nosso. */
  private fail(reply: FastifyReply, err: unknown) {
    this.fastify.log.error(err)
    const e = err as { statusCode?: number; message?: string }
    if (e.statusCode === 400) return reply.status(400).send({ error: e.message })
    return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
  }

  /** GET /admin/day-sales?date=YYYY-MM-DD */
  async getReport(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    const { date } = request.query as { date?: string }
    try {
      return reply.status(200).send(await this.service.getReport(date))
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  /** GET /admin/day-sales/pdf?date=YYYY-MM-DD */
  async getPdf(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    const { date } = request.query as { date?: string }
    try {
      const buffer = await this.service.getPdfBuffer(date)
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="vendas-${date ?? 'hoje'}.pdf"`)
        .send(buffer)
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  /** GET /admin/day-sales/excel?date=YYYY-MM-DD */
  async getExcel(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    const { date } = request.query as { date?: string }
    try {
      const buffer = await this.service.getExcelBuffer(date)
      return reply
        .header('Content-Type', XLSX_MIME)
        .header('Content-Disposition', `attachment; filename="vendas-${date ?? 'hoje'}.xlsx"`)
        .send(buffer)
    } catch (err) {
      return this.fail(reply, err)
    }
  }
}
