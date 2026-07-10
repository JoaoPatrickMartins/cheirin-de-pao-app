# Phase 5: Delivery Experience - Pattern Map

**Mapeado:** 2026-06-15
**Arquivos analisados:** 12 arquivos novos/modificados
**Analógicos encontrados:** 12 / 12

---

## File Classification

| Arquivo novo/modificado | Role | Data Flow | Analógico mais próximo | Qualidade |
|-------------------------|------|-----------|------------------------|-----------|
| `apps/api/src/modules/admin-orders/admin-orders.service.ts` | service | CRUD + event-driven | `apps/api/src/modules/schedules/schedules.service.ts` | role-match |
| `apps/api/src/modules/admin-orders/admin-orders.schema.ts` | schema | transform | `apps/api/src/modules/orders/orders.schema.ts` | exact |
| `apps/api/src/modules/admin-orders/admin-orders.controller.ts` | controller | request-response | `apps/api/src/modules/auth/auth.controller.ts` | exact |
| `apps/api/src/modules/admin-orders/admin-orders.route.ts` | route | request-response | `apps/api/src/modules/orders/orders.route.ts` | exact |
| `apps/api/src/modules/orders/orders.service.ts` (estender) | service | CRUD | `apps/api/src/modules/orders/orders.service.ts` | self |
| `apps/api/src/modules/orders/orders.repository.ts` (estender) | repository | CRUD | `apps/api/src/modules/orders/orders.repository.ts` | self |
| `apps/api/src/modules/notifications/notifications.service.ts` (estender) | service | CRUD | `apps/api/src/modules/notifications/notifications.service.ts` | self |
| `apps/api/src/modules/notifications/notifications.controller.ts` (estender) | controller | request-response | `apps/api/src/modules/notifications/notifications.controller.ts` | self |
| `apps/api/src/modules/notifications/notifications.route.ts` (estender) | route | request-response | `apps/api/src/modules/notifications/notifications.route.ts` | self |
| `apps/api/src/plugins/cron.ts` (estender) | plugin | event-driven | `apps/api/src/plugins/cron.ts` | self |
| `apps/web/src/hooks/useOrderTracking.ts` | hook | request-response (polling) | `apps/web/src/hooks/usePaymentPolling.ts` | exact |
| `apps/web/src/pages/client/TrackingScreen.tsx` | component | request-response | `apps/web/src/pages/client/CreditHistoryScreen.tsx` | role-match |
| `apps/web/src/pages/client/NotificationsScreen.tsx` | component | request-response | `apps/web/src/pages/client/CreditHistoryScreen.tsx` | role-match |
| `apps/web/src/pages/client/HomeScreen.tsx` (modificar) | component | request-response | `apps/web/src/pages/client/HomeScreen.tsx` | self |
| `apps/web/src/routes/router.tsx` (modificar) | config | — | `apps/web/src/routes/router.tsx` | self |

---

## Pattern Assignments

### `apps/web/src/hooks/useOrderTracking.ts` (hook, polling)

**Analógico:** `apps/web/src/hooks/usePaymentPolling.ts`

**Imports pattern** (linhas 1-2):
```typescript
import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/apiFetch'
```

**Core polling pattern** (linhas 12-36):
```typescript
// DIFERENÇA CHAVE vs usePaymentPolling:
// 1. Sem MAX_ATTEMPTS — poll infinito enquanto montado
// 2. Intervalo 30_000ms (não 3_000ms)
// 3. Fetch imediato na montagem (não espera o primeiro intervalo)
// 4. 404 é tratado como "sem pedido hoje" (setOrder(null)), não como erro

useEffect(() => {
  if (!paymentId || attempts >= MAX_ATTEMPTS) return  // ← REMOVER esta lógica

  const id = setInterval(async () => {
    try {
      const res = await apiFetch(`/payments/${paymentId}/status`)
      const data = (await res.json()) as { status: string; creditBalance?: number }
      if (data.status === 'approved') {
        clearInterval(id)
        onApproved(data.creditBalance ?? 0)
      } else if (data.status === 'rejected') {
        clearInterval(id)
        onRejected?.()
      } else {
        setAttempts((a) => a + 1)
      }
    } catch {
      setAttempts((a) => a + 1)
    }
  }, 3000)

  return () => clearInterval(id)   // ← MANTER obrigatoriamente
}, [paymentId, attempts])
```

**Adaptação para useOrderTracking:**
```typescript
// Fetch imediato + poll a 30s + cleanup obrigatório
useEffect(() => {
  const fetchOrder = async () => {
    try {
      const res = await apiFetch('/orders/today')
      if (res.ok) {
        const data = (await res.json()) as TodayOrder | null
        setOrder(data)
      } else if (res.status === 404) {
        setOrder(null)
      }
    } catch {
      // falha de rede — mantém estado anterior
    } finally {
      setIsLoading(false)
    }
  }
  fetchOrder()                              // fetch imediato na montagem
  const id = setInterval(fetchOrder, 30_000)
  return () => clearInterval(id)            // cleanup obrigatório
}, [])
```

---

### `apps/api/src/modules/admin-orders/admin-orders.controller.ts` (controller, request-response)

**Analógico:** `apps/api/src/modules/auth/auth.controller.ts`

**Imports pattern** (linhas 1-4):
```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { UpdateOrderStatusSchema } from './admin-orders.schema.js'
import { AdminOrdersService } from './admin-orders.service.js'
```

**Estrutura da classe** (linhas 17-22):
```typescript
export class AdminOrdersController {
  private service: AdminOrdersService

  constructor(private fastify: FastifyInstance) {
    this.service = new AdminOrdersService(fastify)
  }
```

**Admin role check inline** (linhas 114-118 de auth.controller.ts):
```typescript
// Padrão estabelecido — reproduzir ANTES da validação Zod no controller
if (request.user?.role !== 'ADMIN') {
  return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
}
```

**Core handler pattern** (linhas 24-52 de orders.controller.ts):
```typescript
// Padrão: validação Zod → extrair userId/params do JWT/route → chamar service → tratar erros
async updateOrderStatus(request: FastifyRequest, reply: FastifyReply) {
  // 1. Role check inline
  if (request.user?.role !== 'ADMIN') {
    return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
  }

  // 2. Validação Zod do body
  let body: ReturnType<typeof UpdateOrderStatusSchema.parse>
  try {
    body = UpdateOrderStatusSchema.parse(request.body)
  } catch (err) {
    if (err instanceof ZodError) {
      return reply.status(400).send({ error: zodMessage(err) })
    }
    return reply.status(400).send({ error: 'Dados inválidos.' })
  }

  // 3. Params da rota
  const { id: orderId } = request.params as { id: string }

  // 4. Chamar service
  try {
    await this.service.updateOrderStatus(orderId, body.status)
    return reply.status(200).send({ ok: true })
  } catch (err) {
    this.fastify.log.error(err)
    const e = err as { statusCode?: number; message?: string }
    if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
    if (e.statusCode === 422) return reply.status(422).send({ error: e.message })
    return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
  }
}
```

**Helper zodMessage** (linhas 7-9):
```typescript
type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}
```

---

### `apps/api/src/modules/admin-orders/admin-orders.route.ts` (route, request-response)

**Analógico:** `apps/api/src/modules/orders/orders.route.ts`

**Imports e estrutura completa** (linhas 1-18):
```typescript
import { FastifyPluginAsync } from 'fastify'
import { AdminOrdersController } from './admin-orders.controller.js'

export const adminOrdersRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminOrdersController(fastify)

  fastify.patch(
    '/admin/orders/:id/status',
    { preHandler: [fastify.authenticate] },  // role check fica no controller
    ctrl.updateOrderStatus.bind(ctrl),
  )
}
```

---

### `apps/api/src/modules/admin-orders/admin-orders.schema.ts` (schema, transform)

**Analógico:** `apps/api/src/modules/orders/orders.schema.ts`

**Padrão Zod** (linhas 1-23):
```typescript
import { z } from 'zod'

// Transições válidas: SCHEDULED → OUT_FOR_DELIVERY → DELIVERED
// Valida que apenas valores aceitos pelo enum chegam ao service
export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['OUT_FOR_DELIVERY', 'DELIVERED'], {
    errorMap: () => ({ message: 'Status inválido. Use OUT_FOR_DELIVERY ou DELIVERED.' }),
  }),
})

export type UpdateOrderStatusBody = z.infer<typeof UpdateOrderStatusSchema>
```

---

### `apps/api/src/modules/admin-orders/admin-orders.service.ts` (service, CRUD + event-driven)

**Analógico:** `apps/api/src/modules/schedules/schedules.service.ts`

**Imports pattern** (linhas 1-5):
```typescript
import { FastifyInstance } from 'fastify'
import * as OneSignal from '@onesignal/node-onesignal'
```

**createOsClient helper** (linhas 34-39 de schedules.service.ts):
```typescript
function createOsClient() {
  const configuration = OneSignal.createConfiguration({
    restApiKey: process.env.ONESIGNAL_REST_API_KEY!,
  })
  return new OneSignal.DefaultApi(configuration)
}
```

**OneSignal push individual** (linhas 80-96 de schedules.service.ts):
```typescript
// Padrão: push individual (include_subscription_ids com um único playerId)
if (user.oneSignalPlayerId) {
  try {
    const osClient = createOsClient()
    const notification = new OneSignal.Notification()
    notification.app_id = process.env.ONESIGNAL_APP_ID!
    notification.include_subscription_ids = [user.oneSignalPlayerId]
    notification.headings = { pt: 'Cheirin de Pão' }
    notification.contents = { pt: 'Créditos insuficientes para a entrega de amanhã' }
    await osClient.createNotification(notification)
  } catch (pushErr) {
    this.fastify.log.warn(
      { userId: schedule.userId, err: pushErr },
      '[schedules] falha ao enviar push — ignorado',
    )
  }
}
```

**Prisma.$transaction para atomicidade** (linhas 100-124 de schedules.service.ts):
```typescript
// Padrão de transação quando há múltiplas escritas correlacionadas
await this.prisma.$transaction(async (tx) => {
  await tx.order.create({ data: { ... } })
  await tx.user.update({ where: { id: userId }, data: { ... } })
  await tx.creditTransaction.create({ data: { ... } })
})
```

**Validação de transição de estado + persist Notification (novo padrão desta fase):**
```typescript
// VALID_TRANSITIONS garante que apenas transições permitidas são aceitas (Pitfall 5)
const VALID_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
}

async updateOrderStatus(orderId: string, newStatus: string) {
  const order = await this.prisma.order.findUnique({ where: { id: orderId } })
  if (!order) throw { statusCode: 404, message: 'Pedido não encontrado' }

  const allowed = VALID_TRANSITIONS[order.status] ?? []
  if (!allowed.includes(newStatus)) {
    throw { statusCode: 422, message: `Transição inválida: ${order.status} → ${newStatus}` }
  }

  await this.prisma.order.update({
    where: { id: orderId },
    data: { status: newStatus as OrderStatus },
  })

  if (newStatus === 'DELIVERED') {
    await this.notifyDelivered(order)  // push + persist Notification
  }
}
```

---

### `apps/api/src/modules/orders/orders.service.ts` (estender — CRUD)

**Analógico:** `apps/api/src/modules/orders/orders.service.ts` (self)

**Padrão BRAZIL_OFFSET_HOURS** (linhas 9-23):
```typescript
const BRAZIL_OFFSET_HOURS = 3

function getTomorrowUTC3(): Date {
  const nowUTC = Date.now()
  const nowBrazil = nowUTC - BRAZIL_OFFSET_HOURS * 60 * 60 * 1000
  const todayBrazil = new Date(nowBrazil)
  const year = todayBrazil.getUTCFullYear()
  const month = todayBrazil.getUTCMonth()
  const day = todayBrazil.getUTCDate()
  return new Date(Date.UTC(year, month, day + 1, BRAZIL_OFFSET_HOURS, 0, 0, 0))
}
```

**Novo helper getTodayRange (adaptação do padrão acima):**
```typescript
// Calcula início e fim do dia BRT em UTC — evita Pitfall 1
function getTodayRange(): { start: Date; end: Date } {
  const nowUTC = Date.now()
  const nowBrazil = nowUTC - BRAZIL_OFFSET_HOURS * 60 * 60 * 1000
  const todayBrazil = new Date(nowBrazil)
  const year = todayBrazil.getUTCFullYear()
  const month = todayBrazil.getUTCMonth()
  const day = todayBrazil.getUTCDate()
  // Meia-noite BRT em UTC = 03:00 UTC
  const start = new Date(Date.UTC(year, month, day, BRAZIL_OFFSET_HOURS, 0, 0, 0))
  // 23:59:59 BRT em UTC = 02:59:59 UTC do dia seguinte
  const end = new Date(Date.UTC(year, month, day + 1, BRAZIL_OFFSET_HOURS - 1, 59, 59, 999))
  return { start, end }
}
```

**Novos métodos a adicionar à classe OrdersService:**
```typescript
async getTodayOrder(userId: string) {
  const { start, end } = getTodayRange()
  return this.prisma.order.findFirst({
    where: {
      userId,
      scheduledDate: { gte: start, lte: end },
      status: { not: 'CANCELLED' },
    },
  })
}

async getOrderHistory(userId: string, days: number = 30) {
  const since = new Date()
  since.setDate(since.getDate() - days)
  return this.prisma.order.findMany({
    where: {
      userId,
      scheduledDate: { gte: since },
      status: { not: 'CANCELLED' },
    },
    orderBy: { scheduledDate: 'desc' },
  })
}
```

---

### `apps/api/src/modules/orders/orders.repository.ts` (estender — CRUD)

**Analógico:** `apps/api/src/modules/orders/orders.repository.ts` (self)

**Padrão da classe** (linhas 1-27):
```typescript
import { FastifyInstance } from 'fastify'

export class OrdersRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  // Métodos existentes: findById, findByUserId
  // Adicionar: findTodayByUserId, findHistoryByUserId
  async findTodayByUserId(userId: string, start: Date, end: Date) {
    return this.prisma.order.findFirst({
      where: { userId, scheduledDate: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
    })
  }

  async findHistoryByUserId(userId: string, since: Date) {
    return this.prisma.order.findMany({
      where: { userId, scheduledDate: { gte: since }, status: { not: 'CANCELLED' } },
      orderBy: { scheduledDate: 'desc' },
    })
  }
}
```

---

### `apps/api/src/modules/orders/orders.controller.ts` (estender) + `orders.route.ts` (estender)

**Analógico:** `apps/api/src/modules/orders/orders.controller.ts` (self)

**Novos métodos no controller — padrão** (baseado em linhas 24-52):
```typescript
async getTodayOrder(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user!.id    // userId do JWT — nunca do body
    const order = await this.service.getTodayOrder(userId)
    if (!order) return reply.status(404).send({ error: 'Nenhuma entrega hoje' })
    return reply.status(200).send(order)
  } catch (err) {
    this.fastify.log.error(err)
    return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
  }
}

async getOrderHistory(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user!.id
    const query = request.query as { days?: string }
    const days = query.days ? parseInt(query.days, 10) : 30
    const history = await this.service.getOrderHistory(userId, days)
    return reply.status(200).send(history)
  } catch (err) {
    this.fastify.log.error(err)
    return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
  }
}
```

**Novas rotas a adicionar** (baseado em linhas 10-18 de orders.route.ts):
```typescript
fastify.get(
  '/orders/today',
  { preHandler: [fastify.authenticate] },
  ctrl.getTodayOrder.bind(ctrl),
)

fastify.get(
  '/orders/history',
  { preHandler: [fastify.authenticate] },
  ctrl.getOrderHistory.bind(ctrl),
)
```

---

### `apps/api/src/modules/notifications/notifications.service.ts` (estender)

**Analógico:** `apps/api/src/modules/notifications/notifications.service.ts` (self)

**Estrutura existente da classe** (linhas 9-30):
```typescript
export class NotificationsService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  // Método existente: savePushToken(userId, playerId)
  // Adicionar: getByUserId, markAllRead, createAndTrim
}
```

**Novos métodos (padrão Prisma do projeto):**
```typescript
async getByUserId(userId: string) {
  return this.prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
}

async markAllRead(userId: string) {
  await this.prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  })
}

async createAndTrim(data: {
  userId: string
  type: NotificationType
  title: string
  body: string
  actionRoute?: string
}) {
  await this.prisma.notification.create({
    data: { ...data, isRead: false },
  })
  // Trim — D-10: máximo 30 notificações por usuário
  const all = await this.prisma.notification.findMany({
    where: { userId: data.userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  if (all.length > 30) {
    const toDelete = all.slice(30).map((n) => n.id)
    await this.prisma.notification.deleteMany({ where: { id: { in: toDelete } } })
  }
}

async countUnread(userId: string) {
  return this.prisma.notification.count({
    where: { userId, isRead: false },
  })
}
```

---

### `apps/api/src/modules/notifications/notifications.controller.ts` (estender)

**Analógico:** `apps/api/src/modules/notifications/notifications.controller.ts` (self)

**Padrão do controller existente** (linhas 21-49):
```typescript
// Padrão: userId do JWT, Zod no body, reply.status().send()
export class NotificationsController {
  private service: NotificationsService

  constructor(private fastify: FastifyInstance) {
    this.service = new NotificationsService(fastify)
  }

  // Método existente: savePushToken
  // Adicionar: getNotifications, readAll, getUnreadCount

  async getNotifications(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id
      const notifications = await this.service.getByUserId(userId)
      return reply.status(200).send(notifications)
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async readAll(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id
      await this.service.markAllRead(userId)
      return reply.status(200).send({ ok: true })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async getUnreadCount(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user!.id
      const count = await this.service.countUnread(userId)
      return reply.status(200).send({ count })
    } catch (err) {
      this.fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
```

**Novas rotas a adicionar** (baseado em linhas 10-18 de notifications.route.ts):
```typescript
fastify.get(
  '/notifications/me',
  { preHandler: [fastify.authenticate] },
  ctrl.getNotifications.bind(ctrl),
)

fastify.patch(
  '/notifications/read-all',
  { preHandler: [fastify.authenticate] },
  ctrl.readAll.bind(ctrl),
)

fastify.get(
  '/notifications/unread-count',
  { preHandler: [fastify.authenticate] },
  ctrl.getUnreadCount.bind(ctrl),
)
```

---

### `apps/api/src/plugins/cron.ts` (estender)

**Analógico:** `apps/api/src/plugins/cron.ts` (self)

**Guard NODE_ENV e padrão do plugin** (linhas 1-13):
```typescript
import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import cron from 'node-cron'
import { SchedulesService } from '../modules/schedules/schedules.service.js'

const cronPlugin: FastifyPluginAsync = fp(async (fastify) => {
  // Não inicializar crons em ambiente de teste
  if (process.env.NODE_ENV === 'test') {
    fastify.log.info('[cron] ambiente de teste — crons não registrados')
    return
  }
```

**Padrão de cron job existente** (linhas 40-53):
```typescript
// Estrutura try/catch por job + log info/error
cron.schedule(
  '0 20 * * 0',
  async () => {
    fastify.log.info('[cron] iniciando sendReconfigureReminders')
    try {
      await schedulesService.sendReconfigureReminders()
      fastify.log.info('[cron] sendReconfigureReminders concluído')
    } catch (err) {
      fastify.log.error({ err }, '[cron] erro em sendReconfigureReminders — servidor mantido ativo')
    }
  },
  { timezone: 'America/Sao_Paulo', name: 'weekly-reminder' },
)
```

**3º cron a adicionar — véspera 21h:**
```typescript
// Cron 3 — 21h diário (America/Sao_Paulo)
// Notifica clientes com entrega agendada para amanhã
cron.schedule(
  '0 21 * * *',
  async () => {
    fastify.log.info('[cron] iniciando sendEveReminders')
    try {
      await schedulesService.sendEveReminders()
      fastify.log.info('[cron] sendEveReminders concluído')
    } catch (err) {
      fastify.log.error({ err }, '[cron] erro em sendEveReminders — servidor mantido ativo')
    }
  },
  { timezone: 'America/Sao_Paulo', name: 'eve-reminders' },
)
```

**Atualizar log final:**
```typescript
// De:
fastify.log.info('[cron] 2 cron jobs registrados (meia-noite diário + domingo 20h)')
// Para:
fastify.log.info('[cron] 3 cron jobs registrados (meia-noite diário + domingo 20h + diário 21h)')
```

---

### `apps/web/src/pages/client/TrackingScreen.tsx` (component, request-response)

**Analógico:** `apps/web/src/pages/client/CreditHistoryScreen.tsx`

**Imports pattern** (linhas 1-6 de CreditHistoryScreen.tsx):
```typescript
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../../components/brand/Icon'
```

**Para TrackingScreen, adicionar:**
```typescript
import { useOrderTracking } from '../../hooks/useOrderTracking'
```

**AppBar com back button** (linhas 56-88 de CreditHistoryScreen.tsx):
```typescript
// Padrão de AppBar com botão voltar
<div style={{ display: 'flex', alignItems: 'center', padding: '6px 20px 14px', gap: 12 }}>
  <button
    onClick={() => navigate(-1)}
    aria-label="Voltar"
    style={{
      width: 38,
      height: 38,
      borderRadius: 12,
      background: 'var(--color-surface-2)',
      border: 'none',
      display: 'grid',
      placeItems: 'center',
      cursor: 'pointer',
      flexShrink: 0,
    }}
  >
    <Icon name="arrowL" size={20} />
  </button>
  <h1 style={{
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: 21,
    color: 'var(--color-text)',
    letterSpacing: '-0.02em',
    margin: 0,
  }}>
    Sua entrega
  </h1>
</div>
```

**Skeleton loading e lista vazia** (linhas 93-134 de CreditHistoryScreen.tsx):
```typescript
// Padrão de skeleton com var(--color-surface-2) + lista vazia com color-text-ter
{isLoading && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    {[1, 2, 3].map((n) => (
      <div key={n} style={{ height: 64, borderRadius: 'var(--radius-card)', background: 'var(--color-surface-2)' }} />
    ))}
  </div>
)}
{!isLoading && !error && items.length === 0 && (
  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text-ter)', textAlign: 'center', marginTop: 40 }}>
    Nenhuma entrega nos últimos 30 dias.
  </p>
)}
```

**Design handoff — TrackScreen** (`.projeto/design_handoff_cheirin_pao/app/screens-client-extra.jsx` linhas 96-150):

Timeline 3 passos com fundo escuro (`t.espresso`) no card superior e steps visuais:
```jsx
// Card de status atual — fundo espresso, texto FAF5EC, accent E3AC3F
<div style={{ background: t.espresso, padding: '20px', position: 'relative', overflow: 'hidden' }}>
  <div style={{ fontSize: 11.5, color: '#E3AC3F', fontWeight: 700, letterSpacing: '0.06em' }}>
    QUARTA · 11 JUN
  </div>
  <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 30, color: '#FAF5EC' }}>
    4 pãezinhos
  </div>
</div>

// Timeline step: done=accent, current=accent filled, pending=border
// connector: width:2.5, background: done ? t.accent : t.border, minHeight:38
```

---

### `apps/web/src/pages/client/NotificationsScreen.tsx` (component, request-response)

**Analógico:** `apps/web/src/pages/client/CreditHistoryScreen.tsx`

**Imports pattern** (linhas 1-5):
```typescript
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../../components/brand/Icon'
```

**Padrão fetch + mark-as-read ao montar:**
```typescript
// D-10: marcar todas como lidas ao abrir a tela — PATCH após GET
useEffect(() => {
  const load = async () => {
    try {
      const res = await apiFetch('/notifications/me')
      if (res.ok) {
        setNotifications(await res.json())
      } else {
        setError('Não foi possível carregar as notificações.')
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
    // Marcar como lidas (best-effort — não bloqueia UI)
    apiFetch('/notifications/read-all', { method: 'PATCH' }).catch(() => {})
  }
  void load()
}, [])
```

**Card de item** (linhas 136-204 de CreditHistoryScreen.tsx como base estrutural):
```typescript
// Card com display:flex, gap:12, boxShadow soft
<div style={{
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius-card)',
  padding: '14px 16px',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  boxShadow: 'var(--shadow-soft)',
  // Novo/não-lido: border destaque (ver NotifsScreen do handoff)
  border: notification.isRead ? '1px solid var(--color-border2)' : '1.5px solid var(--color-accent)',
}}>
```

**Design handoff — NotifsScreen** (`.projeto/design_handoff_cheirin_pao/app/screens-client-extra.jsx` linhas 153-186):

Cards com ícone colorido por tipo (gold=alerta, good=entrega, neutral=outros), badge "novo" via border accent, e CTA opcional.

---

### `apps/web/src/pages/client/HomeScreen.tsx` (modificar)

**Analógico:** `apps/web/src/pages/client/HomeScreen.tsx` (self)

**Ícone de sino com badge — adicionar ao header:**
```typescript
// Adicionar ao topo da HomeScreen, alinhado à direita do greeting
// Padrão de botão mínimo 44px (CLAUDE.md constraint)
<button
  onClick={() => navigate('/client/notificacoes')}
  aria-label="Notificações"
  style={{
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'var(--color-surface-2)',
    border: 'none',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
  }}
>
  <Icon name="bell" size={22} color="var(--color-text)" />
  {unreadCount > 0 && (
    <span style={{
      position: 'absolute',
      top: 6,
      right: 6,
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: 'var(--color-accent)',
    }} />
  )}
</button>
```

**Fetch unreadCount ao montar** (padrão de CreditHistoryScreen.tsx linhas 21-39):
```typescript
// Estado local + fetch no mount (sem context global — re-monta ao voltar de NotificationsScreen)
const [unreadCount, setUnreadCount] = useState(0)

useEffect(() => {
  const fetchCount = async () => {
    try {
      const res = await apiFetch('/notifications/unread-count')
      if (res.ok) {
        const data = (await res.json()) as { count: number }
        setUnreadCount(data.count)
      }
    } catch {
      // silencioso — badge não crítico
    }
  }
  void fetchCount()
}, [])
```

**Card "Entrega de hoje" funcional** (substituir placeholder existente nas linhas 77-109):
```typescript
// Usar useOrderTracking hook + exibir status real
const { order, isLoading: orderLoading } = useOrderTracking()

// Substituir o placeholder por card dinâmico com status
```

---

### `apps/web/src/routes/router.tsx` (modificar)

**Analógico:** `apps/web/src/routes/router.tsx` (self)

**Padrão lazy import** (linhas 49-51):
```typescript
// Padrão: lazy() com import dinâmico + .then(m => ({ Component: m.ComponentName }))
{
  path: 'pedidos',
  lazy: () =>
    import('../pages/client/TrackingScreen').then((m) => ({
      Component: m.TrackingScreen,
    })),
},
{
  path: 'notificacoes',
  lazy: () =>
    import('../pages/client/NotificationsScreen').then((m) => ({
      Component: m.NotificationsScreen,
    })),
},
```

---

## Shared Patterns

### Autenticação (preHandler)
**Fonte:** `apps/api/src/modules/orders/orders.route.ts` linhas 12-17
**Aplicar a:** Todos os endpoints de cliente e admin desta fase
```typescript
{ preHandler: [fastify.authenticate] }
```

### Admin Role Check Inline
**Fonte:** `apps/api/src/modules/auth/auth.controller.ts` linhas 114-117
**Aplicar a:** `admin-orders.controller.ts` — PRIMEIRO bloco de código em cada handler
```typescript
if (request.user?.role !== 'ADMIN') {
  return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
}
```

### Error Handling — Controladores
**Fonte:** `apps/api/src/modules/orders/orders.controller.ts` linhas 44-51
**Aplicar a:** Todos os novos controllers desta fase
```typescript
const e = err as { statusCode?: number; message?: string }
if (e.statusCode === 400) {
  return reply.status(400).send({ error: e.message ?? 'Requisição inválida' })
}
// Adicionar para Fase 5: 404 e 422 também
if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
if (e.statusCode === 422) return reply.status(422).send({ error: e.message })
return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
```

### OneSignal Push + Persist Notification (operação dupla obrigatória)
**Fonte:** Derivado de `apps/api/src/modules/schedules/schedules.service.ts` linhas 80-96
**Aplicar a:** `admin-orders.service.ts` (DELIVERED), `schedules.service.ts` (sendEveReminders)

**Regra:** Push em try/catch próprio (falha silenciosamente — D-06). Persist em bloco separado obrigatório.
```typescript
// 1. Push best-effort
if (playerId) {
  try { /* OneSignal */ } catch (err) { fastify.log.warn({ userId, err }, '...') }
}
// 2. Persist obrigatório — fora do try do push
await notificationsService.createAndTrim({ userId, type, title, body, actionRoute })
```

### Timezone BRT — cálculo de datas
**Fonte:** `apps/api/src/modules/orders/orders.service.ts` linhas 9-24
**Aplicar a:** `orders.service.ts` (getTodayRange), `schedules.service.ts` (sendEveReminders — query por amanhã)

Usar `BRAZIL_OFFSET_HOURS = 3` e `Date.UTC(year, month, day, 3, 0, 0)` — NUNCA `new Date()` direto para comparações de "hoje/amanhã".

### Cleanup de setInterval (anti memory-leak)
**Fonte:** `apps/web/src/hooks/usePaymentPolling.ts` linha 33
**Aplicar a:** `useOrderTracking.ts`
```typescript
return () => clearInterval(id)  // OBRIGATÓRIO no return do useEffect
```

### CSS Design Tokens (mandatório)
**Fonte:** `apps/web/src/pages/client/CreditHistoryScreen.tsx` (toda a tela)
**Aplicar a:** TrackingScreen, NotificationsScreen, modificações HomeScreen

| Token | Uso |
|-------|-----|
| `var(--font-display)` | Títulos, números (Bricolage Grotesque) |
| `var(--font-body)` | Texto UI (Hanken Grotesk) |
| `var(--color-surface)` | Fundo de cards |
| `var(--color-surface-2)` | Skeleton, backgrounds secundários |
| `var(--color-accent)` | Amarelo-âmbar principal |
| `var(--color-text)` / `var(--color-text-sec)` / `var(--color-text-ter)` | Hierarquia de texto |
| `var(--radius-card)` | Border radius de cards |
| `var(--shadow-soft)` | Sombra de cards |
| `minHeight: 44` | Todos os elementos interativos (CLAUDE.md constraint) |

### Tela com AppBar + scroll
**Fonte:** `apps/web/src/pages/client/CreditHistoryScreen.tsx` linhas 46-92
**Aplicar a:** TrackingScreen, NotificationsScreen
```typescript
<div style={{
  minHeight: 'calc(100dvh - 56px - env(safe-area-inset-bottom))',
  background: 'var(--color-app-bg)',
}}>
  {/* AppBar */}
  <div style={{ display: 'flex', alignItems: 'center', padding: '6px 20px 14px', gap: 12 }}>
    ...
  </div>
  {/* Content scrollável */}
  <div style={{ padding: '0 20px 20px' }}>
    ...
  </div>
</div>
```

---

## Tests Pattern

### Hook test (useOrderTracking)
**Analógico:** `apps/web/src/hooks/__tests__/usePaymentPolling.test.ts`

**Setup obrigatório** (linhas 1-22):
```typescript
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockApiFetch = vi.hoisted(() => vi.fn())
vi.mock('../../lib/apiFetch', () => ({ apiFetch: mockApiFetch }))

// Sempre usar fakeTimers para controlar setInterval
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
})
afterEach(() => {
  vi.useRealTimers()
})
```

**Casos obrigatórios (baseado no padrão):**
```typescript
// 1. clearInterval chamado no unmount (anti memory-leak)
const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
const { unmount } = renderHook(() => useOrderTracking())
unmount()
expect(clearIntervalSpy).toHaveBeenCalled()

// 2. Sem fetch após unmount
const { unmount } = renderHook(() => useOrderTracking())
unmount()
mockApiFetch.mockClear()
await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
expect(mockApiFetch).not.toHaveBeenCalled()

// 3. Poll a cada 30s (não 3s como no usePaymentPolling)
await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
expect(mockApiFetch).toHaveBeenCalledTimes(2) // 1 imediato + 1 do interval
```

### Service test (admin-orders.service)
**Analógico:** `apps/api/src/modules/orders/__tests__/orders.service.test.ts`

**makeFastifyMock pattern** (linhas 19-58):
```typescript
// Criar mock do fastify com prisma controlável por teste
function makeFastifyMock(overrides = {}) {
  const prisma = {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    notification: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
  }
  return {
    fastify: {
      prisma,
      log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
    } as unknown,
    prisma,
  }
}
```

**Mock OneSignal** (padrão de schedules.service.test.ts linhas 7-21):
```typescript
vi.mock('@onesignal/node-onesignal', () => {
  const createNotificationMock = vi.fn().mockResolvedValue({})
  return {
    createConfiguration: vi.fn().mockReturnValue({}),
    DefaultApi: vi.fn().mockImplementation(() => ({ createNotification: createNotificationMock })),
    Notification: vi.fn().mockImplementation(() => ({
      app_id: '', include_subscription_ids: [], headings: {}, contents: {},
    })),
    _createNotificationMock: createNotificationMock,
  }
})
```

---

## No Analog Found

Não há arquivos sem analógico nesta fase. Todos os padrões existem no codebase ou são derivações diretas de padrões existentes.

| Arquivo | Observação |
|---------|------------|
| `sendEveReminders()` em schedules.service.ts | Novo método — padrão derivado de `sendReconfigureReminders()` existente (linhas 134-163), adaptado para buscar `Order` (não `Schedule`) de amanhã |

---

## Metadata

**Escopo de busca:** `apps/api/src/modules/`, `apps/api/src/plugins/`, `apps/web/src/`, `apps/api/prisma/schema.prisma`, `.projeto/design_handoff_cheirin_pao/`
**Arquivos lidos:** 20
**Data do mapeamento:** 2026-06-15
