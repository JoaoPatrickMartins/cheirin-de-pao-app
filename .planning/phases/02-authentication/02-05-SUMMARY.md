---
phase: 02-authentication
plan: 05
subsystem: auth
tags: [react, registration, onboarding, otp, stepper, admin, courier]

requires:
  - phase: 02-03
    provides: AuthContext, useAuth, ProtectedRoute, LoadingScreen, router with /register lazy route

provides:
  - OnboardingScreen: 5-step client registration stepper fully wired to API
  - StepDots: progress indicator with animated active dot
  - ChannelSelector: SMS/E-mail toggle with auto-select logic (AUTH-04)
  - CondoSearch: searchable condominium list with empty state
  - OtpInput: 4-digit input component with auto-focus and backspace navigation (plan 04 dep)
  - ResendTimer: 30-second countdown timer enabling resend action (plan 04 dep)
  - apiFetch: centralized fetch wrapper injecting Authorization Bearer + X-Device-Id headers (plan 04 dep)
  - CourierRegisterScreen: admin form to register courier via POST /auth/couriers
  - /admin/couriers/new nested route in router

affects: [02-04-login-screen, 03-client-home, 05-admin-panel]

tech-stack:
  added: []
  patterns:
    - "All hooks declared before any conditional return — Rules of Hooks compliance"
    - "CPF formatted for display (000.000.000-00) but raw 11 digits sent to API via stripCpf()"
    - "apiFetch auto-injects Authorization Bearer + X-Device-Id — callers pass plain body objects"
    - "ChannelSelector auto-select: phone-only → SMS; email-only → email; both → keep current"
    - "CondoSearch internal query state + filter (case-insensitive) + empty state"
    - "OnboardingScreen step 2 loads GET /condominiums on useEffect mount, not at component mount"
    - "Block/Tower chips visible only when selectedCondo.type === 'BLOCKS'"
    - "Step 4 OTP: OtpInput.onComplete auto-submits; PrimaryBtn as fallback CTA"
    - "CourierRegisterScreen: all useState hooks before role guard Navigate conditional return"

key-files:
  created:
    - apps/web/src/lib/apiFetch.ts
    - apps/web/src/components/auth/StepDots.tsx
    - apps/web/src/components/auth/ChannelSelector.tsx
    - apps/web/src/components/auth/CondoSearch.tsx
    - apps/web/src/components/auth/OtpInput.tsx
    - apps/web/src/components/auth/ResendTimer.tsx
    - apps/web/src/pages/auth/OnboardingScreen.tsx
    - apps/web/src/pages/admin/CourierRegisterScreen.tsx
  modified:
    - apps/web/src/routes/router.tsx

key-decisions:
  - "OtpInput and ResendTimer implemented in plan 05 (not 04) — parallel wave 4, plan 05 needs them for OnboardingScreen step 4"
  - "apiFetch body: callers pass JSON.stringify(obj); apiFetch receives string, passes through unchanged; Content-Type: application/json always set"
  - "CourierRegisterScreen hooks-before-guard pattern: all useState declarations before Navigate conditional return"
  - "Step 2 condo load triggered by useEffect dep [step] — only fetched when step === 2"

metrics:
  duration: ~60min
  completed: 2026-06-14
  tasks_completed: 2
  files_created: 8
  files_modified: 1
---

# Phase 02 Plan 05: Client Registration + Admin Courier Screen Summary

**5-step client registration stepper fully wired to API, admin courier registration form, and 3 shared auth components (apiFetch, OtpInput, ResendTimer) implemented as wave-4 parallel dependency.**

## Accomplishments

- **apiFetch** (`apps/web/src/lib/apiFetch.ts`): Centralized fetch wrapper. Reads `device_id` from localStorage (creates UUID v4 via `crypto.randomUUID()` on first call). Injects `X-Device-Id` header always. Injects `Authorization: Bearer <token>` if `auth_token` in localStorage. Base URL from `VITE_API_URL` env var, defaults to `http://localhost:3001`.

- **StepDots** (`apps/web/src/components/auth/StepDots.tsx`): 5-dot progress indicator. Active dot: 24×8px, `--color-accent`, radius 99px. Inactive: 8×8px, `--color-border`. Transition `width + background 0.25s ease`.

- **ChannelSelector** (`apps/web/src/components/auth/ChannelSelector.tsx`): SMS/E-mail toggle with auto-select. Phone-only → SMS pre-selected; email-only → email pre-selected; both → keeps current. Disabled channel gets `opacity: 0.5`. Selected: `--color-gold-soft` bg, `--color-accent` border+text.

- **CondoSearch** (`apps/web/src/components/auth/CondoSearch.tsx`): Searchable condo list with internal query state. Case-insensitive name filter. Empty state: building icon + "Seu condomínio ainda não é parceiro." Selected card has `--color-accent` border + check icon.

- **OtpInput** (`apps/web/src/components/auth/OtpInput.tsx`): 4 inputs 64×72px. Auto-focus next on digit entry. Backspace on empty input focuses previous. `onComplete` fires when all 4 filled. Filled border `--color-accent`, empty `--color-border`.

- **ResendTimer** (`apps/web/src/components/auth/ResendTimer.tsx`): 30-second countdown. "Não chegou? Reenviar em M:SS" (color-text-ter). At 0: "Não chegou? Reenviar código" (color-accent). Resets on each resend.

- **OnboardingScreen** (`apps/web/src/pages/auth/OnboardingScreen.tsx`): 5-step stepper.
  - Step 0: nome, CPF (formatted display, raw 11-digit API), dataNascimento. CTA disabled until all non-empty.
  - Step 1: telefone + email + ChannelSelector. Auto-selects channel via useEffect. CTA disabled until at least one contact non-empty.
  - Step 2: CondoSearch loads `GET /condominiums` on `useEffect([step])` when step = 2. Empty state when API returns [].
  - Step 3: selected condo name + neighborhood subtitle. Block/Tower chips only when `condo.type === 'BLOCKS'`. Apartment field. CTA "Enviar código de confirmação" → `POST /auth/register` → `userId` → `POST /auth/otp/send` → step 4. 409 shows "Esse CPF já tem uma conta."
  - Step 4: OTP input + ResendTimer. `onComplete` → `POST /auth/otp/verify` → `auth.login(token, user)` → `navigate('/client')`.

- **CourierRegisterScreen** (`apps/web/src/pages/admin/CourierRegisterScreen.tsx`): 4-field form (nome, CPF, telefone, email). All `useState` hooks before role guard. `POST /auth/couriers` (admin bearer auto-injected). Success state with check icon + "Entregador cadastrado com sucesso!" + back button.

- **router.tsx**: `/admin` route now has `children` with `{ path: 'couriers/new', lazy: CourierRegisterScreen }`. AdminLayout already renders `<Outlet />`.

## Verification

- `npx tsc --noEmit -p apps/web/tsconfig.json` exits 1 with exactly 1 expected error: LoginScreen not found (plan 04, parallel wave 4 — not blocking)
- `npm run test --workspace=@cheirin-de-pao/web` exits 0 (10 todo tests, 4 skipped — expected)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed React Rules of Hooks violation in CourierRegisterScreen**
- **Found during:** Task 2 implementation
- **Issue:** Initial implementation had `Navigate` conditional return before `useState` declarations — violates React Rules of Hooks (hooks after conditional return)
- **Fix:** Moved all `useState` declarations before the role guard conditional return
- **Files modified:** `apps/web/src/pages/admin/CourierRegisterScreen.tsx`
- **Commit:** aae2fd8

### Missing Dependency (Wave 4 Parallel Execution)

**2. [Rule 3 - Blocking] Implemented plan 04 artifacts (OtpInput, ResendTimer, apiFetch) within plan 05**
- **Found during:** Task 1 — OnboardingScreen step 4 requires OtpInput and ResendTimer; all screens require apiFetch
- **Issue:** Plans 04 and 05 run in parallel in wave 4. Plan 05 `depends_on: [02-03]` only, but needs artifacts from plan 04
- **Fix:** Implemented OtpInput, ResendTimer, and apiFetch as part of plan 05's Task 1 commit, matching plan 04's spec from 02-04-PLAN.md. Plan 04 agent will commit either identical files or encounter a merge-time no-op
- **Files created:** `apps/web/src/components/auth/OtpInput.tsx`, `apps/web/src/components/auth/ResendTimer.tsx`, `apps/web/src/lib/apiFetch.ts`
- **Commit:** 90a8267

## Known Stubs

None. All components are fully wired to API endpoints.

## Threat Model Review

All T-02-16 through T-02-20 mitigations applied:
- T-02-16: "Enviar código de confirmação" disabled while loading (single tap protection)
- T-02-17: CPF stripped with `/\D/g` before sending; server-side validation in CpfSchema
- T-02-18: CourierRegisterScreen checks `user.role === 'ADMIN'` before rendering; API preHandler also checks
- T-02-20: Block field only enabled when `condoType === 'BLOCKS'`

## Self-Check: PASSED

Files confirmed present:
- apps/web/src/lib/apiFetch.ts
- apps/web/src/components/auth/StepDots.tsx
- apps/web/src/components/auth/ChannelSelector.tsx
- apps/web/src/components/auth/CondoSearch.tsx
- apps/web/src/components/auth/OtpInput.tsx
- apps/web/src/components/auth/ResendTimer.tsx
- apps/web/src/pages/auth/OnboardingScreen.tsx
- apps/web/src/pages/admin/CourierRegisterScreen.tsx
- apps/web/src/routes/router.tsx

Commits confirmed: 90a8267, aae2fd8
