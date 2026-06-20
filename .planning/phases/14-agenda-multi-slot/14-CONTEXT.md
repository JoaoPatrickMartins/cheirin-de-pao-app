# Phase 14: Agenda Multi-Slot - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Esta fase entrega o suporte a múltiplos horários de entrega na agenda semanal do cliente. Quando o condomínio tem 2 slots ativos, o cliente configura quantidade de pães por horário (manhã e tarde) para cada dia da semana. O cron de meia-noite gera um Order separado por slot. Agendamentos legados (campo único `deliveryTime` + `weeklyQty`) continuam funcionando sem migração forçada de dados.

**Requisitos desta fase:** MSCHED-01, MSCHED-02, MSCHED-03, MSCHED-04 (4 requisitos)

</domain>

<decisions>
## Implementation Decisions

### Formato do Campo `days` (Estrutura de Dados)

- **D-01:** Estrutura do campo `days Json?` no modelo `Schedule`: **por slot (chave = horário HH:MM)**. Formato: `{ "06:30": WeeklyQty, "15:30": WeeklyQty }` onde `WeeklyQty = { seg, ter, qua, qui, sex, sab, dom: number }`. Alinha com `Condominium.deliverySlots String[]` (array de strings HH:MM, D-15 de fases anteriores).

- **D-02:** Adicionar `deliveryTime String?` ao modelo `Order` via `db push`. Orders criados pelo cron multi-slot têm `deliveryTime` preenchido com o horário do slot (ex: `"06:30"`). Orders legados (single-slot, antes desta fase) têm `deliveryTime: null` — backward-compatible.

### Endpoint de Save (`PUT /schedules/me`)

- **D-03:** Endpoint `PUT /schedules/me` aceita dois formatos no body — backward-compatible:
  - **Novo (multi-slot):** `{ days: Record<string, WeeklyQty>, notifyReconfigure: boolean }` — quando o condo tem 2+ slots ativos.
  - **Legado (single-slot):** `{ weeklyQty: WeeklyQty, deliveryTime: string, notifyReconfigure: boolean }` — quando o condo tem apenas 1 slot.
  - Se `days` está presente no body → salva no campo `schedule.days`. Se ausente → salva nos campos `weeklyQty` + `deliveryTime` como antes. O schema Zod aceita ambos.

### Endpoint de Leitura (`GET /schedules/me`)

- **D-04:** Endpoint `GET /schedules/me` retorna `{ weeklyQty, deliveryTime, days, notifyReconfigure, isActive }`. O frontend usa `days` se não-null, senão usa `weeklyQty + deliveryTime`. A lógica de fallback fica no hook — sem normalização no backend.

### UI Condicional da ScheduleScreen

- **D-05:** Condição de renderização multi-slot: `slots.filter(s => s.isActive).length >= 2`. Se verdadeiro → exibe modo multi-slot (2 seções). Senão → exibe modo single-slot (UI atual inalterada). Os `slots` já são buscados via `/client/condominium/slots` na montagem da ScheduleScreen.

- **D-06:** No modo multi-slot, `DeliveryTimeChips` **não é usado** (horários são fixos, definidos pelo condo — não é mais uma escolha do cliente). As seções têm headers fixos: "☀️ Manhã · 06:30" e "🌙 Tarde · 15:30", cada uma com 7 day-rows (label + stepper) abaixo.

- **D-07:** Footer no modo multi-slot: exibe `"Consumo semanal: X pães"` (soma total de todos os slots de todos os dias). O horário é removido do footer — não faz sentido exibir um único horário com 2 slots.

### Backward-Compat no Cron e Services

- **D-08:** `createDailyOrders()` — detecção de modo via campo `schedule.days`:
  - Se `schedule.days` **não é null**: modo multi-slot — itera `Object.entries(days)`, para cada `[slotTime, weeklyQtyMap]`, cria 1 Order com `{ qty: weeklyQtyMap[dayKey], deliveryTime: slotTime }` se `qty > 0`.
  - Se `schedule.days` **é null**: modo legado — usa `weeklyQty[dayKey]`, cria 1 Order sem `deliveryTime` (comportamento atual).

- **D-09:** Extrair função helper `getConsumoSemanal(schedule)` no `schedules.service.ts` — reutilizada em `processAutoBuy`, `sendLowCreditNotifications` e `createDailyOrders`:
  ```ts
  function getConsumoSemanal(schedule): number {
    if (schedule.days) {
      const days = schedule.days as Record<string, WeeklyQty>
      return Object.values(days)
        .flatMap(wq => Object.values(wq))
        .reduce((sum, v) => sum + (v as number), 0)
    }
    const wq = schedule.weeklyQty as WeeklyQty
    return Object.values(wq).reduce((sum, v) => sum + v, 0)
  }
  ```

- **D-10:** `sendEveReminders()` — um push **por order** (comportamento atual mantido). Com multi-slot, um cliente com 2 orders no mesmo dia recebe 2 pushes de véspera. O texto do push inclui `Order.deliveryTime` quando disponível: `"2 pães às 06:30 amanhã"`.

### Hook `useSchedule` (Frontend)

- **D-11:** Estender o `useSchedule` existente (não criar hook novo). Adicionar ao return: `days: Record<string, WeeklyQty>` e `setDays: (d: Record<string, WeeklyQty>) => void`. O hook retorna os dois estados (legado e multi-slot). A `ScheduleScreen` usa o par adequado baseado em `activeSlots`.

- **D-12:** `saveSchedule(activeSlots: DeliverySlot[])` — o hook passa a receber `activeSlots` como parâmetro. Internamente: se `activeSlots.filter(s => s.isActive).length >= 2` → envia `{ days, notifyReconfigure }`. Senão → envia `{ weeklyQty, deliveryTime, notifyReconfigure }`.

- **D-13:** Inicialização do estado `days` ao carregar schedule legado (`schedule.days === null`) quando o condo já tem 2 slots ativos: inicializar `days` com `{ [slot.time]: DEFAULT_WEEKLY_QTY }` para cada slot ativo — cliente configura do zero no novo formato. Sem migração automática do `weeklyQty` legado (evita confusão de horário).

### Claude's Discretion

- Design visual dos headers de seção na ScheduleScreen multi-slot (ícone exato de sol/lua, tamanho do label, separação entre seções) — seguir padrão visual existente (fundo creme, tokens espresso/dourado).
- Mensagens de push de véspera com `deliveryTime` incluído (ex: "2 pães às 06:30 amanhã" vs "Lembrete: 2 pães agendados para amanhã — 06:30") — texto final fica a critério do executor.
- Skeleton de loading para modo multi-slot (2x7 rows) — seguir o padrão de skeleton já existente na ScheduleScreen (pulse animation).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos e Regras de Negócio
- `.projeto/Cheirin_de_Pao_Requisitos_v01.md` §MSCHED — MSCHED-01 a MSCHED-04 (agenda multi-slot — requisitos desta fase)
- `.projeto/Cheirin_de_Pao_Modelo_Funcionamento.md` — modelo de negócio: ciclo de créditos e agendamentos (contexto para geração de orders e consumo de créditos)

### Schema Prisma
- `apps/api/prisma/schema.prisma` — schema v1.1 (Phase 10). Leitura obrigatória — modelo `Schedule` (campos `weeklyQty`, `deliveryTime`, `days`), modelo `Order` (adicionar `deliveryTime String?` nesta fase), modelo `Condominium` (campo `deliverySlots String[]`).

### Decisões de Fases Anteriores Relevantes
- D-14 (STATE.md): `Schedule.days Json?` adicionado sem formato definido — esta fase define o formato `{ "HH:MM": WeeklyQty }`.
- D-15 (STATE.md): `Condominium.deliverySlots String[]` — array de strings HH:MM. Chaves do campo `days` devem espelhar exatamente os valores deste array.
- D-17 (STATE.md): `@@unique([userId, condominiumId])` mantido — 1 Schedule por cliente por condomínio; o campo `days` carrega múltiplos slots dentro de um único documento.

### Código Existente — Frontend (pontos de integração)
- `apps/web/src/pages/client/ScheduleScreen.tsx` — tela atual a ser refatorada para suporte multi-slot. Já busca slots via `/client/condominium/slots`. Renderização condicional baseada em `activeSlots.length >= 2`.
- `apps/web/src/hooks/useSchedule.ts` — hook a ser estendido com `days`/`setDays` e `saveSchedule(activeSlots)`. Leitura obrigatória antes de modificar.
- `apps/web/src/components/client/DeliveryTimeChips.tsx` — componente atual de seleção de horário. **Não usar no modo multi-slot** — substituído por headers fixos de seção.
- `apps/web/src/components/client/StepperInline.tsx` — stepper reutilizável para as day-rows em ambos os modos (single-slot e multi-slot).
- `apps/web/src/components/client/BannerCobertura.tsx` — componente de cobertura de créditos. Recebe `semana` (consumoSemanal total) — compatível com multi-slot desde que o `consumoSemanal` seja a soma de todos os slots.

### Código Existente — Backend (pontos de integração)
- `apps/api/src/modules/schedules/schedules.service.ts` — **leitura obrigatória**. Contém `createDailyOrders()`, `processAutoBuy()`, `sendLowCreditNotifications()`, `sendEveReminders()`. Todos precisam atualização para multi-slot (D-08, D-09, D-10).
- `apps/api/src/modules/schedules/schedules.schema.ts` — schema Zod do body `PUT /schedules/me`. Adicionar campo `days` opcional (D-03).
- `apps/api/src/modules/schedules/schedules.repository.ts` — método `upsert()` que salva o schedule. Verificar se aceita o campo `days`.
- `apps/api/src/modules/schedules/schedules.route.ts` — rota GET e PUT. Verificar response do GET para incluir campo `days` (D-04).
- `apps/api/src/plugins/cron.ts` — cron de meia-noite chama `createDailyOrders()`. Sem mudança no cron em si — apenas no service.

### Pending Todo (do STATE.md)
- "Verificar se `CourierScreen` precisa filtrar por slot em `GET /courier/orders/today` após Phase 14" — verificar se o entregador precisa ver orders agrupados por slot (manhã vs tarde) nesta fase.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StepperInline` — já usado nas day-rows do modo single-slot. Reutilizado diretamente nas seções de manhã e tarde.
- `BannerCobertura` — recebe `semana: number` (consumo total). Compatível com multi-slot sem mudança, desde que o hook some todos os slots.
- `useSchedule` — hook a estender, não reescrever. Já tem `isLoading`, `isSaving`, `notifyReconfigure`, `saveSchedule`, `consumoSemanal`. Base sólida para adicionar `days`.
- `apiFetch` — utilitário de fetch autenticado já em uso no hook e na ScheduleScreen.
- Skeleton de loading com `pulse` animation — já implementado na ScheduleScreen (linhas 210-229). Reutilizar para as 2 seções multi-slot.

### Established Patterns
- Detecção de modo no frontend via array de slots: `slots.filter(s => s.isActive).length >= 2` — alinha com o padrão de `DeliveryTimeChips` que já usa `slots.map(...)`.
- Cron com try/catch por schedule: `schedules.service.ts` já processa schedules em loop com try/catch individual — manter o mesmo padrão no modo multi-slot.
- `prisma.$transaction` para criar Order + decrementar creditBalance + criar CreditTransaction atomicamente — manter para cada slot no multi-slot.

### Integration Points
- `apps/api/prisma/schema.prisma`: adicionar `deliveryTime String?` ao modelo `Order` e rodar `db push`.
- `schedules.service.ts` → `createDailyOrders()`: ponto principal de mudança no backend.
- `ScheduleScreen.tsx`: renderização condicional baseada em `activeSlots` (slots já buscados no `useEffect` existente).
- `useSchedule.ts`: adicionar estado `days` e modificar `saveSchedule` para aceitar `activeSlots`.

</code_context>

<specifics>
## Specific Ideas

- Footer multi-slot: `"Consumo semanal: X pães"` (sem horário) — simples e direto.
- Headers de seção com emoji temporal: "☀️ Manhã · 06:30" e "🌙 Tarde · 15:30" — conforme mockup aprovado.
- Função helper `getConsumoSemanal(schedule)` extraída no service — padrão de utilitário puro sem side effects.
- `saveSchedule(activeSlots)` — assinatura do hook com `activeSlots` como parâmetro explícito para decidir o formato do body.
- `Order.deliveryTime` adicionado via `db push` — sem migração; campo nullable backward-compatible.

</specifics>

<deferred>
## Deferred Ideas

- Agrupamento de orders por slot na `CourierScreen` (entregador vê "manhã" vs "tarde") — o pending todo do STATE.md; verificar se está no escopo desta fase ou é Phase seguinte.
- Migração automática do `weeklyQty` legado para o primeiro slot ao salvar (usuário que já tinha agenda configurada vê os valores preservados) — decidido manter inicialização zerada nesta fase por simplicidade.

</deferred>

---

*Phase: 14-Agenda Multi-Slot*
*Context gathered: 2026-06-20*
