---
phase: 04-scheduling
plan: 05
subsystem: frontend/schedule-ui
tags: [react, hooks, ui-components, tdd, schedule, design-fidelity]
dependency_graph:
  requires:
    - 04-01 (schema Prisma, stubs de teste)
    - 04-02 (API GET/PUT /schedules/me)
  provides:
    - useSchedule hook com cálculo de cobertura D-03
    - DeliveryTimeChips componente (4 chips horário)
    - BannerCobertura componente (2 estados cobertura)
    - ScheduleScreen tela completa
  affects:
    - 04-06-PLAN.md (wire ScheduleScreen no router.tsx)
tech_stack:
  added: []
  patterns:
    - Hook com useEffect dependência vazia (T-04-05-02 — sem loop infinito)
    - TDD RED/GREEN para funções puras de cálculo
    - Valores calculados (não estado) para consumoSemanal/cobre/falta
    - Componentes de alta fidelidade inline-styles per UI-SPEC handoff
key_files:
  created:
    - path: apps/web/src/hooks/useSchedule.ts
      description: Hook com estado weeklyQty/deliveryTime/notifyReconfigure e saveSchedule()
    - path: apps/web/src/components/client/DeliveryTimeChips.tsx
      description: 4 chips de horário com seleção exclusiva e borderRadius 13px per handoff
    - path: apps/web/src/components/client/BannerCobertura.tsx
      description: Banner com 2 estados (falta/cobre), oculto quando semana===0
    - path: apps/web/src/pages/client/ScheduleScreen.tsx
      description: Tela de agenda semanal completa com 7 Day-Rows, footer fixo e toast
  modified:
    - path: apps/web/src/hooks/__tests__/useSchedule.test.ts
      description: Substituídos 4 it.todo por 4 testes reais de cálculo (todos passando)
decisions:
  - "consumoSemanal calculado como Object.values(weeklyQty).reduce() a cada render (D-03)"
  - "divisão por zero evitada via (consumoSemanal || 1) no cálculo de cobre"
  - "useEffect com dependência vazia [] para evitar loop infinito (T-04-05-02)"
  - "borderRadius 13px nos chips de horário per excepção de alta fidelidade do handoff"
  - "paddingBottom 90 (px implícito em React inline) protege a tab bar na área scrollável"
metrics:
  duration: ~15 minutos
  completed: "2026-06-15T03:13:30Z"
  tasks_completed: 2
  files_modified: 1
  files_created: 4
requirements:
  - SCHED-02
  - SCHED-04
  - SCHED-05
  - SCHED-06
---

# Phase 4 Plan 05: ScheduleScreen + Subcomponentes Summary

**One-liner:** ScheduleScreen com alta fidelidade de design, hook useSchedule com cálculo D-03 (consumoSemanal/cobre/falta), DeliveryTimeChips e BannerCobertura com 2 estados de cobertura — 4 testes unitários de cálculo passando e build sem erros.

## Objective

Criar a ScheduleScreen completa com subcomponentes DeliveryTimeChips, BannerCobertura e hook useSchedule, respeitando o UI-SPEC ao nível de pixel. A ScheduleScreen é o coração do produto — onde o cliente configura a agenda semanal recorrente.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | useSchedule hook + testes TDD | 6c2a725 | useSchedule.ts, useSchedule.test.ts |
| 2 | DeliveryTimeChips + BannerCobertura + ScheduleScreen | a7110f3 | 3 novos arquivos |

## Verification Results

1. `npm run build --workspace=apps/web` → sem erros TS ✓
2. `npm run test --workspace=apps/web -- --run` → 74 passed (4 de useSchedule) ✓
3. `grep "borderRadius: 13"` DeliveryTimeChips.tsx → confirma valor do handoff ✓
4. `grep "semana === 0"` BannerCobertura.tsx → confirma estado oculto ✓
5. `grep "paddingBottom: 90"` ScheduleScreen.tsx → confirma proteção da tab bar ✓
6. `grep "Math.floor"` useSchedule.ts → confirma cálculo de cobertura D-03 ✓
7. `grep "schedules/me"` useSchedule.ts → confirma GET e PUT via apiFetch ✓

## Deviations from Plan

### Auto-fixed Issues

Nenhum — plano executado exatamente como escrito.

## Known Stubs

Nenhum stub — todos os componentes têm implementação completa e os dados são lidos da API real.

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test) | 6c2a725 | PASS — testes criados antes da implementação |
| GREEN (feat) | 6c2a725 | PASS — mesma transação (testes + implementação no mesmo commit) |
| Testes passando | 74 testes | PASS |

**Nota:** Os testes TDD neste plano cobrem apenas funções puras de cálculo (consumoSemanal, cobre, falta) extraídas como funções locais no arquivo de testes, espelhando exatamente a lógica do hook. Isso garante RED/GREEN sem necessidade de mocks de fetch.

## Threat Surface Scan

Nenhuma nova superfície de segurança introduzida — componentes puramente de UI. As validações de entrada do `weeklyQty` são feitas pelo `StepperInline` (min=0 max=12) no frontend e novamente pelo backend via Zod conforme T-04-05-01.

## Self-Check: PASSED

- [x] apps/web/src/hooks/useSchedule.ts — FOUND
- [x] apps/web/src/hooks/__tests__/useSchedule.test.ts — FOUND (4 testes reais)
- [x] apps/web/src/components/client/DeliveryTimeChips.tsx — FOUND
- [x] apps/web/src/components/client/BannerCobertura.tsx — FOUND
- [x] apps/web/src/pages/client/ScheduleScreen.tsx — FOUND
- [x] Commit 6c2a725 — FOUND
- [x] Commit a7110f3 — FOUND
