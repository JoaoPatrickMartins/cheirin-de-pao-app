# Architecture: Integração das Features v1.1 — Cheirin de Pão

**Milestone:** v1.1 — Features adicionais ao sistema existente  
**Pesquisado em:** 2026-06-18  
**Confiança geral:** HIGH (baseado em leitura direta do codebase + SDK instalado)

---

## Contexto: Arquitetura Atual

Antes de detalhar cada feature, o mapa de responsabilidades atual:

| Camada | O que faz |
|--------|-----------|
| `schema.prisma` | 17 collections MongoDB. Toda mudança de schema requer apenas `prisma generate` (sem migrations). |
| `modules/*/service.ts` | Lógica de negócio. Instancia repository, nunca acessa `fastify.prisma` diretamente nos métodos públicos (usa `this.prisma` getter). |
| `modules/*/repository.ts` | Queries Prisma. Nunca tem lógica de negócio. |
| `modules/*/route.ts` | Define endpoints Fastify com schema OpenAPI inline. Delega para controller. |
| `plugins/cron.ts` | 4 cron jobs. Instancia `SchedulesService` diretamente — único ponto de entrada para os crons. |
| `plugins/authenticate.ts` | `fastify.authenticate` preHandler. Decodifica JWT, injeta `request.user`. |
| Frontend `hooks/` | Toda lógica de estado e fetch encapsulada em custom hooks. As telas são "burras". |
| Frontend `lib/apiFetch.ts` | Wrapper do fetch com Authorization header injetado automaticamente. |

---

## Feature 1: Cartões Salvos (Múltiplos)

### Situação atual

`User.cardTokenMp String?` armazena um único token de uso único do Mercado Pago Bricks. Tokens Bricks são **one-shot** — válidos para uma transação, não para cobrança recorrente. Para cartões salvos reais, o MP exige o fluxo Customer + Card:

1. Criar `Customer` no MP: `POST /v1/customers` → retorna `customer_id`
2. Salvar cartão: `POST /v1/customers/{customer_id}/cards` com `token` do Bricks → retorna `card_id` permanente
3. Cobrar: `POST /v1/payments` com `{ customer_id, token: card_id }` — sem o usuário precisar digitar novamente

O SDK v3 instalado (`mercadopago@^3.1.0`) já expõe a classe `Customer` com os métodos `create()`, `createCard()`, `listCards()`, `removeCard()`. Confirmado em `/node_modules/mercadopago/dist/clients/customer/index.js`.

### Mudanças no Schema

**NOVO model `SavedCard`** (nova collection):

```prisma
model SavedCard {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  userId          String   @db.ObjectId
  mpCustomerId    String   // ID do Customer no Mercado Pago (ex: "123456789-abc...")
  mpCardId        String   // ID do Card no Mercado Pago (ex: "1234567890")
  lastFourDigits  String   // Exibição: "4242"
  expirationMonth Int      // Mês de validade: 12
  expirationYear  Int      // Ano de validade: 2027
  paymentMethodId String   // "visa", "master", etc.
  cardholderName  String
  isDefault       Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([userId])
}
```

**MODIFICAR `User`**: remover `cardTokenMp String?` após migração silenciosa (o campo pode ficar obsoleto no schema mas não precisa ser dropado — MongoDB ignora campos extras).

**ADICIONAR `mpCustomerId String?` no `User`**: o Customer MP é one-per-user, criado na primeira vez que o usuário salva um cartão.

```prisma
// Adicionar em User:
mpCustomerId  String?   // ID do Customer no Mercado Pago — criado ao salvar primeiro cartão
```

**Por que `SavedCard` como collection separada e não array embedded?**

- MongoDB embedded arrays são limitados para operações individuais (remover um item específico é verboso)
- Permite `@@index([userId])` para lookup eficiente
- Permite `isDefault` com update simples (`updateMany` para resetar, `update` para setar)
- O campo `mpCardId` é o identificador permanente no MP — não é um token one-shot

### Mudanças na API

**NOVO módulo `saved-cards`** (não polui o módulo `payments` existente):

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/saved-cards` | Lista cartões do usuário autenticado |
| `POST` | `/saved-cards` | Salva novo cartão (recebe `token` do Bricks) |
| `DELETE` | `/saved-cards/:id` | Remove cartão (por ID interno) |
| `PATCH` | `/saved-cards/:id/default` | Define como padrão |

**Fluxo de `POST /saved-cards`** (service):

```
1. Buscar user no DB — se não tem mpCustomerId → Customer.create({ body: { email } }) → salvar mpCustomerId no User
2. Customer.createCard({ customerId, body: { token } }) → retorna card com id, last_four_digits, etc.
3. Criar SavedCard no DB com os dados do card
4. Retornar SavedCard criado
```

**MODIFICAR `POST /payments/card`**: aceitar `savedCardId` como alternativa ao `token`:

```
Se body.savedCardId:
  1. Buscar SavedCard pelo ID (valida que pertence ao userId)
  2. Usar payment.create({ body: { customer_id, token: savedCard.mpCardId, ... } })
Se body.token:
  fluxo atual — sem mudança
```

O `CardPayment` Brick sempre gera um `token` novo — a UI de "cartão salvo" **não usa o Brick**. Usa uma lista dos cartões salvos + confirmação de CVV (se necessário). O CVV para transação com cartão salvo pode ser obrigatório dependendo do banco emissor — isso é controlado pelo campo `security_code.length` retornado pelo MP ao listar cards.

**MODIFICAR `webhooks.service.ts`**: nenhuma mudança necessária. O webhook já reconcilia por `mpPaymentId` — não depende do método de tokenização.

### Mudanças no Frontend

**NOVA tela `SavedCardsScreen`** em `/client/creditos/cartoes`:

- Lista `GET /saved-cards`
- Botão "Adicionar cartão" → navega para `CardPaymentScreen` com flag `saveCard: true`
- Botão "Remover" → `DELETE /saved-cards/:id`
- Toggle "Padrão" → `PATCH /saved-cards/:id/default`

**MODIFICAR `CardPaymentScreen`**:

- Após pagamento aprovado, se `state.saveCard === true` → chamar `POST /saved-cards` com o `token` do Brick
- O `token` já está em `formData.token` no `handleSubmit` — apenas passar para o endpoint

**MODIFICAR `CombosScreen` / `AutoBuyScreen`**:

- Exibir cartões salvos como opção de pagamento rápido (lista + "Pagar com cartão salvo")
- Ao selecionar cartão salvo, não navegar para `CardPaymentScreen` — fazer `POST /payments/card` com `savedCardId` diretamente

**MODIFICAR `AutoBuyScreen`** (compra recorrente):

- Permitir vincular um `savedCardId` ao `autoRecharge` Json no User
- O `processAutoBuy` no service pode então cobrar diretamente sem depender de push

### Impacto nos Crons

**MODIFICAR `processAutoBuy` em `schedules.service.ts`**:

Atualmente envia push pedindo ao cliente finalizar a compra manualmente (comentário no código: "Pix-first MVP"). Com cartão salvo:

```
Se user tem autoRecharge.savedCardId:
  → POST /v1/payments com customer_id + mpCardId (cobrança direta)
  → Criar Payment no DB
  → Reconciliação via webhook normal
Se não tem savedCardId:
  → comportamento atual (push + pix manual)
```

**Dependência de build**: `SavedCard` model deve existir antes de qualquer work no frontend ou no cron.

---

## Feature 2: Horários de Entrega por Condomínio

### Situação atual

`ScheduleBodySchema` define `deliveryTime: z.enum(['06:30', '07:00', '07:30', '08:00'])` — hardcoded no schema Zod. Qualquer condomínio aceita qualquer horário desses 4. Não há validação de que o condomínio oferece aquele horário.

### Mudanças no Schema

**OPÇÃO RECOMENDADA: array de strings embedded no `Condominium`**

```prisma
model Condominium {
  // ... campos existentes ...
  deliverySlots  String[]  @default([])  // ex: ["06:30", "07:00", "08:00"]
}
```

**Por que não uma collection `DeliverySlot` separada?**

- Os slots são simples strings de horário — sem metadados adicionais por slot
- Uma collection separada seria over-engineering para esse domínio
- `String[]` em MongoDB é um array nativo — eficiente para leitura e escrita
- Admin pode editar via `PATCH /admin/condominiums/:id` passando o novo array

**Por que não `Json`?**

- `String[]` é tipado no Prisma — retorna `string[]` sem casting manual
- Mais simples que `Json` para arrays homogêneos

**Valores válidos**: manter a lista hardcoded no backend como enum de validação: `['06:00', '06:30', '07:00', '07:30', '08:00', '08:30']`. A lista de horários disponíveis para o Condomínio é um subconjunto desses.

### Mudanças na API

**MODIFICAR `PUT /admin/condominiums/:id`** (módulo `admin-condominiums`):

- Adicionar `deliverySlots: z.array(z.enum([...horarios_validos])).optional()` no `UpdateCondominiumBody`

**MODIFICAR `GET /condominiums`** (módulo `condominiums`):

- Incluir `deliverySlots` na resposta — o frontend precisa saber os slots disponíveis antes de renderizar os chips

**MODIFICAR `PUT /schedules/me`** (módulo `schedules`):

- Antes de salvar, validar que `deliveryTime` está em `condominium.deliverySlots`
- Buscar o condomínio do usuário (`user.condominiumId`) e checar o array
- Lançar 422 se o horário não estiver disponível no condomínio

**MODIFICAR `schedules.schema.ts`**:

- Trocar `z.enum(['06:30', '07:00', '07:30', '08:00'])` por `z.string()` — a validação de horário válido agora é feita no service contra o DB, não no schema estático

### Mudanças no Frontend

**MODIFICAR `DeliveryTimeChips` component**:

- Atualmente tem os 4 horários hardcoded como constante no componente
- Passar `availableSlots: string[]` como prop
- `ScheduleScreen` carrega os slots do condomínio via `GET /condominiums` (já existente) e passa para o component

**MODIFICAR `useSchedule` hook**:

- Receber `availableSlots` como parâmetro
- Filtrar o `deliveryTime` atual — se não estiver nos slots disponíveis, resetar para o primeiro slot disponível

### Impacto nos Crons

**MODIFICAR `createDailyOrders` em `schedules.service.ts`**:

Atualmente, o cron não usa `deliveryTime` na criação da `Order`. Com múltiplos slots por condomínio, cada `Order` precisa registrar o horário planejado para roteamento do entregador.

**MODIFICAR `Order` model** — adicionar campo:

```prisma
model Order {
  // ... campos existentes ...
  deliveryTime  String?   // Horário planejado da entrega: "07:00"
}
```

No `createDailyOrders`, ao criar a `Order`:

```typescript
await tx.order.create({
  data: {
    userId: schedule.userId,
    type: 'SCHEDULED',
    quantity: qty,
    scheduledDate,
    status: 'SCHEDULED',
    deliveryTime: schedule.deliveryTime,  // <-- novo campo
  },
})
```

O `DeliveryList` agrupa por condomínio — com múltiplos slots, pode ser necessário criar uma `DeliveryList` por (condomínio × horário) no futuro. Para o MVP desse milestone, apenas adicionar `deliveryTime` na `Order` é suficiente.

---

## Feature 3: Agenda com Múltiplos Slots

### Situação atual

`Schedule` tem `@@unique([userId, condominiumId])` — um cliente pode ter apenas uma agenda por condomínio. `deliveryTime String` — um único horário para todos os dias da semana. `weeklyQty Json` — quantidade por dia (sem horário por dia).

### Análise da Mudança

A feature "múltiplos slots" tem dois sub-cenários possíveis:

**Cenário A**: O cliente escolhe **um horário por dia** (seg 06:30, ter 07:00, qua 06:30...). Isso requer refatorar `weeklyQty` para incluir o horário junto à quantidade.

**Cenário B**: O cliente tem **uma agenda por horário** (agenda do 06:30 com suas qtds, agenda do 07:00 com suas qtds). Isso requer quebrar o `@@unique([userId, condominiumId])`.

### Mudanças no Schema — Cenário A (recomendado para este milestone)

Manter `@@unique([userId, condominiumId])` — uma agenda por condomínio — mas trocar `deliveryTime String` por um horário **por dia**:

**OPÇÃO**: Trocar `weeklyQty Json` por um composite type embedded:

```prisma
type DaySchedule {
  qty          Int     // Quantidade de pãezinhos (0 = sem entrega)
  deliveryTime String  // "06:30", "07:00", etc.
}

model Schedule {
  id             String      @id @default(auto()) @map("_id") @db.ObjectId
  userId         String      @db.ObjectId
  condominiumId  String      @db.ObjectId
  days           Json        // { seg: DaySchedule, ter: DaySchedule, ... }
  deliveryTime   String?     // Mantido para retrocompatibilidade — pode ser null em novas agendas
  weeklyQty      Json?       // Mantido para retrocompatibilidade
  notifyReconfigure Boolean  @default(false)
  isActive       Boolean     @default(true)
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  @@unique([userId, condominiumId])
}
```

**Por que `Json` e não um composite type Prisma?**

Composite types no Prisma MongoDB são documentos embedded com schema fixo. Para `days`, precisamos de 7 chaves (`seg`, `ter`, etc.) cada uma com `qty` e `deliveryTime` — seria verboso como composite type e ainda precisaria de `Json` para o objeto raiz. Usar `Json` para `days` é mais pragmático e consistente com o `weeklyQty` atual.

**Estratégia de migração sem downtime**:

- Adicionar `days Json?` ao schema (nullable)
- Manter `weeklyQty Json?` e `deliveryTime String?` (tornar nullable)
- O service lê `days` se presente, cai para `weeklyQty` + `deliveryTime` se não
- Ao salvar via `PUT /schedules/me`, sempre gravar o novo formato `days`
- Registros antigos continuam funcionando enquanto não são re-salvos

### Mudanças na API

**MODIFICAR `schedules.schema.ts`**:

```typescript
export const DayScheduleSchema = z.object({
  qty: z.number().int().min(0).max(12),
  deliveryTime: z.string(),  // validado contra slots do condomínio no service
})

export const DaysScheduleSchema = z.object({
  seg: DayScheduleSchema,
  ter: DayScheduleSchema,
  qua: DayScheduleSchema,
  qui: DayScheduleSchema,
  sex: DayScheduleSchema,
  sab: DayScheduleSchema,
  dom: DayScheduleSchema,
})

export const ScheduleBodySchema = z.union([
  // Formato novo: days com horário por dia
  z.object({
    days: DaysScheduleSchema,
    notifyReconfigure: z.boolean().default(false),
  }),
  // Formato legado: weeklyQty + deliveryTime único (retrocompatível)
  z.object({
    weeklyQty: WeeklyQtySchema,
    deliveryTime: z.string(),
    notifyReconfigure: z.boolean().default(false),
  }),
])
```

**MODIFICAR `schedules.service.ts`**:

- `getSchedule`: normalizar resposta — se registro tem `days`, retornar `days`; se não, construir `days` a partir de `weeklyQty` + `deliveryTime` para o frontend não precisar lidar com dois formatos
- `createDailyOrders`: ler `days` com fallback para `weeklyQty`; ao criar `Order`, usar `days[dayKey].deliveryTime` como `deliveryTime`

### Mudanças no Frontend

**MODIFICAR `ScheduleScreen`**:

- Cada dia agora tem um stepper (quantidade) + chip de horário
- `DeliveryTimeChips` move para dentro de cada `DayRow` (ou um picker inline por dia)
- O hook `useSchedule` precisa gerenciar um `days` record ao invés de `weeklyQty` + `deliveryTime` separados

**MODIFICAR `useSchedule` hook**:

- Estado: trocar `weeklyQty` + `deliveryTime` por `days: Record<DayKey, { qty: number; deliveryTime: string }>`
- `consumoSemanal`: sum de `days[key].qty`
- Inicializar com valores do servidor ou default (qty=0, deliveryTime=primeiro slot disponível)

### Impacto nos Crons

**MODIFICAR `createDailyOrders`** (já coberto na Feature 2):

```typescript
// Suporte a ambos os formatos
const dayData = (schedule as any).days?.[dayKey]
const qty = dayData?.qty ?? (schedule.weeklyQty as WeeklyQty)?.[dayKey] ?? 0
const deliveryTime = dayData?.deliveryTime ?? schedule.deliveryTime ?? '07:00'
```

**MODIFICAR `processAutoBuy`**:

- `consumoSemanal` calculado a partir de `days` se presente:
  ```typescript
  const consumoSemanal = schedule.days
    ? Object.values(schedule.days as Record<string, {qty: number}>).reduce((s, d) => s + d.qty, 0)
    : Object.values(schedule.weeklyQty as WeeklyQty).reduce((s, v) => s + v, 0)
  ```

---

## Feature 4: Crédito Manual Admin

### Situação atual

`TransactionType` enum: `PURCHASE | DELIVERY | REFUND | EXPIRY`. Não existe `ADMIN_GRANT` ou `BONUS`. `CreditTransaction` tem `referenceId String?` e `description String?` mas não tem `adminId`.

### Mudanças no Schema

**MODIFICAR enum `TransactionType`**:

```prisma
enum TransactionType {
  PURCHASE
  DELIVERY
  REFUND
  EXPIRY
  ADMIN_GRANT   // Crédito manual concedido por admin
}
```

**MODIFICAR `CreditTransaction`** — adicionar campos de auditoria:

```prisma
model CreditTransaction {
  id          String          @id @default(auto()) @map("_id") @db.ObjectId
  userId      String          @db.ObjectId
  type        TransactionType
  quantity    Int
  referenceId String?
  description String?
  adminId     String?         @db.ObjectId  // Obrigatório se type=ADMIN_GRANT
  reason      String?         // Obrigatório se type=ADMIN_GRANT: "Promoção lançamento", etc.
  createdAt   DateTime        @default(now())
  // Sem updatedAt — CreditTransaction é imutável (já documentado no schema)
}
```

**Por que não uma collection separada `AdminCreditGrant`?**

- `CreditTransaction` já é o ledger de créditos — separar criaria inconsistência no extrato do cliente
- Os campos `adminId` + `reason` são nullable — não afetam registros existentes no MongoDB (schema-less)
- O extrato do cliente (`GET /credits/history`) já retorna `CreditTransaction` — o tipo `ADMIN_GRANT` aparece naturalmente no histórico

### Mudanças na API

**NOVO endpoint** em módulo `admin-clients` (ou novo módulo `admin-credits`):

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/admin/clients/:id/credits` | Concede créditos a um cliente |

Body:
```json
{
  "quantity": 10,
  "reason": "Promoção de lançamento — bloco A"
}
```

Service (`admin-clients.service.ts` ou novo `admin-credits.service.ts`):

```typescript
async grantCredit(clientId: string, adminId: string, quantity: number, reason: string) {
  const user = await this.prisma.user.findUnique({ where: { id: clientId } })
  if (!user || user.role !== 'CLIENT') throw { statusCode: 404, message: 'Cliente não encontrado' }
  if (quantity <= 0) throw { statusCode: 400, message: 'Quantidade deve ser positiva' }

  await this.prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: clientId },
      data: { creditBalance: { increment: quantity } },
    })
    await tx.creditTransaction.create({
      data: {
        userId: clientId,
        type: 'ADMIN_GRANT',
        quantity,
        adminId,
        reason,
        description: `Crédito manual: ${reason}`,
      },
    })
  })
}
```

**MODIFICAR `GET /credits/history`** (módulo `credits`):

- Incluir `adminId` e `reason` na resposta quando `type === 'ADMIN_GRANT'`
- O cliente não vê `adminId` — apenas `description` e `type` no extrato

**MODIFICAR `admin-financial.service.ts`**:

- `getRevenue`: excluir `ADMIN_GRANT` do cálculo de receita (não é receita real — é concessão)
- Adicionar endpoint `GET /admin/financial/grants` para auditoria de grants (lista de ADMIN_GRANTs com adminId + reason)

### Mudanças no Frontend

**MODIFICAR tela de detalhe de cliente no Admin** (nova tela ou modal):

- Exibir saldo atual
- Campo de quantidade + campo de motivo
- Botão "Conceder créditos"
- Confirmação antes de enviar

**MODIFICAR `CreditHistoryScreen` (cliente)**:

- Exibir `ADMIN_GRANT` com label amigável: "Crédito especial" (não expor o `adminId`)

### Impacto nos Crons

Nenhum. O grant manual não envolve crons.

---

## Feature 5: Perfil Editável

### Situação atual

Não existe endpoint de edição de perfil do usuário. O `AuthService.register` cria o user com todos os campos. Não há rota `PATCH /users/me` ou similar no codebase.

### Análise de Campos Editáveis

| Campo | Editável? | Regra |
|-------|-----------|-------|
| `name` | Sim | Livre |
| `email` | Sim, com OTP | Novo e-mail deve ser único; novo OTP enviado para confirmar |
| `phone` | Sim, com OTP | Novo telefone deve ser único; novo OTP enviado para confirmar |
| `cpf` | **Não** | Documento de identidade — imutável após cadastro. Regra fiscal/legal. |
| `birthDate` | Sim | Sem restrição especial |
| `condominiumId` | Sim | Mudança de condomínio cancela/recria schedule? Ver abaixo. |
| `apartment` | Sim | Livre |
| `block` | Sim | Livre |
| `oneSignalPlayerId` | Sim (interno) | Atualizado pelo app automaticamente |

**Mudança de condomínio**: a `Schedule` tem `@@unique([userId, condominiumId])`. Se o usuário muda de condomínio:

- A agenda do condomínio antigo deve ser marcada `isActive: false`
- Uma nova agenda (vazia) pode ser criada para o novo condomínio, ou o usuário reconfigura
- Recomendação: ao mudar `condominiumId`, desativar agenda ativa atual + enviar push pedindo reconfiguração
- Orders já geradas (`status: SCHEDULED`) não são canceladas automaticamente — o admin decide

**Mudança de telefone/e-mail**: requer novo OTP para confirmar o novo contato:

1. Usuário submete novo telefone/email
2. Sistema envia OTP para o **novo** contato (não o atual)
3. Usuário confirma com OTP
4. Sistema atualiza o campo

### Mudanças no Schema

Nenhuma mudança de schema necessária — todos os campos editáveis já existem no `User`.

### Mudanças na API

**NOVO endpoint no módulo `auth`** ou **novo módulo `users`**:

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/users/me` | Perfil completo do usuário autenticado |
| `PATCH` | `/users/me` | Edita campos do perfil (sem contato sensível) |
| `POST` | `/users/me/phone` | Inicia mudança de telefone (envia OTP) |
| `POST` | `/users/me/email` | Inicia mudança de e-mail (envia OTP) |
| `POST` | `/users/me/contact/verify` | Confirma OTP e aplica novo contato |

**`PATCH /users/me`** — campos aceitos:

```typescript
z.object({
  name: z.string().min(2).optional(),
  birthDate: z.string().date().optional(),
  condominiumId: z.string().optional(),
  apartment: z.string().optional(),
  block: z.string().optional(),
})
// cpf NUNCA aceito neste endpoint
```

**`POST /users/me/phone`** — inicia mudança:

```typescript
// Body: { phone: string }
// 1. Verificar unicidade do novo telefone
// 2. Criar OtpCode para o userId com channel='sms', dest=newPhone
// 3. Armazenar o pending phone em cache (Redis) ou em campo temporário
```

**Problema de estado intermediário**: ao verificar o OTP do novo contato, o sistema precisa saber qual era o "pending phone/email". Opções:

- **Opção A** (recomendada): adicionar `pendingPhone String?` e `pendingEmail String?` ao `User`. Ao confirmar OTP, mover para `phone`/`email` e nullar o pending.
- **Opção B**: incluir o novo contato criptografado no próprio OtpCode (campo `referenceId` já existe em `OtpCode` — pode ser usado).

Recomendação: **Opção A** — mais explícita, sem encoding de dados no OtpCode.

```prisma
// Adicionar em User:
pendingPhone  String?   // Telefone aguardando confirmação OTP
pendingEmail  String?   // E-mail aguardando confirmação OTP
```

**`POST /users/me/contact/verify`**:

```typescript
// Body: { code: string, type: 'phone' | 'email' }
// 1. Verificar OTP ativo para o userId
// 2. Se válido: mover pendingPhone/pendingEmail para phone/email
// 3. Nullar o pending field
// 4. Revogar sessions ativas (opcional — forçar relogin após mudança de contato)
```

**Tratamento de mudança de condomínio** no service:

```typescript
if (data.condominiumId && data.condominiumId !== user.condominiumId) {
  // Desativar agenda ativa
  await tx.schedule.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false },
  })
  // Enviar push de reconfiguração
  // ... (usar OneSignal como no sendReconfigureReminders)
}
await tx.user.update({ where: { id: userId }, data })
```

### Mudanças no Frontend

**NOVA tela `ProfileScreen`** em `/client/perfil`:

- Exibe campos atuais (GET /users/me)
- Formulário editável para name, birthDate, apartment, block
- Seletor de condomínio (com aviso sobre impacto na agenda)
- Botão "Alterar telefone" → flow com OTP
- Botão "Alterar e-mail" → flow com OTP
- CPF exibido como somente leitura (sem campo de edição)

**Adicionar rota** em `router.tsx`:

```typescript
{
  path: 'perfil',
  lazy: () => import('../pages/client/ProfileScreen').then((m) => ({ Component: m.ProfileScreen })),
}
```

**MODIFICAR `ClientLayout`**:

- Adicionar link para `/client/perfil` no menu ou header (ícone de usuário)

**NOVO hook `useProfile`**:

- `GET /users/me` ao montar
- Funções: `updateProfile(data)`, `initPhoneChange(phone)`, `initEmailChange(email)`, `verifyContactChange(code, type)`
- O fluxo de OTP de contato reutiliza os mesmos componentes do fluxo de login

### Impacto nos Crons

Nenhum direto. Indiretamente: se o usuário muda de condomínio, a desativação da agenda afeta `createDailyOrders` (que já filtra `isActive: true`).

---

## Ordem de Build Sugerida

Considerando dependências entre as features:

### Fase 1 — Schema e infraestrutura (sem dependências externas)

1. **Adicionar `ADMIN_GRANT` ao enum `TransactionType`** + campos `adminId` e `reason` em `CreditTransaction` + `mpCustomerId` em `User` + `pendingPhone`/`pendingEmail` em `User` + `deliverySlots String[]` em `Condominium` + `deliveryTime String?` em `Order` + `days Json?` em `Schedule` (tornar `weeklyQty` e `deliveryTime` nullable)
2. **Criar model `SavedCard`**
3. **Rodar `prisma generate`** — um único `generate` cobre todas as mudanças

### Fase 2 — Backend: features independentes

As features 4 (crédito admin) e 5 (perfil) são independentes entre si e das features de cartão/agenda. Podem ser buildadas em paralelo.

**Feature 4 — Crédito Manual**:
- Endpoint `POST /admin/clients/:id/credits`
- Modificar `GET /credits/history` para incluir campos de grant

**Feature 5 — Perfil Editável**:
- Módulo `users` com `GET /users/me` + `PATCH /users/me`
- Endpoints de mudança de contato com OTP

### Fase 3 — Backend: cartões salvos

Depende do schema `SavedCard` (Fase 1).

- Módulo `saved-cards`
- Modificar `POST /payments/card` para aceitar `savedCardId`
- Modificar `processAutoBuy` para cobrar via cartão salvo

### Fase 4 — Backend: horários por condomínio + agenda multi-slot

Depende de `deliverySlots` no `Condominium` e `days` no `Schedule` (Fase 1). As duas subfeaturas são acopladas (slot do condomínio valida slot da agenda).

- Modificar `admin-condominiums` para gerenciar `deliverySlots`
- Modificar `schedules.service.ts` para ler `days` com fallback
- Modificar `createDailyOrders` para usar `days[dayKey]`

### Fase 5 — Frontend

Pode começar após Fases 2–4 (ou em paralelo com mocks):

1. `ProfileScreen` + `useProfile` hook
2. `SavedCardsScreen` + modificações em `CardPaymentScreen`
3. `ScheduleScreen` refatorada para `days` + `DeliveryTimeChips` por dia
4. Tela admin de grant de créditos

---

## Pontos de Integração: Novo vs. Modificado

| Artefato | Status | Detalhes |
|----------|--------|---------|
| `schema.prisma` — `SavedCard` model | **NOVO** | Nova collection |
| `schema.prisma` — `User.mpCustomerId` | **NOVO campo** | Nullable |
| `schema.prisma` — `User.pendingPhone/pendingEmail` | **NOVO campo** | Nullable |
| `schema.prisma` — `Condominium.deliverySlots` | **NOVO campo** | Array de strings |
| `schema.prisma` — `Order.deliveryTime` | **NOVO campo** | Nullable |
| `schema.prisma` — `Schedule.days` | **NOVO campo** | Json nullable |
| `schema.prisma` — `Schedule.weeklyQty/deliveryTime` | **MODIFICADO** | Tornar nullable |
| `schema.prisma` — `TransactionType` | **MODIFICADO** | Adicionar `ADMIN_GRANT` |
| `schema.prisma` — `CreditTransaction.adminId/reason` | **NOVO campo** | Nullable |
| `modules/saved-cards/` | **NOVO módulo** | 5 arquivos (route/controller/service/repository/schema) |
| `modules/users/` | **NOVO módulo** | Perfil editável |
| `modules/payments/payments.service.ts` | **MODIFICADO** | Aceitar `savedCardId` em `createCard()` |
| `modules/schedules/schedules.service.ts` | **MODIFICADO** | `createDailyOrders` + `processAutoBuy` com `days` fallback |
| `modules/schedules/schedules.schema.ts` | **MODIFICADO** | Novo `DaysScheduleSchema` |
| `modules/admin-clients/admin-clients.service.ts` | **MODIFICADO** | Adicionar `grantCredit()` |
| `modules/admin-condominiums/` | **MODIFICADO** | `deliverySlots` no update schema |
| `modules/credits/credits.route.ts` | **MODIFICADO** | Incluir campos de grant na history response |
| `plugins/cron.ts` | **SEM MUDANÇA** | Os 4 crons existentes — o service muda, não o plugin |
| `pages/client/ScheduleScreen.tsx` | **MODIFICADO** | UI de `days` com horário por dia |
| `pages/client/CardPaymentScreen.tsx` | **MODIFICADO** | Suporte a `saveCard` flag |
| `pages/client/ProfileScreen.tsx` | **NOVO** | Nova tela |
| `pages/client/SavedCardsScreen.tsx` | **NOVO** | Nova tela |
| `hooks/useSchedule.ts` | **MODIFICADO** | Estado `days` ao invés de `weeklyQty`+`deliveryTime` |
| `hooks/useProfile.ts` | **NOVO** | Profile + contact change |
| `routes/router.tsx` | **MODIFICADO** | Novas rotas `/perfil`, `/cartoes` |

---

## Riscos e Pontos de Atenção

### Risco 1: Retrocompatibilidade do Schedule

Todos os `Schedule` existentes têm `weeklyQty` (não-null) e `deliveryTime` (não-null). Ao tornar esses campos nullable (para adicionar `days`), os registros existentes continuam válidos — MongoDB não recalcula documentos ao mudar o schema Prisma. **Risco baixo** — o fallback no service garante leitura correta.

### Risco 2: Token Mercado Pago em `cardTokenMp`

O campo `User.cardTokenMp` armazena um token Bricks one-shot — não um `mpCardId` permanente. O `processAutoBuy` no cron usa esse campo? Leitura do código: não, o `processAutoBuy` atual apenas envia push — não faz cobrança. O campo `cardTokenMp` é escrito em `CardPaymentScreen` via `PUT /users/me/card-token` (endpoint que já existe no frontend mas não foi encontrado nas routes do backend). **Ação necessária**: verificar se esse endpoint existe no backend ou é chamada silenciosa (o `.catch(() => {})` no frontend sugere que pode não existir).

### Risco 3: OTP de mudança de contato vs. OTP de login

O flow de OTP usa `OtpCode.userId` como chave de deduplicação (`findActiveOtp` retorna o primeiro OTP ativo do usuário). Se o usuário tem um OTP de login ativo e tenta mudar o telefone, pode haver conflito. **Solução**: adicionar `channel` como discriminador no `findActiveOtp`, ou adicionar um campo `purpose: 'LOGIN' | 'CONTACT_CHANGE'` ao `OtpCode`.

### Risco 4: `deliverySlots` vazio em condomínios existentes

Condomínios existentes têm `deliverySlots: []`. A validação no `PUT /schedules/me` bloquearia todos os clientes de salvar agenda até que o admin configure os slots. **Solução**: tratar array vazio como "sem restrição" (aceitar qualquer horário válido do enum global) — comportamento idêntico ao atual.
