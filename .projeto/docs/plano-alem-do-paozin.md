# Plano — Além do Pãozin (mini market)

> ⚠️ **Documento temporário de planejamento.** Referência durante a implementação. **Apagar ao concluir** todas as ondas.
> **Requisitos:** [`../add-feat-alem-do-paozin.md`](../add-feat-alem-do-paozin.md) · **Handoff:** [`../handoff-alem-do-paozin.md`](../handoff-alem-do-paozin.md)

---

## 1. Objetivo

Adicionar uma loja de produtos de café da manhã ("Além do Pãozin") que **complementa** o pão sem tocar no core (combos, avulso, agenda). Cliente monta uma **Cestinha**, paga em **dinheiro e/ou pãezinhos (crédito)** — pagamento **misto** — e recebe **junto com a entrega da manhã**. Admin cadastra produtos (com foto), categorias e estoque.

## 2. Decisões-âncora (do levantamento)

| # | Decisão |
|---|---|
| DEC-16/17/18 | 1 crédito resgata a valor **avulso** (`avulsoUnit`); desconto é **implícito** (economia do combo); selo **sempre real/dinâmico** (~16–17%, nunca o 37% mock). |
| DEC-20/21 | **Pagamento misto obrigatório** no v1; split = cliente escolhe quantos pãezinhos aplicar (padrão = máximo), resto em dinheiro. |
| DEC-22 | Novo `PaymentPurpose = MARKET` reusando Pix (MP) + cartão (Stripe). |
| DEC-32/33 | **Cestinha unificada** no cliente; `MarketOrder` **separado** no backend (não refatorar o `Order`). |
| DEC-38 (MKT-33) | Confirmação antes de pagar = **sheet (opção B)**. |
| DEC-39 | Carrinho **persistente** entre sessões/dispositivos no v1. |
| DEC-06 | Foto de produto via **S3** (bucket do usuário). |
| DEC-08/09 | Estoque **diário (reseta)** e **fixo (inventário)**, **global**. |
| DEC-28/29/30 | Carona na **entrega da manhã** (mesmo condo+data+slot+entregador), respeitando corte. |
| DEC-36 | Estorno = **tudo em crédito** (inclusive parte em dinheiro), sem estorno no gateway. |
| DEC-01 | **Perfil fica como está**; Cestinha entra como **aba nova** → 6 abas. |
| Princípio | Layout/dados do mockup são **placeholders** — manter o real, puxar números dos dados reais. |

## 3. Estado atual relevante (correções do código — LEIA)

> Levantado por exploração do código. Corrige premissas do levantamento.

- 🔴 **`Delivery` e `DeliveryList` são DEAD CODE.** Nada escreve nessas coleções. A esteira roda 100% sobre o **`Order`**, agrupando em runtime pela tripla **(`condominiumId`, dia de `scheduledDate` em BRT, `slotId`)** e transicionando `Order.status` + gravando `Order.courierId`. **Não existe "gerar lista" para plugar.**
- **Os pontos de junção da esteira** (onde o `MarketOrder` precisa aparecer para "pegar carona"), todos derivados por query:
  1. Separação (board + conclude): `apps/api/src/modules/admin-separation/admin-separation.service.ts` (`getBoard` ~83-233, `conclude` ~266-279). `totalBreads` = **soma de `Order.quantity`**.
  2. Divisão entre entregadores: `apps/api/src/modules/admin-orders/admin-orders.service.ts` (`getDivisionSuggestion` ~661-752, `approveDivision` ~391-406, `assignCourier` ~332-378) — agrupa por `condominiumId`, grava `courierId`, move `SEPARATED → OUT_FOR_DELIVERY`.
  3. Rota do entregador: `apps/api/src/modules/courier/courier.service.ts` (`getTodayOrders` ~92-332) + `courier.repository.ts:25`.
  4. Transições de status: `admin-orders.service.ts` (`updateOrderStatus` ~170-218) — usado por `confirmDelivery`/`markNotDelivered` do courier.
- **Ciclo de vida do `Order`:** `SCHEDULED → SEPARATED → OUT_FOR_DELIVERY → DELIVERED / NOT_DELIVERED / CANCELLED`. O `MarketOrder` **reusa o enum `OrderStatus`** e espelha esse ciclo.
- **Pagamento:** ponto único idempotente `creditForPayment` (`apps/api/src/modules/payments/credit-payment.ts:28`), com ramo por `purpose` (CREDITS/HOOK). Chamado por webhooks Stripe/MP e pelo polling `getStatus`. **Precedentes a copiar:** `createHookPix` (`payments.service.ts:116`) para cobrar valor não-combo com `purpose`; `fulfill-single-order.ts` para confirmar um objeto de domínio na aprovação. `resolveAmount` (`payments.service.ts:26`) é o único lugar que decide o valor.
- **Setting:** `defaults-seed.ts` (upsert idempotente) + `admin-settings.service.ts` (getters/setters) + rotas por grupo; cliente lê via `GET /pricing` (`credits.service.ts:57`).
- **`packages/shared`:** hoje só auth/identidade. Padrão da casa = schema Zod é a fonte, tipo é `z.infer`. **Não há** `formatBRL` compartilhado (duplicado ≥10×), nem dias-da-semana, nem enums de domínio no shared.
- **Greenfield confirmado:** não existe produto/catálogo/**estoque**/carrinho, nem infra de **imagem/upload/S3**.
- **Validação dupla:** JSON Schema na route (docs/coerção) + **Zod no controller (validação real)**. `userId`/role sempre do JWT. **Fastify apaga campos fora do response schema** (já mordeu — todo endpoint precisa do response schema completo).

## 4. Arquitetura-alvo

### 4.1 Modelo de dados novo (`schema.prisma`)

- **`Product`**: `name`, `description?`, `categoryId`, `price Float` (R$), `photoUrl?`, `stockType (DAILY|FIXED)`, `stock Int?` (FIXED), `dailyCapacity Int?` (DAILY), `availableDays Json?` (null = sempre), `isActive`, `sortOrder?`, timestamps. `@@index([categoryId, isActive])`. Enum novo `StockType`.
- **`ProductCategory`**: `name`, `emoji?`, `sortOrder?`, `isActive`. Semear 6 padrão.
- **`Cart`** (persistente, 1 por usuário `@unique`): `userId`, `items MarketOrderItem[]` (composite embutido), `breadQty Int @default(0)` (pães do add-on C8), `updatedAt`.
- **`MarketOrder`**: `userId`, `condominiumId`, `scheduledDate` (meio-dia BRT), `slotId`, `status OrderStatus`, `courierId?`, `breadQty Int @default(0)`, `items MarketOrderItem[]` (composite, com **snapshot** de nome/preço), `totalValue Float`, `creditsApplied Int`, `moneyAmount Float`, `paymentId?`, marcos `separatedAt/deliveredAt/failedAt/cancelledAt`, `failureReason?/cancelReason?`, timestamps. **Índices espelhando o `Order`:** `@@index([condominiumId, scheduledDate])`, `@@index([courierId, scheduledDate])`, `@@index([userId])`.
- **Extensões de enum:** `TransactionType += MARKET_PURCHASE, MARKET_REFUND`; `PaymentPurpose += MARKET`.
- **Setting novo:** `marketMinimoCestinha` (R$, default ex. 15,00).
- Rodar `npx prisma generate` (sem migrations — Mongo).

### 4.2 Como o `MarketOrder` pega carona na esteira (o custo real)

Como não há "lista", o `MarketOrder` carrega a **mesma tripla** (`condominiumId`, `scheduledDate`, `slotId`) + `courierId`/`status`, e cada um dos 4 pontos passa a **ler também `MarketOrder`** para o mesmo escopo:

1. **Separação:** `getBoard` inclui os `MarketOrder` do (condo, dia, slot) por cliente; **`totalItems` paralelo** (produtos) — **não** somar no `totalBreads` (que é pão). Exceção: `MarketOrder.breadQty` (pães da cestinha) **soma** no `totalBreads`. `conclude` faz `updateMany` também nos `MarketOrder` (`SCHEDULED → SEPARATED`).
2. **Divisão:** ao aprovar/atribuir courier num condo/dia/slot, `updateMany` também nos `MarketOrder` do escopo (mesmo `courierId`, `SEPARATED → OUT_FOR_DELIVERY`).
3. **Rota do entregador:** `getTodayOrders` mescla, por parada (cliente/apto), os itens do `MarketOrder` ("4 🥖 + 1 bolo"). Rota/OSRM inalterada (mesmas paradas).
4. **Confirmação:** `confirmDelivery`/`markNotDelivered` transicionam **também** o `MarketOrder` do (cliente, dia, slot).

### 4.3 Checkout + pagamento misto (fluxo)

1. Front envia a Cestinha (itens + `breadQty` + data/slot + `creditsApplied` desejado).
2. Backend **valida**: mínimo (`marketMinimoCestinha` sobre o total R$), **corte do slot** (`isPastCutoffForDelivery`), disponibilidade/estoque; **recalcula o total no servidor** a partir dos preços reais (nunca confia no cliente).
3. Total R$ = Σ produtos + `breadQty × avulsoUnit`. Máx. crédito = `floor(total/avulsoUnit)`. `creditsApplied = min(saldo, escolha, máx)`. `moneyAmount = total − creditsApplied×avulsoUnit`.
4. **Debita créditos + reserva estoque (decremento atômico)** e cria `MarketOrder` (status inicial `PENDING_PAYMENT` se `moneyAmount>0`, senão já confirma).
5. `moneyAmount == 0` (100% crédito) → confirma `MarketOrder` (`SCHEDULED`, entra na esteira). Fim.
6. `moneyAmount > 0` → cria `Payment` (`purpose=MARKET`, com `comboId`/`customQuantity` **sempre null** — senão polui `revenueByType`/estorno) e `moneyAmount` **calculado no servidor**, metadata `{ marketOrderId }`. Aprovação → `creditForPayment` **ramo novo `MARKET`** → `fulfill-market-order.ts` confirma o `MarketOrder`.
   - **Pix:** copiar `createHookPix` (cobra valor arbitrário direto, fora do `resolveAmount`).
   - **Cartão:** ⚠️ **não há endpoint hoje** para valor arbitrário (`createCard` é amarrado ao `resolveAmount`). Criar método novo passando `amount` explícito a `chargeOffSession`/`createCardIntent` — e usar `idempotencyKey` do Stripe (hoje o `createCard` não usa).
7. **Falha/expira** → libera estoque + **estorna créditos** + cancela `MarketOrder`.

> ✅ **Decisão (Onda 4): pães na Cestinha = Fork 2 (escolhido pelo usuário).** Os pães do add-on (C8) viajam como `MarketOrder.breadQty` — **um pedido só, um split só**. A esteira soma esse `breadQty` no total de pães da separação/rota (§4.2), como itens paralelos aos produtos. **Não** se cria `Order` de pão separado para a cestinha; o `Order` do fluxo avulso/agenda permanece intocado. Créditos consumidos pelos `breadQty` entram no `creditsApplied` do mesmo `MarketOrder`.

⚠️ **Crítico (confirmado na revisão):** `creditForPayment` só trata `HOOK` e `CREDITS` — um `Payment` MARKET **sem ramo próprio** cai em `if(!quantity) return` e **nunca vira PAID nem é cumprido** (vale p/ webhook Stripe **e** MP **e** o pull de status). O **ramo `MARKET` é o 1º item da Onda 4**.

**Idempotência do checkout:** o guard `status==='PAID'` + transição de status cobrem o caminho com pagamento. Mas pedido **100% crédito não tem `paymentId`** → sem trava contra duplo-clique (o próprio `Order` sofre disso; não há `@@unique` em `paymentId`). Adicionar **chave de idempotência do cliente** (ou índice único) no `POST /market/checkout`.

### 4.4 Estoque
- **FIXED:** `stock` decrementa na reserva (checkout), volta no cancelamento/falha. Reposição manual (admin).
- **DAILY:** capacidade por dia. Preferir **contador por (produto, dia)** com `$inc` condicional (atômico, evita corrida de dois checkouts pelo último item) em vez de derivar de `Σ` a cada pedido; disponível = `dailyCapacity − reservadoNoDia`. Dia novo = contador zerado (implícito pela chave de data).
- **Atomicidade:** decremento condicional em transação (padrão do `creditUserBalance`) para não vender o último item 2×.

### 4.5 Cancelamento / estorno
- Só **antes do corte** (reusa `isPastCutoffForDelivery`). `MarketOrder → CANCELLED`, `cancelledAt`.
- Devolve estoque. Estorna **tudo em crédito**: `+creditsApplied` e `+ceil(moneyAmount/avulsoUnit)` (a favor do cliente) via `CreditTransaction MARKET_REFUND`. Idempotente.

### 4.6 Storage de imagem (S3)
- Deps: `@fastify/multipart` + `@aws-sdk/client-s3`. Config `.env` (bucket, region, credenciais). Validação tipo/tamanho (JPG/PNG ≤ 5 MB). Guardar URL no `Product.photoUrl`; sem foto → ícone/cor da categoria no front.

### 4.7 Segmentação financeira (NOVO — obrigatório; achado da revisão)

🔴 **Nenhuma agregação de receita filtra por `purpose` hoje** — `HOOK` já vaza para toda a receita, e `MARKET` vazaria igual. **Decidido:** adicionar filtro de `purpose` **corrigindo MARKET e HOOK juntos** (mesmo filtro) — **MKT-36** — em:
- `admin-financial.service.ts` — receita total (`:76-83`), por tipo (`:86-105`), por condomínio (`:108-143`).
- `admin-orders.service.ts getDashboard` — `revenueToday`/`revenueTrendPct` (`:487-495`). (`breadsTodayCount` usa `Order` → imune.)
- `admin-reports.service.ts` — `getCreditLiability` (**contamina `estPricePerCredit`/passivo de crédito** — o pior), `getCondominiumRanking` (revenue), e decidir se `getPaymentsReport`/`getRetentionReport` **segmentam** ou **excluem** MARKET.
- `admin-payments.service.ts` — expor `purpose` no `list`; no `refund`, não gerar `CreditTransaction` de qty 0 para MARKET.

### 4.8 Notificações do MarketOrder (NOVO; achado da revisão)

Hoje **só `DELIVERED` notifica o cliente** (`admin-orders.service.ts:210-212`), com OneSignal inline e texto "pães". Para o market: usar o helper `NotificationsService.notifyUser` (`notifications.service.ts:122`), **novos valores em `NotificationType`**, texto próprio e `actionRoute` que abra o pedido de market. **Escopo v1 (DECIDIDO):** apenas `DELIVERED` (paridade com o pão) — **MKT-35**. `OUT_FOR_DELIVERY`/`NOT_DELIVERED` ficam fora do v1.

### 4.9 Superfícies do cliente — C7 não sai de graça (achado da revisão)

`TrackingScreen` + histórico leem **só `prisma.order`** (`/orders/today|next|history`, `orders.service.ts`). Um `MarketOrder` separado **não aparece sozinho**. Para MKT-01/C7 (market no acompanhamento/histórico): criar **endpoints de market** (`/market/orders/today|next|history`) + integrar no front, OU endpoints unificados que mesclem `Order` + `MarketOrder`.

## 5. Ondas de implementação

**Onda 0 — Fundações (backend, sem UI).** `schema.prisma` (models + enums + índices + `generate`); `defaults-seed.ts` (`marketMinimoCestinha` + 6 categorias); schemas Zod em `packages/shared/src/schemas` (+ tipos `z.infer`); infra S3 + endpoint de upload (admin).

**Onda 1 — Catálogo + admin (backend + UI admin).** Módulos `products`, `product-categories`, `admin-market` (route/controller/service/repo/schema, validação dupla, role ADMIN inline): CRUD admin de produto/categoria, ajuste de estoque, alerta de baixo estoque, `GET` público do catálogo. `admin-settings`: `marketMinimoCestinha`. UI: hub "Além do Pãozin" em `AdminGestao`; `MA_Produtos`, `MarketProductForm` (upload foto + **precificação ao vivo** lendo `/pricing`+`/combos`), `MA_Categorias`, `MA_Estoque`, `MA_Config`.

**Onda 2 — Catálogo cliente (frontend read-only).** 6ª aba na `ClientTabBar` (**sem remover Perfil**); `MarketCatalog` (grid, chips de categoria, banner "duas formas de pagar", **selo de economia dinâmico**), `ProductDetail` (painel 2 preços), estados esgotado/últimas; `MarketHomeBlock` na Home; `FloatingCart`.

**Onda 3 — Cestinha persistente.** Módulo `cart` (`GET/PUT /market/cart` por usuário, persistente; add/remove/setQty; `breadQty`). Tela `Cestinha` (itens, mínimo, continuar comprando). Add-on **C8** na `SingleScreen`.

**Onda 4 — Checkout + pagamento misto + fulfillment.** Tela de checkout (split "usar pãezinhos", padrão máx., valor ao vivo, método) + **sheet de confirmação (B)** + aviso suave saldo×agenda (usa `schedule-projection`). Backend: `POST /market/checkout` (valida mínimo/corte/estoque/**`availableDays`**, recalcula total no servidor, **chave de idempotência**, debita crédito + reserva estoque, cria `MarketOrder`; se `money>0` cria `Payment MARKET`; **limpa o `Cart` no sucesso**). Pagamento: **`creditForPayment` ramo `MARKET` (1º item, crítico)** + `fulfill-market-order.ts`; `createMarketPix` (copia `createHookPix`); **método novo de cartão** p/ valor arbitrário. **§4.7 segmentação financeira entra aqui** (senão receita/relatórios quebram ao ir ao ar). Tela de sucesso (`MarketDone`).

**Onda 5 — Integração na esteira (entrega real).** Os 4 pontos de §4.2: separação (board+conclude+cupom+`totalItems`), divisão (`getDivisionSuggestion`/`approveDivision`/`assignCourier`), rota do entregador (`getTodayOrders` + chips de itens), transições (`confirmDelivery`/`markNotDelivered`). Front `AdminSeparacao` + `CourierScreen`.

**Onda 6 — Cancelamento, histórico, notificações, polimento.** Cancelamento + estorno + devolução de estoque; **C7** = novos endpoints `/market/orders/*` + integração no acompanhamento/histórico (§4.9), timeline, cancelar antes do corte; **notificações** do market (§4.8); **sweep de Pix expirado** (libera estoque + estorna crédito); densidade da tab bar (6 itens).

**Ordem:** `0 → 1 → 2 → 3 → 4 → 5 → 6`. Cada onda é entregável e testável.

## 6. Riscos / pontos de atenção

1. **Esteira sem "lista"** — a integração custa tocar em ~5 queries de leitura (§4.2), não uma tabela. É o maior esforço não óbvio.
2. **`Order.quantity` é pão** — não misturar itens de produto no `totalBreads`; usar `totalItems` paralelo (só `breadQty` da cestinha soma em pães).
3. **Fastify apaga campos fora do response schema** — cobrir 100% dos campos em cada endpoint novo/alterado.
4. **Validação dupla** — atualizar JSON Schema (route) **e** Zod (schema) juntos ([[api-dual-schema-validation]]).
5. **`creditBalance` null** (contas legadas) — tratar antes de `$inc` no débito/estorno.
6. **Oversell** — decremento de estoque atômico/condicional em transação.
7. **Nunca confiar no total do cliente** — recalcular no servidor a partir dos preços reais.
8. **Pix abandonado** — estoque reservado + crédito debitado ficam presos; precisa do sweep de expiração (Onda 6).
9. **Selo de desconto** — sempre dinâmico dos combos reais (~16–17%), nunca hard-code do mock (37%).
10. **6 abas** — tratar densidade em 390px (ícone + rótulo curto), sem remover Perfil.
11. **Estorno com arredondamento** — `ceil(moneyAmount/avulsoUnit)` a favor do cliente.
12. 🔴 **`creditForPayment` sem ramo `MARKET`** → pagamento MARKET nunca vira PAID nem é cumprido. Maior armadilha; ramo novo é pré-requisito do checkout com dinheiro.
13. 🔴 **Vazamento de `purpose` no financeiro** — receita/relatórios/passivo de crédito não filtram `purpose` (HOOK já vaza); MARKET precisa de filtro (§4.7), senão os números do admin quebram.
14. **MarketOrder invisível** ao acompanhamento/histórico/painel do cliente (só leem `Order`) — C7 exige integração explícita (§4.9).
15. **Idempotência fraca p/ pedido 100% crédito** (sem `paymentId`, sem `@@unique`) — duplo-clique duplica pedido/débito/estoque; usar chave de idempotência.
16. **Cartão com valor arbitrário não existe hoje** — precisa de método novo (só Pix tem precedente via `createHookPix`).
17. **Parada só-market** (dia sem pão p/ o cliente) — o confirm do entregador é por `orderId`; garantir confirmação de parada que só tem `MarketOrder`.

## 7. Mapa requisito → onda

| Onda | MKT / trabalho |
|---|---|
| 0 | 05, 06 (infra), 08, 09, 16, 21, 25, 34 (modelo) |
| 1 | 04, 05, 06, 07, 10, 12, 13, 14, 19 |
| 2 | 01, 02, 12, 18 |
| 3 | 03, 34 |
| 4 | 15, 16, 17, 20, 21, 22, 25, 33, **36** (§4.7 seg. financeira, inclui HOOK) + idempotência + método cartão |
| 5 | 26, 27 (+ parada só-market) |
| 6 | 11, 30, 31, 32, **35** + **C7 endpoints (§4.9)** + **notificações de entrega (§4.8)** |

> **Requisitos "por design" (sem código dedicado):** MKT-23 (market não chama auto-recarga), MKT-24 (sem frete), MKT-29 (v1 sem recorrência) — garantidos por não implementar o oposto.

## 8. Checklist de remoção
- [ ] Todas as ondas concluídas e validadas
- [ ] **Apagar este arquivo** (`docs/plano-alem-do-paozin.md`)
