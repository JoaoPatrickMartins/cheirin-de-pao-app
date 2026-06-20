# Phase 14: Agenda Multi-Slot - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-20
**Phase:** 14-agenda-multi-slot
**Areas discussed:** Formato do campo `days`, UI condicional da ScheduleScreen, Backward-compat no cron e services, Hook e endpoint de save

---

## Formato do campo `days`

### Estrutura JSON do campo `days`

| Option | Description | Selected |
|--------|-------------|----------|
| Por slot (chave = horário) | `{ "06:30": WeeklyQty, "15:30": WeeklyQty }` — cron itera `Object.entries(days)` | ✓ |
| Por dia (chave = dia) | `{ "seg": { "06:30": 2, "15:30": 1 } }` — cron pega `days[dayKey]` e itera slots | |
| Array de slots | `[{ slotTime: "06:30", weeklyQty: {...} }]` — mais explícito, mais verboso | |

**User's choice:** Por slot (chave = horário)
**Notes:** Alinha com `Condominium.deliverySlots String[]` (array de strings HH:MM) e simplifica o loop no cron.

---

### Campo `deliveryTime` no modelo Order

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, adicionar `deliveryTime String?` | Orders multi-slot têm deliveryTime; orders legados têm null | ✓ |
| Não, derivar do condomínio | Sem mudança no modelo Order | |

**User's choice:** Sim, adicionar `deliveryTime String?`
**Notes:** Necessário para o entregador distinguir slots e para os pushes de véspera mencionarem o horário.

---

### Formato do body `PUT /schedules/me`

| Option | Description | Selected |
|--------|-------------|----------|
| Campo `days` separado no body | Aceita `days` (novo) OU `weeklyQty + deliveryTime` (legado) — backward-compatible | ✓ |
| Unificar sempre em `days` | Frontend sempre envia `days`, mesmo para single-slot | |

**User's choice:** Campo `days` separado no body

---

### Formato do response `GET /schedules/me`

| Option | Description | Selected |
|--------|-------------|----------|
| Retornar `days` junto com campos legados | Frontend usa `days` se não-null, senão usa legado — lógica de fallback no hook | ✓ |
| Backend normaliza para sempre retornar `days` | Conversão no response handler — mais limpo no frontend | |

**User's choice:** Retornar `days` junto com campos legados

---

## UI Condicional da ScheduleScreen

### Chips de horário no modo multi-slot

| Option | Description | Selected |
|--------|-------------|----------|
| Chips viram headers de seção | `DeliveryTimeChips` não usado; seções com headers fixos "☀️ Manhã · 06:30" | ✓ |
| Chips permanecem (visualização) | Chips no topo para visualizar horários disponíveis sem interação de seleção | |

**User's choice:** Chips viram headers de seção
**Notes:** No multi-slot, o horário não é mais uma escolha do cliente — é fixo pelo condo.

---

### Footer no modo multi-slot

| Option | Description | Selected |
|--------|-------------|----------|
| Soma total no footer, sem horário | "Consumo semanal: X pães" — horário removido | ✓ |
| Breakdown por slot no footer | "Manhã: 10 pães / Tarde: 8 pães · Total: 18" | |

**User's choice:** Soma total no footer, sem horário

---

### Condição de renderização multi-slot

| Option | Description | Selected |
|--------|-------------|----------|
| `slots.filter(s => s.isActive).length >= 2` | Multi-slot apenas com 2+ slots ATIVOS — dinâmico | ✓ |
| `slots.length >= 2` | Multi-slot com 2 slots registrados, independente de ativação | |

**User's choice:** `slots.filter(s => s.isActive).length >= 2`

---

## Backward-Compat no Cron e Services

### Detecção legado vs multi-slot no cron

| Option | Description | Selected |
|--------|-------------|----------|
| Campo `days` presente = multi-slot | `schedule.days` não-null → iterar slots; null → comportamento atual | ✓ |
| Flag explícito no Schedule | Adicionar `scheduleVersion` ou `isMultiSlot` ao modelo | |

**User's choice:** Campo `days` presente = multi-slot

---

### Cálculo do consumoSemanal em `processAutoBuy` e `sendLowCreditNotifications`

| Option | Description | Selected |
|--------|-------------|----------|
| Função helper `getConsumoSemanal(schedule)` | Extraída e reutilizada nos 3 métodos — sem duplicação | ✓ |
| Inline em cada método | Bloco `if (schedule.days) {...} else {...}` em cada um dos 3 métodos | |

**User's choice:** Função helper `getConsumoSemanal(schedule)`

---

### Pushes de véspera (`sendEveReminders`) com multi-slot

| Option | Description | Selected |
|--------|-------------|----------|
| Um push por order (comportamento atual) | Cliente com 2 orders recebe 2 pushes, cada um com o horário | ✓ |
| Um push consolidado por cliente | Agrupar orders do mesmo cliente/dia — 1 push total | |

**User's choice:** Um push por order (comportamento atual)

---

## Hook e Endpoint de Save

### Estrutura do `useSchedule` para multi-slot

| Option | Description | Selected |
|--------|-------------|----------|
| Estender `useSchedule` com estado `days` | Adicionar `days`/`setDays` ao hook existente — sem novo hook | ✓ |
| Criar `useMultiSlotSchedule` separado | Novo hook para o modo multi-slot; ScheduleScreen importa condicionalmente | |

**User's choice:** Estender `useSchedule` com estado `days`

---

### Como `saveSchedule` decide o formato do body

| Option | Description | Selected |
|--------|-------------|----------|
| Receber `activeSlots` como parâmetro | `saveSchedule(activeSlots)` — hook decide o body pelo activeSlots recebido | ✓ |
| Estado interno `isMultiSlot` no hook | Hook detecta o modo ao carregar dados do GET | |

**User's choice:** Receber `activeSlots` como parâmetro
**Notes:** Menor acoplamento — o hook não precisa saber dos slots; a ScreenSchedule passa o contexto.

---

### Inicialização do estado `days` para schedule legado

| Option | Description | Selected |
|--------|-------------|----------|
| Inicializar `days` zerado com slots do condo | `{ [slotTime]: DEFAULT_WEEKLY_QTY }` para cada slot ativo — cliente configura do zero | ✓ |
| Copiar `weeklyQty` para o primeiro slot | Preservar agenda anterior no primeiro slot — conveniência ao migrar | |

**User's choice:** Inicializar `days` zerado com slots do condo
**Notes:** Evita confusão de horário — o `weeklyQty` legado pode ter sido configurado para um horário diferente dos novos slots.

---

## Claude's Discretion

- Design visual dos headers de seção multi-slot (ícone exato, tamanho, separação entre seções)
- Texto exato dos pushes de véspera com `deliveryTime` incluído
- Skeleton de loading para modo multi-slot (estrutura com 2 seções)

## Deferred Ideas

- Agrupamento de orders por slot na `CourierScreen` — pending todo do STATE.md; verificar se é escopo desta fase.
- Migração automática do `weeklyQty` legado para o primeiro slot ao salvar — decidido contra nesta fase (inicialização zerada).
