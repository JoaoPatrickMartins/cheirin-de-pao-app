---
phase: 04-scheduling
plan: 03
subsystem: backend/orders+notifications
tags: [orders, notifications, prisma-transaction, onesignal, push-token, tdd, atomic-credits]
dependency_graph:
  requires:
    - 04-01 (oneSignalPlayerId no User, node-cron e @onesignal/node-onesignal instalados)
  provides:
    - OrdersService.createSingleOrder com reserva atômica via prisma.$transaction
    - POST /orders autenticado (SCHED-01)
    - POST /users/push-token autenticado (D-09)
    - NotificationsService.savePushToken (oneSignalPlayerId no User)
  affects:
    - 04-04-PLAN.md (cron diário que cria Orders usa padrão similar de $transaction)
    - 04-05-PLAN.md (frontend SingleScreen chama POST /orders)
tech_stack:
  added: []
  patterns:
    - prisma.$transaction para reserva atômica de créditos (MVP-safe)
    - TDD RED/GREEN com importação dinâmica de service em testes Vitest
    - userId sempre extraído do JWT — nunca aceito no body (T-04-03-01, T-04-03-05)
    - Cálculo de "amanhã" em UTC-3 com Date.UTC e offset hard-coded (D-05 CONTEXT.md)
key_files:
  created:
    - path: apps/api/src/modules/orders/orders.schema.ts
      description: CreateOrderSchema (quantity int 1-20, scheduledDate datetime ISO)
    - path: apps/api/src/modules/orders/orders.repository.ts
      description: OrdersRepository — findById, findByUserId
    - path: apps/api/src/modules/orders/orders.service.ts
      description: OrdersService.createSingleOrder com reserva atômica via $transaction
    - path: apps/api/src/modules/orders/orders.controller.ts
      description: OrdersController — POST /orders retorna 201 com orderId/scheduledDate/quantity
    - path: apps/api/src/modules/orders/orders.route.ts
      description: ordersRoute — POST /orders com preHandler authenticate
    - path: apps/api/src/modules/orders/__tests__/orders.service.test.ts
      description: 3 testes unitários TDD (criação com sucesso, saldo insuficiente, data no passado)
    - path: apps/api/src/modules/notifications/notifications.service.ts
      description: NotificationsService.savePushToken — salva oneSignalPlayerId no User
    - path: apps/api/src/modules/notifications/notifications.controller.ts
      description: NotificationsController — POST /users/push-token com userId do JWT
    - path: apps/api/src/modules/notifications/notifications.route.ts
      description: notificationsRoute — POST /users/push-token com preHandler authenticate
  modified:
    - path: apps/api/src/server.ts
      description: Registrar ordersRoute e notificationsRoute na Phase 4
decisions:
  - "Reserva atômica via prisma.$transaction (MVP — sem $runCommandRaw): T-04-03-04"
  - "Cálculo de amanhã UTC-3 via Date.UTC com offset hard-coded (D-05 — Admin configura na Fase 7)"
  - "userId nunca aceito no body — sempre extraído do JWT em ambos os endpoints"
  - "Zod v4 usa .string() sem required_error (API mudou de v3)"
metrics:
  duration: ~20 minutos
  completed: "2026-06-15T03:00:00Z"
  tasks_completed: 2
  files_modified: 1
  files_created: 9
requirements:
  - SCHED-01
  - SCHED-04
---

# Phase 4 Plan 03: Módulo Orders + Notifications Summary

**One-liner:** Módulo orders com reserva atômica de créditos via prisma.$transaction (TDD, 3 testes passando) e módulo notifications com POST /users/push-token autenticado salvando oneSignalPlayerId do JWT.

## Objective

Habilitar o cliente a criar pedidos únicos com reserva imediata de créditos (SCHED-01) e registrar o player_id do OneSignal no backend para push notifications (D-09 do CONTEXT.md). Executado em paralelo com o plano 04-02 na Wave 1.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| RED | Testes unitários OrdersService | a22f3ef | orders/__tests__/orders.service.test.ts |
| 1 | Módulo orders completo | ff73219 | 5 arquivos orders/ |
| 2 | Módulo notifications | 7716633 | 3 arquivos notifications/ + server.ts |

## Verification Results

1. `npm run test --workspace=apps/api -- --run` — 66 passed, 0 failed (orders: 3/3 PASS) ✓
2. `npm run build --workspace=apps/api` — sem erros TS ✓
3. `grep "preHandler.*authenticate" orders.route.ts` — `{ preHandler: [fastify.authenticate] }` ✓
4. `grep "preHandler.*authenticate" notifications.route.ts` — `{ preHandler: [fastify.authenticate] }` ✓
5. `grep "request.user" notifications.controller.ts` — `const userId = request.user!.id` ✓
6. `grep "oneSignalPlayerId" notifications.service.ts` — `data: { oneSignalPlayerId: playerId }` ✓
7. `grep "'SINGLE'" orders.service.ts` — `type: 'SINGLE'` ✓
8. `grep "$transaction" orders.service.ts` — `await this.prisma.$transaction(async (tx) => {` ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zod v4 API — required_error removido**
- **Found during:** Task 1 (build TypeScript após criar orders.schema.ts)
- **Issue:** Zod v4 (instalado: 4.4.3) removeu `required_error` e `invalid_type_error` do objeto de config de `z.string()` e `z.number()`. A API agora usa apenas `error`.
- **Fix:** Removidos os parâmetros `required_error` e `invalid_type_error` do schema. Mensagens de erro customizadas mantidas apenas nos métodos `.int()`, `.min()`, `.max()` e `.datetime()` que ainda suportam string de mensagem.
- **Files modified:** `apps/api/src/modules/orders/orders.schema.ts`
- **Commit:** ff73219

## TDD Gate Compliance

- [x] Commit `test(...)` RED — a22f3ef (3 testes pending antes da implementação)
- [x] Commit `feat(...)` GREEN — ff73219 (3 testes passando)
- Refactor: não necessário — implementação já limpa

## Known Stubs

Nenhum stub encontrado nos arquivos criados.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new_endpoint | apps/api/src/modules/orders/orders.route.ts | POST /orders — nova superfície de entrada de dados (mitigada: autenticação JWT + validação Zod + $transaction) |
| threat_flag: new_endpoint | apps/api/src/modules/notifications/notifications.route.ts | POST /users/push-token — nova superfície de entrada de dados (mitigada: autenticação JWT + Zod .min(1)) |

Ambas as superfícies estão cobertas pelo threat model do plano (T-04-03-01 a T-04-03-06).

## Self-Check: PASSED

- [x] apps/api/src/modules/orders/orders.schema.ts — FOUND
- [x] apps/api/src/modules/orders/orders.repository.ts — FOUND
- [x] apps/api/src/modules/orders/orders.service.ts — FOUND
- [x] apps/api/src/modules/orders/orders.controller.ts — FOUND
- [x] apps/api/src/modules/orders/orders.route.ts — FOUND
- [x] apps/api/src/modules/orders/__tests__/orders.service.test.ts — FOUND
- [x] apps/api/src/modules/notifications/notifications.service.ts — FOUND
- [x] apps/api/src/modules/notifications/notifications.controller.ts — FOUND
- [x] apps/api/src/modules/notifications/notifications.route.ts — FOUND
- [x] Commit a22f3ef (RED test) — FOUND
- [x] Commit ff73219 (feat orders) — FOUND
- [x] Commit 7716633 (feat notifications) — FOUND
