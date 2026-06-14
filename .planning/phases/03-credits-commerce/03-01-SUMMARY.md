---
phase: 03-credits-commerce
plan: 01
subsystem: database, testing
tags: [prisma, mongodb, vitest, testing, mercadopago, credits, payments]

# Dependency graph
requires: []
provides:
  - "Prisma schema estendido com creditBalance, autoRecharge, cardTokenMp (User) e customQuantity (Payment)"
  - "8 arquivos de teste stub em estado RED cobrindo payments, webhooks, credits, UI e hooks"
  - "Variaveis MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, MP_PUBLIC_KEY documentadas em .env.example"
  - "VITE_MP_PUBLIC_KEY documentada em apps/web/.env.example"
affects: [03-02-payments-api, 03-03-credits-api, 03-04-combos-ui, 03-05-pix-flow, 03-06-polling]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stubs de teste em estado RED com expect(true).toBe(false) para garantir falha antes da implementacao"
    - "createMockFastify com overrides para mocks de Prisma em testes de service da API"
    - "vi.useFakeTimers() para testar hooks com setInterval/clearInterval"
    - "vi.mock('react-router-dom') parcial preservando implementacao original via importOriginal"

key-files:
  created:
    - apps/api/src/modules/payments/__tests__/payments.service.test.ts
    - apps/api/src/modules/webhooks/__tests__/webhooks.service.test.ts
    - apps/api/src/modules/credits/__tests__/credits.service.test.ts
    - apps/web/src/components/client/__tests__/QuantityStepper.test.tsx
    - apps/web/src/components/client/__tests__/ClientTabBar.test.tsx
    - apps/web/src/pages/client/__tests__/HomeScreen.test.tsx
    - apps/web/src/pages/client/__tests__/CombosScreen.test.tsx
    - apps/web/src/hooks/__tests__/usePaymentPolling.test.ts
  modified:
    - apps/api/prisma/schema.prisma
    - apps/api/.env.example
    - apps/web/.env.example

key-decisions:
  - "Stubs de teste usam expect(true).toBe(false) (nao it.todo) para garantir estado RED visivel nos reports de CI"
  - "Importacao de servicos comentada nos stubs para evitar erros de modulo nao encontrado antes da implementacao"
  - "VITE_MP_PUBLIC_KEY unica variavel MP permitida no .env.example do frontend — MP_ACCESS_TOKEN e MP_WEBHOOK_SECRET sao segredos backend-only"
  - "creditBalance e manipulado apenas via webhook service com $transaction atomico — nunca via request direto do cliente (T-03-01)"

patterns-established:
  - "Stubs RED: imports de implementacao ficam comentados nos arquivos de teste ate o modulo ser criado"
  - "Mock Fastify: createMockFastify() com spread overrides cobre todos os models Prisma necessarios"
  - "Frontend tests: vi.mock com importOriginal preserva MemoryRouter e outros exports do react-router-dom"

requirements-completed:
  - CRED-01
  - CRED-03
  - CRED-04
  - CRED-06
  - CRED-07
  - CRED-11
  - PAY-01
  - UI-07
  - UI-08
  - UI-04

# Metrics
duration: 15min
completed: 2026-06-14
---

# Phase 3 Plan 01: Wave 0 Foundation Summary

**Prisma schema estendido com campos de creditos/pagamentos MP e 8 stubs de teste RED cobrindo toda a Wave 1-3 da Fase 3**

## Performance

- **Duration:** 15 min
- **Started:** 2026-06-14T00:00:00Z
- **Completed:** 2026-06-14T00:15:00Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Schema Prisma estendido com 4 novos campos: `creditBalance Int @default(0)`, `autoRecharge Json?`, `cardTokenMp String?` no model User e `customQuantity Int?` no model Payment — `prisma generate` executado sem erros
- Variaveis de ambiente do Mercado Pago documentadas em `.env.example` (API: MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, MP_PUBLIC_KEY; Web: VITE_MP_PUBLIC_KEY apenas)
- 8 stubs de teste em estado RED criados cobrindo: PaymentsService (CRED-01, CRED-11), WebhooksService (PAY-01, T-03-01), CreditsService (CRED-03, CRED-04), QuantityStepper (UI-07), ClientTabBar (UI-08), HomeScreen (UI-04, CRED-11), CombosScreen (CRED-01 navigate state camelCase), usePaymentPolling (cleanup + MAX_ATTEMPTS)

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Estender schema Prisma + prisma generate + atualizar .env.example** - `35ac50c` (feat)
2. **Task 2: Criar stubs de teste Wave 0 (API + Web)** - `a5ee725` (test)

## Files Created/Modified

- `apps/api/prisma/schema.prisma` - Campos creditBalance, autoRecharge, cardTokenMp, customQuantity adicionados
- `apps/api/.env.example` - Secao Mercado Pago com MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, MP_PUBLIC_KEY
- `apps/web/.env.example` - VITE_MP_PUBLIC_KEY adicionada (unica variavel MP segura para bundle Vite)
- `apps/api/src/modules/payments/__tests__/payments.service.test.ts` - Stubs CRED-01 + CRED-11
- `apps/api/src/modules/webhooks/__tests__/webhooks.service.test.ts` - Stubs PAY-01 HMAC + idempotencia
- `apps/api/src/modules/credits/__tests__/credits.service.test.ts` - Stubs CRED-03 + CRED-04
- `apps/web/src/components/client/__tests__/QuantityStepper.test.tsx` - Stubs UI-07
- `apps/web/src/components/client/__tests__/ClientTabBar.test.tsx` - Stubs UI-08
- `apps/web/src/pages/client/__tests__/HomeScreen.test.tsx` - Stubs UI-04 + CRED-11
- `apps/web/src/pages/client/__tests__/CombosScreen.test.tsx` - Stubs CRED-01 navigate state camelCase
- `apps/web/src/hooks/__tests__/usePaymentPolling.test.ts` - Stubs cleanup clearInterval + MAX_ATTEMPTS=5

## Decisions Made

- Stubs usam `expect(true).toBe(false)` em vez de `it.todo` para que apareçam como FAIL (nao como SKIP/TODO) nos reports de CI, garantindo visibilidade do estado RED
- Imports de servicos ficam comentados nos stubs porque os arquivos de implementacao (`payments.service.ts`, etc.) nao existem ainda — evita erros de modulo ao rodar os testes agora
- `VITE_MP_PUBLIC_KEY` e a unica variavel MP no .env.example do frontend — `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` sao segredos que nunca devem entrar no bundle Vite

## Deviations from Plan

None - plano executado exatamente como especificado. Task 1 estava completa do commit anterior (35ac50c); Task 2 completada neste ciclo de execucao.

## Issues Encountered

- O arquivo `apps/api/src/modules/payments/__tests__/payments.service.test.ts` existia no repo principal como arquivo untracked mas nao estava presente no worktree apos o reset para 35ac50c. Solucao: criado novamente no worktree com o mesmo conteudo do arquivo original do repo principal.

## Known Stubs

Todos os 8 arquivos de teste sao intencionalmente stubs (estado RED). Cada `it('TODO: ...', () => { expect(true).toBe(false) })` sera preenchido com implementacao real nos planos 02-06 da Fase 3:

- `payments.service.test.ts` — implementado no plano 03-02
- `webhooks.service.test.ts` — implementado no plano 03-02
- `credits.service.test.ts` — implementado no plano 03-03
- `QuantityStepper.test.tsx` — implementado no plano 03-04
- `ClientTabBar.test.tsx` — implementado no plano 03-04
- `HomeScreen.test.tsx` — implementado no plano 03-05
- `CombosScreen.test.tsx` — implementado no plano 03-04
- `usePaymentPolling.test.ts` — implementado no plano 03-05

## Next Phase Readiness

- Schema Prisma com todos os campos necessarios para Fase 3 — planos 02-06 podem comecar
- 8 arquivos de teste em estado RED prontos para serem preenchidos com implementacao
- Variaveis de ambiente documentadas — desenvolvedor pode configurar credenciais MP antes de iniciar plano 02
- Nenhum bloqueador pendente para Wave 1

---
*Phase: 03-credits-commerce*
*Completed: 2026-06-14*
