import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError, z } from 'zod'
import {
  ExpenseCreateSchema,
  ExpenseUpdateSchema,
  ExpenseCategoryCreateSchema,
  ExpenseCategoryUpdateSchema,
  ExpenseRecurrenceCreateSchema,
  ExpenseRecurrenceUpdateSchema,
  ExpenseImportSchema,
  ExpenseGroupSchema,
  ObjectIdSchema,
  DateOnlySchema,
  MonthSchema,
} from '@cheirin-de-pao/shared'
import { AdminExpensesService, ExpenseError } from './admin-expenses.service.js'
import { ExpensesReportService } from './expenses-report.service.js'
import { PeriodQuerySchema, specFromQuery } from '../../lib/period-query.js'
import { resolveWindow } from '../../lib/date-range.js'
import { uploadImage, StorageError, isStorageConfigured } from '../../lib/storage.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

const ListQuerySchema = z.object({
  month: MonthSchema.optional(),
  categoryId: ObjectIdSchema.optional(),
  group: ExpenseGroupSchema.optional(),
  status: z.enum(['PENDING', 'PAID', 'CANCELLED']).optional(),
  condominiumId: ObjectIdSchema.optional(),
  supplierId: ObjectIdSchema.optional(),
})

const IdParamsSchema = z.object({ id: ObjectIdSchema })
const MarkPaidSchema = z.object({ paidAt: DateOnlySchema.optional() })
const PayableQuerySchema = z.object({
  daysAhead: z.coerce.number().int().min(0).max(365).optional(),
})
const IncludeInactiveSchema = z.object({
  includeInactive: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((v) => v === true || v === 'true' || v === '1'),
})

/**
 * AdminExpensesController — despesas, categorias e recorrências.
 *
 * Segurança: preHandler `fastify.authenticate` na rota + role check ADMIN aqui (padrão D-11).
 *
 * `ExpenseError` carrega o próprio `statusCode`, então regra de negócio vira 400/404/409 em vez de
 * um 500 genérico que esconderia "categoria não encontrada" atrás de "erro interno".
 */
export class AdminExpensesController {
  private service: AdminExpensesService
  private report: ExpensesReportService

  constructor(private fastify: FastifyInstance) {
    this.service = new AdminExpensesService(fastify)
    this.report = new ExpensesReportService(fastify)
  }

  private adminId(request: FastifyRequest, reply: FastifyReply): string | null {
    if (request.user?.role !== 'ADMIN') {
      reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
      return null
    }
    const id = request.user?.id
    if (id == null) {
      reply.status(403).send({ error: 'Sessão inválida' })
      return null
    }
    return id
  }

  /** Executa, traduzindo ZodError → 400, ExpenseError → o status dele, resto → 500. */
  private async run<T>(reply: FastifyReply, fn: () => Promise<T>, okStatus = 200) {
    try {
      return reply.status(okStatus).send(await fn())
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      if (err instanceof ExpenseError) {
        return reply.status(err.statusCode).send({ error: err.message })
      }
      if (err instanceof RangeError) return reply.status(400).send({ error: err.message })
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  // ── Categorias ──────────────────────────────────────────────────────────

  async listCategories(request: FastifyRequest, reply: FastifyReply) {
    if (!this.adminId(request, reply)) return
    return this.run(reply, async () => {
      const q = IncludeInactiveSchema.parse(request.query)
      return this.service.listCategories(q.includeInactive)
    })
  }

  async createCategory(request: FastifyRequest, reply: FastifyReply) {
    if (!this.adminId(request, reply)) return
    return this.run(
      reply,
      async () => this.service.createCategory(ExpenseCategoryCreateSchema.parse(request.body)),
      201,
    )
  }

  async updateCategory(request: FastifyRequest, reply: FastifyReply) {
    if (!this.adminId(request, reply)) return
    return this.run(reply, async () => {
      const { id } = IdParamsSchema.parse(request.params)
      return this.service.updateCategory(id, ExpenseCategoryUpdateSchema.parse(request.body))
    })
  }

  async deleteCategory(request: FastifyRequest, reply: FastifyReply) {
    if (!this.adminId(request, reply)) return
    return this.run(reply, async () => {
      const { id } = IdParamsSchema.parse(request.params)
      return this.service.deleteCategory(id)
    })
  }

  // ── Lançamentos ─────────────────────────────────────────────────────────

  async list(request: FastifyRequest, reply: FastifyReply) {
    const adminId = this.adminId(request, reply)
    if (!adminId) return
    return this.run(reply, async () => {
      const q = ListQuerySchema.parse(request.query)
      return this.service.list(q, adminId)
    })
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const adminId = this.adminId(request, reply)
    if (!adminId) return
    return this.run(
      reply,
      async () => this.service.create(ExpenseCreateSchema.parse(request.body), adminId),
      201,
    )
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const adminId = this.adminId(request, reply)
    if (!adminId) return
    return this.run(reply, async () => {
      const { id } = IdParamsSchema.parse(request.params)
      return this.service.update(id, ExpenseUpdateSchema.parse(request.body), adminId)
    })
  }

  async markPaid(request: FastifyRequest, reply: FastifyReply) {
    const adminId = this.adminId(request, reply)
    if (!adminId) return
    return this.run(reply, async () => {
      const { id } = IdParamsSchema.parse(request.params)
      const { paidAt } = MarkPaidSchema.parse(request.body ?? {})
      return this.service.markPaid(id, paidAt, adminId)
    })
  }

  /** POST /admin/expenses/purchases/:id/pay — marca a compra ao fornecedor como paga (B5). */
  async markPurchasePaid(request: FastifyRequest, reply: FastifyReply) {
    const adminId = this.adminId(request, reply)
    if (!adminId) return
    return this.run(reply, async () => {
      const { id } = IdParamsSchema.parse(request.params)
      const { paidAt } = MarkPaidSchema.parse(request.body ?? {})
      return this.service.markPurchasePaid(id, paidAt)
    })
  }

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const adminId = this.adminId(request, reply)
    if (!adminId) return
    return this.run(reply, async () => {
      const { id } = IdParamsSchema.parse(request.params)
      return this.service.remove(id, adminId)
    })
  }

  async listPayable(request: FastifyRequest, reply: FastifyReply) {
    if (!this.adminId(request, reply)) return
    return this.run(reply, async () => {
      const q = PayableQuerySchema.parse(request.query)
      return this.service.listPayable(q.daysAhead)
    })
  }

  async importRows(request: FastifyRequest, reply: FastifyReply) {
    const adminId = this.adminId(request, reply)
    if (!adminId) return
    return this.run(reply, async () => {
      const { rows } = ExpenseImportSchema.parse(request.body)
      return this.service.importRows(rows, adminId)
    })
  }

  /**
   * POST /admin/expenses/receipt — sobe a foto do comprovante e devolve a URL.
   *
   * Separado do lançamento de propósito: o upload pode falhar (rede ruim na rua, bucket não
   * configurado) e isso **não pode impedir o registro da despesa**. O front sobe a foto, guarda a
   * URL e manda junto no `POST /admin/expenses`; se o upload falhar, ele lança sem anexo.
   */
  async uploadReceipt(request: FastifyRequest, reply: FastifyReply) {
    if (!this.adminId(request, reply)) return
    if (!isStorageConfigured()) {
      return reply.status(503).send({ error: 'Armazenamento de comprovantes não configurado.' })
    }
    try {
      const file = await request.file()
      if (!file) return reply.status(400).send({ error: 'Nenhum arquivo enviado.' })
      const url = await uploadImage(await file.toBuffer(), file.mimetype, 'receipts')
      return reply.status(201).send({ url })
    } catch (err) {
      if (err instanceof StorageError) return reply.status(400).send({ error: err.message })
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  // ── Recorrências ────────────────────────────────────────────────────────

  async listRecurrences(request: FastifyRequest, reply: FastifyReply) {
    if (!this.adminId(request, reply)) return
    return this.run(reply, async () => {
      const q = IncludeInactiveSchema.parse(request.query)
      return this.service.listRecurrences(q.includeInactive)
    })
  }

  async createRecurrence(request: FastifyRequest, reply: FastifyReply) {
    if (!this.adminId(request, reply)) return
    return this.run(
      reply,
      async () => this.service.createRecurrence(ExpenseRecurrenceCreateSchema.parse(request.body)),
      201,
    )
  }

  async updateRecurrence(request: FastifyRequest, reply: FastifyReply) {
    if (!this.adminId(request, reply)) return
    return this.run(reply, async () => {
      const { id } = IdParamsSchema.parse(request.params)
      return this.service.updateRecurrence(id, ExpenseRecurrenceUpdateSchema.parse(request.body))
    })
  }

  async removeRecurrence(request: FastifyRequest, reply: FastifyReply) {
    if (!this.adminId(request, reply)) return
    return this.run(reply, async () => {
      const { id } = IdParamsSchema.parse(request.params)
      return this.service.removeRecurrence(id)
    })
  }

  /**
   * GET /admin/reports/expenses — relatório de despesas (F2).
   *
   * Outra pergunta que a lista: "para onde o dinheiro está indo, e isso mudou?". Compara com a
   * janela anterior EQUIVALENTE por padrão.
   */
  async getReport(request: FastifyRequest, reply: FastifyReply) {
    if (!this.adminId(request, reply)) return
    return this.run(reply, async () => {
      const query = PeriodQuerySchema.parse(request.query)
      // Comparativo LIGADO por padrão aqui (ao contrário do resto): um gasto sem "vs. o mês
      // passado" não diz se subiu, e essa é a pergunta da tela.
      const compare = (request.query as { compare?: unknown })?.compare !== 'false'
      return this.report.getReport(resolveWindow(specFromQuery(query, 'month')), compare)
    })
  }
}
