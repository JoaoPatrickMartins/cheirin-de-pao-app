---
phase: 02-authentication
plan: 02-02
subsystem: api/auth
tags: [auth, otp, session, zod, prisma, zenvia, resend, unit-tests]
dependency_graph:
  requires: [02-01]
  provides: [auth-schema, auth-repository, auth-service, otp-service]
  affects: [02-02b]
tech_stack:
  added: [resend@6.12.4]
  patterns: [AuthRepository-receives-FastifyInstance, sha256-token-hashing, dev-bypass-NODE_ENV, device-mismatch-detection]
key_files:
  created:
    - apps/api/src/modules/auth/auth.schema.ts
    - apps/api/src/modules/auth/auth.repository.ts
    - apps/api/src/modules/auth/auth.service.ts
    - apps/api/src/modules/auth/otp.service.ts
  modified:
    - apps/api/src/__tests__/auth.service.test.ts
    - apps/api/tsconfig.json
decisions:
  - "All hashing uses node:crypto sha256 — no bcryptjs (per RESEARCH.md slopcheck [SUS] verdict)"
  - "Zenvia uses direct fetch (no @zenvia/sdk — vulnerable deps chain)"
  - "Dev bypass: NODE_ENV=development skips Zenvia/Resend, stores hash of OTP_DEV_CODE (default 1234)"
  - "Duplicate OTP guard: sendOtp() reuses existing non-expired OtpCode (Pitfall 5 from RESEARCH.md)"
  - "verifyOtpAndCreateSession revokes ALL sessions from OTHER devices when new session created"
  - "tsconfig.json extended with vitest/globals types to satisfy tsc --noEmit on test files"
metrics:
  duration: "~15 minutes"
  completed: "2026-06-14T03:39:03Z"
  tasks_completed: 1
  files_changed: 6
---

# Phase 02 Plan 02: Auth Business Logic Summary

**One-liner:** Complete auth business logic layer — Zod schemas, Prisma repository, AuthService (OTP generation, session creation, device mismatch, dev bypass), and OTP delivery (Zenvia fetch + Resend SDK), with 4 unit tests replacing Wave 0 stubs.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Auth schema, repository, service, OTP service | ef2f2b6 | auth.schema.ts, auth.repository.ts, auth.service.ts, otp.service.ts, auth.service.test.ts, tsconfig.json |

## Verification Results

```
npm run test --workspace=@cheirin-de-pao/api
  Test Files  1 passed (1)
       Tests  4 passed (4)
   Duration   277ms

npx tsc --noEmit -p apps/api/tsconfig.json
  Exit 0 — clean
```

Both verification commands exit 0.

## Success Criteria Check

- [x] auth.schema.ts exports RegisterSchema, SendOtpSchema, VerifyOtpSchema, RegisterCourierSchema
- [x] RegisterSchema .refine rejects body where both phone and email are undefined
- [x] auth.repository.ts exports AuthRepository class with all required methods (findUserByPhone, findUserByEmail, createUser, findActiveOtp, createOtp, markOtpUsed, createSession, findSessionByTokenHash, revokeSession, updateSessionLastUsed)
- [x] auth.service.ts exports AuthService with: generateOtpCode, hashValue, generateSessionToken, sendOtp, createSessionForUser, verifyOtpAndCreateSession, register, registerCourier
- [x] otp.service.ts exports sendSmsOtp and sendEmailOtp
- [x] auth.service.test.ts: 4 real tests passing (not it.todo)
- [x] `npm run test --workspace=@cheirin-de-pao/api` exits 0
- [x] `npx tsc --noEmit -p apps/api/tsconfig.json` exits 0
- [x] NODE_ENV=development + OTP_DEV_CODE=1234 test: service does not call Zenvia/Resend, stores hash of '1234'

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Added vitest/globals to API tsconfig.json**
- **Found during:** Task 1 verification — `npx tsc --noEmit` reported TS2582 errors (`describe`, `it`, `expect` not found)
- **Issue:** API `tsconfig.json` lacked `"types": ["vitest/globals"]`, causing TypeScript to not recognize Vitest globals
- **Fix:** Added `"types": ["vitest/globals"]` to `apps/api/tsconfig.json` compilerOptions — mirroring the existing pattern in `apps/web/tsconfig.json`
- **Files modified:** apps/api/tsconfig.json
- **Commit:** ef2f2b6

**Note:** All 4 source files (auth.schema.ts, auth.repository.ts, auth.service.ts, otp.service.ts) and the test file were already present from a prior partial execution. This plan execution verified correctness, confirmed tests pass, fixed the TypeScript compilation blocker, and committed the complete set.

## Known Stubs

None — all business logic is fully implemented. OTP delivery functions (sendSmsOtp, sendEmailOtp) require production credentials (ZENVIA_TOKEN, ZENVIA_FROM, RESEND_API_KEY, RESEND_FROM) but have a documented dev bypass via NODE_ENV=development.

## Threat Flags

No new security surface beyond what was defined in the plan's threat model.

## Self-Check

### Files exist:
- [x] apps/api/src/modules/auth/auth.schema.ts
- [x] apps/api/src/modules/auth/auth.repository.ts
- [x] apps/api/src/modules/auth/auth.service.ts
- [x] apps/api/src/modules/auth/otp.service.ts
- [x] apps/api/src/__tests__/auth.service.test.ts (4 real tests)
- [x] apps/api/tsconfig.json (vitest/globals added)

### Commits exist:
- [x] ef2f2b6 — feat(02-02): add auth business logic

## Self-Check: PASSED
