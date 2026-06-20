---
phase: 14-agenda-multi-slot
plan: "02"
subsystem: api/schema
tags: [prisma, zod, schema, multi-slot, backward-compatible]
dependency_graph:
  requires: []
  provides: [Schedule.deliveryTime-nullable, Schedule.weeklyQty-nullable, Order.deliveryTime, ScheduleBodySchema-backward-compat]
  affects: [schedules.repository.ts, schedules.service.ts]
tech_stack:
  added: []
  patterns: [z.refine para union backward-compatible, prisma db push MongoDB]
key_files:
  created: []
  modified:
    - apps/api/prisma/schema.prisma
    - apps/api/src/modules/schedules/schedules.schema.ts
decisions:
  - "DaysSchema usa z.record(z.string(), WeeklyQtySchema) — chave HH:MM, valor WeeklyQty"
  - "ScheduleBodySchema usa .refine em vez de z.union — evita mensagens de erro confusas (Pitfall 3)"
  - "deliveryTime mudado de z.enum para z.string() — slots são configuráveis pelo admin"
  - "Schedule.weeklyQty tornado Json? junto com deliveryTime String? no mesmo db push"
metrics:
  duration: "8min"
  completed: "2026-06-20"
  tasks: 2
  files: 2
---

# Phase 14 Plan 02: Schema Prisma + Zod Backward-Compatible Summary

Schema Prisma tornado nullable para `Schedule.deliveryTime` e `Schedule.weeklyQty`; `Order.deliveryTime String?` adicionado; `ScheduleBodySchema` refatorado com `DaysSchema` e `.refine` para aceitar formato multi-slot e legado simultaneamente.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Atualizar schema.prisma e executar db push | 5984e30 | apps/api/prisma/schema.prisma |
| 2 | Refatorar ScheduleBodySchema para aceitar multi-slot e legado | b049026 | apps/api/src/modules/schedules/schedules.schema.ts |

## Deviations from Plan

None — plano executado exatamente como escrito.

## Verification Results

- `npx prisma validate` — OK (schema válido)
- `grep "deliveryTime.*String?" schema.prisma` — 2 ocorrências (Schedule + Order)
- `grep "weeklyQty.*Json?" schema.prisma` — 1 ocorrência (Schedule)
- `npx prisma db push --accept-data-loss` — sucesso, Prisma Client regenerado (v6.19.3)
- `npx tsc --noEmit` — zero erros em schedules.schema.ts
- `DaysSchema`, `WeeklyQtySchema`, `ScheduleBodySchema`, `WeeklyQty`, `ScheduleBody` — todos exportados

## Known Stubs

None.

## Threat Flags

None — nenhuma nova superfície de ataque além do threat model do plano.

## Self-Check: PASSED

- [x] apps/api/prisma/schema.prisma modificado e válido
- [x] apps/api/src/modules/schedules/schedules.schema.ts com DaysSchema e .refine
- [x] Commit 5984e30 existe
- [x] Commit b049026 existe
