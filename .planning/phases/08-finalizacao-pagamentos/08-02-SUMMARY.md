---
phase: 08-finalizacao-pagamentos
plan: "02"
subsystem: backend/schedules
tags: [cron, onesignal, push-notifications, credits, tdd, cred-09]
dependency_graph:
  requires:
    - apps/api/src/modules/schedules/schedules.repository.ts (findUserById)
    - apps/api/src/modules/notifications/notifications.service.ts (createAndTrim)
    - apps/api/src/plugins/cron.ts (cron de meia-noite)
  provides:
    - sendLowCreditNotifications() em SchedulesService
    - Cron de meia-noite chama sendLowCreditNotifications após processAutoBuy
  affects:
    - apps/api/src/plugins/cron.ts (cron de meia-noite expandido)
tech_stack:
  added: []
  patterns:
    - Push OneSignal com additionalData.screen para deep link (D-11)
    - try/catch isolado por operacao no cron (T-08-06 mitigado)
    - notificationsService.createAndTrim com type LOW_CREDIT
key_files:
  created: []
  modified:
    - apps/api/src/modules/schedules/schedules.service.ts
    - apps/api/src/modules/schedules/__tests__/schedules.service.test.ts
    - apps/api/src/plugins/cron.ts
decisions:
  - "Locale 'pt' (nao 'pt-BR') nas notificacoes para consistencia com codigo existente"
  - "Notification LOW_CREDIT persistida mesmo quando oneSignalPlayerId=null"
  - "additionalData: { screen: 'creditos' } como deep link — sem action buttons (D-11)"
metrics:
  duration: 3min
  completed_date: "2026-06-19T02:36:46Z"
  tasks_completed: 2
  files_modified: 3
---

# Phase 8 Plan 02: sendLowCreditNotifications (CRED-09) Summary

## One-liner

Push de credito insuficiente (CRED-09) via OneSignal com deep link para CombosScreen, persistencia LOW_CREDIT em Notification, wiring no cron de meia-noite, e bug fix da URL inexistente /client/comprar em processAutoBuy.

## What Was Built

### Task 1: sendLowCreditNotifications + bug fix processAutoBuy URL
**Commit:** `0a0a99c`

Implementada a funcao `sendLowCreditNotifications()` na classe `SchedulesService`:
- Loop sobre todos os schedules ativos
- Skip para usuarios com `autoRecharge.active = true` (CRED-10 cuida disso)
- Calculo do `consumoSemanal` com o mesmo padrao de `processAutoBuy`
- Skip quando `consumoSemanal === 0` ou `creditBalance >= consumoSemanal`
- Push OneSignal com `additionalData: { screen: 'creditos' }` (deep link D-11)
- Persistencia de `Notification` com `type: 'LOW_CREDIT'` independente de `oneSignalPlayerId`
- Try/catch por iteracao — falha em um usuario nao aborta o loop

Bug fix: `processAutoBuy` linha 271 — URL `/client/comprar` (rota inexistente) corrigida para `/client/creditos` (D-17/D-18).

### Task 2: Testes unitarios CRED-09 + wiring no cron
**Commit:** `ab4dde6`

4 testes unitarios adicionados em `describe('sendLowCreditNotifications [CRED-09]')`:
1. Envia push quando `creditBalance < consumoSemanal` e sem `autoRecharge`
2. NAO envia push quando `autoRecharge.active = true`
3. NAO envia push quando `creditBalance >= consumoSemanal`
4. NAO envia push quando `oneSignalPlayerId = null`, mas persiste `Notification`

Mock do `OneSignal.Notification` atualizado para incluir `additionalData: {}` (necessario para o teste 1).

`cron.ts` atualizado:
- Log de inicio atualizado: inclui `sendLowCreditNotifications`
- Try/catch isolado para `sendLowCreditNotifications` apos `processAutoBuy`

## Verification Results

```
npm test (suite completa): 272 passed, 0 failed (38 test files)
npx tsc --noEmit: sem erros
grep sendLowCreditNotifications schedules.service.ts: 2 (definicao + chamada interna)
grep sendLowCreditNotifications cron.ts: 4 (chamada + logs)
grep client/comprar schedules.service.ts: 0 (bug removido)
grep LOW_CREDIT schedules.service.ts: 2 (type + string)
```

## Deviations from Plan

None - plano executado exatamente como escrito.

O plano especificava locale `'pt'` para consistencia com o codigo existente, e foi seguido. O mock do OneSignal foi atualizado com `additionalData: {}` para suportar a verificacao do deep link no teste 1 — ajuste minimo necessario para os testes funcionarem.

## Known Stubs

None — funcao totalmente implementada com push real OneSignal e persistencia real de Notification.

## Threat Flags

Nenhuma superficie nova identificada alem do threat model do plano:
- T-08-05 (envio duplicado): Mitigado — idempotencia natural por schedule (1 por usuario por cron run)
- T-08-06 (cron derrubado): Mitigado — try/catch isolado em cron.ts
- T-08-07 (saldo exposto): Accept — dados do proprio usuario, push somente para `oneSignalPlayerId` do usuario

## Self-Check: PASSED

Files modified verified:
- apps/api/src/modules/schedules/schedules.service.ts: contains sendLowCreditNotifications (2x), LOW_CREDIT (2x), /client/creditos (1x), no /client/comprar
- apps/api/src/modules/schedules/__tests__/schedules.service.test.ts: contains sendLowCreditNotifications (5x), 4 test cases
- apps/api/src/plugins/cron.ts: contains sendLowCreditNotifications (4x)

Commits verified:
- 0a0a99c: feat(08-02): implementar sendLowCreditNotifications e corrigir URL processAutoBuy
- ab4dde6: test(08-02): 4 testes unitarios CRED-09 + wiring sendLowCreditNotifications no cron
