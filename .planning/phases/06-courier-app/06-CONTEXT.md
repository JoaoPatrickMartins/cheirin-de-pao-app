# Phase 6: Courier App - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Entregador acessa a lista de entregas do dia (agrupada por condomínio, filtrada pelas ordens atribuídas a ele), confirma cada parada individualmente via dialog de confirmação, e visualiza a rota entre condomínios num mapa real (Leaflet + OpenStreetMap + OSRM).

O Admin atribui ordens ao entregador antes da rota via endpoint em batch. A geração da lista e o disparo de notificações push ao cliente ocorrem no momento da confirmação de cada apartamento.

</domain>

<decisions>
## Implementation Decisions

### Confirmação de Entrega (COUR-02)
- **D-01:** Check por apartamento = **imediato**: chama `PATCH /courier/orders/:id/confirm` → status muda para `DELIVERED` → notificação push disparada ao cliente na hora. N chamadas de API por rota (aceitável para rotas de 10–30 entregas).
- **D-02:** **Dialog de confirmação** aparece antes de disparar o DELIVERED. Entregador toca no check → modal pergunta "Confirmar entrega para Apto X?" → ao confirmar, dispara a chamada. Evita confirmações acidentais.
- **D-03:** Entrega confirmada é **irreversível** — `DELIVERED` é estado final. Se houver engano, Admin intervém (Fase 7). Simplifica fluxo e evita notificações contraditórias ao cliente.
- **D-04:** **Feedback visual** fiel ao handoff: linha com `text-decoration: line-through`, opacidade 50%, ícone de check verde preenchido. Pill do condomínio atualiza contagem (ex: `2/4 → 3/4`). Ao concluir todas as paradas do condomínio, pill muda para "Ok" (tom verde).

### Mapa de Rota (COUR-03)
- **D-05:** **Leaflet + OpenStreetMap real** — não o SVG estilizado do handoff. Implementar mapa real com react-leaflet.
- **D-06:** **Geocodificação dinâmica via Nominatim** (api.nominatim.openstreetmap.org) pelo endereço do condomínio — sem campo lat/lng no schema. Backend geocodifica o endereço dos condomínios on-demand e faz cache do resultado.
- **D-07:** **OSRM público** (router.project-osrm.org) para cálculo de rota e estimativa de distância entre condomínios no MVP. Sem necessidade de self-hosted.
- **D-08:** Usar **react-leaflet** (wrapper oficial) como biblioteca React para o mapa. Adicionar `react-leaflet` e `leaflet` ao `apps/web`.

### Ordem de Apartamentos (COUR-04)
- **Claude's Discretion:** Ordenação sugerida dentro do condomínio por número de apartamento crescente (simples, determinístico). Fase 7 pode refinar com configuração do Admin.

### Atribuição de Entregas (COUR-01)
- **D-09:** Entregador vê **apenas as ordens atribuídas a ele** — filtro por `courierId` no `Order`. Orders sem `courierId` não aparecem para nenhum entregador.
- **D-10:** `courierId` é campo **opcional** (`String?`) no schema Prisma em `Order`. Breaking change zero — Orders existentes ficam com `null` e o cron não precisa de alteração.
- **D-11:** **Admin atribui ordens em batch** via `PATCH /admin/orders/assign-courier` (body: `{ courierId, orderIds[] }` ou `{ courierId, condominiumId, date }`). Sem UI na Fase 6 — testado via curl/Postman. UI de atribuição fica para Fase 7 (ADMO-11).

### API do Entregador (Endpoints)
- **D-12:** **Novo módulo** `apps/api/src/modules/courier/` com:
  - `courier.route.ts` — preHandler: `[fastify.authenticate, fastify.requireCourier]`
  - `GET /courier/orders/today` — lista ordens `SCHEDULED` + `OUT_FOR_DELIVERY` do dia BRT atribuídas ao entregador logado, agrupadas por condomínio com paradas na ordem sugerida
  - `PATCH /courier/orders/:id/confirm` — transição para `DELIVERED` + disparo de push ao cliente (reutiliza lógica do admin-orders.service de Fase 5)
- **D-13:** **Endpoint de atribuição** (`PATCH /admin/orders/assign-courier`) é adicionado ao módulo `admin-orders` existente (Fase 5) — consistente com demais rotas admin sobre pedidos.
- **D-14:** Guard `requireCourier` a ser criado no plugin `authenticate.ts` (análogo ao `requireAdmin` existente).

### Card de Progresso (COUR-05)
- **Claude's Discretion:** Card espresso no topo (fiel ao handoff): `X/N paradas` (Bricolage Grotesque 26px) + `Total de pães` (dourado). Barra de progresso dourada embaixo (`width: feitas/total * 100%`, transition 0.3s).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos e Domínio
- `.planning/REQUIREMENTS.md` §COUR-01..05 — requisitos do entregador desta fase
- `.planning/phases/06-courier-app/06-CONTEXT.md` — este arquivo

### Fase Anterior (dependências diretas)
- `.planning/phases/05-delivery-experience/05-CONTEXT.md` — decisões de transição de status, notificações push e módulo admin-orders
- `apps/api/src/modules/admin-orders/admin-orders.route.ts` — módulo a ser estendido com assign-courier
- `apps/api/src/modules/admin-orders/admin-orders.service.ts` — lógica de transição + push a ser reutilizada pelo courier.service

### Design
- `.projeto/design_handoff_cheirin_pao/app/screens-roles.jsx` — **referência primária**: `CourierScreen` + `CourierRoute` em alta fidelidade (confirmação, lista, mapa SVG de referência visual)
- `.projeto/design_handoff_cheirin_pao/README.md` — tokens de design (cores, tipografia, espaçamentos)
- `.projeto/design_handoff_cheirin_pao/app/brand.jsx` — primitivas UI (`Card`, `Pill`, `Icon`, `BreadMark`, tokens)
- `.projeto/` — requisitos v01 e modelo de funcionamento

### Padrões de Código Existentes
- `apps/web/src/pages/courier/CourierLayout.tsx` — layout e guard COURIER já implementados
- `apps/api/src/plugins/authenticate.ts` — `requireAdmin` como modelo para `requireCourier`
- `apps/api/src/modules/orders/orders.route.ts` — padrão de rotas autenticadas
- `apps/api/src/modules/notifications/notifications.service.ts` — OneSignal push (reutilizar no courier.service)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/pages/courier/CourierLayout.tsx` — guard de role COURIER pronto; `<Outlet />` aguarda telas da Fase 6
- `apps/api/src/modules/admin-orders/admin-orders.controller.ts` — `updateOrderStatus()` com validação de transição e push; courier.controller pode reutilizar a mesma lógica via service
- `apps/api/src/modules/notifications/notifications.service.ts` — `sendPushNotification()` já usa OneSignal SDK; importar no courier.service
- `apps/api/src/plugins/cron.ts` — padrão `NODE_ENV !== 'test'` guard (referência, não usado diretamente na Fase 6)

### Established Patterns
- Módulos: `*.route.ts` → `*.controller.ts` → `*.service.ts` → `*.repository.ts`
- Autenticação: `preHandler: [fastify.authenticate]`; admin: `fastify.requireAdmin` (criar análogo `requireCourier`)
- Zod schemas em `*.schema.ts`; validação no controller antes de chamar service
- Commits atômicos por tarefa; `SUMMARY.md` obrigatório ao final de cada plano

### Integration Points
- `Order` no schema Prisma: adicionar campo `courierId String?` + `prisma db push`
- `OrderStatus` enum: `OUT_FOR_DELIVERY` já adicionado na Fase 5 (D-02 do CONTEXT-05)
- `fastify.requireCourier` a ser criado em `apps/api/src/plugins/authenticate.ts`
- `router.tsx` frontend: adicionar sub-rotas `/courier/*` dentro do `CourierLayout`

</code_context>

<specifics>
## Specific Ideas

- **Dialog de confirmação**: modal simples (não bottom sheet) com nome do cliente + apartamento + quantidade. Dois botões: "Cancelar" (fecha) e "Confirmar entrega" (dispara a chamada).
- **Mapa**: react-leaflet com tiles OSM padrão; marcadores numerados dourados nos condomínios (ordem da rota calculada pelo OSRM); polyline dourada conectando as paradas. Legenda de distância total + tempo estimado (retornados pelo OSRM).
- **Geocodificação**: backend geocodifica via Nominatim antes de retornar a rota ao entregador. Cache simples em memória (Map) por endereço durante a sessão do servidor — evita chamadas repetidas ao Nominatim para o mesmo condomínio.
- **Segmented control Lista / Rota** fiel ao handoff: `Surface2` background, tabs com ícone + label, tab ativa com `surface` + `shadowSoft`.

</specifics>

<deferred>
## Deferred Ideas

- **OSRM self-hosted** no VPS — produção com mais volume → Fase 7 ou pós-MVP
- **Atribuição automática** com aprovação do Admin (ADMO-11) → Fase 7
- **UI de atribuição de entregadores** no Admin → Fase 7
- **Configuração da ordem de apartamentos** pelo Admin → Fase 7
- **Desmarcar entrega** (reversão de DELIVERED) → Fase 7 (Admin intervém)

</deferred>

---

*Phase: 6-courier-app*
*Context gathered: 2026-06-15*
