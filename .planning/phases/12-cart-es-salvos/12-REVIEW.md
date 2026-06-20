---
phase: 12-cart-es-salvos
reviewed: 2026-06-19T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - apps/api/src/modules/saved-cards/saved-cards.schema.ts
  - apps/api/src/modules/saved-cards/saved-cards.repository.ts
  - apps/api/src/modules/saved-cards/saved-cards.service.ts
  - apps/api/src/modules/saved-cards/saved-cards.controller.ts
  - apps/api/src/modules/saved-cards/saved-cards.route.ts
  - apps/api/src/modules/saved-cards/__tests__/saved-cards.service.test.ts
  - apps/api/src/modules/payments/__tests__/payments-card-saved.test.ts
  - apps/api/src/modules/payments/payments.service.ts
  - apps/api/src/modules/payments/payments.schema.ts
  - apps/api/src/modules/payments/__tests__/payments.service.test.ts
  - apps/api/src/server.ts
  - apps/web/src/components/client/SavedCardItem.tsx
  - apps/web/src/components/client/SavedCardsList.tsx
  - apps/web/src/pages/client/CardPaymentScreen.tsx
  - apps/web/src/pages/client/SettingsScreen.tsx
findings:
  critical: 3
  warning: 6
  info: 2
  total: 11
status: fixed
---

# Phase 12: Code Review Report

**Reviewed:** 2026-06-19
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

This phase implements saved cards (cartões salvos) via the Mercado Pago Customer API, covering backend (CARD-01/04/05/06) and frontend (selection, management, payment flows). The IDOR protections are structurally sound and CVV handling is correct. However, there are three blockers: a race condition that allows bypassing the 3-card limit, a broken "Pagar sem salvar" button (dead handler), and a leaking MP error object that can expose internal API details to clients. Additionally, the `getOrCreateMpCustomer` logic is duplicated across two services with slightly different behavior, the CVV validation in the frontend accepts only 3 digits but Amex requires 4, and there are missing input validations at the API boundary.

---

## Critical Issues

### CR-01: Race condition — 3-card limit can be bypassed

**File:** `apps/api/src/modules/payments/payments.service.ts:218-242`

**Issue:** The card-save flow in `createCard` does a `count()` check followed by a non-atomic `customerCardApi.create()` + `savedCard.create()`. Two concurrent payment requests with `saveCard:true` from the same user will both read `count === 2` (or 0/1), both pass the guard, and both write — resulting in 4 or more cards in the database. The service-level `saveNewCard` in `SavedCardsService` has the same non-atomic pattern (line 144-159 of `saved-cards.service.ts`), but that path is not directly called from payments; only the inline version in `payments.service.ts` is the live risk.

**Fix:** Either use a unique compound index `(userId, mpCardId)` at the Prisma/MongoDB schema level to prevent duplicate MP card IDs, or perform the count and insert inside a Prisma `$transaction` with appropriate serializable isolation. At minimum, add an optimistic check that aborts if `count >= 3` after the MP card is created but before saving to the DB:

```typescript
// After mpCard is created, re-check count atomically
const currentCount = await this.prisma.savedCard.count({ where: { userId } })
if (currentCount >= 3) {
  // Roll back: remove the card we just created in MP
  await this.customerCardApi.remove({ customerId: mpCustomerId, id: mpCard.id })
  // Silently skip save — payment already succeeded
  return { paymentId: payment.id }
}
```

---

### CR-02: "Pagar sem salvar" button is a dead handler — payment cannot be submitted

**File:** `apps/web/src/pages/client/CardPaymentScreen.tsx:621-634`

**Issue:** When the user has saved cards, expands "Adicionar novo cartão", and unchecks "Salvar para compras futuras", `showSecondaryBtn` becomes `true` and a "Pagar sem salvar" button appears. Its `onClick` handler is an empty function (`// Brick tem seu próprio submit — nada a fazer aqui manualmente`). The MP Brick only triggers its `onSubmit` callback when the **Brick's own internal submit button** is clicked — the external "Pagar sem salvar" span cannot programmatically trigger the Brick's submit. The user clicks "Pagar sem salvar" and nothing happens. This effectively blocks checkout in this code path.

Also, `showPrimaryBtn` on line 157-160 evaluates to `false` when `addCardExpanded && !saveForLater`, so there is no working CTA at all for this state.

**Fix:** Either:
1. Remove the external "Pagar sem salvar" button and rely solely on the Brick's own submit (hide the checkbox or always pass `saveCard` in `onSubmit` based on checkbox state), or
2. Use the MP Brick's `customization` prop to override its submit button label to "Pagar sem salvar" when `!saveForLater`, removing the need for a duplicate external button.

```tsx
// Option 1: pass saveForLater state into onSubmit, remove external button
<CardPayment
  initialization={{ amount }}
  customization={{ visual: { buttonLabel: saveForLater ? 'Salvar e pagar' : 'Pagar sem salvar' } }}
  onSubmit={handleBrickSubmit}
  ...
/>
// Remove showSecondaryBtn block entirely
```

---

### CR-03: MP SDK error details leaked to client on card removal failure

**File:** `apps/api/src/modules/saved-cards/saved-cards.service.ts:85-88` / `saved-cards.controller.ts:98-102`

**Issue:** `removeCard` calls `this.customerCardApi.remove(...)` and does not catch errors. When the MP API returns an error (e.g., invalid card ID, 404, rate limit), the MP SDK throws an `Error` instance with a `message` and potentially a `cause` containing full MP response details. The controller's `isBusinessError` guard correctly distinguishes MP errors from business errors (it excludes objects with `message` or `cause` properties), so MP errors fall through to the generic 500 handler — that part is correct. However, the `request.log.error({ err }, ...)` call at line 98 will log the full MP error object including any sensitive fields present in the MP response payload (e.g., card numbers in error context). This is an information exposure risk in logs that may be shipped to external logging services.

More critically: if MP's `remove` throws synchronously (not a rejected promise), the error is not caught at all and will bubble up as an unhandled exception, crashing the Fastify handler.

**Fix:** Wrap the MP call explicitly:

```typescript
async removeCard(cardId: string, userId: string) {
  // ... ownership checks ...
  try {
    await this.customerCardApi.remove({
      customerId: user.mpCustomerId,
      id: card.mpCardId,
    })
  } catch (mpErr) {
    // Log sanitized error; never expose MP internals
    this.fastify.log.error({ mpCardId: card.mpCardId }, 'MP card removal failed')
    throw { error: 'Não foi possível remover o cartão no Mercado Pago. Tente novamente.', status: 502 }
  }
  await this.repo.deleteById(cardId)
}
```

---

## Warnings

### WR-01: Duplicate `getOrCreateMpCustomer` with behavioral divergence

**File:** `apps/api/src/modules/payments/payments.service.ts:98-114` and `apps/api/src/modules/saved-cards/saved-cards.service.ts:34-58`

**Issue:** There are two independent implementations of the same idempotent MP Customer lookup/create logic. They differ in one important way: the `PaymentsService` version (line 100) does `if (user?.mpCustomerId) return user.mpCustomerId` — it skips the DB query if the user object is already in scope. The `SavedCardsService` version (line 35-36) does a fresh `prisma.user.findUnique` even when `user` is already available. More critically, the `PaymentsService` version has a null-safety gap: if `findUnique` returns `null` (deleted user), line 100 will not throw — `user?.mpCustomerId` is `undefined`, execution continues to the MP search using `userEmail`, potentially creating an MP Customer for a non-existent user.

**Fix:** Extract to a shared utility or inject as a dependency. The `SavedCardsService` version (which properly throws on `!user`) is the correct one.

---

### WR-02: CVV validation accepts only 3 digits — Amex cards (4 digits) will always fail

**File:** `apps/web/src/pages/client/CardPaymentScreen.tsx:77`

**Issue:** The CVV guard is `if (cvv.length < 3)`. American Express cards have a 4-digit CVV (CID). The `maxLength={4}` attribute on the input correctly allows 4 digits, but the validation only requires `>= 3`. An Amex user can enter 3 digits and submit — the MP API will reject the token. Worse, users with non-Amex cards entering exactly 3 digits are accepted, but the selected saved card's brand is known from `savedCards` state and could be used to enforce the correct length.

**Fix:**

```typescript
const selectedCard = savedCards.find((c) => c.id === selectedCardId)
const requiredCvvLength = selectedCard?.brand === 'amex' ? 4 : 3
if (cvv.length < requiredCvvLength) {
  setCvvError(`Informe o código de segurança (${requiredCvvLength} dígitos)`)
  return
}
```

---

### WR-03: `setDefault` repository method can silently target a card belonging to another user

**File:** `apps/api/src/modules/saved-cards/saved-cards.repository.ts:39-42`

**Issue:** `setDefault` in the repository does `prisma.savedCard.update({ where: { id: cardId }, data: { isDefault: true } })`. The service correctly validates ownership before calling this, but the repository method itself accepts any `cardId` without a `userId` constraint in the `update` call. If the service-level guard is ever bypassed (e.g., the method is called from a new code path, or a future refactor removes the guard), the repository will happily update a card belonging to any user. This is a defense-in-depth gap.

**Fix:** Add `userId` to the update predicate:

```typescript
this.prisma.savedCard.update({
  where: { id: cardId, userId }, // MongoDB Prisma supports compound where on unique fields
  data: { isDefault: true },
})
```

---

### WR-04: `deleteById` in repository has no ownership constraint

**File:** `apps/api/src/modules/saved-cards/saved-cards.repository.ts:46-48`

**Issue:** Same defense-in-depth gap as WR-03. `deleteById` takes only `id` — no `userId` is passed to the Prisma `delete` call. Service-level ownership check exists, but the repository is not hardened.

**Fix:**

```typescript
deleteById(id: string, userId: string) {
  return this.prisma.savedCard.delete({ where: { id, userId } })
}
```

Update call sites in `saved-cards.service.ts:90` to `this.repo.deleteById(cardId, userId)`.

---

### WR-05: `createCard` in `payments.service.ts` does not validate `paymentMethodId` when using a saved card

**File:** `apps/api/src/modules/payments/payments.service.ts:180-197`

**Issue:** When a saved card is used (`savedCardId` provided), `paymentToken` is generated from `CardToken.create`, but `paymentMethodId` is still passed directly to `Payment.create` at line 188. Since `paymentMethodId` is optional in the schema (line 22 of `payments.schema.ts`), it can be `undefined` when `savedCardId` is used. The MP API requires `payment_method_id` for card payments — passing `undefined` will cause an `internal_error` response from MP. The saved card's brand (e.g., `'visa'`) is available from the `savedCard` object fetched at line 154 and should be used as the fallback.

**Fix:**

```typescript
payment_method_id: paymentMethodId ?? (savedCardId ? savedCard?.brand : undefined),
```

(where `savedCard` is hoisted to the outer scope when `savedCardId` is present)

---

### WR-06: Dialog dismiss via backdrop click does not reset `removingCardId`

**File:** `apps/web/src/pages/client/SettingsScreen.tsx:400-403`

**Issue:** The remove-card dialog's backdrop `onClick` calls `setShowRemoveDialog(false)` and `setCardToRemove(null)`, but does not call `setRemovingCardId(null)`. If a removal is in-flight and the user dismisses the dialog via the backdrop (not via the "Manter cartão" button), `removingCardId` stays set. This causes: (1) the "Remover" button on the card in the list to remain in the "Removendo..." state permanently, and (2) the remove button in the dialog (which re-opens) to appear disabled forever for that card ID.

**Fix:**

```typescript
onClick={() => {
  setShowRemoveDialog(false)
  setCardToRemove(null)
  setRemovingCardId(null) // reset in-flight state on dismiss
}}
```

---

## Info

### IN-01: `mpCustomerId` unused parameter in `saveNewCard`

**File:** `apps/api/src/modules/saved-cards/saved-cards.service.ts:133-159`

**Issue:** `saveNewCard` accepts `mpCustomerId` in its params object but never uses it. The `repo.create` call does not persist `mpCustomerId` — looking at `SavedCardsRepository.create`, the `mpCustomerId` field is not in the schema. This parameter was presumably included for a future use (e.g., passing it to `CustomerCard.create`) but was not wired in the final implementation. It is dead parameter surface that confuses callers about what is required.

**Fix:** Remove `mpCustomerId` from the `saveNewCard` params signature if it is not used, or document its intended future purpose with a `// TODO` comment. All callers in `payments.service.ts:213-242` pass it, so removal requires updating call sites.

---

### IN-02: `SkeletonCard` inline `<style>` tag duplicated per skeleton instance

**File:** `apps/web/src/components/client/SavedCardsList.tsx:122-128`

**Issue:** The `SkeletonCard` component renders a `<style>` block defining `@keyframes savedcard-pulse` inside every skeleton instance. When 3 skeletons are rendered (the default), 3 identical `<style>` tags are injected into the DOM. This does not cause incorrect behavior but is wasteful and can cause specificity confusion in some style parsers.

**Fix:** Move the `<style>` tag outside the `SkeletonCard` component — either into `SavedCardsList` itself (rendered once) or into a global CSS file.

---

_Reviewed: 2026-06-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
