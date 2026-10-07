import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z, ZodError } from 'zod'
import { AdminCourierPayoutsService } from './admin-courier-payouts.service.js'

const objectId = z.string().regex(/^[0-9a-f]{24}$/i, 'Id inválido')
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (AAAA-MM-DD)')
const money = z.number().finite().min(0, 'Valor não pode ser negativo').max(100_000, 'Valor acima do limite')

const IdParams = z.object({ id: objectId })
const ListQuery = z.object({ week: day.optional() })
const HistoryQuery = z.object({ courierId: objectId.optional(), limit: z.coerce.number().int().min(1).max(100).optional() })
const EditBody = z.object({ remunerationFinal: money, fuelFinal: money, adjustReason: z.string().trim().max(200).nullish() })
const ApproveBody = z.object({
  paid: z.boolean(),
  paidAt: day.optional(),
  paymentMethod: z.string().trim().max(40).nullish(),
  dueDate: day.optional(),
})
const DiscardBody = z.object({ reason: z.string().trim().min(3, 'Diga o motivo do descarte').max(200) })

/** A8 · Pagamentos dos entregadores. Admin checado aqui; erros esperados viram 400/404/409. */
export class AdminCourierPayoutsController {
  private service: AdminCourierPayoutsService

  constructor(private fastify: FastifyInstance) {
    this.service = new AdminCourierPayoutsService(fastify)
  }

  private async run<T>(request: FastifyRequest, reply: FastifyReply, work: () => Promise<T>) {
    if (request.user?.role !== 'ADMIN') return reply.status(403).send({ error: 'Acesso restrito ao administrador' })
    try {
      return reply.status(200).send(await work())
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: err.issues.map((i) => i.message).join(', ') })
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 400 || e.statusCode === 404 || e.statusCode === 409) return reply.status(e.statusCode).send({ error: e.message })
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  list(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, () => this.service.list(ListQuery.parse(request.query ?? {}).week))
  }

  history(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, () => {
      const q = HistoryQuery.parse(request.query ?? {})
      return this.service.history(q.courierId, q.limit)
    })
  }

  summary(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, () => this.service.summary())
  }

  edit(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, () => this.service.edit(IdParams.parse(request.params).id, EditBody.parse(request.body ?? {})))
  }

  approve(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, () => {
      const b = ApproveBody.parse(request.body ?? {})
      return this.service.approve(IdParams.parse(request.params).id, { ...b, paymentMethod: b.paymentMethod ?? null }, request.user!.id)
    })
  }

  discard(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, () => this.service.discard(IdParams.parse(request.params).id, DiscardBody.parse(request.body ?? {}).reason))
  }
}
