# Phase 4: Scheduling — Pattern Map

**Mapped:** 2026-06-14
**Files analyzed:** 17 arquivos novos/modificados
**Analogs found:** 17 / 17

---

## File Classification

| Arquivo Novo/Modificado | Role | Data Flow | Análogo mais próximo | Qualidade |
|-------------------------|------|-----------|----------------------|-----------|
| `apps/api/src/modules/schedules/schedules.route.ts` | route | request-response | `apps/api/src/modules/credits/credits.route.ts` | exact |
| `apps/api/src/modules/schedules/schedules.controller.ts` | controller | request-response | `apps/api/src/modules/credits/credits.controller.ts` | exact |
| `apps/api/src/modules/schedules/schedules.service.ts` | service | CRUD + batch | `apps/api/src/modules/credits/credits.service.ts` | role-match |
| `apps/api/src/modules/schedules/schedules.repository.ts` | repository | CRUD | `apps/api/src/modules/credits/credits.repository.ts` | exact |
| `apps/api/src/modules/schedules/schedules.schema.ts` | schema | transform | `apps/api/src/modules/credits/credits.schema.ts` | exact |
| `apps/api/src/modules/schedules/__tests__/schedules.service.test.ts` | test | — | `apps/api/src/modules/credits/__tests__/credits.service.test.ts` | exact |
| `apps/api/src/modules/orders/orders.route.ts` | route | request-response | `apps/api/src/modules/payments/payments.route.ts` | exact |
| `apps/api/src/modules/orders/orders.controller.ts` | controller | request-response | `apps/api/src/modules/payments/payments.controller.ts` | exact |
| `apps/api/src/modules/orders/orders.service.ts` | service | CRUD + atomic | `apps/api/src/modules/payments/payments.service.ts` | role-match |
| `apps/api/src/modules/orders/orders.repository.ts` | repository | CRUD | `apps/api/src/modules/payments/payments.repository.ts` | exact |
| `apps/api/src/modules/orders/orders.schema.ts` | schema | transform | `apps/api/src/modules/payments/payments.schema.ts` | exact |
| `apps/api/src/modules/orders/__tests__/orders.service.test.ts` | test | — | `apps/api/src/modules/payments/__tests__/payments.service.test.ts` | exact |
| `apps/api/src/modules/notifications/notifications.route.ts` | route | request-response | `apps/api/src/modules/credits/credits.route.ts` | role-match |
| `apps/api/src/modules/notifications/notifications.controller.ts` | controller | request-response | `apps/api/src/modules/credits/credits.controller.ts` | role-match |
| `apps/api/src/modules/notifications/notifications.service.ts` | service | event-driven | `apps/api/src/modules/webhooks/webhooks.service.ts` | partial |
| `apps/api/src/plugins/cron.ts` | plugin | event-driven | `apps/api/src/plugins/prisma.ts` | role-match |
| `apps/api/src/server.ts` (modificar) | config | — | `apps/api/src/server.ts` (existente) | exact |
| `apps/api/prisma/schema.prisma` (modificar) | model | — | `apps/api/prisma/schema.prisma` (existente) | exact |
| `apps/web/src/pages/client/ScheduleScreen.tsx` | component | request-response | `apps/web/src/pages/client/AutoBuyScreen.tsx` | role-match |
| `apps/web/src/pages/client/SingleScreen.tsx` | component | request-response | `apps/web/src/pages/client/CombosScreen.tsx` | role-match |
| `apps/web/src/hooks/useSchedule.ts` | hook | request-response | `apps/web/src/hooks/usePaymentPolling.ts` | role-match |
| `apps/web/src/hooks/useOneSignalRegister.ts` | hook | event-driven | `apps/web/src/hooks/useAuth.ts` | partial |
| `apps/web/src/routes/router.tsx` (modificar) | config | — | `apps/web/src/routes/router.tsx` (existente) | exact |

---

## Pattern Assignments

### `apps/api/src/modules/schedules/schedules.route.ts` (route, request-response)

**Análogo:** `apps/api/src/modules/credits/credits.route.ts`

**Imports pattern** (linhas 1–3):
```typescript
import { FastifyPluginAsync } from 'fastify'
import { SchedulesController } from './schedules.controller.js'
```

**Core route pattern** (linhas 4–26):
```typescript
export const schedulesRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new SchedulesController(fastify)

  fastify.get(
    '/schedules/me',
    { preHandler: [fastify.authenticate] },
    ctrl.getMySchedule.bind(ctrl),
  )
  fastify.put(
    '/schedules/me',
    { preHandler: [fastify.authenticate] },
    ctrl.upsertSchedule.bind(ctrl),
  )
}
```

**Padrão chave:** Toda rota autenticada usa `{ preHandler: [fastify.authenticate] }`. Rotas agrupadas por recurso em um único `FastifyPluginAsync`. Métodos do controller usam `.bind(ctrl)`.

---

### `apps/api/src/modules/schedules/schedules.controller.ts` (controller, request-response)

**Análogo:** `apps/api/src/modules/credits/credits.controller.ts`

**Imports pattern** (linhas 1–5):
```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { UpsertScheduleSchema } from './schedules.schema.js'
import { SchedulesService } from './schedules.service.js'
```

**Helper zodMessage** (linhas 6–10) — copiar identicamente:
```typescript
type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}
```

**Classe e construtor** (linhas 12–16):
```typescript
export class SchedulesController {
  private service: SchedulesService

  constructor(private fastify: FastifyInstance) {
    this.service = new SchedulesService(fastify)
  }
```

**Padrão de handler GET autenticado** — extraído de `credits.controller.ts` linhas 39–48:
```typescript
async getMySchedule(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user!.id
    const schedule = await this.service.getMySchedule(userId)
    return reply.status(200).send(schedule)
  } catch (err) {
    this.fastify.log.error(err)
    return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
  }
}
```

**Padrão de handler PUT com validação Zod** — extraído de `credits.controller.ts` linhas 50–70:
```typescript
async upsertSchedule(request: FastifyRequest, reply: FastifyReply) {
  let body: ReturnType<typeof UpsertScheduleSchema.parse>
  try {
    body = UpsertScheduleSchema.parse(request.body)
  } catch (err) {
    if (err instanceof ZodError) {
      return reply.status(400).send({ error: zodMessage(err) })
    }
    return reply.status(400).send({ error: 'Dados inválidos.' })
  }
  try {
    const userId = request.user!.id
    const result = await this.service.upsertSchedule(userId, body)
    return reply.status(200).send(result)
  } catch (err) {
    this.fastify.log.error(err)
    return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
  }
}
```

**Padrão de erros de negócio** — para handlers de criação de Order, usar o `isBusinessError` de `payments.controller.ts` linhas 18–31:
```typescript
function isBusinessError(err: unknown): err is { error: string; status: number } {
  return (
    typeof err === 'object' &&
    err !== null &&
    !(err instanceof Error) &&
    'error' in err &&
    'status' in err &&
    typeof (err as { error: unknown }).error === 'string' &&
    typeof (err as { status: unknown }).status === 'number' &&
    !('message' in err) &&
    !('cause' in err)
  )
}
```

---

### `apps/api/src/modules/schedules/schedules.service.ts` (service, CRUD + batch)

**Análogo:** `apps/api/src/modules/credits/credits.service.ts` + `apps/api/src/modules/payments/payments.service.ts`

**Imports e construtor** (credits.service.ts linhas 1–8):
```typescript
import { FastifyInstance } from 'fastify'
import { SchedulesRepository } from './schedules.repository.js'

export class SchedulesService {
  private repo: SchedulesRepository

  constructor(private fastify: FastifyInstance) {
    this.repo = new SchedulesRepository(fastify)
  }
```

**Padrão de throw de erro de negócio** — extraído de `credits.service.ts` linhas 33–37:
```typescript
throw { error: 'Mensagem segura para exibir ao cliente', status: 400 }
```

**Padrão de $transaction sequencial** — extraído de `payments.repository.ts` linhas 35–50:
```typescript
const [, updatedUser] = await this.fastify.prisma.$transaction([
  this.fastify.prisma.creditTransaction.create({ data: { ... } }),
  this.fastify.prisma.user.update({
    where: { id: userId },
    data: { creditBalance: { decrement: quantity } },
  }),
])
```

**Padrão de getter private para prisma** — extraído de `payments.service.ts` linhas 19–21:
```typescript
private get prisma() {
  return this.fastify.prisma
}
```

**Padrão de upsert do Schedule** — derivado do padrão de update em `credits.controller.ts` linhas 61–64:
```typescript
async upsertSchedule(userId: string, condominiumId: string, data: ScheduleBody) {
  return this.fastify.prisma.schedule.upsert({
    where: { userId_condominiumId: { userId, condominiumId } },
    create: { userId, condominiumId, ...data, isActive: true },
    update: { ...data },
  })
}
```

**Padrão de verificação de saldo antes de criar Order** — extraído de `credits.service.ts` linhas 64–68:
```typescript
async checkBalance(userId: string, requiredQty: number): Promise<boolean> {
  const user = await this.repo.getUserById(userId)
  if (!user) return false
  return user.creditBalance >= requiredQty
}
```

---

### `apps/api/src/modules/schedules/schedules.repository.ts` (repository, CRUD)

**Análogo:** `apps/api/src/modules/credits/credits.repository.ts`

**Estrutura completa** (linhas 1–40):
```typescript
import { FastifyInstance } from 'fastify'

export class SchedulesRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  findActiveByUserId(userId: string) {
    return this.prisma.schedule.findFirst({
      where: { userId, isActive: true },
    })
  }

  findAllActive() {
    return this.prisma.schedule.findMany({
      where: { isActive: true },
      include: { user: { select: { id: true, creditBalance: true, oneSignalPlayerId: true, autoRecharge: true } } },
    })
  }

  getUserById(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } })
  }

  updateUser(userId: string, data: Record<string, unknown>) {
    return this.prisma.user.update({ where: { id: userId }, data })
  }
}
```

**Padrão de acesso ao prisma via getter privado** — copiar de `credits.repository.ts` linhas 6–8:
```typescript
private get prisma() {
  return this.fastify.prisma
}
```

---

### `apps/api/src/modules/schedules/schedules.schema.ts` (schema, transform)

**Análogo:** `apps/api/src/modules/credits/credits.schema.ts`

**Estrutura** (linhas 1–20):
```typescript
import { z } from 'zod'

const WeeklyQtySchema = z.object({
  seg: z.number().int().min(0).max(12),
  ter: z.number().int().min(0).max(12),
  qua: z.number().int().min(0).max(12),
  qui: z.number().int().min(0).max(12),
  sex: z.number().int().min(0).max(12),
  sab: z.number().int().min(0).max(12),
  dom: z.number().int().min(0).max(12),
})

export const UpsertScheduleSchema = z.object({
  weeklyQty: WeeklyQtySchema,
  deliveryTime: z.enum(['06:30', '07:00', '07:30', '08:00']),
  notifyReconfigure: z.boolean().default(false),
})

export type UpsertScheduleBody = z.infer<typeof UpsertScheduleSchema>
```

**Padrão de export com tipo inferido** — extraído de `credits.schema.ts` linhas 7–15:
```typescript
export type AutoRechargeBody = z.infer<typeof AutoRechargeSchema>
```

---

### `apps/api/src/modules/schedules/__tests__/schedules.service.test.ts` (test)

**Análogo:** `apps/api/src/modules/credits/__tests__/credits.service.test.ts`

**Cabeçalho e imports** (linhas 1–7):
```typescript
// Schedules service unit tests -- Wave N implementation (GREEN state)
// Requirements: SCHED-01..04, CRED-07, CRED-10
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

import { SchedulesService } from '../schedules.service.js'
```

**Padrão createMockFastify** (linhas 8–18) — copiar e adaptar:
```typescript
function createMockFastify(overrides: Record<string, unknown> = {}): FastifyInstance {
  return {
    prisma: {
      schedule: { findMany: vi.fn(), findFirst: vi.fn(), upsert: vi.fn() },
      order: { create: vi.fn() },
      user: { findUnique: vi.fn(), update: vi.fn() },
      creditTransaction: { create: vi.fn() },
      $transaction: vi.fn(),
      $runCommandRaw: vi.fn(),
      ...overrides,
    },
    log: { warn: vi.fn(), error: vi.fn() },
  } as unknown as FastifyInstance
}
```

**Padrão de describe/it** (linhas 20–101) — cada describe cobre um requisito, cada it descreve comportamento observável em português sem acentos (padrão do projeto):
```typescript
describe('SchedulesService [SCHED-02]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('upsertSchedule [SCHED-02]', () => {
    it('cria Schedule quando usuario nao tem schedule ativo', async () => { ... })
    it('atualiza Schedule existente sem criar duplicata', async () => { ... })
  })
})
```

**Mock de módulo externo** — para testes que envolvem OneSignal, copiar padrão de mock de `payments.service.test.ts` linhas 8–22:
```typescript
const mockCreateNotification = vi.fn()
vi.mock('@onesignal/node-onesignal', () => ({
  createConfiguration: vi.fn(() => ({})),
  DefaultApi: class {
    createNotification = mockCreateNotification
  },
  Notification: class {},
}))
```

---

### `apps/api/src/modules/orders/orders.route.ts` (route, request-response)

**Análogo:** `apps/api/src/modules/payments/payments.route.ts`

**Core pattern** (linhas 1–16):
```typescript
import { FastifyPluginAsync } from 'fastify'
import { OrdersController } from './orders.controller.js'

export const ordersRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new OrdersController(fastify)

  fastify.post(
    '/orders',
    { preHandler: [fastify.authenticate] },
    ctrl.createSingleOrder.bind(ctrl),
  )
}
```

---

### `apps/api/src/modules/orders/orders.controller.ts` (controller, request-response)

**Análogo:** `apps/api/src/modules/payments/payments.controller.ts`

**Padrão de handler POST com Zod + isBusinessError** (linhas 44–68):
```typescript
async createSingleOrder(request: FastifyRequest, reply: FastifyReply) {
  let body: ReturnType<typeof CreateOrderSchema.parse>
  try {
    body = CreateOrderSchema.parse(request.body)
  } catch (err) {
    if (err instanceof ZodError) {
      return reply.status(400).send({ error: zodMessage(err) })
    }
    return reply.status(400).send({ error: 'Dados inválidos.' })
  }
  try {
    const userId = request.user!.id
    const result = await this.service.createSingleOrder(userId, body)
    return reply.status(201).send(result)
  } catch (err) {
    this.fastify.log.error({ err }, 'orders: erro ao criar pedido')
    if (isBusinessError(err)) {
      return reply.status(err.status).send({ error: err.error })
    }
    return reply.status(500).send({ error: 'Não foi possível criar o pedido. Tente novamente.' })
  }
}
```

**Nota:** Copiar `isBusinessError` de `payments.controller.ts` linhas 18–31 (guard distingue erro de negócio de erro inesperado).

---

### `apps/api/src/modules/orders/orders.service.ts` (service, CRUD + atomic)

**Análogo:** `apps/api/src/modules/payments/payments.service.ts`

**Construtor** (pagamentos, linhas 6–17):
```typescript
export class OrdersService {
  private repo: OrdersRepository

  constructor(private fastify: FastifyInstance) {
    this.repo = new OrdersRepository(fastify)
  }

  private get prisma() {
    return this.fastify.prisma
  }
```

**Padrão de throw de erro de negócio** — de `payments.service.ts` linha 51:
```typescript
throw { error: 'Créditos insuficientes', status: 400 }
```

**Padrão de $transaction para criar Order + decrementar crédito** — baseado em `payments.repository.ts` linhas 35–50:
```typescript
await this.prisma.$transaction([
  this.prisma.order.create({
    data: { userId, type: 'SINGLE', quantity, scheduledDate: date, status: 'SCHEDULED' },
  }),
  this.prisma.user.update({
    where: { id: userId },
    data: { creditBalance: { decrement: quantity } },
  }),
  this.prisma.creditTransaction.create({
    data: { userId, type: 'DELIVERY', quantity: -quantity,
            description: `Reserva de ${quantity} pão(eis) — pedido único` },
  }),
])
```

---

### `apps/api/src/modules/orders/orders.repository.ts` (repository, CRUD)

**Análogo:** `apps/api/src/modules/payments/payments.repository.ts`

**Estrutura** (linhas 1–35):
```typescript
import { FastifyInstance } from 'fastify'

export class OrdersRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  createOrder(data: { userId: string; type: 'SINGLE' | 'SCHEDULED'; quantity: number; scheduledDate: Date; status: 'SCHEDULED' }) {
    return this.prisma.order.create({ data })
  }

  findByUserAndDate(userId: string, date: Date) {
    return this.prisma.order.findFirst({ where: { userId, scheduledDate: date } })
  }
}
```

**Padrão de reserva atômica de créditos** (RESEARCH.md Seção 4 — para uso em produção):
```typescript
// Em orders.repository.ts — reserva atômica via $runCommandRaw
async reserveCredits(userId: string, quantity: number): Promise<boolean> {
  const result = await this.fastify.prisma.$runCommandRaw({
    update: 'User',
    updates: [{
      q: { _id: { $oid: userId }, creditBalance: { $gte: quantity } },
      u: { $inc: { creditBalance: -quantity } },
      multi: false,
    }]
  }) as { nModified?: number; modifiedCount?: number }
  return (result.nModified ?? result.modifiedCount ?? 0) > 0
}
```

**Nota MVP:** Para o MVP usar `$transaction` interativo (mais simples) conforme RESEARCH.md Seção 4. Documentar a limitação de race condition.

---

### `apps/api/src/modules/orders/orders.schema.ts` (schema, transform)

**Análogo:** `apps/api/src/modules/payments/payments.schema.ts`

**Padrão de validação com refinamento** (linhas 3–11):
```typescript
import { z } from 'zod'

export const CreateOrderSchema = z.object({
  date: z.string().datetime().or(z.string().date()),  // ISO date string
  quantity: z.number().int().min(1).max(20),
})

export type CreateOrderBody = z.infer<typeof CreateOrderSchema>
```

---

### `apps/api/src/modules/orders/__tests__/orders.service.test.ts` (test)

**Análogo:** `apps/api/src/modules/payments/__tests__/payments.service.test.ts`

**Mock de dependência externa** (linhas 7–22 do análogo) — adaptar para `$runCommandRaw`:
```typescript
function createMockFastify(overrides: Record<string, unknown> = {}): FastifyInstance {
  return {
    prisma: {
      order: { create: vi.fn(), findFirst: vi.fn() },
      user: { findUnique: vi.fn(), update: vi.fn() },
      creditTransaction: { create: vi.fn() },
      $transaction: vi.fn(),
      $runCommandRaw: vi.fn(),
      ...overrides,
    },
    log: { error: vi.fn(), warn: vi.fn() },
  } as unknown as FastifyInstance
}
```

---

### `apps/api/src/modules/notifications/notifications.route.ts` (route, request-response)

**Análogo:** `apps/api/src/modules/credits/credits.route.ts`

**Padrão** (linhas 1–14):
```typescript
import { FastifyPluginAsync } from 'fastify'
import { NotificationsController } from './notifications.controller.js'

export const notificationsRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new NotificationsController(fastify)

  fastify.post(
    '/users/push-token',
    { preHandler: [fastify.authenticate] },
    ctrl.savePushToken.bind(ctrl),
  )
}
```

---

### `apps/api/src/modules/notifications/notifications.controller.ts` (controller, request-response)

**Análogo:** `apps/api/src/modules/credits/credits.controller.ts` — handler PUT simples

**Padrão** — copiar padrão de `updateCardToken` em `credits.controller.ts` linhas 72–93:
```typescript
async savePushToken(request: FastifyRequest, reply: FastifyReply) {
  let body: ReturnType<typeof PushTokenSchema.parse>
  try {
    body = PushTokenSchema.parse(request.body)
  } catch (err) {
    if (err instanceof ZodError) {
      return reply.status(400).send({ error: zodMessage(err) })
    }
    return reply.status(400).send({ error: 'Dados inválidos.' })
  }
  try {
    await this.fastify.prisma.user.update({
      where: { id: request.user!.id },
      data: { oneSignalPlayerId: body.playerId },
    })
    return reply.status(200).send({ ok: true })
  } catch (err) {
    this.fastify.log.error(err)
    return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
  }
}
```

---

### `apps/api/src/modules/notifications/notifications.service.ts` (service, event-driven)

**Análogo:** `apps/api/src/modules/webhooks/webhooks.service.ts` (serviço sem repository próprio, acessa `fastify.prisma` diretamente via getter)

**Estrutura** — copiar padrão de `webhooks.service.ts` linhas 1–17:
```typescript
import { FastifyInstance } from 'fastify'
import * as OneSignal from '@onesignal/node-onesignal'

export class NotificationsService {
  private osClient: OneSignal.DefaultApi

  constructor(private fastify: FastifyInstance) {
    const configuration = OneSignal.createConfiguration({
      restApiKey: process.env.ONESIGNAL_REST_API_KEY!,
    })
    this.osClient = new OneSignal.DefaultApi(configuration)
  }
```

**Padrão de falha silenciosa (não propagar erro de push)** — análogo ao `webhooks.service.ts` linhas 58–63 onde erros não críticos não propagam:
```typescript
async sendPush(playerId: string, title: string, body: string, url?: string): Promise<void> {
  try {
    const notification = new OneSignal.Notification()
    notification.app_id = process.env.ONESIGNAL_APP_ID!
    notification.include_subscription_ids = [playerId]
    notification.headings = { pt: title }
    notification.contents = { pt: body }
    if (url) notification.url = url
    const response = await this.osClient.createNotification(notification)
    if (!response.id) {
      this.fastify.log.warn({ playerId }, 'OneSignal: sem recipient — player_id inválido ou expirado')
    }
  } catch (err) {
    this.fastify.log.error(err, 'OneSignal: falha ao enviar push')
    // Não propagar — falha de push não deve interromper o cron
  }
}
```

---

### `apps/api/src/plugins/cron.ts` (plugin, event-driven)

**Análogo:** `apps/api/src/plugins/prisma.ts`

**Estrutura de plugin Fastify com fastify-plugin** (prisma.ts linhas 1–18):
```typescript
import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import cron from 'node-cron'

const cronPlugin: FastifyPluginAsync = fp(async (fastify) => {
  // Cron diário meia-noite — cria Orders do dia seguinte + verifica auto-buy
  cron.schedule('0 0 * * *', async () => {
    try {
      const schedulesService = new SchedulesService(fastify)
      await schedulesService.createDailyOrders()
      await schedulesService.processAutoBuy()
    } catch (err) {
      fastify.log.error(err, 'cron: erro no job diário')
    }
  }, { timezone: 'America/Sao_Paulo' })

  // Cron domingo 20h — lembrete de reconfiguração semanal
  cron.schedule('0 20 * * 0', async () => {
    try {
      const notificationsService = new NotificationsService(fastify)
      await notificationsService.sendReconfigureReminders()
    } catch (err) {
      fastify.log.error(err, 'cron: erro no lembrete de reconfiguração')
    }
  }, { timezone: 'America/Sao_Paulo' })
})

export default cronPlugin
```

**Padrão de hook onClose** — extraído de `prisma.ts` linhas 15–17 (cleanup no shutdown):
```typescript
fastify.addHook('onClose', async () => {
  // node-cron: tasks são garbage-collected automaticamente — sem cleanup explícito necessário
})
```

---

### `apps/api/src/server.ts` (modificar — config)

**Análogo:** `apps/api/src/server.ts` (existente)

**Padrão de registro de rota** (linhas 82–86):
```typescript
// Phase 3 — Credits & Commerce
await fastify.register(paymentsRoute)
await fastify.register(creditsRoute)
await fastify.register(webhooksRoute)
```

**O que adicionar após as rotas da Fase 3** — copiar o padrão de registro sequencial:
```typescript
// Phase 4 — Scheduling
await fastify.register(schedulesRoute)
await fastify.register(ordersRoute)
await fastify.register(notificationsRoute)
await fastify.register(cronPlugin)   // DEVE vir após prismaPlugin (usa fastify.prisma)
```

**envSchema additions** (linhas 19–42) — adicionar após as vars existentes:
```typescript
ONESIGNAL_APP_ID: { type: 'string' },
ONESIGNAL_REST_API_KEY: { type: 'string' },
```

**Nota:** `ONESIGNAL_APP_ID` e `ONESIGNAL_REST_API_KEY` não devem ser adicionados a `required` — são opcionais para não quebrar o desenvolvimento sem credenciais OneSignal.

---

### `apps/api/prisma/schema.prisma` (modificar — model)

**Análogo:** `apps/api/prisma/schema.prisma` (existente)

**Campo a adicionar ao modelo User:**
```prisma
model User {
  // ... campos existentes ...
  oneSignalPlayerId String?   // NOVO — Phase 4: OneSignal push subscription ID
}
```

**Constraint a adicionar ao modelo Schedule:**
```prisma
model Schedule {
  // ... campos existentes ...
  @@unique([userId, condominiumId])   // NOVO — necessário para upsert via Prisma
}
```

---

### `apps/web/src/pages/client/ScheduleScreen.tsx` (component, request-response)

**Análogo:** `apps/web/src/pages/client/AutoBuyScreen.tsx`

**Imports pattern** (AutoBuyScreen linhas 1–5):
```typescript
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { apiFetch } from '../../lib/apiFetch'
// + import StepperInline do componente reutilizável
import StepperInline from '../../components/client/StepperInline'
```

**Padrão de useEffect para fetch inicial** (AutoBuyScreen linhas 33–49):
```typescript
useEffect(() => {
  const load = async () => {
    try {
      const res = await apiFetch('/schedules/me')
      if (res.ok) {
        const data = await res.json() as Schedule
        // popular estado local com os dados retornados
      }
    } catch {
      // falha silenciosa — inicia com estado padrão (zeros)
    } finally {
      setIsLoading(false)
    }
  }
  load()
}, [])
```

**Padrão de chips de seleção** (AutoBuyScreen linhas 226–270) — chips de horário de entrega seguem exatamente este padrão com `background: var(--color-accent)` quando selecionado:
```typescript
const DELIVERY_TIMES = ['06:30', '07:00', '07:30', '08:00']

{DELIVERY_TIMES.map((time) => (
  <button
    key={time}
    onClick={() => setDeliveryTime(time)}
    style={{
      minHeight: 44,
      padding: '8px 14px',
      borderRadius: 'var(--radius-btn)',
      border: deliveryTime === time
        ? '1.5px solid var(--color-accent)'
        : '1.5px solid var(--color-border)',
      background: deliveryTime === time ? 'var(--color-accent)' : 'var(--color-surface)',
      color: deliveryTime === time ? 'var(--color-primary-btn-text)' : 'var(--color-text)',
      fontFamily: 'var(--font-body)',
      fontWeight: 600,
      fontSize: 13,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }}
  >
    {time}
  </button>
))}
```

**Padrão de toggle** (AutoBuyScreen linhas 113–141) — para toggle `notifyReconfigure`:
```typescript
<button
  onClick={() => setNotifyReconfigure(!notifyReconfigure)}
  aria-label={notifyReconfigure ? 'desativar lembrete' : 'ativar lembrete'}
  style={{
    width: 52, height: 30, borderRadius: 999, border: 'none',
    background: notifyReconfigure ? 'var(--color-accent)' : 'var(--color-border)',
    cursor: 'pointer', position: 'relative', transition: 'background .2s', padding: 0,
  }}
>
  <div style={{
    position: 'absolute', top: 3, left: notifyReconfigure ? 25 : 3,
    width: 24, height: 24, borderRadius: '50%', background: 'white',
    transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
  }} />
</button>
```

**Padrão de CTA fixo acima da tab bar** (CombosScreen linhas 340–402):
```typescript
<div style={{
  position: 'fixed',
  bottom: 'calc(56px + env(safe-area-inset-bottom))',
  left: 0, right: 0,
  padding: '10px 20px 12px',
  background: 'var(--color-app-bg)',
  borderTop: '1px solid var(--color-border-2)',
}}>
  <button
    onClick={handleSave}
    disabled={isSaving}
    style={{
      width: '100%', minHeight: 52,
      borderRadius: 'var(--radius-btn)',
      border: 'none', background: 'var(--color-accent)',
      color: 'var(--color-primary-btn-text)',
      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
      cursor: isSaving ? 'default' : 'pointer',
      opacity: isSaving ? 0.7 : 1,
    }}
  >
    {isSaving ? 'Salvando...' : 'Salvar agenda'}
  </button>
</div>
```

**Padrão de layout principal** (CombosScreen linhas 134–143):
```typescript
<div style={{
  minHeight: 'calc(100dvh - 56px - env(safe-area-inset-bottom))',
  background: 'var(--color-app-bg)',
  display: 'flex', flexDirection: 'column',
}}>
```

**Padrão de título de seção** (AutoBuyScreen linhas 148–157):
```typescript
<p style={{
  fontFamily: 'var(--font-body)',
  fontWeight: 600, fontSize: 12.5, letterSpacing: '0.04em',
  color: 'var(--color-text-sec)', margin: 0,
}}>
  DIAS DA SEMANA
</p>
```

---

### `apps/web/src/pages/client/SingleScreen.tsx` (component, request-response)

**Análogo:** `apps/web/src/pages/client/CombosScreen.tsx` (tela com stepper + CTA fixo + BannerInsuficiente)

**Imports** (CombosScreen linhas 1–8):
```typescript
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { apiFetch } from '../../lib/apiFetch'
import QuantityStepper from '../../components/client/QuantityStepper'
import BannerInsuficiente from '../../components/client/BannerInsuficiente'
```

**Padrão de leitura de saldo do AuthContext** (CombosScreen linhas 115–117):
```typescript
const { user } = useAuth()
const creditBalance = user?.creditBalance ?? 0
```

**Padrão de uso de BannerInsuficiente** (CombosScreen linhas 229–235):
```typescript
{creditBalance < quantity && quantity > 0 && (
  <BannerInsuficiente
    saldo={creditBalance}
    requerido={quantity}
    onComprar={() => navigate('/client/creditos')}
    onAjustar={(qtd) => setQuantity(qtd)}
  />
)}
```

**Padrão de handleSubmit** (CombosScreen linhas 67–113 adaptado):
```typescript
const handleAgendar = async () => {
  if (isSubmitting) return
  setIsSubmitting(true)
  setError(null)
  try {
    const res = await apiFetch('/orders', {
      method: 'POST',
      body: JSON.stringify({ date: selectedDate, quantity }),
    })
    if (res.ok) {
      navigate('/client/agenda', { replace: true })
      // opcional: toast de confirmação
    } else {
      const err = (await res.json()) as { error?: string }
      setError(err.error ?? 'Não foi possível agendar. Tente novamente.')
    }
  } catch {
    setError('Algo deu errado. Verifique sua conexão.')
  } finally {
    setIsSubmitting(false)
  }
}
```

**Padrão de chips de data** — derivado do padrão de chips de dia de semana em AutoBuyScreen linhas 240–268:
```typescript
const CUTOFF_HOUR = 21
const now = new Date()
const isAfterCutoff = now.getHours() >= CUTOFF_HOUR

const dateChips = [
  { label: 'Amanhã', value: getTomorrow(), disabled: isAfterCutoff },
  { label: 'Depois de amanhã', value: getDayAfterTomorrow(), disabled: false },
  // + próximos dias até 5 chips
]

{dateChips.map((chip) => (
  <button
    key={chip.value}
    onClick={() => !chip.disabled && setSelectedDate(chip.value)}
    disabled={chip.disabled}
    style={{
      minHeight: 44, padding: '8px 16px',
      borderRadius: 'var(--radius-btn)',
      border: selectedDate === chip.value
        ? '1.5px solid var(--color-accent)'
        : '1.5px solid var(--color-border)',
      background: selectedDate === chip.value ? 'var(--color-accent)' : 'var(--color-surface)',
      color: selectedDate === chip.value ? 'var(--color-primary-btn-text)' : 'var(--color-text)',
      opacity: chip.disabled ? 0.45 : 1,
      cursor: chip.disabled ? 'default' : 'pointer',
      fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}
  >
    {chip.label}
  </button>
))}
```

---

### `apps/web/src/hooks/useSchedule.ts` (hook, request-response)

**Análogo:** `apps/web/src/hooks/usePaymentPolling.ts`

**Imports e assinatura** (usePaymentPolling linhas 1–9):
```typescript
import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/apiFetch'

export function useSchedule() {
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
```

**Padrão de useEffect para fetch** (usePaymentPolling linhas 12–35):
```typescript
useEffect(() => {
  const load = async () => {
    try {
      const res = await apiFetch('/schedules/me')
      if (res.ok) {
        const data = await res.json() as Schedule
        setSchedule(data)
      }
    } catch {
      setError('Não foi possível carregar a agenda.')
    } finally {
      setIsLoading(false)
    }
  }
  load()
}, [])
```

**Padrão de função de update com apiFetch** — derivado da lógica de submit de AutoBuyScreen:
```typescript
const updateSchedule = useCallback(async (data: UpsertScheduleBody) => {
  const res = await apiFetch('/schedules/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json() as { error?: string }
    throw new Error(err.error ?? 'Erro ao salvar agenda')
  }
  const updated = await res.json() as Schedule
  setSchedule(updated)
  return updated
}, [])

return { schedule, isLoading, error, updateSchedule }
```

---

### `apps/web/src/hooks/useOneSignalRegister.ts` (hook, event-driven)

**Análogo:** `apps/web/src/hooks/useAuth.ts` (hook simples com useContext) e `apps/web/src/main.tsx` (inicialização do OneSignal)

**Padrão de hook simples** (useAuth.ts linhas 1–9):
```typescript
import { useEffect } from 'react'
import OneSignal from 'react-onesignal'
import { apiFetch } from '../lib/apiFetch'

export function useOneSignalRegister() {
  useEffect(() => {
    // Verifica se já tem ID (usuário havia aceitado push antes)
    const existingId = OneSignal.User?.PushSubscription?.id
    if (existingId) {
      apiFetch('/users/push-token', {
        method: 'POST',
        body: JSON.stringify({ playerId: existingId }),
      }).catch(() => {
        // Falha silenciosa — não bloquear o app por falha no registro de push
      })
    }

    // Listener para detectar quando o ID fica disponível
    const handler = (event: { current: { id?: string } }) => {
      const id = event.current?.id
      if (id) {
        apiFetch('/users/push-token', {
          method: 'POST',
          body: JSON.stringify({ playerId: id }),
        }).catch(() => {})
      }
    }
    OneSignal.User?.PushSubscription?.addEventListener('change', handler)
    return () => {
      OneSignal.User?.PushSubscription?.removeEventListener('change', handler)
    }
  }, [])
}
```

**Onde chamar:** Em `ClientLayout.tsx` (análogo: `apps/web/src/pages/client/ClientLayout.tsx` linhas 1–25) — o layout só renderiza após autenticação, garantindo que o token JWT esteja disponível para o `POST /users/push-token`:
```typescript
// Em ClientLayout.tsx:
import { useOneSignalRegister } from '../../hooks/useOneSignalRegister'

export function ClientLayout() {
  useOneSignalRegister()  // ADICIONAR — registro de push token após autenticação
  const { user, isLoading } = useAuth()
  // ... resto existente ...
}
```

---

### `apps/web/src/routes/router.tsx` (modificar — config)

**Análogo:** `apps/web/src/routes/router.tsx` (existente)

**Padrão de rota lazy** (router.tsx linhas 56–61 — rota agenda atual):
```typescript
{
  path: 'agenda',
  lazy: () =>
    import('../pages/client/PlaceholderScreen').then((m) => ({
      Component: m.PlaceholderScreen,
    })),
},
```

**Substituir por** (mesma estrutura, novo componente + sub-rota):
```typescript
{
  path: 'agenda',
  lazy: () =>
    import('../pages/client/ScheduleScreen').then((m) => ({
      Component: m.ScheduleScreen,
    })),
},
{
  path: 'agenda/pedido-unico',
  lazy: () =>
    import('../pages/client/SingleScreen').then((m) => ({
      Component: m.SingleScreen,
    })),
},
```

---

## Shared Patterns

### Autenticação em rotas protegidas
**Fonte:** `apps/api/src/modules/auth/auth.route.ts` linhas 7–21 + `apps/api/src/plugins/authenticate.ts`
**Aplicar a:** Todas as rotas de `schedules`, `orders`, `notifications`
```typescript
// Em TODA rota que requer autenticação:
{ preHandler: [fastify.authenticate] }

// Para acessar o userId do usuário autenticado:
const userId = request.user!.id
```

### Tratamento de erros no controller
**Fonte:** `apps/api/src/modules/credits/credits.controller.ts` linhas 6–10 e 22–27
**Aplicar a:** Todos os controllers da Fase 4
```typescript
// Helper para formatar mensagens Zod:
type ZodIssue = { message: string }
function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

// Estrutura padrão de try/catch em handlers:
try {
  const result = await this.service.metodo(...)
  return reply.status(2xx).send(result)
} catch (err) {
  this.fastify.log.error(err)
  return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
}
```

### Erros de negócio (throw + guard)
**Fonte:** `apps/api/src/modules/payments/payments.controller.ts` linhas 18–31 (guard) + `apps/api/src/modules/credits/credits.service.ts` linhas 33–38 (throw)
**Aplicar a:** `orders.service.ts`, `orders.controller.ts`, `schedules.service.ts`
```typescript
// No service — throw com shape { error, status }:
throw { error: 'Créditos insuficientes', status: 400 }

// No controller — guard distingue erro de negócio de erro inesperado:
if (isBusinessError(err)) {
  return reply.status(err.status).send({ error: err.error })
}
return reply.status(500).send({ error: 'Erro inesperado.' })
```

### Plugin Fastify com fastify-plugin
**Fonte:** `apps/api/src/plugins/prisma.ts` linhas 1–18
**Aplicar a:** `plugins/cron.ts`
```typescript
import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'

const myPlugin: FastifyPluginAsync = fp(async (fastify) => {
  // plugin body
})

export default myPlugin
```

### Acesso ao Prisma no repository
**Fonte:** `apps/api/src/modules/credits/credits.repository.ts` linhas 6–8
**Aplicar a:** `schedules.repository.ts`, `orders.repository.ts`
```typescript
private get prisma() {
  return this.fastify.prisma
}
```

### Pattern de screen React (layout + fetch + CTA)
**Fonte:** `apps/web/src/pages/client/AutoBuyScreen.tsx` + `apps/web/src/pages/client/CombosScreen.tsx`
**Aplicar a:** `ScheduleScreen.tsx`, `SingleScreen.tsx`
```typescript
// Layout wrapper com minHeight e padding seguro:
<div style={{
  minHeight: 'calc(100dvh - 56px - env(safe-area-inset-bottom))',
  background: 'var(--color-app-bg)',
  padding: '20px', display: 'flex', flexDirection: 'column', gap: 24,
}}>

// Tipografia de título de seção:
fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12.5, letterSpacing: '0.04em'

// Tipografia de título principal:
fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 21, letterSpacing: '-0.02em'

// CTA desabilitado:
opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'default' : 'pointer'
```

### Fetch com apiFetch
**Fonte:** `apps/web/src/lib/apiFetch.ts` + `apps/web/src/pages/client/AutoBuyScreen.tsx` linhas 51–80
**Aplicar a:** Todos os hooks e screens da Fase 4
```typescript
// Padrão: apiFetch retorna Response bruta — caller faz .json() e verifica res.ok
const res = await apiFetch('/endpoint', {
  method: 'POST',
  body: JSON.stringify(payload),
})
if (res.ok) {
  const data = await res.json()
  // ...
} else {
  const err = await res.json() as { error?: string }
  setError(err.error ?? 'Algo deu errado.')
}
```

### $transaction para operações atômicas
**Fonte:** `apps/api/src/modules/payments/payments.repository.ts` linhas 35–50
**Aplicar a:** `orders.service.ts` (criar Order + decrementar crédito), `schedules.service.ts` (cron — criar Orders em lote)
```typescript
const [resultado] = await this.fastify.prisma.$transaction([
  this.fastify.prisma.modelo.create({ data: { ... } }),
  this.fastify.prisma.user.update({
    where: { id: userId },
    data: { creditBalance: { decrement: quantidade } },
  }),
  this.fastify.prisma.creditTransaction.create({ data: { ... } }),
])
```

---

## Sem Análogo Direto

Arquivos onde não existe precedente exato no código atual (planner deve usar padrões do RESEARCH.md):

| Arquivo | Role | Data Flow | Motivo |
|---------|------|-----------|--------|
| `apps/api/src/plugins/cron.ts` (lógica interna dos jobs) | plugin | event-driven | Nenhum job de cron existe no projeto. Seguir padrão de plugin Fastify + node-cron conforme RESEARCH.md Seção 1 |
| `apps/api/src/modules/notifications/notifications.service.ts` (envio OneSignal) | service | event-driven | Nenhuma integração OneSignal SDK existe ainda no backend. Seguir padrão de `sendPush` do RESEARCH.md Seção 2 |
| `apps/web/src/hooks/useOneSignalRegister.ts` | hook | event-driven | Nenhum hook de push notifications existe. O análogo mais próximo é a inicialização em `main.tsx` + padrão de `useAuth.ts`. Seguir RESEARCH.md Seção 3 |

---

## Metadata

**Escopo da busca de análogos:**
- `apps/api/src/modules/` — todos os módulos das Fases 1–3
- `apps/api/src/plugins/` — todos os plugins existentes
- `apps/api/src/server.ts` — configuração de startup
- `apps/web/src/pages/client/` — todas as screens existentes
- `apps/web/src/hooks/` — todos os hooks existentes
- `apps/web/src/contexts/` — contextos existentes
- `apps/web/src/routes/router.tsx` — configuração de rotas
- `apps/web/src/main.tsx` — ponto de entrada da app

**Arquivos escaneados:** 28
**Data da extração:** 2026-06-14
