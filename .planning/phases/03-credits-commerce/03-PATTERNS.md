# Phase 3: Credits & Commerce - Pattern Map

**Mapped:** 2026-06-14
**Files analyzed:** 26 new/modified files
**Analogs found:** 24 / 26

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/api/prisma/schema.prisma` | config/schema | — | self (modify existing) | exact |
| `apps/api/src/server.ts` | config | request-response | self (modify existing) | exact |
| `apps/api/src/modules/payments/payments.route.ts` | route | request-response | `apps/api/src/modules/auth/auth.route.ts` | exact |
| `apps/api/src/modules/payments/payments.controller.ts` | controller | request-response | `apps/api/src/modules/auth/auth.controller.ts` | exact |
| `apps/api/src/modules/payments/payments.service.ts` | service | request-response | `apps/api/src/modules/auth/auth.service.ts` | exact |
| `apps/api/src/modules/payments/payments.repository.ts` | repository | CRUD | `apps/api/src/modules/auth/auth.repository.ts` | exact |
| `apps/api/src/modules/payments/payments.schema.ts` | config/validation | — | `apps/api/src/modules/auth/auth.schema.ts` | exact |
| `apps/api/src/modules/credits/credits.route.ts` | route | request-response | `apps/api/src/modules/auth/auth.route.ts` | exact |
| `apps/api/src/modules/credits/credits.controller.ts` | controller | request-response | `apps/api/src/modules/auth/auth.controller.ts` | exact |
| `apps/api/src/modules/credits/credits.service.ts` | service | CRUD | `apps/api/src/modules/auth/auth.service.ts` | role-match |
| `apps/api/src/modules/credits/credits.repository.ts` | repository | CRUD | `apps/api/src/modules/auth/auth.repository.ts` | exact |
| `apps/api/src/modules/credits/credits.schema.ts` | config/validation | — | `apps/api/src/modules/auth/auth.schema.ts` | exact |
| `apps/api/src/modules/webhooks/webhooks.route.ts` | route | event-driven | `apps/api/src/modules/auth/auth.route.ts` | role-match |
| `apps/api/src/modules/webhooks/webhooks.controller.ts` | controller | event-driven | `apps/api/src/modules/auth/auth.controller.ts` | role-match |
| `apps/api/src/modules/webhooks/webhooks.service.ts` | service | event-driven | `apps/api/src/modules/auth/auth.service.ts` | role-match |
| `apps/web/src/pages/client/ClientLayout.tsx` | component/layout | request-response | self + `apps/web/src/pages/admin/AdminLayout.tsx` | exact |
| `apps/web/src/pages/client/HomeScreen.tsx` | component/page | request-response | `apps/web/src/pages/auth/LoginScreen.tsx` | role-match |
| `apps/web/src/pages/client/CombosScreen.tsx` | component/page | request-response | `apps/web/src/pages/auth/LoginScreen.tsx` | role-match |
| `apps/web/src/pages/client/PixWaitingScreen.tsx` | component/page | event-driven | `apps/web/src/pages/auth/LoginScreen.tsx` | role-match |
| `apps/web/src/pages/client/CardPaymentScreen.tsx` | component/page | request-response | `apps/web/src/pages/auth/LoginScreen.tsx` | role-match |
| `apps/web/src/pages/client/PurchasedScreen.tsx` | component/page | request-response | `apps/web/src/pages/splash/SplashScreen.tsx` | role-match |
| `apps/web/src/pages/client/AutoBuyScreen.tsx` | component/page | request-response | `apps/web/src/pages/auth/LoginScreen.tsx` | role-match |
| `apps/web/src/pages/client/CreditHistoryScreen.tsx` | component/page | CRUD | `apps/web/src/pages/auth/LoginScreen.tsx` | role-match |
| `apps/web/src/pages/client/PlaceholderScreen.tsx` | component/page | — | `apps/web/src/pages/splash/SplashScreen.tsx` | role-match |
| `apps/web/src/components/client/ClientTabBar.tsx` | component/ui | request-response | `apps/web/src/components/auth/OtpInput.tsx` | role-match |
| `apps/web/src/components/client/QuantityStepper.tsx` | component/ui | — | `apps/web/src/components/auth/OtpInput.tsx` | role-match |
| `apps/web/src/components/client/StepperInline.tsx` | component/ui | — | `apps/web/src/components/auth/OtpInput.tsx` | role-match |
| `apps/web/src/components/client/CreditBalanceCard.tsx` | component/ui | — | `apps/web/src/pages/splash/SplashScreen.tsx` | role-match |
| `apps/web/src/components/client/ComboCard.tsx` | component/ui | — | `apps/web/src/components/auth/OtpInput.tsx` | role-match |
| `apps/web/src/components/client/BannerInsuficiente.tsx` | component/ui | — | `apps/web/src/components/auth/OtpInput.tsx` | role-match |
| `apps/web/src/hooks/useCredits.ts` | hook | CRUD | `apps/web/src/hooks/useAuth.ts` | exact |
| `apps/web/src/hooks/usePaymentPolling.ts` | hook | event-driven | `apps/web/src/hooks/useInstallPrompt.ts` | role-match |
| `apps/web/src/contexts/AuthContext.tsx` | context | — | self (modify existing) | exact |
| `apps/web/src/routes/router.tsx` | config/route | — | self (modify existing) | exact |

---

## Pattern Assignments

### `apps/api/src/modules/payments/payments.route.ts` (route, request-response)

**Analog:** `apps/api/src/modules/auth/auth.route.ts`

**Full file pattern** (lines 1–18):
```typescript
import { FastifyPluginAsync } from 'fastify'
import { AuthController } from './auth.controller.js'

export const authRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AuthController(fastify)

  // Public routes — no preHandler
  fastify.post('/auth/register', ctrl.register.bind(ctrl))

  // Authenticated route — preHandler: [fastify.authenticate]
  fastify.post(
    '/auth/couriers',
    { preHandler: [fastify.authenticate] },
    ctrl.registerCourier.bind(ctrl),
  )
}
```

**Key adaptation:** Replace `authRoute`/`AuthController` with `paymentsRoute`/`PaymentsController`. All three payment endpoints (`POST /payments/pix`, `POST /payments/card`, `GET /payments/:id/status`) receive `{ preHandler: [fastify.authenticate] }`. The webhook route (`POST /webhooks/mercadopago`) must be registered in `webhooks.route.ts` WITHOUT `preHandler` — it is a public endpoint validated by HMAC signature instead.

**Registration in server.ts** (lines 70–72):
```typescript
// Add after existing route registrations:
await fastify.register(paymentsRoute)
await fastify.register(creditsRoute)
await fastify.register(webhooksRoute)
```

---

### `apps/api/src/modules/payments/payments.controller.ts` (controller, request-response)

**Analog:** `apps/api/src/modules/auth/auth.controller.ts`

**Class structure + constructor** (lines 1–22):
```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { AuthService } from './auth.service.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

export class AuthController {
  private service: AuthService

  constructor(private fastify: FastifyInstance) {
    this.service = new AuthService(fastify)
  }
  // ...
}
```

**Two-try-catch handler pattern** (lines 24–44):
```typescript
async register(request: FastifyRequest, reply: FastifyReply) {
  let body: ReturnType<typeof RegisterSchema.parse>
  try {
    body = RegisterSchema.parse(request.body)
  } catch (err) {
    if (err instanceof ZodError) {
      return reply.status(400).send({ error: zodMessage(err) })
    }
    return reply.status(400).send({ error: 'Dados inválidos.' })
  }
  try {
    const result = await this.service.register(body)
    if ('error' in result) {
      return reply.status(result.status).send({ error: result.error })
    }
    return reply.status(201).send(result)
  } catch (err) {
    this.fastify.log.error(err)
    return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
  }
}
```

**Role check pattern** (lines 114–117):
```typescript
// Applied to any endpoint restricted by role
if (request.user?.role !== 'ADMIN') {
  return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
}
```

**Key adaptation:** All methods use the same two-try-catch structure: first try parses Zod schema, second try calls service. For `createPix` and `createCard`, check `request.user` is non-null (guaranteed by `authenticate` preHandler, but be defensive). Return `{ paymentId, qr_code_base64, qr_code }` for Pix, `{ paymentId }` for card. Return `{ status, creditBalance? }` for `getStatus`.

---

### `apps/api/src/modules/payments/payments.service.ts` (service, request-response)

**Analog:** `apps/api/src/modules/auth/auth.service.ts`

**Class structure** (lines 7–13):
```typescript
export class AuthService {
  private repo: AuthRepository

  constructor(private fastify: FastifyInstance) {
    this.repo = new AuthRepository(fastify)
  }
  // ...
}
```

**Use of `node:crypto`** (lines 1–5):
```typescript
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { FastifyInstance } from 'fastify'
import { AuthRepository } from './auth.repository.js'
```

**Key adaptation:** Import `MercadoPagoConfig, Payment` from `'mercadopago'`. Instantiate `mpClient` in the constructor from `process.env.MP_ACCESS_TOKEN`. For `createPix`: call `paymentApi.create({ body: { transaction_amount, payment_method_id: 'pix', payer: { email } } })`, save `Payment` to DB with `status: 'PENDING'`, return `{ paymentId, qr_code_base64, qr_code }`. For `getStatus`: query DB by `paymentId`, return `{ status, creditBalance? }` when `PAID`. Use `this.fastify.prisma` via the repo layer.

---

### `apps/api/src/modules/payments/payments.repository.ts` (repository, CRUD)

**Analog:** `apps/api/src/modules/auth/auth.repository.ts`

**Full file pattern** (lines 1–68):
```typescript
import { FastifyInstance } from 'fastify'

export class AuthRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }

  findUserByPhone(phone: string) {
    return this.prisma.user.findUnique({ where: { phone } })
  }
  // ... single-responsibility methods, one operation each
}
```

**Key adaptation:** Methods needed: `createPayment(data)`, `findPaymentById(id)`, `updatePaymentStatus(id, status)`, `findPaymentByMercadoPagoId(mpId)`, `creditUserBalance(userId, quantity, paymentId)` — the last uses `fastify.prisma.$transaction([creditTransaction.create(...), user.update({ creditBalance: { increment: quantity } })])`.

---

### `apps/api/src/modules/payments/payments.schema.ts` (validation, —)

**Analog:** `apps/api/src/modules/auth/auth.schema.ts`

**Full file pattern** (lines 1–47):
```typescript
import { z } from 'zod'
import { CpfSchema } from '@cheirin-de-pao/shared'

export const RegisterSchema = z
  .object({
    name: z.string().min(2),
    // ...
  })
  .refine((d) => d.phone || d.email, { message: 'phone ou email obrigatório' })

export type RegisterBody = z.infer<typeof RegisterSchema>
```

**Key adaptation:** Define `CreatePixPaymentSchema` (`comboId?: z.string()`, `customQuantity?: z.number().int().positive()`), `CreateCardPaymentSchema` (adds `token: z.string()`, `installments: z.number()`, `issuerId: z.string().optional()`), `GetPaymentStatusParamsSchema` (`id: z.string()`). All schemas export their `z.infer<typeof ...>` types.

---

### `apps/api/src/modules/credits/credits.route.ts` (route, CRUD)

**Analog:** `apps/api/src/modules/auth/auth.route.ts`

**Pattern:** Same `FastifyPluginAsync` + controller constructor pattern. Endpoints: `GET /combos` (authenticated), `GET /pricing` (authenticated), `GET /credits/history` (authenticated). All receive `{ preHandler: [fastify.authenticate] }`.

**Route without controller** (condominiums pattern at lines 1–22):
```typescript
import { FastifyPluginAsync } from 'fastify'

export const condominiumsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/condominiums', async (_request, reply) => {
    try {
      const condominiums = await fastify.prisma.condominium.findMany({
        orderBy: { name: 'asc' },
      })
      return reply.send(result)
    } catch (err) {
      fastify.log.error(err)
      return reply.status(500).send({ error: 'Erro ao carregar condomínios.' })
    }
  })
}
```

**Key adaptation:** For `GET /combos`, query `fastify.prisma.combo.findMany({ where: { isActive: true } })`. For `GET /pricing`, query `fastify.prisma.setting.findMany({ where: { key: { in: ['avulsoLimite', 'avulsoUnit'] } } })` and transform into `{ avulsoLimite, avulsoUnit }`. For `GET /credits/history`, query `CreditTransaction` filtered by `request.user!.id`.

---

### `apps/api/src/modules/webhooks/webhooks.route.ts` (route, event-driven)

**Analog:** `apps/api/src/modules/auth/auth.route.ts`

**Critical difference — no `authenticate` preHandler:**
```typescript
// auth.route.ts shows how to register WITHOUT preHandler (public routes):
fastify.post('/auth/register', ctrl.register.bind(ctrl))   // ← no preHandler
fastify.post('/auth/otp/send', ctrl.sendOtp.bind(ctrl))    // ← no preHandler
```

**Key adaptation:** `POST /webhooks/mercadopago` is registered with no `preHandler` at all — validation is done by HMAC-SHA256 inside `webhooks.controller.ts`. Copy the `FastifyPluginAsync` shell exactly, but omit `{ preHandler: [fastify.authenticate] }`.

---

### `apps/api/src/modules/webhooks/webhooks.service.ts` (service, event-driven)

**Analog:** `apps/api/src/modules/auth/auth.service.ts`

**`node:crypto` usage** (lines 1–4):
```typescript
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
```

**Key adaptation:** Import `createHmac` from `'node:crypto'`. The `validateSignature(xSignature, xRequestId, dataId)` method uses:
```typescript
import { createHmac } from 'node:crypto'

const parts = Object.fromEntries(xSignature.split(',').map(p => p.split('=')))
const { ts, v1 } = parts
const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
const computed = createHmac('sha256', process.env.MP_WEBHOOK_SECRET!).update(manifest).digest('hex')
return computed === v1
```

The `processApprovedPayment(mpPaymentId)` method checks `Payment.status === 'PAID'` before crediting (idempotency), then uses `fastify.prisma.$transaction([...])` to atomically create `CreditTransaction` and increment `User.creditBalance`.

---

### `apps/api/src/server.ts` (config, —) — MODIFY EXISTING

**Analog:** self

**Env schema addition** (lines 17–36 show the existing pattern):
```typescript
const envSchema = {
  type: 'object',
  required: ['DATABASE_URL'],
  properties: {
    DATABASE_URL: { type: 'string' },
    // ...existing vars...
    // Phase 3 additions:
    MP_ACCESS_TOKEN: { type: 'string' },
    MP_WEBHOOK_SECRET: { type: 'string' },
    MP_PUBLIC_KEY: { type: 'string' },
  },
}
```

**Route registration** (lines 70–72 show existing pattern):
```typescript
await fastify.register(authRoute)
await fastify.register(condominiumsRoute)
// Add:
await fastify.register(paymentsRoute)
await fastify.register(creditsRoute)
await fastify.register(webhooksRoute)
```

---

### `apps/api/prisma/schema.prisma` — MODIFY EXISTING

**Analog:** self

**Existing `User` model** (lines 103–117):
```prisma
model User {
  id            String    @id @default(auto()) @map("_id") @db.ObjectId
  email         String?   @unique
  phone         String?   @unique
  role          UserRole
  name          String
  cpf           String    @unique
  birthDate     DateTime?
  isBlocked     Boolean   @default(false)
  condominiumId String?   @db.ObjectId
  apartment     String?
  block         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

**Existing `Payment` model** (lines 260–271):
```prisma
model Payment {
  id            String        @id @default(auto()) @map("_id") @db.ObjectId
  userId        String        @db.ObjectId
  amount        Float
  method        PaymentMethod
  status        PaymentStatus
  mercadoPagoId String?       @unique
  comboId       String?       @db.ObjectId
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
}
```

**Key additions to `User`:**
```prisma
creditBalance  Int     @default(0)
autoRecharge   Json?
cardTokenMp    String?
```

**Key additions to `Payment`:**
```prisma
customQuantity Int?
```

**Note:** After any schema change, run only `prisma generate` — never `prisma migrate dev` (MongoDB, lines 1–4 of schema).

---

### `apps/web/src/pages/client/ClientLayout.tsx` (component/layout, —) — MODIFY EXISTING

**Analog:** self (`apps/web/src/pages/admin/AdminLayout.tsx`)

**Existing layout structure** (lines 1–20):
```typescript
import { Outlet } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { LoadingScreen } from '../auth/LoadingScreen'
import { Navigate } from 'react-router'

export function ClientLayout() {
  const { user, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!user || user.role !== 'CLIENT') return <Navigate to="/" replace />

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-app-bg)' }}>
      <div style={{ padding: '1rem' }}>
        Área do Cliente — Fase 3
        <Outlet />
      </div>
    </div>
  )
}
```

**Key adaptation:** Remove the placeholder `<div style={{ padding: '1rem' }}>`. Add `<ClientTabBar />` as a fixed bottom component outside the scrollable content area:
```typescript
return (
  <div style={{ minHeight: '100dvh', background: 'var(--color-app-bg)', paddingBottom: 'calc(56px + env(safe-area-inset-bottom))' }}>
    <Outlet />
    <ClientTabBar />
  </div>
)
```

---

### `apps/web/src/routes/router.tsx` (config/route, —) — MODIFY EXISTING

**Analog:** self

**Existing lazy-load pattern** (lines 28–56):
```typescript
{
  path: '/client',
  lazy: () =>
    import('../pages/client/ClientLayout').then((m) => ({
      Component: m.ClientLayout,
    })),
},
```

**Key adaptation:** Add sub-routes under `/client` with lazy-loaded children. Pattern for each child:
```typescript
{
  path: '/client',
  lazy: () => import('../pages/client/ClientLayout').then((m) => ({ Component: m.ClientLayout })),
  children: [
    { index: true, lazy: () => import('../pages/client/HomeScreen').then((m) => ({ Component: m.HomeScreen })) },
    { path: 'home', lazy: () => import('../pages/client/HomeScreen').then((m) => ({ Component: m.HomeScreen })) },
    { path: 'creditos', lazy: () => import('../pages/client/CombosScreen').then((m) => ({ Component: m.CombosScreen })) },
    { path: 'creditos/pix', lazy: () => import('../pages/client/PixWaitingScreen').then((m) => ({ Component: m.PixWaitingScreen })) },
    { path: 'creditos/cartao', lazy: () => import('../pages/client/CardPaymentScreen').then((m) => ({ Component: m.CardPaymentScreen })) },
    { path: 'creditos/sucesso', lazy: () => import('../pages/client/PurchasedScreen').then((m) => ({ Component: m.PurchasedScreen })) },
    { path: 'creditos/extrato', lazy: () => import('../pages/client/CreditHistoryScreen').then((m) => ({ Component: m.CreditHistoryScreen })) },
    { path: 'creditos/recorrente', lazy: () => import('../pages/client/AutoBuyScreen').then((m) => ({ Component: m.AutoBuyScreen })) },
    { path: 'agenda', lazy: () => import('../pages/client/PlaceholderScreen').then((m) => ({ Component: m.PlaceholderScreen })) },
    { path: 'pedidos', lazy: () => import('../pages/client/PlaceholderScreen').then((m) => ({ Component: m.PlaceholderScreen })) },
  ],
},
```

---

### `apps/web/src/pages/client/HomeScreen.tsx` (component/page, request-response)

**Analog:** `apps/web/src/pages/auth/LoginScreen.tsx`

**Imports pattern** (lines 1–8):
```typescript
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { apiFetch } from '../../lib/apiFetch'
import { Icon } from '../../components/brand/Icon'
```

**State + navigation pattern** (lines 20–28):
```typescript
export function LoginScreen() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // ...
}
```

**apiFetch usage pattern** (lines 43–53):
```typescript
const res = await apiFetch('/auth/otp/send', {
  method: 'POST',
  body: JSON.stringify(body),
})
if (res.ok) {
  const data = (await res.json()) as { userId?: string }
  // ...
} else {
  const err = (await res.json()) as { error?: string }
  setError(err.error ?? 'Algo deu errado.')
}
```

**Key adaptation:** `HomeScreen` reads `user.creditBalance` from `useAuth()` (after `AuthContext` is updated). Navigation to `CombosScreen` via `navigate('/client/creditos')`, to `CreditHistoryScreen` via `navigate('/client/creditos/extrato')`. The `CreditBalanceCard` component receives the balance as a prop. `TodayDelivery` and `NextDays` sections are placeholder divs in Phase 3.

---

### `apps/web/src/pages/client/CombosScreen.tsx` (component/page, request-response)

**Analog:** `apps/web/src/pages/auth/LoginScreen.tsx`

**Multi-step/toggle state pattern** (lines 9–28):
```typescript
type Step = 'phone-entry' | 'otp'
// ...
const [step, setStep] = useState<Step>('phone-entry')
```

**Key adaptation:** Use a `tab: 'combos' | 'avulso'` state for the toggle between "Combos" and "Compra personalizada". On mount, call `apiFetch('/combos')` and `apiFetch('/pricing')` to load data. Sub-components `ComboCard` and `QuantityStepper` are used inline. On combo select → `apiFetch('/payments/pix', { method: 'POST', body: ... })` or navigate to `'/client/creditos/cartao'` depending on chosen method.

---

### `apps/web/src/pages/client/PixWaitingScreen.tsx` (component/page, event-driven)

**Analog:** `apps/web/src/pages/auth/LoginScreen.tsx` + polling hook

**Error + loading state pattern** (lines 29–30):
```typescript
const [isLoading, setIsLoading] = useState(false)
const [error, setError] = useState<string | null>(null)
```

**Key adaptation:** Receives `paymentId`, `qrCodeBase64`, `qrCode` as route state (via `useLocation`). Renders QR code as `<img src={`data:image/png;base64,${qrCodeBase64}`} />`. Uses `usePaymentPolling` hook. On `approved`, calls `navigate('/client/creditos/sucesso')` and updates `AuthContext` with new `creditBalance`. On timeout (5 attempts), shows "Verificar mais tarde" message.

---

### `apps/web/src/pages/client/CardPaymentScreen.tsx` (component/page, request-response)

**Analog:** `apps/web/src/pages/auth/LoginScreen.tsx`

**Key adaptation:** No equivalent in codebase — uses `@mercadopago/sdk-react`. Call `initMercadoPago(import.meta.env.VITE_MP_PUBLIC_KEY, { locale: 'pt-BR' })` once (in `main.tsx` or with a guard). Render `<CardPayment initialization={{ amount }} onSubmit={async (formData) => { ... }} />`. In `onSubmit`, call `apiFetch('/payments/card', { method: 'POST', body: JSON.stringify({ ...formData, comboId }) })`. On success, navigate to polling/success flow.

---

### `apps/web/src/components/client/ClientTabBar.tsx` (component/ui, request-response)

**Analog:** `apps/web/src/components/auth/OtpInput.tsx` (stateful UI component pattern)

**Component + props interface pattern** (lines 17–82 of OtpInput):
```typescript
export interface OtpInputProps {
  onComplete: (code: string) => void
  disabled?: boolean
}

export function OtpInput({ onComplete, disabled = false }: OtpInputProps) {
  const [digits, setDigits] = useState(['', '', '', ''])
  // ...
  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
      {digits.map((d, i) => (
        <input key={i} ... />
      ))}
    </div>
  )
}
```

**Icon usage pattern** (from Icon.tsx lines 54–69):
```typescript
<Icon name="home" size={22} color={active ? 'var(--color-gold)' : 'var(--color-text-ter)'} />
```

**Color tokens** (from globals.css lines 25–27):
```css
--color-gold: #E3AC3F;        /* active icon color */
--color-text-ter: #A89A82;    /* inactive icon color */
--color-accent: #B0702A;      /* active label color */
--color-surface: #FFFFFF;     /* tab bar background */
--color-border-2: rgba(43, 26, 12, 0.06); /* top border */
```

**Key adaptation:** Use `useLocation()` + `useNavigate()` from `react-router`. Four tabs: `home` (icon `home`), `calendar` (icon `calendar`), `coin` (icon `coin`), `bag` (icon `bag`). Fixed bottom bar with `env(safe-area-inset-bottom)` padding.

---

### `apps/web/src/components/client/QuantityStepper.tsx` (component/ui, —)

**Analog:** `apps/web/src/components/auth/OtpInput.tsx`

**Controlled + callback pattern** (lines 17–19):
```typescript
export interface OtpInputProps {
  onComplete: (code: string) => void
  disabled?: boolean
}
```

**Key adaptation:** Props `{ min: number, max: number, value: number, onChange: (v: number) => void }`. Renders `−` button, value display, `+` button. The `−` is disabled when `value <= min`, `+` is disabled when `value >= max`. Buttons use `minHeight: 48` (large version) or `minHeight: 34` (inline version via `StepperInline`). Style: buttons with `background: var(--color-surface-2)`, `borderRadius: var(--radius-btn)`, `color: var(--color-text)`.

---

### `apps/web/src/components/client/CreditBalanceCard.tsx` (component/ui, —)

**Analog:** `apps/web/src/pages/splash/SplashScreen.tsx` (decorative card pattern)

**Gradient card pattern** (lines 96–106 of SplashScreen):
```typescript
<div
  style={{
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    boxShadow: 'var(--shadow-soft)',
    marginBottom: 32,
  }}
>
```

**Key adaptation:** Background `linear-gradient(135deg, #1E1207, #2E1D0D)`. Balance number in `Bricolage Grotesque 800 52px` color `#FAF5EC`. Label "SEUS CRÉDITOS" in `12.5px 600` color `#C7B595`. BreadMark watermark at `opacity: 0.1` (reuse `<BreadMark />` component already in codebase at `apps/web/src/components/brand/BreadMark.tsx`).

---

### `apps/web/src/hooks/useCredits.ts` (hook, CRUD)

**Analog:** `apps/web/src/hooks/useAuth.ts`

**Exact pattern** (lines 1–9):
```typescript
import { useContext } from 'react'
import { AuthContext } from '../contexts/AuthContext'
import type { AuthContextType } from '../contexts/AuthContext'

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
```

**Key adaptation:** `useCredits()` wraps a `CreditsContext` (or can be a standalone hook that calls `apiFetch('/credits/history')` directly). Simpler approach: a hook that calls `apiFetch` and manages local state with `useState`/`useEffect`. Returns `{ creditBalance, history, isLoading, refetch }`. The `creditBalance` source of truth is `useAuth().user?.creditBalance` — `useCredits` adds the history list.

---

### `apps/web/src/hooks/usePaymentPolling.ts` (hook, event-driven)

**Analog:** `apps/web/src/hooks/useInstallPrompt.ts` (browser event listener with cleanup)

**Key adaptation:** Uses `useEffect` with `setInterval` and cleanup `return () => clearInterval(id)`. Props: `paymentId: string | null`, `onApproved: (creditBalance: number) => void`. Internal state: `attempts` (max 5), `isTimeout`. Interval: 3000ms. Calls `apiFetch(`/payments/${paymentId}/status`)`. Stops on `approved`, `rejected`, or `attempts >= 5`.

---

### `apps/web/src/contexts/AuthContext.tsx` (context, —) — MODIFY EXISTING

**Analog:** self

**Existing `AuthUser` interface** (lines 4–8):
```typescript
export interface AuthUser {
  id: string
  role: 'CLIENT' | 'COURIER' | 'ADMIN'
  name: string
}
```

**Existing `AuthContextType`** (lines 10–16):
```typescript
export interface AuthContextType {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  login: (token: string, user: AuthUser) => void
  logout: () => void
}
```

**Key adaptation:** Add `creditBalance: number` to `AuthUser`. Add `updateCreditBalance: (balance: number) => void` to `AuthContextType`. The `updateCreditBalance` function updates `user.creditBalance` in state and in `localStorage`'s `auth_user`. This is called by `usePaymentPolling` on `approved` without a full refetch.

---

### Test files

**Analog:** `apps/api/src/__tests__/auth.service.test.ts`

**Mock Fastify pattern** (lines 7–33):
```typescript
function createMockFastify(overrides: Record<string, unknown> = {}): FastifyInstance {
  return {
    prisma: {
      otpCode: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'otp1', ...data })),
        update: vi.fn().mockResolvedValue({}),
      },
      // ...
    },
    ...overrides,
  } as unknown as FastifyInstance
}
```

**Test structure** (lines 35–110):
```typescript
describe('AuthService [AUTH-05, AUTH-06]', () => {
  it('description', async () => {
    const fastify = createMockFastify()
    const service = new AuthService(fastify)
    // arrange → act → expect
  })
})
```

**RTL test pattern** (from `OtpInput.test.tsx` lines 1–57):
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { OtpInput } from '../OtpInput'

describe('OtpInput [UI-06]', () => {
  it('renders 4 input elements', () => {
    render(<OtpInput onComplete={() => {}} />)
    const inputs = screen.getAllByRole('textbox')
    expect(inputs).toHaveLength(4)
  })
})
```

---

## Shared Patterns

### Authentication — preHandler in routes

**Source:** `apps/api/src/modules/auth/auth.route.ts` (line 13–17) + `apps/api/src/plugins/authenticate.ts` (lines 14–72)
**Apply to:** All `payments.route.ts` and `credits.route.ts` endpoints
```typescript
fastify.post(
  '/payments/pix',
  { preHandler: [fastify.authenticate] },
  ctrl.createPix.bind(ctrl),
)
```
**Do NOT apply to:** `webhooks.route.ts` — webhook endpoint is public, validated by HMAC instead.

### Zod Validation in Controllers

**Source:** `apps/api/src/modules/auth/auth.controller.ts` (lines 13–16 + 25–33)
**Apply to:** All controller methods in `payments`, `credits`, `webhooks`
```typescript
type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}
// ...
try {
  body = SomeSchema.parse(request.body)
} catch (err) {
  if (err instanceof ZodError) return reply.status(400).send({ error: zodMessage(err) })
  return reply.status(400).send({ error: 'Dados inválidos.' })
}
```

### Error Logging + 500 Response

**Source:** `apps/api/src/modules/auth/auth.controller.ts` (lines 41–43)
**Apply to:** All controller methods
```typescript
} catch (err) {
  this.fastify.log.error(err)
  return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
}
```

### Repository — prisma getter pattern

**Source:** `apps/api/src/modules/auth/auth.repository.ts` (lines 4–8)
**Apply to:** `payments.repository.ts`, `credits.repository.ts`
```typescript
export class AuthRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }
}
```

### apiFetch in React hooks and pages

**Source:** `apps/web/src/lib/apiFetch.ts` (lines 40–58)
**Apply to:** All new hooks (`useCredits`, `usePaymentPolling`) and page components (`HomeScreen`, `CombosScreen`, `PixWaitingScreen`, `CardPaymentScreen`, `CreditHistoryScreen`, `AutoBuyScreen`)
```typescript
import { apiFetch } from '../../lib/apiFetch'
// ...
const res = await apiFetch('/some-endpoint', { method: 'POST', body: JSON.stringify(payload) })
if (res.ok) {
  const data = (await res.json()) as ExpectedType
} else {
  const err = (await res.json()) as { error?: string }
  setError(err.error ?? 'Algo deu errado.')
}
```

### Design Tokens

**Source:** `apps/web/src/styles/globals.css` (lines 1–46)
**Apply to:** All new React components
```css
/* Key tokens for Phase 3 components */
--color-espresso: #1E1207;         /* CreditBalanceCard gradient start */
--color-app-bg: #FAF5EC;           /* screen backgrounds */
--color-surface: #FFFFFF;          /* cards, tab bar background */
--color-surface-2: #F4EBDA;        /* stepper buttons, toggle inactive */
--color-gold: #E3AC3F;             /* active tab icon */
--color-accent: #B0702A;           /* active tab label, CTA hover */
--color-text: #241608;             /* primary text */
--color-text-sec: #7C6A50;         /* secondary text */
--color-text-ter: #A89A82;         /* inactive tab label */
--color-border-2: rgba(43,26,12,0.06); /* tab bar top border */
--radius-card: 22px;               /* card border radius */
--radius-btn: 16px;                /* button + stepper border radius */
--font-display: "Bricolage Grotesque Variable"; /* headings, balance number */
--font-body: "Hanken Grotesk";     /* body text, labels */
```

### Inline style approach (not Tailwind classes)

**Source:** `apps/web/src/pages/auth/LoginScreen.tsx` (lines 131–200) + `apps/web/src/components/auth/OtpInput.tsx` (lines 46–82)
**Apply to:** All new React components in `apps/web/src/`
All components use inline `style={{}}` objects referencing CSS variables, NOT Tailwind utility classes (except on `<div className="...">` for structural layout in the SplashScreen, but the dominant pattern across auth/client screens is pure inline style).

### localStorage try/catch

**Source:** `apps/web/src/contexts/AuthContext.tsx` (lines 28–40) + `apps/web/src/lib/apiFetch.ts` (lines 18–30)
**Apply to:** Any new code accessing `localStorage`
```typescript
try {
  localStorage.setItem('key', value)
} catch {
  // localStorage unavailable (iOS Safari private mode) — degrade gracefully
}
```

### Lazy route loading

**Source:** `apps/web/src/routes/router.tsx` (lines 14–56)
**Apply to:** All new screen components added to `router.tsx`
```typescript
{
  path: 'creditos',
  lazy: () =>
    import('../pages/client/CombosScreen').then((m) => ({
      Component: m.CombosScreen,
    })),
},
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web/src/pages/client/CardPaymentScreen.tsx` | component/page | request-response | Uses `@mercadopago/sdk-react` `CardPayment` Brick — no iframe/third-party component exists in codebase yet. Use RESEARCH.md Pattern 4 directly. |
| `apps/api/src/modules/webhooks/webhooks.service.ts` (HMAC part) | service | event-driven | No HMAC-SHA256 webhook validation exists anywhere in the codebase. Use RESEARCH.md Pattern 3 directly with `node:crypto` `createHmac`. |

---

## Metadata

**Analog search scope:** `apps/api/src/`, `apps/web/src/`, `apps/api/prisma/`
**Files scanned:** 31
**Pattern extraction date:** 2026-06-14
