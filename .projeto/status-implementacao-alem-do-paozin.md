# STATUS — Implementação "Além do Pãozin" (mini market)

> 🔄 **Arquivo de retomada.** Atualizado ao fim de cada onda. Se o contexto estourar, abra uma
> nova janela e cole o **prompt de continuação** (no fim deste arquivo) para prosseguir de onde parou.
>
> **Última atualização:** 23/07/2026 — 🎉 **FEATURE COMPLETA** (Ondas 0–6, backend + frontend). Falta só: revisão/commit do usuário + apagar este plano/`docs`.

---

## 0. Como retomar (leia nesta ordem)
1. **Este arquivo** — estado atual + próximo passo exato.
2. [`docs/plano-alem-do-paozin.md`](./docs/plano-alem-do-paozin.md) — plano (6 ondas, §4.x, riscos, mapa MKT→onda).
3. [`add-feat-alem-do-paozin.md`](./add-feat-alem-do-paozin.md) — requisitos (DEC-01..39, MKT-01..36).
4. [`handoff-alem-do-paozin.md`](./handoff-alem-do-paozin.md) — design das telas (C1..C8, A1..A6, E1).

## 1. Regras invioláveis
- **NÃO** commitar nem pushar sem autorização explícita do usuário (regra do CLAUDE.md).
- Implementação **DIRETA** (sem GSD, autorizado), branch **`feat/update`**.
- **Order de pão intocado**; `MarketOrder` é separado e pega carona na esteira.
- **Mockup é placeholder** — usar números/dados reais, nunca os do protótipo (desconto real ~16–17%, não 37%).
- Padrão de módulo backend: `route` (JSON schema + `authenticate`) → `controller` (Zod + role ADMIN inline + `{statusCode,message}`) → `service` → `repository`. Rotas novas do market **sem response-schema**.
- Front admin: hub `AdminGestao` renderiza sub-telas por estado (`sub`), **sem mexer no router**. Telas usam `apiFetch`, `Icon`, `SwitchToggle`, `ConfirmSheet`, inputs inline com CSS vars.
- Design: tema claro (creme), tokens de `design_handoff_cheirin_pao/README.md`. **Perfil fica na tab bar**; Cestinha é a 6ª aba.
- **Ao terminar CADA onda/etapa: rodar typecheck (shared+api / web) + build do api, ATUALIZAR este arquivo e entregar novo prompt de continuação.**

## 2. Comandos de verificação
```bash
# regenerar Prisma Client após mudar o schema:
DATABASE_URL="mongodb://localhost:27017/cheirin" npx prisma generate --schema=apps/api/prisma/schema.prisma
# typecheck:
npm run -w @cheirin-de-pao/shared typecheck
npm run -w @cheirin-de-pao/api typecheck
npm run -w @cheirin-de-pao/web typecheck
# build backend:
npm run -w @cheirin-de-pao/api build
```

## 3. Progresso

### ✅ Onda 0 — Fundações (backend) — CONCLUÍDA
- `schema.prisma`: models `Product`, `ProductCategory`, `Cart`, `MarketOrder`, `ProductDailyStock`; composites `MarketOrderItem`, `CartItem`; enums `StockType`, `MarketOrderStatus` (com `PENDING_PAYMENT`); `TransactionType` += `MARKET_PURCHASE`/`MARKET_REFUND`; `PaymentPurpose` += `MARKET`. `MarketOrder.idempotencyKey @unique`.
- `bootstrap/defaults-seed.ts`: setting `marketMinimoCestinha=15.00` + 6 categorias padrão.
- `packages/shared/src/schemas/market.ts` (+ export em `index.ts`): Zod + tipos.
- Infra S3: `@fastify/multipart` + `@aws-sdk/client-s3`; `apps/api/src/lib/storage.ts`; multipart no `server.ts`; env `S3_*` opcional.

### ✅ Onda 1 — Catálogo + Admin — CONCLUÍDA (typecheck shared+api+web e build api OK)
**Backend:**
- `apps/api/src/modules/admin-market/` (schema, repository, service, controller, route): produtos CRUD + `PATCH /:id/stock`; `POST /admin/market/upload` (multipart→S3); categorias CRUD (delete bloqueado com produtos → 409); config `GET/PATCH /admin/market/config`. Listagem inclui `lowStock`.
- `apps/api/src/modules/market/` (repository, service, controller, route): `GET /market/catalog` (autenticado) → `{ categories, products }` com flags `soldOut`/`limited`.
- `server.ts`: registrados `adminMarketRoute` + `marketRoute` + tags Swagger.

**UI admin** (padrão AdminGestao — sub-telas por estado):
- `apps/web/src/pages/admin/gestao/AdminMarket.tsx` (hub + chips Produtos/Categorias/Config).
- `MarketProdutos.tsx` (lista + alerta de baixo estoque + filtro por categoria).
- `MarketProductForm.tsx` (upload de foto, **precificação ao vivo** lendo `/admin/settings/avulso` + `/admin/combos`, tipo de estoque, disponibilidade por dias, ativo, excluir).
- `MarketCategorias.tsx` (CRUD) · `MarketConfig.tsx` (mínimo da Cestinha).
- `AdminGestao.tsx`: item "Além do Pãozin" no hub + switch. `lib/apiFetch.ts`: passa a suportar `FormData` (não força `Content-Type: json` no upload).

### ✅ Onda 2 — Catálogo do cliente (frontend read-only) — CONCLUÍDA (typecheck shared+api+web e build api OK)
> Read-only/navegação: browsear catálogo, filtrar, abrir detalhe. "Adicionar à Cestinha" + carrinho = Onda 3.
**Dados (fonte única):**
- `apps/web/src/lib/market.ts` — tipos (`MarketProduct`/`MarketCategory`/`MarketCatalog`) + helpers `formatBRL`, `paezinhosDe`, `formatAvailableDays`.
- `apps/web/src/hooks/useMarketCatalog.ts` — busca em paralelo `GET /market/catalog` + `GET /pricing` (avulsoUnit) + `GET /combos` → `maxEconomyPercent` = `max(economyPercent)` dos combos (selo dinâmico real ~16–17%, **nunca 37%**). Expõe `reload`.

**Chrome / navegação:**
- `components/brand/Icon.tsx`: novo ícone **`basket`** (identidade da área).
- `components/client/ClientTabBar.tsx`: **6ª aba "Cestinha"** (ícone basket, path `/client/market`), inserida entre Pães e Pedidos — **Perfil mantido**. Densidade ajustada p/ 6 itens (fonte 10, ícone 21, gap 3, `whiteSpace:nowrap`).
- `routes/router.tsx`: rotas `market` → `MarketCatalog` e `market/produto/:id` → `ProductDetail` (lazy, sob `/client`).

**Componentes:**
- `components/client/ProdPhoto.tsx` — foto S3 ou fallback (gradiente por `categoryId` + emoji da categoria); prop `dimmed` p/ esgotado.
- `components/client/ProdCard.tsx` — card do grid (2 col): foto, nome, preço à vista, "ou N 🥖", selo `🥖 −X%`, badges Esgotado/Últimas. Read-only (sem add).
- `components/client/MarketMiniCard.tsx` — card compacto da faixa da Home.
- `components/client/MarketHomeBlock.tsx` — bloco "Além do Pãozin" na Home; até 6 produtos (disponíveis 1º) + "Ver tudo"; **`return null` sem produtos** (renderizado direto na Home, sem wrapper motion, p/ não deixar gap fantasma).

**Telas:**
- `pages/client/MarketCatalog.tsx` (aba Cestinha) — AppBar basket, banner **"Duas formas de pagar"** (economia até X%), busca, chips de categoria (Tudo + categorias), grid 2 col; estados: loading skeleton, erro (retry), catálogo vazio, sem resultado.
- `pages/client/ProductDetail.tsx` — foto grande, categoria+nome, **painel de 2 preços** (À vista R$ × Com pãezinhos = N 🥖 + "economize até X%"), descrição, aviso de disponibilidade (dias), avisos esgotado/últimas; estados loading/erro/não-encontrado. **Sem CTA de adicionar** (Onda 3).
- `pages/client/HomeScreen.tsx`: `MarketHomeBlock` encaixado entre QuickActions e Próximas entregas.

**Notas p/ Onda 3:** o `useMarketCatalog` já centraliza catálogo+preço+economia (reusar). `FloatingCart`, botão "Adicionar à Cestinha" (no `ProdCard`/`ProductDetail`) e contador no AppBar do catálogo ficaram deliberadamente de fora.

### ✅ Onda 3 — Cestinha persistente — CONCLUÍDA (typecheck shared+api+web e build api OK)
> Carrinho por usuário no backend (persistente entre sessões/dispositivos, DEC-39/MKT-34) + tela + add + add-on C8. Checkout/pagamento = Onda 4.

**Backend (dentro do módulo `market`, sem criar `modules/cart`):**
- `market.repository.ts`: `getCart`, `upsertCart` (composite `items: { set }`), `findProductsByIds`, `getSetting`.
- `market.service.ts`: `getCart(userId)` + `updateCart(userId, input)` via `buildCartView` — junta itens com `Product`, **recalcula subtotal no servidor**, snapshot nome/preço/foto, flag `soldOut`, **ignora produto inativo/inexistente**, aplica `marketMinimoCestinha` + `avulsoUnit`, `meetsMinimum`. `updateCart` colapsa duplicados/clampa qty(1..99)/breadQty(0..100); breadQty ausente = preserva.
- `market.controller.ts`: `getCart`/`updateCart` (Zod `UpdateCartSchema`, `userId = request.user!.id`).
- `market.route.ts`: `GET /market/cart` + `PUT /market/cart` (authenticate, **sem response-schema**).

**Front (estado + telas):**
- `lib/market.ts`: tipos `CartView`/`CartLine` + `emptyCart()`.
- `contexts/CartContext.tsx` (`CartProvider` + `useCart`): estado da Cestinha; `addProduct/setQty/removeProduct/setBreadQty/clear/qtyOf/count/subtotal`; **otimista + PUT com debounce (400ms) + guard de sequência (anti-rollback de cliques rápidos) + reload em falha**. Monta em `ClientLayout` (dentro de `NotifProvider`).
- `components/client/FloatingCart.tsx`: botão flutuante (contador+subtotal) → Cestinha. **Allowlist** de telas sem rodapé fixo (`/client`,`/home`,`/pedidos`,`/perfil`,`/notificacoes`) p/ não colidir com CTAs fixos (Combos/Agenda/Single/Cartões).
- `components/client/CartButton.tsx`: ícone Cestinha + contador na AppBar do catálogo e do detalhe (onde o FloatingCart fica oculto).
- `ProdCard.tsx`: root virou `div[role=button]`; controle de adicionar isolado (+ → stepper − N +); esgotado sem add; selo economia movido p/ canto sup. direito.
- `pages/client/ProductDetail.tsx`: rodapé fixo `DetailFooter` (StepperInline + "Adicionar · R$" com feedback "Adicionado ✓"; esgotado → CTA desabilitado) + `CartButton` na AppBar.
- `pages/client/CestinhaScreen.tsx` (rota `market/cestinha`): itens (ProdPhoto, nome, R$/🥖, StepperInline, remover, aviso "Esgotado"), linha "Seu pedido de pão" quando `breadQty>0` (pago com pãezinhos, stepper 0..100), resumo (subtotal + aviso de mínimo "Faltam R$ X"), "Continuar comprando", rodapé "Ir para pagamento" (desabilitado < mínimo; **acima do mínimo mostra nota "pagamento na próxima atualização" — checkout é Onda 4**). Estados vazia/loading.
- `components/client/MarketMiniCard.tsx`: agora 2 modos — `onOpen` (faixa da Home, navega) e `onAdd` (C8, adiciona sem navegar, selo de qtd).
- `components/client/MarketAddonStrip.tsx` + `SingleScreen.tsx`: **add-on C8** aditivo (após o card de quantidade, sem tocar no submit do pão). Tocar produto adiciona à Cestinha; CTA "Ir para a Cestinha (N)" faz `setBreadQty(qtd)` e navega.

**Decisões desta onda:** cart guardado como `{productId, qty}[]`+`breadQty`; servidor é a autoridade (reconcilia após PUT). Selo/preços reusam `useMarketCatalog`. Itens esgotados permanecem na Cestinha marcados (validação dura fica no checkout, Onda 4). `count` = Σ qty de produto (não conta pães).

### ✅ Onda 4 — Checkout + pagamento misto — CONCLUÍDA (backend + frontend; typecheck shared+api+web + build api + teste creditForPayment OK)
> §4.7 feita nesta onda (Opção B). Fluxo assíncrono de falha/expiração de pagamento → Onda 6.

**Pagamento/fulfillment:**
- `apps/api/src/modules/payments/fulfill-market-order.ts` (novo): `fulfillMarketOrder` acha `MarketOrder` por `paymentId`; `PENDING_PAYMENT → SCHEDULED`; marca `Payment` PAID; **não credita saldo**. Idempotente.
- `credit-payment.ts`: ramo `purpose === 'MARKET'` → `fulfillMarketOrder`. **Cobre webhook Stripe + webhook MP + pull `getStatus` de uma vez** (todos passam por `creditForPayment`).
- `payments.service.ts`: `createMarketPix({amount,marketOrderId})` (copia `createHookPix`) + `createMarketCard(...)` novo (valor arbitrário; `idempotencyKey` `market_<orderId>`; cartão salvo com sucesso síncrono → `fulfillMarketOrder`). Ambos gravam `MarketOrder.paymentId` logo após criar o `Payment`.

**Checkout:**
- `market-checkout.service.ts` (novo) `MarketCheckoutService.checkout`: idempotência (`idempotencyKey @unique` + catch P2002), lê Cestinha no servidor, valida mínimo/corte(`isPastCutoffForDelivery`)/`availableDays`/estoque, **recalcula total**, `creditsApplied = min(saldo, escolha, floor(total/avulsoUnit))`, `moneyAmount`. Transação: **reserva estoque atômica** (FIXED `updateMany stock>=qty decrement`; DAILY `ProductDailyStock` upsert + `updateMany reserved<=cap-qty inc`) → cria `MarketOrder` → debita crédito (`MARKET_PURCHASE`, referenceId=order.id). money==0 → `SCHEDULED`; money>0 → `PENDING_PAYMENT` + `createMarketPix/Card`. **Limpa a Cestinha** no sucesso. Falha síncrona do gateway → `releaseOrder` (libera estoque + `MARKET_REFUND` + `CANCELLED`).
- `market.controller.ts` + `market.route.ts`: `POST /market/checkout` (Zod `MarketCheckoutSchema`, sem response-schema). `handleError` agora repassa `{statusCode,message}`.

**§4.7 segmentação financeira (MKT-36) — Opção B (DECIDIDA pelo usuário):** filtro só nos relatórios de **dinheiro**; relatórios **comportamentais/operacionais contam tudo**. `apps/api/src/lib/revenue.ts` (novo: `excludeNonCreditPurpose` = `NOT purpose in [HOOK,MARKET]`; `nonCreditPurposeMatchRaw` = `$nin`; compras de crédito têm `purpose=null` e continuam contando).
- **COM filtro** (receita/passivo/ranking): `admin-financial.getRevenue` (total+combos+avulso+pipeline condo), `admin-orders.getDashboard` (revenueToday/ontem), `admin-reports.getCreditLiability` (paidAgg — corrige `estPricePerCredit`), `admin-reports.getCondominiumRanking` (raw).
- **SEM filtro (conta tudo — saúde do gateway / comportamento):** `admin-reports.getPaymentsReport` (aprovação/método/recuperação — recusas do fluxo novo precisam aparecer) e `getRetentionReport` (MARKET buyer é cliente real).
- `admin-payments`: expõe `purpose` no list/getById (**+ campo no response-schema da rota**); refund não grava CreditTransaction qty 0 **e BLOQUEIA estorno de `purpose=MARKET`** (400 "use o cancelamento da Cestinha") — senão estornaria o dinheiro mas deixaria o pedido ativo + créditos presos.

**Decisões desta etapa:** vínculo Payment↔MarketOrder por `MarketOrder.paymentId` (não há metadata no Payment). Reserva/débito ANTES do gateway; compensação síncrona no erro. **Reversão em falha ASSÍNCRONA (Pix expirado/abandonado E Pix/cartão recusado) NÃO é feita hoje** — `MarketOrder` fica `PENDING_PAYMENT` com estoque+crédito presos → **resolver no sweep da Onda 6** (varre `PENDING_PAYMENT` velhos → `releaseOrder`; cobre expiração E recusa).

**Frontend (feito):**
- `pages/client/MarketCheckoutScreen.tsx` (rota `market/checkout`): resumo curto; seletor de entrega (régua de dias + slots, corte via `lib/cutoff` do front); **split "Usar meus pãezinhos"** (range 0..`min(saldo, floor(total/avulso))`, **padrão = máximo**, atalhos "Só dinheiro"/"Usar o máximo", selo −X% de `maxEconomyPercent`); balanço Com pãezinhos × Em dinheiro; **aviso suave dourado** saldo×agenda (via `useSchedule`); forma de pagamento **só quando `moneyAmount>0`** (Pix / cartão salvo `SavedCardsList` / novo cartão `AddCardForm`); **sheet de confirmação (B, MKT-33)** para Pix/cartão-salvo; sub-view `waiting` (QR Pix + `usePaymentPolling`; cartão pending idem). `idempotencyKey` = `crypto.randomUUID()` gerado 1× no mount.
- `pages/client/MarketDoneScreen.tsx` (rota `market/sucesso`): confirmação, "chega {quando}, junto com o pão", pãezinhos usados + dinheiro + total, CTAs "Acompanhar pedidos"/"Voltar ao início".
- `CestinhaScreen`: CTA "Ir para pagamento" agora navega para `market/checkout` (removida a nota "em breve").

**Decisões do frontend:** cartão = sempre **salvar-e-cobrar** `savedCardId` (reusa `AddCardForm`+off_session, como o combo) — **não** uso confirmação de PaymentIntent/`clientSecret` no front (o ramo new-card com clientSecret do backend fica sem uso, mas inofensivo). Cartão novo confirma pelo próprio botão do `AddCardForm` (não passa pelo sheet — é confirmação explícita equivalente). Após sucesso, `reloadCart()` sincroniza a Cestinha vazia. "Acompanhar" leva a `/client/pedidos` (market no acompanhamento = Onda 6).

### ✅ Onda 5 — Integração na esteira — CONCLUÍDA (backend + frontend; typecheck shared+api+web + build api + 88 testes OK)
> `MarketOrder` pega carona na esteira do pão (§4.2): transições, display (separação + rota do entregador) e parada só-market — backend E frontend prontos.

**Helper novo:** `apps/api/src/lib/market-pipeline.ts` — `separateMarketOrders`, `dispatchMarketForOrders` (deriva escopo condo/slot/dia dos pedidos de pão atribuídos → mesmo courier + opcional despacho), `assignMarketByCondoDay`, `propagateMarketStatusForOrder` (espelha transição do Order no MarketOrder do mesmo userId/dia/slot). Todos `updateMany` guardados por status (idempotentes). **NÃO** propaga CANCELLED (cancelar pão ≠ cancelar Cestinha).

**Transições fiadas:**
- `admin-separation.conclude`: + `separateMarketOrders` (SCHEDULED→SEPARATED no condo/slot/dia). count agregado.
- `admin-orders.updateOrderStatus`: + `propagateMarketStatusForOrder` (cobre toggle de separação + confirm/fail do entregador em parada combinada).
- `admin-orders.assignCourier` (orderIds e condo+date): + courier nos MarketOrder do escopo.
- `admin-orders.approveDivision`: + courier + OUT_FOR_DELIVERY nos MarketOrder do escopo dos pedidos despachados.
- **`dispatchMarketForOrders` (refinado — slot dividido entre couriers):** (1) parada COMBINADA casa por `userId` (Cestinha vai pro MESMO courier do pão do cliente — sem last-write-wins); (2) parada SÓ-market (cliente sem pão no slot, excluindo quem tem pão de QUALQUER courier) cai no 1º courier a processar (guard `courierId: null`). Corrige o risco de a Cestinha aparecer na rota do courier errado.

**Display + parada só-market:**
- `admin-separation.getBoard`: mescla MarketOrder por (condo, slot, cliente) — parada combinada anexa `marketItems`/`marketItemCount` e soma `breadQty` aos pães; **parada só-market** vira linha com `marketOrderId` e `orderId:''`. Novos contadores `totalItems`/`separatedItems` (slot/condo/board). Gate = mesmos turnos com PurchaseOrder FINALIZED (slot 100% só-market sem PO não aparece — limitação conhecida). **Response-schema atualizado.**
- `courier.getTodayOrders`: mescla MarketOrder do courier nas paradas (combinada: soma breadQty + `marketItems`; só-market: parada sintética com `marketOrderId`), aba "Realizadas" idem. `totalItems` no topo. **Response-schema + `courier.schema` atualizados.**
- `courier.repository`: `findTodayMarketByCourierId`, `findTodayCompletedMarketByCourierId`, `findMarketById`.
- **Parada só-market** confirma/nega por rota própria: `PATCH /courier/market-orders/:id/confirm` e `/not-delivered` (`confirmMarketDelivery`/`markMarketNotDelivered` no service; validam courierId + status OUT_FOR_DELIVERY). Paradas combinadas continuam confirmando pelo `orderId` do pão (propaga sozinho).

**Testes:** mocks de prisma de `courier`/`admin-separation` ganharam stub `marketOrder` (findMany/updateMany vazios) — 88 testes passam.

**Frontend (feito):**
- `components/admin/SeparationCoupon.tsx`: cupom impresso ganhou seção "Além do Pãozin" (lista de itens) + esconde "Pãezinhos" quando 0 (parada só-market); `CouponData += marketItems?`.
- `pages/admin/tabs/AdminSeparacao.tsx`: interfaces com `marketItems`/`marketItemCount`/`marketOrderId` + `totalItems`/`separatedItems`. `OrderRow` mostra chips dos itens (gold); parada só-market (`orderId===''`) tem checkbox read-only (separa no "Concluir") + código do cupom via `marketOrderId`; pães só quando >0. Subtítulo do condomínio e resumo mostram "+ N itens". `toggleOrder` ignora parada só-market.
- `components/courier/StopRow.tsx`: `Stop += marketOrderId?/marketItems?/marketItemCount?` + helper `stopKey` (orderId || marketOrderId). Chips dos itens sob o nome; parada só-market mostra 🧺 no lugar dos pães.
- `components/courier/CondoAccordion.tsx` + `CourierScreen.tsx`: rastreio de confirmadas/não-entregues por `stopKey` (não colide entre paradas só-market); `totalItems` no card "Rota de hoje"; concluídas da sessão levam os itens.
- `components/courier/ConfirmDeliveryDialog.tsx`: escolhe o endpoint por tipo — pão `/courier/orders/:id/*`, só-market `/courier/market-orders/:id/*`; resumo trata 0 pães.
- `components/courier/CourierCompletedList.tsx`: chips dos itens + 🧺 quando 0 pães; chave por `marketOrderId`.

### ✅ Onda 6 — Cancelamento, histórico (C7), sweep, notificações — CONCLUÍDA (backend + frontend; typecheck shared+api+web + build api + 88 testes OK)
> Última onda concluída. Backend do pós-venda + frontend C7 prontos.

**Cancelamento + estorno (MKT-30/31/32):** `apps/api/src/modules/market/market-orders.service.ts` (novo) `cancelOrder(userId, id)` — 404 se não é do usuário; idempotente se já CANCELLED; só `SCHEDULED`/`PENDING_PAYMENT`; gate de corte (`isPastCutoffForDelivery` via slots do condo, code `CUTOFF_PASSED`). Estorno **tudo em crédito**: `creditsApplied + (moneyPaid ? ceil(moneyAmount/avulsoUnit) : 0)` — `moneyPaid = SCHEDULED && moneyAmount>0` (PENDING_PAYMENT não pagou dinheiro → só créditos). `MARKET_REFUND` idempotente por `referenceId`, devolve estoque, `CANCELLED`. **Sem estorno no gateway** (DEC-36).

**C7 leitura:** mesmo serviço — `getToday`/`getNext`/`getHistory` retornam view enriquecida (items, status, datas, split, `cancelable` = aberto & antes do corte, `refundedCredits` real dos CANCELLED via soma das `MARKET_REFUND`).

**Sweep (risco de Pix preso):** `MarketCheckoutService.sweepStuckPayments(ttl=30min)` — varre `PENDING_PAYMENT` além do TTL → `releaseOrder` (créditos aplicados + estoque + CANCELLED). **Plugado no cron de 1 min** (`plugins/cron.ts`). Cobre Pix expirado/abandonado E recusado.

**Notificação (MKT-35, só DELIVERED):** `market-notify.ts` `notifyMarketDelivered` (reusa `DELIVERY_DONE`, texto/rota do market). Disparado em `admin-orders.updateOrderStatus` (parada combinada — só se o cliente tinha Cestinha DELIVERED no escopo) e em `courier.confirmMarketDelivery` (parada só-market).

**Rotas:** `GET /market/orders/today|next|history` + `POST /market/orders/:id/cancel` (no `market.route`/controller; sem response-schema).

**Frontend C7 (feito):** `components/client/MarketOrdersSection.tsx` (novo) — seção **auto-contida** "Suas Cestinhas" na `TrackingScreen` (não toca no fluxo do pão): consome `GET /market/orders/history`, card com ícone basket + chips dos itens (+ `breadQty`), status pill (Agendada/Em separação/Saiu/Entregue/Cancelada), split pago, botão **Cancelar** quando `cancelable` (confirm inline → `POST /market/orders/:id/cancel`), nota "estornado em {refundedCredits} 🥖". Some quando não há Cestinha. Encaixada na `TrackingScreen` acima do "Histórico" do pão.

### 🎉 FEATURE COMPLETA — o que falta é só do usuário
1. **Revisar** o diff completo (branch `feat/update`).
2. **Commit + push** (NÃO feito — regra: só com autorização explícita).
3. **Apagar os docs temporários** de planejamento quando quiser: `docs/plano-alem-do-paozin.md` (checklist §8 do próprio plano) e, se fizer sentido, este `status-*.md` + os `add-feat-*`/`brief-*`/`handoff-*`.
4. **Pendências conhecidas p/ produção** (não bloqueiam a feature): configurar bucket/credenciais **S3** (`S3_*` no `.env`) para o upload de foto; testar o fluxo ponta-a-ponta com Mongo Atlas + Stripe/MP reais (a verificação foi typecheck + build + 88 testes unitários, sem e2e).

### Recap das ondas (todas ✅)
- **0** Fundações (schema/enums/seed/S3) · **1** Catálogo + admin · **2** Catálogo do cliente · **3** Cestinha persistente · **4** Checkout + pagamento misto (+ §4.7 segmentação financeira Opção B) · **5** Integração na esteira (separação/divisão/rota/transições + parada só-market) · **6** Cancelamento/estorno + sweep + C7 + notificação.

## 4. Decisões que valem lembrar
- 1 crédito resgata a valor avulso (`avulsoUnit`). Desconto implícito (economia do combo). Selo dinâmico.
- Pagamento misto obrigatório no v1. Pães na Cestinha = Fork 2 (`MarketOrder.breadQty`).
- Estorno: tudo em crédito (inclusive parte em dinheiro, `ceil`). Cancelar só antes do corte.
- Estoque DAILY: contador atômico `ProductDailyStock` por (produto, dia).
- Notificação de entrega do market no v1: só `DELIVERED`. Financeiro (§4.7, **feito na Onda 4, Opção B**): filtro de `purpose` (exclui MARKET+HOOK) **só nos relatórios de dinheiro** (receita/passivo/ranking); saúde do gateway/retenção contam tudo. Estorno genérico de MARKET **bloqueado**.
- `availableDays = []` (ou ausente) = sempre disponível.
- **Esteira (Onda 5, DECIDIDO):** a Cestinha só pega carona em turno que **já tem pão** (gate = `PurchaseOrder` FINALIZED). Turno 100% só-market (sem pão no turno inteiro) não aparece na separação — comportamento aceito.

---

## 5. PROMPT DE CONTINUAÇÃO (copie para a nova janela)

```
Continue a implementação da feature "Além do Pãozin" (mini market) no app Cheirin de Pão.

Recupere TODO o contexto lendo, nesta ordem:
1. .projeto/status-implementacao-alem-do-paozin.md   (estado atual + próximo passo exato)
2. .projeto/docs/plano-alem-do-paozin.md             (plano: 6 ondas, §4.x, riscos)
3. .projeto/add-feat-alem-do-paozin.md               (requisitos DEC-01..39 / MKT-01..36)
4. .projeto/handoff-alem-do-paozin.md                (design das telas)

Regras invioláveis:
- NÃO faça commit nem push sem eu autorizar explicitamente.
- Implementação DIRETA (sem GSD), na branch feat/update. Nada de refatorar o fluxo do pão (Order intocado).
- Mockup é placeholder: use números/dados reais, nunca os do protótipo.
- Padrão de módulo: route(JSON schema)+authenticate → controller(Zod + role ADMIN inline) → service → repository. Rotas novas do market sem response-schema. Front admin = sub-telas por estado no AdminGestao (sem router).
- OBRIGATÓRIO ao terminar CADA onda/etapa, nesta ordem: (1) rode typecheck (shared+api+web) e build do api; (2) ATUALIZE o arquivo de contexto .projeto/status-implementacao-alem-do-paozin.md (progresso done/next, arquivos novos, decisões e a data em "Última atualização"); (3) me entregue AQUI no chat o PROMPT DE CONTINUAÇÃO atualizado (este mesmo bloco, apontando o novo "próximo passo") para eu colar numa nova sessão caso o contexto estoure.

Tarefa: a feature "Além do Pãozin" está COMPLETA (Ondas 0–6, backend + frontend, typecheck+build+88 testes OK) na branch feat/update, SEM commit. Se esta sessão reabrir: nada de novo a implementar — o pendente é revisão + commit/push (só com minha autorização explícita) e, quando eu pedir, apagar os docs temporários de planejamento. Só retome desenvolvimento se eu apontar um ajuste/bug específico.
```
