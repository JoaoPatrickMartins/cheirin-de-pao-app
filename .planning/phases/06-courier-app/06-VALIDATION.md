---
phase: 6
slug: courier-app
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-15
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (latest) |
| **Config file** | `apps/api/vitest.config.ts` e `apps/web/vitest.config.ts` (existentes) |
| **Quick run command** | `npm run test --workspace=apps/api` |
| **Full suite command** | `npm run test` (raiz Turborepo) |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test --workspace=apps/api`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | COUR-01 | T-06-01 | `getTodayOrders` filtra por `courierId` do entregador logado | unit | `vitest run apps/api/src/modules/courier/__tests__/courier.service.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | COUR-01 | T-06-01 | Ordens sem `courierId` não aparecem na lista | unit | idem | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | COUR-02 | T-06-02 | `confirmDelivery` transição SCHEDULED/OUT_FOR_DELIVERY → DELIVERED | unit | idem | ❌ W0 | ⬜ pending |
| 06-01-04 | 01 | 1 | COUR-02 | T-06-02 | Order de outro entregador retorna 403 | unit | idem | ❌ W0 | ⬜ pending |
| 06-01-05 | 01 | 1 | COUR-03 | — | Rota retorna null quando OSRM falha (graceful degradation) | unit | idem | ❌ W0 | ⬜ pending |
| 06-01-06 | 01 | 1 | COUR-04 | — | Paradas ordenadas por apartment numérico crescente | unit | idem | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | COUR-05 | — | Card de progresso: contagem local atualiza corretamente | manual | — | Manual only | ⬜ pending |
| 06-02-02 | 02 | 2 | COUR-02 | — | Dialog de confirmação: cancela sem chamar API | manual | — | Manual only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/modules/courier/__tests__/courier.service.test.ts` — stubs para COUR-01, COUR-02, COUR-03, COUR-04
- [ ] `apps/api/src/modules/admin-orders/__tests__/admin-orders-assign.service.test.ts` — cobre D-11 (assign-courier endpoint)

*Infraestrutura de testes já existente — vitest configurado desde Fase 1.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Card de progresso atualiza contagem ao confirmar parada | COUR-05 | Interação de estado local React | 1. Abrir CourierScreen; 2. Confirmar parada; 3. Verificar X/N e barra animam |
| Dialog de confirmação cancela sem chamar API | COUR-02 | Interação de UI (modal) | 1. Tocar na parada; 2. Tocar "Cancelar"; 3. Verificar que PATCH não foi chamado (DevTools) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
