---
phase: 10-schema-v1-1-credito-manual-admin-logout
reviewed: 2026-06-19T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - apps/api/prisma/schema.prisma
  - apps/api/src/modules/admin-clients/__tests__/admin-clients.service.test.ts
  - apps/api/src/modules/admin-clients/admin-clients.schema.ts
  - apps/api/src/modules/admin-clients/admin-clients.route.ts
  - apps/api/src/modules/admin-clients/admin-clients.service.ts
  - apps/api/src/modules/admin-clients/admin-clients.controller.ts
  - apps/web/src/components/admin/ClientDetailView.tsx
  - apps/web/src/components/admin/AdminBottomNav.tsx
  - apps/web/src/components/admin/AdminBottomNav.js
  - apps/web/src/components/admin/__tests__/AdminBottomNav.test.tsx
  - apps/web/src/pages/courier/CourierScreen.tsx
  - apps/web/src/pages/client/NotificationsScreen.tsx
  - apps/web/src/hooks/useOneSignalDeepLink.ts
findings:
  critical: 4
  warning: 5
  info: 3
  total: 12
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-06-19T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Review covers the Phase 10 implementation: Prisma schema v1.1 (Session + OtpCode + SavedCard models), manual credit grant flow (`POST /admin/clients/:id/grant-credits`), and admin logout. The schema additions are well-structured. The primary concerns are: a response contract mismatch that causes the client list endpoint to silently drop fields the frontend may depend on; an invalid notification type referenced in the frontend causing dead code paths; sensitive payment fields potentially leaked (defense-in-depth relies on Fastify serialization alone); the frontend `handleGrant` function providing no user feedback on API error; and compiled `.js` artifacts checked in alongside `.tsx` source.

---

## Critical Issues

### CR-01: `list()` service omits CPF/phone/email but route schema advertises them — silent data contract break

**File:** `apps/api/src/modules/admin-clients/admin-clients.service.ts:39-48`

**Issue:** The `select` clause in `AdminClientsService.list()` fetches only `id`, `name`, `condominiumId`, `apartment`, `block`, `creditBalance`, `isBlocked`, and `createdAt`. The route schema at `admin-clients.route.ts:43-45` declares `cpf`, `phone`, and `email` as response properties. These fields will never be present in the actual response. Additionally, `condominiumName` is declared in the route schema (line 48) but is never resolved — only `condominiumId` is returned. Any frontend code depending on these declared fields will silently receive `undefined`.

**Fix:**
Either add the missing fields to the select clause and resolve `condominiumName` via a join, or remove the fields from the route schema to match the actual response:

```typescript
// Option A — add fields to select
select: {
  id: true,
  name: true,
  cpf: true,
  phone: true,
  email: true,
  condominiumId: true,
  apartment: true,
  block: true,
  creditBalance: true,
  isBlocked: true,
  createdAt: true,
},
```

Or remove `cpf`, `phone`, `email`, and `condominiumName` from the route schema `response[200].items.properties` if those fields are intentionally excluded.

---

### CR-02: `getDetail()` and `grantCredits()` expose sensitive payment fields via full `user` object spread

**File:** `apps/api/src/modules/admin-clients/admin-clients.controller.ts:61` and `apps/api/src/modules/admin-clients/admin-clients.service.ts:163-167`

**Issue:** `getDetail` calls `prisma.user.findUnique` with no `select` clause (service line 75), then the controller spreads the full result into the HTTP response body (`{ ...result.client, ... }` at controller line 61). The `User` model contains `cardTokenMp`, `mpCustomerId`, `autoRecharge` (JSON payment config), and `oneSignalPlayerId`. These are sensitive payment and notification credentials.

For `grantCredits`, `prisma.user.update` at service line 163 also has no `select` clause, so `updatedUser` holds the full `User` object including payment fields. The controller sends it directly (`reply.status(200).send(result)`).

Fastify's response schema serialization (`fast-json-stringify`) will filter to declared fields only, but this is an implicit server-side guard — the full object with payment tokens is constructed and passed through the entire request pipeline before being filtered. An accidental removal of the response schema, a middleware that logs request/response bodies, or a future code path that bypasses the schema would leak these fields.

**Fix:**
Add explicit `select` clauses to exclude payment fields at the database query level:

```typescript
// In getDetail() — add select to findUnique
const user = await this.prisma.user.findUnique({
  where: { id },
  select: {
    id: true, name: true, cpf: true, phone: true, email: true,
    condominiumId: true, apartment: true, block: true,
    creditBalance: true, isBlocked: true, createdAt: true,
    // explicitly NO: cardTokenMp, mpCustomerId, autoRecharge, oneSignalPlayerId
  },
})

// In grantCredits() — add select to user.update
this.prisma.user.update({
  where: { id: clientId },
  data: { creditBalance: { increment: quantity } },
  select: { id: true, creditBalance: true },
})
```

---

### CR-03: `NotificationsScreen` handles `OUT_FOR_DELIVERY` as a notification type — it does not exist in `NotificationType` enum

**File:** `apps/web/src/pages/client/NotificationsScreen.tsx:20,28,44`

**Issue:** The `NotificationType` enum in the Prisma schema defines: `DELIVERY_EVE`, `DELIVERY_DONE`, `LOW_CREDIT`, `CUTOFF`, `RECONFIGURE`, `CREDIT_PURCHASED`, `CREDIT_GRANTED`. The value `OUT_FOR_DELIVERY` is an `OrderStatus` enum value, not a notification type. It will never arrive in a `Notification.type` field from the backend. The three references in `NotificationsScreen` (`getTone`, `getIcon`, `CTA_CONFIG`) are dead code that will never execute, and `CREDIT_PURCHASED` and `CUTOFF` (valid notification types) have no icon, tone, or CTA handling — they fall through to defaults silently.

**Fix:** Remove `OUT_FOR_DELIVERY` from all three maps and add handling for the two missing valid types:

```typescript
// getTone — add CREDIT_PURCHASED to 'gold', CUTOFF to 'neutral'
if (['DELIVERY_EVE', 'DELIVERY_DONE'].includes(type)) return 'good'
if (['LOW_CREDIT', 'CREDIT_GRANTED', 'CREDIT_PURCHASED'].includes(type)) return 'gold'
return 'neutral'  // catches CUTOFF, RECONFIGURE, unknown

// getIcon — add CREDIT_PURCHASED and CUTOFF
if (type === 'CREDIT_PURCHASED') return 'coin'
if (type === 'CUTOFF') return 'alert'
// remove: if (type === 'OUT_FOR_DELIVERY') return 'truck'

// CTA_CONFIG — remove OUT_FOR_DELIVERY, add CREDIT_PURCHASED
CREDIT_PURCHASED: { label: 'Ver saldo', path: '/client/creditos' },
// remove OUT_FOR_DELIVERY entry
```

---

### CR-04: Logout does not revoke the server-side session — token remains valid after client-side clear

**File:** `apps/web/src/contexts/AuthContext.tsx:63-72`

**Issue:** The `logout` function only removes `auth_token`/`auth_user` from `localStorage` and clears React state. It does not call any backend endpoint to revoke the session in the `Session` collection. The backend has a full `revokeSession` mechanism (`auth.repository.ts:61-63`) and the `Session` model has an `isRevoked` field. After logout, the raw token previously stored in `localStorage` remains valid on the server until its `expiresAt` date. Any actor with the token (e.g., grabbed from browser history, a shared/stolen device, or a compromised extension) can continue making authenticated API requests.

The `AdminBottomNav.tsx` and `CourierScreen.tsx` both call `logout` directly — this issue affects all three user roles.

**Fix:** Add a backend logout endpoint and call it before clearing local state:

```typescript
// AuthContext.tsx
logout: async () => {
  try {
    await apiFetch('/auth/logout', { method: 'POST' })
  } catch {
    // best-effort — always clear local state
  } finally {
    try {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
    } catch { /* iOS Safari private mode */ }
    setToken(null)
    setUser(null)
    navigate('/')
  }
},
```

Backend endpoint must call `authRepository.revokeSession(sessionId)` for the current token.

---

## Warnings

### WR-01: `handleGrant` silently swallows API errors — no user feedback on grant failure

**File:** `apps/web/src/components/admin/ClientDetailView.tsx:106-129`

**Issue:** When `POST /admin/clients/:id/grant-credits` returns a non-2xx status (`!res.ok`), the `handleGrant` function takes no action — no toast, no error state, no user message. The `catch` block is also silent. The admin receives no feedback that the credit grant failed. This contrasts with `handleConfirmarBloqueio` at line 131, which correctly shows a `blockError` on failure.

**Fix:**
```typescript
if (res.ok) {
  // ... existing success path
} else {
  setToast({ message: 'Falha ao adicionar créditos. Tente novamente.', ok: false })
  setTimeout(() => setToast(null), 3000)
}
```
The toast already exists in the component and should be used for error reporting.

---

### WR-02: `grantQty` accepts `NaN` from empty input — bypasses `< 1` guard and sends `NaN` to backend

**File:** `apps/web/src/components/admin/ClientDetailView.tsx:647`

**Issue:** `setGrantQty(Number(e.target.value))` — when the user clears the input field, `e.target.value` is `""` and `Number("")` returns `0`. When the user types a non-numeric value, `Number(...)` returns `NaN`. The guard `grantQty < 1` evaluates `NaN < 1` as `false`, meaning the button is enabled and `JSON.stringify({ quantity: NaN })` will serialize as `{"quantity":null}`, which passes `null` to the backend. The Zod schema (`z.number().int().min(1)`) will reject `null` but the error is swallowed silently (WR-01 above).

**Fix:**
```typescript
onChange={(e) => {
  const parsed = parseInt(e.target.value, 10)
  setGrantQty(isNaN(parsed) ? 1 : parsed)
}}
```

---

### WR-03: `grantCredits` test for `$transaction` success does not validate `NotificationsService` is called — test can pass with broken notification path

**File:** `apps/api/src/modules/admin-clients/__tests__/admin-clients.service.test.ts:298-307`

**Issue:** The test mocks `prisma.notification` at the Prisma level but `AdminClientsService.grantCredits` instantiates `new NotificationsService(this.fastify)` and calls `createAndTrim`, which in turn calls `prisma.notification.create` then `prisma.notification.findMany` then conditionally `prisma.notification.deleteMany`. The test only asserts `prisma.$transaction` was called and `result.creditBalance === 15`. If `createAndTrim` throws (e.g. due to missing mock setup), the test will fail for the wrong reason — or if `NotificationsService` is refactored to not use `prisma.notification.create` directly, the test will continue to pass while the notification path is broken.

**Fix:** Either mock `NotificationsService` at the module level or assert on `prisma.notification.create` being called after `grantCredits`:

```typescript
vi.mock('../notifications/notifications.service.js', () => ({
  NotificationsService: vi.fn().mockImplementation(() => ({
    createAndTrim: vi.fn().mockResolvedValue(undefined),
  })),
}))
// Then assert createAndTrim was called with the correct arguments
```

---

### WR-04: `AdminBottomNav.js` compiled artifact is checked into source control alongside `.tsx`

**File:** `apps/web/src/components/admin/AdminBottomNav.js`

**Issue:** The repository contains both `AdminBottomNav.tsx` (TypeScript source) and `AdminBottomNav.js` (compiled JavaScript output). The `.js` file is a full compiled version of the component including the JSX runtime transform. This pattern exists across the entire `admin/` directory (and likely the codebase). Checked-in compiled artifacts create drift risk: the `.js` file may fall out of sync with the `.tsx` source when the source is edited. Build tools may also pick up the wrong file depending on module resolution order, causing subtle behavioral discrepancies between development and production.

**Fix:** Add `*.js` (or the compiled output directory) to `.gitignore` if these are generated artifacts. If they are intentional (e.g., for a non-Vite consumer), add a CI check that verifies `.js` is in sync with `.tsx`.

---

### WR-05: `resumoAgendamento` displays quantity from only the first scheduled day — misleading when days have different quantities

**File:** `apps/web/src/components/admin/ClientDetailView.tsx:65-66`

**Issue:** The `resumoAgendamento` helper collects all days with `qty > 0`, formats their names, but then takes `qtdExemplo = entries[0][1]` and displays only the first day's quantity as if it represents all days (e.g., "Seg, Qua, Sex — 2 pães"). If the schedule has Monday=2 and Wednesday=3 and Friday=1, the display shows "Seg, Qua, Sex — 2 pães", which misrepresents Wednesday and Friday quantities. Admins using this to assess a client's usage will see incorrect data.

**Fix:** Either display each day's quantity individually, or compute a total/range:
```typescript
const total = entries.reduce((sum, [, qty]) => sum + qty, 0)
return `${dias} — ${total} pão${total !== 1 ? 's' : ''}/sem`
```

---

## Info

### IN-01: `blockClient` alias on service should be removed — it is dead code in production

**File:** `apps/api/src/modules/admin-clients/admin-clients.service.ts:203-220`

**Issue:** `blockClient` is documented as a "retroactive alias for compatibility with Wave 0 tests". It is tested in the test file (line 275-293) but is not exposed via any route — only `blockToggle` is wired in `admin-clients.route.ts`. Dead production code that exists solely for test compatibility is a maintenance liability and indicates the test should be updated to use `blockToggle` directly.

**Fix:** Update the test to call `blockToggle` and remove the `blockClient` method from the service.

---

### IN-02: `CourierScreen` logout button has no confirmation dialog — inconsistent UX with admin logout

**File:** `apps/web/src/pages/courier/CourierScreen.tsx:108-124`

**Issue:** The courier logout button (comment says "D-08: sem dialog, clique direto") fires `logout` immediately on click. The admin logout (implemented this phase) shows a confirmation dialog. If this is intentional per spec, the comment is sufficient. However, the courier can accidentally trigger logout with a single tap while confirming a delivery. This is a UX inconsistency worth documenting if intentional, or correcting if not.

**Fix:** If the spec requires no dialog for couriers, document the reason in the UI spec. If unintentional, add a confirmation dialog matching the admin pattern.

---

### IN-03: `useOneSignalDeepLink` — `navigate` in the dependency array causes listener re-registration on every render

**File:** `apps/web/src/hooks/useOneSignalDeepLink.ts:58`

**Issue:** `useNavigate` from React Router returns a stable function reference (documented in React Router docs as stable), so this is generally safe. However, `navigate` is included in the `useEffect` dependency array, which means if the reference ever changes (e.g., on router context change), the listener will be removed and re-added. This is minor, but using an empty dependency array `[]` with a `useRef` to capture navigate is the more robust pattern for event listener hooks that should register once.

**Fix:**
```typescript
const navigateRef = useRef(navigate)
useEffect(() => { navigateRef.current = navigate }, [navigate])

useEffect(() => {
  // ... use navigateRef.current inside handleClick
}, []) // empty deps — register once
```

---

_Reviewed: 2026-06-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
