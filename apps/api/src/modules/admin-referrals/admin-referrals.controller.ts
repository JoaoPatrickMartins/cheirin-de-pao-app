import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import { AdminReferralsService } from './admin-referrals.service.js'
import { LinkReferralSchema, ListReferralsQuerySchema, RejectReferralSchema } from './admin-referrals.schema.js'

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

function zodMessage(err: ZodError): string {
  return err.issues.map((i) => i.message).join(', ')
}

type IdParams = { Params: { id: string } }

/**
 * AdminReferralsController — Indique e Ganhe, lado do admin. Toda rota checa ADMIN no primeiro
 * statement do handler (o `authenticate` da rota só garante o JWT).
 */
export class AdminReferralsController {
  private service: AdminReferralsService

  constructor(private fastify: FastifyInstance) {
    this.service = new AdminReferralsService(fastify)
  }

  private denied(request: FastifyRequest, reply: FastifyReply): boolean {
    if (request.user?.role === 'ADMIN') return false
    void reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    return true
  }

  /** Erro conhecido → status do domínio; o resto → 500 logado. */
  private fail(reply: FastifyReply, err: unknown) {
    if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
    const domain = domainError(err)
    if (domain) return reply.status(domain.statusCode).send({ error: domain.message })
    this.fastify.log.error(err)
    return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
  }

  async summary(request: FastifyRequest, reply: FastifyReply) {
    if (this.denied(request, reply)) return reply
    try {
      return reply.status(200).send(await this.service.summary())
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    if (this.denied(request, reply)) return reply
    try {
      const query = ListReferralsQuerySchema.parse(request.query ?? {})
      return reply.status(200).send(await this.service.list(query))
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  async detail(request: FastifyRequest<IdParams>, reply: FastifyReply) {
    if (this.denied(request, reply)) return reply
    try {
      const detail = await this.service.detail(request.params.id)
      if (!detail) return reply.status(404).send({ error: 'Indicação não encontrada.' })
      return reply.status(200).send(detail)
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  async approve(request: FastifyRequest<IdParams>, reply: FastifyReply) {
    if (this.denied(request, reply)) return reply
    try {
      await this.service.approve(request.params.id, request.user!.id)
      return reply.status(200).send({ ok: true })
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  async reject(request: FastifyRequest<IdParams>, reply: FastifyReply) {
    if (this.denied(request, reply)) return reply
    let body
    try {
      body = RejectReferralSchema.parse(request.body ?? {})
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      throw err
    }
    try {
      await this.service.reject(request.params.id, body, request.user!.id)
      return reply.status(200).send({ ok: true })
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  async clientReferrals(request: FastifyRequest<IdParams>, reply: FastifyReply) {
    if (this.denied(request, reply)) return reply
    try {
      const data = await this.service.clientReferrals(request.params.id)
      if (!data) return reply.status(404).send({ error: 'Cliente não encontrado.' })
      return reply.status(200).send(data)
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  async checkCode(request: FastifyRequest<IdParams & { Querystring: { code?: string } }>, reply: FastifyReply) {
    if (this.denied(request, reply)) return reply
    try {
      const data = await this.service.checkCode(request.params.id, request.query.code ?? '')
      if (!data) return reply.status(404).send({ error: 'Cliente não encontrado.' })
      return reply.status(200).send(data)
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  async link(request: FastifyRequest<IdParams>, reply: FastifyReply) {
    if (this.denied(request, reply)) return reply
    let body
    try {
      body = LinkReferralSchema.parse(request.body ?? {})
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      throw err
    }
    try {
      const res = await this.service.link(request.params.id, body.code)
      return reply.status(200).send({ ok: true, ...res })
    } catch (err) {
      return this.fail(reply, err)
    }
  }
}
