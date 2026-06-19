---
phase: 8
slug: finalizacao-pagamentos
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-18
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `cd apps/api && npm test -- payments.service.test.ts webhooks.service.test.ts` |
| **Full suite command** | `cd apps/api && npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && npm test -- payments.service.test.ts webhooks.service.test.ts`
- **After every plan wave:** Run `cd apps/api && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-audit-pix | audit | 1 | CRED-01 / PAY-01 | T-08-01 | `createPix` retorna `qr_code_base64` e `qr_code` | unit | `cd apps/api && npm test -- payments.service.test.ts` | ✅ | ⬜ pending |
| 08-audit-card | audit | 1 | CRED-01 / PAY-02 | T-08-02 | `createCard` salva payment e retorna `paymentId` | unit | `cd apps/api && npm test -- payments.service.test.ts` | ✅ | ⬜ pending |
| 08-audit-webhook | audit | 1 | CRED-01 | T-08-03 | `reconcilePayment` credita após `approved` + idempotência | unit | `cd apps/api && npm test -- webhooks.service.test.ts` | ✅ | ⬜ pending |
| 08-audit-webhook-avulso | audit | 1 | CRED-03 | — | `reconcilePayment` com `customQuantity` credita corretamente | unit | `cd apps/api && npm test -- webhooks.service.test.ts` | ❌ W0 | ⬜ pending |
| 08-push-lowcredit | cron | 2 | CRED-09 | — | Push disparado quando `saldo < consumoSemanal` e sem auto-recharge | unit | `cd apps/api && npm test -- schedules.service.test.ts` | ❌ W0 | ⬜ pending |
| 08-home-banner | frontend | 2 | UI-04 | — | HomeScreen renderiza BannerInsuficiente quando `creditBalance=0` | manual | Verificar em browser com saldo zerado | — | ⬜ pending |
| 08-tabbar | frontend | 2 | UI-08 | — | Aba "Créditos" ativa em `/client/creditos/*` | manual | Navegar para `/client/creditos/pix` e verificar tab ativa | — | ⬜ pending |
| 08-pix-e2e | sandbox | 3 | PAY-01 | — | Fluxo Pix end-to-end: QR → sandbox → webhook → saldo atualizado | manual/sandbox | ngrok + dashboard MP sandbox + testar no browser | — | ⬜ pending |
| 08-card-e2e | sandbox | 3 | PAY-02 | — | Fluxo cartão end-to-end: Brick → token → backend → saldo atualizado | manual/sandbox | Dados de teste MP sandbox + testar no browser | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/modules/webhooks/__tests__/webhooks.service.test.ts` — confirmar/criar caso `customQuantity` para CRED-03
- [ ] `apps/api/src/modules/schedules/__tests__/schedules.service.test.ts` — criar case para `sendLowCreditNotifications` (nova função para CRED-09)
- [ ] Verificar `apps/api/src/modules/credits/__tests__/credits.service.test.ts` — cobertura de `getPricing` e `checkBalance`

*Wave 0 também inclui user_setup blocking para credenciais MP sandbox e ngrok — sem testes automatizados possíveis antes disso.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fluxo Pix end-to-end com sandbox MP | PAY-01 | Requer ngrok + dashboard MP + QR code real | `ngrok http 3001`, configurar webhook no dashboard MP sandbox, comprar combo com Pix, aguardar polling e verificar saldo atualizado |
| Fluxo cartão com MP Bricks sandbox | PAY-02 | Requer MP_PUBLIC_KEY + dados de cartão de teste | Usar dados de teste MP (`4235647728025682`), completar compra e verificar saldo |
| BannerInsuficiente na HomeA | UI-04 | Componente React — sem framework de teste frontend configurado | Zerar saldo manualmente no Atlas, recarregar HomeScreen, verificar banner visível |
| Tab bar — aba Créditos ativa | UI-08 | Comportamento visual — sem framework de teste frontend | Navegar para `/client/creditos/pix` e verificar que aba "Créditos" está com ícone dourado |
| NextDays com dados reais | UI-07 | Fluxo integrado (schedule + frontend) | Ter agendamento ativo, verificar que próximos 5 dias aparecem com quantidade e pill gold |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
