import fp from 'fastify-plugin'
import { FastifyPluginAsync, preHandlerHookHandler } from 'fastify'
import { createHash } from 'node:crypto'

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; role: string; name: string } | null
  }
  interface FastifyInstance {
    authenticate: preHandlerHookHandler
    requireCourier: preHandlerHookHandler
  }
}

const authenticatePlugin: FastifyPluginAsync = fp(async (fastify) => {
  // Sets request.user = null on every request by default.
  // Public routes always have request.user available (as null) without any conditional logic.
  fastify.decorateRequest('user', null)

  // authenticate preHandler: ONLY invoked on routes that explicitly register it.
  // NO addHook('onRequest', ...) — that would break public routes by returning 401 globally.
  const authenticate: preHandlerHookHandler = async (request, reply) => {
    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      fastify.log.warn({ url: request.url, method: request.method }, '[auth] 401 — sem Authorization header')
      return reply.status(401).send({ error: 'Não autorizado' })
    }

    const rawToken = authHeader.slice(7)
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')
    const deviceId = request.headers['x-device-id'] as string | undefined

    const session = await fastify.prisma.session.findFirst({
      where: {
        token: tokenHash,
        isRevoked: false,
        expiresAt: { gt: new Date() }, // filtra no banco, evita I/O desnecessário e clock skew
      },
    })

    if (!session) {
      fastify.log.warn(
        { url: request.url, method: request.method, tokenHashPrefix: tokenHash.slice(0, 8) },
        '[auth] 401 — sessão não encontrada (expirada, revogada ou token inválido)',
      )
      return reply.status(401).send({ error: 'Sessão expirada ou inválida' })
    }

    // Pitfall 3 / D-08: device mismatch detection — revoke session if X-Device-Id differs
    if (deviceId && session.deviceId !== deviceId) {
      fastify.log.warn(
        {
          url: request.url,
          method: request.method,
          sessionDeviceId: session.deviceId,
          requestDeviceId: deviceId,
        },
        '[auth] 401 — device mismatch, sessão revogada',
      )
      await fastify.prisma.session.update({
        where: { id: session.id },
        data: { isRevoked: true },
      })
      return reply.status(401).send({ error: 'Dispositivo alterado — faça login novamente' })
    }

    // Update last activity timestamp
    await fastify.prisma.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    })

    // Fetch user info to populate request.user
    const user = await fastify.prisma.user.findFirst({
      where: { id: session.userId },
      select: { id: true, role: true, name: true },
    })

    if (!user) {
      return reply.status(401).send({ error: 'Usuário não encontrado' })
    }

    request.user = { id: user.id, role: user.role, name: user.name }
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
