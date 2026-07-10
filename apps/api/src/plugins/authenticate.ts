import fp from 'fastify-plugin'
import { FastifyPluginAsync, preHandlerHookHandler } from 'fastify'

// Dados que o app precisa a cada request — populados a partir dos claims do JWT.
type AuthUser = { id: string; role: string; name: string }

// Claims do access token JWT.
interface AccessTokenPayload {
  sub: string // userId
  role: string
  name: string
  sid: string // id da Session (refresh) associada — usado no logout
  deviceId: string
  iat?: number
  exp?: number
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null
    // id da Session (refresh) do token atual — usado por /auth/logout
    sessionId: string | null
  }
  interface FastifyInstance {
    authenticate: preHandlerHookHandler
    requireCourier: preHandlerHookHandler
  }
}

// Alinha o tipo de request.user do @fastify/jwt ao nosso (evita conflito de augmentation).
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload
    user: AuthUser | null
  }
}

const authenticatePlugin: FastifyPluginAsync = fp(async (fastify) => {
  // request.user já é decorado pelo @fastify/jwt (default null) — não redecorar aqui.
  // Rotas públicas continuam com request.user === null disponível.
  fastify.decorateRequest('sessionId', null)

  // authenticate preHandler: SÓ roda nas rotas que o registram explicitamente.
  // Opção A (stateless): valida o access token por ASSINATURA, sem I/O no banco.
  // A revogação de sessão acontece no login/refresh (o access expira em 15 min).
  const authenticate: preHandlerHookHandler = async (request, reply) => {
    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      fastify.log.warn({ url: request.url, method: request.method }, '[auth] 401 — sem Authorization header')
      return reply.status(401).send({ error: 'Não autorizado' })
    }

    const rawToken = authHeader.slice(7)
    let payload: AccessTokenPayload
    try {
      payload = fastify.jwt.verify<AccessTokenPayload>(rawToken)
    } catch {
      fastify.log.warn(
        { url: request.url, method: request.method },
        '[auth] 401 — token inválido ou expirado',
      )
      return reply.status(401).send({ error: 'Sessão expirada ou inválida' })
    }

    // Detecção de troca de dispositivo — instantânea, sem banco (deviceId vem no claim).
    const deviceId = request.headers['x-device-id'] as string | undefined
    if (deviceId && payload.deviceId !== deviceId) {
      fastify.log.warn(
        {
          url: request.url,
          method: request.method,
          tokenDeviceId: payload.deviceId,
          requestDeviceId: deviceId,
        },
        '[auth] 401 — device mismatch',
      )
      return reply.status(401).send({ error: 'Dispositivo alterado — faça login novamente' })
    }

    request.user = { id: payload.sub, role: payload.role, name: payload.name }
    request.sessionId = payload.sid
  }

  fastify.decorate('authenticate', authenticate)

  // requireCourier preHandler — D-14: guard para rotas /courier/*
  // Deve ser usado APÓS fastify.authenticate (que popula request.user)
  const requireCourier: preHandlerHookHandler = async (request, reply) => {
    if (request.user?.role !== 'COURIER') {
      return reply.status(403).send({ error: 'Acesso negado: apenas entregadores' })
    }
  }

  fastify.decorate('requireCourier', requireCourier)
})

export default authenticatePlugin
