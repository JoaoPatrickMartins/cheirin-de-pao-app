import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import { CondoInterestSchema, MarkHandledSchema } from './condo-interests.schema.js'
import { CondoInterestsService } from './condo-interests.service.js'

/** Erro de domínio lançado pelo service: `{ statusCode, message }`. */
function domainError(err: unknown): { statusCode: number; message: string } | null {
  if (err && typeof err === 'object' && 'statusCode' in err && 'message' in err) {
    const e = err as { statusCode: unknown; message: unknown }
    if (typeof e.statusCode === 'number' && typeof e.message === 'string') {
      return { statusCode: e.statusCode, message: e.message }
    }
  }
  return null
}

/**
 * CondoInterestsController — lista de espera de condomínio. O POST é público (o visitante ainda
 * não tem conta); as rotas do admin checam ADMIN no primeiro statement.
 */
export class CondoInterestsController {
  private service: CondoInterestsService

  constructor(private fastify: FastifyInstance) {
    this.service = new CondoInterestsService(fastify)
  }

  private fail(reply: FastifyReply, err: unknown) {
    // A 1ª mensagem vai para a tela: é a do campo que precisa de ajuste.
    if (err instanceof ZodError) return reply.status(400).send({ error: err.issues[0]?.message ?? 'Dados inválidos.' })
    const domain = domainError(err)
    if (domain) return reply.status(domain.statusCode).send({ error: domain.message })
    this.fastify.log.error(err)
    return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = CondoInterestSchema.parse(request.body ?? {})
      await this.service.create(body)
      return reply.status(201).send({ ok: true })
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    try {
      return reply.status(200).send(await this.service.listGroups())
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  async setHandled(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }
    try {
      const body = MarkHandledSchema.parse(request.body ?? {})
      await this.service.setHandled(body.groupKey, body.handled)
      return reply.status(200).send({ ok: true })
    } catch (err) {
      return this.fail(reply, err)
    }
  }
}
