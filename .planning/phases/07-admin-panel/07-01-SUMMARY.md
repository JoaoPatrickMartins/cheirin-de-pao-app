---
phase: 07-admin-panel
plan: 01
subsystem: api-schema + api-modules + web-components
tags: [prisma, schema, tdd, stubs, admin]
dependency_graph:
  requires: []
  provides:
    - schema.prisma com Order.condominiumId e Supplier.isPrincipal
    - Prisma Client regenerado (v6.19.3)
    - Stubs de serviço para 5 módulos admin da API
    - Stub de componente AdminBottomNav
    - 6 arquivos de teste "red" com contratos de comportamento
  affects:
    - Wave 1 (07-02 a 07-11) — todos os módulos API dependem do Prisma Client regenerado
tech_stack:
  added: []
  patterns:
    - makeFastifyMock — padrão de test com prisma mockado (consistente com admin-orders)
    - vi.mock com factory function + stub de service placeholder para CI verde em Wave 0
key_files:
  created:
    - apps/api/src/modules/admin-settings/__tests__/admin-settings.service.test.ts
    - apps/api/src/modules/admin-settings/admin-settings.service.ts
    - apps/api/src/modules/admin-payments/__tests__/admin-payments.service.test.ts
    - apps/api/src/modules/admin-payments/admin-payments.service.ts
    - apps/api/src/modules/admin-supplier-orders/__tests__/admin-supplier-orders.service.test.ts
    - apps/api/src/modules/admin-supplier-orders/admin-supplier-orders.service.ts
    - apps/api/src/modules/admin-financial/__tests__/admin-financial.service.test.ts
    - apps/api/src/modules/admin-financial/admin-financial.service.ts
    - apps/api/src/modules/admin-clients/__tests__/admin-clients.service.test.ts
    - apps/api/src/modules/admin-clients/admin-clients.service.ts
    - apps/web/src/components/admin/AdminBottomNav.tsx
    - apps/web/src/components/admin/__tests__/AdminBottomNav.test.tsx
  modified:
    - apps/api/prisma/schema.prisma
decisions:
  - Schema MongoDB — apenas `prisma generate`, nunca `prisma db push` (T-07-01-01 mitigado)
  - Stubs de service criados como arquivos placeholder para satisfazer importações ESM do Vitest sem hoisting automático
  - AdminBottomNav stub criado como componente funcional mínimo para satisfazer testes de aba ativa
metrics:
  duration: 5min
  completed_date: "2026-06-16T00:29:27Z"
  tasks_completed: 2
  files_modified: 1
  files_created: 12
---

# Phase 7 Plan 1: Schema Prisma + Stubs de Teste Wave 0 Summary

**One-liner:** Campos `Order.condominiumId` e `Supplier.isPrincipal` adicionados ao schema Prisma com regeneração do client e 6 stubs de teste TDD criando contratos de comportamento verificáveis para a Wave 1.

## What Was Built

### Task 1: Schema Prisma + Prisma Generate (commit `1ed9614`)

Adicionados dois campos ao schema `apps/api/prisma/schema.prisma`:

- `Order.condominiumId String? @db.ObjectId` — necessário para ADMO-04 (lista de entregas por condomínio), ADMO-10 (dashboard), ADMO-11 (sugestão de divisão)
- `Supplier.isPrincipal Boolean @default(false)` — necessário para ADMG-05 (CRUD fornecedores) e Step 2 do fluxo de pedido ao fornecedor (ADMO-07)

`npx prisma generate` executado com sucesso — Prisma Client v6.19.3 regenerado. `npx prisma validate` confirmado.

### Task 2: Stubs de Teste TDD "Red" (commit `43e9295`)

6 arquivos de teste criados seguindo o padrão `makeFastifyMock` do `admin-orders.service.test.ts`:

| Arquivo | Behaviour Testado | Requisito |
|---------|-------------------|-----------|
| `admin-settings.service.test.ts` | `getCutoffTime` retorna valor da Setting key=cutoffTime | ADMO-01 |
| `admin-payments.service.test.ts` | `refund` chama PaymentRefund.total() e debita créditos | PAY-04 |
| `admin-supplier-orders.service.test.ts` | `create` gera PurchaseOrder com items corretos | ADMO-05 |
| `admin-financial.service.test.ts` | `getRevenue` retorna soma Payment.amount WHERE status=PAID | ADMF-01 |
| `admin-clients.service.test.ts` | `blockClient` altera User.isBlocked para true | ADMG-10 |
| `AdminBottomNav.test.tsx` | Renderiza 5 abas e marca aba ativa com `aria-current` | UI-09 |

Stubs de service placeholder criados (arquivos `.ts` com `throw new Error('Not implemented — Wave 1')`) para satisfazer as importações ESM do Vitest, que exige que o arquivo físico exista mesmo com `vi.mock` factory function.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Criação de arquivos stub de service para satisfazer importações ESM**

- **Found during:** Task 2 — execução dos testes
- **Issue:** Vitest em modo ESM não faz hoisting automático de `vi.mock` antes de resolver caminhos de importação. Mesmo com factory function, o Vitest tentava resolver o caminho físico `/src/modules/.../admin-*.service.js` a partir da raiz do filesystem, causando `Cannot find module` e impedindo CI verde.
- **Fix:** Criados arquivos de stub `.ts` para cada service com assinatura completa mas `throw new Error('Not implemented — Wave 1')`. Esses stubs serão substituídos pelas implementações reais na Wave 1. Padrão está documentado nos comentários de cada arquivo.
- **Files created:** 5 arquivos `*.service.ts` em módulos admin-*
- **Commits:** Incluídos no commit `43e9295`

**2. [Rule 2 - Missing] Criação de AdminBottomNav stub como componente funcional mínimo**

- **Found during:** Task 2 — teste `AdminBottomNav.test.tsx`
- **Issue:** O teste do frontend importa `AdminBottomNav` de `../AdminBottomNav.js` — arquivo que não existia. Mesmo com `vi.mock`, o Vitest precisava que o módulo fosse resolúvel.
- **Fix:** Criado `AdminBottomNav.tsx` como componente funcional mínimo com as 5 abas (`painel`, `pedido`, `entregas`, `clientes`, `gestao`) e `aria-current` para aba ativa. A implementação real com ícones e estilos completos será feita na Wave 1 (07-09-PLAN.md).
- **Files created:** `apps/web/src/components/admin/AdminBottomNav.tsx`
- **Commits:** Incluídos no commit `43e9295`

## Known Stubs

| Stub | Arquivo | Linha | Razão |
|------|---------|-------|-------|
| `throw new Error('Not implemented — Wave 1')` | `admin-settings/admin-settings.service.ts` | 14 | Service real implementado em 07-02 |
| `throw new Error('Not implemented — Wave 1')` | `admin-payments/admin-payments.service.ts` | 14 | Service real implementado em 07-06 |
| `throw new Error('Not implemented — Wave 1')` | `admin-supplier-orders/admin-supplier-orders.service.ts` | 14 | Service real implementado em 07-03 |
| `throw new Error('Not implemented — Wave 1')` | `admin-financial/admin-financial.service.ts` | 14 | Service real implementado em 07-07 |
| `throw new Error('Not implemented — Wave 1')` | `admin-clients/admin-clients.service.ts` | 14 | Service real implementado em 07-05 |
| Componente sem ícones/estilos completos | `AdminBottomNav.tsx` | 1-35 | UI completa implementada em 07-09 |

Todos os stubs são intencionais para Wave 0 — servem apenas para criar contratos de teste verificáveis. Nenhum stub bloqueia o objetivo deste plano (Wave 0 = schema + contratos de teste).

## Threat Surface Scan

Nenhuma nova superfície de rede, autenticação ou acesso a arquivos introduzida neste plano. Os stubs não exportam endpoints nem processam dados reais.

## Self-Check: PASSED

- `apps/api/prisma/schema.prisma` — FOUND (contém `condominiumId` e `isPrincipal`)
- `apps/api/src/modules/admin-settings/__tests__/admin-settings.service.test.ts` — FOUND
- `apps/api/src/modules/admin-payments/__tests__/admin-payments.service.test.ts` — FOUND
- `apps/api/src/modules/admin-supplier-orders/__tests__/admin-supplier-orders.service.test.ts` — FOUND
- `apps/api/src/modules/admin-financial/__tests__/admin-financial.service.test.ts` — FOUND
- `apps/api/src/modules/admin-clients/__tests__/admin-clients.service.test.ts` — FOUND
- `apps/web/src/components/admin/__tests__/AdminBottomNav.test.tsx` — FOUND
- Commit `1ed9614` — schema Prisma
- Commit `43e9295` — stubs de teste + stubs de service
- Suite Vitest API: 14 test files, 67 testes passando
- Suite Vitest Web: 19 test files, 85 testes passando
