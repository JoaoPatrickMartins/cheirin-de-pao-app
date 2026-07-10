# Phase 02: Authentication - Pattern Map

**Mapped:** 2026-06-13
**Files analyzed:** 18 new/modified files
**Analogs found:** 18 / 18 (all have at least a role-match or structural analog in the existing codebase)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/api/prisma/schema.prisma` | model/config | CRUD | self (existing schema) | exact — append-only |
| `apps/api/src/modules/auth/auth.route.ts` | route | request-response | `apps/api/src/modules/health/health.route.ts` | exact — same Fastify plugin shape |
| `apps/api/src/modules/auth/auth.controller.ts` | controller | request-response | `apps/api/src/modules/health/health.route.ts` | role-match — handler extraction pattern |
| `apps/api/src/modules/auth/auth.service.ts` | service | CRUD | `apps/api/src/plugins/prisma.ts` + RESEARCH patterns | role-match — prisma.decorateRequest pattern |
| `apps/api/src/modules/auth/auth.repository.ts` | repository | CRUD | `apps/api/src/plugins/prisma.ts` | role-match — `fastify.prisma.*` query style |
| `apps/api/src/modules/auth/otp.service.ts` | service | request-response | RESEARCH Pattern 5/6 (Zenvia fetch + Resend) | no codebase analog — use RESEARCH patterns |
| `apps/api/src/modules/auth/auth.schema.ts` | utility/schema | transform | `packages/shared/src/schemas/index.ts` | exact — Zod schema file structure |
| `apps/api/src/plugins/authenticate.ts` | middleware | request-response | `apps/api/src/plugins/prisma.ts` | exact — `fp()` + `decorateRequest` plugin shape |
| `apps/api/src/bootstrap/admin-seed.ts` | utility | CRUD | `apps/api/src/server.ts` (start() pattern) | role-match — startup hook with prisma access |
| `apps/api/src/server.ts` | config | request-response | self (existing) | exact — extend existing envSchema + register route |
| `apps/web/src/contexts/AuthContext.tsx` | provider | event-driven | `apps/web/src/hooks/useInstallPrompt.ts` | role-match — useState+useEffect+localStorage pattern |
| `apps/web/src/hooks/useAuth.ts` | hook | request-response | `apps/web/src/hooks/useInstallPrompt.ts` | exact — same hook export shape |
| `apps/web/src/pages/auth/LoginScreen.tsx` | component | request-response | `apps/web/src/pages/splash/SplashScreen.tsx` | exact — same inline-style + CSS var pattern |
| `apps/web/src/pages/auth/OnboardingScreen.tsx` | component | CRUD | `apps/web/src/pages/splash/SplashScreen.tsx` | exact — same inline-style + CSS var pattern |
| `apps/web/src/components/auth/OtpInput.tsx` | component | event-driven | `apps/web/src/components/brand/BreadMark.tsx` | role-match — typed props + SVG/DOM element |
| `apps/web/src/pages/client/ClientLayout.tsx` | component | request-response | self (existing stub) | exact — extend existing stub |
| `apps/web/src/pages/courier/CourierLayout.tsx` | component | request-response | self (existing stub) | exact — extend existing stub |
| `apps/web/src/pages/admin/AdminLayout.tsx` | component | request-response | self (existing stub) | exact — extend existing stub |
| `apps/web/src/pages/admin/CourierRegisterScreen.tsx` | component | CRUD | `apps/web/src/pages/splash/SplashScreen.tsx` | role-match — form page with inline-style pattern |
| `apps/web/src/routes/router.tsx` | config | request-response | self (existing) | exact — extend createBrowserRouter array |
| `packages/shared/src/schemas/index.ts` | utility/schema | transform | self (existing) | exact — append Zod schema exports |
| `apps/api/vitest.config.ts` | config | — | `apps/web/vitest.config.ts` | exact — same defineConfig shape |
| `packages/shared/src/__tests__/cpf.test.ts` | test | — | `apps/web/src/pages/splash/SplashScreen.test.tsx` | exact — same describe/it.todo stub pattern |
| `apps/web/src/components/auth/__tests__/OtpInput.test.tsx` | test | — | `apps/web/src/pages/splash/SplashScreen.test.tsx` | exact — same describe/it.todo stub pattern |

---

## Pattern Assignments

### `apps/api/prisma/schema.prisma` (model/config, CRUD)

**Analog:** Self — existing `apps/api/prisma/schema.prisma`

**Append pattern** (lines 100-283 establish model convention):
```prisma
// Comment header: // {N}. ModelName — one-line description
model Session {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  userId      String   @db.ObjectId
  token       String   @unique  // sha256 hash of raw token
  deviceId    String
  lastUsedAt  DateTime @default(now())
  expiresAt   DateTime
  isRevoked   Boolean  @default(false)
  createdAt   DateTime @default(now())
}

model OtpCode {
  id        String    @id @default(auto()) @map("_id") @db.ObjectId
  userId    String    @db.ObjectId
  code      String    // sha256 hash of 4-digit code
  channel   String    // "sms" | "email"
  expiresAt DateTime
  usedAt    DateTime? // null until used; never deleted (audit trail)
  createdAt DateTime  @default(now())
}
```

**Critical constraint:** NEVER run `prisma migrate dev`. MongoDB adapter. Run `prisma generate` only after changes.

---

### `apps/api/src/modules/auth/auth.route.ts` (route, request-response)

**Analog:** `apps/api/src/modules/health/health.route.ts`

**Full analog file** (lines 1-12):
```typescript
import { FastifyPluginAsync } from 'fastify'

export const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_request, reply) => {
    try {
      await fastify.prisma.$runCommandRaw({ ping: 1 })
      return reply.send({ ok: true, db: 'connected' })
    } catch (err) {
      return reply.status(503).send({ ok: false, db: 'disconnected', error: String(err) })
    }
  })
}
```

**Auth route pattern** — expand to multiple endpoints:
```typescript
import { FastifyPluginAsync } from 'fastify'
import { AuthController } from './auth.controller'

export const authRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AuthController(fastify)

  fastify.post('/auth/register', ctrl.register.bind(ctrl))
  fastify.post('/auth/otp/send', ctrl.sendOtp.bind(ctrl))
  fastify.post('/auth/otp/verify', ctrl.verifyOtp.bind(ctrl))

  // Admin-only route — uses authenticate plugin scoped inline
  fastify.post('/auth/couriers',
    { preHandler: [fastify.authenticate] },
    ctrl.registerCourier.bind(ctrl)
  )
}
```

**Registration in server.ts** — copy pattern from `apps/api/src/server.ts` lines 38-41:
```typescript
await fastify.register(authRoute)  // mirrors: await fastify.register(healthRoute)
```

---

### `apps/api/src/modules/auth/auth.controller.ts` (controller, request-response)

**Analog:** `apps/api/src/modules/health/health.route.ts` (handler body extracted to separate class)

**Pattern — extract handler from route, add Zod validation:**
```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { RegisterSchema, SendOtpSchema, VerifyOtpSchema } from './auth.schema'
import { AuthService } from './auth.service'

export class AuthController {
  private service: AuthService

  constructor(private fastify: FastifyInstance) {
    this.service = new AuthService(fastify)
  }

  async register(request: FastifyRequest, reply: FastifyReply) {
    const body = RegisterSchema.parse(request.body)
    try {
      const result = await this.service.register(body)
      return reply.status(201).send(result)
    } catch (err) {
      // Follow health.route.ts error style: return reply.status(N).send({...})
      return reply.status(400).send({ error: String(err) })
    }
  }
}
```

**Error handling convention** from `health.route.ts` lines 7-10:
```typescript
// Inline try/catch per handler — no centralized error middleware in existing codebase
try {
  // ... business logic
} catch (err) {
  return reply.status(503).send({ ok: false, error: String(err) })
}
```

---

### `apps/api/src/modules/auth/auth.repository.ts` (repository, CRUD)

**Analog:** `apps/api/src/plugins/prisma.ts` + `apps/api/src/modules/health/health.route.ts`

**Prisma access pattern** from `health.route.ts` line 6 and `prisma.ts` lines 11-17:
```typescript
// Access prisma via fastify decorator — always fastify.prisma.modelName.method()
await fastify.prisma.$runCommandRaw({ ping: 1 })  // existing pattern in health.route.ts

// Repository class receives fastify instance to access fastify.prisma
import { FastifyInstance } from 'fastify'

export class AuthRepository {
  constructor(private fastify: FastifyInstance) {}

  async findUserByPhone(phone: string) {
    return this.fastify.prisma.user.findFirst({ where: { phone } })
  }

  async createSession(data: { userId: string; token: string; deviceId: string; expiresAt: Date }) {
    return this.fastify.prisma.session.create({ data: { ...data, lastUsedAt: new Date() } })
  }

  async findActiveSession(tokenHash: string) {
    return this.fastify.prisma.session.findFirst({
      where: { token: tokenHash, isRevoked: false },
    })
  }

  async revokeSession(sessionId: string) {
    return this.fastify.prisma.session.update({
      where: { id: sessionId },
      data: { isRevoked: true },
    })
  }
}
```

---

### `apps/api/src/modules/auth/auth.schema.ts` (utility/schema, transform)

**Analog:** `packages/shared/src/schemas/index.ts`

**Full analog** (lines 1-11):
```typescript
import { z } from 'zod'

// Base ID schema — MongoDB ObjectId as 24-char hex string
export const ObjectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId')

// User role enum — matches Prisma UserRole enum values exactly
export const UserRoleSchema = z.enum(['CLIENT', 'COURIER', 'ADMIN'])

// Condominium type enum — matches Prisma CondoType enum values exactly
export const CondoTypeSchema = z.enum(['SINGLE_ENTRANCE', 'BLOCKS'])
```

**Auth schemas** — follow same zod-only file convention:
```typescript
import { z } from 'zod'

// Strip formatting before validation (Pitfall 4 in RESEARCH.md)
const cpfSchema = z.string()
  .transform(v => v.replace(/\D/g, ''))
  .refine(v => v.length === 11, 'CPF deve ter 11 dígitos')
  // módulo 11 validation added as .refine() — see RESEARCH.md AUTH-02

// AUTH-02: at least one of phone or email required
export const RegisterSchema = z.object({
  name: z.string().min(1),
  cpf: cpfSchema,
  birthDate: z.string(), // ISO date string
  phone: z.string().optional(),
  email: z.string().email().optional(),
  channel: z.enum(['sms', 'email']),
  condominiumId: z.string(),
  apartment: z.string().min(1),
  block: z.string().optional(),
}).refine(d => d.phone || d.email, { message: 'Informe telefone ou e-mail' })

// AUTH-03: block required only if condo type is BLOCKS — enforced in service layer
// after fetching condo from DB

export const SendOtpSchema = z.object({
  phone: z.string().optional(),
  email: z.string().email().optional(),
}).refine(d => d.phone || d.email, { message: 'Informe telefone ou e-mail' })

export const VerifyOtpSchema = z.object({
  userId: z.string(),
  code: z.string().length(4),
  deviceId: z.string(),
})
```

---

### `apps/api/src/plugins/authenticate.ts` (middleware, request-response)

**Analog:** `apps/api/src/plugins/prisma.ts`

**Full analog** (lines 1-20):
```typescript
import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import { PrismaClient } from '@prisma/client'

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
  }
}

const prismaPlugin: FastifyPluginAsync = fp(async (fastify) => {
  const prisma = new PrismaClient()
  await prisma.$connect()
  fastify.decorate('prisma', prisma)
  fastify.addHook('onClose', async (app) => {
    await app.prisma.$disconnect()
  })
})

export default prismaPlugin
```

**Authenticate plugin** — same `fp()` + `decorateRequest` shape:
```typescript
import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import { createHash } from 'crypto'

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; role: string; name: string } | null
  }
}

const authenticatePlugin: FastifyPluginAsync = fp(async (fastify) => {
  fastify.decorateRequest('user', null)

  fastify.addHook('onRequest', async (request, reply) => {
    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    const rawToken = authHeader.slice(7)
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')
    const deviceId = request.headers['x-device-id'] as string | undefined

    const session = await fastify.prisma.session.findFirst({
      where: { token: tokenHash, isRevoked: false },
      include: { user: { select: { id: true, role: true, name: true } } }
    })

    if (!session || session.expiresAt < new Date()) {
      return reply.status(401).send({ error: 'Session expired' })
    }
    if (deviceId && session.deviceId !== deviceId) {
      await fastify.prisma.session.update({
        where: { id: session.id }, data: { isRevoked: true }
      })
      return reply.status(401).send({ error: 'Device changed' })
    }
    await fastify.prisma.session.update({
      where: { id: session.id }, data: { lastUsedAt: new Date() }
    })
    request.user = session.user
  })
})

export default authenticatePlugin
```

**Registration in server.ts** — mirrors prisma plugin registration (line 38):
```typescript
await fastify.register(authenticatePlugin)  // after prismaPlugin, before routes
```

---

### `apps/api/src/bootstrap/admin-seed.ts` (utility, CRUD)

**Analog:** `apps/api/src/server.ts` — `start()` function structure (lines 21-53)

**start() pattern** (lines 21-53):
```typescript
const start = async () => {
  try {
    // sequential await fastify.register(...)
    // then fastify.listen(...)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()
```

**Bootstrap pattern** — called from `start()` after prismaPlugin registered:
```typescript
// apps/api/src/bootstrap/admin-seed.ts
import { PrismaClient } from '@prisma/client'

export async function seedAdminIfAbsent(prisma: PrismaClient): Promise<void> {
  const adminExists = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
  if (adminExists) return

  const name = process.env.ADMIN_NAME
  const phone = process.env.ADMIN_PHONE || null
  const email = process.env.ADMIN_EMAIL || null

  if (!name || (!phone && !email)) {
    console.warn('[bootstrap] ADMIN_NAME and ADMIN_PHONE/ADMIN_EMAIL not set — skipping admin seed')
    return
  }

  await prisma.user.create({
    data: {
      name,
      phone,
      email,
      role: 'ADMIN',
      cpf: process.env.ADMIN_CPF ?? '00000000000',
    },
  })
  console.log('[bootstrap] Admin user created:', name)
}
```

**Called from server.ts** — insert after prismaPlugin register (line 38):
```typescript
// After: await fastify.register(prismaPlugin)
const { seedAdminIfAbsent } = await import('./bootstrap/admin-seed')
await seedAdminIfAbsent(fastify.prisma)
```

---

### `apps/api/src/server.ts` (config — modification, request-response)

**Analog:** Self — extend existing file

**envSchema extension** (lines 10-18 — add after existing properties):
```typescript
const envSchema = {
  type: 'object',
  required: ['DATABASE_URL'],
  properties: {
    DATABASE_URL: { type: 'string' },
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
  },
}
```

---

### `apps/web/src/contexts/AuthContext.tsx` (provider, event-driven)

**Analog:** `apps/web/src/hooks/useInstallPrompt.ts`

**useState + useEffect + localStorage pattern** (lines 1-43):
```typescript
import { useState, useEffect } from 'react'

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<...>(null)
  const [isInstallable, setIsInstallable] = useState(false)

  useEffect(() => {
    // Detect state from browser APIs on mount
    const standalone = window.matchMedia('(display-mode: standalone)').matches
    setIsStandalone(standalone)
    // Event listener pattern
    const handler = (e: Event) => { ... }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)  // cleanup
  }, [])

  return { isInstallable, isIOS, isStandalone, triggerInstall }
}
```

**AuthContext** — same patterns: useState for state, useEffect for rehydration from localStorage, return typed object:
```typescript
import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { useNavigate, Outlet } from 'react-router'

// CRITICAL: AuthProvider must be a layout route Component, not wrap RouterProvider
// Reason: useNavigate requires Router ancestor (RESEARCH.md Pitfall 1)
export function AuthProvider() {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Wrap in try/catch — iOS Safari private mode blocks localStorage (RESEARCH Pitfall 6)
    try {
      const storedToken = localStorage.getItem('auth_token')
      const storedUser = localStorage.getItem('auth_user')
      if (storedToken && storedUser) {
        setToken(storedToken)
        setUser(JSON.parse(storedUser))
      }
    } catch {
      // localStorage unavailable — in-memory only
    }
    setIsLoading(false)
  }, [])

  const value = useMemo(() => ({
    user, token, isLoading,
    login: (t: string, u: AuthUser) => { /* set localStorage + state */ },
    logout: () => { /* clear localStorage + state + navigate('/') */ },
  }), [user, token, isLoading, navigate])

  return (
    <AuthContext.Provider value={value}>
      <Outlet />  {/* Layout route — renders child routes */}
    </AuthContext.Provider>
  )
}
```

---

### `apps/web/src/hooks/useAuth.ts` (hook, request-response)

**Analog:** `apps/web/src/hooks/useInstallPrompt.ts`

**Export shape** from `useInstallPrompt.ts` (line 8 + line 42):
```typescript
export function useInstallPrompt() {
  // ... internal state
  return { isInstallable, isIOS, isStandalone, triggerInstall }
}
```

**useAuth** — same named function export, typed return:
```typescript
import { useContext } from 'react'
import { AuthContext } from '../contexts/AuthContext'

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx  // { user, token, isLoading, login, logout }
}
```

---

### `apps/web/src/pages/auth/LoginScreen.tsx` (component, request-response)

**Analog:** `apps/web/src/pages/splash/SplashScreen.tsx` + `.projeto/design_handoff_cheirin_pao/app/screens-onboarding.jsx` lines 40-83

**Component structure from SplashScreen.tsx** (lines 1-10):
```typescript
import { useState } from 'react'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'
import { BreadMark } from '../../components/brand/BreadMark'
import { Icon } from '../../components/brand/Icon'

export function SplashScreen() {
  const { isInstallable, isIOS, isStandalone, triggerInstall } = useInstallPrompt()
  const [showIOSSheet, setShowIOSSheet] = useState(false)
  // ...
}
```

**Inline-style CSS vars pattern** from SplashScreen.tsx (lines 19-35):
```typescript
// All styles inline, always use CSS vars from globals.css:
// --font-display, --font-body, --color-text, --color-accent, --color-surface-alt,
// --color-border, --radius-btn, --radius-card, --radius-field, --shadow-soft
<div style={{ backgroundColor: 'var(--color-app-bg)' }}>
  <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32 }}>...</h1>
</div>
```

**OTP input pattern** from `.projeto/design_handoff_cheirin_pao/app/screens-onboarding.jsx` lines 70-76:
```typescript
// OTP input — 4 inputs with auto-focus and auto-advance (UI-06)
const [code, setCode] = React.useState(['', '', '', ''])
const refs = [0, 1, 2, 3].map(() => React.useRef(null))
const setDigit = (i, v) => {
  if (!/^\d?$/.test(v)) return
  const nc = [...code]; nc[i] = v; setCode(nc)
  if (v && i < 3) refs[i + 1].current?.focus()
}
// Input element exact dimensions from design:
// width:64, height:72, borderRadius:18, fontSize:30, fontWeight:800
// border: 1.5px solid (accent when filled, border when empty)
// fontFamily: var(--font-display) (Bricolage Grotesque)
// background: var(--color-surface-alt)
```

**Resend timer** from screens-onboarding.jsx line 78:
```typescript
// "Reenviar em 0:28" — 30s countdown, useState+useEffect (RESEARCH Don't Hand-Roll section)
const [seconds, setSeconds] = useState(30)
useEffect(() => {
  if (seconds <= 0) return
  const id = setTimeout(() => setSeconds(s => s - 1), 1000)
  return () => clearTimeout(id)
}, [seconds])
```

---

### `apps/web/src/pages/auth/OnboardingScreen.tsx` (component, CRUD)

**Analog:** `.projeto/design_handoff_cheirin_pao/app/screens-onboarding.jsx` lines 87-226

**5-step stepper structure** (lines 87-122):
```typescript
// NSTEPS = 5, [step, setStep] = useState(0)
// Steps: 0=Dados, 1=Contato, 2=Condomínio, 3=Endereço, 4=OTP
// Progress dots: width 22 for active, 7 for inactive; accent color for active
// Back button: surface2 background, 38×38, borderRadius 12

const Dots = () => (
  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '4px 0 16px' }}>
    {Array.from({ length: NSTEPS }).map((_, i) => (
      <div key={i} style={{
        width: i === step ? 22 : 7, height: 7, borderRadius: 99,
        background: i === step ? 'var(--color-accent)' : 'var(--color-border)',
        transition: 'all .25s'
      }} />
    ))}
  </div>
)
```

**Channel selector** from screens-onboarding.jsx lines 146-155:
```typescript
// Auto-select SMS if phone filled; email if only email; both = show selector
// Selector: flex row, two buttons, accent border + goldSoft bg when selected
// Design key tokens: border 1.5px solid accent, background goldSoft, color accent when active
```

**Step 3 — Condominium search** (lines 163-184):
```typescript
// Search field with live filter, scrollable card list
// Empty state: "Seu condomínio ainda não é parceiro."
// Card: 1.5px accent border when selected, check icon from Icon component
```

**Step 4 — Address with conditional block** (lines 187-204):
```typescript
// Show Bloco/Torre picker ONLY if condo.type === 'BLOCKS' (AUTH-03)
// Pill buttons for block selection: accent border + goldSoft bg when selected
```

---

### `apps/web/src/components/auth/OtpInput.tsx` (component, event-driven)

**Analog:** `apps/web/src/components/brand/BreadMark.tsx`

**Typed props interface pattern** from BreadMark.tsx (lines 1-7):
```typescript
interface BreadMarkProps {
  size?: number
  color?: string
  reduced?: boolean
  side?: number
  strong?: number
}

export function BreadMark({ size = 100, color = '#E3AC3F', ... }: BreadMarkProps) {
```

**OtpInput** — same named export + typed interface:
```typescript
interface OtpInputProps {
  onComplete: (code: string) => void
  disabled?: boolean
}

export function OtpInput({ onComplete, disabled = false }: OtpInputProps) {
  // 4-digit state + refs array + setDigit handler
  // Exact dimensions: width:64, height:72, borderRadius:18, fontSize:30, fontWeight:800
  // Border: 1.5px solid var(--color-accent) when filled, var(--color-border) when empty
  // Background: var(--color-surface-alt)
  // Font: var(--font-display)
}
```

---

### `apps/web/src/routes/router.tsx` (config — modification, request-response)

**Analog:** Self — extend existing `createBrowserRouter` array

**Existing structure** (lines 1-30):
```typescript
import { createBrowserRouter } from 'react-router'
import { SplashScreen } from '../pages/splash/SplashScreen'

export const router = createBrowserRouter([
  { path: '/', element: <SplashScreen /> },
  {
    path: '/client',
    lazy: () => import('../pages/client/ClientLayout').then((m) => ({
      Component: m.ClientLayout,
    })),
  },
  // /courier and /admin follow same lazy pattern
])
```

**Updated structure** — wrap all routes in AuthProvider layout:
```typescript
import { AuthProvider } from '../contexts/AuthContext'

export const router = createBrowserRouter([
  {
    Component: AuthProvider,  // layout route parent — enables useNavigate inside provider
    children: [
      { path: '/', element: <SplashScreen /> },
      {
        path: '/login',
        lazy: () => import('../pages/auth/LoginScreen').then(m => ({ Component: m.LoginScreen })),
      },
      {
        path: '/register',
        lazy: () => import('../pages/auth/OnboardingScreen').then(m => ({ Component: m.OnboardingScreen })),
      },
      // /client, /courier, /admin — same lazy pattern as existing, wrap content with ProtectedRoute
    ],
  },
])
```

---

### `apps/web/src/pages/client/ClientLayout.tsx` (component — modification)
### `apps/web/src/pages/courier/CourierLayout.tsx` (component — modification)
### `apps/web/src/pages/admin/AdminLayout.tsx` (component — modification)

**Analog:** Self — each is currently a one-line stub:
```typescript
export function ClientLayout() {
  return <div>Client (Phase 2)</div>
}
```

**Update pattern** — add auth guard + placeholder header, keep Phase 2 note:
```typescript
import { useAuth } from '../../hooks/useAuth'
import { Navigate } from 'react-router'

export function ClientLayout() {
  const { user, isLoading } = useAuth()
  if (isLoading) return null
  if (!user || user.role !== 'CLIENT') return <Navigate to="/" replace />
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-app-bg)' }}>
      {/* Header placeholder — Phase 3 adds tab bar */}
      <main style={{ padding: '0 0 env(safe-area-inset-bottom)' }}>
        <div>Client (Phase 3+)</div>
      </main>
    </div>
  )
}
```

---

### `apps/web/src/pages/admin/CourierRegisterScreen.tsx` (component, CRUD)

**Analog:** `.projeto/design_handoff_cheirin_pao/app/screens-onboarding.jsx` step 0 form pattern (lines 123-135)

**Step 0 form pattern** (lines 127-134):
```typescript
// Simple vertical form with Field components (label, icon, value, onChange, placeholder)
// Primary button at bottom: disabled until required fields filled
// Field design: inline style matching brand tokens

<div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
  <Field label="Nome completo" icon="user" value={nome} onChange={setNome} placeholder="Ex.: Marina Ribeiro" />
  <Field label="CPF" icon="card" value={cpf} onChange={setCpf} placeholder="000.000.000-00" type="tel" />
</div>
<Btn full size="lg" disabled={!nome || !cpf}>Continuar</Btn>
```

**CourierRegisterScreen fields** — name, CPF, phone, email:
```typescript
// AUTH-07: Admin registers courier. Minimal form (4 fields).
// POST to /auth/couriers with Authorization: Bearer <adminToken>
// Success: navigate back to admin panel or show confirmation
```

---

### `apps/api/vitest.config.ts` (config)

**Analog:** `apps/web/vitest.config.ts`

**Full analog** (lines 1-11):
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
})
```

**API vitest config** — no React plugin, Node environment:
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
})
```

---

### Test files (test stubs)

**Analog:** `apps/web/src/pages/splash/SplashScreen.test.tsx`

**Full analog** (lines 1-7):
```typescript
// Component will be created in Plan 03 — test stubs only
// Requirements: UI-05 (Splash screen with espresso background + gold symbol)

describe('SplashScreen [UI-05]', () => {
  it.todo('renders espresso background')
  it.todo('shows install CTA')
})
```

**Test files to create:**

`packages/shared/src/__tests__/cpf.test.ts`:
```typescript
// Shared CPF validation — módulo 11 algorithm (AUTH-02)
describe('validateCpf [AUTH-02]', () => {
  it.todo('accepts a valid CPF')
  it.todo('rejects all-same-digit CPFs (e.g., 111.111.111-11)')
  it.todo('strips formatting before validation')
  it.todo('rejects CPF with wrong check digits')
})
```

`apps/api/src/__tests__/auth.service.test.ts`:
```typescript
// AUTH-05/06 OTP + session logic
describe('AuthService [AUTH-05, AUTH-06]', () => {
  it.todo('generateOtpCode returns 4-digit string between 1000 and 9999')
  it.todo('dev mode: any code is accepted when OTP_DEV_CODE=1234')
  it.todo('session expiry: expiresAt < now() returns 401')
  it.todo('device mismatch: different deviceId revokes session')
})
```

`apps/web/src/components/auth/__tests__/OtpInput.test.tsx`:
```typescript
// UI-06 OTP input focus behavior
describe('OtpInput [UI-06]', () => {
  it.todo('renders 4 input elements')
  it.todo('focus advances to next input when digit entered')
  it.todo('calls onComplete when all 4 digits filled')
  it.todo('rejects non-numeric characters')
})
```

---

### `packages/shared/src/schemas/index.ts` (utility/schema — modification)

**Analog:** Self — append to existing file

**Existing exports** (lines 1-11):
```typescript
import { z } from 'zod'
export const ObjectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId')
export const UserRoleSchema = z.enum(['CLIENT', 'COURIER', 'ADMIN'])
export const CondoTypeSchema = z.enum(['SINGLE_ENTRANCE', 'BLOCKS'])
```

**Append pattern** — add CPF validator following same style:
```typescript
// CPF validation — módulo 11 algorithm; strips formatting before validating
export const CpfSchema = z.string()
  .transform(v => v.replace(/\D/g, ''))
  .refine(validateCpfDigits, 'CPF inválido')

// Helper (not exported — internal to schema file):
function validateCpfDigits(cpf: string): boolean {
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false  // all same digit
  // módulo 11 algorithm for both check digits
  // ... (standard Brazilian CPF algorithm)
  return true
}
```

---

## Shared Patterns

### Fastify Plugin Shape (`fp()` + `decorate*`)
**Source:** `apps/api/src/plugins/prisma.ts` lines 1-20
**Apply to:** `apps/api/src/plugins/authenticate.ts`
```typescript
import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'

const myPlugin: FastifyPluginAsync = fp(async (fastify) => {
  // 1. declare module 'fastify' to extend FastifyInstance or FastifyRequest
  // 2. fastify.decorate('name', value) or fastify.decorateRequest('name', value)
  // 3. fastify.addHook('onClose', ...) for cleanup
})

export default myPlugin
```

### Inline Styles with CSS Vars (Frontend)
**Source:** `apps/web/src/pages/splash/SplashScreen.tsx` throughout, `apps/web/src/styles/globals.css`
**Apply to:** All `apps/web/src/pages/auth/*.tsx`, `apps/web/src/components/auth/OtpInput.tsx`, layout updates
```typescript
// CSS variables available in globals.css @theme block:
// Typography:   var(--font-display) | var(--font-body)
// Font sizes:   var(--text-sm) = 12.5px | var(--text-base) = 15px | var(--text-xl) = 21px | var(--text-3xl) = 32px
// Colors:       var(--color-app-bg) | var(--color-surface) | var(--color-surface-alt) | var(--color-surface-2)
//               var(--color-text) | var(--color-text-sec) | var(--color-text-ter)
//               var(--color-accent) = #B0702A | var(--color-gold) = #E3AC3F | var(--color-gold-soft) = #F3DDA6
//               var(--color-border) | var(--color-border-2)
// Radii:        var(--radius-field) = 14px | var(--radius-btn) = 16px | var(--radius-card) = 22px
// Shadows:      var(--shadow-soft) | var(--shadow-strong)
```

### Error Response Format
**Source:** `apps/api/src/modules/health/health.route.ts` lines 7-10
**Apply to:** All auth route handlers
```typescript
// Success: reply.send({ data: result }) or reply.status(201).send(result)
// Error:   reply.status(N).send({ error: String(err) })
// Not a global error handler — each handler has its own try/catch
```

### Zod Schema File Convention
**Source:** `packages/shared/src/schemas/index.ts`
**Apply to:** `apps/api/src/modules/auth/auth.schema.ts`, shared schema additions
```typescript
// 1. Import only from 'zod'
// 2. Export each schema as a named const (PascalCase + Schema suffix)
// 3. Derive TypeScript types with z.infer<typeof XSchema> in types/index.ts
// 4. No business logic in schema files — only shape + refinements
```

### TypeScript Named Export Pattern (Components and Hooks)
**Source:** Every existing file uses named exports — no default exports on components/hooks
**Apply to:** All new `apps/web/src/` files
```typescript
// ALWAYS named exports:
export function MyComponent() { ... }
export function useMyHook() { ... }
// NOT: export default function MyComponent() { ... }
// Exception: Fastify plugins use default export (matches existing prisma.ts pattern)
```

### localStorage Access Safety Wrapper
**Source:** RESEARCH.md Pitfall 6
**Apply to:** `apps/web/src/contexts/AuthContext.tsx` all localStorage calls
```typescript
// Wrap ALL localStorage access in try/catch for iOS Safari private mode compatibility
try {
  const value = localStorage.getItem('auth_token')
} catch {
  // Silently fail — user stays unauthenticated, must re-login on next page load
}
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/api/src/modules/auth/otp.service.ts` | service | request-response | No external HTTP call services exist yet in the codebase. Use RESEARCH.md Pattern 5 (Zenvia fetch) and Pattern 6 (Resend SDK) directly. |
| `apps/api/src/modules/auth/auth.service.ts` | service | CRUD | No service layer classes exist in Phase 1. Pattern from RESEARCH.md + follows prisma.ts access conventions. |

---

## Key Design Token Reference (OTP Input exact dimensions)

From `.projeto/design_handoff_cheirin_pao/app/screens-onboarding.jsx` lines 72-74:
```
width: 64px
height: 72px
textAlign: 'center'
fontSize: 30px
fontWeight: 800
fontFamily: var(--font-display)  // Bricolage Grotesque
color: var(--color-text)
background: var(--color-surface-alt)
border: 1.5px solid <accent when filled | border when empty>
borderRadius: 18px
outline: 'none'
gap between inputs: 12px
justifyContent: 'space-between'
```

---

## Metadata

**Analog search scope:**
- `apps/api/src/` (all 3 files)
- `apps/web/src/` (all 15 files)
- `packages/shared/src/` (all 6 files)
- `.projeto/design_handoff_cheirin_pao/app/screens-onboarding.jsx` (canonical UI reference)
- `.projeto/design_handoff_cheirin_pao/app/brand.jsx` (design tokens)

**Files scanned:** 24 source files + 2 design reference files
**Pattern extraction date:** 2026-06-13
