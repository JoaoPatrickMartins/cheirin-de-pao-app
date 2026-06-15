# Phase 4: Scheduling - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

O cliente autenticado pode configurar sua agenda semanal de pãezinhos (quantidade por dia da semana, 0 = sem entrega), criar pedidos únicos (avulsos) para datas específicas, e o sistema reserva créditos automaticamente — com alertas quando o saldo não cobre o agendamento. Fase 4 também inclui o cron de geração diária de Orders, o cron de compra automática (CRED-07/10, deferred da Fase 3) e o envio do lembrete de reconfiguração semanal via OneSignal.

**Entregáveis desta fase:**
- ScheduleScreen: agenda semanal por dia da semana com steppers, horário de entrega, toggle de reconfiguração semanal, alerta de cobertura de créditos
- SingleScreen: pedido único com quick chips de data + "Outra data" (input nativo), stepper de quantidade, alerta de crédito insuficiente
- Aba "Agenda" da tab bar — deixa de ser placeholder
- Backend: módulo `schedules` + módulo `orders` (Clean Architecture)
- Cron diário (meia-noite): cria Orders do dia seguinte para cada Schedule ativo
- Cron de compra automática: dispara quando saldo < consumo de 7 dias ou no dia configurado
- OneSignal SDK no backend + endpoint `POST /users/push-token` + cron domingo 20h para lembrete de reconfiguração

**Requisitos desta fase:** SCHED-01..06, CRED-07, CRED-10 (8 requisitos)

</domain>

<decisions>
## Implementation Decisions

### Recorrência semanal (SCHED-03)
- **D-01:** Cron diário roda à **meia-noite** e cria os Orders do dia seguinte para cada Schedule ativo com `isActive: true`. Cada Order é criado com `type: WEEKLY`, `status: SCHEDULED` e `scheduledDate` = próximo dia com quantidade > 0.
- **D-02:** Se o saldo do cliente for insuficiente para cobrir o Order do dia seguinte, o Order **não é criado**. O cliente recebe notificação de alerta via OneSignal (push: "Créditos insuficientes para a entrega de amanhã").
- **D-03:** Consumo semanal na `ScheduleScreen` é **projeção calculada no frontend**: soma das quantidades do plano local (`seg+ter+...`). Não depende de Orders no banco. Cobertura = `Math.floor(saldo / consumoSemanal)` semanas.

### Data no pedido único (SCHED-01)
- **D-04:** Seleção de data via **quick chips** (Amanhã, Depois de amanhã, + próximos dias relevantes) **+ opção "Outra data"** que abre `<input type="date">` nativo. Range válido: de amanhã até 30 dias à frente.
- **D-05:** Horário de corte **hard-coded 21h** como constante (`CUTOFF_HOUR = 21`). Se o horário atual for ≥ 21h, a opção "Amanhã" fica desabilitada e a seleção mínima vira "Depois de amanhã". O Admin configura o valor real na Fase 7 — a constante vira leitura de config do banco então.
- **D-06:** Limite de **30 dias à frente** para agendamento de pedido único. O `<input type="date">` usa `min` e `max` para restringir o range.

### Notificação de reconfiguração semanal (SCHED-04)
- **D-07:** Fase 4 implementa o **envio real via OneSignal SDK** (`@onesignal/node-onesignal` no backend). Não é só salvar a preferência — a Fase 4 entrega o push funcionando.
- **D-08:** Cron domingo 20h: busca todos os usuários com `notifyReconfigure: true` em seus Schedules ativos e envia push via OneSignal SDK com CTA "Ajustar agenda" que deep-linka para a ScheduleScreen.
- **D-09:** Frontend registra o **player_id** (subscription_id) do OneSignal após o usuário aceitar push notifications. Envia via `POST /users/push-token` com `{ playerId: string }`. Backend salva em campo `oneSignalPlayerId` no modelo `User`.

### Cron de compra automática (CRED-07/10 — deferred da Fase 3)
- **D-10:** Fase 4 **implementa o cron de compra automática** completo (CRED-07/10). A UI (`AutoBuyScreen`) e o save de preferência já existem da Fase 3 (D-04).
- **D-11:** Modalidade "quando estiver acabando": limiar = `saldo_atual < consumo_semanal_do_schedule`. O cron verifica diariamente (junto com o cron de criação de Orders) e dispara a compra se o limiar for atingido.
- **D-12:** Modalidade "toda semana": cron roda no dia configurado pelo cliente (seletor no `AutoBuyScreen`) e compra o combo selecionado. Usa o **card token** salvo no `User` na Fase 3 (D-06 da Fase 3).
- **D-13:** Se a compra automática falhar (cartão recusado, token expirado): backend envia push OneSignal "Compra automática falhou — verifique seu cartão" e **não retenta**. Próxima execução do cron tentará novamente se o limiar ainda for atingido.

### Claude's Discretion
- Estrutura interna dos módulos `schedules` e `orders` na API — seguir Clean Architecture já estabelecida (`modules/auth/`, `modules/payments/`)
- Biblioteca de cron no backend — usar `node-cron` (já comum em projetos Fastify/Node.js) ou `@fastify/schedule` se disponível
- Endpoint `GET /schedules/me` retorna o Schedule ativo do cliente — usado pela ScheduleScreen para pre-popular os steppers
- Endpoint `POST /orders` para pedido único — valida crédito antes de criar
- Endpoint `PUT /schedules/me` para salvar/atualizar a agenda semanal — cria Schedule se não existir, atualiza se existir
- Modelo de dados: campo `oneSignalPlayerId: String?` adicionado ao modelo `User` no Prisma schema

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos e Regras de Negócio
- `.projeto/Cheirin_de_Pao_Requisitos_v01.md` §SCHED — SCHED-01..06 (agendamentos completos)
- `.projeto/Cheirin_de_Pao_Requisitos_v01.md` §CRED — CRED-07, CRED-10 (compra automática e disparo por saldo insuficiente)
- `.projeto/Cheirin_de_Pao_Modelo_Funcionamento.md` — modelo de negócio: como créditos são reservados ao agendar e como a agenda semanal repete

### Design e UI
- `.projeto/design_handoff_cheirin_pao/app/screens-order.jsx` — `ScheduleScreen` (linha ~173) e `SingleScreen` (linha ~255): layout exato dos steppers por dia, quick chips de data, alerta de cobertura, banner de crédito insuficiente. **Leitura obrigatória.**
- `.projeto/design_handoff_cheirin_pao/app/screens-client-extra.jsx` — `AutoBuyScreen` (tela de compra automática já existente da Fase 3): layout de referência
- `.projeto/design_handoff_cheirin_pao/app/brand.jsx` — tokens de tema, tipografia (Bricolage Grotesque + Hanken Grotesk), paleta espresso/dourado/creme

### Código Existente (Fases 1–3)
- `apps/api/prisma/schema.prisma` — modelos `Schedule` (linha ~179), `Order` (linha ~192), `OrderType`, `OrderStatus` já definidos — usar sem alterar estrutura base; adicionar `oneSignalPlayerId` ao `User`
- `apps/api/src/modules/auth/auth.route.ts` — padrão de módulo Fastify a seguir para `modules/schedules/` e `modules/orders/`
- `apps/web/src/pages/client/PlaceholderScreen.tsx` — placeholder da aba Agenda que será substituído pela `ScheduleScreen`
- `apps/web/src/lib/apiFetch.ts` — wrapper com Authorization header — todos os hooks de agenda e pedido usam este wrapper
- `apps/web/src/contexts/AuthContext.tsx` — expõe `user` com saldo — `ScheduleScreen` e `SingleScreen` leem o saldo daqui

### Contexto das Decisões da Fase 3
- `.planning/phases/03-credits-commerce/03-CONTEXT.md` — D-04 (AutoBuyScreen UI já feita), D-05 (limiar "quando estiver acabando"), D-06 (card token salvo no User para compra automática)

### Integrações Externas
- OneSignal SDK: `@onesignal/node-onesignal` — para envio de push notifications do backend
- OneSignal Web SDK (frontend): para registrar o player_id no PWA instalado
- `node-cron` ou equivalente — para crons diário (meia-noite), domingo 20h e verificação de auto-buy

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `QuantityStepper` — componente já construído na Fase 3 (D-discretion da Fase 3) para CombosScreen. Reutilizar nos steppers por dia da `ScheduleScreen` (`max={12}`) e no stepper da `SingleScreen` (`max={20}`).
- `apps/web/src/lib/apiFetch.ts` — usar em todos os hooks: `useSchedule`, `useCreateOrder`, `useUpdateSchedule`
- `apps/web/src/contexts/AuthContext.tsx` — `user.credits` para cálculo de cobertura na `ScheduleScreen` e alerta na `SingleScreen`
- `apps/api/src/plugins/authenticate.ts` — preHandler em todas as rotas de schedules e orders
- `apps/api/src/plugins/prisma.ts` — decorator `fastify.prisma` disponível

### Established Patterns
- **Módulo Fastify**: `modules/{domain}/{domain}.route.ts` + `controller.ts` + `service.ts` + `repository.ts` — Fase 4 cria `modules/schedules/` e `modules/orders/` seguindo o mesmo padrão
- **React Context + hook**: criar `useSchedule()` análogo ao `useAuth()` — retorna o Schedule ativo, função de update, e estado de loading
- **PlaceholderScreen → tela real**: a aba "Agenda" já navega para uma rota `/client/schedule` — apenas substituir o conteúdo do placeholder pela `ScheduleScreen` real

### Integration Points
- **Aba Agenda**: `apps/web/src/pages/client/PlaceholderScreen.tsx` na rota `/client/schedule` → substituir pelo componente `ScheduleScreen`
- **Tab bar**: já existente no `ClientLayout.tsx` com a aba "Agenda" funcional desde a Fase 3 (D-08)
- **Cron jobs**: registrar no startup do servidor Fastify (`apps/api/src/server.ts`) ou em plugin separado `plugins/cron.ts`
- **Endpoint push token**: `POST /users/push-token` — novo endpoint no módulo `auth` ou novo módulo `notifications`
- **OneSignal inicialização frontend**: no `apps/web/src/main.tsx` — inicializar SDK OneSignal e registrar o player_id após aceitar push (similar ao `initMercadoPago` já presente)

</code_context>

<specifics>
## Specific Ideas

- **ScheduleScreen — alerta de cobertura**: design mostra dois estados: (1) saldo insuficiente → banner dourado clicável que vai para CombosScreen; (2) saldo suficiente → card cinza clicável que vai para AutoBuyScreen. Replicar exatamente esses dois estados.
- **SingleScreen — crédito insuficiente**: número grande (56px Bricolage Grotesque) muda de cor dourada para `t.warn` quando quantidade > saldo. Card de créditos insuficientes com dois botões: "Comprar créditos" (→ CombosScreen) e "Usar {saldo}" (seta o stepper para o saldo disponível).
- **Horário de entrega na ScheduleScreen**: design mostra 4 quick chips: 06:30, 07:00, 07:30, 08:00. Selecionado tem `background: t.goldSoft, border: t.accent`. Salvo no campo `deliveryTime` do Schedule.
- **Cron diário**: rodar à 00:00 (meia-noite) no timezone do servidor. Considerar timezone do condomínio se suportado futuramente — por enquanto usar UTC-3 (Brasília) hard-coded.

</specifics>

<deferred>
## Deferred Ideas

- **Múltiplos agendamentos por condomínio** (ex: apartamento com 2 moradores querendo entregas em horários diferentes) — fora do escopo do MVP
- **Cancelamento de pedido único após confirmação** — cancelar um Order já criado (reembolso de créditos). Fica para Fase 5 ou 7.
- **Pausa de agenda** (ex: "pausar por 2 semanas durante férias") — nova capability, fase futura
- **Horário de corte configurável pelo Admin** (ADMO-01) — Fase 7. Fase 4 usa constante hard-coded `CUTOFF_HOUR = 21`

</deferred>

---

*Phase: 4-Scheduling*
*Context gathered: 2026-06-14*
