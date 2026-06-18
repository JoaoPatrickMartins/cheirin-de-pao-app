# Stack Research: Cheirin de Pão v1.1

**Milestone:** Features v1.1 (cartões salvos, slots de horário configuráveis, multi-slot por dia, edição de perfil)
**Pesquisado em:** 2026-06-18
**Confiança geral:** HIGH — todas as decisões críticas verificadas nos tipos do SDK instalado ou na documentação oficial MP

---

## Adições de Stack

### 1. Mercado Pago — Customer & Cards API (Backend)

**Situação:** Já disponível. `mercadopago@3.1.0` (instalado) já exporta `Customer` e `CustomerCard` com tipagem completa.

Verificado nos tipos instalados:
- `Customer.create()` — cria registro de cliente no MP (retorna `{ id, email, ... }`)
- `Customer.search()` — busca por e-mail para evitar duplicidade ao recriar
- `Customer.createCard()` — vincula token de cartão a um Customer MP (aceita `{ customerId, body: { token } }`)
- `Customer.listCards()` — lista cartões salvos de um Customer
- `Customer.removeCard()` — desvincula cartão salvo

**O que precisa mudar no schema Prisma:**

Adicionar campo `mpCustomerId String?` ao model `User`. O campo atual `cardTokenMp String?` salva um token temporário (expira em horas) — para cartões salvos, o que persiste é o **id do cartão no MP** (`CustomerCardResponse.id`), não o token. O `mpCustomerId` é o vínculo estável.

```prisma
// User — acrescentar
mpCustomerId   String?   // ID do Customer no Mercado Pago (/v1/customers/:id)
// cardTokenMp existente pode ser removido ou mantido para fluxo de auto-recharge via Pix
```

Não é necessária uma collection nova. Os IDs de cartões salvos são buscados ao vivo via `customer.listCards({ customerId })` — não precisam ser duplicados localmente. Guardar apenas `mpCustomerId` no `User` é o padrão correto (evita dessincronização).

**Fluxo de integração verificado:**

1. No primeiro pagamento com cartão, após aprovação: chamar `Customer.search({ filters: { email } })` — se não existe, `Customer.create({ body: { email } })`. Salvar `mpCustomerId` no `User`.
2. `Customer.createCard({ customerId: mpCustomerId, body: { token } })` — vincula o token (que ainda está válido neste momento) ao Customer MP e retorna `CardResponse.id`.
3. Para cobrar com cartão salvo: o frontend re-tokeniza apenas o CVV via MP.js/Brick (MP exige recaptura do CVV por PCI — não é possível pular). O `onSubmit` do Payment Brick devolve um `token` novo. O backend chama `Payment.create()` com `payer: { type: 'customer', id: mpCustomerId }` + `token` novo.

**Nenhuma lib nova necessária para este fluxo.**

---

### 2. Slots de horário de entrega por condomínio (Backend + Schema)

**Situação:** Sem lib necessária. É puramente modelagem de dados + lógica de validação Zod.

O campo `deliveryTime` no model `Schedule` é hoje um `String` com enum hardcoded em Zod (`'06:30' | '07:00' | '07:30' | '08:00'`). Para tornar os slots **configuráveis por condomínio**, a abordagem correta é adicionar slots ao model `Condominium` como **Prisma composite type** (array embarcado), sem nova collection.

```prisma
// Novo composite type — adicionar ao schema.prisma
type DeliverySlot {
  time     String   // "06:30", "07:00", etc.
  label    String?  // "Manhã cedo", opcional
  isActive Boolean  @default(true)
}

// Condominium — acrescentar campo
deliverySlots  DeliverySlot[]
```

Prisma 6 suporta composite types com arrays em MongoDB (verificado: `@@` anotações não se aplicam a tipos, apenas a models). Array de composite types é type-safe no Prisma Client — diferente de `Json` que não tem tipagem.

O `ScheduleBodySchema` em Zod passa a aceitar qualquer `HH:MM` válido (z.string().regex) ao invés de enum fixo — a validação de "slot válido para o condomínio" fica na service layer, não no schema Zod.

**Impacto nos crons:** Nenhum. O `deliveryTime` no `Schedule` já existe como string; a mudança é só ampliar o conjunto de valores aceitos. Os crons atuais (`createDailyOrders`, `sendEveReminders`) não filtram por horário — continuam funcionando sem alteração.

---

### 3. Agendamentos com múltiplos slots por dia (Schema + Cron)

**Situação:** O schema atual de `Schedule` usa `weeklyQty: Json` (objeto `{ seg, ter, qua, qui, sex, sab, dom }` com quantidade única por dia). Múltiplos slots por dia exige mudar a estrutura desse campo.

**Abordagem recomendada:** substituir `weeklyQty Json` por `weeklySlots Json` com estrutura mais rica:

```typescript
// Tipo TypeScript representando a nova estrutura
type WeeklySlots = {
  [day in 'seg'|'ter'|'qua'|'qui'|'sex'|'sab'|'dom']: Array<{
    time: string    // ex.: "06:30"
    quantity: number
  }>
}
// Exemplo: { seg: [{ time: "06:30", qty: 2 }, { time: "08:00", qty: 1 }], ter: [], ... }
```

Manter como `Json` no Prisma é correto para MongoDB — Prisma composite type seria mais restritivo aqui porque `weeklySlots` é um objeto com chaves dinâmicas (dias), não um array homogêneo. `Json` com validação Zod na camada de serviço é o padrão estabelecido no projeto (o `weeklyQty` atual já usa esse padrão).

**Impacto nos crons existentes:**

- `createDailyOrders` — precisa ser adaptado. Hoje lê `weeklyQty[dayKey]` como número escalar; passará a iterar `weeklySlots[dayKey]` como array de slots, criando um `Order` por slot (com `deliveryTime` no Order).
- `sendEveReminders` — sem alteração se `Order` continuar sendo a unidade de notificação.
- `processAutoBuy` — o cálculo de `consumoSemanal` muda: soma de `slot.quantity` em todos os dias em vez de soma direta dos valores do objeto.

**Mudança de schema necessária no model `Order`:** adicionar `deliveryTime String?` para registrar qual slot gerou o pedido (essencial para o entregador saber qual apartamento entregar em qual janela).

```prisma
// Order — acrescentar
deliveryTime  String?   // slot que originou o pedido, ex.: "06:30"
```

Nenhuma lib nova. `node-cron@4.2.1` (instalado) já suporta lógica interna com loops por slot — basta adaptar o código da service.

---

### 4. Edição de perfil — validação CPF e telefone brasileiro

**Situação:** CPF já tem validação módulo-11 completa em `packages/shared/src/schemas/index.ts` (`CpfSchema`). Não adicionar nada para CPF.

**Telefone:** Zod 4.4.3 (instalado) expõe `z.e164()` nativo que valida o formato `+DDDDxxxxxxx` internacionalmente. Para telefone brasileiro especificamente, `z.e164()` valida o formato mas não verifica DDD válido (11–99) nem 8/9 dígitos após o DDD.

**Decisão:** Implementar validação de telefone BR como `z.string().refine()` no shared package, sem biblioteca externa. O regex é simples e já documentado:

```typescript
// Adicionar a packages/shared/src/schemas/index.ts
export const PhoneBrSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => /^[1-9]{2}9?\d{8}$/.test(v), {
    message: 'Telefone deve ter DDD + 8 ou 9 dígitos',
  })
  .transform((v) => `+55${v}`)  // normaliza para E.164
```

Esse padrão aceita celulares (11 dígitos com 9) e fixos (10 dígitos). Rejeita DDDs impossíveis implicitamente (primeiro dígito 0 ou 1 são filtrados pelo `[1-9]{2}`).

**Não instalar** `cpf-cnpj-validator`, `zod-phonenumber`, `libphonenumber-js` ou qualquer biblioteca de validação BR — o projeto já tem implementação própria para CPF e o telefone não justifica dependência externa.

---

## Configurações Necessárias

### Mercado Pago — variável de ambiente

Nenhuma variável nova além do `MP_ACCESS_TOKEN` já existente. A Customer API usa o mesmo access token da Payment API.

### Prisma — após mudanças de schema

Executar apenas `prisma generate` (nunca `prisma migrate dev` — MongoDB não suporta migrations com Prisma, como documentado no próprio schema).

### Webhook MP — evento de cartão salvo

O MP não emite webhook quando um cartão é vinculado via `Customer.createCard()`. A lógica de salvar `mpCustomerId` e fazer `createCard()` roda **síncronamente** na service de pagamentos, logo após a aprovação do pagamento (`payment_status === 'approved'`). Não requer nova configuração de webhook.

### Cron — múltiplos slots

Se um condomínio tiver slots às 06:30 e 08:00, a lógica de `createDailyOrders` precisa garantir idempotência: verificar se já existe `Order` para `{ userId, scheduledDate, deliveryTime }` antes de criar. Adicionar índice composto no model `Order`:

```prisma
// Order — adicionar índice para idempotência
@@index([userId, scheduledDate, deliveryTime])
```

Em MongoDB+Prisma, `@@index` é suportado em models (não em composite types). HIGH confidence — verificado na documentação Prisma.

---

## O que NÃO adicionar

| Lib / Abordagem | Por que não |
|---|---|
| `cpf-cnpj-validator` | CPF já validado com módulo-11 próprio no shared package. Dependência desnecessária. |
| `libphonenumber-js` | Overkill para BR — 200KB+ de bundle para validar DDD e formato que um regex cobre. |
| `@victorfernandesraton/zod-phonenumber` | Wrapper sobre libphonenumber-js. Mesmo problema de peso + dependência de lib que soma nada ao que já existe. |
| `date-fns` ou `luxon` para time slots | Os slots de horário são strings `HH:MM` comparadas como texto — não precisam de parsing de Date. O timezone já está resolvido com `Intl.DateTimeFormat` nos crons. |
| `node-schedule` em substituição ao `node-cron` | `node-cron@4.2.1` (instalado) já suporta horários múltiplos via lógica interna. Trocar causaria refatoração sem ganho. |
| Collection separada para `DeliverySlot` | MongoDB + Prisma composite type embedded é mais performático e não requer join para ler slots do condomínio. |
| Duplicar `card_ids` do MP no banco local | Cartões são buscados ao vivo via `Customer.listCards()` — duplicar cria dessincronização se o usuário remover um cartão diretamente no app MP. Armazenar apenas `mpCustomerId`. |
| Upgrade de `mercadopago` SDK | `@3.1.0` já tem `Customer`, `CustomerCard` com tipagem completa. Upgrade não adiciona nada para este escopo. |
| `react-hook-form` | O projeto usa Zod diretamente com state local. Não há formulários suficientemente complexos para justificar a dependência. |

---

## Fontes

- Tipos TypeScript instalados: `/node_modules/mercadopago/dist/clients/customer/index.d.ts`, `/node_modules/mercadopago/dist/clients/customerCard/commonTypes.d.ts`, `/node_modules/mercadopago/dist/clients/customerCard/create/types.d.ts` — HIGH confidence
- MP Docs: [Add saved cards — Payment Brick](https://www.mercadopago.com.co/developers/en/docs/checkout-bricks/payment-brick/advanced-features/customers-cards) — confirma `initialization.payer.{ customerId, cardsIds }` — MEDIUM confidence
- MP Docs: [Receive payments with saved cards](https://www.mercadopago.com.ar/developers/en/docs/checkout-api/cards-and-customers-management/receive-payments-with-saved-cards) — confirma `payer.type: 'customer'` + `payer.id: mpCustomerId` no backend — MEDIUM confidence
- Prisma Docs: [Composite types](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/composite-types) — suporte a `type DeliverySlot` com array em MongoDB — HIGH confidence
- Zod 4 changelog: `z.e164()` nativo confirmado em issues do repositório — MEDIUM confidence
- Schema atual do projeto: `/apps/api/prisma/schema.prisma` — base para todas as decisões de modelagem
- Código existente: `/apps/api/src/modules/payments/payments.service.ts`, `/apps/api/src/modules/schedules/schedules.service.ts`, `/apps/api/src/plugins/cron.ts`
