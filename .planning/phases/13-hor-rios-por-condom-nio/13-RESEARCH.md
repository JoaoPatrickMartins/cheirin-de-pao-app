# Phase 13: Horários por Condomínio — Research

**Researched:** 2026-06-19
**Domain:** Schema migration + Admin CRUD + Cron multi-slot + Frontend dinâmico
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SLOT-01 | Cada condomínio tem exatamente 2 slots fixos (manhã e tarde) — Admin pode editar o horário de cada slot individualmente (ex: 06:30 → 07:00) | Schema migration: `deliverySlots String[]` → composite type `DeliverySlot[]` com campos `time`, `cutoffTime`, `isActive`; nova rota PATCH `/admin/condominiums/:id/slots/:slotId` |
| SLOT-02 | Ao criar condomínio, slots criados automaticamente com horários padrão: manhã 06:30 e tarde 15:30 | `create` no repository já chama `this.prisma.condominium.create({ data })` — adicionar `deliverySlots` padrão no `CreateCondominiumBody` ou no service antes de persistir |
| SLOT-03 | Script de migração popula slots padrão (manhã 06:30 e tarde 15:30) nos condomínios existentes durante o deploy | Script Node.js standalone que usa `@prisma/client` diretamente — lê todos os condomínios onde `deliverySlots` está vazio e faz `updateMany` com os 2 slots padrão |
| SLOT-04 | Horários disponíveis na agenda do cliente são carregados dinamicamente dos slots ativos do seu condomínio | Novo endpoint `GET /client/condominium/slots` retorna slots ativos do condomínio do usuário autenticado; `ScheduleScreen` troca `DeliveryTimeChips` (hardcoded) por chips gerados a partir da API |
| SLOT-05 | Admin pode ativar/desativar cada slot individualmente por condomínio | Campo `isActive` por slot; rota PATCH `/admin/condominiums/:id/slots/:slotId` com body `{ isActive: boolean }` |
| SLOT-06 | Cada slot tem seu próprio horário de corte configurável (ex: slot manhã → corte 22h anterior; slot tarde → corte 10h mesmo dia) | Campo `cutoffTime` por slot (string HH:MM); a lógica de `processCutoff` em `AdminSettingsService` precisa iterar sobre todos os condomínios e seus slots ativos |
| SLOT-07 | Sistema passa a ter 2 horários de corte — bloqueio e notificações de corte disparam separadamente por slot | `processCutoff` deixa de usar `Setting.cutoffTime` global como referência única; passa a percorrer `Condominium.deliverySlots[]` ativos e verificar `cutoffTime` de cada slot |
</phase_requirements>

---

## Summary

A Phase 13 converte o campo `deliverySlots String[]` (array simples de strings HH:MM, introduzido na Phase 10 como D-15) em uma estrutura por condomínio com campos adicionais por slot: `time` (HH:MM), `cutoffTime` (HH:MM), `isActive` (bool) e `name` (manhã/tarde). O Prisma MongoDB suporta tipos compostos embutidos (`type` keyword no schema), o que permite migrar o campo sem criar uma nova collection.

As três partes do sistema que precisam de adaptação são: (1) backend — schema Prisma, repository de condomínios, service de criação, novo endpoint de slots, e refatoração do `processCutoff`; (2) script de migração standalone para condomínios existentes no Atlas; (3) frontend — endpoint público de slots do condomínio do cliente e substituição dos chips hardcoded em `DeliveryTimeChips` / `ScheduleScreen`.

O cron de meia-noite (`createDailyOrders`) **não muda nesta fase** — ele continua usando `weeklyQty`/`deliveryTime` do `Schedule`. A adaptação do cron para multi-slot pertence à Phase 14 (MSCHED-02). O que muda nesta fase é apenas o `processCutoff` (SLOT-07), que passa a disparar por slot e não pelo `Setting.cutoffTime` global.

**Primary recommendation:** Implementar `DeliverySlot` como composite type Prisma embutido em `Condominium` (sem nova collection), migrar dados via script standalone, e adicionar endpoint dedicado de slots para o cliente e para o admin.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Estrutura de slots por condomínio | Database / Storage | API / Backend | Dados pertencem ao modelo `Condominium`; API expõe e valida |
| CRUD de slots (admin) | API / Backend | Frontend Server (SSR) | Rotas autenticadas ADMIN controlam mutação |
| Leitura de slots ativos (cliente) | API / Backend | Browser / Client | Endpoint protegido por JWT CLIENT retorna apenas slots do condomínio do usuário |
| Cutoff por slot | API / Backend | — | Lógica de negócio pura no `AdminSettingsService.processCutoff()` |
| UI de configuração de slots (admin) | Browser / Client | — | CRUD inline dentro de `AdminCondos` / `CondoForm` existentes |
| Chips de horário dinâmicos (cliente) | Browser / Client | API / Backend | Frontend busca slots; API fornece dados |
| Script de migração | Database / Storage | — | Script standalone Node.js — roda uma vez no deploy |

---

## Standard Stack

### Core (já instalado no projeto)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@prisma/client` | 6.19.3 | ORM MongoDB — schema + queries | Padrão do projeto desde Phase 1 |
| `zod` | ^3 | Validação de body nas rotas | Padrão do projeto — todo controller usa Zod |
| `fastify` | ^4 | Framework HTTP | Padrão do projeto |
| `node-cron` | ^3/v4 | Cron jobs (cutoff, daily-orders) | Já instalado — `cron.ts` usa `node-cron` |

Nenhum pacote novo precisa ser instalado para esta fase. [VERIFIED: codebase grep]

---

## Package Legitimacy Audit

Nenhum pacote novo será instalado nesta fase. Todos os pacotes utilizados já estão presentes no `node_modules` do projeto e foram auditados em fases anteriores.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Admin UI (CondoForm)
    │  PATCH /admin/condominiums/:id/slots/:slotId
    ▼
adminCondominiums.route → adminCondominiums.controller
    │  Zod parse (SlotUpdateBody)
    ▼
adminCondominiums.service.updateSlot()
    │  findById → validação de existência
    ▼
adminCondominiums.repository.updateSlot()
    │  prisma.condominium.update({ deliverySlots: [...] })
    ▼
MongoDB Atlas (Condominium.deliverySlots[])

──────────────────────────────────────────────

Cliente (ScheduleScreen)
    │  GET /client/condominium/slots
    ▼
condominiumSlotsRoute (nova rota pública-autenticada)
    │  JWT → user.condominiumId
    ▼
Condominium.deliverySlots.filter(isActive)
    ▼
DeliveryTimeChips (chips gerados dinamicamente)

──────────────────────────────────────────────

Cron horário (processCutoff)
    │  percorre todos os Condominium
    ▼
Para cada slot ativo → verifica slot.cutoffTime vs. hora BRT
    │  se match → filtra clientes do condomínio sem Order amanhã
    ▼
OneSignal push (por slot, por condomínio)
```

### Recommended Project Structure

```
apps/api/src/
├── modules/
│   ├── admin-condominiums/
│   │   ├── admin-condominiums.schema.ts    (+ SlotUpdateSchema, SlotBody)
│   │   ├── admin-condominiums.repository.ts (+ updateSlot, findById)
│   │   ├── admin-condominiums.service.ts   (+ updateSlot, ensureDefaultSlots)
│   │   ├── admin-condominiums.controller.ts (+ updateSlot handler)
│   │   └── admin-condominiums.route.ts     (+ PATCH /admin/condominiums/:id/slots/:slotId)
│   └── condominiums/
│       └── condominiums.route.ts           (+ GET /client/condominium/slots — nova rota)
├── modules/admin-settings/
│   └── admin-settings.service.ts          (refatorar processCutoff para multi-slot)
└── scripts/
    └── migrate-delivery-slots.ts           (script standalone de migração)

apps/web/src/
├── components/client/
│   └── DeliveryTimeChips.tsx               (aceitar slots[] como prop em vez de hardcode)
└── pages/client/
    └── ScheduleScreen.tsx                  (useEffect para buscar slots do condomínio)
```

### Pattern 1: Composite Type Prisma para DeliverySlot

**What:** Substituir `deliverySlots String[]` por `deliverySlots DeliverySlot[]` onde `DeliverySlot` é um composite type embutido (sem nova collection).

**When to use:** Sempre que um subdocumento não precisa de ID próprio e pertence ao documento pai.

**Como declarar no schema.prisma:**
```prisma
// Composite type — embeds dentro de Condominium, sem collection própria
type DeliverySlot {
  name        String   // "manha" | "tarde"
  time        String   // "HH:MM" ex: "06:30"
  cutoffTime  String   // "HH:MM" ex: "22:00"
  isActive    Boolean
}

model Condominium {
  id            String         @id @default(auto()) @map("_id") @db.ObjectId
  name          String
  address       Address
  type          CondoType
  isActive      Boolean        @default(true)
  deliverySlots DeliverySlot[] // substituiu String[]
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}
```

**Implicação:** Prisma MongoDB com composite types embutidos **não permite** `updateMany` com filtro por campo interno. Para atualizar um slot específico, é necessário ler o array completo, modificar o elemento e reescrever (`prisma.condominium.update({ data: { deliverySlots: novoArray } })`). [VERIFIED: codebase — padrão já usado com `Address` composite type]

### Pattern 2: Slots padrão na criação de condomínio

**What:** No `AdminCondominiumsService.create()`, injetar os 2 slots padrão antes de chamar o repository.

```typescript
// Em admin-condominiums.service.ts
const DEFAULT_SLOTS = [
  { name: 'manha', time: '06:30', cutoffTime: '22:00', isActive: true },
  { name: 'tarde', time: '15:30', cutoffTime: '10:00', isActive: true },
]

async create(data: CreateCondominiumBody) {
  return this.repository.create({
    ...data,
    deliverySlots: DEFAULT_SLOTS,
  })
}
```

### Pattern 3: Atualização de slot por índice (read-modify-write)

**What:** Como Prisma MongoDB não suporta update de elemento de array por índice diretamente, o padrão é:

```typescript
// Em admin-condominiums.repository.ts
async updateSlot(id: string, slotName: string, patch: Partial<DeliverySlotInput>) {
  const condo = await this.findById(id)
  if (!condo) throw { statusCode: 404, message: 'Condomínio não encontrado' }

  const updatedSlots = condo.deliverySlots.map((s) =>
    s.name === slotName ? { ...s, ...patch } : s
  )

  return this.prisma.condominium.update({
    where: { id },
    data: { deliverySlots: updatedSlots },
  })
}
```

O `slotName` ("manha" | "tarde") funciona como chave natural — sem necessidade de ID de slot. [ASSUMED — padrão inferido do composite type `Address` já em uso no projeto]

### Pattern 4: processCutoff multi-slot

**What:** `processCutoff` atual lê `Setting.cutoffTime` global e verifica contra hora atual. Na Phase 13, deve iterar sobre todos os condomínios e slots ativos.

```typescript
// Lógica nova em admin-settings.service.ts
async processCutoff(): Promise<void> {
  const nowHHMM = /* hora BRT atual HH:MM */

  const condominiums = await this.prisma.condominium.findMany({
    where: { isActive: true },
  })

  for (const condo of condominiums) {
    const activeSlots = condo.deliverySlots.filter(
      (s) => s.isActive && s.cutoffTime === nowHHMM
    )
    if (activeSlots.length === 0) continue

    // Para cada slot que está no horário de corte agora:
    for (const slot of activeSlots) {
      // Buscar clientes deste condomínio sem pedido para amanhã no slot
      // Enviar notificação CUTOFF para cada um (best-effort)
    }
  }
}
```

**Atenção:** A notificação de corte precisa mencionar o slot específico ("O prazo para pãezinhos da manhã de amanhã encerrou") para evitar ambiguidade quando um cliente tem ambos os slots ativos. [ASSUMED]

### Pattern 5: Script de migração standalone

**What:** Script TypeScript executado manualmente no deploy (`npx tsx scripts/migrate-delivery-slots.ts`) — não é parte do servidor.

```typescript
// apps/api/src/scripts/migrate-delivery-slots.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEFAULT_SLOTS = [
  { name: 'manha', time: '06:30', cutoffTime: '22:00', isActive: true },
  { name: 'tarde', time: '15:30', cutoffTime: '10:00', isActive: true },
]

async function main() {
  const condos = await prisma.condominium.findMany()
  let updated = 0

  for (const condo of condos) {
    if (condo.deliverySlots.length === 0) {
      await prisma.condominium.update({
        where: { id: condo.id },
        data: { deliverySlots: DEFAULT_SLOTS },
      })
      updated++
    }
  }

  console.log(`Migração concluída: ${updated} condomínios atualizados`)
}

main().finally(() => prisma.$disconnect())
```

**IMPORTANTE:** `deliverySlots String[]` no schema atual armazena strings HH:MM. Após a migração do schema para `DeliverySlot[]`, os documentos com `deliverySlots: ["06:30", "15:30"]` no Atlas ficam **incompatíveis** com o novo tipo. O script deve verificar se o campo já é um array de objetos ou de strings, e tratar ambos os casos. [ASSUMED — verificar estrutura real dos documentos no Atlas antes de executar]

### Anti-Patterns to Avoid

- **Criar collection separada para slots:** Desnecessário — composite type embutido é a solução Prisma/MongoDB para subdocumentos sem identidade própria. O projeto já usa esse padrão com `Address`.
- **Manter `Setting.cutoffTime` global como fallback:** Na Phase 13, cada slot tem seu próprio `cutoffTime`. O `Setting.cutoffTime` global pode ser mantido para compatibilidade com visualizações existentes no Admin, mas não deve mais ser a fonte de verdade para o `processCutoff`.
- **Atualizar `createDailyOrders` nesta fase:** Essa adaptação pertence à Phase 14. Na Phase 13, o cron de meia-noite continua usando `weeklyQty`/`deliveryTime` do Schedule.
- **Hardcode de `deliverySlots` no frontend:** `DeliveryTimeChips` atualmente tem `DELIVERY_TIMES = ['06:30', '07:00', '07:30', '08:00']` hardcoded. Na Phase 13, deve receber `slots[]` como prop carregados da API.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Validação de formato HH:MM | regex manual | `z.string().regex(/^\d{2}:\d{2}$/)` (Zod) | Padrão já usado em `admin-settings.schema.ts` para `cutoffTime` |
| Update de array de composite type | query MongoDB raw | read-modify-write via Prisma (Pattern 3) | Prisma MongoDB não suporta arrayFilters — padrão seguro é ler + reescrever |
| Script de migração com ORM alternativo | mongoose / raw MongoDB driver | `@prisma/client` diretamente | Já instalado, tipado, consistente com o schema do projeto |

---

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `Condominium.deliverySlots String[]` — condomínios existentes no Atlas têm array de strings (ex: `["06:30", "15:30"]`) ou array vazio `[]` | Script de migração: converter para `DeliverySlot[]` com `name`, `time`, `cutoffTime`, `isActive` |
| Live service config | `Setting.cutoffTime` — valor global no Atlas (ex: `"20:00"`) | Não remover — manter para compatibilidade com tela de configurações do Admin (ADMO-01 já completo). Novos slots têm `cutoffTime` próprio |
| OS-registered state | Cron `cutoff-check` registrado em `cron.ts` a cada hora | Nenhuma ação de re-registro — apenas refatorar o corpo da função `processCutoff` |
| Secrets/env vars | Nenhum env var novo necessário | None |
| Build artifacts | `@prisma/client` gerado — após mudança do schema precisa de `prisma generate` + `prisma db push` | Executar `prisma generate` após alterar o schema |

**Atenção crítica sobre migração:** Se `deliverySlots` já contém strings HH:MM no Atlas (`["06:30"]`), após alterar o schema Prisma para `DeliverySlot[]` as queries existentes falharão com erro de tipo. O script de migração deve rodar **antes** do deploy do novo código. Ordem obrigatória: (1) rodar script de migração, (2) fazer `prisma generate`, (3) deploy da API.

---

## Common Pitfalls

### Pitfall 1: Schema Prisma com composite type e dados legados incompatíveis
**What goes wrong:** Alterar `deliverySlots String[]` para `deliverySlots DeliverySlot[]` no schema e fazer `prisma generate` sem migrar os dados primeiro faz com que leituras de documentos com strings retornem erro de tipo em runtime.
**Why it happens:** Prisma MongoDB não faz coerção automática de tipos — o adapter espera o tipo exato declarado no schema.
**How to avoid:** Rodar o script de migração no Atlas **antes** de fazer `prisma generate` e deploy. O plano deve ter Wave 0 bloqueante com o script.
**Warning signs:** Erros `PrismaClientKnownRequestError` em qualquer operação `findMany` ou `findUnique` em `Condominium` após deploy.

### Pitfall 2: Update de slot sobrescreve o array inteiro sem preservar o outro slot
**What goes wrong:** Enviar `{ deliverySlots: [slotAtualizado] }` na atualização remove o outro slot.
**Why it happens:** MongoDB `$set` em um array substitui o array inteiro — não é um merge.
**How to avoid:** Sempre usar Pattern 3 (read-modify-write): ler os 2 slots, mapear para atualizar apenas o slot alvo, reescrever o array completo.
**Warning signs:** Após editar o slot manhã, o slot tarde desaparece.

### Pitfall 3: processCutoff em loop N² (condomínios × clientes)
**What goes wrong:** Para cada condomínio em corte, buscar todos os clientes e depois todos os orders — O(C × U × O) onde C = condomínios, U = usuários, O = orders.
**Why it happens:** Queries aninhadas em loops sem batching.
**How to avoid:** Buscar orders de amanhã uma vez (todos), indexar por userId em um Set, depois filtrar clientes por condomínio.
**Warning signs:** Log de `processCutoff` demorando > 5s com poucos condomínios.

### Pitfall 4: DeliveryTimeChips exibe chips vazios se a API retornar slots inativos
**What goes wrong:** `ScheduleScreen` passa todos os slots sem filtrar `isActive: true`, mostrando chips para slots desativados.
**Why it happens:** Endpoint pode retornar todos os slots (para o admin ver o estado) mas o cliente deve ver apenas os ativos.
**How to avoid:** Endpoint `GET /client/condominium/slots` já filtra `isActive: true` no backend. Ou filtrar no frontend antes de renderizar.

### Pitfall 5: `GET /client/condominium/slots` sem autenticação expõe dados de outros condomínios
**What goes wrong:** Rota que aceita `?condominiumId=` sem verificar que o usuário pertence àquele condomínio.
**How to avoid:** Usar `user.condominiumId` do JWT — sem aceitar parâmetro de condomínio externo. O usuário só vê os slots do seu próprio condomínio.

---

## Code Examples

### Exemplo 1: Schema Prisma atualizado [VERIFIED: codebase — padrão Address já existe]
```prisma
type DeliverySlot {
  name        String   // "manha" | "tarde"
  time        String   // "06:30"
  cutoffTime  String   // "22:00"
  isActive    Boolean
}

model Condominium {
  // ... campos existentes ...
  deliverySlots DeliverySlot[]
}
```

### Exemplo 2: Zod schema para atualização de slot
```typescript
// admin-condominiums.schema.ts
export const SlotUpdateSchema = z.object({
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  cutoffTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  isActive: z.boolean().optional(),
})
export type SlotUpdateBody = z.infer<typeof SlotUpdateSchema>
```

### Exemplo 3: Rota do endpoint de slots do cliente
```typescript
// GET /client/condominium/slots — autenticado (CLIENT)
fastify.get('/client/condominium/slots', {
  preHandler: [fastify.authenticate],
}, async (request, reply) => {
  const user = request.user
  if (!user.condominiumId) return reply.code(404).send({ message: 'Sem condomínio vinculado' })

  const condo = await fastify.prisma.condominium.findUnique({
    where: { id: user.condominiumId },
    select: { deliverySlots: true },
  })

  const activeSlots = (condo?.deliverySlots ?? []).filter((s) => s.isActive)
  return reply.send(activeSlots)
})
```

### Exemplo 4: DeliveryTimeChips com slots dinâmicos
```tsx
// DeliveryTimeChips.tsx — nova assinatura
interface DeliverySlot {
  name: string
  time: string
}

interface DeliveryTimeChipsProps {
  slots: DeliverySlot[]  // vem da API, não hardcoded
  value: string
  onChange: (v: string) => void
}

export default function DeliveryTimeChips({ slots, value, onChange }: DeliveryTimeChipsProps) {
  return (
    <div>
      <p style={{ /* mesmo estilo atual */ }}>Horário de entrega</p>
      <div style={{ display: 'flex', gap: 9, marginBottom: 18 }}>
        {slots.map((slot) => {
          const isActive = value === slot.time
          return (
            <button key={slot.name} onClick={() => onChange(slot.time)} style={{ /* mesmo estilo */ }}>
              {slot.time}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `deliverySlots String[]` — array simples de HH:MM | `deliverySlots DeliverySlot[]` — composite type com time, cutoffTime, isActive | Phase 13 | Suporte a corte individual por slot sem nova collection |
| `Setting.cutoffTime` global — único horário de corte | `slot.cutoffTime` por slot por condomínio | Phase 13 | Admin pode ter manhã com corte 22h e tarde com corte 10h |
| `DeliveryTimeChips` hardcoded (4 opções fixas) | Chips gerados dinamicamente a partir da API | Phase 13 | Horários refletem a configuração real do condomínio do cliente |

**Deprecated/outdated após Phase 13:**
- `Setting.cutoffTime` como fonte de verdade para `processCutoff` (mantém o registro para compatibilidade visual, mas não é mais consultado pelo cron)
- `DELIVERY_TIMES = ['06:30', '07:00', '07:30', '08:00']` hardcoded em `DeliveryTimeChips`

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Prisma MongoDB não suporta update direto de elemento de array por índice — necessário read-modify-write | Architecture Patterns (Pattern 3) | Se suportado, o padrão ainda é aceitável — apenas menos eficiente |
| A2 | `slotName` ("manha"/"tarde") funciona como chave natural para identificar o slot no array | Architecture Patterns (Pattern 3) | Se dois slots puderem ter o mesmo nome no futuro, precisaria de ID sintético |
| A3 | Condomínios existentes no Atlas têm `deliverySlots: []` (vazio) ou `["06:30", "15:30"]` (strings) | Runtime State Inventory | Se já existem objetos parcialmente migrados, o script precisa de lógica de detecção de formato |
| A4 | cutoffTime padrão do slot manhã = 22:00 do dia anterior; slot tarde = 10:00 do mesmo dia | Pattern 2 / Script | Se os valores padrão corretos forem diferentes, o script de migração popula valores errados |
| A5 | A mensagem de push do corte deve mencionar o slot específico ("manhã" / "tarde") | Common Pitfalls | Se a mensagem for genérica, clientes com 2 slots não saberão qual slot encerrou |

---

## Open Questions

1. **Corte do slot manhã: mesmo dia ou dia anterior?**
   - O que sabemos: o slot manhã é às 06:30. Um corte às 22:00 seria no dia anterior (ex: corte quinta às 22h para entrega sexta às 06:30).
   - O que está incerto: como o `processCutoff` interpreta o `cutoffTime` do slot — se é sempre "hora BRT de hoje" ou se precisa considerar "dia anterior para slot manhã".
   - Recomendação: o `processCutoff` compara apenas `slot.cutoffTime === nowHHMM` sem considerar a data. Para o slot manhã com cutoff 22:00, o cron das 22:00 de quinta dispara notificação de corte para a entrega de sexta às 06:30 — **isso está correto** pois o cron de meia-noite cria os orders do dia seguinte. O admin precisa ser instruído a configurar o cutoffTime sabendo que ele se refere à hora do dia de corte (não necessariamente o dia da entrega).

2. **SLOT-05: ativar/desativar múltiplos condomínios de uma vez**
   - O que sabemos: SLOT-05 menciona "ou em múltiplos condomínios de uma vez pelo painel".
   - O que está incerto: se a UI bulk precisa ser implementada nesta fase ou se a edição individual já satisfaz o critério.
   - Recomendação: o success criteria 1 menciona apenas a edição individual. A funcionalidade bulk pode ser implementada como seleção múltipla na lista de condomínios, mas é secundária ao requisito principal. O plano deve priorizar a edição individual e marcar o bulk como enhancement.

---

## Environment Availability

Step 2.6: SKIPPED — sem dependências externas novas. Todos os serviços e ferramentas (Prisma, node-cron, OneSignal, MongoDB Atlas) já estão disponíveis e operacionais desde fases anteriores.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vitest.config.ts` (raiz do monorepo) |
| Quick run command | `npm run test -- --run` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SLOT-01 | `updateSlot` atualiza apenas o slot alvo sem remover o outro | unit | `vitest run apps/api/src/modules/admin-condominiums/__tests__/` | ❌ Wave 0 |
| SLOT-02 | `create()` injeta os 2 slots padrão automaticamente | unit | idem | ❌ Wave 0 |
| SLOT-03 | Script de migração: condomínio sem slots recebe slots padrão; condomínio com slots não é alterado | unit | `vitest run apps/api/src/scripts/__tests__/` | ❌ Wave 0 |
| SLOT-06 | `processCutoff` dispara para slot cujo cutoffTime == hora BRT atual | unit | `vitest run apps/api/src/modules/admin-settings/__tests__/` | existente |
| SLOT-07 | `processCutoff` itera sobre múltiplos condomínios/slots; dispara separadamente | unit | idem | existente |

### Wave 0 Gaps
- [ ] `apps/api/src/modules/admin-condominiums/__tests__/admin-condominiums.service.test.ts` — cobre SLOT-01, SLOT-02
- [ ] `apps/api/src/scripts/__tests__/migrate-delivery-slots.test.ts` — cobre SLOT-03

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | sim | JWT via `fastify.authenticate` preHandler — padrão existente |
| V4 Access Control | sim | Role check ADMIN inline no controller — padrão D-11 do projeto |
| V5 Input Validation | sim | Zod schema antes de qualquer operação no banco |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR — cliente busca slots de outro condomínio via param | Tampering | Usar `user.condominiumId` do JWT; nunca aceitar `condominiumId` do query param |
| Admin atualiza slot com `time` inválido (ex: "99:99") | Tampering | `z.string().regex(/^\d{2}:\d{2}$/)` no Zod schema |

---

## Sources

### Primary (HIGH confidence)
- Codebase grep — `apps/api/prisma/schema.prisma` — estrutura atual de `Condominium.deliverySlots String[]` e `Address` composite type [VERIFIED: codebase]
- Codebase grep — `apps/api/src/modules/admin-condominiums/` — padrões existentes de CRUD (schema, repository, service, controller, route) [VERIFIED: codebase]
- Codebase grep — `apps/api/src/plugins/cron.ts` — 4 crons existentes incluindo `processCutoff` e `createDailyOrders` [VERIFIED: codebase]
- Codebase grep — `apps/api/src/modules/admin-settings/admin-settings.service.ts` — lógica completa de `processCutoff` com `Setting.cutoffTime` global [VERIFIED: codebase]
- Codebase grep — `apps/web/src/components/client/DeliveryTimeChips.tsx` — array hardcoded `DELIVERY_TIMES` [VERIFIED: codebase]
- Codebase grep — `apps/web/src/pages/client/ScheduleScreen.tsx` — uso atual de `DeliveryTimeChips` e `useSchedule` [VERIFIED: codebase]
- STATE.md D-15 — `Condominium.deliverySlots String[]` embedded como array simples de strings HH:MM [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- REQUIREMENTS.md SLOT-01..07 — requisitos detalhados da fase [VERIFIED: codebase]
- ROADMAP.md Phase 13 success criteria — critérios de aceitação [VERIFIED: codebase]

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — sem pacotes novos; stack existente verificada no codebase
- Schema migration pattern: HIGH — composite type `Address` já em uso no projeto
- Architecture: HIGH — padrões de módulo existentes (admin-condominiums) são reutilizados
- processCutoff refactor: MEDIUM — lógica inferida do código existente; detalhes de "dia anterior vs mesmo dia" para slot manhã precisam de validação
- Pitfalls: HIGH — baseados em comportamento documentado do Prisma MongoDB

**Research date:** 2026-06-19
**Valid until:** 2026-07-19 (stack estável; Prisma 6.x)
