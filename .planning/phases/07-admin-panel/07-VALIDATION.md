---
phase: 7
slug: admin-panel
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-15
---

# Phase 7 — Validation Strategy

> Contrato de validação por fase para amostragem de feedback durante a execução.

---

## Test Infrastructure

| Propriedade | Valor |
|-------------|-------|
| **Framework** | Vitest (latest) |
| **Config file API** | `apps/api/vitest.config.ts` |
| **Config file Web** | `apps/web/vitest.config.ts` |
| **Quick run command** | `npm run test --workspace=@cheirin-de-pao/api` |
| **Full suite command** | `npm run test -w apps/api && npm run test -w apps/web` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **Após cada commit de task:** `npm run test --workspace=@cheirin-de-pao/api`
- **Após cada wave completa:** `npm run test -w apps/api && npm run test -w apps/web`
- **Antes de `/gsd:verify-work`:** Suite completa deve estar verde
- **Max feedback latency:** ~30 segundos

---

## Per-Task Verification Map

| Task ID | Requirement | Comportamento | Tipo | Comando Automatizado | Arquivo Existe | Status |
|---------|-------------|--------------|------|---------------------|----------------|--------|
| 07-01-01 | ADMO-01 | Settings.cutoffTime salvo e lido | unit | `vitest run admin-settings.service.test.ts` | ❌ Wave 0 | ⬜ pending |
| 07-01-02 | ADMO-02 | Push enviado para clientes sem Order ao corte | unit (mock OneSignal) | `vitest run admin-settings.service.test.ts` | ❌ Wave 0 | ⬜ pending |
| 07-01-03 | ADMO-05 | PurchaseOrder criado com items corretos | unit | `vitest run admin-supplier-orders.service.test.ts` | ❌ Wave 0 | ⬜ pending |
| 07-01-04 | ADMO-08 | getBuffer() retorna Buffer > 0 bytes | unit (pdfmake mock) | `vitest run admin-supplier-orders.service.test.ts` | ❌ Wave 0 | ⬜ pending |
| 07-01-05 | PAY-04 | Estorno chama PaymentRefund.total() + debita créditos | unit (mock MP) | `vitest run admin-payments.service.test.ts` | ❌ Wave 0 | ⬜ pending |
| 07-01-06 | ADMG-10 | Bloquear cliente altera User.isBlocked | unit | `vitest run admin-clients.service.test.ts` | ❌ Wave 0 | ⬜ pending |
| 07-01-07 | ADMF-01 | Receita por período soma Payment.amount WHERE status=PAID | unit | `vitest run admin-financial.service.test.ts` | ❌ Wave 0 | ⬜ pending |
| 07-01-08 | UI-09 | AdminBottomNav renderiza 5 abas + aba ativa correta | component | `vitest run AdminBottomNav.test.tsx` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/modules/admin-settings/__tests__/admin-settings.service.test.ts`
- [ ] `apps/api/src/modules/admin-payments/__tests__/admin-payments.service.test.ts`
- [ ] `apps/api/src/modules/admin-supplier-orders/__tests__/admin-supplier-orders.service.test.ts`
- [ ] `apps/api/src/modules/admin-financial/__tests__/admin-financial.service.test.ts`
- [ ] `apps/api/src/modules/admin-clients/__tests__/admin-clients.service.test.ts`
- [ ] `apps/web/src/components/admin/__tests__/AdminBottomNav.test.tsx`
