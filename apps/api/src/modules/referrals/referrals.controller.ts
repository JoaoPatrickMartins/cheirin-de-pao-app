import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import { ReferralsService } from './referrals.service.js'
import { CelebrationSeenSchema } from './referrals.schema.js'

/**
 * ReferralsController — Indique e Ganhe, lado do cliente.
 * As rotas públicas (config e validação do código) não têm checagem de role; as do cliente
 * checam CLIENT no primeiro statement do handler.
 */
export class ReferralsController {
  private service: ReferralsService

  constructor(private fastify: FastifyInstance) {
    this.service = new ReferralsService(fastify)
  }

  async publicConfig(_request: FastifyRequest, reply: FastifyReply) {
    try {
      return reply.status(200).send(await this.service.publicConfig())
    } catch (err) {
      // O cadastro não pode travar por isto: sem config, o campo do código simplesmente não aparece.
      this.fastify.log.error(err)
      return reply.status(200).send({ active: false, welcomeBreads: 0 })
    }
  }

  async checkCode(request: FastifyRequest<{ Params: { code: string } }>, reply: FastifyReply) {
    try {
      return reply.status(200).send(await this.service.checkCode(request.params.code))
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async summary(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'CLIENT') {
      return reply.status(403).send({ error: 'Acesso negado: apenas clientes' })
    }
    try {
      return reply.status(200).send(await this.service.summary(request.user.id))
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'CLIENT') {
      return reply.status(403).send({ error: 'Acesso negado: apenas clientes' })
    }
    try {
      return reply.status(200).send(await this.service.me(request.user.id))
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async celebrationSeen(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'CLIENT') {
      return reply.status(403).send({ error: 'Acesso negado: apenas clientes' })
    }
    let body
    try {
      body = CelebrationSeenSchema.parse(request.body ?? {})
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: 'Dados inválidos.' })
      throw err
    }
    try {
      await this.service.markCelebrationSeen(request.user.id, body)
      return reply.status(200).send({ ok: true })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async dismissHomeCard(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'CLIENT') {
      return reply.status(403).send({ error: 'Acesso negado: apenas clientes' })
    }
    try {
      await this.service.dismissHomeCard(request.user.id)
      return reply.status(200).send({ ok: true })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
