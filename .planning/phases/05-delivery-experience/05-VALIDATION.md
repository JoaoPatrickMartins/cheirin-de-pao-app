---
phase: 5
slug: delivery-experience
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-15
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (API)** | Vitest — `apps/api/vitest.config.ts` |
| **Framework (Web)** | Vitest + jsdom — `apps/web/vitest.config.ts` |
| **Quick run command (API)** | `cd apps/api && npx vitest run` |
| **Quick run command (Web)** | `cd apps/web && npx vitest run` |
| **Full suite command** | `npm run test --workspace=apps/api && npm run test --workspace=apps/web` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && npx vitest run` + `cd apps/web && npx vitest run`
- **After every plan wave:** Run full suite (API + Web)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01 | 01 | 1 | ACOMP-01 | T-05-01 | `updateOrderStatus` valida VALID_TRANSITIONS — rejeita DELIVERED→SCHEDULED | unit | `npx vitest run apps/api/src/modules/admin-orders/__tests__/admin-orders.service.test.ts` | ❌ W0 | ⬜ pending |
| 05-02 | 01 | 1 | ACOMP-01 | T-05-02 | Endpoint admin usa `preHandler: [fastify.authenticate, fastify.requireAdmin]` | unit | idem | ❌ W0 | ⬜ pending |
| 05-03 | 02 | 1 | ACOMP-01 | — | `getTodayOrder()` usa offset BRT em UTC (BRAZIL_OFFSET_HOURS=3) | unit | `npx vitest run apps/api/src/modules/orders/__tests__/orders.service.test.ts` | ❌ W0 | ⬜ pending |
| 05-04 | 02 | 1 | ACOMP-01 | — | `useOrderTracking` poll 30s + cleanup no unmount | unit | `npx vitest run apps/web/src/hooks/__tests__/useOrderTracking.test.ts` | ❌ W0 | ⬜ pending |
| 05-05 | 03 | 2 | ACOMP-02 | — | `sendEveReminders()` busca orders do dia seguinte (não schedules) | unit | `npx vitest run apps/api/src/modules/schedules/__tests__/schedules.service.test.ts` | ❌ W0 | ⬜ pending |
| 05-06 | 03 | 2 | ACOMP-03 | — | Push DELIVERED disparado + Notification persistida ao marcar DELIVERED | unit | `npx vitest run apps/api/src/modules/admin-orders/__tests__/admin-orders.service.test.ts` | ❌ W0 | ⬜ pending |
| 05-07 | 03 | 2 | ACOMP-05 | — | Trim a 30 notificações por usuário no `create()` | unit | idem | ❌ W0 | ⬜ pending |
| 05-08 | 04 | 2 | ACOMP-04 | — | `getOrderHistory()` retorna apenas últimos 30 dias com orders | unit | `npx vitest run apps/api/src/modules/orders/__tests__/orders.service.test.ts` | ❌ W0 | ⬜ pending |
| 05-09 | 04 | 2 | ACOMP-05 | T-05-03 | `GET /notifications/me` usa userId do JWT, nunca do body | unit | `npx vitest run apps/api/src/modules/notifications/__tests__/notifications.service.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/modules/admin-orders/__tests__/admin-orders.service.test.ts` — stubs para ACOMP-01 (transições de status), ACOMP-03 (push DELIVERED), ACOMP-05 (persist Notification + trim 30)
- [ ] `apps/web/src/hooks/__tests__/useOrderTracking.test.ts` — stubs para ACOMP-01 (poll 30s, cleanup no unmount)
- [ ] `apps/api/src/modules/orders/__tests__/orders.service.test.ts` — ESTENDER: adicionar casos `getTodayOrder` (timezone BRT) e `getHistory` (últimos 30 dias)
- [ ] `apps/api/src/modules/schedules/__tests__/schedules.service.test.ts` — ESTENDER: adicionar caso `sendEveReminders` busca orders (não schedules)
- [ ] `apps/api/src/modules/notifications/__tests__/notifications.service.test.ts` — ESTENDER ou criar: casos `getByUserId` e `markAllRead`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Badge vermelho aparece na HomeScreen quando há notificações não lidas | ACOMP-05 | Requer renderização do app e verificação visual | Acessar HomeScreen com notificações pendentes; verificar badge no ícone de sino |
| Notificação push de véspera chega no device | ACOMP-02 | Requer device real com OneSignal registrado | Registrar device com OneSignal; disparar cron manualmente; verificar push recebido |
| Notificação push de entrega chega no device | ACOMP-03 | Requer device real com OneSignal registrado | Mudar status para DELIVERED via Admin; verificar push recebido no device |
| TrackingScreen exibe card de hoje + histórico corretamente | ACOMP-01 / ACOMP-04 | Layout visual de alta fidelidade | Acessar tela com pedido do dia ativo; verificar estados visuais dos 3 status |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
