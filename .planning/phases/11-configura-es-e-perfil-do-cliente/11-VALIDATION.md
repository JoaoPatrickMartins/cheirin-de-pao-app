---
phase: 11
slug: configura-es-e-perfil-do-cliente
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-19
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (frontend) + Jest/Fastify inject (backend) |
| **Config file** | `apps/web/vitest.config.ts` / `apps/api/jest.config.ts` |
| **Quick run command** | `npm run test --workspace=apps/api -- --testPathPattern=client-profile` |
| **Full suite command** | `npm run test --workspace=apps/api && npm run test --workspace=apps/web` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test --workspace=apps/api -- --testPathPattern=client-profile`
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-schema-otp | — | 1 | CONF-04 | T-11-01 | OTP CONTACT_CHANGE não conflita com LOGIN | unit | `npx prisma db push && npm run test -- --testPathPattern=otp` | ❌ W0 | ⬜ pending |
| 11-backend-profile | — | 1 | CONF-02/03/05 | T-11-02 | JWT obrigatório, CPF nunca editável | unit | `npm run test --workspace=apps/api -- --testPathPattern=client-profile` | ❌ W0 | ⬜ pending |
| 11-backend-contact | — | 2 | CONF-04 | T-11-03 | 422 se contato já em uso | unit | `npm run test --workspace=apps/api -- --testPathPattern=contact-change` | ❌ W0 | ⬜ pending |
| 11-frontend-settings | — | 2 | CONF-01/02/03/07 | — | N/A | manual | — | — | ⬜ pending |
| 11-frontend-contact | — | 3 | CONF-04 | — | N/A | manual | — | — | ⬜ pending |
| 11-frontend-condo | — | 3 | CONF-05/06 | — | N/A | manual | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/modules/client-profile/__tests__/client-profile.test.ts` — stubs para CONF-02, CONF-03, CONF-05
- [ ] `apps/api/src/modules/client-profile/__tests__/contact-change.test.ts` — stubs para CONF-04 (OTP purpose, conflito de contato)
- [ ] `apps/api/prisma/schema.prisma` — campo `purpose String @default("LOGIN")` adicionado ao model `OtpCode`
- [ ] `npx prisma db push` executado após schema update

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 5º tab "Perfil" visível no ClientTabBar | CONF-01 | UI visual, sem DOM assertions úteis | Abrir o app como cliente, verificar que aparece o 5º tab com ícone user e label "Perfil" |
| CPF exibido mas bloqueado | CONF-03 | Comportamento visual de input readonly | Verificar no campo CPF que está desabilitado e com estilo visual diferenciado |
| Step wizard inline OTP | CONF-04 | Animação de transição de step na mesma tela | Clicar "Editar contato", preencher novo contato, clicar "Enviar código" — verificar que step 2 aparece na mesma tela sem navegação |
| Dialog de confirmação ao mudar condomínio | CONF-06 | Interação com dialog nativo | Mudar condomínio e clicar "Salvar endereço" — verificar que dialog aparece com texto de aviso de desativação de agenda |
| Banner de agenda desativada na ScheduleScreen | CONF-06 | Estado contextual cross-screen | Após mudar de condomínio, navegar para a ScheduleScreen e verificar que banner aparece |
| Logout via botão "Sair" | CONF-07 | Navegação e limpeza de sessão | Clicar "Sair", verificar redirecionamento para login e limpeza do localStorage |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
