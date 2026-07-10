---
phase: 2
slug: authentication
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-13
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (frontend + api — api config is Wave 0) |
| **Config file (web)** | `apps/web/vitest.config.ts` (exists — jsdom, setupFiles: `src/test-setup.ts`) |
| **Config file (api)** | `apps/api/vitest.config.ts` — ❌ Wave 0 must create |
| **Config file (shared)** | `packages/shared/vitest.config.ts` (exists from Phase 1) |
| **Quick run command** | `npm run test --workspace=@cheirin-de-pao/web` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds (web unit tests); ~10s full suite after Wave 0 |

---

## Sampling Rate

- **After every task commit:** Run `npm run test --workspace=@cheirin-de-pao/web`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green + manual success criteria checklist
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-??-01 | schema | 1 | AUTH-01..08 | — | Session/OtpCode models added to schema.prisma | manual | `npx prisma validate` | ✅ W0 | ⬜ pending |
| 02-??-02 | shared | 1 | AUTH-02 | — | CPF módulo 11 rejects invalid CPFs | unit | `npm run test --workspace=@cheirin-de-pao/shared` | ❌ Wave 0 | ⬜ pending |
| 02-??-03 | api-auth | 1 | AUTH-03 | — | Zod superRefine blocks null block when condo type=blocks | unit | `npm run test --workspace=@cheirin-de-pao/api` | ❌ Wave 0 | ⬜ pending |
| 02-??-04 | api-auth | 1 | AUTH-05 | T-02-01 | OTP generates 4-digit code in range 1000-9999 | unit | `npm run test --workspace=@cheirin-de-pao/api` | ❌ Wave 0 | ⬜ pending |
| 02-??-05 | api-auth | 1 | AUTH-05 | T-02-01 | Dev mode bypass — OTP_DEV_CODE=1234 accepted | unit | `npm run test --workspace=@cheirin-de-pao/api` | ❌ Wave 0 | ⬜ pending |
| 02-??-06 | api-auth | 1 | AUTH-06 | T-02-02 | Expired session (expiresAt < now) returns 401 | unit | `npm run test --workspace=@cheirin-de-pao/api` | ❌ Wave 0 | ⬜ pending |
| 02-??-07 | api-auth | 1 | AUTH-06 | T-02-03 | Device mismatch revokes session + returns 401 | unit | `npm run test --workspace=@cheirin-de-pao/api` | ❌ Wave 0 | ⬜ pending |
| 02-??-08 | web-otp | 2 | UI-06 | — | OTP input focus advances to next digit on input | component | `npm run test --workspace=@cheirin-de-pao/web` | ❌ Wave 0 | ⬜ pending |
| AUTH-01 | web-reg | 2 | AUTH-01 | — | 5-step registration completes and user created in DB | manual | — | N/A | ⬜ pending |
| AUTH-04 | web-login | 2 | AUTH-04 | — | Channel auto-selected (SMS if phone, email if email-only) | manual | — | N/A | ⬜ pending |
| AUTH-07 | web-admin | 2 | AUTH-07 | — | Admin registers courier; courier can log in with OTP | manual | — | N/A | ⬜ pending |
| AUTH-08 | api-auth | 1 | AUTH-08 | — | Admin login with OTP redirects to /admin | manual | — | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/vitest.config.ts` — API test infrastructure (no test runner configured in Phase 1)
- [ ] `packages/shared/src/__tests__/cpf.test.ts` — stubs for AUTH-02 CPF validation
- [ ] `apps/api/src/__tests__/auth.service.test.ts` — stubs for AUTH-05 OTP generation + AUTH-06 session/device logic
- [ ] `apps/web/src/components/__tests__/OtpInput.test.tsx` — stub for UI-06 OTP focus behavior

*Wave 0 must complete before execution proceeds to Wave 1 API tasks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 5-step registration completes + user in DB | AUTH-01 | Requires Prisma + running server + browser | Run dev server, complete full 5-step onboarding as new user; verify User document in MongoDB Atlas |
| Session persists across app restart | AUTH-06 | Requires browser close/reopen sequence | Log in, close browser tab, reopen app — should land on profile screen without re-login |
| Admin registers courier + courier logs in | AUTH-07 | Requires two browser sessions | Admin creates courier via admin screen; log in as courier with OTP |
| Login redirects to correct profile screen | AUTH-08 | Requires role-based routing in browser | Log in as Admin, Client, Courier — verify each lands on /admin, /client, /courier |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
