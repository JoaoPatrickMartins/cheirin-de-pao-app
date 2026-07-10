---
phase: 14-agenda-multi-slot
plan: 03
status: complete
completed_at: "2026-06-20"
---

# Summary — Plano 03: Backend Multi-Slot (schedules.service + repository)

## O que foi feito

**Task 1 — repository.upsert() multi-slot**
- `schedules.repository.ts`: adicionada detecção `isMultiSlot = 'days' in data && data.days !== undefined`
- Modo multi-slot: salva apenas `days` no update/create (weeklyQty e deliveryTime preservados ou omitidos)
- Modo legado: comportamento inalterado

**Task 2 — schedules.service.ts**
- `getConsumoSemanal(schedule)`: helper module-level que soma qtds de todos os slots (multi-slot) ou weeklyQty (legado). Reutilizado em 3 funções.
- `createDailyOrders()`: bifurcação `if (schedule.days)` → loop por slot com transação independente por slot (T-14-03-02). Busca de usuário feita dentro de cada iteração de slot (saldo atualizado).
- `sendEveReminders()`: null-check `order.deliveryTime ? \` às ${...}\` : ''` (D-10, T-14-03-03)
- `processAutoBuy()` e `sendLowCreditNotifications()`: substituídos por `getConsumoSemanal(schedule)` (D-09)

**Bug fix — isolamento de mock nos testes**
- Removidos `mockImplementationOnce` desnecessários nos casos "NÃO deve enviar push" em `getConsumoSemanal_retornaSomaTotal_modoMultiSlot` e `sendLowCreditNotifications_usaGetConsumoSemanal_modoMultiSlot`. Entradas não consumidas na fila `mockImplementationOnce` sangrava entre testes, causando falha nos MSCHED-04 de `sendEveReminders`.

## Resultado

- 39/39 testes verdes (7 novos MSCHED-02/04 passando — RED → GREEN)
- `npx tsc --noEmit` sem erros em schedules.service.ts e schedules.repository.ts
- Backward-compat total: schedules legados (sem `days`) continuam funcionando

## Arquivos modificados

- `apps/api/src/modules/schedules/schedules.service.ts` — multi-slot service logic
- `apps/api/src/modules/schedules/schedules.repository.ts` — upsert multi-slot (plano anterior)
- `apps/api/src/modules/schedules/__tests__/schedules.service.test.ts` — fix de isolamento de mock
