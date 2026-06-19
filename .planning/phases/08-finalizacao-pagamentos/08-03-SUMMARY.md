---
phase: 08-finalizacao-pagamentos
plan: "03"
subsystem: frontend/client
tags:
  - onesignal
  - deep-link
  - home-screen
  - credits
  - payments
  - ui
dependency_graph:
  requires:
    - "08-01: testes de backend verdes"
    - "08-02: sendLowCreditNotifications implementado"
    - "08-05: testes processAutoBuy completos"
  provides:
    - "useOneSignalDeepLink hook para navegação via push"
    - "HomeScreen completa: BannerInsuficiente + NextDays reais + TodayDelivery 3 estados"
    - "CardPaymentScreen com botão back Icon arrowL"
    - "CombosScreen com BannerInsuficiente em ambas as abas"
    - "PixWaitingScreen com copy correto no estado rejected"
  affects:
    - "apps/web/src/hooks/useOneSignalDeepLink.ts"
    - "apps/web/src/pages/client/ClientLayout.tsx"
    - "apps/web/src/pages/client/HomeScreen.tsx"
    - "apps/web/src/pages/client/CardPaymentScreen.tsx"
    - "apps/web/src/pages/client/CombosScreen.tsx"
    - "apps/web/src/pages/client/PixWaitingScreen.tsx"
    - "apps/web/src/components/client/BannerInsuficiente.tsx"
tech_stack:
  added: []
  patterns:
    - "useEffect com window.OneSignal para deep link (padrão useOneSignalRegister)"
    - "Cleanup removeEventListener no unmount — T-04-06-04"
    - "useSchedule(creditBalance) para dados reais de agendamento semanal"
    - "DAY_KEY_MAP + DAY_ABBR para calcular próximos 5 dias em BRT"
key_files:
  created:
    - apps/web/src/hooks/useOneSignalDeepLink.ts
  modified:
    - apps/web/src/pages/client/ClientLayout.tsx
    - apps/web/src/pages/client/HomeScreen.tsx
    - apps/web/src/pages/client/CardPaymentScreen.tsx
    - apps/web/src/pages/client/CombosScreen.tsx
    - apps/web/src/pages/client/PixWaitingScreen.tsx
    - apps/web/src/components/client/BannerInsuficiente.tsx
decisions:
  - "Prop hideAjustar adicionada ao BannerInsuficiente — botão Usar N ocultado na HomeScreen onde não faz sentido contextualmente"
  - "import react-router (não react-router-dom) — padrão do projeto verificado via grep"
  - "ClientTabBar estava conforme — sem alteração necessária (startsWith + path /client/creditos já corretos)"
metrics:
  duration: "~5 minutos"
  completed: "2026-06-19T04:18:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 7
---

# Phase 08 Plan 03: Frontend Gaps — HomeScreen + DeepLink + Auditorias Summary

**One-liner:** Hook useOneSignalDeepLink para navegação via push, HomeScreen completa com BannerInsuficiente + NextDays reais + TodayDelivery 3 estados, botão back Icon arrowL no CardPaymentScreen, BannerInsuficiente na aba avulso do CombosScreen, e copy correto no estado rejected do PixWaitingScreen.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Criar useOneSignalDeepLink + wiring no ClientLayout | d6ea63a | useOneSignalDeepLink.ts, ClientLayout.tsx |
| 2 | Completar HomeScreen — BannerInsuficiente + NextDays reais + TodayDelivery | 44dfb1a | HomeScreen.tsx, BannerInsuficiente.tsx |
| 3 | Fix CardPaymentScreen + auditoria ClientTabBar + auditoria CombosScreen e PixWaitingScreen | 30ba556 | CardPaymentScreen.tsx, CombosScreen.tsx, PixWaitingScreen.tsx |

## What Was Built

### Task 1: useOneSignalDeepLink + ClientLayout

Criado `apps/web/src/hooks/useOneSignalDeepLink.ts` seguindo exatamente o padrão de `useOneSignalRegister.ts`:
- Acessa `(window as any).OneSignal` — sem import direto de react-onesignal
- Listener `OS.Notifications.addEventListener('click', handleClick)` no useEffect
- Handler: verifica `event.notification.additionalData.screen === 'creditos'` e navega para `/client/creditos`
- Cleanup: `removeEventListener('click', handleClick)` no return do useEffect
- Deps do useEffect: `[navigate]`

`ClientLayout.tsx` atualizado: `useOneSignalDeepLink()` chamado imediatamente após `useOneSignalRegister()`.

### Task 2: HomeScreen completa

**LACUNA 1 — BannerInsuficiente:**
Inserido após o TodayDelivery card, condição `creditBalance === 0`. Usa `hideAjustar={true}` para ocultar o botão "Usar 0" sem sentido no contexto da Home. `BannerInsuficiente.tsx` recebeu prop opcional `hideAjustar?: boolean` para suportar esse caso.

**LACUNA 2 — TodayDelivery 3 estados:**
Ja estava implementado corretamente via `useOrderTracking` → `GET /orders/today`. Confirmado: SCHEDULED (AGENDADO/gold), OUT_FOR_DELIVERY (SAINDO DO FORNO/green dot/A caminho), DELIVERED (ENTREGUE/opacity 0.85/Entregue hoje). Nenhuma alteração necessária.

**LACUNA 3 — NextDays com dados reais:**
Integrado `useSchedule(creditBalance)` para obter `weeklyQty` real de `GET /schedules/me`. Implementado:
- `DAY_KEY_MAP`: índice getDay() → chave WeeklyQty
- `DAY_ABBR`: chave → abreviação exibida
- `nextDays`: Array de 5 dias a partir de amanhã com `{abbr, dayNum, qty, key}`
- Três estados: loading (placeholders cinza), sem agendamento (texto descritivo), com agendamento (cards por dia com pill gold para qty > 0, "folga" para qty = 0)
- Header: "Próximas entregas" (Bricolage 16px w700) + botão "Editar agenda" (accent)

### Task 3: Auditorias e correções

**CardPaymentScreen:** Botão back com `←` literal substituído por `<Icon name="arrowL" size={20} color="var(--color-text)" />` com `aria-label="Voltar"`, dimensões `38×38`, border `1.5px solid var(--color-border)`, background `var(--color-surface-2)`.

**ClientTabBar:** Auditada — já estava conforme. Tab "Créditos" usa `path: '/client/creditos'` e mecanismo `location.pathname.startsWith(tab.path)`. Cobre automaticamente `/client/creditos/pix`, `/client/creditos/cartao`, `/client/creditos/sucesso`. Nenhuma alteração necessária.

**CombosScreen:** BannerInsuficiente já existia na aba combos. Adicionado na aba avulso com condição `creditBalance < customQty`. Props: `onComprar={() => setTab('combos')}`, `onAjustar={(qtd) => setCustomQty(qtd)}`.

**PixWaitingScreen:** Copy do estado rejected corrigido de "Pagamento recusado." para "Pagamento não aprovado. Isso pode ter sido um erro temporário do banco. Tente novamente." conforme UI-SPEC. Botão "Tentar novamente" navega para `/client/creditos` — já estava correto. `updateCreditBalance` chamado antes de navegar para sucesso — já estava correto.

## Verification Results

```
npx tsc --noEmit em apps/web: 0 erros (3 verificações: após cada task)
BannerInsuficiente em HomeScreen: 3 (>= 2 requerido)
useOneSignalDeepLink em ClientLayout: 2 (>= 2 requerido)
arrowL em CardPaymentScreen: 1 (>= 1 requerido)
client/creditos em ClientTabBar: 1 (>= 1 requerido)
startsWith em ClientTabBar: 1 (>= 1 requerido)
Pagamento não aprovado em PixWaitingScreen: 1 (>= 1 requerido)
BannerInsuficiente em CombosScreen: 4 (>= 2 requerido — aba combos + aba avulso)
sendLowCreditNotifications em cron.ts: 4 (>= 2 requerido — vem do 08-02)
```

## Deviations from Plan

### Auto-added Functionality

**1. [Rule 2 - Missing Feature] Prop hideAjustar adicionada ao BannerInsuficiente**
- **Found during:** Task 2 — ao analisar como usar BannerInsuficiente na HomeScreen
- **Issue:** O componente BannerInsuficiente não possuía prop para ocultar o botão "Usar N", que não faz sentido quando saldo=0 na HomeScreen (ajustar para 0 pãezinhos não é uma ação útil)
- **Fix:** Adicionada prop opcional `hideAjustar?: boolean = false` com condicional `{!hideAjustar && <button>Usar {saldo}</button>}`
- **Files modified:** `apps/web/src/components/client/BannerInsuficiente.tsx`
- **Commit:** 44dfb1a (incluído na Task 2)

**2. [Rule 1 - Bug Fix] Import corrigido de react-router-dom para react-router**
- **Found during:** Task 1 — ao executar TypeScript check
- **Issue:** Hook criado com `import { useNavigate } from 'react-router-dom'` mas o projeto usa `react-router` sem o sufixo `-dom`
- **Fix:** Corrigido para `import { useNavigate } from 'react-router'`
- **Files modified:** `apps/web/src/hooks/useOneSignalDeepLink.ts`
- **Commit:** d6ea63a (corrigido antes do commit)

### No Changes Needed (Intentional)

- `ClientTabBar.tsx` — ja estava conforme: startsWith + path '/client/creditos'
- `TodayDelivery` em HomeScreen — ja tinha os 3 estados completos (SCHEDULED/OUT_FOR_DELIVERY/DELIVERED)
- `PixWaitingScreen` — `updateCreditBalance` e `Tentar novamente` / `Verificar mais tarde` já estavam corretos

## Known Stubs

Nenhum stub identificado nos arquivos modificados. Todos os dados são reais via API (useSchedule → GET /schedules/me, useOrderTracking → GET /orders/today, useAuth → creditBalance).

## Threat Flags

Nenhum novo endpoint ou surface de segurança introduzido além do threat model do plano:
- T-08-09 (deep link screen manipulado): Accept — navega apenas para `/client/creditos`, rota interna sem ação destrutiva
- T-08-10 (creditBalance exposto na UI): Accept — dado do próprio usuário autenticado via AuthContext
- T-08-11 (CardPayment token): Mitigado — validação ocorre no backend MP server-side (não alterado)
- T-08-12 (GET /schedules/me sem auth): Mitigado — endpoint protegido por fastify.authenticate (não alterado)

## Self-Check: PASSED

- [x] `apps/web/src/hooks/useOneSignalDeepLink.ts` — FOUND e criado
- [x] `apps/web/src/pages/client/ClientLayout.tsx` — FOUND e modificado
- [x] `apps/web/src/pages/client/HomeScreen.tsx` — FOUND e modificado
- [x] `apps/web/src/pages/client/CardPaymentScreen.tsx` — FOUND e modificado
- [x] `apps/web/src/pages/client/CombosScreen.tsx` — FOUND e modificado
- [x] `apps/web/src/pages/client/PixWaitingScreen.tsx` — FOUND e modificado
- [x] `apps/web/src/components/client/BannerInsuficiente.tsx` — FOUND e modificado
- [x] Commit d6ea63a — FOUND em git log (Task 1)
- [x] Commit 44dfb1a — FOUND em git log (Task 2)
- [x] Commit 30ba556 — FOUND em git log (Task 3)
- [x] TypeScript compila sem erros em apps/web
- [x] STATE.md e ROADMAP.md NÃO modificados (conforme instrução do orquestrador)
