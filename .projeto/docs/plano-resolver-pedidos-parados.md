# Plano — Resolver "Pedidos Parados"

> Status: **IMPLEMENTADO** (2026-07-04). GSD não instalado neste projeto — plano versionado aqui e seguido manualmente.
> Extra em relação ao plano: campo `Order.deliveryNote` persiste a nota da entrega manual/retroativa (atende ao "marcar como entregue informando motivo"). Push retroativo é suprimido (só notifica DELIVERED quando a data é hoje). Typecheck limpo; API 280 testes + 7 novos de `resolveStuckOrder`; web 96 testes verdes.

## 1. Problema

Um pedido entra no limbo ("parado") quando a **data de entrega já passou** e o status **ainda não é terminal** — `scheduledDate < hoje (BRT)` e `status ∈ {SCHEDULED, SEPARATED, OUT_FOR_DELIVERY}`. É literalmente "a data passou e ninguém marcou desfecho".

- Cálculo/contagem: `apps/api/src/modules/admin-orders/admin-orders.service.ts` — `getStuck()` (836-859) e `stuckCount` no dashboard (396-401).
- Banner no painel: `apps/web/src/pages/admin/tabs/AdminPainel.tsx:114-157`.
- Tela e filtro "Parados": `apps/web/src/pages/admin/tabs/AdminEntregas.tsx` (filtro chama `GET /admin/orders/stuck`).

**Gaps atuais:**
1. O banner só chama `onNavigate('entregas')` — cai na visão "Hoje", não em `Histórico › Parados`.
2. Na tela de Parados, a única ação real é "Marcar não entregue". Não há "Marcar como entregue", "Cancelar", nem devolução de pães no mesmo passo (o "Estornar crédito" só aparece depois que o pedido já virou terminal).
3. **Bug latente:** `VALID_TRANSITIONS` não permite `SCHEDULED → NOT_DELIVERED` nem `SCHEDULED → DELIVERED`. Um parado em `SCHEDULED` (caso comum) hoje falharia com 422 ao tentar "não entregue".

## 2. Decisões tomadas

| Tema | Decisão |
|---|---|
| Estorno de dinheiro | **Vínculo leve**: gravar `Order.paymentId` quando o pedido nasce de um pagamento; no resolver, exibir o pagamento vinculado e disparar o estorno **já existente** (`POST /admin/payments/:id/refund`, que estorna no Stripe e ajusta créditos atomicamente). Sem pagamento vinculado → só devolve pães. |
| Devolver pães | **No mesmo passo**, com checkbox "Devolver X pães ao saldo" **ligado por padrão** (admin pode desmarcar). |
| Desfechos de encerramento | **Marcar como entregue** (retroativo/manual), **Não entregue** (com motivo), **Cancelar** (com motivo). |

## 3. Modelo de desfechos (o "Resolver")

Para um pedido parado, o resolver oferece exatamente 3 saídas terminais:

- **Entregue** (`DELIVERED`) — "foi entregue mas ninguém registrou". Não mexe em créditos. Motivo/nota opcional. **Não** envia push de "entregue" quando a data já passou (evita notificação retroativa estranha).
- **Não entregue** (`NOT_DELIVERED`) — falha de entrega. Motivo **obrigatório**. Checkbox "Devolver X pães" (default ON).
- **Cancelar** (`CANCELLED`) — pedido anulado. Motivo **obrigatório**. Checkbox "Devolver X pães" (default ON).

Estorno de **dinheiro** (Stripe) é uma ação **separada e secundária**, só visível quando há `paymentId` vinculado, delegada ao endpoint de Pagamentos já existente.

## 4. Backend

### 4.1 Destravar transições (correção obrigatória)
`admin-orders.service.ts` `VALID_TRANSITIONS` (20-24): adicionar `'DELIVERED'` e `'NOT_DELIVERED'` à lista de `SCHEDULED`. Resultado: qualquer estado ativo pode ir a qualquer estado terminal (admin).

### 4.2 Endpoint combinado de resolução
Novo `POST /admin/orders/:id/resolve` — resolve status + estorno de pães **em uma transação**, evitando duas chamadas e estados parciais.

- Body: `{ outcome: 'DELIVERED' | 'NOT_DELIVERED' | 'CANCELLED', reason?: string, refundCredits?: boolean }`
- Validação: `reason` obrigatório para `NOT_DELIVERED`/`CANCELLED`; pedido deve estar em estado ativo (senão 409 "já resolvido").
- Service `resolveStuckOrder(orderId, adminId, {...})` dentro de `$transaction`:
  1. valida transição (reusa a máquina do 4.1);
  2. atualiza status + marcos (`deliveredAt` | `failedAt`+`failureReason` | `cancelledAt`+`cancelReason`);
  3. se `refundCredits` e `outcome ∈ {NOT_DELIVERED, CANCELLED}`: checa idempotência (sem `CreditTransaction REFUND` prévio para o `orderId`), cria `REFUND +quantity`, `increment` no `creditBalance`. Reusa a lógica de `refundOrder()` (865-899).
  4. `refundCredits` é ignorado em `DELIVERED`.
- Push: manter push de `DELIVERED` **apenas** se `scheduledDate` for hoje; suprimir/ajustar para resolução retroativa.

> Reuso: `updateOrderStatus()` e `refundOrder()` já existem; extrair o núcleo de cada um para chamar dentro da mesma `$transaction` (evitar transações aninhadas).

### 4.3 Vínculo pedido ↔ pagamento (leve)
- **Schema** (`prisma/schema.prisma`, model `Order` 244-268): adicionar `paymentId String?` (Mongo → só `prisma generate`, sem migration).
- **Criação**: `CreateOrderBody` (orders schema) ganha `paymentId?` opcional; `createSingleOrder` (`orders.service.ts:121-162`) grava no `Order` quando presente.
- **Threading no cliente**: expor o `Payment.id` na resposta de `POST /payments/pix` e `POST /payments/card`; `SingleScreen.tsx` inclui no `pendingOrder`; `finalizePendingOrder.ts` envia `paymentId` no `POST /orders`. Só o caminho "precisa pagar" carrega paymentId; caminho "saldo cobre tudo" fica sem (esperado).
- **Enriquecimento**: `_ledgerSelect`/`_enrichOrders` passam a incluir `paymentId` e um resumo do pagamento vinculado (`amount`, `status`) + o flag `refunded` já existente, para o sheet decidir o que mostrar.

### 4.4 Regra de negócio: dinheiro × pães (evitar duplo crédito)
- "Devolver pães" (`refundOrder`, **+qty**) e "Estornar pagamento" (`admin-payments refund`, **−min(paesComprados, saldo)**) mexem no saldo em sentidos diferentes.
- Regra: para as mesmas unidades, é **ou dinheiro de volta ou pães de volta**, não os dois. UI deve deixar isso explícito e evitar a combinação cega (ver 5.2).

## 5. Frontend

### 5.1 Deep-link do banner
- `AdminPainel.tsx:117`: o clique passa um alvo (ex.: `onNavigate('entregas', { segment: 'historico', filter: 'parados' })`).
- `AdminEntregas.tsx`: ler o alvo e inicializar `segment='historico'` + `histFilter='parados'` (hoje começa em `'hoje'`). Ajustar a assinatura de `onNavigate` na cadeia do layout admin.

### 5.2 Resolver no `OrderDetailSheet.tsx`
- Substituir o bloco de ações atual (só "Marcar não entregue" + "Estornar crédito" tardio) por uma seção **"Resolver pedido"** com os 3 desfechos.
- Cada desfecho abre um mini-form:
  - `DELIVERED`: nota opcional; confirma.
  - `NOT_DELIVERED` / `CANCELLED`: motivo (obrigatório) + checkbox "Devolver X pães ao saldo" (default ON).
- Chama `POST /admin/orders/:id/resolve`.
- **Bloco de pagamento** (só se `row.paymentId`): mostra "Pagamento: R$ X · status" e botão **"Estornar pagamento (R$ X)"** → `POST /admin/payments/:paymentId/refund`. Aviso curto de que dinheiro estorna **o valor pago** (déficit), que pode diferir da quantidade de pães do pedido; e que não deve ser combinado com "devolver pães" para as mesmas unidades.
- Atualizar `STATUS_META`/gates conforme necessário; após resolver, fechar sheet e refazer o fetch da lista.

## 6. Pontos de atenção
- **Transições** (4.1) — sem isso o resolver quebra em pedidos `SCHEDULED`.
- **Idempotência** — o estorno de pães já é idempotente por `referenceId`; manter no endpoint combinado.
- **Push retroativo** — não notificar "entregue" para data passada.
- **Dinheiro × pães** (4.4) — não permitir duplo crédito.
- **Atomicidade** — status + estorno de pães na mesma transação; estorno de dinheiro (Stripe) permanece no fluxo de Pagamentos (externo, já atômico lá).
- **Payment.id na resposta** — confirmar que `payments.service` expõe o id nas respostas de pix/cartão antes de threadar.

## 7. Fora de escopo
- Refazer o fluxo de avulso para ser 1:1 pagamento↔pedido (descartado por custo/risco).
- Estorno parcial de dinheiro (o endpoint atual estorna total).
- Vincular pedidos `SCHEDULED` (recorrentes da agenda) a pagamentos — vínculo é só para avulsos pagos.

## 8. Ordem de execução
1. Backend: `VALID_TRANSITIONS` (4.1) + endpoint `resolve` (4.2) + enriquecimento com `paymentId`/refunded (4.3 parte leitura). Testes.
2. Backend: schema `Order.paymentId` + `CreateOrderBody.paymentId` + gravação (4.3 escrita) + expor `Payment.id` nas respostas de pagamento.
3. Frontend: deep-link do banner (5.1).
4. Frontend: resolver no `OrderDetailSheet` (5.2) + bloco de pagamento.
5. Frontend: threading do `paymentId` (SingleScreen → finalizePendingOrder → POST /orders).

## 9. Testes
- Unit (service): resolve para cada outcome; transição `SCHEDULED → NOT_DELIVERED/DELIVERED`; idempotência do estorno de pães; `refundCredits` ignorado em `DELIVERED`; 409 em pedido já resolvido.
- Integração: `POST /admin/orders/:id/resolve` (feliz + erros de validação de motivo).
- Frontend: banner abre Histórico › Parados; resolver dispara a chamada correta; checkbox default ON; bloco de pagamento só com `paymentId`.
