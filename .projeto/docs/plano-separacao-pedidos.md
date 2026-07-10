# Plano — Pipeline rastreável de pedidos (corte → separação → entrega → histórico)

> ⚠️ **Documento temporário de planejamento.** Serve de referência durante a implementação.
> **Apagar ao concluir todas as fases**, quando não for mais necessário.

---

## 1. Objetivo

Transformar a operação do admin num **pipeline com estados rastreáveis de ponta a ponta**, resolvendo três necessidades:

1. **Verificação geral de pedidos** — visão de futuros agendados + histórico completo (entregue / não entregue / cancelado), com detector de pedidos "no limbo" (sem desfecho).
2. **Etapa intermediária de Separação** — entre o corte/compra ao fornecedor e a divisão de entregas: recebimento dos pães, separação por cliente, **cupom não fiscal impresso (térmica)** com QR, conferência final e liberação do lote para a Entrega.
3. **Navegação** — incluir o passo de Separação na barra e mover o logout para o fim da Gestão.

---

## 2. Decisões travadas

| Tema | Decisão |
|---|---|
| Impressão do cupom | **HTML + `window.print()`** (CSS 80/58mm, qualquer impressora com driver) |
| Estilo do cupom | Prévia na tela com a marca; `@media print` **monocromático, sem fundo** (térmica imprime só preto/branco) |
| QR no cupom | **Sim** — codifica `orderId`. **Sem HMAC no v1** (JWT + dono já protegem; HMAC = v2) |
| Confirmação do entregador | App do entregador escaneia o QR → confirma entrega (reusa `confirm`). `BarcodeDetector` nativo + fallback JS + botão manual |
| Falha de entrega | `NOT_DELIVERED` + motivo. **Crédito permanece debitado**; estorno é ação manual (atalho dedicado) |
| Granularidade "Concluir separação" | **Condomínio + turno** (lote físico), com roll-ups "concluir condomínio" e "concluir tudo" |
| Cadeia de custódia (scan no recebimento do lote) | **Fora do v1** |
| Navegação | 6 abas: **Painel · Compra · Separação · Entregas · Clientes · Gestão**; logout → fim da Gestão |
| Renomear `Pedido`→`Compra` | Só o **label**; key interna `pedido` mantida |
| Verificação de pedidos | Sub-abas dentro de **Entregas**: Hoje · Próximos · Histórico |
| Estorno | Atalho "Estornar crédito" no detalhe do pedido (`REFUND`), idempotente, com motivo |

---

## 3. Estado atual (resumo do levantamento)

- **Ciclo de vida hoje:** só `SCHEDULED → OUT_FOR_DELIVERY → DELIVERED`
  (`apps/api/src/modules/admin-orders/admin-orders.service.ts:9-19`).
  `CANCELLED` existe no enum mas nunca é setado. **Não há estado de falha nem detector de parados** → origem do "limbo".
- **Sem histórico real por cliente:** a aba Entregas tem "Histórico", mas mostra **pedidos de compra ao fornecedor** (`PurchaseOrder`), não entregas por cliente — e `delivered/total` nem são populados (`apps/web/src/pages/admin/tabs/AdminEntregas.tsx:317`).
- **Vão entre corte e entrega:** `admin-supplier-orders` vai `draft → finalize` e **para**. Nada acontece depois. `DeliveryList` existe no schema mas nunca é usado. Não há cupom/impressora térmica no repo.
- **Materialização:** cron a cada minuto cria `Order`s no `cutoffTime` de cada turno, para a **data de entrega** correta (`apps/api/src/lib/cutoff.ts`, `schedules.service.ts:createOrdersAtCutoff`). Crédito é debitado nesse momento.
- **Navegação:** 5 abas + botão "Sair" embutido na nav (`AdminBottomNav.tsx:13-19` e `:92-122`); Gestão é hub com 8 itens (`AdminGestao.tsx:32-41`).

---

## 4. Modelo-alvo

### Ciclo de vida v2

```
SCHEDULED ──→ SEPARATED ──→ OUT_FOR_DELIVERY ──→ DELIVERED
   │             │                                  │
   └──→ CANCELLED└──→ CANCELLED          └──→ NOT_DELIVERED (com motivo)
```

- `SEPARATED` (novo): separado + cupom impresso + conferido. **Só `SEPARATED` entra na divisão da Entrega** (gate).
- `NOT_DELIVERED` (novo): falha com motivo → tira do limbo. Crédito permanece debitado.
- `CANCELLED`: passa a ser realmente usado (cancelamento antes da entrega).
- Detector de limbo: `scheduledDate` no passado + status não-terminal.

### Pipeline de telas

`Painel · Compra (corte→fornecedor + histórico de compras) · Separação (novo) · Entregas (Hoje·Próximos·Histórico) · Clientes · Gestão (+ Sair)`

### Glossário — "lote físico"

Conjunto de pedidos de **um condomínio + um turno**, embalado junto e entregue como bloco a um entregador (ex.: "Jardim Sul — Manhã", 8 aptos). É a unidade de "Concluir separação". Cliente com manhã+tarde = 2 pedidos = 2 cupons = 2 lotes.

---

## 5. Fases de implementação

### Fase 0 — Modelo de dados + ciclo de vida (backend)

- `apps/api/prisma/schema.prisma`:
  - `OrderStatus`: `+ SEPARATED`, `+ NOT_DELIVERED`.
  - `Order`: `+ separatedAt`, `deliveredAt`, `failedAt`, `failureReason`, `cancelledAt`, `cancelReason`.
  - Índices `@@index([status, scheduledDate])`, `@@index([condominiumId, scheduledDate])`.
  - `npx prisma generate`.
- `admin-orders.service.ts`: atualizar `VALID_TRANSITIONS`; `updateOrderStatus(reason?)` setando timestamps/motivos por status.
- Route/controller: body aceita `reason` opcional; **response schema cobrindo todos os campos novos** (ver Riscos).
- Testes das novas transições.

### Fase A — Separação (backend) + gate da Entrega

Novo módulo `apps/api/src/modules/admin-separation/` (route/controller/service/repository/schema/tests):
- `GET /admin/separation/board?date=YYYY-MM-DD` (default = data de entrega corrente) → `Order`s materializados agrupados **condomínio → turno → cliente**, com status de separação, contadores (separados/total) e payload do cupom (dados + `orderId` p/ QR). Reusa a lógica de linhas por cliente de `admin-supplier-orders` (apenas `source: 'order'`, filtrado por `scheduledDate`).
- `PATCH /admin/separation/orders/:id` `{ separated: boolean }` → `SCHEDULED ↔ SEPARATED`, set/clear `separatedAt`.
- `PATCH /admin/separation/conclude` `{ condominiumId, slotId, date }` → todos `SCHEDULED` do escopo → `SEPARATED` (idempotente).
- **Gate** em `admin-orders.service.ts` (`division-suggestion`, `delivery-status`, `assign-courier`): filtrar `SEPARATED`.
  **Transição segura de rollout:** aceitar `SCHEDULED OR SEPARATED` até a UI da Fase B estar no ar; depois fechar só em `SEPARATED`.

### Fase B — Separação (frontend) + cupom térmico

- `apps/web/src/pages/admin/tabs/AdminSeparacao.tsx`: lista por condomínio → turno → cliente; toggle "separado"; progresso por lote; "Imprimir cupom" (individual e lote do condomínio+turno); "Concluir separação" (condo+turno) + roll-ups.
- `apps/web/src/components/admin/SeparationCoupon.tsx`: componente **print-only**.
  - Prévia na tela com a marca (SVG do pãozinho, paleta `#FBF3E4`/`#1E1207`/`#B0702A`, fontes Bricolage + Hanken).
  - `@media print` + `@page { size: 80mm auto; margin: 0 }` **monocromático, sem fundo, alto contraste**.
  - Conteúdo real: condomínio, bloco/apto, cliente, quantidade, turno, código curto + **QR (orderId)**.
  - QR: usar `qrcode.react` (`QRCodeSVG`) — SVG nítido, imprime bem em mono. (Sem dependência de rede.)
- `AdminLayout.tsx`: novo tab `separacao`.

### Fase C — Navegação

- `AdminBottomNav.tsx`: label `Pedido`→`Compra`; inserir `separacao` entre `pedido` e `entregas`; **remover** o botão "Sair" + dialog.
- `AdminLayout.tsx` / `AdminTab`: `+ 'separacao'`.
- `AdminGestao.tsx`: "Sair" como item final do hub + dialog de confirmação (reusar D-09).

### Fase D — Verificação geral (ledger + limbo + estorno)

Backend:
- `GET /admin/orders` (ledger paginado): filtros `from`, `to`, `status[]`, `condominiumId`, `courierId`, `q` (cliente/apto).
- `GET /admin/orders/stuck` (limbo): `scheduledDate < início de hoje (BRT)` **e** status ∉ {`DELIVERED`,`NOT_DELIVERED`,`CANCELLED`}.
- `POST /admin/orders/:id/refund`: `CreditTransaction` `REFUND` (+qty), idempotente, com `reason`. **Atenção `creditBalance` null** (contas legadas) — tratar antes do `$inc`.
- Dashboard: `+ stuckCount`.

Frontend:
- `AdminEntregas.tsx`: SegmentedControl → **Hoje · Próximos · Histórico**.
  - Hoje: divisão + tracking (já com gate).
  - Próximos: `GET /admin/orders` (futuros materializados).
  - Histórico: ledger por cliente, chips de status (Entregue / Não entregue / Cancelado / **Parados**), busca, intervalo. Detalhe do pedido → marcar `NOT_DELIVERED`/`CANCELLED` + **"Estornar crédito"**.
- Mover o **histórico de compras ao fornecedor** para a aba **Compra** (`AdminPedido.tsx`).
- Painel: card "N pedidos parados" → deep-link p/ Histórico › Parados.

### Fase E — App do entregador (scan + não entregue)

- `apps/web/src/pages/courier/CourierScreen.tsx` + `QrScanner.tsx`:
  - "Escanear cupom" → `BarcodeDetector` (nativo Chrome/Android) com fallback JS via import dinâmico; botão manual mantido.
  - Scan → decodifica `orderId` → `PATCH /courier/orders/:id/confirm` (já existe; valida dono).
- "Não entregue" + motivo → novo `PATCH /courier/orders/:id/not-delivered { reason }` → `OUT_FOR_DELIVERY`/atribuído → `NOT_DELIVERED`, valida dono.
- `courier.service.ts`: `markNotDelivered`.

**Ordem:** `0 → A → B → C → D → E`. Cada fase é entregável e testável isolada.

---

## 6. Riscos / pontos de atenção

1. **Alinhamento de datas** — ancorar todo o pipeline no `scheduledDate` real de cada `Order` (não em rótulos "hoje/amanhã"); o corte gera p/ hoje ou amanhã conforme o turno, e a `division-suggestion` hoje usa "amanhã". Validar na Fase A.
2. **Fastify apaga campos fora do response schema** — todo endpoint novo/alterado precisa do response schema cobrindo 100% dos campos retornados (já mordeu antes).
3. **Rollout sem quebrar a Entrega** — gate aceita `SCHEDULED OR SEPARATED` durante a transição; fechar só em `SEPARATED` após a UI da Separação subir.
4. **Térmica = monocromático** — `@media print` sem fundo/cor; QR preto sólido.
5. **`creditBalance` null** — contas legadas com null fazem `$inc` virar no-op; o estorno precisa tratar.
6. **Prisma + Mongo null vs unset** — cuidado nos filtros (`{ not: null }` etc.).

---

## 7. Checklist de remoção

- [ ] Todas as fases concluídas e validadas
- [ ] **Apagar este arquivo** (`docs/plano-separacao-pedidos.md`)
