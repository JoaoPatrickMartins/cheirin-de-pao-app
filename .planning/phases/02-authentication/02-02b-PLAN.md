---
phase: 02-authentication
plan: 02b
type: execute
wave: 2
depends_on: [02-02]
files_modified:
  - apps/api/src/modules/auth/auth.route.ts
  - apps/api/src/modules/auth/auth.controller.ts
  - apps/api/src/plugins/authenticate.ts
  - apps/api/src/bootstrap/admin-seed.ts
  - apps/api/src/modules/condominiums/condominiums.route.ts
  - apps/api/src/server.ts
autonomous: true
requirements: [AUTH-07, AUTH-08]

must_haves:
  truths:
    - "POST /auth/register, POST /auth/otp/send, POST /auth/otp/verify, POST /auth/couriers are all reachable HTTP endpoints"
    - "GET /condominiums returns 200 with a JSON array (public, no auth required)"
    - "Protected routes that register fastify.authenticate as preHandler reject requests without a valid Bearer token"
    - "Public routes (register, otp/send, otp/verify, condominiums) work without any Authorization header"
    - "Admin is auto-seeded on server boot from env vars if no ADMIN role exists in DB"
    - "POST /auth/couriers requires Admin bearer token (preHandler: [fastify.authenticate]) and checks role === ADMIN"
  artifacts:
    - path: "apps/api/src/modules/auth/auth.route.ts"
      provides: "Fastify auth routes: POST /auth/register, POST /auth/otp/send, POST /auth/otp/verify, POST /auth/couriers"
      exports: ["authRoute"]
    - path: "apps/api/src/modules/auth/auth.controller.ts"
      provides: "Request/response parsing and Zod validation for all auth endpoints"
      exports: ["AuthController"]
    - path: "apps/api/src/plugins/authenticate.ts"
      provides: "Fastify plugin: decorateRequest('user') + fastify.authenticate preHandler decorator (no global onRequest hook)"
      exports: ["default (authenticatePlugin)"]
    - path: "apps/api/src/bootstrap/admin-seed.ts"
      provides: "seedAdminIfAbsent() called from server start()"
      exports: ["seedAdminIfAbsent"]
    - path: "apps/api/src/modules/condominiums/condominiums.route.ts"
      provides: "GET /condominiums endpoint (public)"
      exports: ["condominiumsRoute"]
  key_links:
    - from: "apps/api/src/modules/auth/auth.route.ts"
      to: "apps/api/src/plugins/authenticate.ts"
      via: "preHandler: [fastify.authenticate] on POST /auth/couriers only"
      pattern: "fastify\\.authenticate"
    - from: "apps/api/src/plugins/authenticate.ts"
      to: "apps/api/prisma/schema.prisma Session model"
      via: "fastify.prisma.session.findFirst inside preHandler"
      pattern: "fastify\\.prisma\\.session"
    - from: "apps/api/src/server.ts"
      to: "apps/api/src/bootstrap/admin-seed.ts"
      via: "seedAdminIfAbsent(fastify.prisma) called after prismaPlugin registration"
      pattern: "seedAdminIfAbsent"
---

<objective>
Wire the auth business logic to Fastify HTTP routes: auth controller, auth routes, the authenticate plugin (preHandler-only, no global hook), admin bootstrap, condominiums endpoint, and server.ts registration.

Purpose: Plan 02-02 built all business logic in isolation. This plan wires it to the HTTP layer. After this plan the running API accepts OTP-based login/registration in dev mode and GET /condominiums is available for the registration form. Frontend plans 03–05 consume these endpoints directly.
Output: 6 modified files. Running API server handles all auth routes.
</objective>

<execution_context>
@/root/.claude/get-shit-done/workflows/execute-plan.md
@/root/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/02-authentication/02-CONTEXT.md
@.planning/phases/02-authentication/02-RESEARCH.md
@.planning/phases/02-authentication/02-PATTERNS.md
@.planning/phases/02-authentication/02-02-SUMMARY.md

<interfaces>
<!-- Key contracts the executor needs. Extracted from codebase. -->

From apps/api/src/modules/health/health.route.ts (exact Fastify plugin pattern):
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

From apps/api/src/plugins/prisma.ts (fp() plugin shape — exact analog for authenticate.ts):
```typescript
import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
const prismaPlugin: FastifyPluginAsync = fp(async (fastify) => {
  fastify.decorate('prisma', prisma)
  fastify.addHook('onClose', async (app) => { await app.prisma.$disconnect() })
})
export default prismaPlugin
```

From apps/api/src/server.ts (current structure — to be extended):
```typescript
// envSchema properties to add for Phase 2 (per PATTERNS.md):
// NODE_ENV, OTP_DEV_CODE, ZENVIA_TOKEN, ZENVIA_FROM, RESEND_API_KEY, RESEND_FROM,
// ADMIN_NAME, ADMIN_PHONE, ADMIN_EMAIL, ADMIN_CPF
// Registration order after prismaPlugin:
//   await seedAdminIfAbsent(fastify.prisma)
//   await fastify.register(authenticatePlugin)
//   await fastify.register(authRoute)
//   await fastify.register(condominiumsRoute)
```

From apps/api/src/modules/auth/auth.service.ts (after Plan 02-02):
```typescript
export class AuthService {
  register(body): Promise<{ userId: string }>
  sendOtp(userId, channel, dest): Promise<void>
  verifyOtpAndCreateSession(userId, code, deviceId): Promise<{ rawToken: string; user: { id, role, name } }>
  registerCourier(body): Promise<{ id: string; name: string; role: string }>
}
```

From apps/api/src/modules/auth/auth.schema.ts (after Plan 02-02):
```typescript
export const RegisterSchema        // z.infer → RegisterBody
export const SendOtpSchema         // z.infer → SendOtpBody
export const VerifyOtpSchema       // z.infer → VerifyOtpBody
export const RegisterCourierSchema // z.infer → RegisterCourierBody
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Auth controller, routes, authenticate plugin (preHandler only), admin bootstrap, condominiums, server wiring</name>
  <files>
    apps/api/src/modules/auth/auth.controller.ts,
    apps/api/src/modules/auth/auth.route.ts,
    apps/api/src/plugins/authenticate.ts,
    apps/api/src/bootstrap/admin-seed.ts,
    apps/api/src/modules/condominiums/condominiums.route.ts,
    apps/api/src/server.ts
  </files>
  <read_first>
    - apps/api/src/server.ts (full file — extend envSchema + register new plugins and routes in correct order)
    - apps/api/src/modules/health/health.route.ts (exact Fastify plugin pattern to replicate)
    - apps/api/src/plugins/prisma.ts (fp() + decorateRequest plugin pattern for authenticate.ts)
    - .planning/phases/02-authentication/02-RESEARCH.md (Pattern 3 authenticate plugin original code — read to understand the logic, NOT the hook strategy; see action below for the correct approach, Pattern 9 admin seed, Pitfall 3 device header)
    - .planning/phases/02-authentication/02-PATTERNS.md (auth.route.ts, authenticate.ts, admin-seed.ts, server.ts sections)
    - apps/api/prisma/schema.prisma (verify prisma.condominium model exists for GET /condominiums)
  </read_first>
  <action>
    1. auth.controller.ts: AuthController class with methods register, sendOtp, verifyOtp, registerCourier. Each method: parse body with corresponding Zod schema (.parse throws on invalid — catch and return 400 with {error: string}), call AuthService method, return appropriate status (201 for register/registerCourier, 200 for sendOtp/verifyOtp). On verifyOtp success, return { token: rawToken, user: { id, role, name } }.

    2. auth.route.ts: FastifyPluginAsync. Registers POST /auth/register (no preHandler), POST /auth/otp/send (no preHandler), POST /auth/otp/verify (no preHandler), POST /auth/couriers (preHandler: [fastify.authenticate] — requires ADMIN role check in controller). Export as authRoute.

    3. authenticate.ts: Use fp() so the plugin decorates the root Fastify instance (scope: all child plugins can call fastify.authenticate as a preHandler). Implementation strategy: ONLY use a preHandler decorator, NEVER a global addHook('onRequest') hook.

       Step A — module augmentation:
       ```
       declare module 'fastify' {
         interface FastifyRequest {
           user: { id: string; role: string; name: string } | null
         }
         interface FastifyInstance {
           authenticate: preHandlerHookHandler
         }
       }
       ```

       Step B — decorateRequest('user', null): sets request.user = null on every request by default. This ensures public routes always have request.user available (as null) without any conditional logic.

       Step C — decorate('authenticate', preHandlerFn): The preHandler function validates the Authorization header, hashes the token, queries prisma.session, checks isRevoked + expiresAt, checks X-Device-Id mismatch (per D-08), updates lastUsedAt, and sets request.user. If validation fails, returns reply.status(401) with an error message. This function is ONLY invoked on routes that explicitly register it as a preHandler — it is NOT wired to any global hook. Public routes (POST /auth/register, POST /auth/otp/send, POST /auth/otp/verify, GET /condominiums) do NOT use preHandler and receive request.user = null (the decorateRequest default).

       Do NOT use addHook('onRequest', ...) inside this plugin. The global hook approach in RESEARCH.md Pattern 3 returns 401 on every request without a Bearer header, which breaks all public endpoints. The preHandler opt-in approach avoids this entirely.

    4. admin-seed.ts: seedAdminIfAbsent(prisma: PrismaClient) as exported async function. Reads ADMIN_NAME, ADMIN_PHONE/ADMIN_EMAIL from process.env. If missing, console.warn and return. findFirst where role ADMIN. If exists, return. Otherwise prisma.user.create with role ADMIN, cpf = process.env.ADMIN_CPF ?? '00000000000' (placeholder per A4 resolution). Log '[bootstrap] Admin user created: name'.

    5. condominiums.route.ts: FastifyPluginAsync at GET /condominiums (no preHandler — public route). Query fastify.prisma.condominium.findMany({ orderBy: { name: 'asc' } }). Return array of { id, name, type, neighborhood } — map to only send fields needed by registration form step 2. Export as condominiumsRoute.

    6. server.ts modifications:
       - Extend envSchema.properties with: NODE_ENV (string, default 'development'), OTP_DEV_CODE (string, default '1234'), ZENVIA_TOKEN (string), ZENVIA_FROM (string), RESEND_API_KEY (string), RESEND_FROM (string), ADMIN_NAME (string), ADMIN_PHONE (string), ADMIN_EMAIL (string), ADMIN_CPF (string). None of the new properties are added to required[] — dev mode runs without them.
       - After `await fastify.register(prismaPlugin)`: call seedAdminIfAbsent(fastify.prisma).
       - After seedAdminIfAbsent: `await fastify.register(authenticatePlugin)`.
       - After healthRoute: `await fastify.register(authRoute)` and `await fastify.register(condominiumsRoute)`.
  </action>
  <verify>
    <automated>npx tsc --noEmit -p apps/api/tsconfig.json && curl -s http://localhost:3001/health | grep -c '"ok":true'</automated>
  </verify>
  <done>All API auth endpoints exist, authenticate preHandler validates tokens on opted-in routes only, GET /condominiums is public, admin is seeded on boot, and TypeScript compiles clean.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Full backend auth surface: POST /auth/register, POST /auth/otp/send, POST /auth/otp/verify, POST /auth/couriers, GET /condominiums. authenticate preHandler enforces auth on /auth/couriers only.</what-built>
  <how-to-verify>
    Start the API server: `npm run dev --workspace=@cheirin-de-pao/api`

    1. Verify public routes work without auth:
       ```
       curl http://localhost:3001/condominiums
       # Expect: 200 with JSON array (empty or with data)

       curl -X POST http://localhost:3001/auth/otp/send \
         -H 'Content-Type: application/json' \
         -d '{"phone":"11999999999"}'
       # Expect: 200 or 404 (not 401, not 500)
       ```

    2. Verify auth-protected route rejects unauthenticated request:
       ```
       curl -X POST http://localhost:3001/auth/couriers \
         -H 'Content-Type: application/json' \
         -d '{"name":"Test","cpf":"529.982.247-25","phone":"11988887777"}'
       # Expect: 401 Unauthorized (no Bearer token)
       ```

    3. Verify TypeScript: `npx tsc --noEmit -p apps/api/tsconfig.json` → exits 0

    4. Verify tests: `npm run test --workspace=@cheirin-de-pao/api` → exits 0
  </how-to-verify>
  <resume-signal>Type "approved" if all checks pass, or describe the issue</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client browser → POST /auth/register | Untrusted user input: name, CPF, phone, email, condominiumId, apartment |
| Client browser → POST /auth/otp/verify | Untrusted: 4-digit code + deviceId; session token is created here and returned once |
| preHandler → protected route | authenticate preHandler is the auth enforcement point; public routes bypass it by design |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-03 | Spoofing | Device ID mismatch (X-Device-Id header) | accept | device_id is a convenience signal per D-08, not a security control; session token hash is the primary auth; spoofing device_id without the token provides no access |
| T-02-04 | Elevation of Privilege | POST /auth/couriers — admin-only | mitigate | preHandler: [fastify.authenticate] on /auth/couriers route + role === ADMIN check in controller before creating COURIER user |
| T-02-05 | Tampering | Admin bootstrap — env var injection | accept | Admin only created if no ADMIN role exists (idempotent); bootstrap reads env vars at server startup only |
| T-02-06 | Information Disclosure | OTP code in SMS/email | accept | HTTPS in transit to Zenvia/Resend; dev mode never sends to external services (OTP_DEV_CODE bypass); 4-digit code acceptable for UX-focused auth at this scale |
| T-02-SC | Tampering | authenticate.ts global hook bypass | mitigate | Plugin uses preHandler decorator (not global onRequest); public routes explicitly have no preHandler — no ambiguity, no accidental bypass |
</threat_model>

<verification>
After task completes and API server is running with `npm run dev`:

```bash
# TypeScript clean
npx tsc --noEmit -p apps/api/tsconfig.json

# Health still works
curl http://localhost:3001/health

# OTP send (dev mode — no SMS sent, no auth required)
curl -X POST http://localhost:3001/auth/otp/send \
  -H 'Content-Type: application/json' \
  -d '{"phone":"11999999999"}'

# Condominiums list (public, no auth)
curl http://localhost:3001/condominiums

# Auth guard on couriers (no token → 401)
curl -X POST http://localhost:3001/auth/couriers \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","cpf":"529.982.247-25","phone":"11988887777"}'

# Unit tests
npm run test --workspace=@cheirin-de-pao/api
```
</verification>

<success_criteria>
- All auth routes registered: POST /auth/register, POST /auth/otp/send, POST /auth/otp/verify, POST /auth/couriers
- GET /condominiums returns 200 with array (no auth required)
- POST /auth/couriers returns 401 without Authorization header
- POST /auth/otp/send returns 200/404 (not 401) without Authorization header
- authenticate plugin ONLY uses decorateRequest + decorate('authenticate') — no addHook('onRequest')
- Admin seeded from env vars on server start
- Dev mode OTP bypass functional (OTP_DEV_CODE=1234 accepted without SMS/email)
- Unit tests pass (`npm run test --workspace=@cheirin-de-pao/api` exits 0)
- TypeScript compiles clean across all workspaces
</success_criteria>

<output>
Create `.planning/phases/02-authentication/02-02b-SUMMARY.md` when done
</output>
