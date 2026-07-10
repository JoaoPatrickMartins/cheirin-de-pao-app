---
phase: 02-authentication
plan: "02b"
subsystem: auth-http-layer
tags: [fastify, routes, authenticate-plugin, admin-seed, condominiums, dotenv]
dependency_graph:
  requires: [02-02]
  provides:
    - POST /auth/register
    - POST /auth/otp/send
    - POST /auth/otp/verify
    - POST /auth/couriers (ADMIN only)
    - GET /condominiums
    - fastify.authenticate preHandler
    - seedAdminIfAbsent bootstrap
  affects:
    - 02-03-PLAN.md (frontend consumes all auth endpoints)
tech_stack:
  added:
    - dotenv@16.x (explicit startup loading to fix Prisma cold-start race)
  patterns:
    - Fastify plugin (FastifyPluginAsync) for routes and authenticate
    - fp() scoped plugin for authenticate decorator
    - preHandler opt-in (not global onRequest hook) for auth enforcement
    - decorateRequest('user', null) default for public routes
key_files:
  created:
    - apps/api/src/modules/auth/auth.controller.ts
    - apps/api/src/modules/auth/auth.route.ts
    - apps/api/src/plugins/authenticate.ts
    - apps/api/src/bootstrap/admin-seed.ts
    - apps/api/src/modules/condominiums/condominiums.route.ts
  modified:
    - apps/api/src/server.ts
decisions:
  - "authenticate.ts uses preHandler decorator ONLY (no addHook onRequest) — public routes are never blocked"
  - "dotenv/config imported first in server.ts — fixes Prisma v6 cold-start race where DATABASE_URL wasn't in process.env before PrismaClient init (deviation from plan, but required)"
  - "Auth env vars (ZENVIA_TOKEN, RESEND_API_KEY, etc.) marked optional in envSchema — dev mode works without them via OTP_DEV_CODE bypass"
  - "ADMIN_EMAIL=admin@cheirin.com.br pre-filled in .env for dev convenience"
metrics:
  duration: ~25 minutes (including checkpoint verification)
  completed_date: "2026-06-14T01:30:00Z"
  tasks_completed: 2
  files_created: 5
  files_modified: 2
---

# Phase 02 Plan 02b: Auth HTTP Layer Summary

**One-liner:** Auth routes (register, OTP send/verify, couriers), authenticate preHandler plugin, admin bootstrap seed, and GET /condominiums wired to Fastify — plus dotenv cold-start fix for Prisma v6.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Auth controller, routes, authenticate plugin, admin seed, condominiums, server wiring | d2bf03a | 6 files |
| fix | dotenv/config cold-start fix | 1d49bc4 | apps/api/src/server.ts |

## Verification Results

### Automated
- `npx tsc --noEmit -p apps/api/tsconfig.json` — exit 0 (TypeScript clean)
- `npm run test --workspace=@cheirin-de-pao/api` — exit 0 (4 tests, 1 file)

### Manual (checkpoint:human-verify gate — PASSED)
```
GET  /health           → 200 {"ok":true,"db":"connected"}
GET  /condominiums     → 200 [] (public, no auth)
POST /auth/otp/send    → 404 {"error":"Usuário não encontrado"} (public, user not found — not 401)
POST /auth/couriers    → 401 {"error":"Não autorizado"} (auth enforced)
[bootstrap] Admin user created: Admin
```

## Deviations from Plan

### Auto-fixed

**1. Prisma v6 cold-start race condition**
- **Found during:** Checkpoint verification
- **Issue:** Prisma v6 validates `env("DATABASE_URL")` from schema.prisma at `new PrismaClient()` time. On `tsx watch` cold start, `@fastify/env` dotenv loading hadn't populated `process.env.DATABASE_URL` yet, causing `PrismaClientInitializationError P1012`.
- **Fix:** Added `import 'dotenv/config'` as the first line of `server.ts`. This loads `apps/api/.env` synchronously before any module initialization runs. dotenv installed as direct devDependency.
- **Commits:** 1d49bc4

## Self-Check: PASSED

- [x] POST /auth/register — registered (no preHandler)
- [x] POST /auth/otp/send — registered (no preHandler)
- [x] POST /auth/otp/verify — registered (no preHandler)
- [x] POST /auth/couriers — registered with preHandler: [fastify.authenticate]
- [x] GET /condominiums — registered (no preHandler), returns 200 array
- [x] POST /auth/couriers returns 401 without Bearer token — CONFIRMED
- [x] authenticate.ts has NO addHook('onRequest') — CONFIRMED (grep clean)
- [x] seedAdminIfAbsent called from server.ts after prismaPlugin
- [x] Admin seeded on boot: "[bootstrap] Admin user created: Admin" — CONFIRMED
- [x] TypeScript clean: exit 0
- [x] Tests passing: 4/4
