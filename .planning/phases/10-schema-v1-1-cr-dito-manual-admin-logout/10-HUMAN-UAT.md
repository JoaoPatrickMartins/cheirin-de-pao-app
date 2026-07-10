---
status: partial
phase: 10-schema-v1-1-cr-dito-manual-admin-logout
source: [10-VERIFICATION.md]
started: 2026-06-19T20:40:00Z
updated: 2026-06-19T20:40:00Z
---

## Current Test

[aguardando teste humano]

## Tests

### 1. Posicionamento visual do botão '+ Adicionar créditos'
expected: Botão aparece abaixo do saldo no ClientDetailView, visível e acessível para admin
result: [pending]

### 2. Comportamento interativo do modal de concessão de créditos
expected: Foco automático no input ao abrir, chips de motivo selecionáveis com aria-pressed, botão Confirmar desabilitado até quantidade ≥ 1 e motivo selecionado, toast de sucesso após confirmar, fechar com Escape
result: [pending]

### 3. Fluxo ponta a ponta com MongoDB Atlas real
expected: Após grant → CreditTransaction criada com type ADMIN_GRANT + adminId + reason, User.creditBalance incrementado atomicamente
result: [pending]

### 4. Push OneSignal para cliente com credencial real
expected: Notificação push recebida no dispositivo do cliente com conteúdo correto após grant
result: [pending]

### 5. Logout do entregador
expected: Clicar no ícone de logout no header do CourierScreen encerra a sessão e redireciona para tela de login
result: [pending]

### 6. Logout do admin com dialog de confirmação
expected: Clicar em 'Sair' no AdminBottomNav exibe dialog "Sair da conta?" com botões "Continuar na conta" e "Sair"; confirmar encerra a sessão e redireciona para login
result: [pending]

### 7. Card CREDIT_GRANTED na NotificationsScreen
expected: Notificação CREDIT_GRANTED exibe tom gold, ícone coin, e CTA "Ver saldo" navegando para /client/home
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
