# STATUS — Créditos fracionados (Ondas 0..F)

> 🚧 **EM ANDAMENTO.** Leia este arquivo antes de mexer em qualquer conta de crédito
> (pãezinhos). O §4 guarda, onda por onda, os arquivos tocados e as **decisões** que não são
> óbvias no código. Para abrir uma sessão nova, use o prompt do §6.
>
> **Última atualização:** 31/07/2026 — 🎉 **TODAS as ondas concluídas** (0, A, B, C, D, E, F) +
> as 2 correções do teste manual (§4-bis) + a **F-limpeza** (§4-quater). Nenhuma pendência aberta.
> **Etapa atual:** ✅ nada a implementar. Resta **verificação manual** (§5) e a decisão de
> commit/deploy — que depende de autorização explícita do usuário.
> ⚠️ **Antes de deployar:** ler o §4-quater ("ordem de deploy") — a produção precisa ter rodado o
> backfill corrigido ao menos uma vez.
> **Piso de testes:** api **610 + 3 todo** · web **118 + 17 todo** · shared **38 + 4 todo**.
> **Branch:** `development` · **sem commit** (aguardando autorização explícita).

---

## 0. Como retomar (leia nesta ordem)

1. **Este arquivo** — estado atual, o que já foi feito, próximo passo exato.
2. `packages/shared/src/credits.ts` — a aritmética de crédito e o **porquê** de tudo ser em
   centavos inteiros. É a fonte única (front + API).
3. Contexto da feature em volta: [`status-integracao-cestinha.md`](./status-integracao-cestinha.md)
   e [`status-implementacao-alem-do-paozin.md`](./status-implementacao-alem-do-paozin.md).

---

## 1. Regras invioláveis

- ❌ **NÃO** commitar nem pushar sem autorização **explícita** do usuário, pedida **a cada vez**.
  "Funcionou", "perfeito" ou "pode seguir" **não** contam como autorização de commit.
- ✅ Implementação **DIRETA** (sem GSD, autorizado pelo usuário em 31/07/2026).
- ✅ **Os testes são o piso** — sempre verdes ao fim de cada onda (números no cabeçalho).
- ✅ **Validação dupla:** rota tocada = atualizar JSON Schema (`*.route.ts`) **E** Zod
  (`*.schema.ts`). Campo de crédito declarado `type: 'integer'` é **arredondado em silêncio**
  pelo serializador do Fastify — é o risco nº 1 da Onda E.
- ✅ **Nunca** converter campo `Int` existente para `Float` no Prisma + MongoDB: a leitura de um
  `int32` gravado num campo declarado `Float` estoura ("Inconsistent column data"). Campo novo
  com nome novo, sempre.
- ✅ Toda conta de crédito passa por `packages/shared/src/credits.ts`. Nada de
  `valor / avulsoUnit` solto no código.

### Ritual obrigatório ao fim de CADA onda (nesta ordem)

1. Rodar **typecheck** (shared + api + web) + **testes** dos três.
2. **ATUALIZAR ESTE ARQUIVO**: mover a onda para concluída com arquivos tocados e decisões,
   atualizar "Última atualização", "Etapa atual", o piso de testes e o §6.
3. **PERGUNTAR AO USUÁRIO** se ele quer continuar **nesta mesma sessão** ou **em outra**.
   - Outra sessão → entregar no chat o **PROMPT DE CONTINUAÇÃO** (§6), pronto para copiar.

---

## 2. Comandos de verificação

```bash
# typecheck dos três pacotes:
npx turbo run typecheck --filter=@cheirin-de-pao/shared --filter=@cheirin-de-pao/web --filter=@cheirin-de-pao/api

# testes dos três:
npx turbo run test

# só a aritmética de crédito:
cd packages/shared && npx vitest run src/__tests__/credits.test.ts

# regenerar Prisma Client depois de mudar o schema (Onda A):
DATABASE_URL="mongodb://localhost:27017/cheirin" npx prisma generate --schema=apps/api/prisma/schema.prisma
```

---

## 3. O problema e as decisões (31/07/2026)

### Diagnóstico

Crédito inteiro valendo `avulsoUnit` (R$ 1,20) quantiza grosso demais para item barato. Um
produto de R$ 1,80 exibia **"2 🥖"** (`Math.round`) = R$ 2,00–2,30 de custo real → **mais caro
que pagar em dinheiro**, matando a economia anunciada do combo. Pior: o backend sempre aplicou
`floor` (1 🥖 + R$ 0,60), então a vitrine prometia um pagamento que a API nunca aceitava.

Limiar geral: com crédito **inteiro**, a promessa só sobrevive acima de
`0,5 × avulso / economia` — 4% → R$ 15,00 · 8% → R$ 7,50 · 17% → R$ 3,53. Ou seja: **todo item
abaixo de ~R$ 15 quebra** para o combo mais fraco. É estrutural, não caso de borda.

### Decisões confirmadas — **não reabrir sem motivo novo**

| # | Decisão |
|---|---|
| **D-1** | Saldo em **milésimos de pãozinho** (1 pão = 1000), em campo **Int** novo. Nunca `Float`. |
| **D-2** | Campos novos: `User.creditMilli`, `CreditTransaction.quantityMilli`, `MarketOrder.creditsAppliedMilli`. Legados ficam em escrita dupla e só saem no fim. |
| **D-3** | Exibição em **decimal** ("1,5 🥖", 1 casa). Sem "resto em dinheiro" na UI depois da Onda C. |
| **D-4** | Saldo mostra a fração; "dá pra N dias" e a elegibilidade de entrega usam a **parte inteira** (`floor`). |
| **D-5** | Débito arredondado **para baixo** (a favor do cliente). Erro máximo R$ 0,002. |
| **D-6** | Backfill ×1000 em script idempotente. Semântica única, sem conviver com duas. |
| **D-7** | Poeira (< 1 pão) **acumula**, sem regra especial de perdão. |
| **D-8** | API expõe **decimal** de pãezinhos; o banco guarda mili. O front só formata e compara — nunca acumula. |
| **D-9** | Pão continua **inteiro**: 1 pão = 1000 mili, sempre. Fração só nasce na Cestinha. |
| **D-10** | Crédito é denominado em **PÃO**, não em R$ congelado: reajuste do avulso valoriza o crédito já comprado. **Decisão explícita do usuário:** quem comprou antes se mantém assim. Guard-rail de piso no `avulsoUnit` e "passivo a valor de reposição" foram **DESCARTADOS** — não são bug, não reimplementar. |

---

## 4. Progresso

### ✅ Onda 0 — Vitrine × cobrança alinhadas + float — CONCLUÍDA (31/07/2026)

> Deployável sozinha, sem migração e sem mudança de contrato. Desbloqueia o cadastro de produto
> a R$ 1,80/1,90 sem a tela mentir, e corrige um **bug real de ponto flutuante** que já estava
> em produção.
> Verificação: typecheck shared+api+web ✅ · api **568 + 3 todo** ✅ · web **116 + 17 todo** ✅ ·
> shared **34 + 4 todo** ✅

| # | Tarefa | Estado |
|---|---|---|
| 0.1 | `packages/shared/src/credits.ts` — aritmética única em centavos inteiros | ✅ |
| 0.2 | Vitrine passa a mostrar o split real ("1 pão + R$ 0,60"), não `round` para cima | ✅ |
| 0.3 | Selo `−X%` passa a mostrar a economia **efetiva** do item, não o % cheio do combo | ✅ |
| 0.4 | Aviso do formulário de produto (admin) com o custo real por combo | ✅ |
| 0.5 | `floor`/`ceil` de crédito à prova de float no backend e no front | ✅ |

**O bug de float (achado nesta onda, não era teórico):** `Math.floor(3.30 / 1.10)` devolve **2**
em ponto flutuante (o quociente sai `2.9999999999999996`) — o cliente **perdia um pãozinho
inteiro** e pagava a diferença em dinheiro. Varredura até 300 pães: avulso R$ 1,10 falha em 149
casos, R$ 1,35 em 117, R$ 1,30 em **62** (o 1º em R$ 9,10), R$ 0,90 em 47. **R$ 1,20 passa por
sorte do binário** — ou seja, o bug estava latente e apareceria no primeiro reajuste do avulso.
Mesma classe no estorno (`Math.ceil`), que soltava um pãozinho a mais. Corrigido com aritmética
em centavos inteiros; teste de regressão varre 13 valores de avulso × 300 múltiplos.

**Arquivos tocados:**

*Novos:*
- `packages/shared/src/credits.ts` — `toCents`, `fromCents`, `splitEmPaezinhos`,
  `paezinhosParaEstorno`, `economiaEfetiva`, `custoComPaezinhos`. **É a fonte única.**
- `packages/shared/src/__tests__/credits.test.ts` — 25 testes.
- `apps/api/src/lib/__tests__/market-reversal.test.ts` — 5 testes de `refundableCredits`.

*Shared:*
- `packages/shared/src/index.ts` — re-export de `./credits`.

*Backend:*
- `market-checkout.service.ts` — `maxCredits` via `splitEmPaezinhos`; `moneyAmount` em centavos.
- `market-reversal.ts` — `refundableCredits` usa `paezinhosParaEstorno`.

*Frontend:*
- `lib/market.ts` — `paezinhosDe` (que arredondava para cima) **removido**; entrou
  `labelPaezinhos(split)`. A remoção foi de propósito: o compilador apontou os 4 call sites.
- `ProdCard.tsx`, `MarketMiniCard.tsx`, `BreadCard.tsx`, `ProductDetail.tsx` — split real + selo
  com economia efetiva.
- `MarketCheckoutScreen.tsx` — `maxApplicable` e `creditValue` em centavos.
- `admin/gestao/MarketProductForm.tsx` — aviso com o custo real por combo + linha explicando o
  resto em dinheiro ("um preço múltiplo de R$ 1,20 é pago 100% com pãezinhos").

**Efeito visível:** produto a R$ 1,80 com avulso R$ 1,20 → vitrine mostra "🥖 1 pão + R$ 0,60"
e selo −11% (Fornão), em vez de "🥖 2 pães · −17%". O aviso do admin mostra R$ 1,60 (Fornão) a
R$ 1,75 (Fornin) — sempre **abaixo** dos R$ 1,80 em dinheiro.

---

### ✅ Onda A — Fundação do mili-pão — CONCLUÍDA (31/07/2026)

> Só fundação: nenhum comportamento mudou ainda. Os campos novos existem e estão vazios, os
> helpers existem e ainda não são chamados em produção. **Deployável sem efeito visível.**
> Verificação: typecheck shared+api+web ✅ · build api ✅ · api **568 + 3 todo** ✅ ·
> web **116 + 17 todo** ✅ · shared **47 + 4 todo** ✅ (+13)

| # | Tarefa | Estado |
|---|---|---|
| A1 | Helpers do mili-pão em `packages/shared/src/credits.ts` | ✅ |
| A2 | 3 campos novos no Prisma, **nullable** (não `@default`) | ✅ |
| A3 | `backfill-credit-milli.ts` + `npm run -w @cheirin-de-pao/api migrate:credit-milli` | ✅ |
| A4 | Testes de tabela fixando a promessa do combo | ✅ |

**Decisão nova (A2) — os campos são `Int?`, não `Int @default(0)`.** No MongoDB o `@default` do
Prisma **só vale na criação**: documento gravado antes do campo lê `null`, e um campo declarado
não-nullable estoura a leitura. O schema já registrava essa lição em `Combo.showEconomy`. Efeito
colateral bom: `null` distingue "ainda não migrado", e é isso que permite escrita dupla e
backfill em **qualquer ordem**, sem janela em que o saldo apareça como zero.

**Decisão nova (A1) — `milliOrLegacy(milli, legacyWhole)`.** Toda leitura de crédito passa por
ela: devolve o canônico quando existe e `legado × 1000` quando é `null`. Com isso o backfill
deixa de ser pré-requisito de deploy — vira só housekeeping. Cuidado: `milliOrLegacy(0, 45)`
devolve **0** (saldo zerado de verdade não pode virar 45); o fallback é só para `null`/`undefined`.

**Arquivos tocados:**

*Novos:*
- `apps/api/src/scripts/backfill-credit-milli.ts` — ×1000 em `User`, `CreditTransaction` (em
  lotes de 500) e `MarketOrder`; só escreve onde o canônico é `null`; no fim confere
  `Σ creditMilli == Σ creditBalance × 1000` e avisa se divergir.

*Shared:*
- `credits.ts` — `CREDIT_SCALE = 1000`, `toMilli`, `fromMilli`, `wholeBreads`,
  `creditsForPrice`, `moneyForCredits`, `formatCredits`, `milliOrLegacy`.
- `__tests__/credits.test.ts` — +13 testes, incluindo a matriz **7 preços × 3 combos reais**
  (Fornão/Fornalha/Fornin) provando `economia real ≥ economia anunciada − 0,1 pp` **e**
  `custo < preço em dinheiro` em todos os 21 casos.

*Backend:*
- `prisma/schema.prisma` — `User.creditMilli`, `CreditTransaction.quantityMilli`,
  `MarketOrder.creditsAppliedMilli` (todos `Int?`, com comentário do porquê).
- `package.json` — script `migrate:credit-milli`.

**Deploy:** nada manual. Campo opcional no MongoDB não exige `db push` (só índice exigiria), e
**nenhum índice novo entrou** — sem risco do `Error 85` da briga `db push` × `ensure-indexes.ts`.
O backfill é opcional (ver `milliOrLegacy`) e pode rodar depois, a qualquer momento.

**Números de referência** (avulso R$ 1,20): `creditsForPrice(1.80) = 1500` (1,5 🥖) ·
`creditsForPrice(1.90) = 1583` (exibido "1,6") · Fornin paga o item de R$ 1,80 por R$ 1,725
(4,2% de economia, acima dos 4% anunciados) contra R$ 2,30 no modelo inteiro.

### ✅ Onda B — Escrita dupla no backend + backfill no boot — CONCLUÍDA (31/07/2026)

> Ainda **sem mudança de comportamento visível**: enquanto um pão custa 1000 mili, os dois
> campos andam juntos. O que esta onda entrega é a garantia de que, quando a Onda C ligar o
> débito fracionado, o campo canônico já estará correto para todo mundo.
> Verificação: typecheck shared+api+web ✅ · build api ✅ · api **575 + 3 todo** ✅ (+7) ·
> web **116 + 17 todo** ✅ · shared **47 + 4 todo** ✅

**Decisão nova (B0) — o backfill roda no BOOT, não só por comando.** É a correção de um furo do
plano original: a escrita dupla usa `$inc` nos dois campos, e `$inc` num campo **ausente** no
MongoDB **cria** o campo com o valor do incremento. Um cliente com 45 pãezinhos que comprasse 30
antes do backfill ficaria com `creditMilli = 30000` em vez de 75000 — e o backfill posterior
**não** corrigiria, porque só preenche o que está null. Rodando no boot (antes de servir
tráfego, guard de execução única via `Setting.creditMilliBackfilledAt`, no mesmo molde do
`backfillSupplierProductsIfNeeded`), a janela deixa de existir. Falha no backfill não derruba o
boot e não grava a flag → tenta de novo no próximo restart.

**Decisão nova (B6) — as réguas de "tem crédito?" passaram a perguntar em PÃES INTEIROS**
(`wholeBreads(milliOrLegacy(...))`), não em `saldo > 0`. Antes da Onda C isso é um no-op (canônico
== legado × 1000); depois, é a semântica certa: 0,6 🥖 de poeira não entrega pão nenhum, então não
pode contar como "tem crédito" na operação nem no aviso de saldo baixo.

**Arquivos tocados:**

*Novos:*
- `apps/api/src/bootstrap/credit-milli-backfill.ts` — `runCreditMilliBackfill` (lotes de 500 nos
  3 modelos + as duas somas de conferência) e `backfillCreditMilliIfNeeded` (guard de flag).
- `apps/api/src/bootstrap/__tests__/credit-milli-backfill.test.ts` — 7 testes: ×1000 nos 3
  campos, sinal negativo preservado no extrato, idempotência, guard da flag, aviso de
  divergência e "falha não derruba o boot nem grava a flag".

*Escrita dupla (saldo + extrato), 11 arquivos:*
- `payments.repository.ts` (compra de crédito) · `orders.service.ts` (débito do pedido único +
  estorno do cancelamento) · `schedules.service.ts` e `schedules.repository.ts` (débito da agenda
  no corte) · `admin-clients.service.ts` (ADMIN_GRANT, ADMIN_DEBIT, cancelamento) ·
  `admin-orders.service.ts` (`refundOrder` e `resolveStuckOrder`) · `admin-payments.service.ts`
  (estorno do gateway) · `market-checkout.service.ts` (débito da Cestinha, `creditsAppliedMilli`
  no pedido e devolução no `releaseOrder`) · `market-reversal.ts` · `admin-market.service.ts`
  (resolver perda).
- `market-checkout.releaseOrder` devolve por `milliOrLegacy(order.creditsAppliedMilli,
  order.creditsApplied)` — pedido anterior ao campo lê null e precisa devolver o inteiro × 1000.

*Leituras que passaram a usar `wholeBreads(milliOrLegacy(...))`:*
- `credits.service.ts` (`checkBalance`) · `orders.service.ts` (saldo insuficiente) ·
  `schedules.service.ts` (saldo do corte, saldo após recarga e o aviso de crédito baixo) ·
  `admin-reports.service.ts` (clientes sem crédito / em risco) ·
  `admin-supplier-orders.service.ts` (flag `no-credit` da parada).
- `schedules.repository.findUserById`, `admin-reports` e `admin-supplier-orders` passaram a
  selecionar `creditMilli` (sem isso a leitura cai no fallback e o campo novo seria ignorado).

*Criação de usuário com o campo já presente:* `auth.repository.ts` (CLIENT),
`admin-couriers.service.ts` e `admin-couriers.repository.ts` (COURIER).

*Testes ajustados* (passaram a fixar a escrita dupla): `admin-clients.service.test.ts`,
`admin-orders-ledger.service.test.ts`, `orders.service.test.ts`, `resolve-loss.service.test.ts`.

**O que NÃO mudou de propósito:** o `creditBalance` legado continua sendo o valor exibido ao
cliente e ao admin (as respostas de API seguem inteiras) e o passivo/financeiro continua lendo os
campos legados. Isso é Onda E — trocar antes exigiria mexer nos JSON Schemas no meio de uma onda
que não tem verificação visual.

### ✅ Onda C — Checkout e estorno fracionados — CONCLUÍDA (31/07/2026)

> O backend já aceita e devolve pãezinhos fracionados. **Ponta a ponta ainda não muda nada**: o
> front continua sugerindo pãezinhos inteiros, e o servidor clampa por saldo e custo — então o
> comportamento segue idêntico até a Onda D. Isso é de propósito: C e D são deployáveis separadas.
> Verificação: typecheck shared+api+web ✅ · build api ✅ · api **583 + 3 todo** ✅ (+8) ·
> web **116 + 17 todo** ✅ · shared **47 + 4 todo** ✅

| # | Tarefa | Estado |
|---|---|---|
| C1 | Split do checkout em milésimos (`creditsForPrice`) — dinheiro chega a R$ 0,00 em qualquer preço | ✅ |
| C2 | Estorno da Cestinha em milésimos (`refundableCreditsMilli`) nos 3 caminhos | ✅ |
| C3 | Zod aceita decimal; API responde decimal | ✅ |
| C4 | Testes do estorno fracionado (+8) | ✅ |

**Como ficou o split** (`market-checkout.service.ts`): `maxCreditsMilli = creditsForPrice(total,
avulsoUnit)` cobre **100%** do valor; `creditsMilli = min(sugestão do cliente, saldo, custo)`;
`moneyAmount = round2(total − moneyForCredits(creditsMilli, avulsoUnit))` → **0,00** quando o
crédito cobre tudo. Um item de R$ 1,80 com avulso R$ 1,20 passa a ser pago com 1,5 🥖 e **zero**
de Pix.

**Decisão (C2) — REVERTIDA em 31/07/2026, ver §4-bis.** Eu havia mantido o estorno da parte em
dinheiro arredondado para cima em pãezinhos inteiros ("generosidade" da DEC-36). O usuário apontou
que isso é uma **brecha de dinheiro** — e está certo. Hoje o estorno é **proporcional** nas duas
pontas.

**Decisão nova (C1/C2) — o gate de "tem crédito para devolver?" é no MILÉSIMO, nunca no espelho
legado.** Um pedido de 0,4 🥖 arredonda para `creditsApplied = 0`, e um `if (order.creditsApplied
> 0)` engoliria a devolução inteira. Vale para `releaseOrder`, `reverseMarketOrder` e
`resolveNotDelivered` — os três têm teste de regressão.

**O espelho legado `creditsApplied` passou a ser `Math.round` do canônico** e é **só
exibição/histórico**: nenhuma conta lê ele. Consequência esperada: a partir daqui
`Σ creditBalance × 1000 ≠ Σ creditMilli`, e o backfill avisa isso no log (é normal, não é furo).

**Arquivos tocados:**

*Shared:*
- `schemas/market.ts` — `creditsApplied` deixou de ser `.int()`. As rotas do market **não têm
  response-schema** (só tags/summary), então aqui não há o risco de truncamento do Fastify — ele
  vale para as rotas admin, na Onda E.

*Backend:*
- `market-checkout.service.ts` — split fracionado, `createOrderTx` recebe `creditsMilli`
  (canônico) além do espelho legado, saldo re-checado em milésimos dentro da transação,
  `releaseOrder` com gate no milésimo e `buildResult` devolvendo decimal.
- `market-reversal.ts` — `refundableCreditsMilli` (novo, canônico) + `refundableCredits` (decimal,
  para a UI); `reverseMarketOrder` grava legado arredondado + canônico exato.
- `admin-market.service.ts` — `resolveNotDelivered` em milésimos; a lista de Cestinhas passa a
  somar estorno pelo canônico.
- `market-orders.service.ts` — Cestinhas do cliente com `creditsApplied` decimal; estornos somados
  em milésimos e convertidos só no fim (somar decimais acumularia erro de float).
- `market-notify.ts` — `paesLabel` formata via `formatCredits`, senão o push sairia com "1.5
  pãezinhos" em vez de "1,5".

*Testes:* `market-reversal.test.ts` (+5: exato, ignora o legado, fallback, política DEC-36 da parte
em dinheiro, fração que arredonda para 0) · `market-sweep.service.test.ts` (+3: devolução exata,
fração não engolida, pedido legado).

### ✅ Onda D — Front do cliente (o fracionado LIGADO) — CONCLUÍDA (31/07/2026)

> A partir desta onda o cliente **vê e usa** o crédito fracionado: um item de R$ 1,80 mostra
> "🥖 1,5 pães · −17%" e é pago **100% com pãezinhos**, sem Pix de R$ 0,60.
> Verificação: typecheck shared+api+web ✅ · build api ✅ · build web ✅ · api **583 + 3 todo** ✅ ·
> web **118 + 17 todo** ✅ (+2) · shared **41 + 4 todo** ✅

| # | Tarefa | Estado |
|---|---|---|
| D0 | Backend: saldo do cliente exposto em pãezinhos decimais | ✅ |
| D1 | `shared`: modelo INTEIRO removido (não convivem dois modelos) | ✅ |
| D2 | Cards + ProductDetail + form do admin em pãezinhos decimais | ✅ |
| D3 | `MarketCheckoutScreen` em milésimos → 100% pãezinhos | ✅ |
| D4 | Saldo com fração; réguas de entrega em pães inteiros | ✅ |
| D5 | Extrato, resumo do pedido e cartões de Cestinha | ✅ |

**Decisão nova (D0) — o saldo passou a ser exposto em DECIMAL, e isso teve de entrar aqui, não na
Onda E.** Sem isso o cliente veria o espelho legado arredondado: quem gastasse 1,5 🥖 de um saldo
de 45 veria **43** (legado) em vez de **43,5** (real) — e ficaria devendo meio pãozinho na conta
dele. Endpoints trocados: `GET/PATCH /client/profile`, confirmação de pagamento,
`POST /orders/:id/cancel` e `GET /credits/history`.

**Achado — havia um `type: 'integer'` client-facing.** `GET /credits/history` declarava
`quantity: { type: 'integer' }`, e o `fast-json-stringify` truncaria `-1,5` para `-1` **em
silêncio**: o extrato não fecharia com o saldo. Corrigido junto com `orders.route.ts`. Os demais
`integer` de crédito são todos de rotas ADMIN → Onda E.

**Decisão nova (D1) — o modelo inteiro foi REMOVIDO do `shared`,** não deixado ao lado do novo:
saíram `splitEmPaezinhos`, `economiaEfetiva` e o tipo `CreditSplit`. Dois modelos de crédito
convivendo é a receita para alguém voltar a somar "crédito inteiro + resto em dinheiro" seis meses
depois. O compilador apontou os 6 call sites. A guarda de float da Onda 0 foi reescrita sobre
`creditsForPrice` (13 avulsos × 300 múltiplos), então a cobertura não caiu.

**Decisão nova (D4) — a fração aparece no saldo, mas NUNCA nas réguas de entrega.** O card mostra
"43,5 🥖" (honesto); já "rende ~N dias", "cobre N semanas", saldo insuficiente e o pedido único
usam `wholeBreadsOf()` — meio pãozinho de poeira não entrega pão nenhum, e prometer o contrário
seria pior que esconder a fração. Entrou `wholeBreadsOf(credits)` no `shared` para isso (atalho de
`wholeBreads(toMilli(...))`, que passa pelos milésimos para um `43.999999` do JSON não virar 43).

**Formatação:** todo texto com pãezinhos passa por `formatCredits` — sem isso o React imprimiria
`1.5` (ponto) em vez de `1,5`. Vale para vitrine, checkout, extrato, resumo, cartões e os pushes
(que já foram na Onda C).

**Arquivos tocados:**

*Backend:* `client-profile.service.ts` + `.repository.ts` · `payments.service.ts` ·
`orders.service.ts` + `orders.route.ts` (`integer` → `number`) · `credits.service.ts`
(extrato decimal) + `credits.route.ts` (`integer` → `number`).

*Shared:* `credits.ts` — removidos `splitEmPaezinhos`/`economiaEfetiva`/`CreditSplit`, adicionado
`wholeBreadsOf`, `custoComPaezinhos` agora usa `creditsForPrice`. `__tests__/credits.test.ts`
reescrito na parte afetada.

*Frontend:* `lib/market.ts` (`labelPaezinhos(milli)`) · `ProdCard` · `MarketMiniCard` ·
`BreadCard` · `ProductDetail` · `MarketCheckoutScreen` (milésimos ponta a ponta) ·
`CreditBalanceCard` (anima em milésimos) · `HomeScreen` · `useSchedule` (+ teste) ·
`SingleScreen` (pães inteiros) · `MarketDoneScreen` · `MarketOrderCard` ·
`CreditHistoryScreen` · `admin/gestao/MarketProductForm`.

**O selo de economia voltou a ser o % CHEIO do combo.** Na Onda 0 ele mostrava a economia
diluída pelo resto em dinheiro (−11% num combo de 17%); agora o crédito cobre 100% do preço,
então o % anunciado é o % entregue — que era o objetivo de todo o trabalho.

### ✅ Onda E — Admin, relatórios e contratos — CONCLUÍDA (31/07/2026)

> Fecha o outro lado: o admin passa a ver os mesmos números que o cliente. Nenhuma leitura de
> crédito exposta lê mais o campo legado.
> Verificação: typecheck shared+api+web ✅ · build api ✅ · build web ✅ · api **583 + 3 todo** ✅ ·
> web **118 + 17 todo** ✅ · shared **41 + 4 todo** ✅

| # | Tarefa | Estado |
|---|---|---|
| E1 | 14 campos de crédito nas rotas admin: `integer` → `number` | ✅ |
| E2 | `admin-clients`: lista, detalhe, grant/remove, extrato e ledger | ✅ |
| E3 | `admin-orders` + `admin-market`: ledger de Cestinha e estornos | ✅ |
| E4 | Relatórios: passivo, retenção e financeiro somando em milésimos | ✅ |
| E5 | Front admin: listas, sheets, extrato e relatórios formatados | ✅ |

**A armadilha do `type: 'integer'` era real e estava em 14 campos.** `creditBalance`,
`creditsApplied`, `refundedCredits`, o `quantity` do extrato e o `credits` do financeiro — todos
declarados `integer` em `admin-clients.route.ts`, `admin-orders.route.ts` e
`admin-financial.route.ts`. O `fast-json-stringify` truncaria 43,5 → 43 **sem erro nenhum**.
Ficou `integer` só onde o valor é inteiro por natureza: `quantity` de `Order` (pão inteiro),
`quantity` de `Combo`, os *bodies* de grant/remove (o admin concede inteiro) e o
`refundedCredits` de `POST /orders/:id/cancel` — este último com comentário explicando o porquê,
para ninguém "corrigir" depois.

**Decisão nova (E2) — o filtro "sem crédito" virou "não dá nem um pão"** (`creditMilli < 1000`),
em vez de `creditBalance <= 0`. Com saldo fracionado, um cliente com 0,6 🥖 tem saldo mas não
recebe pão nenhum: a régua operacional é a que importa para o admin. A ordenação por saldo também
passou para o canônico.

**Decisão nova (E4) — todo agregado de crédito soma em MILÉSIMOS e converte no fim.** Vale para o
passivo (`Σ creditMilli`), créditos vendidos/consumidos e o `credits` do financeiro
(`Σ creditsAppliedMilli`). Somar os campos legados somaria arredondamentos: com centenas de
Cestinhas fracionadas, o fechamento sairia alguns pãezinhos fora — o tipo de erro que ninguém
rastreia depois.

**No front admin, remover crédito continua em pães INTEIROS** (`wholeBreadsOf` no teto do input e
nas validações): o admin não tem por que digitar 43,5, e o saldo exibido segue mostrando a fração.

**Arquivos tocados:**

*Contratos:* `admin-clients.route.ts` (8 campos) · `admin-orders.route.ts` (5) ·
`admin-financial.route.ts` (1) · `orders.route.ts` (comentário do `integer` intencional).

*Backend:* `admin-clients.service.ts` (lista, filtro/ordenação canônicos, detalhe, grant/remove,
extrato, ledger) · `admin-orders.service.ts` (`_marketLedgerSelect` + 3 retornos de estorno) ·
`admin-market.service.ts` (4 selects de saldo, 4 retornos, lista de Cestinhas) ·
`admin-reports.service.ts` (passivo + vendidos/consumidos) · `admin-financial.service.ts`
(`credits`) · `admin-payments.service.ts` (débito do estorno em pães inteiros).

*Frontend admin:* `AdminClientes` (coluna + CSV) · `ClientDetailView` (saldo, modais, extrato ×2,
toast, timeline) · `MarketCestinhas` · `OrderDetailSheet` · `RelShared` (novo `fmtCredits`) ·
`RelPassivo` · `RelRetencao` · `AdminFinanceiro`.

*Testes ajustados:* `admin-financial.service.test.ts` e `admin-reports.market.service.test.ts` —
os mocks agora devolvem `creditsAppliedMilli`/`quantityMilli`, como o Prisma devolveria.

**Auditoria final:** varredura por `type: 'integer'` em campo de crédito → só o caso intencional;
varredura por leitura de saldo legado exposta → nenhuma (fora do próprio backfill, que compara os
dois campos de propósito).

> ⚠️ **Errata (17/08/2026) — a varredura acima passou por cima de um caso.** Ela procurou por
> *leituras* de `creditBalance`, e o `GET /admin/clients/:id` não lia o campo: ele **espalhava o
> documento cru** (`...result.client` no controller, sobre um `findUnique` sem `select`), e o
> espelho legado entrava na resposta pela porta dos fundos — o response schema da rota declara
> `creditBalance` e deixou passar. Sintoma: o mesmo cliente com **0 crédito na lista e 6 pães no
> detalhe**; e, do outro lado, cliente novo com saldo real aparecendo **zerado** no detalhe
> (`creditBalance` nunca sai do default 0 para quem entrou depois da limpeza).
>
> Corrigido derivando o canônico no `getDetail` (+6 testes de regressão em
> `admin-clients.credit-decimal.service.test.ts`). A blindagem contra a recaída é o **rename do
> campo Prisma para `creditBalanceLegacy` com `@map("creditBalance")`**: o banco não muda, mas
> nenhum spread acidental volta a produzir a chave `creditBalance`, e o allowlist da rota passa a
> descartá-la sozinho. Lição para varreduras futuras: procurar por *spread de documento do Prisma*
> em resposta, não só por leitura nominal do campo.
>
> Conferência de dados (banco de teste, 8 clientes): 7 fecham extrato = saldo ao centavo; o único
> divergente carrega um resíduo de reset manual de junho. **Nenhum reparo de saldo foi necessário
> — o defeito era só de exibição.**

### ✅ Onda F (testes) — CONCLUÍDA (31/07/2026) · ⏳ F-limpeza pendente

> Verificação: typecheck shared+api+web ✅ · api **610 + 3 todo** ✅ (+19) · web **118 + 17 todo** ✅ ·
> shared **39 + 4 todo** ✅

| # | Tarefa | Estado |
|---|---|---|
| F1 | Poeira não entrega pão (`checkBalance` com saldo fracionado) | ✅ +5 |
| F2 | Admin: saldo, extrato, grant/remove decimais atravessam sem arredondar | ✅ +11 |
| F3 | Admin: ledger de Cestinha com crédito fracionado | ✅ +3 |
| F-limpeza | Legado fora do runtime (escrita dupla, `milliOrLegacy`, selects) | ✅ §4-quater |

**O teste que fecha o extrato com o saldo** (`admin-clients.credit-decimal.service.test.ts`): soma
os movimentos do extrato e compara com o saldo da lista — 45 − 1,5 = **43,5**. Com os campos
legados daria 45 − 2 = 43. É o teste que pega qualquer superfície do admin que volte a ler o
espelho arredondado.

**Também fixado:** `breadQty` da Cestinha continua **inteiro** no ledger — o crédito fracionado não
pode vazar para a quantidade de pães, que é o número que a operação separa.

**A F-limpeza foi feita** depois de confirmar cobertura 0 na base (§4-quater). Os três campos
legados seguem no schema como fonte do backfill do boot — a "última faxina" (tirá-los de vez) só
depende de confirmar cobertura 0 em **produção**.

---

## 4-quater. ✅ F-limpeza — o legado saiu do runtime (31/07/2026)

Autorizada pelo usuário depois de confirmar a **cobertura do canônico** na base: `0 pendentes` em
10 usuários, 128 movimentos e 14 Cestinhas.

**O que saiu:**
- **Escrita dupla:** nenhum caminho grava mais `creditBalance`, `CreditTransaction.quantity` ou
  `MarketOrder.creditsApplied`. Só o canônico (`creditMilli`, `quantityMilli`,
  `creditsAppliedMilli`) é escrito, nos ~15 sites de saldo/extrato.
- **`milliOrLegacy`:** removida do `shared` e substituída por leitura direta (`x ?? 0`) nas 40
  chamadas. Enquanto existisse, alguém a chamaria de novo e o legado voltaria por osmose.
- **Selects:** os campos legados saíram de todos os `select` de runtime.
- **Espelho no checkout:** `const creditsApplied = Math.round(...)` era código morto depois da
  remoção da escrita — saiu junto com o parâmetro de `createOrderTx`.

**O que FICOU, de propósito:** os três campos legados seguem **declarados no schema** e são a
**fonte do backfill do boot**. `CreditTransaction.quantity` virou `Int?` (linha nova não o grava).
Nada em runtime lê nem escreve — os comentários no schema dizem isso em cada campo.

⚠️ **Ordem de deploy (importa):** este código lê **só** `creditMilli`. Num ambiente em que o
backfill corrigido (§4-bis) ainda não rodou, saldo de documento não migrado lê `null → 0`. A
cobertura foi verificada **nesta base**; a produção usa `DATABASE_URL_PROD` e **não foi verificada**.
O backfill do boot vai junto neste deploy e roda **antes** de servir tráfego, então o caminho
normal se autocorrige — mas confirme no log:

```
[bootstrap] crédito migrado para milésimos de pãozinho
```

Para conferir a cobertura em qualquer ambiente (só leitura):

```ts
prisma.user.count({ where: { OR: [{ creditMilli: null }, { creditMilli: { isSet: false } }] } })
// 0 = pode remover os campos legados do schema e o backfill (última faxina)
```

**Última faxina, quando quiser:** com cobertura 0 em produção por alguns dias, dá para tirar do
schema `creditBalance` / `quantity` / `creditsApplied`, apagar `credit-milli-backfill.ts`, o script
`migrate:credit-milli` e a chamada no `server.ts`. No MongoDB isso **não apaga dado** — as chaves
continuam nos documentos, só deixam de ser visíveis ao Prisma, e é reversível re-declarando o campo.

**Rollback:** a partir deste deploy o campo legado fica **congelado**. Voltar para uma versão
anterior faria o app ler saldo desatualizado — se precisar reverter, reverta também o banco ou
reprocesse a partir do extrato (`quantityMilli`).

**Verificação:** typecheck shared+api+web ✅ · build api ✅ · build web ✅ ·
api **610 + 3 todo** ✅ · web **118 + 17 todo** ✅ · shared **38 + 4 todo** ✅ (a `milliOrLegacy`
levou seu teste embora; o resto da cobertura ficou).

**Testes ajustados (10 arquivos):** todas as fixtures passaram a descrever o mundo canônico —
`creditMilli` em vez de `creditBalance`, `quantityMilli` em vez de `quantity`,
`creditsAppliedMilli` em vez de `creditsApplied`. Os casos que provavam o *fallback* viraram o
oposto: **ausência de canônico = 0**, nunca "reaparece pelo legado". Foi o que garantiu que a
remoção não deixou nenhum caminho lendo o campo antigo.

## 4-ter. ✅ FECHADO — "cliente gastou 1,4, admin diz 2" era falso positivo

Investigado no banco em 31/07/2026, com autorização do usuário (leitura de um `MarketOrder`).
**Não era bug de crédito** — eram dois números diferentes lidos como se fossem o mesmo.

A Cestinha em questão (`6a6b7b95…`, criada 30/07 16:28, ainda **SCHEDULED**):

| Campo | Valor |
|---|---|
| itens | 1× Geleia de Morango @ R$ 0,80 · 1× produto teste @ R$ 0,20 |
| Σ itens | R$ 1,00 · **itemCount = 2 unidades** |
| `breadQty` | 4 pães |
| `totalValue` / `moneyAmount` | R$ 1,40 / R$ 1,40 |
| `creditsApplied` / `creditsAppliedMilli` | **0 / 0** — não usou crédito nenhum |

- O **"1,4"** da tela do cliente é **R$ 1,40 em dinheiro**, não 1,4 pãezinhos.
- O **"2"** da tela do admin é o **`marketItemCount`** (2 unidades de produto), não pãezinhos.
- A separação conta `breadQty = 4` pães + 2 unidades de item — correto para o que foi comprado.

**Achado colateral, esse real:** o `totalValue` desse pedido foi calculado com o avulso de
**R$ 0,10** (avulso implícito = `(1,40 − 1,00) / 4`), que era o valor configurado durante o teste;
hoje o avulso é R$ 1,20. O snapshot é o comportamento correto (preço congelado no pedido), mas o
pedido **está SCHEDULED**: se for entregue, saem 4 pães que renderam R$ 0,40. Vale cancelar esse
pedido de teste antes de seguir, para não sujar a separação.

Consequência geral da **D-10** que isso ilustra: pedido antigo tem `totalValue` no avulso da época.
Nenhuma tela hoje re-deriva pãezinhos a partir do R$ de um pedido (todas leem
`creditsAppliedMilli`), e é assim que deve continuar — re-derivar com o avulso de hoje daria número
diferente em todo histórico anterior a um reajuste.

---

## 4-bis. Correções achadas no teste manual (31/07/2026)

Duas coisas que **só apareceram rodando o app**. Ambas corrigidas, com teste de regressão.

### 🐞 O backfill "rodou" sem migrar ninguém — `{ campo: null }` não acha chave ausente no Mongo

**Sintoma:** cliente comprou uma Cestinha de 5,5 🥖 com saldo 60 e a Home mostrou **54**, não 54,5.

**Medido na base real:**

| Consulta | Resultado |
|---|---|
| Mongo puro `{ creditMilli: { $exists: false } }` | **9 documentos** |
| Mongo puro `{ creditMilli: null }` | 10 |
| **Prisma** `where: { creditMilli: null }` | **1** |
| **Prisma** `where: { creditMilli: { isSet: false } }` | **9** |

No Prisma + MongoDB, `{ campo: null }` casa **só `null` explícito**. Documento em que a chave nunca
foi escrita aparece apenas com `{ isSet: false }`. O backfill filtrava por `null`, achou zero
pendências, **gravou a flag de concluído e não migrou ninguém**.

**Segundo efeito, pior:** `$inc` sobre chave inexistente **não credita nada** — o débito de 5500
mili se perdeu e a chave virou `null`. O campo legado, esse sim, baixou 6 (arredondado). Resultado:
o cliente pagou 5,5 e foi cobrado 6. (O comentário anterior no código dizia que o `$inc` criaria o
campo com o valor do incremento; estava errado.)

**Terceiro efeito, silencioso:** os agregados da Onda E (`_sum: { quantityMilli }`,
`{ creditsAppliedMilli }`, `{ creditMilli }`) **ignorariam todo o histórico** não migrado — passivo,
créditos vendidos e financeiro só contariam o que nasceu depois.

**Correções:** (1) os três filtros passaram a `OR: [{ campo: null }, { campo: { isSet: false } }]`;
(2) **o guard do boot deixou de ser por flag e passou a ser por pendência** (um `count`) — com
guard por flag, quem ficou de fora nunca mais seria migrado. A flag é só o registro da última
execução. +2 testes.

### 🐞 O estorno da parte em dinheiro era uma brecha de dinheiro

**Apontado pelo usuário.** O `ceil` para pãozinho inteiro devolvia R$ 1,20 de crédito por R$ 0,10
pagos em dinheiro: **R$ 1,10 de lucro por ciclo comprar-cancelar, repetível à vontade.**

**Correção:** a parte em dinheiro converte pela **mesma função do débito** (`creditsForPrice`), então
R$ 0,60 devolve **0,5 🥖** e o ciclo fecha em zero. `paezinhosParaEstorno` foi **removida** do
`shared` — enquanto existisse, alguém a chamaria de novo. +6 testes, incluindo uma matriz de
neutralidade (5 combinações de crédito × dinheiro) e o caso explícito dos centavos.

**Pendência de dado:** o cliente de teste perdeu 0,5 🥖 na Cestinha do incidente. O saldo correto é
**54,5**; o backfill vai cimentar 54. Corrigir exige um `creditMilli = 54500` pontual nesse
documento — **aguardando autorização do usuário** (é escrita em banco).

---

## 5. Verificação manual

### Depois da F-limpeza — 3 checagens de fumaça

Nada mudou de comportamento, mas o runtime passou a ler um campo só. Vale confirmar:

1. **Reinicie a API** e confirme no log: se aparecer `[bootstrap] crédito migrado para milésimos`,
   havia documento pendente (esperado no 1º boot de um ambiente novo); se não aparecer, já estava
   coberto. Nos dois casos o app tem de subir normal.
2. **Compre e cancele uma Cestinha fracionada** — saldo tem de voltar ao valor exato de antes.
3. **Admin → Clientes** — o saldo continua batendo com o que o cliente vê. Se aparecer **0** para
   alguém que tem saldo, é documento sem `creditMilli`: rode `migrate:credit-milli`.


### Onda E — o lado do admin (faça estes 5)

1. **Clientes** → coluna de saldo mostra **43,5** para quem gastou 1,5 🥖 (não 43 nem 44).
2. Detalhe do cliente → "Saldo de créditos: **43,5** pães"; o extrato tem a linha da Cestinha com
   **−1,5**; "Remover créditos" aceita no máximo **43** (inteiro).
3. **Gestão → Cestinhas** → o split mostra "**1,5** 🥖"; uma Cestinha cancelada mostra
   "estornado **1,5** 🥖".
4. **Relatórios → Passivo** → "créditos em circulação" com decimal, e o valor em R$ coerente.
5. **Financeiro** → "pago em pãezinhos" com decimal ao lado do valor em R$.

> Se algum desses aparecer **arredondado**, o suspeito é um `type: 'integer'` que escapou no
> response-schema da rota — não o serviço.

### Onda D — o fracionado ligado (faça estes 6)

1. Produto a **R$ 1,80** (avulso R$ 1,20) no catálogo: card mostra **"🥖 1,5 pães"** e o selo com o
   **% cheio** do melhor combo (−17%, não −11%).
2. Detalhe do produto: bloco "Com pãezinhos" mostra **1,5 pãezinhos**, sem "+ R$ 0,60".
3. Cestinha só com esse item → checkout: "Usa **1,5** 🥖 · sobram 43,5 de 45", **Em dinheiro
   R$ 0,00** e o CTA não pede forma de pagamento. Confirmar → pedido **SCHEDULED** na hora.
4. Home depois da compra: saldo mostra **43,5**; "rende ~N dias" usa 43 (pão inteiro).
5. Extrato (`/client/creditos`): linha da Cestinha com **−1,5** (não −2).
6. Cancelar a Cestinha: devolve **1,5 🥖** e o saldo volta a 45 exatos.

> Em todos os textos, conferir a vírgula: "1,5", nunca "1.5".

### Onda 0

> A Onda A não tem verificação manual: nada mudou de comportamento. Se quiser confirmar a
> fundação, rode `npm run -w @cheirin-de-pao/api migrate:credit-milli` e confira que a linha
> "Conferência: Σ creditMilli = … · Σ creditBalance × 1000 = …" mostra os dois números iguais.
> Rodar de novo deve reportar `0 preenchidos`.


1. Admin → Gestão → produto novo com preço **1,80** (avulso 1,20): aviso mostra
   "🥖 = 1 pãozinho + R$ 0,60" e "gasta o equivalente a R$ 1,60 (Fornão) a R$ 1,75 (Fornin)".
2. Catálogo do cliente: o card do item mostra "🥖 1 pão + R$ 0,60" e o selo **−11%** (não −17%).
3. Produto com preço múltiplo do avulso (ex.: **2,40**): mostra "🥖 2 pães", selo com o % cheio
   do combo e **nenhuma** menção a dinheiro.
4. Checkout com saldo: "Usa N 🥖" bate com o card, e a parte em dinheiro é exatamente o resto.
5. Cancelar uma Cestinha paga parcialmente em dinheiro: o estorno devolve
   `creditsApplied + ceil(dinheiro/avulso)` pãezinhos, sem um extra.

---

## 6. PROMPT DE CONTINUAÇÃO (copiar numa sessão nova)

```
Créditos fracionados (mili-pão) no Cheirin de Pão — branch development, implementação DIRETA
autorizada (sem GSD), SEM commit sem autorização explícita.

Leia primeiro:
1. .projeto/status-creditos-fracionados.md  (§3 decisões D-1..D-10, §4 ondas, §4-bis/ter/quater)
2. packages/shared/src/credits.ts           (aritmética única: centavos e milésimos inteiros)

ESTADO: TODAS as ondas (0, A, B, C, D, E, F) e a F-limpeza estão CONCLUÍDAS. O crédito é
fracionado ponta a ponta (cliente e admin), o legado saiu do runtime e nada foi commitado.
Piso de testes: api 610+3 todo · web 118+17 todo · shared 38+4 todo — precisa continuar verde.

NÃO há trabalho de implementação pendente. O que resta:
- verificação manual (§5) e a decisão de commit/deploy (só o usuário autoriza);
- a "última faxina" do §4-quater (tirar os 3 campos legados do schema + o backfill), que exige
  cobertura 0 em PRODUÇÃO por alguns dias — confira antes com o count do §4-quater.

Regras invioláveis: toda conta de crédito passa por packages/shared/src/credits.ts; saldo é
`creditMilli` (milésimos, inteiro) e nada mais; estorno SEMPRE proporcional (ceil é brecha de
dinheiro — §4-bis); campo de crédito em rota é `type: 'number'`, nunca 'integer'; filtro de
pendência no Mongo precisa de `isSet: false` além de `null`. Não reabra D-1..D-10.
```
