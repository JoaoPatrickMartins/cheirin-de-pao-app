---
phase: 06-courier-app
verified: 2026-06-15T19:21:34Z
status: human_needed
score: 10/11 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Abrir aba Rota no app e verificar se a polyline dourada conecta corretamente os condomínios no mapa"
    expected: "Polyline tracejada dourada segue a rota real entre os condomínios; marcadores numerados estão nas posições corretas"
    why_human: "O backend passa r.geometry?.coordinates do OSRM diretamente sem conversão [lng,lat] → [lat,lng]. Leaflet espera [lat,lng]. No código de produção, a polyline pode estar plotada com coordenadas invertidas (lat/lng trocados), o que só é visível visualmente no mapa real."
  - test: "Confirmar entrega como entregador e verificar notificação push recebida pelo cliente"
    expected: "Após PATCH /courier/orders/:id/confirm, o cliente recebe notificação push OneSignal com confirmação de entrega; status da order muda para DELIVERED"
    why_human: "Fluxo envolve serviço externo (OneSignal) que não pode ser verificado via grep"
  - test: "Tentar acessar /courier sem login → deve redirecionar para login"
    expected: "Usuário não autenticado é redirecionado; usuário CLIENT recebe 403 na API"
    why_human: "Comportamento de roteamento frontend e guard de autenticação precisam de teste em browser"
  - test: "Login como entregador → /courier → verificar lista de entregas do dia com dados reais do banco"
    expected: "CourierScreen exibe condomínios com paradas reais atribuídas ao entregador; card de progresso mostra 0/N paradas corretamente"
    why_human: "Requer entregador cadastrado e orders atribuídas via assign-courier no banco real"
---

# Phase 06: Courier App — Verification Report

**Phase Goal:** Entregar o app completo do entregador (Courier App) — backend com endpoints de rota e confirmação de entrega, frontend com mapa Leaflet, lista de paradas e fluxo de confirmação, integrado ao sistema de push e ao módulo de créditos existente.
**Verified:** 2026-06-15T19:21:34Z
**Status:** human_needed
**Re-verification:** No — verificação inicial

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | GET /courier/orders/today retorna apenas ordens com courierId igual ao userId do JWT | VERIFIED | `courier.repository.ts` filtra `courierId` via `findTodayByCourierId`; controller extrai `request.user!.id`; teste unitário confirma (comportamento 1) |
| 2  | PATCH /courier/orders/:id/confirm transiciona o status para DELIVERED e retorna 403 se courierId da order difere do entregador logado | VERIFIED | `courier.service.ts` linha 246-251 valida ownership e lança 403; delega `updateOrderStatus('DELIVERED')` ao AdminOrdersService; teste comportamento 3 e 4 passam |
| 3  | Rotas /courier/* retornam 403 sem autenticação e 403 para roles != COURIER | VERIFIED | `courier.route.ts` usa `preHandler: [fastify.authenticate, fastify.requireCourier]` em ambas as rotas; `authenticate.ts` linha 90-96 implementa `requireCourier` com check `role !== 'COURIER'` → 403 |
| 4  | Paradas dentro de cada condomínio estão ordenadas por número de apartamento crescente (numérico) | VERIFIED | `courier.service.ts` linha 139: `condo.stops.sort((a, b) => a.sortKey - b.sortKey)`; sortKey via `parseInt(apartment, 10)` com fallback 9999; teste comportamento 6 confirma sequência 9 < 10 < 101 |
| 5  | Endpoint assign-courier grava courierId nas orders selecionadas | VERIFIED | `admin-orders.service.ts` método `assignCourier` executa `prisma.order.updateMany({ data: { courierId } })`; rota `PATCH /admin/orders/assign-courier` wired em admin-orders.route.ts |
| 6  | Entregador acessa /courier e vê lista de entregas agrupada por condomínio com bloco/torre, apto, qtd e nome do cliente | VERIFIED | `CourierScreen.tsx` consome `apiFetch('/courier/orders/today')` em useEffect; `CondoAccordion.tsx` renderiza stops com nome, apartamento, bloco e quantidade |
| 7  | Card de progresso exibe X/N paradas e total de pães com barra dourada animada | VERIFIED | `ProgressCard.tsx` com props `confirmed/total/totalBreads/confirmedBreads`; `transition: 'width 0.3s ease'` na barra; opacity 0.12 no BreadMark decorativo |
| 8  | Toque na parada abre dialog de confirmação; ao confirmar, status muda com strikethrough + opacity 50% + check verde | VERIFIED | `StopRow.tsx` chama `onPress(stop)` que abre `ConfirmDeliveryDialog`; `ConfirmDeliveryDialog` faz PATCH e chama `onConfirmed(orderId)`; `CourierScreen` adiciona ao `confirmedIds` Set; `StopRow` aplica `textDecoration: 'line-through'` e `opacity: 0.5` quando `isConfirmed` |
| 9  | Segmented control Lista/Rota presente; aba Rota exibe mapa Leaflet real com tiles OSM e marcadores numerados | VERIFIED | `SegmentedControl.tsx` implementado; `CourierRouteView.tsx` renderiza `<CourierMap>` com TileLayer OSM, DivIcon numerados e Polyline; `CourierMap.tsx` usa `L.divIcon` com `className: ''` |
| 10 | Polyline dourada tracejada conecta os condomínios e mapa faz fitBounds nos marcadores | UNCERTAIN | Polyline existe com `color="#E3AC3F"`, `dashArray="2 9"`, `lineCap="round"`; FitBounds via `useMap()` hook implementado. PORÉM: backend retorna `r.geometry?.coordinates` do OSRM sem conversão `[lng,lat] → [lat,lng]`. Leaflet Polyline espera `[lat,lng]`. Para coordenadas brasileiras, a polyline pode ser renderizada com lat/lng trocados — necessita verificação visual humana. |
| 11 | Se OSRM ou Nominatim falhar, aba Rota exibe "Rota indisponível" sem bloquear aba Lista | VERIFIED | `CourierRouteView.tsx` testa `if (route === null)` e renderiza card com "Rota indisponível" + instrução para usar aba Lista; OSRM em try/catch isolado no service com fallback `route = null`; teste comportamento 5 confirma |

**Score:** 10/11 truths verified (1 UNCERTAIN — necessita verificação humana)

---

### Required Artifacts

| Artifact | Expected | Status | Detalhes |
|----------|----------|--------|---------|
| `apps/api/prisma/schema.prisma` | campo `courierId String? @db.ObjectId` em model Order | VERIFIED | Linha 203: `courierId String? @db.ObjectId` presente em model Order |
| `apps/api/src/plugins/authenticate.ts` | `requireCourier` preHandler decorator | VERIFIED | Exporta `requireCourier` via `fastify.decorate`; declare module FastifyInstance inclui `requireCourier: preHandlerHookHandler` |
| `apps/api/src/modules/courier/courier.service.ts` | `getTodayOrders + confirmDelivery` | VERIFIED | Ambos os métodos implementados com lógica real de negócio; geocodeCache Map em nível de instância; OSRM em try/catch |
| `apps/api/src/modules/courier/__tests__/courier.service.test.ts` | testes unitários COUR-01..COUR-04, mínimo 80 linhas | VERIFIED | 331 linhas; 6 describe blocks cobrindo todos os comportamentos; 102/102 testes passando |
| `apps/web/src/pages/courier/CourierScreen.tsx` | tela principal do entregador | VERIFIED | Implementada com header, segmented control, progress card, lista e dialog |
| `apps/web/src/components/courier/ProgressCard.tsx` | card espresso com contador + barra animada | VERIFIED | Fundo `#1E1207`, barra com `transition: 'width 0.3s ease'`, BreadMark `opacity: 0.12` |
| `apps/web/src/components/courier/CondoAccordion.tsx` | accordion por condomínio com pill | VERIFIED | `aria-expanded={isOpen}`, pill "Ok" good quando `feitas === total`, chevron com rotate |
| `apps/web/src/components/courier/StopRow.tsx` | linha de parada clicável | VERIFIED | `<button>` nativo, `minHeight: 44`, strikethrough + opacity quando `isConfirmed` |
| `apps/web/src/components/courier/ConfirmDeliveryDialog.tsx` | modal de confirmação | VERIFIED | `role="dialog"`, `aria-modal="true"`, erro "Falha na conexão. Tente novamente.", PATCH via apiFetch |
| `apps/web/src/components/courier/CourierMap.tsx` | mapa react-leaflet com TileLayer OSM, DivIcon, Polyline | VERIFIED | DivIcon com `className: ''`, `useMap()` no FitBounds, `aria-label="Mapa de rota do entregador"`, sem `L.Icon` |
| `apps/web/src/pages/courier/CourierRouteView.tsx` | aba Rota: mapa + lista de paradas | VERIFIED | Graceful degradation `route === null`, filtro de condos com lat/lng null, badges dourados, hora estimada |
| `apps/web/src/main.tsx` | `leaflet/dist/leaflet.css` importado antes de globals.css | VERIFIED | Linha 1: `import 'leaflet/dist/leaflet.css'` antes de fontes e globals.css |

---

### Key Link Verification

| From | To | Via | Status | Detalhes |
|------|----|-----|--------|---------|
| `courier.route.ts` | `authenticate.ts` | `preHandler: [fastify.authenticate, fastify.requireCourier]` | WIRED | Ambas as rotas têm o preHandler completo |
| `courier.service.ts` | `admin-orders.service.ts` | `new AdminOrdersService(this.fastify).updateOrderStatus` | WIRED | Linha 254-255 instancia AdminOrdersService e chama updateOrderStatus |
| `server.ts` | `courier.route.ts` | `fastify.register(courierRoute)` | WIRED | Linha 101 de server.ts: `await fastify.register(courierRoute)` |
| `CourierScreen.tsx` | `/courier/orders/today` | `apiFetch('/courier/orders/today')` em useEffect | WIRED | Linha 51 de CourierScreen.tsx |
| `ConfirmDeliveryDialog.tsx` | `/courier/orders/:id/confirm` | `apiFetch PATCH` | WIRED | Linha 27: `apiFetch('/courier/orders/${stop.orderId}/confirm', { method: 'PATCH' })` |
| `router.tsx` | `CourierScreen.tsx` | lazy import como `children[0].index` | WIRED | Confirmado via grep: sub-rota `index: true` com lazy import de CourierScreen |
| `CourierScreen.tsx` | `CourierRouteView.tsx` | `tab === 'route'` renderiza `<CourierRouteView>` | WIRED | Linha 232: `<CourierRouteView condos={data.condos} route={data.route} />` |
| `CourierMap.tsx` | `tile.openstreetmap.org` | TileLayer url | WIRED | `url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produz Dados Reais | Status |
|----------|--------------|--------|-------------------|--------|
| `CourierScreen.tsx` | `data` (TodayOrdersResponse) | `apiFetch('/courier/orders/today')` → `GET /courier/orders/today` → `CourierRepository.findTodayByCourierId` → `prisma.order.findMany` | Sim — query real ao MongoDB | FLOWING |
| `ConfirmDeliveryDialog.tsx` | resultado do PATCH | `apiFetch PATCH → CourierService.confirmDelivery → AdminOrdersService.updateOrderStatus → prisma.order.update` | Sim — atualização real no banco | FLOWING |
| `CourierMap.tsx` | `geometry` | `courier.service.ts` → `r.geometry?.coordinates` do OSRM | Dados chegam do OSRM mas podem ter coordenadas invertidas ([lng,lat] vs [lat,lng] esperado pelo Leaflet) | UNCERTAIN — ver truth #10 |

---

### Behavioral Spot-Checks

| Comportamento | Comando | Resultado | Status |
|--------------|---------|-----------|--------|
| API tests passam (102 testes) | `npm run test --workspace=apps/api` | 15 arquivos, 102 testes passando | PASS |
| Typecheck frontend | `npm run typecheck --workspace=apps/web` | Saiu com código 0 (sem erros de tipo) | PASS |
| Build frontend | `npm run build --workspace=apps/web` | Build bem-sucedido; `CourierScreen-BLkpZgwr.js` (168 kB) gerado; sem erros de bundle | PASS |

---

### Requirements Coverage

| Requirement | Plano(s) | Descrição | Status | Evidência |
|-------------|---------|-----------|--------|---------|
| COUR-01 | 06-01, 06-02 | Entregador acessa lista de entregas do dia agrupada por condomínio (bloco/torre, apto, qtd, nome do cliente) | SATISFIED | Backend filtra por `courierId`; frontend renderiza CondoAccordion com todos os campos |
| COUR-02 | 06-01, 06-02 | Entregador confirma cada entrega com check manual (toque na parada) | SATISFIED | `StopRow` → `ConfirmDeliveryDialog` → `PATCH /courier/orders/:id/confirm` → AdminOrdersService DELIVERED |
| COUR-03 | 06-03 | Entregador visualiza mapa com ordem de paradas entre condomínios (OpenStreetMap + Leaflet + OSRM) | SATISFIED (com ressalva) | Mapa Leaflet com TileLayer OSM, marcadores DivIcon numerados e Polyline implementados. Possível inversão de coordenadas da geometria OSRM — verificação humana necessária |
| COUR-04 | 06-01, 06-03 | Sistema exibe ordem sugerida de apartamentos dentro de cada condomínio | SATISFIED | Backend ordena stops por `sortKey = parseInt(apartment, 10)` ASC; frontend exibe "ORDEM SUGERIDA NO PRÉDIO" com lista ordenada |
| COUR-05 | 06-02 | Card de progresso exibe paradas feitas/total e total de pães | SATISFIED | `ProgressCard` com `confirmed/total paradas` e `confirmedBreads/totalBreads pães`; barra animada 0.3s |

---

### Anti-Patterns Found

| Arquivo | Linha | Padrão | Severidade | Impacto |
|---------|-------|--------|-----------|---------|
| `courier.service.ts` | 213 | `geometry: r.geometry?.coordinates ?? []` — OSRM retorna `[lng,lat]` (GeoJSON); Leaflet espera `[lat,lng]`; conversão não implementada apesar de T-06-10 declarar que "backend já converteu" | WARNING | Polyline pode ser renderizada com coordenadas invertidas no mapa; marcadores e FitBounds não são afetados (usam lat/lng da geocodificação Nominatim) |

Nenhum marcador TBD, FIXME, XXX ou placeholder encontrado nos arquivos criados nesta fase.

---

### Human Verification Required

#### 1. Polyline do mapa com coordenadas corretas

**Teste:** Login como entregador com orders atribuídas em dois ou mais condomínios diferentes. Navegar para /courier → aba "Rota". Observar a polyline dourada tracejada no mapa.
**Esperado:** A polyline conecta visualmente os marcadores numerados na região geográfica correta (Sul/Sudeste do Brasil). Se a polyline aparecer em regiões geográficas absurdas (por exemplo, no Atlântico Norte ou sobre linhas verticais no mapa), as coordenadas estão invertidas.
**Por que humano:** A inversão `[lng,lat]` vs `[lat,lng]` na geometria OSRM só é detectável visualmente no mapa real. O código compila sem erros mas a renderização seria incorreta. O backend (`courier.service.ts` linha 213) passa `r.geometry?.coordinates` direto sem conversão; o plano declarava que a conversão seria feita no backend mas não foi implementada.

#### 2. Notificação push ao confirmar entrega

**Teste:** Confirmar uma parada via ConfirmDeliveryDialog → verificar se o cliente recebe notificação OneSignal "Seu pedido foi entregue".
**Esperado:** Push OneSignal entregue ao dispositivo do cliente; status da order muda para DELIVERED no banco.
**Por que humano:** Envolve serviço externo OneSignal e requer dispositivo real com PWA instalado.

#### 3. Fluxo completo de atribuição e visualização de rota

**Teste:** (1) Admin usa `PATCH /admin/orders/assign-courier` para atribuir orders a um entregador. (2) Entregador faz login, acessa /courier, verifica lista com os condomínios corretos. (3) Troca para aba Rota e verifica mapa com marcadores na posição correta.
**Esperado:** Orders aparecem agrupadas por condomínio na lista; mapa mostra marcadores nas coordenadas geográficas corretas dos condomínios.
**Por que humano:** Requer dados reais no banco (MongoDB Atlas remoto) e usuário COURIER autenticado.

---

### Resumo dos Gaps

Não foram encontrados gaps bloqueadores. Todos os artefatos existem, têm implementação substantiva e estão corretamente conectados. Os 102 testes do workspace `apps/api` passam. O build do frontend compila sem erros.

O único ponto pendente é a verificação visual da polyline no mapa: o backend passa as coordenadas de geometria do OSRM sem conversão explícita de `[lng,lat]` para `[lat,lng]`. O plano declarou que essa conversão seria feita no backend (T-06-10), mas o código em `courier.service.ts` linha 213 retorna `r.geometry?.coordinates` diretamente. Dado que o OSRM retorna GeoJSON padrão (`[longitude, latitude]`) e o Leaflet Polyline espera `[latitude, longitude]`, a polyline pode estar sendo plotada com coordenadas invertidas — algo que só a verificação visual confirma.

Os requisitos COUR-01 a COUR-05 têm evidência de implementação real no código. A fase está funcionalmente completa aguardando validação humana para o item acima.

---

_Verified: 2026-06-15T19:21:34Z_
_Verifier: Claude (gsd-verifier)_
