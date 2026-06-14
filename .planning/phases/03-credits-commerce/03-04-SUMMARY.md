---
phase: 03-credits-commerce
plan: 04
subsystem: frontend
tags: [react, auth-context, tab-bar, home-screen, credit-balance, ui, navigation]

# Dependency graph
requires:
  - "03-01 (Prisma schema + creditBalance field)"
provides:
  - "AuthUser com creditBalance: number e updateCreditBalance no AuthContext"
  - "ClientTabBar com 4 abas fixas (Inicio/Agenda/Creditos/Pedidos) com deteccao de aba ativa"
  - "HomeScreen completa: saudacao, CreditBalanceCard, TodayDelivery placeholder, QuickActions, NextDays"
  - "CreditBalanceCard: gradiente espresso, saldo 52px Bricolage 800, BreadMark watermark, botoes Comprar e Extrato"
  - "CreditHistoryScreen: lista de transacoes via GET /credits/history"
  - "PlaceholderScreen: telas Em breve para Agenda e Pedidos"
  - "Router /client com todas as sub-rotas lazy (home, creditos, agenda, pedidos, pix, cartao, sucesso, extrato, recorrente)"
affects: [03-05-pix-flow, 03-06-polling, 03-02-payments-api, 03-03-credits-api]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ClientTabBar usa useLocation().pathname.startsWith() para detectar aba ativa"
    - "updateCreditBalance: atualiza state e localStorage dentro de try/catch (mesmo padrao do login)"
    - "creditBalance ?? 0 backward compat no rehydrate do localStorage"
    - "Rotas lazy com import().then(m => ({ Component: m.X })) para code splitting"
    - "data-active='true' em botoes de aba para testes e acessibilidade"

key-files:
  created:
    - apps/web/src/components/client/ClientTabBar.tsx
    - apps/web/src/components/client/CreditBalanceCard.tsx
    - apps/web/src/pages/client/HomeScreen.tsx
    - apps/web/src/pages/client/CreditHistoryScreen.tsx
    - apps/web/src/pages/client/PlaceholderScreen.tsx
    - apps/web/src/pages/client/CombosScreen.tsx
    - apps/web/src/pages/client/PixWaitingScreen.tsx
    - apps/web/src/pages/client/CardPaymentScreen.tsx
    - apps/web/src/pages/client/PurchasedScreen.tsx
    - apps/web/src/pages/client/AutoBuyScreen.tsx
  modified:
    - apps/web/src/contexts/AuthContext.tsx
    - apps/web/src/pages/client/ClientLayout.tsx
    - apps/web/src/routes/router.tsx
    - apps/web/src/pages/auth/LoginScreen.tsx
    - apps/web/src/pages/auth/OnboardingScreen.tsx
    - apps/web/src/components/client/__tests__/ClientTabBar.test.tsx
    - apps/web/src/pages/client/__tests__/HomeScreen.test.tsx
    - apps/web/src/pages/client/__tests__/CombosScreen.test.tsx

key-decisions:
  - "CreditBalanceCard usa BreadMark como watermark posicao absoluta bottom:-50px right:-30px opacity:0.1 (exato do UI-SPEC)"
  - "PlaceholderScreen detecta icon e titulo via pathname ao inves de props para compatibilidade com lazy loading"
  - "Scaffold screens (CombosScreen, PixWaitingScreen, etc.) criados como stubs minimos para router nao quebrar TypeScript"
  - "react-router-dom corrigido para react-router nos test stubs do plano 03-01 (Rule 1 bug fix)"

requirements-completed:
  - CRED-11
  - UI-04
  - UI-08

# Metrics
duration: 8min
completed: 2026-06-14
---

# Phase 3 Plan 04: Frontend Core (AuthContext + Tab Bar + HomeA) Summary

**Tab bar funcional com 4 abas, HomeA com saldo real em Bricolage 800 52px, AuthContext estendido com creditBalance e updateCreditBalance — 10 arquivos novos, 8 modificados**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-14T15:59:06Z
- **Completed:** 2026-06-14T16:07:14Z
- **Tasks:** 2 (TDD)
- **Files created:** 10
- **Files modified:** 8

## Accomplishments

### Task 1: AuthContext + ClientTabBar + router + ClientLayout

- `AuthContext.tsx`: adicionado `creditBalance: number` ao `AuthUser` (com `?? 0` backward compat no rehydrate do localStorage) e `updateCreditBalance: (balance: number) => void` ao `AuthContextType` com atualização do state e do localStorage dentro de try/catch
- `ClientTabBar.tsx`: 4 abas fixas (Início/Agenda/Créditos/Pedidos) usando `useLocation().pathname.startsWith(tab.path)`, `data-active="true"` no botão ativo, safe-area-inset-bottom, hit target 44px por aba
- `ClientLayout.tsx`: remove placeholder de texto "Área do Cliente — Fase 3", adiciona `ClientTabBar` como filho e `paddingBottom: calc(56px + env(safe-area-inset-bottom))` no container
- `router.tsx`: rota `/client` agora tem `children` com lazy loading para 10 sub-rotas (index, home, creditos, agenda, pedidos, creditos/pix, creditos/cartao, creditos/sucesso, creditos/extrato, creditos/recorrente)

### Task 2: HomeScreen + CreditBalanceCard + CreditHistoryScreen + PlaceholderScreen

- `HomeScreen.tsx`: saudação por hora do dia (`getHours()` < 12 "Bom dia", < 18 "Boa tarde", >= 18 "Boa noite"), `user?.name.split(' ')[0]`, `CreditBalanceCard`, card `TodayDelivery` placeholder ("Nenhuma entrega agendada"), 4 `QuickActions`, card `NextDays` com link "Editar agenda"
- `CreditBalanceCard.tsx`: gradiente `linear-gradient(135deg, #1E1207, #2E1D0D)`, padding `22px 22px 20px` (override de alta fidelidade), número `52px Bricolage 800 #FAF5EC letterSpacing:-0.03em`, sufixo "pães" `16px 700 #E3AC3F`, `BreadMark` watermark `absolute bottom:-50px right:-30px opacity:0.1 size=200 #E3AC3F`, footer com botão gold (flex:1) e soft (flexShrink:0)
- `CreditHistoryScreen.tsx`: `GET /credits/history` via `apiFetch` no `useEffect`, lista com tipo (PURCHASE=arrowU gold / CONSUMPTION=chevD accent), quantidade com sinal +/-, data `Intl.DateTimeFormat('pt-BR')`, skeleton loading com 3 itens
- `PlaceholderScreen.tsx`: detecta icon/titulo pelo pathname (`agenda` → calendar/Agenda, `pedidos` → bag/Pedidos), layout centralizado `minHeight: calc(100dvh - 56px - env(safe-area-inset-bottom))`, texto "Em breve — disponível na próxima atualização"

## Task Commits

| # | Commit | Description |
|---|--------|-------------|
| RED | `bea8131` | test(03-04): update ClientTabBar and HomeScreen test stubs to real RED assertions |
| GREEN T1 | `2349d75` | feat(03-04): AuthContext + ClientTabBar + router sub-rotas + ClientLayout |
| GREEN T2 | `90d2171` | feat(03-04): HomeScreen + CreditBalanceCard + CreditHistoryScreen + PlaceholderScreen |

## Test Results

| Test Suite | Tests | Result |
|-----------|-------|--------|
| ClientTabBar.test.tsx | 7/7 | GREEN |
| HomeScreen.test.tsx | 3/3 | GREEN |
| OtpInput.test.tsx (x2) | 8/8 | GREEN (unchanged) |

Remaining failures are pre-existing stubs from plan 03-01 for plans 03-05/06:
- `QuantityStepper.test.tsx` (6 tests) — stubs para plano 03-05
- `CombosScreen.test.tsx` (4 tests) — stubs para plano 03-05
- `usePaymentPolling.test.ts` (5 tests) — stubs para plano 03-05/06

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] react-router-dom → react-router em test stubs**
- **Found during:** Task 1 (TypeScript compile)
- **Issue:** Stubs do plano 03-01 importavam `MemoryRouter` de `react-router-dom`, mas o projeto usa `react-router` v7 (sem o pacote `-dom` separado)
- **Fix:** Substituição de `react-router-dom` por `react-router` em `ClientTabBar.test.tsx`, `HomeScreen.test.tsx`, `CombosScreen.test.tsx`
- **Files modified:** 3 test files
- **Commit:** `2349d75`

**2. [Rule 2 - Missing critical functionality] creditBalance ?? 0 em LoginScreen e OnboardingScreen**
- **Found during:** Task 1 (TypeScript compile — `creditBalance` required em AuthUser mas ausente nos callers)
- **Issue:** `LoginScreen` e `OnboardingScreen` chamavam `auth.login()` sem `creditBalance` — violação TypeScript e risco de `undefined` no estado
- **Fix:** Adicionado `creditBalance: data.user.creditBalance ?? 0` nas duas telas de auth
- **Files modified:** `LoginScreen.tsx`, `OnboardingScreen.tsx`
- **Commit:** `2349d75`

**3. [Rule 2 - Scaffolding] Criação de stubs mínimos para as telas referenciadas no router**
- **Found during:** Task 1 (TypeScript compile — router referencia módulos inexistentes)
- **Issue:** Router criado com lazy imports para `CombosScreen`, `PixWaitingScreen`, `CardPaymentScreen`, `PurchasedScreen`, `AutoBuyScreen` — nenhum existia ainda (são dos planos 03-05)
- **Fix:** Criados como stubs mínimos que exportam o componente com um layout básico — suficientes para TypeScript compilar sem erros e para não quebrar o roteamento em tempo de execução
- **Files created:** 5 scaffold files
- **Commit:** `90d2171`

## Known Stubs

| File | Stub Type | Reason | Plan to resolve |
|------|-----------|--------|-----------------|
| `apps/web/src/pages/client/CombosScreen.tsx` | Scaffold mínimo | Implementação completa (combos + compra personalizada + UI) é plano 03-05 | 03-05 |
| `apps/web/src/pages/client/PixWaitingScreen.tsx` | Scaffold mínimo | Tela de espera Pix com QR code e polling — plano 03-05/06 | 03-05 |
| `apps/web/src/pages/client/CardPaymentScreen.tsx` | Scaffold mínimo | Integração com Mercado Pago Bricks — plano 03-05 | 03-05 |
| `apps/web/src/pages/client/PurchasedScreen.tsx` | Scaffold mínimo | Tela de sucesso pós-pagamento — plano 03-05 | 03-05 |
| `apps/web/src/pages/client/AutoBuyScreen.tsx` | Scaffold mínimo | Configuração de compra recorrente — plano 03-05 | 03-05 |

## Threat Surface Scan

T-03-07 e T-03-08 do threat model foram implementados conforme especificação:
- `updateCreditBalance` é função local de contexto — não exposta a rotas públicas, chamada apenas por hooks após confirmação do backend
- localStorage armazena apenas `id, role, name, creditBalance` — sem dados sensíveis (sem token de cartão, sem PII além do nome)

Nenhuma nova superfície de ataque não prevista no threat model foi introduzida.

## Self-Check: PASSED

All key files exist and all commits are recorded:
- `apps/web/src/components/client/ClientTabBar.tsx` — FOUND
- `apps/web/src/components/client/CreditBalanceCard.tsx` — FOUND
- `apps/web/src/pages/client/HomeScreen.tsx` — FOUND
- `apps/web/src/pages/client/CreditHistoryScreen.tsx` — FOUND
- `apps/web/src/pages/client/PlaceholderScreen.tsx` — FOUND
- `apps/web/src/contexts/AuthContext.tsx` — FOUND
- `apps/web/src/routes/router.tsx` — FOUND
- `apps/web/src/pages/client/ClientLayout.tsx` — FOUND

Commits:
- `bea8131` — RED tests — FOUND
- `2349d75` — Task 1 GREEN — FOUND
- `90d2171` — Task 2 GREEN — FOUND
