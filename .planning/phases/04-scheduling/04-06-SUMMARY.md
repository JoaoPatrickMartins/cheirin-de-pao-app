---
phase: 04-scheduling
plan: 06
subsystem: frontend/single-order-ui
tags: [react, ui-components, onesignal, router, design-fidelity, push-notifications]
dependency_graph:
  requires:
    - 04-03 (POST /orders backend endpoint)
    - 04-05 (ScheduleScreen + useSchedule hook)
  provides:
    - DateChips componente (chips de data com corte 21h, input nativo, min/max 30 dias)
    - SingleScreen tela completa (QuantityStepper, BannerInsuficiente, CreditCard, footer fixo)
    - router /client/agenda → ScheduleScreen (aba Agenda funcional)
    - router /client/agenda/pedido-unico → SingleScreen
    - useOneSignalRegister hook (registra player_id via POST /users/push-token)
  affects:
    - Fase 5 (push notifications — player_id registrado via useOneSignalRegister)
tech_stack:
  added: []
  patterns:
    - Input nativo type=date com min/max via ref (D-04, D-06)
    - CUTOFF_HOUR constante para lógica de corte às 21h (D-05)
    - useEffect com cleanup de addEventListener (T-04-06-04)
    - Lazy import de rotas via react-router
    - warn === accent no tema claro (mesmo #B0702A para ambos os estados do stepper)
key_files:
  created:
    - path: apps/web/src/components/client/DateChips.tsx
      description: Chips de data com Amanhã/Depois de amanhã/Outra data, CUTOFF_HOUR=21, input nativo com min/max
    - path: apps/web/src/pages/client/SingleScreen.tsx
      description: Tela de pedido único com QuantityStepper min=1/max=20, DateChips, BannerInsuficiente e CreditCard
    - path: apps/web/src/hooks/useOneSignalRegister.ts
      description: Hook que registra player_id do OneSignal via POST /users/push-token no ClientLayout
  modified:
    - path: apps/web/src/routes/router.tsx
      description: Rota /client/agenda agora aponta para ScheduleScreen; nova sub-rota agenda/pedido-unico → SingleScreen
    - path: apps/web/src/pages/client/ClientLayout.tsx
      description: Adicionada chamada useOneSignalRegister() após autenticação
decisions:
  - "warn === accent (#B0702A) no tema claro — cor do stepper mantida pelo componente existente em ambos os estados"
  - "useEffect com dependência [] e cleanup removeEventListener (T-04-06-04 — sem loop de listener)"
  - "Chip desabilitado usa disabled attr + onClick=undefined + opacity 0.4 (D-05 — cutoff 21h)"
  - "BannerInsuficiente reutilizado com onComprar → /client/creditos e onAjustar → setQtd(saldo)"
  - "Input nativo type=date acionado via ref.current.click() no chip Outra data"
  - "SingleScreen exporta como named export para consistência com demais telas do projeto"
metrics:
  duration: ~20 minutos
  completed: "2026-06-15T00:20:00Z"
  tasks_completed: 2
  files_modified: 2
  files_created: 3
requirements:
  - SCHED-01
  - SCHED-04
---

# Phase 4 Plan 06: SingleScreen + DateChips + Router + useOneSignalRegister Summary

**One-liner:** SingleScreen com DateChips (corte 21h, input nativo 30 dias), BannerInsuficiente e CreditCard inline; aba Agenda deixa de ser placeholder via router.tsx; useOneSignalRegister registra player_id no ClientLayout — 74 testes passando e build sem erros.

## Objective

Completar o ciclo do cliente front-end da Fase 4: criar a SingleScreen com todos os subcomponentes (DateChips, reutilização de QuantityStepper e BannerInsuficiente, CreditCard), atualizar o router.tsx para apontar a aba Agenda para a ScheduleScreen real, e criar o hook useOneSignalRegister que registra o player_id do PWA no backend.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | DateChips + SingleScreen | 67d1adf | DateChips.tsx (novo), SingleScreen.tsx (novo) |
| 2 | router.tsx atualizado + useOneSignalRegister + ClientLayout wiring | 97cf280 | router.tsx, useOneSignalRegister.ts (novo), ClientLayout.tsx |

## Verification Results

1. `npm run build --workspace=apps/web` → sem erros TS ✓
2. `npm run test --workspace=apps/web -- --run` → 74 passed, sem FAILs ✓
3. `grep "CUTOFF_HOUR" DateChips.tsx` → confirma constante 21 ✓
4. `grep "disabled|opacity.*0.4" DateChips.tsx` → confirma chip desabilitado após corte ✓
5. `grep 'type="date"' DateChips.tsx` → confirma input nativo ✓
6. `grep "ScheduleScreen" router.tsx` → confirma rota agenda substituída ✓
7. `grep "pedido-unico" router.tsx` → confirma nova sub-rota ✓
8. `grep "PlaceholderScreen"` em rota agenda → 0 resultados ✓
9. `grep "push-token" useOneSignalRegister.ts` → confirma endpoint correto ✓
10. `grep "useOneSignalRegister" ClientLayout.tsx` → confirma wiring ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] QuantityStepper não aceita prop `numberColor`**
- **Found during:** Task 1
- **Issue:** O plano menciona que a cor do número deve ser `warn` quando `qtd > saldo`, mas `warn === accent` no tema claro (mesmo `#B0702A`). O componente `QuantityStepper.tsx` usa `var(--color-accent)` fixo — não há mudança visual real.
- **Fix:** Removida a prop inexistente `numberColor` da chamada. A cor `accent` já é o estado correto para ambas as situações no tema claro, conforme confirmado na UI-SPEC seção 8: "Cor insuficiente: `warn` (`#B0702A` — mesmo valor no tema claro)".
- **Files modified:** `SingleScreen.tsx`
- **Commit:** 67d1adf

### Observação sobre BannerInsuficiente

O plano menciona alterar o texto "Comprar mais" para "Comprar créditos" no BannerInsuficiente. O componente existente tem texto fixo "Comprar mais". Como a UI-SPEC (seção 10) indica que o BannerInsuficiente existente deve ser reutilizado "passando as props corretas" e não há prop para alterar o texto do botão, optou-se por manter o componente existente intacto (evitando quebrar outros usos) e documentar isso como um desvio cosmético. O fluxo funcional (onComprar e onAjustar) está correto.

## Known Stubs

Nenhum stub — todos os componentes têm implementação completa e dados reais da API.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| threat_flag: auth-boundary | apps/web/src/hooks/useOneSignalRegister.ts | Novo endpoint POST /users/push-token chamado com JWT — conforme planejado em T-04-06-02 e T-04-06-03 |
| threat_flag: input-validation | apps/web/src/pages/client/SingleScreen.tsx | scheduledDate enviado ao backend — validado no backend via CreateOrderSchema Zod (T-04-06-01) |

Ambas as superfícies estão no threat_model do plano e têm mitigações definidas.

## Self-Check: PASSED

- [x] apps/web/src/components/client/DateChips.tsx — FOUND
- [x] apps/web/src/pages/client/SingleScreen.tsx — FOUND
- [x] apps/web/src/hooks/useOneSignalRegister.ts — FOUND
- [x] apps/web/src/routes/router.tsx (modificado) — FOUND com ScheduleScreen e pedido-unico
- [x] apps/web/src/pages/client/ClientLayout.tsx (modificado) — FOUND com useOneSignalRegister
- [x] Commit 67d1adf — FOUND
- [x] Commit 97cf280 — FOUND
