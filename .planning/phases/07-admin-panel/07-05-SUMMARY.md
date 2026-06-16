---
phase: 07-admin-panel
plan: 05
subsystem: api-modules
tags: [admin, financial, payments, mercadopago, refund, prisma-aggregate, tdd]
dependency_graph:
  requires:
    - 07-01 (schema Prisma + stubs Wave 0 — AdminFinancialService e AdminPaymentsService stubs)
  provides:
    - GET /admin/financial com period, byType, byCondominium
    - GET /admin/payments (lista)
    - GET /admin/payments/:id (detalhe)
    - POST /admin/payments/:id/refund (estorno MP + $transaction)
  affects:
    - server.ts — adminFinancialRoute e adminPaymentsRoute registrados
    - 07-08 a 07-12 (UI admin) — endpoints disponíveis para consumo frontend
tech_stack:
  added: []
  patterns:
    - prisma.payment.aggregate com _sum e where status=PAID para ADMF-01
    - $runCommandRaw com pipeline $lookup Payment->User->condominiumId para ADMF-02
    - PaymentRefund.total({ payment_id }) do SDK mercadopago v3 para PAY-04
    - prisma.$transaction array para atomicidade Payment+CreditTransaction+User
    - Math.min(paesQty, user.creditBalance) para creditsToDebit seguro (D-05)
key_files:
  created:
    - apps/api/src/modules/admin-financial/admin-financial.schema.ts
    - apps/api/src/modules/admin-financial/admin-financial.controller.ts
    - apps/api/src/modules/admin-financial/admin-financial.route.ts
    - apps/api/src/modules/admin-payments/admin-payments.repository.ts
    - apps/api/src/modules/admin-payments/admin-payments.schema.ts
    - apps/api/src/modules/admin-payments/admin-payments.controller.ts
    - apps/api/src/modules/admin-payments/admin-payments.route.ts
  modified:
    - apps/api/src/modules/admin-financial/admin-financial.service.ts (stub → implementação real)
    - apps/api/src/modules/admin-financial/__tests__/admin-financial.service.test.ts (stub → testes reais)
    - apps/api/src/modules/admin-payments/admin-payments.service.ts (stub → implementação real)
    - apps/api/src/modules/admin-payments/__tests__/admin-payments.service.test.ts (stub → testes reais)
    - apps/api/src/server.ts (registrar adminFinancialRoute e adminPaymentsRoute)
decisions:
  - PaymentRefund (não Payment) para estorno — classe separada no SDK mercadopago v3 (Pitfall 2 do RESEARCH.md)
  - $runCommandRaw com $match date range ANTES do $lookup — T-07-05-05 (mitigar DoS em collection inteira)
  - creditsToDebit = Math.min(combo.quantity ou customQuantity, user.creditBalance) — D-05 (debitar apenas disponível)
  - Erro da API MP → 502 (não 500) para diferenciar erro externo de erro interno
metrics:
  duration: 7min
  completed_date: "2026-06-16T00:40:00Z"
  tasks_completed: 2
  files_modified: 5
  files_created: 7
---

# Phase 7 Plan 5: admin-financial e admin-payments Summary

**One-liner:** Módulos financeiro e de pagamentos do admin — receita por período/tipo/condomínio via prisma.aggregate + $runCommandRaw, e estorno Mercado Pago com PaymentRefund.total() em transação atômica.

## What Was Built

### Task 1: Módulo admin-financial (commit `b20e9ab`)

Implementação completa de `AdminFinancialService.getRevenue(period, condominiumId?)` cobrindo ADMF-01 a ADMF-03:

- **ADMF-01:** `prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'PAID', createdAt: { gte, lte } } })` com intervalo de datas calculado em BRT (UTC-3) para `period=day|week|month`
- **ADMF-03:** Duas queries `aggregate` separadas — `comboId: { not: null }` para combos, `customQuantity: { not: null }` para avulso
- **ADMF-02:** `$runCommandRaw` com pipeline `$match` (date range, impedindo DoS) → `$lookup` Payment→User → `$unwind` → `$group` por `condominiumId`. Nomes buscados via `condominium.findMany` por ids extraídos do resultado.
- `condominiumId` opcional no pipeline via `$match 'user.condominiumId': { $oid: id }`

Arquivos criados:
- `admin-financial.schema.ts` — `FinancialQuerySchema` com `period` e `condominiumId` opcional
- `admin-financial.controller.ts` — role check ADMIN + Zod parse de querystring
- `admin-financial.route.ts` — `GET /admin/financial` com `preHandler: [authenticate]`

Testes: 5 novos testes verdes cobrindo total, byType, byCondominium, condominiumId e total=0.

### Task 2: Módulo admin-payments (commit `642ae08`)

Implementação completa de lista, detalhe e estorno:

- **PAY-03:** `list()` via `findAll()` + join manual ao User. `getById(id)` com 404 se não encontrado.
- **PAY-04:** `refund(id)` — 6 passos exatos do plano:
  1. `findById` com 404
  2. Verificar `status === 'PAID'` — 400 se diferente
  3. Verificar `mercadoPagoId` não nulo — 400 se nulo (T-07-05-03)
  4. `this.refundApi.total({ payment_id: mercadoPagoId })` — **classe PaymentRefund** (não Payment, Pitfall 2)
  5. `creditsToDebit = Math.min(combo.quantity ?? customQuantity ?? 0, user.creditBalance)` (D-05)
  6. `prisma.$transaction([payment.update, creditTransaction.create, user.update])` — atomicidade (T-07-05-02)

Arquivos criados:
- `admin-payments.repository.ts` — `findAll`, `findById`, `updateStatus`
- `admin-payments.schema.ts` — `PaymentIdParamSchema` para validar `:id`
- `admin-payments.controller.ts` — handlers `list`, `getById`, `refund`; erro MP → 502
- `admin-payments.route.ts` — 3 rotas com `preHandler: [authenticate]`

Testes: 7 novos testes verdes com `vi.mock('mercadopago')` correto (MockPaymentRefund com `.total`), verificando chamada com `payment_id` correto e `$transaction` chamado 1 vez.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mock de teste para $transaction precisava de métodos adicionais**

- **Found during:** Task 2 — fase GREEN (execução do service real)
- **Issue:** O mock do Prisma no teste tinha apenas `$transaction` mas não tinha `payment.update`, `creditTransaction.create`, e `user.update`. O service chama esses métodos como argumentos do array passado para `$transaction`, causando `TypeError: this.prisma.payment.update is not a function`.
- **Fix:** Adicionados `payment.update`, `user.update`, e `creditTransaction.create` ao mock do Prisma nos testes. O `$transaction` continua mockado para retornar o resultado pré-definido.
- **Files modified:** `admin-payments/__tests__/admin-payments.service.test.ts`
- **Commit:** Incluído no commit `642ae08`

## Known Stubs

Nenhum. Todos os stubs da Wave 0 foram substituídos por implementações reais funcionais.

## Threat Surface Scan

Endpoints novos introduzidos — já cobertos pelo `<threat_model>` do plano:

| Flag | File | Description |
|------|------|-------------|
| threat_flag: elevation-of-privilege | admin-financial.route.ts + admin-payments.route.ts | Novos endpoints admin — mitigado: role check ADMIN inline no controller em todos os handlers |
| threat_flag: tampering | admin-payments.service.ts (refund) | Estorno via MP — mitigado: verificação status=PAID + mercadoPagoId + $transaction atômica |

Todos os threats identificados no `<threat_model>` do plano (T-07-05-01 a T-07-05-06) estão mitigados conforme especificado.

## Self-Check: PASSED

Verificações realizadas:

- `admin-financial.service.ts` — FOUND (implementação real, `getRevenue` retorna `total/byType/byCondominium`)
- `admin-financial.schema.ts` — FOUND (FinancialQuerySchema com period e condominiumId)
- `admin-financial.controller.ts` — FOUND (role check ADMIN + Zod parse)
- `admin-financial.route.ts` — FOUND (GET /admin/financial com authenticate)
- `admin-payments.service.ts` — FOUND (PaymentRefund instanciado no construtor, $transaction na linha 131)
- `admin-payments.repository.ts` — FOUND (findAll, findById, updateStatus)
- `admin-payments.controller.ts` — FOUND (handlers list, getById, refund com 502 para MP)
- `admin-payments.route.ts` — FOUND (3 rotas com authenticate)
- Commit `b20e9ab` — admin-financial implementado
- Commit `642ae08` — admin-payments implementado
- Suite Vitest API: 14 test files, 77 testes passando (baseline era 67, +10 novos)
- `grep PaymentRefund apps/api/src/modules/admin-payments/admin-payments.service.ts` — FOUND (não Payment)
- `grep "$transaction" apps/api/src/modules/admin-payments/admin-payments.service.ts` — FOUND (linha 131)
- `grep "refund\|/admin/payments" apps/api/src/modules/admin-payments/admin-payments.route.ts` — FOUND (3 endpoints)
