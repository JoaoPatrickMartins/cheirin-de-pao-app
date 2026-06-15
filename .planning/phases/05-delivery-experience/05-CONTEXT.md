# Phase 5: Delivery Experience - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Cliente acompanha o status da entrega em tempo real (3 estados: Agendado → Saiu para entrega → Entregue), recebe notificações push automáticas (véspera às 21h e confirmação de entrega), acessa histórico dos últimos 30 dias e tem uma central de notificações no app.

O entregador ainda não tem app nesta fase (Fase 6) — a transição SCHEDULED → OUT_FOR_DELIVERY é acionada manualmente pelo Admin.

</domain>

<decisions>
## Implementation Decisions

### Status em Tempo Real (ACOMP-01)
- **D-01:** Transição `SCHEDULED → OUT_FOR_DELIVERY` acionada manualmente pelo Admin (Fase 5). A Fase 6 substituirá por confirmação do entregador.
- **D-02:** Schema Prisma precisa do novo valor `OUT_FOR_DELIVERY` no enum `OrderStatus` (atualmente só `SCHEDULED` e `DELIVERED`).
- **D-03:** Cliente vê o status atualizado via **polling automático a cada 30s** — `useEffect` + `setInterval` chamando `GET /orders/today`. Mesmo padrão do `PixWaitingScreen` (Fase 3). Sem WebSocket nem SSE no MVP.

### Notificações Push (ACOMP-02, ACOMP-03)
- **D-04:** Notificação de véspera (lembrete): cron `0 21 * * *` em `America/Sao_Paulo`. Horário **21h hardcoded** na Fase 5 — configurável pelo Admin na Fase 7.
- **D-05:** Notificação de confirmação de entrega: disparada no momento em que o Admin muda o status para `DELIVERED` (endpoint `PATCH /orders/:id/status`).
- **D-06:** Clientes sem `oneSignalPlayerId` registrado são silenciosamente ignorados pelo cron — **sem erro, sem retry**. Notificação é best-effort.

### Histórico e Tela de Acompanhamento (ACOMP-04)
- **D-07:** Status do dia atual e histórico ficam na **mesma tela** (`TrackingScreen`): card de status do pedido de hoje no topo (quando houver), lista de histórico abaixo.
- **D-08:** Histórico exibe apenas **dias com pedido** (sem dias vazios). Período: últimos 30 dias. Endpoint: `GET /orders/history?days=30`.

### Central de Notificações (ACOMP-05)
- **D-09:** Central acessível via **ícone de sino na HomeScreen** com badge vermelho quando há itens novos. Toque abre `NotificationsScreen` dedicada.
- **D-10:** Limite de **30 notificações** armazenadas por usuário. Todas marcadas como lidas (`read: true`) ao abrir a tela.

### Admin — Acionamento Manual
- **D-11:** Admin precisa de endpoint `PATCH /admin/orders/:id/status` (com `preHandler: [fastify.authenticate, fastify.requireAdmin]`) para mudar `SCHEDULED → OUT_FOR_DELIVERY → DELIVERED`. UI Admin fica para Fase 7 — na Fase 5 pode ser testado via curl/Postman.
- **D-12:** PAY-03 (status de pagamento no Admin) e PAY-04 (estorno/reembolso) ficam **diferidos para Fase 7** conforme já registrado no STATE.md.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos e Domínio
- `.planning/REQUIREMENTS.md` §ACOMP-01..05 — requisitos de acompanhamento desta fase
- `.planning/phases/05-delivery-experience/05-CONTEXT.md` — este arquivo

### Fase Anterior (dependências diretas)
- `.planning/phases/04-scheduling/04-02-SUMMARY.md` — módulo schedules: `SchedulesService.createDailyOrders`, `sendReconfigureReminders`
- `.planning/phases/04-scheduling/04-03-SUMMARY.md` — módulo orders: `OrdersService.createSingleOrder`, módulo notifications: `POST /users/push-token`
- `.planning/phases/04-scheduling/04-04-SUMMARY.md` — plugin cron.ts (padrão a seguir para novos cron jobs)

### Design
- `.projeto/design_handoff_cheirin_pao/` — handoff de alta fidelidade (mandatório)
- `.projeto/` — requisitos v01 e modelo de funcionamento

### Padrões de Código Existentes
- `apps/web/src/pages/client/PixWaitingScreen.tsx` — padrão de polling com `setInterval` + `useEffect`
- `apps/api/src/plugins/cron.ts` — padrão de cron jobs com node-cron v4 + guard `NODE_ENV !== 'test'`
- `apps/api/src/modules/schedules/schedules.service.ts` — padrão OneSignal batch push

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/pages/client/PixWaitingScreen.tsx` — padrão de polling (setInterval + cleanup) para status em tempo real
- `apps/api/src/plugins/cron.ts` — template de novos cron jobs; copiar guard `NODE_ENV` e estrutura try/catch
- `apps/api/src/modules/schedules/schedules.service.ts` — `sendReconfigureReminders()` usa OneSignal SDK; reutilizar para notificações de véspera e entrega
- `apps/api/src/modules/notifications/notifications.service.ts` — `savePushToken()` já persiste `oneSignalPlayerId` em `User`

### Established Patterns
- Autenticação via `preHandler: [fastify.authenticate]`; admin via `fastify.requireAdmin`
- Zod schemas em `*.schema.ts`, repository em `*.repository.ts`, service em `*.service.ts`
- Commits atômicos por tarefa; SUMMARY.md obrigatório ao final

### Integration Points
- `Order.status` no schema Prisma precisa de novo valor `OUT_FOR_DELIVERY`
- `Notification` collection precisará ser criada (modelo: `userId`, `type`, `message`, `read`, `createdAt`)
- `HomeScreen.tsx` receberá ícone de sino com badge

</code_context>

<specifics>
## Specific Ideas

- Horário 21h para notificação de véspera — consistente com `CUTOFF_HOUR` da Fase 4 (DateChips)
- Central de notificações: 30 itens máx, mesmo horizonte do histórico (30 dias)
- Fase 7 tornará o horário de notificação configurável pelo Admin

</specifics>

<deferred>
## Deferred Ideas

- **PAY-03** (status de pagamento no Admin) → Fase 7
- **PAY-04** (estorno/reembolso) → Fase 7
- **Horário de véspera configurável pelo Admin** → Fase 7
- **WebSocket/SSE para status em tempo real** → pós-MVP, quando houver demanda

</deferred>

---

*Phase: 5-delivery-experience*
*Context gathered: 2026-06-15*
