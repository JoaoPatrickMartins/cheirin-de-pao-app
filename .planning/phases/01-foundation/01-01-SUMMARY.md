---
phase: 01-foundation
plan: "01"
subsystem: monorepo-scaffold
tags: [turborepo, typescript, vitest, npm-workspaces, devcontainer]
dependency_graph:
  requires: []
  provides:
    - monorepo-root-config
    - workspace-package-manifests
    - shared-zod-schemas
    - vitest-test-infrastructure
  affects:
    - apps/web (Plans 02, 03 depend on this scaffold)
    - apps/api (Plan 02 depends on this scaffold)
    - packages/shared (consumed by all future plans)
tech_stack:
  added:
    - turbo@2.9.18
    - typescript@5.7.3
    - zod@4.4.3
    - vitest (latest)
    - "@testing-library/react (latest)"
    - "@testing-library/jest-dom (latest)"
    - jsdom (latest)
    - prisma@6.19.3 (exact — v7 does not support MongoDB)
    - "@prisma/client@6.19.3 (exact)"
    - react@19.2.7
    - react-dom@19.2.7
    - react-router@7.17.0
    - fastify@5.8.5
  patterns:
    - Turborepo 2.x "tasks" key (NOT "pipeline" — renamed in 2.0)
    - TypeScript project references via tsconfig.base.json + per-package extends
    - npm workspaces hoisting (node_modules at root)
    - Zod v4 schemas as single source of truth for shared types
    - Vitest jsdom + @testing-library/jest-dom for React component tests
key_files:
  created:
    - package.json
    - turbo.json
    - tsconfig.base.json
    - .env.example
    - .gitignore
    - docker-compose.yml
    - .devcontainer/devcontainer.json
    - apps/web/package.json
    - apps/web/tsconfig.json
    - apps/web/index.html
    - apps/web/vitest.config.ts
    - apps/web/src/test-setup.ts
    - apps/web/src/hooks/useInstallPrompt.test.ts
    - apps/web/src/components/brand/BreadMark.test.tsx
    - apps/web/src/pages/splash/SplashScreen.test.tsx
    - apps/api/package.json
    - apps/api/tsconfig.json
    - packages/shared/package.json
    - packages/shared/tsconfig.json
    - packages/shared/src/schemas/index.ts
    - packages/shared/src/types/index.ts
    - packages/shared/src/constants/index.ts
    - packages/shared/src/index.ts
  modified: []
decisions:
  - "Prisma pinned to exact 6.19.3 — v7 dropped MongoDB support; accidental upgrade would break at runtime"
  - "TypeScript pinned to 5.7.3 — v6 is strict-by-default which breaks greenfield without explicit opt-out"
  - "react-router@7.17.0 imported from 'react-router' NOT 'react-router-dom' (v7 consolidation)"
  - "turbo.json uses 'tasks' key NOT 'pipeline' (renamed in Turborepo 2.0; old key silently ignored)"
  - "No MongoDB service in docker-compose — MongoDB Atlas remote only per CLAUDE.md constraint"
  - "Vitest stub tests use it.todo() NOT it.skip() — todos show as pending, exit code 0"
metrics:
  duration: "5 minutes"
  completed: "2026-06-13"
  tasks_completed: 3
  files_created: 23
---

# Phase 1 Plan 01: Monorepo Scaffold Summary

**One-liner:** Turborepo monorepo scaffold with npm workspaces, TypeScript 5.7 base config, shared Zod schemas, and Vitest test infrastructure as the foundation for Plans 02 and 03.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Root workspace + Turborepo + TypeScript base + Dev Container | 67bf813 | package.json, turbo.json, tsconfig.base.json, .env.example, .gitignore, docker-compose.yml, .devcontainer/devcontainer.json |
| 2 | Three workspace package.json + tsconfig files + packages/shared source | c71e25c | apps/web/package.json, apps/web/tsconfig.json, apps/web/index.html, apps/api/package.json, apps/api/tsconfig.json, packages/shared/* (6 files), package-lock.json |
| 3 | Vitest test infrastructure + stub test files + typecheck baseline | b9e5d32 | apps/web/vitest.config.ts, apps/web/src/test-setup.ts, 3 stub test files |

## Verification Results

| Check | Result |
|-------|--------|
| `npm install` resolves all workspaces | PASS — 541 packages, 0 vulnerabilities |
| `turbo.json` has "tasks" key (not "pipeline") | PASS |
| `package.json` workspaces ["apps/*","packages/*"] | PASS |
| `.env.example` has DATABASE_URL (mongodb+srv) + VITE_ONESIGNAL_APP_ID | PASS |
| `.gitignore` excludes .env | PASS |
| `vitest run` exits 0 (6 todo, 0 failures) | PASS — exit code 0 |
| `prisma@6.19.3` pinned (exact) in apps/api | PASS |
| `react-router@7.17.0` (NOT react-router-dom) in apps/web | PASS |
| `moduleResolution: Bundler` in tsconfig.base.json | PASS |
| Dev Container references `javascript-node:20` image | PASS |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

The following stub test files were created intentionally and will be wired in Plan 03:

| File | Stubs | Reason |
|------|-------|--------|
| `apps/web/src/hooks/useInstallPrompt.test.ts` | 2 `it.todo()` | Hook implementation deferred to Plan 03 |
| `apps/web/src/components/brand/BreadMark.test.tsx` | 2 `it.todo()` | Component implementation deferred to Plan 03 |
| `apps/web/src/pages/splash/SplashScreen.test.tsx` | 2 `it.todo()` | Component implementation deferred to Plan 03 |

These stubs are intentional per VALIDATION.md Wave 0 requirements — they satisfy the "test file exists" requirement without causing import errors from non-existent components.

## Threat Flags

No new security surface introduced. Threat model compliance:

| T-ID | Mitigation | Status |
|------|-----------|--------|
| T-01-01 | `.env` in `.gitignore`; `.env.example` with mongodb+srv:// placeholder | APPLIED |
| T-01-SC | All packages from RESEARCH.md Package Legitimacy Audit — all Approved | APPLIED |

## Self-Check: PASSED

**Files exist:**
- `package.json` — FOUND
- `turbo.json` — FOUND
- `tsconfig.base.json` — FOUND
- `.env.example` — FOUND
- `.gitignore` — FOUND
- `docker-compose.yml` — FOUND
- `.devcontainer/devcontainer.json` — FOUND
- `apps/web/package.json` — FOUND
- `apps/web/tsconfig.json` — FOUND
- `apps/web/index.html` — FOUND
- `apps/web/vitest.config.ts` — FOUND
- `apps/web/src/test-setup.ts` — FOUND
- `apps/web/src/hooks/useInstallPrompt.test.ts` — FOUND
- `apps/web/src/components/brand/BreadMark.test.tsx` — FOUND
- `apps/web/src/pages/splash/SplashScreen.test.tsx` — FOUND
- `apps/api/package.json` — FOUND
- `apps/api/tsconfig.json` — FOUND
- `packages/shared/package.json` — FOUND
- `packages/shared/tsconfig.json` — FOUND
- `packages/shared/src/schemas/index.ts` — FOUND
- `packages/shared/src/types/index.ts` — FOUND
- `packages/shared/src/constants/index.ts` — FOUND
- `packages/shared/src/index.ts` — FOUND

**Commits exist:**
- `67bf813` — FOUND (Task 1)
- `c71e25c` — FOUND (Task 2)
- `b9e5d32` — FOUND (Task 3)
