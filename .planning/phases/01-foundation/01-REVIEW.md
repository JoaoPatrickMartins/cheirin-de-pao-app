---
phase: 01-foundation
reviewed: 2026-06-13T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - apps/api/prisma/schema.prisma
  - apps/api/src/modules/health/health.route.ts
  - apps/api/src/plugins/prisma.ts
  - apps/api/src/server.ts
  - apps/web/src/components/brand/BreadMark.tsx
  - apps/web/src/components/brand/Icon.tsx
  - apps/web/src/hooks/useInstallPrompt.ts
  - apps/web/src/main.tsx
  - apps/web/src/pages/splash/SplashScreen.tsx
  - apps/web/src/routes/router.tsx
  - apps/web/src/styles/globals.css
  - apps/web/src/sw.ts
  - apps/web/vite.config.ts
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-13
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed all 13 source files from the Phase 01 Foundation implementation: 4 backend API files (Prisma schema, Fastify server, Prisma plugin, health route) and 9 frontend files (Vite config, Tailwind tokens, service worker, main entry, hooks, components, pages, router).

The walking-skeleton structure is sound and the implementation follows the plan's patterns well. The CORS, Prisma, and plugin registration order are implemented correctly. Three critical issues were found: error details exposed in the public health endpoint may include MongoDB hostnames or internal error messages; the CORS security gate is silently bypassed if `NODE_ENV` is not set to `'production'` in a production deployment; and the `.env` file placement creates a non-obvious developer experience gap. Five warnings cover a logic bug in the install prompt dismissal flow, the missing iOS sheet entrance animation, the `Notification` model's mutable `isRead` field contradicting its "immutable log" designation, the missing workspace-level `.env.example`, and missing keyboard accessibility on the iOS overlay. Three info items cover a relative path for the OneSignal worker, a minor icon count discrepancy, and a secondary button with a no-op handler.

---

## Critical Issues

### CR-01: Health endpoint leaks internal error detail to unauthenticated callers

**File:** `apps/api/src/modules/health/health.route.ts:9`

**Issue:** The 503 response includes `error: String(err)` verbatim. When Prisma fails to reach MongoDB Atlas, `PrismaClientInitializationError` messages include the Atlas cluster hostname (e.g. `"Can't reach database server at cluster0.xxxxx.mongodb.net:27017"`). This exposes infrastructure topology to anyone who can reach the `/health` endpoint, which has no authentication or rate limiting. A future `PrismaClientKnownRequestError` can include query fragments. The endpoint is completely public.

**Fix:** Return a sanitised message in production; keep the full error only in the server log (Fastify already logs it via `fastify.log`):

```typescript
export const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_request, reply) => {
    try {
      await fastify.prisma.$runCommandRaw({ ping: 1 })
      return reply.send({ ok: true, db: 'connected' })
    } catch (err) {
      fastify.log.error(err, 'MongoDB health check failed')
      const isProd = process.env.NODE_ENV === 'production'
      return reply.status(503).send({
        ok: false,
        db: 'disconnected',
        ...(isProd ? {} : { error: String(err) }),
      })
    }
  })
}
```

---

### CR-02: CORS security gate silently opens if NODE_ENV is absent in production

**File:** `apps/api/src/server.ts:31-35`

**Issue:** The CORS origin is controlled by `process.env.NODE_ENV === 'production'`. If a production deployment does not explicitly set `NODE_ENV=production` (e.g. a misconfigured Docker container, a hosting script that omits the variable, or a developer testing a production build locally), the condition evaluates to `false` and CORS is set to `'http://localhost:5173'` instead of `false`. The `envSchema` validated by `@fastify/env` does not include `NODE_ENV` in its `required` list, so the server starts successfully without it. A missing `NODE_ENV` in production is silent and hard to detect.

**Fix:** Add `NODE_ENV` to the `envSchema` so the server refuses to start without it, or flip the default to the safer value (deny all) and explicitly opt in for dev:

```typescript
// Option A: Fail-safe default (safest)
const origin = process.env.NODE_ENV === 'development'
  ? 'http://localhost:5173'
  : false   // deny CORS by default; explicit allowlist added when domain is known

// Option B: Validate NODE_ENV at startup
const envSchema = {
  type: 'object',
  required: ['DATABASE_URL', 'NODE_ENV'],
  properties: {
    DATABASE_URL: { type: 'string' },
    NODE_ENV: { type: 'string', enum: ['development', 'production', 'test'] },
    API_PORT: { type: 'integer', default: 3001 },
    API_HOST: { type: 'string', default: '0.0.0.0' },
  },
}
```

Option A requires no schema change and inverts the risk: a missing `NODE_ENV` in dev shows a CORS error in the browser (visible, easy to diagnose) rather than silently allowing localhost origin in production (invisible, dangerous).

---

### CR-03: No apps/api/.env.example — root .env.example is not found by @fastify/env

**File:** `apps/api/src/server.ts:26` / `.env.example` (root)

**Issue:** `@fastify/env` with `dotenv: true` reads the `.env` file from `process.cwd()`. Turborepo runs each workspace's `dev` script from that workspace's directory (`apps/api/`), so `@fastify/env` looks for `apps/api/.env`. The only `.env.example` is at the repository root. The `01-02-SUMMARY.md` developer setup section says "Copy `.env.example` to `apps/api/.env`", but there is no `apps/api/.env.example` to make this expectation clear. A developer who copies the root example to `apps/api/.env` will get it right, but a developer who creates a root `.env` (which is the more intuitive action given the example lives there) will see `@fastify/env` fail with "Environment variable not found: DATABASE_URL" and have no obvious path to resolution.

This is a correctness issue, not just documentation: a developer following the most natural convention will have a broken dev environment.

**Fix:** Add `apps/api/.env.example` with the same API-relevant variables:

```
# apps/api/.env.example
# Copy this file to apps/api/.env and fill in real values

# MongoDB Atlas (required — get from Atlas dashboard)
DATABASE_URL="mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/cheirin-dev?retryWrites=true&w=majority"

# API server
NODE_ENV=development
API_PORT=3001
API_HOST=0.0.0.0
```

Note this also surfaces the `NODE_ENV` omission from CR-02.

---

## Warnings

### WR-01: useInstallPrompt leaves isInstallable=true after user dismisses the native prompt

**File:** `apps/web/src/hooks/useInstallPrompt.ts:37-39`

**Issue:** After `triggerInstall()` is called, if the user dismisses the native install dialog (`outcome === 'dismissed'`), only `deferredPrompt` is set to `null`. `isInstallable` remains `true`. The UI will continue showing the install CTA as if the install can be triggered, but the next call to `triggerInstall()` returns early because `deferredPrompt` is `null`. This creates a broken UI state: the button appears active but does nothing. The `beforeinstallprompt` event fires at most once per browser session (Chrome does not re-fire it after dismissal), so the state is permanently stuck.

**Fix:** Set `isInstallable(false)` on both `'accepted'` and `'dismissed'` outcomes:

```typescript
const { outcome } = await deferredPrompt.userChoice
setIsInstallable(false)   // always clear — prompt can only be used once
setDeferredPrompt(null)
```

---

### WR-02: iOS install sheet renders without entrance animation — slide-up never plays

**File:** `apps/web/src/pages/splash/SplashScreen.tsx:226-228`

**Issue:** The plan specification states: "initial transform `translateY(100%)`, animated to `translateY(0)` via CSS transition 300ms ease-out." The implementation sets `transform: 'translateY(0)'` as the static initial value. The `transition` property is present but there is no state change to animate from. The sheet appears instantly (no slide-up), which breaks the specified UX and may feel abrupt, particularly on iOS where bottom sheets are a standard affordance with expected motion.

**Fix:** Use a state variable to drive the animation:

```tsx
function IOSInstallSheet({ onDismiss }: IOSInstallSheetProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger after mount so CSS transition has a starting frame
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <>
      <div onClick={onDismiss} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 40 }} />
      <div
        style={{
          // ... other styles
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 300ms ease-out',
        }}
      >
        {/* content */}
      </div>
    </>
  )
}
```

---

### WR-03: Notification model contradicts "immutable log" designation by having a mutable isRead field

**File:** `apps/api/prisma/schema.prisma:273-282`

**Issue:** The schema comment on line 272 states `// (imutável — sem updatedAt)` and the plan explicitly calls Notification an "immutable audit log." However, the model includes `isRead Boolean @default(false)` — a field that must be mutated when a user reads a notification. MongoDB does not enforce field-level immutability; Prisma has no built-in mechanism either. An application layer update of `isRead` will occur with no `updatedAt` timestamp, making it impossible to know when the notification was read or to audit the change. This is a semantic inconsistency that will mislead future developers about the model's mutability contract and can cause operational confusion.

**Fix (two options):**

Option A — Remove the immutability claim; add `updatedAt`:
```prisma
model Notification {
  // ... existing fields
  isRead      Boolean          @default(false)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt  // track when isRead was set
}
```

Option B — Remove `isRead` from the Notification model and track read state in a separate `NotificationRead` model or as a field on User, keeping Notification truly immutable.

Option A is lower friction for Phase 01; Option B is architecturally cleaner.

---

### WR-04: IOSInstallSheet overlay div has no keyboard handler — keyboard users cannot dismiss

**File:** `apps/web/src/pages/splash/SplashScreen.tsx:205-213`

**Issue:** The overlay `<div onClick={onDismiss}>` allows mouse/touch dismissal but provides no keyboard interaction (`onKeyDown`, `role`, `tabIndex`). The `Escape` key is a standard expectation for dismissing modal overlays. The sheet itself also lacks `role="dialog"` and `aria-modal="true"`, which means screen readers do not announce it as a modal dialog and may allow focus to escape to background content.

**Fix:**

```tsx
<div
  onClick={onDismiss}
  onKeyDown={(e) => e.key === 'Escape' && onDismiss()}
  role="button"
  tabIndex={-1}   // focusable but not in tab order (sheet content is)
  aria-label="Fechar instruções"
  style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 40 }}
/>
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="ios-sheet-title"
  style={{ /* ... */ }}
>
  <h2 id="ios-sheet-title">Adicionar à tela inicial</h2>
  {/* ... */}
</div>
```

---

### WR-05: Prisma plugin calls $connect() eagerly — startup blocks on Atlas round-trip

**File:** `apps/api/src/plugins/prisma.ts:13`

**Issue:** `await prisma.$connect()` is called inside the plugin registration, which blocks the Fastify startup sequence until the MongoDB Atlas TCP handshake and TLS negotiation complete (typically 200–600 ms on a cold connection from a VPS to Atlas). If Atlas is unreachable at startup time (network partition, incorrect DATABASE_URL, Atlas cluster paused), the server fails to start entirely — there is no health-degraded mode where the server runs but reports "db: disconnected." This behavior is documented implicitly in the plan ("GET /health returns 503 when DATABASE_URL is invalid") but that path is only reachable if the server starts at all. A wrong `DATABASE_URL` will cause the server to crash at startup rather than start and report 503 on `/health`.

Additionally, Prisma v6 with the MongoDB adapter performs lazy connection on first query by default; the explicit `$connect()` call is unnecessary.

**Fix:** Remove the eager `$connect()` call. Prisma will connect on the first `$runCommandRaw` in the health route, which correctly surfaces a 503 rather than a startup crash:

```typescript
const prismaPlugin: FastifyPluginAsync = fp(async (fastify) => {
  const prisma = new PrismaClient()
  // Do NOT call $connect() here — Prisma connects lazily on first query.
  // A bad DATABASE_URL will be caught by GET /health returning 503,
  // rather than preventing the server from starting.
  fastify.decorate('prisma', prisma)
  fastify.addHook('onClose', async (app) => {
    await app.prisma.$disconnect()
  })
})
```

---

## Info

### IN-01: OneSignal serviceWorkerPath is a relative URL without a leading slash

**File:** `apps/web/src/main.tsx:20`

**Issue:** `serviceWorkerPath: 'push/onesignal/OneSignalSDKWorker.js'` is a relative URL. Since `OneSignal.init()` is called at module load time while the page is at `/`, this resolves to `/push/onesignal/OneSignalSDKWorker.js` and works correctly in practice. However, if the app ever uses a non-root `base` in `vite.config.ts`, or if `OneSignal.init()` is ever moved to a component that renders on a sub-route, the relative resolution will silently break. The `serviceWorkerParam.scope` already uses an absolute path (`/push/onesignal/`), and the path should be consistent.

**Fix:**
```typescript
serviceWorkerPath: '/push/onesignal/OneSignalSDKWorker.js',
```

---

### IN-02: Ic map in Icon.tsx contains 43 entries; plan and SUMMARY state 42

**File:** `apps/web/src/components/brand/Icon.tsx:1-45`

**Issue:** The `Ic` record contains 43 path entries. The plan (`01-03-PLAN.md`) and SUMMARY (`01-03-SUMMARY.md`) state "42-path Ic map from brand.jsx." One extra icon was included beyond the canonical source count. This is not a runtime error but creates a discrepancy between the stated specification and the implementation.

**Fix:** Identify and remove the extra entry, or update the plan/summary to reflect 43 icons. Either way the discrepancy should be resolved so future developers know the canonical icon set size.

---

### IN-03: Secondary "Já tenho conta" button has a no-op handler with a comment

**File:** `apps/web/src/pages/splash/SplashScreen.tsx:127`

**Issue:** `onClick={() => {/* navigate to login — Phase 2 */}}` is a do-nothing handler. The button appears interactive, has a cursor and minimum touch target, but pressing it produces no feedback and no navigation. On mobile, tapping with no visible response is disorienting. The comment confirms this is intentional as a Phase 2 stub, but there is no visual indication to the user that the action was received.

**Fix:** For a Phase 1 stub, disable the button visually or add a toast/console message so the lack of navigation is attributable. Alternatively, use `disabled` styling until Phase 2 wires the route:

```tsx
<button
  disabled
  style={{
    // ... existing styles,
    opacity: 0.5,
    cursor: 'not-allowed',
  }}
>
  Já tenho conta — entrar
</button>
```

---

_Reviewed: 2026-06-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
