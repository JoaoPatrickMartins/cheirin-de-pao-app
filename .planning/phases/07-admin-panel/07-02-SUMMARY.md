---
phase: 07-admin-panel
plan: 02
subsystem: api-modules
tags: [fastify, prisma, zod, tdd, onesignal, admin-settings, admin-condominiums, admin-combos]
dependency_graph:
  requires:
    - 07-01 (schema Prisma com Order.condominiumId, Supplier.isPrincipal + Prisma Client regenerado)
  provides:
    - GET/PATCH /admin/settings/cutoff e /admin/settings/avulso
    - CRUD /admin/condominiums (GET, POST, PATCH/:id, DELETE/:id)
    - CRUD /admin/combos (GET, POST, PATCH/:id, DELETE/:id) + PATCH/:id/promotion
    - AdminSettingsService.processCutoff() para cron job (07-06)
  affects:
    - 07-06 (cron de corte depende de AdminSettingsService.processCutoff)
    - 07-09 (frontend usa GET /admin/combos e GET /admin/condominiums)
    - 07-10 (frontend usa GET /admin/settings/*)
tech_stack:
  added: []
  patterns:
    - route→controller→service→repository (padrão consolidado admin)
    - Role check ADMIN inline no controller (per D-11)
    - preHandler fastify.authenticate em todas as rotas (T-07-02-05)
    - Zod schema parse antes de qualquer chamada ao banco (T-07-02-03)
    - Push OneSignal best-effort com try/catch por usuário (processCutoff)
    - FAR_FUTURE (9999-12-31) para promoção "permanente" (endsAt não nulável no schema)
key_files:
  created:
    - apps/api/src/modules/admin-settings/admin-settings.schema.ts
    - apps/api/src/modules/admin-settings/admin-settings.service.ts
    - apps/api/src/modules/admin-settings/admin-settings.controller.ts
    - apps/api/src/modules/admin-settings/admin-settings.route.ts
    - apps/api/src/modules/admin-condominiums/admin-condominiums.schema.ts
    - apps/api/src/modules/admin-condominiums/admin-condominiums.repository.ts
    - apps/api/src/modules/admin-condominiums/admin-condominiums.service.ts
    - apps/api/src/modules/admin-condominiums/admin-condominiums.controller.ts
    - apps/api/src/modules/admin-condominiums/admin-condominiums.route.ts
    - apps/api/src/modules/admin-combos/admin-combos.schema.ts
    - apps/api/src/modules/admin-combos/admin-combos.repository.ts
    - apps/api/src/modules/admin-combos/admin-combos.service.ts
    - apps/api/src/modules/admin-combos/admin-combos.controller.ts
    - apps/api/src/modules/admin-combos/admin-combos.route.ts
  modified:
    - apps/api/src/modules/admin-settings/__tests__/admin-settings.service.test.ts
decisions:
  - endsAt em Promotion não é nulável no schema — usado FAR_FUTURE (9999-12-31) para representar promoção permanente até desativação
  - processCutoff usa toLocaleTimeString pt-BR America/Sao_Paulo para comparar com cutoffTime — evita dependência de lib de timezone externa
  - togglePromotion desativa promoções existentes antes de criar nova (idempotente) — evita múltiplas promoções ativas simultâneas
metrics:
  duration: 5min
  completed_date: "2026-06-16T00:39:00Z"
  tasks_completed: 2
  files_modified: 1
  files_created: 14
---

# Phase 7 Plan 2: Módulos Admin-Settings, Admin-Condominiums e Admin-Combos Summary

**One-liner:** 3 módulos API admin implementados com padrão route→controller→service→repository, role check ADMIN inline em 16 handlers, Zod validation, processCutoff com push OneSignal best-effort e toggle de promoção com 15% fixo via Promotion model.

## What Was Built

### Task 1: Módulo admin-settings (commit `fde74fb` + `4bdd20c`)

**RED commit (`fde74fb`):** Teste real substituiu mock temporário da Wave 0. 11 testes cobrindo getCutoffTime (default + valor existente), setCutoffTime (upsert com key/value), getAvulsoConfig (conversão string→número + defaults), setAvulsoConfig (2 upserts), processCutoff (busca users e orders).

**GREEN commit (`4bdd20c`):** 4 arquivos criados:

| Arquivo | Conteúdo |
|---------|----------|
| `admin-settings.schema.ts` | `UpdateCutoffSchema` (regex `/^\d{2}:\d{2}$/`) + `UpdateAvulsoSchema` (int min 1 + float min 0) |
| `admin-settings.service.ts` | 5 métodos + processCutoff com OneSignal best-effort por usuário |
| `admin-settings.controller.ts` | 4 handlers (getCutoff, setCutoff, getAvulso, setAvulso) com role check ADMIN + Zod |
| `admin-settings.route.ts` | GET/PATCH /admin/settings/cutoff + GET/PATCH /admin/settings/avulso |

`processCutoff()`: verifica hora BRT vs cutoffTime, busca clientes com oneSignalPlayerId, filtra quem já tem Order para amanhã, envia push para o restante. Cada push é independente (try/catch individual) — falha silenciosa com log.warn.

### Task 2: Módulos admin-condominiums e admin-combos (commit `53544e9`)

**10 arquivos criados:**

**admin-condominiums (5 arquivos):**
- Schema Zod: `CreateCondominiumSchema` com address object aninhado (street/number/complement?/city/state/zip) + enum `SINGLE_ENTRANCE|BLOCKS`
- Repository: findAll (orderBy name asc), findById, create, update, remove
- Service: list, create, update (404 se não encontrar), remove (404 se não encontrar)
- Controller: GET/POST/PATCH/:id/DELETE/:id com role check ADMIN + Zod
- Route: 4 endpoints com preHandler authenticate

**admin-combos (5 arquivos):**
- Schema Zod: `CreateComboSchema` (name/quantity/price/tag?) + `TogglePromotionSchema` ({ active: boolean })
- Repository: findAll, findById, create, update, remove + findActivePromotion, createPromotion, deactivatePromotions
- Service: list (com activePromotion embed via Promise.all), create, update (404), remove (404), togglePromotion
- Controller: GET/POST/PATCH/:id/DELETE/:id/PATCH/:id/promotion com role check ADMIN + Zod
- Route: 5 endpoints com preHandler authenticate

`list()` em combos: para cada combo busca a Promotion mais recente com `isActive=true` e embute como `activePromotion` no objeto retornado.

`togglePromotion()`: active=true → deactivatePromotions + createPromotion (PERCENT, 15%, endsAt=FAR_FUTURE); active=false → deactivatePromotions. Idempotente e 15% fixo (T-07-02-04).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Merge dos commits da Wave 0 no worktree antes de iniciar**

- **Found during:** Setup inicial — worktree criado antes dos commits da Phase 07-01
- **Issue:** O worktree estava baseado em `ccb5c03` (Phase 06 final), sem os commits da Wave 0 (1ed9614, 43e9295, fc7f964, 07602f9). Os módulos `admin-settings/` não existiam no worktree.
- **Fix:** `git merge 07602f9 --no-edit` (fast-forward) — incorporou todos os commits da Wave 0 incluindo schema Prisma, stubs de service e stubs de teste.
- **Impact:** Nenhum — merge foi limpo sem conflitos.

**2. [Rule 1 - Decision] endsAt em Promotion é DateTime não nulável**

- **Found during:** Task 2 — análise do schema Prisma
- **Issue:** O plano especifica "endsAt=null (permanente)" mas o modelo `Promotion.endsAt` é `DateTime` (não `DateTime?`) no schema.
- **Fix:** Usado `new Date('9999-12-31T23:59:59.999Z')` como `FAR_FUTURE` — representa "permanente até desativação" sem alterar o schema.
- **Files modified:** `admin-combos.service.ts`

## Known Stubs

Nenhum stub nos arquivos criados. O stub de Wave 0 em `admin-settings.service.ts` foi substituído pela implementação real.

## Threat Surface Scan

Todos os novos endpoints cobertos pelo threat model do plano:

| Ameaça | Mitigação Aplicada |
|--------|-------------------|
| T-07-02-01: Elevation of Privilege | Role check `request.user?.role !== 'ADMIN'` em 16 handlers (4 settings + 4 condominiums + 5 combos + 3 extras) |
| T-07-02-02: Tampering cutoffTime | `UpdateCutoffSchema` com regex `/^\d{2}:\d{2}$/` antes do upsert |
| T-07-02-03: Tampering condominiums | `CreateCondominiumSchema` parse antes de qualquer chamada ao banco |
| T-07-02-04: Tampering promotion | `TogglePromotionSchema ({ active: boolean })` + discountValue=15 hardcoded no service |
| T-07-02-05: Info Disclosure sem auth | `preHandler: [fastify.authenticate]` em todas as 13 rotas novas |

Nenhuma nova superfície não planejada introduzida.

## TDD Gate Compliance

- Commit RED: `fde74fb` — `test(07-02): RED — testes reais para AdminSettingsService`
- Commit GREEN: `4bdd20c` — `feat(07-02): implementar módulo admin-settings`
- Task 2 não tem testes separados (não é `tdd="true"` no PLAN.md — os testes TDD cobrem apenas admin-settings)

## Self-Check: PASSED

Arquivos criados verificados:
- `apps/api/src/modules/admin-settings/admin-settings.schema.ts` — FOUND
- `apps/api/src/modules/admin-settings/admin-settings.service.ts` — FOUND (implementação real)
- `apps/api/src/modules/admin-settings/admin-settings.controller.ts` — FOUND
- `apps/api/src/modules/admin-settings/admin-settings.route.ts` — FOUND
- `apps/api/src/modules/admin-condominiums/admin-condominiums.schema.ts` — FOUND
- `apps/api/src/modules/admin-condominiums/admin-condominiums.repository.ts` — FOUND
- `apps/api/src/modules/admin-condominiums/admin-condominiums.service.ts` — FOUND
- `apps/api/src/modules/admin-condominiums/admin-condominiums.controller.ts` — FOUND
- `apps/api/src/modules/admin-condominiums/admin-condominiums.route.ts` — FOUND
- `apps/api/src/modules/admin-combos/admin-combos.schema.ts` — FOUND
- `apps/api/src/modules/admin-combos/admin-combos.repository.ts` — FOUND
- `apps/api/src/modules/admin-combos/admin-combos.service.ts` — FOUND
- `apps/api/src/modules/admin-combos/admin-combos.controller.ts` — FOUND
- `apps/api/src/modules/admin-combos/admin-combos.route.ts` — FOUND

Commits verificados:
- `fde74fb` — test RED admin-settings
- `4bdd20c` — feat admin-settings (4 arquivos)
- `53544e9` — feat admin-condominiums + admin-combos (10 arquivos)

Suite Vitest API: 20 test files, 107 testes passando.
