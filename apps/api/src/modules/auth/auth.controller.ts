import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import {
  RegisterSchema,
  SendOtpSchema,
  VerifyOtpSchema,
  RegisterCourierSchema,
} from './auth.schema.js'
import { AuthService } from './auth.service.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

export class AuthController {
  private service: AuthService

  constructor(private fastify: FastifyInstance) {
    this.service = new AuthService(fastify)
  }

  async register(request: FastifyRequest, reply: FastifyReply) {
    let body: ReturnType<typeof RegisterSchema.parse>
    try {
      body = RegisterSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    try {
      const result = await this.service.register(body)
      if ('error' in result) {
        return reply.status(result.status).send({ error: result.error })
      }
      return reply.status(201).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async sendOtp(request: FastifyRequest, reply: FastifyReply) {
    let body: ReturnType<typeof SendOtpSchema.parse>
    try {
      body = SendOtpSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    try {
      const { email } = body
      // Resolve userId pelo e-mail (acesso apenas por e-mail neste momento)
      const user = await this.fastify.prisma.user.findFirst({ where: { email } })

      if (!user) {
        return reply.status(404).send({ error: 'Usuário não encontrado' })
      }

      await this.service.sendOtp(user.id, email)
      return reply.status(200).send({ ok: true, userId: user.id })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async verifyOtp(request: FastifyRequest, reply: FastifyReply) {
    let body: ReturnType<typeof VerifyOtpSchema.parse>
    try {
      body = VerifyOtpSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    try {
      const { userId, code, deviceId } = body
      const result = await this.service.verifyOtpAndCreateSession(userId, code, deviceId)
      if ('error' in result) {
        return reply.status(result.status).send({ error: result.error })
      }

      // Fetch user info to return with token
      const user = await this.fastify.prisma.user.findFirst({
        where: { id: userId },
        select: { id: true, role: true, name: true },
      })

      if (!user) {
        return reply.status(404).send({ error: 'Usuário não encontrado' })
      }

      return reply.status(200).send({
        token: result.rawToken,
        user: { id: user.id, role: user.role, name: user.name },
      })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async registerCourier(request: FastifyRequest, reply: FastifyReply) {
    // Role check — only ADMIN can register couriers (T-02-04)
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    let body: ReturnType<typeof RegisterCourierSchema.parse>
    try {
      body = RegisterCourierSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    try {
      const result = await this.service.registerCourier(body)
      if ('error' in result) {
        return reply.status(result.status).send({ error: result.error })
      }
      return reply.status(201).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
