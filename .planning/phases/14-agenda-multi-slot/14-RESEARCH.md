# Phase 14: Agenda Multi-Slot - Research

**Researched:** 2026-06-20
**Domain:** Agenda semanal com suporte a múltiplos horários de entrega (multi-slot)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Estrutura do campo `days Json?` no modelo `Schedule`: `{ "HH:MM": WeeklyQty }` onde `WeeklyQty = { seg, ter, qua, qui, sex, sab, dom: number }`. Alinha com `Condominium.deliverySlots String[]`.
- **D-02:** Adicionar `deliveryTime String?` ao modelo `Order` via `db push`. Orders multi-slot têm `deliveryTime` preenchido; orders legados têm `deliveryTime: null`.
- **D-03:** `PUT /schedules/me` aceita dois formatos backward-compatible — novo (`{ days, notifyReconfigure }`) e legado (`{ weeklyQty, deliveryTime, notifyReconfigure }`). Se `days` presente → salva em `schedule.days`. Ausente → salva em `weeklyQty + deliveryTime` como antes.
- **D-04:** `GET /schedules/me` retorna `{ weeklyQty, deliveryTime, days, notifyReconfigure, isActive }`. Lógica de fallback fica no hook — sem normalização no backend.
- **D-05:** Condição de renderização multi-slot: `slots.filter(s => s.isActive).length >= 2`.
- **D-06:** No modo multi-slot, `DeliveryTimeChips` não é usado. Headers fixos: "☀️ Manhã · 06:30" e "🌙 Tarde · 15:30".
- **D-07:** Footer multi-slot: `"Consumo semanal: X pães"` (sem horário).
- **D-08:** `createDailyOrders()` detecta modo via `schedule.days`: não-null → multi-slot (itera slots), null → modo legado (usa `weeklyQty`).
- **D-09:** Extrair `getConsumoSemanal(schedule)` como helper puro em `schedules.service.ts`.
- **D-10:** `sendEveReminders()` mantém um push por order. Com multi-slot, cliente recebe 2 pushes de véspera. Texto inclui `Order.deliveryTime` quando disponível.
- **D-11:** Estender `useSchedule` (não criar hook novo) com `days: Record<string, WeeklyQty>` e `setDays`.
- **D-12:** `saveSchedule(activeSlots)` decide formato do body baseado em `activeSlots.filter(s => s.isActive).length >= 2`.
- **D-13:** Inicialização do estado `days` ao carregar schedule legado com condo de 2 slots: inicializa com `{ [slot.time]: DEFAULT_WEEKLY_QTY }` para cada slot ativo — sem migrar `weeklyQty` legado.

### Claude's Discretion

- Design visual dos headers de seção (ícone exato de sol/lua, tamanho do label) — seguir padrão visual existente.
- Mensagens de push de véspera com `deliveryTime` incluído — texto final a critério do executor.
- Skeleton de loading para modo multi-slot (2×7 rows) — seguir padrão existente.

### Deferred Ideas (OUT OF SCOPE)

- Agrupamento de orders por slot na `CourierScreen` — verificar se está no escopo desta fase ou é próxima.
- Migração automática do `weeklyQty` legado para o primeiro slot ao salvar.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MSCHED-01 | Se o condomínio tem os 2 slots ativos, cliente pode configurar quantidade de pães por horário (manhã e tarde) para cada dia da semana | UI condicional baseada em `activeSlots.length >= 2`; hook estendido com `days`/`setDays` |
| MSCHED-02 | O cron de meia-noite gera um Order separado por slot de entrega agendado (podendo gerar 2 orders por dia para um mesmo cliente) | Modificação em `createDailyOrders()` via detecção de `schedule.days` |
| MSCHED-03 | Tela de agenda exibe seção por horário (manhã / tarde) com stepper de quantidade por dia da semana em cada seção | Renderização condicional na `ScheduleScreen` com 2 seções de 7 day-rows cada |
| MSCHED-04 | Agendamentos no formato legado (`deliveryTime` + `weeklyQty`) continuam funcionando sem migração forçada de dados | Detecção `schedule.days === null` no service; `ScheduleBodySchema` Zod backward-compatible |
</phase_requirements>

---

## Summary

A Phase 14 implementa suporte a múltiplos slots de entrega na agenda semanal do cliente. A arquitetura aprovada no CONTEXT.md é cuidadosamente retrocompatível: o campo `days Json?` já existe no modelo `Schedule` (adicionado na Phase 10), mas sem formato definido — esta fase define o formato `{ "HH:MM": WeeklyQty }`. O campo `Order.deliveryTime String?` ainda não existe e precisa ser adicionado via `db push`.

A mudança mais impactante é em `schedules.service.ts`, onde três funções (`createDailyOrders`, `processAutoBuy`, `sendLowCreditNotifications`) precisam usar o helper `getConsumoSemanal(schedule)` para calcular o consumo semanal corretamente em ambos os modos. No frontend, a `ScheduleScreen` recebe renderização condicional baseada nos slots ativos do condomínio, e o hook `useSchedule` é estendido com estado `days`.

O pending todo do STATE.md sobre a `CourierScreen` foi avaliado: a fase atual DEFERRED o agrupamento por slot para o entregador — a `GET /courier/orders/today` continua retornando todos os orders do dia sem agrupamento por slot. O entregador verá 2 orders separados para o mesmo cliente/apartamento quando houver multi-slot, o que é funcionalmente correto (cada order é uma entrega distinta) mas visualmente subótimo — aceito nesta fase.

**Primary recommendation:** Implementar em 3 planos sequenciais: (1) schema + `db push` + Zod, (2) service + repository backend, (3) hook + ScheduleScreen frontend.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Detecção de modo (single vs multi-slot) | API / Backend + Browser / Client | — | Backend detecta por `schedule.days`; Frontend detecta por `activeSlots.length` |
| Geração de orders multi-slot | API / Backend (Cron) | — | `createDailyOrders()` no service — sem participação do frontend |
| Cálculo de consumo semanal | API / Backend | Browser / Client | Service para push/autobuy; Hook para UI |
| Estado do formulário de agenda | Browser / Client | — | `useSchedule` gerencia estado local; salva via PUT |
| Validação do body PUT | API / Backend (Fastify/Zod) | — | Schema Zod backward-compatible — valida ambos os formatos |
| Renderização condicional UI | Browser / Client | — | `ScheduleScreen` decide por `activeSlots.length >= 2` |
| Push de véspera com horário | API / Backend (Cron) | — | `sendEveReminders()` já itera por order — lê `Order.deliveryTime` |

---

## Standard Stack

Esta fase não instala nenhum pacote novo. Toda a implementação usa o stack existente.

### Stack em uso (sem mudanças)

| Biblioteca | Versão | Papel nesta fase |
|-----------|--------|-----------------|
| Prisma Client | 6.19.3 | `db push` para adicionar `Order.deliveryTime String?`; queries multi-slot |
| Fastify | 5.8.5 | Endpoint `PUT /schedules/me` backward-compatible |
| Zod | 4.4.3 | Extensão do `ScheduleBodySchema` com `days` opcional |
| Vitest | latest | Testes unitários novos para multi-slot no `schedules.service.test.ts` |
| React | 19.2.7 | `ScheduleScreen` refatorada; `useSchedule` estendido |

### Package Legitimacy Audit

> Nenhum pacote novo instalado nesta fase. Auditoria não aplicável.

---

## Architecture Patterns

### System Architecture Diagram

```
[Cliente abre ScheduleScreen]
          |
          v
[GET /client/condominium/slots] --> [Condominium.deliverySlots]
          |
    activeSlots.filter(isActive).length >= 2?
          |
    YES --|--------------> Modo Multi-Slot
          |                [2 seções de 7 rows com StepperInline]
          |                [days: { "06:30": WeeklyQty, "15:30": WeeklyQty }]
          |
    NO ---|--------------> Modo Single-Slot (UI atual inalterada)
                           [weeklyQty + deliveryTime]

[handleSave]
    |
    v
saveSchedule(activeSlots)
    |
    |-- multi-slot --> PUT /schedules/me { days, notifyReconfigure }
    |-- single-slot -> PUT /schedules/me { weeklyQty, deliveryTime, notifyReconfigure }
          |
          v
[SchedulesController.updateMySchedule]
    |
    v
[ScheduleBodySchema.parse(body)] -- discrimina por presença de "days"
    |
    v
[SchedulesRepository.upsert] -- salva days OU weeklyQty+deliveryTime


[Cron meia-noite: createDailyOrders()]
    |
    for each schedule:
          |
          schedule.days !== null?
          |
    YES --|---> for each [slotTime, weeklyQtyMap] in Object.entries(days):
          |         qty = weeklyQtyMap[dayKey]
          |         if qty > 0: create Order { qty, deliveryTime: slotTime }
          |
    NO ---|---> qty = weeklyQty[dayKey]
                if qty > 0: create Order { qty } (deliveryTime: null)
```

### Recommended Project Structure

Nenhuma pasta nova. Mudanças cirúrgicas nos arquivos existentes:

```
apps/api/prisma/
└── schema.prisma           # Order.deliveryTime String? adicionado

apps/api/src/modules/schedules/
├── schedules.schema.ts     # ScheduleBodySchema estendido (days opcional)
├── schedules.repository.ts # upsert: salva days quando presente
├── schedules.service.ts    # getConsumoSemanal() + createDailyOrders() multi-slot
│                           # + processAutoBuy() + sendLowCreditNotifications()
│                           # + sendEveReminders() com Order.deliveryTime
└── __tests__/
    └── schedules.service.test.ts  # novos testes MSCHED-02/04

apps/web/src/hooks/
└── useSchedule.ts          # days/setDays + saveSchedule(activeSlots)

apps/web/src/pages/client/
└── ScheduleScreen.tsx      # renderização condicional multi-slot
```

### Pattern 1: Schema Zod Backward-Compatible

**What:** O `ScheduleBodySchema` aceita dois formatos mutuamente exclusivos.
**When to use:** Sempre que `PUT /schedules/me` receber o body.

```typescript
// Source: apps/api/src/modules/schedules/schedules.schema.ts (a ser atualizado)
export const DaysSchema = z.record(z.string(), WeeklyQtySchema)
// "06:30" -> WeeklyQty, "15:30" -> WeeklyQty

export const ScheduleBodySchema = z.union([
  // Novo formato (multi-slot)
  z.object({
    days: DaysSchema,
    notifyReconfigure: z.boolean().default(false),
  }),
  // Formato legado (single-slot)
  z.object({
    weeklyQty: WeeklyQtySchema,
    deliveryTime: z.string(),
    notifyReconfigure: z.boolean().default(false),
  }),
])
```

**AVISO DE IMPLEMENTAÇÃO:** O schema Zod atual usa `z.enum` para `deliveryTime` com valores fixos (`['06:30', '07:00', '07:30', '08:00']`). No modo multi-slot, os horários vêm dinamicamente de `Condominium.deliverySlots`. O novo schema deve aceitar qualquer string no formato HH:MM (ou simplesmente `z.string()`) para acomodar slots configuráveis.

### Pattern 2: Helper `getConsumoSemanal`

**What:** Função pura extraída para calcular consumo semanal em ambos os modos.
**When to use:** Em `createDailyOrders`, `processAutoBuy`, `sendLowCreditNotifications`.

```typescript
// Source: apps/api/src/modules/schedules/schedules.service.ts (D-09 do CONTEXT.md)
function getConsumoSemanal(schedule: { days: unknown; weeklyQty: unknown }): number {
  if (schedule.days) {
    const days = schedule.days as Record<string, WeeklyQty>
    return Object.values(days)
      .flatMap(wq => Object.values(wq))
      .reduce((sum, v) => sum + (v as number), 0)
  }
  const wq = schedule.weeklyQty as WeeklyQty
  return Object.values(wq).reduce((sum, v) => sum + (v as number), 0)
}
```

### Pattern 3: `createDailyOrders()` Multi-Slot

**What:** Loop por slots dentro do schedule quando `schedule.days !== null`.
**When to use:** No cron de meia-noite.

```typescript
// Source: apps/api/src/modules/schedules/schedules.service.ts (D-08 do CONTEXT.md)
// Dentro do for (const schedule of schedules):
if (schedule.days) {
  // Modo multi-slot
  const days = schedule.days as Record<string, WeeklyQty>
  for (const [slotTime, weeklyQtyMap] of Object.entries(days)) {
    const qty = weeklyQtyMap[dayKey] ?? 0
    if (qty === 0) continue
    if (user.creditBalance < qty) {
      // push de alerta + continue
      continue
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.order.create({
        data: {
          userId: schedule.userId,
          type: 'SCHEDULED',
          quantity: qty,
          scheduledDate,
          status: 'SCHEDULED',
          deliveryTime: slotTime,  // NOVO campo
        },
      })
      await tx.user.update({ ... decrement qty ... })
      await tx.creditTransaction.create({ ... })
    })
  }
} else {
  // Modo legado (código atual inalterado)
  const weeklyQty = schedule.weeklyQty as WeeklyQty
  const qty = weeklyQty[dayKey] ?? 0
  // ...
}
```

### Pattern 4: `useSchedule` Estendido

**What:** Hook existente estendido com `days`/`setDays` e assinatura `saveSchedule(activeSlots)`.

```typescript
// Source: apps/web/src/hooks/useSchedule.ts (a ser atualizado — D-11, D-12, D-13)
const [days, setDays] = useState<Record<string, WeeklyQty>>({})

// Na inicialização (useEffect load):
if (data.days) {
  setDays(data.days as Record<string, WeeklyQty>)
} else if (activeSlots && activeSlots.filter(s => s.isActive).length >= 2) {
  // D-13: inicializar days do zero para condo multi-slot sem schedule.days
  const initDays: Record<string, WeeklyQty> = {}
  activeSlots.filter(s => s.isActive).forEach(slot => {
    initDays[slot.time] = { seg:0, ter:0, qua:0, qui:0, sex:0, sab:0, dom:0 }
  })
  setDays(initDays)
}

// saveSchedule com activeSlots como parâmetro (D-12):
const saveSchedule = async (activeSlots: DeliverySlot[]) => {
  const isMulti = activeSlots.filter(s => s.isActive).length >= 2
  const body = isMulti
    ? { days, notifyReconfigure }
    : { weeklyQty, deliveryTime, notifyReconfigure }
  // ... fetch PUT /schedules/me com body
}
```

**ATENÇÃO:** A assinatura de `saveSchedule` muda de `() => Promise<{ok, error?}>` para `(activeSlots: DeliverySlot[]) => Promise<{ok, error?}>`. O `handleSave` na `ScheduleScreen` precisa passar `slots` (ou `activeSlots`) para `saveSchedule(slots)`.

### Pattern 5: Renderização Condicional na `ScheduleScreen`

**What:** Dois modos de UI baseados na contagem de slots ativos.

```tsx
// Source: apps/web/src/pages/client/ScheduleScreen.tsx (a ser refatorado)
const activeSlots = slots.filter(s => s.isActive)
const isMultiSlot = activeSlots.length >= 2

// No JSX:
{isMultiSlot ? (
  // Modo multi-slot: 2 seções com headers
  activeSlots.map(slot => (
    <div key={slot.time}>
      {/* Separador */}
      <div style={{ borderTop: '1px solid var(--color-border-2)', margin: '0 0 16px 0' }} />
      {/* Header pill */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--color-surface-2)',
        borderRadius: 12,
        padding: '8px 12px',
        marginBottom: 8,
      }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--color-accent)',
          letterSpacing: '-0.02em',
        }}>
          {slot.name === 'manha' ? '☀️ Manhã' : '🌙 Tarde'} · {slot.time}
        </span>
      </div>
      {/* 7 day-rows com StepperInline */}
      {DAYS.map(({ label, key }) => {
        const v = (days[slot.time] ?? DEFAULT_WEEKLY_QTY)[key]
        // ... day-row idêntico ao single-slot
      })}
    </div>
  ))
) : (
  // Modo single-slot: UI atual inalterada
  <>
    <DeliveryTimeChips slots={slots} value={deliveryTime} onChange={setDeliveryTime} />
    {DAYS.map(...)} {/* código atual */}
  </>
)}
```

### Anti-Patterns to Avoid

- **Criar hook `useDays` separado:** D-11 proíbe explicitamente. Estender `useSchedule`.
- **Migrar `weeklyQty` legado automaticamente para `days`:** D-13 proíbe. Inicializa zerado.
- **Normalizar no backend (GET retorna apenas `days`):** D-04 proíbe. Frontend faz a lógica de fallback.
- **Criar novo campo Zod obrigatório:** `deliveryTime` e `weeklyQty` devem ser opcionais no novo schema quando `days` está presente — `z.union` ou discriminated union resolve isso.
- **Incrementar `creditBalance` do usuário por total do dia (soma dos 2 slots de uma vez):** Cada slot deve ser uma transação Prisma independente — garante que créditos insuficientes para o slot da tarde não bloqueiem o slot da manhã.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Discriminação de formato do body | Parser manual por presença de campos | `z.union([...])` do Zod | Validação tipada; já usado no projeto |
| Transação atômica por order | Lógica manual de rollback | `prisma.$transaction(async tx => ...)` | Já no padrão do projeto — ver `createDailyOrders()` atual |
| Soma de WeeklyQty multi-slot | Loop manual repetido | `getConsumoSemanal(schedule)` (D-09) | Evita divergência entre 4 funções do service |
| Detecção de timezone BRT | Cálculo manual de offset | `Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo' })` | Já no padrão do projeto — ver `getTomorrowDayKey()` |

---

## Runtime State Inventory

> Esta fase NÃO é uma fase de rename/rebrand/refactor de strings. Mas envolve adição de campo no schema do banco.

| Categoria | Itens encontrados | Ação necessária |
|-----------|-------------------|-----------------|
| Schema de banco | `Order.deliveryTime String?` — campo não existe ainda no modelo `Order` | `db push` (MongoDB não precisa de migration; campo nullable é backward-compat com documents existentes) |
| Documentos Schedule existentes | `days: null` (campo existe mas sem formato) — legados com `weeklyQty` + `deliveryTime` preenchidos | Nenhuma migração; código trata `days === null` como modo legado |
| Documentos Order existentes | Sem campo `deliveryTime` — após `db push`, documentos existentes terão `deliveryTime: undefined/null` | Nenhuma migração; campo é `String?` |
| Cron jobs | `cron.ts` não muda — apenas o service muda | Code edit apenas |
| Env vars / secrets | Nenhuma nova variável de ambiente | — |

**Nada encontrado nas categorias: OS-registered state, build artifacts, live service config (n8n etc.).**

---

## Common Pitfalls

### Pitfall 1: `Schedule.deliveryTime` é NOT NULLABLE no schema atual

**What goes wrong:** O campo `deliveryTime` em `Schedule` (não em `Order`) é `String` (não `String?`). O `upsert` do repositório passa `data.deliveryTime` diretamente. No modo multi-slot, o body não tem `deliveryTime` — o upsert vai falhar ou salvar um valor incorreto.

**Why it happens:** O schema Prisma foi escrito quando só havia single-slot. O campo `days Json?` foi adicionado (Phase 10), mas `deliveryTime` não foi tornado opcional.

**How to avoid:** O `SchedulesRepository.upsert` precisa lidar com ambos os casos. Opção A: tornar `deliveryTime` nullable no Prisma (`String?`) via `db push`. Opção B: manter `deliveryTime: String` e sempre salvar algum valor (ex: `data.deliveryTime ?? ''`). **A Opção A é mais limpa** — o field deve ser `String?` no schema. O `db push` no MongoDB não quebra documentos existentes (o campo já tem valor).

**Warning signs:** Erro de TypeScript no `upsert` quando `data.deliveryTime` é undefined.

**DECISÃO DE PESQUISA:** O schema precisa de `Schedule.deliveryTime String?` (tornar nullable). Isso requer `db push` para atualizar o Prisma Client gerado.

### Pitfall 2: Transação Prisma independente por slot — não por usuário

**What goes wrong:** Se o executor implementar um único `$transaction` para os 2 slots de um mesmo usuário no mesmo dia, um crédito insuficiente para o slot da tarde vai reverter a criação do order da manhã.

**Why it happens:** A lógica de saldo (`if user.creditBalance < qty continue`) está antes da transação, mas se alguém mover isso para dentro de uma transação abrangente, o rollback compromete ambos os slots.

**How to avoid:** Manter a estrutura de loop: para cada `[slotTime, weeklyQtyMap]`, verificar saldo ANTES de entrar na transação (como já é feito no modo single-slot). A transação abrange apenas `order.create + user.update + creditTransaction.create` para aquele slot.

**Warning signs:** Um cliente com saldo suficiente para manhã mas não para tarde não recebe o order da manhã.

### Pitfall 3: `ScheduleBodySchema` com `z.union` — ordem importa

**What goes wrong:** `z.union([A, B])` tenta A primeiro. Se A é o schema multi-slot e B é o legado, um body legado sem `days` pode falhar na tentativa de A e então tentar B — mas a mensagem de erro reportada é da primeira tentativa (A), causando confusão.

**Why it happens:** Comportamento padrão do `z.union`.

**How to avoid:** Usar `z.discriminatedUnion` se possível (requer campo discriminador), ou `z.union` com a validação mais restritiva primeiro. Alternativa mais simples: usar schema com todos os campos opcionais e validação custom:

```typescript
export const ScheduleBodySchema = z.object({
  days: DaysSchema.optional(),
  weeklyQty: WeeklyQtySchema.optional(),
  deliveryTime: z.string().optional(),
  notifyReconfigure: z.boolean().default(false),
}).refine(
  (data) => data.days !== undefined || (data.weeklyQty !== undefined && data.deliveryTime !== undefined),
  { message: 'Forneça days (multi-slot) ou weeklyQty+deliveryTime (single-slot)' }
)
```

**Warning signs:** Erros 400 com mensagens sobre campos multi-slot ao enviar body legado.

### Pitfall 4: `useSchedule` — mudança de assinatura do `saveSchedule`

**What goes wrong:** A `ScheduleScreen` chama `saveSchedule()` sem argumentos atualmente. Após a mudança para `saveSchedule(activeSlots)`, se não for atualizada, TypeScript vai capturar — mas se o tipo for `DeliverySlot[] | undefined` com fallback, o comportamento pode ser inesperado.

**Why it happens:** Mudança de assinatura entre versions do hook.

**How to avoid:** Alterar `handleSave` na `ScheduleScreen` para `saveSchedule(slots)` ao mesmo tempo que o hook é atualizado. Ambas as mudanças devem estar no mesmo plano/commit.

**Warning signs:** TypeScript error em `handleSave`.

### Pitfall 5: `sendEveReminders` — texto do push com `deliveryTime` null

**What goes wrong:** Orders legados têm `Order.deliveryTime = null`. O texto `"${order.quantity} pães às ${order.deliveryTime} amanhã"` vai renderizar `"2 pães às null amanhã"`.

**Why it happens:** Campo opcional sendo interpolado diretamente.

**How to avoid:** Verificar `order.deliveryTime` antes de incluir no texto:

```typescript
const timeStr = order.deliveryTime ? ` às ${order.deliveryTime}` : ''
notification.contents = { pt: `Lembrete: ${order.quantity} pães${timeStr} amanhã.` }
```

**Warning signs:** Clientes recebem push com "null" no texto.

### Pitfall 6: CourierScreen — entregador vê 2 orders para o mesmo apartamento

**What goes wrong:** Com multi-slot, um cliente pode ter 2 orders no mesmo dia (manhã e tarde). A `GET /courier/orders/today` vai retornar os 2. Na `CourierScreen`, o mesmo apartamento aparecerá duas vezes na lista.

**Why it happens:** A tela atual não foi projetada para este cenário. O `CondoAccordion` agrupa por apartamento — com 2 orders para o mesmo apt, podem aparecer 2 linhas.

**Decision:** Per CONTEXT.md `<deferred>`, o agrupamento por slot na CourierScreen é deferred para fase seguinte. Aceitar que o entregador veja 2 linhas para o mesmo apartamento — cada linha é um order separado com quantidade e status independentes. Isso é funcionalmente correto.

**Warning signs:** Entregador fica confuso com 2 linhas para o mesmo apt no mesmo dia — documentar no checkpoint humano de verificação.

---

## Code Examples

### Verificação completa do estado do schema atual

`Schedule.deliveryTime` é `String` (não nullable) — linha 198 do schema.
`Schedule.days` é `Json?` (nullable) — linha 201.
`Order.deliveryTime` **não existe** — precisa ser adicionado.

```prisma
// Estado atual (schema.prisma linhas 192-221):
model Schedule {
  // ...
  weeklyQty    Json      // não nullable
  deliveryTime String    // não nullable — PROBLEMA para multi-slot
  days         Json?     // nullable — ok
  // ...
}

model Order {
  // ...
  condominiumId  String?  @db.ObjectId
  // deliveryTime NÃO EXISTE aqui — precisa ser adicionado
  createdAt  DateTime
  // ...
}
```

### Mudanças necessárias no schema.prisma

```prisma
// Após Phase 14:
model Schedule {
  // ...
  weeklyQty    Json
  deliveryTime String?   // MUDANÇA: String -> String? (nullable para multi-slot)
  days         Json?
  // ...
}

model Order {
  // ...
  condominiumId  String?  @db.ObjectId
  deliveryTime   String?  // NOVO campo (D-02)
  createdAt      DateTime @default(now())
  // ...
}
```

### Repository upsert atualizado

```typescript
// apps/api/src/modules/schedules/schedules.repository.ts
upsert(userId: string, condominiumId: string, data: ScheduleBody) {
  const isMultiSlot = 'days' in data && data.days !== undefined

  return this.prisma.schedule.upsert({
    where: { userId_condominiumId: { userId, condominiumId } },
    update: isMultiSlot
      ? { days: data.days, notifyReconfigure: data.notifyReconfigure, isActive: true }
      : { weeklyQty: data.weeklyQty, deliveryTime: data.deliveryTime, notifyReconfigure: data.notifyReconfigure, isActive: true },
    create: isMultiSlot
      ? { userId, condominiumId, days: data.days, weeklyQty: {seg:0,ter:0,qua:0,qui:0,sex:0,sab:0,dom:0}, notifyReconfigure: data.notifyReconfigure, isActive: true }
      : { userId, condominiumId, weeklyQty: data.weeklyQty, deliveryTime: data.deliveryTime, notifyReconfigure: data.notifyReconfigure, isActive: true },
  })
}
```

**NOTA:** No `create` multi-slot, `weeklyQty` ainda é obrigatório no banco (`Json` não nullable) — passar um objeto zerado como placeholder. Alternativa: tornar `weeklyQty` também `Json?` no schema. A decisão mais simples e segura é tornar `weeklyQty` e `deliveryTime` ambos nullable no schema via `db push`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `deliveryTime` único por schedule | `days Json?` com múltiplos slots por horário | Phase 14 | Schedule pode ter config de manhã e tarde independentes |
| Cron gera 1 order/dia/cliente | Cron gera N orders/dia/cliente (1 por slot ativo) | Phase 14 | Order.deliveryTime distingue qual slot gerou o order |
| `weeklyQty` legado | `days` format `{ "HH:MM": WeeklyQty }` | Phase 14 | Alinha com `Condominium.deliverySlots String[]` |

**Deprecated/outdated:**
- `DeliveryTimeChips` no modo multi-slot: não usado (horários são fixos do condo — não é escolha do cliente).
- `z.enum(['06:30', '07:00', '07:30', '08:00'])` para `deliveryTime` no Zod schema: substituído por `z.string()` genérico (slots são configuráveis pelo admin).

---

## Assumptions Log

| # | Claim | Section | Risk se errado |
|---|-------|---------|----------------|
| A1 | `Schedule.weeklyQty` pode ser tornado `Json?` no mesmo `db push` que adiciona `Order.deliveryTime String?` sem quebrar documentos MongoDB existentes | Schema, Repository | Documentos existentes têm `weeklyQty` preenchido — tornar nullable não quebra; mas o `upsert` legado que não passa `weeklyQty` pode falhar se o Prisma Client exigir o campo. Verificar gerado. |

---

## Open Questions

1. **`Schedule.weeklyQty` deve ser tornado nullable (`Json?`)?**
   - What we know: Atualmente `Json` (não nullable). No modo multi-slot, o `create` no upsert precisa de um valor para `weeklyQty` mesmo que não seja usado.
   - What's unclear: Se o executor deve tornar `weeklyQty Json?` no mesmo `db push`, ou manter `Json` e passar um objeto zerado como placeholder no `create` multi-slot.
   - Recommendation: Tornar `weeklyQty Json?` é mais limpo. Um único `db push` pode alterar `Schedule.deliveryTime String -> String?`, `Schedule.weeklyQty Json -> Json?`, e adicionar `Order.deliveryTime String?`.

2. **Texto do push de véspera multi-slot (`sendEveReminders`)**
   - What we know: D-10 diz incluir `Order.deliveryTime` quando disponível; CONTEXT.md deixa a critério do executor.
   - What's unclear: Texto exato — "2 pães às 06:30 amanhã" vs "Lembrete: 2 pães (06:30) agendados para amanhã."
   - Recommendation: Implementar como `"Lembrete: ${qty} pães${deliveryTime ? ` às ${deliveryTime}` : ''} amanhã."` — conciso e backward-compatible.

---

## Environment Availability

> Dependências externas: apenas MongoDB Atlas (já em uso). Nenhuma nova dependência.

| Dependência | Required By | Available | Versão | Fallback |
|-------------|-------------|-----------|--------|----------|
| MongoDB Atlas | `db push` (Order.deliveryTime) | ✓ | remoto | — |
| Prisma CLI | `prisma db push` + `prisma generate` | ✓ | 6.19.3 | — |
| Node.js | API runtime | ✓ | (via monorepo) | — |

**Nenhuma dependência bloqueante sem fallback.**

---

## Validation Architecture

> `workflow.nyquist_validation: true` — seção obrigatória.

### Test Framework

| Propriedade | Valor |
|-------------|-------|
| Framework | Vitest (latest) |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command | `cd apps/api && npm test` |
| Full suite command | `cd apps/api && npm test -- --reporter=verbose` |

### Phase Requirements → Test Map

| Req ID | Comportamento | Tipo de Teste | Comando automatizado | Arquivo existe? |
|--------|---------------|---------------|---------------------|-----------------|
| MSCHED-01 | `ScheduleScreen` renderiza 2 seções quando `activeSlots.length >= 2` | Manual (UI) | — | — |
| MSCHED-02 | `createDailyOrders()` gera 2 Orders quando `schedule.days` tem 2 slots com qty > 0 | Unit | `cd apps/api && npm test -- schedules.service` | ✅ (arquivo existe, novos testes a adicionar) |
| MSCHED-02 | `createDailyOrders()` gera 0 Orders quando `schedule.days` tem qty = 0 em ambos os slots | Unit | `cd apps/api && npm test -- schedules.service` | ✅ |
| MSCHED-02 | `createDailyOrders()` gera 1 Order (manhã) quando tarde tem saldo insuficiente | Unit | `cd apps/api && npm test -- schedules.service` | ✅ |
| MSCHED-03 | Headers "☀️ Manhã · 06:30" e "🌙 Tarde · 15:30" aparecem no DOM | Manual (UI) | — | — |
| MSCHED-04 | `createDailyOrders()` modo legado (`schedule.days === null`) continua gerando 1 Order | Unit | `cd apps/api && npm test -- schedules.service` | ✅ (testes existentes cobrem isso) |
| MSCHED-04 | `PUT /schedules/me` body legado `{weeklyQty, deliveryTime}` aceito sem erro 400 | Unit | `cd apps/api && npm test -- schedules.service` | ✅ |

### Casos de Borda para Validação

| Cenário | Comportamento Esperado | Como Verificar |
|---------|----------------------|----------------|
| Cliente com `schedule.days` nulo, condo 2 slots ativos | Hook inicializa `days` zerado (D-13) — UI mostra 2 seções com todos 0 | Inspecionar estado do hook no DevTools |
| Schedule multi-slot com saldo insuficiente para slot da manhã mas suficiente para tarde | Order da manhã NÃO criado; order da tarde SIM criado; push de alerta enviado para manhã | Teste unitário com `creditBalance` calibrado |
| Cron processa schedule legado (sem `days`) — condo do usuário agora tem 2 slots | Usa `weeklyQty` como antes — não muda comportamento | Teste unitário com `schedule.days = null` |
| `sendEveReminders` com `Order.deliveryTime = null` (order legado) | Push sem horário no texto — sem "null" literal | Teste unitário: verificar `notification.contents` |
| `sendEveReminders` com `Order.deliveryTime = "06:30"` (order multi-slot) | Push com "às 06:30" no texto | Teste unitário: verificar `notification.contents` |
| `getConsumoSemanal` com `days = { "06:30": {seg:2,...}, "15:30": {seg:1,...} }` | Retorna soma total (ex: 2+1 por dia × N dias) | Teste unitário da função helper |
| `PUT /schedules/me` com `days` presente → `GET /schedules/me` retorna `days` | Campo persiste e é retornado pelo GET | Teste de integração ou manual |

### Sampling Rate

- **Per task commit:** `cd apps/api && npm test -- schedules.service`
- **Per wave merge:** `cd apps/api && npm test`
- **Phase gate:** Suite completa verde antes de `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/api/src/modules/schedules/__tests__/schedules.service.test.ts` — adicionar testes MSCHED-02/04:
  - `createDailyOrders_multiSlot_cria2Orders_quandoAmbosSlotsTêmQty`
  - `createDailyOrders_multiSlot_criaApenasOrdersManhã_quandoTardeInsuficiente`
  - `createDailyOrders_legado_continuaFuncionando_quandoDaysNulo`
  - `getConsumoSemanal_retornaSomaTotal_modoMultiSlot`
  - `sendEveReminders_textoPush_inclui_deliveryTime_quandoDisponível`
  - `sendEveReminders_textoPush_SEM_null_quandoDeliveryTimeNulo`
  - `sendLowCreditNotifications_usaGetConsumoSemanal_modoMultiSlot`

*(Infraestrutura de teste já existe — não precisar criar `vitest.config.ts` ou `conftest`.)*

---

## Security Domain

> `security_enforcement` não está explicitamente `false` no config — seção incluída.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | sim (endpoints autenticados) | `fastify.authenticate` preHandler — já implementado |
| V3 Session Management | sim | JWT sessions — já implementado |
| V4 Access Control | sim | `request.user.id` para acessar schedule — nunca aceitar userId do body |
| V5 Input Validation | sim | Zod schema no `ScheduleBodySchema` — validar ambos os formatos |
| V6 Cryptography | não | Sem dados criptografados nesta fase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cliente envia `days` com chave de horário não-pertencente ao seu condo | Tampering | Validar que as chaves de `days` correspondem aos `deliverySlots` do condomínio do usuário — ou aceitar qualquer string e deixar o cron ignorar horários inativos |
| Overflow de quantidade por slot | Tampering | `WeeklyQtySchema` já valida `min(0).max(12)` por dia — manter no `DaysSchema` |
| IDOR: salvar schedule de outro usuário | Elevation of Privilege | `userId` sempre do `request.user.id` (JWT) — nunca do body |

**NOTA DE SEGURANÇA:** A validação das chaves do campo `days` merece atenção. A decisão D-01 diz que as chaves devem espelhar `Condominium.deliverySlots`. O backend **pode** aceitar qualquer string HH:MM e o cron vai simplesmente não reconhecer como slot ativo — comportamento inofensivo. A validação estrita (verificar se a chave está em `deliverySlots` do condo) aumenta segurança mas adiciona uma query ao banco no PUT. Para o MVP, aceitar qualquer string é aceitável — documentar como `[ASSUMED]` que a validação estrita não é necessária nesta fase.

---

## Project Constraints (from CLAUDE.md)

- **Stack Frontend:** React + Vite + Tailwind CSS + Zod — não revisitável
- **Stack Backend:** Node.js + Fastify + Prisma + MongoDB Atlas — não revisitável
- **Banco:** MongoDB Atlas remoto — `db push` (nunca `prisma migrate dev`)
- **Fidelidade de Design:** Alta fidelidade — tokens de cores, tipografia e espaçamentos do handoff são mandatórios (ver `14-UI-SPEC.md`)
- **Monorepo:** Turborepo com npm workspaces — não criar packages fora da estrutura

---

## Sources

### Primary (HIGH confidence)

- Codebase direto — `apps/api/prisma/schema.prisma` (lido integralmente)
- Codebase direto — `apps/api/src/modules/schedules/schedules.service.ts` (lido integralmente)
- Codebase direto — `apps/api/src/modules/schedules/schedules.schema.ts` (lido integralmente)
- Codebase direto — `apps/api/src/modules/schedules/schedules.repository.ts` (lido integralmente)
- Codebase direto — `apps/api/src/modules/schedules/schedules.route.ts` (lido integralmente)
- Codebase direto — `apps/api/src/modules/schedules/schedules.controller.ts` (lido integralmente)
- Codebase direto — `apps/api/src/plugins/cron.ts` (lido integralmente)
- Codebase direto — `apps/web/src/hooks/useSchedule.ts` (lido integralmente)
- Codebase direto — `apps/web/src/pages/client/ScheduleScreen.tsx` (lido integralmente)
- Codebase direto — `apps/api/src/modules/courier/courier.service.ts` (lido integralmente)
- `.planning/phases/14-agenda-multi-slot/14-CONTEXT.md` — decisões bloqueadas D-01 a D-13
- `.planning/phases/14-agenda-multi-slot/14-UI-SPEC.md` — contrato visual aprovado

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — MSCHED-01..04 (contexto de requisitos)
- `.planning/STATE.md` — D-14, D-15, D-17 de fases anteriores; pending todo CourierScreen
- `apps/api/src/modules/schedules/__tests__/schedules.service.test.ts` — padrões de testes existentes

---

## Metadata

**Confidence breakdown:**

- Schema changes: HIGH — schema lido diretamente; campos identificados com precisão
- Architecture (backend): HIGH — código existente lido; pontos de mudança identificados
- Architecture (frontend): HIGH — hook e componente lidos integralmente
- Pitfalls: HIGH — identificados diretamente do código existente (não especulação)
- Test patterns: HIGH — arquivo de teste existente lido como referência

**Research date:** 2026-06-20
**Valid until:** 2026-07-20 (stack estável; sem dependências externas mutáveis nesta fase)
