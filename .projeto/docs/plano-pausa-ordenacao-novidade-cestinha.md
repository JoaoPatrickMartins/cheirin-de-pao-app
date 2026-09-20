# Plano — Pausa, Ordenação e Novidade nos produtos da Cestinha

> ✅ **Status:** **IMPLEMENTADO** em 19/09/2026 (execução direta, sem GSD, autorizada pelo usuário).
> **SEM COMMIT** — aguardando autorização explícita. Branch `feat/add-complementocliente`.
> Verificação: typecheck (shared + api + web) ✅ · build do api ✅ · build do web ✅ ·
> **851 testes do api passando + 3 todo** (+77) · **143 do web passando + 17 todo** (+19).
> Ver §13 para o que divergiu do plano.
>
> ⚠️ **A decisão D-3 (corte por ciclo de entrega) foi REVERTIDA** após o UAT — o horário do produto
> passa a ser relógio de loja. Ver [plano-correcao-horario-de-venda.md](./plano-correcao-horario-de-venda.md).

## 1. Objetivo

Dar ao admin quatro controles novos sobre os produtos do mini market "Além do Pãozin", sem que
nenhum deles vaze complexidade para o cliente:

1. **Corte por horário** — depois de uma hora configurada, o produto para de aceitar pedido para
   o ciclo de entrega em curso. Volta sozinho quando o ciclo vira.
2. **Pausa imediata** — o admin pausa o item agora, com prazo (15/30/60 min ou personalizado) ou
   sem prazo ("até eu religar"). Com prazo, despausa sozinho.
3. **Ordenação** — o admin arrasta para definir a ordem em que os produtos aparecem na vitrine.
4. **Novidade** — marcar produtos como novidade; eles sobem para a frente da grade (atrás apenas
   do Pão Francês), podem ser vários ao mesmo tempo, ordenáveis entre si, e o selo expira sozinho.

**Invariante de produto:** em todos os casos, o cliente vê **"Esgotado"** — o card não some, não
ganha explicação, não diz "pausado". O admin vê o estado real, o motivo e a hora da volta.

---

## 2. Contexto — o que já existe

| Peça | Arquivo | O que faz hoje |
|---|---|---|
| Modelo | [schema.prisma:679-696](../../apps/api/prisma/schema.prisma#L679-L696) | `isActive`, `sortOrder`, `availableDays`, `stock`/`dailyCapacity` |
| Catálogo (cliente) | [market.service.ts:59-102](../../apps/api/src/modules/market/market.service.ts#L59-L102) | filtra `isActive: true`; calcula `soldOut` = `maxQty <= 0` |
| Cestinha (carrinho) | [market.service.ts:129-203](../../apps/api/src/modules/market/market.service.ts#L129-L203) | recalcula `soldOut` por linha, clampa qty pelo teto |
| Checkout | [market-checkout.service.ts:104-184](../../apps/api/src/modules/market/market-checkout.service.ts#L104-L184) | valida `isActive`, `availableDays`, corte do slot, bloqueios, estoque |
| Régua de corte BRT | [lib/cutoff.ts](../../apps/api/src/lib/cutoff.ts) | `nowHHMM`, `cutoffInstantForDelivery`, `isPastCutoffForDelivery`, `nextDeliveryDateStr` |
| Slots do condomínio | [lib/delivery-slots.ts](../../apps/api/src/lib/delivery-slots.ts) | `getCondoDeliverySlots`, `getGlobalDeliverySlots`, `HHMM_RE` |
| Admin — lista | [MarketProdutos.tsx](../../apps/web/src/pages/admin/gestao/MarketProdutos.tsx) | lista + `statusOf()` (Inativo/Esgotado/Baixo/Ativo) |
| Admin — form | [MarketProductForm.tsx](../../apps/web/src/pages/admin/gestao/MarketProductForm.tsx) | CRUD + bloco "Disponibilidade" (dias da semana) |
| Cliente — card | [ProdCard.tsx](../../apps/web/src/components/client/ProdCard.tsx#L76-L80) | selo canto superior DIREITO: Esgotado / Últimas |
| Drag-and-drop | [DeliveryDivisionCard.tsx](../../apps/web/src/components/admin/DeliveryDivisionCard.tsx#L96-L125) | padrão @dnd-kit já pronto (GripDots, DragOverlay, touch) |

### Cinco achados que encurtam o trabalho

**A1 — `sortOrder` já existe e já é usado no `orderBy`** em
[market.repository.ts:17](../../apps/api/src/modules/market/market.repository.ts#L17) e
[admin-market.repository.ts:17](../../apps/api/src/modules/admin-market/admin-market.repository.ts#L17).
Nenhuma UI escreve nele — é sempre `0`, e o catálogo cai no desempate por nome. A feature 3 é
**1 endpoint + 1 tela**, sem mexer em leitura.

**A2 — o estado "Esgotado" do cliente já é completo e centralizado num único booleano.** Ele
governa ProdCard, ProductDetail, CestinhaScreen, MarketMiniCard e MarketAddonStrip. Fazendo
`soldOut` virar a **união** (sem estoque OU pausado OU fora do prazo), o comportamento pedido sai
com **zero mudança** nessas cinco telas.

**A3 — o Pão Francês já é renderizado fora da grade, sempre primeiro**
([MarketCatalog.tsx:251-259](../../apps/web/src/pages/client/MarketCatalog.tsx#L251-L259)).
"Novidade atrás só do pão francês" = novidade em 1º lugar da grade. Sai de graça.

**A4 — buraco atual: o checkout não valida `soldOut`.**
[market-checkout.service.ts:106](../../apps/api/src/modules/market/market-checkout.service.ts#L106)
só barra `!isActive`. Quem já tem o item no carrinho hoje atravessa um produto esgotado até a
reserva atômica. **Sem tapar isso, a pausa é decorativa.**

**A5 — @dnd-kit já é dependência** ([package.json](../../apps/web/package.json)) e já tem padrão
visual e de toque validado no admin. Nada a instalar, nada a inventar.

---

## 3. Decisões confirmadas

| # | Decisão | Detalhe |
|---|---|---|
| **D-1** | **Pausa é um eixo novo, não um valor de `isActive`** | `isActive: false` continua sendo *arquivar* (some do catálogo). Pausa é ortogonal: o card fica visível e não-comprável. |
| **D-2** | **Estado derivado, nunca escrito por cron** | Tudo é calculado na leitura a partir de `now`. Sem minuto perdido em deploy/queda, sem backfill, precisão ao segundo, função pura testável. Mesmo gosto de `isPastCutoffForDelivery`. |
| **D-3** | **O horário é CORTE POR CICLO DE ENTREGA, não vitrine** | O horário do produto é um `cutoffTime` próprio, na mesma família de `availableDays` (que já é validado contra a data de entrega). Modela o corte real do fornecedor. |
| **D-4** | **Janela `de–até` (HH:MM BRT)** | `availableFrom`/`availableUntil`, ambos opcionais. Só `até` resolve o caso pedido; `de` cobre item que só entra em venda após certa hora. Sem cruzar meia-noite (validado). |
| **D-5** | **O corte do produto só ANTECIPA, nunca estende** | `corteEfetivo = min(corte do slot, corte do produto)`. Um produto não pode vender além do corte do slot. |
| **D-6** | **O catálogo usa um ciclo de referência implícito** | Sem seletor de data, sem informar data ao cliente. A referência é a próxima entrega que o cliente conseguiria. Fluxo de compra intacto. |
| **D-7** | **A pausa manual é VITRINE, não ciclo** | "Pausa 30 min" bloqueia agora, para qualquer data. É outro mecanismo, e compõe com D-3 por OR. |
| **D-8** | **Pausa manual com prazo E sem prazo** | `pausedUntil` (despausa sozinha) + `isPaused` ("até eu religar"). "Despausar agora" sempre disponível. |
| **D-9** | **Ao expirar o snooze, a janela de horário volta a mandar** | É o "ainda respeitando a regra anterior". O empilhamento é OR; nenhuma pausa apaga a outra. |
| **D-10** | **Um único `sortOrder`; novidade é *balde*, não campo de ordem** | Ordenação final: `[novidade vigente desc, sortOrder asc, name asc]`. Evita um segundo campo de ordem e mantém fonte única. |
| **D-11** | **Ordem e flag de novidade salvam juntas, atomicamente** | `PUT /admin/market/products/order` recebe `{ novidades: [], catalogo: [] }`. A tela nunca salva pela metade. |
| **D-12** | **Novidade expira sozinha, com prazo padrão de 14 dias editável** | `newUntil` derivado (sem cron). Opções 7/14/30 dias e "até eu remover" (`newUntil: null`). |
| **D-13** | **Cliente vê só "Esgotado"** | Sem "volta às", sem motivo, sem data. Zero mudança de copy no front. **Revisa** a escolha inicial de mostrar o horário de volta. |
| **D-14** | **O admin vê tudo** | Estado, motivo (`manual`/`temporaria`/`horario`), instante da volta e contagem regressiva viva. |
| **D-15** | **Pausa é estado de vitrine, não de operação** | [restock-demand.ts:78](../../apps/api/src/lib/restock-demand.ts#L78) filtra por `isActive` — produto pausado continua ativo, continua entrando em Reposição e no pedido ao fornecedor. Correto e de graça. |
| **D-16** | **Selo de novidade: espresso + ouro, canto superior ESQUERDO** | O direito já é do Esgotado/Últimas — nunca colidem, e os dois podem coexistir. |
| **D-17** | **Modo "Ordenar" dentro de Gestão › Produtos** | Toggle na própria lista, não tela nova. O hub do Além do Pãozin já tem 6 abas. |
| **D-18** | **Pão Francês fora da ordenação e da novidade** | Ele não entra na grade (tem card próprio, sempre primeiro). Excluído da tela de ordenação. |
| **D-19** | **Campos novos nullable, sem índice novo** | `db push` sem migração e sem backfill. Nada de índice: o catálogo tem dezenas de linhas, e há histórico de índice duplicado quebrando o `db push` (commit c96bee3). |
| **D-20** | **Fechar o buraco do CTA da Cestinha** | Desabilitar "Finalizar" quando qualquer linha está esgotada. A mensagem "Esgotado — remova para continuar" já existe; hoje ela não trava nada e o cliente leva 409. |

---

## 4. Regras finais (como fica)

### 4.1 Corte por ciclo — a matemática

Para um produto `P`, um slot `S` e uma data de entrega `D` (YYYY-MM-DD, dia BRT):

```
diaDoCorte(hhmm)  =  S.time > hhmm ? D : D-1          // Regra A, já em cutoff.ts

corteProduto  =  instanteBRT( diaDoCorte(P.availableUntil), P.availableUntil )
                 (null quando P.availableUntil é null)

corteSlot     =  cutoffInstantForDelivery(S.time, S.cutoffTime, D)

corteEfetivo  =  min( corteSlot , corteProduto ?? +∞ )                        // D-5

abertura      =  instanteBRT( diaDoCorte(P.availableUntil ?? S.cutoffTime), P.availableFrom )
                 (null quando P.availableFrom é null)

aceitaPedido(now)  =  (abertura == null || now >= abertura)  &&  now < corteEfetivo
```

`corteProduto` é literalmente `cutoffInstantForDelivery(S.time, P.availableUntil, D)` — o horário do
produto entra no lugar do horário de corte do slot. A `abertura` usa o **mesmo dia-calendário** do
corte do produto, para que a janela `de–até` fique num dia só (daí a proibição de cruzar meia-noite).

**Exemplo** — slot manhã `06:30`, corte do slot `22:00`, croissant com janela `até 10:00`:

| Agora | Próxima entrega | Corte do croissant | Estado |
|---|---|---|---|
| 09:59 | amanhã 06:30 | hoje 10:00 | disponível |
| 10:00 | amanhã 06:30 | passou | **Esgotado** |
| 22:00 | depois de amanhã 06:30 | amanhã 10:00 | **reabre sozinho** |

Às 22:00 o corte do slot passa, a próxima entrega avança um dia e o produto volta — sem cron, sem
ninguém tocar em nada.

### 4.2 Ciclo de referência do catálogo (D-6)

O catálogo e a Cestinha não conhecem a data de entrega — ela só é escolhida no
[MarketCheckoutScreen](../../apps/web/src/pages/client/MarketCheckoutScreen.tsx). Então:

```
cicloDeReferencia(condominiumId, now):
  slots = getCondoDeliverySlots(condominiumId)   // sem condomínio → getGlobalDeliverySlots()
  para cada slot ATIVO S:
      d = nextDeliveryDateStr(S.time, now)                         // hoje se S.time > agora, senão amanhã
      se isPastCutoffForDelivery(S.time, S.cutoffTime, d, now):
          d = d + 1 dia                                            // o corte desse ciclo já passou
      candidato = { S, d, instanteEntrega: instanteBRT(d, S.time) }
  retorna o candidato de MENOR instanteEntrega    (null se não há slot ativo)
```

**Simplificação consciente:** a referência **não** consulta dias/datas bloqueadas
(`getRulesForCondo` / `getDateBlock`). Se amanhã for feriado, o catálogo pode mostrar um produto
como fechado quando ele já estaria aberto para depois. É raro, e o custo de evitar seria 2 queries
extras em **toda carga de Home** — o `/market/catalog` é consumido também por
[MarketHomeBlock](../../apps/web/src/components/client/MarketHomeBlock.tsx) e
[MarketAddonStrip](../../apps/web/src/components/client/MarketAddonStrip.tsx). O checkout valida de
verdade. Fica anotado como refinamento futuro.

**Sem slot ativo:** `foraDoPrazo = false` — não se pune o cliente por uma lacuna de configuração
(o checkout já barra com "Horário de entrega indisponível").

### 4.3 Estado efetivo (o que o cliente e o admin veem)

```
pausadoVitrine =  P.isPaused === true  ||  (P.pausedUntil != null && P.pausedUntil > now)
foraDoPrazo    =  ciclo != null && !aceitaPedido(P, ciclo.S, ciclo.d, now)
semEstoque     =  maxQty <= 0                                        // regra atual, intocada

soldOut (CLIENTE) =  semEstoque || pausadoVitrine || foraDoPrazo      // D-3, uma palavra só
```

Para o admin, o mesmo cálculo devolve estrutura:

```ts
availability: {
  state:  'inativo' | 'pausado' | 'esgotado' | 'ativo'   // nesta ordem de prioridade
  reason: 'manual' | 'temporaria' | 'horario' | null
  until:  string | null                                   // ISO; null = sem previsão
}
```

### 4.4 Ordenação e novidade

```
novidadeVigente(P) =  P.isNew === true  &&  (P.newUntil == null || P.newUntil > now)

ordem =  [ novidadeVigente desc , sortOrder asc , name asc ]
```

O banco ordena por `[sortOrder, name]` (já é o caso hoje) e **o serviço reordena o balde** com um
sort estável de uma linha. Motivo: `newUntil` é derivado — uma novidade expirada não pode continuar
ordenando na frente, e o banco não sabe disso.

```ts
const ordered = [...products].sort((a, b) => Number(novidadeVigente(b)) - Number(novidadeVigente(a)))
```

**Efeito colateral desejado:** ao expirar, a novidade mantém o `sortOrder` baixo e cai para o
**topo do catálogo comum** — um item recente continua bem posicionado. É intencional.

---

## 5. Modelo de dados

```prisma
model Product {
  // ... campos atuais inalterados ...

  // ── Corte por ciclo de entrega (janela diária de PEDIDO, BRT "HH:MM") ──
  // Mesma família de availableDays: relativo à DATA DE ENTREGA, não ao relógio da loja.
  // null = sem restrição de horário. Não cruza meia-noite (from < until).
  availableFrom   String?
  availableUntil  String?

  // ── Pausa de vitrine (bloqueia AGORA, qualquer data) ──
  isPaused        Boolean?   // sem prazo — o admin religa na mão
  pausedUntil     DateTime?  // com prazo — despausa sozinha ao passar do instante
  pauseReason     String?    // motivo, só o admin vê
  pausedBy        String?    @db.ObjectId
  pausedAt        DateTime?

  // ── Novidade ──
  isNew           Boolean?
  newUntil        DateTime?  // null com isNew=true = "até eu remover"
}
```

**Por que nullable e não `@default(false)`:** o conector MongoDB do Prisma lê documento sem o campo
como `null` sem reclamar; com default há risco de inconsistência em documentos antigos. É o padrão
já usado no schema (`stockReturned Boolean?`, `creditsAppliedMilli Int?`). `null` é tratado como
`false` no serviço. **Nenhum backfill de boot é necessário.**

**Nenhum índice novo** (D-19).

---

## 6. Backend

### 6.1 `apps/api/src/lib/product-availability.ts` (novo — é onde mora toda a regra)

Funções puras, relógio injetável, sem Prisma exceto na busca do ciclo:

```ts
export type PauseReason = 'manual' | 'temporaria' | 'horario'
export interface Availability { paused: boolean; reason: PauseReason | null; until: Date | null }

/** Pausa de vitrine (manual/temporária). Independe da entrega. */
export function vitrinePause(p, now): Availability

/** Instante do corte efetivo do produto para uma entrega: min(corte do slot, corte do produto). */
export function effectiveCutoffInstant(p, slot, deliveryDateStr): Date

/** Instante de abertura da janela, ou null. */
export function windowOpenInstant(p, slot, deliveryDateStr): Date | null

/** O produto aceita pedido para (slot, data) neste instante? */
export function acceptsOrder(p, slot, deliveryDateStr, now): boolean

/** Ciclo de referência do catálogo (§4.2). Única função que toca o banco. */
export async function referenceCycle(prisma, condominiumId, now): Promise<{ slot; dateStr } | null>

/** Estado completo para o admin (§4.3). */
export function availabilityOf(p, cycle, now): { state; reason; until }

/** Novidade vigente (§4.4). */
export function isNovidadeVigente(p, now): boolean
```

Um helper local `instantAt(slotTime, refHHMM, atHHMM, D)` generaliza
`cutoffInstantForDelivery` (que fixa dia e hora no mesmo `hhmm`) para permitir dia do `until` com
hora do `from`. **`lib/cutoff.ts` não é alterado.**

### 6.2 `packages/shared/src/schemas/market.ts`

```ts
export const HHMMSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido')

// CreateProductSchema / UpdateProductSchema ganham:
  availableFrom:  HHMMSchema.nullable().optional(),
  availableUntil: HHMMSchema.nullable().optional(),
  isNew:          z.boolean().optional(),
  newUntil:       z.string().datetime().nullable().optional(),
// + .refine(from < until quando ambos presentes)

export const PauseProductSchema = z.object({
  minutes: z.number().int().min(1).max(1440).optional(),   // ausente = "até eu religar"
  reason:  z.string().trim().max(120).optional(),
})

export const ReorderProductsSchema = z.object({
  novidades: z.array(ObjectIdSchema).max(200),
  catalogo:  z.array(ObjectIdSchema).max(200),
})
```

### 6.3 `market.service.ts` (cliente)

- `getCatalog(userId)` passa a receber `userId`, resolve o `referenceCycle` **uma vez** e aplica a
  união do `soldOut` a todos os produtos.
- Acrescenta `isNew: boolean` (novidade vigente) ao payload — **único campo novo para o cliente**.
- Reordena pelo balde de novidade (§4.4).
- `buildCartView` recebe o mesmo ciclo e aplica a mesma união por linha. **`maxQty` não é tocado** —
  a quantidade do carrinho não é zerada silenciosamente; a linha fica marcada e o cliente remove.

### 6.4 `market-checkout.service.ts`

Novo **passo 7.1**, logo depois da checagem de `availableDays` (mesma família):

```ts
// 7.1 Pausa e corte por produto — avaliados contra a DATA REAL escolhida.
for (const { product } of lines) {
  if (vitrinePause(product, now).paused || !acceptsOrder(product, slot, dateStr, now)) {
    throw { statusCode: 409, message: `${product.name} está esgotado.` }
  }
}
```

Mensagem **idêntica** à do passo 8 — nunca vazar "pausado" (D-13).

### 6.5 `admin-market.service.ts` + rotas

| Método | Rota | O que faz |
|---|---|---|
| `POST` | `/admin/market/products/:id/pause` | `{ minutes?, reason? }` → grava `pausedUntil` (ou `isPaused: true`), `pausedBy`, `pausedAt` |
| `POST` | `/admin/market/products/:id/resume` | limpa `isPaused`, `pausedUntil`, `pauseReason` |
| `PUT` | `/admin/market/products/order` | `{ novidades, catalogo }` → `$transaction` de N updates |
| `PATCH` | `/admin/market/products/:id` | estendido com `availableFrom`, `availableUntil`, `isNew`, `newUntil` |
| `GET` | `/admin/market/products` | ganha `availability` (§4.3) em cada linha |

**Regras do reorder:** ids duplicados entre as duas listas → 400. Id inexistente → 400. Pão Francês
na lista → ignorado (D-18). `sortOrder` é uma sequência contínua: novidades `0..n-1`, catálogo
`n..n+m-1`, e `isNew` é gravado junto no mesmo `$transaction`.

**`updateProduct` do Pão Francês** ([admin-market.service.ts:171-184](../../apps/api/src/modules/admin-market/admin-market.service.ts#L171-L184))
já filtra os campos editáveis — os novos campos **não** entram lá.

---

## 7. Frontend admin

### 7.1 `MarketProdutos.tsx` — lista

- `statusOf()` com nova prioridade: **Inativo → Pausado → Esgotado → Baixo → Ativo**.
- Linha pausada ganha **trilho de 4px em `--color-gold` à esquerda** e pill
  `⏸ 12 min` em `--color-accent` sobre `--color-surface-2`, com **contagem regressiva viva**
  (um `useNow()` de 30s compartilhado na tela).
- Pill `⏸ pausado` sem contagem quando é "até eu religar"; `⏸ até 10:00` quando é corte por horário.
- Botão ⏸ por linha → abre o `PauseSheet` (pausar em 2 toques, sem entrar no produto).
- Botão **"Ordenar"** no topo, ao lado de "Novo produto".

### 7.2 `PauseSheet.tsx` (novo — modelado no `ConfirmSheet` existente)

```
   Pausar "Geleia de Morango"

   [ 15 min ]  [ 30 min ]  [ 1 h ]
   [ Personalizado… ]
   [ Até eu religar ]

   ⏸  Volta às 10:32                      ← preview ao vivo
   Motivo (opcional) ______________

   [           Pausar           ]
```

Quando o produto **já** está fechado pelo corte por horário, o sheet diz isso em vez de fingir:
*"Este produto já está fora do prazo do próximo pedido (volta às 22h). Pausar agora vale para
quando ele reabrir."*

Produto pausado → o mesmo sheet vira **"Despausar agora"** + a informação de quando voltaria sozinho.

### 7.3 Modo "Ordenar" (dentro de `MarketProdutos`)

```
   ✦ NOVIDADES
    ⠿  🫙  Geleia de Morango
    ⠿  🥐  Croissant
   ────────────────────────────────
   CATÁLOGO
    ⠿  ☕  Café em grãos
    ⠿  🧈  Manteiga
    ⠿  🧀  Queijo minas

   ┌──────────────────────────────┐
   │        Salvar ordem          │   sticky, safe-area
   └──────────────────────────────┘
```

- `DndContext` + dois `SortableContext` verticais; `useDroppable` nas seções para aceitar lista
  vazia. **Arrastar entre as seções marca/desmarca novidade.**
- Reuso do `GripDots` e do `DragOverlay` de
  [DeliveryDivisionCard.tsx](../../apps/web/src/components/admin/DeliveryDivisionCard.tsx)
  (inclusive `touchAction: 'none'`, que é o que faz funcionar no celular).
- Linhas compactas, tap-para-editar desligado no modo ordenar.
- Salvar → um `PUT` atômico; erro → mantém a ordem local e mostra o erro (não recarrega em cima).

### 7.4 `MarketProductForm.tsx`

Dentro do bloco **Disponibilidade** (abaixo dos chips de dia da semana):

```
   Horário do pedido
   [ O dia todo ]  [ Faixa de horário ]
       das [06:00] às [10:00]

   Depois de 10:00, o produto não entra mais no pedido
   da próxima entrega. Ele volta sozinho quando o ciclo vira.
```

Bloco novo **Novidade**:

```
   ✦ Marcar como novidade            [toggle]
       ( ) 7 dias   (•) 14 dias   ( ) 30 dias   ( ) Até eu remover
       Expira em 03/10/2026
```

Ambos ocultos para o Pão Francês (D-18).

---

## 8. Frontend cliente

**Só duas mudanças.** Tudo o mais funciona por causa de A2.

1. **Selo de novidade** — canto superior **esquerdo** da foto, em
   [ProdCard](../../apps/web/src/components/client/ProdCard.tsx),
   [MarketMiniCard](../../apps/web/src/components/client/MarketMiniCard.tsx) (menor) e no hero do
   [ProductDetail](../../apps/web/src/pages/client/ProductDetail.tsx). Coexiste com o selo
   Esgotado/Últimas no canto direito.

2. **Gate do CTA da Cestinha** (D-20) — desabilitar "Finalizar" quando alguma linha tem
   `soldOut`, em [CestinhaScreen.tsx:212](../../apps/web/src/pages/client/CestinhaScreen.tsx#L212).
   A mensagem por linha já existe.

E um ajuste invisível: `useMarketCatalog` refaz o fetch no `visibilitychange` — resolve 90% do
estado velho (app aberto no bolso atravessando o corte) por ~6 linhas, sem nenhum dado novo no
payload.

### 8.1 Spec do selo (D-16)

```
   ┌────────────────┐
   │ ▐█✦ NOVIDADE▌  │   background : var(--color-espresso)  #1E1207
   │   [  foto  ]   │   color      : var(--color-gold)      #E3AC3F
   │                │   font-size  : 10.5px / weight 800
   │ GELEIAS        │   letter-sp  : 0.06em / UPPERCASE
   │ Geleia de      │   padding    : 3px 8px / radius 999
   │ Morango        │   posição    : top 6, left 6, z-index 2
   │ R$ 12,00       │
   │ 🥖 10 pães −17%│   (mesmas medidas do cornerBadge existente,
   │ [ Adicionar  ] │    espelhado para a esquerda)
   └────────────────┘
```

No `MarketMiniCard` (150px de largura): 9.5px, padding `2px 6px`, e o texto vira só **`✦ NOVO`**.

Produto pausado **mantém** o selo de novidade; a foto acinzenta e o canto direito recebe "Esgotado".

---

## 9. Ondas de implementação

| Onda | Escopo | Entrega verificável |
|---|---|---|
| **A** | Schema (`db push`) · schemas Zod no `shared` · `lib/product-availability.ts` · testes unitários da lib | `npm run typecheck` nos 3 pacotes + testes da lib passando |
| **B** | `market.service.ts`: união do `soldOut`, `isNew`, reordenação, ciclo de referência | testes de catálogo/cestinha com relógio fixo |
| **C** | `market-checkout.service.ts` passo 7.1 · `admin-market.service.ts`: `availability`, pause/resume, reorder · rotas + controller | testes de checkout e do módulo admin |
| **D** | Admin UI: `statusOf` + trilho + pill viva · `PauseSheet` · modo Ordenar · form (janela + novidade) | UAT no admin |
| **E** | Cliente: selo de novidade (3 componentes) · gate do CTA · refetch no `visibilitychange` | testes do web + UAT no cliente |

**A → B → C** são sequenciais (B e C dependem da lib). **D** e **E** podem correr em paralelo
depois de C.

---

## 10. Testes

A lib de disponibilidade concentra todo o risco. Relógio fixo, função pura, sem mocks de Prisma:

| Caso | Esperado |
|---|---|
| corte 10:00, slot 06:30/22:00, às 09:59 | aceita |
| mesmo cenário às 10:00 | recusa |
| mesmo cenário às 22:00 | aceita de novo (ciclo virou) |
| corte do produto 23:00 > corte do slot 22:00 | o slot manda (corte 22:00) |
| slot da tarde 15:30, corte do slot 10:00, produto até 09:00 | corte no MESMO dia às 09:00 |
| janela 14:00–18:00, às 13:59 / 14:00 / 18:00 | recusa / aceita / recusa |
| `pausedUntil` no futuro | recusa, `reason: 'temporaria'` |
| `pausedUntil` expirado, fora da janela de horário | recusa, `reason: 'horario'` (D-9) |
| `isPaused: true` dentro da janela | recusa, `reason: 'manual'` |
| `isNew: true`, `newUntil` expirado | não ordena na frente |
| sem slot ativo no condomínio | `foraDoPrazo = false` |
| reorder com id duplicado entre listas | 400 |
| reorder com Pão Francês | ignorado |
| checkout de item pausado | 409 com "está esgotado" (sem a palavra "pausado") |

---

## 11. Riscos

| # | Risco | Mitigação |
|---|---|---|
| **R1** | `/market/catalog` passa a ler os slots do condomínio — e ele é chamado em toda carga de Home (`MarketHomeBlock`) | 2 queries, resolvidas **uma vez** por request e compartilhadas por todos os produtos. Sem N+1. Medir se virar problema. |
| **R2** | Estado derivado fica velho numa aba aberta | O servidor é autoridade e barra no checkout com mensagem clara; o refetch no `visibilitychange` cobre o caso comum. |
| **R3** | `db push` no Mongo com campos novos | Todos nullable, sem índice novo (D-19). Zero backfill. Há histórico de índice duplicado quebrando `db push` (c96bee3). |
| **R4** | Duas semânticas de pausa (vitrine × ciclo) confundem o admin | Microcopy explícita no form ("volta sozinho quando o ciclo vira") e no `PauseSheet` (o aviso de sobreposição). O cliente nunca vê a diferença. |
| **R5** | Feriado/bloqueio desloca o ciclo de referência (§4.2) | Documentado como simplificação. Baixa frequência; o checkout valida de verdade. |
| **R6** | Novidade expirada cai no topo do catálogo comum | Intencional e documentado (§4.4). Se incomodar, o admin rearrasta. |

---

## 12. O que divergiu do plano

| # | Divergência | Por quê |
|---|---|---|
| **V-1** | **A volta de um produto com `availableFrom` é mais tarde que a virada do ciclo** | O plano dizia "volta = corte do turno". Um teste mostrou que isso está errado quando há abertura própria: com janela `14:00–18:00`, o ciclo vira às 22:00 mas a janela do ciclo seguinte só abre às 14:00 do dia seguinte. `orderWindowBlock` usa o **máximo** entre os dois. O caso sem `availableFrom` (o do exemplo do §4.1) continua igual. |
| **V-2** | **O reorder aplica o prazo padrão ao promover** | Não estava no plano. Arrastar um item para "Novidades" é uma forma de marcar novidade — sem aplicar o prazo ali, o selo posto pelo arraste seria eterno, contradizendo D-12. Reordenar uma novidade que já existe **preserva** o prazo. |
| **V-3** | **`novidadeDirty` no formulário** | Sem isso, salvar uma edição de nome reiniciaria a contagem do selo para 14 dias. O `newUntil` só é reenviado quando o admin mexe nos controles de novidade; caso contrário o backend preserva o que está gravado. |
| **V-4** | **`prisma db push` não foi executado — e não é necessário** | No MongoDB, campos escalares opcionais não existem como esquema e nenhum índice foi adicionado (D-19). Só `prisma generate` foi preciso, para os tipos do client. |
| **V-5** | **No `ProductDetail` o selo de novidade vai à DIREITA** | No herói, o selo de estoque já ocupava `top/left`. Na grade os dois cantos seguem como planejado (novidade à esquerda, estoque à direita). |
| **V-6** | **`availabilityOf` recebe `outOfStock` pronto em vez de ler estoque** | Manter a lib focada em tempo/pausa. Quem sabe calcular o teto por pedido é quem já o calcula (catálogo e admin), e a regra não fica duplicada dentro da lib. |
| **V-7** | **O admin também ganhou `isNovidade`** | `isNew` cru pode estar vencido. A lista precisava do selo **vigente**, e a tela de ordenação precisa dele para montar as duas seções. |

## 13. Pendência de processo

O `CLAUDE.md` exige que alterações de código passem por um comando GSD (`/gsd-quick`,
`/gsd-execute-phase`). Esses comandos **não estavam disponíveis nesta sessão** — não há
`.claude/commands/` no repo nem skill `gsd-*` registrada. O usuário autorizou explicitamente a
execução direta ("execute direto"), como já havia ocorrido em
`plano-gancho-cestinha-recorrencia.md`.

E, como sempre neste repo: **nenhum commit ou push sem autorização explícita no momento.**

## 14. Para validar no app (UAT)

1. **Gestão › Além do Pãozin › Produtos** — abrir um produto, ligar "Faixa de horário" e pôr um
   `até` que já passou. Salvar. A linha deve virar `⏸ Pausado · volta HH:MM`.
2. No app do cliente, o mesmo produto aparece **cinza com "Esgotado"** e o card **não some**.
3. Adicionar esse produto à Cestinha ANTES de pausar e tentar finalizar: o botão "Ir para
   pagamento" fica travado com "Remova os itens esgotados para continuar".
4. Na lista do admin, tocar em **⏸ pausar** → 15 min. A pill deve contar para trás sozinha e o
   produto voltar ao fim do prazo, sem recarregar nada.
5. **Ordenar** → arrastar um produto para a seção **Novidades** → Salvar ordem. No cliente ele
   sobe para a frente da grade (atrás só do Pão Francês) com o selo `✦ NOVIDADE`.
