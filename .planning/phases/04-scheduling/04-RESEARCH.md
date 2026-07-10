# Phase 4: Scheduling — Research

**Researched:** 2026-06-14
**Domain:** Cron jobs (Fastify), OneSignal push (backend + frontend PWA), reserva atômica de créditos (Prisma/MongoDB), Mercado Pago cobrança automática
**Confidence:** MEDIUM-HIGH (codebase: HIGH, bibliotecas externas: MEDIUM)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Cron diário à meia-noite cria Orders do dia seguinte para cada Schedule ativo com `isActive: true`. Cada Order criado com `type: SCHEDULED`, `status: SCHEDULED`, `scheduledDate` = próximo dia com quantidade > 0.
- **D-02:** Se saldo insuficiente para cobrir Order do dia seguinte: Order **não criado**. Push OneSignal de alerta enviado.
- **D-03:** Consumo semanal é **projeção calculada no frontend** (soma de `weeklyQty`). Cobertura = `Math.floor(saldo / consumoSemanal)` semanas. Sem depender de Orders no banco.
- **D-04:** Seleção de data no SingleScreen via **quick chips** (Amanhã, Depois de amanhã, + próximos dias) + "Outra data" → `<input type="date">` nativo. Range: amanhã até 30 dias.
- **D-05:** Horário de corte **hard-coded `CUTOFF_HOUR = 21`**. Se >= 21h, "Amanhã" fica desabilitado.
- **D-06:** Limite de **30 dias** para pedido único. `<input type="date">` usa `min` e `max`.
- **D-07:** Fase 4 implementa **envio real via OneSignal SDK** (`@onesignal/node-onesignal` no backend). Push funcionando, não só salvar preferência.
- **D-08:** Cron domingo 20h: busca usuários com `notifyReconfigure: true` → push via OneSignal SDK com CTA deep-link para ScheduleScreen.
- **D-09:** Frontend registra `player_id` via `POST /users/push-token` com `{ playerId: string }`. Backend salva em `oneSignalPlayerId` no modelo `User`.
- **D-10:** Fase 4 implementa o **cron de compra automática** completo (CRED-07/10). UI e save de preferência já existem da Fase 3.
- **D-11:** Modalidade "quando estiver acabando": limiar = `saldo_atual < consumo_semanal_do_schedule`. Cron verifica diariamente (junto com cron de Orders).
- **D-12:** Modalidade "toda semana": cron no dia configurado. Usa **card token** salvo em `User.cardTokenMp`.
- **D-13:** Se compra automática falhar: push "Compra automática falhou — verifique seu cartão". **Sem retentativa**. Próxima execução do cron tentará novamente se limiar ainda for atingido.

### Claude's Discretion
- Estrutura interna dos módulos `schedules` e `orders` — seguir Clean Architecture já estabelecida.
- Biblioteca de cron — `node-cron` (recomendado) ou `@fastify/schedule`.
- Endpoints: `GET /schedules/me`, `POST /orders`, `PUT /schedules/me`.
- Campo `oneSignalPlayerId: String?` adicionado ao modelo `User`.

### Deferred Ideas (OUT OF SCOPE)
- Múltiplos agendamentos por condomínio.
- Cancelamento de pedido único após confirmação.
- Pausa de agenda (férias).
- Horário de corte configurável pelo Admin (Fase 7).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCHED-01 | Cliente pode criar pedido único (avulso) — escolhe data e quantidade; créditos reservados imediatamente | Seção 4 (reserva atômica), Seção 5 (padrões endpoint), Seção 6 (modelo Order) |
| SCHED-02 | Cliente pode configurar agendamento semanal personalizado — define quantidade por dia (0 = sem entrega) | Seção 5 (módulos schedules), Seção 6 (modelo Schedule.weeklyQty) |
| SCHED-03 | Agendamento semanal repete automaticamente toda semana até o cliente alterar ou desativar | Seção 1 (cron diário meia-noite) |
| SCHED-04 | Cliente pode ativar notificação de reconfiguração semanal (domingo à noite lembra de ajustar semana seguinte) | Seção 1 (cron domingo 20h), Seção 2 (OneSignal SDK backend) |
| SCHED-05 | Se créditos insuficientes para cobrir o agendamento, banner de alerta exibido com opções de ação | Seção 7 (BannerInsuficiente existente) |
| SCHED-06 | Tela de agenda semanal exibe consumo semanal total e cobertura de créditos | Seção 7 (AuthContext.user.creditBalance, cálculo frontend D-03) |
| CRED-07 | Cliente pode ativar compra recorrente automática — modalidade "quando estiver acabando" ou "toda semana" | Seção 8 (MP card token), UI já existe na Fase 3 |
| CRED-10 | Se créditos insuficientes e com compra automática, combo é comprado automaticamente e cliente recebe confirmação | Seção 8 (MP preapproval vs token), Seção 2 (push confirmação) |
</phase_requirements>

---

## Summary

A Fase 4 é fundamentalmente uma fase de **automação e integração**: crons que criam pedidos e disparam compras, SDK OneSignal que envia pushes reais, e endpoints REST que permitem ao cliente configurar sua agenda. A maior parte da infraestrutura de código já existe — a fase adiciona dois módulos Fastify novos (`schedules`, `orders`), um plugin de cron, um plugin de OneSignal e as telas `ScheduleScreen` e `SingleScreen` no frontend.

O maior risco técnico é a **compra automática via cartão salvo**: o `cardTokenMp` salvo pelo MP Brick é um **token de uso único** (expira em 7 dias). Ele não pode ser reutilizado para cobranças futuras sem CVV. Para cobranças recorrentes sem interação do usuário, o Mercado Pago exige a API `/preapproval` (Subscriptions). Isso representa uma discrepância com a decisão D-12 e precisa de atenção especial no planejamento.

O segundo ponto crítico é a **reserva atômica de créditos**: MongoDB com Prisma não suporta isolamento de transações, tornando o padrão `updateOne` com condição `where: { creditBalance: { gte: quantidade } }` via `prisma.$runCommandRaw` o único caminho seguro para evitar saldo negativo em condições de race.

**Primary recommendation:** Usar `node-cron` com timezone `America/Sao_Paulo`, registrado em um plugin Fastify dedicado `plugins/cron.ts`. OneSignal SDK `@onesignal/node-onesignal` v5.8.0 no backend para push. Para compra automática, criar uma API de preapproval MP OU implementar "apenas Pix" para o modo automático (com notificação push para o cliente pagar).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Agenda semanal (CRUD) | API / Backend | — | Persistência de Schedule, validação de créditos |
| Pedido único (CRUD) | API / Backend | — | Reserva de crédito deve ocorrer no backend |
| Cron diário (criação de Orders) | API / Backend | — | Processo server-side, sem participação do cliente |
| Cron domingo 20h (push reconfigure) | API / Backend | — | Processo server-side, OneSignal SDK no backend |
| Cron compra automática | API / Backend | — | Processo server-side, chama MP sem interação |
| ScheduleScreen (UI da agenda semanal) | Frontend/Client | — | Leitura de Schedule, steppers por dia |
| SingleScreen (UI pedido único) | Frontend/Client | — | Quick chips de data, stepper de quantidade |
| Registro de player_id OneSignal | Frontend/Client | API / Backend (save) | SDK captura no browser, backend persiste |
| Cálculo de cobertura de créditos | Frontend/Client | — | D-03: projeção local, não depende de Orders |
| Alerta de saldo insuficiente | Frontend/Client | — | Calculado no frontend com dados do AuthContext |

---

## 1. Cron Jobs no Fastify

### Recomendação: `node-cron` em plugin dedicado

**Nenhuma biblioteca de cron está instalada** no `apps/api/package.json` atual. Será necessário adicionar `node-cron`. [VERIFIED: npm registry — slopcheck OK]

**`node-cron` v4.2.1** — biblioteca madura, publicada em 2026-04-24, repositório oficial em `github.com/merencia/node-cron`. [VERIFIED: npm registry]

```bash
# Instalar no workspace da API
npm install node-cron --workspace=apps/api
npm install --save-dev @types/node-cron --workspace=apps/api
```

### API do node-cron

```typescript
// Source: github.com/merencia/node-cron README
import cron from 'node-cron'

// Parâmetros: expression, callback, options
const task = cron.schedule(
  '0 0 * * *',                         // meia-noite
  async () => { /* handler */ },
  {
    scheduled: true,
    timezone: 'America/Sao_Paulo',      // UTC-3 (Brasília) — hard-coded na Fase 4
  }
)

// Para o cron de domingo 20h:
cron.schedule('0 20 * * 0', handler, { timezone: 'America/Sao_Paulo' })

// Para compra automática (roda junto com cron diário ou separado):
cron.schedule('0 0 * * *', autoBuyHandler, { timezone: 'America/Sao_Paulo' })

// Controle:
task.start()
task.stop()
```

**Expressões cron para esta fase:**
| Cron | Expressão | Timezone |
|------|-----------|----------|
| Criação de Orders do dia seguinte | `0 0 * * *` (meia-noite) | America/Sao_Paulo |
| Compra automática (verificação diária) | `0 0 * * *` (junto com Orders) | America/Sao_Paulo |
| Lembrete de reconfiguração semanal | `0 20 * * 0` (domingo 20h) | America/Sao_Paulo |

### Padrão de integração com Fastify

Registrar em `apps/api/src/plugins/cron.ts` e inicializar **depois** que o `prismaPlugin` for registrado (o cron precisa de `fastify.prisma`): [ASSUMED — padrão baseado na estrutura de plugins Fastify existente no projeto]

```typescript
// apps/api/src/plugins/cron.ts
import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import cron from 'node-cron'

const cronPlugin: FastifyPluginAsync = fp(async (fastify) => {
  // Cron diário meia-noite — cria Orders + verifica auto-buy "quando estiver acabando"
  cron.schedule('0 0 * * *', async () => {
    const service = new SchedulesService(fastify)
    await service.createDailyOrders()
    await service.processAutoBuyLowBalance()
  }, { timezone: 'America/Sao_Paulo' })

  // Cron compra automática semanal — verifica usuários com modo "semanal" no dia configurado
  // (roda todo dia, a lógica interna filtra pelo dia da semana do usuário)
  cron.schedule('0 0 * * *', async () => {
    const service = new SchedulesService(fastify)
    await service.processAutoBuyWeekly()
  }, { timezone: 'America/Sao_Paulo' })

  // Cron lembrete domingo 20h
  cron.schedule('0 20 * * 0', async () => {
    const service = new NotificationsService(fastify)
    await service.sendReconfigureReminders()
  }, { timezone: 'America/Sao_Paulo' })
})

export default cronPlugin
```

Registro no `server.ts` após `prismaPlugin`:

```typescript
import cronPlugin from './plugins/cron.js'
// ...
await fastify.register(prismaPlugin)
await fastify.register(cronPlugin)   // depois do prisma
```

### Como testar crons unitariamente

**Estratégia:** Isolar a lógica em métodos de service e testar o service diretamente — NÃO testar o cron em si. O cron é apenas um trigger que chama `service.createDailyOrders()`. O vitest testa o método de service com mocks do Prisma. [ASSUMED — baseado nos padrões de teste existentes no projeto]

```typescript
// Teste do service, não do cron:
it('createDailyOrders cria Order para cada Schedule ativo com saldo suficiente', async () => {
  const fastify = createMockFastify({
    schedule: { findMany: vi.fn().mockResolvedValue([mockSchedule]) },
    user: { findUnique: vi.fn().mockResolvedValue({ creditBalance: 10 }) },
    order: { create: vi.fn() },
    creditTransaction: { create: vi.fn() },
  })
  const service = new SchedulesService(fastify)
  await service.createDailyOrders()
  expect(fastify.prisma.order.create).toHaveBeenCalledWith(...)
})
```

### Alternativa: `@fastify/schedule`

`@fastify/schedule` é um plugin oficial do ecosistema Fastify que integra `toad-scheduler`. Suporta Fastify v5. [ASSUMED — baseado em documentação pública] Porém, adiciona complexidade desnecessária para este caso de uso simples. **Decisão: usar `node-cron` diretamente** conforme sugerido no CONTEXT.md.

---

## 2. OneSignal SDK Backend (`@onesignal/node-onesignal`)

### Inicialização

```typescript
// Source: github.com/OneSignal/onesignal-node-api README
import * as OneSignal from '@onesignal/node-onesignal'

const configuration = OneSignal.createConfiguration({
  restApiKey: process.env.ONESIGNAL_REST_API_KEY!,
})

const osClient = new OneSignal.DefaultApi(configuration)
```

Adicionar ao `envSchema` em `server.ts`:
```typescript
ONESIGNAL_APP_ID: { type: 'string' },
ONESIGNAL_REST_API_KEY: { type: 'string' },
```

### Enviando push para um player_id específico

O campo correto é `include_subscription_ids` (array de subscription IDs / player IDs): [CITED: documentation.onesignal.com/reference/create-notification]

```typescript
// Source: OneSignal REST API docs
async function sendPush(playerId: string, title: string, body: string, actionRoute?: string) {
  const notification = new OneSignal.Notification()
  notification.app_id = process.env.ONESIGNAL_APP_ID!
  notification.include_subscription_ids = [playerId]
  notification.headings = { pt: title }
  notification.contents = { pt: body }
  if (actionRoute) {
    notification.url = actionRoute   // deep-link para a tela (ex: /client/agenda)
  }

  try {
    const response = await osClient.createNotification(notification)
    if (!response.id) {
      // HTTP 200 sem id = nenhum recipient válido (player_id inválido/expirado)
      // Não é um erro crítico — o usuário desinstalou o app ou revogou permissão
      fastify.log.warn({ playerId }, 'OneSignal: sem recipient — player_id inválido ou expirado')
    }
  } catch (err) {
    fastify.log.error(err, 'OneSignal: falha ao enviar push')
    // Não propagar o erro — falha de push não deve interromper o cron
  }
}
```

### Tratamento de player_id inválido

Quando o usuário desinstala o app ou revoga permissão, a API do OneSignal retorna HTTP 200 com `{ errors: { invalid_player_ids: [...] } }` ou simplesmente sem `id`. [CITED: documentation.onesignal.com/reference/create-notification]

**Estratégia recomendada:**
- Se `response.id` for null/undefined: logar como warning, NÃO lançar erro
- O cron continua processando os demais usuários
- Não limpar o `oneSignalPlayerId` do banco automaticamente (pode ser transiente — usuário reinstala o app e registra novo token)

### Envio para múltiplos usuários (cron de reconfiguração)

```typescript
// Para o cron de domingo: busca usuários com notifyReconfigure=true e envia em batch
const users = await prisma.schedule.findMany({
  where: { notifyReconfigure: true, isActive: true },
  include: { user: { select: { oneSignalPlayerId: true } } }
})

// Enviar individualmente (OneSignal aceita até 20.000 subscription_ids por request,
// mas para simplicidade na Fase 4, enviar em batches de 1.000)
const playerIds = users
  .map(s => s.user?.oneSignalPlayerId)
  .filter(Boolean) as string[]

// Alternativa: usar include_segments ou filtros — mas subscription_ids é mais preciso
const notification = new OneSignal.Notification()
notification.app_id = process.env.ONESIGNAL_APP_ID!
notification.include_subscription_ids = playerIds.slice(0, 2000)
notification.headings = { pt: 'Ajuste sua agenda para a semana' }
notification.contents = { pt: 'Configure seus pãezinhos para os próximos dias' }
notification.url = '/client/agenda'
```

---

## 3. OneSignal Web SDK (Frontend PWA)

### Status atual no projeto

O frontend **já tem `react-onesignal` v3.5.5 instalado e inicializado** em `apps/web/src/main.tsx`:

```typescript
// main.tsx (linhas 24-28) — JÁ EXISTE
OneSignal.init({
  appId: import.meta.env.VITE_ONESIGNAL_APP_ID as string,
  serviceWorkerPath: 'push/onesignal/OneSignalSDKWorker.js',
  serviceWorkerParam: { scope: '/push/onesignal/' },
})
```

A Fase 4 adiciona apenas a **captura do `player_id`** após o usuário aceitar push e o envio para o backend.

### Como obter o subscription_id/player_id

O OneSignal WebSDK expõe o ID via `OneSignal.User.PushSubscription.id`: [CITED: documentation.onesignal.com/docs/web-sdk-reference]

```typescript
// Abordagem recomendada — listener para detectar quando o ID está disponível
// Adicionar em main.tsx ou em um hook dedicado useOneSignal()

OneSignal.User.PushSubscription.addEventListener('change', (event) => {
  const subscriptionId = event.current.id
  if (subscriptionId) {
    // Enviar para o backend via POST /users/push-token
    apiFetch('/users/push-token', {
      method: 'POST',
      body: JSON.stringify({ playerId: subscriptionId }),
    }).catch(() => {
      // Falha silenciosa — não bloquear o app por falha no registro de push
    })
  }
})

// Também verificar se já tem ID ao inicializar (usuário já havia aceitado push antes)
const existingId = OneSignal.User.PushSubscription.id
if (existingId) {
  apiFetch('/users/push-token', { method: 'POST', body: JSON.stringify({ playerId: existingId }) })
}
```

### Onde chamar

**Opção A (recomendada):** Em `main.tsx`, logo após `OneSignal.init()`. Simples, sem contexto React necessário.

**Opção B:** Em um hook `useOneSignalRegister()` chamado no `ClientLayout.tsx` — permite acesso ao `apiFetch` com o token de autenticação já disponível via `localStorage`. Esta é a opção correta, pois o endpoint `POST /users/push-token` requer autenticação.

**Recomendação:** Hook `useOneSignalRegister()` chamado no `ClientLayout.tsx` — garante que o usuário esteja autenticado antes de tentar registrar.

### Compatibilidade iOS Safari PWA

iOS requer que o PWA esteja instalado (adicionado à Tela Inicial) para suportar push. O `VITE_ONESIGNAL_APP_ID` placeholder (Fase 1) exibe warning no console mas não quebra o app. Em produção, configurar com App ID real do OneSignal. [ASSUMED — baseado em comportamento documentado do OneSignal com iOS 16.4+]

---

## 4. Reserva Atômica de Créditos

### O problema

Ao criar um `Order` (pedido único ou gerado pelo cron), o sistema precisa:
1. Verificar que `user.creditBalance >= quantidade`
2. Decrementar `creditBalance` por `quantidade`
3. Criar o `Order` com `status: SCHEDULED`

Sem atomicidade, duas execuções simultâneas podem ambas passar na verificação e criar dois Orders, deixando o saldo negativo.

### Prisma + MongoDB: restrições importantes

Prisma suporta `$transaction` com MongoDB, **mas MongoDB não tem isolation levels**. Isso significa que uma transação interativa pode ver dados não-committed de outras transações. [CITED: prisma.io/docs/orm/prisma-client/queries/transactions]

Para uso em lote (cron que processa dezenas de usuários em sequência), o risco de race condition é baixo porque cada usuário tem seu próprio documento. Para pedido único via API, o risco é maior (chamada dupla por bug ou retry do cliente).

### Estratégia recomendada: `updateOne` condicional via `$runCommandRaw`

Prisma não suporta nativamente `updateOne` com condição em campo não-único (como `creditBalance >= quantidade`). A solução é usar `prisma.$runCommandRaw` para executar uma operação MongoDB nativa: [ASSUMED — baseado em comportamento documentado do Prisma com MongoDB]

```typescript
// Em orders.repository.ts
async reserveCredits(userId: string, quantity: number): Promise<boolean> {
  const result = await this.fastify.prisma.$runCommandRaw({
    update: 'User',
    updates: [{
      q: { _id: { $oid: userId }, creditBalance: { $gte: quantity } },
      u: { $inc: { creditBalance: -quantity } },
      multi: false,
    }]
  }) as { nModified?: number; modifiedCount?: number }

  // Se nModified === 0: saldo insuficiente ou userId não encontrado
  return (result.nModified ?? result.modifiedCount ?? 0) > 0
}
```

**Fluxo no service:**

```typescript
async createSingleOrder(userId: string, data: CreateOrderBody): Promise<Order> {
  // 1. Tenta reservar atomicamente os créditos
  const reserved = await this.repo.reserveCredits(userId, data.quantity)
  if (!reserved) {
    throw { error: 'Créditos insuficientes', status: 400 }
  }

  try {
    // 2. Cria o Order e a CreditTransaction (sem rollback automático no MongoDB)
    const [order] = await this.fastify.prisma.$transaction([
      this.fastify.prisma.order.create({
        data: { userId, type: 'SINGLE', quantity: data.quantity, scheduledDate: data.date, status: 'SCHEDULED' }
      }),
      this.fastify.prisma.creditTransaction.create({
        data: { userId, type: 'DELIVERY', quantity: -data.quantity, description: `Reserva de ${data.quantity} pão(es) — pedido único` }
      }),
    ])
    return order
  } catch (err) {
    // 3. Se falhar, reverter a reserva manualmente
    await this.fastify.prisma.user.update({
      where: { id: userId },
      data: { creditBalance: { increment: data.quantity } }
    })
    throw err
  }
}
```

### Alternativa mais simples (Fase 4 MVP)

Para o MVP com tráfego baixo, pode-se usar `$transaction` interativo com verificação manual. O risco de race condition em produção com poucos usuários é aceitável:

```typescript
await this.fastify.prisma.$transaction(async (tx) => {
  const user = await tx.user.findUnique({ where: { id: userId } })
  if (!user || user.creditBalance < quantity) {
    throw { error: 'Créditos insuficientes', status: 400 }
  }
  await tx.user.update({ where: { id: userId }, data: { creditBalance: { decrement: quantity } } })
  await tx.order.create({ data: { ... } })
  await tx.creditTransaction.create({ data: { ... } })
})
```

**Recomendação:** Usar a transação interativa para o MVP. Documentar a limitação. Migrar para `$runCommandRaw` se necessário em produção.

### Para o cron diário (sem concorrência real)

O cron processa usuários sequencialmente. Não há risco de race condition. Usar `$transaction` sequencial simples:

```typescript
await prisma.$transaction([
  prisma.order.create({ data: { ... } }),
  prisma.user.update({ where: { id: userId }, data: { creditBalance: { decrement: quantity } } }),
  prisma.creditTransaction.create({ data: { ... } }),
])
```

---

## 5. Padrões do Projeto (Módulos Fastify)

### Estrutura confirmada via codebase

**Módulo existente de referência:** `apps/api/src/modules/payments/` e `apps/api/src/modules/credits/` (criados na Fase 3). Estrutura:

```
modules/{domain}/
├── {domain}.route.ts        # FastifyPluginAsync, registra rotas
├── {domain}.controller.ts   # Classe com métodos handler (parse Zod + call service)
├── {domain}.service.ts      # Lógica de negócio
├── {domain}.repository.ts   # Acesso ao Prisma
├── {domain}.schema.ts       # Schemas Zod + tipos inferidos
└── __tests__/
    └── {domain}.service.test.ts
```

**Fase 4 cria:**
- `modules/schedules/` — CRUD de Schedule + lógica de cobertura
- `modules/orders/` — criação de Orders (avulsos e pelo cron)
- `plugins/cron.ts` — cron jobs registrados como Fastify plugin

**Endpoints a criar:**

| Método | Path | Autenticação | Descrição |
|--------|------|-------------|-----------|
| `GET` | `/schedules/me` | authenticate | Retorna Schedule ativo do usuário |
| `PUT` | `/schedules/me` | authenticate | Cria ou atualiza Schedule (upsert) |
| `POST` | `/orders` | authenticate | Cria pedido único + reserva créditos |
| `POST` | `/users/push-token` | authenticate | Salva `oneSignalPlayerId` no User |

### Padrão de upsert para Schedule

Como um usuário pode ter apenas um Schedule ativo, o endpoint `PUT /schedules/me` deve usar upsert:

```typescript
// No service:
async upsertSchedule(userId: string, condominiumId: string, data: ScheduleBody) {
  return this.fastify.prisma.schedule.upsert({
    where: { userId_condominiumId: { userId, condominiumId } },  // índice composto
    create: { userId, condominiumId, ...data },
    update: { ...data },
  })
}
```

**Atenção:** O schema Prisma atual NÃO tem `@@unique([userId, condominiumId])` no modelo `Schedule`. É necessário adicionar para o upsert funcionar. [VERIFIED: arquivo apps/api/prisma/schema.prisma lido diretamente]

### Padrão do server.ts para registros

```typescript
// Após as rotas da Fase 3, adicionar:
await fastify.register(schedulesRoute)
await fastify.register(ordersRoute)
await fastify.register(notificationsRoute)  // POST /users/push-token
await fastify.register(cronPlugin)           // após prismaPlugin
```

---

## 6. Prisma Schema — Schedule e Order

### Modelo `Schedule` (linha ~179 do schema.prisma)

**Campos ATUAIS confirmados:**

```prisma
model Schedule {
  id                String   @id @default(auto()) @map("_id") @db.ObjectId
  userId            String   @db.ObjectId
  condominiumId     String   @db.ObjectId
  weeklyQty         Json     // { seg: 2, ter: 0, qua: 2, qui: 2, sex: 2, sab: 0, dom: 0 }
  deliveryTime      String   // "06:30" | "07:00" | "07:30" | "08:00"
  notifyReconfigure Boolean  @default(false)
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

**Campos FALTANTES que precisam ser adicionados:**
1. `@@unique([userId, condominiumId])` — necessário para upsert via Prisma. MVP tem apenas um condomínio por usuário.

**Tipo do `weeklyQty`:** `Json` — armazenar como objeto com chaves de dias da semana. Forma recomendada:

```typescript
// Tipo TypeScript para weeklyQty
interface WeeklyQty {
  seg: number  // 0-12
  ter: number
  qua: number
  qui: number
  sex: number
  sab: number
  dom: number
}
```

### Modelo `Order` (linha ~192 do schema.prisma)

**Campos ATUAIS confirmados:**

```prisma
model Order {
  id             String      @id @default(auto()) @map("_id") @db.ObjectId
  userId         String      @db.ObjectId
  type           OrderType   // SINGLE | SCHEDULED
  quantity       Int
  scheduledDate  DateTime
  status         OrderStatus // SCHEDULED | OUT_FOR_DELIVERY | DELIVERED | CANCELLED
  deliveryListId String?     @db.ObjectId
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
}
```

**Campos FALTANTES:**
- Nenhum campo faltante crítico para a Fase 4. O `type: SCHEDULED` (gerado pelo cron) e `type: SINGLE` (pedido avulso) já estão no enum `OrderType`.

**Nota sobre `OrderType`:** O enum tem `SINGLE` e `SCHEDULED`. No CONTEXT.md o cron cria com `type: WEEKLY` — mas o schema usa `SCHEDULED`. Usar `SCHEDULED` (o que está no schema). [VERIFIED: arquivo apps/api/prisma/schema.prisma — enum OrderType = SINGLE | SCHEDULED]

### Modelo `User` — campo faltante

O campo `oneSignalPlayerId` **ainda não existe** no schema. Precisa ser adicionado: [VERIFIED: apps/api/prisma/schema.prisma lido diretamente — campo ausente]

```prisma
model User {
  // ... campos existentes ...
  creditBalance    Int       @default(0)      // já existe
  autoRecharge     Json?                      // já existe
  cardTokenMp      String?                    // já existe
  oneSignalPlayerId String?                   // ADICIONAR na Fase 4
}
```

---

## 7. Componentes Reutilizáveis Confirmados

### `QuantityStepper` — CONFIRMADO

**Localização:** `apps/web/src/components/client/QuantityStepper.tsx` [VERIFIED: arquivo lido diretamente]

**Interface:**
```typescript
interface QuantityStepperProps {
  min: number
  max: number
  value: number
  onChange: (v: number) => void
}
```

**Uso na ScheduleScreen:** Um stepper por dia da semana com `min={0}`, `max={12}`.
**Uso na SingleScreen:** Um stepper com `min={1}`, `max={20}`.

### `StepperInline` — CONFIRMADO

**Localização:** `apps/web/src/components/client/StepperInline.tsx` [VERIFIED: arquivo lido diretamente]

Versão compacta do stepper (34x34px vs 48x48px), ideal para uso na ScheduleScreen ao lado do label do dia da semana. Fontes menores (18px vs 56px no QuantityStepper grande).

### `BannerInsuficiente` — CONFIRMADO

**Localização:** `apps/web/src/components/client/BannerInsuficiente.tsx` [VERIFIED: arquivo lido diretamente]

**Interface:**
```typescript
interface BannerInsuficienteProps {
  saldo: number
  requerido: number
  onComprar: () => void
  onAjustar: (novaQtd: number) => void
}
```

Retorna `null` se `requerido <= saldo`. Exibir no `SingleScreen` quando `quantidade > user.creditBalance`.

**Atenção para ScheduleScreen:** O CONTEXT.md descreve dois estados diferentes dos que o `BannerInsuficiente` cobre:
- Estado 1 (saldo insuficiente): banner dourado → vai para CombosScreen
- Estado 2 (saldo suficiente): card cinza → vai para AutoBuyScreen

O `BannerInsuficiente` cobre apenas o estado 1. O card de cobertura (estado 2) é um componente novo a criar.

### `apiFetch` — CONFIRMADO

**Localização:** `apps/web/src/lib/apiFetch.ts` [VERIFIED: arquivo lido diretamente]

Injecta automaticamente `Authorization: Bearer <token>` e `X-Device-Id`. Todos os hooks da Fase 4 (`useSchedule`, `useCreateOrder`, `useUpdateSchedule`) devem usá-lo.

### `AuthContext` — CONFIRMADO

**Localização:** `apps/web/src/contexts/AuthContext.tsx` [VERIFIED: arquivo lido diretamente]

Expõe `user.creditBalance` via `useAuth()`. Método `updateCreditBalance(balance)` já existe para atualizar o saldo sem refetch.

**Uso na ScheduleScreen:** `const { user } = useAuth()` → `user.creditBalance` para cálculo de cobertura.

### `PlaceholderScreen` — CONFIRMADO (a ser substituído)

**Localização:** `apps/web/src/pages/client/PlaceholderScreen.tsx` [VERIFIED: arquivo lido diretamente]

A rota `/client/agenda` atualmente aponta para `PlaceholderScreen`. Na Fase 4, o router.tsx deve ser atualizado para apontar para `ScheduleScreen`:

```typescript
// Em router.tsx, substituir:
{ path: 'agenda', lazy: () => import('../pages/client/PlaceholderScreen')... }
// Por:
{ path: 'agenda', lazy: () => import('../pages/client/ScheduleScreen')... }
// E adicionar sub-rota:
{ path: 'agenda/pedido-unico', lazy: () => import('../pages/client/SingleScreen')... }
```

---

## 8. Compra Automática — Card Token MP

### Descoberta Crítica: Token do Brick é de uso único

O `cardTokenMp` salvo pela `PaymentsService.createCard()` (Fase 3) é o **token gerado pelo MP Brick no momento do pagamento**. Este token expira em 7 dias e é de **uso único**. [CITED: mercadopago.com.br/developers/en/docs/subscriptions/additional-content/cardtoken]

**Isso significa que D-12 ("usa o card token salvo no User para compra automática") é tecnicamente inviável** com o token atual. O `cardTokenMp` no banco é o token da última transação — já foi consumido.

### Opções para compra recorrente sem CVV

**Opção A: API `/preapproval` do Mercado Pago (Subscriptions)**

O MP oferece a API de Subscriptions (`/preapproval`) que aceita um `card_token_id` na criação e cobra automaticamente de acordo com a recorrência definida. Após criação, o MP guarda o método de pagamento e cobra sem CVV. [CITED: mercadopago.com.co/developers/en/docs/subscriptions/integration-configuration/subscription-no-associated-plan/authorized-payments]

```typescript
// POST /preapproval
{
  "back_url": "https://app.cheirindepao.com.br/client/creditos",
  "reason": "Recarga automática Cheirin de Pão",
  "payer_email": user.email,
  "auto_recurring": {
    "frequency": 1,
    "frequency_type": "weeks",       // ou "months"
    "transaction_amount": combo.price,
    "currency_id": "BRL"
  },
  "card_token_id": card_token_id,   // token ONE-TIME fornecido pelo usuário UMA VEZ
  "status": "authorized"
}
```

**Limitação:** Requer que o usuário forneça um novo token de cartão especificamente para a subscription. Não usa o `cardTokenMp` atual (já expirado).

**Opção B: Pix automático via geração de cobrança + push (sem cobrança silenciosa)**

Em vez de cobrar o cartão silenciosamente, o backend gera um Pix e envia push ao cliente: "Sua recarga automática está pronta — toque para pagar". O cliente paga com Pix em um clique.

**Opção C: Simplificar para MVP — notificação + compra manual**

O cron detecta saldo baixo e envia push "Seus créditos estão acabando — recarregue agora". O cliente abre o app e compra manualmente. UI da AutoBuyScreen já existe.

### Recomendação para o Planner

**Para CRED-07/10 no MVP da Fase 4:**

A opção mais viável e alinhada com o que foi implementado na Fase 3 é uma combinação:

1. **Modo "quando estiver acabando":** Cron detecta `saldo < consumoSemanal` → envia push de alerta com deep-link para CombosScreen. O sistema "notifica com opção de ação" (conforme CRED-09). Isso entrega o valor sem a complexidade de tokenização recorrente.

2. **Modo "toda semana":** Gerar QR Pix automaticamente no dia configurado + enviar push com o valor e link para a tela de pagamento Pix. O cliente "paga com 1 toque".

Esta abordagem entrega CRED-07 (ativa compra recorrente) e CRED-10 (recebe confirmação) sem exigir o fluxo de card token recorrente, que requer infraestrutura adicional de MP Subscriptions.

**Se o cliente exigir cobrança automática real no cartão:** Implementar o fluxo `/preapproval` do MP. Requer adicionar endpoint no frontend para o usuário fornecer novo card token especificamente para a subscription. Estimativa de esforço: +1 wave.

---

## Don't Hand-Roll

| Problema | Não Construir | Usar Em Vez | Por Quê |
|----------|---------------|-------------|---------|
| Cron expression parsing | Parser de cron próprio | `node-cron` | Timezone, expressões complexas, edge cases de calendário |
| Push notification | Chamada direta à WebPush API | `@onesignal/node-onesignal` | Gerenciamento de tokens, retry, plataformas múltiplas |
| Cobrança recorrente sem CVV | Salvar número de cartão | MP Subscriptions API (`/preapproval`) | PCI compliance, tokenização segura, retry automático |
| Atomic decrement com condição | Lógica de locking customizada | `$runCommandRaw` com `$gte` | Race condition em `$transaction` do Prisma/MongoDB |
| Serializações de weeklyQty | Formato próprio | JSON padrão com keys de dias | Compatibilidade com Prisma Json type |

---

## Common Pitfalls

### Pitfall 1: timezone do cron em UTC no servidor VPS

**O que dá errado:** VPS pode estar em UTC. O cron `0 0 * * *` sem timezone dispara à meia-noite UTC = 21h no Brasil (UTC-3).
**Por que acontece:** `node-cron` usa o timezone do processo Node.js por padrão.
**Como evitar:** Sempre passar `{ timezone: 'America/Sao_Paulo' }` no terceiro argumento.
**Sinal de alerta:** Ordens sendo criadas com data errada, um dia atrasado.

### Pitfall 2: `$transaction` sem isolamento no MongoDB

**O que dá errado:** Dois requests simultâneos de pedido único passam pela verificação de saldo e ambos criam Orders, resultando em saldo negativo.
**Por que acontece:** MongoDB não tem isolation levels — leituras dentro de `$transaction` podem ver dados não-committed.
**Como evitar:** Usar `$runCommandRaw` com `updateOne` condicional (`$gte`), verificar `nModified`.
**Sinal de alerta:** `creditBalance` negativo no banco.

### Pitfall 3: Token MP Brick é de uso único

**O que dá errado:** Cron tenta usar `user.cardTokenMp` para criar pagamento → MP retorna erro `invalid_token` ou `expired_token`.
**Por que acontece:** O Brick gera um token one-time para a transação imediata. Token expira em 7 dias ou após uso.
**Como evitar:** Usar MP Subscriptions API para cobranças recorrentes, ou usar Pix.
**Sinal de alerta:** `createCard` no cron retorna erro 400 do MP.

### Pitfall 4: `player_id` registrado antes da autenticação

**O que dá errado:** `useOneSignalRegister` é chamado antes do login → `POST /users/push-token` retorna 401.
**Por que acontece:** `main.tsx` inicializa antes do router e do AuthContext.
**Como evitar:** Chamar o registro do `player_id` dentro do `ClientLayout.tsx`, que só renderiza após autenticação validada.
**Sinal de alerta:** 401 no console após aceitar push.

### Pitfall 5: Campo `oneSignalPlayerId` ausente no schema

**O que dá errado:** `prisma.user.update({ data: { oneSignalPlayerId: ... } })` lança erro de compilação TypeScript.
**Por que acontece:** Campo não existe no `schema.prisma` atual.
**Como evitar:** Adicionar campo ao schema e rodar `prisma generate` antes de usar.

### Pitfall 6: `weeklyQty` como string JSON ao invés de objeto

**O que dá errado:** Frontend envia `weeklyQty` como `JSON.stringify({...})`, backend salva como string no campo `Json` do Prisma.
**Por que acontece:** Serialização dupla.
**Como evitar:** Passar o objeto diretamente sem `JSON.stringify` extra no body do request — `apiFetch` já serializa com `JSON.stringify`.

### Pitfall 7: `SCHEDULED` vs `WEEKLY` no OrderType

**O que dá errado:** CONTEXT.md menciona `type: WEEKLY` mas o enum do schema só tem `SINGLE` e `SCHEDULED`.
**Como evitar:** Usar `OrderType.SCHEDULED` para ordens geradas pelo cron semanal.

---

## Standard Stack

### Core (Fase 4)

| Biblioteca | Versão | Propósito | Status |
|------------|--------|----------|--------|
| `node-cron` | 4.2.1 | Cron jobs no backend | A instalar |
| `@onesignal/node-onesignal` | 5.8.0 | Push notifications backend | A instalar |
| `react-onesignal` | 3.5.5 | SDK OneSignal no PWA | JÁ INSTALADO |
| `fastify` | 5.8.5 | Server backend | JÁ INSTALADO |
| `@prisma/client` | 6.19.3 | ORM | JÁ INSTALADO |
| `zod` | 4.4.3 | Validação schemas | JÁ INSTALADO |

### Instalação dos novos pacotes

```bash
npm install node-cron @onesignal/node-onesignal --workspace=apps/api
npm install --save-dev @types/node-cron --workspace=apps/api
```

---

## Package Legitimacy Audit

> Auditoria executada com slopcheck em 2026-06-14.

| Pacote | Registry | Repositório | slopcheck | Disposição |
|--------|----------|-------------|-----------|------------|
| `node-cron` | npm | github.com/merencia/node-cron | [OK] (nota: nome clássico de LLM bait, mas pacote estabelecido) | Aprovado |
| `@onesignal/node-onesignal` | npm | github.com/OneSignal/onesignal-node-api | [OK] | Aprovado |
| `react-onesignal` | npm | github.com/OneSignal/react-onesignal | [OK] | Aprovado (já instalado) |

**Pacotes removidos por [SLOP]:** nenhum
**Pacotes flagged como [SUS]:** nenhum

---

## Architecture Patterns

### Fluxo de dados — Criação de Order (pedido único)

```
Cliente (SingleScreen)
  │ POST /orders { date, quantity }
  ▼
ordersRoute → OrdersController
  │ parse Zod
  │ authenticate preHandler
  ▼
OrdersService.createSingleOrder(userId, data)
  │
  ├─ reserveCredits (atomic $runCommandRaw)
  │    └─ retorna false → lança { error, status: 400 }
  │
  ├─ prisma.$transaction([
  │    order.create({ type: SINGLE, status: SCHEDULED }),
  │    creditTransaction.create({ type: DELIVERY, quantity: -data.quantity })
  │  ])
  │
  └─ retorna Order criado
  ▼
Controller → reply.status(201).send({ orderId, scheduledDate })
  ▼
Frontend: navegar para /client/agenda com toast de confirmação
```

### Fluxo de dados — Cron diário (meia-noite)

```
Cron 00:00 America/Sao_Paulo
  │
  ▼
plugins/cron.ts → SchedulesService.createDailyOrders()
  │
  ├─ prisma.schedule.findMany({ where: { isActive: true } })
  │
  └─ Para cada Schedule:
       │
       ├─ Calcular scheduledDate = amanhã
       ├─ Obter quantidade = weeklyQty[dayOfWeek(scheduledDate)]
       │
       ├─ Se quantidade === 0: PULAR
       │
       ├─ Se user.creditBalance < quantidade:
       │    └─ OneSignal push: "Créditos insuficientes para entrega de amanhã"
       │    └─ NÃO criar Order
       │
       └─ Se saldo suficiente:
            └─ prisma.$transaction([
                 order.create({ type: SCHEDULED, status: SCHEDULED }),
                 user.update({ creditBalance: { decrement: quantidade } }),
                 creditTransaction.create({ type: DELIVERY })
               ])
```

### Fluxo de dados — Cron de compra automática

```
Cron 00:00 America/Sao_Paulo (junto com createDailyOrders)
  │
  ▼
SchedulesService.processAutoBuy()
  │
  ├─ Busca usuários com autoRecharge.active = true
  │
  └─ Para cada usuário:
       │
       ├─ Modo "acabar" (mode: 'acabar'):
       │    ├─ Calcular consumoSemanal do Schedule ativo
       │    ├─ Se user.creditBalance < consumoSemanal:
       │    │    └─ OPÇÃO MVP: enviar push Pix "Sua recarga está pronta"
       │    │       (gerar QR Pix + push com deep-link)
       │    └─ Se não: ignorar
       │
       └─ Modo "toda semana" (mode: 'semanal'):
            ├─ Verificar se hoje === autoRecharge.weekday
            ├─ Se sim: gerar Pix de recarga + push notificação
            └─ Se não: ignorar
```

### Estrutura de arquivos — Fase 4

```
apps/api/src/
├── plugins/
│   ├── prisma.ts              (existente)
│   ├── authenticate.ts        (existente)
│   └── cron.ts                (NOVO — registra os 3 crons)
├── modules/
│   ├── auth/                  (existente)
│   ├── payments/              (existente — Fase 3)
│   ├── credits/               (existente — Fase 3)
│   ├── webhooks/              (existente — Fase 3)
│   ├── schedules/             (NOVO)
│   │   ├── schedules.route.ts
│   │   ├── schedules.controller.ts
│   │   ├── schedules.service.ts
│   │   ├── schedules.repository.ts
│   │   ├── schedules.schema.ts
│   │   └── __tests__/schedules.service.test.ts
│   ├── orders/                (NOVO)
│   │   ├── orders.route.ts
│   │   ├── orders.controller.ts
│   │   ├── orders.service.ts
│   │   ├── orders.repository.ts
│   │   ├── orders.schema.ts
│   │   └── __tests__/orders.service.test.ts
│   └── notifications/         (NOVO — apenas POST /users/push-token)
│       ├── notifications.route.ts
│       ├── notifications.controller.ts
│       └── notifications.service.ts

apps/web/src/
├── pages/client/
│   ├── ScheduleScreen.tsx     (NOVO — substitui PlaceholderScreen na rota /client/agenda)
│   └── SingleScreen.tsx       (NOVO — rota /client/agenda/pedido-unico)
├── hooks/
│   ├── useSchedule.ts         (NOVO — GET /schedules/me + PUT /schedules/me)
│   └── useOneSignalRegister.ts (NOVO — captura player_id e envia para backend)
└── routes/router.tsx          (MODIFICAR — atualizar rota /client/agenda)
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (backend e frontend) |
| Config file | Nenhum arquivo vitest.config — usa defaults via `"test": "vitest run"` no package.json |
| Quick run (backend) | `npm run test --workspace=apps/api` |
| Quick run (frontend) | `npm run test --workspace=apps/web` |
| Full suite | `npm run test --workspaces` |

### Phase Requirements → Test Map

| Req ID | Comportamento | Tipo | Comando Automatizado |
|--------|---------------|------|----------------------|
| SCHED-01 | `createSingleOrder` reserva créditos atomicamente | unit | `vitest run --reporter=verbose apps/api/src/modules/orders/__tests__/orders.service.test.ts` |
| SCHED-01 | `createSingleOrder` lança erro se saldo insuficiente | unit | idem |
| SCHED-02 | `upsertSchedule` cria novo Schedule se não existir | unit | `vitest run apps/api/src/modules/schedules/__tests__/schedules.service.test.ts` |
| SCHED-02 | `upsertSchedule` atualiza Schedule existente | unit | idem |
| SCHED-03 | `createDailyOrders` cria Order para cada Schedule ativo | unit | idem |
| SCHED-03 | `createDailyOrders` pula dias com quantidade 0 | unit | idem |
| SCHED-04 | `sendReconfigureReminders` chama OneSignal para usuários com `notifyReconfigure=true` | unit (mock OneSignal) | `vitest run apps/api/src/modules/schedules/__tests__/schedules.service.test.ts` |
| SCHED-05 | `BannerInsuficiente` renderiza quando `requerido > saldo` | unit (RTL) | `vitest run apps/web/src/components/client/__tests__/BannerInsuficiente.test.tsx` |
| SCHED-05 | `BannerInsuficiente` retorna null quando `requerido <= saldo` | unit (RTL) | idem |
| SCHED-06 | Cálculo de `cobertura = Math.floor(saldo / consumoSemanal)` correto | unit | `vitest run apps/web/src/hooks/__tests__/useSchedule.test.ts` |
| CRED-07 | `processAutoBuy` detecta modo "acabar" e gera push | unit | `vitest run apps/api/src/modules/schedules/__tests__/schedules.service.test.ts` |
| CRED-10 | `processAutoBuy` modo "semanal" dispara no dia correto | unit | idem |

### Sampling Rate

- **Por task commit:** `npm run test --workspace=apps/api` (backend) ou `npm run test --workspace=apps/web` (frontend)
- **Por wave merge:** `npm run test --workspaces`
- **Phase gate:** Suite completa verde antes do `/gsd:verify-work`

### Wave 0 Gaps (arquivos de teste a criar)

- [ ] `apps/api/src/modules/schedules/__tests__/schedules.service.test.ts` — cobre SCHED-01..04, CRED-07, CRED-10
- [ ] `apps/api/src/modules/orders/__tests__/orders.service.test.ts` — cobre SCHED-01
- [ ] `apps/web/src/components/client/__tests__/BannerInsuficiente.test.tsx` — cobre SCHED-05
- [ ] `apps/web/src/hooks/__tests__/useSchedule.test.ts` — cobre SCHED-06

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Aplica | Controle Standard |
|---------------|--------|------------------|
| V2 Authentication | sim | `fastify.authenticate` preHandler em todos os endpoints de schedules/orders |
| V3 Session Management | não (herdado da Fase 2) | — |
| V4 Access Control | sim | Verificar `userId === request.user.id` antes de qualquer operação em Schedule/Order |
| V5 Input Validation | sim | Zod schemas para body de `PUT /schedules/me` e `POST /orders` |
| V6 Cryptography | não | — |

### Known Threat Patterns

| Pattern | STRIDE | Mitigação |
|---------|--------|-----------|
| Cliente modifica Schedule de outro usuário | Elevation of Privilege | `where: { id: scheduleId, userId: request.user.id }` em todas as queries |
| Double-spend de créditos via requests paralelos | Tampering | `$runCommandRaw` com `$gte` condicional (Seção 4) |
| Push token de outro usuário | Spoofing | `POST /users/push-token` deve atualizar apenas `request.user.id` |
| Injeção de `weeklyQty` com quantidades negativas | Tampering | Zod: `z.number().int().min(0).max(12)` para cada dia |
| Data de pedido único no passado | Tampering | Validar `scheduledDate >= tomorrow` no backend |

---

## Environment Availability

| Dependência | Requerida Por | Disponível | Versão | Fallback |
|-------------|--------------|------------|--------|---------|
| Node.js | Todos | ✓ | Runtime do projeto | — |
| MongoDB Atlas | Prisma | ✓ (remoto) | Atlas remoto | — |
| ONESIGNAL_APP_ID | Push backend | Requer configuração | — | Env var placeholder (warning no console) |
| ONESIGNAL_REST_API_KEY | Push backend | Requer configuração | — | Env var placeholder (testes mocam) |
| VITE_ONESIGNAL_APP_ID | Push frontend | Já configurado (Fase 1) | — | — |

**Dependências faltantes sem fallback para push real:**
- `ONESIGNAL_APP_ID` e `ONESIGNAL_REST_API_KEY` precisam ser obtidas no painel OneSignal antes de rodar o cron de domingo.

---

## Assumptions Log

| # | Claim | Seção | Risco se errado |
|---|-------|-------|-----------------|
| A1 | `fastify-cron` plugin com Fastify v5 é suportado | Seção 1 | Baixo — peerDeps confirmam `^4.1.0 || ^5.0.0` |
| A2 | `$runCommandRaw` com `updates.q` funciona com `_id: { $oid: userId }` no Prisma | Seção 4 | Alto — formato ObjectId pode precisar de ajuste; testar em Wave 0 |
| A3 | `@@unique([userId, condominiumId])` no schema é suficiente para upsert | Seção 5 | Médio — MongoDB com Prisma pode exigir índice explícito; verificar ao rodar `prisma generate` |
| A4 | `OneSignal.User.PushSubscription.id` disponível em `react-onesignal` v3.5.5 | Seção 3 | Médio — versão pode não expor diretamente; fallback: usar `addEventListener("change")` |
| A5 | `cron.schedule` com `timezone` funciona em node-cron v4 | Seção 1 | Baixo — documentado na v3+, v4 mantém compatibilidade |
| A6 | `OrderType.SCHEDULED` (não `WEEKLY`) é o valor correto para Orders do cron | Seção 6 | Baixo — verificado no schema; CONTEXT.md usa terminologia diferente |
| A7 | Abordagem Pix automático para compra recorrente é aceitável para o MVP | Seção 8 | Alto — se o cliente exigir cobrança silenciosa no cartão, é necessário MP Subscriptions API |

---

## Open Questions (RESOLVED)

1. **Compra automática: Pix-first ou MP Subscriptions?**
   - O que sabemos: `cardTokenMp` atual é token one-time, não reusável sem CVV
   - **RESOLVIDO 2026-06-14:** Pix-first para MVP aprovado pelo usuário. Cron gera QR Pix + envia push. D-12 revisado no CONTEXT.md. Cobrança silenciosa no cartão (MP Subscriptions `/preapproval`) postergada.

2. **`@@unique([userId, condominiumId])` no Schedule: necessário?**
   - O que sabemos: Schema atual não tem o índice. MVP tem um condomínio por usuário
   - **RESOLVIDO 2026-06-14:** Adicionar `@@unique([userId, condominiumId])` ao schema. 04-01 inclui esta alteração no `schema.prisma`.

3. **Batching de push notifications no cron de domingo**
   - O que sabemos: OneSignal aceita até 20.000 `subscription_ids` por request
   - **RESOLVIDO 2026-06-14:** Envio em único request sem batching — MVP terá < 100 usuários. 04-02 implementa sem batching.

---

## Sources

### Primary (HIGH confidence)
- `apps/api/prisma/schema.prisma` — modelos Schedule, Order, User verificados diretamente
- `apps/api/src/modules/payments/payments.service.ts` — implementação de card token (Fase 3)
- `apps/api/src/modules/credits/credits.controller.ts` — endpoint `autoRecharge` existente
- `apps/api/src/server.ts` — estrutura de registros de plugins
- `apps/web/src/main.tsx` — OneSignal já inicializado
- `apps/web/src/components/client/QuantityStepper.tsx` — componente confirmado
- `apps/web/src/components/client/BannerInsuficiente.tsx` — componente confirmado
- `apps/web/src/contexts/AuthContext.tsx` — interface AuthUser com creditBalance

### Secondary (MEDIUM confidence)
- [npm: node-cron v4.2.1](https://www.npmjs.com/package/node-cron) — slopcheck OK, repositório oficial
- [npm: @onesignal/node-onesignal v5.8.0](https://www.npmjs.com/package/@onesignal/node-onesignal) — pacote oficial OneSignal
- [OneSignal REST API: Create Notification](https://documentation.onesignal.com/reference/create-notification) — campos `include_subscription_ids`, comportamento com player_id inválido
- [OneSignal WebSDK Reference](https://documentation.onesignal.com/docs/web-sdk-reference) — `OneSignal.User.PushSubscription.id`
- [Prisma Transactions com MongoDB](https://www.prisma.io/docs/orm/prisma-client/queries/transactions) — limitação de isolation levels
- [MP Subscriptions: Authorized Payments](https://www.mercadopago.com.co/developers/en/docs/subscriptions/integration-configuration/subscription-no-associated-plan/authorized-payments) — `/preapproval` API, card_token_id

### Tertiary (LOW confidence)
- [MP Card Token — uso único](https://www.mercadopago.com.br/developers/en/docs/subscriptions/additional-content/cardtoken) — confirmado que token Brick expira em 7 dias e é single-use

---

## Metadata

**Confidence breakdown:**
- Codebase (módulos, componentes, schema): HIGH — arquivos lidos diretamente
- `node-cron` API: MEDIUM — README lido, slopcheck OK, registry verificado
- OneSignal SDK backend: MEDIUM — README GitHub lido, documentação REST verificada
- OneSignal Web SDK: MEDIUM — documentação verificada para `PushSubscription.id`
- Prisma/MongoDB transactions: MEDIUM — documentação oficial verificada
- MP card token reusability: HIGH — documentação oficial clara: token é one-time

**Research date:** 2026-06-14
**Valid until:** 2026-07-14 (30 dias — stack estável exceto OneSignal SDK)
