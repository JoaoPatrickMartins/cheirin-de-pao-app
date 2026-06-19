# Phase 9: Finalização Rastreamento - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Auditar e completar o loop de rastreamento do cliente end-to-end: verificar o código existente (TrackingScreen, NotificationsScreen, hooks, cron das 21h, backend routes), identificar e corrigir gaps funcionais, e entregar:
- Status da entrega em tempo real na Home (3 estados: Agendado → Saiu para entrega → Entregue) via `useOrderTracking` polling 30s
- Push de véspera (cron 21h — `sendEveReminders`) com deep link para `/client/pedidos`
- Push de entrega confirmada (DELIVERY_DONE — `notifyAndPersist`) com deep link para `/client/pedidos`
- Badge no sino da HomeScreen sincronizado via `NotifContext` compartilhado
- `NotificationsScreen` com cards por tipo, mark-all-read automático ao abrir, e CTAs corretos
- `TrackingScreen` com 3-state stepper + histórico dos últimos 30 dias
- Planos 05-03 e 05-04 marcados como concluídos no ROADMAP após verificação

**Requisitos desta fase:** ACOMP-01, ACOMP-02, ACOMP-03, ACOMP-04, ACOMP-05 (5 requisitos)

</domain>

<decisions>
## Implementation Decisions

### Abordagem à Fase
- **D-01:** Fase 9 **audita e completa gaps** — não reconstrói do zero. O código substancial já existe (TrackingScreen 564 linhas, NotificationsScreen 277 linhas, useOrderTracking, useNotifBadge, crons, rotas de backend). Mesma estratégia da Fase 8: verificar o que funciona end-to-end, identificar lacunas funcionais reais e criar planos apenas para o que está quebrado ou faltando.
- **D-02:** Ao verificar que os planos 05-03 e 05-04 (originalmente Fase 5) estão funcionando corretamente, **marcá-los como concluídos** no ROADMAP.md. Mantém o ROADMAP preciso com o estado real do código.

### Deep Link dos Pushes OneSignal
- **D-03:** Push de véspera (`sendEveReminders`) → adicionar `additionalData: { screen: 'pedidos' }`. Ao tocar, cliente navega para `/client/pedidos` (TrackingScreen).
- **D-04:** Push de entrega confirmada (`notifyAndPersist`, DELIVERY_DONE) → adicionar `additionalData: { screen: 'pedidos' }`. Ao tocar, cliente navega para `/client/pedidos`.
- **D-05:** `useOneSignalDeepLink` extendido para tratar `screen: 'pedidos'` → `navigate('/client/pedidos')`. Montado no `ClientLayout` existente — menor mudança estrutural.

### Badge do Sino — Sincronização via Context
- **D-06:** Criar `NotifContext` com `unreadCount` + `refresh()`. `HomeScreen` e `NotificationsScreen` compartilham o contexto via provider no `ClientLayout`.
- **D-07:** `useNotifBadge` atual é substituído/absorvido pelo `NotifContext`. O hook existente pode ser mantido como wrapper de conveniência se necessário.
- **D-08:** Ao montar a `NotificationsScreen`, chamar automaticamente `PUT /notifications/read-all` no backend e `refresh()` no contexto — badge zera imediatamente. **Sem botão explícito** — abriu a tela, as notificações são marcadas como lidas.

### actionRoute das Notificações In-App
- **D-09:** `sendEveReminders` passa a persistir `DELIVERY_EVE` com `actionRoute: '/client/pedidos'`.
- **D-10:** `CTA_CONFIG` na `NotificationsScreen` recebe entrada para `DELIVERY_EVE`: `{ label: 'Ver pedido', path: '/client/pedidos' }`.
- **D-11:** `CTA_CONFIG` na `NotificationsScreen` recebe entrada para `OUT_FOR_DELIVERY`: `{ label: 'Acompanhar', path: '/client/pedidos' }`. (Nenhum push é disparado hoje para este tipo — configurado preventivamente para quando for adicionado.)

### Claude's Discretion
- Polling do `useOrderTracking` (30s) mantido como está — sem mudança de intervalo.
- Estrutura interna do `NotifContext` (React.createContext vs. Zustand) — implementar com React Context nativo (padrão existente no projeto: AuthContext).
- `deliveredAt` no card da TrackingScreen — exibir se disponível no response de `/orders/history`.
- Estado vazio da NotificationsScreen — Claude implementa conforme design handoff.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos e Regras de Negócio
- `.projeto/Cheirin_de_Pao_Requisitos_v01.md` §ACOMP — ACOMP-01..05 (acompanhamento de entrega e histórico)
- `.projeto/Cheirin_de_Pao_Modelo_Funcionamento.md` — modelo de negócio: ciclo de vida do pedido (estados), notificações e central de notificações

### Design e UI
- `.projeto/design_handoff_cheirin_pao/app/screens-client-extra.jsx` — `TrackScreen` e `NotifsScreen` (referência de design para TrackingScreen e NotificationsScreen). **Leitura obrigatória** antes de implementar qualquer tela.
- `.projeto/design_handoff_cheirin_pao/app/screens-home.jsx` — HomeA "Carteira" com seção "Entrega de hoje" e badge do sino (referência do estado já entregue na Fase 8)
- `.projeto/design_handoff_cheirin_pao/app/brand.jsx` — tokens de tema (espresso, dourado, creme), tipografia

### Código Existente — Frontend
- `apps/web/src/pages/client/TrackingScreen.tsx` — 564 linhas; 3-state stepper + seção de histórico. **Ponto de partida para auditoria.**
- `apps/web/src/pages/client/NotificationsScreen.tsx` — 277 linhas; cards por tipo, CTA_CONFIG, formatTimestamp. **Ponto de partida para auditoria.**
- `apps/web/src/hooks/useOrderTracking.ts` — polling `/orders/today` a cada 30s; `TodayOrder` interface
- `apps/web/src/hooks/useNotifBadge.ts` — fetch `/notifications/unread-count` no mount; substituir/absorver pelo NotifContext (D-06)
- `apps/web/src/hooks/useOneSignalDeepLink.ts` — handler de push click; estender para `screen: 'pedidos'` (D-05)
- `apps/web/src/pages/client/HomeScreen.tsx` — badge já wired via `useNotifBadge` (linha 52); botão sino navega para `/client/notificacoes` (linha 172)
- `apps/web/src/routes/router.tsx` — rotas `/client/pedidos` (TrackingScreen) e `/client/notificacoes` (NotificationsScreen) já configuradas

### Código Existente — Backend
- `apps/api/src/modules/schedules/schedules.service.ts` — `sendEveReminders()` (cron 21h); adicionar `additionalData: { screen: 'pedidos' }` e `actionRoute: '/client/pedidos'` (D-03, D-09)
- `apps/api/src/modules/admin-orders/admin-orders.service.ts` — `notifyAndPersist()` (DELIVERY_DONE); adicionar `additionalData: { screen: 'pedidos' }` no push OneSignal (D-04)
- `apps/api/src/modules/notifications/notifications.service.ts` — `getByUserId()`, `markAllRead()`, `countUnread()`, `createAndTrim()`
- `apps/api/src/modules/notifications/notifications.route.ts` — `/notifications/me`, `/notifications/read-all`, `/notifications/unread-count`
- `apps/api/src/modules/orders/orders.route.ts` — `/orders/today` (status em tempo real) e `/orders/history` (últimos 30 dias)
- `apps/api/src/plugins/cron.ts` — Cron 3 às 21h (`sendEveReminders`) já registrado

### Planos Pendentes da Fase 5 (para auditoria)
- `.planning/phases/05-delivery-experience/05-03-PLAN.md` — plano original de rastreamento (para verificação)
- `.planning/phases/05-delivery-experience/05-04-PLAN.md` — plano original de notificações (para verificação)
- `.planning/phases/05-delivery-experience/05-CONTEXT.md` — decisões de design da Fase 5 (contexto histórico)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useOrderTracking` (`apps/web/src/hooks/useOrderTracking.ts`) — polling existente, reutilizar sem alteração
- `useOneSignalDeepLink` (`apps/web/src/hooks/useOneSignalDeepLink.ts`) — estender com case `'pedidos'`
- `apiFetch` wrapper — usado em todos os hooks; injeção automática de token de autenticação
- `AuthContext` — padrão de Context existente no projeto; `NotifContext` deve seguir o mesmo padrão

### Established Patterns
- **Cron error isolation**: cada bloco try/catch independente em `cron.ts` — falha em sendEveReminders não afeta outros crons
- **Push OneSignal best-effort**: push dentro de try/catch; `createAndTrim` persistido fora do try (garantido) — padrão em `admin-orders.service.ts` e `schedules.service.ts`
- **Módulo Fastify**: `modules/{domain}/{domain}.route.ts` + `.controller.ts` + `.service.ts` — notifications já segue o padrão
- **`additionalData.screen`** para deep link OneSignal: padrão definido em `schedules.service.ts` (`screen: 'creditos'`) e `useOneSignalDeepLink`

### Integration Points
- **NotifContext** provisionado no `ClientLayout` — `HomeScreen` e `NotificationsScreen` consomem
- **Cron 21h**: `sendEveReminders()` em `schedules.service.ts` → adicionar `additionalData` no push OneSignal e `actionRoute` na chamada `createAndTrim`
- **`notifyAndPersist`**: em `admin-orders.service.ts` → adicionar `additionalData: { screen: 'pedidos' }` no `OneSignal.Notification()`
- **router.tsx**: rotas `/client/pedidos` e `/client/notificacoes` já configuradas com lazy imports — sem necessidade de registrar novamente

</code_context>

<specifics>
## Specific Ideas

- **Auditoria dos planos 05-03/05-04**: verificar especificamente: (1) `sendEveReminders` persiste DELIVERY_EVE corretamente, (2) `notifyAndPersist` dispara push + persiste DELIVERY_DONE ao confirmar entrega, (3) `/orders/today` retorna status correto, (4) `/orders/history` retorna últimos 30 dias com paginação correta, (5) `TrackingScreen` renderiza os 3 estados corretamente com dados reais
- **NotifContext**: seguir exatamente o padrão do `AuthContext` existente — `React.createContext`, provider em `ClientLayout`, hook `useNotif()` para consumir
- **mark-all-read automático**: chamada a `PUT /notifications/read-all` no `useEffect` de montagem da `NotificationsScreen` (sem depender de interação do usuário)
- **Badge visual**: badge vermelho com número (já implementado na HomeScreen para counts > 0) — verificar se o CSS já está correto no código existente
- **CTA na NotificationsScreen**: ao tocar no CTA de uma notificação, navegar para `actionRoute` via `useNavigate` — verificar se já está wired ou é um gap

</specifics>

<deferred>
## Deferred Ideas

- **Push de "Saiu para entrega" (OUT_FOR_DELIVERY)**: adicionar push quando admin muda status para OUT_FOR_DELIVERY está fora do escopo dos requisitos ACOMP-02/03 (apenas véspera e DELIVERED). Defer → v2 se demandado.
- **Polling do badge em tempo real**: se o cliente estiver na Home e receber uma push enquanto está com o app aberto, o badge não atualiza até reabrir a tela. Defer → v2 (WebSocket ou Server-Sent Events).
- **Toggles granulares de notificações push**: já deferido em v2 no STATE.md — mantido.

</deferred>

---

*Phase: 09-finaliza-o-rastreamento*
*Context gathered: 2026-06-19*
