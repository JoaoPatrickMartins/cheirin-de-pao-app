---
phase: 02-authentication
plan: "01"
subsystem: auth-foundation
tags: [prisma, schema, mongodb, vitest, zod, cpf-validation, test-infrastructure]
dependency_graph:
  requires: []
  provides:
    - prisma/Session model
    - prisma/OtpCode model
    - CpfSchema (módulo-11)
    - api/vitest
    - shared/vitest
    - Wave 0 test stubs (cpf, auth.service, OtpInput)
  affects:
    - 02-02-PLAN.md (consumes Session + OtpCode Prisma types, CpfSchema)
    - 02-03-PLAN.md (consumes OtpInput test stubs)
tech_stack:
  added:
    - vitest@4.1.8 (api + shared devDependency)
  patterns:
    - Prisma MongoDB schema extension (additive — db push, no migrate)
    - Zod transform + refine pipeline for domain validation (CpfSchema)
    - it.todo stub pattern for pre-implementation test scaffolding
key_files:
  created:
    - apps/api/vitest.config.ts
    - apps/api/src/__tests__/auth.service.test.ts
    - apps/api/.env.example
    - packages/shared/vitest.config.ts
    - packages/shared/src/__tests__/cpf.test.ts
    - apps/web/src/components/__tests__/OtpInput.test.tsx
  modified:
    - apps/api/prisma/schema.prisma
    - packages/shared/src/schemas/index.ts
    - apps/api/package.json
    - packages/shared/package.json
decisions:
  - "Vitest added as devDependency to both api and shared packages (was missing — required for Wave 0 test stubs to run)"
  - "CpfSchema uses .transform() to strip formatting before .refine() for length and módulo-11 — idiomatic Zod pipeline"
  - "validateCpfDigits helper is not exported (internal to schemas/index.ts) to keep public API minimal"
  - "shared/vitest.config.ts uses node environment (no DOM needed for utility package)"
metrics:
  duration: 4 minutes
  completed_date: "2026-06-14T02:32:16Z"
  tasks_completed: 2
  files_created: 6
  files_modified: 4
---

# Phase 02 Plan 01: Auth Foundation Summary

**One-liner:** Prisma schema extended with Session + OtpCode models pushed to MongoDB Atlas, CpfSchema with módulo-11 validation added to shared, Vitest configured in api and shared, and 12 Wave 0 test stubs scaffolded across three workspaces.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend Prisma schema with Session + OtpCode, push to Atlas | 3048893 | apps/api/prisma/schema.prisma |
| 2 | Add CpfSchema + scaffold all Wave 0 test stubs | 192b790 | 9 files (see key_files above) |

## Verification Results

- `npx prisma validate --schema=apps/api/prisma/schema.prisma` — exit 0
- `npx prisma db push` — exit 0; Session and OtpCode collections created in MongoDB Atlas with `Session_token_key` unique index
- `npx prisma generate` — exit 0; Prisma Client v6.19.3 regenerated with typed Session + OtpCode access
- `npx tsc --noEmit -p apps/api/tsconfig.json` — exit 0 (no TypeScript errors)
- `npm test` (full Turborepo suite) — exit 0; 3 workspaces, 18 todos total (shared: 4, api: 4, web: 10)
- CpfSchema validated manually: `529.982.247-25` ACCEPTED, `111.111.111-11` REJECTED, `529.982.247-26` REJECTED

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added Vitest to api and shared packages**
- **Found during:** Task 2
- **Issue:** apps/api/package.json and packages/shared/package.json had no `vitest` devDependency and no `test` script. Without these, `npm run test --workspace=@cheirin-de-pao/api` would fail with "Missing script: test" — blocking the plan's acceptance criteria.
- **Fix:** Added `vitest: "latest"` to devDependencies and `"test": "vitest run"` to scripts in both package.json files. Also created `packages/shared/vitest.config.ts` (node environment) since the shared package had no test configuration at all.
- **Files modified:** apps/api/package.json, packages/shared/package.json, packages/shared/vitest.config.ts
- **Commit:** 192b790

## Known Stubs

The following stubs are intentional Wave 0 scaffolding — all will be implemented in Plan 02-02 and 02-03:

| File | Stubs | Resolved by |
|------|-------|-------------|
| packages/shared/src/__tests__/cpf.test.ts | 4 it.todo (validateCpf) | Plan 02-02 |
| apps/api/src/__tests__/auth.service.test.ts | 4 it.todo (AuthService) | Plan 02-02 |
| apps/web/src/components/__tests__/OtpInput.test.tsx | 4 it.todo (OtpInput) | Plan 02-03 |

These stubs do NOT block the plan's goal — the goal was to scaffold the test infrastructure, not implement the tests. All stubs produce passing todo results in Vitest.

## Threat Flags

No new threat surfaces introduced beyond what was documented in the plan's threat model (T-02-SC-02: db push additive only; T-02-01: .env.example placeholders only).

## Self-Check: PASSED

- [x] apps/api/prisma/schema.prisma — FOUND (contains `model Session {` and `model OtpCode {`)
- [x] apps/api/vitest.config.ts — FOUND
- [x] apps/api/src/__tests__/auth.service.test.ts — FOUND
- [x] apps/api/.env.example — FOUND (contains ZENVIA_TOKEN, RESEND_API_KEY, OTP_DEV_CODE, ADMIN_NAME)
- [x] packages/shared/src/schemas/index.ts — FOUND (exports CpfSchema)
- [x] packages/shared/src/__tests__/cpf.test.ts — FOUND
- [x] packages/shared/vitest.config.ts — FOUND
- [x] apps/web/src/components/__tests__/OtpInput.test.tsx — FOUND
- [x] Commit 3048893 — FOUND (feat(02-01): extend Prisma schema)
- [x] Commit 192b790 — FOUND (feat(02-01): add CpfSchema, Vitest configs, and Wave 0 test stubs)
