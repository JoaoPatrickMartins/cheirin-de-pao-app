---
phase: 11-configura-es-e-perfil-do-cliente
plan: "01"
subsystem: auth, testing, database
tags: [prisma, otp, mongodb, vitest, backward-compat]

# Dependency graph
requires:
  - phase: 10-schema-v1-1-cr-dito-manual-admin-logout
    provides: schema v1.1 base com SavedCard, deliverySlots e campo days em Schedule
provides:
  - Campo purpose String? em OtpCode (schema Prisma) — backward-compat com documentos legados
  - findActiveOtp com filtro purpose: { in: [null, 'LOGIN'] } isolando OTPs de CONTACT_CHANGE
  - createOtp com parâmetro purpose?: string opcional
  - Stubs Wave 0: SettingsScreen.test.tsx, ContactEditScreen.test.tsx, client-profile.service.test.ts
affects:
  - 11-02 (client-profile module — usa purpose CONTACT_CHANGE ao criar OTPs)
  - 11-03 (ContactEditScreen — OTP de mudança de contato)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "OTP com purpose nullable: documentos legados (purpose=null) tratados como LOGIN via in: [null, 'LOGIN']"
    - "Stubs Wave 0 com it.todo() como placeholders para implementação em waves seguintes"

key-files:
  created:
    - apps/web/src/pages/client/__tests__/SettingsScreen.test.tsx
    - apps/web/src/pages/client/__tests__/ContactEditScreen.test.tsx
    - apps/api/src/modules/client-profile/__tests__/client-profile.service.test.ts
  modified:
    - apps/api/prisma/schema.prisma
    - apps/api/src/modules/auth/auth.repository.ts

key-decisions:
  - "D-18 aplicado: purpose: { in: [null, 'LOGIN'] } em findActiveOtp para backward-compat com documentos sem purpose"

patterns-established:
  - "Stubs Wave 0 com it.todo() como placeholders de teste para implementação nas waves seguintes"

requirements-completed:
  - CONF-04

# Metrics
duration: 8min
completed: "2026-06-19"
---

# Phase 11 Plan 01: OtpCode purpose + stubs Wave 0 Summary

**Campo `purpose String?` adicionado ao model OtpCode (schema Prisma) com filtro backward-compat em findActiveOtp para isolar OTPs de CONTACT_CHANGE do fluxo de login, e 3 stubs Wave 0 de teste criados**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-19T23:20:00Z
- **Completed:** 2026-06-19T23:28:16Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- OtpCode.purpose String? adicionado ao schema Prisma — documentos legados sem o campo retornam null, tratado como LOGIN
- findActiveOtp filtrado com `purpose: { in: [null, 'LOGIN'] }` — OTPs de CONTACT_CHANGE nunca passam por este filtro (D-18)
- createOtp aceita `purpose?: string` opcional para que client-profile possa criar OTPs CONTACT_CHANGE
- 3 stubs Wave 0 criados com it.todo() cobrindo CONF-02, 03, 04, 05, 06, 07 — passando em npx vitest run

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Adicionar purpose String? ao OtpCode + adaptar findActiveOtp** - `fa18242` (feat)
2. **Task 2: Stubs de teste Wave 0** - `ce97ceb` (test)

## Files Created/Modified

- `apps/api/prisma/schema.prisma` - Campo `purpose String?` adicionado ao model OtpCode após usedAt
- `apps/api/src/modules/auth/auth.repository.ts` - findActiveOtp com filtro backward-compat; createOtp com purpose?: string
- `apps/web/src/pages/client/__tests__/SettingsScreen.test.tsx` - Stub Wave 0 (CONF-02/03/05/07)
- `apps/web/src/pages/client/__tests__/ContactEditScreen.test.tsx` - Stub Wave 0 (CONF-04)
- `apps/api/src/modules/client-profile/__tests__/client-profile.service.test.ts` - Stub Wave 0 (CONF-02/03/04/05/06)

## Decisions Made

- D-18 aplicado: `purpose: { in: [null, 'LOGIN'] }` em findActiveOtp — documentos legados (null) continuam válidos para login sem necessidade de migração

## Deviations from Plan

None - plano executado exatamente como especificado.

## Issues Encountered

- `npm run test` (turbo) falhou na primeira execução por conflito de concorrência na compilação de arquivos dist (2 testes no dist/ com problema de compilação paralela). Execução direta via `npx vitest run` em cada app confirmou: 38 test files passando na API e 22 passando no web. Os 3 stubs novos estão incluídos e marcados como todo.

## Threat Surface Scan

Sem nova superfície de segurança além do já mapeado no threat_model do plano. O filtro `purpose: { in: [null, 'LOGIN'] }` implementa T-11-01-01 (Spoofing).

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

- Schema com purpose String? disponível para o módulo client-profile criar OTPs CONTACT_CHANGE (plano 11-02)
- Stubs Wave 0 criados como base para implementação incremental nas waves 2-5
- `npx prisma validate` passa sem erros

---
*Phase: 11-configura-es-e-perfil-do-cliente*
*Completed: 2026-06-19*
