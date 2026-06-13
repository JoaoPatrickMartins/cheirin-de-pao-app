import Fastify from 'fastify'
import cors from '@fastify/cors'
import env from '@fastify/env'
import prismaPlugin from './plugins/prisma'
import { healthRoute } from './modules/health/health.route'

const fastify = Fastify({ logger: true })

// Environment variable validation schema (registered FIRST before other plugins)
const envSchema = {
  type: 'object',
  required: ['DATABASE_URL'],
  properties: {
    DATABASE_URL: { type: 'string' },
    API_PORT: { type: 'integer', default: 3001 },
    API_HOST: { type: 'string', default: '0.0.0.0' },
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

    // CORS — restrict to Vite dev server in development; never allow '*'
    await fastify.register(cors, {
      origin:
        process.env.NODE_ENV === 'production'
          ? false
          : 'http://localhost:5173',
    })

    // Prisma plugin — connects to MongoDB Atlas and decorates fastify with .prisma
    await fastify.register(prismaPlugin)

    // Health route — GET /health returns {ok:true, db:'connected'} on success
    await fastify.register(healthRoute)

    const port = Number(process.env.API_PORT ?? 3001)
    const host = process.env.API_HOST ?? '0.0.0.0'

    await fastify.listen({ port, host })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
