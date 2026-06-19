---
phase: 10
slug: schema-v1-1-credito-manual-admin-logout
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-19
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (node environment — API; jsdom + @testing-library/react — Web) |
| **Config file (API)** | `apps/api/vitest.config.ts` |
| **Config file (Web)** | `apps/web/vitest.config.ts` |
| **Quick run API** | `cd apps/api && npx vitest run` |
| **Quick run Web** | `cd apps/web && npx vitest run` |
| **Full suite command** | `npm run test` (raiz — Turborepo) |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run (API ou Web conforme o arquivo modificado)
- **After every plan wave:** Run `npm run test` na raiz
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Req ID | Behavior | Tipo | Automated Command | File Exists | Status |
|--------|----------|------|-------------------|-------------|--------|
| CREDM-02 | `grantCredits` registra `CreditTransaction` `ADMIN_GRANT` + incrementa `creditBalance` atomicamente via `$transaction` | unit | `cd apps/api && npx vitest run --reporter=verbose src/modules/admin-clients` | ❌ Wave 0 | ⬜ pending |
| CREDM-02 | `grantCredits` com role não-CLIENT retorna 404 | unit | `cd apps/api && npx vitest run --reporter=verbose src/modules/admin-clients` | ❌ Wave 0 | ⬜ pending |
| CREDM-03 | Push OneSignal chamado com `additionalData.screen = 'home'` e `type=CREDIT_GRANTED` | unit (mock OneSignal) | `cd apps/api && npx vitest run --reporter=verbose src/modules/admin-clients` | ❌ Wave 0 | ⬜ pending |
| LGOUT-02 | `AdminBottomNav` renderiza 6 botões (5 abas + Sair) | unit | `cd apps/web && npx vitest run --reporter=verbose src/components/admin` | ❌ atualizar existente | ⬜ pending |
| LGOUT-02 | Botão 'Sair' do `AdminBottomNav` existe com `aria-label="Sair"` | unit | `cd apps/web && npx vitest run --reporter=verbose src/components/admin` | ❌ atualizar existente | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/modules/admin-clients/__tests__/admin-clients.service.test.ts` — describe `grantCredits`: 3 casos (CREDM-02: atômico, role inválido, push com additionalData.screen)
- [ ] `apps/web/src/components/admin/__tests__/AdminBottomNav.test.tsx` — atualizar `toHaveLength(5)` → `toHaveLength(6)` + test botão 'Sair' com `aria-label="Sair"` (LGOUT-02)

*Infraestrutura de testes existente cobre todas as necessidades — nenhuma instalação nova.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Schema v1.1 aplicado no Atlas sem quebrar documentos existentes | SC-1 | `prisma db push` é idempotente mas só verificável em runtime | Após db push: verificar Atlas Studio que `SavedCard` collection existe e documentos User antigos continuam intactos |
| Modal de grant fecha e toast exibe após confirmar | CREDM-01 | Comportamento de UI — sem test de componente para modal inteiro | Abrir ClientDetailView, clicar '+ Adicionar créditos', preencher modal, confirmar — toast deve aparecer e saldo atualizar |
| Cliente recebe push ao ganhar créditos | CREDM-03 | Requer device com OneSignal real | No sandbox MP: usar Admin para grant a cliente logado no PWA instalado — verificar notificação push chegando |
| Logout entregador redireciona para login | LGOUT-01 | Requer navegação real no app | Login como entregador no PWA, tocar no ícone de logout, verificar redirecionamento para `/` |
| Dialog de confirmação de logout admin | LGOUT-02 | Requer interação visual | Login como admin, tocar 'Sair' no AdminBottomNav, verificar dialog e confirmar logout |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
