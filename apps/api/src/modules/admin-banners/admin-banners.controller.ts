import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import '@fastify/multipart' // augmenta FastifyRequest com .file()
import { ZodError } from 'zod'
import { CreateBannerSchema, UpdateBannerSchema } from '@cheirin-de-pao/shared'
import { AdminBannersService } from './admin-banners.service.js'
import { uploadImage, StorageError } from '../../lib/storage.js'

type ZodIssue = { message: string }
function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

/**
 * AdminBannersController — handlers dos banners, avisos e promoções (admin).
 * Role ADMIN inline (per D-11); Zod valida o body; erros de negócio chegam como
 * { statusCode, message }.
 */
export class AdminBannersController {
  private service: AdminBannersService

  constructor(private fastify: FastifyInstance) {
    this.service = new AdminBannersService(fastify)
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

  async list(request: FastifyRequest, reply: FastifyReply) {
    if (this.denyNonAdmin(request, reply)) return
    try {
      return reply.status(200).send(await this.service.list())
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  async get(request: FastifyRequest, reply: FastifyReply) {
    if (this.denyNonAdmin(request, reply)) return
    const { id } = request.params as { id: string }
    try {
      return reply.status(200).send(await this.service.get(id))
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    if (this.denyNonAdmin(request, reply)) return
    let body: ReturnType<typeof CreateBannerSchema.parse>
    try {
      body = CreateBannerSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    try {
      return reply.status(201).send(await this.service.create(body, request.user!.id))
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    if (this.denyNonAdmin(request, reply)) return
    const { id } = request.params as { id: string }
    let body: ReturnType<typeof UpdateBannerSchema.parse>
    try {
      body = UpdateBannerSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    try {
      return reply.status(200).send(await this.service.update(id, body))
    } catch (err) {
      // O service revalida o objeto MESCLADO — um patch que só faz sentido junto com o que já
      // estava gravado falha aqui, e o admin precisa ver a mensagem, não um 500.
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return this.handleError(reply, err)
    }
  }

  async remove(request: FastifyRequest, reply: FastifyReply) {
    if (this.denyNonAdmin(request, reply)) return
    const { id } = request.params as { id: string }
    try {
      return reply.status(200).send(await this.service.remove(id))
    } catch (err) {
      return this.handleError(reply, err)
    }
  }

  /** Upload da arte (multipart/form-data) → { url }. Mesmo limite de 5 MB do upload de produto. */
  async uploadArt(request: FastifyRequest, reply: FastifyReply) {
    if (this.denyNonAdmin(request, reply)) return
    try {
      const file = await request.file()
      if (!file) return reply.status(400).send({ error: 'Nenhum arquivo enviado.' })
      const buffer = await file.toBuffer()
      const url = await uploadImage(buffer, file.mimetype, 'banners')
      return reply.status(201).send({ url })
    } catch (err) {
      if (err instanceof StorageError) return reply.status(400).send({ error: err.message })
      return this.handleError(reply, err)
    }
  }
}
