---
phase: 05-delivery-experience
plan: "02"
subsystem: api-orders-notifications
tags:
  - orders
  - notifications
  - tdd
  - brt-timezone
  - endpoint-extension
dependency_graph:
  requires:
    - 04-03 (OrdersService base com BRAZIL_OFFSET_HOURS e getTomorrowUTC3)
    - 04-03 (NotificationsService base com savePushToken)
  provides:
    - GET /orders/today (polling de status do dia)
    - GET /orders/history (histórico 30 dias)
    - GET /notifications/me (central in-app)
    - PATCH /notifications/read-all (marcar todas como lidas)
    - GET /notifications/unread-count (badge de sino)
  affects:
    - 05-03 (useOrderTracking consome GET /orders/today)
    - 05-04 (NotificationsScreen consome GET /notifications/me e PATCH /notifications/read-all)
    - 05-04 (HomeScreen badge consome GET /notifications/unread-count)
tech_stack:
  added: []
  patterns:
    - getTodayRange() com BRAZIL_OFFSET_HOURS=3 (UTC offset estático, sem getTimezoneOffset)
    - createAndTrim — create + findMany + deleteMany se >30 (DoS mitigation T-05-06)
    - userId sempre de request.user!.id no controller (T-05-04 isolation)
key_files:
  created:
    - apps/api/src/modules/notifications/__tests__/notifications.service.test.ts
  modified:
    - apps/api/src/modules/orders/orders.service.ts
    - apps/api/src/modules/orders/orders.repository.ts
    - apps/api/src/modules/orders/orders.controller.ts
    - apps/api/src/modules/orders/orders.route.ts
    - apps/api/src/modules/notifications/notifications.service.ts
    - apps/api/src/modules/notifications/notifications.controller.ts
    - apps/api/src/modules/notifications/notifications.route.ts
    - apps/api/src/modules/orders/__tests__/orders.service.test.ts
decisions:
  - getTodayRange usa BRAZIL_OFFSET_HOURS=3 estático (não getTimezoneOffset) — consistência com padrão existente do projeto
  - createAndTrim implementado no service (não no cron) — simplifica chamadores em admin-orders.service.ts
  - userId nunca aceito de body/query — sempre de request.user!.id (mitiga T-05-04)
metrics:
  duration: "3 minutes"
  completed: "2026-06-15T13:39:05Z"
  tasks_completed: 2
  files_modified: 9
---

# Phase 05 Plan 02: Orders & Notifications Endpoints Summary

**One-liner:** 5 endpoints REST para rastreamento de entrega e central de notificações in-app, com isolamento por userId via JWT e timezone BRT por offset estático.

## Tasks Completed

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 | Stubs de teste RED — 8 novos casos em orders.service.test.ts e notifications.service.test.ts | 1fa42ea | DONE |
| 2 | Implementação GREEN — orders e notifications extensions, 48 testes verdes | 9aad149 | DONE |

## What Was Built

### orders.service.ts
- **getTodayRange()** — helper que calcula início e fim do dia BRT usando `BRAZIL_OFFSET_HOURS = 3`; meia-noite BRT = 03:00 UTC
- **getTodayOrder(userId)** — `prisma.order.findFirst` com `scheduledDate: { gte: start, lte: end }` e `status: { not: 'CANCELLED' }`
- **getOrderHistory(userId, days=30)** — `prisma.order.findMany` com `scheduledDate: { gte: since }`, `status: { not: 'CANCELLED' }`, `orderBy: { scheduledDate: 'desc' }`

### orders.repository.ts
- **findTodayByUserId(userId, start, end)** — findFirst com range BRT
- **findHistoryByUserId(userId, since)** — findMany com corte temporal

### orders.controller.ts + orders.route.ts
- `GET /orders/today` — 404 `{ error: 'Nenhuma entrega hoje' }` se null
- `GET /orders/history?days=30` — array vazio se nenhum pedido no período

### notifications.service.ts
- **getByUserId(userId)** — findMany `{ take: 30, orderBy: { createdAt: 'desc' } }`
- **markAllRead(userId)** — updateMany `{ where: { userId, isRead: false }, data: { isRead: true } }`
- **createAndTrim(data)** — create + trim: deleteMany se `all.length > 30` (mitigação T-05-06)
- **countUnread(userId)** — count `{ where: { userId, isRead: false } }`

### notifications.controller.ts + notifications.route.ts
- `GET /notifications/me` — retorna array das últimas 30 notificações
- `PATCH /notifications/read-all` — retorna `{ ok: true }`
- `GET /notifications/unread-count` — retorna `{ count: N }`
- `POST /users/push-token` — preservada (não removida)

### Testes
- **orders.service.test.ts**: +5 casos (05-03a,b,c para getTodayOrder; 05-08a,b para getOrderHistory)
- **notifications.service.test.ts**: criado do zero com 3 casos (05-09a getByUserId; 05-09b markAllRead; 05-09c countUnread)
- **Suite completa**: 48 testes / 7 arquivos — todos passam

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED — 8 novos casos falham com TypeError | 1fa42ea | PASSED |
| GREEN — todos os 11 casos passam (3 preexistentes + 8 novos) | 9aad149 | PASSED |

## Deviations from Plan

None — plano executado exatamente conforme especificado.

## Threat Model Verification

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-05-04: Information Disclosure em /notifications/me | userId sempre de `request.user!.id` no controller — verificado em 4 handlers | MITIGATED |
| T-05-05: Information Disclosure em /orders/today e /orders/history | `preHandler: [fastify.authenticate]` em ambas as rotas; userId do JWT | MITIGATED |
| T-05-06: DoS em notifications.service.ts createAndTrim | deleteMany após create se `all.length > 30` | MITIGATED |

## Known Stubs

None — todos os métodos implementados retornam dados reais do Prisma.

## Threat Flags

None — nenhuma nova superfície de ataque introduzida além do planejado.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| orders.service.ts com getTodayRange, getTodayOrder, getOrderHistory | FOUND |
| notifications.service.ts com getByUserId, markAllRead, createAndTrim, countUnread | FOUND |
| orders.route.ts com GET /orders/today e GET /orders/history | FOUND |
| notifications.route.ts com GET /notifications/me, PATCH /read-all, GET /unread-count | FOUND |
| notifications.route.ts ainda contém POST /users/push-token | FOUND |
| Commit 1fa42ea (RED tests) | FOUND |
| Commit 9aad149 (GREEN implementation) | FOUND |
| 48 testes passando (7 arquivos) | VERIFIED |
