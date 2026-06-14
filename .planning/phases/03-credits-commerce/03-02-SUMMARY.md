---
phase: 03-credits-commerce
plan: 02
subsystem: payments, api
tags: [mercadopago, fastify, prisma, zod, payments, credits, pix, typescript]

# Dependency graph
requires:
  - phase: 03-01
    provides: "Prisma schema com creditBalance/autoRecharge/cardTokenMp e stubs de teste RED"
provides:
  - "PaymentsService.createPix — integração com MP SDK, retorna qr_code_base64 + qr_code + paymentId"
  - "PaymentsService.createCard — tokenização via Brick MP, retorna paymentId"
  - "PaymentsService.getStatus — lê banco local (nunca chama MP), retorna status + creditBalance quando PAID"
  - "PaymentsRepository com createPayment, findPaymentById, updatePaymentStatus, findPaymentByMercadoPagoId, creditUserBalance via $transaction"
  - "CreditsService.listCombos, getPricing, getCreditHistory, validateCustomPurchase, checkBalance"
  - "paymentsRoute: POST /payments/pix, POST /payments/card, GET /payments/:id/status — todos autenticados"
  - "creditsRoute: GET /combos, GET /pricing, GET /credits/history, PUT /users/me/auto-recharge, PUT /users/me/card-token — todos autenticados"
  - "Zod schemas: CreatePixPaymentSchema, CreateCardPaymentSchema, AutoRechargeSchema, CardTokenSchema"
affects: [03-03-webhooks, 03-04-combos-ui, 03-05-pix-flow, 03-06-card-payment]

# Tech tracking
tech-stack:
  added:
    - "mercadopago 3.1.0 — SDK Node.js oficial MP (npm install --workspace=apps/api)"
  patterns:
    - "PaymentsService instancia MercadoPagoConfig + Payment no constructor (não como singletons globais)"
    - "getStatus lê apenas o banco local — nunca chama MP API (polling-safe)"
    - "createPix/createCard nunca creditam créditos — apenas criam Payment{PENDING} (D-02)"
    - "creditUserBalance usa prisma.$transaction([creditTransaction.create, user.update]) para atomicidade"
    - "payer.email fallback: user.email ?? \`${user.id}@cheirin.app\` para usuários sem email"

key-files:
  created:
    - apps/api/src/modules/payments/payments.schema.ts
    - apps/api/src/modules/payments/payments.repository.ts
    - apps/api/src/modules/payments/payments.service.ts
    - apps/api/src/modules/payments/payments.controller.ts
    - apps/api/src/modules/payments/payments.route.ts
    - apps/api/src/modules/credits/credits.schema.ts
    - apps/api/src/modules/credits/credits.repository.ts
    - apps/api/src/modules/credits/credits.service.ts
    - apps/api/src/modules/credits/credits.controller.ts
    - apps/api/src/modules/credits/credits.route.ts
  modified:
    - apps/api/src/modules/payments/__tests__/payments.service.test.ts
    - apps/api/src/modules/credits/__tests__/credits.service.test.ts

key-decisions:
  - "getStatus NUNCA chama MP API — lê apenas Payment.status no banco local para segurança e performance"
  - "Nenhum crédito creditado em createPix/createCard — Payment{PENDING} apenas; webhook (plano 03) credita"
  - "creditUserBalance usa prisma.$transaction atômico para evitar crédito parcial em caso de falha"
  - "Módulos NÃO registrados em server.ts — isso ocorre no plano 03 após webhook estar pronto"
  - "cardTokenMp salvo no user.update dentro de createCard para futuras cobranças automáticas (D-06)"

patterns-established:
  - "Módulo Fastify: route.ts (preHandler: [fastify.authenticate]) + controller.ts (two-try-catch) + service.ts + repository.ts"
  - "Mock mercadopago em testes: class-based mocks (não vi.fn()) para Payment e MercadoPagoConfig"
  - "Erro estruturado retornado de service: { error: string, status: number } — controller verifica 'error' in err"

requirements-completed:
  - CRED-01
  - CRED-02
  - CRED-03
  - CRED-04
  - CRED-05
  - CRED-07
  - CRED-08
  - CRED-10
  - CRED-11
  - PAY-01
  - PAY-02

# Metrics
duration: 6min
completed: 2026-06-14
---

# Phase 3 Plan 02: Payments API + Credits API Summary

**Módulos Fastify payments e credits com 10 arquivos TypeScript — integração MP SDK, Pix/cartão PENDING-only, validação avulso, PUT auto-recharge e card-token — 11 tests GREEN**

## Performance

- **Duration:** 6 min
- **Started:** 2026-06-14T15:58:55Z
- **Completed:** 2026-06-14T16:05:15Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Módulo payments completo: 5 arquivos TypeScript (schema, repository, service, controller, route) — integração com mercadopago SDK v3, POST /payments/pix retorna qr_code_base64 + qr_code, POST /payments/card retorna paymentId, GET /payments/:id/status lê banco local sem chamar MP
- Módulo credits completo: 5 arquivos TypeScript (schema, repository, service, controller, route) — GET /combos, GET /pricing, GET /credits/history, PUT /users/me/auto-recharge, PUT /users/me/card-token
- 11 testes GREEN: 6 de PaymentsService (createPix cria PENDING, retorna qr_code_base64/qr_code/paymentId; getStatus pending/approved/rejected) + 5 de CreditsService (validateCustomPurchase rejeita >= avulsoLimite e <= 0; aceita < avulsoLimite; getUnitPrice avulsoUnit > melhorComboUnit)
- Segurança por design: nenhum crédito adicionado em createPix/createCard (D-02); transaction_amount calculado no servidor a partir do banco (T-03-02); MP_ACCESS_TOKEN permanece no backend (T-03-05)

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Módulo payments — schema Zod + repository + service** - `05dedc8` (feat)
2. **Task 2: Módulo credits completo + payments route/controller** - `3a562a1` (feat)

**Plan metadata:** _committed after this SUMMARY_

_Note: TDD — stubs RED existiam do plano 01; testes GREEN confirmados antes do commit de cada task_

## Files Created/Modified

- `apps/api/src/modules/payments/payments.schema.ts` — CreatePixPaymentSchema (comboId|customQuantity refine) e CreateCardPaymentSchema (token obrigatório + comboId|customQuantity refine)
- `apps/api/src/modules/payments/payments.repository.ts` — 5 métodos: createPayment, findPaymentById, updatePaymentStatus, findPaymentByMercadoPagoId, creditUserBalance com $transaction
- `apps/api/src/modules/payments/payments.service.ts` — createPix (MercadoPagoConfig + Payment no constructor, retorna qr_code_base64), createCard (retorna paymentId, salva cardTokenMp), getStatus (lê banco, mapa PENDING→pending/PAID→approved/FAILED→rejected)
- `apps/api/src/modules/payments/payments.controller.ts` — two-try-catch por método, valida schemas Zod, extrai userId de request.user!.id
- `apps/api/src/modules/payments/payments.route.ts` — POST /payments/pix, POST /payments/card, GET /payments/:id/status com preHandler: [fastify.authenticate]
- `apps/api/src/modules/credits/credits.schema.ts` — BuyCustomSchema, AutoRechargeSchema (mode/weekday/comboId), CardTokenSchema
- `apps/api/src/modules/credits/credits.repository.ts` — listActiveCombos, getSettingByKey, getSettingsByKeys, getCreditHistory, getUserById, updateUser
- `apps/api/src/modules/credits/credits.service.ts` — listCombos, getPricing, getCreditHistory, validateCustomPurchase, getUnitPrice, checkBalance
- `apps/api/src/modules/credits/credits.controller.ts` — listCombos, getPricing, getCreditHistory, updateAutoRecharge (prisma.user.update autoRecharge), updateCardToken (prisma.user.update cardTokenMp)
- `apps/api/src/modules/credits/credits.route.ts` — 5 rotas com preHandler authenticate: GET /combos, GET /pricing, GET /credits/history, PUT /users/me/auto-recharge, PUT /users/me/card-token
- `apps/api/src/modules/payments/__tests__/payments.service.test.ts` — 6 testes GREEN com class-based mocks para MercadoPagoConfig + Payment
- `apps/api/src/modules/credits/__tests__/credits.service.test.ts` — 5 testes GREEN para validateCustomPurchase e getUnitPrice

## Decisions Made

- Mock de mercadopago nos testes usa classes ES6 (não `vi.fn()`) porque `new Payment(client)` exige um construtor: `class MockPayment { create = mockPaymentCreate }`. Isso foi necessário porque a abordagem `vi.fn(() => ({ create: mockCreate }))` cria uma arrow function, não um construtor.
- `getStatus` retorna `{ status: 'approved', creditBalance }` quando Payment.status === 'PAID' para que o frontend possa atualizar o saldo via polling sem um endpoint `/me` separado (Open Question 1 do RESEARCH.md).
- Módulos não registrados em `server.ts` — confirmado pela instrução do plano que o registro ocorre no plano 03 após o módulo webhooks estar pronto.

## Deviations from Plan

None — plano executado exatamente como especificado.

O único ajuste de implementação foi no mock de testes (abordagem class-based em vez de vi.fn()), que foi necessário para que o `new Payment(client)` no constructor do PaymentsService funcionasse corretamente nos testes.

## Issues Encountered

- Mock de `mercadopago` com `vi.fn()` falhou com `TypeError: () => ({ create: mockCreate }) is not a constructor` — resolvido usando classes ES6 no mock factory de `vi.mock()`.
- `npm run test --workspace=apps/api` executado a partir do root do monorepo roda os testes do **repo principal**, não do worktree. Solução: rodar testes com `npx vitest run` diretamente do diretório `apps/api` do worktree.

## User Setup Required

Nenhuma configuração manual necessária neste plano. Os módulos não estão registrados em server.ts ainda.

Nota: `MP_ACCESS_TOKEN` deve estar configurado no `.env` antes de usar os endpoints em produção/desenvolvimento. Ver `apps/api/.env.example` para referência.

## Next Phase Readiness

- Plano 03 pode registrar `paymentsRoute` e `creditsRoute` em `server.ts` e criar o módulo webhooks
- `PaymentsRepository.creditUserBalance` está pronto para ser chamado pelo WebhooksService após aprovação de pagamento
- `PaymentsRepository.findPaymentByMercadoPagoId` está disponível para verificar idempotência no webhook
- `CreditsService.validateCustomPurchase` disponível para uso no endpoint de compra personalizada
- 6 stubs de webhook (`webhooks.service.test.ts`) permanecem RED e serão implementados no plano 03

---
*Phase: 03-credits-commerce*
*Completed: 2026-06-14*
