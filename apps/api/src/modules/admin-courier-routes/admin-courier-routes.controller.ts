import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z, ZodError } from 'zod'
import { searchAddress } from '../../lib/geocode.js'
import { AdminCourierRoutesService } from './admin-courier-routes.service.js'

const objectId = z.string().regex(/^[0-9a-f]{24}$/i, 'Id inválido')
const RouteParams = z.object({ id: objectId, slotId: z.string().min(1).max(40) })
const AdoptParams = RouteParams.extend({ runId: objectId })
const OrderBody = z.object({ condominiumIds: z.array(objectId).min(1).max(100) })
const GeocodeQuery = z.object({ q: z.string().min(3, 'Digite ao menos 3 letras').max(200) })

/** Rotas dos entregadores no admin (A2 mapa ao vivo · A4 rota do entregador · A5 busca da base e rota padrão). */
export class AdminCourierRoutesController {
  private service: AdminCourierRoutesService

  constructor(private fastify: FastifyInstance) {
    this.service = new AdminCourierRoutesService(fastify)
  }

  /** Admin + Zod + erros esperados (400/404) num lugar só. */
  private async run<T>(request: FastifyRequest, reply: FastifyReply, work: () => Promise<T>) {
    if (request.user?.role !== 'ADMIN') return reply.status(403).send({ error: 'Acesso restrito ao administrador' })
    try {
      return reply.status(200).send(await work())
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: err.issues.map((i) => i.message).join(', ') })
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 400 || e.statusCode === 404) return reply.status(e.statusCode).send({ error: e.message })
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  getRoute(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, () => {
      const p = RouteParams.parse(request.params)
      return this.service.getRoute(p.id, p.slotId)
    })
  }

  accept(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, () => {
      const p = RouteParams.parse(request.params)
      return this.service.accept(p.id, p.slotId, request.user!.id)
    })
  }

  keep(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, () => {
      const p = RouteParams.parse(request.params)
      return this.service.keep(p.id, p.slotId, request.user!.id)
    })
  }

  save(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, () => {
      const p = RouteParams.parse(request.params)
      const b = OrderBody.parse(request.body ?? {})
      return this.service.save(p.id, p.slotId, b.condominiumIds, request.user!.id)
    })
  }

  adopt(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, () => {
      const p = AdoptParams.parse(request.params)
      return this.service.adopt(p.id, p.slotId, p.runId, request.user!.id)
    })
  }

  reset(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, () => {
      const p = RouteParams.parse(request.params)
      return this.service.reset(p.id, p.slotId)
    })
  }

  defaultRoute(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, () => this.service.defaultRoute())
  }

  suggestDefault(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, () => this.service.suggestDefault())
  }

  saveDefault(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, () => this.service.saveDefault(OrderBody.parse(request.body ?? {}).condominiumIds, request.user!.id))
  }

  reviewDefault(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, () => this.service.reviewDefault())
  }

  preview(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, () => this.service.preview(OrderBody.parse(request.body ?? {}).condominiumIds))
  }

  live(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, () => this.service.live())
  }

  geocode(request: FastifyRequest, reply: FastifyReply) {
    return this.run(request, reply, async () => ({ results: await searchAddress(GeocodeQuery.parse(request.query).q) }))
  }
}
