# Plano — Gancho grátis pela Cestinha e por Recorrência

> ✅ **Status:** **IMPLEMENTADO** em 17/08/2026 (execução direta, sem GSD, autorizada pelo usuário).
> **SEM COMMIT** — aguardando autorização explícita. Branch `feat/add-complementocliente`.
> Verificação: typecheck (shared+api+web) ✅ · build do api ✅ · **727 testes do api passando + 3
> todo** (+19) · **118 do web passando + 17 todo**. Ver §11 para o que divergiu do plano.

## 1. Objetivo

Ampliar as regras que dão direito ao **gancho de porta gratuito**, hoje limitadas a "comprou combo"
ou "pedido único ≥ mínimo", com dois novos caminhos:

1. **Cestinha (mini market):** uma compra na Cestinha dá direito ao gancho grátis quando o **valor
   total** do pedido equivale a, no mínimo, a **mesma quantidade de pães** já configurada para o
   pedido único — convertida para reais pelo preço do pão avulso.
2. **Recorrência (fidelidade):** o cliente que atingir um **número X de pedidos entregues** também
   ganha o gancho, mesmo que nenhum pedido isolado tenha atingido o mínimo.

O invariante permanece: **o gancho grátis é concedido uma única vez por cliente**, qualquer que seja
a regra que o contemplou — inclusive quando o gancho veio de uma **concessão do admin**.

---

## 2. Contexto — o que já existe

| Peça | Arquivo | O que faz hoje |
|---|---|---|
| Config | [gancho-config.ts](../../apps/api/src/lib/gancho-config.ts) | Lê `ganchoPedidoUnicoMin` (default 10) e `ganchoPreco` (default R$ 5) do `Setting`, com parse defensivo |
| Elegibilidade | [client-hook.service.ts:38-53](../../apps/api/src/modules/client-hook/client-hook.service.ts#L38-L53) | `isFreeEligible` = (nº de `Payment PAID` com `comboId`) > 0 **OU** (nº de `Order SINGLE` não-cancelado com `quantity >= pedidoUnicoMin`) > 0 |
| Status | [client-hook.service.ts:60-105](../../apps/api/src/modules/client-hook/client-hook.service.ts#L60-L105) | `GET /client/hook-request` → `{ hookPrice, pedidoUnicoMin, freeEligible, hasHook, needsConsent, canRequestPaid, current }` |
| "Uma vez só" | [client-hook.service.ts:92-93](../../apps/api/src/modules/client-hook/client-hook.service.ts#L92-L93) | `hasHook = totalHooks > 0` (conta **todos** os `HookRequest`, de qualquer tipo) e `needsConsent = freeEligible && !hasHook` |
| Concessão admin | [admin-hooks.service.ts:281-310](../../apps/api/src/modules/admin-hooks/admin-hooks.service.ts#L281-L310) | Cria `HookRequest { type: BONUS, status: REQUESTED }` |
| Modal | [ClientLayout.tsx:75-95](../../apps/web/src/pages/client/ClientLayout.tsx#L75-L95) + [GanchoConsentModal.tsx](../../apps/web/src/components/client/GanchoConsentModal.tsx) | Gate obrigatório no mount e no evento `cdp:refresh-hook` |
| Config admin | [AdminGancho.tsx](../../apps/web/src/pages/admin/gestao/AdminGancho.tsx) | Gestão → Gancho: `pedidoUnicoMin` + `preco` |
| Cestinha | [market-checkout.service.ts:189](../../apps/api/src/modules/market/market-checkout.service.ts#L189) | `totalValue = productSubtotal + breadQty × avulsoUnit` |

### ✅ Achado importante — a concessão do admin **já** encerra o direito ao grátis

O pedido "gancho concedido pelo admin também conta como recebimento do gancho grátis" **já é o
comportamento atual e não exige código novo**. `hasHook` conta *qualquer* `HookRequest`, e o `BONUS`
do admin nasce como um `HookRequest` (`admin-hooks.service.ts:297`). Com isso, `needsConsent` vira
`false` e o modal nunca aparece. O que este plano faz é **preservar esse invariante** ao adicionar as
regras novas: elas entram todas dentro de `isFreeEligible`, que só é consultado quando o cliente não
tem nenhum gancho. Fica um caso de teste explícito na Onda C.

---

## 3. Decisões confirmadas

| # | Decisão | Detalhe |
|---|---|---|
| **D-1** | **Base da Cestinha: valor total → pães-equivalentes** | O total da Cestinha é convertido pelo preço avulso e comparado com o **mesmo** `pedidoUnicoMin`. Como `totalValue` já inclui `breadQty × avulsoUnit`, os pães da Cestinha entram automaticamente — não há regra separada para eles. |
| **D-2** | **Recorrência conta pedidos ENTREGUES** | `Order { type: SINGLE, status: DELIVERED }` + `MarketOrder { status: DELIVERED }`. Cancelado, não-entregue ou ainda em rota **não** contam. Entregas da agenda (`Order SCHEDULED`) **não** contam. |
| **D-3** | **Recorrência vale só daqui pra frente** | Um marco de data (`ganchoRecorrenciaDesde`) é gravado quando a regra é ativada; só pedidos com `deliveredAt >= marco` entram no contador. Evita um lote retroativo de ganchos elegíveis no dia da ativação. |
| **D-4** | **O número de pedidos é configurado pelo admin** | Nova config em Gestão → Gancho. Semeado como **`0` = regra desligada** — a regra só passa a valer quando o admin definir o número. |
| **D-5** | **Cestinha qualifica na compra; recorrência, na entrega** | A regra de valor da Cestinha segue o mesmo momento do avulso/combo (vale assim que o pedido é confirmado, sem esperar a entrega). A de recorrência, por definição (D-2), só avança quando a entrega é confirmada. |
| **D-6** | **Gancho grátis continua sendo 1 por cliente** | Nenhuma regra nova cria um segundo gancho. Todas entram em `isFreeEligible`, protegido por `hasHook`. |

---

## 4. Regras finais (como fica)

O cliente tem direito ao gancho grátis se **não possui nenhum gancho** E satisfaz **pelo menos uma**:

```
R1 (existente)  comprou qualquer combo                             → Payment PAID com comboId
R2 (existente)  pedido único com quantity >= pedidoUnicoMin        → Order SINGLE não-cancelado
R3 (NOVA)       Cestinha com totalValue >= pedidoUnicoMin × avulsoUnit
R4 (NOVA)       nº de pedidos entregues (SINGLE + Cestinha, desde o marco) >= recorrenciaMin
                (só avaliada quando recorrenciaMin > 0)
```

**Exemplo de R3** — `pedidoUnicoMin = 10`, `avulsoUnit = R$ 1,20` → limiar **R$ 12,00**.
Uma Cestinha de R$ 14,00 (6 pães + geleia) equivale a 11,6 pães ⇒ **elegível**.

**Inversão da conversão (nota de implementação):** comparar `creditsForPrice(totalValue, avulsoUnit)
>= pedidoUnicoMin × 1000` por pedido exigiria carregar todas as Cestinhas do cliente. A comparação
equivalente `totalValue >= pedidoUnicoMin × avulsoUnit` é feita **no banco**, com um `count`. É a
mesma matemática (`creditsForPrice` é `floor(total¢ × 1000 / unit¢)`), só que sem trazer documentos.

---

## 5. Mudanças por camada

### 5.1 Configuração (Settings)

Duas chaves novas no `Setting`:

| Chave | Tipo | Default (seed) | Significado |
|---|---|---|---|
| `ganchoRecorrenciaMin` | int ≥ 0 | `'0'` | Pedidos entregues para ganhar o gancho. **0 = regra desligada.** |
| `ganchoRecorrenciaDesde` | ISO datetime | *(não semeada)* | Marco de vigência da regra (D-3). Gravado na **primeira ativação**. |

**Arquivos:**

1. **[gancho-config.ts](../../apps/api/src/lib/gancho-config.ts)** — a interface `GanchoConfig` ganha
   `recorrenciaMin: number` e `recorrenciaDesde: Date | null`, com o mesmo parse defensivo
   (valor inválido → `0` / `null`, nunca lança). É a fonte única já compartilhada por
   admin-settings, client-hook e payments.

2. **[defaults-seed.ts](../../apps/api/src/bootstrap/defaults-seed.ts)** — upsert de
   `ganchoRecorrenciaMin` com `update: {}` (cria só se ausente), no mesmo bloco das outras chaves de
   gancho (linhas 46-61). **Não** semear `ganchoRecorrenciaDesde` — sua ausência é o sinal de
   "regra nunca foi ligada".

3. **[admin-settings.service.ts:191-203](../../apps/api/src/modules/admin-settings/admin-settings.service.ts#L191-L203)** —
   `setGanchoConfig` recebe `recorrenciaMin` e faz o upsert. Lógica do marco:

   ```
   se recorrenciaMin > 0 e a chave ganchoRecorrenciaDesde NÃO existe:
       criar ganchoRecorrenciaDesde = agora
   caso contrário: não tocar no marco
   ```

   O marco **nunca é reescrito** — desligar (0) e religar a regra depois mantém o progresso já
   acumulado pelos clientes. Reescrever zeraria o contador de todo mundo sem aviso.

4. **Validação dupla** (obrigatória — ver memória `api-dual-schema-validation`):
   - `UpdateGanchoSchema` em [admin-settings.schema.ts:106](../../apps/api/src/modules/admin-settings/admin-settings.schema.ts#L106):
     `+ recorrenciaMin: z.number().int().min(0).max(100)`
   - JSON Schema do `GET` e do `PATCH /admin/settings/gancho` em
     [admin-settings.route.ts:300-356](../../apps/api/src/modules/admin-settings/admin-settings.route.ts#L300-L356):
     `+ recorrenciaMin` no body e nos dois responses.
   > Campo novo ausente no response-schema é removido **em silêncio** pelo Fastify — a tela do admin
   > mostraria o stepper sempre em 0 sem nenhum erro visível.

### 5.2 Elegibilidade (`ClientHookService`)

**[client-hook.service.ts](../../apps/api/src/modules/client-hook/client-hook.service.ts)** — `isFreeEligible`
passa a avaliar R1..R4. Assinatura nova: recebe a `GanchoConfig` inteira em vez de só o mínimo.

```
R3 — Cestinha:
  limiar = round2(pedidoUnicoMin × avulsoUnit) − 0.005   ← tolerância de float (§7.2)
  prisma.marketOrder.count({ where: {
    userId,
    status: { notIn: ['CANCELLED', 'PENDING_PAYMENT'] },   ← D-5: confirmada, não precisa entregue
    totalValue: { gte: limiar },
  }}) > 0

R4 — Recorrência (só se recorrenciaMin > 0 && recorrenciaDesde != null):
  entregues = prisma.order.count({ where: {
                userId, type: 'SINGLE', status: 'DELIVERED',
                deliveredAt: { gte: recorrenciaDesde },
              }})
            + prisma.marketOrder.count({ where: {
                userId, status: 'DELIVERED',
                deliveredAt: { gte: recorrenciaDesde },
              }})
  entregues >= recorrenciaMin
```

O preço avulso é lido do `Setting` `avulsoUnit` por um helper privado, no mesmo padrão de
[market-orders.service.ts:41](../../apps/api/src/modules/market/market-orders.service.ts#L41)
(fallback 0 → limiar 0; nesse caso R3 é neutralizada em vez de liberar o gancho para todos:
com `avulsoUnit <= 0`, **pular R3**).

**Curto-circuito (ganho de performance, entra junto):** hoje `getStatus` calcula `freeEligible`
sempre, inclusive para quem já tem gancho — com R3/R4 isso passaria de 2 para 5 queries por chamada,
numa rota que roda **no mount de toda sessão de cliente**. Passa a valer:

```
se totalHooks > 0  →  freeEligible = false, needsConsent = false   (sem nenhuma query de elegibilidade)
```

Seguro: no front, `freeEligible` só é lido dentro de `if (!data.hasHook)`
([HookScreen.tsx:237-238](../../apps/web/src/pages/client/HookScreen.tsx#L237-L238)), e o
`ClientLayout` só usa `needsConsent`. Semanticamente, "já tem gancho" ⇒ "não tem direito ao grátis".

**Resposta do `GET /client/hook-request`** ganha 3 campos (para o app explicar o critério e mostrar
progresso), com o JSON Schema da rota atualizado junto:

| Campo | Tipo | Uso |
|---|---|---|
| `cestinhaMinValue` | number | Limiar em R$ da Cestinha (`pedidoUnicoMin × avulsoUnit`) |
| `recorrenciaMin` | integer | 0 = regra desligada (o app esconde a seção) |
| `recorrenciaProgress` | integer | Pedidos entregues já contados — permite "3 de 5 pedidos" |

> `recorrenciaProgress` é o resultado das duas counts de R4, que já são executadas; não custa query
> extra. Quando o cliente já tem gancho, os três campos vêm com o valor da config e progresso `0`.

`requestHook` ([linha 132-136](../../apps/api/src/modules/client-hook/client-hook.service.ts#L132-L136))
passa a usar a mesma `isFreeEligible` estendida — o guard de 422 continua valendo para as regras novas
sem mudança estrutural.

### 5.3 Frontend cliente

1. **[MarketDoneScreen.tsx](../../apps/web/src/pages/client/MarketDoneScreen.tsx)** — disparar
   `window.dispatchEvent(new Event('cdp:refresh-hook'))` no mount, exatamente como
   [PurchasedScreen.tsx:36-39](../../apps/web/src/pages/client/PurchasedScreen.tsx#L36-L39).
   **Sem isso a R3 fica invisível até o cliente reabrir o app** — a Cestinha tem tela de sucesso
   própria (`/client/market/sucesso`) e nunca passa pela `PurchasedScreen`.

2. **[HookScreen.tsx:237-247](../../apps/web/src/pages/client/HookScreen.tsx#L237-L247)** — o texto do
   estado "ainda não elegível" cita hoje só combo e pedido único. Passa a citar os quatro caminhos e,
   quando `recorrenciaMin > 0`, mostra o progresso (`recorrenciaProgress` de `recorrenciaMin`
   pedidos). Cópia sugerida: *"Ao comprar um combo, fazer um pedido maior, levar uma Cestinha a
   partir de R$ X — ou completar N pedidos — você recebe o gancho de porta de graça."*

3. **[GanchoConsentModal.tsx](../../apps/web/src/components/client/GanchoConsentModal.tsx)** — **sem
   mudança**. É agnóstico ao motivo da elegibilidade; o backend é a autoridade.

### 5.4 Frontend admin

**[AdminGancho.tsx](../../apps/web/src/pages/admin/gestao/AdminGancho.tsx)** (Gestão → Gancho):

- Novo `NumberStepper` **"Pedidos para o gancho por fidelidade"** (0..100, `0` = desligado),
  com subtítulo *"Pedidos entregues (avulso ou Cestinha) para o cliente ganhar o gancho. 0 desliga a
  regra."*
- Texto do topo (linhas 103-106) reescrito para incluir Cestinha e fidelidade.
- Bloco **"COMO FICA"** (linhas 170-187) passa a exibir as quatro regras, incluindo o limiar da
  Cestinha em reais — o que exige o `avulsoUnit` na tela. Duas opções: (a) `GET /admin/settings/gancho`
  passa a devolver também `avulsoUnit` (read-only, um campo a mais nos dois schemas), ou (b) a tela
  busca `/admin/settings/avulso` em paralelo. **Recomendo (a)** — uma requisição, e o cálculo do
  limiar fica no mesmo lugar em que a regra vive.
- Nota curta na UI de que **desligar e religar a regra não zera o progresso** dos clientes (§5.1).

---

## 6. Ondas de implementação

| Onda | Escopo | Entregável verificável |
|---|---|---|
| **A** | Config: `gancho-config.ts`, seed, `setGanchoConfig` + marco, Zod + JSON Schema (dupla validação) | `GET/PATCH /admin/settings/gancho` aceita e devolve `recorrenciaMin`; marco gravado só na 1ª ativação |
| **B** | R3 (Cestinha) em `isFreeEligible` + curto-circuito do `hasHook` + novos campos do response | Cliente com Cestinha acima do limiar fica `needsConsent: true` |
| **C** | R4 (Recorrência) + respeito ao marco + testes do invariante "uma vez só" (incl. `BONUS` do admin) | Contador só soma entregas após o marco; nenhum cliente com gancho fica elegível |
| **D** | Front cliente: trigger no `MarketDoneScreen`, textos e progresso no `HookScreen` | Modal aparece na hora ao fechar uma Cestinha qualificante |
| **E** | Front admin: `AdminGancho` (stepper + prévia + `avulsoUnit`) | Admin liga a regra e vê o limiar em R$ na prévia |
| **F** | Verificação manual (§8) | 12 cenários |

Ritual ao fim de cada onda (padrão do projeto, ver `status-integracao-cestinha.md`):
typecheck (shared + api + web) → build do api → testes do api → atualizar o arquivo de status →
perguntar ao usuário se continua na mesma sessão.

```bash
npm run -w @cheirin-de-pao/shared typecheck
npm run -w @cheirin-de-pao/api typecheck
npm run -w @cheirin-de-pao/web typecheck
npm run -w @cheirin-de-pao/api build
npm run -w @cheirin-de-pao/api test
```

---

## 7. Riscos e pontos de atenção

### 7.1 Custo de query numa rota quente
`GET /client/hook-request` roda no mount de toda sessão de cliente. R3+R4 acrescentam 3 counts.
**Mitigado** pelo curto-circuito do §5.2: quem já tem gancho (a maioria, com o tempo) não roda
nenhuma delas. `MarketOrder` tem `@@index([userId, createdAt])`; `Order` **não** tem índice por
`userId` — mas a regra R2 atual já faz esse count hoje, então não há regressão. **Não** criar índice
novo neste plano (ver memória `prisma-index-management`: índice declarado no schema e no
`ensure-indexes.ts` gera `Error 85` intermitente no `prisma db push`).

### 7.2 Float na comparação de `totalValue`
`MarketOrder.totalValue` é `Float`. Uma Cestinha de exatamente R$ 12,00 pode estar gravada como
`11.999999…`. Por isso o limiar leva `− 0.005` (meio centavo) — meio centavo a favor do cliente é
irrelevante para o negócio e elimina o falso negativo.

### 7.3 Documentos antigos sem `deliveredAt`
Pedidos `DELIVERED` anteriores ao campo de marcos podem não ter a chave `deliveredAt`. No Mongo,
`{ deliveredAt: { gte: marco } }` **não casa** documento sem a chave (memória
`prisma-mongo-isset-null`) — o que aqui é exatamente o comportamento desejado (D-3: pedidos antigos
não contam). Nenhum tratamento especial necessário.

### 7.4 Modal obrigatório em lote
O `GanchoConsentModal` é bloqueante (sem backdrop/ESC/dispensar). Quando a regra R4 for atingida, o
cliente recebe o modal na **próxima abertura do app** — não há push nem trigger imediato, porque a
entrega é confirmada pelo entregador, não pelo cliente. É aceitável e consistente com o fluxo atual,
mas o admin deve saber que ligar a regra com um número baixo produz uma fila de ganchos a entregar.
O marco de D-3 já limita o tamanho desse lote a zero no dia da ativação.

### 7.5 `pedidoUnicoMin` é compartilhado
Por decisão (D-1), a Cestinha usa o **mesmo** mínimo do pedido único. Mexer nele muda as duas regras
ao mesmo tempo — a prévia "COMO FICA" da tela do admin deve deixar isso explícito.

### 7.6 Reajuste do avulso move o limiar da Cestinha
O limiar de R3 é derivado de `avulsoUnit`, então um reajuste de preço eleva automaticamente o valor
mínimo da Cestinha. É o comportamento correto (o critério é "N pães", não "R$ X") e coerente com a
memória `credito-denominado-em-pao`.

---

## 8. Testes

### Backend (unitários, padrão `__tests__` existente)

**`client-hook.service.test.ts`** — o mock de `prisma` precisa ganhar `marketOrder.count` e as duas
chaves novas de `Setting`. Casos:

1. Cestinha de R$ 14 com limiar R$ 12 → `freeEligible: true`
2. Cestinha de R$ 8 com limiar R$ 12 → `false`
3. Cestinha `PENDING_PAYMENT` acima do limiar → `false` (D-5)
4. `avulsoUnit` ausente/0 → R3 pulada, sem liberar gancho indevido
5. `recorrenciaMin = 0` → R4 não avaliada (nenhuma count disparada)
6. 5 entregas com `recorrenciaMin = 5` → `true`; com 4 → `false`
7. Entregas anteriores ao marco não contam (D-3)
8. **Invariante:** cliente com `HookRequest BONUS` do admin → `hasHook: true`, `needsConsent: false`,
   `freeEligible: false` **mesmo satisfazendo R3 e R4**, e `requestHook` devolve o gancho existente
   sem criar outro
9. Curto-circuito: com `totalHooks > 0`, nenhuma query de elegibilidade é chamada

**`admin-settings.service.test.ts`** — upsert de `ganchoRecorrenciaMin`; marco gravado na primeira
ativação (`0 → 5`); marco **não** reescrito ao mudar o número (`5 → 8`) nem ao religar (`5 → 0 → 5`).

**`gancho-config`** — parse defensivo das chaves novas (ausente, vazia, texto, negativa).

### Verificação manual (12 cenários)

1. Admin liga a regra (0 → 5) · 2. Prévia mostra o limiar em R$ correto · 3. Cliente novo fecha
Cestinha acima do limiar → modal na hora · 4. …abaixo do limiar → sem modal · 5. Cliente com 4/5
entregas → sem modal, HookScreen mostra "4 de 5" · 6. 5ª entrega → modal na próxima abertura ·
7. Admin concede `BONUS` a cliente elegível por R4 → modal some · 8. Cliente com gancho entregue
compra Cestinha grande → sem modal, só o gancho pago segue disponível · 9. Admin desliga a regra
(→ 0) → a seção some do HookScreen · 10. Admin religa → progresso preservado · 11. Reajuste do
avulso → limiar da Cestinha acompanha · 12. Cestinha cancelada não conta.

---

## 9. Fora de escopo

- Segundo gancho grátis / gancho por indicação.
- Push proativo avisando "você ganhou um gancho" (hoje o canal é o modal no mount).
- Contar entregas da agenda semanal (`Order SCHEDULED`) na recorrência — descartado em D-2.
- Backfill retroativo de elegibilidade — descartado em D-3.
- Mudanças no fluxo do gancho **pago** (Pix) e na fila do admin.

---

## 10. Arquivos tocados (previsão)

**Backend (9)**
`lib/gancho-config.ts` · `bootstrap/defaults-seed.ts` · `modules/client-hook/client-hook.service.ts` ·
`modules/client-hook/client-hook.route.ts` · `modules/admin-settings/admin-settings.service.ts` ·
`admin-settings.schema.ts` · `admin-settings.route.ts` · `admin-settings.controller.ts` ·
`__tests__/` (3 arquivos)

**Frontend (3)**
`pages/client/MarketDoneScreen.tsx` · `pages/client/HookScreen.tsx` ·
`pages/admin/gestao/AdminGancho.tsx`

**Sem mudança de schema Prisma** — as duas configs novas são linhas no `Setting` (key/value), então
não há `prisma db push`, índice novo nem migração de dados.

---

## 11. Status da implementação (17/08/2026)

Todas as ondas concluídas. O que **divergiu do plano**, e por quê:

1. **Ondas B e C foram feitas juntas.** Ambas reescreviam o mesmo `isFreeEligible`; separá-las
   significaria escrever o bloco duas vezes. O método virou `evaluateFree`, que avalia R1..R4 num
   único `Promise.all` e devolve `{ eligible, recorrenciaProgress }`. Os testes seguem separados
   por regra.

2. **`recorrenciaMin` é OPCIONAL no `PATCH /admin/settings/gancho`** (não previsto no plano).
   Um PWA em cache com a versão anterior da tela não envia o campo. Com ele obrigatório, o admin
   levaria 400 e não conseguiria salvar nada; com `default 0`, desligaria a regra sem perceber.
   Omitido = **preserva o valor vigente**, e a resposta devolve `recorrenciaMin` em vigor.

3. **`GET /admin/settings/gancho` devolve também `recorrenciaDesde`** (além do `avulsoUnit` da
   opção (a) do §5.4) — a tela usa a data para explicar desde quando a fidelidade conta.

4. **O marco usa `upsert` com `update: {}`** em vez de "ler e criar se ausente": é atômico e
   idempotente, sem janela de corrida entre dois admins salvando ao mesmo tempo.

5. **`getStatus` ganhou uma query** (`avulsoUnit`), em paralelo com as demais, para o
   `cestinhaMinValue` ser correto mesmo no caminho curto-circuitado. O saldo continua favorável:
   quem já tem gancho deixou de pagar as 5 queries de elegibilidade.

### Arquivos alterados (12)

**Backend (8):** `lib/gancho-config.ts` · `bootstrap/defaults-seed.ts` ·
`modules/client-hook/client-hook.service.ts` · `modules/client-hook/client-hook.route.ts` ·
`modules/admin-settings/admin-settings.service.ts` · `admin-settings.schema.ts` ·
`admin-settings.route.ts` · `admin-settings.controller.ts`

**Testes (2):** `client-hook/__tests__/client-hook.service.test.ts` (11 → 25) ·
`admin-settings/__tests__/admin-settings.service.test.ts` (21 → 26)

**Frontend (3):** `pages/client/MarketDoneScreen.tsx` · `pages/client/HookScreen.tsx` ·
`pages/admin/gestao/AdminGancho.tsx`

### Como ligar em produção

O seed cria `ganchoRecorrenciaMin = 0` no boot — **nada muda sozinho**. A regra da Cestinha (R3)
passa a valer no deploy (deriva de configs que já existem); a de fidelidade só quando o admin
definir o número em **Gestão → Gancho**, e a contagem começa naquele instante.

### Pendente

Apenas a **verificação manual** (§8, 12 cenários) e a decisão de commit/deploy.
