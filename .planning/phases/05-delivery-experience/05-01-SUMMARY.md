---
phase: "05"
plan: "01"
subsystem: api
tags: [admin-orders, status-transitions, onesignal, notifications, tdd]
dependency_graph:
  requires:
    - "04-scheduling (OrdersService, PrismaClient com model Order)"
    - "02-auth (fastify.authenticate plugin, UserRole enum)"
  provides:
    - "PATCH /admin/orders/:id/status — endpoint de transição de status"
    - "AdminOrdersService.updateOrderStatus() — validação VALID_TRANSITIONS"
    - "AdminOrdersService.createAndTrim() — persistência + trim 30 notificações"
  affects:
    - "apps/api/src/modules/notifications/ (Plan 02 estenderá NotificationsService)"
tech_stack:
  added: []
  patterns:
    - "VALID_TRANSITIONS map para state machine de pedidos"
    - "Push OneSignal best-effort (try/catch silencioso) + persist obrigatório separado"
    - "Inline role check ADMIN antes de Zod parse no controller"
    - "Notification trim: findMany desc + deleteMany slice(30) por userId"
key_files:
  created:
    - "apps/api/src/modules/admin-orders/admin-orders.schema.ts"
    - "apps/api/src/modules/admin-orders/admin-orders.service.ts"
    - "apps/api/src/modules/admin-orders/admin-orders.controller.ts"
    - "apps/api/src/modules/admin-orders/admin-orders.route.ts"
    - "apps/api/src/modules/admin-orders/__tests__/admin-orders.service.test.ts"
  modified: []
decisions:
  - "createAndTrim implementado diretamente no AdminOrdersService (sem depender do Plan 02) para manter planos Wave 1 paralelos e independentes"
  - "notifyAndPersist: push em try/catch separado; persist SEMPRE fora do try — garantia D-06"
  - "VALID_TRANSITIONS definida fora da classe como constante do módulo (não como propriedade de instância)"
metrics:
  duration: "~25min"
  completed_date: "2026-06-15"
  tasks_completed: 2
  files_created: 5
  tests_added: 6
  tests_total: 46
---

# Phase 5 Plan 01: Admin Orders Module Summary

**One-liner:** Módulo admin-orders com VALID_TRANSITIONS state machine, push OneSignal best-effort ao DELIVERED, e trim automático de 30 notificações por usuário.

## What Was Built

Módulo completo `admin-orders` com 4 arquivos de produção e 1 arquivo de testes:

- **admin-orders.schema.ts** — `UpdateOrderStatusSchema` com `z.enum(['OUT_FOR_DELIVERY', 'DELIVERED'])` e errorMap PT-BR
- **admin-orders.service.ts** — `AdminOrdersService` com `VALID_TRANSITIONS` map, `updateOrderStatus()` e `createAndTrim()` (lógica de persist + trim 30 internamente)
- **admin-orders.controller.ts** — handler com role check inline 403, Zod parse, tratamento de 404/422/500
- **admin-orders.route.ts** — `PATCH /admin/orders/:id/status` com `preHandler: [fastify.authenticate]`
- **admin-orders.service.test.ts** — 6 testes unitários cobrindo todos os fluxos (RED → GREEN TDD)

## TDD Gate Compliance

- RED (test commit): `42b38b8` — `test(05-01): add failing tests for AdminOrdersService (RED)`
- GREEN (feat commit): `b23f850` — `feat(05-01): módulo admin-orders com VALID_TRANSITIONS e notificação DELIVERED`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removido `toHaveBeenCalledAtLeast` (não existe no Vitest)**
- **Found during:** Task 2 (GREEN phase, primeira execução)
- **Issue:** O Vitest não possui o matcher `toHaveBeenCalledAtLeast` — API do Chai/Jest mas não do Vitest nativo
- **Fix:** Substituído por `expect(prisma.notification.create.mock.calls.length).toBeGreaterThanOrEqual(1)` — equivalente e compatível com Vitest
- **Files modified:** `apps/api/src/modules/admin-orders/__tests__/admin-orders.service.test.ts`
- **Commit:** `b23f850` (incluído no mesmo commit GREEN)

## Task Commits

| Task | Tipo | Hash | Descrição |
|------|------|------|-----------|
| Task 1 (RED) | test | `42b38b8` | 6 testes falhos para AdminOrdersService |
| Task 2 (GREEN) | feat | `b23f850` | Módulo completo + correção bug toHaveBeenCalledAtLeast |

## Test Results

- **Novos testes (admin-orders.service.test.ts):** 6/6 passed
- **Suite completa da API (vitest run):** 46/46 passed (7 arquivos)
- **Regressões:** nenhuma

## Verification Checklist

- [x] `PATCH /admin/orders/:id/status` registrada com `preHandler: [fastify.authenticate]`
- [x] Transição `DELIVERED → SCHEDULED` rejeitada com 422 (validada por teste 05-01)
- [x] Role check inline bloqueia `role !== 'ADMIN'` com 403
- [x] `createAndTrim` persiste Notification e aplica trim a 30 por usuário
- [x] Suite `vitest run` retorna 0 (46 testes passando)

## Known Stubs

Nenhum. Todos os métodos implementados e testados.

## Threat Flags

Nenhum novo surface além do descrito no `<threat_model>` do plano.

## Self-Check: PASSED

- `apps/api/src/modules/admin-orders/admin-orders.schema.ts` — FOUND
- `apps/api/src/modules/admin-orders/admin-orders.service.ts` — FOUND
- `apps/api/src/modules/admin-orders/admin-orders.controller.ts` — FOUND
- `apps/api/src/modules/admin-orders/admin-orders.route.ts` — FOUND
- `apps/api/src/modules/admin-orders/__tests__/admin-orders.service.test.ts` — FOUND
- Commit `42b38b8` — FOUND
- Commit `b23f850` — FOUND
