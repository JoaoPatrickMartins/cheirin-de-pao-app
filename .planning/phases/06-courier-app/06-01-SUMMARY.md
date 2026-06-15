---
phase: 06-courier-app
plan: "01"
subsystem: backend-courier
tags:
  - courier
  - api
  - prisma
  - authentication
  - osrm
  - nominatim
  - tdd

dependency_graph:
  requires:
    - 05-01  # admin-orders module (updateOrderStatus + notifyAndPersist)
    - 05-06  # authenticate plugin (base para requireCourier)
  provides:
    - courier-module-api        # GET /courier/orders/today + PATCH /courier/orders/:id/confirm
    - assign-courier-endpoint   # PATCH /admin/orders/assign-courier
    - require-courier-guard     # fastify.requireCourier preHandler
    - courierId-field-in-order  # campo courierId String? em Order no schema Prisma
  affects:
    - 06-02  # frontend courier (consome GET /courier/orders/today)
    - 06-03  # courier map (consome dados de rota do endpoint)

tech_stack:
  added:
    - Nominatim (geocodificacao de enderecos via api.nominatim.openstreetmap.org)
    - OSRM publico (router.project-osrm.org — rota entre condominios)
  patterns:
    - CourierService.geocodeCache Map em nivel de instancia (cache em memoria por sessao)
    - requireCourier preHandler como analogo ao requireAdmin existente
    - delegacao de updateOrderStatus ao AdminOrdersService (reutilizacao sem duplicacao)

key_files:
  created:
    - apps/api/src/modules/courier/courier.schema.ts
    - apps/api/src/modules/courier/courier.repository.ts
    - apps/api/src/modules/courier/courier.service.ts
    - apps/api/src/modules/courier/courier.controller.ts
    - apps/api/src/modules/courier/courier.route.ts
    - apps/api/src/modules/courier/__tests__/courier.service.test.ts
  modified:
    - apps/api/prisma/schema.prisma  # courierId String? em model Order
    - apps/api/src/plugins/authenticate.ts  # requireCourier guard + declare module
    - apps/api/src/modules/admin-orders/admin-orders.schema.ts  # AssignCourierSchema
    - apps/api/src/modules/admin-orders/admin-orders.service.ts  # assignCourier method
    - apps/api/src/modules/admin-orders/admin-orders.controller.ts  # assignCourier handler
    - apps/api/src/modules/admin-orders/admin-orders.route.ts  # PATCH assign-courier
    - apps/api/src/server.ts  # courierRoute registrado

decisions:
  - "courierId validado via ownership check (order.courierId === JWT id) antes de qualquer acao — T-06-01"
  - "geocodeCache como Map<string, coords|null> em nivel de instancia — evita chamadas repetidas ao Nominatim"
  - "OSRM em try/catch isolado — erro seta route: null sem propagar (graceful degradation)"
  - "requireCourier como preHandler separado de authenticate — composicao explicita na rota"
  - "confirmDelivery delega updateOrderStatus ao AdminOrdersService — reutiliza push + persist sem duplicar"

metrics:
  duration: "351s (~6min)"
  completed_date: "2026-06-15"
  tasks_completed: 2
  files_created: 6
  files_modified: 7
---

# Phase 06 Plan 01: Modulo Courier Backend Summary

**One-liner:** Modulo courier completo com guard requireCourier, GET /courier/orders/today agrupado por condominio com geocodificacao Nominatim + rota OSRM, PATCH confirm com ownership check 403, e endpoint assign-courier no admin.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Schema courierId + requireCourier guard + stubs TDD Red | 67f5cc0 | schema.prisma, authenticate.ts, courier.service.test.ts |
| 2 | Modulo courier completo + assign-courier + wiring (TDD Green) | 22247f6 | 5 novos + 6 modificados |

## What Was Built

### Backend — Modulo Courier

**`GET /courier/orders/today`** (preHandler: [authenticate, requireCourier]):
- Filtra ordens por `courierId === JWT.id` e status `SCHEDULED | OUT_FOR_DELIVERY` no range BRT hoje
- Enrich: busca nome do cliente e dados do condominio (nome, endereco) via Prisma
- Agrupa por `condominiumId`; ordena stops por apartamento numerico ASC (parseInt, fallback 9999)
- Geocodifica enderecos via Nominatim com cache em memoria (`geocodeCache` Map)
- Calcula rota OSRM em try/catch isolado — erro seta `route: null` (graceful degradation D-07)
- Retorna `TodayOrdersResponse` completo

**`PATCH /courier/orders/:id/confirm`** (preHandler: [authenticate, requireCourier]):
- Extrai `courierId` do JWT — nunca do body (T-06-01)
- Valida `order.courierId === courierId` — lanca `{ statusCode: 403 }` se diferente
- Delega para `AdminOrdersService.updateOrderStatus('DELIVERED')` que dispara push OneSignal + persiste Notification

**`PATCH /admin/orders/assign-courier`** (preHandler: [authenticate] + role check ADMIN inline):
- Aceita `{ courierId, orderIds[] }` ou `{ courierId, condominiumId, date }`
- `orderIds`: updateMany direto
- `condominiumId+date`: query em 2 etapas (findMany → updateMany)
- Validado via `AssignCourierSchema` Zod

### Schema Prisma
- Adicionado `courierId String? @db.ObjectId` ao model `Order` (D-10)
- `prisma db push` executado com sucesso; `prisma generate` regenerou o client

### Guard requireCourier
- Adicionado ao `authenticate.ts` como `preHandlerHookHandler` analogo ao requireAdmin
- Role check: `request.user?.role !== 'COURIER'` → 403

## TDD Gate Compliance

**RED gate (Task 1):** Commit `67f5cc0` — stubs de 6 comportamentos em `courier.service.test.ts` (vitest, 331 linhas)
**GREEN gate (Task 2):** Commit `22247f6` — implementacao completa; 96/96 testes passando (14 arquivos de teste)

## Security Threats Addressed

| Threat ID | Mitigation Implemented |
|-----------|----------------------|
| T-06-01 | `confirmDelivery` valida `order.courierId === courierId` (JWT) antes de delegar — lanca 403 se diferente |
| T-06-02 | `preHandler: [authenticate, requireCourier]` em ambas as rotas — role != COURIER retorna 403 |
| T-06-03 | `repository.findTodayByCourierId` filtra por `courierId` — orders sem courierId nunca retornam |
| T-06-04 | Role check ADMIN inline no `controller.assignCourier` + `AssignCourierSchema` Zod |
| T-06-05 | `encodeURIComponent(address)` aplicado na URL do Nominatim; endereco vem do banco (nao do entregador) |

## Deviations from Plan

None — plano executado exatamente conforme especificado.

## Known Stubs

None — todos os endpoints estao funcionais com logica real:
- `getTodayOrders` faz queries reais ao banco via `findTodayByCourierId`
- `confirmDelivery` delega ao `AdminOrdersService` real (push + persist)
- `assignCourier` executa `updateMany` real

## Threat Flags

None — nenhuma nova superficie de seguranca alem do que esta no threat_model do plano.

## Self-Check: PASSED

### Arquivos criados
- [x] apps/api/src/modules/courier/courier.schema.ts
- [x] apps/api/src/modules/courier/courier.repository.ts
- [x] apps/api/src/modules/courier/courier.service.ts
- [x] apps/api/src/modules/courier/courier.controller.ts
- [x] apps/api/src/modules/courier/courier.route.ts
- [x] apps/api/src/modules/courier/__tests__/courier.service.test.ts

### Commits
- [x] 67f5cc0 — test(06-01): schema courierId + requireCourier guard + stubs TDD Red
- [x] 22247f6 — feat(06-01): modulo courier completo + assign-courier + wiring server.ts (TDD Green)

### Testes
- [x] 96/96 testes passando (14 arquivos de teste)
- [x] 6 novos testes do modulo courier (todos verdes)
