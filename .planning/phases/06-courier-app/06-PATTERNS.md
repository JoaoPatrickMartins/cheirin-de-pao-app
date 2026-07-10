# Phase 6: Courier App — Pattern Map

**Mapeado:** 2026-06-15
**Arquivos analisados:** 17 (13 novos + 4 modificados)
**Análogos encontrados:** 16 / 17

---

## File Classification

| Arquivo novo / modificado | Role | Data Flow | Análogo mais próximo | Qualidade |
|---------------------------|------|-----------|----------------------|-----------|
| `apps/api/src/modules/courier/courier.route.ts` | route | request-response | `apps/api/src/modules/orders/orders.route.ts` | exato |
| `apps/api/src/modules/courier/courier.controller.ts` | controller | request-response | `apps/api/src/modules/orders/orders.controller.ts` | exato |
| `apps/api/src/modules/courier/courier.service.ts` | service | CRUD + request-response | `apps/api/src/modules/admin-orders/admin-orders.service.ts` | exato |
| `apps/api/src/modules/courier/courier.repository.ts` | repository | CRUD | `apps/api/src/modules/orders/orders.repository.ts` | exato |
| `apps/api/src/modules/courier/courier.schema.ts` | config/schema | transform | `apps/api/src/modules/orders/orders.schema.ts` | exato |
| `apps/api/src/modules/courier/__tests__/courier.service.test.ts` | test | batch | `apps/api/src/modules/admin-orders/__tests__/admin-orders.service.test.ts` | exato |
| `prisma/schema.prisma` (modificar) | config | — | `apps/api/prisma/schema.prisma` (o próprio) | n/a |
| `apps/api/src/plugins/authenticate.ts` (modificar) | middleware | request-response | o próprio arquivo | n/a |
| `apps/api/src/modules/admin-orders/admin-orders.route.ts` (modificar) | route | request-response | o próprio arquivo | n/a |
| `apps/web/src/pages/courier/CourierScreen.tsx` | component/page | request-response | `apps/web/src/pages/client/TrackingScreen.tsx` | role-match |
| `apps/web/src/pages/courier/CourierRouteView.tsx` | component/page | request-response | `apps/web/src/pages/client/TrackingScreen.tsx` | role-match |
| `apps/web/src/components/courier/ProgressCard.tsx` | component | — | `apps/web/src/components/client/CreditBalanceCard.tsx` | role-match |
| `apps/web/src/components/courier/SegmentedControl.tsx` | component | — | `apps/web/src/components/client/DateChips.tsx` | role-match |
| `apps/web/src/components/courier/CondoAccordion.tsx` | component | — | `apps/web/src/pages/client/TrackingScreen.tsx` (Timeline) | role-match |
| `apps/web/src/components/courier/StopRow.tsx` | component | — | `apps/web/src/pages/client/TrackingScreen.tsx` (history row) | role-match |
| `apps/web/src/components/courier/ConfirmDeliveryDialog.tsx` | component | request-response | `apps/web/src/pages/client/TrackingScreen.tsx` | partial |
| `apps/web/src/components/courier/CourierMap.tsx` | component | request-response | nenhum análogo no codebase | nenhum |
| `apps/web/src/routes/router.tsx` (modificar) | config | — | o próprio arquivo | n/a |

---

## Pattern Assignments

### `apps/api/src/modules/courier/courier.route.ts` (route, request-response)

**Análogo:** `apps/api/src/modules/orders/orders.route.ts`

**Imports + estrutura** (linhas 1–30 do análogo):
```typescript
import { FastifyPluginAsync } from 'fastify'
import { OrdersController } from './orders.controller.js'

export const ordersRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new OrdersController(fastify)

  fastify.get(
    '/orders/today',
    { preHandler: [fastify.authenticate] },
    ctrl.getTodayOrder.bind(ctrl),
  )

  fastify.patch(
    '/orders/:id/...',
    { preHandler: [fastify.authenticate] },
    ctrl.someMethod.bind(ctrl),
  )
}
```

**Diferença courier:** `preHandler` usa `[fastify.authenticate, fastify.requireCourier]` em ambas as rotas, ao invés de apenas `[fastify.authenticate]`. Nome do export: `courierRoute`.

**Rotas a registrar:**
```typescript
// GET /courier/orders/today
// PATCH /courier/orders/:id/confirm
```

---

### `apps/api/src/modules/courier/courier.controller.ts` (controller, request-response)

**Análogo:** `apps/api/src/modules/orders/orders.controller.ts`

**Imports + classe** (linhas 1–11 do análogo):
```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { CreateOrderSchema } from './orders.schema.js'
import { OrdersService } from './orders.service.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

export class OrdersController {
  private service: OrdersService

  constructor(private fastify: FastifyInstance) {
    this.service = new OrdersService(fastify)
  }
```

**Padrão de handler com userId do JWT** (linhas 56–70 do análogo):
```typescript
async getTodayOrder(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = request.user!.id
    const order = await this.service.getTodayOrder(userId)
    if (!order) return reply.status(404).send({ error: 'Nenhuma entrega hoje' })
    return reply.status(200).send(order)
  } catch (err) {
    this.fastify.log.error(err)
    return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
  }
}
```

**Padrão de handler com params de rota + role check inline** (linhas 34–65 de `admin-orders.controller.ts`):
```typescript
async updateOrderStatus(request: FastifyRequest, reply: FastifyReply) {
  // 1. Role check inline (courier.controller usa courierId em vez de role)
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

**Adaptação para `confirmDelivery`:** o role check inline NÃO é necessário no método (o guard `requireCourier` no preHandler já faz isso). O courierId vem de `request.user!.id` — nunca do body. Retorna `403` se `order.courierId !== request.user.id` (validação no service).

---

### `apps/api/src/modules/courier/courier.service.ts` (service, CRUD + request-response)

**Análogo primário:** `apps/api/src/modules/admin-orders/admin-orders.service.ts`
**Análogo secundário:** `apps/api/src/modules/orders/orders.service.ts` (padrão `getTodayRange`)

**Imports + construtor** (linhas 1–43 de `admin-orders.service.ts`):
```typescript
import { FastifyInstance } from 'fastify'
import * as OneSignal from '@onesignal/node-onesignal'

const VALID_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
}

export class AdminOrdersService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }
```

**Padrão updateOrderStatus reutilizável** (linhas 48–71 de `admin-orders.service.ts`):
```typescript
async updateOrderStatus(orderId: string, newStatus: string): Promise<void> {
  const order = await this.prisma.order.findUnique({ where: { id: orderId } })
  if (!order) {
    throw { statusCode: 404, message: 'Pedido não encontrado' }
  }
  const allowed = VALID_TRANSITIONS[order.status] ?? []
  if (!allowed.includes(newStatus)) {
    throw { statusCode: 422, message: `Transição inválida: ${order.status} → ${newStatus}` }
  }
  await this.prisma.order.update({
    where: { id: orderId },
    data: { status: newStatus as 'OUT_FOR_DELIVERY' | 'DELIVERED' },
  })
  if (newStatus === 'DELIVERED') {
    await this.notifyAndPersist(order)
  }
}
```

**Padrão getTodayRange** (linhas 32–44 de `orders.service.ts`):
```typescript
const BRAZIL_OFFSET_HOURS = 3

function getTodayRange(): { start: Date; end: Date } {
  const nowUTC = Date.now()
  const nowBrazil = nowUTC - BRAZIL_OFFSET_HOURS * 60 * 60 * 1000
  const todayBrazil = new Date(nowBrazil)
  const year = todayBrazil.getUTCFullYear()
  const month = todayBrazil.getUTCMonth()
  const day = todayBrazil.getUTCDate()
  const start = new Date(Date.UTC(year, month, day, BRAZIL_OFFSET_HOURS, 0, 0, 0))
  const end = new Date(Date.UTC(year, month, day + 1, BRAZIL_OFFSET_HOURS - 1, 59, 59, 999))
  return { start, end }
}
```

**Padrão notifyAndPersist reutilizável** (linhas 79–117 de `admin-orders.service.ts`):
```typescript
private async notifyAndPersist(order: {
  id: string; userId: string; quantity: number
}): Promise<void> {
  const user = await this.prisma.user.findUnique({
    where: { id: order.userId },
    select: { oneSignalPlayerId: true },
  })
  // 1. Push best-effort
  if (user?.oneSignalPlayerId) {
    try {
      const osClient = createOsClient()
      const notification = new OneSignal.Notification()
      notification.app_id = process.env.ONESIGNAL_APP_ID!
      notification.include_subscription_ids = [user.oneSignalPlayerId]
      notification.headings = { pt: 'Cheirin de Pão' }
      notification.contents = { pt: `Seus ${order.quantity} pães foram entregues. Bom apetite!` }
      await osClient.createNotification(notification)
    } catch (pushErr) {
      this.fastify.log.warn({ orderId: order.id, err: pushErr }, '[courier] falha ao enviar push — ignorado')
    }
  }
  // 2. Persist obrigatório — fora do try do push
  await this.createAndTrim({ userId: order.userId, type: 'DELIVERY_DONE', ... })
}
```

**Nota de implementação:** `courier.service.ts` importa `AdminOrdersService` diretamente para reutilizar `updateOrderStatus` + `notifyAndPersist`. Não duplicar a lógica. A função `getTodayRange` pode ser duplicada localmente no `courier.service.ts` (Assumption A4 do RESEARCH.md — aceitável no MVP).

---

### `apps/api/src/modules/courier/courier.repository.ts` (repository, CRUD)

**Análogo:** `apps/api/src/modules/orders/orders.repository.ts`

**Estrutura completa** (linhas 1–48 do análogo):
```typescript
import { FastifyInstance } from 'fastify'

export class OrdersRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  async findById(id: string) {
    return this.prisma.order.findUnique({ where: { id } })
  }

  async findByUserId(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { scheduledDate: 'asc' },
    })
  }

  async findTodayByUserId(userId: string, start: Date, end: Date) {
    return this.prisma.order.findFirst({
      where: { userId, scheduledDate: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
    })
  }
}
```

**Métodos a adicionar em `courier.repository.ts`:**
- `findTodayByCourierId(courierId, start, end)` — `findMany` onde `courierId === courierId`, `scheduledDate` no range BRT, `status IN ['SCHEDULED', 'OUT_FOR_DELIVERY']`
- `findById(id)` — reutiliza o mesmo padrão `findUnique`
- `assignCourier(orderIds, courierId)` — `updateMany` (para o endpoint admin, fica em `admin-orders.repository.ts` ou inline no service)

---

### `apps/api/src/modules/courier/courier.schema.ts` (schema, transform)

**Análogo:** `apps/api/src/modules/orders/orders.schema.ts`

**Estrutura** (linhas 1–22 do análogo):
```typescript
import { z } from 'zod'

export const CreateOrderSchema = z.object({
  quantity: z.number().int('Quantidade deve ser inteiro').min(1).max(20),
  scheduledDate: z.string().datetime({ message: 'Data de entrega deve ser uma data/hora ISO válida' }),
})

export type CreateOrderBody = z.infer<typeof CreateOrderSchema>
```

**Schemas a criar em `courier.schema.ts`:**
- `ConfirmDeliveryParams` — `z.object({ id: z.string().min(1) })` para `PATCH /courier/orders/:id/confirm`
- Nenhum body schema para o GET (sem body)

**Schema a adicionar em `admin-orders.schema.ts`:**
```typescript
// Análogo: UpdateOrderStatusSchema (mesma estrutura, body diferente)
export const AssignCourierSchema = z.object({
  courierId: z.string().min(1),
  orderIds: z.array(z.string().min(1)).min(1).optional(),
  condominiumId: z.string().optional(),
  date: z.string().optional(),
})
export type AssignCourierBody = z.infer<typeof AssignCourierSchema>
```

---

### `apps/api/src/modules/courier/__tests__/courier.service.test.ts` (test, batch)

**Análogo:** `apps/api/src/modules/admin-orders/__tests__/admin-orders.service.test.ts`

**Estrutura de mock e describe** (linhas 1–67 do análogo):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdminOrdersService } from '../admin-orders.service.js'

// Mock OneSignal
vi.mock('@onesignal/node-onesignal', () => {
  const createNotificationMock = vi.fn().mockResolvedValue({})
  return {
    createConfiguration: vi.fn().mockReturnValue({}),
    DefaultApi: vi.fn().mockImplementation(() => ({ createNotification: createNotificationMock })),
    Notification: vi.fn().mockImplementation(() => ({ app_id: '', include_subscription_ids: [], headings: {}, contents: {} })),
  }
})

function makeFastifyMock(overrides: { order?: ...; user?: ...; notificationCount?: number } = {}) {
  const prisma = {
    order: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    user:  { findUnique: vi.fn() },
    notification: { create: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
  }
  return {
    fastify: { prisma, log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } } as unknown,
    prisma,
  }
}

describe('CourierService', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('getTodayOrders', () => {
    it('retorna apenas ordens com courierId do entregador logado', ...)
    it('orders sem courierId não aparecem na lista', ...)
  })

  describe('confirmDelivery', () => {
    it('transição SCHEDULED → DELIVERED é válida', ...)
    it('order de outro entregador retorna 403', ...)
  })

  describe('graceful degradation', () => {
    it('retorna route: null quando OSRM falha', ...)
  })
})
```

**Padrão de throw com statusCode** (replicar de admin-orders):
```typescript
// Service throws plain object — controller inspeciona e.statusCode
throw { statusCode: 403, message: 'Acesso negado: esta entrega não pertence a você' }
throw { statusCode: 404, message: 'Pedido não encontrado' }
```

---

### `prisma/schema.prisma` (modificar — adicionar campo em Order)

**Análogo direto:** linha 195–205 do próprio arquivo (modelo Order atual):
```prisma
// 8. Order — pedidos unitários (avulsos ou gerados pelo schedule)
model Order {
  id             String      @id @default(auto()) @map("_id") @db.ObjectId
  userId         String      @db.ObjectId
  type           OrderType
  quantity       Int
  scheduledDate  DateTime
  status         OrderStatus
  deliveryListId String?     @db.ObjectId
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
}
```

**Alterar para:** adicionar `courierId String? @db.ObjectId` após `deliveryListId`.

**Padrão de campo opcional String ObjectId** (referência: `DeliveryList.courierId` linhas 222–228):
```prisma
model DeliveryList {
  ...
  courierId     String?            @db.ObjectId   // ← mesmo padrão
  ...
}
```

**IMPORTANTE:** Após editar o schema, executar `prisma generate` (não `prisma db push` — MongoDB é schemaless para campos opcionais).

---

### `apps/api/src/plugins/authenticate.ts` (modificar — adicionar requireCourier)

**Análogo:** o próprio arquivo, `requireAdmin` pattern (não existe ainda mas segue o mesmo padrão interno).

**Padrão de decorate já existente** (linhas 14–86 do arquivo):
```typescript
// declare module: adicionar requireCourier ao FastifyInstance
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: preHandlerHookHandler
    requireCourier: preHandlerHookHandler   // NOVO
  }
}

// Dentro do plugin:
const requireCourier: preHandlerHookHandler = async (request, reply) => {
  if (request.user?.role !== 'COURIER') {
    return reply.status(403).send({ error: 'Acesso negado: apenas entregadores' })
  }
}

fastify.decorate('requireCourier', requireCourier)
```

**Posição:** adicionar logo após `fastify.decorate('authenticate', authenticate)` (linha 85).

---

### `apps/api/src/modules/admin-orders/admin-orders.route.ts` (modificar — adicionar assign-courier)

**Análogo:** o próprio arquivo (linhas 1–21):
```typescript
export const adminOrdersRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminOrdersController(fastify)

  fastify.patch(
    '/admin/orders/:id/status',
    { preHandler: [fastify.authenticate] },
    ctrl.updateOrderStatus.bind(ctrl),
  )

  // NOVO — adicionar:
  fastify.patch(
    '/admin/orders/assign-courier',
    { preHandler: [fastify.authenticate] },
    ctrl.assignCourier.bind(ctrl),
  )
}
```

**Nota:** `fastify.authenticate` sem `requireAdmin` — o role check ADMIN fica inline no controller `assignCourier`, seguindo o mesmo padrão de `updateOrderStatus`.

---

### `apps/web/src/pages/courier/CourierScreen.tsx` (page, request-response)

**Análogo:** `apps/web/src/pages/client/TrackingScreen.tsx`

**Imports padrão** (linhas 1–7 do análogo):
```typescript
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../../components/brand/Icon'
import { BreadMark } from '../../components/brand/BreadMark'
```

**Padrão de fetch inicial** (linhas 298–320 do análogo):
```typescript
export function TrackingScreen() {
  const navigate = useNavigate()
  const [history, setHistory] = useState<HistoryOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiFetch('/endpoint')
        if (res.ok) {
          setData((await res.json()) as DataType)
        }
      } catch {
        // mantém estado anterior em falha de rede
      } finally {
        setIsLoading(false)
      }
    }
    void fetchData()
  }, [])
```

**Padrão de AppBar com voltar** (linhas 329–367 do análogo):
```typescript
{/* AppBar */}
<div style={{ display: 'flex', alignItems: 'center', padding: '6px 20px 14px', gap: 12 }}>
  <button
    onClick={() => navigate(-1)}
    aria-label="Voltar"
    style={{
      width: 38, height: 38, borderRadius: 12,
      background: 'var(--color-surface-2)', border: 'none',
      display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0,
    }}
  >
    <Icon name="arrowL" size={20} />
  </button>
  <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 21, ... }}>
    Título
  </h1>
</div>
```

**Adaptação para CourierScreen:** header usa `BreadMark` (42px, fundo espresso) em vez de botão voltar. Segmented control substituindo o título. Fundo `var(--color-app-bg)`. Padding lateral: `0 20px`.

---

### `apps/web/src/pages/courier/CourierRouteView.tsx` (page, request-response)

**Análogo:** `apps/web/src/pages/client/TrackingScreen.tsx` (estrutura de lista + cards)

**Padrão de card de item em lista** (linhas 497–558 do análogo):
```typescript
<div style={{
  display: 'flex', gap: 13, padding: 14,
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius-card)',
  alignItems: 'center',
}}>
  <div style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--color-surface-2)', ... }}>
    <Icon name="..." size={21} color="var(--color-accent)" />
  </div>
  <div style={{ flex: 1 }}>
    <p style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14.5, color: 'var(--color-text)', margin: 0 }}>
      Título
    </p>
    <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-ter)', margin: '1px 0 0' }}>
      Subtítulo
    </p>
  </div>
</div>
```

**Nota:** `CourierRouteView` recebe props (dados da rota já carregados no `CourierScreen`) — não faz fetch próprio.

---

### `apps/web/src/components/courier/ProgressCard.tsx` (component)

**Análogo:** `apps/web/src/components/client/CreditBalanceCard.tsx`

**Padrão de card espresso com BreadMark watermark** (linhas 9–50 do análogo):
```typescript
// Card com fundo espresso e BreadMark decorativo
<div style={{ background: 'linear-gradient(135deg, #1E1207, #2E1D0D)', padding: '22px 22px 20px', position: 'relative', overflow: 'hidden' }}>
  {/* BreadMark watermark */}
  <div style={{ position: 'absolute', bottom: -50, right: -30, opacity: 0.1, pointerEvents: 'none' }}>
    <BreadMark size={200} color="#E3AC3F" />
  </div>
  {/* Label uppercase */}
  <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600, color: '#C7B595', letterSpacing: '0.04em', margin: '0 0 8px', textTransform: 'uppercase' }}>
    LABEL
  </p>
  {/* Display number */}
  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 52, color: '#FAF5EC', lineHeight: 1, letterSpacing: '-0.03em' }}>
    {value}
  </span>
</div>
```

**Adaptação para ProgressCard:** fundo sólido `#1E1207` (não gradient). Display 26px (não 52px). Layout flex row: coluna esquerda (PROGRESSO + contador paradas) e coluna direita (pães). Barra de progresso `height: 6px`, `width: ${feitas/total * 100}%`, `transition: width 0.3s ease`. BreadMark `size={130}`, `bottom: -40px`, `right: -16px`, `opacity: 0.12`.

---

### `apps/web/src/components/courier/SegmentedControl.tsx` (component)

**Análogo:** `apps/web/src/components/client/DateChips.tsx`

**Padrão de chip/tab com estado ativo** (linhas 65–100 do análogo):
```typescript
const chipBase: React.CSSProperties = {
  flex: 1, padding: '13px 14px', borderRadius: 16,
  border: '1.5px solid var(--color-border)',
  background: 'var(--color-surface)',
  cursor: 'pointer',
}
const chipActive: React.CSSProperties = {
  ...chipBase,
  border: '1.5px solid var(--color-accent)',
  background: 'var(--color-gold-soft)',
}

// Tab com ícone + label
<button
  style={value === tabKey ? chipActive : chipBase}
  onClick={() => onChange(tabKey)}
>
  <Icon name={icon} size={16} color={value === tabKey ? 'var(--color-accent)' : 'var(--color-text)'} />
  <p style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, ... }}>
    {label}
  </p>
</button>
```

**Adaptação para SegmentedControl:** fundo container `var(--color-surface-2)`, border-radius 13px, padding 4px. Tab ativa: fundo `var(--color-surface)`, sem borda, `shadowSoft`. Tab inativa: fundo transparente, sem borda. Tab altura mínima 44px. Fonte 15px. Ícones `list` e `route` size 17px.

---

### `apps/web/src/components/courier/CondoAccordion.tsx` (component)

**Análogo:** Timeline em `apps/web/src/pages/client/TrackingScreen.tsx` (linhas 198–296) + padrão de card de lista

**Padrão de card de seção clicável** (padrão consolidado do codebase):
```typescript
// Card container
<div style={{
  background: 'var(--color-surface)',
  borderRadius: 22, // var(--radius-card) == 22
  boxShadow: 'var(--shadow-soft)',
  overflow: 'hidden',
}}>
  {/* Header clicável */}
  <button
    onClick={() => onToggle(condoIndex)}
    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', minHeight: 44 }}
    aria-expanded={isOpen}
  >
    {/* Badge numérico dourado */}
    <div style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--color-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: 'var(--color-espresso)' }}>{order}</span>
    </div>
    {/* Nome + subtítulo */}
    <div style={{ flex: 1, textAlign: 'left' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>{condoName}</p>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--color-text-ter)', margin: 0 }}>{subtitle}</p>
    </div>
    {/* Pill + Chevron */}
    <Icon name="chevD" size={18} color="var(--color-text-ter)" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
  </button>

  {/* Conteúdo (condicional) */}
  {isOpen && (
    <div style={{ borderTop: '1px solid var(--color-border-2)' }}>
      {/* paradas */}
    </div>
  )}
</div>
```

**Padrão de Pill** (linhas 92–127 de `TrackingScreen.tsx`):
```typescript
function Pill({ children, tone, dot }: PillProps) {
  const toneStyles = {
    good:    { background: 'var(--color-good-soft)',  color: 'var(--color-good)' },
    neutral: { background: 'var(--color-surface-2)',  color: 'var(--color-text-sec)' },
    gold:    { background: 'var(--color-gold-soft)',  color: 'var(--color-accent)' }, // adicionar
  }
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 99, fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 11.5, ...toneStyles[tone] }}>
      {dot && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-good)' }} />}
      {children}
    </div>
  )
}
```

---

### `apps/web/src/components/courier/StopRow.tsx` (component)

**Análogo:** history row em `apps/web/src/pages/client/TrackingScreen.tsx` (linhas 497–558)

**Padrão de linha de item com estado** (linhas 508–556 do análogo):
```typescript
<div
  key={o.id}
  style={{ display: 'flex', gap: 13, padding: 14, background: 'var(--color-surface)', borderRadius: 'var(--radius-card)', alignItems: 'center' }}
>
  {/* Ícone/badge à esquerda */}
  <div style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--color-surface-2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
    <Icon name="..." size={21} color="var(--color-accent)" />
  </div>
  {/* Texto principal */}
  <div style={{ flex: 1 }}>
    <p style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14.5, color: 'var(--color-text)', margin: 0 }}>...</p>
    <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-ter)', margin: '1px 0 0' }}>...</p>
  </div>
  {/* Badge/status à direita */}
</div>
```

**Adaptação para StopRow:**
- `padding: '12px 16px'`, `minHeight: 44`, `cursor: 'pointer'`
- Toque dispara `onPress(stop)` — não `onClick` em `<div>` — usar `<button>` ou role=button
- Estado confirmado: `textDecoration: 'line-through'`, `opacity: 0.5` no texto do apartamento
- Checkbox 28×28px border-radius 9px (não ícone de seleção)
- Número de ordem: círculo 22×22px, fundo `surface-2`, Bricolage 12px
- Quantidade: Bricolage 15px, cor `var(--color-accent)`

---

### `apps/web/src/components/courier/ConfirmDeliveryDialog.tsx` (component, request-response)

**Análogo parcial:** padrão de botão primary/ghost do codebase (consolidado de `CreditBalanceCard.tsx` linhas 141–189)

**Padrão de botão primary** (linhas 141–162 de `CreditBalanceCard.tsx`):
```typescript
<button
  onClick={onConfirm}
  style={{
    flex: 1, minHeight: 44,
    background: 'var(--color-espresso)',
    color: 'var(--color-primary-btn-text)',
    borderRadius: 'var(--radius-btn)',
    fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700,
    border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '13px 18px',
    transition: 'transform 0.15s, filter 0.15s',
  }}
>
  Confirmar entrega
</button>
```

**Padrão de botão ghost:**
```typescript
<button style={{
  flex: 1, minHeight: 44,
  background: 'transparent',
  color: 'var(--color-text)',
  borderRadius: 'var(--radius-btn)',
  fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 700,
  border: '1.5px solid var(--color-border)',
  cursor: 'pointer',
}}>
  Cancelar
</button>
```

**Estrutura do Dialog (sem análogo exato):**
```typescript
// Backdrop
<div
  role="dialog"
  aria-modal="true"
  onClick={onClose}  // fecha ao clicar fora
  style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
>
  {/* Card interno — stopPropagation para não fechar ao clicar dentro */}
  <div
    onClick={(e) => e.stopPropagation()}
    style={{ background: 'var(--color-surface)', borderRadius: 22, padding: 24, width: '100%', maxWidth: 320 }}
  >
    ...botões...
  </div>
</div>
```

**Estado de loading no botão confirmar:**
```typescript
<button
  disabled={isLoading}
  style={{ ..., opacity: isLoading ? 0.6 : 1, cursor: isLoading ? 'wait' : 'pointer' }}
>
  {isLoading ? 'Confirmando...' : 'Confirmar entrega'}
</button>
```

---

### `apps/web/src/components/courier/CourierMap.tsx` (component, request-response)

**Análogo:** NENHUM no codebase — primeiro componente com react-leaflet.

Ver seção **No Analog Found** abaixo. Usar exemplos do RESEARCH.md diretamente.

---

### `apps/web/src/routes/router.tsx` (modificar — adicionar sub-rotas /courier)

**Análogo:** padrão `/client` com children (linhas 28–119 do próprio arquivo):
```typescript
{
  path: '/client',
  lazy: () => import('../pages/client/ClientLayout').then((m) => ({ Component: m.ClientLayout })),
  children: [
    {
      index: true,
      lazy: () => import('../pages/client/HomeScreen').then((m) => ({ Component: m.HomeScreen })),
    },
    {
      path: 'home',
      lazy: () => import('../pages/client/HomeScreen').then((m) => ({ Component: m.HomeScreen })),
    },
  ],
},
```

**Adaptação para /courier** (modificar bloco existente nas linhas 121–126):
```typescript
// ANTES (linhas 121–126):
{
  path: '/courier',
  lazy: () => import('../pages/courier/CourierLayout').then((m) => ({ Component: m.CourierLayout })),
},

// DEPOIS:
{
  path: '/courier',
  lazy: () => import('../pages/courier/CourierLayout').then((m) => ({ Component: m.CourierLayout })),
  children: [
    {
      index: true,
      lazy: () => import('../pages/courier/CourierScreen').then((m) => ({ Component: m.CourierScreen })),
    },
  ],
},
```

---

## Shared Patterns

### Autenticação via JWT
**Fonte:** `apps/api/src/plugins/authenticate.ts` (linhas 21–84)
**Aplicar a:** todos os handlers do `courier.controller.ts`

```typescript
// userId extraído do JWT — NUNCA do body ou params não validados
const userId = request.user!.id  // request.user sempre populado após preHandler authenticate
```

### Erro estruturado do service (throw plain object)
**Fonte:** `apps/api/src/modules/admin-orders/admin-orders.service.ts` (linhas 53–58) e `apps/api/src/modules/orders/orders.service.ts`
**Aplicar a:** `courier.service.ts` — todos os throws

```typescript
throw { statusCode: 404, message: 'Pedido não encontrado' }
throw { statusCode: 403, message: 'Acesso negado: esta entrega não pertence a você' }
throw { statusCode: 422, message: `Transição inválida: ${order.status} → DELIVERED` }
```

### Inspeção de erro no controller
**Fonte:** `apps/api/src/modules/admin-orders/admin-orders.controller.ts` (linhas 55–65)
**Aplicar a:** `courier.controller.ts`

```typescript
} catch (err) {
  this.fastify.log.error(err)
  const e = err as { statusCode?: number; message?: string }
  if (e.statusCode === 403) return reply.status(403).send({ error: e.message })
  if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
  if (e.statusCode === 422) return reply.status(422).send({ error: e.message })
  return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
}
```

### Validação Zod no controller
**Fonte:** `apps/api/src/modules/admin-orders/admin-orders.controller.ts` (linhas 41–50)
**Aplicar a:** `courier.controller.ts` — handler confirmDelivery

```typescript
function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

let params: ReturnType<typeof ConfirmDeliveryParams.parse>
try {
  params = ConfirmDeliveryParams.parse(request.params)
} catch (err) {
  if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
  return reply.status(400).send({ error: 'Dados inválidos.' })
}
```

### apiFetch no frontend
**Fonte:** `apps/web/src/lib/apiFetch.ts`
**Aplicar a:** `CourierScreen.tsx`, `ConfirmDeliveryDialog.tsx`

```typescript
import { apiFetch } from '../../lib/apiFetch'

// Uso padrão
const res = await apiFetch('/courier/orders/today')
if (res.ok) { setData(await res.json()) }

// PATCH com body
const res = await apiFetch(`/courier/orders/${orderId}/confirm`, { method: 'PATCH' })
```

### Tokens de tipografia inline
**Fonte:** `apps/web/src/pages/client/TrackingScreen.tsx` (linhas 155–185, 265–290)
**Aplicar a:** todos os componentes courier

```typescript
// Display/títulos
fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em'
fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em'

// Body/labels
fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12, letterSpacing: '0.04em'
fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em'
```

### Tokens de cor
**Fonte:** `apps/web/src/pages/client/TrackingScreen.tsx` (linhas 95–127) + `CreditBalanceCard.tsx`
**Aplicar a:** todos os componentes courier

```typescript
// Espresso card (ProgressCard)
background: '#1E1207'   // ou 'var(--color-espresso)'
color: '#FAF5EC'        // texto principal no espresso
color: '#E3AC3F'        // gold / --color-gold
color: '#C7B595'        // textSec no espresso

// Surface cards (CondoAccordion, StopRow, CourierRouteView list)
background: 'var(--color-surface)'
borderRadius: 22        // ou 'var(--radius-card)'
boxShadow: 'var(--shadow-soft)'

// Estados de confirmação
color: 'var(--color-good)'       // check verde
background: 'var(--color-good-soft)' // fundo pill "Ok"
```

### Push best-effort com OneSignal
**Fonte:** `apps/api/src/modules/admin-orders/admin-orders.service.ts` (linhas 89–107)
**Aplicar a:** `courier.service.ts` — confirmDelivery reutiliza `AdminOrdersService.updateOrderStatus` que já chama `notifyAndPersist` internamente — sem duplicar.

---

## No Analog Found

| Arquivo | Role | Data Flow | Razão |
|---------|------|-----------|-------|
| `apps/web/src/components/courier/CourierMap.tsx` | component | request-response | Primeiro componente com react-leaflet no projeto. Usar padrões do RESEARCH.md seções "Padrão 3 e 4" + "Code Examples Exemplo 3" diretamente. Pontos críticos: `import 'leaflet/dist/leaflet.css'` obrigatório; marcadores como `L.DivIcon` com `className: ''`; `FitBounds` como componente filho usando `useMap()`. |

---

## Metadata

**Escopo da busca de análogos:** `apps/api/src/modules/`, `apps/api/src/plugins/`, `apps/api/prisma/`, `apps/web/src/pages/`, `apps/web/src/components/`, `apps/web/src/routes/`, `apps/web/src/hooks/`, `apps/web/src/lib/`
**Arquivos escaneados:** ~30 arquivos TypeScript/TSX
**Data do mapeamento:** 2026-06-15
