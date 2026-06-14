---
phase: 3
slug: credits-commerce
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-14
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend + backend) |
| **Config file** | `apps/web/vitest.config.ts` / `apps/api/vitest.config.ts` |
| **Quick run command** | `npm run test --workspace=apps/api -- --reporter=verbose 2>&1 | grep -E "payments|PASS|FAIL"` |
| **Full suite command** | `npm run test --workspaces` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test --workspace=apps/api -- --testPathPattern=payments`
- **After every plan wave:** Run `npm run test --workspaces`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 0 | CRED-01 | — | creditBalance não negativo | unit | `npm test -- creditBalance` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | PAY-01 | T-03-01 | Pix criado via MP e QR retornado | unit | `npm run test --workspace=apps/api -- --reporter=verbose` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | PAY-02 | T-03-02 | Cartão processado via CardPayment Brick | unit | `npm run test --workspace=apps/api -- --reporter=verbose` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | CRED-05 | T-03-03 | Webhook HMAC validado antes de creditar | unit | `npm run test --workspace=apps/api -- --reporter=verbose` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 1 | UI-04 | — | Tab bar navega entre 4 seções | automated | `npm run test --workspace=apps/web -- --reporter=verbose 2>&1 \| grep -E "ClientTabBar"` | ❌ W0 | ⬜ pending |
| 03-04-02 | 04 | 1 | UI-07 | — | Tela Créditos exibe combos e avulsa | e2e-manual | manual | N/A | ⬜ pending |
| 03-05-01 | 05 | 4 | CRED-01 | T-03-09 | CombosScreen navega com state camelCase | automated | `npm run test --workspace=apps/web -- --reporter=verbose 2>&1 \| grep -E "CombosScreen"` | ❌ W0 | ⬜ pending |
| 03-06-01 | 06 | 5 | PAY-01 | T-03-12 | usePaymentPolling: cleanup + MAX_ATTEMPTS | automated | `npm run test --workspace=apps/web -- --reporter=verbose 2>&1 \| grep -E "usePaymentPolling"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Arquivos de stub criados pelo plano 03-01 T2. Nomes reais (conforme 03-01-PLAN.md):

### API (apps/api)
- [ ] `apps/api/src/modules/payments/__tests__/payments.service.test.ts` — stub para PAY-01, CRED-01, CRED-11
- [ ] `apps/api/src/modules/webhooks/__tests__/webhooks.service.test.ts` — stub para CRED-05 (HMAC), idempotência
- [ ] `apps/api/src/modules/credits/__tests__/credits.service.test.ts` — stub para CRED-03, CRED-04

### Web (apps/web)
- [ ] `apps/web/src/components/client/__tests__/QuantityStepper.test.tsx` — stub para UI-07
- [ ] `apps/web/src/components/client/__tests__/ClientTabBar.test.tsx` — stub para UI-08
- [ ] `apps/web/src/pages/client/__tests__/HomeScreen.test.tsx` — stub para UI-04, CRED-11
- [ ] `apps/web/src/pages/client/__tests__/CombosScreen.test.tsx` — stub para CRED-01 (navigate state camelCase)
- [ ] `apps/web/src/hooks/__tests__/usePaymentPolling.test.ts` — stub para cleanup clearInterval, MAX_ATTEMPTS

*Se infraestrutura de teste já existir da Fase 2, adicionar apenas os stubs acima.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fluxo completo Pix (QR → webhook → saldo) | PAY-01, CRED-03 | Requer sandbox Mercado Pago real | 1. Comprar combo via UI → copiar QR copia-e-cola → simular webhook via CLI MP → verificar saldo na Home |
| Fluxo cartão via CardPayment Brick | PAY-02, CRED-03 | Requer interação com iframe do MP | 1. Preencher Brick com cartão de teste → confirmar → verificar saldo atualizado |
| Tab bar + navegação 4 seções | UI-04 | Comportamento visual no browser | 1. Abrir app como cliente → verificar Início/Agenda/Créditos/Pedidos funcionam |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (8 stub files criados pelo 03-01 T2)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
