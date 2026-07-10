---
phase: 04-scheduling
plan: 01
subsystem: backend/schema
tags: [schema, prisma, mongodb, node-cron, onesignal, test-stubs]
dependency_graph:
  requires: []
  provides:
    - User.oneSignalPlayerId campo no schema Prisma
    - Schedule.@@unique([userId, condominiumId]) índice composto
    - node-cron@4.2.1 instalado em apps/api
    - "@onesignal/node-onesignal@5.8.0 instalado em apps/api"
    - Stubs de teste para schedules, orders, BannerInsuficiente e useSchedule
  affects:
    - 04-02-PLAN.md (usa node-cron e schema atualizado)
    - 04-03-PLAN.md (usa @onesignal/node-onesignal)
    - 04-04-PLAN.md (usa Schedule @@unique para upsert)
    - 04-05-PLAN.md (implementa BannerInsuficiente)
    - 04-06-PLAN.md (implementa useSchedule)
tech_stack:
  added:
    - node-cron@^4.2.1 (cron jobs de agendamento)
    - "@onesignal/node-onesignal@^5.8.0 (SDK de push notifications)"
    - "@types/node-cron@^3.0.11 (tipagem TypeScript)"
  patterns:
    - Schema Prisma com campos opcionais aditivos (sem --accept-data-loss)
    - @@unique composto para suporte a upsert por pares userId+condominiumId
    - Stubs de teste com it.todo (Vitest pending, não falha)
key_files:
  modified:
    - path: apps/api/prisma/schema.prisma
      description: Adicionado oneSignalPlayerId (String?) em User e @@unique em Schedule
    - path: apps/api/package.json
      description: node-cron, @onesignal/node-onesignal e @types/node-cron adicionados
    - path: package-lock.json
      description: Lockfile atualizado com 231 novos pacotes
  created:
    - path: apps/api/src/modules/schedules/__tests__/schedules.service.test.ts
      description: Stub com 8 it.todo para SchedulesService
    - path: apps/api/src/modules/orders/__tests__/orders.service.test.ts
      description: Stub com 3 it.todo para OrdersService
    - path: apps/web/src/components/client/__tests__/BannerInsuficiente.test.tsx
      description: Stub com 4 it.todo para BannerInsuficiente
    - path: apps/web/src/hooks/__tests__/useSchedule.test.ts
      description: Stub com 4 it.todo para useSchedule
decisions:
  - "Schema Prisma atualizado com alterações aditivas apenas (sem --accept-data-loss)"
  - "@@unique([userId, condominiumId]) adicionado ao Schedule para suporte a upsert Prisma (D-01 do RESEARCH.md)"
  - "Stubs de teste criados com it.todo para não bloquear verificadores automatizados"
metrics:
  duration: ~10 minutos
  completed: "2026-06-15T02:23:58Z"
  tasks_completed: 3
  files_modified: 3
  files_created: 4
requirements:
  - SCHED-01
  - SCHED-02
  - SCHED-03
  - SCHED-04
  - SCHED-05
  - SCHED-06
---

# Phase 4 Plan 01: Schema e Setup Wave 0 Summary

**One-liner:** Schema Prisma atualizado com oneSignalPlayerId e @@unique para Schedule, node-cron e @onesignal/node-onesignal instalados, 4 stubs de teste Wave 0 criados e passando no Vitest.

## Objective

Wave 0 bloqueante da Fase 4 — prepara o terreno para todos os planos subsequentes da fase de agendamentos. Nenhum plano da Fase 4 pode começar antes deste concluir.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Atualizar schema Prisma (oneSignalPlayerId + @@unique) | b47ee78 | apps/api/prisma/schema.prisma |
| 2 | Instalar node-cron e @onesignal/node-onesignal | eeb5ce5 | apps/api/package.json, package-lock.json |
| 3 | Criar stubs de teste Wave 0 | 168ae9d | 4 arquivos de teste |

## Verification Results

1. `grep -c "oneSignalPlayerId" apps/api/prisma/schema.prisma` → 1 ✓
2. `grep -c "@@unique" apps/api/prisma/schema.prisma` → 1 ✓
3. `npx prisma db push` → "Your database indexes are now in sync with your Prisma schema" ✓
4. `grep "node-cron" apps/api/package.json` → "node-cron": "^4.2.1" ✓
5. `grep "@onesignal/node-onesignal" apps/api/package.json` → "@onesignal/node-onesignal": "^5.8.0" ✓
6. `npm run test --workspace=apps/api -- --run` → 4 passed | 2 skipped | 11 todo (sem FAIL) ✓
7. `npm run test --workspace=apps/web -- --run` → 7 passed | 5 skipped | 14 todo (sem FAIL) ✓
8. Contagem de it.todo: schedules=8, orders=3, BannerInsuficiente=4, useSchedule=4 ✓

## Deviations from Plan

Nenhuma — plano executado exatamente como escrito.

## Known Stubs

| Arquivo | Stubs | Razão |
|---------|-------|-------|
| apps/api/src/modules/schedules/__tests__/schedules.service.test.ts | 8 it.todo | Implementação vem nas Tasks 2-4 da Fase 4 |
| apps/api/src/modules/orders/__tests__/orders.service.test.ts | 3 it.todo | Implementação vem na Task 5 da Fase 4 |
| apps/web/src/components/client/__tests__/BannerInsuficiente.test.tsx | 4 it.todo | Componente implementado na Wave 2 da Fase 4 |
| apps/web/src/hooks/__tests__/useSchedule.test.ts | 4 it.todo | Hook implementado na Wave 1 da Fase 4 |

Os stubs são intencionais e não impedem o objetivo do plano (Wave 0 = preparar o terreno, não implementar funcionalidades).

## Threat Surface Scan

Nenhuma nova superfície de segurança introduzida — as alterações são:
- Campo opcional `oneSignalPlayerId` no modelo User (não exposto em rotas públicas)
- Índice único composto no Schedule (melhora integridade de dados)
- Pacotes instalados (auditados via Package Legitimacy Audit no RESEARCH.md)
- Stubs de teste (sem impacto em runtime)

## Self-Check: PASSED

- [x] apps/api/prisma/schema.prisma — FOUND
- [x] apps/api/package.json — contém node-cron e @onesignal/node-onesignal
- [x] apps/api/src/modules/schedules/__tests__/schedules.service.test.ts — FOUND
- [x] apps/api/src/modules/orders/__tests__/orders.service.test.ts — FOUND
- [x] apps/web/src/components/client/__tests__/BannerInsuficiente.test.tsx — FOUND
- [x] apps/web/src/hooks/__tests__/useSchedule.test.ts — FOUND
- [x] Commit b47ee78 — FOUND
- [x] Commit eeb5ce5 — FOUND
- [x] Commit 168ae9d — FOUND
