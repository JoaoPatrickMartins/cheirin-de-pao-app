import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError, type ZodType } from 'zod'
import type { SocialProviderSlug } from '@cheirin-de-pao/shared'
import {
  SocialStartSchema,
  SocialConnectSchema,
  SocialClaimSchema,
  SocialLinkCodeSchema,
  SocialLinkCodeVerifySchema,
  SocialLinkPasswordSchema,
  SocialCompleteSchema,
  SocialProviderSchema,
} from './social-auth.schema.js'
import { SocialAuthService, type ClaimResult, type HttpError, type LinkFieldError } from './social-auth.service.js'
import { readSocialConfig } from './social-auth.config.js'

// Mensagens dos erros de campo do vínculo (L6) — o app mostra no próprio campo.
const FIELD_ERROR: Record<LinkFieldError['fieldError'], { status: number; message: string }> = {
  code_wrong: { status: 401, message: 'Código não confere.' },
  code_expired: { status: 401, message: 'Código expirado. Peça um novo.' },
  no_code: { status: 400, message: 'Peça o código primeiro.' },
  password_wrong: { status: 401, message: 'Senha incorreta.' },
  too_many: { status: 429, message: 'Muitas tentativas por agora. Comece de novo.' },
}

type ParseResult<T> = { ok: true; data: T } | { ok: false }

export class SocialAuthController {
  private service: SocialAuthService

  constructor(private fastify: FastifyInstance) {
    this.service = new SocialAuthService(fastify)
  }

  private parse<T>(schema: ZodType<T>, value: unknown, reply: FastifyReply): ParseResult<T> {
    try {
      return { ok: true, data: schema.parse(value) }
    } catch (err) {
      const message =
        err instanceof ZodError ? err.issues.map((i) => i.message).join(', ') : 'Dados inválidos.'
      void reply.status(400).send({ error: message })
      return { ok: false }
    }
  }

  // `:provider` fora da lista (hoje só `google`) → 404, como uma rota que não existe.
  private providerParam(request: FastifyRequest, reply: FastifyReply): SocialProviderSlug | null {
    const parsed = SocialProviderSchema.safeParse((request.params as { provider?: string }).provider)
    if (!parsed.success) {
      void reply.status(404).send({ error: 'Provedor não suportado' })
      return null
    }
    return parsed.data
  }

  private sendResult(
    reply: FastifyReply,
    result:
      | ClaimResult
      | LinkFieldError
      | HttpError
      | { ok: true; maskedEmail: string }
      | { flowId: string; secret: string; authUrl: string },
  ) {
    if ('fieldError' in result) {
      const { status, message } = FIELD_ERROR[result.fieldError]
      return reply.status(status).send({ error: message, reason: result.fieldError, attemptsLeft: result.attemptsLeft })
    }
    if ('error' in result) return reply.status(result.status).send({ error: result.error })
    return reply.status(200).send(result)
  }

  private fail(reply: FastifyReply, err: unknown) {
    this.fastify.log.error(err)
    return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
  }

  async providers(_request: FastifyRequest, reply: FastifyReply) {
    return reply.status(200).send(this.service.providers())
  }

  async start(request: FastifyRequest, reply: FastifyReply) {
    const slug = this.providerParam(request, reply)
    if (!slug) return reply
    const body = this.parse(SocialStartSchema, request.body, reply)
    if (!body.ok) return reply
    // Conectar a quem está logado tem rota própria (autenticada): aqui é só entrar/cadastrar.
    if (body.data.intent !== 'login') return reply.status(400).send({ error: 'Use /connect para conectar pelo Perfil.' })
    try {
      return this.sendResult(reply, await this.service.start(slug, 'login', body.data.deviceId))
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  async connect(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'CLIENT') return reply.status(403).send({ error: 'Acesso negado' })
    const slug = this.providerParam(request, reply)
    if (!slug) return reply
    const body = this.parse(SocialConnectSchema, request.body, reply)
    if (!body.ok) return reply
    try {
      return this.sendResult(reply, await this.service.start(slug, 'link', body.data.deviceId, request.user.id))
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  async callback(request: FastifyRequest, reply: FastifyReply) {
    const slug = this.providerParam(request, reply)
    if (!slug) return reply
    const query = request.query as { code?: string; state?: string; error?: string }
    let target: string
    try {
      target = await this.service.handleCallback(slug, {
        code: typeof query.code === 'string' ? query.code : undefined,
        state: typeof query.state === 'string' ? query.state : undefined,
        error: typeof query.error === 'string' ? query.error : undefined,
      })
    } catch (err) {
      this.fastify.log.error(err)
      // Sempre devolve o navegador ao app — nunca uma página de erro da API.
      target = `${readSocialConfig().appBaseUrl}/?social_error=provider_error`
    }
    // A URL do callback carrega o `code` do Google: não guardar em cache nem vazar no Referer.
    return reply.header('Cache-Control', 'no-store').header('Referrer-Policy', 'no-referrer').redirect(target, 302)
  }

  async claim(request: FastifyRequest, reply: FastifyReply) {
    const body = this.parse(SocialClaimSchema, request.body, reply)
    if (!body.ok) return reply
    try {
      return this.sendResult(reply, await this.service.claim(body.data.flowId, body.data.secret, body.data.deviceId))
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  async sendLinkCode(request: FastifyRequest, reply: FastifyReply) {
    const body = this.parse(SocialLinkCodeSchema, request.body, reply)
    if (!body.ok) return reply
    try {
      return this.sendResult(reply, await this.service.sendLinkCode(body.data.flowId, body.data.secret))
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  async verifyLinkCode(request: FastifyRequest, reply: FastifyReply) {
    const body = this.parse(SocialLinkCodeVerifySchema, request.body, reply)
    if (!body.ok) return reply
    const { flowId, secret, deviceId, code } = body.data
    try {
      return this.sendResult(reply, await this.service.verifyLinkCode(flowId, secret, deviceId, code))
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  async linkWithPassword(request: FastifyRequest, reply: FastifyReply) {
    const body = this.parse(SocialLinkPasswordSchema, request.body, reply)
    if (!body.ok) return reply
    const { flowId, secret, deviceId, password } = body.data
    try {
      return this.sendResult(reply, await this.service.linkWithPassword(flowId, secret, deviceId, password))
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  async complete(request: FastifyRequest, reply: FastifyReply) {
    const body = this.parse(SocialCompleteSchema, request.body, reply)
    if (!body.ok) return reply
    try {
      return this.sendResult(reply, await this.service.complete(body.data))
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  async accounts(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'CLIENT') return reply.status(403).send({ error: 'Acesso negado' })
    try {
      return reply.status(200).send(await this.service.listAccounts(request.user.id))
    } catch (err) {
      return this.fail(reply, err)
    }
  }

  async disconnect(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'CLIENT') return reply.status(403).send({ error: 'Acesso negado' })
    const slug = this.providerParam(request, reply)
    if (!slug) return reply
    try {
      await this.service.disconnect(request.user.id, slug)
      return reply.status(200).send({ ok: true })
    } catch (err) {
      return this.fail(reply, err)
    }
  }
}
