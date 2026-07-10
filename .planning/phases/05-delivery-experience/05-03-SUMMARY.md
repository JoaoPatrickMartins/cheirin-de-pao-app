---
phase: 05-delivery-experience
plan: 03
status: completed
completed_at: 2026-06-15
---

# Plan 05-03 Summary — Cron véspera, sendEveReminders e adminOrdersRoute

## O que foi implementado

**Task 1 — sendEveReminders + testes:**
- `SchedulesService` agora injeta `NotificationsService` no construtor
- `sendEveReminders()` busca `prisma.order.findMany` com scheduledDate = amanhã em BRT (Date.UTC + offset 3h) e `status: { not: 'CANCELLED' }`
- Para cada order: tenta push OneSignal em try/catch separado (D-06: silencioso); persiste `Notification` tipo `DELIVERY_EVE` via `createAndTrim` obrigatoriamente (independente de playerId)
- Casos 05-05a e 05-05b adicionados ao test suite — todos passam (96 testes GREEN)

**Task 2 — cron.ts e server.ts:**
- 3º cron job registrado: `'0 21 * * *'`, timezone `America/Sao_Paulo`, name `eve-reminders`
- Log atualizado para "3 cron jobs registrados (meia-noite diário + domingo 20h + diário 21h)"
- `adminOrdersRoute` importado e registrado em `server.ts` — PATCH `/admin/orders/:id/status` acessível

## Arquivos modificados
- `apps/api/src/modules/schedules/schedules.service.ts`
- `apps/api/src/modules/schedules/__tests__/schedules.service.test.ts`
- `apps/api/src/plugins/cron.ts`
- `apps/api/src/server.ts`
