# Phase 12: Cartões Salvos - Research

**Researched:** 2026-06-19
**Domain:** Mercado Pago Customer API + SavedCard CRUD + CardPaymentScreen refatorada
**Confidence:** HIGH

---

## Summary

A Phase 12 adiciona suporte a cartões salvos no Mercado Pago. O fluxo central é: ao pagar com cartão, o cliente escolhe entre um cartão salvo (lista) ou adiciona um novo (Brick completo + checkbox "Salvar"). Para cartões salvos, o backend cria um `CardToken` via MP SDK usando `card_id + customer_id + security_code` (CVV capturado pelo Brick) — gerando um token de uso único por transação, conforme D-16 (PCI DSS). Nas configurações, o cliente gerencia até 3 cartões salvos.

A infraestrutura está quase completa: o modelo `SavedCard` já existe no schema Prisma (Phase 10, D-13), `User.mpCustomerId` está disponível, e `CardToken`, `Customer` e `CustomerCard` já estão no `mercadopago` SDK v3 instalado. Nenhum novo pacote é necessário — é implementação pura sobre infraestrutura existente.

A mudança mais crítica no backend é expandir `POST /payments/card` para aceitar `savedCardId` como alternativa ao `token` bruto, e criar um novo módulo `saved-cards` com 4 endpoints REST (`GET /users/me/cards`, `DELETE /users/me/cards/:id`, `PATCH /users/me/cards/:id` e lógica de criação via flag `saveCard` em `/payments/card`). No frontend, a `CardPaymentScreen` existente passa a ter dois modos (A: tem cartões salvos / B: sem cartões).

**Recomendação principal:** Criar módulo `saved-cards` independente no backend (padrão dos demais módulos) e refatorar `CardPaymentScreen` com estados controlados por `useState` sem nova rota — apenas lógica condicional interna.

---

## Project Constraints (from CLAUDE.md)

- Stack Frontend: React + Vite + Tailwind CSS + Zod — definido e não revisitável
- Stack Backend: Node.js + Fastify + Prisma + MongoDB Atlas — definido e não revisitável
- Pagamentos: Mercado Pago exclusivamente (Pix + cartão)
- Alta fidelidade de design — tokens de cores, tipografia e espaçamentos são mandatórios
- Fontes: Bricolage Grotesque (display) e Hanken Grotesk (body)
- Nenhum banco local — MongoDB Atlas remoto em dev e produção

---

<phase_requirements>
## Phase Requirements

| ID | Descrição | Suporte desta pesquisa |
|----|-----------|------------------------|
| CARD-01 | No fluxo de compra com cartão, cliente vê seus cartões salvos e pode selecionar um para pagar | API: `GET /users/me/cards`; Frontend: `SavedCardsList` com radio selector |
| CARD-02 | Cliente cadastra novo cartão no fluxo de compra com opção de salvar | `POST /payments/card` com `saveCard: true`; backend chama `Customer.createCard` |
| CARD-03 | Opção de compra única sem salvar com menor destaque visual | Botão/texto secundário "Pagar sem salvar" (12.5px, color-text-sec) — ver UI-SPEC |
| CARD-04 | CVV capturado via Brick a cada transação; compras com cartão salvo usam token direto sem redigitar dados | D-16: `CardToken.create({ card_id, customer_id, security_code })` — token de uso único por transação |
| CARD-05 | Até 3 cartões salvos; definir padrão e remover nas configurações | `PATCH /users/me/cards/:id` (isDefault) + `DELETE /users/me/cards/:id` + lógica de limite no service |
| CARD-06 | Fluxo funciona tanto para combo quanto para compra personalizada | `savedCardId` + `comboId?` ou `customQuantity?` — mesma lógica de `resolveAmount` já existente |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Tier Primário | Tier Secundário | Racional |
|------------|--------------|-----------------|---------|
| Listar cartões salvos do cliente | API Backend | — | Prisma `SavedCard` + autenticação JWT obrigatória |
| Salvar cartão novo via MP | API Backend | — | Requer `MP_ACCESS_TOKEN` (segredo) — nunca no frontend |
| Remover cartão (DB + MP) | API Backend | — | Chama `Customer.removeCard` no MP + deleta `SavedCard` local |
| Definir cartão padrão | API Backend | — | PATCH em `SavedCard.isDefault` + unset nos demais |
| Renderizar lista de cartões salvos | Browser/Client | — | `SavedCardsList` + `SavedCardItem` — estado local React |
| Capturar CVV via Brick para cartão salvo | Browser/Client | — | MP Bricks CardPayment modo "CVV only" — PCI DSS compliance |
| Gerar token de transação para cartão salvo | API Backend | — | `CardToken.create({ card_id, customer_id, security_code })` — precisa do access token |
| Criar/buscar MP Customer | API Backend | — | `Customer.create` / `Customer.search` — fluxo idempotente via `mpCustomerId` |

---

## Standard Stack

### Core (já instalado — sem novos pacotes)

| Biblioteca | Versão | Propósito | Por que usar |
|------------|--------|-----------|--------------|
| `mercadopago` | 3.1.0 | `Customer`, `CustomerCard`, `CardToken` APIs | Já instalado; v3 inclui `Customer.createCard`, `Customer.removeCard`, `Customer.listCards`, `CardToken.create` |
| `@mercadopago/sdk-react` | 1.0.7 | `CardPayment` Brick (modo completo + CVV) | Já instalado desde Phase 3; suporta modo restrito via `customization` |
| `@prisma/client` | (gerado) | `SavedCard` CRUD | Model já definido no schema (Phase 10) |
| `zod` | (existente) | Schema validation nos endpoints novos | Padrão de todos os módulos existentes |

**Nenhum novo pacote a instalar nesta fase.**

### Alternativas Consideradas

| Em vez de | Poderia usar | Tradeoff |
|-----------|-------------|---------|
| `CardToken.create` no backend (D-16) | Armazenar o CVV | PCI DSS proibe armazenar CVV — inaceitável |
| MP Customer API para salvar cartões | Armazenar dados brutos do cartão | PCI DSS proibe — inaceitável |
| Novo módulo `saved-cards` | Expandir `client-profile` | Módulo separado mantém separação de preocupações (padrão do projeto) |

---

## Package Legitimacy Audit

> Nenhum pacote novo é instalado nesta fase. Todos os pacotes usados já estão no projeto:
> - `mercadopago@3.1.0` — em uso desde Phase 3
> - `@mercadopago/sdk-react@1.0.7` — em uso desde Phase 3

**Nenhum pacote adicionado; seção de auditoria não aplicável.**

---

## Architecture Patterns

### Diagrama de Fluxo de Dados

```
Cliente (browser)
  │
  ├─ GET /users/me/cards ──────────────────► API: saved-cards.service
  │                                               └─ prisma.savedCard.findMany({ userId })
  │                                               └─ retorna [{ id, brand, lastFour, expiresAt, isDefault }]
  │
  ├─ [Seleciona cartão salvo + confirma]
  │    POST /payments/card
  │    { savedCardId, comboId?, customQuantity? }
  │         │
  │         └─ payments.service.createCardWithSaved()
  │              ├─ prisma.savedCard.findUnique (valida dono)
  │              ├─ CardToken.create({ card_id: mpCardId, customer_id: mpCustomerId, security_code })
  │              │    └─ retorna token de uso único
  │              └─ Payment.create({ token, payment_method_id, ... })
  │
  ├─ [Adiciona novo cartão + saveCard: true]
  │    POST /payments/card
  │    { token, paymentMethodId, ..., saveCard: true }
  │         │
  │         └─ payments.service.createCard()
  │              ├─ Payment.create({ token, ... }) ─── cobra o pagamento
  │              └─ [se approved] getOrCreateMpCustomer()
  │                   ├─ Customer.search({ email }) → usa existente ou cria novo
  │                   ├─ Customer.createCard({ customerId, body: { token } })
  │                   ├─ [se < 3 cartões] prisma.savedCard.create(...)
  │                   └─ prisma.user.update({ mpCustomerId })
  │
  ├─ PATCH /users/me/cards/:id { isDefault: true }
  │         └─ saved-cards.service.setDefault()
  │              ├─ prisma.savedCard.updateMany({ userId }, { isDefault: false })
  │              └─ prisma.savedCard.update({ id }, { isDefault: true })
  │
  └─ DELETE /users/me/cards/:id
           └─ saved-cards.service.removeCard()
                ├─ prisma.savedCard.findUnique (valida dono + pega mpCardId)
                ├─ Customer.removeCard({ customerId, cardId: mpCardId })
                └─ prisma.savedCard.delete({ id })
```

### Estrutura de Projeto Sugerida

```
apps/api/src/modules/
└── saved-cards/                    ← módulo novo
    ├── saved-cards.route.ts        ← GET /users/me/cards, DELETE /:id, PATCH /:id
    ├── saved-cards.controller.ts
    ├── saved-cards.service.ts      ← lógica MP Customer + Prisma
    ├── saved-cards.repository.ts   ← operações Prisma no SavedCard
    ├── saved-cards.schema.ts       ← Zod schemas
    └── __tests__/
        └── saved-cards.service.test.ts

apps/web/src/
├── components/client/
│   ├── SavedCardItem.tsx           ← card reutilizável (modo 'select' | 'manage')
│   └── SavedCardsList.tsx          ← lista com skeleton + estado vazio
└── pages/client/
    └── CardPaymentScreen.tsx       ← refatorada (modo A e B)
```

### Padrão 1: getOrCreateMpCustomer (idempotência)

**O que é:** Ao salvar o primeiro cartão de um usuário, é necessário criar um Customer no MP. O padrão garante que nunca criamos dois Customers para o mesmo usuário.

**Quando usar:** Sempre que `saveCard: true` e o usuário ainda não tem `mpCustomerId`.

```typescript
// Source: mercadopago SDK v3 — Customer.search + Customer.create
// apps/api/src/modules/saved-cards/saved-cards.service.ts

private async getOrCreateMpCustomer(user: { id: string; email: string | null; mpCustomerId: string | null }): Promise<string> {
  // Já tem mpCustomerId — retornar sem criar
  if (user.mpCustomerId) return user.mpCustomerId

  const email = user.email ?? `${user.id}@cheirin.app`

  // Buscar por e-mail primeiro (idempotência — evita duplicatas)
  const searchResult = await this.customerApi.search({
    options: { email },
  })

  let mpCustomerId: string

  if (searchResult.results && searchResult.results.length > 0) {
    mpCustomerId = searchResult.results[0].id!
  } else {
    const created = await this.customerApi.create({
      body: { email },
    })
    mpCustomerId = created.id!
  }

  // Persistir no User para próximas transações
  await this.prisma.user.update({
    where: { id: user.id },
    data: { mpCustomerId },
  })

  return mpCustomerId
}
```
**[VERIFIED: npm registry]** — `Customer.search`, `Customer.create` confirmados nas type definitions do `mercadopago@3.1.0` instalado localmente.

---

### Padrão 2: Token de uso único para cartão salvo (D-16)

**O que é:** Para pagar com cartão salvo, o backend gera um novo token de uso único passando `card_id + customer_id + security_code` (CVV capturado pelo Brick no frontend). Este token é então usado na chamada `Payment.create` — nunca reutilizando o token de uma transação anterior.

**Por que:** PCI DSS proíbe armazenar CVV. O Brick no frontend captura apenas o CVV e o envia ao backend — o backend usa o `CardToken` SDK para gerar o token completo de uma só vez.

```typescript
// Source: mercadopago SDK v3 — CardToken.create com card_id
// apps/api/src/modules/payments/payments.service.ts

async createCardWithSaved(params: {
  savedCardId: string
  securityCode: string       // CVV capturado pelo Brick
  comboId?: string
  customQuantity?: number
  userId: string
}) {
  const { savedCardId, securityCode, comboId, customQuantity, userId } = params

  const user = await this.prisma.user.findUnique({ where: { id: userId } })
  if (!user?.mpCustomerId) throw { error: 'Cliente sem Customer MP', status: 400 }

  const savedCard = await this.prisma.savedCard.findUnique({ where: { id: savedCardId } })
  if (!savedCard || savedCard.userId !== userId) throw { error: 'Cartão não encontrado', status: 404 }

  // Gerar token de uso único — NUNCA armazenar CVV
  const cardToken = await this.cardTokenApi.create({
    body: {
      card_id: savedCard.mpCardId,
      customer_id: user.mpCustomerId,
      security_code: securityCode,
    },
  })

  const { amount, description } = await this.resolveAmount(comboId, customQuantity)

  const response = await this.paymentApi.create({
    body: {
      transaction_amount: amount,
      description,
      token: cardToken.id,
      installments: 1,
      payment_method_id: savedCard.brand.toLowerCase(), // 'visa', 'master', etc.
      payer: {
        email: user.email ?? `${userId}@cheirin.app`,
        // id do customer MP — vincula ao customer salvo
        id: user.mpCustomerId,
      },
    },
  })

  await this.repo.createPayment({
    userId, amount, method: 'CREDIT_CARD', status: 'PENDING',
    mercadoPagoId: String(response.id), comboId, customQuantity,
  })

  return { paymentId: response.id }
}
```
**[VERIFIED: npm registry]** — `CardToken.create` com `card_id` e `customer_id` confirmado em `cardToken/create/types.d.ts` do SDK instalado.

---

### Padrão 3: Salvar cartão pós-pagamento aprovado

**O que é:** Ao pagar com novo cartão e `saveCard: true`, o cartão é salvo no MP Customer API **após** o pagamento ser criado (mas não necessariamente aprovado — o MP salva o cartão mesmo com status `pending`, pois o token ainda é válido).

**Atenção:** Salvar antes de processar o pagamento cria cartões "fantasma" se o pagamento falhar na validação de valores. Salvar imediatamente após `Payment.create` (antes do webhook approved) é o comportamento correto — o MP já validou o token com o banco.

```typescript
// Dentro de createCard(), após Payment.create bem-sucedido:
if (saveCard && !error) {
  const mpCustomerId = await this.getOrCreateMpCustomer(user)
  const existingCards = await this.prisma.savedCard.count({ where: { userId } })

  if (existingCards < 3) {
    const mpCard = await this.customerApi.createCard({
      customerId: mpCustomerId,
      body: { token },
    })
    // mpCard.payment_method.id = 'visa' | 'master' | 'elo' | etc.
    // mpCard.last_four_digits, mpCard.expiration_month, mpCard.expiration_year
    await this.prisma.savedCard.create({
      data: {
        userId,
        mpCardId: mpCard.id!,
        brand: mpCard.payment_method?.id ?? 'unknown',
        lastFour: mpCard.last_four_digits ?? '????',
        expiresAt: `${String(mpCard.expiration_month).padStart(2, '0')}/${String(mpCard.expiration_year).slice(-2)}`,
        isDefault: existingCards === 0, // primeiro cartão vira padrão
      },
    })
  }
}
```
**[VERIFIED: npm registry]** — `Customer.createCard`, `CustomerCardResponse.last_four_digits`, `CustomerCardResponse.expiration_month/year` confirmados nas type definitions do SDK instalado.

---

### Padrão 4: Modo CVV-only do Brick no frontend

**O que é:** Para cartões salvos, o Brick `<CardPayment>` é usado em modo restrito para capturar apenas o CVV. O frontend exibe o Brick dentro do card "Adicionar novo cartão" expandido — o CVV é obtido via `onSubmit` como `formData.security_code`.

**Atenção crítica (D-16):** O Brick modo CVV-only NÃO é nativo do `@mercadopago/sdk-react@1.0.7` — o Brick sempre renderiza o formulário completo. A abordagem correta é:

1. Para cartão salvo selecionado: renderizar um `<input type="password" maxLength={4}>` customizado para o CVV (simples, sem Brick)
2. O CVV é enviado como campo `securityCode` no body de `POST /payments/card`
3. O backend usa `CardToken.create({ card_id, customer_id, security_code })` para criar o token

**[ASSUMED]** — O `@mercadopago/sdk-react` v1.0.7 não expõe um modo "CVV-only" documentado via props. A abordagem de input customizado é a alternativa padrão documentada no ecossistema MP. Confirmar com o usuário se preferem um input simples nativo vs. uma tentativa de customização avançada do Brick.

```tsx
// Captura de CVV para cartão salvo — input nativo customizado
// apps/web/src/pages/client/CardPaymentScreen.tsx

{selectedSavedCard && (
  <div style={{ marginTop: 8 }}>
    <label
      htmlFor="cvv-input"
      style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: 'var(--color-text-sec)' }}
    >
      Código de segurança (CVV)
    </label>
    <input
      id="cvv-input"
      type="password"
      inputMode="numeric"
      maxLength={4}
      value={cvv}
      onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
      placeholder="•••"
      style={{
        borderRadius: 'var(--radius-field)',
        border: '1.5px solid var(--color-border)',
        padding: '12px 14px',
        fontFamily: 'var(--font-body)',
        fontSize: 15,
        width: 100,
      }}
    />
  </div>
)}
```

---

### Anti-Patterns a Evitar

- **Armazenar CVV no banco:** Proibido por PCI DSS — usar apenas `CardToken.create` com o CVV e descartar imediatamente.
- **Criar MP Customer sem verificar duplicatas:** Sempre buscar por email antes de criar (`Customer.search({ email })`).
- **Salvar cartão antes de `Payment.create`:** Cria cartões no MP sem pagamento associado.
- **Confiar em `payment_method_id` do Brick como brand definitiva:** O campo retornado pelo MP Card criado é `payment_method.id` — usar este, não o do Brick.
- **Chamar `DELETE /users/me/cards/:id` sem deletar no MP também:** Sempre sincronizar deleção local + MP Customer API.
- **Mostrar mais de 3 cartões salvos:** O limite de 3 é regra de negócio (CARD-05) — enforçar no backend antes de salvar.

---

## Don't Hand-Roll

| Problema | Não construir | Usar | Por que |
|----------|--------------|------|---------|
| Tokenização de cartão | Lógica de tokenização própria | `CardToken.create` (SDK MP) | PCI DSS — dados brutos do cartão nunca passam pelo backend |
| Gerenciamento de Customer MP | Tabela própria de customers | `Customer.search/create` + `mpCustomerId` no User | MP gerencia o vault de cartões; duplicata causa erros |
| Validação de bandeira | Regex no número do cartão | `payment_method.id` do `CustomerCardResponse` | MP já identifica a bandeira ao salvar via `createCard` |
| Deleção de cartão do vault MP | Apenas deletar no Prisma | `Customer.removeCard` + `prisma.savedCard.delete` | Deletar só no Prisma deixa cartão ativo no MP |

**Insight principal:** O vault de cartões vive no Mercado Pago — o `SavedCard` local é apenas um espelho (metadata) para renderização na UI sem precisar chamar o MP a cada load de tela.

---

## Common Pitfalls

### Pitfall 1: Limit de 3 cartões não enforçado no backend

**O que dá errado:** Frontend controla o limite, mas se o usuário chamar a API diretamente, salva um 4° cartão.
**Por que acontece:** A validação fica só no frontend.
**Como evitar:** `saved-cards.service.ts` conta `prisma.savedCard.count({ where: { userId } })` antes de salvar.
**Sinais de alerta:** Usuário com 4+ cartões na UI.

---

### Pitfall 2: Race condition em `setDefault`

**O que dá errado:** Dois requests simultâneos de `setDefault` deixam dois cartões com `isDefault: true`.
**Por que acontece:** Falta de atomicidade — duas queries separadas (unset + set).
**Como evitar:** Usar `prisma.$transaction([...])` para garantir atomicidade das duas operações.

```typescript
// Source: Prisma docs — interactive transactions
await this.prisma.$transaction([
  this.prisma.savedCard.updateMany({ where: { userId }, data: { isDefault: false } }),
  this.prisma.savedCard.update({ where: { id: cardId }, data: { isDefault: true } }),
])
```

---

### Pitfall 3: `mpCustomerId` null ao pagar com cartão salvo

**O que dá errado:** `CardToken.create` falha sem `customer_id`.
**Por que acontece:** O `mpCustomerId` pode ser null se o cartão foi salvo por um caminho alternativo.
**Como evitar:** `saved-cards.service.createCardWithSaved()` verifica `user.mpCustomerId` e lança erro 400 se nulo antes de tentar criar o token.

---

### Pitfall 4: CVV com 3 dígitos para Mastercard, 4 para Amex

**O que dá errado:** Input fixo com `maxLength={3}` recusa CVV da Amex (4 dígitos).
**Por que acontece:** Amex tem CVV de 4 dígitos (CID), na frente do cartão.
**Como evitar:** `maxLength={4}` no input de CVV; o MP valida o tamanho correto via `CardToken.create`.

---

### Pitfall 5: Deleção no MP sem deletar no Prisma (ou vice-versa)

**O que dá errado:** Desincronização entre o vault MP e o espelho local.
**Por que acontece:** Error handling incompleto — um dos dois passos falha silenciosamente.
**Como evitar:** `removeCard` no service: se a chamada ao MP falhar, propagar o erro sem deletar no Prisma. Se o Prisma falhar após o MP deletar, logar o erro mas não reverter no MP (idempotente).

---

### Pitfall 6: `payment_method_id` na `Payment.create` para cartão salvo

**O que dá errado:** MP retorna `internal_error` quando `payment_method_id` não é passado ou está errado.
**Por que acontece:** O `brand` guardado no `SavedCard` pode ser em uppercase ("VISA") mas o MP exige lowercase ("visa").
**Como evitar:** `savedCard.brand.toLowerCase()` ao passar para `Payment.create`.

---

## Code Examples

### Endpoint: GET /users/me/cards

```typescript
// Source: padrão existente em client-profile.route.ts
// apps/api/src/modules/saved-cards/saved-cards.route.ts
fastify.get('/users/me/cards', {
  preHandler: [fastify.authenticate],
  schema: { tags: ['saved-cards'], security: [{ bearerAuth: [] }] },
}, async (request, reply) => {
  const userId = request.user!.id
  const cards = await service.listCards(userId)
  return reply.send(cards) // [{ id, brand, lastFour, expiresAt, isDefault }]
})
```

### Endpoint: PATCH /users/me/cards/:id

```typescript
// apps/api/src/modules/saved-cards/saved-cards.route.ts
fastify.patch('/users/me/cards/:id', {
  preHandler: [fastify.authenticate],
}, async (request, reply) => {
  const { id } = request.params as { id: string }
  const { isDefault } = z.object({ isDefault: z.boolean() }).parse(request.body)
  const userId = request.user!.id
  if (isDefault) await service.setDefault(id, userId)
  return reply.send({ ok: true })
})
```

### Endpoint: DELETE /users/me/cards/:id

```typescript
// apps/api/src/modules/saved-cards/saved-cards.route.ts
fastify.delete('/users/me/cards/:id', {
  preHandler: [fastify.authenticate],
}, async (request, reply) => {
  const { id } = request.params as { id: string }
  const userId = request.user!.id
  await service.removeCard(id, userId)
  return reply.status(204).send()
})
```

### Frontend: CardPaymentScreen — dois modos

```tsx
// apps/web/src/pages/client/CardPaymentScreen.tsx
// Lógica de modo — determinada por savedCards.length após fetch

const [savedCards, setSavedCards] = useState<SavedCard[]>([])
const [loading, setLoading] = useState(true)
const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
const [addCardExpanded, setAddCardExpanded] = useState(false)
const [saveForLater, setSaveForLater] = useState(true) // checked por padrão
const [cvv, setCvv] = useState('')

useEffect(() => {
  apiFetch('/users/me/cards')
    .then(r => r.ok ? r.json() : [])
    .then((cards: SavedCard[]) => {
      setSavedCards(cards)
      const def = cards.find(c => c.isDefault) ?? cards[0]
      if (def) setSelectedCardId(def.id)
    })
    .finally(() => setLoading(false))
}, [])

const hasSavedCards = savedCards.length > 0
```

---

## State of the Art

| Abordagem Antiga | Abordagem Atual | Quando Mudou | Impacto |
|-----------------|-----------------|--------------|---------|
| `cardTokenMp` (token bruto no User) | `SavedCard` collection + `mpCustomerId` (D-13) | Phase 10 (v1.1) | Token bruto não identifica a bandeira nem os 4 últimos dígitos — substituído por Customer API |
| Token reutilizável entre transações | Token de uso único por transação via `CardToken.create` (D-16) | Design v1.1 | PCI DSS compliance — token sempre expirado após primeiro uso |

**Deprecated/obsoleto:**
- `PUT /users/me/card-token`: endpoint criado na Phase 3 para salvar o token bruto. Na Phase 12, o `SavedCard` collection substitui esse mecanismo. O endpoint pode ser mantido por compatibilidade mas não é mais o fluxo principal.

---

## Assumptions Log

| # | Afirmação | Seção | Risco se errada |
|---|-----------|-------|-----------------|
| A1 | `@mercadopago/sdk-react@1.0.7` não tem modo "CVV-only" nativo via props | Padrão 4 | Se tiver, o input nativo customizado pode ser substituído por prop do Brick — menos trabalho |
| A2 | Salvar o cartão logo após `Payment.create` (antes do webhook approved) é o comportamento correto para cartões de crédito | Padrão 3 | Se o MP requer pagamento aprovado antes de salvar, o fluxo precisa de evento pós-webhook |
| A3 | O campo `payment_method.id` do `CustomerCardResponse` retorna o mesmo valor que `payment_method_id` do Brick (ex: `"visa"`, `"master"`) | Pitfall 6 | Se o formato for diferente, o mapeamento de bandeira para logo fica incorreto |

---

## Open Questions

1. **CVV input nativo vs. Brick "CVV-only"**
   - O que sabemos: `@mercadopago/sdk-react@1.0.7` expõe `CardPayment` que renderiza o formulário completo; não há evidência de modo "CVV-only" via props nas type definitions
   - O que não está claro: Se versões mais recentes do Brick suportam `initialization.cardId` para modo CVV-only (documentação MP pode estar atualizada além da versão instalada)
   - Recomendação: Input nativo customizado para CVV é a abordagem mais simples e compatível com D-16; evita dependência de features não documentadas

2. **Momento de salvar o cartão no MP Customer**
   - O que sabemos: D-16 diz que créditos só são adicionados após webhook `approved`; o salvamento do cartão é ação separada dos créditos
   - O que não está claro: O MP permite `createCard` com token de um pagamento `pending` (em análise antifraude)?
   - Recomendação: Salvar o cartão logo após `Payment.create` bem-sucedido (status pending/approved) — o token representa um cartão válido independentemente do status do pagamento

---

## Environment Availability

| Dependência | Requerida por | Disponível | Versão | Fallback |
|-------------|--------------|-----------|--------|---------|
| `mercadopago` SDK v3 | Customer API, CardToken API | ✓ | 3.1.0 | — |
| `@mercadopago/sdk-react` | CardPayment Brick | ✓ | 1.0.7 | — |
| `MP_ACCESS_TOKEN` | Todas as chamadas MP | ✓ (env) | — | Bloqueia execução |
| `MP_PUBLIC_KEY` | Inicialização do Brick | ✓ (env) | — | Bloqueia execução |
| MongoDB Atlas | `SavedCard` CRUD | ✓ (remoto) | — | — |
| Prisma `SavedCard` model | Espelho local dos cartões | ✓ (schema já gerado) | — | — |

**Nenhuma dependência bloqueante ausente.**

---

## Validation Architecture

### Test Framework

| Propriedade | Valor |
|-------------|-------|
| Framework | Vitest (node environment) |
| Config file | `apps/api/vitest.config.ts` |
| Comando rápido | `npm run test --workspace=apps/api` |
| Suite completa | `npm run test --workspace=apps/api && npm run test --workspace=apps/web` |

### Mapeamento Requisitos → Testes

| Req ID | Comportamento | Tipo | Comando automatizado | Arquivo existe? |
|--------|--------------|------|---------------------|-----------------|
| CARD-01 | `GET /users/me/cards` retorna lista de cartões do usuário autenticado | unit | `npm run test --workspace=apps/api -- --testPathPattern=saved-cards` | ❌ Wave 0 |
| CARD-02 | `POST /payments/card` com `saveCard: true` cria SavedCard no Prisma após Payment.create | unit | `npm run test --workspace=apps/api -- --testPathPattern=payments` | ✅ (ampliar) |
| CARD-03 | Frontend exibe CTA "Pagar sem salvar" com menor proeminência | manual | — | Manual only |
| CARD-04 | `createCardWithSaved` chama `CardToken.create` com `card_id + customer_id + security_code` e não armazena CVV | unit | `npm run test --workspace=apps/api -- --testPathPattern=saved-cards` | ❌ Wave 0 |
| CARD-05 | `setDefault` usa `prisma.$transaction` para atomicidade; `removeCard` deleta no MP e Prisma | unit | `npm run test --workspace=apps/api -- --testPathPattern=saved-cards` | ❌ Wave 0 |
| CARD-06 | `resolveAmount` funciona com `savedCardId + comboId` e com `savedCardId + customQuantity` | unit | `npm run test --workspace=apps/api -- --testPathPattern=saved-cards` | ❌ Wave 0 |

### Wave 0 Gaps

- [ ] `apps/api/src/modules/saved-cards/__tests__/saved-cards.service.test.ts` — cobre CARD-01, CARD-04, CARD-05, CARD-06
- [ ] Ampliar `payments.service.test.ts` — cobrir path `saveCard: true` (CARD-02)

---

## Security Domain

### Categorias ASVS Aplicáveis

| Categoria ASVS | Aplica | Controle padrão |
|----------------|--------|-----------------|
| V2 Autenticação | sim | JWT via `fastify.authenticate` preHandler (padrão existente) |
| V3 Session Management | não | Sem nova sessão |
| V4 Controle de Acesso | sim | `savedCard.userId !== request.user.id` → 404 (nunca 403 — não revela existência) |
| V5 Validação de Input | sim | Zod nos schemas de todos os endpoints novos |
| V6 Criptografia | sim | Nunca armazenar CVV — `CardToken.create` descarta após uso; PCI DSS via MP |

### Padrões de Ameaça Conhecidos

| Padrão | STRIDE | Mitigação padrão |
|--------|--------|-----------------|
| IDOR — acessar cartão de outro usuário | Tampering | Verificar `savedCard.userId === request.user.id` antes de qualquer operação |
| CVV leak nos logs | Information Disclosure | Nunca logar `security_code`; mascarar em logs de request body |
| Salvar cartão sem pagamento (abuso de API) | Tampering | Salvar cartão apenas dentro do fluxo de `POST /payments/card` bem-sucedido |
| Exceder limite de 3 cartões via chamadas paralelas | Tampering | Verificar contagem no service antes de `createCard` no MP |

---

## Sources

### Primary (HIGH confidence)
- SDK instalado localmente: `node_modules/mercadopago/dist/clients/customer/index.d.ts` — métodos `create`, `search`, `createCard`, `removeCard`, `listCards`
- SDK instalado localmente: `node_modules/mercadopago/dist/clients/cardToken/create/types.d.ts` — `CardTokenCreateBody` com `card_id`, `customer_id`, `security_code`
- SDK instalado localmente: `node_modules/mercadopago/dist/clients/customerCard/commonTypes.d.ts` — `CustomerCardResponse` com `last_four_digits`, `expiration_month`, `expiration_year`, `payment_method`
- `apps/api/prisma/schema.prisma` — modelo `SavedCard` (collection 18): `mpCardId`, `brand`, `lastFour`, `expiresAt`, `isDefault`
- `apps/api/prisma/schema.prisma` — `User.mpCustomerId: String?` presente
- `.planning/STATE.md` — D-13 (SavedCard collection), D-16 (CVV via Brick), decisões travadas

### Secondary (MEDIUM confidence)
- `apps/web/src/pages/client/CardPaymentScreen.tsx` — estrutura atual da tela a ser refatorada
- `apps/web/src/components/client/ComboCard.tsx` — padrão radio indicator (26×26px, borda 2px accent, círculo interno 13×13px) a replicar
- `apps/web/src/pages/client/SettingsScreen.tsx` — padrão `SectionCard`, `ContactRow`, toast, dialog confirmação

### Tertiary (LOW confidence)
- A1, A2, A3 marcados como `[ASSUMED]` no Assumptions Log

---

## Metadata

**Breakdown de confiança:**
- Stack e SDK: HIGH — type definitions verificadas localmente no SDK instalado
- Arquitetura (Customer API flow): HIGH — confirmado pelas types do SDK
- Padrão CVV input nativo: MEDIUM — alternativa prática com A1 [ASSUMED] para o modo Brick
- Pitfalls: HIGH — derivados das constraints do SDK e das regras PCI DSS explícitas (D-16)

**Data da pesquisa:** 2026-06-19
**Válido até:** 2026-07-19 (SDK e API do MP são estáveis; válido por 30 dias)
