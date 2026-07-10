---
plan: 12-03
phase: 12-cart-es-salvos
status: complete
completed: "2026-06-19"
tasks_completed: 2
tasks_total: 2
checkpoint: approved
self_check: PASSED
---

# Plan 12-03 Summary — SavedCardsSection na SettingsScreen

## Objective

Integrar gerenciamento de cartões salvos na SettingsScreen existente, fechando o loop do CARD-05.

## What Was Built

### Task 1 — SavedCardsSection integrada (auto)
- **`apps/web/src/pages/client/SettingsScreen.tsx`** — modificado in-place:
  - 6 estados novos: `savedCards`, `loadingCards`, `cardError`, `removingCardId`, `cardToRemove`, `showRemoveDialog`
  - `useEffect` de fetch `GET /users/me/cards` na montagem
  - `handleSetDefault`: `PATCH /users/me/cards/:id` + atualização local de `isDefault` + toast
  - `handleRemovePress`: abre dialog de confirmação com o card selecionado
  - `handleRemoveConfirm`: `DELETE /users/me/cards/:id` + filtra da lista + toast
  - Seção "Cartões" inserida entre "Contato" e "Condomínio" usando `SavedCardsList` em `mode="manage"`
  - Dialog de remoção com overlay + botões em coluna ("Manter cartão" / "Remover cartão" #C0392B)
  - Rodapé informativo condicional: visível somente quando `0 < savedCards.length < 3`
  - Zero erros TypeScript

### Task 2 — Checkpoint humano (verificação manual)
- Aprovado pelo usuário após teste dos fluxos CARD-01 a CARD-06 no app

## Key Files

### Modified
- `apps/web/src/pages/client/SettingsScreen.tsx` — seção Cartões + handlers + dialog

## Self-Check: PASSED

- [x] TypeScript: zero erros de compilação
- [x] `GET /users/me/cards` — fetch na montagem
- [x] `PATCH /users/me/cards/:id` — definir padrão
- [x] `DELETE /users/me/cards/:id` — remover com confirmação
- [x] Dialog de remoção com texto "•••• {lastFour}"
- [x] Toast "Cartão padrão atualizado." e "Cartão removido."
- [x] Rodapé condicional (length < 3)
- [x] Seção inserida na posição correta (Contato → Cartões → Condomínio)
- [x] Checkpoint humano aprovado: CARD-01 a CARD-06 verificados

## Deviations

Nenhum.

## Requirements Coverage

| Requirement | Status |
|-------------|--------|
| CARD-05 — Gerenciar cartões na SettingsScreen | ✓ Complete |
