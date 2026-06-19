---
phase: 10-schema-v1-1-cr-dito-manual-admin-logout
plan: "02"
subsystem: api/admin-clients
tags: [fastify, prisma, onesignal, tdd-green, admin-clients, credits]
dependency_graph:
  requires:
    - Plan 10-01 (schema ADMIN_GRANT, CREDIT_GRANTED, adminId/reason no CreditTransaction)
  provides:
    - POST /admin/clients/:id/grant-credits operacional
    - GrantCreditsSchema (quantity int min 1, reason enum 4 valores)
    - AdminClientsService.grantCredits com transacao atomica + push + notificacao in-app
    - AdminClientsController.grantCredits com role check ADMIN
    - getDetail flatten corrigido (campos no nivel raiz)
  affects:
    - Frontend Admin que consume GET /admin/clients/:id (resposta agora achatada)
    - Qualquer cliente que chama grantCredits via POST (novo endpoint)
tech_stack:
  added: []
  patterns:
    - "prisma.$transaction para operacao financeira atomica"
    - "Push OneSignal best-effort (try/catch — falha ignorada)"
    - "NotificationsService.createAndTrim fora do try do push (obrigatorio)"
    - "TDD GREEN — 4 stubs RED do Plan 01 passam"
key_files:
  created: []
  modified:
    - apps/api/src/modules/admin-clients/admin-clients.schema.ts
    - apps/api/src/modules/admin-clients/admin-clients.route.ts
    - apps/api/src/modules/admin-clients/admin-clients.service.ts
    - apps/api/src/modules/admin-clients/admin-clients.controller.ts
    - apps/api/src/modules/admin-clients/__tests__/admin-clients.service.test.ts
decisions:
  - "NotificationsService instanciado diretamente na service (new NotificationsService(this.fastify)) — mesmo padrao do schedules.service.ts"
  - "TransactionType e NotificationType importados de @prisma/client — evita strings literais sem type safety"
  - "prisma generate re-executado (desvio Rule 1) — cliente gerado no Plan 01 nao incluia ADMIN_GRANT e CREDIT_GRANTED no TypeScript"
  - "Mock prisma.notification adicionado ao makeFastifyMock — necessario para NotificationsService.createAndTrim no contexto de teste"
metrics:
  duration: "15min"
  completed_date: "2026-06-19"
  tasks_completed: 2
  files_modified: 5
---

# Phase 10 Plan 02: grantCredits Service + Route + Flatten Fix Summary

**One-liner:** Servico grantCredits com transacao atomica Prisma (ADMIN_GRANT), push OneSignal best-effort e notificacao CREDIT_GRANTED persistida; rota POST /admin/clients/:id/grant-credits registrada; flatten do getDetail corrigido; todos os 15 testes em GREEN.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Adicionar GrantCreditsSchema e rota POST grant-credits | 19a5c10 | admin-clients.schema.ts, admin-clients.route.ts |
| 2 | Implementar grantCredits na service + corrigir flatten no controller (GREEN phase) | 46b1186 | admin-clients.service.ts, admin-clients.controller.ts, admin-clients.service.test.ts |

## What Was Built

### Task 1 — Schema e Route

`admin-clients.schema.ts`:
- `GrantCreditsSchema` exportado com `quantity: z.number().int().min(1)` e `reason: z.enum(['Acerto', 'Bonificacao', 'Compensacao', 'Promocao'])`
- Tipo `GrantCreditsBody` exportado

`admin-clients.route.ts`:
- Rota `POST /admin/clients/:id/grant-credits` registrada com `preHandler: [fastify.authenticate]`
- Schema OpenAPI documentado (body, params, response 200)

### Task 2 — Service, Controller e Testes (GREEN)

`admin-clients.service.ts`:
- Imports adicionados: `OneSignal`, `TransactionType`, `NotificationType` de `@prisma/client`, `NotificationsService`
- Helper `createOsClient()` definido seguindo padrao do projeto
- Metodo `grantCredits(clientId, { quantity, reason, adminId })`:
  1. Valida `quantity >= 1` — lanca `{ statusCode: 400 }` se invalido
  2. Busca user por id; lanca `{ statusCode: 404 }` se inexistente ou nao CLIENT
  3. `prisma.$transaction([creditTransaction.create(ADMIN_GRANT), user.update(increment)])` — atomico
  4. Push OneSignal best-effort (try/catch — falha logada, nao lancada)
  5. `notificationsService.createAndTrim(CREDIT_GRANTED)` — FORA do try, obrigatorio

`admin-clients.controller.ts`:
- Import de `GrantCreditsSchema` adicionado
- `getDetail`: flatten corrigido — `reply.send({ ...result.client, schedule: result.schedule, recentOrders: result.recentOrders })`
- Metodo `grantCredits`: role check ADMIN, validacao Zod do body, `adminId` extraido do JWT

`admin-clients.service.test.ts`:
- `makeFastifyMock` atualizado com `prisma.notification` (create, findMany, deleteMany) — necessario para `NotificationsService.createAndTrim`

**Resultado dos testes:**
- 4 testes `grantCredits`: PASS (GREEN confirmado)
- 11 testes existentes (list, getDetail, blockToggle): PASS (nenhum regrediu)
- Total: 15/15 PASS

## Verification Results

```
Tests: 15 passed (0 failed)
grant-credits no route.ts: 1 match
GrantCreditsSchema no schema.ts: 4 matches
ADMIN_GRANT no service.ts: 2 matches (enum + data create)
createAndTrim no service.ts: 1 match
...result.client no controller.ts: 1 match
npx tsc --noEmit: 0 erros TypeScript
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] prisma generate necessario para ADMIN_GRANT e CREDIT_GRANTED no TypeScript**
- **Found during:** Task 2 — verificacao TypeScript pos-implementacao
- **Issue:** O cliente Prisma TypeScript nao incluia `ADMIN_GRANT` no `TransactionType` nem `CREDIT_GRANTED` no `NotificationType`, mesmo apos o `prisma generate` do Plan 01. O cliente gerado nao refletia o schema v1.1.
- **Fix:** Re-executado `cd apps/api && npx prisma generate` — regenerou o cliente com os enums corretos.
- **Files modified:** `node_modules/.prisma/client/index.d.ts` (gerado — nao commitado)
- **Commit:** N/A (arquivo gerado)

**2. [Rule 1 - Bug] Mock prisma.notification ausente no makeFastifyMock**
- **Found during:** Task 2 — primeira execucao dos testes apos implementacao
- **Issue:** `NotificationsService.createAndTrim` usa `this.prisma.notification.create` e `findMany`, mas o `makeFastifyMock` nao tinha `notification` no prisma mock. Resultado: `TypeError: Cannot read properties of undefined (reading 'create')`.
- **Fix:** Adicionado `notification: { create: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() }` ao mock.
- **Files modified:** `apps/api/src/modules/admin-clients/__tests__/admin-clients.service.test.ts`
- **Commit:** 46b1186 (incluido no commit da task)

## TDD Gate Compliance

- RED gate: Commit 8508344 (Plan 01 — stubs falhando com "is not a function")
- GREEN gate: Commit 46b1186 (15/15 testes passando)
- REFACTOR gate: N/A (codigo limpo sem necessidade de refatoracao)

## Threat Flags

Nenhum — implementacao segue exatamente as mitigacoes do threat model do plano:
- T-10-02-01: Role check ADMIN no controller + adminId do JWT (nunca do body)
- T-10-02-02: z.number().int().min(1) + validacao adicional na service
- T-10-02-03: z.enum(['Acerto','Bonificacao','Compensacao','Promocao'])
- T-10-02-04: adminId e reason salvos no CreditTransaction

## Known Stubs

Nenhum — implementacao completa e funcional.

## Self-Check: PASSED

- [x] `admin-clients.schema.ts` — modificado e commitado (19a5c10)
- [x] `admin-clients.route.ts` — modificado e commitado (19a5c10)
- [x] `admin-clients.service.ts` — modificado e commitado (46b1186)
- [x] `admin-clients.controller.ts` — modificado e commitado (46b1186)
- [x] `admin-clients.service.test.ts` — modificado e commitado (46b1186)
- [x] Commit 19a5c10 existe no git log
- [x] Commit 46b1186 existe no git log
- [x] 15/15 testes passando (GREEN)
- [x] Zero erros TypeScript
