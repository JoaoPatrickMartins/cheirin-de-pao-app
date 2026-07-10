# Phase 7: Admin Panel — Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 35 (novos + modificados)
**Analogs found:** 33 / 35

---

## File Classification

| Arquivo Novo / Modificado | Role | Data Flow | Analog Mais Próximo | Match |
|---------------------------|------|-----------|---------------------|-------|
| `apps/api/src/modules/admin-settings/admin-settings.route.ts` | route | request-response | `apps/api/src/modules/admin-orders/admin-orders.route.ts` | exact |
| `apps/api/src/modules/admin-settings/admin-settings.controller.ts` | controller | request-response | `apps/api/src/modules/admin-orders/admin-orders.controller.ts` | exact |
| `apps/api/src/modules/admin-settings/admin-settings.service.ts` | service | CRUD | `apps/api/src/modules/notifications/notifications.service.ts` | role-match |
| `apps/api/src/modules/admin-settings/admin-settings.schema.ts` | schema | — | `apps/api/src/modules/admin-orders/admin-orders.schema.ts` | exact |
| `apps/api/src/modules/admin-supplier-orders/admin-supplier-orders.route.ts` | route | request-response | `apps/api/src/modules/admin-orders/admin-orders.route.ts` | exact |
| `apps/api/src/modules/admin-supplier-orders/admin-supplier-orders.controller.ts` | controller | request-response | `apps/api/src/modules/admin-orders/admin-orders.controller.ts` | exact |
| `apps/api/src/modules/admin-supplier-orders/admin-supplier-orders.service.ts` | service | file-I/O + CRUD | `apps/api/src/modules/payments/payments.service.ts` | role-match |
| `apps/api/src/modules/admin-financial/admin-financial.route.ts` | route | request-response | `apps/api/src/modules/admin-orders/admin-orders.route.ts` | exact |
| `apps/api/src/modules/admin-financial/admin-financial.controller.ts` | controller | request-response | `apps/api/src/modules/admin-orders/admin-orders.controller.ts` | exact |
| `apps/api/src/modules/admin-financial/admin-financial.service.ts` | service | batch/aggregate | `apps/api/src/modules/orders/orders.repository.ts` | partial |
| `apps/api/src/modules/admin-clients/admin-clients.route.ts` | route | request-response | `apps/api/src/modules/admin-orders/admin-orders.route.ts` | exact |
| `apps/api/src/modules/admin-clients/admin-clients.controller.ts` | controller | request-response | `apps/api/src/modules/admin-orders/admin-orders.controller.ts` | exact |
| `apps/api/src/modules/admin-clients/admin-clients.service.ts` | service | CRUD | `apps/api/src/modules/admin-orders/admin-orders.service.ts` | role-match |
| `apps/api/src/modules/admin-condominiums/admin-condominiums.route.ts` | route | request-response | `apps/api/src/modules/admin-orders/admin-orders.route.ts` | exact |
| `apps/api/src/modules/admin-condominiums/admin-condominiums.controller.ts` | controller | CRUD | `apps/api/src/modules/admin-orders/admin-orders.controller.ts` | exact |
| `apps/api/src/modules/admin-combos/admin-combos.route.ts` | route | request-response | `apps/api/src/modules/admin-orders/admin-orders.route.ts` | exact |
| `apps/api/src/modules/admin-combos/admin-combos.controller.ts` | controller | CRUD | `apps/api/src/modules/admin-orders/admin-orders.controller.ts` | exact |
| `apps/api/src/modules/admin-suppliers/admin-suppliers.route.ts` | route | request-response | `apps/api/src/modules/admin-orders/admin-orders.route.ts` | exact |
| `apps/api/src/modules/admin-suppliers/admin-suppliers.controller.ts` | controller | CRUD | `apps/api/src/modules/admin-orders/admin-orders.controller.ts` | exact |
| `apps/api/src/modules/admin-couriers/admin-couriers.route.ts` | route | request-response | `apps/api/src/modules/admin-orders/admin-orders.route.ts` | exact |
| `apps/api/src/modules/admin-couriers/admin-couriers.controller.ts` | controller | CRUD | `apps/api/src/modules/admin-orders/admin-orders.controller.ts` | exact |
| `apps/api/src/modules/admin-payments/admin-payments.route.ts` | route | request-response | `apps/api/src/modules/payments/payments.route.ts` | exact |
| `apps/api/src/modules/admin-payments/admin-payments.controller.ts` | controller | request-response | `apps/api/src/modules/admin-orders/admin-orders.controller.ts` | exact |
| `apps/api/src/modules/admin-payments/admin-payments.service.ts` | service | request-response | `apps/api/src/modules/payments/payments.service.ts` | exact |
| `apps/api/src/plugins/cron.ts` (modificar) | plugin | event-driven | si mesmo (cron.ts já existe) | exact |
| `apps/api/src/server.ts` (modificar) | config | — | si mesmo (server.ts já existe) | exact |
| `apps/web/src/pages/admin/AdminLayout.tsx` (substituir) | layout | request-response | `apps/web/src/pages/client/ClientLayout.tsx` | role-match |
| `apps/web/src/components/admin/AdminBottomNav.tsx` | component | — | `apps/web/src/components/client/ClientTabBar.tsx` | exact |
| `apps/web/src/components/admin/SegmentedControl.tsx` | component | — | `apps/web/src/components/courier/SegmentedControl.tsx` | exact |
| `apps/web/src/pages/admin/tabs/AdminPainel.tsx` | page | request-response | `apps/web/src/pages/courier/CourierScreen.tsx` | role-match |
| `apps/web/src/pages/admin/tabs/AdminClientes.tsx` | page | CRUD | `apps/web/src/pages/courier/CourierScreen.tsx` | role-match |
| `apps/web/src/pages/admin/tabs/AdminGestao.tsx` | page | CRUD | `apps/web/src/pages/client/CombosScreen.tsx` | partial |
| `apps/web/src/pages/admin/gestao/forms/*.tsx` | form component | CRUD | `apps/web/src/pages/client/CombosScreen.tsx` | partial |
| `apps/api/src/modules/admin-*/admin-*.repository.ts` (vários) | repository | CRUD | `apps/api/src/modules/payments/payments.repository.ts` | exact |
| `apps/api/src/modules/admin-*/admin-*.schema.ts` (vários) | schema | — | `apps/api/src/modules/admin-orders/admin-orders.schema.ts` | exact |

---

## Pattern Assignments

### API — Módulos Admin (route → controller → service → repository)

**Analog:** `apps/api/src/modules/admin-orders/admin-orders.route.ts`

**Padrão de rota** (linhas 1–29 completas):
```typescript
import { FastifyPluginAsync } from 'fastify'
import { AdminCondominiumsController } from './admin-condominiums.controller.js'

export const adminCondominiumsRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminCondominiumsController(fastify)

  fastify.get(
    '/admin/condominiums',
    { preHandler: [fastify.authenticate] },
    ctrl.list.bind(ctrl),
  )
  fastify.post(
    '/admin/condominiums',
    { preHandler: [fastify.authenticate] },
    ctrl.create.bind(ctrl),
  )
  fastify.patch(
    '/admin/condominiums/:id',
    { preHandler: [fastify.authenticate] },
    ctrl.update.bind(ctrl),
  )
  fastify.delete(
    '/admin/condominiums/:id',
    { preHandler: [fastify.authenticate] },
    ctrl.remove.bind(ctrl),
  )
}
```

**Regra crítica:** `preHandler: [fastify.authenticate]` na rota; role check `ADMIN` inline no controller. NUNCA colocar role check no preHandler.

---

### `admin-orders.controller.ts` — Padrão de Controller Admin

**Analog:** `apps/api/src/modules/admin-orders/admin-orders.controller.ts`

**Imports** (linhas 1–5):
```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { CreateCondominiumSchema } from './admin-condominiums.schema.js'
import { AdminCondominiumsService } from './admin-condominiums.service.js'
```

**Role check inline + Zod + service call** (linhas 35–66 do analog):
```typescript
export class AdminCondominiumsController {
  private service: AdminCondominiumsService

  constructor(private fastify: FastifyInstance) {
    this.service = new AdminCondominiumsService(fastify)
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    // 1. Role check inline — NUNCA no preHandler
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    try {
      const result = await this.service.list()
      return reply.status(200).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    if (request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
    }

    // 2. Validação Zod do body
    let body: ReturnType<typeof CreateCondominiumSchema.parse>
    try {
      body = CreateCondominiumSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({ error: zodMessage(err) })
      }
      return reply.status(400).send({ error: 'Dados inválidos.' })
    }

    // 3. Chamar service
    try {
      const result = await this.service.create(body)
      return reply.status(201).send(result)
    } catch (err) {
      this.fastify.log.error(err)
      const e = err as { statusCode?: number; message?: string }
      if (e.statusCode === 400) return reply.status(400).send({ error: e.message })
      return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
    }
  }
}
```

**zodMessage helper** (linhas 7–10 do analog — copiar em todo controller):
```typescript
type ZodIssue = { message: string }
function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}
```

---

### `admin-orders.schema.ts` — Padrão de Schema Zod

**Analog:** `apps/api/src/modules/admin-orders/admin-orders.schema.ts`

**Padrão completo** (linhas 1–35):
```typescript
import { z } from 'zod'

export const CreateCondominiumSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  address: z.string().min(1, 'Endereço é obrigatório'),
  type: z.enum(['SINGLE', 'BLOCKS'], {
    errorMap: () => ({ message: 'Tipo inválido. Use SINGLE ou BLOCKS.' }),
  }),
  blockCount: z.number().int().min(1).optional(),
})

export type CreateCondominiumBody = z.infer<typeof CreateCondominiumSchema>

export const UpdateCondominiumSchema = CreateCondominiumSchema.partial()
export type UpdateCondominiumBody = z.infer<typeof UpdateCondominiumSchema>
```

---

### `payments.repository.ts` — Padrão de Repository

**Analog:** `apps/api/src/modules/payments/payments.repository.ts` (linhas 1–53 completas)

**Padrão** (linhas 1–12):
```typescript
import { FastifyInstance } from 'fastify'

export class AdminCondominiumsRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  findAll() {
    return this.prisma.condominium.findMany({ orderBy: { name: 'asc' } })
  }

  findById(id: string) {
    return this.prisma.condominium.findUnique({ where: { id } })
  }

  create(data: { name: string; address: string; type: string; blockCount?: number }) {
    return this.prisma.condominium.create({ data })
  }

  update(id: string, data: Partial<{ name: string; address: string; type: string; blockCount: number }>) {
    return this.prisma.condominium.update({ where: { id }, data })
  }

  remove(id: string) {
    return this.prisma.condominium.delete({ where: { id } })
  }
}
```

---

### `admin-orders.service.ts` — Padrão de Service Admin

**Analog:** `apps/api/src/modules/admin-orders/admin-orders.service.ts`

**Estrutura do service** (linhas 35–55):
```typescript
export class AdminCondominiumsService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  async list() {
    return this.prisma.condominium.findMany({ orderBy: { name: 'asc' } })
  }

  async create(data: CreateCondominiumBody) {
    return this.prisma.condominium.create({ data })
  }

  async update(id: string, data: UpdateCondominiumBody) {
    const existing = await this.prisma.condominium.findUnique({ where: { id } })
    if (!existing) throw { statusCode: 404, message: 'Condomínio não encontrado' }
    return this.prisma.condominium.update({ where: { id }, data })
  }

  async remove(id: string) {
    const existing = await this.prisma.condominium.findUnique({ where: { id } })
    if (!existing) throw { statusCode: 404, message: 'Condomínio não encontrado' }
    return this.prisma.condominium.delete({ where: { id } })
  }
}
```

**Padrão de erro tipado no service** (linhas 57–60 do analog):
```typescript
// Lança erro com statusCode para o controller capturar e mapear para HTTP status
throw { statusCode: 404, message: 'Pedido não encontrado' }
throw { statusCode: 422, message: `Transição inválida: ${current} → ${next}` }
throw { statusCode: 400, message: 'Informe orderIds ou condominiumId+date' }
```

---

### `admin-payments.service.ts` — Padrão de Estorno Mercado Pago

**Analog:** `apps/api/src/modules/payments/payments.service.ts` (linhas 1–18 para imports/construtor)

**Imports e instanciação MP** (linhas 1–17 do analog, adaptado):
```typescript
import { FastifyInstance } from 'fastify'
import { MercadoPagoConfig, PaymentRefund } from 'mercadopago'
// ATENÇÃO: classe é PaymentRefund (não Payment) — ver RESEARCH.md Pitfall 2

export class AdminPaymentsService {
  private mpClient: MercadoPagoConfig
  private refundApi: PaymentRefund

  constructor(private fastify: FastifyInstance) {
    this.mpClient = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN!,
      options: { timeout: 5000 },
    })
    this.refundApi = new PaymentRefund(this.mpClient)
  }

  private get prisma() {
    return this.fastify.prisma
  }
```

**Padrão de transação Prisma** (de `payments.repository.ts` linhas 35–51):
```typescript
// $transaction para atomicidade: debitar crédito + atualizar status
const [, updatedUser] = await this.prisma.$transaction([
  this.prisma.payment.update({ where: { id }, data: { status: 'REFUNDED' } }),
  this.prisma.creditTransaction.create({
    data: {
      userId,
      type: 'REFUND',
      quantity: -creditsToDebit,
      referenceId: id,
      description: `Estorno de ${creditsToDebit} crédito(s)`,
    },
  }),
  this.prisma.user.update({
    where: { id: userId },
    data: { creditBalance: { decrement: creditsToDebit } },
  }),
])
```

---

### `cron.ts` (modificar) — Padrão de Cron Job

**Analog:** `apps/api/src/plugins/cron.ts` (linhas 1–74 completas)

**Padrão de novo schedule** (linhas 18–37 do analog como referência):
```typescript
// Cron 4 — verificação de cutoff a cada hora cheia (America/Sao_Paulo)
// Adicionar APÓS o cron 3 existente, ANTES do log final
const adminSettingsService = new AdminSettingsService(fastify)

cron.schedule(
  '0 * * * *',   // todo XX:00
  async () => {
    fastify.log.info('[cron] verificando cutoff')
    try {
      await adminSettingsService.processCutoff()
      fastify.log.info('[cron] processCutoff concluído')
    } catch (err) {
      fastify.log.error({ err }, '[cron] erro no processCutoff — servidor mantido ativo')
    }
  },
  { timezone: 'America/Sao_Paulo', name: 'cutoff-check' },
)
```

**Guard NODE_ENV='test'** (linha 8 do analog — OBRIGATÓRIO):
```typescript
if (process.env.NODE_ENV === 'test') {
  fastify.log.info('[cron] ambiente de teste — crons não registrados')
  return
}
```

---

### `server.ts` (modificar) — Registro de Módulos

**Analog:** `apps/api/src/server.ts` (linhas 8–20 para imports; linhas 96–102 para registros)

**Padrão de import** (linhas 8–18 do analog):
```typescript
import { adminCondominiumsRoute } from './modules/admin-condominiums/admin-condominiums.route.js'
import { adminCombosRoute } from './modules/admin-combos/admin-combos.route.js'
import { adminSuppliersRoute } from './modules/admin-suppliers/admin-suppliers.route.js'
import { adminCouriersRoute } from './modules/admin-couriers/admin-couriers.route.js'
import { adminClientsRoute } from './modules/admin-clients/admin-clients.route.js'
import { adminFinancialRoute } from './modules/admin-financial/admin-financial.route.js'
import { adminSupplierOrdersRoute } from './modules/admin-supplier-orders/admin-supplier-orders.route.js'
import { adminPaymentsRoute } from './modules/admin-payments/admin-payments.route.js'
import { adminSettingsRoute } from './modules/admin-settings/admin-settings.route.js'
```

**Padrão de registro** (linhas 98–102 do analog):
```typescript
// Phase 7 — Admin Panel
await fastify.register(adminCondominiumsRoute)
await fastify.register(adminCombosRoute)
await fastify.register(adminSuppliersRoute)
// ... demais módulos
```

---

### `AdminLayout.tsx` (substituir) — Layout com Estado Interno de Aba

**Analog:** `apps/web/src/pages/client/ClientLayout.tsx` (linhas 1–28 completas)
**Diferença crítica (D-01):** AdminLayout usa estado interno em vez de `<Outlet />` para as 5 abas. A rota `/admin` não tem sub-rotas no React Router para as abas.

**Padrão base** (de ClientLayout.tsx, linhas 1–28):
```typescript
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { LoadingScreen } from '../auth/LoadingScreen'
import { Navigate } from 'react-router'
import { AdminBottomNav } from '../../components/admin/AdminBottomNav'
import { AdminPainel } from './tabs/AdminPainel'
import { AdminPedido } from './tabs/AdminPedido'
import { AdminEntregas } from './tabs/AdminEntregas'
import { AdminClientes } from './tabs/AdminClientes'
import { AdminGestao } from './tabs/AdminGestao'

type AdminTab = 'painel' | 'pedido' | 'entregas' | 'clientes' | 'gestao'

export function AdminLayout() {
  const { user, isLoading } = useAuth()
  const [tab, setTab] = useState<AdminTab>('painel')

  if (isLoading) return <LoadingScreen />
  if (!user || user.role !== 'ADMIN') return <Navigate to="/" replace />

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--color-app-bg)',
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: 'calc(56px + env(safe-area-inset-bottom))',
      }}
    >
      {tab === 'painel' && <AdminPainel onNavigate={setTab} />}
      {tab === 'pedido' && <AdminPedido />}
      {tab === 'entregas' && <AdminEntregas />}
      {tab === 'clientes' && <AdminClientes />}
      {tab === 'gestao' && <AdminGestao />}
      <AdminBottomNav activeTab={tab} onTabChange={setTab} />
    </div>
  )
}
```

---

### `AdminBottomNav.tsx` — Navegação Inferior Admin

**Analog:** `apps/web/src/components/client/ClientTabBar.tsx` (linhas 1–85 completas)
**Diferença:** AdminBottomNav usa estado interno (`activeTab` prop) em vez de `useLocation`. Ícones e labels diferentes (ver UI-SPEC).

**Padrão de imports e TABS** (linhas 1–15 do analog):
```typescript
import { Icon, Ic } from '../brand/Icon'

type AdminTab = 'painel' | 'pedido' | 'entregas' | 'clientes' | 'gestao'

interface TabItem {
  key: AdminTab
  label: string
  icon: keyof typeof Ic
}

const TABS: TabItem[] = [
  { key: 'painel',    label: 'Painel',    icon: 'trend'     },
  { key: 'pedido',    label: 'Pedido',    icon: 'factory'   },
  { key: 'entregas',  label: 'Entregas',  icon: 'truck'     },
  { key: 'clientes',  label: 'Clientes',  icon: 'users'     },
  { key: 'gestao',    label: 'Gestão',    icon: 'settings'  },
]
```

**Padrão de nav + botão** (linhas 22–84 do analog, adaptado):
```typescript
export function AdminBottomNav({
  activeTab,
  onTabChange,
}: {
  activeTab: AdminTab
  onTabChange: (tab: AdminTab) => void
}) {
  return (
    <nav
      role="navigation"
      aria-label="Navegação administrativa"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border-2)',
        display: 'flex',
        alignItems: 'stretch',
        padding: '8px 6px calc(8px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
            style={{
              flex: 1,
              minHeight: 44,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '5px 0',
            }}
          >
            <Icon
              name={tab.icon}
              size={22}
              stroke={isActive ? 2.3 : 2}
              color={isActive ? 'var(--color-accent)' : 'var(--color-text-ter)'}
            />
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 10,
                fontWeight: isActive ? 700 : 600,
                color: isActive ? 'var(--color-accent)' : 'var(--color-text-ter)',
                lineHeight: 1,
              }}
            >
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
```

---

### `SegmentedControl.tsx` (admin) — Controle Segmentado Reutilizável

**Analog:** `apps/web/src/components/courier/SegmentedControl.tsx` (linhas 1–60 completas)
**Diferença:** a versão admin usa tipo genérico para suportar múltiplos usos (Hoje/Histórico, Dia/Semana/Mês).

**Padrão de componente** (linhas 1–59 do analog, adaptado com generic):
```typescript
interface Tab<T extends string> {
  key: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  tabs: Tab<T>[]
  value: T
  onChange: (v: T) => void
}

export function SegmentedControl<T extends string>({
  tabs,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div
      style={{
        background: 'var(--color-surface-2)',
        borderRadius: 13,
        padding: 4,
        display: 'flex',
        gap: 4,
      }}
    >
      {tabs.map((tab) => {
        const isActive = value === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              flex: 1,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: 'pointer',
              borderRadius: 10,
              background: isActive ? 'var(--color-surface)' : 'transparent',
              boxShadow: isActive ? 'var(--shadow-soft)' : 'none',
              transition: 'background 0.15s ease, box-shadow 0.15s ease',
              fontFamily: 'var(--font-body)',
              fontSize: 13.5,
              fontWeight: 700,
              color: isActive ? 'var(--color-text)' : 'var(--color-text-sec)',
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
```

---

### Telas das Abas (AdminPainel, AdminPedido, etc.) — Padrão de Tela com Estado

**Analog:** `apps/web/src/pages/courier/CourierScreen.tsx` (linhas 1–252 completas)

**Padrão de imports + estados + useEffect + apiFetch** (linhas 1–62):
```typescript
import { useState, useEffect } from 'react'
import { apiFetch } from '../../../lib/apiFetch'
import { AdminHead } from '../../../components/admin/AdminHead'
import { BreadMark } from '../../../components/brand/BreadMark'

interface DashboardData {
  breadsTodayCount: number
  revenueToday: number
  clientsCount: number
  condominiumsCount: number
}

export function AdminPainel({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiFetch('/admin/dashboard')
        if (res.ok) {
          setData((await res.json()) as DashboardData)
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

**Padrão de AdminHead** (extraído de CourierScreen.tsx linhas 90–130 como referência estrutural):
```typescript
// Avatar espresso 42×42px com BreadMark dourado — componente reutilizável AdminHead
<div
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '4px 20px 14px',
  }}
>
  <div
    style={{
      width: 42,
      height: 42,
      borderRadius: 13,
      background: '#1E1207',       // --color-espresso
      display: 'grid',
      placeItems: 'center',
      flexShrink: 0,
    }}
  >
    <BreadMark size={27} color="#E3AC3F" aria-label="Cheirin de Pão" />
  </div>
  <div>
    <p style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 600,
                color: 'var(--color-text-ter)', margin: 0 }}>
      {sub}
    </p>
    <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20,
                 letterSpacing: '-0.02em', color: 'var(--color-text)', margin: 0 }}>
      {titulo}
    </h1>
  </div>
</div>
```

---

### Telas com Sub-estado (AdminClientes, AdminGestao) — Padrão de Stack Interno

**Analog:** `apps/web/src/pages/client/CombosScreen.tsx` (linhas 27–66 para padrão de tab/sub state)

**Padrão de sub-estado por aba (D-02)** (adaptado de CombosScreen.tsx linhas 32–35):
```typescript
type AdminClientesSub = null | 'detalhe'

export function AdminClientes() {
  const [sub, setSub] = useState<AdminClientesSub>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filtroCondominio, setFiltroCondominio] = useState<string | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // sub === null → lista
  // sub === 'detalhe' → detalhe do cliente selecionado
  if (sub === 'detalhe' && selectedId) {
    return (
      <ClientDetailView
        clienteId={selectedId}
        onBack={() => { setSub(null); setSelectedId(null) }}
      />
    )
  }

  return (
    // ... lista de clientes
  )
}
```

**Padrão de sub-estado para CRUD (AdminGestao, D-03):**
```typescript
type AdminGestaoSub = null | 'combos' | 'avulso' | 'fornecedores' |
                      'entregadores' | 'condos' | 'pagamentos' | 'financeiro'

export function AdminGestao() {
  const [sub, setSub] = useState<AdminGestaoSub>(null)

  if (sub !== null) {
    // Sub-tela substitui o hub completamente
    return <SubTelaPorSub sub={sub} onBack={() => setSub(null)} />
  }

  // Hub: lista de 7 cards de acesso
  return ( /* ... */ )
}
```

**Sub-estado de CRUD em sub-telas (CRUD forms, D-03):**
```typescript
type SubTelaSub = null | 'criar' | 'editar'

export function AdminCondos({ onBack }: { onBack: () => void }) {
  const [sub, setSub] = useState<SubTelaSub>(null)
  const [editId, setEditId] = useState<string | null>(null)

  if (sub === 'criar') {
    return <CondoForm onBack={() => setSub(null)} onSaved={() => setSub(null)} />
  }
  if (sub === 'editar' && editId) {
    return <CondoForm id={editId} onBack={() => setSub(null)} onSaved={() => setSub(null)} />
  }

  return ( /* ... lista + botão "Adicionar condomínio" */ )
}
```

---

### Formulários de CRUD — Padrão de Form

**Analog:** `apps/web/src/pages/client/CombosScreen.tsx` (linhas 67–113 para padrão handleSubmit + loading + error)

**Padrão de submit com loading + error** (linhas 67–113 do analog):
```typescript
const [isSaving, setIsSaving] = useState(false)
const [error, setError] = useState<string | null>(null)

const handleSalvar = async () => {
  if (isSaving) return
  setIsSaving(true)
  setError(null)
  try {
    const res = await apiFetch('/admin/condominiums', {
      method: 'POST',
      body: JSON.stringify(formData),
    })
    if (res.ok) {
      onSaved()
    } else {
      const err = (await res.json()) as { error?: string }
      setError(err.error ?? 'Não foi possível salvar. Tente novamente.')
    }
  } catch {
    setError('Falha na conexão. Tente novamente.')
  } finally {
    setIsSaving(false)
  }
}
```

---

### Tests de Service Admin — Padrão de Teste com makeFastifyMock

**Analog:** `apps/api/src/modules/admin-orders/__tests__/admin-orders.service.test.ts` (linhas 1–66 completas)

**Padrão makeFastifyMock** (linhas 24–66 do analog — copiar e adaptar as coleções):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdminSettingsService } from '../admin-settings.service.js'

function makeFastifyMock(overrides: {
  setting?: { key: string; value: string } | null
} = {}) {
  const {
    setting = { key: 'cutoffTime', value: '20:00' },
  } = overrides

  const prisma = {
    setting: {
      findUnique: vi.fn().mockResolvedValue(setting),
      upsert: vi.fn().mockResolvedValue(setting),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    notification: {
      create: vi.fn().mockResolvedValue({ id: 'notif-1' }),
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

describe('AdminSettingsService', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('getCutoffTime retorna o valor da Setting key=cutoffTime', async () => {
    const { fastify } = makeFastifyMock()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new AdminSettingsService(fastify as any)
    const result = await service.getCutoffTime()
    expect(result).toBe('20:00')
  })
})
```

**Padrão de mock do Mercado Pago** (linhas 7–21 de payments.service.test.ts):
```typescript
const mockRefundTotal = vi.fn()

vi.mock('mercadopago', () => {
  class MockMercadoPagoConfig {
    constructor(_opts: unknown) {}
  }
  class MockPaymentRefund {
    constructor(_client: unknown) {}
    total = mockRefundTotal
  }
  return {
    MercadoPagoConfig: MockMercadoPagoConfig,
    PaymentRefund: MockPaymentRefund,
  }
})
```

---

## Shared Patterns

### Autenticação e Role Check Admin
**Fonte:** `apps/api/src/plugins/authenticate.ts` (linhas 15–97)
**Aplicar em:** Todos os controllers admin
```typescript
// Na rota: preHandler: [fastify.authenticate]
// No controller (primeiro statement de cada handler):
if (request.user?.role !== 'ADMIN') {
  return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
}
```

### Error Handling — Service (lança) + Controller (captura)
**Fonte:** `apps/api/src/modules/admin-orders/admin-orders.controller.ts` (linhas 62–65) + `admin-orders.service.ts` (linhas 52–59)
**Aplicar em:** Todos os services e controllers
```typescript
// Service lança:
throw { statusCode: 404, message: 'Recurso não encontrado' }
// Controller captura:
const e = err as { statusCode?: number; message?: string }
if (e.statusCode === 404) return reply.status(404).send({ error: e.message })
if (e.statusCode === 400) return reply.status(400).send({ error: e.message })
return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
```

### Push OneSignal (best-effort)
**Fonte:** `apps/api/src/modules/admin-orders/admin-orders.service.ts` (linhas 89–108)
**Aplicar em:** `admin-settings.service.ts` (cron de corte, ADMO-02)
```typescript
import * as OneSignal from '@onesignal/node-onesignal'

function createOsClient() {
  const configuration = OneSignal.createConfiguration({
    restApiKey: process.env.ONESIGNAL_REST_API_KEY!,
  })
  return new OneSignal.DefaultApi(configuration)
}

// best-effort: falha silenciosa, não bloqueia fluxo
try {
  const osClient = createOsClient()
  const notification = new OneSignal.Notification()
  notification.app_id = process.env.ONESIGNAL_APP_ID!
  notification.include_subscription_ids = [user.oneSignalPlayerId]
  notification.headings = { pt: 'Cheirin de Pão' }
  notification.contents = { pt: 'Sua mensagem aqui' }
  await osClient.createNotification(notification)
} catch (pushErr) {
  this.fastify.log.warn({ err: pushErr }, '[admin-settings] falha ao enviar push — ignorado')
}
```

### Tokens de Design (CSS custom properties)
**Fonte:** Todas as telas em `apps/web/src/` — padrão consolidado
**Aplicar em:** Todos os componentes admin
```typescript
// Cores via CSS custom properties (nunca valores hardcoded exceto espresso/gold que não têm token dedicado)
color: 'var(--color-text)'           // #241608
color: 'var(--color-text-sec)'       // #7C6A50
color: 'var(--color-text-ter)'       // #A89A82
color: 'var(--color-accent)'         // #B0702A
color: 'var(--color-gold)'           // #E3AC3F  (usada inline em BreadMark e alguns valores exatos)
background: 'var(--color-app-bg)'    // #FAF5EC
background: 'var(--color-surface)'   // #FFFFFF
background: 'var(--color-surface-2)' // #F4EBDA
border: '1px solid var(--color-border-2)'

// Fontes
fontFamily: 'var(--font-display)'   // Bricolage Grotesque (títulos, KPIs, valores grandes)
fontFamily: 'var(--font-body)'      // Hanken Grotesk (UI geral, labels, textos)
```

### apiFetch — Cliente HTTP autenticado
**Fonte:** `apps/web/src/pages/client/CombosScreen.tsx` (linha 8) + `apps/web/src/pages/courier/CourierScreen.tsx` (linha 3)
**Aplicar em:** Todos os componentes/telas React admin
```typescript
import { apiFetch } from '../../../lib/apiFetch'

// GET
const res = await apiFetch('/admin/clients')
if (res.ok) {
  const data = await res.json()
}

// POST/PATCH
const res = await apiFetch('/admin/condominiums', {
  method: 'POST',
  body: JSON.stringify(body),
})
```

---

## No Analog Found

| Arquivo | Role | Data Flow | Motivo |
|---------|------|-----------|--------|
| `apps/api/src/modules/admin-supplier-orders/pdf-generator.ts` | utility | file-I/O | Nenhum gerador de PDF existe no projeto — usar padrão da RESEARCH.md Pattern 2 (pdfmake v0.3 `getBuffer()`) |
| `apps/api/src/modules/admin-supplier-orders/excel-generator.ts` | utility | file-I/O | Nenhum gerador de Excel existe no projeto — usar padrão da RESEARCH.md Pattern 3 (exceljs `writeBuffer()`) |

Esses dois arquivos dependem exclusivamente dos padrões verificados no RESEARCH.md. O planner deve referenciar RESEARCH.md §Pattern 2 e §Pattern 3 diretamente para as ações desses arquivos.

---

## Metadata

**Escopo da busca:** `apps/api/src/modules/`, `apps/api/src/plugins/`, `apps/web/src/pages/`, `apps/web/src/components/`, `apps/web/src/routes/`
**Arquivos escaneados:** 55
**Data de extração:** 2026-06-15
