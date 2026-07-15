import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { UpdateProfileSchema, ContactChangeRequestSchema, ContactChangeConfirmSchema } from './client-profile.schema.js'
import { ClientProfileService } from './client-profile.service.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

export class ClientProfileController {
  private service: ClientProfileService

  constructor(private fastify: FastifyInstance) {
    this.service = new ClientProfileService(fastify)
  }

  async getProfile(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'CLIENT') {
      return reply.status(403).send({ error: 'Acesso negado' })
    }
    const userId = request.user.id
    try {
      const profile = await this.service.getProfile(userId)
      if (!profile) return reply.status(404).send({ error: 'Usuário não encontrado' })
      return reply.status(200).send(profile)
    } catch (err) {
      return reply.status(500).send({ error: 'Erro interno' })
    }
  }

  async updateProfile(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'CLIENT') {
      return reply.status(403).send({ error: 'Acesso negado' })
    }
    const userId = request.user.id
    let body: ReturnType<typeof UpdateProfileSchema.parse>
    try {
      body = UpdateProfileSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Corpo inválido' })
    }
    try {
      const result = await this.service.updateProfile(userId, body)
      if ('error' in result) return reply.status(result.status ?? 500).send({ error: result.error })
      return reply.status(200).send(result)
    } catch (err) {
      return reply.status(500).send({ error: 'Erro interno' })
    }
  }

  async requestContactChange(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'CLIENT') {
      return reply.status(403).send({ error: 'Acesso negado' })
    }
    const userId = request.user.id
    let body: ReturnType<typeof ContactChangeRequestSchema.parse>
    try {
      body = ContactChangeRequestSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Corpo inválido' })
    }
    try {
      const result = await this.service.requestContactChange(userId, body)
      if ('error' in result) return reply.status(result.status ?? 500).send({ error: result.error })
      return reply.status(204).send()
    } catch (err) {
      return reply.status(500).send({ error: 'Erro interno' })
    }
  }

  async getOnboarding(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'CLIENT') {
      return reply.status(403).send({ error: 'Acesso negado' })
    }
    try {
      const result = await this.service.getOnboardingStatus(request.user.id)
      if ('error' in result) return reply.status(result.status ?? 500).send({ error: result.error })
      return reply.status(200).send(result)
    } catch (err) {
      return reply.status(500).send({ error: 'Erro interno' })
    }
  }

  async completeOnboarding(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'CLIENT') {
      return reply.status(403).send({ error: 'Acesso negado' })
    }
    try {
      const result = await this.service.completeOnboarding(request.user.id)
      if ('error' in result) return reply.status(result.status ?? 500).send({ error: result.error })
      return reply.status(200).send(result)
    } catch (err) {
      return reply.status(500).send({ error: 'Erro interno' })
    }
  }

  async confirmContactChange(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'CLIENT') {
      return reply.status(403).send({ error: 'Acesso negado' })
    }
    const userId = request.user.id
    let body: ReturnType<typeof ContactChangeConfirmSchema.parse>
    try {
      body = ContactChangeConfirmSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
      return reply.status(400).send({ error: 'Corpo inválido' })
    }
    try {
      const result = await this.service.confirmContactChange(userId, body)
      if ('error' in result) return reply.status(result.status).send({ error: result.error })
      return reply.status(200).send(result)
    } catch (err) {
      return reply.status(500).send({ error: 'Erro interno' })
    }
  }
}
