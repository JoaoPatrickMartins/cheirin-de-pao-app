# Phase 5: Delivery Experience - Research

**Researched:** 2026-06-15
**Domain:** Rastreamento de pedidos em tempo real, notificações push OneSignal, histórico de entregas, central de notificações in-app
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Status em Tempo Real (ACOMP-01)**
- D-01: Transição `SCHEDULED → OUT_FOR_DELIVERY` acionada manualmente pelo Admin (Fase 5). A Fase 6 substituirá por confirmação do entregador.
- D-02: Schema Prisma precisa do novo valor `OUT_FOR_DELIVERY` no enum `OrderStatus` (atualmente só `SCHEDULED` e `DELIVERED`).
- D-03: Cliente vê o status atualizado via polling automático a cada 30s — `useEffect` + `setInterval` chamando `GET /orders/today`. Mesmo padrão do `PixWaitingScreen` (Fase 3). Sem WebSocket nem SSE no MVP.

**Notificações Push (ACOMP-02, ACOMP-03)**
- D-04: Notificação de véspera (lembrete): cron `0 21 * * *` em `America/Sao_Paulo`. Horário 21h hardcoded na Fase 5 — configurável pelo Admin na Fase 7.
- D-05: Notificação de confirmação de entrega: disparada no momento em que o Admin muda o status para `DELIVERED` (endpoint `PATCH /orders/:id/status`).
- D-06: Clientes sem `oneSignalPlayerId` registrado são silenciosamente ignorados pelo cron — sem erro, sem retry. Notificação é best-effort.

**Histórico e Tela de Acompanhamento (ACOMP-04)**
- D-07: Status do dia atual e histórico ficam na mesma tela (`TrackingScreen`): card de status do pedido de hoje no topo (quando houver), lista de histórico abaixo.
- D-08: Histórico exibe apenas dias com pedido (sem dias vazios). Período: últimos 30 dias. Endpoint: `GET /orders/history?days=30`.

**Central de Notificações (ACOMP-05)**
- D-09: Central acessível via ícone de sino na HomeScreen com badge vermelho quando há itens novos. Toque abre `NotificationsScreen` dedicada.
- D-10: Limite de 30 notificações armazenadas por usuário. Todas marcadas como lidas (`isRead: true`) ao abrir a tela.

**Admin — Acionamento Manual**
- D-11: Admin precisa de endpoint `PATCH /admin/orders/:id/status` (com `preHandler: [fastify.authenticate]` + inline role check) para mudar `SCHEDULED → OUT_FOR_DELIVERY → DELIVERED`. UI Admin fica para Fase 7 — na Fase 5 pode ser testado via curl/Postman.
- D-12: PAY-03 (status de pagamento no Admin) e PAY-04 (estorno/reembolso) ficam diferidos para Fase 7.

### Claude's Discretion

Nenhuma área de discrição registrada no CONTEXT.md — todas as decisões arquiteturais relevantes estão locked.

### Deferred Ideas (OUT OF SCOPE)

- PAY-03 (status de pagamento no Admin) → Fase 7
- PAY-04 (estorno/reembolso) → Fase 7
- Horário de véspera configurável pelo Admin → Fase 7
- WebSocket/SSE para status em tempo real → pós-MVP
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACOMP-01 | Status da entrega do dia em 3 estados: Agendado → Saiu para entrega → Entregue | Enum `OrderStatus` já tem `OUT_FOR_DELIVERY` e `DELIVERED`; padrão polling via `useEffect + setInterval` confirmado em `usePaymentPolling.ts` |
| ACOMP-02 | Notificação push na véspera lembrando da entrega agendada para o dia seguinte | Padrão cron `0 21 * * *` em `America/Sao_Paulo` confirmado em `cron.ts`; SDK OneSignal `@onesignal/node-onesignal@5.8.0` já instalado |
| ACOMP-03 | Notificação push confirmando quando a entrega foi realizada | Disparo no `PATCH /admin/orders/:id/status → DELIVERED`; padrão OneSignal one-shot confirmado em `schedules.service.ts` |
| ACOMP-04 | Histórico de pedidos — últimos 30 dias com data, quantidade e status | `GET /orders/history?days=30`; query Prisma com `gte: thirtyDaysAgo, orderBy: scheduledDate desc` |
| ACOMP-05 | Central de notificações no app com cards por tipo e indicação de itens novos | Modelo `Notification` já existe no schema; `NotificationType` enum já definido (DELIVERY_EVE, DELIVERY_DONE, LOW_CREDIT, etc.) |
</phase_requirements>

---

## Summary

A Fase 5 é essencialmente uma camada de observabilidade sobre os dados de `Order` e `Notification` já modelados nas fases anteriores. O schema Prisma já contém o enum `OrderStatus` com os três valores necessários (`SCHEDULED`, `OUT_FOR_DELIVERY`, `DELIVERED`) e o modelo `Notification` com `NotificationType` cobrindo todos os tipos desta fase (`DELIVERY_EVE`, `DELIVERY_DONE`). Isso significa que não há migrations de schema, sem novos pacotes npm e sem novos modelos de banco — apenas novos endpoints, um novo cron job e novas telas.

O padrão de polling para status em tempo real é idêntico ao `usePaymentPolling` da Fase 3, adaptado para um intervalo de 30s e sem máximo de tentativas (polling enquanto a tela estiver montada). O padrão de cron jobs OneSignal é idêntico ao `cron.ts` da Fase 4 — basta adicionar um terceiro job ao arquivo existente. O padrão de armazenamento persistente de notificações requer que cada disparo OneSignal seja acompanhado de um `prisma.notification.create()` no mesmo código.

O único artefato genuinamente novo no backend é o módulo `admin-orders` (endpoint `PATCH /admin/orders/:id/status`) e os dois novos endpoints no módulo `orders` (`GET /orders/today`, `GET /orders/history`). No frontend, três novas telas: `TrackingScreen`, `NotificationsScreen` e as atualizações em `HomeScreen` (sino com badge + card de entrega de hoje funcional).

**Primary recommendation:** Adicionar o 3º cron (21h) ao `cron.ts` existente, estender o `OrdersService` com `getTodayOrder` e `getHistory`, criar o módulo `admin-orders`, e construir as telas seguindo o design handoff (`screens-client-extra.jsx` — componentes `TrackScreen` e `NotifsScreen`).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Status polling (30s) | Browser / Client | — | Estado local do componente; sem custo de SSR; padrão já estabelecido em PixWaitingScreen |
| GET /orders/today | API / Backend | Database | Lookup simples por userId + scheduledDate == hoje; requer auth JWT |
| GET /orders/history | API / Backend | Database | Query com filtro de data e paginação implícita (30 dias) |
| PATCH /admin/orders/:id/status | API / Backend | — | Transição de estado + disparo OneSignal + persist Notification; requer role ADMIN |
| Cron véspera 21h | API / Backend | — | Lógica de notificação batch; mesmo processo que cron.ts existente |
| Persistir Notification no banco | API / Backend | Database | Gravação atômica junto ao disparo OneSignal em cada trigger |
| GET /notifications/me | API / Backend | Database | Retorna últimas 30 notificações do usuário autenticado |
| PATCH /notifications/read-all | API / Backend | Database | Marca todas as notificações do usuário como isRead=true |
| TrackingScreen | Browser / Client | — | Composição de status hoje + histórico; dados via apiFetch |
| NotificationsScreen | Browser / Client | — | Lista in-app; marca lidas ao montar via PATCH |
| Bell badge (HomeScreen) | Browser / Client | — | Estado derivado de contagem de isRead=false; atualizado no load da home |

---

## Standard Stack

### Core (todos já instalados — sem novos pacotes)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@onesignal/node-onesignal` | 5.8.0 | SDK push notifications | Já instalado; padrão estabelecido em Fase 4 [VERIFIED: apps/api/package.json] |
| `node-cron` | 4.2.1 | Scheduler cron 21h véspera | Já instalado; padrão cron.ts da Fase 4 [VERIFIED: apps/api/package.json] |
| `@prisma/client` | 6.19.3 | Acesso MongoDB para Notification e Order | Já instalado; schema já tem modelos necessários [VERIFIED: apps/api/package.json] |
| `zod` | 4.4.3 | Validação de schemas de request/response | Padrão estabelecido em todas as fases [VERIFIED: apps/api/package.json] |
| `react-onesignal` | instalado no web | Registro de push no PWA | Já instalado em apps/web [VERIFIED: apps/web/package.json] |

### Instalação

Nenhuma instalação necessária. Todos os pacotes já estão presentes.

---

## Package Legitimacy Audit

> Nenhum pacote novo será instalado nesta fase. Todos os pacotes utilizados foram auditados nas fases anteriores e estão presentes no `package.json`.

| Package | Registry | Fase de Instalação | slopcheck | Disposition |
|---------|----------|-------------------|-----------|-------------|
| `@onesignal/node-onesignal` | npm | Fase 4 | N/A (já auditado) | Approved |
| `node-cron` | npm | Fase 4 | N/A (já auditado) | Approved |
| `@prisma/client` | npm | Fase 1 | N/A (já auditado) | Approved |
| `react-onesignal` | npm | Fase 4 | N/A (já auditado) | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
[Cliente PWA] ──── GET /orders/today (poll 30s) ────► [API Fastify]
                                                            │
                ◄── { status, quantity, scheduledDate } ────┤
                                                            │
[Admin curl/Postman] ─ PATCH /admin/orders/:id/status ─►  │
                         { status: OUT_FOR_DELIVERY }       │
                                                            ▼
                                              [OrdersService.updateStatus()]
                                                   │          │
                                            [prisma.$transaction]
                                                   │          │
                                          order.update()   notification.create()
                                                              │
                                                    [OneSignal SDK] ──► Push ao cliente

[Cron 0 21 * * * BRT] ──► [SchedulesService.sendEveReminders()]
       │                          │          │
   node-cron v4              Order.findMany  │
   (adicionado ao              (amanhã)      ▼
    cron.ts existente)               [OneSignal batch push]
                                     + [notification.createMany()]

[Cliente PWA] ── GET /notifications/me ──► [API]
                                               │
◄── [lista últimas 30 Notification] ──────────┘
                                               │
[Abrir NotificationsScreen] ── PATCH /notifications/read-all ──► [API]
                                                                      │
                                                               isRead=true em todas
```

### Recommended Project Structure

```
apps/api/src/
├── modules/
│   ├── orders/
│   │   ├── orders.service.ts        # ESTENDER: getTodayOrder(), getHistory()
│   │   ├── orders.repository.ts     # ESTENDER: findTodayByUserId(), findHistoryByUserId()
│   │   ├── orders.schema.ts         # ESTENDER: UpdateStatusSchema (admin)
│   │   ├── orders.controller.ts     # ESTENDER: getTodayOrder, getHistory
│   │   └── orders.route.ts          # ESTENDER: GET /today, GET /history
│   ├── admin-orders/               # NOVO módulo
│   │   ├── admin-orders.service.ts  # updateOrderStatus() + notificar
│   │   ├── admin-orders.schema.ts   # UpdateOrderStatusSchema
│   │   ├── admin-orders.controller.ts
│   │   └── admin-orders.route.ts    # PATCH /admin/orders/:id/status
│   └── notifications/
│       ├── notifications.service.ts  # ESTENDER: getByUserId(), markAllRead(), create()
│       ├── notifications.controller.ts # ESTENDER: getNotifications, readAll
│       └── notifications.route.ts   # ESTENDER: GET /notifications/me, PATCH /notifications/read-all
├── plugins/
│   └── cron.ts                     # ESTENDER: adicionar 3º cron (0 21 * * *)
apps/web/src/
├── hooks/
│   └── useOrderTracking.ts         # NOVO: polling GET /orders/today a cada 30s
├── pages/client/
│   ├── TrackingScreen.tsx           # NOVO: status hoje + histórico
│   ├── NotificationsScreen.tsx      # NOVO: central de notificações
│   └── HomeScreen.tsx              # ATUALIZAR: sino com badge + TodayDelivery card funcional
└── routes/
    └── router.tsx                  # ATUALIZAR: novas rotas client/pedidos e client/notificacoes
```

### Padrão 1: Polling de Status (useOrderTracking)

**O que é:** Hook React com `setInterval` + cleanup em `useEffect`. Intervalo 30s. Para quando o componente desmonta.
**Quando usar:** TrackingScreen e HomeScreen (card "entrega de hoje").

```typescript
// Source: apps/web/src/hooks/usePaymentPolling.ts (adaptado para 30s sem MAX_ATTEMPTS)
import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/apiFetch'

export interface TodayOrder {
  id: string
  status: 'SCHEDULED' | 'OUT_FOR_DELIVERY' | 'DELIVERED'
  quantity: number
  scheduledDate: string
}

export function useOrderTracking(): { order: TodayOrder | null; isLoading: boolean } {
  const [order, setOrder] = useState<TodayOrder | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await apiFetch('/orders/today')
        if (res.ok) {
          const data = (await res.json()) as TodayOrder | null
          setOrder(data)
        } else if (res.status === 404) {
          setOrder(null)
        }
      } catch {
        // falha de rede — mantém estado anterior
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrder() // fetch imediato na montagem
    const id = setInterval(fetchOrder, 30_000) // poll a cada 30s
    return () => clearInterval(id)             // cleanup obrigatório
  }, [])

  return { order, isLoading }
}
```

### Padrão 2: Cron de Véspera (adição ao cron.ts)

**O que é:** 3º cron job adicionado ao `cron.ts` existente. Mesmo guard `NODE_ENV !== 'test'` já aplicado ao plugin inteiro.
**Quando usar:** `0 21 * * *` America/Sao_Paulo — notificação véspera + persist Notification.

```typescript
// Source: apps/api/src/plugins/cron.ts (padrão existente — adição do 3º cron)
cron.schedule(
  '0 21 * * *',
  async () => {
    fastify.log.info('[cron] iniciando sendEveReminders')
    try {
      await schedulesService.sendEveReminders()
      fastify.log.info('[cron] sendEveReminders concluído')
    } catch (err) {
      fastify.log.error({ err }, '[cron] erro em sendEveReminders — servidor mantido ativo')
    }
  },
  { timezone: 'America/Sao_Paulo', name: 'eve-reminders' },
)
```

### Padrão 3: Disparo OneSignal + Persist Notification (operação dupla)

**O que é:** Toda vez que uma notificação push é enviada, uma `Notification` deve ser salva no banco. Os dois devem ocorrer no mesmo fluxo — push falha silenciosamente (D-06), persist é obrigatório.
**Quando usar:** Em `sendEveReminders()` (cron 21h), `updateOrderStatus()` ao setar DELIVERED, e em qualquer futuro trigger de notificação.

```typescript
// Padrão: push + persist independentes (push falha silenciosamente)
async function notifyAndPersist(
  fastify: FastifyInstance,
  userId: string,
  playerId: string | null,
  type: NotificationType,
  title: string,
  body: string,
  actionRoute?: string,
) {
  // 1. Push OneSignal (best-effort — D-06)
  if (playerId) {
    try {
      const osClient = createOsClient()
      const notification = new OneSignal.Notification()
      notification.app_id = process.env.ONESIGNAL_APP_ID!
      notification.include_subscription_ids = [playerId]
      notification.headings = { pt: title }
      notification.contents = { pt: body }
      if (actionRoute) notification.url = actionRoute
      await osClient.createNotification(notification)
    } catch (err) {
      fastify.log.warn({ userId, err }, '[notifications] falha no push — ignorado')
    }
  }

  // 2. Persist no banco (D-10: trim para 30 notificações por usuário)
  await fastify.prisma.notification.create({
    data: { userId, type, title, body, isRead: false, actionRoute },
  })
  // Trim: remover as mais antigas se ultrapassar 30
  const all = await fastify.prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  if (all.length > 30) {
    const toDelete = all.slice(30).map((n) => n.id)
    await fastify.prisma.notification.deleteMany({ where: { id: { in: toDelete } } })
  }
}
```

### Padrão 4: Admin inline role check (sem plugin requireAdmin)

**O que é:** O projeto não tem decorator `fastify.requireAdmin`. O padrão existente (visto em `auth.controller.ts`) é um check inline no controller.

```typescript
// Source: apps/api/src/modules/auth/auth.controller.ts linha 116
// Padrão estabelecido — reproduzir em admin-orders.controller.ts
if (request.user?.role !== 'ADMIN') {
  return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
}
```

### Padrão 5: GET /orders/today — lógica de "hoje"

**O que é:** Consulta por scheduledDate do dia atual no timezone America/Sao_Paulo. Utiliza o mesmo padrão de `getTomorrowUTC3` do `orders.service.ts` — calcular início e fim do dia em UTC-3.

```typescript
// Derivado de orders.service.ts existente (padrão BRAZIL_OFFSET_HOURS)
function getTodayRange(): { start: Date; end: Date } {
  const nowUTC = Date.now()
  const nowBrazil = nowUTC - 3 * 60 * 60 * 1000
  const todayBrazil = new Date(nowBrazil)
  const year = todayBrazil.getUTCFullYear()
  const month = todayBrazil.getUTCMonth()
  const day = todayBrazil.getUTCDate()
  // Início do dia BRT em UTC: meia-noite UTC-3 = 03:00 UTC
  const start = new Date(Date.UTC(year, month, day, 3, 0, 0, 0))
  // Fim do dia BRT em UTC: 23:59:59 UTC-3 = 02:59:59 UTC do dia seguinte
  const end = new Date(Date.UTC(year, month, day + 1, 2, 59, 59, 999))
  return { start, end }
}
```

### Anti-Patterns a Evitar

- **Criar model `AdminOrders` separado:** A tabela `Order` já é a fonte da verdade — apenas adicionar endpoint de admin que modifica `Order.status`.
- **Criar nova collection `Notification` no schema:** Já existe — não recriar.
- **Adicionar `OUT_FOR_DELIVERY` ao schema:** Já existe no enum `OrderStatus` — não há migration necessária.
- **Enviar push sem persistir Notification:** Viola ACOMP-05 — toda notificação push deve ter registro in-app correspondente.
- **Polling com MAX_ATTEMPTS:** `useOrderTracking` não tem limite — é infinito enquanto a tela estiver montada (diferente do `usePaymentPolling` que tem MAX=5).
- **`clearInterval` faltando no cleanup:** O padrão `usePaymentPolling` confirma que o cleanup é obrigatório para evitar memory leak.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agendamento cron | Cron job próprio com `setInterval` no processo principal | `node-cron` v4 já instalado | node-cron gerencia timezone, missed executions e naming correto |
| Push notifications | HTTP direto para OneSignal API | `@onesignal/node-onesignal` SDK já instalado | SDK gerencia autenticação, retry e serialização |
| Timezone BRT | `new Date().getHours()` (UTC) | `Intl.DateTimeFormat` com `timeZone: 'America/Sao_Paulo'` | Brasil tem horário de verão intermitente — UTC offset não é constante |
| Trim de notificações | Scheduled job para limpeza | Trim inline no `create()` (delete oldest > 30) | Simples, sem complexidade adicional para MVP |
| Admin auth guard | Novo decorator `fastify.requireAdmin` | Inline `request.user?.role !== 'ADMIN'` check | Padrão já estabelecido no projeto — consistência |

**Key insight:** Todo o stack de notificações push (OneSignal SDK, node-cron, Prisma) já está instalado e com padrões de uso estabelecidos na Fase 4. Esta fase é principalmente extensão, não construção nova.

---

## Common Pitfalls

### Pitfall 1: Timezone duplo — BRT vs UTC no banco

**O que dá errado:** `prisma.order.findMany({ where: { scheduledDate: { gte: startOfToday } } })` com `startOfToday = new Date()` retorna registros errados pois MongoDB armazena em UTC mas o "hoje" do cliente é BRT (UTC-3).
**Por que acontece:** `new Date()` retorna UTC, mas o cron de meia-noite cria orders com `scheduledDate` no timezone BRT-aware.
**Como evitar:** Usar o padrão `BRAZIL_OFFSET_HOURS = 3` já estabelecido em `orders.service.ts` — calcular início e fim do dia BRT convertido para UTC.
**Sinais de alerta:** "Nenhuma entrega hoje" mesmo quando o order existe no banco; ordens aparecendo no dia errado.

### Pitfall 2: Polling sem cleanup → memory leak

**O que dá errado:** `useEffect(() => { setInterval(...) }, [])` sem retornar `() => clearInterval(id)` continua rodando após o componente desmontar.
**Por que acontece:** React não cancela timers automaticamente — o desenvolvedor é responsável.
**Como evitar:** Sempre retornar a função de cleanup. O padrão `usePaymentPolling.ts` já demonstra isso corretamente.
**Sinais de alerta:** Console warnings "Can't perform a React state update on an unmounted component"; requisições GET /orders/today continuando após navegação.

### Pitfall 3: Push dispara mas Notification não é salvo

**O que dá errado:** O cliente recebe o push no celular mas a `NotificationsScreen` fica vazia (sem histórico in-app).
**Por que acontece:** O código OneSignal e o `prisma.notification.create()` são chamados em blocos try/catch separados — se o try do OneSignal falhar e o persist ficar dentro desse mesmo try, o persist não ocorre.
**Como evitar:** Estrutura dois blocos separados — push em try/catch próprio (falha silenciosamente), persist em operação obrigatória fora do try.

### Pitfall 4: Badge "sino" obsoleto (stale)

**O que dá errado:** O badge vermelho continua aparecendo depois que o usuário já leu todas as notificações.
**Por que acontece:** O count de não-lidas é carregado apenas na montagem da HomeScreen e não é invalidado ao voltar da NotificationsScreen.
**Como evitar:** Ao voltar da `NotificationsScreen` (ou ao chamar `PATCH /notifications/read-all`), recarregar o count de não-lidas. Opções: (a) fazer fetch do count na montagem da HomeScreen, (b) usar React context/state global mínimo para o count.

### Pitfall 5: Admin endpoint PATCH sem validação do status transition

**O que dá errado:** Admin pode mandar `status: SCHEDULED` para um order já `DELIVERED`, revertendo o estado.
**Por que acontece:** Sem validação das transições permitidas.
**Como evitar:** Validar no service que apenas transições válidas são aceitas: `SCHEDULED → OUT_FOR_DELIVERY`, `OUT_FOR_DELIVERY → DELIVERED`. Rejeitar qualquer outra com 422.

### Pitfall 6: Cron sendEveReminders inclui clientes sem order amanhã

**O que dá errado:** Cliente que não tem entrega amanhã recebe notificação de véspera incorretamente.
**Por que acontece:** Query busca todos os schedules ativos, mas não verifica se há um `Order` criado para amanhã.
**Como evitar:** Query do cron de véspera deve buscar `Order` onde `scheduledDate` = amanhã BRT e `status = SCHEDULED` (o cron de meia-noite já criou os orders). Não buscar `Schedule` diretamente.

---

## Code Examples

### GET /orders/today — endpoint completo

```typescript
// apps/api/src/modules/orders/orders.route.ts (extensão)
fastify.get(
  '/orders/today',
  { preHandler: [fastify.authenticate] },
  ctrl.getTodayOrder.bind(ctrl),
)

// orders.service.ts
async getTodayOrder(userId: string) {
  const { start, end } = getTodayRange() // helper timezone BRT
  return this.prisma.order.findFirst({
    where: {
      userId,
      scheduledDate: { gte: start, lte: end },
      status: { not: 'CANCELLED' },
    },
  })
}
```

### GET /orders/history — endpoint completo

```typescript
// orders.service.ts
async getOrderHistory(userId: string, days: number = 30) {
  const since = new Date()
  since.setDate(since.getDate() - days)
  return this.prisma.order.findMany({
    where: {
      userId,
      scheduledDate: { gte: since },
      status: { not: 'CANCELLED' },
    },
    orderBy: { scheduledDate: 'desc' },
  })
}
```

### PATCH /admin/orders/:id/status — validação de transição

```typescript
// admin-orders.service.ts
const VALID_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
}

async updateOrderStatus(orderId: string, newStatus: string) {
  const order = await this.prisma.order.findUnique({ where: { id: orderId } })
  if (!order) throw { statusCode: 404, message: 'Pedido não encontrado' }
  const allowed = VALID_TRANSITIONS[order.status] ?? []
  if (!allowed.includes(newStatus)) {
    throw { statusCode: 422, message: `Transição inválida: ${order.status} → ${newStatus}` }
  }
  await this.prisma.order.update({
    where: { id: orderId },
    data: { status: newStatus as OrderStatus },
  })
  // Notificar cliente se DELIVERED
  if (newStatus === 'DELIVERED') {
    await this.notifyDelivered(order)
  }
}
```

### NotificationsScreen — marcar lidas ao montar

```typescript
// apps/web/src/pages/client/NotificationsScreen.tsx
useEffect(() => {
  const load = async () => {
    const res = await apiFetch('/notifications/me')
    if (res.ok) setNotifications(await res.json())
    // Marcar todas como lidas ao abrir a tela (D-10)
    await apiFetch('/notifications/read-all', { method: 'PATCH' })
    setBadgeCount(0)
  }
  load()
}, []) // sem dependências — executa apenas na montagem
```

---

## State of the Art

| Old Approach | Current Approach | Impacto |
|--------------|------------------|---------|
| Schema sem OUT_FOR_DELIVERY | Schema Prisma já tem o enum completo | Nenhuma migration necessária |
| Notification model ausente | Já definido no schema com NotificationType | Nenhuma adição de model necessária |
| requireAdmin como plugin separado | Check inline `request.user?.role !== 'ADMIN'` | Consistência com padrão do projeto |

**Não há abordagens obsoletas relevantes nesta fase** — o projeto está em MVP, todos os padrões são recentes.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A query de véspera buscará `Order` com `scheduledDate` = amanhã BRT (não `Schedule`) | Common Pitfalls §6 | Clientes sem order amanhã receberiam push incorretamente |
| A2 | O badge de sino será um contador simples de `isRead=false` carregado no mount da HomeScreen | Architecture Patterns | Se o count ficar obsoleto entre navegações, UX degradada |
| A3 | `PATCH /notifications/read-all` marca TODAS as notificações do usuário como lidas (não apenas as visíveis) | Code Examples | D-10 diz "todas marcadas como lidas ao abrir a tela" — interpretado como bulk update sem filtro de data |

**Risco de A1 é o mais crítico** — o planner deve garantir que `sendEveReminders` consulte `Order.scheduledDate = amanhã` e não `Schedule.weeklyQty`.

---

## Open Questions

1. **Badge count: fetch na HomeScreen ou estado global?**
   - O que sabemos: a HomeScreen precisa mostrar o badge. A NotificationsScreen precisa zerá-lo.
   - O que está incerto: se usar fetch no mount da HomeScreen, o badge pode ficar stale entre navegações sem refetch.
   - Recomendação: fetch simples `GET /notifications/unread-count` no mount da HomeScreen + estado local. Ao voltar da NotificationsScreen (via React Router), a HomeScreen é re-montada automaticamente e refaz o fetch. Sem necessidade de context global.

2. **O cron de véspera deve checar se o usuário tem oneSignalPlayerId mas também deve persistir Notification mesmo sem playerId?**
   - O que sabemos: D-06 diz "silenciosamente ignorados" para o push. D-10 diz que notificações são armazenadas no banco.
   - O que está incerto: se um usuário sem playerId (push desativado) deve ter a Notification persistida para aparecer na central in-app.
   - Recomendação: sim — persistir a `Notification` independentemente do playerId. O push é best-effort; a central in-app é confiável.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | v20.20.2 | — |
| MongoDB Atlas (remoto) | Dados | ✓ (config em .env) | Prisma 6.19.3 | Sem fallback — conforme CLAUDE.md |
| OneSignal (ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY) | Push notifications | ✓ (configurado na Fase 4) | SDK 5.8.0 | Best-effort — D-06 garante que falhas são silenciosas |
| node-cron | Cron 21h | ✓ | 4.2.1 | — |
| Vitest (API) | Testes unitários | ✓ | Config em apps/api/vitest.config.ts | — |
| Vitest + jsdom (Web) | Testes de hook | ✓ | Config em apps/web/vitest.config.ts | — |

**Missing dependencies with no fallback:** nenhuma.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (API) | Vitest — `apps/api/vitest.config.ts` |
| Framework (Web) | Vitest + jsdom — `apps/web/vitest.config.ts` |
| Quick run command (API) | `cd apps/api && npx vitest run` |
| Quick run command (Web) | `cd apps/web && npx vitest run` |
| Full suite command | `npm run test --workspace=apps/api && npm run test --workspace=apps/web` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACOMP-01 | `getTodayOrder()` retorna order correto por userId+data BRT | unit | `npx vitest run --reporter=verbose apps/api/src/modules/orders/__tests__/orders.service.test.ts` | ❌ Wave 0 |
| ACOMP-01 | `updateOrderStatus()` valida transições SCHEDULED→OUT_FOR_DELIVERY→DELIVERED | unit | `npx vitest run apps/api/src/modules/admin-orders/__tests__/admin-orders.service.test.ts` | ❌ Wave 0 |
| ACOMP-01 | `useOrderTracking` faz poll 30s e para no unmount | unit | `npx vitest run apps/web/src/hooks/__tests__/useOrderTracking.test.ts` | ❌ Wave 0 |
| ACOMP-02 | `sendEveReminders()` busca orders amanhã (não schedules) e envia push | unit | `npx vitest run apps/api/src/modules/schedules/__tests__/schedules.service.test.ts` | ❌ Wave 0 (extensão) |
| ACOMP-03 | Push DELIVERED disparado ao chamar `updateOrderStatus(..., 'DELIVERED')` | unit | `npx vitest run apps/api/src/modules/admin-orders/__tests__/admin-orders.service.test.ts` | ❌ Wave 0 |
| ACOMP-04 | `getOrderHistory()` retorna apenas orders dos últimos 30 dias | unit | `npx vitest run apps/api/src/modules/orders/__tests__/orders.service.test.ts` | ❌ Wave 0 (extensão) |
| ACOMP-05 | Notification persistida a cada push (eve + delivered) | unit | `npx vitest run apps/api/src/modules/admin-orders/__tests__/admin-orders.service.test.ts` | ❌ Wave 0 |
| ACOMP-05 | Trim a 30 notificações por usuário | unit | Idem | ❌ Wave 0 |

### Sampling Rate

- **Por task commit:** `cd apps/api && npx vitest run` + `cd apps/web && npx vitest run`
- **Por wave merge:** Suite completa das duas apps
- **Phase gate:** Full suite green antes de `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/api/src/modules/admin-orders/__tests__/admin-orders.service.test.ts` — cobre ACOMP-01 (transições), ACOMP-03 (push DELIVERED), ACOMP-05 (persist Notification)
- [ ] `apps/web/src/hooks/__tests__/useOrderTracking.test.ts` — cobre ACOMP-01 (poll 30s, cleanup)
- [ ] `apps/api/src/modules/orders/__tests__/orders.service.test.ts` — ESTENDER: adicionar casos `getTodayOrder` e `getHistory`
- [ ] `apps/api/src/modules/schedules/__tests__/schedules.service.test.ts` — ESTENDER: adicionar caso `sendEveReminders` busca orders (não schedules)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | sim | `preHandler: [fastify.authenticate]` em todos os endpoints de cliente e admin |
| V3 Session Management | não (já implementado) | — |
| V4 Access Control | sim | Inline `request.user?.role !== 'ADMIN'` em `admin-orders.controller.ts` |
| V5 Input Validation | sim | Zod schema para `UpdateOrderStatusSchema` — enum de status válidos |
| V6 Cryptography | não aplicável | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cliente tentando chamar `PATCH /admin/orders/:id/status` | Elevation of Privilege | `preHandler: [fastify.authenticate]` + inline role check |
| Replay de status (DELIVERED → SCHEDULED) | Tampering | Validação de transição no service — VALID_TRANSITIONS map |
| Usuário A buscando notificações do usuário B via `GET /notifications/me` | Information Disclosure | `userId` extraído do JWT (nunca do body/query) — padrão estabelecido |
| Flooding de notificações (stale data) | DoS | Trim a 30 por usuário no próprio `create()` |

---

## Project Constraints (from CLAUDE.md)

- **Stack Frontend:** React + Vite + Tailwind CSS + Zod — não revisitável
- **Stack Backend:** Node.js + Fastify + Prisma + MongoDB Atlas — não revisitável
- **MongoDB Atlas remoto** — sem banco local em nenhum ambiente
- **Push:** OneSignal exclusivamente
- **Fidelidade de Design:** Alta fidelidade — cores, tipografia e espaçamentos do handoff são mandatórios
- **Fontes:** Bricolage Grotesque (títulos/números) + Hanken Grotesk (texto/UI)
- **Commits:** atômicos por tarefa; SUMMARY.md obrigatório ao final da fase
- **Hit targets:** mínimo 44px em todos os elementos interativos

---

## Sources

### Primary (HIGH confidence)

- `apps/api/prisma/schema.prisma` — Verificado: enum `OrderStatus` já tem `OUT_FOR_DELIVERY` e `DELIVERED`; modelo `Notification` com `NotificationType` (DELIVERY_EVE, DELIVERY_DONE) e campo `isRead` já existe
- `apps/api/src/plugins/cron.ts` — Verificado: padrão de cron jobs com node-cron v4, guard `NODE_ENV !== 'test'`, timezone `America/Sao_Paulo`
- `apps/api/src/modules/schedules/schedules.service.ts` — Verificado: padrão OneSignal SDK (createConfiguration, Notification object, include_subscription_ids)
- `apps/web/src/hooks/usePaymentPolling.ts` — Verificado: padrão de polling com `setInterval` + cleanup em `useEffect`
- `apps/api/src/modules/orders/orders.service.ts` — Verificado: padrão `BRAZIL_OFFSET_HOURS` para cálculo de datas em BRT
- `.projeto/design_handoff_cheirin_pao/app/screens-client-extra.jsx` — Verificado: componentes `TrackScreen` (timeline 3 passos) e `NotifsScreen` (cards por tipo)
- `.projeto/design_handoff_cheirin_pao/app/data.jsx` — Verificado: `TRACK_STEPS` (agendado/saiu/entregue), `ORDERS` (formato do histórico)
- `apps/api/package.json` — Verificado: `@onesignal/node-onesignal@5.8.0`, `node-cron@4.2.1`, `@prisma/client@6.19.3`, `zod@4.4.3`
- `apps/web/src/routes/router.tsx` — Verificado: estrutura de rotas `/client/*` com lazy imports
- `apps/api/src/modules/auth/auth.controller.ts` — Verificado: padrão inline de role check para ADMIN

### Secondary (MEDIUM confidence)

Nenhuma fonte secundária necessária — toda a informação foi verificada diretamente no codebase.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todos os pacotes verificados em package.json do projeto
- Schema/models: HIGH — schema.prisma lido diretamente; enum e models confirmados
- Architecture: HIGH — padrões verificados em código existente das fases anteriores
- Design handoff: HIGH — screens-client-extra.jsx lido diretamente
- Pitfalls: HIGH (timezone, cleanup) / MEDIUM (badge staleness — baseado em padrões React conhecidos)

**Research date:** 2026-06-15
**Valid until:** 2026-07-15 (estável — sem dependências de APIs externas em movimento rápido)
