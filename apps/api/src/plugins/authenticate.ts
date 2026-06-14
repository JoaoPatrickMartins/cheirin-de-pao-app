import fp from 'fastify-plugin'
import { FastifyPluginAsync, preHandlerHookHandler } from 'fastify'
import { createHash } from 'node:crypto'

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; role: string; name: string } | null
  }
  interface FastifyInstance {
    authenticate: preHandlerHookHandler
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
      return reply.status(401).send({ error: 'Não autorizado' })
    }

    const rawToken = authHeader.slice(7)
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')
    const deviceId = request.headers['x-device-id'] as string | undefined

    const session = await fastify.prisma.session.findFirst({
      where: { token: tokenHash, isRevoked: false },
    })

    if (!session || session.expiresAt < new Date()) {
      return reply.status(401).send({ error: 'Sessão expirada ou inválida' })
    }

    // Pitfall 3 / D-08: device mismatch detection — revoke session if X-Device-Id differs
    if (deviceId && session.deviceId !== deviceId) {
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
})

export default authenticatePlugin
