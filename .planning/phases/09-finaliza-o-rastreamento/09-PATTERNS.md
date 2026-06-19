# Phase 9: Finalização Rastreamento - Pattern Map

**Mapped:** 2026-06-19
**Files analyzed:** 8 arquivos a criar/modificar
**Analogs found:** 8 / 8

---

## File Classification

| Arquivo Novo/Modificado | Role | Data Flow | Analog Mais Próximo | Qualidade |
|-------------------------|------|-----------|---------------------|-----------|
| `apps/web/src/contexts/NotifContext.tsx` | provider | request-response | `apps/web/src/contexts/AuthContext.tsx` | role-match |
| `apps/web/src/hooks/useOneSignalDeepLink.ts` | hook | event-driven | `apps/web/src/hooks/useOneSignalDeepLink.ts` (o próprio) | exact (extensão) |
| `apps/web/src/pages/client/ClientLayout.tsx` | layout | request-response | `apps/web/src/contexts/AuthContext.tsx` (AuthProvider com Outlet) | role-match |
| `apps/web/src/pages/client/HomeScreen.tsx` | component | request-response | `apps/web/src/hooks/useNotifBadge.ts` (será substituído) | exact (swap) |
| `apps/web/src/pages/client/NotificationsScreen.tsx` | component | request-response | `apps/web/src/pages/client/NotificationsScreen.tsx` (o próprio) | exact (completude) |
| `apps/web/src/pages/client/TrackingScreen.tsx` | component | request-response | `apps/web/src/pages/client/TrackingScreen.tsx` (o próprio) | exact (auditoria) |
| `apps/api/src/modules/schedules/schedules.service.ts` | service | event-driven (cron) | `apps/api/src/modules/admin-orders/admin-orders.service.ts` (notifyAndPersist) | role-match |
| `apps/api/src/modules/admin-orders/admin-orders.service.ts` | service | request-response | `apps/api/src/modules/schedules/schedules.service.ts` (sendEveReminders) | role-match |

---

## Pattern Assignments

### `apps/web/src/contexts/NotifContext.tsx` (provider, request-response) — CRIAR

**Analog:** `apps/web/src/contexts/AuthContext.tsx`

**Imports pattern** (AuthContext.tsx linhas 1-3):
```typescript
import { createContext, useState, useEffect, useMemo } from 'react'
// NotifContext usa useCallback em vez de useMemo (refresh é função estável)
import { createContext, useState, useEffect, useCallback, useContext } from 'react'
import { apiFetch } from '../lib/apiFetch'
```

**Interface e createContext pattern** (AuthContext.tsx linhas 4-20):
```typescript
// AuthContext — padrão de interface explícita + createContext com null ou valor padrão
export const AuthContext = createContext<AuthContextType | null>(null)

// NotifContext — usa valor padrão no-op (não null) para evitar null check nos consumidores
interface NotifContextValue {
  unreadCount: number
  refresh: () => void
}
const NotifContext = createContext<NotifContextValue>({
  unreadCount: 0,
  refresh: () => {},
})
```

**Provider pattern** (AuthContext.tsx linhas 22-94 — estrutura a adaptar):
```typescript
// AuthContext: função Provider sem argumento que renderiza <Outlet />
export function AuthProvider() {
  return (
    <AuthContext.Provider value={value}>
      <Outlet />
    </AuthContext.Provider>
  )
}

// NotifContext: função Provider com children prop (é inserido dentro de ClientLayout,
// não substituindo o layout inteiro)
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

**Padrão crítico — useCallback com deps []:**
Extraído de `apps/web/src/hooks/useNotifBadge.ts` linhas 7-17 (padrão já validado no projeto):
```typescript
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
}, [])   // <-- deps [] obrigatório — evita loop infinito em NotificationsScreen
```

---

### `apps/web/src/hooks/useOneSignalDeepLink.ts` (hook, event-driven) — EDITAR

**Analog:** o próprio arquivo (`apps/web/src/hooks/useOneSignalDeepLink.ts`)

**Estrutura existente completa** (linhas 1-55 — leitura integral):
```typescript
// ESTRUTURA ATUAL — alterar apenas o bloco de condicionais do handleClick

const handleClick = (event: {
  notification?: { additionalData?: { screen?: string } }
}) => {
  try {
    const screen = event?.notification?.additionalData?.screen
    if (screen === 'creditos') {
      navigate('/client/creditos')
    }
    // D-05: ADICIONAR bloco abaixo, sem remover o case 'creditos'
    // else if (screen === 'pedidos') {
    //   navigate('/client/pedidos')
    // }
  } catch {
    // Silencioso — falha no deep link não impede uso do app
  }
}
```

**Pattern de extensão — adicionar case ao bloco try existente** (linha 32):
```typescript
const screen = event?.notification?.additionalData?.screen
if (screen === 'creditos') {
  navigate('/client/creditos')
} else if (screen === 'pedidos') {
  navigate('/client/pedidos')   // D-05 — case novo
}
```

**Padrão de cleanup listener** (linhas 40-54 — manter sem alteração):
```typescript
try {
  OS?.Notifications?.addEventListener?.('click', handleClick)
} catch {
  // Silencioso
}
return () => {
  try {
    OS?.Notifications?.removeEventListener?.('click', handleClick)
  } catch {
    // Silencioso
  }
}
```

---

### `apps/web/src/pages/client/ClientLayout.tsx` (layout, request-response) — EDITAR

**Analog:** `apps/web/src/contexts/AuthContext.tsx` + arquivo próprio

**Estrutura atual completa** (linhas 1-31 — leitura integral):
```typescript
import { Outlet } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { LoadingScreen } from '../auth/LoadingScreen'
import { Navigate } from 'react-router'
import { ClientTabBar } from '../../components/client/ClientTabBar'
import { useOneSignalRegister } from '../../hooks/useOneSignalRegister'
import { useOneSignalDeepLink } from '../../hooks/useOneSignalDeepLink'

export function ClientLayout() {
  const { user, isLoading } = useAuth()
  useOneSignalRegister()
  useOneSignalDeepLink()

  if (isLoading) return <LoadingScreen />
  if (!user || user.role !== 'CLIENT') return <Navigate to="/" replace />

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--color-app-bg)',
        paddingBottom: 'calc(56px + env(safe-area-inset-bottom))',
      }}
    >
      <Outlet />
      <ClientTabBar />
    </div>
  )
}
```

**Pattern de inserção de NotifProvider** (D-06 — envolver Outlet + ClientTabBar):
```typescript
// ADICIONAR import
import { NotifProvider } from '../../contexts/NotifContext'

// MODIFICAR return — envolver conteúdo com NotifProvider
return (
  <div
    style={{
      minHeight: '100dvh',
      background: 'var(--color-app-bg)',
      paddingBottom: 'calc(56px + env(safe-area-inset-bottom))',
    }}
  >
    <NotifProvider>
      <Outlet />
      <ClientTabBar />
    </NotifProvider>
  </div>
)
```

**Por que NotifProvider envolve ClientTabBar também:** ClientTabBar pode futuramente exibir badge na aba — envolver ambos mantém a opção aberta sem custo.

---

### `apps/web/src/pages/client/HomeScreen.tsx` (component, request-response) — EDITAR

**Analog:** `apps/web/src/hooks/useNotifBadge.ts` (origem do hook a ser substituído)

**Import e uso atual** (HomeScreen.tsx linhas 7 e 52):
```typescript
// REMOVER:
import { useNotifBadge } from '../../hooks/useNotifBadge'
// ...
const { unreadCount } = useNotifBadge()
```

**Substituição por NotifContext** (D-07):
```typescript
// ADICIONAR:
import { useNotif } from '../../contexts/NotifContext'
// ...
const { unreadCount } = useNotif()
```

**Badge visual existente** (HomeScreen.tsx linhas 171-201 — sem alteração visual):
```typescript
// Padrão do badge: dot 7×7 bg gold, position absolute top 9 right 9
{unreadCount > 0 && (
  <div
    style={{
      position: 'absolute',
      top: 9,
      right: 9,
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: 'var(--color-gold)',
    }}
  />
)}
```

---

### `apps/web/src/pages/client/NotificationsScreen.tsx` (component, request-response) — EDITAR

**Analog:** o próprio arquivo (277 linhas — leitura integral disponível)

**CTA_CONFIG atual** (linhas 38-42 — SUBSTITUIR):
```typescript
// ATUAL (incompleto):
const CTA_CONFIG: Record<string, { label: string; path: string }> = {
  LOW_CREDIT: { label: 'Comprar créditos', path: '/client/creditos' },
  DELIVERY_DONE: { label: 'Acompanhar', path: '/client/pedidos' },    // label errado
  RECONFIGURE: { label: 'Ajustar agenda', path: '/client/agenda' },
}

// CORRETO (D-10, D-11 — 5 entradas):
const CTA_CONFIG: Record<string, { label: string; path: string }> = {
  LOW_CREDIT:       { label: 'Comprar créditos', path: '/client/creditos' },
  DELIVERY_DONE:    { label: 'Ver pedido',        path: '/client/pedidos' },  // label corrigido
  DELIVERY_EVE:     { label: 'Ver pedido',        path: '/client/pedidos' },  // NOVO D-10
  OUT_FOR_DELIVERY: { label: 'Acompanhar',        path: '/client/pedidos' },  // NOVO D-11
  RECONFIGURE:      { label: 'Ajustar agenda',    path: '/client/agenda'  },
}
```

**useEffect de montagem — badge sync** (linhas 62-80 — adicionar refresh()):
```typescript
// ATUAL (linha 75 — sem refresh):
apiFetch('/notifications/read-all', { method: 'PATCH' })
  .then(() => setIsRead(true))
  .catch(() => {})

// CORRETO (D-08 — adicionar refresh() após setIsRead):
const { refresh } = useNotif()  // adicionar ao topo do componente

// no useEffect:
apiFetch('/notifications/read-all', { method: 'PATCH' })
  .then(() => {
    setIsRead(true)
    refresh()  // zera badge na HomeScreen
  })
  .catch(() => {})
```

**Assinatura do useEffect com refresh como dep** (seguindo pitfall 1 do RESEARCH.md):
```typescript
// refresh vem de useCallback com deps [] — referência estável
// safe incluir no array de deps sem loop
useEffect(() => {
  const load = async () => { ... }
  void load()
}, [refresh])  // refresh é estável graças ao useCallback
```

**Pattern de card existente** (linhas 177-270 — não alterar estrutura):
```typescript
// Padrão de card: border lida vs não lida, ícone 42×42, CTA com navigate(cta.path)
const read = isRead || n.isRead
border: read
  ? '1px solid var(--color-border-2)'
  : '1.5px solid var(--color-accent)',
```

---

### `apps/web/src/pages/client/TrackingScreen.tsx` (component, request-response) — VERIFICAR

**Analog:** o próprio arquivo (564 linhas — auditoria, sem mudanças estruturais previstas)

**Padrão de navegação back a verificar** (pitfall 2 do RESEARCH.md):
```typescript
// Padrão atual (verificar se funciona via tab bar):
onClick={() => navigate(-1)}

// Fallback sugerido se navigate(-1) falhar (window.history.length <= 1):
onClick={() => {
  if (window.history.length > 1) {
    navigate(-1)
  } else {
    navigate('/client/home')
  }
}}
```

**Polling pattern** (useOrderTracking — não alterar intervalo):
```typescript
// useOrderTracking já implementa polling 30s, cleanup e pausa em DELIVERED
// Verificar apenas que TrackingScreen consome corretamente:
const { order } = useOrderTracking()
```

---

### `apps/api/src/modules/schedules/schedules.service.ts` (service, event-driven) — EDITAR

**Analog:** `apps/api/src/modules/admin-orders/admin-orders.service.ts` (notifyAndPersist)

**Bloco de push existente em sendEveReminders** (linhas 196-208 — adicionar notification.data):
```typescript
// ATUAL (sem notification.data):
const notification = new OneSignal.Notification()
notification.app_id = process.env.ONESIGNAL_APP_ID!
notification.include_subscription_ids = [user.oneSignalPlayerId]
notification.headings = { pt: 'Cheirin de Pão' }
notification.contents = { pt: `Lembrete: ${order.quantity} pães agendados para amanhã.` }
await osClient.createNotification(notification)

// CORRETO (D-03 — adicionar notification.data, D-copywriting — atualizar headings):
notification.headings = { pt: 'Entrega amanhã 🍞' }  // alinhado ao UI-SPEC copywriting
notification.contents = { pt: `Lembrete: ${order.quantity} pães agendados para amanhã.` }
notification.data = { screen: 'pedidos' }   // D-03 — campo 'data' no SDK backend
await osClient.createNotification(notification)
```

**Bloco de createAndTrim** (linhas 211-216 — adicionar actionRoute):
```typescript
// ATUAL (sem actionRoute):
await this.notificationsService.createAndTrim({
  userId: order.userId,
  type: 'DELIVERY_EVE',
  title: 'Entrega amanhã',
  body: `Lembrete: ${order.quantity} pães agendados para amanhã.`,
})

// CORRETO (D-09 — adicionar actionRoute + atualizar title):
await this.notificationsService.createAndTrim({
  userId: order.userId,
  type: 'DELIVERY_EVE',
  title: 'Entrega amanhã 🍞',         // alinhado ao copywriting contract
  body: `Lembrete: ${order.quantity} pães agendados para amanhã.`,
  actionRoute: '/client/pedidos',       // D-09
})
```

**Padrão de error isolation no cron** (linhas 193-208 — manter):
```typescript
// Push dentro de try/catch — erro de push não quebra o cron
if (user?.oneSignalPlayerId) {
  try {
    // ... push
  } catch (pushErr) {
    this.fastify.log.warn({ ... }, '[schedules] falha ao enviar push de véspera — silencioso')
  }
}
// createAndTrim fora do try — persist garantido
await this.notificationsService.createAndTrim({ ... })
```

---

### `apps/api/src/modules/admin-orders/admin-orders.service.ts` (service, request-response) — EDITAR

**Analog:** `apps/api/src/modules/schedules/schedules.service.ts` (sendEveReminders — padrão idêntico)

**Bloco de push em notifyAndPersist** (linhas 93-101 — adicionar notification.data):
```typescript
// ATUAL (sem notification.data):
const notification = new OneSignal.Notification()
notification.app_id = process.env.ONESIGNAL_APP_ID!
notification.include_subscription_ids = [user.oneSignalPlayerId]
notification.headings = { pt: 'Cheirin de Pão' }
notification.contents = {
  pt: `Seus ${order.quantity} pães foram entregues. Bom apetite!`,
}
await osClient.createNotification(notification)

// CORRETO (D-04 — adicionar notification.data, D-copywriting — atualizar headings):
notification.headings = { pt: 'Entrega realizada! 🎉' }  // alinhado ao UI-SPEC copywriting
notification.contents = {
  pt: `Seus ${order.quantity} pães foram entregues. Bom apetite!`,
}
notification.data = { screen: 'pedidos' }   // D-04 — campo 'data' no SDK backend
await osClient.createNotification(notification)
```

**Nota:** createAndTrim de DELIVERY_DONE (linhas 111-117) já tem `actionRoute: '/client/pedidos'` — não alterar.

**Padrão de isolamento push/persist** (linhas 90-117 — referência para sendEveReminders):
```typescript
// 1. Push best-effort (dentro de try)
if (user?.oneSignalPlayerId) {
  try {
    // ... push
  } catch (pushErr) {
    this.fastify.log.warn({ orderId: order.id, userId: order.userId, err: pushErr }, '...')
  }
}
// 2. Persist obrigatório (fora do try)
await this.createAndTrim({ ... })
```

---

## Shared Patterns

### React Context — Provider com children

**Fonte:** `apps/web/src/contexts/AuthContext.tsx`
**Aplica a:** `NotifContext.tsx`

Diferença chave: `AuthContext.AuthProvider` não recebe `children` — renderiza `<Outlet />` diretamente porque é o layout de rota. `NotifContext.NotifProvider` recebe `{ children: React.ReactNode }` porque é inserido dentro de um layout existente (`ClientLayout`).

```typescript
// AuthProvider (AuthContext.tsx linha 22) — pattern de layout-como-provider
export function AuthProvider() {
  return <AuthContext.Provider value={value}><Outlet /></AuthContext.Provider>
}

// NotifProvider (NotifContext.tsx) — pattern de provider-dentro-de-layout
export function NotifProvider({ children }: { children: React.ReactNode }) {
  return <NotifContext.Provider value={{ unreadCount, refresh }}>{children}</NotifContext.Provider>
}
```

### apiFetch — Fetch com JWT automático

**Fonte:** `apps/web/src/lib/apiFetch.ts` (usado em useNotifBadge.ts linha 9, NotificationsScreen.tsx linhas 65-75)
**Aplica a:** `NotifContext.tsx`

```typescript
// Padrão de uso — import e chamada:
import { apiFetch } from '../lib/apiFetch'
const res = await apiFetch('/notifications/unread-count')
if (res.ok) {
  const data = (await res.json()) as { count: number }
}
```

### OneSignal push best-effort + persist garantido

**Fonte:** `apps/api/src/modules/admin-orders/admin-orders.service.ts` linhas 90-117
**Aplica a:** `schedules.service.ts` (sendEveReminders) e `admin-orders.service.ts` (notifyAndPersist)

```typescript
// 1. Push within try/catch — falha de push é silenciosa
if (user?.oneSignalPlayerId) {
  try {
    const notification = new OneSignal.Notification()
    notification.data = { screen: 'pedidos' }  // D-03 / D-04
    await osClient.createNotification(notification)
  } catch (pushErr) {
    this.fastify.log.warn({ ... }, 'falha ao enviar push — ignorado')
  }
}
// 2. createAndTrim fora do try — persist obrigatório
await this.notificationsService.createAndTrim({ ... })
```

### notification.data (backend) ↔ additionalData (frontend)

**Fonte:** `apps/web/src/hooks/useOneSignalDeepLink.ts` + `apps/api/src/modules/schedules/schedules.service.ts`
**Aplica a:** ambos os arquivos de backend (schedules.service.ts e admin-orders.service.ts)

```typescript
// Backend — SDK @onesignal/node-onesignal: campo 'data'
notification.data = { screen: 'pedidos' }

// Frontend — SDK react-onesignal: campo 'additionalData' no evento de clique
const screen = event?.notification?.additionalData?.screen
```

### Fastify authenticate preHandler

**Fonte:** `apps/api/src/modules/notifications/notifications.route.ts` linhas 15, 47, 76, 100
**Aplica a:** nenhum endpoint novo nesta fase — todos os endpoints existentes já têm o preHandler correto

```typescript
fastify.get('/notifications/me', {
  preHandler: [fastify.authenticate],
  // ...
}, ctrl.getNotifications.bind(ctrl))
```

---

## No Analog Found

Nenhum arquivo desta fase ficou sem analog. Todos têm precedente direto no codebase.

---

## Metadata

**Escopo de busca de analogs:** `apps/web/src/contexts/`, `apps/web/src/hooks/`, `apps/web/src/pages/client/`, `apps/api/src/modules/`
**Arquivos lidos para extração:** 9 arquivos (AuthContext.tsx, useNotifBadge.ts, useOneSignalDeepLink.ts, NotificationsScreen.tsx, ClientLayout.tsx, HomeScreen.tsx, schedules.service.ts, admin-orders.service.ts, notifications.service.ts, notifications.route.ts)
**Data de mapeamento:** 2026-06-19
