---
phase: 04-scheduling
verified: 2026-06-15T00:00:00Z
status: human_needed
score: 17/18 must-haves verified
overrides_applied: 0
gaps:
  - truth: "BannerCobertura onAutoBuy navega para rota existente no router"
    status: failed
    reason: "ScheduleScreen.tsx navega para '/client/creditos/compra-automatica' mas o router.tsx define a rota do AutoBuyScreen como 'creditos/recorrente' — link quebrado que resulta em 404 ao clicar no banner"
    artifacts:
      - path: "apps/web/src/pages/client/ScheduleScreen.tsx"
        issue: "Linha 340: onAutoBuy={() => navigate('/client/creditos/compra-automatica')} — rota não existe"
      - path: "apps/web/src/routes/router.tsx"
        issue: "Linha 105: a rota do AutoBuyScreen é 'creditos/recorrente', não 'creditos/compra-automatica'"
    missing:
      - "Corrigir ScheduleScreen.tsx linha 340 para navigate('/client/creditos/recorrente') OU adicionar alias de rota no router"
human_verification:
  - test: "Acessar /client/agenda no PWA e verificar que a ScheduleScreen carrega corretamente (não PlaceholderScreen)"
    expected: "Tela de agenda semanal com 7 Day-Rows, DeliveryTimeChips, card de lembrete e botão Salvar agenda"
    why_human: "Verificação visual do roteamento e renderização dos componentes"
  - test: "Salvar uma agenda com diferentes quantidades e verificar toast 'Agenda salva!'"
    expected: "Toast aparece por 2.5s; GET /schedules/me seguinte retorna os novos valores"
    why_human: "Fluxo de salvamento real com banco de dados"
  - test: "Acessar /client/agenda/pedido-unico e criar um pedido avulso"
    expected: "Stepper 1-20, DateChips com chips de data, botão 'Reservar e confirmar' habilitado apenas quando quantidade <= saldo e data selecionada; após confirmar, toast 'Pedido agendado!' e redirect para /client/agenda"
    why_human: "Verificação do fluxo de reserva atômica de créditos"
  - test: "Testar chip 'Amanhã cedo' após 21h local"
    expected: "Chip fica com opacity 0.4, não responde a cliques, sublabel 'Disponível até 21:00'"
    why_human: "Lógica depende do horário real do dispositivo"
  - test: "Aceitar notificações push no PWA e verificar que POST /users/push-token é chamado"
    expected: "Backend salva oneSignalPlayerId no User; confirmável via log do servidor ou consulta ao banco"
    why_human: "Requer PWA instalado e permissão de push do SO"
  - test: "Verificar que o cron de meia-noite cria Orders corretos no Atlas"
    expected: "Orders com type=SCHEDULED, status=SCHEDULED, userId correto e creditBalance decrementado"
    why_human: "Requer aguardar execução agendada do cron ou disparar manualmente via script"
---

# Phase 4: Scheduling — Verification Report

**Phase Goal:** Sistema de agendamento semanal recorrente — cliente configura agenda de pãezinhos uma vez, sistema cria pedidos diários automaticamente via cron, gerencia créditos, e envia notificações push via OneSignal.
**Verified:** 2026-06-15T00:00:00Z
**Status:** human_needed (1 gap de roteamento + 6 itens para verificação humana)
**Re-verification:** No — verificação inicial

---

## Nota Prévia: SCHED-07 Inexistente

O prompt de verificação lista `SCHED-07` como requirement ID a verificar. Este ID **não existe** em REQUIREMENTS.md (a seção SCHED termina em SCHED-06) nem em nenhum dos planos da fase. O ID foi ignorado por não ter base no contrato de requisitos. Os 6 requisitos verificáveis são SCHED-01..06.

CRED-07 e CRED-10 aparecem nos planos 04-02 e 04-04, mas REQUIREMENTS.md os mapeia para Phase 3 (CRED-07 marcado como Complete, CRED-10 como Pending). A implementação da lógica de `processAutoBuy` em `schedules.service.ts` cobre a intenção do CRED-10 (compra automática com notificação), porém o REQUIREMENTS.md não atualiza o status para Complete nem remapeia para Phase 4. Isso é uma inconsistência de rastreabilidade — reportada como WARNING, não BLOCKER.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Cliente pode criar pedido único (avulso) com reserva atômica de créditos | ✓ VERIFIED | `orders.service.ts` usa `prisma.$transaction`, type='SINGLE', status='SCHEDULED'; POST /orders autenticado em `orders.route.ts` |
| 2 | Cliente pode configurar agendamento semanal personalizado (quantidade por dia, 0=sem entrega) | ✓ VERIFIED | `ScheduleScreen.tsx` com 7 Day-Rows e `StepperInline` min=0 max=12; `schedules.schema.ts` WeeklyQtySchema com min(0)/max(12) |
| 3 | Agendamento semanal cria Orders automaticamente via cron à meia-noite | ✓ VERIFIED | `cron.ts` com expressão '0 0 * * \*', timezone 'America/Sao_Paulo', chama `createDailyOrders()` |
| 4 | Cron de domingo 20h envia push de reconfiguração via OneSignal | ✓ VERIFIED | `cron.ts` com '0 20 \* \* 0' chama `sendReconfigureReminders()`; service usa `osClient.createNotification()` com `include_subscription_ids` |
| 5 | Sistema gerencia créditos: saldo insuficiente bloqueia criação de Order e dispara push | ✓ VERIFIED | `createDailyOrders()` verifica `creditBalance < qty` antes de criar Order; envia push para `oneSignalPlayerId` se insuficiente |
| 6 | Cliente pode ativar notificação de reconfiguração semanal | ✓ VERIFIED | Switch `notifyReconfigure` em `ScheduleScreen.tsx` salvo via PUT /schedules/me; `schedules.schema.ts` com `notifyReconfigure: z.boolean()` |
| 7 | Banner de alerta de cobertura exibido quando créditos insuficientes | ✓ VERIFIED | `BannerCobertura.tsx` com estado A (goldSoft/gold) quando `semana > saldo`; oculto quando `semana === 0` |
| 8 | Tela de agenda exibe consumo semanal calculado localmente | ✓ VERIFIED | `useSchedule.ts`: `consumoSemanal = Object.values(weeklyQty).reduce(...)` (D-03); ScheduleScreen footer mostra `{consumoSemanal} pães · {deliveryTime}` |
| 9 | Aba Agenda deixa de ser placeholder | ✓ VERIFIED | `router.tsx` rota 'agenda' → `ScheduleScreen` (não PlaceholderScreen); sub-rota 'agenda/pedido-unico' → `SingleScreen` |
| 10 | POST /users/push-token salva oneSignalPlayerId no User autenticado | ✓ VERIFIED | `notifications.service.ts` usa `prisma.user.update({data: {oneSignalPlayerId: playerId}})`; `userId` extraído de `request.user!.id` |
| 11 | useOneSignalRegister registra player_id no ClientLayout | ✓ VERIFIED | `ClientLayout.tsx` importa e chama `useOneSignalRegister()` antes do return; hook usa `apiFetch('/users/push-token', {method: 'POST'})` |
| 12 | DateChips desabilita chip 'Amanhã cedo' após 21h | ✓ VERIFIED | `DateChips.tsx` linha 13: `CUTOFF_HOUR = 21`; linha 135: `disabled={isAfterCutoff}`; opacity 0.4 e sub-label 'Disponível até 21:00' |
| 13 | cronPlugin registrado após todos os módulos no server.ts | ✓ VERIFIED | `server.ts` linha 98: `cronPlugin` após webhooksRoute (92), schedulesRoute (95), ordersRoute (96), notificationsRoute (97) |
| 14 | Variáveis de ambiente OneSignal no envSchema do server.ts | ✓ VERIFIED | `server.ts` linhas 46-47: `ONESIGNAL_APP_ID` e `ONESIGNAL_REST_API_KEY` no envSchema |
| 15 | PUT /schedules/me valida weeklyQty (inteiro 0-12) e deliveryTime (enum 4 horários) | ✓ VERIFIED | `schedules.schema.ts`: WeeklyQtySchema com `.int().min(0).max(12)`; `z.enum(['06:30','07:00','07:30','08:00'])` |
| 16 | processAutoBuy existe e verifica saldo vs consumo semanal (modo 'acabar') e dia da semana (modo 'semanal') | ✓ VERIFIED | `schedules.service.ts` linhas 166-246: verifica `autoRecharge.mode`, calcula consumoSemanal, compara com creditBalance; modo semanal usa `Intl.DateTimeFormat` em America/Sao_Paulo |
| 17 | BannerCobertura onAutoBuy navega para rota existente no router | ✗ FAILED | `ScheduleScreen.tsx:340` navega para `/client/creditos/compra-automatica`; router.tsx tem `creditos/recorrente` — rota inexistente gera 404 |
| 18 | Cron jobs usam timezone America/Sao_Paulo | ✓ VERIFIED | `cron.ts`: ambos os cron.schedule() com `{ timezone: 'America/Sao_Paulo', name: '...' }` |

**Score:** 17/18 truths verified

---

## Deferred Items

Nenhum item identificado para fases futuras — todos os gaps são da fase atual.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/prisma/schema.prisma` | oneSignalPlayerId + @@unique | ✓ VERIFIED | Linha 118: `oneSignalPlayerId String?`; Linha 191: `@@unique([userId, condominiumId])` |
| `apps/api/src/modules/schedules/schedules.schema.ts` | WeeklyQtySchema + ScheduleBodySchema | ✓ VERIFIED | 22 linhas, WeeklyQty com 7 chaves, deliveryTime enum, notifyReconfigure |
| `apps/api/src/modules/schedules/schedules.repository.ts` | findActiveByUserId, upsert (@@unique), findAllActive | ✓ VERIFIED | 64 linhas, upsert usando `userId_condominiumId` |
| `apps/api/src/modules/schedules/schedules.service.ts` | createDailyOrders, sendReconfigureReminders, processAutoBuy | ✓ VERIFIED | 247 linhas, todos os 5 métodos presentes e substantivos |
| `apps/api/src/modules/schedules/schedules.route.ts` | GET + PUT /schedules/me autenticados | ✓ VERIFIED | preHandler: [fastify.authenticate] em ambas as rotas |
| `apps/api/src/modules/orders/orders.service.ts` | createSingleOrder com $transaction | ✓ VERIFIED | 105 linhas, usa prisma.$transaction com verificação de saldo |
| `apps/api/src/modules/orders/orders.route.ts` | POST /orders autenticado | ✓ VERIFIED | preHandler: [fastify.authenticate] |
| `apps/api/src/modules/notifications/notifications.service.ts` | savePushToken com oneSignalPlayerId | ✓ VERIFIED | 30 linhas, salva oneSignalPlayerId via prisma.user.update |
| `apps/api/src/modules/notifications/notifications.route.ts` | POST /users/push-token autenticado | ✓ VERIFIED | preHandler: [fastify.authenticate] |
| `apps/api/src/plugins/cron.ts` | 2 crons com node-cron + SchedulesService | ✓ VERIFIED | 58 linhas, fp(fastify-plugin), 2 cron.schedule() com timezone |
| `apps/api/src/server.ts` | schedulesRoute, ordersRoute, notificationsRoute, cronPlugin | ✓ VERIFIED | Linhas 95-98: todos registrados na ordem correta |
| `apps/web/src/hooks/useSchedule.ts` | schedule state + consumoSemanal + cobre + falta | ✓ VERIFIED | 136 linhas, cálculos D-03 como valores derivados, GET e PUT /schedules/me |
| `apps/web/src/components/client/DeliveryTimeChips.tsx` | 4 chips horário com seleção exclusiva | ✓ VERIFIED | Existe, borderRadius: 13 per handoff |
| `apps/web/src/components/client/BannerCobertura.tsx` | 2 estados + null quando semana===0 | ✓ VERIFIED | 109 linhas, `if (semana === 0) return null`, estados A e B com tokens corretos |
| `apps/web/src/pages/client/ScheduleScreen.tsx` | 7 Day-Rows + footer + toast | ✓ VERIFIED | 440 linhas, 7 Day-Rows com StepperInline min=0 max=12, footer com consumoSemanal e botão Salvar |
| `apps/web/src/components/client/DateChips.tsx` | chips + CUTOFF_HOUR=21 + input nativo | ✓ VERIFIED | 195 linhas, CUTOFF_HOUR=21, disabled={isAfterCutoff}, type="date" com min/max |
| `apps/web/src/pages/client/SingleScreen.tsx` | stepper 1-20 + BannerInsuficiente + CreditCard | ✓ VERIFIED | 368 linhas, min={1} max={20}, BannerInsuficiente condicional, CreditCard inline |
| `apps/web/src/hooks/useOneSignalRegister.ts` | registra player_id via POST /users/push-token | ✓ VERIFIED | 71 linhas, useEffect com cleanup, chama apiFetch('/users/push-token') |
| `apps/web/src/routes/router.tsx` | agenda → ScheduleScreen, agenda/pedido-unico → SingleScreen | ✓ VERIFIED | Linhas 58-68, lazy imports corretos |
| `apps/web/src/pages/client/ClientLayout.tsx` | useOneSignalRegister() chamado | ✓ VERIFIED | Linha 11: `useOneSignalRegister()` chamado dentro de ClientLayout |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `schedules.service.ts` | `fastify.prisma.schedule` | `upsert` | ✓ WIRED | `this.prisma.schedule.upsert(...)` em upsertSchedule |
| `schedules.service.ts` | `@onesignal/node-onesignal` | `sendReconfigureReminders` | ✓ WIRED | `osClient.createNotification(notification)` em 3 métodos diferentes |
| `orders.service.ts` | `fastify.prisma` | `$transaction` | ✓ WIRED | `this.prisma.$transaction(async (tx) => {...})` em createSingleOrder |
| `notifications.service.ts` | `fastify.prisma.user` | `update oneSignalPlayerId` | ✓ WIRED | `prisma.user.update({data: {oneSignalPlayerId: playerId}})` |
| `cron.ts` | `schedules.service.ts` | `SchedulesService constructor` | ✓ WIRED | `new SchedulesService(fastify)` no plugin, chamadas diretas aos métodos |
| `server.ts` | `cron.ts` | `fastify.register(cronPlugin)` | ✓ WIRED | Linha 98 do server.ts |
| `useSchedule.ts` | `/schedules/me` | `apiFetch` | ✓ WIRED | GET e PUT via `apiFetch('/schedules/me', ...)` |
| `ScheduleScreen.tsx` | `AuthContext.tsx` | `useAuth().user.creditBalance` | ✓ WIRED | `const { user } = useAuth(); const creditBalance = user?.creditBalance ?? 0` |
| `useOneSignalRegister.ts` | `/users/push-token` | `apiFetch POST` | ✓ WIRED | `apiFetch('/users/push-token', {method: 'POST', ...})` |
| `ClientLayout.tsx` | `useOneSignalRegister.ts` | `useOneSignalRegister()` | ✓ WIRED | Import e chamada na linha 6 e 11 |
| `ScheduleScreen.tsx` | `/client/creditos/compra-automatica` | `navigate` | ✗ BROKEN | Rota não existe no router — router tem `creditos/recorrente` |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `ScheduleScreen.tsx` | `weeklyQty`, `deliveryTime` | `useSchedule` → `apiFetch GET /schedules/me` → prisma.schedule.findFirst | Sim — dados do banco MongoDB Atlas | ✓ FLOWING |
| `SingleScreen.tsx` | `creditBalance` | `useAuth().user.creditBalance` → AuthContext → JWT | Sim — saldo real do usuário autenticado | ✓ FLOWING |
| `ScheduleScreen.tsx` | `consumoSemanal`, `cobre`, `falta` | Calculados localmente de `weeklyQty` (D-03) | Sim — soma real das quantidades configuradas | ✓ FLOWING |
| `BannerCobertura.tsx` | `semana`, `saldo`, `cobre` | Props de ScheduleScreen (acima) | Sim — derivado do estado real | ✓ FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Schema tem oneSignalPlayerId | `grep "oneSignalPlayerId" apps/api/prisma/schema.prisma` | 1 match (linha 118) | ✓ PASS |
| Schema tem @@unique em Schedule | `grep "@@unique" apps/api/prisma/schema.prisma` | 1 match (linha 191) | ✓ PASS |
| node-cron instalado | `grep "node-cron" apps/api/package.json` | "node-cron": "^4.2.1" | ✓ PASS |
| @onesignal/node-onesignal instalado | `grep "onesignal" apps/api/package.json` | "^5.8.0" | ✓ PASS |
| cron usa timezone America/Sao_Paulo | `grep -c "America/Sao_Paulo" apps/api/src/plugins/cron.ts` | 4 (>= 2 exigido) | ✓ PASS |
| Orders com $transaction | `grep "prisma.*transaction" apps/api/src/modules/orders/orders.service.ts` | match na linha 65 | ✓ PASS |
| type='SINGLE' para pedido avulso | `grep "'SINGLE'" apps/api/src/modules/orders/orders.service.ts` | match linha 82 | ✓ PASS |
| userId do JWT em notifications | `grep "request.user" apps/api/src/modules/notifications/notifications.controller.ts` | `request.user!.id` linha 41 | ✓ PASS |
| ScheduleScreen sem PlaceholderScreen na rota agenda | `grep "PlaceholderScreen" router.tsx` (rota agenda) | PlaceholderScreen presente APENAS na rota 'pedidos' | ✓ PASS |
| BannerCobertura hidden quando semana===0 | `grep "semana === 0" BannerCobertura.tsx` | match linha 29 | ✓ PASS |
| CUTOFF_HOUR=21 em DateChips | `grep "CUTOFF_HOUR" DateChips.tsx` | `CUTOFF_HOUR = 21` linha 13 | ✓ PASS |
| Link broken: compra-automatica vs recorrente | `grep "compra-automatica" router.tsx` | 0 resultados — rota não existe | ✗ FAIL |

---

## Probe Execution

Step 7c: SKIPPED — nenhum probe-*.sh encontrado para a fase 04 e a fase não é migração/tooling.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| SCHED-01 | 04-03, 04-06 | Pedido único com reserva imediata de créditos | ✓ SATISFIED | OrdersService.createSingleOrder via $transaction; SingleScreen + POST /orders |
| SCHED-02 | 04-02, 04-05 | Agendamento semanal personalizado por dia | ✓ SATISFIED | ScheduleBodySchema com WeeklyQty; ScheduleScreen com 7 Day-Rows |
| SCHED-03 | 04-02, 04-04 | Agendamento repete automaticamente toda semana | ✓ SATISFIED | Cron meia-noite chama createDailyOrders(); Orders criados automaticamente |
| SCHED-04 | 04-02, 04-04, 04-06 | Notificação de reconfiguração semanal | ✓ SATISFIED | Cron domingo 20h chama sendReconfigureReminders(); switch notifyReconfigure na ScheduleScreen |
| SCHED-05 | 04-05 | Banner de alerta quando créditos insuficientes | ✓ SATISFIED | BannerCobertura estado A (goldSoft); createDailyOrders não cria Order e envia push |
| SCHED-06 | 04-05 | Tela exibe consumo semanal e cobertura de créditos | ✓ SATISFIED | useSchedule calcula consumoSemanal e cobre; footer mostra "{n} pães · {hora}" |
| SCHED-07 | — | **ID INEXISTENTE** | — | SCHED-07 não existe em REQUIREMENTS.md — apenas SCHED-01..06 definidos para Phase 4 |
| CRED-07 | 04-04 | Compra automática (quando acabar / toda semana) | ✓ SATISFIED (implementado) | processAutoBuy() em schedules.service.ts — porém REQUIREMENTS.md não remapeia para Phase 4 |
| CRED-10 | 04-02 | Combo comprado automaticamente + confirmação | ~ PARTIAL | processAutoBuy envia push para o cliente finalizar o Pix (Pix-first MVP conforme D-12); cobrança silenciosa adiada — REQUIREMENTS.md marca como Pending |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|---------|--------|
| `apps/web/src/pages/client/ScheduleScreen.tsx` | 340 | Link quebrado: navega para `/client/creditos/compra-automatica` que não existe no router | BLOCKER | Clique no BannerCobertura estado B (saldo suficiente) gera 404 — usuário não consegue acessar a tela de compra automática pela ScheduleScreen |
| `apps/web/src/components/client/__tests__/BannerInsuficiente.test.tsx` | 7-10 | 4 `it.todo` restantes (Wave 0 stubs não substituídos) | WARNING | BannerInsuficiente.tsx existe e está sendo usado na SingleScreen, mas seus testes unitários permanecem como stubs — cobertura de teste ausente para o componente |

---

## Human Verification Required

### 1. Navegação aba Agenda → ScheduleScreen

**Test:** Acessar `/client/agenda` no PWA autenticado como cliente
**Expected:** ScheduleScreen com 7 Day-Rows (Seg-Dom), chips de horário, card de lembrete e botão "Salvar agenda"
**Why human:** Verificação visual do lazy loading e renderização completa

### 2. Fluxo de salvar agenda semanal

**Test:** Ajustar quantidade de pães para diferentes dias e clicar "Salvar agenda"
**Expected:** Toast "Agenda salva!" aparece por 2.5s; GET /schedules/me subsequente retorna os valores salvos
**Why human:** Requer chamada real ao banco MongoDB Atlas e confirmação do ciclo PUT/toast

### 3. Fluxo de pedido único (SingleScreen)

**Test:** Acessar `/client/agenda/pedido-unico`, selecionar quantidade e data, clicar "Reservar e confirmar"
**Expected:** Toast "Pedido agendado!" + redirect para /client/agenda; saldo decrementado no AuthContext
**Why human:** Requer saldo real no banco e chamada ao $transaction

### 4. Chip "Amanhã cedo" desabilitado após 21h

**Test:** Testar o chip no dispositivo após as 21h (horário do servidor/browser)
**Expected:** Chip com opacity 0.4, não responde a cliques, sub-label "Disponível até 21:00"
**Why human:** Depende do horário real do dispositivo no momento do teste

### 5. Registro de push token via OneSignal

**Test:** Instalar o PWA, aceitar notificações e verificar backend
**Expected:** `POST /users/push-token` com playerId salvo no campo `oneSignalPlayerId` do User no Atlas
**Why human:** Requer PWA instalado, SDK OneSignal configurado com credenciais reais e permissão do SO

### 6. Execução do cron de meia-noite

**Test:** Verificar Orders criados automaticamente após meia-noite (ou forçar execução via script de teste)
**Expected:** Orders com type='SCHEDULED', status='SCHEDULED', userId correto, scheduledDate=amanhã; creditBalance decrementado no User
**Why human:** Requer espera pelo horário agendado ou mecanismo de trigger manual

---

## Gaps Summary

**1 gap bloqueador identificado:**

**Link quebrado: `onAutoBuy` navega para rota inexistente.**

`ScheduleScreen.tsx` (linha 340) chama `navigate('/client/creditos/compra-automatica')` quando o usuário clica no BannerCobertura em estado B (saldo suficiente, cobre semanas). Entretanto, `router.tsx` registra o `AutoBuyScreen` sob o path `creditos/recorrente`. O resultado é uma navegação 404 — o usuário não consegue acessar a tela de compra automática a partir da agenda.

**Correção:** Alterar ScheduleScreen.tsx linha 340 de `'/client/creditos/compra-automatica'` para `'/client/creditos/recorrente'`.

**Contexto de rastreabilidade (informacional — não bloqueador):**

SCHED-07 mencionado no prompt não existe em REQUIREMENTS.md. CRED-07 e CRED-10 são tecnicamente implementados na Fase 4 (via `processAutoBuy`), mas REQUIREMENTS.md não foi atualizado para refletir esse remapeamento — ainda os indica como Phase 3. Isso é uma inconsistência de documentação, não de implementação.

---

*Verified: 2026-06-15T00:00:00Z*
*Verifier: Claude (gsd-verifier)*
