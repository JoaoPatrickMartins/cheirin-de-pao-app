# Phase 10: Schema v1.1 + Crédito Manual Admin + Logout — Research

**Pesquisado:** 2026-06-19
**Domínio:** Prisma schema (MongoDB Atlas), Fastify API, React frontend
**Confiança:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Schema v1.1 aplica todos os campos de uma vez — uma única migração (`prisma db push`) que desbloqueia Phases 11–14. Não dividir em parciais.
- **D-02:** Campos adicionados:
  - `TransactionType.ADMIN_GRANT` — novo enum value
  - `NotificationType.CREDIT_GRANTED` — novo enum value
  - `CreditTransaction.adminId String? @db.ObjectId`
  - `CreditTransaction.reason String?`
  - `User.mpCustomerId String?`
  - model `SavedCard` (schema mínimo viável — ver D-07)
  - `Condominium.deliverySlots String[]`
  - `Schedule.days Json?`
- **D-03:** Botão '+ Adicionar créditos' fica dentro do card de saldo no `ClientDetailView` — abaixo do número de créditos.
- **D-04:** Modal centralizado com overlay escuro, reutilizando padrão `aria-modal="true"` do `ClientDetailView`.
- **D-05:** Seletor de motivo via chips horizontais (4 opções: Acerto, Bonificação, Compensação, Promoção) — reutiliza padrão `SegmentedControl`.
- **D-06:** Após confirmar: modal fecha, saldo atualizado imediatamente, toast de sucesso.
- **D-07:** Model `SavedCard` mínimo:
  ```
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  userId     String   @db.ObjectId
  mpCardId   String
  brand      String
  lastFour   String
  expiresAt  String
  isDefault  Boolean  @default(false)
  createdAt  DateTime @default(now())
  ```
- **D-08:** Entregador: ícone `LogOut` no canto superior direito do header do `CourierScreen`. Sem dialog de confirmação.
- **D-09:** Admin: item 'Sair' como último item do `AdminBottomNav`. Dialog de confirmação.
- **D-10:** Ambos chamam `AuthContext.logout()` diretamente.
- **D-11:** `NotificationType.CREDIT_GRANTED` novo enum value.
- **D-12:** Push: título `'Pãezinhos chegando! 🥐'`, corpo `'Você ganhou {N} pão(es) de crédito. Novo saldo: {total} pão(es).'`
- **D-13:** Notification in-app: `type=CREDIT_GRANTED`, `actionRoute: '/client/home'`.
- **D-14:** `CTA_CONFIG` recebe: `CREDIT_GRANTED: { label: 'Ver saldo', path: '/client/home' }`.
- **D-15:** Push: `additionalData: { screen: 'home' }` para deep link via `useOneSignalDeepLink`.

### Claude's Discretion

- Validação do campo quantidade no modal (mínimo 1, máximo razoável).
- Ícone específico do botão de logout do entregador (`LogOut` de lucide-react — ou o ícone `logout` já existente em `Icon.tsx`).
- Cores dos chips de motivo quando selecionado.
- Posicionamento exato do item 'Sair' no `AdminBottomNav` — último tab, com ícone `LogOut`.

### Deferred Ideas (OUT OF SCOPE)

- Histórico de ADMIN_GRANTs visível ao cliente no extrato de créditos.
- Motivo customizado (campo livre além das 4 opções).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CREDM-01 | Admin pode adicionar créditos manualmente a um cliente selecionando quantidade e motivo | Ponto de integração: `ClientDetailView` + novo modal + `POST /admin/clients/:id/grant-credits` |
| CREDM-02 | Operação registra `CreditTransaction` com `type=ADMIN_GRANT`, quantidade, adminId e motivo | Padrão `$transaction` verificado em `payments.repository.ts`; novo service `grantCredits()` |
| CREDM-03 | Cliente recebe push OneSignal + notificação in-app ao receber créditos manuais | Padrão `notifyAndPersist` verificado em `admin-orders.service.ts`; reutilizar exatamente |
| LGOUT-01 | Entregador tem botão de logout acessível | Header do `CourierScreen` linha ~82; ícone `logout` já existe em `Icon.tsx` |
| LGOUT-02 | Admin tem botão de logout acessível | `AdminBottomNav` precisa de item 'Sair' + dialog confirm; `AuthContext.logout()` já implementado |
</phase_requirements>

---

## Summary

A Phase 10 é a mais cirúrgica e preparatória do roadmap v1.1. Ela entrega três blocos independentes que, individualmente, são de baixa complexidade — mas o schema unificado é um pré-requisito hard para as Phases 11–14. Todo o código existente foi auditado e os padrões de integração estão claramente estabelecidos.

O principal risco técnico identificado é uma **inconsistência existente na API**: `GET /admin/clients/:id` retorna `{ client: User, schedule, recentOrders }` (estrutura aninhada), mas o frontend (`ClientDetailView`) faz cast direto para `ClienteDetalhe` esperando campos no nível raiz (`id`, `name`, `creditBalance`). Isso provavelmente funciona por acidente — o frontend possivelmente usa spread ou o Fastify serializa flat — mas o planner precisa verificar e documentar o comportamento real antes de confiar em `cliente.creditBalance` para exibir o saldo pós-grant. O caminho mais seguro para o refresh pós-grant é um re-fetch do endpoint `/admin/clients/:id` e mapeamento explícito do campo `creditBalance` vindo de `result.client.creditBalance` ou `result.creditBalance`.

O ícone `logout` já existe no dicionário `Ic` de `Icon.tsx` — não é necessário instalar lucide-react nem nenhuma dependência nova para os botões de logout. O toast segue o padrão inline sem biblioteca externa (verificado em `ScheduleScreen.tsx` e `SingleScreen.tsx`). O push OneSignal segue o padrão de `createOsClient()` + `notification.data` verificado em `admin-orders.service.ts`.

**Recomendação principal:** Nenhum pacote novo precisa ser instalado nesta fase. Todo código reutiliza padrões já establecidos.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schema v1.1 (enums + fields + SavedCard) | Database/Schema | — | `prisma db push` no MongoDB Atlas; sem migration |
| `POST /admin/clients/:id/grant-credits` | API / Backend | — | Operação com auditoria — creditBalance + CreditTransaction |
| Push OneSignal CREDIT_GRANTED | API / Backend | — | Servidor controla timing e payload; frontend não envia push |
| Notification in-app CREDIT_GRANTED | API / Backend | — | `createAndTrim()` existente, usado pelo mesmo service |
| Modal de grant no ClientDetailView | Frontend / Client | — | UI admin — input de quantidade e motivo |
| Toast pós-grant | Frontend / Client | — | Feedback local inline sem biblioteca |
| Logout ícone CourierScreen | Frontend / Client | — | Chama `AuthContext.logout()` — sem lógica de servidor |
| Logout item AdminBottomNav + dialog | Frontend / Client | — | Chama `AuthContext.logout()` — sem lógica de servidor |
| `CTA_CONFIG[CREDIT_GRANTED]` | Frontend / Client | — | Entrada de navegação na `NotificationsScreen` |
| `useOneSignalDeepLink` case `home` | Frontend / Client | — | Handler de clique de push; navega para `/client/home` |

---

## Standard Stack

### Core (não muda — verificado no codebase)

| Library | Versão atual | Propósito | Status |
|---------|-------------|-----------|--------|
| Prisma | 6.19.3 | ORM + schema MongoDB | Instalado [VERIFIED: schema.prisma header] |
| `@onesignal/node-onesignal` | instalado | Push notifications backend | Instalado [VERIFIED: imports em admin-orders.service.ts] |
| Fastify | instalado | HTTP framework API | Instalado [ASSUMED: versão exata não verificada] |
| React + Vite | instalado | Frontend PWA | Instalado [ASSUMED: versão exata não verificada] |
| Vitest | instalado | Testes unitários | Instalado [VERIFIED: vitest.config.ts] |

### Sem pacotes novos nesta fase

Esta fase não instala nenhuma dependência nova. Todos os padrões usam código e bibliotecas já presentes.

---

## Package Legitimacy Audit

> Nenhum pacote novo instalado nesta fase. Seção N/A.

**Pacotes removidos por slopcheck:** nenhum
**Pacotes suspeitos:** nenhum

---

## Architecture Patterns

### Diagrama de Fluxo — Crédito Manual Admin

```
Admin (browser)
    │
    ├─ [ClientDetailView] card de saldo
    │      └─ botão "+ Adicionar créditos"
    │             └─ abre modal (quantity + chip motivo)
    │                    └─ confirmar
    │
    ▼
POST /admin/clients/:id/grant-credits
    │  body: { quantity: number, reason: string }
    │  preHandler: [fastify.authenticate] (role ADMIN)
    │
    ├─ service.grantCredits(clientId, quantity, reason, adminId)
    │     ├─ prisma.$transaction([
    │     │     creditTransaction.create({ type: 'ADMIN_GRANT', adminId, reason }),
    │     │     user.update({ creditBalance: { increment: quantity } })
    │     │  ])
    │     ├─ push OneSignal (best-effort, silencioso se falhar)
    │     └─ notifications.createAndTrim({ type: 'CREDIT_GRANTED' })
    │
    └─ 200 { creditBalance: novoSaldo }
          │
          ▼
[ClientDetailView] atualiza state creditBalance → fecha modal → exibe toast
```

### Diagrama de Fluxo — Logout

```
[CourierScreen header] ícone logout
    └─ onClick → AuthContext.logout()
                      ├─ localStorage.removeItem('auth_token')
                      ├─ localStorage.removeItem('auth_user')
                      ├─ setToken(null) / setUser(null)
                      └─ navigate('/')

[AdminBottomNav] item 'Sair'
    └─ onClick → setShowLogoutDialog(true)
                      └─ dialog: [Cancelar] / [Sair]
                              └─ Sair → AuthContext.logout()
```

### Padrão 1: Operação Atômica de Crédito (Prisma.$transaction)

**Verificado em:** `apps/api/src/modules/payments/payments.repository.ts` linha 36

```typescript
// Padrão sequential transaction (array) — usado em creditUserBalance
const [, updatedUser] = await this.prisma.$transaction([
  this.prisma.creditTransaction.create({
    data: {
      userId,
      type: 'PURCHASE',
      quantity,
      referenceId: paymentId,
      description: `Compra de ${quantity} crédito(s)`,
    },
  }),
  this.prisma.user.update({
    where: { id: userId },
    data: { creditBalance: { increment: quantity } },
  }),
])
return updatedUser
```

**Para ADMIN_GRANT:** Usar o mesmo padrão, adicionando `adminId` e `reason` ao `CreditTransaction`. [VERIFIED: codebase]

### Padrão 2: notifyAndPersist (Push + In-App)

**Verificado em:** `apps/api/src/modules/admin-orders/admin-orders.service.ts` linhas 80–119

```typescript
// Pattern: createOsClient() + notification.data + createAndTrim()
import * as OneSignal from '@onesignal/node-onesignal'

function createOsClient() {
  const configuration = OneSignal.createConfiguration({
    restApiKey: process.env.ONESIGNAL_REST_API_KEY!,
  })
  return new OneSignal.DefaultApi(configuration)
}

// push best-effort (D-06: falha é silenciosa)
if (user?.oneSignalPlayerId) {
  try {
    const osClient = createOsClient()
    const notification = new OneSignal.Notification()
    notification.app_id = process.env.ONESIGNAL_APP_ID!
    notification.include_subscription_ids = [user.oneSignalPlayerId]
    notification.headings = { pt: 'Título' }
    notification.contents = { pt: 'Corpo da mensagem' }
    notification.data = { screen: 'home' }
    await osClient.createNotification(notification)
  } catch (pushErr) {
    this.fastify.log.warn({ err: pushErr }, '[módulo] falha ao enviar push — ignorado')
  }
}

// persist obrigatório — fora do try do push
await this.createAndTrim({
  userId,
  type: 'CREDIT_GRANTED',
  title: 'Título',
  body: 'Corpo',
  actionRoute: '/client/home',
})
```

[VERIFIED: codebase — padrão idêntico ao de admin-orders.service.ts]

### Padrão 3: Modal com aria-modal (ClientDetailView)

**Verificado em:** `apps/web/src/components/admin/ClientDetailView.tsx` linhas 487–606

Estrutura do dialog existente (bloquear/desbloquear):
- `position: fixed, inset: 0` — overlay escuro com `rgba(0,0,0,0.4)`
- `alignItems: 'flex-end'` — modal aparece na parte inferior (bottom sheet)
- `background: var(--color-surface), borderRadius: '20px 20px 0 0'`
- Botões: Cancelar (border transparent) + Confirmar (background accent)
- `onClick` no overlay fecha o modal

**Nota:** O CONTEXT.md D-04 fala em "modal centralizado". O padrão atual do projeto é bottom sheet (flex-end). Para CREDM o planner deve definir se usa bottom sheet (consistente com o projeto) ou centered modal.

### Padrão 4: Toast Inline

**Verificado em:** `apps/web/src/pages/client/ScheduleScreen.tsx` linhas 49–92

```typescript
const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null)

// disparar:
setToast({ message: 'Mensagem de sucesso', ok: true })
setTimeout(() => setToast(null), 2500)

// JSX:
{toast && (
  <div style={{
    position: 'fixed',
    top: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9999,
    background: 'var(--color-espresso)',
    color: 'var(--color-primary-btn-text)',
    borderRadius: 12,
    padding: '12px 16px',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 14,
    whiteSpace: 'nowrap',
    boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
  }}>
    {toast.message}
  </div>
)}
```

[VERIFIED: codebase — padrão existente em ScheduleScreen.tsx e SingleScreen.tsx]

### Padrão 5: SegmentedControl (chips de seleção)

**Verificado em:** `apps/web/src/components/courier/SegmentedControl.tsx`

O `SegmentedControl` existente é **hard-coded** para as opções `list | route` com interface fechada:
```typescript
interface SegmentedControlProps {
  value: 'list' | 'route'
  onChange: (v: 'list' | 'route') => void
}
```

Isso significa que ele **não pode ser reutilizado diretamente** como componente genérico para os chips de motivo (Acerto, Bonificação, Compensação, Promoção). O planner deve escolher entre:
1. Criar chips de motivo inline no modal (simples, específico — recomendado para esta fase)
2. Generalizar o SegmentedControl existente (impacto maior — arriscado)

**Recomendação:** Implementar chips de motivo inline no modal do grant, seguindo o mesmo estilo visual do SegmentedControl mas sem modificar o componente existente.

### Padrão 6: Ícone `logout` — Já Presente em Icon.tsx

**Verificado em:** `apps/web/src/components/brand/Icon.tsx` linha 32

```typescript
logout: 'M15 12H4M11 8l-4 4 4 4M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5',
```

O ícone `logout` já está no dicionário `Ic`. Uso: `<Icon name="logout" size={22} />`. Não precisa de lucide-react.

### Anti-Patterns a Evitar

- **Não usar lucide-react:** O projeto tem seu próprio sistema de ícones SVG inline em `Icon.tsx`. O ícone `logout` já existe.
- **Não instalar biblioteca de toast:** O padrão do projeto é toast inline com `useState` + `setTimeout`.
- **Não usar `prisma.user.update` direto para incrementar saldo:** Usar `$transaction` para garantir atomicidade com a criação do `CreditTransaction`.
- **Não modificar `SegmentedControl.tsx` existente:** Ele tem interface fechada para `list | route`. Criar chips inline no modal.
- **Não esquecer o `adminId` no `CreditTransaction`:** O campo `adminId` vem de `request.user.id` (JWT), nunca do body.

---

## Don't Hand-Roll

| Problema | Não construir | Usar em vez | Por quê |
|----------|---------------|-------------|---------|
| Push notifications | lógica própria de notif | padrão `createOsClient()` de `admin-orders.service.ts` | Já estabelecido no projeto; inclui best-effort + log de falha |
| Notificação in-app com trim | lógica própria | `notifications.service.ts` `createAndTrim()` | Já implementado com trim automático de 30 notif/usuário |
| Atualização atômica de saldo | `update` simples | `prisma.$transaction` | Garante consistência entre `creditBalance` e `CreditTransaction` |
| Ícone logout | nova lib de ícones | `<Icon name="logout" />` | Já presente em `Ic` dict de `Icon.tsx` |
| Toast de feedback | lib sonner/react-hot-toast | toast inline com `useState` | Padrão estabelecido em ScheduleScreen e SingleScreen |

---

## Runtime State Inventory

> Esta fase não é de rename/refactor. Não há estado de runtime afetado pelas mudanças.

**Nada encontrado em nenhuma categoria** — verificado por tipo de mudança (schema additive-only, novas rotas, novos componentes).

---

## Common Pitfalls

### Pitfall 1: API retorna `{ client, schedule, recentOrders }` mas frontend espera campos planos

**O que pode dar errado:** O `AdminClientsService.getDetail()` retorna `{ client: User, schedule, recentOrders }`. O controller envia esse objeto diretamente. O `ClientDetailView` faz `setCliente(await res.json() as ClienteDetalhe)` esperando campos como `creditBalance` no nível raiz.

**Por que acontece:** O service retorna uma estrutura aninhada (`client.creditBalance`) mas o frontend trata como se os campos fossem planos (`cliente.creditBalance`). Pode funcionar hoje por TypeScript não verificar em runtime — `cliente.creditBalance` seria `undefined` silenciosamente.

**Como evitar:** Antes de implementar o refresh pós-grant, o planner deve:
1. Verificar o que `/admin/clients/:id` realmente retorna em runtime (inspecionar com curl ou log)
2. Se retornar `{ client: { creditBalance } }`, o controller precisa de flatten: `return reply.send({ ...result.client, schedule: result.schedule, recentOrders: result.recentOrders })`
3. O endpoint de grant (`POST /admin/clients/:id/grant-credits`) deve retornar `{ creditBalance: novoSaldo }` explicitamente para o refresh ser simples

**Sinais de alerta:** `cliente.creditBalance` renderizado como `undefined` na tela do admin.

### Pitfall 2: Teste de AdminBottomNav espera exatamente 5 botões

**O que pode dar errado:** O teste `AdminBottomNav.test.tsx` linha 15 verifica `expect(buttons).toHaveLength(5)`. Adicionar o item 'Sair' cria um 6º botão e **quebra o teste existente**.

**Por que acontece:** O teste foi escrito para a estrutura de 5 abas do Phase 7. Ao adicionar 'Sair', o count aumenta.

**Como evitar:** O planner deve incluir atualização do teste `AdminBottomNav.test.tsx` na mesma tarefa de modificação do componente. O novo teste deve:
- Verificar que há 6 botões (5 tabs + 1 Sair)
- Verificar que o botão 'Sair' existe com `aria-label="Sair"`
- Verificar que o dialog de confirmação aparece ao clicar em 'Sair'

### Pitfall 3: `TransactionType` e `NotificationType` são enums Prisma — precisam de `prisma generate` após db push

**O que pode dar errado:** Adicionar `ADMIN_GRANT` ao enum `TransactionType` e `CREDIT_GRANTED` ao `NotificationType` requer:
1. `prisma db push` — atualiza o Atlas (schemaless, não falha)
2. `prisma generate` — regenera o Prisma Client TypeScript

Se o `generate` for esquecido, o código que usa `type: 'ADMIN_GRANT'` vai falhar em TypeScript com "Type 'ADMIN_GRANT' is not assignable to type 'TransactionType'".

**Como evitar:** O plano Wave 0 deve sempre conter as duas operações sequenciais: `prisma db push && npx prisma generate`.

### Pitfall 4: `SegmentedControl` existente não é genérico

**O que pode dar errado:** Tentar passar as 4 opções de motivo como `value` ao `SegmentedControl` existente vai falhar porque a interface aceita apenas `'list' | 'route'`.

**Como evitar:** Criar chips de motivo inline no modal de grant. Não modificar o `SegmentedControl` existente para não introduzir regressão no `CourierScreen`.

### Pitfall 5: Enum `CREDIT_GRANTED` + getTone/getIcon na NotificationsScreen não tratam o novo tipo

**O que pode dar errado:** A `NotificationsScreen` tem `getTone()` e `getIcon()` que retornam `'neutral'` / `'repeat'` para tipos não reconhecidos. `CREDIT_GRANTED` cairia no fallback `neutral` com ícone `repeat` — funcional mas não ideal.

**Como evitar:** O plano deve incluir adição de `CREDIT_GRANTED` ao `getTone()` (tom `'gold'`) e `getIcon()` (ícone `'coin'` ou `'wallet'`) na `NotificationsScreen`.

### Pitfall 6: Logout admin — `AdminTab` type não inclui 'logout'

**O que pode dar errado:** O `AdminLayout` usa `type AdminTab = 'painel' | 'pedido' | 'entregas' | 'clientes' | 'gestao'`. O `AdminBottomNav` recebe `activeTab: AdminTab`. Adicionar 'Sair' como um tab normal exigiria adicionar `'logout'` ao type — mas 'Sair' não é uma aba navegável, é uma ação.

**Como evitar:** Implementar 'Sair' como um botão especial **fora do array `TABS`** no `AdminBottomNav`, com lógica própria de `onClick` que recebe uma prop `onLogout: () => void`. O `AdminLayout` passa `onLogout={() => { setShowLogoutDialog(true) }}`. O dialog de confirmação fica no `AdminLayout` ou no `AdminBottomNav`. Assim `AdminTab` não precisa ser modificado.

**Alternativa (mais simples):** Dialog de confirmação dentro do `AdminBottomNav` com `useState` local — sem prop `onLogout`.

---

## Code Examples

### Schema v1.1 — Diff completo

```prisma
// TransactionType — adicionar ADMIN_GRANT
enum TransactionType {
  PURCHASE
  DELIVERY
  REFUND
  EXPIRY
  ADMIN_GRANT  // novo — Phase 10
}

// NotificationType — adicionar CREDIT_GRANTED
enum NotificationType {
  DELIVERY_EVE
  DELIVERY_DONE
  LOW_CREDIT
  CUTOFF
  RECONFIGURE
  CREDIT_PURCHASED
  CREDIT_GRANTED  // novo — Phase 10
}

// CreditTransaction — adicionar adminId e reason
model CreditTransaction {
  id          String          @id @default(auto()) @map("_id") @db.ObjectId
  userId      String          @db.ObjectId
  type        TransactionType
  quantity    Int
  referenceId String?
  description String?
  adminId     String?         @db.ObjectId  // novo — quem fez o grant
  reason      String?                        // novo — acerto/bonificação/compensação/promoção
  createdAt   DateTime        @default(now())
}

// User — adicionar mpCustomerId
model User {
  // ... campos existentes ...
  mpCustomerId  String?  // novo — prep Phase 12
}

// Condominium — adicionar deliverySlots
model Condominium {
  // ... campos existentes ...
  deliverySlots  String[]  // novo — prep Phase 13 (HH:MM array)
}

// Schedule — adicionar days
model Schedule {
  // ... campos existentes ...
  days  Json?  // novo — prep Phase 14 (nullable)
}

// SavedCard — novo model (collection 18)
model SavedCard {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  userId    String   @db.ObjectId
  mpCardId  String
  brand     String
  lastFour  String
  expiresAt String
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

[VERIFIED: schema base em apps/api/prisma/schema.prisma]

### Backend — grantCredits service

```typescript
// Em admin-clients.service.ts — novo método
async grantCredits(
  clientId: string,
  quantity: number,
  reason: string,
  adminId: string,
): Promise<{ creditBalance: number }> {
  const user = await this.prisma.user.findUnique({ where: { id: clientId } })
  if (!user || user.role !== 'CLIENT') {
    throw { statusCode: 404, message: 'Cliente não encontrado' }
  }

  // Atomicamente: cria CreditTransaction + incrementa creditBalance
  const [, updatedUser] = await this.prisma.$transaction([
    this.prisma.creditTransaction.create({
      data: {
        userId: clientId,
        type: 'ADMIN_GRANT',
        quantity,
        adminId,
        reason,
        description: `Grant manual: ${reason}`,
      },
    }),
    this.prisma.user.update({
      where: { id: clientId },
      data: { creditBalance: { increment: quantity } },
    }),
  ])

  // Push + Notification (padrão notifyAndPersist)
  await this.notifyGrantCredits(clientId, quantity, updatedUser.creditBalance)

  return { creditBalance: updatedUser.creditBalance }
}
```

[ASSUMED: estrutura exata — baseada nos padrões verificados de payments.repository.ts e admin-orders.service.ts]

### Frontend — Chips de motivo inline

```tsx
// Chips de motivo — inline no modal de grant (não usar SegmentedControl existente)
const MOTIVOS = ['Acerto', 'Bonificação', 'Compensação', 'Promoção'] as const
type Motivo = typeof MOTIVOS[number]

// State:
const [motivo, setMotivo] = useState<Motivo | null>(null)

// JSX:
<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
  {MOTIVOS.map((m) => (
    <button
      key={m}
      onClick={() => setMotivo(m)}
      style={{
        padding: '8px 14px',
        borderRadius: 999,
        border: motivo === m ? 'none' : '1.5px solid var(--color-border)',
        background: motivo === m ? 'var(--color-gold)' : 'transparent',
        color: motivo === m ? '#1E1207' : 'var(--color-text)',
        fontFamily: 'var(--font-body)',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        minHeight: 44,
      }}
    >
      {m}
    </button>
  ))}
</div>
```

[ASSUMED: baseado no padrão visual dos botões existentes no projeto]

### Frontend — Logout no CourierScreen

```tsx
// Adicionar no header do CourierScreen (linha ~88)
// O header já tem justifyContent: 'space-between'
// BreadMark fica à esquerda, logout fica à direita

import { useAuth } from '../../hooks/useAuth'

const { logout } = useAuth()

// No JSX do header, substituir o div de "Textos" por dois elementos:
<div style={{ textAlign: 'right', flex: 1 }}>
  {/* textos existentes */}
</div>
<button
  onClick={logout}
  aria-label="Sair"
  style={{
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 8,
    display: 'flex',
    alignItems: 'center',
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
  }}
>
  <Icon name="logout" size={22} color="var(--color-text-ter)" />
</button>
```

[ASSUMED: baseado na estrutura atual do header do CourierScreen]

---

## State of the Art

| Abordagem Antiga | Abordagem Atual | Quando Mudou | Impacto |
|------------------|-----------------|-------------|---------|
| Prisma migrate dev | `prisma db push` | Desde Phase 1 | MongoDB não suporta migrations; db push é additive-only no Atlas |
| lucide-react para ícones | `Icon.tsx` + dicionário `Ic` | Phase 6 (CourierScreen) | Ícone `logout` já presente — não instalar lucide-react |
| Library de toast (sonner) | `useState` inline | Phase 4 (ScheduleScreen) | Toast inline sem dependência; padrão estabelecido |

**Deprecated/outdated:**
- `prisma migrate dev`: Nunca usar — header do schema.prisma diz explicitamente. Usar apenas `prisma db push` + `prisma generate`.

---

## Assumptions Log

| # | Claim | Seção | Risco se Errado |
|---|-------|-------|-----------------|
| A1 | Controller `getDetail` retorna estrutura aninhada `{ client, schedule, recentOrders }` e frontend funciona por acidente de TypeScript cast | Pitfall 1 | Se o controller já aplica flatten antes de enviar, o Pitfall 1 não existe e o refresh pode ser feito mais simplesmente |
| A2 | `grantCredits` deve ser método novo em `admin-clients.service.ts` (não em `credits.service.ts`) | Backend patterns | Colocar em credits.service.ts também funciona; a escolha afeta onde ficam os testes |
| A3 | Dialog de confirmação de logout admin fica dentro do `AdminBottomNav` com state local | Frontend patterns | Pode ser mais limpo colocar no `AdminLayout` — afeta prop drilling vs encapsulamento |
| A4 | `Condominium.deliverySlots String[]` não quebra documentos existentes no Atlas | Schema v1.1 | MongoDB Atlas aceita `String[]` como array vazio `[]` para documentos antigos; deve ser seguro |
| A5 | O endpoint `POST /admin/clients/:id/grant-credits` deve retornar `{ creditBalance }` para o refresh frontend | API design | Se retornar outro formato, o frontend precisa fazer segundo fetch |

---

## Open Questions

1. **Discrepância getDetail: aninhado vs flat**
   - O que sabemos: `admin-clients.service.ts` retorna `{ client: User, schedule, recentOrders }` e o controller faz `send(result)` diretamente.
   - O que não está claro: Se o frontend hoje acessa `cliente.creditBalance` corretamente ou se há um bug silencioso.
   - Recomendação: O planner deve incluir na Wave 0 uma verificação do endpoint real com `curl` ou teste de integração, e corrigir o controller se necessário (flatten dos campos de `client` para o nível raiz).

2. **Dialog de confirmação — no componente ou no layout?**
   - O que sabemos: `AdminBottomNav` é stateless hoje. `AdminLayout` tem o state de tab.
   - O que não está claro: Qual abordagem é menos disruptiva.
   - Recomendação: State do dialog no `AdminBottomNav` (local) — evita prop drilling e não modifica `AdminLayout`.

---

## Environment Availability

> Esta fase não requer ferramentas externas além das já em uso.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Prisma CLI | prisma db push + generate | ✓ | 6.19.3 | — |
| MongoDB Atlas | schema push | ✓ | remoto | — |
| `@onesignal/node-onesignal` | push CREDIT_GRANTED | ✓ | instalado | — |
| ONESIGNAL_APP_ID env var | push | ✓ [ASSUMED] | — | push silenciosamente falha (best-effort) |
| ONESIGNAL_REST_API_KEY env var | push | ✓ [ASSUMED] | — | push silenciosamente falha (best-effort) |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework API | Vitest (node environment) |
| Framework Web | Vitest + jsdom + @testing-library/react |
| Config API | `apps/api/vitest.config.ts` |
| Config Web | `apps/web/vitest.config.ts` |
| Quick run API | `cd apps/api && npx vitest run` |
| Quick run Web | `cd apps/web && npx vitest run` |
| Full suite | `npm run test` na raiz (Turborepo) |

### Phase Requirements → Test Map

| Req ID | Behavior | Tipo | Comando | Arquivo existe? |
|--------|----------|------|---------|-----------------|
| CREDM-02 | grantCredits registra CreditTransaction ADMIN_GRANT + incrementa creditBalance atomicamente | unit | `cd apps/api && npx vitest run --reporter=verbose src/modules/admin-clients` | ❌ Wave 0 |
| CREDM-02 | grantCredits com role não-CLIENT retorna 404 | unit | idem | ❌ Wave 0 |
| CREDM-03 | push OneSignal chamado com additionalData.screen = 'home' | unit (mock OneSignal) | idem | ❌ Wave 0 |
| LGOUT-02 | AdminBottomNav renderiza botão 'Sair' | unit | `cd apps/web && npx vitest run --reporter=verbose src/components/admin` | ❌ atualizar existente |
| LGOUT-02 | AdminBottomNav teste existente agora espera 6 botões | unit | idem | ❌ atualizar |

### Wave 0 Gaps

- [ ] `apps/api/src/modules/admin-clients/__tests__/admin-clients.service.test.ts` — adicionar describe `grantCredits` com 3 cases (CREDM-02)
- [ ] `apps/web/src/components/admin/__tests__/AdminBottomNav.test.tsx` — atualizar `toHaveLength(5)` → `toHaveLength(6)` e adicionar test de botão Sair (LGOUT-02)
- [ ] Não há gaps de framework — infraestrutura de testes completa.

### Sampling Rate

- **Por commit de tarefa:** `cd apps/api && npx vitest run` (backend) ou `cd apps/web && npx vitest run` (frontend)
- **Por wave merge:** `npm run test` na raiz
- **Phase gate:** Suite completa verde antes de `/gsd:verify-work`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | sim | JWT via `fastify.authenticate` preHandler — já implementado |
| V4 Access Control | sim | `request.user?.role !== 'ADMIN'` — padrão existente em todos os controllers admin |
| V5 Input Validation | sim | Zod schema para body de `grant-credits` (quantity: min 1, reason: enum) |
| V6 Cryptography | não | Nenhuma operação criptográfica nova |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Admin grant para usuário não-CLIENT | Elevation of Privilege | Verificar `role === 'CLIENT'` no service antes do grant — padrão já em `blockToggle` |
| `quantity` negativo ou zero no body | Tampering | Zod: `z.number().int().min(1).max(500)` no schema do endpoint |
| `adminId` manipulado via body | Tampering | `adminId` sempre vem de `request.user.id` (JWT) — nunca do body |
| `screen: 'home'` deep link malicioso via push | Tampering | Handler `useOneSignalDeepLink` só navega para rotas `/client/home` — sem exec de código |

---

## Sources

### Primary (HIGH confidence)
- `apps/api/prisma/schema.prisma` — schema completo auditado
- `apps/api/src/modules/admin-orders/admin-orders.service.ts` — padrão notifyAndPersist verificado
- `apps/api/src/modules/payments/payments.repository.ts` — padrão $transaction verificado
- `apps/api/src/modules/admin-clients/*` — estrutura do módulo verificada
- `apps/web/src/components/admin/ClientDetailView.tsx` — componente auditado completo
- `apps/web/src/components/admin/AdminBottomNav.tsx` — componente auditado
- `apps/web/src/pages/courier/CourierScreen.tsx` — componente auditado
- `apps/web/src/contexts/AuthContext.tsx` — `logout()` verificado linhas 63–76
- `apps/web/src/hooks/useOneSignalDeepLink.ts` — hook verificado
- `apps/web/src/pages/client/NotificationsScreen.tsx` — `CTA_CONFIG` verificado
- `apps/web/src/components/brand/Icon.tsx` — ícone `logout` verificado linha 32

### Secondary (MEDIUM confidence)
- `apps/web/src/components/courier/SegmentedControl.tsx` — confirmado que é hard-coded para list/route
- `apps/web/src/components/admin/__tests__/AdminBottomNav.test.tsx` — teste de 5 botões verificado linha 15

---

## Metadata

**Breakdown de confiança:**
- Schema v1.1: HIGH — campos verificados no schema atual; padrão `db push` estabelecido desde Phase 1
- Padrões backend (grantCredits, push, transaction): HIGH — código verificado diretamente nos serviços existentes
- Padrões frontend (modal, toast, ícones): HIGH — componentes verificados no codebase
- Integração getDetail/creditBalance: MEDIUM — discrepância identificada mas não testada em runtime

**Data da pesquisa:** 2026-06-19
**Válido até:** 2026-07-19 (schema estável; codebase muda com implementação)
