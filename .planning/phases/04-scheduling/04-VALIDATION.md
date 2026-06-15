---
phase: 4
slug: scheduling
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-14
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend) + Jest/supertest (backend) |
| **Config file** | `apps/web/vitest.config.ts` / `apps/api/jest.config.ts` |
| **Quick run command** | `npm run test --workspace=apps/web -- --run` |
| **Full suite command** | `npm run test --workspace=apps/web -- --run && npm run test --workspace=apps/api` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test --workspace=apps/web -- --run`
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | SCHED-01 | — | N/A | unit | `npm run test --workspace=apps/api -- --run` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | SCHED-02 | — | N/A | unit | `npm run test --workspace=apps/web -- --run` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | SCHED-03 | — | N/A | integration | `npm run test --workspace=apps/api -- --run` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 2 | SCHED-04 | — | N/A | unit | `npm run test --workspace=apps/web -- --run` | ❌ W0 | ⬜ pending |
| 04-05-01 | 05 | 3 | SCHED-05 | — | N/A | integration | `npm run test --workspace=apps/api -- --run` | ❌ W0 | ⬜ pending |
| 04-06-01 | 06 | 3 | SCHED-06 | — | N/A | unit | `npm run test --workspace=apps/web -- --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/__tests__/scheduling.test.ts` — stubs para SCHED-01, SCHED-03, SCHED-05
- [ ] `apps/web/src/__tests__/scheduling.test.tsx` — stubs para SCHED-02, SCHED-04, SCHED-06

*Framework já instalado nas fases anteriores.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pãezinhos chegam na porta no dia agendado | SCHED-01 | Requer ambiente de produção com entregador real | Verificar registro de entrega no painel admin |
| Notificação push chega ao cliente | SCHED-06 | Requer dispositivo real com PWA instalado | Agendar entrega e verificar push no dia |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
