---
phase: 12-cart-es-salvos
plan: "01"
subsystem: backend/payments
tags:
  - saved-cards
  - mercadopago
  - pci-dss
  - tdd
  - fastify
dependency_graph:
  requires:
    - "apps/api/src/plugins/prisma.ts (prisma.savedCard model)"
    - "apps/api/src/plugins/authenticate.ts (fastify.authenticate preHandler)"
    - "apps/api/src/modules/payments/payments.service.ts (expandido)"
  provides:
    - "GET /users/me/cards"
    - "PATCH /users/me/cards/:id"
    - "DELETE /users/me/cards/:id"
    - "POST /payments/card aceita savedCardId + securityCode"
    - "POST /payments/card aceita saveCard:true para salvar após pagamento"
  affects:
    - "apps/api/src/server.ts (novo register savedCardsRoute)"
    - "apps/api/src/modules/payments/payments.schema.ts (schema expandido)"
tech_stack:
  added: []
  patterns:
    - "route → controller → service → repository (padrão Cheirin de Pão)"
    - "isBusinessError guard (copiado de payments.controller.ts)"
    - "$transaction atômico para setDefault"
    - "CardToken.create com CVV descartado (PCI DSS)"
    - "TDD Red→Green com vi.mock do SDK mercadopago"
key_files:
  created:
    - apps/api/src/modules/saved-cards/saved-cards.schema.ts
    - apps/api/src/modules/saved-cards/saved-cards.repository.ts
    - apps/api/src/modules/saved-cards/saved-cards.service.ts
    - apps/api/src/modules/saved-cards/saved-cards.controller.ts
    - apps/api/src/modules/saved-cards/saved-cards.route.ts
    - apps/api/src/modules/saved-cards/__tests__/saved-cards.service.test.ts
    - apps/api/src/modules/payments/__tests__/payments-card-saved.test.ts
  modified:
    - apps/api/src/modules/payments/payments.service.ts
    - apps/api/src/modules/payments/payments.schema.ts
    - apps/api/src/modules/payments/__tests__/payments.service.test.ts
    - apps/api/src/server.ts
decisions:
  - "createCardWithSaved expõe token (não chama Payment.create) para pagamentos usarem: separação de responsabilidade entre saved-cards e payments"
  - "saveCard flow em payments.service.ts (não em saved-cards.service.ts) para manter T-12-04: salvar só após Payment.create bem-sucedido"
  - "security_code passado apenas no body de CardToken.create e descartado imediatamente (D-16 + T-12-02)"
  - "getOrCreateMpCustomer: verifica DB → busca MP por email → cria; nunca cria duplicata (T-12-06)"
metrics:
  duration: "~6 minutos"
  completed_date: "2026-06-20"
  tasks_completed: 2
  files_changed: 11
---

# Phase 12 Plan 01: Módulo Saved Cards (Backend) Summary

## One-liner

Módulo completo de cartões salvos via MP Customer API: 5 arquivos backend (schema/repository/service/controller/route), expansão de payments.service com savedCardId + saveCard:true, 21 testes TDD verdes cobrindo IDOR/CVV/limite/atomicidade.

## What Was Built

### Task 1: Módulo saved-cards (5 arquivos + testes)

Criado o módulo `saved-cards` seguindo o padrão route → controller → service → repository do projeto:

- **saved-cards.schema.ts**: Zod schemas para `SavedCardParams` (id) e `SetDefaultBody` (isDefault) com tipos inferidos
- **saved-cards.repository.ts**: Classe com métodos `findByUser`, `findById`, `countByUser`, `create`, `setDefault` (via `prisma.$transaction`), `deleteById`
- **saved-cards.service.ts**: Instancia `Customer`, `CustomerCard`, `CardToken` do SDK mercadopago; implementa `listCards`, `getOrCreateMpCustomer`, `setDefault`, `removeCard`, `createCardWithSaved`, `saveNewCard`
- **saved-cards.controller.ts**: `list`, `setDefault`, `remove` com `isBusinessError` guard (idêntico ao de payments.controller.ts)
- **saved-cards.route.ts**: Plugin Fastify com 3 endpoints autenticados e tags OpenAPI

**Cobertura de segurança (STRIDE):**
- T-12-01 (IDOR): `savedCard.userId !== userId` → 404 em todos os endpoints e no service — nunca revela existência do recurso
- T-12-02 (CVV): `security_code` apenas no body de `cardTokenApi.create`, não logado, não persistido, não retornado
- T-12-03 (limite): `countByUser >= 3` verificado no service antes de chamar MP
- T-12-05 (race condition setDefault): `prisma.$transaction([updateMany, update])` garante atomicidade
- T-12-06 (duplicata MP Customer): verifica `mpCustomerId` no DB → busca MP por email → cria apenas se ausente

### Task 2: Expansão payments.service + wiring server.ts

- **payments.schema.ts**: `token` agora opcional; adicionados `savedCardId`, `securityCode`, `saveCard` com refinements Zod
- **payments.service.ts**: Importa `Customer`, `CustomerCard`, `CardToken`; fluxo com `savedCardId` (CardToken.create antes de Payment.create); fluxo com `saveCard:true` (após Payment.create bem-sucedido, respeita limite de 3)
- **server.ts**: Import e registro de `savedCardsRoute` + tag OpenAPI `saved-cards`
- **payments.service.test.ts**: Mock mercadopago atualizado com as 3 novas classes (fix de regressão)

## Test Results

```
Test Files  21 passed | 1 skipped (22)
Tests       170 passed | 3 todo (173)
```

- 16 novos testes em `saved-cards.service.test.ts` (CARD-01, CARD-04, CARD-05, CARD-06)
- 5 novos testes em `payments-card-saved.test.ts` (CARD-02, CARD-06)
- 0 regressões em testes existentes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mock incompleto de mercadopago em payments.service.test.ts**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** `payments.service.test.ts` mockava apenas `MercadoPagoConfig` e `Payment`; ao expandir `payments.service.ts` para importar `Customer`, `CustomerCard`, `CardToken`, o Vitest lançou "No 'Customer' export is defined on the mock"
- **Fix:** Adicionado mock de `Customer`, `CustomerCard`, `CardToken` ao `vi.mock('mercadopago', ...)` existente; adicionado `savedCard` ao `createMockFastify` do mesmo arquivo
- **Files modified:** `apps/api/src/modules/payments/__tests__/payments.service.test.ts`
- **Commit:** `506dbcb`

## Known Stubs

Nenhum. O módulo não possui valores hardcoded, placeholders ou dados mockados fluindo para a UI. O módulo é puramente backend — os dados virão do Prisma + MP API em runtime.

## Threat Flags

Nenhuma nova superfície de ameaça não coberta pelo threat_model do plano. Todos os endpoints exigem `fastify.authenticate` e validam IDOR.

## Self-Check: PASSED

- FOUND: apps/api/src/modules/saved-cards/saved-cards.schema.ts
- FOUND: apps/api/src/modules/saved-cards/saved-cards.repository.ts
- FOUND: apps/api/src/modules/saved-cards/saved-cards.service.ts
- FOUND: apps/api/src/modules/saved-cards/saved-cards.controller.ts
- FOUND: apps/api/src/modules/saved-cards/saved-cards.route.ts
- FOUND: apps/api/src/modules/saved-cards/__tests__/saved-cards.service.test.ts
- FOUND: apps/api/src/modules/payments/__tests__/payments-card-saved.test.ts
- FOUND commit 4406877 (Task 1)
- FOUND commit 506dbcb (Task 2)
