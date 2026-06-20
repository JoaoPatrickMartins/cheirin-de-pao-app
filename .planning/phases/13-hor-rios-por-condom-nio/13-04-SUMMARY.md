---
phase: 13-hor-rios-por-condom-nio
plan: "04"
subsystem: frontend
tags: [delivery-slots, schedule, dynamic-data, react]
dependency_graph:
  requires: [13-02, 13-03]
  provides: [frontend-slots-integration]
  affects: [ScheduleScreen, DeliveryTimeChips]
tech_stack:
  added: []
  patterns: [apiFetch, useEffect-on-mount, exported-interface]
key_files:
  created: []
  modified:
    - apps/web/src/components/client/DeliveryTimeChips.tsx
    - apps/web/src/pages/client/ScheduleScreen.tsx
decisions:
  - "DeliverySlot interface exportada de DeliveryTimeChips para reutilização na ScheduleScreen"
  - "Erro de fetch silenciado via console.warn — tela não trava com slots vazio"
  - "Erros pré-existentes no apps/api (CustomerCardGetRemoveData) documentados como diferidos — fora do escopo desta task"
metrics:
  duration: "~10 min"
  completed: "2026-06-19"
  tasks_completed: 2
  files_modified: 2
---

# Phase 13 Plan 04: Frontend dinâmico — DeliveryTimeChips + ScheduleScreen Summary

DeliveryTimeChips migrado de array hardcoded para prop `slots: DeliverySlot[]`; ScheduleScreen busca `GET /client/condominium/slots` na montagem e passa dados ao componente.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Refatorar DeliveryTimeChips para aceitar slots[] | 930c31a | DeliveryTimeChips.tsx |
| 2 | Integrar busca de slots na ScheduleScreen | 530659b | ScheduleScreen.tsx |

## What Was Built

### Task 1 — DeliveryTimeChips

- Removida constante `DELIVERY_TIMES = ['06:30', '07:00', '07:30', '08:00']` hardcoded
- Adicionada e exportada interface `DeliverySlot` com campos `name`, `time`, `cutoffTime`, `isActive`
- Props atualizadas: `slots: DeliverySlot[]` adicionada
- `.map` migrado de `DELIVERY_TIMES.map((time) => ...)` para `slots.map((slot) => ...)` usando `slot.time` como valor exibido e `slot.name` como key
- Estilo visual 100% preservado: `borderRadius: 13`, cores, padding, tipografia idênticos ao handoff
- Array vazio renderiza container sem chips (sem crash)

### Task 2 — ScheduleScreen

- Importações adicionadas: `useEffect`, `DeliverySlot` de DeliveryTimeChips, `apiFetch` de lib
- Estado `slots: DeliverySlot[]` inicializado como `[]`
- `useEffect` com deps `[]` busca `GET /client/condominium/slots` na montagem:
  - Sucesso: `setSlots(data)`
  - Erro (rede ou HTTP não-ok): `console.warn` + estado permanece `[]`
- `<DeliveryTimeChips>` recebe `slots={slots}`
- Nenhuma outra lógica da ScheduleScreen alterada

## Deviations from Plan

None — plano executado exatamente como escrito.

## Known Stubs

None — os slots são dados reais vindos da API. Se a API retornar array vazio (nenhum slot ativo no condomínio), nenhum chip é exibido — comportamento intencional e tratado no componente.

## Deferred Items

**Erros pré-existentes no apps/api** (fora do escopo desta task):
- `apps/api/src/modules/payments/payments.service.ts(237)` — `CustomerCardGetRemoveData` não aceita `id`
- `apps/api/src/modules/saved-cards/saved-cards.service.ts(89)` — mesmo tipo

Estes erros existiam antes desta task. O build do `apps/web` compila sem erros TypeScript.

## Threat Flags

None — nenhuma nova superfície de rede ou auth introduzida. O endpoint `GET /client/condominium/slots` já estava protegido por JWT (implementado na wave 2, plano 13-03).

## Self-Check: PASSED

- [x] `apps/web/src/components/client/DeliveryTimeChips.tsx` — existe, DELIVERY_TIMES removido, DeliverySlot exportado
- [x] `apps/web/src/pages/client/ScheduleScreen.tsx` — existe, busca /client/condominium/slots, passa slots={slots}
- [x] Commit 930c31a — feat(13-04): refatorar DeliveryTimeChips
- [x] Commit 530659b — feat(13-04): integrar busca de slots na ScheduleScreen
- [x] Build apps/web — 185 modules transformados, sem erros TypeScript
