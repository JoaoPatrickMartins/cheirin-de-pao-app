import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ClientHookService } from './client-hook.service.js'

/**
 * ClientHookController — endpoints do cliente para o gancho de porta.
 * Role check CLIENT inline no primeiro statement de cada handler.
 */
export class ClientHookController {
  private service: ClientHookService

  constructor(private fastify: FastifyInstance) {
    this.service = new ClientHookService(fastify)
  }

  async status(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'CLIENT') {
      return reply.status(403).send({ error: 'Acesso negado: apenas clientes' })
    }
    try {
      const result = await this.service.getStatus(request.user.id)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async request(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'CLIENT') {
      return reply.status(403).send({ error: 'Acesso negado: apenas clientes' })
    }
    try {
      const result = await this.service.requestHook(request.user.id)
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
