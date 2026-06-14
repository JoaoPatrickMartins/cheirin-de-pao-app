import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import env from '@fastify/env'
import prismaPlugin from './plugins/prisma.js'
import authenticatePlugin from './plugins/authenticate.js'
import { healthRoute } from './modules/health/health.route.js'
import { authRoute } from './modules/auth/auth.route.js'
import { condominiumsRoute } from './modules/condominiums/condominiums.route.js'
import { paymentsRoute } from './modules/payments/payments.route.js'
import { creditsRoute } from './modules/credits/credits.route.js'
import { webhooksRoute } from './modules/webhooks/webhooks.route.js'
import { seedAdminIfAbsent } from './bootstrap/admin-seed.js'

const fastify = Fastify({ logger: true })

// Environment variable validation schema (registered FIRST before other plugins)
const envSchema = {
  type: 'object',
  required: ['DATABASE_URL', 'MP_ACCESS_TOKEN', 'MP_WEBHOOK_SECRET', 'MP_PUBLIC_KEY'],
  properties: {
    DATABASE_URL: { type: 'string' },
    MP_ACCESS_TOKEN: { type: 'string' },
    MP_WEBHOOK_SECRET: { type: 'string' },
    MP_PUBLIC_KEY: { type: 'string' },
    API_PORT: { type: 'integer', default: 3001 },
    API_HOST: { type: 'string', default: '0.0.0.0' },
    // Phase 2 additions:
    NODE_ENV: { type: 'string', default: 'development' },
    OTP_DEV_CODE: { type: 'string', default: '1234' },
    ZENVIA_TOKEN: { type: 'string' },
    ZENVIA_FROM: { type: 'string' },
    RESEND_API_KEY: { type: 'string' },
    RESEND_FROM: { type: 'string' },
    ADMIN_NAME: { type: 'string' },
    ADMIN_PHONE: { type: 'string' },
    ADMIN_EMAIL: { type: 'string' },
    ADMIN_CPF: { type: 'string' },
    CORS_ORIGIN: { type: 'string' },
  },
}

// INFO: Copy .env.example to apps/api/.env (or root .env) and fill DATABASE_URL before starting
const start = async () => {
  try {
    // Register @fastify/env FIRST — validates environment before any plugin connects
    await fastify.register(env, {
      schema: envSchema,
      dotenv: true,
    })

    // CORS — usa CORS_ORIGIN em produção; fallback para Vite dev server
    // Em produção: CORS_ORIGIN=https://app.cheirindepao.com.br
    await fastify.register(cors, {
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    })

    // Rate-limit global — protege endpoints OTP contra brute force
    // 5 requisições por minuto por IP (proteção mínima; ajustar por rota se necessário)
    await fastify.register(rateLimit, { max: 5, timeWindow: '1 minute' })

    // Prisma plugin — connects to MongoDB Atlas and decorates fastify with .prisma
    await fastify.register(prismaPlugin)

    // Bootstrap — seed admin user from env vars if no ADMIN role exists
    await seedAdminIfAbsent(fastify.prisma)

    // Authenticate plugin — decorateRequest('user') + fastify.authenticate preHandler decorator
    // IMPORTANT: registered AFTER prismaPlugin (needs fastify.prisma) and BEFORE routes
    await fastify.register(authenticatePlugin)

    // Health route — GET /health returns {ok:true, db:'connected'} on success
    await fastify.register(healthRoute)

    // Auth routes — POST /auth/register, /auth/otp/send, /auth/otp/verify, /auth/couriers
    await fastify.register(authRoute)

    // Condominiums route — GET /condominiums (public, no auth required)
    await fastify.register(condominiumsRoute)

    // Phase 3 — Credits & Commerce
    await fastify.register(paymentsRoute)
    await fastify.register(creditsRoute)
    await fastify.register(webhooksRoute)

    const port = Number(process.env.API_PORT ?? 3001)
    const host = process.env.API_HOST ?? '0.0.0.0'

    await fastify.listen({ port, host })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
