# Plano: gancho sozinho na rota e card da Solicitação de Gancho

> ✅ **Status:** **IMPLEMENTADO** em 06/10/2026, **SEM COMMIT**. Verificação: typecheck api e web ✅ ·
> `vite build` ✅ · api **1.998 + 3 todo** (+17) · web **681 + 17 todo** (+9). Card conferido em
> 360 e 390 px (headless). `db push` feito no banco de teste. Execução direta, **sem GSD**. Branch de referência: `feat/add-complementocliente`. Não há tela nova: a folha
> "Enviar na rota" ganha uma seção, e a parada do app do entregador ganha a variante "só gancho",
> feita com os componentes que já existem (kit `CR*`, `CRSheet`, `CRAvatar`, `CRNote`, `CRBig`).
> Por isso não passa pelo Claude Design.

---

## 0. Pedido

O usuário pediu, em 06/10/2026, a partir de um print da fila de ganchos (Gestão › Solicitação de Gancho):

1. **Botão quebrado no card.** Os botões de ação estouram a largura do card.
2. **Card abre o cliente.** Sai o botão "Ver cliente"; clicar no card abre o cliente.
3. **Gancho sem pedido.** O gancho pode ser enviado mesmo sem pedido nos próximos dias, indo sozinho.

---

## 1. Diagnóstico

### 1.1 Botão quebrado

Em [`AdminGanchos.tsx`](../../apps/web/src/pages/admin/gestao/AdminGanchos.tsx), no `HookCard`, os quatro
botões ficam num `div` com `flexShrink: 0` e sem `flexWrap`: Ver cliente, Cupom, Enviar na rota e
Marcar entregue. O `flexWrap` do pai só separa a data dos botões, não os botões entre si. A linha passa
de 500px e estoura o card em qualquer celular. No print, a janela tinha 514px.

### 1.2 Bug: "Enviar na rota" nunca encontra dia de entrega

`AdminHooksService.routeOptions` em
[`admin-hooks.service.ts`](../../apps/api/src/modules/admin-hooks/admin-hooks.service.ts) tem três problemas.

- **Filtro com status inexistente.**
  - `Order` filtra `['SCHEDULED','CONFIRMED','OUT_FOR_DELIVERY']`, mas `OrderStatus` não tem `CONFIRMED`.
  - `MarketOrder` filtra `['CONFIRMED','SEPARATED','OUT_FOR_DELIVERY']`, mas `MarketOrderStatus` também não tem `CONFIRMED`.
  - O `as never` escondeu o erro do TypeScript, e os testes mockam o Prisma.
  - **Verificado em 06/10** com uma consulta só de leitura no `cheirin-de-pao-teste`: as duas consultas lançam
    `PrismaClientValidationError: Invalid value for argument 'in'`.
  - O endpoint responde 500. A folha trata resposta com erro como lista vazia (`res.ok ? … : []`) e por isso **sempre** mostra
    "O cliente não tem entrega nos próximos 7 dias".
- **Status que faltam.** O pão `SEPARATED` e a Cestinha `SCHEDULED` ficavam de fora.
- **Agenda não aparece.** O pedido da agenda só nasce no corte (`schedules.service.ts`). Mesmo com o
  filtro certo, a busca de "7 dias" só enxergaria o dia seguinte.

### 1.3 Por que o gancho não pode ir sozinho hoje

O gancho na rota (A7, Onda 8) só existe como **selo** (`hookToDeliver`) numa parada que já existe, de
pão ou de Cestinha. O resto da operação também só enxerga `Order` e `MarketOrder`:

- a rota do dia (`CourierService.getTodayOrders`);
- as paradas do turno (`CourierRunsService.slotStops`), e com elas iniciar, resumo, encerrar e "Saiu para entrega";
- o comprovante (`DeliveryProof`, `resolveStopByKey`);
- o pagamento (`resolvedCourierStops`);
- o mapa ao vivo (`AdminCourierRoutesService.live`);
- o app do entregador: chave da parada, confirmar, não entregue, foto e fila offline.

Uma parada sem pedido teria chave `''`, iria para `/courier/market-orders//confirm` e daria 404.

---

## 2. Decisões (aprovadas em 06/10/2026)

| # | Decisão |
|---|---|
| **D-1** | **Layout do card.** "Cupom" vira um botão pequeno à direita da data. Embaixo ficam **"Enviar na rota"** (ou "Tirar da rota") e **"Marcar entregue"** lado a lado, com a mesma largura. No gancho entregue, sobra só a linha da data com o Cupom. |
| **D-2** | **O card inteiro abre o cliente** (evento `cdp:open-admin-client`). O botão "Ver cliente" sai. Os botões de dentro do card, inclusive a caixa de seleção, **não** abrem o cliente. |
| **D-3** | **Escopo:** a correção do bug e o gancho sozinho saem **juntos**, numa versão só. |
| **D-4** | **Janela de dias:** **hoje e os próximos 6 dias**. Só entram turnos ativos do condomínio do cliente. Ficam de fora dias bloqueados (`DeliveryBlock`), dias da semana sem entrega nas regras do condomínio e turnos em que a parada do cliente já foi resolvida. Cada opção diz se o gancho **vai junto com o pão** ou vai **sozinho**. As datas rolam de lado. |
| **D-5** | **"Com pão"** quer dizer duas coisas: o cliente tem `Order` ou `MarketOrder` ativo (`SCHEDULED`, `SEPARATED` ou `OUT_FOR_DELIVERY`) naquele dia e turno, **ou** a agenda ativa e não pausada prevê pão naquele dia da semana e turno. |
| **D-6** | **Entregador.** Se o pão do dia e turno já foi despachado, vai o entregador da parada, fixo (como hoje). Nos outros casos, **o admin escolhe**, e a folha já vem com uma **sugestão**. A sugestão segue esta ordem:<br>1. quem atende o condomínio naquele dia e turno pela divisão aprovada, dando preferência ao mesmo bloco;<br>2. senão, a rota salva do turno que contém o condomínio, dando preferência à aceita;<br>3. senão, nenhuma sugestão.<br>Não aparecem entregadores bloqueados, de folga, fora da escala ou com a rota daquele turno já encerrada. |
| **D-7** | **O pão tem prioridade.** Se o pão do cliente for dividido depois para outro entregador, o gancho vai junto com o pão (`dispatchHooksAfterDivision` já sobrescreve `routeCourierId`). O entregador escolhido é o plano B: só leva o gancho se não houver pão. |
| **D-8** | **Parada só de gancho.** Ela existe quando o gancho está `REQUESTED`, com `routeDate` igual a hoje e `routeCourierId` igual ao entregador, **e** o cliente não tem `Order` nem `MarketOrder` naquele dia e turno (fora `CANCELLED` e `PENDING_PAYMENT`). Se o cliente tiver pedido ainda não despachado, o gancho espera a divisão. |
| **D-9** | **Foto:** valem as mesmas regras do entregador (`fotoEntrega` e `fotoNaoEntrega`). O comprovante fica ligado ao gancho (`DeliveryProof.hookRequestId`). |
| **D-10** | **Conta como parada.** Entra em "entregas" no pagamento por entrega e no total de portas. Um turno só com ganchos pode ser iniciado e encerrado, e por isso conta no pagamento por rota. O "Ganchos" do resumo do turno, hoje fixo em 0, passa a contar os ganchos entregues pelo entregador no turno, com pão ou sozinhos. |
| **D-11** | **Aviso ao cliente:** só o **"Seu gancho chegou"**, que já existe. O "Saiu para entrega" **não** vai para a parada só de gancho. |
| **D-12** | **Aviso ao entregador:** **sem push**. A parada aparece quando o app atualiza, junto com o aviso de "entregas novas" que já existe. |
| **D-13** | **Não entregue:** o gancho volta para a fila, como já acontece com o gancho que vai com o pão (V-72). O motivo fica gravado e aparece no card. |

### Padrões adotados sem pergunta (conferir na revisão)

- **Sem QR.** A parada só de gancho é confirmada **pela lista**, e o cupom do gancho continua sem QR.
- **Sem recado nem "Reportar problema"** na parada só de gancho. Os dois dependem de `Order` ou
  `MarketOrder` (`findStop` e `CourierReport`). Problema na porta é registrado como "Não consegui entregar".
- **O gancho sozinho fica fora** da divisão de Entregas, da oferta de turno ("N paradas") e do
  lembrete de entregas pendentes do admin.
- **Rota salva.** O prédio que só tem gancho entra no traçado do dia, mas **não** gera sugestão de rota salva.
  Um gancho avulso não deve mudar a rota fixa do entregador.
- **Recusa de turno.** Quando o entregador recusa o turno, o gancho sozinho dele volta para a fila com o motivo
  "Entregador recusou o turno". O gancho que vai com o pão segue como hoje: perde o entregador e é
  despachado de novo na próxima aprovação.

---

## 3. Mudanças

### 3.1 Schema (`apps/api/prisma/schema.prisma`)

É MongoDB, sem `migrate`. Os dois campos são opcionais. Rodar `prisma db push` no banco de teste e no deploy, por causa do índice.

- `DeliveryProof.hookRequestId String? @db.ObjectId` + `@@index([hookRequestId])`. É o registro do desfecho da
  parada só de gancho. A chave única `[courierId, userId, slotId, date, outcome]` continua valendo, porque por
  definição (D-8) não existe parada de pão do mesmo cliente no mesmo turno.
- `HookRequest.routeFailedReason String?`: motivo do "não consegui entregar" ou da recusa de turno.

### 3.2 Backend: admin-hooks

1. **`routeOptions(hookId, now)`** é reescrito e passa a devolver `{ options, couriers }`.
   - **Status corrigidos e tipados**, sem `as never`. `Order` usa `OrderStatus[]` com `SCHEDULED`, `SEPARATED` e `OUT_FOR_DELIVERY`.
     `MarketOrder` usa `MarketOrderStatus[]` com os mesmos três.
   - **Dias:** de hoje a hoje+6, em BRT.
     - Bloqueios: `listBlocksOverlapping` uma vez para o intervalo, depois `findBlockForDate` dia a dia.
     - Dia da semana sem entrega: `getRulesForCondo` + `isDayBlocked`.
   - **Turnos:** `getCondoDeliverySlots(condominiumId)`, filtrando `isActive`.
   - **Pedidos e agenda do cliente no intervalo:** uma consulta por coleção, não uma por dia. A agenda vem do
     `Schedule` do cliente (`isActive`, sem `pausedAt`, `days[slotId][weekday] > 0`).
   - **Por dia e turno:**
     - parada já resolvida (`DELIVERED` ou `NOT_DELIVERED`): a opção sai;
     - pão ou Cestinha despachado com `courierId`: `courierLocked`;
     - pedido ou agenda: `withBread`.
   - **Sugestão (D-6):**
     1. Entre os pedidos despachados do mesmo condomínio no dia e turno (`Order` + `MarketOrder` com `courierId`), vence o entregador do mesmo bloco; senão, o que tem mais paradas.
     2. Senão, a `CourierRouteTemplate` do turno cujo `condominiumIds` contém o condomínio, com a aceita primeiro.
   - **`unavailableCourierIds` por opção:** `courierOffMap(ids, date, slotId)` + `CourierRun` `ENDED` naquele dia e turno.
   - **Campos da opção:** `date`, `slotId`, `slotLabel`, `slotEmoji`, `slotTime`, `withBread`, `courierLocked`,
     `courier` (o fixo ou o sugerido, ou `null`) e `unavailableCourierIds`.
   - **`couriers`:** usuários com `role: 'COURIER'` e `isBlocked: false`, com `id`, `name` e `photoUrl`. É o mesmo filtro da divisão.
   - Cliente sem condomínio recebe `options: []`.
2. **`sendOnRoute(hookId, date, slotId, courierId?)`** revalida a opção.
   - Se `courierLocked`, grava o entregador da parada e ignora `courierId`.
   - Senão, `courierId` é obrigatório:
     - sem ele: 400 "Escolha quem leva o gancho";
     - fora da lista ou indisponível: 422.
   - Grava `routeDate`, `routeSlotId` e `routeCourierId`, e zera `routeFailedAt` e `routeFailedReason`.
3. **`enrich`** ganha dois campos:
   - `route.alone`: o cliente não tem `Order` nem `MarketOrder` não cancelado no dia e turno da rota. É uma consulta em lote para todos os ganchos da página.
   - `routeFailedReason`.
4. **`returnHookToQueue`** ([`courier-ops.ts`](../../apps/api/src/modules/courier/courier-ops.ts)) recebe o motivo
   opcional e grava em `routeFailedReason`. O pão não entregue passa o motivo do pedido.
5. **Schemas de [`admin-hooks.route.ts`](../../apps/api/src/modules/admin-hooks/admin-hooks.route.ts):**
   - a resposta de `route-options` passa a ser um objeto;
   - `courierId` entra como opcional no body do `POST …/route`;
   - o item da listagem ganha `route.alone` e `routeFailedReason`.

   O Fastify descarta campos que não estão declarados, então esses campos precisam entrar no schema.

### 3.3 Backend: entregador (parada só de gancho)

6. **Novo [`lib/hook-stops.ts`](../../apps/api/src/lib/)**:
   - `pendingHookOnlyStops(prisma, { courierIds, date, slotId? })` aplica D-8;
   - `isHookOnly(prisma, hook)` é a checagem usada na confirmação;
   - `resolvedHookOnlyStops(prisma, courierIds, fromDay, toDay)` lê `DeliveryProof` com `hookRequestId`.
7. **`CourierService.getTodayOrders`**:
   - as paradas só de gancho pendentes entram em `enriched` com `orderId: ''`, `quantity: 0`, `marketItems: []`,
     **`hookId`** e `hookToDeliver: null`;
   - as resolvidas hoje entram em `completedEnriched`, vindas do `DeliveryProof`;
   - o turno delas entra em `slots`. Contam em `totalStops` e não somam pães.
8. **Endpoints novos**, irmãos dos de pão e Cestinha, em [`courier.route.ts`](../../apps/api/src/modules/courier/courier.route.ts):
   - `PATCH /courier/hooks/:id/confirm` com body `{ via, clientOpId, occurredAt? }`;
   - `PATCH /courier/hooks/:id/not-delivered` com body `{ failureCode, reason, via, clientOpId, occurredAt? }`.

   No `CourierService`, ficam em `confirmHookStop` e `markHookNotDelivered`.
   - **Respostas:**
     - 404: gancho desconhecido;
     - 403: `routeCourierId` de outro entregador;
     - 409: já resolvido. A exceção é o mesmo `clientOpId`, que responde 200, igual ao `alreadyResolved`, para a fila offline;
     - 422: o cliente passou a ter pão no turno, com a mensagem "O gancho vai junto com o pão desta parada".
   - **Confirmar:**
     - `AdminHooksService.markDelivered(id, courierId, 'COURIER')`, que já manda o push "Seu gancho chegou";
     - `recordStopOutcome('DELIVERED', { hookRequestId, required: rules.fotoEntrega })`;
     - `ensureStarted`.
   - **Não entregue:**
     - `returnHookToQueue` com o motivo;
     - `recordStopOutcome('NOT_DELIVERED', { hookRequestId, required: rules.fotoNaoEntrega })`;
     - `ensureStarted`.
   - **Resposta:** o `buildStopSummary` ganha `kind: 'HOOK'`, com `orderId: null`, `quantity: 0`, `hookId` e o comprovante.
9. **[`courier-stop.ts`](../../apps/api/src/modules/courier/courier-stop.ts)**:
   - `recordStopOutcome` aceita `hookRequestId`;
   - `resolveStopByKey` ganha o caminho do gancho, que acha o `DeliveryProof` por `hookRequestId` + `courierId` (o mais recente).

   Com isso, enviar e pular a foto funcionam com a chave do gancho.
10. **`hookOutcome`** é o "Deixou o gancho também?" do gancho que vai com o pão. A busca de reserva por pedido
    passa a filtrar o dia de hoje e os status ativos. Hoje ela pega o pedido mais recente do cliente, que pode ser um
    pedido futuro, e devolve um 404 errado.
11. **[`courier-runs.ts`](../../apps/api/src/modules/courier/courier-runs.ts)**:
    - **`slotStops`:** inclui as paradas só de gancho, as pendentes pelo `HookRequest` e as resolvidas pelo `DeliveryProof`.
      Cada uma vem com `refId = hookId`, `breads: 0`, `marketCount: 0` e `hookOnly: true`.
    - **Efeitos:**
      - um turno só com ganchos inicia;
      - `summary`, `noPhoto`, `next` e `end` passam a enxergar essas paradas;
      - `notifyOut` pula `hookOnly`, conforme D-11.
    - **`stats.ganchos`:** conta `HookRequest` `DELIVERED` com `deliveredVia: 'COURIER'`, `deliveredById` do entregador e
      `routeDate`/`routeSlotId` do turno.
12. **[`courier-plan.ts`](../../apps/api/src/modules/courier/courier-plan.ts)**:
    - `resolveDayRoute` ganha `suggestFrom?: PlanCondo[]`, que são os prédios sem os que só têm gancho;
    - `ensureSuggestion` usa `suggestFrom`, e a ordem do dia usa todos os prédios.
    - Precisam passar `suggestFrom`: `CourierService.slotRoutes`, `CourierRunsService.start` e `reorder`.
13. **[`lib/courier-stops.ts`](../../apps/api/src/lib/courier-stops.ts)**: `resolvedCourierStops` soma as paradas só de gancho
    (`breads: 0`, `hasBread: false`), e o tipo `Db` ganha `deliveryProof`.
    - Isso afeta o pagamento (`computeWeek`), `courier-earnings`, as estatísticas de `courier-me` e o relatório de combustível.
    - Conferir o tipo de `prisma` em cada chamada.
14. **`AdminCourierRoutesService.live`**: o mapa ao vivo inclui as paradas só de gancho, pendentes e resolvidas, com a chave `courierId|userId|slotId`.
15. **[`courier-shifts.ts`](../../apps/api/src/modules/courier/courier-shifts.ts)**, em `decline`: o gancho sozinho do entregador naquele
    dia e turno volta para a fila com o motivo "Entregador recusou o turno". O gancho que vai com o pão segue como hoje.
16. **Schemas de `courier.route.ts`**:
    - o `hookId` entra nas paradas de hoje e nas concluídas;
    - o `stopSummarySchema` ganha `kind` com `HOOK` e o campo `hookId`.

### 3.4 Frontend: admin

17. **`HookCard`** em [`AdminGanchos.tsx`](../../apps/web/src/pages/admin/gestao/AdminGanchos.tsx), conforme D-1 e D-2.
    - **Clique no card:** o `div` do card recebe `onClick={onViewClient}` e `cursor: 'pointer'`.
    - **Nome do cliente:** vira `<button type="button" aria-label="Ver cliente {nome}">`, com cara de texto. É o caminho
      para teclado e leitor de tela. O clique dele sobe para o card, então ele não tem handler próprio.
      - Por que não `role="button"` no card inteiro: botão dentro de botão é ARIA inválido.
      - Além disso, o nome acessível do card incluiria "Enviar na rota" e quebraria o `getByRole` dos testes.
    - **Caixa de seleção, Cupom, Enviar/Tirar da rota e Marcar entregue:** chamam `e.stopPropagation()`.
    - **Rodapé:**
      - linha 1: relógio e data (`flex: 1`, `minWidth: 0`) + **Cupom** (`minHeight: 34`, `padding: '0 12px'`);
      - linha 2, só se não estiver entregue: `display: 'grid'`, `gridTemplateColumns: '1fr 1fr'`, `gap: 8`. Os botões têm `minWidth: 0`, ficam
        centralizados, com `padding: '0 8px'`, `whiteSpace: 'nowrap'` e o texto com reticências como último recurso.
      - Conferir em 360, 390 e 412px. "Marcar entregue" na Hanken Grotesk 13/700 fica perto de 145px, e a coluna em 360px tem 140px.
        Se não couber, usar fonte 12,5 e ícone de 15.
    - **`routeLine`:**
      - "Na rota de 08/10 · ☀️ Manhã · Antônio · **só o gancho**" quando `route.alone`;
      - "Ficou para outro dia (08/10 · Cliente ausente) · voltou para a fila" quando há `routeFailedReason`.
18. **[`HookRouteSheet.tsx`](../../apps/web/src/components/admin/HookRouteSheet.tsx)** passa a ler o novo formato.
    - **Datas:** 7 botões com rolagem lateral (`overflowX: 'auto'`, `flex: 'none'`, sem barra de rolagem).
    - **Turno:** o controle segmentado continua como hoje.
    - **Linha do modo, embaixo:**
      - 🥖 "Vai junto com o pão de {primeiro nome}";
      - 🪝 "Só o gancho: parada própria na rota".
    - **Entregador:**
      - com `courierLocked`, o card atual ("Entregador da rota do cliente");
      - senão, "**Quem leva**": um `radiogroup` com `CRAvatar` e nome curto, sem os indisponíveis da opção. O sugerido vem
        primeiro, marcado como "Sugerido".
      - Com pão ainda não despachado, entra a nota "Se o pão sair com outro entregador na divisão, o gancho vai junto com o pão".
      - Lista vazia: "Nenhum entregador disponível neste turno".
    - **Botão principal:**
      - "Enviar na rota de 08/10" ou "Enviar só o gancho em 08/10";
      - fica desabilitado até haver entregador.
    - **Sem opções:** "O condomínio do cliente não tem turno de entrega nos próximos 7 dias".
    - **Envio:** `courierId` vai no body quando não há `courierLocked`.

### 3.5 Frontend: entregador

19. **Tipos:**
    - `Stop.hookId?` ([`StopRow.tsx`](../../apps/web/src/components/courier/StopRow.tsx));
    - `CompletedStop.hookId?` (`CourierCompletedList.tsx`);
    - `StopSummary.kind` com `'HOOK'` e `hookId` ([`courierApi.ts`](../../apps/web/src/lib/courierApi.ts));
    - `OpTarget.kind` com `'HOOK'` ([`courierQueue.ts`](../../apps/web/src/lib/courierQueue.ts)).
20. **Chave da parada:** `stopKey` e `completedKey` passam a ser `orderId || marketOrderId || hookId`.
    - Sem isso, as paradas só de gancho dividiriam a chave `''` e confirmar uma marcaria todas.
    - Em [`CourierScreen.tsx`](../../apps/web/src/pages/courier/CourierScreen.tsx), mudam:
      - `localKeyOf` e `activeStopOf`;
      - `targetOfStop`, que passa a devolver `{ kind: 'HOOK', id: hookId }`;
      - `localSummary` (`kind: 'HOOK'`);
      - `startPhoto` (chave = `hookId`);
      - `photoForPending` (`refId` = `hookId` vira `HOOK`);
      - em `completedView`, a chave, a remoção de duplicadas e o repasse do `hookId`.
21. **`courierApi`:**
    - os caminhos de confirmar e de não entregue de `HOOK` vão para `/courier/hooks/:id/confirm` e `/courier/hooks/:id/not-delivered`;
    - o `sendQueuedOp` trata o alvo `HOOK`.
22. **Telas:**
    - **`StopRow`:** mostra "🪝 Só gancho" no lugar de 🥖/🧺, sem o selo "+ entregar gancho".
    - **`ConfirmSheet`:** mostra "🪝 Gancho de porta" e os botões **"Gancho entregue"** e "Não consegui entregar".
    - **`ResultPopup`:** com `kind: 'HOOK'`, não pergunta "Deixou o gancho também?" e mostra "🪝 Gancho entregue".
    - **`CourierCompletedList`:** mostra 🪝 no lugar de 🥖/🧺.
    - **Recado e "Reportar problema":** ficam escondidos na parada só de gancho.
    - **`CourierRouteView` e `CourierEndRun`:** as portas incluem as paradas só de gancho, e o bloco "Ganchos" passa a ter o número real.

### 3.6 Testes

**API ([`admin-hooks.service.test.ts`](../../apps/api/src/modules/admin-hooks/__tests__/admin-hooks.service.test.ts) e testes do `courier`):**

- **`routeOptions`:**
  - o filtro de status não tem `CONFIRMED` e inclui `SEPARATED` (pão) e `SCHEDULED` (Cestinha);
  - a agenda marca `withBread`;
  - dia bloqueado, dia da semana sem entrega e turno inativo ficam de fora;
  - parada resolvida fica de fora;
  - pão despachado dá `courierLocked`;
  - a sugestão vem pela divisão (mesmo bloco primeiro) e depois pela rota salva;
  - folga e turno `ENDED` aparecem como indisponíveis.
- **`sendOnRoute`:**
  - exige entregador quando não há `courierLocked`;
  - recusa entregador indisponível;
  - ignora o `courierId` quando há `courierLocked`.
- **`enrich`:** `route.alone` e `routeFailedReason`.
- **`getTodayOrders`:** a parada só de gancho aparece, e some quando o cliente tem pedido no turno.
- **Confirmar e não entregue do gancho:** 200, 403, 409, o mesmo `clientOpId` responde 200, 422 com pão, e a foto pela chave do gancho.
- **Turno:**
  - um turno só com ganchos inicia e encerra;
  - `notifyOut` pula a parada só de gancho;
  - `stats.ganchos` tem o número real.
- **Pagamento e recusa:** `resolvedCourierStops` conta a parada só de gancho, e a recusa de turno devolve o gancho sozinho para a fila.

**Web:**

- **`AdminGanchos.test.tsx`:**
  - clicar no card dispara `cdp:open-admin-client`;
  - Cupom, rota, entregue e a caixa de seleção não disparam o evento;
  - o botão "Ver cliente" com texto não existe mais;
  - o nome do cliente tem `aria-label`.
- **`HookRouteSheet`:**
  - a opção "só o gancho" aparece;
  - o entregador é obrigatório;
  - o envio leva `courierId`;
  - com `courierLocked`, não aparece seletor.
- **Entregador:**
  - `StopRow` e `ConfirmSheet` mostram a variante só de gancho;
  - no `CourierScreen`, confirmar faz `PATCH /courier/hooks/h1/confirm`;
  - a fila offline aceita o alvo `HOOK`;
  - o `ResultPopup` não pergunta pelo gancho.

**Verificação:** `npm run typecheck` e `npm test` em `apps/api` e `apps/web`, mais o `vite build`. Sem o `as never`, o
`tsc` passa a pegar status inválidos.

### 3.7 Como conferir no banco de teste

1. Cliente com agenda para amanhã: a folha mostra amanhã com "Vai junto com o pão".
2. Cliente sem pedido e sem agenda: a folha mostra "Só o gancho" e sugere um entregador. Enviar. O card mostra "Na rota de … · só o gancho".
3. No app desse entregador, no dia: a parada "🪝 Só gancho" aparece.
   - Confirmar, com a foto conforme a regra dele.
   - O cliente recebe "Seu gancho chegou".
   - O card do admin mostra "Entregue por X na rota".
4. "Não consegui entregar": o gancho volta para a fila, e o card mostra o motivo.
5. Turno só com gancho: iniciar e encerrar. O resumo mostra "Ganchos 1", e o pagamento por entrega conta a parada.
6. Card em 360px e em 390px: os botões não quebram. Clicar no card abre o cliente, e clicar nos botões não.

---

## 4. Ordem de execução

1. Card (D-1, D-2). É só front, independente do resto, e pode ser conferido sozinho.
2. Status corrigidos em `routeOptions`. Destrava o "Enviar na rota" do gancho que vai com o pão.
3. Schema + `db push` no banco de teste (conferir o alvo no `apps/api/.env` antes).
4. Backend admin-hooks: opções, envio, `enrich`.
5. Backend do entregador: `hook-stops`, rota do dia, endpoints, comprovante, turno, rota salva, pagamento, mapa ao vivo, recusa.
6. Front do entregador.
7. Folha "Enviar na rota".
8. Testes, typecheck, build e a conferência do §3.7.

---

## 5. Pontos de atenção

- **Deploy:** `prisma db push` por causa do índice novo em `DeliveryProof`. Incluir no
  [checklist de deploy](./checklist-deploy-app-entregador.md), no item A7 Gancho na rota.
- **Custo de `routeOptions`:** uma consulta por coleção para o intervalo de 7 dias, nunca uma por dia ou turno.
- **Ganchos antigos.** Os que estão "na rota" de dias que já passaram continuam como "passou sem resposta: envie de
  novo". Esta versão não faz limpeza automática.
- **Pedido criado depois.** Se o cliente ganhar pedido no turno depois que o gancho sozinho já foi
  confirmado, nada muda: o gancho já está `DELIVERED`.
- **Fora desta versão** (registrado):
  - QR no cupom do gancho;
  - gancho sozinho na divisão de Entregas e na oferta de turno;
  - recado e reporte na parada só de gancho.
  - `assignCourier` (`PATCH /admin/orders/assign-courier`) não move o `routeCourierId` do gancho. Hoje o
    web não chama esse endpoint.
