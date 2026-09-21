# Plano — Melhorias na Solicitação de Gancho (Admin)

## Objetivo

Três melhorias na área de gancho do administrativo:

1. **Contagem de pendências** — quantos ganchos aguardam entrega, visível antes de abrir a fila.
2. **Cupom de entrega do gancho** — impressão na térmica de 80mm, um a um ou em lote por seleção múltipla.
3. **Histórico de ganchos no cliente** — o que já foi solicitado, pago, bonificado e entregue para aquele cliente.

## Contexto (o que já existia)

- Fila de ganchos: `apps/web/src/pages/admin/gestao/AdminGanchos.tsx` — busca, chips de status/tipo,
  agrupamento condomínio → bloco, "Marcar entregue" e "Ver cliente".
- API: `apps/api/src/modules/admin-hooks/` — `GET /admin/hook-requests`, `PATCH /:id/deliver`,
  `POST /grant`. `markDelivered` é idempotente e dispara push + notificação in-app.
- Cupom térmico: `apps/web/src/components/admin/coupon/CouponShell.tsx` (`CouponPrintHost`, `Coupon`,
  `CouponAddress`, `usePrintQueue`) com as variantes `OrderCoupon` (pedido) e `ManualCoupon` (avulso).
  O CSS de impressão é **global** (`body > *:not(.coupon-print-host) { display: none }`).
- Seleção múltipla + impressão em lote: `AdminSeparacao.tsx` — barra fixa acima da nav (56px + safe area).
- Detalhe do cliente: `ClientDetailView.tsx` — tinha "Conceder gancho", nenhum histórico.
- `HookRequest` (Prisma) já guarda `type`, `status`, `reason`, `requestedAt`, `deliveredAt`,
  `deliveredById`, `grantedById`, `paymentId`, com índices `[userId, createdAt]` e `[status, requestedAt]`.

## Decisões

1. **Contagem em endpoint próprio** (`GET /admin/hook-requests/summary`), não no `total` da listagem:
   o `total` muda quando o admin filtra por "Entregues" ou por tipo, e o número de pendências não pode
   depender do filtro na tela. Contagem crua no índice `[status, requestedAt]`, sem `enrich`.
2. **Imprimir NÃO marca entrega.** O cupom sai na montagem; a entrega é registrada quando o gancho
   chega na porta (e é ela que dispara push e notificação in-app). Unir as duas ações notificaria
   o cliente no momento errado.
3. **Cupom sem QR** — não há pedido para o entregador bipar, mesma decisão do cupom manual. O que
   identifica a entrega é o cabeçalho de endereço, vindo do mesmo `formatUnit` da rota do entregador.
4. **Rótulos de gancho em módulo compartilhado** (`apps/web/src/lib/hookLabels.ts`): a fila e o
   histórico do cliente mostram as mesmas pílulas; duas cópias divergiriam na primeira renomeação.
5. **Histórico no cliente = card na aba Geral + eventos na Atividade.** O card fica junto ao botão
   que concede o gancho — quem vai bonificar precisa ver antes se já existe um gancho entregue.
6. **Rota do histórico em `admin-clients`**, não em `admin-hooks`: acompanha `credit-history`,
   `payments` e `orders`, que já vivem lá e são consumidos pela mesma tela.

## Mudanças

### Backend (`apps/api`)

1. `admin-hooks.service.ts` — `countPending()`: `hookRequest.count({ where: { status: 'REQUESTED' } })`.
   `PENDING_PAYMENT` fica fora: não há gancho a entregar enquanto o pagamento não confirma.
2. `admin-hooks.controller.ts` / `admin-hooks.route.ts` — `GET /admin/hook-requests/summary` → `{ pending }`.
3. `admin-clients.service.ts` — `getHooks(id)`: `assertClient` → todos os `HookRequest` do cliente
   (inclusive `PENDING_PAYMENT` e `CANCELLED`), com nomes dos admins (concessão/entrega) e o valor do
   `Payment` vinculado resolvidos em **duas** queries batch.
4. `admin-clients.controller.ts` / `admin-clients.route.ts` — `GET /admin/clients/:id/hooks`.

### Frontend (`apps/web`)

5. **Novo** `lib/hookLabels.ts` — `HOOK_TYPE_BADGE`, `HOOK_STATUS_BADGE` e os tipos `HookType`,
   `HookStatus`, `HookFullStatus`.
6. **Novo** `components/admin/coupon/HookCoupon.tsx` — `HookCouponSheet`: cabeçalho da marca, endereço,
   faixa "GANCHO DE PORTA" (borda, não fundo sólido — fundo preto vira borrão na térmica), tipo,
   data da solicitação, motivo e uma linha de instrução para o cliente.
7. `AdminGanchos.tsx`:
   - contagem de pendentes no cabeçalho (bloco accent) e no chip "Pendentes";
   - checkbox por card (no lugar do avatar), "Selecionar os N carregados" e barra fixa com
     "Imprimir N cupons" — a seleção é limpa ao trocar filtro/busca e podada após cada refetch;
   - botão "Cupom" por card para impressão avulsa;
   - rodapé da lista cresce enquanto a barra está no ar, para o último card não ficar embaixo dela.
8. `AdminGestao.tsx` — `HubCard` ganha `badge?: number`; o card "Solicitação de Gancho" mostra as
   pendências. O efeito depende de `sub`: o componente não desmonta ao entrar numa subtela, então
   a contagem é refeita ao voltar ao hub.
9. `ClientDetailView.tsx` — `GanchosCard` (aba Geral, abaixo do saldo), recarregado após conceder um
   gancho; e os ganchos entram na timeline da aba Atividade pela data do desfecho (entrega) quando existe.

### Testes

- `admin-hooks.service.test.ts` — `countPending` filtra `REQUESTED` e não carrega os ganchos.
- `admin-clients.service.test.ts` — `getHooks`: ordenação, batch de admins, valor do gancho pago,
  lista vazia sem queries extras e 404 para não-CLIENT.
- **Novo** `AdminGanchos.test.tsx` — contagem, impressão avulsa, impressão em lote, "imprimir não
  marca entregue", selecionar todos/limpar e limpeza da seleção ao trocar de filtro.

## Pontos de atenção

- Um único `CouponPrintHost` montado por tela — o CSS de impressão é global.
- "Selecionar todos" alcança só o que foi carregado (`PAGE_SIZE = 20`); o rótulo diz isso.
- Nenhuma mudança de schema: `HookRequest` já tinha todos os campos (MongoDB, sem `migrate`).
