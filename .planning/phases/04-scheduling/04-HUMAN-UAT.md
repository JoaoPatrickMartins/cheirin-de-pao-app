---
status: partial
phase: 04-scheduling
source: [04-VERIFICATION.md]
started: 2026-06-15T00:30:00Z
updated: 2026-06-15T00:30:00Z
---

## Current Test

[aguardando testes humanos]

## Tests

### 1. Navegação aba Agenda
expected: ScheduleScreen carrega ao clicar na aba Agenda (não PlaceholderScreen)
result: [pending]

### 2. Salvar agenda
expected: PUT /schedules/me persiste weeklyQty/deliveryTime, toast "Agenda salva!" aparece
result: [pending]

### 3. Pedido único
expected: POST /orders reserva créditos atomicamente, redirect para /client/agenda após sucesso
result: [pending]

### 4. Chip "Amanhã cedo" após 21h
expected: chip desabilitado com label "Disponível até 21:00" e opacity 0.4 após 21h do dispositivo
result: [pending]

### 5. Registro de push token
expected: useOneSignalRegister registra player_id via POST /users/push-token quando PWA instalado com credenciais OneSignal reais
result: [pending]

### 6. Cron de meia-noite
expected: Orders SCHEDULED criados automaticamente no Atlas para clientes com agenda ativa
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
