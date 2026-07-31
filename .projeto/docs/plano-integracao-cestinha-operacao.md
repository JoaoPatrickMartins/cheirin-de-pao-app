# PLANO — Integração completa da Cestinha ("Além do Pãozin") na operação

> **Criado:** 28/07/2026 · **Atualizado:** 28/07/2026 · Branch base: `feat/update`
> **Origem:** as Cestinhas não aparecem como pedidos na administração. A auditoria mostrou que o
> problema é muito maior que a aba Pedidos — a Cestinha está integrada em **3 pontos** da esteira
> (separação, rota do entregador, transições) e **ausente em ~20 outros** (pedido ao fornecedor,
> entregas, ledger, painel, financeiro, relatórios, CRM, notificações).
>
> **STATUS: 📋 PLANEJADO — decisões D-1..D-10 TODAS CONFIRMADAS pelo usuário em 28/07/2026.**
> **⏸️ AGUARDANDO AUTORIZAÇÃO EXPLÍCITA DO USUÁRIO PARA INICIAR A IMPLEMENTAÇÃO (Onda A).**
> Nada de código, commit ou push antes disso.

---

## 1. Diagnóstico

### 1.1 O que foi reportado

| Print | Tela | Sintoma |
|---|---|---|
| 1 | Cliente › Histórico | 4 Cestinhas para **qua 29/jul** (`2× produto teste`, `4 🥖` cada) + 1 pedido de pão para qui 30 |
| 2 | Admin › Pedidos › detalhe do condomínio | só o pedido de pão (4 pães, 1 entrega, "Avulso"). Nenhuma Cestinha |
| 3 | Admin › Pedidos | "**6 dias sem agendamentos** · ter 28 · **qua 29** · sex 31 …" — o dia com 4 Cestinhas é listado como vazio |

### 1.2 Causa-raiz — uma única função

Todo o fluxo "Pedido ao fornecedor / Cortes / Dias em aberto" deriva de **uma** função:

[admin-supplier-orders.service.ts:134](../../apps/api/src/modules/admin-supplier-orders/admin-supplier-orders.service.ts#L134) — `_buildDeliveryRows()`

Ela une `prisma.order` (materializados) + projeção da agenda. **Nunca lê `prisma.marketOrder`.**

Consumidores afetados (todos, de uma vez):

| Método | Linha | Tela / efeito |
|---|---|---|
| `getDraft` | :260 | lista de condomínios da aba Pedido |
| `getCondominiumDetail` | :308 | **print 2** |
| `getSlotsStatus` | :489 | abre a aba no turno certo |
| `getUpcomingDays` | :540 | **print 3** ("dias sem agendamentos") |
| `createQuick` | :630 | **"Gerar direto" — não pede os pães da Cestinha ao fornecedor** |
| `autoGenerateAtCutoff` | :669 | rede de segurança das 22:00 — idem |
| `sendCutoffReminders` | :736 | push T-30 subestima o total |
| `_notifyAtCutoffOffset` | :828 | avisos de corte / autogen idem |
| `sendDeliveryPendingReminders` | :867 | lê só `Order` — parada só-Cestinha nunca gera aviso |

### 1.3 O efeito dominó (por que é mais grave que "não aparece")

1. **`MarketOrder.breadQty` nunca é pedido ao fornecedor.** O cliente paga por pães dentro da
   Cestinha ([market-checkout.service.ts:169](../../apps/api/src/modules/market/market-checkout.service.ts#L169) —
   `total = productSubtotal + breadQty * avulsoUnit`), mas eles não entram em `createQuick`.
   → **falta física de pão na fornada.** Nos prints: 4 Cestinhas × 4 pães = **16 pães vendidos e não pedidos**.

2. **Dia sem pão avulso/agenda = nenhum `PurchaseOrder`.** E a Separação tem gate por PO
   ([admin-separation.service.ts:100-105](../../apps/api/src/modules/admin-separation/admin-separation.service.ts#L100) —
   `if (finalizedSlots.size === 0) return empty`).
   → a Cestinha **nunca é separada**, logo nunca é despachada, nunca entregue, e fica `SCHEDULED`
   para sempre na tela do cliente. **É exatamente o caso de qua 29 nos prints.**

3. **Nenhum alarme dispara.** `getStuck` / `stuckCount` só olham `Order`
   ([admin-orders.service.ts:1086](../../apps/api/src/modules/admin-orders/admin-orders.service.ts#L1086) e :560),
   então uma Cestinha perdida não conta como "pedido parado". Ela desaparece em silêncio —
   com o crédito do cliente já debitado e o estoque do produto já reservado.

---

## 2. Auditoria completa por feature

Legenda: 🟢 integrado · 🟡 parcial · 🔴 ausente · ⚪ não se aplica

### 2.1 Pedido ao fornecedor / Cortes / Dias em aberto — 🔴
Ver §1.2. **Zero** integração. Impacto operacional e físico (o pão não é comprado).

### 2.2 Separação — 🟡 (integrado, porém inalcançável)
- 🟢 `getBoard` mescla `MarketOrder` por (condo, slot, cliente): parada combinada anexa
  `marketItems` e soma `breadQty`; parada só-market vira linha própria
  ([admin-separation.service.ts:130-291](../../apps/api/src/modules/admin-separation/admin-separation.service.ts#L130)).
- 🟢 `conclude` separa também as Cestinhas (`separateMarketOrders`).
- 🔴 **Gate por `PurchaseOrder` FINALIZED** (:100) — sem pão no turno, nada aparece (§1.3.2).
- 🔴 **Não existe lista consolidada de itens do mercadinho a separar.** Os itens só aparecem como
  chips por parada. Falta o "quanto pegar da prateleira": `12× bolo`, `4× geleia` por dia/turno.
  Hoje o admin tem que somar os chips na mão.

### 2.3 Entregas (divisão + status) — 🟡
- 🟢 `assignCourier` (:371, :400) e `approveDivision` (:434) propagam para `MarketOrder`.
- 🟢 Rota do entregador, confirmação e paradas só-market (Onda 5).
- 🔴 `getDeliveryStatus` (:618) — só `Order`. A aba Entregas não mostra parada só-Cestinha nem
  soma o `breadQty` nos contadores por condomínio/bloco.
- 🔴 `getDivisionSuggestion` (:695) — só `Order`. Consequências:
  - a parada só-market não entra no *greedy* nem na divisão persistida (modo "aprovada");
  - ela só pega carona pelo guard `courierId: null` de
    [`dispatchMarketForOrders`](../../apps/api/src/lib/market-pipeline.ts#L92) — **o primeiro
    entregador a ser processado leva**, sem o admin ver nem poder mudar;
  - condomínio/turno **só** com Cestinha → nenhum entregador sugerido → nunca despachada.
- 🔴 `sendCourierPendingReminders` ([courier.service.ts:531](../../apps/api/src/modules/courier/courier.service.ts#L531)) — só `Order`.

### 2.4 Pedidos — ledger / verificação geral / parados — 🔴
- 🔴 `getLedger` (:1038) — a "verificação geral", cujo propósito declarado é *"garantir que nenhum
  pedido fique invisível"*, ignora 100% das Cestinhas.
- 🔴 `getStuck` (:1086) + `stuckCount` (:560) — Cestinha parada não é detectada (§1.3.3).
- 🔴 `resolveStuckOrder` (:1170) e `refundOrder` (:1115) — sem equivalente para `MarketOrder`.
- 🔴 **Não existe nenhum endpoint admin que liste uma Cestinha.** `admin-market` só tem
  produtos / categorias / config ([admin-market.route.ts](../../apps/api/src/modules/admin-market/admin-market.route.ts)).
  O admin não consegue abrir, auditar, cancelar ou estornar uma Cestinha.

### 2.5 Painel (dashboard) — 🔴
[admin-orders.service.ts:448](../../apps/api/src/modules/admin-orders/admin-orders.service.ts#L448)
- 🔴 `breadsTodayCount`, `breadsTomorrowCount`, `breadsByWeekday` (:506-555) — só `Order.quantity`.
  Não somam `MarketOrder.breadQty`.
- 🔴 `revenueToday` / `revenueTrendPct` / `revenueByType` — excluem MARKET por desenho (§4.7 Opção B)
  e **nada ocupa o lugar**: a receita da Cestinha não existe em nenhum lugar do admin.
- 🔴 `stuckCount` — idem 2.4.

### 2.6 Financeiro — 🔴
[admin-financial.service.ts:66](../../apps/api/src/modules/admin-financial/admin-financial.service.ts#L66)
- 🔴 `total`, `byType.combos`, `byType.avulso` e `byCondominium` todos aplicam
  `excludeNonCreditPurpose` ([revenue.ts:18](../../apps/api/src/lib/revenue.ts#L18)). Sem linha
  "Além do Pãozin".
- ⚠️ **Cuidado conceitual:** uma Cestinha paga 100% em pãezinhos gera `Payment` = **nenhum**.
  O dinheiro entrou antes (na compra do combo). Contabilizar `totalValue` como receita nova seria
  **contagem dupla**. Ver decisão D-2 (§3).
- 🔴 Sem custo/margem dos produtos do mercadinho — não há custo em lugar nenhum (ver §3-B / Onda H).

### 2.7 Relatórios — 🔴
[admin-reports.service.ts](../../apps/api/src/modules/admin-reports/admin-reports.service.ts)
- 🔴 `getDeliveryReport` (:481) — status/motivos só de `Order`. Cestinha entregue, não entregue e
  cancelada são invisíveis; a taxa de entrega mede só o pão.
- 🔴 `getWasteReport` (:524) — `ordered` (PurchaseOrder) × `delivered` (`Order`).
  **Acoplado à Onda A:** ao incluir o pão da Cestinha no PO, o `delivered` precisa somar
  `MarketOrder.breadQty` DELIVERED, senão o desperdício fica falsamente positivo.
- 🔴 `getCondominiumRanking` (:384) — `revenue` exclui MARKET; `breadsDelivered` só `Order`.
- 🔴 `getRetentionReport` (:251) — `creditsConsumed` soma só `type: 'DELIVERY'`; o consumo via
  `MARKET_PURCHASE` não aparece. `activation.withDelivery` só `Order` DELIVERED.
- 🟡 `getPaymentsReport` (:600) — conta tudo (correto p/ saúde do gateway), mas sem quebra por
  `purpose`: não se distingue recusa de combo de recusa de Cestinha.
- 🟢 `getCreditLiability` (:357) — `estPricePerCredit` exclui MARKET corretamente e o passivo vem
  de `user.creditBalance`, que o `MARKET_PURCHASE` já reduz. Está certo.
- ⚪ `getScheduleProfileReport`, `getAccessReport` — agenda / analytics, não se aplica.

### 2.8 Clientes (CRM 360) — 🔴
[admin-clients.service.ts](../../apps/api/src/modules/admin-clients/admin-clients.service.ts)
- 🔴 `getDetail` (:181) — `recentOrders` só `Order`; `metrics.breadsDelivered` / `ordersCount` só `Order`.
- 🟡 `metrics.totalSpent` (:206) — soma **todos** os `Payment` PAID, então inclui a parte em
  dinheiro da Cestinha, mas não a parte em crédito. Número híbrido, sem rótulo.
- 🔴 `getOrders` (:458) — só `Order`. O admin não consegue auditar uma Cestinha do cliente.
- 🔴 `cancelOrder` (:510) — sem equivalente market. Depois do corte **ninguém** pode reverter uma
  Cestinha: o cliente é barrado por `CUTOFF_PASSED`
  ([market-orders.service.ts:167](../../apps/api/src/modules/market/market-orders.service.ts#L167))
  e o admin não tem rota.
- 🔴 **`MARKET_PURCHASE` e `MARKET_REFUND` não têm rótulo em nenhum dos dois extratos** — cai no
  enum cru na tela:
  - [ClientDetailView.tsx:1547](../../apps/web/src/components/admin/ClientDetailView.tsx#L1547) (`TX_LABEL`)
  - [CreditHistoryScreen.tsx:16](../../apps/web/src/pages/client/CreditHistoryScreen.tsx#L16) (`TYPE_LABEL`)

### 2.9 Notificações — 🔴
Só existe **uma**: `notifyMarketDelivered` (DELIVERED) — [market-notify.ts](../../apps/api/src/modules/market/market-notify.ts).
Faltam:
- 🔴 **Cliente — cancelamento automático pelo sweep.** `sweepStuckPayments` cancela a Cestinha e
  estorna crédito **em silêncio** ([market-checkout.service.ts:350](../../apps/api/src/modules/market/market-checkout.service.ts#L350),
  rodando a cada minuto no cron). O cliente descobre sozinho. **É o pior furo de confiança da lista.**
- 🔴 Cliente — véspera (`DELIVERY_EVE`): `sendEveReminders`
  ([schedules.service.ts:553](../../apps/api/src/modules/schedules/schedules.service.ts#L553)) itera só `Order`.
- 🔴 Cliente — não entregue (`NOT_DELIVERED`).
- 🔴 Admin — `ADMIN_ORDER_PLACED` no checkout da Cestinha (existe para pão em
  [orders.service.ts:226](../../apps/api/src/modules/orders/orders.service.ts#L226)).
- 🔴 Admin — `ADMIN_ORDER_CANCELLED` no cancelamento da Cestinha (pão: :340).
- 🔴 Admin — estoque baixo de produto do mercadinho (a flag `lowStock` existe na listagem, mas não notifica).

### 2.10 Pagamentos (admin) — 🟡
- 🟢 `purpose` exposto no list/getById.
- 🟡 Estorno genérico de `purpose=MARKET` **bloqueado** com 400 "use o cancelamento da Cestinha"
  ([admin-payments.service.ts:124](../../apps/api/src/modules/admin-payments/admin-payments.service.ts#L124))
  — correto em si, mas **o caminho alternativo não existe** (§2.8). Beco sem saída.

### 2.11 Estoque do mercadinho — 🟡
- 🟢 Reserva atômica no checkout; devolução no cancelamento.
- 🔴 `NOT_DELIVERED` não libera `ProductDailyStock.reserved` nem devolve `Product.stock`, e não
  registra perda em nenhum relatório.
- 🔴 Sem visão admin de "reservado hoje por produto" — indispensável para preparar/comprar os itens.
- 🔴 **Não existe caminho para comprar reposição de produto `FIXED`** (geleia, café): o pedido ao
  fornecedor é sempre por turno e derivado da demanda do dia. Ver D-9 / Onda H8.

### 2.12 Já integrado (não mexer) — 🟢
- Limite de entregas por dia: `countCommittedDeliveries` já conta Cestinha por parada
  ([schedule-projection.ts:119-142](../../apps/api/src/lib/schedule-projection.ts#L119)).
- Rota/confirmação do entregador, cupom de separação, propagação de status (Onda 5).
- Bloqueio de dia da semana e limite no checkout da Cestinha (:127-141).

---

## 3. Decisões de arquitetura — ✅ TODAS CONFIRMADAS (28/07/2026)

> Registro fechado. As dez decisões abaixo (D-1..D-10) foram confirmadas pelo usuário em
> **28/07/2026** e são a base das Ondas A..H. Qualquer mudança aqui invalida o plano — reabrir
> explicitamente antes de codar diferente.

**D-1 — Pão e item são coisas diferentes. Nunca somar.** ✅ CONFIRMADA
`MarketOrder.breadQty` é **pão francês**: mesma unidade do `Order`, mesmo fornecedor, mesma fornada
→ entra em *todo* contador de pães. `MarketOrder.items[]` são produtos do mercadinho (bolo, geleia)
→ estoque próprio, preparo próprio, métrica paralela ("itens"). O board de separação já usa essa
separação (`totalBreads` × `totalItems`); estender o mesmo vocabulário ao resto.
*Risco evitado:* "18 pães hoje" quando são 12 pães + 6 potes de geleia → comprar 18 pães.
*Define a assinatura de `bread-demand.ts` (A1) — junto com D-5.*

**D-2 — Receita: três números, não um.** ✅ CONFIRMADA — **substitui a Opção B da Onda 4/§4.7**
| Métrica | Fonte | Significado |
|---|---|---|
| Receita de crédito | `Payment` PAID `purpose ∉ {HOOK,MARKET}` | dinheiro novo de combo/avulso (**inalterado**) |
| Receita da Cestinha | `Payment` PAID `purpose = MARKET` | dinheiro **novo** da Cestinha |
| GMV da Cestinha | `MarketOrder.totalValue` (não cancelado) = `moneyAmount` + `creditsApplied × avulsoUnit` | **valor movimentado** — diz se o mercadinho funciona |

Total consolidado = receita de crédito + receita da Cestinha. **GMV nunca é somado à receita** — a
parte paga em pãezinhos já foi faturada quando o combo foi comprado; somar seria contagem dupla.
Exibir lado a lado, sempre rotulado.
*Consequência aceita e esperada:* o card "Receita do dia" **não sobe** quando a Cestinha é paga
100% em crédito. Quem sobe é o GMV. Isso está correto — não é bug, não "consertar" depois.
*Com a Onda H9 (custo real) isto ganha margem/CMV.*

**D-3 — Gate da separação.** ✅ CONFIRMADA
Um turno entra na Separação se tem `PurchaseOrder` FINALIZED **ou** `MarketOrder` confirmado
([admin-separation.service.ts:100](../../apps/api/src/modules/admin-separation/admin-separation.service.ts#L100)).
A Onda A resolve o caso com pão; isto cobre a Cestinha 100% produtos. Sem efeito no fluxo do pão.

**D-4 — Ledger unificado, com discriminador.** ✅ CONFIRMADA
`LedgerRow` ganha `kind: 'BREAD' | 'CESTINHA'`; o ledger une as duas coleções, com filtro por tipo.
Aba separada foi **descartada**: contraria o propósito declarado da tela ("nenhum pedido invisível")
e obrigaria a olhar em dois lugares para saber se algo ficou para trás.

**D-5 — Parada é a unidade de entrega.** ✅ CONFIRMADA
Cliente com pão + Cestinha no mesmo slot = **1 parada** (uma campainha). Ao unir as fontes, mesclar
por `(userId, slotId)`; **pães somam sempre**. Senão `deliveryCount` e `_slotBreakdown`
([:243](../../apps/api/src/modules/admin-supplier-orders/admin-supplier-orders.service.ts#L243))
contam 2 entregas onde há 1 → divisão de entregas desbalanceada e número sem credibilidade.
*Define a assinatura de `bread-demand.ts` (A1) — junto com D-1.*

**D-6 — `Order` continua intocado.** ✅ CONFIRMADA
Toda união é por leitura/agregação, como na Onda 5. Nenhuma migração, nenhum campo novo em `Order`,
zero risco para o fluxo de pão em produção. **Os 88 testes atuais são o piso — sempre verdes.**

---

## 3-B. Fornecimento multi-produto × multi-fornecedor

### 3-B.1 Estado atual — o modelo só sabe comprar pão

| Peça | Hoje | Limitação |
|---|---|---|
| `Supplier.pricePerUnit` | **um** preço por fornecedor | é o preço *do pão*. Não há onde guardar "quanto o fornecedor Y cobra pelo bolo de fubá" |
| `PurchaseOrderItem` | `supplierId` + `quantity` + `unitPrice` | **não tem `productId`** — toda linha é implicitamente pão |
| `Setting.supplierSplitPrincipalPct` | split **global** 75/25 | um único percentual para o negócio inteiro, não por produto |
| `Supplier.isPrincipal` | 1 principal, N reservas | "principal" é global, não por produto |
| [AdminPedido.tsx:474](../../apps/web/src/pages/admin/tabs/AdminPedido.tsx#L474) | `principal` = `find(isPrincipal)`, `reserva` = `find(!isPrincipal)` | **hard-coded em exatamente 2 fornecedores e 1 produto** |
| PDF/Excel | 1 documento com **todos** os fornecedores e preços | não é enviável a um fornecedor — mostra o preço do concorrente |
| `Product` | sem custo | sem margem, sem CMV |

E o pão **já é um `Product`**: `Setting.breadProductId` aponta para ele, semeado em
[defaults-seed.ts:145-171](../../apps/api/src/bootstrap/defaults-seed.ts#L145) (`stockType: DAILY`).
Ou seja, a unificação "pão é um item do catálogo de fornecimento" não exige inventar nada.

### 3-B.2 Decisões — ✅ TODAS CONFIRMADAS (28/07/2026)

**D-7 — Fornecimento é uma matriz (produto × fornecedor), não um split global.** ✅ CONFIRMADA
O rateio deixa de ser um percentual do negócio e passa a ser **por produto**: cada produto tem seus
fornecedores, sua fatia padrão e seu custo. Pão vira apenas a primeira linha dessa matriz.
`defaultSharePct` (em vez de só "fornecedor padrão") cobre os dois casos pedidos: *tudo para o Y*
(100/0) e *parte para o X, parte para o Y* (75/25, 50/50) — e preserva o 75/25 atual do pão.

**D-8 — O custo mora na *relação*, não no fornecedor nem no produto.** ✅ CONFIRMADA
A existência da linha `(fornecedor, produto)` **é** a afirmação "este fornecedor fornece este
produto". Sem linha → sem custo cadastrável, e o fornecedor **nem aparece como opção** para aquele
produto — exatamente o requisito ("se não fornece, não tem por que ter custo cadastrado").
*Substitui a antiga G3* (campo de custo em `Product`), que ficaria errada: o mesmo bolo tem custo
diferente em cada fornecedor.

**D-9 — Dois regimes de compra, não um.** ✅ CONFIRMADA
- **`DELIVERY_BATCH`** — produtos `stockType: DAILY` (pão, bolo). Quantidade **derivada da demanda
  confirmada** do (dia, turno), no corte. É o fluxo atual, generalizado para N produtos.
- **`RESTOCK`** — produtos `stockType: FIXED` (geleia, café). Não têm demanda diária: são
  inventário (não se compra 3 potes porque 3 pessoas pediram hoje; repõe-se quando acaba). Pedido
  **avulso**, sem turno, disparado por estoque baixo. Hoje **não existe nenhum caminho** para
  comprar reposição.

**D-10 — `Supplier.pricePerUnit` e `supplierSplitPrincipalPct` viram legado.** ✅ CONFIRMADA
**Não remover** (há dados em produção): backfill para a matriz (H1) e manter como fallback de
leitura. `Supplier.isPrincipal` também permanece, virando semente do `isPreferred` do pão.

### 3-B.3 Schema proposto

```prisma
// Catálogo de fornecimento — a existência da linha = "este fornecedor fornece este produto".
model SupplierProduct {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  supplierId      String   @db.ObjectId
  productId       String   @db.ObjectId
  unitCost        Float    // custo unitário DESTE produto NESTE fornecedor (R$)
  defaultSharePct Int      @default(0)  // fatia padrão da demanda (0..100). Σ por produto ∈ {0,100}
  isPreferred     Boolean  @default(false) // fornecedor padrão do produto: desempata arredondamento
  minOrderQty     Int?     // pedido mínimo do fornecedor para este produto (opcional)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([supplierId, productId])
  @@index([productId, isActive])
}
```

Alterações mínimas nos modelos existentes:

```prisma
enum PurchaseOrderKind { DELIVERY_BATCH  RESTOCK }   // D-9

model PurchaseOrder {
  // ... campos atuais
  kind          PurchaseOrderKind?  // null/ausente = DELIVERY_BATCH (compat com docs antigos)
  totalQuantity Int                 // MANTÉM O SIGNIFICADO: só PÃES (getWasteReport depende disto)
  totalItems    Int?                // unidades de produtos NÃO-pão
  totalValue    Float?              // custo total do pedido (R$)
  // slotId já é opcional → RESTOCK grava null
}

model PurchaseOrderItem {
  // ... campos atuais
  productId   String?  @db.ObjectId // null/ausente = pão (compat com itens antigos)
  productName String?               // snapshot do nome no momento da compra
  // unitPrice mantém o nome; passa a ser o snapshot de SupplierProduct.unitCost
}
```

> ⚠️ **`totalQuantity` continua sendo só pão.** Se virar "tudo", `getWasteReport`
> ([admin-reports.service.ts:524](../../apps/api/src/modules/admin-reports/admin-reports.service.ts#L524))
> passa a comparar bolo com pão entregue e o desperdício explode. Novos totais em campos novos.

### 3-B.4 Motor de rateio (split engine)

Entrada: `demanda[productId] = qty` (do `bread-demand.ts` da Onda A, para o pão, + `Σ items[].qty`
dos `MarketOrder` do escopo, para os produtos). Saída: `linhas[(productId, supplierId)] = qty`.

1. Fornecedores elegíveis = `SupplierProduct` ativos daquele produto **com `Supplier.isActive`**.
2. Rateio por `defaultSharePct`; **o resto do arredondamento vai para `isPreferred`** (ou para a
   maior fatia) → resultado determinístico, soma sempre igual à demanda.
3. `Σ defaultSharePct == 0` → 100% para o `isPreferred`; sem `isPreferred` → primeiro ativo.
4. Nenhum fornecedor cadastrado para um produto com demanda > 0 → **não silenciar**: bloquear a
   geração com erro acionável ("Bolo de Fubá não tem fornecedor cadastrado") e notificar o admin.
   Na rede de segurança das 22:00, gerar o resto e avisar o que ficou de fora (nunca omitir).
5. `minOrderQty` — apenas **aviso** na tela, não bloqueio.
6. O admin sempre pode sobrescrever quantidade por (produto, fornecedor) antes de gerar.

### 3-B.5 Documento por fornecedor

`GET /admin/supplier-orders/:id/pdf|excel` ganha **`?supplierId=`**: gera o documento **daquele**
fornecedor, agrupado por produto (`Produto | Qtd | Custo unit. | Total`), com um rodapé de total.
Sem o parâmetro, mantém o documento consolidado interno (visão do admin). `SupplierOrderData`
passa a ter `supplier?: { name, cnpj }` e `items[]` por produto.

---

## 4. Plano de implementação

### Onda A — P0 · O pão da Cestinha entra na operação física
> Sem isto, o negócio vende pão que ninguém assa. É a onda que corrige os 3 prints.

**A1.** Novo `apps/api/src/lib/bread-demand.ts` — fonte única da demanda de pão de um
(slot, dia): une `Order` + `MarketOrder.breadQty` + projeção da agenda, **mesclada por parada**
(D-5). Retorna linhas com `origin: 'bread' | 'market'`, `marketItems[]`, `marketItemCount`.

**A2.** `_buildDeliveryRows` passa a delegar para A1 → os 9 consumidores de §1.2 são corrigidos de
uma vez. `DeliveryRow` ganha `origin` / `marketItems` / `marketItemCount`; Cestinha confirmada
entra como `source: 'order'` (é paga → **tem** que entrar no pedido ao fornecedor).

**A3.** `createQuick` / `autoGenerateAtCutoff` — o total passa a incluir o pão da Cestinha
automaticamente via A2. **Validar** que a rede de segurança das 22:00 pede o total certo.

**A4.** Gate da separação (D-3) — `admin-separation.service.ts:100`.

**A5.** Painel — `breadsTodayCount` / `breadsTomorrowCount` / `breadsByWeekday` somam `breadQty`.

**A6.** `getWasteReport` — `delivered` soma `MarketOrder.breadQty` DELIVERED (acoplado a A3).

**A7.** Frontend: `AdminPedido.tsx` e `DiasEmAberto.tsx` exibem "N pães · M itens"; o detalhe do
condomínio mostra o chip 🧺 na parada com Cestinha. `SeparationCoupon` já suporta.

**Verificação:** com 4 Cestinhas de 4 pães em qua 29 e nada mais → o dia sai de "sem agendamentos",
`Gerar direto` pede 16 pães, o detalhe do condomínio lista as 4 paradas, a separação abre.

### Onda B — P0 · Esteira completa (separação de itens, divisão, parados)
**B1.** Lista consolidada de itens do mercadinho por dia/turno (novo endpoint + card na
Separação): `Σ qty` por produto — o "quanto pegar da prateleira".
**B2.** `getDeliveryStatus` — unir `MarketOrder` (paradas só-market + `breadQty` nos contadores).
**B3.** `getDivisionSuggestion` — incluir a parada só-market no *greedy* e na divisão persistida,
para o admin ver e reatribuir. Fecha o "primeiro courier leva" e o caso condo-só-Cestinha.
**B4.** `getStuck` + `stuckCount` — incluir `MarketOrder` com data passada e status não terminal.
**B5.** `resolveStuckOrder` para Cestinha (desfecho + devolução de crédito e estoque).
**B6.** `sendCourierPendingReminders` e `sendDeliveryPendingReminders` — contar paradas só-market.
**B7.** Frontend `AdminEntregas.tsx` — paradas/contadores da Cestinha.

### Onda C — P0 · Visibilidade e controle admin da Cestinha
**C1.** `getLedger` unificado (D-4) + filtro "tipo: pão / Cestinha".
**C2.** Novo `GET /admin/market/orders` (+ `/:id`) — lista/detalhe de Cestinhas com filtros
(data, status, condomínio, cliente).
**C3.** `POST /admin/market/orders/:id/cancel` — cancelamento admin **sem** gate de corte,
reusando o estorno de `market-orders.service.ts`. Fecha o beco sem saída de §2.10.
**C4.** Frontend: sub-tela "Cestinhas" em `AdminMarket.tsx` (padrão `AdminGestao`) + coluna/filtro
de tipo no ledger de `AdminEntregas.tsx`.

> ⚠️ **Validação dupla:** toda rota tocada aqui e na Onda B tem JSON Schema no `*.route.ts` **e**
> Zod no `*.schema.ts`. Campo novo ausente no response-schema é silenciosamente removido; o front
> engole o 400 e mostra lista vazia. Atualizar **os dois**, sempre.

### Onda D — P1 · Financeiro e relatórios
> ⚠️ **Não confundir:** `D1`..`D7` (sem hífen) são **tarefas** desta onda; `D-1`..`D-10` (com
> hífen) são as **decisões** de §3 / §3-B.

**D1.** `getRevenue` — adicionar `market: { revenue, gmv, moneyPart, creditPart }` (D-2) e
`totalConsolidated`. Não mexer nos números atuais de crédito.
**D2.** Painel — card/linha da receita da Cestinha ao lado de `revenueByType`.
**D3.** `getDeliveryReport` — contadores e motivos incluindo `MarketOrder` (quebra por tipo).
**D4.** `getCondominiumRanking` — `revenue` += receita MARKET do condomínio; `breadsDelivered`
+= `breadQty` DELIVERED; nova coluna `cestinhaGmv`.
**D5.** `getRetentionReport` — `creditsConsumed` += `MARKET_PURCHASE`; `withDelivery` inclui
Cestinha entregue.
**D6.** `getPaymentsReport` — quebra por `purpose`.
**D7.** Frontend: `AdminFinanceiro.tsx`, `RelEntregas.tsx`, `RelCondominios.tsx`,
`RelRetencao.tsx`, `RelPagamentos.tsx`, `RelDesperdicio.tsx`.

### Onda E — P1 · Cliente 360 (CRM)
**E1.** `getDetail` — `recentCestinhas` + métricas (`cestinhasCount`, `cestinhaGmv`,
`itemsDelivered`); rotular `totalSpent` (ou separar em pão × Cestinha).
**E2.** `getOrders` — unir Cestinhas com discriminador.
**E3.** Rótulos `MARKET_PURCHASE` / `MARKET_REFUND` nos dois extratos (§2.8) — 4 linhas, faça já.
**E4.** Frontend `ClientDetailView.tsx` — aba/seção Cestinhas + ação de cancelar (C3).

### Onda F — P1 · Notificações
**F1.** **Cliente — cancelamento automático pelo sweep** (Pix expirado/recusado): avisar que o
pedido caiu e o crédito voltou. *Prioridade máxima desta onda.*
**F2.** Cliente — véspera: `sendEveReminders` inclui quem tem Cestinha amanhã (mensagem unificada
quando há pão + Cestinha, para não mandar dois pushes).
**F3.** Cliente — Cestinha não entregue.
**F4.** Admin — `ADMIN_ORDER_PLACED` no checkout; `ADMIN_ORDER_CANCELLED` no cancelamento.
**F5.** Admin — estoque baixo / esgotado de produto do mercadinho (novo tipo + toggle em
`admin-notification-prefs`).

### Onda G — P2 · Estoque, preparo e margem
**G1.** Painel "reservado por produto/dia" (alimenta a compra dos itens).
**G2.** `NOT_DELIVERED` — política explícita de estoque e crédito (hoje: nada acontece).
**G3.** ~~Campo de custo em `Product`~~ → **substituído pela Onda H** (custo mora em
`SupplierProduct`, D-8). Margem por produto sai de lá.
**G4.** Desperdício de itens do mercadinho (reservado × entregue).

### Onda H — P0/P1 · Fornecimento multi-produto × multi-fornecedor
> **Depende da Onda A** (a demanda por produto só existe depois que a Cestinha entra na conta).
> H1–H7 são P0 (hoje é impossível comprar qualquer item do mercadinho); H8–H9 são P1.

**H1 — Schema + backfill.** `SupplierProduct`, `PurchaseOrderKind`, campos novos em
`PurchaseOrder`/`PurchaseOrderItem` (§3-B.3) + `prisma generate`.
Script de backfill (`scripts/backfill-supplier-products.ts`): para cada `Supplier` ativo, criar
`SupplierProduct(breadProductId, unitCost = supplier.pricePerUnit, defaultSharePct` derivado de
`supplierSplitPrincipalPct`, `isPreferred = isPrincipal)`. **Idempotente**, seguindo o padrão do
`backfill-hook-requests.ts` já existente. Sem o backfill, o pão fica sem fornecedor no dia seguinte
ao deploy → rodar **antes** de expor a Onda H.

**H2 — CRUD da matriz de fornecimento.**
- `GET/PUT /admin/suppliers/:id/products` — produtos que o fornecedor fornece (custo, fatia, mínimo).
- `GET /admin/market/products/:id/suppliers` — visão espelhada (leitura), para o form do produto.
- Validações no service: produto existe e está ativo; `unitCost > 0`; `defaultSharePct` 0..100;
  **`Σ defaultSharePct` por produto ∈ {0, 100}** (409 com mensagem dizendo quanto falta/sobra);
  remover a última linha de um produto **com demanda futura** → 409.

**H3 — Demanda agrupada por produto.** Novo `apps/api/src/lib/product-demand.ts`: dado (dia, slot),
retorna `Map<productId, { name, qty, breakdown }>` unindo o pão (via `bread-demand.ts` da Onda A) e
`Σ MarketOrder.items[].qty` dos pedidos confirmados do escopo. Base do draft e do rateio.

**H4 — Motor de rateio** (`apps/api/src/lib/supplier-split.ts`) conforme §3-B.4, com testes
unitários dedicados: arredondamento, fatia 0, fornecedor único, produto sem fornecedor, inativo.

**H5 — Geração do pedido.** `create` aceita `items: [{ productId, supplierId, quantity }]`;
`createQuick` e `autoGenerateAtCutoff` passam a usar H3 + H4. `getGeneratedStatus` e o gate da
Separação seguem olhando pães (`totalQuantity`), sem regressão.

**H6 — Documento por fornecedor** (§3-B.5): `?supplierId=`, agrupado por produto, no PDF e no Excel.

**H7 — Frontend.**
- `FornecedorForm.tsx`: seção "Produtos fornecidos" — lista de produtos ativos com toggle *fornece*,
  campo de custo e fatia padrão %, com o somatório por produto visível ao lado.
- `MarketProductForm.tsx`: bloco read-only "Fornecedores deste produto" (custo e fatia) + atalho.
- `AdminFornecedores.tsx`: o card de split global 75/25 vira "fatia padrão por produto" (ou é
  removido, apontando para o form do fornecedor).
- `AdminPedido.tsx` — **reescrita do passo "Dividir"**: hoje é hard-coded em Principal/Reserva
  ([:474](../../apps/web/src/pages/admin/tabs/AdminPedido.tsx#L474), :1357, :1465). Passa a ser
  **um card por produto** (agrupado, pão primeiro), cada um com uma linha por fornecedor daquele
  produto (stepper de quantidade + custo unitário + subtotal), botão "tudo no padrão" por produto,
  aviso quando a soma ≠ demanda, e total geral em R$. É o maior item de UI da onda.
- Download: um botão por fornecedor.

**H8 — Reposição de inventário (`RESTOCK`, D-9).** `POST /admin/supplier-orders/restock` (produtos
`FIXED`, sem turno) + sugestão a partir do estoque baixo + notificação ao admin (liga com F5).

**H9 — Custo e margem.** Com `unitCost` real: CMV por produto, margem por produto e por Cestinha,
custo do pão no financeiro. Alimenta D-2 (§3) e o desperdício (G4) com valores em R$.

---

## 5. Riscos

| Risco | Mitigação |
|---|---|
| **Contagem dupla de pães** ao unir fontes (Cestinha aparecendo em `Order` *e* `MarketOrder`) | `MarketOrder` é coleção separada, sem `Order` espelho. Mesclar por parada (D-5), não somar linhas |
| **Contagem dupla de receita** (GMV vs Payment) | D-2: métricas separadas e rotuladas; nunca somar GMV à receita |
| **Desperdício falso** ao pedir o pão da Cestinha sem contá-lo como entregue | A3 e A6 na **mesma** onda |
| **Response-schema engolindo campos novos** | ver aviso da Onda C; checar `*.route.ts` + `*.schema.ts` juntos |
| **Regressão no fluxo do pão** | união é aditiva por leitura; `Order` intocado (D-6). Os 88 testes atuais são o piso |
| **Performance** — `_buildDeliveryRows` já roda por dia × slot em `getUpcomingDays` (7×N) e ganharia mais uma query | A1 aceita janela pré-carregada; se preciso, 1 fetch por dia em vez de por slot |
| Cestinha antiga presa em `SCHEDULED` de dias passados (dados já em produção) | script de reconciliação pontual após a Onda B4 dar visibilidade |
| **Pão sem fornecedor após o deploy da Onda H** (matriz vazia) | backfill H1 **antes** de ativar H5; fallback de leitura em `Supplier.pricePerUnit` + `isPrincipal` (D-10) |
| **`totalQuantity` do `PurchaseOrder` mudar de significado** → desperdício falso | mantém = só pães; totais novos em `totalItems`/`totalValue` (§3-B.3) |
| Produto com demanda e **sem fornecedor** cadastrado sumir do pedido em silêncio | §3-B.4 item 4: bloqueia na geração manual, e na automática gera o resto **e avisa** o que ficou de fora |
| Rateio não fechar com a demanda (arredondamento) | resto sempre para `isPreferred`; testes unitários dedicados (H4) |
| PDF consolidado ser enviado ao fornecedor errado (**já é um risco hoje**) | documento por fornecedor (H6); o consolidado passa a ser explicitamente "visão interna" |

---

## 6. Verificação (a cada onda)

```bash
npm run -w @cheirin-de-pao/shared typecheck
npm run -w @cheirin-de-pao/api typecheck
npm run -w @cheirin-de-pao/web typecheck
npm run -w @cheirin-de-pao/api build
npm run -w @cheirin-de-pao/api test     # piso: 88 testes verdes
```

Cenários manuais mínimos (com o caso dos prints):
1. Cestinha com `breadQty > 0` em dia sem pão → dia aparece na aba Pedido, `Gerar direto` inclui os pães.
2. Cestinha 100% produtos (sem pão) → aparece na Separação (D-3) e ganha entregador (B3).
3. Parada combinada pão + Cestinha → **1** entrega nos contadores, não 2 (D-5).
4. Cestinha de dia passado sem desfecho → conta em "parados" e é resolvível (B4/B5).
5. Cestinha paga 100% em crédito → GMV sim, receita não (D-2).

Cenários da Onda H:
6. Pão 75/25 entre dois fornecedores **continua** 75/25 após o backfill (sem regressão).
7. Bolo de fubá com 2 fornecedores 50/50 → demanda 7 gera 4/3 (resto para o `isPreferred`).
8. Fornecedor que **não** fornece geleia não aparece como opção nem tem custo cadastrável.
9. Produto com demanda e sem fornecedor → geração manual bloqueada com mensagem acionável;
   rede de segurança gera o resto e avisa o que ficou de fora.
10. PDF com `?supplierId=` mostra **só** os produtos e custos daquele fornecedor.

---

## 7. Registro de decisões — índice rápido

Todas confirmadas pelo usuário em **28/07/2026**. Onde cada uma é implementada:

| # | Decisão | Onde vive | Ondas |
|---|---|---|---|
| **D-1** | Pão ≠ item — nunca somar | `bread-demand.ts` (A1), contadores | A, B, D |
| **D-2** | Receita: 3 números (crédito · Cestinha · GMV); GMV nunca somado à receita | `revenue.ts`, `getRevenue`, painel | D1, D2, D4, H9 |
| **D-3** | Gate da separação: PO FINALIZED **ou** MarketOrder | `admin-separation.service.ts:100` | A4 |
| **D-4** | Ledger unificado com `kind: BREAD \| CESTINHA` | `getLedger` | C1 |
| **D-5** | Parada = `(userId, slotId)`; pães somam sempre | `bread-demand.ts` (A1) | A, B |
| **D-6** | `Order` intocado; 88 testes são o piso | todas | todas |
| **D-7** | Fornecimento é matriz produto × fornecedor | `SupplierProduct.defaultSharePct` | H1, H4 |
| **D-8** | Custo mora na relação (fornece ⇔ linha existe) | `SupplierProduct.unitCost` | H1, H2, H9 |
| **D-9** | 2 regimes: `DELIVERY_BATCH` × `RESTOCK` | `PurchaseOrderKind` | H1, H5, H8 |
| **D-10** | `pricePerUnit` / `splitPrincipalPct` → legado com backfill | `scripts/backfill-supplier-products.ts` | H1 |

**Decisões descartadas** (registrado para não reabrir sem motivo): aba separada de Cestinhas no
lugar do ledger unificado (D-4); somar GMV à receita (D-2); campo de custo em `Product` (D-8);
contador único de "pães" englobando itens (D-1).

---

## 8. Ordem de execução e estado

| Onda | Prioridade | Depende de | Estado |
|---|---|---|---|
| **A** — pão da Cestinha na operação física | P0 | — | ⏸️ aguardando autorização |
| **B** — esteira (itens, divisão, entregas, parados) | P0 | A | ⏸️ |
| **C** — visibilidade e controle admin | P0 | A | ⏸️ |
| **H1–H7** — fornecimento multi-produto | P0 | A | ⏸️ |
| **D** — financeiro e relatórios | P1 | A, (H9 p/ margem) | ⏸️ |
| **E** — cliente 360 (CRM) | P1 | C3 | ⏸️ |
| **F** — notificações | P1 | — | ⏸️ |
| **H8–H9** — RESTOCK + custo/margem | P1 | H1–H7 | ⏸️ |
| **G** — estoque, preparo, desperdício | P2 | H9 | ⏸️ |

**Próximo passo: Onda A** — é a que corrige os 3 prints e o furo físico (pão vendido e não assado).
A1 (`bread-demand.ts`) é o primeiro arquivo, e sua assinatura sai direto de **D-1 + D-5**.

> ⏸️ **PARADO AQUI POR ORIENTAÇÃO DO USUÁRIO (28/07/2026).** O planejamento está fechado; a
> implementação começa **somente** após autorização explícita. Regra do CLAUDE.md: sem commit e
> sem push sem autorização, a cada vez.

---

## 9. Regras herdadas (do CLAUDE.md e do plano original)
- **NÃO** commitar nem pushar sem autorização explícita do usuário, a cada vez.
- `Order` de pão intocado; `MarketOrder` continua pegando carona (D-6).
- Padrão de módulo: `route` (JSON Schema + `authenticate`) → `controller` (Zod + role ADMIN inline)
  → `service` → `repository`.
- Front admin: sub-telas por estado no hub (`AdminGestao` / `AdminMarket`), sem tocar no router.
- Ao fim de cada onda: typecheck + build + testes, atualizar este arquivo e entregar prompt de continuação.
