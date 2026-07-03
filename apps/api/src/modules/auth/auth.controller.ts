import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import {
  RegisterSchema,
  SendOtpSchema,
  VerifyOtpSchema,
  RegisterCourierSchema,
  RefreshSchema,
  LoginSchema,
  SetPasswordSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
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

      return reply.status(200).send({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        hasPassword: result.hasPassword,
        user: result.user,
      })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    let body: ReturnType<typeof LoginSchema.parse>
    try {
      body = LoginSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    try {
      const result = await this.service.loginWithPassword(body.email, body.password, body.deviceId)
      if ('error' in result) {
        return reply.status(result.status).send({ error: result.error })
      }
      return reply.status(200).send({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        hasPassword: result.hasPassword,
        user: result.user,
      })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    let body: ReturnType<typeof RefreshSchema.parse>
    try {
      body = RefreshSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    try {
      const result = await this.service.refreshSession(body.refreshToken, body.deviceId)
      if ('error' in result) {
        return reply.status(result.status).send({ error: result.error })
      }
      return reply.status(200).send({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        hasPassword: result.hasPassword,
        user: result.user,
      })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    try {
      // sessionId é populado pelo authenticate a partir do claim sid do JWT.
      if (request.sessionId) {
        await this.service.logout(request.sessionId)
      }
      return reply.status(200).send({ ok: true })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  // Define a senha no 1º acesso (autenticado). Só permitido quando ainda não há senha.
  async setPassword(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send({ error: 'Não autorizado' })
    }
    let body: ReturnType<typeof SetPasswordSchema.parse>
    try {
      body = SetPasswordSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    try {
      const result = await this.service.setPassword(request.user.id, body.password)
      if ('error' in result) {
        return reply.status(result.status).send({ error: result.error })
      }
      return reply.status(200).send({ ok: true })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  // Recuperação de senha via OTP (público) → confirma código e define nova senha, emite tokens.
  async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    let body: ReturnType<typeof ResetPasswordSchema.parse>
    try {
      body = ResetPasswordSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    try {
      const result = await this.service.resetPasswordWithOtp(
        body.userId,
        body.code,
        body.deviceId,
        body.newPassword,
      )
      if ('error' in result) {
        return reply.status(result.status).send({ error: result.error })
      }
      return reply.status(200).send({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        hasPassword: result.hasPassword,
        user: result.user,
      })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  // Troca de senha logado (autenticado) — exige a senha atual.
  async changePassword(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send({ error: 'Não autorizado' })
    }
    let body: ReturnType<typeof ChangePasswordSchema.parse>
    try {
      body = ChangePasswordSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }
    try {
      const result = await this.service.changePassword(
        request.user.id,
        body.currentPassword,
        body.newPassword,
      )
      if ('error' in result) {
        return reply.status(result.status).send({ error: result.error })
      }
      return reply.status(200).send({ ok: true })
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
