import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import env from '@fastify/env'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import prismaPlugin from './plugins/prisma.js'
import authenticatePlugin from './plugins/authenticate.js'
import { healthRoute } from './modules/health/health.route.js'
import { authRoute } from './modules/auth/auth.route.js'
import { condominiumsRoute } from './modules/condominiums/condominiums.route.js'
import { paymentsRoute } from './modules/payments/payments.route.js'
import { creditsRoute } from './modules/credits/credits.route.js'
import { webhooksRoute } from './modules/webhooks/webhooks.route.js'
import { schedulesRoute } from './modules/schedules/schedules.route.js'
import { ordersRoute } from './modules/orders/orders.route.js'
import { notificationsRoute } from './modules/notifications/notifications.route.js'
import { adminOrdersRoute } from './modules/admin-orders/admin-orders.route.js'
import { adminSettingsRoute } from './modules/admin-settings/admin-settings.route.js'
import { adminCondominiumsRoute } from './modules/admin-condominiums/admin-condominiums.route.js'
import { adminCombosRoute } from './modules/admin-combos/admin-combos.route.js'
import { adminSuppliersRoute } from './modules/admin-suppliers/admin-suppliers.route.js'
import { adminCouriersRoute } from './modules/admin-couriers/admin-couriers.route.js'
import { adminClientsRoute } from './modules/admin-clients/admin-clients.route.js'
import { adminSupplierOrdersRoute } from './modules/admin-supplier-orders/admin-supplier-orders.route.js'
import { adminFinancialRoute } from './modules/admin-financial/admin-financial.route.js'
import { adminPaymentsRoute } from './modules/admin-payments/admin-payments.route.js'
import { courierRoute } from './modules/courier/courier.route.js'
import cronPlugin from './plugins/cron.js'
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
    // Phase 4 additions — OneSignal push notifications
    ONESIGNAL_APP_ID: { type: 'string' },
    ONESIGNAL_REST_API_KEY: { type: 'string' },
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

    // OpenAPI / Swagger — registrar ANTES das rotas
    await fastify.register(swagger, {
      openapi: {
        openapi: '3.0.3',
        info: {
          title: 'Cheirin de Pão — API',
          description: [
            'API REST do PWA Cheirin de Pão.',
            '',
            '## Autenticação',
            'A maioria das rotas exige um **Bearer JWT** no header `Authorization`.',
            'Obtenha o token via `POST /auth/otp/verify`.',
            '',
            '## Roles',
            '- **CLIENT** — cliente que compra e agenda pãezinhos',
            '- **COURIER** — entregador que confirma entregas',
            '- **ADMIN** — operador com acesso total',
            '',
            '## Rate Limit',
            'Global: 200 req/min · Endpoints OTP: 5 req/min por IP',
          ].join('\n'),
          version: '1.0.0',
        },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
              description: 'Token JWT obtido via POST /auth/otp/verify',
            },
          },
        },
        tags: [
          { name: 'health', description: 'Status da API' },
          { name: 'auth', description: 'Autenticação e cadastro' },
          { name: 'condominiums', description: 'Condomínios disponíveis' },
          { name: 'payments', description: 'Pagamentos Pix e cartão (Mercado Pago)' },
          { name: 'credits', description: 'Saldo e histórico de créditos' },
          { name: 'webhooks', description: 'Webhooks externos (Mercado Pago)' },
          { name: 'schedules', description: 'Agenda semanal recorrente' },
          { name: 'orders', description: 'Pedidos avulsos e rastreamento' },
          { name: 'notifications', description: 'Notificações push e in-app' },
          { name: 'settings', description: 'Configurações públicas (cutoff)' },
          { name: 'courier', description: 'App do entregador' },
          { name: 'admin — dashboard', description: 'Painel admin: KPIs e operação' },
          { name: 'admin — settings', description: 'Configurações operacionais (cutoff, avulso)' },
          { name: 'admin — condominiums', description: 'CRUD de condomínios' },
          { name: 'admin — combos', description: 'CRUD de combos e promoções' },
          { name: 'admin — suppliers', description: 'CRUD de fornecedores' },
          { name: 'admin — couriers', description: 'Gestão de entregadores' },
          { name: 'admin — clients', description: 'Gestão de clientes' },
          { name: 'admin — supplier-orders', description: 'Pedido ao fornecedor, PDF e Excel' },
          { name: 'admin — financial', description: 'Relatório financeiro por período' },
          { name: 'admin — payments', description: 'Lista de pagamentos e estornos' },
        ],
      },
    })

    await fastify.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: { docExpansion: 'list', deepLinking: true },
      staticCSP: true,
    })

    // Rate-limit global — 200 req/min para uso normal da app
    // OTP endpoints têm limite próprio mais restritivo definido em auth.route.ts
    await fastify.register(rateLimit, { max: 200, timeWindow: '1 minute' })

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

    // Phase 4 — Scheduling
    await fastify.register(schedulesRoute)
    await fastify.register(ordersRoute)         // POST /orders — pedido avulso (SCHED-01)
    await fastify.register(notificationsRoute)  // POST /users/push-token (D-09)
    await fastify.register(adminOrdersRoute)    // PATCH /admin/orders/:id/status (ACOMP-01) + GET /admin/dashboard (07-06)
    await fastify.register(adminSettingsRoute)       // Phase 7 — GET/PATCH /admin/settings/cutoff + /avulso (07-02)
    await fastify.register(adminCondominiumsRoute)   // Phase 7 — CRUD /admin/condominiums (07-02)
    await fastify.register(adminCombosRoute)         // Phase 7 — CRUD /admin/combos + /promotion (07-02)
    await fastify.register(adminSuppliersRoute)      // Phase 7 — CRUD /admin/suppliers (07-03)
    await fastify.register(adminCouriersRoute)       // Phase 7 — CRUD /admin/couriers (07-03)
    await fastify.register(adminClientsRoute)        // Phase 7 — GET /admin/clients (07-03)
    await fastify.register(adminSupplierOrdersRoute)  // Phase 7 — GET/POST /admin/supplier-orders + PDF/Excel (ADMO-05..09)
    await fastify.register(adminFinancialRoute) // GET /admin/financial (ADMF-01..04)
    await fastify.register(adminPaymentsRoute)  // GET/POST /admin/payments (PAY-03/04)
    await fastify.register(courierRoute)        // GET /courier/orders/today + PATCH /courier/orders/:id/confirm (COUR-01/02)
    await fastify.register(cronPlugin)          // cron jobs: meia-noite + domingo 20h + 21h (SCHED-03/04)

    const port = Number(process.env.API_PORT ?? 3001)
    const host = process.env.API_HOST ?? '0.0.0.0'

    await fastify.listen({ port, host })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
