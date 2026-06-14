---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-13
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (Wave 0 installs) |
| **Config file** | `apps/web/vitest.config.ts` — Wave 0 gap |
| **Quick run command** | `cd apps/web && npx vitest run --reporter=dot` |
| **Full suite command** | `turbo run test typecheck` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npx vitest run --reporter=dot`
- **After every plan wave:** Run `turbo run test typecheck`
- **Before `/gsd:verify-work`:** Full suite green + `npx prisma validate` + `/health` returns 200
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-infra-01 | infra | 0 | INFRA-01 | — | N/A | smoke | `npm run dev` (manual) | ❌ Wave 0 | ⬜ pending |
| 01-infra-04 | infra | 1 | INFRA-04 | — | N/A | smoke | `cd apps/api && npx prisma validate` | ❌ Wave 0 | ⬜ pending |
| 01-infra-07 | infra | 1 | INFRA-07 | — | N/A | smoke | `curl http://localhost:3001/health` | ❌ Wave 0 | ⬜ pending |
| 01-pwa-01 | pwa | 2 | PWA-01 | — | N/A | smoke | `curl http://localhost:5173/manifest.webmanifest` | ❌ Wave 0 | ⬜ pending |
| 01-pwa-02 | pwa | 2 | PWA-02 | — | N/A | unit | `vitest run src/hooks/useInstallPrompt.test.ts` | ❌ Wave 0 | ⬜ pending |
| 01-pwa-03 | pwa | 2 | PWA-03 | — | N/A | unit | `vitest run src/hooks/useInstallPrompt.test.ts` | ❌ Wave 0 | ⬜ pending |
| 01-ui-03 | ui | 2 | UI-03 | — | N/A | unit | `vitest run src/components/brand/BreadMark.test.tsx` | ❌ Wave 0 | ⬜ pending |
| 01-ui-05 | ui | 2 | UI-05 | — | N/A | unit | `vitest run src/pages/splash/SplashScreen.test.tsx` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/vitest.config.ts` — configure Vitest with jsdom + @testing-library/react
- [ ] `apps/web/src/hooks/useInstallPrompt.test.ts` — stubs for PWA-02, PWA-03
- [ ] `apps/web/src/components/brand/BreadMark.test.tsx` — stub for UI-03
- [ ] `apps/web/src/pages/splash/SplashScreen.test.tsx` — stub for UI-05
- [ ] Framework install: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Android install banner fires | PWA-02 | Requires physical device + HTTPS | Access app on Android Chrome, verify Add to Home Screen prompt appears |
| iOS step-by-step banner shows | PWA-03 | Requires physical iOS 16.4+ device | Access app on Safari iOS, verify custom banner with ⬆ → Adicionar à Tela Inicial instruction |
| PWA opens standalone (no browser chrome) | PWA-01 | Requires installed PWA | Install app, launch from home screen, verify no URL bar |
| Splash screen renders correctly | UI-05 | Visual verification | Check espresso background #1E1207, gold BreadMark symbol, correct typography |
