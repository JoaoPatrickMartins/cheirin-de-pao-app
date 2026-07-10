---
phase: 07-admin-panel
plan: 03
subsystem: api-modules
tags: [api, admin, suppliers, couriers, clients, tdd, fastify, prisma]
dependency_graph:
  requires:
    - 07-01 (schema Prisma com Supplier.isPrincipal e Prisma Client regenerado)
  provides:
    - GET/POST/PATCH/DELETE /admin/suppliers (CRUD com isPrincipal único)
    - GET/POST/PATCH /admin/couriers (cadastro + toggle isBlocked)
    - GET /admin/clients (lista com filtro + lastPurchaseAt)
    - GET /admin/clients/:id (detalhe com Schedule ativo + Orders 30 dias)
    - PATCH /admin/clients/:id/block (toggle isBlocked com verificação de role)
  affects:
    - Wave 1 paralela (07-02): independente, sem conflito de arquivos
    - Frontend 07-09 a 07-11 (AdminGestao, AdminClientes) depende desses endpoints
tech_stack:
  added: []
  patterns:
    - TDD RED → GREEN por módulo (testes criados antes da implementação)
    - role check ADMIN inline no primeiro statement de cada handler (T-07-03-01)
    - throw { statusCode, message } no service + captura tipada no controller
    - makeFastifyMock com prisma mockado por coleção (padrão admin-orders)
    - isPrincipal único via updateMany antes de create/update (Supplier)
    - N+1 aceito no MVP para lastPurchaseAt em listas de clientes pequenas
key_files:
  created:
    - apps/api/src/modules/admin-suppliers/admin-suppliers.route.ts
    - apps/api/src/modules/admin-suppliers/admin-suppliers.controller.ts
    - apps/api/src/modules/admin-suppliers/admin-suppliers.service.ts
    - apps/api/src/modules/admin-suppliers/admin-suppliers.schema.ts
    - apps/api/src/modules/admin-suppliers/admin-suppliers.repository.ts
    - apps/api/src/modules/admin-suppliers/__tests__/admin-suppliers.service.test.ts
    - apps/api/src/modules/admin-couriers/admin-couriers.route.ts
    - apps/api/src/modules/admin-couriers/admin-couriers.controller.ts
    - apps/api/src/modules/admin-couriers/admin-couriers.service.ts
    - apps/api/src/modules/admin-couriers/admin-couriers.schema.ts
    - apps/api/src/modules/admin-couriers/admin-couriers.repository.ts
    - apps/api/src/modules/admin-couriers/__tests__/admin-couriers.service.test.ts
    - apps/api/src/modules/admin-clients/admin-clients.route.ts
    - apps/api/src/modules/admin-clients/admin-clients.controller.ts
    - apps/api/src/modules/admin-clients/admin-clients.schema.ts
    - apps/api/src/modules/admin-clients/admin-clients.repository.ts
  modified:
    - apps/api/src/modules/admin-clients/admin-clients.service.ts (substituído stub Wave 0)
    - apps/api/src/modules/admin-clients/__tests__/admin-clients.service.test.ts (substituído stub temporário)
decisions:
  - N+1 aceito no MVP para lastPurchaseAt: para cada cliente da lista, busca 1 CreditTransaction. Volume esperado pequeno (< 200 clientes por condomínio).
  - blockToggle verifica role=CLIENT antes do toggle (T-07-03-04): admin não pode bloquear outro ADMIN ou COURIER via /admin/clients/:id/block — retorna 404 em vez de 403 para não revelar existência do recurso.
  - P2002 Prisma (CPF duplicado) mapeado para 409 Conflict no controller do courier.
  - CPF de entregador é imutável após criação: UpdateCourierSchema usa .omit({ cpf: true }).
metrics:
  duration: 7min
  completed_date: "2026-06-16T00:40:00Z"
  tasks_completed: 2
  files_modified: 2
  files_created: 16
---

# Phase 7 Plan 3: Admin-Suppliers, Admin-Couriers e Admin-Clients Summary

**One-liner:** CRUD de fornecedores com isPrincipal único, gestão de entregadores com toggle ativo/inativo via isBlocked, e lista/detalhe/bloqueio de clientes com filtro por condomínio e histórico dos últimos 30 dias.

## What Was Built

### Task 1: Módulos admin-suppliers e admin-couriers (commits `9cb3f08`, `544ef61`)

**admin-suppliers (5 arquivos + 1 teste):**

| Endpoint | Comportamento |
|----------|---------------|
| `GET /admin/suppliers` | findMany orderBy name asc; inclui isPrincipal no retorno |
| `POST /admin/suppliers` | cria com todos os campos; se isPrincipal=true, updateMany desativa os outros antes |
| `PATCH /admin/suppliers/:id` | atualiza parcialmente; se isPrincipal=true no body, desativa os outros; 404 se não existe |
| `DELETE /admin/suppliers/:id` | remove; 404 se não existe |

Lógica de único principal (T-07-03-03): `prisma.supplier.updateMany({ where: { isPrincipal: true }, data: { isPrincipal: false } })` executado antes de qualquer `create` ou `update` que tenha `isPrincipal: true`.

**admin-couriers (5 arquivos + 1 teste):**

| Endpoint | Comportamento |
|----------|---------------|
| `GET /admin/couriers` | findMany Users role=COURIER; retorna id, name, cpf, phone, email, isBlocked |
| `POST /admin/couriers` | `prisma.user.create` com role=COURIER; Zod valida CPF 11 dígitos; P2002 → 409 |
| `PATCH /admin/couriers/:id/toggle` | busca User por id (findFirst); 404 se não existe; 400 se role ≠ COURIER; toggle isBlocked |
| `PATCH /admin/couriers/:id` | atualiza name, phone, email; CPF imutável (omitido do UpdateCourierSchema) |

### Task 2: Módulo admin-clients (commits `eb97e10`, `974a07d`)

**admin-clients (5 arquivos + teste atualizado):**

| Endpoint | Comportamento |
|----------|---------------|
| `GET /admin/clients` | findMany role=CLIENT; aceita `?condominiumId` como filtro; inclui lastPurchaseAt (último CreditTransaction PURCHASE) |
| `GET /admin/clients/:id` | User + Schedule ativo (isActive=true) + Orders dos últimos 30 dias; 404 se não existe ou não é CLIENT |
| `PATCH /admin/clients/:id/block` | toggle isBlocked; verifica role=CLIENT antes (T-07-03-04); 404 se não existe ou não é CLIENT |

O teste `admin-clients.service.test.ts` foi reescrito: removido o `vi.mock` temporário do Wave 0 e substituído por testes com `makeFastifyMock` testando o serviço real com prisma mockado por coleção.

## TDD Gate Compliance

| Fase | Tarefa | Commit RED | Commit GREEN |
|------|--------|------------|--------------|
| 1 | admin-suppliers + admin-couriers | `9cb3f08` | `544ef61` |
| 2 | admin-clients | `eb97e10` | `974a07d` |

RED confirmado em ambos os casos (testes falhando com `throw new Error('Not implemented — RED')` antes da implementação).

## Deviations from Plan

Nenhum — plano executado exatamente como escrito.

- Todos os 15 arquivos de implementação criados conforme especificado.
- Todos os critérios de segurança do threat model implementados.
- Role check ADMIN inline em todos os 11 handlers.
- Suite Vitest API verde: 16 test files, 91 testes passando.

## Threat Surface Scan

Todos os endpoints novos têm `preHandler: [fastify.authenticate]` na rota + role check ADMIN inline no controller — nenhuma nova superfície não protegida.

| Threat ID | Status |
|-----------|--------|
| T-07-03-01 | Mitigado — role check `request.user?.role !== 'ADMIN'` no primeiro statement de cada handler |
| T-07-03-02 | Mitigado — Zod valida CPF com 11 dígitos; P2002 capturado no controller como 409 |
| T-07-03-03 | Mitigado — updateMany antes de create/update em transação implícita |
| T-07-03-04 | Mitigado — blockToggle verifica role=CLIENT; 404 se role diferente (não revela existência) |
| T-07-03-05 | Mitigado — getDetail somente leitura; role check admin; dados expostos apenas a ADMIN autenticado |

## Self-Check: PASSED

- `apps/api/src/modules/admin-suppliers/admin-suppliers.service.ts` — FOUND
- `apps/api/src/modules/admin-suppliers/admin-suppliers.controller.ts` — FOUND
- `apps/api/src/modules/admin-suppliers/admin-suppliers.route.ts` — FOUND
- `apps/api/src/modules/admin-suppliers/admin-suppliers.schema.ts` — FOUND
- `apps/api/src/modules/admin-suppliers/admin-suppliers.repository.ts` — FOUND
- `apps/api/src/modules/admin-couriers/admin-couriers.service.ts` — FOUND
- `apps/api/src/modules/admin-couriers/admin-couriers.controller.ts` — FOUND
- `apps/api/src/modules/admin-couriers/admin-couriers.route.ts` — FOUND
- `apps/api/src/modules/admin-couriers/admin-couriers.schema.ts` — FOUND
- `apps/api/src/modules/admin-couriers/admin-couriers.repository.ts` — FOUND
- `apps/api/src/modules/admin-clients/admin-clients.service.ts` — FOUND
- `apps/api/src/modules/admin-clients/admin-clients.controller.ts` — FOUND
- `apps/api/src/modules/admin-clients/admin-clients.route.ts` — FOUND
- `apps/api/src/modules/admin-clients/admin-clients.schema.ts` — FOUND
- `apps/api/src/modules/admin-clients/admin-clients.repository.ts` — FOUND
- Commit `9cb3f08` (RED Task 1) — FOUND
- Commit `544ef61` (GREEN Task 1) — FOUND
- Commit `eb97e10` (RED Task 2) — FOUND
- Commit `974a07d` (GREEN Task 2) — FOUND
- Suite Vitest API: 16 test files, 91 testes passando — CONFIRMED
