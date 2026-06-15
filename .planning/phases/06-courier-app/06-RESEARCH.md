# Phase 6: Courier App - Research

**Researched:** 2026-06-15
**Domain:** React Leaflet / OSRM / Fastify courier module / Prisma schema extension
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Confirmação de Entrega (COUR-02)**
- D-01: Check por apartamento imediato — `PATCH /courier/orders/:id/confirm` → `DELIVERED` → push disparado na hora.
- D-02: Dialog de confirmação obrigatório antes de disparar DELIVERED. Toque na parada → modal "Confirmar entrega para Apto X?" → ao confirmar, dispara a chamada.
- D-03: DELIVERED é irreversível na Fase 6. Engano resolvido pelo Admin na Fase 7.
- D-04: Feedback visual: strikethrough + opacity 50% + check verde. Pill do condomínio atualiza contagem. Pill vira "Ok" (verde) ao concluir todas as paradas.

**Mapa de Rota (COUR-03)**
- D-05: Leaflet + OpenStreetMap real (não SVG estilizado).
- D-06: Geocodificação via Nominatim on-demand + cache em memória (Map) por endereço.
- D-07: OSRM público (router.project-osrm.org) para rota e estimativa de distância.
- D-08: react-leaflet (wrapper oficial React) como biblioteca de mapa.

**Atribuição de Entregas (COUR-01)**
- D-09: Entregador vê apenas ordens com `courierId` = seu ID.
- D-10: `courierId String?` opcional no schema Prisma em `Order`. Zero breaking change.
- D-11: Admin atribui ordens em batch via `PATCH /admin/orders/assign-courier`. Sem UI na Fase 6 — testado via curl/Postman.

**API do Entregador**
- D-12: Novo módulo `apps/api/src/modules/courier/` com:
  - `GET /courier/orders/today` — lista SCHEDULED + OUT_FOR_DELIVERY do dia BRT atribuídas ao entregador.
  - `PATCH /courier/orders/:id/confirm` — transição para DELIVERED + push ao cliente.
- D-13: Endpoint `PATCH /admin/orders/assign-courier` adicionado ao módulo admin-orders existente.
- D-14: Guard `requireCourier` criado em `authenticate.ts`.

**Ordem de Apartamentos (COUR-04)**
- Claude's Discretion: Ordenação por número de apartamento crescente (simples, determinístico).

**Card de Progresso (COUR-05)**
- Claude's Discretion: Card espresso no topo com X/N paradas + Total de pães + barra dourada animada.

### Claude's Discretion
- Ordenação de apartamentos dentro do condomínio: por número crescente.
- Card de progresso: implementação fiel ao handoff (Bricolage 26px display, barra 0.3s).

### Deferred Ideas (OUT OF SCOPE)
- OSRM self-hosted no VPS — Fase 7 ou pós-MVP.
- Atribuição automática com aprovação do Admin (ADMO-11) — Fase 7.
- UI de atribuição de entregadores no Admin — Fase 7.
- Configuração da ordem de apartamentos pelo Admin — Fase 7.
- Desmarcar entrega (reversão de DELIVERED) — Fase 7.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COUR-01 | Entregador acessa lista de entregas do dia agrupada por condomínio (bloco/torre, apto, qtd, nome do cliente) | D-09, D-10, D-12: campo `courierId` em `Order`, endpoint `GET /courier/orders/today` com agrupamento por condomínio |
| COUR-02 | Entregador confirma cada entrega com check manual (toque na parada) | D-01, D-02, D-03: `PATCH /courier/orders/:id/confirm`, dialog de confirmação, transição DELIVERED irreversível |
| COUR-03 | Entregador visualiza mapa com ordem de paradas entre condomínios (OpenStreetMap + Leaflet + OSRM) | D-05..D-08: react-leaflet 5 + OSM tiles + Nominatim geocoding + OSRM routing |
| COUR-04 | Sistema exibe ordem sugerida de apartamentos dentro de cada condomínio | Ordenação por `apartment` crescente no serviço. Ver Pitfall 2 sobre sort alfanumérico. |
| COUR-05 | Card de progresso exibe paradas feitas/total e total de pães entregues no dia | Estado local no frontend: contador `confirmed / total`, soma de `quantity` das paradas confirmadas |
</phase_requirements>

---

## Summary

A Fase 6 constrói o app do entregador sobre fundações já existentes. O backend ganha um novo módulo `courier/` espelhando o padrão `route → controller → service → repository` já usado em 10 módulos (admin-orders, orders, schedules etc.), com um guard `requireCourier` análogo ao `requireAdmin` que já existe. A maior mudança no schema é a adição de `courierId String?` no modelo `Order` — campo opcional, zero breaking change em MongoDB com `prisma generate` (sem necessidade de `prisma db push` para campos opcionais adicionados).

O frontend adiciona duas telas novas (`CourierScreen` + `CourierRouteView`) e seis componentes no diretório `components/courier/`. O ponto de integração mais delicado é o react-leaflet 5, que exige a importação explícita de `leaflet/dist/leaflet.css` e correção dos marcadores padrão quebrados no Vite (problema histórico de resolução de URL relativa no bundler). A solução padrão é usar `L.DivIcon` com HTML customizado — que é exatamente o que o handoff pede (marcadores numerados dourados), eliminando o bug de path de imagens por completo.

O `CourierLayout.tsx` já existe e guarda a rota por `role === 'COURIER'`. O router já registra `/courier` mas sem filhos. A Fase 6 adiciona o filho `index` apontando para `CourierScreen`.

**Recomendação primária:** Organizar a fase em 3 planos verticais — (1) schema + módulo courier API + testes; (2) frontend CourierScreen + componentes de lista + dialog + router; (3) CourierRouteView + react-leaflet + geocoding/OSRM.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Lista de entregas do dia por entregador | API / Backend | — | Filtragem por courierId + agrupamento por condomínio é lógica de negócio no service |
| Confirmação de entrega (DELIVERED + push) | API / Backend | Frontend (UI state) | Transição de status e disparo de push no service; frontend apenas gerencia estado local pós-200 |
| Geocodificação de endereço para lat/lng | API / Backend | — | Cache em memória no servidor; frontend recebe coordenadas prontas |
| Cálculo de rota entre condomínios (OSRM) | API / Backend | — | Backend chama OSRM, retorna polyline + distância/duração ao frontend |
| Renderização do mapa (Leaflet) | Browser / Client | — | react-leaflet roda no browser; servidor não renderiza o mapa |
| Card de progresso + accordion | Browser / Client | — | Estado local de confirmações; conta paradas em memória no componente |
| Guard de role COURIER | Frontend Server (SSR) equiv. / Client Route | API (preHandler) | CourierLayout faz role check no cliente; `requireCourier` protege a API |
| Atribuição de entregas (Admin → Entregador) | API / Backend | — | PATCH admin endpoint atualiza courierId em batch |

---

## Standard Stack

### Core

| Biblioteca | Versão | Propósito | Por que padrão |
|-----------|--------|-----------|----------------|
| react-leaflet | 5.0.0 | Wrapper React para Leaflet; MapContainer, TileLayer, Marker, Polyline, useMap | D-08: decisão locked. Única lib React oficial para Leaflet. Suporta React 19 (peerDep confirmado). |
| leaflet | 1.9.4 | Biblioteca de mapa base (peer dep do react-leaflet) | Peer dependency obrigatória. Versão estável há 2+ anos. |
| @types/leaflet | 1.9.21 | Tipos TypeScript para leaflet | Necessário em projeto TypeScript para autocompletar e type-check dos objetos L.* |

### Dependências já instaladas reutilizadas

| Biblioteca | Versão atual | Reutilização nesta fase |
|-----------|-------------|------------------------|
| @onesignal/node-onesignal | ^5.8.0 | Push DELIVERED via `AdminOrdersService.notifyAndPersist` (reutilização direta) |
| zod | 4.4.3 | Schemas de validação para courier.schema.ts |
| fastify-plugin | 6.0.0 | Padrão de plugin para authenticate.ts (requireCourier) |

### Instalação (apenas novos pacotes)

```bash
# Em apps/web (frontend apenas)
npm install react-leaflet leaflet
npm install -D @types/leaflet
```

**Nenhum novo pacote necessário no backend** — toda a lógica de geocodificação usa `fetch` nativo (Node 18+) e a lógica de push reutiliza `@onesignal/node-onesignal` já instalado.

---

## Package Legitimacy Audit

| Package | Registry | Idade | Downloads | Repositório | slopcheck | Disposição |
|---------|----------|-------|-----------|-------------|-----------|------------|
| react-leaflet | npm | ~10 anos (139 versões) | Amplamente usado | github.com/PaulLeCam/react-leaflet | [OK] | Aprovado |
| leaflet | npm | ~12 anos (48 versões), publicado 1.9.4 há 2+ anos | Mainstream | github.com/Leaflet/Leaflet | [OK] | Aprovado |
| @types/leaflet | npm | Ativo no DefinitelyTyped | Mainstream | DefinitelyTyped | [OK] | Aprovado |

**Packages removidos por slopcheck [SLOP]:** nenhum
**Packages marcados suspeitos [SUS]:** nenhum

*slopcheck rodado em 2026-06-15 — todos os 3 pacotes obtiveram [OK]. Nenhum postinstall script encontrado em react-leaflet ou leaflet. As 8 vulnerabilidades reportadas pelo `npm audit` (zenvia, form-data, request, qs, uuid) são pré-existentes no projeto — não introduzidas por esta fase.*

---

## Architecture Patterns

### Diagrama de Fluxo

```
Entregador (browser)
    │
    │  GET /courier/orders/today
    ▼
CourierService
    ├── prisma.order.findMany(courierId, today BRT, status IN [SCHEDULED, OUT_FOR_DELIVERY])
    ├── enrich: prisma.user.findUnique (nome do cliente por order.userId)
    ├── enrich: prisma.condominium.findUnique (nome, endereço por user.condominiumId)
    ├── geocode: Nominatim (se cache miss) → { lat, lng }  ← cache em Map<endereço, {lat,lng}>
    ├── OSRM: route/v1/driving/{lng,lat};{lng,lat}... → { distance, duration, geometry }
    └── group: por condominiumId, sort paradas por apartment ASC
    │
    │  resposta: { condos: [...], totalStops, totalBreads, route: { distanceKm, durationMin, geometry } }
    ▼
Frontend
    ├── CourierScreen (aba Lista) → CondoAccordion[] → StopRow[]
    │       └── toque em StopRow → ConfirmDeliveryDialog → PATCH /courier/orders/:id/confirm
    └── CourierScreen (aba Rota) → CourierRouteView → CourierMap (react-leaflet)

PATCH /courier/orders/:id/confirm
    ├── requireCourier guard (role check)
    ├── CourierService.confirmDelivery(orderId, courierId)
    │       ├── findUnique(orderId) → valida courierId == request.user.id
    │       ├── AdminOrdersService.updateOrderStatus(orderId, 'DELIVERED')
    │       └── (push + persist Notification via AdminOrdersService.notifyAndPersist)
    └── 200 { ok: true }
```

### Estrutura de Pastas Recomendada

```
apps/api/src/
├── modules/
│   ├── courier/                     # NOVO — módulo entregador
│   │   ├── courier.route.ts         # preHandler: [authenticate, requireCourier]
│   │   ├── courier.controller.ts    # handlers HTTP
│   │   ├── courier.service.ts       # lógica de negócio + geocodificação + OSRM
│   │   ├── courier.repository.ts    # queries Prisma
│   │   ├── courier.schema.ts        # Zod schemas
│   │   └── __tests__/
│   │       └── courier.service.test.ts
│   └── admin-orders/                # EXISTENTE — adicionar assign-courier
│       ├── admin-orders.route.ts    # + PATCH /admin/orders/assign-courier
│       ├── admin-orders.controller.ts
│       ├── admin-orders.service.ts  # + assignCourier(courierId, orderIds[])
│       └── admin-orders.schema.ts   # + AssignCourierSchema

apps/api/src/plugins/
└── authenticate.ts                  # + requireCourier preHandler

apps/api/prisma/
└── schema.prisma                    # Order: + courierId String? @db.ObjectId

apps/web/src/
├── pages/courier/
│   ├── CourierLayout.tsx            # EXISTENTE — sem alteração (guard já implementado)
│   ├── CourierScreen.tsx            # NOVO — tela principal (header + segmented + progress + list/route)
│   └── CourierRouteView.tsx         # NOVO — aba Rota: mapa Leaflet + lista de paradas
├── components/courier/             # NOVO — diretório
│   ├── ProgressCard.tsx
│   ├── SegmentedControl.tsx
│   ├── CondoAccordion.tsx
│   ├── StopRow.tsx
│   ├── ConfirmDeliveryDialog.tsx
│   └── CourierMap.tsx
└── routes/router.tsx               # + sub-rota index em /courier
```

### Padrão 1: requireCourier guard em authenticate.ts

O `requireAdmin` existente faz inline role check. O `requireCourier` segue o mesmo padrão mas como decorator separado para clareza de leitura nas rotas:

```typescript
// Source: apps/api/src/plugins/authenticate.ts (EXISTENTE — a ser estendido)
// Adicionar ao declare module fastify:
// requireCourier: preHandlerHookHandler

const requireCourier: preHandlerHookHandler = async (request, reply) => {
  if (request.user?.role !== 'COURIER') {
    return reply.status(403).send({ error: 'Acesso negado: apenas entregadores' })
  }
}

fastify.decorate('requireCourier', requireCourier)
// FastifyInstance interface: adicionar requireCourier: preHandlerHookHandler
```

### Padrão 2: Geocodificação com cache em memória no Fastify

```typescript
// Source: D-06 do CONTEXT.md + Nominatim Usage Policy
// Cache em Map<string, {lat: number; lng: number}> na instância do serviço (escopo do servidor)
// Rate limit: máximo 1 req/segundo ao Nominatim — aceitável dado o número pequeno de condomínios

const geocodeCache = new Map<string, { lat: number; lng: number }>()

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const cached = geocodeCache.get(address)
  if (cached) return cached

  const query = encodeURIComponent(address)
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
    { headers: { 'User-Agent': 'CheirimdePao-app/1.0 (contato@cheirindepao.com.br)' } }
  )
  const data = await res.json() as Array<{ lat: string; lon: string }>
  if (!data.length) return null

  const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  geocodeCache.set(address, result)
  return result
}
```

**Atenção:** Nominatim exige `User-Agent` identificando a aplicação. Requests sem User-Agent ou com User-Agent genérico podem ser bloqueados. [VERIFIED: operations.osmfoundation.org/policies/nominatim]

### Padrão 3: OSRM — requisição multi-waypoint

```typescript
// Source: router.project-osrm.org (testado em 2026-06-15)
// Formato: /route/v1/driving/{lng,lat};{lng,lat};...?overview=full&geometries=geojson

async function getRoute(waypoints: Array<{ lat: number; lng: number }>) {
  const coords = waypoints.map(w => `${w.lng},${w.lat}`).join(';')
  const res = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`
  )
  const data = await res.json() as {
    code: string
    routes: Array<{
      distance: number   // metros
      duration: number   // segundos
      geometry: {
        type: 'LineString'
        coordinates: Array<[number, number]>  // [lng, lat]
      }
      legs: Array<{ distance: number; duration: number }>
    }>
  }
  if (data.code !== 'Ok' || !data.routes.length) return null
  const route = data.routes[0]
  return {
    distanceKm: (route.distance / 1000).toFixed(1),
    durationMin: Math.round(route.duration / 60),
    geometry: route.geometry   // repassar ao frontend para o Polyline do react-leaflet
  }
}
```

### Padrão 4: react-leaflet — setup crítico no Vite

```typescript
// Source: WebSearch verificado + leaflet docs
// OBRIGATÓRIO: importar o CSS do leaflet em main.tsx (ou no componente CourierMap)
import 'leaflet/dist/leaflet.css'

// OBRIGATÓRIO: corrigir marcadores padrão quebrados no Vite
// Vite não resolve paths relativos dentro de CSS de node_modules corretamente.
// Solução: usar L.DivIcon com HTML customizado (que é exatamente o que o handoff pede —
// marcadores numerados dourados). Isso elimina o problema de icon path por completo.
// Não usar L.Icon com iconUrl para markers padrão.

import L from 'leaflet'

function createNumberedMarker(order: number): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      width:36px;height:36px;border-radius:12px;
      background:#1E1207;border:2px solid #E3AC3F;
      color:#E3AC3F;font-family:'Bricolage Grotesque Variable',serif;
      font-size:15px;font-weight:800;
      display:flex;align-items:center;justify-content:center;
    ">${order}</div>`,
    className: '',    // IMPORTANTE: className vazio evita o fundo branco padrão do DivIcon
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
}
```

### Padrão 5: Agrupamento de ordens por condomínio no service

```typescript
// Source: D-12 do CONTEXT.md + padrão TodayRange já existente em orders.service.ts

type StopGroup = {
  condominiumId: string
  condominiumName: string
  address: string
  lat: number | null
  lng: number | null
  stops: Array<{
    orderId: string
    apartment: string
    block: string | null
    clientName: string
    quantity: number
    status: string
    sortKey: number   // número extraído do apartment para ordenação numérica
  }>
}

// Ordenação por apartment: extrair número inteiro, fallback para string comparison
function apartmentSortKey(apt: string): number {
  const n = parseInt(apt.replace(/\D/g, ''), 10)
  return isNaN(n) ? 9999 : n
}
```

### Anti-Patterns a Evitar

- **Não usar L.Icon com iconUrl para os marcadores customizados:** Leaflet resolve o caminho da imagem relativo ao bundle do Vite, gerando 404 em produção. Usar `L.DivIcon` com HTML inline — é o que o handoff pede.
- **Não chamar Nominatim sem User-Agent:** Requests sem identificação são bloqueados. Sempre incluir `User-Agent: CheirimdePao-app/1.0`.
- **Não passar `courierId` no body do PATCH confirm:** Extrair sempre do `request.user.id` (JWT). Nunca confiar em dados do cliente para identificar o entregador.
- **Não usar `prisma db push` para adicionar `courierId String?`:** MongoDB com Prisma não precisa de migration para adicionar campos opcionais. `prisma generate` é suficiente. `prisma db push` também funciona mas não é necessário.
- **Não ordenar apartamentos com `sort()` string padrão:** "10" < "9" na ordenação lexicográfica. Extrair o número inteiro do apartamento para ordenação numérica.

---

## Don't Hand-Roll

| Problema | Não construir | Usar em vez | Por que |
|---------|--------------|-------------|---------|
| Renderização de mapa interativo | Mapa próprio com SVG/Canvas | react-leaflet + Leaflet | Tiles, zoom, pan, bounds, events — centenas de edge cases |
| Geocodificação de endereço | Parser de CEP/endereço próprio | Nominatim (Fase 6) | Reconhecimento de endereço BR é complexo; Nominatim cobre OpenStreetMap globalmente |
| Roteamento de waypoints | Algoritmo de rota próprio | OSRM público | Grafos de rua, curvas, sentidos únicos — problema NP-difícil |
| Desenho de polyline no mapa | Canvas overlay manual | react-leaflet `<Polyline>` | Integração nativa com tiles, projeção, zoom |
| Marcadores HTML customizados | Overlay absoluto sobre imagem de mapa | `L.DivIcon` com `html` | API oficial do Leaflet para marcadores HTML; coordenadas corretas automaticamente |
| Guard de role | Verificação manual em cada handler | `requireCourier` preHandler (igual ao padrão `requireAdmin` existente) | Centraliza, reutilizável, testável isoladamente |

**Insight:** A decisão de usar DivIcon com HTML customizado (handoff pede marcadores numerados) é simultaneamente a solução estética E a solução técnica para o problema de marker icon no Vite. Não há conflito entre design e engenharia aqui.

---

## Common Pitfalls

### Pitfall 1: CSS do Leaflet não importado — mapa sem tiles e sem controles

**O que acontece:** MapContainer renderiza com altura 0 e sem tiles. Os controles de zoom somem.
**Por que acontece:** Leaflet requer sua própria folha de estilos para posicionar tiles, controles e popups. A biblioteca não injeta CSS automaticamente.
**Como evitar:** Adicionar `import 'leaflet/dist/leaflet.css'` em `main.tsx` (antes de `globals.css`) ou no topo de `CourierMap.tsx`.
**Sinais de alerta:** Mapa renderiza como div vazia ou completamente preto sem tiles.

### Pitfall 2: Ordenação de apartamentos lexicográfica vs. numérica

**O que acontece:** Apartamento "10" aparece antes de "2" e "9".
**Por que acontece:** `Array.sort()` padrão compara strings; "1" < "2" < "9" porém "10" < "2" (primeiro caracter é "1" < "2").
**Como evitar:** Extrair número inteiro do apartment antes de ordenar: `parseInt(apt.replace(/\D/g, ''), 10)`. Fallback 9999 para apartamentos sem número.
**Sinais de alerta:** Reclamação do entregador que a ordem sugerida está "estranha" (10 antes de 2).

### Pitfall 3: courierId ausente retorna empty string no Prisma / MongoDB

**O que acontece:** `findMany({ where: { courierId: request.user.id } })` retorna zero resultados mesmo com orders atribuídas.
**Por que acontece:** Ao adicionar `courierId String?` ao schema e rodar `prisma generate`, documentos existentes têm o campo ausente (não `null` explícito no MongoDB). A query `courierId: 'id'` filtra corretamente porque o campo ausente não iguala nenhuma string — comportamento correto.
**Como evitar:** Sem ação necessária para ordens existentes. Novas ordens atribuídas via `assign-courier` gravam o campo. Verificar em teste com curl após atribuir via endpoint.

### Pitfall 4: DivIcon com `className` padrão do Leaflet

**O que acontece:** Marcador aparece com fundo branco quadrado ao redor do círculo customizado.
**Por que acontece:** Leaflet adiciona `className: 'leaflet-div-icon'` por padrão, que tem `background: white; border: 1px solid #ccc`.
**Como evitar:** Passar `className: ''` explicitamente no `L.divIcon()`.
**Sinais de alerta:** Marcadores com borda ou fundo branco visível ao redor do HTML customizado.

### Pitfall 5: Nominatim sem User-Agent — bloqueio silencioso

**O que acontece:** Requests retornam 403 ou são silenciosamente ignorados, geocodificação sempre retorna null.
**Por que acontece:** A política do Nominatim exige identificação da aplicação via User-Agent. Requests sem User-Agent são tratados como abuso.
**Como evitar:** Sempre incluir `headers: { 'User-Agent': 'CheirimdePao-app/1.0 (contato@cheirindepao.com.br)' }` em todo fetch ao Nominatim.
**Sinais de alerta:** Geocodificação retorna array vazio para endereços válidos.

### Pitfall 6: react-leaflet e React StrictMode — double mount

**O que acontece:** Em desenvolvimento com StrictMode, o mapa pode montar duas vezes, gerando dois layers de tiles sobrepostos.
**Por que acontece:** StrictMode monta e desmonta componentes duas vezes em dev para detectar side effects.
**Como evitar:** react-leaflet 5 lida corretamente com isso via hooks de lifecycle. Não há ação necessária além de garantir que a `key` do MapContainer não seja alterada desnecessariamente.
**Sinais de alerta:** Tiles duplicadas ou comportamento estranho apenas em modo dev (desaparece em build).

### Pitfall 7: OSRM falha silenciosa — não bloquear lista de paradas

**O que acontece:** O entregador não consegue ver a aba Rota, mas também perde a aba Lista.
**Por que acontece:** Erro não tratado no fetch do OSRM propaga e derruba todo o endpoint `GET /courier/orders/today`.
**Como evitar:** Isolar geocodificação e OSRM em try/catch independentes. Se falhar, retornar a lista de paradas sem dados de rota (route: null). O frontend exibe "Rota indisponível" mas a lista funciona normalmente.
**Sinais de alerta:** Endpoint 500 quando OSRM está down ou endereço não encontrado.

---

## Code Examples

### Exemplo 1: Rota Fastify com requireCourier

```typescript
// apps/api/src/modules/courier/courier.route.ts
import { FastifyPluginAsync } from 'fastify'
import { CourierController } from './courier.controller.js'

export const courierRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new CourierController(fastify)

  fastify.get(
    '/courier/orders/today',
    { preHandler: [fastify.authenticate, fastify.requireCourier] },
    ctrl.getTodayOrders.bind(ctrl),
  )

  fastify.patch(
    '/courier/orders/:id/confirm',
    { preHandler: [fastify.authenticate, fastify.requireCourier] },
    ctrl.confirmDelivery.bind(ctrl),
  )
}
```

### Exemplo 2: Endpoint assign-courier (admin-orders)

```typescript
// Adicionado ao admin-orders.route.ts
fastify.patch(
  '/admin/orders/assign-courier',
  { preHandler: [fastify.authenticate] },
  ctrl.assignCourier.bind(ctrl),
)

// admin-orders.schema.ts
export const AssignCourierSchema = z.object({
  courierId: z.string().min(1),
  orderIds: z.array(z.string().min(1)).min(1).optional(),
  condominiumId: z.string().optional(),
  date: z.string().optional(),  // ISO date string
})

// admin-orders.service.ts — assignCourier
async assignCourier(courierId: string, opts: { orderIds?: string[]; condominiumId?: string; date?: string }) {
  if (opts.orderIds?.length) {
    await this.prisma.order.updateMany({
      where: { id: { in: opts.orderIds } },
      data: { courierId },
    })
    return
  }
  // Por condomínio + data
  const { start, end } = getTodayRange(opts.date)
  const orders = await this.prisma.order.findMany({
    where: {
      scheduledDate: { gte: start, lte: end },
      status: { in: ['SCHEDULED', 'OUT_FOR_DELIVERY'] },
      // Para filtrar por condomínio, precisa join via User.condominiumId — query em duas etapas
    },
  })
  // ... (ver Pitfall sobre join — pode precisar de 2 queries no MongoDB/Prisma)
}
```

### Exemplo 3: MapContainer básico com react-leaflet

```tsx
// apps/web/src/components/courier/CourierMap.tsx
// Source: react-leaflet.js.org docs + verificado via npm

import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'  // CRÍTICO — sem isso o mapa não renderiza

interface CourierMapProps {
  waypoints: Array<{ lat: number; lng: number; name: string; order: number }>
  geometry: Array<[number, number]>  // [lat, lng] para Polyline
  distanceKm: string
  durationMin: number
}

function FitBounds({ waypoints }: { waypoints: Array<{ lat: number; lng: number }> }) {
  const map = useMap()
  React.useEffect(() => {
    if (waypoints.length > 0) {
      const bounds = L.latLngBounds(waypoints.map(w => [w.lat, w.lng]))
      map.fitBounds(bounds, { padding: [20, 20] })
    }
  }, [map, waypoints])
  return null
}

export function CourierMap({ waypoints, geometry, distanceKm, durationMin }: CourierMapProps) {
  return (
    <div style={{ borderRadius: 22, overflow: 'hidden', height: 290 }}>
      <MapContainer
        center={[waypoints[0]?.lat ?? -23.5, waypoints[0]?.lng ?? -46.6]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        aria-label="Mapa de rota do entregador"
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <Polyline
          positions={geometry.map(([lat, lng]) => [lat, lng])}
          color="#E3AC3F"
          weight={4}
          dashArray="2 9"
          lineCap="round"
        />
        {waypoints.map((wp) => (
          <Marker
            key={wp.order}
            position={[wp.lat, wp.lng]}
            icon={createNumberedMarker(wp.order)}
            title={wp.name}
          />
        ))}
        <FitBounds waypoints={waypoints} />
      </MapContainer>
    </div>
  )
}
```

### Exemplo 4: Resposta do endpoint GET /courier/orders/today

```typescript
// Formato de resposta esperado pelo frontend
{
  condos: [
    {
      condominiumId: "...",
      condominiumName: "Residencial Jardins",
      address: "Rua das Flores, 100, São Paulo, SP",
      lat: -23.5615,
      lng: -46.6561,
      stops: [
        {
          orderId: "...",
          apartment: "101",
          block: null,
          clientName: "João Silva",
          quantity: 3,
          status: "SCHEDULED"
        },
        // ... ordenado por apartment numérico ASC
      ]
    }
  ],
  totalStops: 12,
  totalBreads: 38,
  route: {
    distanceKm: "4.7",
    durationMin: 22,
    geometry: [[lat, lng], ...]  // para o Polyline
  } | null   // null se geocoding ou OSRM falharam
}
```

---

## State of the Art

| Abordagem Antiga | Abordagem Atual | Quando mudou | Impacto |
|-----------------|-----------------|--------------|---------|
| react-leaflet v3/v4 com API de classe | react-leaflet v5 com API de hooks (`useMap`, `useMapEvents`) | v4→v5 (2024) | API mais limpa; `MapContainer` não aceita mais ref diretamente — usar `useMap` hook dentro de componente filho |
| L.Icon com arquivos de imagem | L.DivIcon com HTML inline para marcadores customizados | Boa prática estabelecida com Vite (2022+) | Elimina problema de path resolution no bundler |
| `prisma migrate dev` para alterações de schema | `prisma generate` (+ `prisma db push` para inspecionar) para MongoDB | Sempre (MongoDB não suporta migrations) | Campos opcionais como `courierId String?` não precisam de migration — MongoDB é schemaless |

**Deprecated / desatualizado:**
- `react-leaflet` com MapContainer aceitando `whenCreated` prop: removido na v4. Usar `useMap` hook.
- `L.Icon.Default.mergeOptions` para corrigir marker icons no Webpack: não necessário com Vite + DivIcon.

---

## Assumptions Log

| # | Afirmação | Seção | Risco se errado |
|---|-----------|-------|-----------------|
| A1 | `prisma generate` é suficiente para adicionar `courierId String?` sem `prisma db push` em MongoDB | Don't Hand-Roll / Padrões | Baixo — se necessário, `prisma db push` também funciona sem side effects em MongoDB |
| A2 | A geometria OSRM retorna coordenadas como `[lng, lat]` (não `[lat, lng]`) | Code Examples — Padrão 3 | Médio — inverter na conversão para Leaflet se os pinos aparecerem no lugar errado |
| A3 | O `courier.service.ts` pode importar `AdminOrdersService` diretamente para reutilizar `updateOrderStatus` + `notifyAndPersist` | Architecture | Baixo — alternativa: duplicar a lógica ou extrair para serviço compartilhado |
| A4 | `getTodayRange()` do `orders.service.ts` pode ser extraído para utilitário compartilhado em `utils/date.ts` | Architecture | Baixo — se não extrair, duplicar a função no courier.service.ts (aceitável no MVP) |

**Se esta tabela estiver vazia:** todas as afirmações foram verificadas ou citadas. Esta tabela tem 4 itens de baixo risco.

---

## Open Questions

1. **Join por condominiumId via userId no courier.service**
   - O que sabemos: `Order` tem `userId`; `User` tem `condominiumId`. Para filtrar por condomínio no `GET /courier/orders/today`, precisa fazer uma query em 2 etapas (buscar userId dos clientes do condomínio, depois filtrar orders).
   - O que está incerto: Se há muitos clientes em múltiplos condomínios, o `IN` em `userId` pode crescer.
   - Recomendação: No MVP, buscar todas as ordens do entregador do dia e agrupar por `user.condominiumId` em memória. O número de entregas por rota (10–30) é pequeno o suficiente.

2. **OSRM retorna waypoints na mesma ordem do input ou reordena (TSP)?**
   - O que sabemos: `/route/v1/driving/` no OSRM público não faz TSP (Traveling Salesman Problem) — responde a rota na ordem exata dos waypoints fornecidos.
   - O que está incerto: A ordem ótima entre condomínios não é calculada automaticamente — o backend envia na ordem que quer e recebe rota nessa ordem.
   - Recomendação: Para o MVP, enviar condomínios em ordem de inserção no banco. A otimização de ordem de visita (TSP) é Fase 7.

---

## Environment Availability

| Dependência | Requerida por | Disponível | Versão | Fallback |
|------------|---------------|-----------|--------|----------|
| Node.js | API + Vite dev | ✓ | detectada no ambiente | — |
| npm | Instalação de pacotes | ✓ | presente | — |
| MongoDB Atlas | prisma.order.findMany etc. | ✓ (remoto) | Atlas | — |
| Nominatim API | Geocodificação | ✓ (pública) | operacional | Não geocodificar; retornar route: null |
| OSRM público | Rota entre condomínios | ✓ (pública) | operacional em 2026-06-15 | route: null; frontend exibe "Rota indisponível" |
| OneSignal | Push DELIVERED | ✓ (configurado desde Fase 4) | SDK v5.8.0 | Silencioso (best-effort como em admin-orders) |

**Dependências ausentes sem fallback:** nenhuma.
**Dependências com fallback:** Nominatim e OSRM — ambas falham graciosamente com `route: null` no response. A lista de paradas continua funcional.

---

## Validation Architecture

### Test Framework

| Propriedade | Valor |
|------------|-------|
| Framework | Vitest (latest) |
| Config file | `apps/api/vitest.config.ts` e `apps/web/vitest.config.ts` (existentes) |
| Comando rápido (API) | `npm run test --workspace=apps/api` |
| Comando rápido (web) | `npm run test --workspace=apps/web` |
| Suite completa | `npm run test` na raiz (Turborepo) |

### Mapa Requisito → Teste

| Req ID | Comportamento | Tipo | Comando automatizado | Arquivo existe? |
|--------|--------------|------|---------------------|-----------------|
| COUR-01 | `getTodayOrders` retorna apenas ordens com courierId do entregador logado | unit | `vitest run apps/api/src/modules/courier/__tests__/courier.service.test.ts` | ❌ Wave 0 |
| COUR-01 | Ordens sem courierId não aparecem na lista | unit | idem | ❌ Wave 0 |
| COUR-02 | `confirmDelivery` transição SCHEDULED/OUT_FOR_DELIVERY → DELIVERED | unit | idem | ❌ Wave 0 |
| COUR-02 | Order de outro entregador retorna 403 | unit | idem | ❌ Wave 0 |
| COUR-03 | Rota retorna null quando OSRM falha (graceful degradation) | unit | idem | ❌ Wave 0 |
| COUR-04 | Paradas ordenadas por apartment numérico crescente | unit | idem | ❌ Wave 0 |
| COUR-05 | Card de progresso: contagem local atualiza corretamente | manual | — | Manual only |
| COUR-02 | Dialog de confirmação: cancela sem chamar API | manual | — | Manual only (UI interaction) |

### Taxa de amostragem

- **Por commit de tarefa:** `npm run test --workspace=apps/api` (testes do módulo courier)
- **Por merge de wave:** suite completa `npm run test`
- **Phase gate:** suite completa verde antes do `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/api/src/modules/courier/__tests__/courier.service.test.ts` — cobre COUR-01, COUR-02, COUR-03, COUR-04
- [ ] `apps/api/src/modules/admin-orders/__tests__/admin-orders-assign.service.test.ts` — cobre D-11 (assign-courier)

*(Infraestrutura de testes já existente — vitest configurado desde Fase 1)*

---

## Security Domain

### Categorias ASVS Aplicáveis

| Categoria ASVS | Aplica | Controle padrão |
|---------------|--------|-----------------|
| V2 Autenticação | sim | `fastify.authenticate` (JWT via session token — padrão existente) |
| V3 Gestão de Sessão | sim | Session com expiresAt + isRevoked (padrão existente, Fase 2) |
| V4 Controle de Acesso | sim | `requireCourier` guard — entregador só acessa suas próprias ordens via courierId |
| V5 Validação de Entrada | sim | Zod schemas em `courier.schema.ts` para body/params |
| V6 Criptografia | não | Nenhuma operação criptográfica nova nesta fase |

### Padrões de Ameaça para este Stack

| Padrão | STRIDE | Mitigação padrão |
|--------|--------|-----------------|
| Entregador confirma entrega de outro entregador | Elevação de privilégio | Validar `order.courierId === request.user.id` antes de confirmar; retornar 403 se diferente |
| IDOR no PATCH /courier/orders/:id/confirm | Spoofing | Mesma mitigação acima — orderId sozinho não é suficiente, courierId do JWT é a âncora |
| Injeção via endereço malicioso no Nominatim | Tampering | `encodeURIComponent(address)` no fetch; endereço vem do banco (não do entregador diretamente) |
| Enumeração de orders via courierId ausente | Information Disclosure | `findMany({ courierId: null })` não é exposto — endpoint filtra sempre pelo courierId do JWT |

---

## Project Constraints (from CLAUDE.md)

Diretivas aplicáveis a esta fase:

| Diretiva | Impacto na Fase 6 |
|---------|------------------|
| Stack Frontend: React + Vite + Tailwind CSS + Zod | react-leaflet instalado como dependência npm padrão; sem mudança no stack base |
| Stack Backend: Node.js + Fastify + Prisma + MongoDB Atlas | Novo módulo courier segue o padrão Fastify existente |
| Banco: MongoDB Atlas remoto | `prisma generate` para gerar client; sem migration necessária para campo opcional |
| Mapas: OpenStreetMap + Leaflet + OSRM (gratuito, open source) | Exatamente o que foi pesquisado — nenhuma alternativa considerada |
| Alta fidelidade de design | UI-SPEC.md é o contrato de implementação; não simplificar componentes visuais |
| Pagamentos: Mercado Pago exclusivamente | Não aplicável a esta fase |
| Push: OneSignal | Reutilizar `notifyAndPersist` do AdminOrdersService existente |

---

## Sources

### Primárias (confiança ALTA)

- `apps/api/src/plugins/authenticate.ts` — padrão exato do `requireAdmin` para modelar `requireCourier`
- `apps/api/src/modules/admin-orders/admin-orders.service.ts` — lógica de `updateOrderStatus` + `notifyAndPersist` a ser reutilizada
- `apps/api/prisma/schema.prisma` — schema atual de Order (sem courierId) e User (condominiumId)
- `apps/web/src/routes/router.tsx` — estrutura de roteamento e ponto de inserção de `/courier` children
- `apps/web/src/components/brand/Icon.tsx` — ícones `list`, `route`, `check`, `chevD`, `pin` confirmados existentes
- `npm view react-leaflet` — versão 5.0.0, peerDeps `leaflet ^1.9.0, react ^19.0.0` [VERIFIED: npm registry]
- `npm view leaflet` — versão 1.9.4 [VERIFIED: npm registry]
- `npm view @types/leaflet` — versão 1.9.21 [VERIFIED: npm registry]
- `slopcheck install react-leaflet leaflet @types/leaflet` — todos [OK] [VERIFIED: slopcheck 0.6.1]
- OSRM API testada em 2026-06-15: `router.project-osrm.org/route/v1/driving/...` [VERIFIED: resposta ao vivo]
- Nominatim testada em 2026-06-15: `nominatim.openstreetmap.org/search` [VERIFIED: resposta ao vivo]
- Nominatim Usage Policy [CITED: operations.osmfoundation.org/policies/nominatim/]

### Secundárias (confiança MÉDIA)

- WebSearch: problema de marker icon no Vite com react-leaflet (múltiplas fontes concordantes; solução DivIcon é canônica)
- react-leaflet.js.org documentação setup (confirmou `leaflet/dist/leaflet.css` como import obrigatório)

### Terciárias (confiança BAIXA)

- Nenhuma.

---

## Metadata

**Breakdown de confiança:**

- Standard stack: ALTA — versões verificadas via npm registry + slopcheck
- Architecture: ALTA — baseada em código existente inspecionado diretamente
- Pitfalls: ALTA — pitfalls 1–4 verificados via código/docs; pitfalls 5–7 baseados em comportamento observável da API

**Data da pesquisa:** 2026-06-15
**Válido até:** 2026-07-15 (leaflet é estável; react-leaflet v5 recentemente lançada)
