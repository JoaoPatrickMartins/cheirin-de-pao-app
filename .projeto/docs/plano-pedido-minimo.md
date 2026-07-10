# Plano — Pedido mínimo (agenda semanal + pedido único)

## Objetivo
Permitir que o admin configure, na aba **Gestão**, a **quantidade mínima** de pães aceita:
1. **Agenda semanal** — mínimo **por dia da semana** (seg..dom). Vale **por turno/entrega**: em cada
   turno cuja quantidade for `> 0`, ela precisa ser `≥` o mínimo daquele dia. `0` (folga) é sempre válido.
2. **Pedido único** — um **valor único** de mínimo, válido para qualquer data.

## Decisões travadas (com o usuário)
- **Pedido único:** valor único (não varia por dia).
- **Agenda + turnos:** o mínimo do dia se aplica a **cada turno/entrega** (alinha ao pedido de compra
  ao fornecedor, que é por turno), não ao total do dia.
- **Escopo:** **global** — guardado em `Setting` (key/value), como `avulsoUnit`/`avulsoLimite`.

## Princípio que torna isso barato
Toda config global já vive na coleção `Setting` (key/value) e é lida/gravada pelo módulo
`admin-settings` (padrão `getAvulsoConfig`/`setAvulsoConfig`). O backend já é o ponto único de
verdade das quantidades: **pedido único** passa 100% por `OrdersService.createSingleOrder`, e a
**agenda** passa 100% por `SchedulesService.upsertSchedule`. Basta ler os novos settings nesses
dois pontos. O front só replica a regra por UX.

## Estado atual (levantado no código)
- **Pedido único** (`SingleScreen.tsx` → `POST /orders`): quantidade **1..20 fixa** no Zod
  (`orders.schema.ts`) e no `QuantityStepper max={20}`. Hoje **não há mínimo além de 1**. Fluxo com
  déficit (Pix/cartão) também termina criando a order via `createSingleOrder` → um único chokepoint.
- **Agenda** (`ScheduleScreen.tsx` → `PUT /schedules/me`): `days = { [slotId]: { seg..dom: 0..12 } }`
  (`WeeklyQtySchema` min 0 / max 12). `0` = folga. `StepperInline min={0} max={12}`.
- **Config global** existente: `Setting` keys `avulsoUnit`, `avulsoLimite`, slots (JSON), split de
  fornecedor. Semeadas em `bootstrap/defaults-seed.ts`.
- **Ponte pro cliente:** `GET /pricing` (autenticado, `credits.route.ts`) já devolve
  `{ avulsoUnit, avulsoLimite }` e já é consumido pelo `SingleScreen`. É o canal natural para
  expor os mínimos ao cliente.
- ⚠️ **Armadilha conhecida** (memórias `fastify-response-schema-strips-fields` /
  `response-schema-type-mismatch`): ao mexer numa rota Fastify, os **campos novos precisam entrar no
  `response.schema` com o TIPO certo**, senão o `fast-json-stringify` descarta (ou dá 500).

---

## Modelo de dados — novas chaves em `Setting`
| key | tipo (value: String) | significado | default |
|-----|----------------------|-------------|---------|
| `pedidoMinimoUnico`  | inteiro (ex.: `"1"`)                                   | mínimo do pedido único | `"1"` (preserva o comportamento atual) |
| `pedidoMinimoAgenda` | JSON `{seg,ter,qua,qui,sex,sab,dom}` inteiros ≥0       | mínimo por dia da semana (por turno) | `{"seg":1,...,"dom":1}` (preserva: `>0` sempre foi ≥1) |

Sem alteração no `schema.prisma` — `Setting` já é key/value genérico.

---

## Mudanças no BACKEND

### 1. `bootstrap/defaults-seed.ts`
Fazer `upsert` idempotente (`update: {}`) das duas chaves com os defaults acima — cria só se ausente,
preservando qualquer valor que o admin já tenha definido.

### 2. `modules/admin-settings/admin-settings.schema.ts`
Novo schema Zod:
```ts
export const UpdatePedidoMinimoSchema = z.object({
  unico: z.number().int().min(1).max(20),
  agenda: z.object({
    seg: z.number().int().min(0).max(12), ter: ..., ..., dom: ...,
  }),
})
```
(`unico` limitado ao teto do pedido único = 20; cada dia da agenda ≤ 12 = teto do `StepperInline`.)

### 3. `admin-settings.service.ts`
Espelhar `getAvulsoConfig`/`setAvulsoConfig`:
- `getPedidoMinimoConfig()` → lê as 2 chaves; faz `JSON.parse` da agenda com fallback seguro
  (dia ausente → 0) para docs legados/malformados.
- `setPedidoMinimoConfig(unico, agenda)` → 2 `upsert` (`String(unico)` e `JSON.stringify(agenda)`).

### 4. `admin-settings.controller.ts` + `admin-settings.route.ts`
- `GET /admin/settings/pedido-minimo` e `PATCH /admin/settings/pedido-minimo` (role check `ADMIN`
  inline, como as outras). **Definir `response.schema`** com `unico: integer` e `agenda: object`
  de 7 props `integer` (evitar strip/500).

### 5. Enforcement — PEDIDO ÚNICO (`modules/orders/orders.service.ts`)
No início de `createSingleOrder`, após validar a data, ler `pedidoMinimoUnico` e:
```ts
if (data.quantity < min) throw { statusCode: 400, message: `Pedido mínimo de ${min} pães` }
```
Cobre saldo, déficit-Pix e déficit-cartão (todos terminam aqui). O `max(20)` do Zod continua.
> Obs.: o `min(1)` do Zod em `orders.schema.ts` fica; o piso dinâmico do admin é checado no service.

### 6. Enforcement — AGENDA (`modules/schedules/schedules.service.ts`)
Em `upsertSchedule`, **antes** do `repo.upsert`, ler `pedidoMinimoAgenda` e validar `data.days`
(e o legado `data.weeklyQty`): para cada `(slot, dia)`, `qty === 0 || qty >= min[dia]`.
Se violar, `throw { statusCode: 422, message: 'Dia X: mínimo de N pães' }` (mensagem agrega os dias
violados). Helper puro testável `validateAgainstMinimums(days, weeklyQty, minimos)`.

### 7. Ponte pro cliente — `GET /pricing` (`credits`)
- `CreditsService.getPricing()` passa a devolver também `pedidoMinimoUnico` e `pedidoMinimoAgenda`.
- **Atualizar o `response.schema` da rota** `/pricing` (`credits.route.ts`) adicionando
  `pedidoMinimoUnico: integer` e `pedidoMinimoAgenda: object{7×integer}` (senão somem no serializer).

---

## Mudanças no FRONTEND

### 8. Novo item na aba Gestão (`pages/admin/tabs/AdminGestao.tsx`)
- Adicionar `'pedido-minimo'` ao union `AdminGestaoSub`, um `HUB_ITEMS` novo
  (`{ key: 'pedido-minimo', icon: 'coin' | 'bag', titulo: 'Pedido mínimo', descricao: 'Mínimo da agenda e do pedido único' }`)
  e o `if (sub === 'pedido-minimo') return <AdminPedidoMinimo onBack={onBack} />`.

### 9. Nova tela `pages/admin/gestao/AdminPedidoMinimo.tsx`
Espelha `AdminAvulso.tsx` (AppBar + card + `NumberStepper` + Salvar + estados load/save/erro):
- **Pedido único:** 1 `NumberStepper` (1..20).
- **Agenda semanal:** 7 `NumberStepper` (0..12), um por dia (reusar layout de linha por dia do
  `ScheduleScreen`). Legenda: "0 = sem mínimo; vale por turno".
- `GET`/`PATCH /admin/settings/pedido-minimo`. Reusar `NumberStepper` local do `AdminAvulso`
  (extrair para componente compartilhado ou copiar — seguir o padrão atual do repo).

### 10. `pages/client/SingleScreen.tsx`
- Ler `pedidoMinimoUnico` do `/pricing` (já é chamado ali).
- `QuantityStepper min={pedidoMinimoUnico}` e inicializar `qtd` com esse mínimo (hoje começa em 1).
- Mensagem/gate no CTA se `qtd < min` (defensivo; o stepper já impede).

### 11. `pages/client/ScheduleScreen.tsx` (+ hook `useSchedule`)
- Buscar `pedidoMinimoAgenda` (via `/pricing` ou dentro do `useSchedule`).
- **Comportamento do `StepperInline` por dia:** valores válidos = `0` (folga) **ou** `[min..12]`.
  - Incrementar a partir de `0` → salta para `min`.
  - Decrementar abaixo de `min` → cai para `0` (folga).
  - (Alternativa: manter livre e validar só no salvar; a versão que "salta" é melhor UX.)
- Validação no `saveSchedule`: se algum dia violar, `toast` com os dias — mas o **backend continua
  autoritativo** (passo 6).
- Ajuste fino: subtítulo/label indicando o mínimo por dia quando `> 0`.

---

## Testes
- **Unit (api):**
  - `admin-settings.service` — get/set das novas chaves + parse/fallback da agenda.
  - `orders.service` — rejeita `quantity < min`; aceita `== min`.
  - `schedules.service` — `validateAgainstMinimums`: `0` passa; `>0 && <min` falha; multi-slot;
    legado `weeklyQty`.
  - `credits.service.getPricing` — inclui os novos campos.
- **Front:** `SingleScreen` respeita `min`; `AdminPedidoMinimo` faz GET/PATCH; `ScheduleScreen` snap
  0↔min.
- **Serializer:** teste (ou verificação manual) de que `/pricing` e `/admin/settings/pedido-minimo`
  **retornam** os campos novos (não caem no strip do fast-json-stringify).

## Ordem de execução sugerida
1. Seed + schema/service/controller/route do `admin-settings` (backend config pronta).
2. Enforcement em `orders.service` e `schedules.service` (+ helper) + testes.
3. `/pricing` estendido (+ schema de resposta).
4. `AdminGestao` + `AdminPedidoMinimo` (admin já consegue configurar).
5. `SingleScreen` e `ScheduleScreen` (cliente respeita).
6. Testes de front + verificação do serializer.

## Riscos / observações
- **Strip/500 do Fastify** ao estender `/pricing` e criar a rota nova — mitigado nos passos 4/7.
- **Docs legados** de `Setting` sem a chave → fallback (min efetivo 0/1) preserva comportamento atual.
- **Coerência de tetos:** `unico ≤ 20` e agenda `≤ 12` casam com os limites já existentes na UI/Zod.
- **Sem migração de dados** — só novas chaves em `Setting`; nada quebra agendas/pedidos existentes.
