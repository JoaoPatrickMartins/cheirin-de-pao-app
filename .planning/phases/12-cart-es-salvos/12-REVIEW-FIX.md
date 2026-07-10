---
phase: 12-cart-es-salvos
fixed_at: 2026-06-19T22:21:00Z
review_path: .planning/phases/12-cart-es-salvos/12-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 12: Code Review Fix Report

**Fixed at:** 2026-06-19T22:21:00Z
**Source review:** .planning/phases/12-cart-es-salvos/12-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (3 Critical, 6 Warning)
- Fixed: 9
- Skipped: 0

## Fixed Issues

### CR-01: Race condition — 3-card limit can be bypassed

**Files modified:** `apps/api/src/modules/payments/payments.service.ts`
**Commit:** a515181
**Applied fix:** Adicionada recontagem pós-criação no MP (`currentCount = await prisma.savedCard.count(...)`) antes de persistir no banco. Se `currentCount >= 3` (request concorrente venceu), o cartão recém-criado no MP é removido via rollback (`customerCardApi.remove`) e a função retorna sem salvar. Também corrigida a lógica de `isDefault` para usar `currentCount === 0` (ao invés do `count` capturado antes do MP).

---

### CR-02: "Pagar sem salvar" button is a dead handler

**Files modified:** `apps/web/src/pages/client/CardPaymentScreen.tsx`
**Commit:** cd44f32
**Applied fix:** Removido o bloco `{showSecondaryBtn && (...)}` inteiro (o span externo com handler morto). Adicionado `customization={{ visual: { buttonLabel: saveForLater ? 'Salvar cartão e pagar' : 'Pagar sem salvar' } }}` ao `<CardPayment>` dentro do card expansível (Modo A), de forma que o botão interno do Brick recebe o label correto conforme o estado do checkbox. `showPrimaryBtn` e `showSecondaryBtn` foram simplificados — o CTA externo só aparece para Modo B e Modo A com cartão salvo selecionado (nunca quando o Brick está expandido).

---

### CR-03: MP SDK error details leaked to client on card removal failure

**Files modified:** `apps/api/src/modules/saved-cards/saved-cards.service.ts`
**Commit:** 1f52073
**Applied fix:** Envolvido `this.customerCardApi.remove(...)` em `try/catch`. Em caso de erro, o log registra apenas `{ mpCardId }` (sanitizado, sem campos internos do MP) e re-throw como `{ error: '...', status: 502 }` padronizado. O `this.repo.deleteById(...)` só é chamado após o bloco try — se o MP falhar, o banco não é modificado.

---

### WR-01: Duplicate `getOrCreateMpCustomer` with null-safety gap

**Files modified:** `apps/api/src/modules/payments/payments.service.ts`
**Commit:** a515181
**Applied fix:** Corrigida a null-safety em `payments.service.ts`: substituído `if (user?.mpCustomerId)` por `if (!user) throw { ... }` + `if (user.mpCustomerId)`. Se `findUnique` retornar `null` (usuário deletado), a função lança 404 ao invés de continuar com `undefined` e criar um MP Customer para usuário inexistente.

---

### WR-02: CVV validation accepts only 3 digits — Amex requires 4

**Files modified:** `apps/web/src/pages/client/CardPaymentScreen.tsx`
**Commit:** cd44f32
**Applied fix:** Em `handlePayWithSavedCard`, o comprimento mínimo do CVV agora é determinado pela bandeira do cartão selecionado: `const selectedCard = savedCards.find((c) => c.id === selectedCardId)` + `const requiredCvvLength = selectedCard?.brand === 'amex' ? 4 : 3`. A mensagem de erro também informa o número de dígitos esperado.

---

### WR-03: `setDefault` repository method can silently target another user's card

**Files modified:** `apps/api/src/modules/saved-cards/saved-cards.repository.ts`
**Commit:** 1f52073
**Applied fix:** Adicionado `userId` ao predicado do `prisma.savedCard.update` dentro do `$transaction`: `where: { id: cardId, userId }`. Defesa em profundidade — impede que o repositório atualize cartão de outro usuário mesmo sem a guarda de serviço.

---

### WR-04: `deleteById` in repository has no ownership constraint

**Files modified:** `apps/api/src/modules/saved-cards/saved-cards.repository.ts`, `apps/api/src/modules/saved-cards/saved-cards.service.ts`
**Commit:** 1f52073
**Applied fix:** Assinatura de `deleteById` alterada para `deleteById(id: string, userId: string)` e o predicado Prisma atualizado para `{ id, userId }`. O call site em `saved-cards.service.ts:removeCard` foi atualizado para passar `userId`: `this.repo.deleteById(cardId, userId)`.

---

### WR-05: `payment_method_id` undefined when using saved card

**Files modified:** `apps/api/src/modules/payments/payments.service.ts`
**Commit:** a515181
**Applied fix:** Variável `savedCard` hoistada para o escopo externo do `createCard` (era declarada apenas dentro do bloco `if (savedCardId)`). O campo `payment_method_id` em `Payment.create` agora usa: `paymentMethodId ?? (savedCardId ? savedCard?.brand : undefined)`. Quando `paymentMethodId` não é fornecido e `savedCardId` está presente, usa o `brand` do cartão salvo (ex.: `'visa'`, `'master'`).

---

### WR-06: Dialog dismiss via backdrop click does not reset `removingCardId`

**Files modified:** `apps/web/src/pages/client/SettingsScreen.tsx`
**Commit:** f402644
**Applied fix:** Adicionado `setRemovingCardId(null)` ao `onClick` do backdrop do dialog de remoção de cartão, ao lado das chamadas existentes a `setShowRemoveDialog(false)` e `setCardToRemove(null)`. Evita que o botão "Remover" fique travado no estado "Removendo..." quando o dialog é fechado pelo backdrop enquanto uma operação está em andamento.

---

_Fixed: 2026-06-19T22:21:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
