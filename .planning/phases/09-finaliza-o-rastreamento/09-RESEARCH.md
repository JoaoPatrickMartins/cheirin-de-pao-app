# Phase 09: Finalização Rastreamento - Research

**Researched:** 2026-06-19
**Domain:** React Context, OneSignal push (frontend + backend), cron Node.js, auditoria de código existente
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Fase 9 **audita e completa gaps** — não reconstrói do zero. Código substancial já existe (TrackingScreen 564 linhas, NotificationsScreen 277 linhas, useOrderTracking, useNotifBadge, crons, rotas de backend). Mesma estratégia da Fase 8: verificar o que funciona end-to-end, identificar lacunas funcionais reais e criar planos apenas para o que está quebrado ou faltando.
- **D-02:** Ao verificar que os planos 05-03 e 05-04 (originalmente Fase 5) estão funcionando corretamente, **marcá-los como concluídos** no ROADMAP.md.
- **D-03:** Push de véspera (`sendEveReminders`) → adicionar `additionalData: { screen: 'pedidos' }`. Ao tocar, cliente navega para `/client/pedidos`.
- **D-04:** Push de entrega confirmada (`notifyAndPersist`, DELIVERY_DONE) → adicionar `additionalData: { screen: 'pedidos' }` no push OneSignal.
- **D-05:** `useOneSignalDeepLink` extendido para tratar `screen: 'pedidos'` → `navigate('/client/pedidos')`.
- **D-06:** Criar `NotifContext` com `unreadCount` + `refresh()`. Provisioned no `ClientLayout`.
- **D-07:** `useNotifBadge` substituído/absorvido pelo `NotifContext`.
- **D-08:** Ao montar `NotificationsScreen`, chamar `PATCH /notifications/read-all` + `refresh()` do contexto — badge zera imediatamente. **Sem botão explícito**.
- **D-09:** `sendEveReminders` passa a persistir `DELIVERY_EVE` com `actionRoute: '/client/pedidos'`.
- **D-10:** `CTA_CONFIG` recebe `DELIVERY_EVE: { label: 'Ver pedido', path: '/client/pedidos' }`.
- **D-11:** `CTA_CONFIG` recebe `OUT_FOR_DELIVERY: { label: 'Acompanhar', path: '/client/pedidos' }`.

### Claude's Discretion

- Polling do `useOrderTracking` (30s) — mantido como está.
- Estrutura interna do `NotifContext` — usar React Context nativo (padrão do AuthContext).
- `deliveredAt` no card da TrackingScreen — exibir se disponível.
- Estado vazio da NotificationsScreen — implementar conforme design handoff.

### Deferred Ideas (OUT OF SCOPE)

- Push de "Saiu para entrega" (OUT_FOR_DELIVERY) — defer → v2.
- Polling do badge em tempo real com app aberto — defer → v2 (WebSocket/SSE).
- Toggles granulares de notificações push — defer → v2.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACOMP-01 | Status da entrega do dia em 3 estados: Agendado → Saiu para entrega → Entregue | TrackingScreen (564 linhas) já implementa o stepper 3-state via `useOrderTracking` polling 30s. Auditoria confirma estrutura correta — apenas verificação e gaps pontuais. |
| ACOMP-02 | Notificação push na véspera lembrando da entrega agendada para o dia seguinte | `sendEveReminders` no cron 21h já existe e envia push + persiste DELIVERY_EVE. Gap: falta `notification.data = { screen: 'pedidos' }` e `actionRoute` na chamada `createAndTrim`. |
| ACOMP-03 | Notificação push confirmando quando a entrega foi realizada | `notifyAndPersist` em `admin-orders.service.ts` já envia push + persiste DELIVERY_DONE com `actionRoute`. Gap: falta `notification.data = { screen: 'pedidos' }` no push OneSignal. |
| ACOMP-04 | Histórico de pedidos — últimos 30 dias com data, quantidade e status | TrackingScreen já faz `GET /orders/history?days=30` e renderiza a lista com StatusPill. Auditoria confirma implementação funcional. |
| ACOMP-05 | Central de notificações com cards por tipo e indicação de itens novos | NotificationsScreen (277 linhas) já existe. Gaps: CTA_CONFIG incompleto (DELIVERY_EVE e OUT_FOR_DELIVERY ausentes; DELIVERY_DONE com label errado); badge não sincronizado via contexto compartilhado. |
</phase_requirements>

---

## Summary

A Fase 9 é uma fase de **auditoria e completude** — não greenfield. O código substancial já existe: TrackingScreen (564 linhas), NotificationsScreen (277 linhas), `useOrderTracking`, `useNotifBadge`, cron 21h (`sendEveReminders`), rotas de backend `/orders/today`, `/orders/history`, `/notifications/me`, `/notifications/read-all`, `/notifications/unread-count`. A auditoria do código revelou que a maior parte está correta e funcional.

Os gaps reais são pontuais e cirúrgicos: (1) `sendEveReminders` não adiciona `notification.data = { screen: 'pedidos' }` ao push OneSignal e não passa `actionRoute` ao `createAndTrim`; (2) `notifyAndPersist` não adiciona `notification.data = { screen: 'pedidos' }` ao push DELIVERY_DONE; (3) `useOneSignalDeepLink` não trata o caso `screen === 'pedidos'`; (4) `NotifContext` ainda não existe — `HomeScreen` usa `useNotifBadge` diretamente, e `NotificationsScreen` não chama `refresh()` após mark-all-read; (5) `CTA_CONFIG` na `NotificationsScreen` está incompleto (DELIVERY_EVE e OUT_FOR_DELIVERY ausentes; DELIVERY_DONE com label "Acompanhar" em vez de "Ver pedido").

A fase 9 resolve os requisitos ACOMP-01..05 primariamente por verificação do código existente e correção cirúrgica desses 5 gaps. A criação de `NotifContext` é o único artefato novo de complexidade real (e segue um padrão bem estabelecido — `AuthContext`).

**Primary recommendation:** Estruturar os planos em duas ondas — Wave 1: backend (additionalData nos pushes) + frontend (NotifContext + deep link); Wave 2: auditoria visual das telas + CTA_CONFIG + mark-all-read badge sync.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Push de véspera (DELIVERY_EVE) | API / Backend (cron) | — | Cron 21h no Fastify lê orders e dispara push via `@onesignal/node-onesignal` |
| Push de entrega confirmada (DELIVERY_DONE) | API / Backend | — | `notifyAndPersist` chamado pelo admin ao confirmar entrega |
| Deep link de push → navegação interna | Browser / Client (PWA) | — | `useOneSignalDeepLink` escuta eventos OneSignal no cliente |
| Badge de notificações não lidas | Frontend (estado compartilhado) | API / Backend (count endpoint) | `NotifContext` mantém `unreadCount` via `GET /notifications/unread-count`; API faz o count |
| Mark-all-read | API / Backend | Frontend (efeito colateral) | `PATCH /notifications/read-all` no backend; frontend chama `refresh()` após o PATCH |
| TrackingScreen — status em tempo real | Browser / Client (polling) | API / Backend | `useOrderTracking` polling 30s contra `GET /orders/today`; API retorna status atual |
| Histórico (últimos 30 dias) | Browser / Client | API / Backend | TrackingScreen faz `GET /orders/history?days=30` no mount |
| NotificationsScreen — cards | Browser / Client | API / Backend | `GET /notifications/me` no mount; renderização no cliente |

---

## Standard Stack

### Core (sem novas dependências — tudo já instalado)

| Library | Version atual | Purpose | Por que standard |
|---------|--------------|---------|-----------------|
| `react` + `react-router` | projeto (Vite+React) | Componentes, contextos, navegação | Stack definida e não revisitável |
| `@onesignal/node-onesignal` | `^5.8.0` (atual: 5.9.0) | Push push da API REST OneSignal no backend | Já usado em `schedules.service.ts` e `admin-orders.service.ts` |
| `react-onesignal` | `3.5.5` | SDK OneSignal no PWA (registro + events) | Já usado em `useOneSignalRegister` e `useOneSignalDeepLink` |
| `node-cron` | versão no projeto | Cron jobs no Fastify | Já registrado em `plugins/cron.ts` — 4 crons ativos |

**Nenhum novo pacote** é necessário nesta fase. [VERIFIED: leitura direta do package.json do projeto]

### Sem Alterações de Dependências

```bash
# Nada a instalar — todas as libs necessárias já estão no projeto
```

---

## Package Legitimacy Audit

> Nenhum novo pacote é instalado nesta fase. Esta seção não se aplica.

**Packages novos:** nenhum.

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PWA (Browser)                               │
│                                                                     │
│  ClientLayout                                                       │
│   ├─ <NotifProvider>  ──────────────── unreadCount, refresh()       │
│   │   ├─ HomeScreen                                                 │
│   │   │   └─ useNotif() → badge do sino                             │
│   │   └─ NotificationsScreen                                        │
│   │       ├─ GET /notifications/me                                  │
│   │       ├─ PATCH /notifications/read-all → refresh() (D-08)      │
│   │       └─ CTA → navigate(cta.path)                              │
│   ├─ useOneSignalDeepLink()                                         │
│   │   └─ screen: 'pedidos' → navigate('/client/pedidos') (D-05)    │
│   └─ TrackingScreen (/client/pedidos)                               │
│       ├─ useOrderTracking() polling 30s → GET /orders/today         │
│       └─ GET /orders/history?days=30                                │
│                                                                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS
┌──────────────────────────────▼──────────────────────────────────────┐
│                      Fastify API (Node.js)                          │
│                                                                     │
│  GET  /orders/today          → status atual do dia                  │
│  GET  /orders/history?days=  → últimos 30 dias                      │
│  GET  /notifications/me      → 30 notificações mais recentes        │
│  PATCH /notifications/read-all → marca todas como lidas             │
│  GET  /notifications/unread-count → { count: N }                    │
│                                                                     │
│  plugins/cron.ts                                                    │
│   └─ Cron 3 — 21h BRT → sendEveReminders()                         │
│       ├─ OneSignal push + notification.data (D-03)                  │
│       └─ createAndTrim DELIVERY_EVE + actionRoute (D-09)            │
│                                                                     │
│  admin-orders.service.ts                                            │
│   └─ markDelivered() → notifyAndPersist()                           │
│       ├─ OneSignal push + notification.data (D-04)                  │
│       └─ createAndTrim DELIVERY_DONE (já tem actionRoute)           │
│                                                                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
        ┌──────────────────────▼──────────────────────┐
        │         OneSignal (push externo)             │
        │  include_subscription_ids + data + contents  │
        └─────────────────────────────────────────────┘
```

### Recommended Project Structure (sem mudanças)

```
apps/web/src/
├─ contexts/
│   ├─ AuthContext.tsx            # padrão existente — MODELO para NotifContext
│   └─ NotifContext.tsx           # CRIAR (único arquivo novo nesta fase)
├─ hooks/
│   ├─ useNotifBadge.ts           # manter ou remover (substituído por NotifContext)
│   └─ useOneSignalDeepLink.ts    # EDITAR — adicionar case 'pedidos'
├─ pages/client/
│   ├─ ClientLayout.tsx           # EDITAR — provisionar <NotifProvider>
│   ├─ HomeScreen.tsx             # EDITAR — trocar useNotifBadge por useNotif()
│   ├─ NotificationsScreen.tsx    # EDITAR — CTA_CONFIG + badge sync
│   └─ TrackingScreen.tsx         # VERIFICAR — deve estar ok
apps/api/src/
├─ modules/schedules/
│   └─ schedules.service.ts       # EDITAR — additionalData + actionRoute em sendEveReminders
└─ modules/admin-orders/
    └─ admin-orders.service.ts    # EDITAR — additionalData em notifyAndPersist push
```

### Pattern 1: NotifContext — seguir exatamente o AuthContext

**O que é:** React Context nativo com `unreadCount` + `refresh()`, provisioned no `ClientLayout`.

**Quando usar:** Compartilhar estado de badge de notificações entre `HomeScreen` (exibe badge) e `NotificationsScreen` (zera badge após mark-all-read).

**Diferença do AuthContext:** `AuthContext` usa `Outlet` como children (é layout). `NotifContext` é um provider simples que recebe `children: React.ReactNode` — pois será inserido dentro do `ClientLayout` (que já é o layout).

```typescript
// Source: apps/web/src/contexts/AuthContext.tsx (padrão a seguir)
// apps/web/src/contexts/NotifContext.tsx

import React, { createContext, useState, useEffect, useCallback, useContext } from 'react'
import { apiFetch } from '../lib/apiFetch'

interface NotifContextValue {
  unreadCount: number
  refresh: () => void
}

const NotifContext = createContext<NotifContextValue>({
  unreadCount: 0,
  refresh: () => {},
})

export function NotifProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch('/notifications/unread-count')
      if (res.ok) {
        const data = (await res.json()) as { count: number }
        setUnreadCount(data.count)
      }
    } catch {
      // mantém estado anterior
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <NotifContext.Provider value={{ unreadCount, refresh }}>
      {children}
    </NotifContext.Provider>
  )
}

export function useNotif() {
  return useContext(NotifContext)
}
```

[VERIFIED: leitura direta de apps/web/src/contexts/AuthContext.tsx]

### Pattern 2: OneSignal `notification.data` para additionalData

**O que é:** O campo `notification.data` do SDK `@onesignal/node-onesignal` é enviado como `data` na API REST do OneSignal. O SDK do cliente (react-onesignal / JS SDK v16) expõe esse campo como `notification.additionalData` no evento de clique.

**Confirmado:** O frontend em `useOneSignalDeepLink.ts` lê `event.notification.additionalData.screen` — e o SDK React-OneSignal (3.5.5) declara `readonly additionalData?: object` no tipo `NotificationClickEvent.notification`. O backend usa `notification.data = { screen: 'pedidos' }`. [VERIFIED: leitura do arquivo `node_modules/react-onesignal/dist/index.d.ts`]

```typescript
// Backend — schedules.service.ts (sendEveReminders)
const notification = new OneSignal.Notification()
notification.app_id = process.env.ONESIGNAL_APP_ID!
notification.include_subscription_ids = [user.oneSignalPlayerId]
notification.headings = { pt: 'Entrega amanhã 🍞' }
notification.contents = { pt: `Lembrete: ${order.quantity} pães agendados para amanhã.` }
notification.data = { screen: 'pedidos' }   // <--- GAP A PREENCHER (D-03)
await osClient.createNotification(notification)
```

```typescript
// Backend — admin-orders.service.ts (notifyAndPersist)
notification.headings = { pt: 'Entrega realizada! 🎉' }
notification.contents = { pt: `Seus ${order.quantity} pães foram entregues. Bom apetite!` }
notification.data = { screen: 'pedidos' }   // <--- GAP A PREENCHER (D-04)
```

```typescript
// Frontend — useOneSignalDeepLink.ts (extensão D-05)
const screen = event?.notification?.additionalData?.screen
if (screen === 'creditos') {
  navigate('/client/creditos')
} else if (screen === 'pedidos') {
  navigate('/client/pedidos')   // <--- case novo a adicionar
}
```

[VERIFIED: leitura direta dos arquivos do projeto]

### Pattern 3: Mark-all-read + badge sync

```typescript
// NotificationsScreen — useEffect de montagem
const { refresh } = useNotif()

useEffect(() => {
  const load = async () => {
    // 1. Carregar notificações
    const res = await apiFetch('/notifications/me')
    if (res.ok) setNotifications(await res.json())
    setIsLoading(false)

    // 2. Mark-all-read (já existe na linha 75 — adicionar refresh())
    apiFetch('/notifications/read-all', { method: 'PATCH' })
      .then(() => {
        setIsRead(true)
        refresh()  // <--- zera badge no HomeScreen (D-08)
      })
      .catch(() => {})
  }
  void load()
}, [refresh])
```

[VERIFIED: leitura direta de apps/web/src/pages/client/NotificationsScreen.tsx]

### Anti-Patterns a Evitar

- **Criar novo listener OneSignal no ClientLayout em vez de estender o existente:** `useOneSignalDeepLink` já registra um listener no `ClientLayout`. Adicionar outro listener para o mesmo evento cria duplicação. Adicionar o case `'pedidos'` dentro do `handleClick` existente.
- **Provisionar `NotifProvider` fora do `ClientLayout`:** O provider deve estar dentro de `ClientLayout` para que só carregue quando o usuário está autenticado (o endpoint `/notifications/unread-count` requer JWT).
- **Chamar `refresh()` como dependência no `useEffect` sem useCallback:** `refresh` em `NotifContext` deve ser `useCallback` para não causar loop infinito no `NotificationsScreen` (que depende de `refresh` no array de deps do useEffect).

---

## Don't Hand-Roll

| Problema | Não Construir | Usar Em Vez | Por Que |
|---------|--------------|-------------|---------|
| Badge de não lidas compartilhado entre telas | Estado local em cada componente + prop drilling | `NotifContext` com `refresh()` | Sem contexto, HomeScreen e NotificationsScreen ficam dessincronizados — badge não zera ao abrir notificações |
| Polling de status de entrega | Implementação custom com setInterval manual | `useOrderTracking` existente — **não alterar** | Já implementa cleanup correto no unmount, trata 404, para quando DELIVERED |
| Propagação de deep link de push | Novo listener OneSignal em cada componente | `useOneSignalDeepLink` no `ClientLayout` (singleton) | Múltiplos listeners no mesmo evento causar navegação duplicada |
| Trim de notificações no banco | Lógica custom no controller | `createAndTrim` existente (limita a 30 por usuário) | Já implementado em `notifications.service.ts` — reutilizar |

---

## Runtime State Inventory

> Esta fase não é de rename/refactor/migração. Não há estado de runtime com strings renomeadas.

| Categoria | Itens | Ação |
|-----------|-------|------|
| Dados armazenados | Notificações no MongoDB com `actionRoute: null` para DELIVERY_EVE (criadas antes desta fase) | Nenhuma migração necessária — notificações sem actionRoute simplesmente não exibem CTA (CTA_CONFIG só mostra botão se `cta` existe) |
| Configuração de serviço live | Cron jobs em `plugins/cron.ts` — já registrados e rodando | Nenhuma ação — código editado; próximo deploy aplica mudança |
| Estado registrado no OS | Nenhum | — |
| Secrets/env vars | `ONESIGNAL_REST_API_KEY`, `ONESIGNAL_APP_ID` — já configurados nas fases anteriores | Nenhuma ação |
| Build artifacts | `.js` compilados (Turborepo) | Rebuilds automáticos via `turbo dev` / `turbo build` |

**Nada encontrado que bloqueia ou requer migração de dados.** [VERIFIED: leitura do código do projeto]

---

## Common Pitfalls

### Pitfall 1: `refresh` como dependência instável no useEffect

**O que acontece:** Se `refresh` em `NotifContext` não for `useCallback`, uma nova referência é criada a cada render. `NotificationsScreen` depende de `refresh` no array de deps do seu `useEffect` de montagem — loop infinito de re-renders.

**Por que acontece:** `useEffect` com `[refresh]` como deps re-executa toda vez que a referência de `refresh` muda.

**Como evitar:** Declarar `refresh` com `useCallback` e deps `[]` — `useNotifBadge.ts` já faz isso corretamente; `NotifContext` deve seguir o mesmo padrão.

**Sinal de alerta:** Console mostrando chamadas repetidas a `/notifications/me` e `/notifications/read-all` em loop.

### Pitfall 2: `navigate(-1)` sem histórico de navegação

**O que acontece:** Quando `TrackingScreen` é acessada via tab bar (aba "Pedidos"), o histórico do react-router pode estar vazio. `navigate(-1)` não volta a nenhum lugar ou volta para fora do app.

**Por que acontece:** React Router `navigate(-1)` depende do histórico de navegação do browser/SPA. Tab bar direta não cria histórico.

**Como evitar:** O UI-SPEC já documenta isso como gap a verificar. A solução padrão é checar `window.history.length > 1` antes de `navigate(-1)`, com fallback para `navigate('/client/home')`. [ASSUMED — o comportamento exato depende de teste manual com a tab bar]

**Sinal de alerta:** Botão "Voltar" na TrackingScreen não funcionando quando acessada via aba "Pedidos".

### Pitfall 3: `ClientLayout` expõe `Outlet` — NotifProvider deve envolver o Outlet, não substituí-lo

**O que acontece:** `AuthContext` usa `return <AuthContext.Provider><Outlet /></AuthContext.Provider>` porque é o próprio layout. `ClientLayout` retorna `<div>...<Outlet />...</div>`. `NotifProvider` deve ser inserido *dentro* do retorno do `ClientLayout`, envolvendo o `<Outlet />` (ou todo o conteúdo).

**Por que acontece:** Confusão com o padrão do `AuthContext` que é layout-como-provider.

**Como evitar:** Em `ClientLayout`, adicionar `<NotifProvider>` envolvendo `<Outlet />` (e opcionalmente `<ClientTabBar />`):
```tsx
return (
  <div style={...}>
    <NotifProvider>
      <Outlet />
      <ClientTabBar />
    </NotifProvider>
  </div>
)
```

### Pitfall 4: Método HTTP errado em `/notifications/read-all`

**O que acontece:** O `NotificationsScreen` atual (linha 75) chama `PATCH /notifications/read-all`. O endpoint em `notifications.route.ts` está registrado como `fastify.patch('/notifications/read-all', ...)`. **Isso está correto e consistente.** [VERIFIED: leitura direta de ambos os arquivos]

**Por que é mencionado:** O UI-SPEC 09 pergunta "verificar método (está `'PATCH'` — endpoint aceita PATCH ou PUT?)". A resposta é: sim, aceita PATCH — o código já está alinhado.

**Sinal de alerta:** Se a auditoria revelar `405 Method Not Allowed` nos logs, significa discrepância.

### Pitfall 5: `additionalData` vs `data` — mapeamento backend → frontend OneSignal

**O que acontece:** No backend, o SDK `@onesignal/node-onesignal` usa `notification.data = { screen: 'pedidos' }` (campo `data`). No frontend, o SDK OneSignal JS expõe esse mesmo campo como `notification.additionalData` no evento de clique.

**Por que acontece:** Nomenclatura diferente entre a API REST do OneSignal e o SDK do browser.

**Como evitar:** Sempre usar `notification.data = { ... }` no backend e `event.notification.additionalData?.screen` no frontend. O padrão já está correto em `useOneSignalDeepLink.ts` e o `screen: 'creditos'` em `sendLowCreditNotifications` usa `notification.url` (sem additionalData) — mas `sendEveReminders` precisa adicionar `notification.data`. [VERIFIED: leitura de `node_modules/react-onesignal/dist/index.d.ts` e `@onesignal/node-onesignal/dist/models/Notification.d.ts`]

---

## Code Examples

### Gap 1: `sendEveReminders` — adicionar `notification.data` e `actionRoute`

```typescript
// apps/api/src/modules/schedules/schedules.service.ts
// Dentro de sendEveReminders(), bloco de push (linhas 196-201):

const notification = new OneSignal.Notification()
notification.app_id = process.env.ONESIGNAL_APP_ID!
notification.include_subscription_ids = [user.oneSignalPlayerId]
notification.headings = { pt: 'Entrega amanhã 🍞' }
notification.contents = { pt: `Lembrete: ${order.quantity} pães agendados para amanhã.` }
notification.data = { screen: 'pedidos' }  // D-03 — ADICIONAR
await osClient.createNotification(notification)

// Chamada createAndTrim (linha 211-216) — ADICIONAR actionRoute:
await this.notificationsService.createAndTrim({
  userId: order.userId,
  type: 'DELIVERY_EVE',
  title: 'Entrega amanhã 🍞',
  body: `Lembrete: ${order.quantity} pães agendados para amanhã.`,
  actionRoute: '/client/pedidos',  // D-09 — ADICIONAR
})
```

### Gap 2: `notifyAndPersist` — adicionar `notification.data`

```typescript
// apps/api/src/modules/admin-orders/admin-orders.service.ts
// Dentro de notifyAndPersist(), bloco do push (linhas 93-101):

const notification = new OneSignal.Notification()
notification.app_id = process.env.ONESIGNAL_APP_ID!
notification.include_subscription_ids = [user.oneSignalPlayerId]
notification.headings = { pt: 'Entrega realizada! 🎉' }
notification.contents = {
  pt: `Seus ${order.quantity} pães foram entregues. Bom apetite!`,
}
notification.data = { screen: 'pedidos' }  // D-04 — ADICIONAR
await osClient.createNotification(notification)
// Nota: createAndTrim DELIVERY_DONE já tem actionRoute: '/client/pedidos' — não alterar
```

### Gap 3: `useOneSignalDeepLink` — case `'pedidos'`

```typescript
// apps/web/src/hooks/useOneSignalDeepLink.ts
// Dentro de handleClick (linha 32):

const screen = event?.notification?.additionalData?.screen
if (screen === 'creditos') {
  navigate('/client/creditos')
} else if (screen === 'pedidos') {
  navigate('/client/pedidos')   // D-05 — ADICIONAR
}
```

### Gap 4: `ClientLayout` — provisionar NotifProvider

```typescript
// apps/web/src/pages/client/ClientLayout.tsx
import { NotifProvider } from '../../contexts/NotifContext'  // IMPORT NOVO

export function ClientLayout() {
  const { user, isLoading } = useAuth()
  useOneSignalRegister()
  useOneSignalDeepLink()

  if (isLoading) return <LoadingScreen />
  if (!user || user.role !== 'CLIENT') return <Navigate to="/" replace />

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-app-bg)', paddingBottom: '...' }}>
      <NotifProvider>          {/* D-06 — ADICIONAR */}
        <Outlet />
        <ClientTabBar />
      </NotifProvider>          {/* D-06 */}
    </div>
  )
}
```

### Gap 5: `HomeScreen` — substituir `useNotifBadge` por `useNotif`

```typescript
// apps/web/src/pages/client/HomeScreen.tsx

// REMOVER:
import { useNotifBadge } from '../../hooks/useNotifBadge'
const { unreadCount } = useNotifBadge()

// ADICIONAR:
import { useNotif } from '../../contexts/NotifContext'
const { unreadCount } = useNotif()
```

### Gap 6: `NotificationsScreen` — CTA_CONFIG + badge sync

```typescript
// apps/web/src/pages/client/NotificationsScreen.tsx

const CTA_CONFIG: Record<string, { label: string; path: string }> = {
  LOW_CREDIT:       { label: 'Comprar créditos', path: '/client/creditos' },
  DELIVERY_DONE:    { label: 'Ver pedido',        path: '/client/pedidos' },  // label corrigido (D-10)
  DELIVERY_EVE:     { label: 'Ver pedido',        path: '/client/pedidos' },  // NOVO (D-10)
  OUT_FOR_DELIVERY: { label: 'Acompanhar',        path: '/client/pedidos' },  // NOVO (D-11)
  RECONFIGURE:      { label: 'Ajustar agenda',    path: '/client/agenda'  },
}

// No componente:
import { useNotif } from '../../contexts/NotifContext'
const { refresh } = useNotif()

// No useEffect — adicionar refresh() após PATCH:
apiFetch('/notifications/read-all', { method: 'PATCH' })
  .then(() => {
    setIsRead(true)
    refresh()  // D-08 — ADICIONAR
  })
  .catch(() => {})
```

---

## State of the Art

| Abordagem Antiga | Abordagem Atual | Quando Mudou | Impacto |
|-----------------|-----------------|--------------|---------|
| `useNotifBadge` local em cada componente | `NotifContext` compartilhado no layout | Fase 9 (agora) | Badge sincronizado entre telas sem prop drilling |
| Push sem deep link (só `notification.url`) | Push com `notification.data = { screen: 'pedidos' }` | Fase 9 (agora) | Clique no push navega diretamente para `/client/pedidos` |
| CTA_CONFIG incompleto (3 entradas) | CTA_CONFIG completo (5 entradas) | Fase 9 (agora) | Notificações DELIVERY_EVE e OUT_FOR_DELIVERY exibem CTA correto |

**Deprecated/outdated nesta fase:**
- `useNotifBadge` como hook autônomo — substituído por `NotifContext`. O arquivo pode ser mantido como wrapper ou removido.

---

## Assumptions Log

| # | Claim | Section | Risk se Errado |
|---|-------|---------|----------------|
| A1 | `navigate(-1)` na TrackingScreen pode não funcionar quando acessada via tab bar (sem histórico) — implementação de fallback a critério do executor | Pitfall 2 | Botão "Voltar" não funciona: UX degradada, mas não bloqueante |

**Todas as demais afirmações foram verificadas via leitura direta do código do projeto.**

---

## Open Questions

1. **Push title do `sendEveReminders`**
   - O que sabemos: O copywriting contract da UI-SPEC define título "Entrega amanhã 🍞". O código atual usa `headings: { pt: 'Cheirin de Pão' }` como título e coloca o conteúdo em `contents`.
   - O que não está claro: O planner deve atualizar o `headings` para "Entrega amanhã 🍞"? Ou apenas adicionar `notification.data`?
   - Recomendação: Atualizar `headings` e `contents` para alinhar com o copywriting contract — o custo é mínimo e a consistência com o UI-SPEC é importante.

2. **`useNotifBadge` — manter ou remover**
   - O que sabemos: O hook será substituído por `useNotif()` do `NotifContext`. Manter o arquivo não causa danos; remover é mais limpo.
   - Recomendação: Manter como stub/wrapper por ora (evita quebrar imports em arquivos `.js` compilados) — decisão do executor.

---

## Environment Availability

> Step 2.6: Fase de código/config — sem novas dependências externas.

| Dependência | Requerida Por | Disponível | Versão | Fallback |
|-------------|-------------|-----------|--------|----------|
| `@onesignal/node-onesignal` | sendEveReminders, notifyAndPersist | Sim | ^5.8.0 (5.9.0 instalada) | — |
| `react-onesignal` | useOneSignalDeepLink | Sim | 3.5.5 | — |
| MongoDB Atlas | todos os endpoints | Assumido disponível (mesmo dev/prod) | — | — |

**Nenhuma dependência faltando.** [VERIFIED: leitura de package.json dos workspaces]

---

## Validation Architecture

> nyquist_validation está habilitado (config.json: `workflow.nyquist_validation: true`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (versão latest) + @testing-library/react |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `cd apps/web && npm test` |
| Full suite command | `cd apps/web && npm test` |

### Phase Requirements → Test Map

| Req ID | Comportamento | Tipo de Teste | Comando Automatizado | Arquivo Existe? |
|--------|--------------|--------------|---------------------|----------------|
| ACOMP-01 | TrackingScreen renderiza 3-state stepper com status SCHEDULED/OUT_FOR_DELIVERY/DELIVERED | unit | `cd apps/web && npm test -- TrackingScreen` | ❌ Wave 0 |
| ACOMP-02 | `sendEveReminders` passa `notification.data = { screen: 'pedidos' }` ao push | unit (backend) | manual-only (cron testado em isolamento) | Manual-only |
| ACOMP-03 | `notifyAndPersist` passa `notification.data = { screen: 'pedidos' }` ao push | unit (backend) | manual-only | Manual-only |
| ACOMP-04 | TrackingScreen exibe lista de histórico com StatusPill correto | unit | `cd apps/web && npm test -- TrackingScreen` | ❌ Wave 0 |
| ACOMP-05 | NotificationsScreen exibe CTA_CONFIG correto; badge zera ao abrir | unit | `cd apps/web && npm test -- NotificationsScreen` | ❌ Wave 0 |
| ACOMP-05 | NotifContext: unreadCount reflete /notifications/unread-count; refresh() funciona | unit | `cd apps/web && npm test -- NotifContext` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd apps/web && npm test`
- **Per wave merge:** `cd apps/web && npm test`
- **Phase gate:** Suite verde antes de `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/web/src/pages/client/__tests__/TrackingScreen.test.tsx` — cobre ACOMP-01, ACOMP-04
- [ ] `apps/web/src/pages/client/__tests__/NotificationsScreen.test.tsx` — cobre ACOMP-05 (CTA_CONFIG, badge sync)
- [ ] `apps/web/src/contexts/__tests__/NotifContext.test.tsx` — cobre ACOMP-05 (context value, refresh)

---

## Security Domain

> `security_enforcement` não está explicitamente `false` no config.json — seção incluída.

### Applicable ASVS Categories

| ASVS Category | Aplica | Standard Control |
|---------------|--------|-----------------|
| V2 Authentication | não (nenhum novo endpoint de auth) | — |
| V3 Session Management | não | — |
| V4 Access Control | sim (notificações) | `preHandler: [fastify.authenticate]` já em todos os endpoints `/notifications/*` — userId extraído do JWT [VERIFIED] |
| V5 Input Validation | não (nenhum input novo nesta fase) | — |
| V6 Cryptography | não | — |

### Known Threat Patterns (stack OneSignal + React Router)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Deep link injection via `additionalData.screen` manipulado | Tampering | `useOneSignalDeepLink` apenas navega para rotas internas hardcoded (whitelist implícita) — nenhuma ação destrutiva possível. Threat model já documentado no código (T-08-09). [VERIFIED] |
| Cross-user notification access | Information Disclosure | `userId` sempre extraído do JWT no controller — nunca do body ou query params. Documentado como T-05-04 no `notifications.service.ts`. [VERIFIED] |
| Push token spoofing | Spoofing | `PUT /users/push-token` requer JWT — apenas o próprio usuário atualiza seu `oneSignalPlayerId`. [VERIFIED] |

---

## Sources

### Primary (HIGH confidence)

- Código do projeto — leitura direta de todos os arquivos listados abaixo:
  - `apps/web/src/hooks/useOrderTracking.ts`
  - `apps/web/src/hooks/useNotifBadge.ts`
  - `apps/web/src/hooks/useOneSignalDeepLink.ts`
  - `apps/web/src/pages/client/NotificationsScreen.tsx`
  - `apps/web/src/pages/client/TrackingScreen.tsx`
  - `apps/web/src/pages/client/HomeScreen.tsx`
  - `apps/web/src/pages/client/ClientLayout.tsx`
  - `apps/web/src/contexts/AuthContext.tsx`
  - `apps/web/src/routes/router.tsx`
  - `apps/api/src/modules/schedules/schedules.service.ts`
  - `apps/api/src/modules/admin-orders/admin-orders.service.ts`
  - `apps/api/src/modules/notifications/notifications.service.ts`
  - `apps/api/src/modules/notifications/notifications.route.ts`
  - `apps/api/src/modules/notifications/notifications.controller.ts`
  - `apps/api/src/plugins/cron.ts`
- `node_modules/react-onesignal/dist/index.d.ts` — type `NotificationClickEvent.notification.additionalData?: object`
- `node_modules/@onesignal/node-onesignal/dist/models/Notification.d.ts` — `'data'?: object`
- `.planning/phases/09-finaliza-o-rastreamento/09-CONTEXT.md`
- `.planning/phases/09-finaliza-o-rastreamento/09-UI-SPEC.md`

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — rastreabilidade ACOMP-01..05 → Phase 9
- `.planning/STATE.md` — decisões de projeto acumuladas

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verificado via package.json e node_modules
- Architecture: HIGH — verificado via leitura direta do código
- Gaps identificados: HIGH — verificado linha a linha nos arquivos
- Pitfalls: HIGH (exceto A1 — `navigate(-1)` = MEDIUM, depende de teste manual)

**Research date:** 2026-06-19
**Valid until:** 2026-07-19 (30 dias — stack estável, sem dependências em movimento rápido)
