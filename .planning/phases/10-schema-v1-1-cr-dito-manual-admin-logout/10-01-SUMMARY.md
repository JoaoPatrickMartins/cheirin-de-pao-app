---
phase: 10-schema-v1-1-cr-dito-manual-admin-logout
plan: "01"
subsystem: api/schema
tags: [prisma, schema, mongodb, tdd-red, admin-clients]
dependency_graph:
  requires: []
  provides:
    - TransactionType.ADMIN_GRANT no schema Prisma
    - NotificationType.CREDIT_GRANTED no schema Prisma
    - CreditTransaction.adminId e CreditTransaction.reason
    - User.mpCustomerId
    - model SavedCard (18 campos D-07)
    - Condominium.deliverySlots String[]
    - Schedule.days Json?
    - Stubs RED grantCredits no AdminClientsService
  affects:
    - Phase 11 (Configurações e Perfil) — schema completo disponível
    - Phase 12 (Cartões Salvos) — SavedCard + mpCustomerId prontos
    - Phase 13 (Horários por Condomínio) — deliverySlots pronto
    - Phase 14 (Agenda Multi-Slot) — days Json? pronto
    - Plan 10-02 — testes RED aguardando implementação grantCredits
tech_stack:
  added: []
  patterns:
    - "prisma db push para MongoDB Atlas (sem migrate dev)"
    - "TDD RED — stubs de teste falham com 'is not a function'"
key_files:
  created: []
  modified:
    - apps/api/prisma/schema.prisma
    - apps/api/src/modules/admin-clients/__tests__/admin-clients.service.test.ts
decisions:
  - "Schema v1.1 aplicado atomicamente via prisma db push — uma única operacao desbloqueia Phases 11-14"
  - "deliverySlots como String[] embedded em Condominium — array simples HH:MM sem collection separada"
  - "days Json? adicionado em Schedule mantendo weeklyQty/deliveryTime como nullable (cenario A)"
  - "SavedCard como model 18 separado com mpCardId — nao embedded em User"
metrics:
  duration: "2min"
  completed_date: "2026-06-19"
  tasks_completed: 2
  files_modified: 2
---

# Phase 10 Plan 01: Schema v1.1 Atomico + Stubs RED grantCredits Summary

**One-liner:** Schema Prisma v1.1 aplicado atomicamente com 7 mudancas D-02 (ADMIN_GRANT, CREDIT_GRANTED, adminId/reason, mpCustomerId, SavedCard, deliverySlots, days Json?) + 4 stubs TDD RED para grantCredits.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Aplicar Schema v1.1 (D-01, D-02) e executar prisma db push + generate | ab752f7 | apps/api/prisma/schema.prisma |
| 2 | Adicionar test stubs grantCredits (RED phase) ao arquivo de testes existente | 8508344 | apps/api/src/modules/admin-clients/__tests__/admin-clients.service.test.ts |

## What Was Built

### Task 1 — Schema v1.1

Aplicadas 7 mudancas atomicas ao `apps/api/prisma/schema.prisma`:

1. **enum TransactionType**: adicionado `ADMIN_GRANT` apos `EXPIRY`
2. **enum NotificationType**: adicionado `CREDIT_GRANTED` apos `CREDIT_PURCHASED`
3. **model CreditTransaction**: adicionados `adminId String? @db.ObjectId` e `reason String?`
4. **model User**: adicionado `mpCustomerId String?` antes de `createdAt`
5. **model SavedCard (novo — model 18)**: criado com 8 campos D-07 (id, userId, mpCardId, brand, lastFour, expiresAt, isDefault, createdAt)
6. **model Condominium**: adicionado `deliverySlots String[]`
7. **model Schedule**: adicionado `days Json?`

`prisma db push` e `prisma generate` executados com sucesso. Cliente Prisma TypeScript v6.19.3 regenerado.

### Task 2 — Stubs RED grantCredits

Adicionados ao arquivo `admin-clients.service.test.ts`:

- `makeFastifyMock` atualizado: `prisma.$transaction` e `creditTransaction.create` mockados
- `describe('grantCredits')` com 4 testes:
  1. Verifica $transaction chamado + creditBalance=15 apos grant de 5 creditos
  2. Lanca 404 quando cliente nao existe
  3. Lanca 404 quando user nao e CLIENT
  4. Lanca 400 quando quantity < 1

**Resultado do runner:** 4 novos testes FAIL (RED confirmado: "service.grantCredits is not a function"), 22 testes existentes PASS (GREEN mantido).

## Verification Results

```
prisma validate: zero erros
prisma db push: "The database is already in sync with the Prisma schema." (sem erros)
prisma generate: Generated Prisma Client (v6.19.3) sem erros TypeScript

grep ADMIN_GRANT schema.prisma:       1 match
grep CREDIT_GRANTED schema.prisma:    1 match
grep adminId schema.prisma:           1 match
grep mpCustomerId schema.prisma:      1 match
grep "model SavedCard" schema.prisma: 1 match
grep deliverySlots schema.prisma:     1 match
grep "days.*Json" schema.prisma:      1 match

Testes: 4 FAIL (RED) + 22 PASS (GREEN) = 26 total
```

## Deviations from Plan

Nenhuma — plano executado exatamente conforme especificado.

## Known Stubs

Nenhum stub de UI/dados. Os stubs de teste sao intencionais (RED phase TDD) — Plan 10-02 implementara o metodo `grantCredits` na service.

## Self-Check: PASSED

- [x] `apps/api/prisma/schema.prisma` — modificado e commitado (ab752f7)
- [x] `apps/api/src/modules/admin-clients/__tests__/admin-clients.service.test.ts` — modificado e commitado (8508344)
- [x] Commit ab752f7 existe no git log
- [x] Commit 8508344 existe no git log
- [x] 4 novos testes em RED (grantCredits)
- [x] 22 testes existentes em GREEN
