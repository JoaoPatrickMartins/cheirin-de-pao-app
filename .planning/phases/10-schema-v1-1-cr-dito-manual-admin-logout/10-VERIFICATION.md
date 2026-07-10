---
phase: 10-schema-v1-1-cr-dito-manual-admin-logout
verified: 2026-06-19T17:40:00Z
status: human_needed
score: 18/18 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Abrir o app como Admin, navegar para detalhe de um cliente e verificar se o botão '+ Adicionar créditos' aparece abaixo do saldo"
    expected: "Botão visível com estilo ghost pequeno logo abaixo do número de créditos"
    why_human: "Posicionamento visual e hierarquia de layout não verificáveis via grep"
  - test: "Clicar no botão '+ Adicionar créditos' e verificar se o modal bottom sheet abre corretamente"
    expected: "Modal exibe handle bar, título 'Adicionar Créditos', input de quantidade com foco automático e 4 chips de motivo (Acerto, Bonificação, Compensação, Promoção)"
    why_human: "Comportamento interativo do modal e animação de abertura requerem inspeção visual"
  - test: "Preencher o modal com quantity=3 e motivo='Bonificação', clicar em 'Adicionar créditos' e verificar fluxo completo"
    expected: "Modal fecha, toast 'N crédito(s) adicionado(s) a [Nome]' aparece por 2500ms, saldo do cliente é atualizado localmente na tela"
    why_human: "Integração ponta a ponta com banco real (MongoDB Atlas) não testável via grep/análise estática"
  - test: "Verificar se o push OneSignal é disparado quando cliente tem oneSignalPlayerId preenchido"
    expected: "Cliente recebe notificação push 'Pãezinhos chegando!' com saldo atualizado"
    why_human: "Integração com serviço externo OneSignal — requer dispositivo real com PWA instalado"
  - test: "Como entregador, clicar no ícone de logout no canto superior direito do header"
    expected: "Sessão encerrada imediatamente sem dialog de confirmação, redirecionamento para tela de login"
    why_human: "Comportamento de navegação e encerramento de sessão requer interação real no app"
  - test: "Como admin, clicar no botão 'Sair' na barra de navegação inferior"
    expected: "Dialog 'Sair da conta?' aparece com botões 'Continuar na conta' e 'Sair'; clicar 'Sair' encerra a sessão"
    why_human: "Comportamento do dialog e sequência de navegação requerem interação real"
  - test: "Como cliente, receber notificação CREDIT_GRANTED e abrir a Central de Notificações"
    expected: "Notificação exibe tom dourado (gold), ícone de moeda (coin) e CTA 'Ver saldo' que navega para /client/home"
    why_human: "Aparência visual do card com tom gold e ícone coin requer inspeção visual; deep link requer push real"
---

# Phase 10: Schema v1.1 + Crédito Manual Admin + Logout — Relatório de Verificação

**Phase Goal:** Schema v1.1 aplicado + crédito manual admin funcional + logout em todos os perfis
**Verificado:** 2026-06-19T17:40:00Z
**Status:** human_needed
**Re-verificação:** Não — verificação inicial

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidência |
|---|-------|--------|-----------|
| 1 | `TransactionType.ADMIN_GRANT` existe no schema Prisma | VERIFIED | `grep ADMIN_GRANT schema.prisma` → linha 48 |
| 2 | `NotificationType.CREDIT_GRANTED` existe no schema Prisma | VERIFIED | `grep CREDIT_GRANTED schema.prisma` → linha 99 |
| 3 | `CreditTransaction` possui campos `adminId` e `reason` opcionais | VERIFIED | schema.prisma linhas 180-181: `adminId String? @db.ObjectId` e `reason String?` |
| 4 | `User` possui campo `mpCustomerId` opcional | VERIFIED | schema.prisma linha 121: `mpCustomerId String?` |
| 5 | `model SavedCard` existe com os 8 campos de D-07 | VERIFIED | schema.prisma linhas 326-335: modelo completo com id, userId, mpCardId, brand, lastFour, expiresAt, isDefault, createdAt |
| 6 | `Condominium` possui campo `deliverySlots String[]` | VERIFIED | schema.prisma linha 133 |
| 7 | `Schedule` possui campo `days Json?` | VERIFIED | schema.prisma linha 194 |
| 8 | `POST /admin/clients/:id/grant-credits` retorna 200 com novo creditBalance | VERIFIED | route.ts linhas 149+187: rota registrada; service.ts implementado com retorno de updatedUser; todos os 4 testes grantCredits PASS |
| 9 | Transação é atômica: `CreditTransaction.ADMIN_GRANT` + `user.creditBalance` increment via `prisma.$transaction` | VERIFIED | service.ts linha 161: `type: TransactionType.ADMIN_GRANT`; `$transaction` chamado; teste 1 de grantCredits PASS |
| 10 | Se cliente não existir ou não for CLIENT, rota retorna 404 | VERIFIED | service.ts linhas 155+209: `throw { statusCode: 404 }`; testes 2 e 3 de grantCredits PASS |
| 11 | Se `quantity < 1`, rota retorna 400 | VERIFIED | service.ts linha 149: `throw { statusCode: 400 }`; teste 4 de grantCredits PASS |
| 12 | Push OneSignal disparado se `oneSignalPlayerId` existir (falha silenciosa) | VERIFIED | service.ts linhas 172-183: bloco condicional com try/catch; falha logada com `log.warn` e não lançada |
| 13 | Notificação in-app `CREDIT_GRANTED` persistida obrigatoriamente | VERIFIED | service.ts linhas 187-196: `createAndTrim` chamado FORA do try do push |
| 14 | Admin vê botão '+ Adicionar créditos' com modal bottom sheet funcional no `ClientDetailView` | VERIFIED | ClientDetailView.tsx: estados `showGrantModal/grantQty/grantMotivo/grantLoading/toast`, função `handleGrant`, botão trigger linha 382, modal linhas 570-744 |
| 15 | Entregador tem botão logout no header de `CourierScreen` que chama `logout()` sem dialog | VERIFIED | CourierScreen.tsx linhas 5+40+109: `useAuth`, `logout` desestruturado, botão com `onClick={logout}` sem dialog |
| 16 | Admin tem botão 'Sair' no `AdminBottomNav` com dialog 'Sair da conta?' | VERIFIED | AdminBottomNav.tsx linhas 3+28+110+130+161: `useAuth`, `logout`, botão Sair com Icon, dialog com título 'Sair da conta?' |
| 17 | `NotificationsScreen` exibe `CREDIT_GRANTED` com tom 'gold', ícone 'coin' e CTA 'Ver saldo' → `/client/home` | VERIFIED | NotificationsScreen.tsx linhas 21+30+46: `getTone` retorna 'gold', `getIcon` retorna 'coin', `CTA_CONFIG.CREDIT_GRANTED.path = '/client/home'` |
| 18 | `useOneSignalDeepLink` navega para `/client/home` quando `screen === 'home'` | VERIFIED | useOneSignalDeepLink.ts linhas 36-37: `else if (screen === 'home') { navigate('/client/home') }` |

**Score:** 18/18 truths verificadas

---

### Artifacts Verificados

| Artifact | Status | Evidência |
|----------|--------|-----------|
| `apps/api/prisma/schema.prisma` | VERIFIED | 7 campos de D-02 presentes (ADMIN_GRANT, CREDIT_GRANTED, adminId, reason, mpCustomerId, SavedCard, deliverySlots, days Json?) |
| `apps/api/src/modules/admin-clients/admin-clients.service.ts` | VERIFIED | `grantCredits` implementado com `$transaction`, push OneSignal, `createAndTrim` |
| `apps/api/src/modules/admin-clients/admin-clients.schema.ts` | VERIFIED | `GrantCreditsSchema` com `quantity: z.number().int().min(1)` e `reason: z.enum(['Acerto', 'Bonificação', 'Compensação', 'Promoção'])` |
| `apps/api/src/modules/admin-clients/admin-clients.route.ts` | VERIFIED | `POST /admin/clients/:id/grant-credits` registrada com `preHandler: [fastify.authenticate]` |
| `apps/api/src/modules/admin-clients/admin-clients.controller.ts` | VERIFIED | `grantCredits` com role check ADMIN, `adminId` do JWT; `getDetail` com flatten corrigido (`...result.client`) |
| `apps/api/src/modules/admin-clients/__tests__/admin-clients.service.test.ts` | VERIFIED | 15/15 testes PASS (4 grantCredits GREEN + 11 existentes GREEN) |
| `apps/web/src/components/admin/ClientDetailView.tsx` | VERIFIED | Modal bottom sheet completo com overlay, handle bar, input, 4 chips, botões, toast, escape key handler |
| `apps/web/src/components/admin/AdminBottomNav.tsx` | VERIFIED | Botão 'Sair' + dialog 'Sair da conta?' com botões 'Continuar na conta' e 'Sair' |
| `apps/web/src/components/admin/__tests__/AdminBottomNav.test.tsx` | VERIFIED | `toHaveLength(6)` presente; 4/4 testes PASS quando executados de `apps/web/` |
| `apps/web/src/pages/courier/CourierScreen.tsx` | VERIFIED | Ícone logout no header com `onClick={logout}` direto |
| `apps/web/src/pages/client/NotificationsScreen.tsx` | VERIFIED | `CREDIT_GRANTED` em `getTone` (gold), `getIcon` (coin) e `CTA_CONFIG` (Ver saldo → /client/home) |
| `apps/web/src/hooks/useOneSignalDeepLink.ts` | VERIFIED | Case `screen === 'home'` → `navigate('/client/home')` |

---

### Key Link Verification

| From | To | Via | Status | Evidência |
|------|----|-----|--------|-----------|
| `admin-clients.route.ts` | `admin-clients.controller.ts#grantCredits` | `fastify.post('/admin/clients/:id/grant-credits', ...)` | WIRED | route.ts linha 149+187 |
| `admin-clients.controller.ts#grantCredits` | `admin-clients.service.ts#grantCredits` | `this.service.grantCredits(id, { ...body, adminId: request.user.id })` | WIRED | controller.ts linha 90 |
| `admin-clients.service.ts#grantCredits` | `prisma.$transaction` | transação atômica `creditTransaction.create + user.update` | WIRED | service.ts linha 161; `$transaction` confirmado |
| `admin-clients.service.ts#grantCredits` | `notificationsService.createAndTrim` | chamada obrigatória fora do try do push | WIRED | service.ts linha 188-196 |
| `admin-clients.controller.ts#getDetail` | `reply.send` | flatten `{ ...result.client, schedule, recentOrders }` | WIRED | controller.ts linha 61 |
| `ClientDetailView.tsx` | `POST /admin/clients/:id/grant-credits` | `apiFetch` com body `{ quantity, reason }` | WIRED | ClientDetailView.tsx linha 110-113 |
| `AdminBottomNav.tsx (botão Sair)` | `AuthContext.logout()` | dialog confirm → `onClick={logout}` | WIRED | AdminBottomNav.tsx linha 192 |
| `CourierScreen.tsx (ícone logout)` | `AuthContext.logout()` | `onClick={logout}` direto sem dialog | WIRED | CourierScreen.tsx linha 109 |
| `useOneSignalDeepLink.ts` | `navigate('/client/home')` | `case screen === 'home'` | WIRED | useOneSignalDeepLink.ts linha 36-37 |
| `NotificationsScreen.tsx CTA_CONFIG` | `navigate('/client/home')` | `cta.path` via `CREDIT_GRANTED` | WIRED | NotificationsScreen.tsx linha 46 |

---

### Behavioral Spot-Checks

| Comportamento | Comando | Resultado | Status |
|--------------|---------|-----------|--------|
| 15 testes grantCredits + existentes GREEN | `npx vitest run apps/api/src/modules/admin-clients/__tests__/admin-clients.service.test.ts` | 15/15 PASS | PASS |
| 4 testes AdminBottomNav GREEN (6 botões) | `cd apps/web && npx vitest run src/components/admin/__tests__/AdminBottomNav.test.tsx` | 4/4 PASS | PASS |

**Nota sobre os testes do AdminBottomNav:** Quando executados da raiz do monorepo (sem mudar de diretório), os testes falham com `document is not defined` porque o Vitest não encontra o `vitest.config.ts` do workspace `apps/web` e não configura o ambiente `jsdom`. Isso é um problema de invocação de CI/CD, não de implementação. Executados corretamente de `apps/web/`, todos os 4 testes passam.

---

### Requirements Coverage

| Requirement | Plano | Descrição | Status | Evidência |
|-------------|-------|-----------|--------|-----------|
| CREDM-01 | 10-02, 10-03 | Admin pode adicionar créditos manualmente selecionando quantidade e motivo | SATISFIED | Modal grant-credits + `POST /admin/clients/:id/grant-credits` implementados |
| CREDM-02 | 10-01, 10-02 | Operação registra CreditTransaction com type=ADMIN_GRANT, adminId e motivo | SATISFIED | Schema com `ADMIN_GRANT`, `adminId`, `reason`; service com `$transaction` e `type: TransactionType.ADMIN_GRANT` |
| CREDM-03 | 10-02, 10-03 | Cliente recebe notificação push + in-app ao receber créditos manuais | SATISFIED | Push OneSignal best-effort + `createAndTrim(CREDIT_GRANTED)` na service; `NotificationsScreen` com tom gold + CTA |
| LGOUT-01 | 10-03 | Entregador tem botão de logout acessível no app | SATISFIED | `CourierScreen.tsx`: botão com Icon logout no header, `onClick={logout}` |
| LGOUT-02 | 10-03 | Admin tem botão de logout acessível no painel | SATISFIED | `AdminBottomNav.tsx`: botão 'Sair' com dialog de confirmação 'Sair da conta?' |

---

### Anti-Patterns Found

| Arquivo | Linha | Padrão | Severidade | Impacto |
|---------|-------|--------|------------|---------|
| Nenhum | — | — | — | Nenhum anti-pattern crítico encontrado nos arquivos modificados |

Nota: Os arquivos modificados foram inspecionados e não contêm `TBD`, `FIXME`, `XXX` não referenciados, `return null` indevido, ou outros marcadores de dívida técnica sem rastreamento.

---

### Human Verification Required

#### 1. Botão '+ Adicionar créditos' posicionado corretamente no ClientDetailView

**Test:** Como admin, abrir o detalhe de um cliente e verificar o posicionamento do botão abaixo do saldo de créditos
**Expected:** Botão ghost pequeno "+" Adicionar créditos visível imediatamente abaixo do número de pães no card de saldo
**Why human:** Posicionamento visual e hierarquia de layout dependem de tokens CSS (`--color-border`, `--color-text`) que não podem ser verificados via análise estática

#### 2. Modal bottom sheet grant-credits — comportamento interativo

**Test:** Clicar no botão trigger, verificar abertura do modal, preenchimento de quantity e seleção de chip de motivo
**Expected:** Modal abre com animação bottom sheet, input recebe foco automático, chips ficam destacados com fundo dourado ao selecionar, botão 'Adicionar créditos' fica habilitado apenas quando quantity >= 1 E motivo selecionado
**Why human:** Comportamento interativo (foco, animação, estado dos chips) não testável via grep/análise estática

#### 3. Fluxo ponta a ponta de concessão de créditos com banco real

**Test:** Preencher o modal com quantity=3, motivo='Bonificação', confirmar
**Expected:** Requisição POST vai para o backend, banco registra `CreditTransaction.type=ADMIN_GRANT`, saldo do cliente é incrementado, modal fecha, toast aparece por 2500ms
**Why human:** Integração com MongoDB Atlas (banco remoto) requer execução real do backend

#### 4. Notificação push OneSignal para cliente com credencial

**Test:** Com cliente que tem `oneSignalPlayerId` configurado, conceder créditos
**Expected:** Dispositivo do cliente recebe push "Pãezinhos chegando!" com novo saldo; o push não bloqueia a resposta da API em caso de falha
**Why human:** Requer dispositivo real com PWA instalado e credenciais OneSignal configuradas

#### 5. Logout do entregador — encerramento de sessão

**Test:** Clicar no ícone de logout no header do CourierScreen
**Expected:** Sessão encerrada sem dialog de confirmação, redirecionamento imediato para tela de login
**Why human:** Comportamento de navegação e limpeza de token JWT requerem execução real do app

#### 6. Logout do admin — dialog de confirmação

**Test:** Clicar no botão 'Sair' na barra de navegação inferior do admin
**Expected:** Dialog 'Sair da conta?' aparece; clicar 'Continuar na conta' fecha o dialog; clicar 'Sair' encerra a sessão e redireciona para login
**Why human:** Comportamento de modal e sequência de navegação requerem interação real

#### 7. Notificação CREDIT_GRANTED na Central de Notificações

**Test:** Como cliente, abrir a Central de Notificações após receber crédito manual
**Expected:** Card de notificação exibe tom dourado (background gold), ícone de moeda, e CTA 'Ver saldo' que navega para /client/home
**Why human:** Aparência visual do card (tom gold, ícone coin) e funcionamento do CTA requerem inspeção visual no app

---

### Gaps Summary

Nenhum gap bloqueante encontrado. Todas as 18 truths verificáveis programaticamente foram confirmadas no codebase. O status `human_needed` reflete exclusivamente os 7 itens de verificação visual/interativa/integração que requerem execução real do app.

---

_Verificado: 2026-06-19T17:40:00Z_
_Verificador: Claude (gsd-verifier)_
