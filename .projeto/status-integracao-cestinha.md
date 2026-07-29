# STATUS — Integração da Cestinha na operação (Ondas A..H)

> 📗 **REGISTRO DA INTEGRAÇÃO — concluída.** Leia este arquivo antes de mexer em qualquer parte da
> Cestinha: o §4 guarda, onda por onda, os arquivos tocados e as **decisões** que não são óbvias no
> código. Para abrir uma sessão nova (auditoria, teste ou extensão), use o prompt do §6.
>
> **Última atualização:** 29/07/2026 — 🎉 **INTEGRAÇÃO COMPLETA. Todas as ondas concluídas**
> (A, B, C, D, E, F, G, H1–H9) + automação do `prisma db push` no pipeline. **Nenhuma onda pendente.**
> Depois disso entraram, a partir de teste manual (ver §4, "Extra"): o espaçamento do cabeçalho de
> bloco na Separação, o bug de **parada com várias Cestinhas ficando pela metade** (Separação e
> Entrega) e a **hierarquia visual dos menus** do hub. Piso de testes: **563 passando + 3 todo**.
> **Etapa atual:** ✅ nada a implementar. O que resta é **verificação manual** (§5, 46 cenários) e a
> decisão de commit/deploy — que depende de autorização explícita do usuário.
>
> ✅ **DEPLOY: nada manual.** Os dois passos que a Onda H exigia foram automatizados em 29/07/2026:
> - **Índices/coleções no Atlas** — o `ansible/playbook.yml` roda `prisma db push` dentro do
>   container depois do `up -d`. Antes era um passo manual do checklist do README (dependia de
>   alguém lembrar), e `prisma generate` — o único que rodava no Dockerfile/CI — **não cria índice**.
> - **Matriz de fornecimento** — `backfillSupplierProductsIfNeeded` roda no boot
>   ([server.ts:212](../apps/api/src/server.ts#L212)), com guard de execução única. O
>   `npm run -w @cheirin-de-pao/api migrate:supplier-products` existe só para reprocessar.
>
> Confirmar no log do deploy: `[bootstrap] matriz de fornecimento semeada (pão × fornecedores)`.

---

## 0. Como retomar (leia nesta ordem)

1. **Este arquivo** — estado atual, o que já foi feito, próximo passo exato.
2. [`docs/plano-integracao-cestinha-operacao.md`](./docs/plano-integracao-cestinha-operacao.md) —
   o plano completo: diagnóstico, auditoria das 12 áreas, **decisões D-1..D-10 (confirmadas)**,
   Ondas A..H, riscos, cenários de verificação.
3. Só se precisar de contexto da feature original:
   [`status-implementacao-alem-do-paozin.md`](./status-implementacao-alem-do-paozin.md).

---

## 1. Regras invioláveis

- ❌ **NÃO** commitar nem pushar sem autorização **explícita** do usuário, pedida **a cada vez**.
  "Funcionou", "perfeito" ou "pode seguir" **não** contam como autorização de commit.
- ✅ Implementação **DIRETA** (sem GSD, autorizado pelo usuário), branch **`feat/update`**.
- ✅ **D-6: `Order` de pão intocado.** Toda união é leitura/agregação. Nenhuma migração de dados.
- ✅ **Os testes de backend são o piso** — sempre verdes ao fim de cada etapa.
  Piso real medido em 28/07/2026: **381 passando + 3 todo** (o "88" do plano original estava
  desatualizado). Onda A: **390**. B: **392**. C: **397**. H1–H7: **431**. F: **467**. E: **477**.
  D: **495**. H8: **514**. H9: **529**. **G: 549 passando + 3 todo** ← piso atual (+168 desde o
  início da integração). Correção da parada multi-Cestinha (29/07): **563 passando + 3 todo** ← piso atual.
- ✅ **Validação dupla:** rota tocada = atualizar JSON Schema (`*.route.ts`) **E** Zod (`*.schema.ts`).
  Campo novo ausente no response-schema é removido em silêncio → o front mostra lista vazia.
- ✅ Padrão de módulo: `route` (JSON Schema + `authenticate`) → `controller` (Zod + role ADMIN
  inline + `{statusCode,message}`) → `service` → `repository`.
- ✅ Front admin: sub-telas por estado no hub (`AdminGestao` / `AdminMarket`), **sem tocar no router**.

### Ritual obrigatório ao fim de CADA etapa (nesta ordem)

1. Rodar **typecheck** (shared + api + web) + **build** do api + **testes** do api.
2. **ATUALIZAR ESTE ARQUIVO**: mover a etapa para "concluída" com os arquivos tocados e as decisões
   tomadas, atualizar "Última atualização" e "Etapa atual", e ajustar o §6.
3. **PERGUNTAR AO USUÁRIO** se ele quer continuar **nesta mesma sessão** ou **em outra sessão**.
   - Mesma sessão → seguir para a próxima etapa.
   - Outra sessão → entregar no chat o **PROMPT DE CONTINUAÇÃO** (§6) atualizado, pronto para copiar.

---

## 2. Comandos de verificação

```bash
# regenerar Prisma Client após mudar o schema:
DATABASE_URL="mongodb://localhost:27017/cheirin" npx prisma generate --schema=apps/api/prisma/schema.prisma

# typecheck:
npm run -w @cheirin-de-pao/shared typecheck
npm run -w @cheirin-de-pao/api typecheck
npm run -w @cheirin-de-pao/web typecheck

# build + testes do backend:
npm run -w @cheirin-de-pao/api build
npm run -w @cheirin-de-pao/api test
```

---

## 3. Decisões confirmadas (28/07/2026) — resumo operacional

Detalhe e rationale no plano (§3 e §3-B). **Não reabrir sem motivo novo.**

| # | Decisão em uma linha |
|---|---|
| **D-1** | Pão ≠ item. `breadQty` entra em todo contador de pães; `items[]` é métrica paralela ("N pães · M itens") |
| **D-2** | Receita = 3 números: crédito · Cestinha (`purpose=MARKET`) · **GMV**. **GMV nunca somado à receita.** Card "Receita do dia" não sobe em Cestinha 100% crédito — é correto |
| **D-3** | Gate da separação: `PurchaseOrder` FINALIZED **ou** `MarketOrder` confirmado |
| **D-4** | Ledger unificado com `kind: 'BREAD' \| 'CESTINHA'` (aba separada descartada) |
| **D-5** | Parada = `(userId, slotId)`. Pão + Cestinha do mesmo cliente/turno = **1 entrega**; pães somam sempre |
| **D-6** | `Order` intocado; 88 testes são o piso |
| **D-7** | Fornecimento é matriz produto × fornecedor (`defaultSharePct`) |
| **D-8** | Custo mora na relação: linha `SupplierProduct` existe ⇔ fornece aquele produto |
| **D-9** | 2 regimes de compra: `DELIVERY_BATCH` (DAILY, do corte) × `RESTOCK` (FIXED, reposição) |
| **D-10** | `Supplier.pricePerUnit` / `supplierSplitPrincipalPct` → legado, com backfill |

---

## 4. Progresso

### ✅ Onda A — P0 · O pão da Cestinha entra na operação física — CONCLUÍDA (28/07/2026)
> Corrigiu os 3 prints do usuário e o furo físico: **pão vendido dentro da Cestinha e nunca pedido
> ao fornecedor**. É a base de todas as outras ondas.
> Verificação: typecheck shared+api+web ✅ · build api ✅ · **390 testes + 3 todo** ✅

| # | Tarefa | Estado |
|---|---|---|
| A1 | `apps/api/src/lib/bread-demand.ts` — fonte única da demanda de pão (Order + `MarketOrder.breadQty` + projeção), mesclada por parada (D-5) | ✅ |
| A2 | `_buildDeliveryRows` delega para A1 → corrige os 9 consumidores de uma vez | ✅ |
| A3 | `createQuick` / `autoGenerateAtCutoff` passam a pedir o pão da Cestinha | ✅ |
| A4 | Gate da separação (D-3) | ✅ |
| A5 | Painel — `breadsToday/Tomorrow/ByWeekday` somam `breadQty` | ✅ |
| A6 | `getWasteReport` — `delivered` soma `breadQty` DELIVERED (acoplado a A3) | ✅ |
| A7 | Frontend — "N pães · M itens" em `AdminPedido` / `DiasEmAberto` + chip 🧺 no detalhe | ✅ |

**Arquivos tocados:**

*Novos:*
- `apps/api/src/lib/bread-demand.ts` — `buildBreadDemand()` + `CONFIRMED_MARKET_STATUSES` +
  `BreadDemandStop` / `MarketItemLine`.
- `apps/api/src/lib/__tests__/bread-demand.test.ts` — 9 testes fixando D-1 e D-5.

*Backend:*
- `admin-supplier-orders.service.ts` — `_buildDeliveryRows` delega para a lib; `DeliveryRow` e
  `SlotBreakdown` ganharam campos; `getDraft`, `getCondominiumDetail`, `getSlotsStatus`,
  `getUpcomingDays` e `createQuick` passam a usar `breadConfirmed`/`breadProjected`.
- `admin-supplier-orders.route.ts` — 4 response-schemas atualizados (draft, slots-status,
  upcoming-days, draft/:condominiumId).
- `admin-separation.service.ts` — gate D-3 (`openSlots` = PO FINALIZED **ou** Cestinha).
- `admin-orders.service.ts` — dashboard soma `breadQty` (hoje/amanhã/ontem/semana) + `itemsByWeekday`.
- `admin-orders.route.ts` — schema do dashboard (`itemsByWeekday`).
- `admin-reports.service.ts` — `getWasteReport` soma `breadQty` DELIVERED no lado "entregue".
- Mocks de teste: `admin-supplier-orders.module.test.ts` e `admin-orders-dashboard.service.test.ts`
  ganharam stub `marketOrder` (default vazio → fluxo do pão idêntico ao histórico).

*Frontend:*
- `DiasEmAberto.tsx` — `DaySlot.items`/`marketBreads`, `UpcomingDay.totalItems`, chip `N 🧺` no
  medalhão e nos chips de turno.
- `AdminPedido.tsx` — `CondoDraft.marketItemCount`/`marketBreads`, `SlotBreakdown.items`, linha
  "🧺 Cestinha N itens · inclui N 🥖 da Cestinha" no resumo, itens nos chips de turno do condomínio.
- `CondominiumOrderDetail.tsx` — badge `🧺 Cestinha` (parada só-market) e `+ 🧺` (combinada), chips
  dos itens por parada, "0 pães" vira `N 🧺`, itens no cabeçalho do grupo, 3 colunas novas no CSV.

**Decisões tomadas durante a implementação (registrar — não são óbvias):**

1. **`CONFIRMED_MARKET_STATUSES` exclui `PENDING_PAYMENT`.** Uma Cestinha aguardando Pix pode ser
   cancelada pelo sweep do cron; pedir esse pão ao fornecedor seria comprar por um pedido que vai
   morrer. Mesmo conjunto que o board da Separação usa → os números reconciliam entre as telas.
2. **A parada agrega VÁRIAS Cestinhas do mesmo cliente/turno.** O caso do print 1 (4 Cestinhas para
   qua 29) é real, não teórico. `marketOrderIds` é um array de propósito.
3. **`_buildDeliveryRows` agora mescla também Order+Order do mesmo cliente/turno** (ex.: um avulso +
   um da agenda). Antes viravam 2 linhas = 2 entregas para 1 campainha. Não mesclar isso enquanto
   se mescla pão+Cestinha seria incoerente. É a mesma regra do D-5, aplicada uniformemente.
4. **`deliveryCount` e `projectedDeliveries` agora são DISJUNTOS** e somam exatamente o total de
   paradas. O front faz `deliveryCount + projectedDeliveries` ([AdminPedido.tsx:446]) — antes uma
   parada com pão materializado + agenda parcialmente prevista era contada nos dois.
5. **`risk` só existe onde há previsto.** O que já foi pago não corre risco de "não materializar";
   antes o risco era atributo da linha prevista, agora é derivado de `breadProjected > 0`.
6. **`byType` ganhou um terceiro balde `cestinha`** em vez de jogar o pão da Cestinha em
   `single`/`scheduled`: single + scheduled + cestinha = pães pagos. (Campo não é renderizado hoje.)
7. **`itemsByWeekday` é série separada no painel.** Nunca somada a `breadsByWeekday` (D-1).
8. **Não mexi na seleção do "próximo corte"** (`slot.breads <= 0` continua pulando o turno): sem pão
   não há o que pedir ao fornecedor de pão. O turno 100% produtos é atendido pelo gate D-3 da
   Separação, não pelo pedido ao fornecedor.

### ✅ Onda B — P0 · Esteira completa — CONCLUÍDA (28/07/2026)
> A Cestinha passa a existir na separação consolidada, no acompanhamento de entregas, na divisão
> entre entregadores e no radar de pedidos parados.
> Verificação: typecheck shared+api+web ✅ · build api ✅ · **392 testes + 3 todo** ✅

| # | Tarefa | Estado |
|---|---|---|
| B1 | Lista consolidada de itens a separar (dia + por lote) no board | ✅ |
| B2 | `getDeliveryStatus` — paradas da Cestinha + contadores | ✅ |
| B3 | `getDivisionSuggestion` + `approveDivision` + `assignCourier` com `marketOrderIds` | ✅ |
| B4 | `getStuck` + `stuckCount` incluem Cestinha; `LedgerRow` ganhou `kind` (D-4) | ✅ |
| B5 | `resolveStuckMarketOrder` — desfecho + estorno + estoque | ✅ |
| B6 | `sendCourierPendingReminders` e `sendDeliveryPendingReminders` contam Cestinha | ✅ |
| B7 | Frontend `AdminEntregas` / `AdminSeparacao` / `DeliveryDivisionCard` / `OrderDetailSheet` | ✅ |

**Arquivos tocados:**

*Novos:*
- `apps/api/src/lib/market-reversal.ts` — `reverseMarketOrder()` + `refundableCredits()`:
  estoque + estorno tudo-em-crédito + status terminal, numa transação idempotente.

*Backend:*
- `admin-orders.service.ts` — `LedgerRow` += `kind`/`marketOrderId`/`marketItems`/`marketItemCount`/
  `creditsApplied`/`moneyAmount`/`totalValue`; novos `_enrichMarketOrders` + `_marketLedgerSelect`;
  `getStuck` e `stuckCount` unificados; `getDeliveryStatus` e `getDivisionSuggestion` reescritos
  sobre PARADAS via novo `collectDivisionStops`; `DivisionUnit`/`DivisionBlock`/`DivisionAssignment`
  += `marketOrderIds`/`items`/`totalItems`; `approveDivision` e `assignCourier` despacham
  `marketOrderIds` explícitos; novo `resolveStuckMarketOrder`.
- `admin-orders.route.ts` — `ledgerRowProps`, delivery-status, division-suggestion, approve-division,
  assign-courier e resolve (body `kind`/`returnStock`).
- `admin-orders.schema.ts` — `AssignCourierSchema.marketOrderIds`; `ApproveDivisionSchema` aceita
  grupo 100% Cestinha (refine "orderIds OU marketOrderIds"); `ResolveOrderSchema` += `kind`/`returnStock`.
- `admin-orders.controller.ts` — repassa `marketOrderIds`; `resolveOrder` roteia por `kind`.
- `admin-separation.service.ts` — `MarketPickItem` + `marketPicklist` por lote e por dia; `items`
  passou a selecionar `productId`.
- `admin-separation.route.ts` — `marketPicklistProps` no slot e no board.
- `admin-supplier-orders.service.ts` — `sendDeliveryPendingReminders` conta paradas + itens.
- `courier.service.ts` — `sendCourierPendingReminders` inclui Cestinhas.
- `market-orders.service.ts` — `cancelOrder` passou a usar `reverseMarketOrder` (deixou de duplicar
  a matemática do estorno).

*Frontend:*
- `AdminEntregas.tsx` — tipos com `marketOrderIds`/`totalItems`; `handleApprove` envia
  `marketOrderIds` e aceita grupo 100% Cestinha; linha do ledger com 🧺, chips dos itens e
  fallback `N 🧺` quando 0 pães.
- `DeliveryDivisionCard.tsx` — `DeliveryUnit`/`BlockBreakdown` += `marketOrderIds`/`items`;
  `explode`/`collapse` preservam os campos novos; chip `N 🧺` na unidade.
- `OrderDetailSheet.tsx` — `LedgerRow` += campos da Cestinha; resolve roteia por `kind`; detalhe
  mostra itens/split/total; esconde "devolver pães" e "estornar pagamento" em Cestinha.
- `AdminSeparacao.tsx` — novo componente `MarketPicklist` (dia + por lote); tipos `MarketPickItem`;
  **correção de key duplicada** (`orderId || marketOrderId`).

*Testes:*
- `admin-orders-dashboard.service.test.ts` — stub `marketOrder`; fixture de delivery-status ganhou
  `userId` por pedido (D-5); **2 testes novos** fixando parada combinada e parada só-Cestinha.
- `admin-orders-ledger.service.test.ts` — stub `marketOrder`.

**Decisões tomadas durante a implementação:**

1. **`LedgerRow.type` vale `'MARKET'` em Cestinha.** Preferi ser explícito no dado a reaproveitar
   `'SINGLE'`, que faria a tela dizer "Avulso" para uma Cestinha. O front discrimina por `kind`.
2. **Extraí `lib/market-reversal.ts`** em vez de duplicar o estorno no admin. A matemática é
   delicada (`ceil(moneyAmount/avulsoUnit)`, `moneyPaid`, idempotência por `referenceId`) e agora
   tem um dono só, usado pelo cliente e pelo admin.
3. **`moneyPaid` generalizado para `status !== 'PENDING_PAYMENT'`** (era `=== 'SCHEDULED'`).
   Equivalente no domínio do `cancelOrder` (que só aceita PENDING_PAYMENT|SCHEDULED) e correto para
   o admin, que resolve pedidos em SEPARATED/OUT_FOR_DELIVERY.
4. **`returnStock` default = `true` só em CANCELLED.** Em NOT_DELIVERED o produto já saiu da
   prateleira e pode ter se perdido; devolver automático inflaria o inventário. O admin decide.
5. **`getStuck` exclui `PENDING_PAYMENT`.** Esse caso já tem dono (o sweep do cron) e apareceria
   como falso positivo no radar de "parados".
6. **`delivered` no delivery-status exige a parada COMPLETA.** Numa parada combinada, pão entregue
   + Cestinha a caminho conta como não entregue — senão o admin veria 100% com entrega pendente.
7. **O greedy da divisão balanceia por `pães + itens`.** Um condomínio com 0 pães e 20 potes de
   geleia não é leve; ordenar só por pães o jogaria para o fim da fila. `total` e `totalItems`
   aparecem separados na tela para o número não mentir.
8. **`getDivisionSuggestion` casa o courier pelo pedido de PÃO** quando a parada é combinada
   (mesma regra que a Onda 5 fiou em `dispatchMarketForOrders`); só assume o courier da Cestinha
   quando a parada é só-market.
9. **Esconder ações inexistentes** no `OrderDetailSheet` para Cestinha: `/orders/:id/refund` daria
   404 e o estorno genérico de `purpose=MARKET` é bloqueado de propósito. A devolução da Cestinha
   acontece dentro do "resolver".
10. **Fixture de teste corrigida, não afrouxada:** a de delivery-status não tinha `userId`, então
    com D-5 os 3 pedidos viravam 1 parada. Três clientes distintos é o caso real; a intenção do
    teste (3 paradas, 1 entregue) ficou intacta e ganhou 2 testes novos.

### ✅ Onda C — P0 · Visibilidade e controle admin — CONCLUÍDA (28/07/2026)
> O admin passa a **ver e reverter** uma Cestinha. Fecha o último beco sem saída do pós-venda.
> Verificação: typecheck shared+api+web ✅ · build api ✅ · **397 testes + 3 todo** ✅

| # | Tarefa | Estado |
|---|---|---|
| C1 | `getLedger` unificado (pão + Cestinha) + filtro `kind` + paginação correta entre 2 coleções | ✅ |
| C2 | `GET /admin/market/orders` e `/orders/:id` — lista/detalhe de Cestinhas | ✅ |
| C3 | `POST /admin/market/orders/:id/cancel` — cancelamento admin sem gate de corte | ✅ |
| C4 | Frontend: sub-tela "Cestinhas" no `AdminMarket` + chips de tipo no ledger | ✅ |

**Arquivos tocados:**

*Novos:*
- `apps/web/src/pages/admin/gestao/MarketCestinhas.tsx` — lista com filtros (Abertas/Todas/
  Entregues/Canceladas) + busca, card com itens/split/estorno, sheet de detalhe com timeline
  completa e cancelamento administrativo (checkboxes de crédito e estoque).

*Backend:*
- `admin-orders.service.ts` — `getLedger` reescrito: une as duas coleções, `LedgerFilters.kind`,
  filtro de status **por coleção** (`BREAD_STATUSES`/`MARKET_STATUSES`), paginação por janela.
- `admin-orders.schema.ts` / `admin-orders.route.ts` — querystring `kind`.
- `admin-market.repository.ts` — `listMarketOrders` / `countMarketOrders` / `findMarketOrder`.
- `admin-market.service.ts` — `AdminMarketOrderRow`, `listOrders`, `getOrder`,
  `cancelOrderAsAdmin` (reusa `reverseMarketOrder`), `enrichOrders` privado, getter `prisma`.
- `admin-market.schema.ts` — `MarketOrderFiltersSchema` (status CSV com valores inválidos
  descartados) + `CancelMarketOrderSchema`.
- `admin-market.controller.ts` / `admin-market.route.ts` — 3 rotas novas.

*Frontend:*
- `AdminMarket.tsx` — 4ª seção "Cestinhas", agora a **aba padrão** do hub.
- `AdminEntregas.tsx` — `KindFilter` + `KindChips`; `kind` na query do ledger e filtro no cliente
  para `/stuck`; `kindFilter` nas deps dos dois efeitos de refetch.

*Testes:* `admin-orders-ledger.service.test.ts` — mock de `marketOrder` parametrizável +
`makeMarketOrder` + **5 testes novos** (união com `kind`, isolamento por `kind`, status só-market,
paginação de 3 páginas entre 2 coleções, `total` como soma dos counts).

**Decisões tomadas durante a implementação:**

1. **Paginação por janela `skip + limit` em CADA coleção.** `take: limit` por coleção daria página
   errada — as `limit` linhas mais recentes do conjunto unido podem vir todas de um lado só.
   Buscar `skip+limit` de cada lado é o teto do que a página pode consumir de uma coleção, então
   cortar a janela depois de unir e ordenar é exato. `total` vem dos dois `count`. Coberto por teste.
2. **Filtro de status por coleção.** `MarketOrderStatus` tem `PENDING_PAYMENT`, que não existe em
   `OrderStatus` — passar no `in` do Order estouraria no Prisma. Cada lado recebe só o que conhece,
   e um filtro que não casa nada naquela coleção significa "nada desta coleção" (respeita a intenção).
3. **`kind` também evita a query.** `kind=BREAD` não consulta `marketOrder` e vice-versa — menos I/O
   e resultado inequívoco.
4. **A visão do mercadinho tem shape próprio** (`AdminMarketOrderRow`), não reusa `LedgerRow`. São
   views diferentes: o ledger é operação de entrega; esta é pedido/produto (itens com preço,
   método de pagamento, telefone do cliente, timeline). Forçar uma abstração só pioraria as duas.
5. **`cancelOrderAsAdmin` é idempotente e barra DELIVERED.** Cancelar de novo devolve o estado sem
   estornar duas vezes; entregue não se cancela (aponta para o "resolver" de Entregas, que é o
   caminho certo para reverter algo já entregue).
6. **"Cestinhas" virou a aba padrão do hub** Além do Pãozin. Produtos/categorias/config são
   cadastro (mexe-se raramente); pedidos são o dia a dia.
7. **`/stuck` não recebe `kind`** — é um alerta e deve mostrar tudo. O filtro de tipo ali é aplicado
   no cliente.

### ✅ Onda H1–H7 — P0 · Fornecimento multi-produto × multi-fornecedor — CONCLUÍDA (28/07/2026)
> Antes disto era **impossível comprar qualquer item do mercadinho**: o modelo só sabia comprar pão.
> Verificação: typecheck shared+api+web ✅ · build api ✅ · **431 testes + 3 todo** ✅

| # | Tarefa | Estado |
|---|---|---|
| H1 | Schema (`SupplierProduct`, `PurchaseOrderKind`, campos novos) + backfill no boot e script | ✅ |
| H2 | CRUD da matriz + validações (Σ fatias, preferido único, demanda órfã) | ✅ |
| H3 | `product-demand.ts` — demanda de compra por produto + `loadSourcingOptions` | ✅ |
| H4 | `supplier-split.ts` — motor de rateio + 11 testes | ✅ |
| H5 | `create`/`createQuick`/`autoGenerateAtCutoff` usam demanda × matriz | ✅ |
| H6 | Documento por fornecedor (`?supplierId=`) no PDF e no Excel | ✅ |
| H7 | Frontend: matriz no fornecedor, leitura no produto, **reescrita do passo "Dividir"** | ✅ |

**Arquivos tocados:**

*Novos (backend):*
- `prisma/schema.prisma` — model `SupplierProduct`; enum `PurchaseOrderKind`; `PurchaseOrder` +=
  `kind`/`totalItems`/`totalValue`; `PurchaseOrderItem` += `productId`/`productName`.
- `lib/supplier-split.ts` — `splitDemandBySupplier` + tipos. **Invariante: a soma das linhas é
  sempre igual à demanda** (resto do arredondamento no `isPreferred`).
- `lib/product-demand.ts` — `buildProductDemand` + `loadSourcingOptions`.
- `bootstrap/supplier-products-backfill.ts` — `runSupplierProductsBackfill` +
  `backfillSupplierProductsIfNeeded` (guard de execução única, plugado no `server.ts`).
- `scripts/backfill-supplier-products.ts` + `npm run migrate:supplier-products`.
- Testes: `lib/__tests__/supplier-split.test.ts` (11), `bootstrap/__tests__/supplier-products-backfill.test.ts` (8),
  `admin-suppliers/__tests__/supplier-products.service.test.ts` (13).

*Backend alterado:*
- `admin-suppliers.{schema,repository,service,controller,route}.ts` — `SetSupplierProductsSchema`,
  9 métodos novos no repo, `listProductsOfSupplier`/`listSuppliersOfProduct`/`setProductsOfSupplier`
  + `assertNoOrphanDemand`, 3 rotas (`GET`/`PUT /admin/suppliers/:id/products`,
  `GET /admin/market/products/:id/suppliers`). `remove` apaga a matriz do fornecedor.
- `admin-supplier-orders.service.ts` — `create` resolve custo pela matriz e separa
  `totalQuantity` (pães) de `totalItems`/`totalValue`; `createQuick` usa demanda × rateio e devolve
  `unsourced`; novo `getSplitPreview`; `getOrderSuppliers`; `_buildSupplierOrderData` filtra por
  fornecedor; `autoGenerateAtCutoff` avisa o que ficou sem fornecedor.
- `admin-supplier-orders.{repository,schema,controller,route}.ts` — `create` com productId/kind/
  totais; `?supplierId=` no pdf/excel; rotas `split-preview` (estática, antes das `/:id`) e
  `/:id/suppliers`.
- `pdf-generator.ts` / `excel-generator.ts` — coluna Produto; modo "por fornecedor" com destinatário
  (nome + CNPJ) e sem a coluna Fornecedor; subtítulo com turno e total de pães.

*Frontend:*
- `SupplierProdutos.tsx` (novo) — editor da matriz no form do fornecedor, com aviso de Σ fatias.
- `FornecedorForm.tsx` — monta o editor ao editar; dica ao criar.
- `MarketProductForm.tsx` — bloco `ProductSuppliers` (leitura) + alerta quando não há fornecedor.
- `AdminFornecedores.tsx` — `SplitDefaultCard` (split global, agora legado) → `SourcingHintCard`.
- `AdminPedido.tsx` — **passo "Dividir" reescrito**: `SplitStep` com um card por produto e uma
  linha por fornecedor; passo "Pronto" com resumo por fornecedor e **PDF por fornecedor**;
  `downloadFile(type, supplierId?)`.

**Decisões tomadas durante a implementação:**

1. **O front NÃO reimplementa o rateio.** Criei `GET /admin/supplier-orders/split-preview` para a
   tela receber a sugestão já calculada. Duas implementações da mesma regra de arredondamento sempre
   divergem — e aí o que a tela mostra deixa de ser o que o "Gerar direto" faz.
2. **`defaultSharePct` em vez de só "fornecedor padrão"** — cobre "tudo no X" (100/0) e
   "parte no X, parte no Y" (75/25), e o backfill **preserva** o 75/25 histórico do pão.
3. **O resto do arredondamento vai para o `isPreferred`** (sem preferido: maior fatia; empate:
   primeiro). Determinístico e a soma fecha sempre — tem teste com 10 demandas diferentes.
4. **`totalQuantity` do `PurchaseOrder` continua sendo só pães.** Os outros produtos vão em
   `totalItems`/`totalValue`. Se ele passasse a somar bolos, o `getWasteReport` explodiria.
5. **A flag do backfill NÃO é gravada quando falta pré-requisito** (sem produto-pão ou sem
   fornecedor ativo). Assim ele roda de verdade quando o admin cadastrar o primeiro fornecedor, em
   vez de ficar marcado como "já feito" para sempre.
6. **`create` barra produto que o fornecedor não fornece** (409) em vez de inventar um custo — mas
   só quando `productId` vem explícito; sem ele a chamada é legada e o fallback `pricePerUnit` vale.
7. **Fornecedor inativo sai do rateio sem apagar a linha** — o custo cadastrado fica lá para quando
   ele voltar.
8. **`SplitDefaultCard` virou `SourcingHintCard` em vez de ser removido.** Editar o percentual
   global não muda mais nada; remover o card deixaria quem o conhecia sem saber para onde foi.
9. **Apagar um fornecedor apaga a matriz dele** — senão sobrariam linhas órfãs que o rateio teria de
   filtrar para sempre.
10. **`H8` (RESTOCK) ficou de fora** — o enum `PurchaseOrderKind` e o `kind` já existem no schema,
    mas o fluxo de reposição de inventário (`FIXED`) é P1 e não bloqueia nada.

### ✅ Onda F — P1 · Notificações — CONCLUÍDA (29/07/2026)
> A Cestinha tinha **uma** notificação (entrega). Tudo o que dava errado com ela acontecia em
> silêncio — inclusive o cancelamento automático por pagamento não concluído, que devolve crédito e
> libera estoque sem o cliente saber que o pedido caiu.
> Verificação: typecheck shared+api+web ✅ · build api ✅ · **467 testes + 3 todo** ✅ (+36)

| # | Tarefa | Estado |
|---|---|---|
| F1 | Cliente avisado quando o **sweep** cancela a Cestinha (Pix expirado/abandonado/recusado) | ✅ |
| F2 | Véspera unificada — `sendEveReminders` inclui Cestinha, **1 aviso por parada** (D-5) | ✅ |
| F3 | Cliente — Cestinha `NOT_DELIVERED` (parada combinada, só-market e resolução do admin) | ✅ |
| F4 | Admin — `ADMIN_ORDER_PLACED` na confirmação da Cestinha e `ADMIN_ORDER_CANCELLED` no cancelamento do cliente | ✅ |
| F5 | Admin — estoque baixo/esgotado do mercadinho: `ADMIN_LOW_STOCK` + toggle | ✅ |

**Arquivos tocados:**

*Novos:*
- `apps/api/src/lib/market-stock-alerts.ts` — `LOW_STOCK_THRESHOLD`, `buildStockAlerts()`
  (cruzamento de limiar), `stockAlertLabel()`, tipos `StockAlert`/`StockSnapshot`.
- `apps/api/src/lib/client-label.ts` — `clientLabel()` ("Fulano · Apto 12B"), antes em 3 cópias.
- Testes: `lib/__tests__/market-stock-alerts.test.ts` (12),
  `modules/market/__tests__/market-sweep.service.test.ts` (7),
  `modules/payments/__tests__/fulfill-market-order.test.ts` (6).

*Backend:*
- `prisma/schema.prisma` — 3 valores novos em `NotificationType`: `MARKET_ORDER_CANCELLED`,
  `MARKET_NOT_DELIVERED` (cliente) e `ADMIN_LOW_STOCK` (admin) + `prisma generate`.
  **Sem impacto de deploy** — valor de enum no Mongo é string, não cria índice nem coleção.
- `modules/market/market-notify.ts` — **reescrito** como casa de TODAS as notificações da Cestinha:
  `notifyMarketDelivered` (existente), `notifyMarketCancelled` (causa `PAYMENT`|`ADMIN`),
  `notifyMarketNotDelivered`, `notifyAdminMarketOrderPlaced`, `notifyAdminMarketOrderCancelled`,
  `notifyAdminLowStock`.
- `modules/market/market-checkout.service.ts` — `releaseOrder` virou **claim atômico** (retorna
  `{released, refundedCredits}`) e aceita motivo; `sweepStuckPayments` avisa o cliente; F4 no
  checkout 100% crédito; novo `alertStockAfterReserve` (F5).
- `modules/payments/fulfill-market-order.ts` — transição via `updateMany` guardado + F4.
- `modules/market/market-orders.service.ts` — `cancelOrder` avisa os admins (só pedido confirmado).
- `lib/market-pipeline.ts` — `PRE_DELIVERY` exportado; `propagateMarketStatusForOrder` devolve
  **quantas Cestinhas a chamada moveu**.
- `modules/admin-orders/admin-orders.service.ts` — aviso de entrega da Cestinha passou a usar esse
  count; F3 na parada combinada; `resolveStuckMarketOrder` avisa o cliente nos 3 desfechos.
- `modules/courier/courier.service.ts` — `markMarketNotDelivered` avisa o cliente (F3 só-market).
- `modules/admin-market/admin-market.service.ts` — `cancelOrderAsAdmin` avisa o cliente; limiar de
  estoque vem da lib.
- `modules/schedules/schedules.service.ts` — `sendEveReminders` reescrito sobre **paradas** +
  `eveMessage()` puro e exportado.
- `modules/admin-notification-prefs/admin-notification-prefs.schema.ts` — `ADMIN_LOW_STOCK`
  (a rota deriva o JSON Schema do array → validação dupla automática).
- `modules/notifications/notifications.route.ts` — `type` e `actionRoute` no response-schema.
- `modules/orders/orders.service.ts` — passa a importar `clientLabel` da lib.

*Frontend:*
- `AdminNotificacoes.tsx` — toggle "Estoque do mercadinho".
- `AdminNotificationsScreen.tsx` — tom/ícone de `ADMIN_LOW_STOCK`.
- `NotificationsScreen.tsx` (cliente) — tom, ícone e CTA de `MARKET_ORDER_CANCELLED` e
  `MARKET_NOT_DELIVERED`.

*Testes:* `schedules.service.test.ts` — `createMockFastify` ganhou stub `marketOrder`
(default vazio → fluxo do pão idêntico ao histórico) + **11 testes novos** (matriz do `eveMessage`
e agrupamento por parada).

**Decisões tomadas durante a implementação:**

1. **O gatilho do aviso é o CLAIM, nunca o estado relido.** `releaseOrder` e `fulfillMarketOrder`
   passaram a mover o status com `updateMany` guardado e só avisam quem ganhou a corrida. O cron de
   1 min não tem trava de execução (duas passadas podem ver o mesmo pedido preso) e webhook Stripe,
   webhook Mercado Pago e o pull de reconciliação chegam ao mesmo pagamento. Sem o claim, o cliente
   recebia dois "seu pedido caiu" e o estoque/crédito voltava em dobro.
2. **O sweep NÃO avisa o admin — só o cliente.** Pedido que morreu em `PENDING_PAYMENT` nunca
   entrou na operação (`CONFIRMED_MARKET_STATUSES` o exclui): não foi à fornada nem à separação,
   então não há nada para o admin corrigir. É a paridade do pão, onde um Pix abandonado nem cria
   `Order`. Mesma regra no cancelamento de um `PENDING_PAYMENT` pelo próprio cliente.
3. **`ADMIN_ORDER_PLACED` sai na CONFIRMAÇÃO, não no checkout.** Uma Cestinha com parte em dinheiro
   nasce aguardando pagamento e pode morrer no sweep; avisar no checkout enfileiraria pedidos
   inexistentes. 100% crédito avisa na hora (já nasce confirmada).
4. **Véspera = 1 notificação por PARADA (D-5), não por pedido.** Efeito colateral desejado: dois
   pedidos de pão do mesmo cliente/turno (avulso + agenda) viravam **dois** pushes para a mesma
   campainha e agora viram um, com o total. Turnos diferentes continuam sendo dois avisos — são
   duas entregas.
5. **No texto da véspera, `breadQty` da Cestinha soma no contador de pães (D-1)** e os itens ficam
   em grandeza separada ("6 pães e sua Cestinha (2 itens)"). O 🧺 aparece **só quando há itens** —
   uma Cestinha só de pão é, para o cliente, uma entrega de pão.
6. **`eveMessage` é função pura exportada.** A matriz de textos (só pão / só Cestinha / os dois /
   sem horário / singular) é testável sem cron nem banco — 5 dos 11 testes novos.
7. **Alerta de estoque por CRUZAMENTO de limiar, não por "está abaixo".** Avisa na reserva que fez
   o estoque cair na faixa crítica e nunca mais; a idempotência sai de (disponível depois,
   consumido agora), sem estado persistido. "Está abaixo" repetiria o aviso em cada venda seguinte
   e o admin desligaria o toggle no terceiro dia.
8. **DAILY só alerta `OUT`; FIXED alerta `LOW` e `OUT`.** "Restam 3 vagas para amanhã" é o
   funcionamento normal de um produto que vende bem — só o esgotamento do dia é notícia. Mesma
   assimetria da flag `lowStock` da listagem, que já é FIXED-only.
9. **O alerta dispara na RESERVA, inclusive em `PENDING_PAYMENT`.** A reserva já bloqueia o item
   para os próximos clientes, então o produto ESTÁ indisponível. Se o sweep devolver o estoque, o
   próximo pedido que cruzar o limiar avisa de novo (correto — cruzou de novo).
10. **Um push por reserva, não um por produto.** Uma Cestinha que zera três produtos é um evento.
11. **Bug encontrado e corrigido: `/notifications/me` engolia `type` e `actionRoute`.** Não estavam
    no response-schema, e `fast-json-stringify` remove o que não está declarado (confirmado
    empiricamente). Resultado: o `getTone`/`getIcon`/`CTA_CONFIG` das duas telas de notificação era
    **código morto** — tudo caía no visual genérico sem botão de ação. É exatamente a armadilha da
    regra de validação dupla, agora com comentário no schema.
12. **Cliente é avisado também quando o ADMIN cancela ou resolve a Cestinha.** Não estava na lista
    da F, mas é o mesmo furo do F1 (o cliente descobre sozinho que o pedido pago desapareceu) e
    reusa o mesmo notificador. `DELIVERED` retroativo **não** avisa — mesma regra do
    `resolveStuckOrder` do pão, que só notifica entrega no dia.
13. **`propagateMarketStatusForOrder` passou a devolver o count** e o aviso de entrega da Cestinha
    deixou de usar `count` por status. O jeito antigo mandava um segundo push quando a Cestinha já
    tinha sido concluída pelo entregador e o pedido de pão era fechado depois.
14. **`LOW_STOCK_THRESHOLD` e `clientLabel` foram para libs.** Dois donos do mesmo número fazem a
    tela dizer "Baixo" sem ninguém ser notificado; dois donos do mesmo rótulo fazem o admin
    traduzir quem é quem em cada aviso.
15. **`data.screen` da véspera era `'pedidos'` (relativo) → `/client/pedidos`.** O
    `useOneSignalDeepLink` navega por rota absoluta; o push de véspera era o único fora do padrão.

### ✅ Onda E — P1 · Cliente 360 (CRM) — CONCLUÍDA (29/07/2026)
> O suporte não tinha **nenhuma** forma de ver uma Cestinha do cliente: detalhe, lista de pedidos e
> timeline liam só `Order`, e os dois extratos de crédito mostravam `MARKET_PURCHASE` cru na tela.
> Verificação: typecheck shared+api+web ✅ · build api ✅ · **477 testes + 3 todo** ✅ (+10)

| # | Tarefa | Estado |
|---|---|---|
| E3 | Rótulos de `MARKET_PURCHASE`/`MARKET_REFUND` nos DOIS extratos | ✅ |
| E1 | `getDetail` — `recentCestinhas` + métricas da Cestinha + `breadsDelivered` com D-1 + `totalSpent` decomposto (D-2) | ✅ |
| E2 | `getOrders` unificado com `kind: BREAD \| CESTINHA` (D-4) | ✅ |
| E4 | Frontend `ClientDetailView` — bloco Além do Pãozin, Cestinhas recentes, lista unificada e cancelamento | ✅ |

**Arquivos tocados:**

*Backend:*
- `admin-clients.service.ts` — `getDetail`: `recentCestinhas` (30 dias, com itens e split) +
  `cestinhasCount`/`cestinhaGmv`/`cestinhaCredits`/`itemsDelivered`, `breadsDelivered` passou a
  somar `MarketOrder.breadQty` DELIVERED (D-1) e `totalSpent` ganhou os recortes
  `spentOnCredits`/`spentOnCestinha` (D-2). `getOrders`: união pão + Cestinha com `kind`,
  `items`/`itemCount`/`totalValue`/`creditsApplied`/`moneyAmount`/`refundedCredits`.
- `admin-clients.route.ts` — response-schemas do detalhe (`recentCestinhas` + 6 métricas novas) e de
  `/orders` (8 campos novos) + summary/description.
- `admin-clients.controller.ts` — repassa `recentCestinhas` no flatten.

*Frontend:*
- `CreditHistoryScreen.tsx` (E3) — `MARKET_PURCHASE`/`MARKET_REFUND` + `REFUND`/`EXPIRY`/
  `ADMIN_DEBIT`, que também faltavam.
- `ClientDetailView.tsx` — `TX_LABEL` += os dois tipos (E3); tipos `ClienteCestinha`/`OrderRow`/
  `ClienteMetrics`; `STATUS_LABEL` += `PENDING_PAYMENT`/`SEPARATED`/`NOT_DELIVERED`; bloco
  **🧺 Além do Pãozin** (novo `MiniStat`); "Última compra" via `ultimaCompra()`; card **Cestinhas
  recentes**; `PedidosPanel` com badge 🧺, itens, estorno, cancelável por `kind` e cancelamento
  roteado para `/admin/market/orders/:id/cancel`; diálogo de cancelamento com texto e toggle
  próprios; `TimelinePanel` discrimina Cestinha.

*Testes:* `admin-clients.service.test.ts` — stub `marketOrder.findMany` que **filtra por status como
o Prisma faria** (uma fixture serve às 3 consultas do `getDetail`) + **10 testes novos**.

**Decisões tomadas durante a implementação:**

1. **`cestinhasCount` e `cestinhaGmv` usam a MESMA população** (`CONFIRMED_MARKET_STATUSES` — exclui
   `PENDING_PAYMENT` e `CANCELLED`). Dois números que o admin lê lado a lado não podem contar
   populações diferentes. **`recentCestinhas` mostra TUDO**, inclusive cancelada e aguardando
   pagamento — ali o propósito é auditoria, e o que caiu é justamente o que se quer investigar.
2. **`breadsDelivered` do CRM passou a somar o `breadQty` da Cestinha entregue (D-1)** — o resto do
   admin já soma desde a Onda A. Antes, um cliente que só compra pela Cestinha aparecia com
   "0 pães entregues" tendo recebido pão todo dia.
3. **`totalSpent` é decomposto por FILTRO, nunca por subtração.** `spentOnCredits` usa
   `excludeNonCreditPurpose` e `spentOnCestinha` usa `purpose=MARKET`; se eu tirasse o MARKET do
   total, um pagamento de gancho (`HOOK`) viraria "compra de crédito". Os dois são recortes de
   `totalSpent`, que continua sendo todo o dinheiro pago.
4. **GMV aparece como "Movimentado", com a frase `movimentado ≠ receita` na própria tela** (D-2).
   Sem o rótulo, o próximo a olhar somaria com "Total gasto" e contaria o mesmo dinheiro duas vezes.
5. **`getOrders` busca `limit` de CADA coleção e corta a janela depois de unir e ordenar** — mesma
   lição da paginação do `getLedger` (Onda C1): as N linhas mais recentes do conjunto unido podem
   vir todas de um lado só. Tem teste.
6. **A linha de Cestinha usa `type: 'MARKET'` e `quantity = breadQty`** (Onda B, decisão 1 + D-1):
   reusar `'SINGLE'` faria a tela chamar uma Cestinha de "Avulso", e o pão dela ocupa o mesmo campo
   do pedido de pão porque **é** pão.
7. **O cancelamento da Cestinha vai para a rota do `admin-market` (C3), não para a do pão.** A rota
   do pão não devolve estoque de produto e o gate dela é `status === 'SCHEDULED'` — usar a mesma
   rota daria 422 numa Cestinha `SEPARATED` e deixaria o produto fora da prateleira.
8. **O toggle de estorno da Cestinha não promete um número.** O total é
   `creditsApplied + ceil(moneyAmount / avulsoUnit)`, calculado no servidor (DEC-36); escrever
   "Devolver N crédito(s)" no front mentiria em todo pedido misto.
9. **`STATUS_LABEL` ganhou os 3 estados que só a Cestinha tem.** `PENDING_PAYMENT`, `SEPARATED` e
   `NOT_DELIVERED` apareceriam como enum cru — o mesmo tipo de furo que o E3 corrigiu no extrato.
10. **"Última compra" considera as duas fontes.** Era `recentOrders[0]`, então quem só compra pela
    Cestinha aparecia como se nunca tivesse comprado nada.
11. **Cestinhas recentes têm card próprio**, separado de "Pedidos recentes" — o número daquele card
    é PÃES, e misturar as duas populações num contador só quebraria o D-1.
12. **A timeline discrimina pelo `kind`** — com a lista unificada, uma Cestinha 100% produtos
    entraria como "Pedido · 0 pães".

### ✅ Onda D — P1 · Financeiro e relatórios — CONCLUÍDA (29/07/2026)
> É onde o **D-2** finalmente virou número. Antes, TODOS os valores do financeiro aplicavam
> `excludeNonCreditPurpose`: o mercadinho não existia no financeiro, a taxa de entrega media só o
> pão, o ranking de condomínios ignorava a receita da Cestinha, o consumo de crédito não contava os
> pãezinhos gastos nela e a saúde do gateway não distinguia recusa de combo de recusa de Cestinha.
> Verificação: typecheck shared+api+web ✅ · build api ✅ · **495 testes + 3 todo** ✅ (+18)

| # | Tarefa | Estado |
|---|---|---|
| D1 | `getRevenue` — `market: { revenue, gmv, moneyPart, creditPart, credits, orders }` + `totalConsolidated` (D-2) | ✅ |
| D2 | Painel — receita consolidada no KPI + linha da Cestinha no card de receita por tipo | ✅ |
| D3 | `getDeliveryReport` — pão + Cestinha, com `byKind` | ✅ |
| D4 | `getCondominiumRanking` — receita consolidada, `breadsDelivered` com D-1 e coluna `cestinhaGmv` | ✅ |
| D5 | `getRetentionReport` — `creditsConsumed` += `MARKET_PURCHASE`; `withDelivery` inclui Cestinha | ✅ |
| D6 | `getPaymentsReport` — `byPurpose` (CREDITS / HOOK / MARKET), cada um com sua taxa de aprovação | ✅ |
| D7 | Frontend — 7 telas | ✅ |

**Arquivos tocados:**

*Backend:*
- `admin-financial.service.ts` — interface `MarketRevenue`, agregações da Cestinha, `totalConsolidated`,
  `byCondominium` virou **união** das duas fontes com `cestinhaGmv`, helper `round2`.
- `admin-financial.route.ts` — `market`, `totalConsolidated` e `cestinhaGmv` no response-schema.
- `admin-reports.service.ts` — `DeliveryCounts` + `byKind` no relatório de entregas (com `tally` e
  `mergeReasons`); ranking com `creditRevenue`/`marketRevenue`/`cestinhaGmv` e pão da Cestinha;
  retenção com `MARKET_PURCHASE` e `withDelivery` unindo as duas fontes; `byPurpose` em pagamentos.
- `admin-reports.route.ts` — 4 descrições atualizadas (**as rotas de relatório não têm
  response-schema**, então os campos novos passam direto; documentar era o que faltava).
- `admin-orders.service.ts` / `admin-orders.route.ts` — dashboard += `marketToday` e
  `revenueTodayConsolidated`, com schema (aqui **tem** response-schema, o campo seria engolido).

*Frontend:*
- `AdminFinanceiro.tsx` — card grande mostra o **consolidado** com a composição embaixo; novo card
  **🧺 Além do Pãozin** (receita nova · movimentado · pago em pãezinhos, cada linha com a sua dica)
  via novo `RevenueLine`; GMV ao lado de cada condomínio + legenda.
- `AdminPainel.tsx` — KPI "Receita do dia" consolidado, com o GMV como `sub`; linha da Cestinha no
  card "Receita por tipo", fora da barra proporcional.
- `RelEntregas.tsx` — card "Por tipo de pedido" (taxa e finalizadas de pão × Cestinha) + 6 linhas no CSV.
- `RelCondominios.tsx` — composição da receita e GMV na linha + CSV com 4 colunas novas.
- `RelPagamentos.tsx` — card "Por finalidade" com taxa de aprovação por fluxo + CSV.
- `RelRetencao.tsx` / `RelDesperdicio.tsx` — notas explicando o que entra em cada número.

*Testes:*
- `admin-financial.service.test.ts` — mock passou a **despachar pelo `where`** + **6 testes novos**.
- `admin-reports.market.service.test.ts` (**novo**) — **12 testes** cobrindo D3..D6.

**Decisões tomadas durante a implementação:**

1. **A janela da Cestinha é a da COMPRA (`createdAt`), não a da entrega.** É assim que
   `market.revenue` (que vem de `Payment`) e `market.gmv` (que vem de `MarketOrder`) medem o mesmo
   período e reconciliam entre si. No ranking, o pão entregue continua pela janela da ENTREGA,
   porque é com o `breadGroups` do pão que ele precisa bater.
2. **`creditPart = gmv − moneyPart`, não `creditsApplied × avulsoUnit`.** Por construção do checkout
   a diferença é exata, e assim o número não depende do preço avulso de HOJE — que pode ter mudado
   desde a compra e reescreveria o passado.
3. **`total` e `byType` do financeiro ficaram INTOCADOS.** O consolidado é campo novo; quem já lia
   esses números não vê valor mudar. Tem teste fixando isso.
4. **`byCondominium` virou UNIÃO das duas fontes.** Um condomínio que só comprou Cestinha não tem
   `Payment` de crédito no período e simplesmente desaparecia da quebra. Tem teste.
5. **GMV por condomínio sai de `groupBy` em `MarketOrder.condominiumId`** (campo denormalizado), sem
   o `$lookup` em `User` que a receita de crédito é obrigada a fazer.
6. **O relatório de entregas conta PEDIDOS, não paradas** — apesar do D-5. Numa parada combinada, o
   pão e a Cestinha falham de forma independente (pode faltar um item com o pão entregue), e contar
   por parada esconderia justamente a falha do mercadinho. `byKind` mantém a série histórica do pão
   legível ao lado da nova.
7. **`PENDING_PAYMENT` fica fora do relatório de entregas**: carrinho abandonado não é entrega
   pendente, e o sweep pode cancelá-lo a qualquer minuto (Onda F1).
8. **Motivos de falha/cancelamento somam por TEXTO entre as duas coleções.** "Cliente ausente"
   derruba a parada inteira — duas linhas iguais no relatório seriam ruído, não informação.
9. **No ranking, `revenue` virou a receita CONSOLIDADA e é ela que ordena**, com `creditRevenue` e
   `marketRevenue` visíveis: um condomínio que subiu por causa da Cestinha não pode parecer que
   vendeu mais crédito.
10. **A receita da Cestinha por condomínio vem de `moneyAmount`**, não de um segundo pipeline em
    `Payment`: um pedido fora de `PENDING_PAYMENT` é um pedido cujo dinheiro entrou, e assim o
    número reconcilia com o `market.moneyPart` do financeiro.
11. **`creditsConsumed` passou a somar `MARKET_PURCHASE`.** Sem isso, quem troca pãezinhos por bolo
    aparecia como quem não consome nada, e o indicador "vendidos × consumidos" — que mede se o
    crédito virou entrega ou virou passivo — mentia na direção mais perigosa.
12. **`withDelivery` usa `Set`, não soma.** Quem recebeu pão E Cestinha é um cliente ativado, não dois.
13. **`byPurpose`: `purpose: null` → `CREDITS`** (compra de crédito nunca seta o campo); `amount`
    conta só os PAID (pendente/recusado não é dinheiro); finalidade sem pagamento no período não
    aparece na lista, em vez de mostrar uma linha de zeros.
14. **O mock do financeiro passou a despachar pelo `where`** em vez de uma cadeia posicional de
    `mockResolvedValueOnce`. A onda acrescentou um 4º `payment.aggregate` e o mock quebrou por
    POSIÇÃO, não por comportamento — um teste assim reprova refatoração legítima.
15. **No painel, o GMV entra como `sub` do KPI, nunca no valor**, e a linha da Cestinha fica FORA da
    barra proporcional de "receita por tipo" (que só tem receita de crédito). Somar ali seria
    exatamente a contagem dupla que o D-2 proíbe.

### ✅ Onda H8 — P1 · RESTOCK: reposição de inventário — CONCLUÍDA (29/07/2026)
> Não existia **nenhum** caminho para comprar reposição de produto `FIXED` (geleia, café): o pedido
> ao fornecedor é sempre por turno e derivado da demanda do dia — o que não faz sentido para
> inventário (não se compra 3 potes porque 3 pessoas pediram hoje; repõe-se quando acaba).
> Verificação: typecheck shared+api+web ✅ · build api ✅ · **514 testes + 3 todo** ✅ (+19)

| # | Tarefa | Estado |
|---|---|---|
| H8.1 | `lib/restock-demand.ts` — candidatos e quanto comprar (cobertura × ritmo de venda) | ✅ |
| H8.2 | `GET /admin/supplier-orders/restock-suggestion` — sugestão × matriz × rateio | ✅ |
| H8.3 | `POST /admin/supplier-orders/restock` — cria e finaliza `kind: RESTOCK`, sem turno | ✅ |
| H8.4 | PDF/Excel de reposição (título próprio, sem linha de pães) | ✅ |
| H8.5 | Frontend — 5ª seção "Reposição" no hub + RESTOCK no histórico de compras | ✅ |

**Arquivos tocados:**

*Novos:* `lib/restock-demand.ts` (`buildRestockCandidates`, `RESTOCK_WINDOW_DAYS`,
`RESTOCK_COVER_DAYS`) · `lib/__tests__/restock-demand.test.ts` (9) ·
`admin-supplier-orders/__tests__/restock.service.test.ts` (10) ·
`apps/web/src/pages/admin/gestao/MarketReposicao.tsx`.

*Backend:* `admin-supplier-orders.service.ts` — `getRestockSuggestion` + `createRestock`; `kind`
passou a ir para os geradores. `admin-supplier-orders.schema.ts` — `CreateRestockSchema` +
`RestockSuggestionQuerySchema`. `.controller.ts` — 2 handlers. `.route.ts` — 2 rotas **estáticas
antes das `/:id`** + `kind`/`totalItems`/`totalValue` no response-schema do histórico.
`pdf-generator.ts` / `excel-generator.ts` — título "Reposição de Estoque" e sem a linha de pães.

*Frontend:* `AdminMarket.tsx` (seção "Reposição") · `SupplierOrderHistory.tsx` (ícone, rótulo
"Reposição" no lugar do turno, itens e valor).

**Decisões tomadas durante a implementação:**

1. **`totalQuantity: 0` SEMPRE no RESTOCK.** Esse campo é "pães" e o `getWasteReport` compara ele com
   os pães entregues (decisão 4 da Onda H1–H7): 20 potes de geleia ali dentro fariam o relatório
   acusar 20 pães no lixo. As unidades vão em `totalItems`. Tem teste.
2. **`slotId: null` é o que mantém o RESTOCK fora do resto da operação de graça.**
   `getGeneratedStatus`/`getSlotsStatus` filtram por `slotId` e o gate da Separação descarta
   `slotId` nulo (`.filter(s => !!s)`) — conferido, nenhuma mudança foi necessária nesses lugares.
   Uma compra de geleia não pode fazer a tela dizer "pedido do turno gerado" nem abrir separação.
3. **A sugestão é por COBERTURA, não por "bateu no limiar".** Ritmo de venda dos últimos 30 dias ×
   dias a cobrir − estoque. O alerta do F5 diz que está baixo; isto diz **quanto comprar**.
4. **Sem venda medida, a sugestão é um piso declarado (`basis: 'FALLBACK'`), e a tela diz isso.** Um
   produto esgotado há semanas vende zero **justamente porque está esgotado** — sugerir 0 seria a
   pior resposta possível, e sugerir uma projeção seria inventar dado.
5. **`coverDays` é escolha do admin** (7/15/30/60 na tela), não constante escondida no código.
6. **Só produto `FIXED`, e o pão é barrado explicitamente.** `DAILY` reseta capacidade todo dia —
   "inventário" ali não significa nada; o pão se compra pela demanda do turno.
7. **Sem linha na matriz → 409** (mesma regra do `create`): não inventar custo para um fornecedor que
   não fornece aquele produto (D-8).
8. **Finaliza na hora**, como o `create`: o admin está comprando, não redigindo rascunho — e
   `getHistory` só lista FINALIZED, então um DRAFT ficaria invisível.
9. **O documento não fala de pão.** Título "Reposição de Estoque" e sem `Paes: 0` no cabeçalho — uma
   ordem de compra de geleia com "Paes: 0" faz o fornecedor duvidar do pedido.
10. **"Reposição" virou seção do hub Além do Pãozin, ao lado de Produtos** — é a ação que o alerta de
    estoque baixo (F5) pede; enfiá-la em Fornecedores deixaria o caminho invisível.
11. **O front NÃO recalcula rateio nem custo** (mesma decisão 1 da Onda H1–H7): a tela mostra o que o
    servidor sugeriu e envia a quantidade final.

### ✅ Onda H9 — P1 · Custo e margem — CONCLUÍDA (29/07/2026)
> Com a matriz de fornecimento preenchida (D-8), o custo finalmente existe — e com ele CMV, margem
> por produto e margem da Cestinha. Fecha o D-2 com o outro lado do caixa.
> Verificação: typecheck shared+api+web ✅ · build api ✅ · **529 testes + 3 todo** ✅ (+15)

**Arquivos tocados:**

*Novos:* `lib/product-cost.ts` (`loadUnitCosts`, `productMargin`) ·
`lib/__tests__/product-cost.test.ts` (11).

*Backend:* `admin-market.service.ts` — `listProducts`/`getProduct` passam por `withCost`
(`unitCost`/`costBasis`/`costSuppliers`/`margin`/`marginPct`). `admin-financial.service.ts` —
`market.cmv`/`margin`/`marginPct`/`unitsWithoutCost` + `purchases { total, breadCost, itemsCost,
orders }`, com os privados `computeMarketCmv` e `computePurchases`. `admin-financial.route.ts` —
schema dos campos novos.

*Frontend:* `MarketProdutos.tsx` — custo e margem em cada produto (ou "custo não cadastrado").
`AdminFinanceiro.tsx` — CMV e margem no card da Cestinha + card **Compras ao fornecedor**.

*Testes:* `admin-financial.service.test.ts` — mock estendido + **5 testes** (CMV com pão, margem
parcial, sem venda, compras por tipo, sem compra).

**Decisões tomadas durante a implementação:**

1. **O custo do produto é a média das linhas ativas PONDERADA por `defaultSharePct`** — não média
   simples nem "custo do preferido". A fatia é a proporção em que a demanda daquele produto é
   realmente comprada; média simples mentiria sobre o mix (75/25 entre R$ 10 e R$ 20 dá R$ 12,50,
   não R$ 15).
2. **CMV não sai do histórico de compras** porque o sistema **não rastreia lote**: um
   `PurchaseOrderItem` diz quanto se pagou por 40 potes num dia, não qual pote saiu em qual
   Cestinha. Amarrar CMV a histórico exigiria controle de lote e daria um número igualmente
   aproximado com muito mais máquina. O custo esperado é aproximado e **honesto sobre isso**
   (`basis`).
3. **Produto sem linha na matriz NÃO recebe custo zero** — fica fora do mapa, e quem consome conta
   as unidades em `unitsWithoutCost`. Zero apareceria como margem de 100%: a mentira mais
   confortável possível. A tela mostra "margem PARCIAL — N un. sem custo cadastrado".
4. **Σ fatias = 0 → custo de quem levaria tudo no rateio** (preferido, senão o primeiro): a mesma
   regra do motor de rateio, então o CMV concorda com o que a compra vai custar de fato.
5. **Fornecedor inativo sai da conta sem apagar a linha** — mesma regra do rateio (o custo
   cadastrado fica lá para quando ele voltar).
6. **O CMV inclui o pão da Cestinha** (D-1: é pão, e pão tem custo). Deixá-lo fora inflaria a margem
   exatamente nos pedidos com mais pão.
7. **A margem é sobre o GMV, não sobre a receita nova.** O custo existe independentemente de o
   cliente ter pagado em dinheiro ou em pãezinhos — medir margem só sobre a receita nova daria
   margem infinita numa Cestinha 100% crédito.
8. **`purchases` usa `PurchaseOrderItem.unitPrice` (custo PAGO), não o custo esperado.** Ali a
   pergunta é "quanto saiu do caixa", não uma projeção. Inclui as reposições (H8) — é gasto igual.
   Item legado sem `productId` conta como pão (era o único produto que o sistema sabia comprar).
9. **A margem por produto aparece na LISTA de produtos**, onde o preço é definido — era ali que o
   admin precificava no escuro. O pão fica de fora (preço travado, não é venda de mercadinho).
10. **Compras ficam em card próprio**, fora do bloco da Cestinha, para não serem lidas como receita
    negativa dentro dele.

### ✅ Onda G — P2 · Estoque, preparo e desperdício dos itens — CONCLUÍDA (29/07/2026)
> A última onda. Fecha o furo com efeito em dinheiro que tinha sobrado: uma Cestinha não entregue
> deixava o produto "vendido" para sempre, sem caminho para devolver estoque ou crédito.
> Verificação: typecheck shared+api+web ✅ · build api ✅ · **549 testes + 3 todo** ✅ (+20)

| # | Tarefa | Estado |
|---|---|---|
| G2 | Política explícita de estoque e crédito em `NOT_DELIVERED` + caminho para resolver | ✅ |
| G1 | Painel "comprometido por produto/dia" (preparo e compra) | ✅ |
| G4 | Desperdício dos itens do mercadinho, com valor em R$ | ✅ |
| G3 | ~~Campo de custo em `Product`~~ — substituído pela Onda H9 (custo em `SupplierProduct`, D-8) | ✅ |

**Arquivos tocados:**

*Schema:* `MarketOrder` += `lossResolvedAt`/`lossResolvedBy`/`stockReturned`/`lossReason`.
**Sem impacto de deploy** (campos opcionais no Mongo, nenhum índice novo; o `prisma db push` do
playbook cobre).

*Backend:* `admin-market.service.ts` — `resolveNotDelivered()` + `getStockOutlook()`;
`AdminMarketOrderRow` += campos de perda e `lossPending`. `admin-market.schema.ts` —
`ResolveNotDeliveredSchema`. `.controller.ts` / `.route.ts` — `POST /admin/market/orders/:id/
resolve-loss` e `GET /admin/market/stock-outlook`. `market-notify.ts` —
`notifyMarketLossResolved`. `admin-reports.service.ts` — `WasteReport.items` + `itemWaste()`.

*Frontend:* `MarketPreparo.tsx` (**novo**, seção "Preparo" no hub) · `MarketCestinhas.tsx` (filtro
"Não entregues", selo **Resolver perda**, fluxo de desfecho) · `AdminMarket.tsx` (6ª seção) ·
`RelDesperdicio.tsx` (card "🧺 Itens do mercadinho" + CSV).

*Testes:* `admin-market/__tests__/resolve-loss.service.test.ts` (8) ·
`admin-market/__tests__/stock-outlook.service.test.ts` (6) ·
`admin-reports/__tests__/item-waste.service.test.ts` (6).

**Decisões tomadas durante a implementação:**

1. **O furo real do G2 não era "não devolve estoque" — era o BECO SEM SAÍDA.** `NOT_DELIVERED` é
   status terminal, então a Cestinha saía do radar de "parados" (`getStuck` só olha não-terminais) e
   o `resolveStuckMarketOrder` a recusava com 422. Não existia **nenhum** caminho para devolver
   estoque ou crédito depois que o entregador marcava a falha.
2. **A política é: nada volta automaticamente — e isso é deliberado.** O produto saiu para a rua;
   pode ter voltado com o entregador ou ter se perdido, e só quem o recebeu de volta sabe (mesma
   razão da decisão 4 da Onda B). Estornar automático daria pãezinhos de volta até quando o cliente
   ficou com a mercadoria. As duas coisas são escolha **explícita** — no Zod, `returnStock` e
   `refundCredits` são obrigatórios e **sem default**: ninguém decide por omissão.
3. **`ProductDailyStock.reserved` NUNCA é liberado.** Ele é a capacidade *daquele dia*, que já
   passou: aquelas unidades foram de fato comprometidas. Liberar reescreveria a história de um dia
   fechado sem abrir vaga para ninguém (a chave é produto+data). Só estoque `FIXED` volta.
4. **O status e o motivo originais da falha ficam intactos.** O que o entregador escreveu na porta
   ("cliente ausente") é o registro do que aconteceu; o desfecho vai em `lossReason`. Por isso
   `resolveNotDelivered` **não** reusa `reverseMarketOrder` inteiro (ele reescreve
   status/`failedAt`/`failureReason`) — reusa só `refundableCredits`, que é a parte delicada da
   matemática. Tem teste garantindo que o update não toca nesses três campos.
5. **`lossResolvedAt` é o que torna a pendência VISÍVEL** (`lossPending` na listagem, selo "Resolver
   perda", filtro "Não entregues"). Sem um marcador, não havia como distinguir resolvido de não
   resolvido — e o estoque seria devolvido duas vezes na segunda tentativa.
6. **Idempotente por `lossResolvedAt`** (e o estorno também por `referenceId`): resolver de novo
   devolve o estado sem creditar nem devolver estoque outra vez.
7. **O cliente só é avisado quando houve estorno de fato.** O aviso de F3 já deu a má notícia; um
   segundo push sem dinheiro de volta só repetiria o problema.
8. **G1 mostra DOIS números por produto/dia, e a diferença é informação.** `confirmed` (pedido que
   existe — é por ele que se prepara) × `reserved` (capacidade do dia, que inclui carrinho
   aguardando pagamento — é por ele que se sabe se ainda dá para vender). `reserved − confirmed` é
   exatamente o que está preso em pagamento pendente, e a tela diz isso.
9. **G1 lista só o que tem movimento** (ou está sem vaga): o catálogo inteiro × 7 dias seria ruído.
   Produto **sem vaga com 0 confirmado aparece** — é venda perdida, o oposto de irrelevante.
10. **G4: falha sem desfecho vai para `pending`, não para `lost`.** Enquanto ninguém apurou se o
    produto voltou, chamar aquilo de prejuízo seria inventar número — o mesmo princípio do
    `unitsWithoutCost` do financeiro (H9). Produto perdido sem custo cadastrado conta unidade e
    **não** inventa valor.
11. **A série de itens é separada da do pão no mesmo relatório (D-1).** O bloco do pão continua
    intacto (`ordered`/`delivered`/`waste`); comparar potes de geleia com pães comprados não
    significa nada. Tem teste fixando que o lado do pão não mudou.

### ✅ Extra — Automação do `prisma db push` no pipeline (29/07/2026)
> Não estava no plano; virou necessário ao descobrir, ao responder "isso precisa rodar em produção?",
> que o passo mais crítico do deploy dependia de alguém lembrar.

**O achado:** MongoDB não tem migrações do Prisma. O `prisma generate` — o único que rodava no
[Dockerfile:22](../apps/api/Dockerfile#L22) e no [mainBackend.yml:24](../.github/workflows/mainBackend.yml#L24)
— gera só o client TypeScript e **não cria índice nenhum**. Quem cria é o `prisma db push`, que
existia apenas como item do checklist do README. Ou seja: os índices declarados no schema podiam
nunca ter existido no Atlas — inclusive o `MarketOrder.idempotencyKey @unique`, que o checkout da
Cestinha usa via `catch P2002` para travar duplo-clique (sem o índice, o P2002 nunca dispara e a
proteção cai no `findUnique`, que tem janela de corrida).

**Arquivos tocados:** `ansible/playbook.yml` (4 tasks novas após o `up -d`), `README.md` (checklist
de deploy e exemplo do Docker).

**Decisões:**
1. **No Ansible, não no GitHub Actions.** O Atlas filtra por IP e só a VPS está liberada; um runner
   do GitHub tem IP dinâmico e exigiria abrir `0.0.0.0/0` no cluster.
2. **Dentro do container.** A imagem já tem o CLI do Prisma (o `npm install` do stage *installer*
   traz devDependencies), o schema em `apps/api/prisma`, o `WORKDIR` correto e o `DATABASE_URL`.
   Nenhum secret novo.
3. **Depois do `up -d`.** O app funciona sem os índices; se rodasse antes, uma falha transitória
   deixaria o serviço fora do ar (o `compose down` já aconteceu). Depois, a falha aparece vermelha
   no Actions com a aplicação servindo.
4. **SEM `--accept-data-loss`.** A flag autoriza derrubar índices que existem no Atlas e não estão no
   schema. Se o passo falhar por isso, é sinal de índice criado à mão — melhor revisar que apagar.
5. **Nome do serviço descoberto em runtime** (`docker compose config --services`): o
   `docker-compose.yml` de produção vive na VPS, fora do repo. Override opcional: `api_service` no
   `ansible/variables.yml`.

### ✅ Extra — Correção: parada com VÁRIAS Cestinhas ficava pela metade (29/07/2026)
> Não estava no plano. Bug reportado pelo usuário na tela do entregador: confirmou a entrega, a
> parada saiu da lista, e no refresh ela **voltou** com parte dos produtos ainda pendente.

**A causa (um padrão, dois lugares):** o cliente pode ter **mais de uma Cestinha no mesmo turno**, e
as telas fundem tudo numa parada só (uma campainha, um cupom). Só que ambos os agregadores guardavam
**apenas o id da primeira** Cestinha, e a ação era aplicada por id — as outras ficavam para trás:

1. **Separação (admin).** `toggleOrder` tinha `if (!order.orderId) return` e o checkbox estava
   `disabled`: parada só-Cestinha nem alternava (separava apenas no "Concluir"). Clicar não fazia
   nada — foi o sintoma relatado primeiro.
2. **Entrega (entregador).** `aggMarket` guardava `marketOrderId: m.id` (a primeira) e
   `confirmMarketDelivery` fazia `update` por id → 1 de N Cestinhas concluída; as demais voltavam
   para a rota ativa. Parada **combinada** (pão + Cestinha) nunca teve o problema: o
   `propagateMarketStatusForOrder` sempre usou `updateMany` por escopo.

**Achados vizinhos, no mesmo código:** `aggMarket` agrupava por `userId` **sem o turno** — Cestinha
da tarde caía na parada da manhã (itens no lugar errado, pães contados 2×) e a parada só-Cestinha da
tarde **desaparecia** da rota quando o cliente tinha pão na manhã; a aba "Realizadas" fundia
`DELIVERED` com `NOT_DELIVERED` numa linha e mostrava o status da primeira; e o cupom de parada
só-Cestinha (QR = `marketOrderId`) sempre batia em `/courier/orders/:id` → 404.

**Arquivos tocados:**
- `lib/market-pipeline.ts` — novo `completeMarketStop` (desfecho por **escopo**: cliente +
  condomínio + turno + dia, com guard `courierId` + `status: OUT_FOR_DELIVERY`).
- `courier.service.ts` — `confirmMarketDelivery`/`markMarketNotDelivered` usam o escopo (+
  `loadOwnMarketStop` para 404/403/422); `aggMarket` passa a chavear por `userId|slotId`
  (+ `|status` nas concluídas) e a guardar `marketOrderIds[]`.
- `courier.schema.ts` + `courier.route.ts` — `marketOrderIds` no tipo e no **response-schema**.
- `admin-separation.service.ts` / `.schema.ts` / `.route.ts` / `.controller.ts` — `marketOrderIds[]`
  no board + `PATCH /admin/separation/market-orders` (`{marketOrderIds, separated}`).
- Front: `AdminSeparacao.tsx` (toggle da Cestinha + `patchOrder` por `orderId || marketOrderId`),
  `CourierScreen.tsx` (scanner escolhe a rota pão/Cestinha), `StopRow.tsx`,
  `CourierCompletedList.tsx`, `ConfirmDeliveryDialog.tsx`.
- Testes: `courier.service.test.ts` (+8) e `admin-separation.service.test.ts` (+6) → **563 passando
  + 3 todo** (piso novo).

**Decisões:**
1. **Desfecho por escopo, não por lista de ids.** O id recebido só *endereça* a parada; o backend
   expande para todas as Cestinhas dela. Isso corrige **sem depender do app** (PWA em cache ganha a
   correção), é imune a id velho na tela e pega Cestinha despachada depois do carregamento.
2. **Notificação ao cliente só se `count > 0`** — mantém a regra da Onda F (avisar a transição, não
   o estado), evitando aviso duplicado quando outro caminho já concluiu.
3. **Parada = cliente + turno** em toda agregação da Cestinha. No admin a Separação já era por
   turno; era só o app do entregador que ignorava o slot.
4. **Realizadas separam o desfecho.** Cestinha com desfecho diferente do pão vira a própria linha em
   vez de ficar escondida sob o status do pão — a operação precisa ver o que falhou.
5. **`setSeparated` não ganhou propagação própria** — o `updateOrderStatus` já chama
   `propagateMarketStatusForOrder` com o mesmo escopo (era código redundante, removido).
6. **Cestinhas presas do teste não precisam de script:** o entregador reabre a rota e confirma a
   parada de novo; o escopo pega as que sobraram.

### ✅ Extra — Hierarquia visual dos menus do hub "Além do Pãozin" (29/07/2026)
> Reportado pelo usuário: "os menus dos filtros ficaram muito iguais e fica bem confuso".

**O achado:** as duas fileiras eram a **mesma espécie visual**. Seções (nível 1) e filtros (nível 2)
usavam pílula `radius 999`, borda `1.5px`, ativo com texto/borda `--color-accent` — diferindo só em
**4px de altura e 1pt de fonte**. Sem separador entre elas, com scrollbar nativa visível na fileira
de seções e corte no meio de "Categorias" sem nenhuma affordance de rolagem.

**Arquivos novos:**
- `hooks/useDragScroll.ts` — rolagem por clicar-e-arrastar (mouse). Extrai o padrão que existia
  inline no `MarketCatalog` do cliente (aquele **não** foi migrado: é tela crítica sem teste; a
  migração é um follow-up opcional).
- `components/admin/SectionTabs.tsx` — nível 1: texto + sublinhado `--color-gold` de 3px sobre uma
  hairline que atravessa a tela, `role=tablist/tab`, fade só do lado com conteúdo escondido
  (`ResizeObserver` + `onScroll`), `scrollIntoView` da aba ativa.
- `components/admin/FilterChips.tsx` — nível 2: chip 30px **sem borda** (fundo `surface-2`),
  selecionado por **preenchimento** espresso, `aria-pressed`.

**Aplicado em:** `AdminMarket.tsx` (fileira de seções), `MarketCestinhas.tsx` e `MarketProdutos.tsx`
(filtros; o `FilterChip` local do Produtos foi removido).

**Decisões:**
1. **Nível 1 deixa de ser pílula** (escolha do usuário entre 3 opções). Trocar só a cor do ativo
   manteria a mesma forma do filtro — resolveria menos.
2. **`Config` fica na fileira** (o usuário preferiu manter em vez de virar engrenagem no AppBar).
3. **Sem contagem nos chips.** A linha "N Cestinhas · mostrando X" já vive abaixo da busca;
   duplicar o número exigiria um agregado por status no backend sem ganho real.
4. **`AdminGanchos` e `AdminClientes` NÃO foram tocados** — têm a mesma colisão (duas fileiras de
   pílulas idênticas) e podem adotar `SectionTabs`/`FilterChips` quando fizer sentido.

### ⏸️ Próximas ondas (não iniciadas)

**Nenhuma.** Todas as ondas do plano (A..H9) estão concluídas.

> 📌 **Follow-ups conhecidos que ficaram FORA do escopo desta integração** (não são pendências dela):
> - **Reconciliação de Cestinhas antigas presas em `SCHEDULED`** de dias passados (risco listado no
>   §5 do plano). Agora elas são visíveis (`getStuck`, Onda B4) e resolvíveis uma a uma
>   (`resolveStuckMarketOrder`, B5); um script de reconciliação em lote continua sendo opcional.
> - **Contas admin individuais** (ver a memória `admin-multi-session`) — nada a ver com a Cestinha.
> - **Cron de reconciliação de pagamentos** (ver `pix-webhook-followups`) — idem.

---

## 5. Cenários de verificação manual (do plano §6)

1. Cestinha com `breadQty > 0` em dia sem pão → o dia sai de "sem agendamentos" e o `Gerar direto`
   inclui os pães.
2. Cestinha 100% produtos (sem pão) → aparece na Separação (D-3) e ganha entregador (Onda B).
3. Parada combinada pão + Cestinha → **1** entrega nos contadores, não 2 (D-5).
4. Cestinha de dia passado sem desfecho → conta em "parados" e é resolvível (Onda B).
5. Cestinha paga 100% em crédito → GMV sim, receita não (D-2).
6. Pão 75/25 entre dois fornecedores **continua** 75/25 após o backfill (Onda H).
7. Bolo com 2 fornecedores 50/50 → demanda 7 gera 4/3 (resto para o `isPreferred`).
8. Fornecedor que não fornece geleia não aparece como opção nem tem custo cadastrável.
9. Produto com demanda e sem fornecedor → geração manual bloqueada com mensagem acionável.
10. PDF com `?supplierId=` mostra só os produtos e custos daquele fornecedor.

Cenários da Onda F (notificações):

11. Cestinha com Pix, deixada sem pagar 30+ min → em até 1 min o cliente recebe "Cestinha
    cancelada", dizendo quantos pãezinhos voltaram (ou "nada foi cobrado"); o admin **não** recebe
    nada. Deixar o cron rodar de novo **não** manda um segundo aviso.
12. Cliente com pão E Cestinha para amanhã no mesmo turno → às 21h chega **um** push
    ("N pães e sua Cestinha (M itens) às HH:MM amanhã"), não dois.
13. Cliente só com Cestinha amanhã → passa a receber véspera (antes: nenhum aviso).
14. Cestinha paga (Pix aprovado) → os admins recebem "Nova Cestinha · Fulano · Apto X · 🧺 N itens ·
    M 🥖 · DD/MM". Cestinha 100% crédito avisa na hora do checkout.
15. Parada só-Cestinha marcada como não entregue pelo entregador → o cliente é avisado.
16. Produto FIXO caindo de 6 para 4 unidades numa Cestinha → admins recebem "estoque baixo";
    a Cestinha seguinte (4 → 3) **não** repete o aviso. Zerar dispara "esgotou".
17. Abrir o sino de notificações (cliente e admin): os ícones/cores/CTAs agora variam por tipo —
    antes tudo aparecia com o ícone genérico e sem botão de ação.

Cenários da Onda E (CRM):

18. Extrato de créditos do cliente e o do admin → a linha da Cestinha aparece rotulada
    ("Cestinha — Além do Pãozin" / "Cestinha"), não mais `MARKET_PURCHASE`.
19. Cliente que só compra pela Cestinha → "Pães entregues" deixa de ser 0, "Última compra" mostra a
    data certa e o bloco **🧺 Além do Pãozin** aparece com Cestinhas · Movimentado · Itens entregues.
20. Admin › Cliente › aba Pedidos → pão e Cestinha na MESMA lista, com 🧺, itens e valor; cancelar
    uma Cestinha `SEPARATED` funciona (vai pela rota do mercadinho), devolve estoque, estorna em
    pãezinhos e o cliente recebe o aviso (Onda F).
21. Cliente com Cestinha cancelada → a linha mostra "estornado N 🥖" e o botão Cancelar não aparece.
22. Aba Atividade → a Cestinha aparece como "🧺 Cestinha · N itens" com o valor, nunca
    "Pedido · 0 pães".

Cenários da Onda D (financeiro e relatórios):

23. Cestinha de R$ 30 paga com R$ 6 + 4 🥖 → Financeiro mostra receita nova R$ 6, movimentado R$ 30
    e "pago em pãezinhos R$ 24"; o card grande soma **só** os R$ 6 à receita de crédito.
24. Cestinha 100% em pãezinhos → movimentado sobe, **receita não** (D-2: é o correto, não é bug).
25. Condomínio que só compra Cestinha → aparece na quebra por condomínio do Financeiro e no ranking
    de Condomínios (antes: invisível nos dois).
26. Relatório de Entregas → card "Por tipo de pedido" com a taxa de pão e a de Cestinha separadas;
    "Cliente ausente" nos dois lados aparece como UMA linha somada.
27. Relatório de Pagamentos → card "Por finalidade": se a Cestinha estiver reprovando cartão, a taxa
    dela aparece sozinha (antes ficava diluída na média geral).
28. Relatório de Retenção → "Créditos consumidos" passa a incluir os pãezinhos gastos em Cestinha.
29. Painel → KPI "Receita do dia" consolidado, com "🧺 R$ X movimentados" embaixo.

Cenários da Onda H8–H9 (RESTOCK + custo/margem):

30. Geleia com 4 em estoque e 30 vendidas em 30 dias → aba **Reposição** sugere 26 (cobertura 30d) e
    7 na cobertura de 7 dias; ajustar a quantidade e comprar cria o pedido.
31. Produto de estoque esgotado e SEM venda no mês → aparece com "sem venda nos últimos 30 dias —
    sugestão mínima", nunca com sugestão 0.
32. Produto de reposição sem fornecedor cadastrado → banner amarelo na tela, não desaparece.
33. Pedido de reposição criado → aparece no histórico de compras como "Reposição" (sem turno), com
    itens e valor; o PDF sai com o título "Reposição de Estoque" e **sem** linha de pães.
34. Relatório de desperdício **não muda** depois de um RESTOCK (o `totalQuantity` dele é 0).
35. Tentar repor pão ou um produto de capacidade diária (bolo) → recusado com mensagem explicando
    que aquilo se compra pela demanda do turno.
36. Lista de produtos → cada um mostra "custo R$ X · margem R$ Y (Z%)", e "custo não cadastrado" em
    quem não tem fornecedor.
37. Produto com dois fornecedores 75/25 (R$ 10 e R$ 20) → custo exibido R$ 12,50, não R$ 15.
38. Financeiro → card da Cestinha ganha CMV e Margem; vendendo item sem custo cadastrado, a margem
    vem marcada como **PARCIAL** com a contagem de unidades sem custo.
39. Financeiro → card **Compras ao fornecedor** com o gasto separado em pão × produtos (inclui as
    reposições), pelo custo pago.

Cenários da Onda G (estoque, preparo e desperdício):

40. Entregador marca uma Cestinha como não entregue → ela aparece na aba **Cestinhas › Não
    entregues** com o selo "Resolver perda" (antes: sumia do admin para sempre).
41. Resolver com "produtos voltaram" + "devolver pãezinhos" → estoque FIXO volta, cliente recebe os
    pãezinhos (inclusive a parte em dinheiro convertida) e é avisado.
42. Resolver como perda real (sem devolver nada) → registrado como perda; o desfecho fica no detalhe.
43. Resolver a MESMA Cestinha duas vezes → nada é creditado nem devolvido de novo.
44. Aba **Preparo** → por dia, o confirmado de cada produto, as vagas restantes e quanto está preso
    em carrinho aguardando pagamento; produto sem vaga aparece mesmo com 0 confirmado.
45. Relatório de Desperdício → card "🧺 Itens do mercadinho" com comprometido/entregue/perdido em
    unidades e R$; enquanto a perda não tem desfecho, fica em "sem desfecho", não em prejuízo.
46. A parte do PÃO do relatório de desperdício continua idêntica (D-1).
47. Cliente com **2+ Cestinhas no mesmo turno**: na Separação o check da parada marca/desmarca todas;
    na Entrega, confirmar a parada conclui todas e, **após o refresh**, ela não volta para a rota
    (era o bug de 29/07 — voltava com parte dos produtos pendente).
48. Cliente com pão na **manhã** e Cestinha só na **tarde** → duas paradas na rota do entregador; os
    itens da tarde não aparecem na parada da manhã e os pães não são contados duas vezes.
49. Escanear o **cupom de uma parada só-Cestinha** → confirma a entrega (antes dava "Pedido não
    encontrado", porque o QR carrega o id do `MarketOrder`).
50. Cestinha **não entregue** e pão **entregue** no mesmo cliente/turno → em "Realizadas" são duas
    linhas com desfechos distintos, não uma linha "Entregue" cobrindo os dois.

---

## 6. FECHAMENTO — não há mais onda a implementar

A integração está **completa**: A, B, C, D, E, F, G e H1–H9 concluídas (+ as correções de 29/07 no
§4), com **563 testes + 3 todo** verdes, typecheck (shared+api+web) e build do api limpos, e **nada
commitado** (branch `feat/update`, aguardando autorização explícita).

### O que fazer a partir daqui

1. **Verificação manual** — os 50 cenários do §5, na ordem em que estão (os 10 primeiros cobrem os
   três prints que originaram o plano; os 4 últimos, o bug da parada multi-Cestinha).
2. **Commit e deploy** — só com autorização explícita, a cada vez (regra do CLAUDE.md). O deploy é
   automatizado: o `ansible/playbook.yml` roda `prisma db push` dentro do container depois do
   `up -d`, então os campos novos de `MarketOrder` (Onda G) e os valores novos de `NotificationType`
   (Onda F) entram sem passo manual. Confirmar no log: `[bootstrap] matriz de fornecimento semeada`.
3. **Follow-ups fora do escopo** — ver a lista ao fim do §4.

### Prompt para uma sessão nova (auditoria / retomada de contexto)

Use este prompt se precisar abrir outra janela para revisar, testar ou estender a integração —
não há etapa pendente para continuar.

```
Contexto: a integração da Cestinha ("Além do Pãozin") na operação admin do app Cheirin de Pão está
COMPLETA (ondas A..H9). Leia, nesta ordem:
1. .projeto/status-integracao-cestinha.md              (o que foi feito, decisões, cenários de teste)
2. .projeto/docs/plano-integracao-cestinha-operacao.md (plano original: diagnóstico e decisões D-1..D-10)

Estado: branch feat/update, NADA commitado. Piso dos testes de backend: 549 passando + 3 todo.

Regras invioláveis:
- NÃO faça commit nem push sem eu autorizar explicitamente, a cada vez.
- D-6: Order de pão INTOCADO — toda união é leitura/agregação, sem migração de dados.
- Rota tocada = atualizar JSON Schema (*.route.ts) E Zod (*.schema.ts). Campo ausente no
  response-schema é removido em silêncio (fast-json-stringify) e o front mostra lista vazia — isso
  JÁ aconteceu em produção com `type`/`actionRoute` de /notifications/me (corrigido na Onda F).
- Padrão de módulo: route(JSON Schema)+authenticate → controller(Zod + role ADMIN) → service →
  repository. Front admin = sub-telas por estado no hub, sem tocar no router.
- Verificação ao fim de qualquer alteração: typecheck (shared+api+web) + build do api + testes do api.

Antes de mudar qualquer coisa, leia as "Decisões tomadas durante a implementação" de TODAS as ondas
no §4 do status: cada uma registra um raciocínio que não é óbvio no código (por que o GMV nunca soma
à receita, por que `totalQuantity` do PurchaseOrder é só pães, por que um produto sem custo não é
custo zero, por que NOT_DELIVERED não devolve estoque automaticamente…). Contrariar uma delas sem
motivo novo reintroduz um bug que já foi pensado.

Vocabulário compartilhado (libs que são fonte única de verdade — reuse, não reimplemente):
- lib/bread-demand.ts        — demanda de pão por parada + CONFIRMED_MARKET_STATUSES
- lib/product-demand.ts      — demanda de compra por produto + loadSourcingOptions
- lib/supplier-split.ts      — motor de rateio (produto × fornecedor)
- lib/restock-demand.ts      — candidatos a reposição de inventário
- lib/product-cost.ts        — custo unitário esperado + margem
- lib/market-reversal.ts     — estorno/reversão de Cestinha (idempotente)
- lib/market-stock-alerts.ts — cruzamento de limiar de estoque
- lib/market-pipeline.ts     — propagação de status Order → MarketOrder
- lib/client-label.ts        — rótulo do cliente nos avisos
- modules/market/market-notify.ts — TODA notificação da Cestinha nasce aqui
```
