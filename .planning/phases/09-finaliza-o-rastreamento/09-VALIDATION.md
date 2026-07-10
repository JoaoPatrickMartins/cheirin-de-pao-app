---
phase: 09
slug: finaliza-o-rastreamento
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-19
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (latest) + @testing-library/react |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `cd apps/web && npm test` |
| **Full suite command** | `cd apps/web && npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npm test`
- **After every plan wave:** Run `cd apps/web && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 0 | ACOMP-01, ACOMP-04 | — | N/A | unit | `cd apps/web && npm test -- TrackingScreen` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 0 | ACOMP-05 | — | N/A | unit | `cd apps/web && npm test -- NotificationsScreen` | ❌ W0 | ⬜ pending |
| 09-01-03 | 01 | 0 | ACOMP-05 | — | N/A | unit | `cd apps/web && npm test -- NotifContext` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 1 | ACOMP-02 | — | notification.data propagada corretamente | manual | manual-only (cron) | — | ⬜ pending |
| 09-02-02 | 02 | 1 | ACOMP-03 | — | notification.data propagada corretamente | manual | manual-only | — | ⬜ pending |
| 09-03-01 | 03 | 1 | ACOMP-05 | T-09-01 | notificações só lidas pelo próprio userId (JWT) | unit | `cd apps/web && npm test -- NotifContext` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/src/pages/client/__tests__/TrackingScreen.test.tsx` — stubs para ACOMP-01, ACOMP-04
- [ ] `apps/web/src/pages/client/__tests__/NotificationsScreen.test.tsx` — stubs para ACOMP-05 (CTA_CONFIG, badge sync)
- [ ] `apps/web/src/contexts/__tests__/NotifContext.test.tsx` — stubs para ACOMP-05 (context value, refresh)

---

## Security Threat Model

| ID | Ameaça | Severidade | Mitigação | Status |
|----|--------|-----------|-----------|--------|
| T-09-01 | Usuário lê notificações de outro userId | HIGH | `preHandler: [fastify.authenticate]` já em todos os endpoints `/notifications/*`; userId extraído do JWT [VERIFICADO] | ✅ Mitigado |

> Nenhum novo endpoint de auth, sessão ou input externo nesta fase — escopo de segurança é restrito ao acesso às notificações existentes.
