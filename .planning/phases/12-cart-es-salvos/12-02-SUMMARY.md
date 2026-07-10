---
phase: 12-cart-es-salvos
plan: "02"
subsystem: frontend/payments
tags:
  - saved-cards
  - card-payment
  - react
  - ui-components
dependency_graph:
  requires:
    - "GET /users/me/cards (12-01 backend)"
    - "POST /payments/card com savedCardId + securityCode (12-01 backend)"
    - "apps/web/src/components/client/ComboCard.tsx (padrão radio indicator)"
    - "apps/web/src/pages/client/CombosScreen.tsx (padrão CTA bar fixa)"
    - "apps/web/src/pages/client/SettingsScreen.tsx (padrão toast)"
  provides:
    - "SavedCardItem: card de cartão salvo com radio indicator modo select/manage"
    - "SavedCardsList: lista com skeleton/erro/vazio"
    - "CardPaymentScreen: Modo A (cartões salvos) e Modo B (sem cartões)"
  affects:
    - "apps/web/src/pages/client/CardPaymentScreen.tsx (refatorado)"
tech_stack:
  added: []
  patterns:
    - "Inline styles com CSS vars (padrão da fase — sem Tailwind)"
    - "Radio indicator 26×26px idêntico ao ComboCard.tsx"
    - "CTA bar fixa padrão CombosScreen.tsx (bottom: calc(56px + env(safe-area-inset-bottom)))"
    - "Toast padrão SettingsScreen.tsx (position fixed top 16px)"
    - "CVV input nativo type=password com cleanup pós-POST (T-12-07)"
key_files:
  created:
    - apps/web/src/components/client/SavedCardItem.tsx
    - apps/web/src/components/client/SavedCardsList.tsx
  modified:
    - apps/web/src/pages/client/CardPaymentScreen.tsx
decisions:
  - "saveModeBCard separado de saveForLater: Modo B (sem cartões) inicia unchecked por padrão; Modo A (Brick expandido) inicia checked por padrão — evita estado compartilhado com comportamentos opostos"
  - "CVV limpo (setCvv('')) sincrono antes do await do POST — garante T-12-07 mesmo em caso de erro de rede"
metrics:
  duration: "~8 minutos"
  completed_date: "2026-06-20"
  tasks_completed: 2
  files_changed: 3
---

# Phase 12 Plan 02: Componentes Frontend Cartões Salvos Summary

## One-liner

SavedCardItem + SavedCardsList com radio indicator 26×26px e CardPaymentScreen refatorada com Modo A (cartões salvos + CVV nativo + Brick colapsável) e Modo B (Brick direto), CTA dinâmica com 3 estados e hierarquia visual CARD-03.

## What Was Built

### Task 1: SavedCardItem + SavedCardsList

Criados dois componentes em `apps/web/src/components/client/`:

- **SavedCardItem.tsx**: Componente reutilizável com dois modos via prop `mode: 'select' | 'manage'`
  - `mode='select'`: Card clicável com `role="radio"` e `aria-checked`, radio indicator 26×26px idêntico ao `ComboCard.tsx`, borda `--color-accent` quando selecionado, sombra `--shadow-strong`
  - `mode='manage'`: Linha com bandeira + dígitos + badge "Padrão" (cor `--color-good`) ou botão "Definir como padrão" + botão "Remover" (#C0392B) com loading state "Removendo..."
  - `renderBrandIcon`: Visa (texto azul Bricolage #1A1F71), Mastercard (SVG 32×20px dois círculos sobrepostos), Elo (texto), genérico (`<Icon name="card">`)

- **SavedCardsList.tsx**: Wrapper da lista com estados:
  - Loading: 3 skeleton cards 64px com animação `savedcard-pulse` (opacity 0.5/1)
  - Erro: texto centralizado 12.5px `--color-text-sec`
  - Vazio (manage): "Nenhum cartão salvo." + subtexto
  - Vazio (select): retorna null (CardPaymentScreen controla Modo B)
  - Lista: `role="radiogroup"` no modo select, gap 8px entre items

### Task 2: CardPaymentScreen Refatorada

Refatoração de `apps/web/src/pages/client/CardPaymentScreen.tsx` preservando AppBar, Brick existente e lógica de navegação:

**Estado novo adicionado:**
- `savedCards`, `loadingCards`, `selectedCardId`, `addCardExpanded`, `saveForLater`, `saveModeBCard`, `cvv`, `cvvError`

**useEffect na montagem:** `GET /users/me/cards` → pré-seleciona cartão `isDefault` ou `cards[0]`. Falha silenciosa → Modo B degradado.

**Modo A (hasSavedCards === true):**
1. Seção "SEUS CARTÕES" com `SavedCardsList` modo select
2. CVV input (`type="password"` `inputMode="numeric"` `maxLength={4}`) exibido abaixo da lista quando cartão selecionado; borda vermelha em erro
3. Separador "ou" horizontal
4. Card colapsável "Adicionar novo cartão" com borda `--color-accent` quando expandido, Brick inline + checkbox `saveForLater` (checked por padrão)

**Modo B (hasSavedCards === false):** Brick direto + checkbox `saveModeBCard` (unchecked por padrão — spec CARD-03)

**CTA dinâmica (3 estados):**
- "Pagar com este cartão" (primário) → quando cartão salvo selecionado + !addCardExpanded
- "Salvar cartão e pagar" (primário) → quando addCardExpanded + saveForLater
- "Pagar sem salvar" (menor destaque — sem fundo, 12.5px `--color-text-sec`, height 44px) → quando addCardExpanded + !saveForLater

**Segurança:**
- T-12-07: `setCvv('')` síncrono antes do `await` do POST — CVV nunca persiste além da requisição, mesmo em erro de rede
- T-12-08: frontend só envia `selectedCardId`; ownership validada no backend (T-12-01)
- T-12-09: `saveCard` flag apenas indica intenção; limite de 3 validado server-side (T-12-03)

**Toast:** padrão idêntico ao SettingsScreen.tsx (position fixed, top 16px, bg `--color-espresso`, auto-dismiss 2500ms)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Estado `saveForLater` separado para Modo B**
- **Found during:** Task 2 — implementação do checkbox
- **Issue:** O PLAN.md especifica `saveForLater: boolean — inicializa como true` mas também especifica que no Modo B o checkbox deve ser "unchecked por padrão". Com um único estado compartilhado inicializado como `true`, o Modo B violaria a spec.
- **Fix:** Criado `saveModeBCard: boolean` inicializado como `false` exclusivamente para o checkbox do Modo B. O `saveForLater` (inicializado como `true`) permanece para o Modo A. O `handleBrickSubmit` usa `hasSavedCards ? saveForLater : saveModeBCard` ao montar o payload.
- **Files modified:** `apps/web/src/pages/client/CardPaymentScreen.tsx`
- **Commit:** `1ff576d`

## Known Stubs

Nenhum. Os dados de cartão virão de `GET /users/me/cards` em runtime. Nenhum valor hardcoded flui para a UI.

## Threat Flags

Nenhuma nova superfície de ameaça não coberta pelo threat_model do plano:
- CVV limpo via T-12-07
- selectedCardId validado via T-12-08 (backend)
- saveCard limit via T-12-09 (backend)

## Self-Check: PASSED

- FOUND: apps/web/src/components/client/SavedCardItem.tsx
- FOUND: apps/web/src/components/client/SavedCardsList.tsx
- FOUND: apps/web/src/pages/client/CardPaymentScreen.tsx (modificado)
- FOUND commit 1e2b719 (Task 1)
- FOUND commit 1ff576d (Task 2)
