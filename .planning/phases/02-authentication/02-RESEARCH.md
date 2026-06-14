# Phase 02: Authentication - Research

**Researched:** 2026-06-13
**Domain:** OTP authentication, session management, React Router v7 guards, Fastify auth middleware, Prisma MongoDB schema extension
**Confidence:** HIGH (core stack verified against official docs and existing codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Session and Token (D-01 to D-03)**
- Session: opaque session token in MongoDB (not JWT). Collection `Session`: `userId`, `token` (hashed), `deviceId`, `lastUsedAt`, `expiresAt`, `isRevoked`.
- Frontend stores token in `localStorage` as `auth_token`. Sent as `Authorization: Bearer <token>`.
- `OtpCode` collection: `userId`, `code` (hashed), `channel` (`sms` | `email`), `expiresAt`, `usedAt`. TTL 10 min. Never deleted after use — marked `usedAt` for audit.

**OTP Providers (D-04 to D-06)**
- SMS via Zenvia (Brazilian provider). Direct REST API calls (no SDK). Env vars: `ZENVIA_TOKEN`, `ZENVIA_FROM`.
- Email via Resend. Official `resend` npm SDK. Env vars: `RESEND_API_KEY`, `RESEND_FROM`.
- Dev mode: fixed `OTP_DEV_CODE=1234`. Any code accepts "1234" in `NODE_ENV=development`.

**Device Detection (D-07 to D-08)**
- Device ID: UUID v4 in `localStorage` as `device_id`. Saved in `Session.deviceId` at creation.
- Mismatch between `localStorage.device_id` and `Session.deviceId` → session revoked → redirect to login.

**Bootstrap (D-09 to D-10)**
- Admin auto-created on server boot from env vars `ADMIN_NAME` + `ADMIN_PHONE`/`ADMIN_EMAIL`.
- Phase 2 includes Courier registration by Admin (AUTH-07). Minimal form: name, CPF, phone, email.

### Claude's Discretion
- Module structure inside `apps/api/src/modules/auth/` — follow Clean Architecture (controller → service → repository) as established in `apps/api/src/modules/health/`
- Hash for session token: `crypto.randomBytes(32).toString('hex')` to generate + `sha256` hash to store
- React Context: `AuthProvider` wrapping `RouterProvider` in `apps/web/src/main.tsx` — exposes `user`, `token`, `isLoading`
- Tab bar / bottom navigation for profiles: NOT in Phase 2. Placeholder layouts only (Phase 3+)

### Deferred Ideas (OUT OF SCOPE)
- Multiple simultaneous sessions per user (D-08 revocation only)
- Explicit logout (Phase 5 or 7)
- OTP rate limiting / anti-abuse (post-MVP)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Cliente pode se cadastrar em 5 passos: Dados → Contato → Condomínio → Endereço → OTP | 5-step stepper pattern from `screens-onboarding.jsx` — exact component structure documented below |
| AUTH-02 | Cadastro exige nome completo, CPF, data de nascimento, pelo menos telefone ou e-mail, condomínio e apartamento | Zod schema with `.refine()` for "at least one of phone/email"; CPF validation via módulo 11 |
| AUTH-03 | Bloco/Torre obrigatório apenas se o condomínio for do tipo blocos/torres | Conditional Zod validation pattern with `.superRefine()` |
| AUTH-04 | Canal de confirmação automático — SMS se tiver telefone, e-mail se cadastrou apenas e-mail | Channel selector UI in `screens-onboarding.jsx` — auto-select; override only if both present |
| AUTH-05 | Login sem senha — usuário recebe código OTP (4 dígitos) via SMS ou e-mail | Zenvia REST API (SMS) + Resend SDK (email). Code generation: `Math.floor(1000 + Math.random() * 9000)` |
| AUTH-06 | Sessão permanente — novo código solicitado apenas em troca de dispositivo, limpeza ou 90 dias | `lastUsedAt` updated on each authenticated request; `expiresAt` = `lastUsedAt + 90d`; deviceId cross-check |
| AUTH-07 | Entregador cadastrado pelo Admin (não faz auto-cadastro) | Simple admin-side form + POST `/auth/couriers` behind admin-only guard |
| AUTH-08 | Admin faz login com OTP — sem cadastro público | Admin created via bootstrap only; login flow is same as client but User.role check → redirect to `/admin` |
| UI-06 | OTP com 4 inputs — avanço automático de foco entre dígitos | 4×`<input maxLength={1} inputMode="numeric">` with `useRef` array; `onChange` advances focus |
</phase_requirements>

---

## Summary

Phase 2 implements the complete authentication layer for Cheirin de Pão. The technical surface is divided into three distinct areas: (1) the API auth module (Fastify routes + Prisma schema extension + OTP delivery), (2) the React frontend flows (5-step registration, OTP login, AuthProvider context, route guards), and (3) the device-session contract (opaque tokens + localStorage device fingerprint).

The existing Phase 1 scaffold provides everything needed: Fastify 5 with Prisma decorator, `UserRoleSchema` in shared package, route groups `/client` / `/courier` / `/admin` in React Router v7, Vitest + Testing Library on the frontend, and CSS design tokens in `globals.css`. Phase 2 extends this scaffold without structural changes.

The most important constraints to plan around: (a) Prisma + MongoDB does not support TTL indexes natively — OTP expiry must be enforced in application code (not database TTL); (b) `@zenvia/sdk` introduces 8 vulnerabilities via deprecated `request` package — use direct `fetch` against `https://api.zenvia.com/v2/channels/sms/messages` instead; (c) the `AuthProvider` must be placed as a layout route parent in the router (not wrapping `RouterProvider` externally) to enable access to React Router's `useNavigate` inside the provider.

**Primary recommendation:** Build the API auth module first (schema migration → OTP service → session service → routes), then the React auth flows (AuthProvider → route guards → login screen → registration stepper → OTP input), then wire admin bootstrap and courier registration last.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| OTP generation | API / Backend | — | Must be server-side; client must never generate its own OTP |
| OTP delivery (SMS/email) | API / Backend | — | API owns Zenvia/Resend credentials; client only receives result |
| Session token creation | API / Backend | — | Token hashed before storage; plaintext only returned to client once |
| Session validation (per-request) | API / Backend | — | `onRequest` hook reads `Authorization` header; no client involvement |
| Device ID generation | Browser / Client | — | UUID v4 generated in `localStorage` on first app load |
| Device ID mismatch detection | API / Backend | — | API compares request `deviceId` header vs `Session.deviceId` in DB |
| Token storage | Browser / Client | — | `localStorage.auth_token`; never in memory only (would lose on refresh) |
| Route guards | Frontend (React Router) | — | Client-side redirect based on AuthContext state; API also enforces |
| Admin bootstrap | API / Backend | — | Server startup hook; no UI or API call needed |
| CPF validation | API + Frontend | packages/shared | Validate on frontend (UX) and on API (security); share the algorithm |

---

## Standard Stack

### Core (already installed in Phase 1)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fastify` | 5.8.5 | HTTP server | Locked by Phase 1 |
| `@prisma/client` | 6.19.3 | MongoDB ORM | Locked by Phase 1 |
| `zod` | 4.4.3 | Schema validation | Locked by Phase 1; shared between API and frontend |
| `react-router` | 7.17.0 | Client routing + route guards | Locked by Phase 1 |
| `react` | 19.2.7 | UI layer | Locked by Phase 1 |

### New Packages for Phase 2
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `resend` | 6.12.4 | Email OTP delivery | Official SDK from Resend; locked by D-05 |
| `uuid` | 14.0.0 | UUID v4 device ID generation (frontend) | Standard; also available via `crypto.randomUUID()` in modern browsers |
| `bcryptjs` | 3.0.3 | OTP code hashing (alternative to crypto sha256) | Pure JS, zero deps; slopcheck [SUS] due to name similarity to `bcrypt` — see audit |
| `@types/uuid` | 11.0.0 | TypeScript types for uuid | DefinitelyTyped |

**Note on hashing:** The CONTEXT.md decision specifies `sha256` for session tokens and `crypto.randomBytes` for generation — both are built into Node.js `crypto` (no package needed). For OTP codes, `bcryptjs` is specified in CONTEXT.md but is flagged [SUS] by slopcheck. The plan should provide an alternative: use Node.js built-in `crypto.createHash('sha256')` for OTP codes as well, which is simpler, faster (OTP codes are short-lived anyway), and requires zero dependencies.

**Installation:**
```bash
# In apps/api — only packages needed server-side
npm install resend --workspace=@cheirin-de-pao/api

# In apps/web — only packages needed client-side  
npm install uuid --workspace=@cheirin-de-pao/web
npm install --save-dev @types/uuid --workspace=@cheirin-de-pao/web
```

Note: `uuid` on the frontend can be replaced with `crypto.randomUUID()` (available in all modern browsers since 2021). Using native `crypto.randomUUID()` eliminates the need for the `uuid` package entirely on the frontend.

### Packages NOT to use
| Package | Reason |
|---------|--------|
| `@zenvia/sdk` (v2.4.4) | Pulls in deprecated `request` chain with 8 vulnerabilities (6 moderate, 2 critical). Use direct `fetch` instead. |
| `bcryptjs` | Slopcheck [SUS] — typosquat risk warning. Use Node.js `crypto.createHash('sha256')` for all hashing. |
| Any JWT library | D-01 locked: opaque session token, not JWT |
| `@fastify/jwt` | Not needed; session token validation is custom |

---

## Package Legitimacy Audit

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| `resend` | npm | ~2 yrs | github.com/resend/resend-node | [OK] | Approved |
| `uuid` | npm | 10+ yrs | github.com/uuidjs/uuid | [OK] | Approved |
| `@types/uuid` | npm | 10+ yrs | DefinitelyTyped | [OK] | Approved |
| `@types/bcryptjs` | npm | 8+ yrs | DefinitelyTyped | [OK] | Approved |
| `bcryptjs` | npm | 10+ yrs | github.com/dcodeIO/bcrypt.js | [SUS] | Not recommended — use `crypto` built-in instead |
| `@zenvia/sdk` | npm | ~5 yrs | github.com/zenvia/zenvia-sdk-node | [OK] | NOT used — vulnerable deps chain; use `fetch` directly |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** `bcryptjs` — slopcheck warns it could be a typosquat of `bcrypt`. Risk is LOW given the package has a legitimate GitHub repo (`dcodeIO/bcrypt.js`) and 10+ years of history. However, the plan should default to Node.js built-in `crypto.createHash('sha256')` for all hashing needs in this phase, avoiding the package entirely.

---

## Architecture Patterns

### System Architecture Diagram

```
CLIENT (Browser)                   API (Fastify)                   EXTERNAL
─────────────────                  ────────────────────            ──────────
                                   
[SplashScreen]                                                     
  └─ "Instalar e criar conta" ──► POST /auth/register ──────────► Zenvia SMS
  └─ "Já tenho conta"         ──► POST /auth/otp/send ──────────► Resend Email
                                       │ generates 4-digit code
[OTP Input (UI-06)]                    │ hashes + stores OtpCode
  └─ code submitted           ──► POST /auth/otp/verify
                                       │ validates code
[AuthProvider]                         │ creates Session (token+hash)
  └─ stores auth_token in ls  ◄── returns { token, user }
  └─ stores device_id in ls

[ProtectedRoute] ─── reads AuthProvider ──► redirects /login if !user

[/client route]  ──► checks user.role === CLIENT
[/courier route] ──► checks user.role === COURIER  
[/admin route]   ──► checks user.role === ADMIN

                                   onRequest hook
All API routes needing auth ──► reads Authorization: Bearer <token>
                                   ├─ finds Session by sha256(token)
                                   ├─ checks isRevoked, expiresAt
                                   ├─ checks deviceId header matches
                                   ├─ updates lastUsedAt
                                   └─ decorates request.user

ADMIN BOOTSTRAP (server startup)
  └─ checks if any ADMIN user exists in DB
  └─ if not: creates user from ADMIN_NAME + ADMIN_PHONE/ADMIN_EMAIL env vars
```

### Recommended Project Structure (new files for Phase 2)

```
apps/api/src/
├── modules/
│   └── auth/
│       ├── auth.route.ts          # Fastify route registrar (POST /auth/*)
│       ├── auth.controller.ts     # Request/response parsing, Zod validation
│       ├── auth.service.ts        # Business logic (OTP gen, session create)
│       ├── auth.repository.ts     # Prisma queries (User, Session, OtpCode)
│       ├── otp.service.ts         # OTP send via Zenvia/Resend; dev bypass
│       └── auth.schema.ts         # Zod schemas for request bodies
├── plugins/
│   └── authenticate.ts            # Fastify plugin: decorateRequest('user') + onRequest hook
└── bootstrap/
    └── admin-seed.ts              # Admin auto-create on server boot

apps/web/src/
├── contexts/
│   └── AuthContext.tsx            # React.createContext + AuthProvider component
├── hooks/
│   └── useAuth.ts                 # useContext(AuthContext) with guard
├── pages/
│   ├── auth/
│   │   ├── LoginScreen.tsx        # Step 1: phone/email input; Step 2: OTP
│   │   └── OnboardingScreen.tsx   # 5-step registration stepper
│   ├── client/
│   │   └── ClientLayout.tsx       # Updated placeholder with auth guard
│   ├── courier/
│   │   └── CourierLayout.tsx      # Updated placeholder with auth guard
│   └── admin/
│       ├── AdminLayout.tsx        # Updated placeholder with auth guard
│       └── CourierRegisterScreen.tsx # Admin registers courier (AUTH-07)
└── routes/
    └── router.tsx                 # Updated: AuthProvider as layout route parent
```

### Pattern 1: AuthProvider as React Router Layout Route

React Router v7 recommended approach — place `AuthProvider` as a parent route `Component` rather than wrapping `RouterProvider` externally. This allows `useNavigate` inside `AuthProvider`.

```typescript
// Source: https://blog.logrocket.com/authentication-react-router-v7/
// apps/web/src/contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { useNavigate, Outlet } from 'react-router'

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  login: (token: string, user: AuthUser) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider() {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Rehydrate from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token')
    const storedUser = localStorage.getItem('auth_user')
    if (storedToken && storedUser) {
      setToken(storedToken)
      setUser(JSON.parse(storedUser))
    }
    setIsLoading(false)
  }, [])

  const value = useMemo(() => ({
    user, token, isLoading,
    login: (t: string, u: AuthUser) => {
      localStorage.setItem('auth_token', t)
      localStorage.setItem('auth_user', JSON.stringify(u))
      setToken(t)
      setUser(u)
    },
    logout: () => {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      setToken(null)
      setUser(null)
      navigate('/') // splash screen
    }
  }), [user, token, isLoading, navigate])

  return (
    <AuthContext.Provider value={value}>
      <Outlet />
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
```

```typescript
// apps/web/src/routes/router.tsx — AuthProvider as layout route
import { createBrowserRouter } from 'react-router'
import { AuthProvider } from '../contexts/AuthContext'

export const router = createBrowserRouter([
  {
    Component: AuthProvider,  // ← layout route parent; has access to useNavigate
    children: [
      { path: '/', element: <SplashScreen /> },
      { path: '/login', lazy: () => import('../pages/auth/LoginScreen').then(m => ({ Component: m.LoginScreen })) },
      { path: '/register', lazy: () => import('../pages/auth/OnboardingScreen').then(m => ({ Component: m.OnboardingScreen })) },
      {
        path: '/client',
        lazy: () => import('../pages/client/ClientLayout').then(m => ({ Component: m.ClientLayout })),
      },
      // Same pattern for /courier and /admin
    ],
  },
])
```

### Pattern 2: Route Guard Component

```typescript
// apps/web/src/components/ProtectedRoute.tsx
import { Navigate } from 'react-router'
import { useAuth } from '../hooks/useAuth'
import type { UserRole } from '@cheirin-de-pao/shared'

interface Props {
  requiredRole: UserRole
  children: React.ReactNode
}

export function ProtectedRoute({ requiredRole, children }: Props) {
  const { user, isLoading } = useAuth()

  if (isLoading) return <div>Carregando...</div> // replace with branded loading state

  if (!user) return <Navigate to="/" replace />

  if (user.role !== requiredRole) return <Navigate to="/" replace />

  return <>{children}</>
}
```

### Pattern 3: Fastify `authenticate` Plugin (scoped to protected routes)

```typescript
// apps/api/src/plugins/authenticate.ts
// Source: https://fastify.dev/docs/latest/Reference/Hooks/
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
        where: { id: session.id },
        data: { isRevoked: true }
      })
      return reply.status(401).send({ error: 'Device changed' })
    }

    // Slide expiry window (90-day inactivity)
    await fastify.prisma.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() }
    })

    request.user = session.user
  })
})

export default authenticatePlugin
```

### Pattern 4: OTP 4-Input Component (UI-06)

From `screens-onboarding.jsx` — replicate exactly:

```typescript
// apps/web/src/components/OtpInput.tsx
// Source: .projeto/design_handoff_cheirin_pao/app/screens-onboarding.jsx
import { useRef, useState } from 'react'

interface OtpInputProps {
  onComplete: (code: string) => void
}

export function OtpInput({ onComplete }: OtpInputProps) {
  const [digits, setDigits] = useState(['', '', '', ''])
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
                useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  const setDigit = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return
    const next = [...digits]
    next[i] = v
    setDigits(next)
    if (v && i < 3) refs[i + 1].current?.focus()
    if (v && i === 3 && next.every(d => d)) onComplete(next.join(''))
  }

  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
      {digits.map((d, i) => (
        <input
          key={i} ref={refs[i]} value={d}
          onChange={e => setDigit(i, e.target.value)}
          maxLength={1} inputMode="numeric"
          style={{
            width: 64, height: 72, textAlign: 'center',
            fontSize: 30, fontWeight: 800,
            fontFamily: 'var(--font-display)',
            color: 'var(--color-text)',
            background: 'var(--color-surface-alt)',
            border: `1.5px solid ${d ? 'var(--color-accent)' : 'var(--color-border)'}`,
            borderRadius: 18, outline: 'none'
          }}
        />
      ))}
    </div>
  )
}
```

### Pattern 5: Zenvia SMS via fetch (no SDK)

```typescript
// apps/api/src/modules/auth/otp.service.ts (SMS portion)
// Source: https://zenvia.com/en/devs/ — API v2
async function sendSmsOtp(phone: string, code: string): Promise<void> {
  const response = await fetch('https://api.zenvia.com/v2/channels/sms/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-TOKEN': process.env.ZENVIA_TOKEN!,
    },
    body: JSON.stringify({
      from: process.env.ZENVIA_FROM,
      to: phone,
      contents: [{ type: 'text', text: `Seu código Cheirin de Pão: ${code}` }],
    }),
  })
  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Zenvia error ${response.status}: ${err}`)
  }
}
```

### Pattern 6: Resend Email OTP (official SDK)

```typescript
// apps/api/src/modules/auth/otp.service.ts (email portion)
// Source: https://resend.com/docs/send-with-nodejs [CITED]
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

async function sendEmailOtp(email: string, code: string): Promise<void> {
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM!,    // e.g. "Cheirin de Pão <noreply@cheirindepao.com.br>"
    to: [email],
    subject: `Seu código de verificação: ${code}`,
    html: `<p>Seu código de verificação é: <strong style="font-size:24px">${code}</strong></p><p>Válido por 10 minutos.</p>`,
  })
  if (error) throw new Error(`Resend error: ${error.message}`)
}
```

### Pattern 7: Prisma Schema Extension (Session + OtpCode)

```prisma
// Append to apps/api/prisma/schema.prisma (after existing models)
// NEVER run `prisma migrate dev` — MongoDB. Run `prisma generate` only.

// 16. Session — persistent device sessions (opaque token, hashed)
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

// 17. OtpCode — one-time codes for login and registration
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

**Important:** Prisma + MongoDB does not support TTL indexes via schema. OTP expiry must be enforced in application code: check `expiresAt < new Date()` before accepting a code.

### Pattern 8: Session Token Generation

```typescript
// Using Node.js built-in crypto only — no external package needed
import { randomBytes, createHash } from 'crypto'

function generateSessionToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('hex')   // 64-char hex string
  const hash = createHash('sha256').update(raw).digest('hex')
  return { raw, hash }
}

function hashOtpCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

function generateOtpCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
}
```

### Pattern 9: Admin Bootstrap on Server Boot

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
      cpf: process.env.ADMIN_CPF ?? '00000000000', // placeholder CPF for admin
    },
  })
  console.log('[bootstrap] Admin user created:', name)
}
```

### Anti-Patterns to Avoid

- **Storing raw token in database:** Always store `sha256(token)` — if the Session collection is compromised, tokens remain unusable.
- **Verifying OTP in the frontend:** OTP validation must be server-side; frontend only sends the code and receives a session token back.
- **Wrapping `RouterProvider` with `AuthProvider` externally in `main.tsx`:** `AuthProvider` placed outside `RouterProvider` cannot call `useNavigate`. Use the layout route pattern instead.
- **Sliding expiry on every request vs checking last-used:** Update `lastUsedAt` on every authenticated request; check `lastUsedAt + 90 days` for expiry, not `createdAt + 90 days`.
- **Using `@zenvia/sdk`:** It transitively depends on the deprecated `request` package with 6 moderate + 2 critical vulnerabilities. Use `fetch` directly against the Zenvia v2 REST API.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email delivery | Custom SMTP client | `resend` SDK | Handles delivery, bounces, retries, dev sandbox |
| UUID v4 generation (client) | Custom random ID | `crypto.randomUUID()` (browser built-in) | Zero deps, cryptographically secure, available since Chrome 92 / Safari 15.4 |
| Token hashing | Custom hash | `crypto.createHash('sha256')` (Node.js built-in) | Constant-time, no deps |
| CPF digit validation | Custom regex | `validateCpf()` function in `packages/shared` | Share between frontend and API; módulo 11 algorithm is non-trivial |
| OTP timer (30s resend countdown) | `setInterval` race conditions | `useState` + `useEffect` countdown | Simple, cancelable, no lib needed |

**Key insight:** For this phase, all crypto operations use Node.js built-ins (`crypto`). External packages are only needed for the OTP email SDK (`resend`) and the browser UUID (`crypto.randomUUID` or `uuid`). Everything else — hashing, token generation, OTP code generation — is in stdlib.

---

## Common Pitfalls

### Pitfall 1: AuthProvider outside RouterProvider loses useNavigate
**What goes wrong:** `AuthProvider` wraps `<RouterProvider>` in `main.tsx`. When `AuthProvider` calls `useNavigate()` (to redirect after login), React throws: "useNavigate() may be used only in the context of a Router component."
**Why it happens:** `useNavigate` requires a Router ancestor. If `AuthProvider` is above `RouterProvider`, no Router ancestor exists.
**How to avoid:** Use `AuthProvider` as a layout route `Component` (the parent of all protected routes), not as a wrapper around `RouterProvider`.
**Warning signs:** Error "useNavigate() may be used only in the context of a Router component" in development.

### Pitfall 2: OTP expiry not enforced (Prisma + MongoDB TTL)
**What goes wrong:** Developer adds `expiresAt` field and assumes MongoDB will auto-delete expired OTP records. Old OTP codes remain valid forever.
**Why it happens:** Prisma MongoDB adapter does not expose TTL index creation in the schema. MongoDB TTL background task only runs every 60 seconds, and requires a separate `createIndex` command that Prisma's `generate` step does not issue.
**How to avoid:** Always check `otpCode.expiresAt < new Date()` in `auth.service.ts` before accepting any OTP code. Do not rely on the record being absent as a proxy for expiry.
**Warning signs:** Codes submitted after 10 minutes still being accepted in integration tests.

### Pitfall 3: Sending bearer token without device_id header
**What goes wrong:** Frontend sends `Authorization: Bearer <token>` but omits the `X-Device-Id` header on some requests. The `authenticate` plugin cannot perform device mismatch detection, silently allowing session access from a different device.
**Why it happens:** Forgetting to include `device_id` (from `localStorage`) in every API request. Different fetch utilities/interceptors may not all add the header.
**How to avoid:** Create a single `apiFetch` wrapper in the frontend that always injects both `Authorization` and `X-Device-Id` from `localStorage`. All API calls go through this wrapper.
**Warning signs:** Device mismatch detection (AUTH-06) not triggering in manual tests.

### Pitfall 4: CPF validation: rejecting formatted vs unformatted input
**What goes wrong:** Frontend sends CPF as `"123.456.789-09"` (formatted) but API validates raw digits only, causing false negatives.
**Why it happens:** Input masking adds `.` and `-` characters. Server-side Zod schema expects 11 digits.
**How to avoid:** Always strip non-numeric characters before validation: `cpf.replace(/\D/g, '')`. Place the strip + validate logic in `packages/shared/src/schemas/index.ts` as a shared Zod refinement.
**Warning signs:** CPF validation passing in frontend but failing in API.

### Pitfall 5: Race condition in 5-step registration — duplicate OTP sends
**What goes wrong:** User completes step 4 (address) and taps "Enviar código" twice quickly. Two OTP codes are sent; the second invalidates the first (if de-duplication is by `usedAt` only).
**Why it happens:** No debounce/loading state on the "Enviar código" button.
**How to avoid:** Disable the button immediately on first tap and show a loading state. On the API, check if an unused, non-expired `OtpCode` exists for this user before generating a new one — reuse it.
**Warning signs:** Users reporting not receiving an OTP or receiving two.

### Pitfall 6: `localStorage` unavailable (private browsing / storage blocked)
**What goes wrong:** `localStorage.getItem('auth_token')` returns `null` even after login in some iOS Safari private browsing configurations.
**Why it happens:** iOS Safari in private mode blocks `localStorage` access (it throws a security error or silently fails).
**How to avoid:** Wrap all `localStorage` calls in try/catch. If unavailable, fall back to in-memory state (user will need to re-authenticate on refresh, which is acceptable).
**Warning signs:** Login appearing to succeed but user being redirected back to splash immediately.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Wrap RouterProvider with Context | AuthProvider as layout route `Component` | React Router v6.4+ | `useNavigate` works inside provider |
| `bcrypt` for all hashing | `crypto.createHash('sha256')` for tokens, `bcryptjs` for passwords | Node.js 15+ | Zero deps for token hashing |
| JWT for stateless sessions | Opaque session tokens in DB (D-01) | Project decision | Enables per-device revocation |
| `uuid` npm package | `crypto.randomUUID()` browser built-in | Chrome 92 / Safari 15.4 (2021) | Zero deps for device ID |

**Deprecated/outdated in this context:**
- `@zenvia/sdk`: functional but transitively depends on `request` (deprecated 2020). Direct `fetch` is simpler and has zero vulnerability surface.
- `bcryptjs` for session token hashing: overkill for short random tokens (sha256 is sufficient; bcrypt's slow hashing is only useful for passwords, which this app doesn't have).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Zenvia's REST API endpoint is `POST https://api.zenvia.com/v2/channels/sms/messages` with `X-API-TOKEN` header | Standard Stack / Code Examples | Zenvia API might use a different auth header or endpoint in current version — verify against Zenvia dashboard before first deploy |
| A2 | `crypto.randomUUID()` is available in all browsers the PWA targets (Android Chrome, iOS Safari 16.4+) | Standard Stack | iOS 15.4+ required — app targets iOS 16.4+ (from CLAUDE.md) so this is safe, but verify |
| A3 | Resend free tier (3,000 emails/month) is sufficient for the MVP | Standard Stack | If user base grows quickly this could be exceeded; monitor |
| A4 | Admin CPF is either not required or can be a placeholder (the User model has `cpf @unique`) | Pattern 9 bootstrap | If CPF is validated on all users including Admin, the seed will need a real CPF env var |
| A5 | The `X-Device-Id` request header name is the correct convention for passing device ID from frontend | Pattern 3 authenticate | Could use any header name; planner should standardize across all plans |

**If this table is empty:** — it is not empty; see above.

---

## Open Questions (RESOLVED)

1. **Admin CPF requirement for bootstrap**
   - What we know: `User.cpf` is `@unique` in the Prisma schema. CPF is required for CLIENT and COURIER.
   - What's unclear: Should ADMIN users also have a real CPF? The CONTEXT.md `D-09` doesn't mention CPF for admin bootstrap env vars.
   - Recommendation: Add `ADMIN_CPF` to `.env.example` as optional. If absent, use a placeholder like `'00000000000'` with a note that it should be updated. Alternatively, make `cpf` nullable for ADMIN role.
   - **RESOLVED:** Admin CPF is optional. `admin-seed.ts` (Plan 02-02b) uses `process.env.ADMIN_CPF ?? '00000000000'` as a placeholder. `ADMIN_CPF` is documented in `.env.example` as an optional env var with an inline comment. No schema change required — the placeholder value satisfies the `@unique` constraint at bootstrap time.

2. **`X-Device-Id` header naming**
   - What we know: CONTEXT.md says device_id is sent; doesn't specify the HTTP header name.
   - What's unclear: Is the header `X-Device-Id`, `x-device-id`, `device-id`, or sent as part of the request body?
   - Recommendation: Use `X-Device-Id` HTTP header (consistent with common API conventions). Document in `authenticate.ts` and the frontend `apiFetch` wrapper.
   - **RESOLVED:** Standardized as `X-Device-Id` HTTP header (title-case). Used in `authenticate.ts` (`request.headers['x-device-id']`) and injected by the frontend `apiFetch` wrapper on every call. Both Plans 02-02b and 02-04 implement this consistently.

3. **Condominium list population for step 3 of registration**
   - What we know: Step 3 of `OnboardingScreen` shows a searchable list of condominiums from the database.
   - What's unclear: At Phase 2, no condominiums are seeded. The empty state is handled in the design ("Seu condomínio ainda não é parceiro"). But should Phase 2 include a seed of at least one test condominium to enable success criteria #1 to be verifiable?
   - Recommendation: Add a `GET /condominiums` public endpoint in Phase 2 (needed for the registration form) and seed 1-2 test condominiums in the bootstrap step.
   - **RESOLVED:** `GET /condominiums` public endpoint is included in Plan 02-02b (`condominiums.route.ts`). The CondoSearch empty state ("Seu condomínio ainda não é parceiro.") handles the zero-condominium case gracefully. Manual success criterion SC1 (complete registration) requires at least one condominium in Atlas — the developer seeds one manually or via the Atlas UI during Phase 2 testing.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | API server | ✓ | v20.20.2 | — |
| npm | Package management | ✓ | 11.12.1 | — |
| MongoDB Atlas | Session/OtpCode storage | ✓ (remote) | Atlas (cloud) | No local fallback by design |
| Zenvia API | SMS OTP delivery | ✗ (credentials needed) | REST API | Dev mode: `OTP_DEV_CODE=1234` |
| Resend | Email OTP delivery | ✗ (API key needed) | SDK | Dev mode: `OTP_DEV_CODE=1234` |
| `mongosh` | Manual DB inspection | ✗ | — | MongoDB Atlas web UI |

**Missing dependencies with no fallback:**
- Zenvia API credentials (`ZENVIA_TOKEN`, `ZENVIA_FROM`) — needed for production SMS. Dev mode bypass (`OTP_DEV_CODE=1234`) covers local development.
- Resend API key (`RESEND_API_KEY`, `RESEND_FROM`) — needed for production email. Dev mode bypass covers local development.

**Missing dependencies with fallback:**
- `mongosh`: Atlas web UI is sufficient for verifying documents in Session/OtpCode collections during development.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (frontend only, already configured) |
| Config file | `apps/web/vitest.config.ts` — jsdom environment, setupFiles: `src/test-setup.ts` |
| Quick run command | `npm run test --workspace=@cheirin-de-pao/web` |
| Full suite command | `npm test` (Turborepo runs all workspaces) |

**API testing:** No Vitest config in `apps/api` — the API has no test infrastructure from Phase 1. Phase 2 should add a Vitest config for unit-testable auth business logic (OTP generation, CPF validation, token hashing). Integration tests against real MongoDB Atlas are out of scope for the MVP.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-02 | CPF validation — módulo 11 algorithm | unit | `npm run test --workspace=@cheirin-de-pao/shared` | ❌ Wave 0 |
| AUTH-03 | Block/unit conditional — Zod schema refinement | unit | `npm run test --workspace=@cheirin-de-pao/api` | ❌ Wave 0 |
| AUTH-05 | OTP code generation — 4 digits, 1000-9999 range | unit | `npm run test --workspace=@cheirin-de-pao/api` | ❌ Wave 0 |
| AUTH-05 | Dev mode bypass — OTP_DEV_CODE=1234 accepted | unit | `npm run test --workspace=@cheirin-de-pao/api` | ❌ Wave 0 |
| AUTH-06 | Session expiry check — `expiresAt < now()` returns 401 | unit | `npm run test --workspace=@cheirin-de-pao/api` | ❌ Wave 0 |
| AUTH-06 | Device mismatch — `deviceId` mismatch revokes session | unit | `npm run test --workspace=@cheirin-de-pao/api` | ❌ Wave 0 |
| UI-06 | OTP input — focus advances to next digit on input | component | `npm run test --workspace=@cheirin-de-pao/web` | ❌ Wave 0 |
| AUTH-01 | 5-step registration — success criteria manual | manual | — | N/A |
| AUTH-07 | Courier registration by Admin — success criteria | manual | — | N/A |

### Sampling Rate
- **Per task commit:** `npm run test --workspace=@cheirin-de-pao/web` (frontend unit tests, ~5s)
- **Per wave merge:** `npm test` (full suite across all workspaces)
- **Phase gate:** Full suite green + manual success criteria checklist before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/shared/src/__tests__/cpf.test.ts` — covers AUTH-02 CPF validation
- [ ] `apps/api/vitest.config.ts` — no API test infrastructure exists; needs setup
- [ ] `apps/api/src/__tests__/auth.service.test.ts` — covers AUTH-05/06 OTP + session logic
- [ ] `apps/web/src/components/__tests__/OtpInput.test.tsx` — covers UI-06 OTP focus behavior

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | OTP-only (no password); opaque session token; 10-min OTP TTL |
| V3 Session Management | yes | 90-day inactivity expiry; per-device binding; `isRevoked` flag; `onRequest` hook validates every request |
| V4 Access Control | yes | `user.role` checked in both API (`authenticate` plugin) and frontend (ProtectedRoute) |
| V5 Input Validation | yes | Zod schemas in `auth.schema.ts` + `packages/shared`; CPF módulo 11; phone format strip |
| V6 Cryptography | yes | `crypto.randomBytes(32)` for token generation; `createHash('sha256')` for storage — Node.js built-in only |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| OTP brute force (10,000 possible codes) | Tampering | 10-min expiry + mark `usedAt` immediately; rate limit deferred to post-MVP |
| Session token theft via XSS | Information Disclosure | `localStorage` (XSS risk acknowledged in D-02); app does not render external HTML |
| Device ID spoofing | Spoofing | device_id is a convenience signal, not a security control; session token hash is the primary auth |
| Session fixation | Elevation of Privilege | New session created on every OTP verification — no pre-auth session reuse |
| Plaintext OTP in transit | Information Disclosure | HTTPS enforced by Nginx + Let's Encrypt in production; local dev uses HTTP (acceptable) |
| Admin bootstrap from env vars | Tampering | Admin only created if no ADMIN role exists; idempotent on every restart |

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 2 |
|-----------|-------------------|
| Stack Frontend: React + Vite + Tailwind CSS + Zod | Auth screens use Tailwind/CSS-vars, Zod for form validation |
| Stack Backend: Node.js + Fastify + Prisma + MongoDB Atlas | Auth module follows Fastify plugin + Prisma patterns from Phase 1 |
| Monorepo: Turborepo + npm workspaces | New packages installed per workspace; shared CPF validation in `packages/shared` |
| Banco: MongoDB Atlas remoto | No local MongoDB; OTP TTL is application-enforced only |
| Autenticação: Sem senha — apenas OTP via SMS/e-mail | Confirmed by all D-0x decisions |
| Fidelidade de Design: Alta fidelidade | OTP inputs must match `screens-onboarding.jsx` exactly (64×72px, raio 18, `--color-accent` border on fill) |
| GSD Workflow Enforcement | All file changes via GSD workflow |

---

## Sources

### Primary (HIGH confidence)
- `apps/api/src/modules/health/health.route.ts` — Fastify module pattern (in-repo, verified)
- `apps/web/src/routes/router.tsx` — existing React Router structure (in-repo, verified)
- `.projeto/design_handoff_cheirin_pao/app/screens-onboarding.jsx` — canonical UI reference (in-repo, verified)
- `.projeto/design_handoff_cheirin_pao/app/brand.jsx` — design tokens (in-repo, verified)
- `apps/api/prisma/schema.prisma` — existing Prisma schema (in-repo, verified)
- `packages/shared/src/schemas/index.ts` — UserRoleSchema (in-repo, verified)
- https://resend.com/docs/send-with-nodejs — Resend SDK usage [CITED]
- https://fastify.dev/docs/latest/Reference/Hooks/ — Fastify onRequest hook, scope behavior [CITED]

### Secondary (MEDIUM confidence)
- https://blog.logrocket.com/authentication-react-router-v7/ — AuthProvider as layout route pattern, verified against React Router v7 API
- WebSearch: Zenvia v2 REST API endpoint + `X-API-TOKEN` header (multiple sources agree; D-04 confirmed via CONTEXT.md as locked decision)
- npm registry: `resend@6.12.4`, `uuid@14.0.0` version verification

### Tertiary (LOW confidence)
- A1: Zenvia exact endpoint URL — confirmed by multiple independent WebSearch results but not verified against live Zenvia dashboard with credentials

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all packages verified via npm registry; patterns verified against official Fastify + React Router docs
- Architecture: HIGH — based on existing Phase 1 code patterns in-repo
- OTP Provider Integration: MEDIUM — Zenvia REST API endpoint and auth header confirmed by multiple secondary sources; Resend confirmed by official docs
- Pitfalls: HIGH — derived from direct analysis of Prisma MongoDB limitations and React Router v7 router context constraints

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 (30 days for stable stack; Zenvia API endpoint should be re-verified before first deploy)
