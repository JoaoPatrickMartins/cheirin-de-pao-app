---
phase: 09-finaliza-o-rastreamento
plan: 01
subsystem: api
tags: [onesignal, push-notifications, deep-link, schedules, admin-orders, notifications]

# Dependency graph
requires:
  - phase: 08-finalizacao-pagamentos
    provides: estrutura de orders e serviços de notificação já implementados
provides:
  - sendEveReminders com notification.data = { screen: 'pedidos' } e actionRoute '/client/pedidos'
  - notifyAndPersist com notification.data = { screen: 'pedidos' } e headings.pt correto
  - Deep link funcional para /client/pedidos ao tocar na notificação push de véspera ou entrega
affects: [frontend-deep-link, tracking-screen, notifications-screen]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Push/persist isolation: push OneSignal dentro do try/catch (best-effort D-06), createAndTrim FORA do try (obrigatório)"
    - "notification.data = { screen: 'pedidos' } para deep link via OneSignal additionalData no frontend"
    - "actionRoute em createAndTrim para CTA 'Ver pedido' na NotificationsScreen"

key-files:
  created: []
  modified:
    - apps/api/src/modules/schedules/schedules.service.ts
    - apps/api/src/modules/admin-orders/admin-orders.service.ts

key-decisions:
  - "notification.data usa campo 'data' do SDK @onesignal/node-onesignal; frontend recebe como event.notification.additionalData.screen (mapeamento automático)"
  - "Commit único para as duas tarefas (tightly coupled — mesmo contexto de gaps de notificação)"
  - "createAndTrim de DELIVERY_DONE em admin-orders.service.ts não alterado — já tinha actionRoute correto"

patterns-established:
  - "notification.data = { screen: 'pedidos' } como padrão de deep link para telas de pedidos"
  - "headings.pt alinhado ao copywriting contract do UI-SPEC em todos os pushes"

requirements-completed: [ACOMP-02, ACOMP-03]

# Metrics
duration: 8min
completed: 2026-06-19
---

# Phase 09 Plan 01: Backend gaps de push notification para deep link — SUMMARY

**notification.data e actionRoute adicionados a sendEveReminders e notifyAndPersist, habilitando deep link /client/pedidos e CTA 'Ver pedido' na NotificationsScreen**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-19T00:00:00Z
- **Completed:** 2026-06-19T00:08:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `sendEveReminders` agora envia push com `notification.data = { screen: 'pedidos' }` — tocar na notificação navega para `/client/pedidos`
- `sendEveReminders` persiste DELIVERY_EVE com `actionRoute: '/client/pedidos'` e `title: 'Entrega amanhã 🍞'` — CTA da NotificationsScreen funcional
- `notifyAndPersist` agora envia push com `notification.data = { screen: 'pedidos' }` e `headings.pt = 'Entrega realizada! 🎉'` — copywriting alinhado ao UI-SPEC
- Suite de testes: 281 passed (38 test files), zero regressões

## Task Commits

Commit único (tarefas fortemente acopladas — mesmo contexto de gaps de notificação):

1. **Task 1 + Task 2: Gaps backend push notification** - `d1f826f` (feat)

**Plan metadata:** (a seguir — commit de docs)

## Files Created/Modified

- `apps/api/src/modules/schedules/schedules.service.ts` — `sendEveReminders`: headings.pt atualizado, `notification.data = { screen: 'pedidos' }` adicionado ao push, `createAndTrim` DELIVERY_EVE recebe `title` e `actionRoute` atualizados
- `apps/api/src/modules/admin-orders/admin-orders.service.ts` — `notifyAndPersist`: headings.pt atualizado para `'Entrega realizada! 🎉'`, `notification.data = { screen: 'pedidos' }` adicionado ao push

## Decisions Made

- Commit único para as duas tarefas: ambas são gaps do mesmo plano de notificações, arquivos diferentes mas contexto idêntico (deep link via notification.data)
- `createAndTrim` de DELIVERY_DONE em `admin-orders.service.ts` não alterado — já tinha `actionRoute: '/client/pedidos'` corretamente configurado
- Padrão de isolamento push/persist (D-06) preservado: push dentro do `try/catch`, `createAndTrim` fora do `try`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Deep link via notification.data está completo no backend — frontend pode implementar `useOneSignalDeepLink` que lê `event.notification.additionalData.screen`
- actionRoute persistido no banco para DELIVERY_EVE e DELIVERY_DONE — NotificationsScreen pode exibir CTA "Ver pedido" para ambos os tipos
- Próximo plano (09-02) pode focar no frontend: TrackingScreen, NotificationsScreen e integração do deep link

---
*Phase: 09-finaliza-o-rastreamento*
*Completed: 2026-06-19*
