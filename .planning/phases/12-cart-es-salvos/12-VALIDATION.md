---
phase: 12
slug: cartoes-salvos
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-19
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` (raiz do monorepo) |
| **Quick run command** | `npm run test --workspace=apps/api -- --run` |
| **Full suite command** | `npm run test --workspace=apps/api -- --run && npm run test --workspace=apps/web -- --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test --workspace=apps/api -- --run`
- **After every plan wave:** Run `npm run test --workspace=apps/api -- --run && npm run test --workspace=apps/web -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | CARD-01..06 | T-12-01 | SavedCard schema válido, mpCustomerId não nulo | unit | `npm run test --workspace=apps/api -- --run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | CARD-02 | T-12-02 | CardToken criado com CVV antes de Payment.create | unit | `npm run test --workspace=apps/api -- --run` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 2 | CARD-01 | T-12-01 | GET /users/me/cards retorna apenas cartões do usuário autenticado | integration | `npm run test --workspace=apps/api -- --run` | ❌ W0 | ⬜ pending |
| 12-02-02 | 02 | 2 | CARD-05 | T-12-03 | setDefault usa $transaction — impossível ter 2 padrões simultâneos | unit | `npm run test --workspace=apps/api -- --run` | ❌ W0 | ⬜ pending |
| 12-03-01 | 03 | 3 | CARD-01,CARD-06 | — | N/A | manual | — | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/modules/saved-cards/__tests__/saved-cards.service.test.ts` — testes unitários do SavedCardsService
- [ ] `apps/api/src/modules/saved-cards/__tests__/saved-cards.routes.test.ts` — testes de rota (GET, DELETE, PATCH)
- [ ] `apps/api/src/modules/payments/__tests__/payments-card-saved.test.ts` — teste de fluxo de pagamento com cartão salvo

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fluxo completo de seleção de cartão salvo no browser | CARD-01, CARD-06 | Integração real com MP Customer API e Brick | Acessar /client/creditos/cartao com cartão salvo cadastrado; verificar que lista exibe, seleciona e paga corretamente |
| Fluxo de cadastro de novo cartão com salvar | CARD-02 | Requer credenciais MP reais e formulário Brick | Completar compra marcando "Salvar para compras futuras"; verificar cartão aparece nas próximas compras |
| Gerenciamento de cartões na SettingsScreen | CARD-05 | UI + chamadas reais de API | Verificar listagem (até 3), definição de padrão e remoção com confirmação |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
