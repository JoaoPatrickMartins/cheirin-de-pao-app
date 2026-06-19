---
phase: 08-finalizacao-pagamentos
plan: "01"
subsystem: backend-payments-tests
tags:
  - mercado-pago
  - webhooks
  - credits
  - testes
  - sandbox
dependency_graph:
  requires:
    - "03-03: payments.service.ts + webhooks.service.ts implementados"
    - "03-02: credits.service.ts + credits.repository.ts implementados"
  provides:
    - "Suite de testes de backend verdes para webhooks + credits"
    - "Auditoria de atomicidade de creditUserBalance ($transaction confirmado)"
    - "CRED-06 verificado: créditos não expiram por design"
    - "Credenciais MP sandbox configuradas (Task 1 — pelo usuário)"
  affects:
    - "08-02: depende de testes verdes antes de implementar novas funcionalidades"
tech_stack:
  added: []
  patterns:
    - "vitest vi.fn() mocks com createMockFastify para injeção de dependência"
    - "prisma.$transaction para atomicidade de creditTransaction.create + user.update"
key_files:
  created:
    - .planning/phases/08-finalizacao-pagamentos/08-01-SUMMARY.md
  modified:
    - apps/api/src/modules/credits/__tests__/credits.service.test.ts
decisions:
  - "RESOLVED (Open Question A2 — RESEARCH.md): creditUserBalance usa prisma.$transaction — risco de duplo crédito eliminado a nível de repository"
  - "CRED-06 CONFIRMADO: schema não possui campo de expiração em Payment/CreditTransaction — créditos não expiram por design"
  - "updatePaymentStatus chamado fora da $transaction de creditUserBalance — ver análise de risco residual em Deviations"
metrics:
  duration: "~15 minutos"
  completed: "2026-06-19T03:36:44Z"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 08 Plan 01: Auditoria de Ambiente Sandbox MP e Testes de Backend Summary

Auditoria de testes de backend e ambiente sandbox MP: suite de webhooks (15 testes) e credits (7 testes) completamente verdes; `creditUserBalance` usa `prisma.$transaction`; CRED-06 confirmado — créditos não expiram no schema.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Configurar credenciais MP sandbox e ngrok | (pelo usuário) | apps/api/.env, apps/web/.env |
| 2 | Auditar e completar testes de backend (webhooks + credits) | e92324c | apps/api/src/modules/credits/__tests__/credits.service.test.ts |

## Audit Results

### payments.repository.ts — Atomicidade ($transaction)

**RESOLVED: usa `prisma.$transaction`**

O método `creditUserBalance` usa `prisma.$transaction([...])` com duas operações atômicas:
1. `creditTransaction.create` — cria o registro imutável de movimentação de créditos
2. `user.update` com `{ creditBalance: { increment: quantity } }` — atualiza o saldo

**Risco residual (Open Question A2 — RESEARCH.md — FECHADO com nuance):**

A atomicidade dentro de `creditUserBalance` está garantida via `$transaction`. Porém, `updatePaymentStatus(paymentId, 'PAID')` é chamado em sequência separada no `WebhooksService.reconcilePayment` (linha 69), após o retorno de `creditUserBalance`. Isso significa:

- Se o processo morrer entre `creditUserBalance` (completo) e `updatePaymentStatus` (não executado), o pagamento ficará com status `PENDING` mesmo tendo créditos creditados.
- No próximo webhook do MP, `reconcilePayment` não encontrará `payment.status === 'PAID'` e chamará `creditUserBalance` novamente — **duplo crédito**.

A idempotência via `payment.status === 'PAID'` é a única proteção, e ela não cobre a janela entre as duas chamadas. Este é um risco residual real, mitigado na prática pela baixa probabilidade de processo morrer nessa janela e pela raridade de webhooks duplicados no MP com intervalo tão curto.

**Recomendação para fase futura:** Envolver `creditUserBalance` + `updatePaymentStatus` numa única `$transaction` no nível do serviço, ou incluir `updatePaymentStatus` dentro do array de `$transaction` em `creditUserBalance`.

### schema.prisma — CRED-06 (Expiração de Créditos)

**CRED-06 CONFIRMADO: schema não possui campo de expiração em Payment/CreditTransaction**

Modelos inspecionados:
- `model Payment` (coleção 14): campos `id`, `userId`, `amount`, `method`, `status`, `mercadoPagoId`, `comboId`, `customQuantity`, `createdAt`, `updatedAt` — **sem `expiresAt`**
- `model CreditTransaction` (coleção 6): campos `id`, `userId`, `type`, `quantity`, `referenceId`, `description`, `createdAt` — **sem `expiresAt`**

Nota: o enum `TransactionType` contém o valor `EXPIRY`, que representa uma transação de débito por expiração (ex: expirar créditos manualmente via operação administrativa), mas não implica TTL automático no schema — é apenas um tipo de movimentação registrável. Créditos não expiram automaticamente.

### Testes de Backend

#### webhooks.service.test.ts — 15/15 PASS

Casos de teste confirmados:

| Caso | Comportamento | Status |
|------|---------------|--------|
| validateSignature: assinatura inválida | retorna false | PASS |
| validateSignature: assinatura válida | retorna true | PASS |
| validateSignature: header ausente | retorna false | PASS |
| reconcilePayment: APROVADO (customQuantity=5) | credita 5 e marca PAID | PASS |
| reconcilePayment: APROVADO (combo quantity=30) | credita 30 e marca PAID | PASS |
| reconcilePayment: REJEITADO | não credita, marca FAILED | PASS |
| reconcilePayment: CANCELADO | não credita, marca FAILED | PASS |
| reconcilePayment: PENDENTE (in_process) | não credita, não altera status | PASS |
| reconcilePayment: idempotência (já PAID) | não consulta MP nem credita | PASS |
| reconcilePayment: pagamento inexistente | no-op | PASS |
| reconcilePayment: combo inexistente (sem quantity) | não credita | PASS |
| processPayment: payment.updated | dispara reconciliação | PASS |
| processPayment: payment.created | dispara reconciliação | PASS |
| processPayment: action não-pagamento | ignorada | PASS |
| processPayment: data.id ausente | ignorado | PASS |

#### credits.service.test.ts — 7/7 PASS

Casos de teste confirmados:

| Caso | Comportamento | Status |
|------|---------------|--------|
| getUnitPrice: avulso > melhor combo | avulsoUnit > bestComboUnitPrice | PASS |
| getUnitPrice: retorna valor correto | avulsoUnit = 1.75 | PASS |
| validateQuantity: rejeita >= avulsoLimite | erro status 400 | PASS |
| validateQuantity: aceita < avulsoLimite | resolve sem erro | PASS |
| validateQuantity: rejeita <= 0 | erro status 400 | PASS |
| getPricing: retorna avulsoLimite + avulsoUnit | valores corretos do banco | PASS (NOVO) |
| getPricing: fallback zeros | zeros quando settings ausentes | PASS (NOVO) |

### Acceptance Criteria Check

- [x] `npm test -- webhooks.service.test.ts` → PASS (15/15)
- [x] `npm test -- credits.service.test.ts` → PASS (7/7)
- [x] `grep -c "customQuantity" webhooks.service.test.ts` → 8 (>= 1)
- [x] `grep -c "creditTransaction\|toHaveBeenCalled" webhooks.service.test.ts` → 24 (>= 1)
- [x] Nenhum teste marcado como skip ou todo
- [x] SUMMARY documenta resultado de inspeção de payments.repository.ts
- [x] SUMMARY documenta resultado de inspeção do schema para CRED-06

## Deviations from Plan

### Auto-added Functionality

**1. [Rule 2 - Missing Coverage] Adicionar testes de getPricing em credits.service.test.ts**
- **Found during:** Task 2 — auditoria de credits.service.test.ts
- **Issue:** O arquivo existia mas não cobria `getPricing()`, que é um método usado pelos endpoints de compra
- **Fix:** Adicionado `describe('getPricing [CRED-04]')` com 2 casos de teste (retorno correto + fallback zeros)
- **Files modified:** `apps/api/src/modules/credits/__tests__/credits.service.test.ts`
- **Commit:** e92324c

### Not Changed (Intentional)

- `webhooks.service.test.ts` — já estava completo e verde; nenhuma modificação necessária
- `payments.repository.ts` — apenas inspecionado, não alterado conforme instrução do plano
- `apps/api/prisma/schema.prisma` — apenas inspecionado, não alterado conforme instrução do plano

## Known Stubs

Nenhum stub identificado nos arquivos modificados neste plano.

## Threat Flags

Nenhum novo surface de segurança introduzido — apenas auditoria e adição de testes.

## Self-Check: PASSED

- [x] `apps/api/src/modules/credits/__tests__/credits.service.test.ts` — FOUND e modificado
- [x] Commit e92324c — CONFIRMED em git log
- [x] 7 testes credits PASS, 15 testes webhooks PASS
- [x] SUMMARY.md criado em `.planning/phases/08-finalizacao-pagamentos/08-01-SUMMARY.md`
- [x] STATE.md e ROADMAP.md NÃO modificados (conforme instrução do orquestrador)
