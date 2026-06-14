# Phase 3: Credits & Commerce - Research

**Researched:** 2026-06-14
**Domain:** Mercado Pago Payments (PIX + Bricks), Credit System, React Tab Bar, Fastify Payments Module
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Polling a cada 3–5 segundos em `GET /payments/{id}/status`. Max 5 tentativas. Sem WebSocket/SSE.
**D-02:** Créditos creditados SOMENTE após backend receber e validar webhook do Mercado Pago com `status: approved`. Nunca antecipado.
**D-03:** QR code gerado pelo backend (chama MP, retorna `qr_code_base64` e `qr_code`). Sem redirecionamento — experiência nativa no app.
**D-04:** Fase 3 = apenas UI + configuração de compra recorrente. Cron job e tokenização para Fase 4/5.
**D-05:** Limiar de compra automática "acabando" = quando saldo < 7 dias de entregas no ritmo atual. Calculado pelo sistema.
**D-06:** Pagamento automático futuro usa card token do MP Bricks (salvo na primeira compra manual). Fase 3 salva o token associado ao usuário.
**D-07:** Aba "Créditos" abre diretamente CombosScreen. Extrato via botão na HomeA.
**D-08:** Abas "Agenda" e "Pedidos" = placeholder "Em breve".
**D-09:** HomeA completa, exceto dados reais de entrega (placeholder para card TodayDelivery).
**D-10:** Backend usa SDK oficial `mercadopago` npm (`apps/api`). Classes `Payment`, `MerchantOrder` etc. com TypeScript.
**D-11:** Dev/testes com credenciais sandbox do Mercado Pago. Webhooks via ngrok ou MP CLI. Env vars: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_PUBLIC_KEY`.
**D-12:** Cartão via Mercado Pago Bricks (`CardPayment`) frontend. Formulário inline — cliente não sai do app. Tokenização no frontend.

### Claude's Discretion

- Estrutura interna do módulo payments na API (controller/service/repository) — seguir Clean Architecture de `modules/auth/`
- Endpoint de webhook do Mercado Pago — validar assinatura com `MP_WEBHOOK_SECRET` antes de processar
- Modelo de dados para transações de crédito — usar coleção `CREDIT_TRANSACTIONS` já definida no schema
- Intervalo de polling — iniciar em 3 segundos, max 5 tentativas, depois parar e sugerir "verificar mais tarde"
- Stepper de quantidade — `<QuantityStepper min={1} max={N} value={v} onChange={fn} />` reutilizável

### Deferred Ideas (OUT OF SCOPE)

- Cron job de compra automática (Fase 4/5)
- Tokenização de cartão para cobranças futuras via cron (Fase 4/5)
- Estorno e reembolso de pagamentos — PAY-04 (Fase 5)
- Status de pagamento no painel Admin — PAY-03 (Fase 5/7)
- Promoções e descontos em combos — ADMG-03 (Fase 7)

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CRED-01 | Cliente pode comprar combos de pãezinhos — cada combo vira créditos no saldo | API: `POST /combos/:id/buy` → Payment MP → webhook → `CreditTransaction.PURCHASE` |
| CRED-02 | Combos configuráveis pelo Admin (nome, quantidade, preço) | `GET /combos` retorna coleção `COMBOS` ativa; leitura apenas nesta fase |
| CRED-03 | Cliente pode fazer compra personalizada (avulsa) abaixo do limite definido pelo Admin | `POST /credits/buy-custom` com `quantity` validado contra `Setting.avulsoLimite` |
| CRED-04 | Preço unitário da compra personalizada maior que o do combo | Validado no serviço: `avulsoUnit > melhorComboUnit`; configurado pelo Admin via `Setting` |
| CRED-05 | Admin define limite máximo e preço unitário da compra personalizada | `GET /pricing` lê `Setting.avulsoLimite` e `Setting.avulsoUnit` do banco |
| CRED-06 | Créditos não expiram | Modelo imutável — `CreditTransaction` sem `expiresAt`. Banner UI informativo |
| CRED-07 | Cliente ativa compra recorrente automática (modalidade "quando acabar" ou "toda semana") | `AutoBuyScreen` salva `autoRecharge` no `User` (schema precisa de campo) |
| CRED-08 | Compra automática "toda semana" tem seletor de dia e combo | `autoRecharge.mode`, `autoRecharge.weekday`, `autoRecharge.comboId` no `User` |
| CRED-09 | Notificação de créditos insuficientes sem compra automática | Banner `BannerInsuficiente` — componente criado aqui, usado ativamente na Fase 4 |
| CRED-10 | Combo comprado automaticamente com crédito insuficiente + compra automática ativa | UI mostra preferência salva; execução real na Fase 4/5 |
| CRED-11 | Saldo exibido na tela principal como número de pãezinhos disponíveis | `HomeA` card espresso: saldo via `GET /me` ou `AuthContext` atualizado |
| PAY-01 | Cliente pode pagar via Pix (Mercado Pago) | Backend `Payment.create` com `payment_method_id: 'pix'` → retorna QR code |
| PAY-02 | Cliente pode pagar via cartão de crédito ou débito (Mercado Pago) | Frontend `@mercadopago/sdk-react` `CardPayment` Brick → token → backend processa |
| UI-04 | Home Cliente — variação A "Carteira" completa | `HomeA` conforme handoff: card espresso + TodayDelivery (placeholder) + QuickActions + NextDays (placeholder) |
| UI-07 | Stepper de quantidade com min/max respeitados | `QuantityStepper` (grande 48px) + `StepperInline` (34px) — componentes novos |
| UI-08 | Tab bar do Cliente: Início / Agenda / Créditos / Pedidos | `ClientTabBar` fixo no bottom com `safe-area-inset-bottom` |

</phase_requirements>

---

## Summary

A Fase 3 implementa o núcleo comercial do Cheirin de Pão: compra de créditos, pagamento via Mercado Pago (PIX e cartão), e exibição do saldo na HomeA. A fase tem três eixos principais que precisam ser planejados em conjunto: (1) schema migration — o modelo `User` não tem `creditBalance` nem `autoRecharge`, que precisam ser adicionados; (2) módulo de pagamentos na API — dois novos módulos Fastify (`payments` e `credits`) seguindo o padrão `auth`; (3) frontend React — tab bar, HomeA completa, CombosScreen, fluxo PIX com polling, Bricks para cartão e AutoBuyScreen.

O Mercado Pago SDK Node.js (`mercadopago` v3.1.0) é um pacote oficial da empresa com 10+ anos de histórico e repositório no GitHub da organização mercadopago — [VERIFIED: npm registry + GitHub oficial]. O SDK React (`@mercadopago/sdk-react` v1.0.7) é igualmente oficial — [VERIFIED: npm registry + GitHub oficial]. A integração PIX retorna `point_of_interaction.transaction_data.qr_code_base64` e `qr_code` (copia-e-cola) na criação do pagamento. A validação de webhook usa HMAC-SHA256 com o header `x-signature` (campos `ts` e `v1`) e o manifesto `id:{id};request-id:{x-request-id};ts:{ts};` — [VERIFIED: docs.mercadopago.com.br/developers].

**Recomendação primária:** Planejar em 5 waves — (1) schema update, (2) módulo payments API + módulo credits API, (3) webhook endpoint + polling endpoint, (4) frontend tab bar + HomeA + CombosScreen, (5) fluxo PIX + fluxo cartão Bricks + AutoBuyScreen.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Geração do QR code PIX | API / Backend | — | Backend chama MP, nunca o frontend. Chave de acesso não exposta. D-03 |
| Tokenização do cartão | Browser / Client (Brick) | API / Backend (processa token) | Brick MP tokeniza no frontend — PCI compliance. D-12 |
| Validação do webhook MP | API / Backend | — | Webhook vem do MP server-to-server. Sem `authenticate` plugin. D-02 |
| Polling de status do pagamento | Browser / Client | API / Backend (endpoint) | Frontend faz polling; backend retorna status do pagamento no MongoDB. D-01 |
| Crédito ao saldo após pagamento aprovado | API / Backend | — | Somente após webhook validado. Nunca no frontend. D-02 |
| Exibição do saldo de créditos | Browser / Client | API / Backend (GET /me) | Frontend lê do AuthContext; refetch após pagamento aprovado. CRED-11 |
| Configuração de compra recorrente | Browser / Client (UI) | API / Backend (persiste) | Apenas salva preferência no banco. Cron na Fase 4/5. D-04 |
| Tab bar navegação | Browser / Client | — | `ClientTabBar` fixo no layout — React Router `useLocation` |
| Combos e pricing | API / Backend | — | `GET /combos` e `GET /pricing` — dados do banco, sem lógica no frontend |
| Cálculo de saldo (soma de transações) | API / Backend | — | Saldo calculado via `aggregate` ou campo desnormalizado no `User` |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `mercadopago` | 3.1.0 | SDK Node.js oficial MP — `Payment`, `MerchantOrder` com TypeScript | Decisão D-10 — único SDK oficial para o provedor de pagamento contratado |
| `@mercadopago/sdk-react` | 1.0.7 | CardPayment Brick React — tokenização frontend PCI-compliant | Decisão D-12 — oficial MP com suporte a React 19 (peerDeps aceita `^19.0.0`) |
| `zod` | 4.4.3 | Validação de schemas nos endpoints de payments e credits | Já no stack — padrão estabelecido nas Fases 1/2 |
| `react-router` | 7.17.0 | Roteamento da tab bar e sub-rotas do cliente | Já instalado — `useLocation`, `useNavigate` |

[VERIFIED: npm registry] para todos os quatro — confirmados com `npm view`. Sem postinstall scripts nos pacotes MP.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:crypto` (built-in) | — | HMAC-SHA256 para validação da assinatura do webhook MP | No endpoint `POST /webhooks/mercadopago` — sem dependência extra |
| `navigator.clipboard` (Web API) | — | Copiar código Pix copia-e-cola | No componente `PixWaitingScreen` — sem biblioteca |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@mercadopago/sdk-react` | SDK JS carregado via `<script>` CDN | SDK React é mais idiomático para o projeto React; CDN exige tipos manuais |
| Polling com `setInterval` | WebSocket / SSE | D-01 decide polling — sem infraestrutura adicional, suficiente para MVP |
| Saldo como aggregate de transações | Campo `creditBalance` desnormalizado no `User` | Desnormalizar é mais rápido para leitura frequente (HomeA carrega a cada visit); recomendado |

**Instalação (API):**
```bash
npm install mercadopago --workspace=apps/api
```

**Instalação (Web):**
```bash
npm install @mercadopago/sdk-react --workspace=apps/web
```

**Verificação de versão:**
```
mercadopago: 3.1.0 (npm view confirmado, 2026-06-14)
@mercadopago/sdk-react: 1.0.7 (npm view confirmado, 2026-06-14)
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `mercadopago` | npm | ~13 anos (2012-10-10) | Alto (SDK oficial) | github.com/mercadopago/sdk-nodejs | N/A* | Aprovado — organização oficial MP |
| `@mercadopago/sdk-react` | npm | ~3 anos (2023-02-15) | Moderado | github.com/mercadopago/sdk-react | N/A* | Aprovado — organização oficial MP |

*slopcheck indisponível neste ambiente. Ambos os pacotes foram verificados via:
1. `npm view` — existem no registro correto (npm, não PyPI)
2. Repositório GitHub na organização oficial `mercadopago` — confirmado via WebFetch
3. Maintainers listados no npm são da organização Mercado Pago
4. Sem `postinstall` scripts (confirmado via `npm view <pkg> scripts.postinstall`)
5. Pacotes referenciados na documentação oficial do provedor de pagamento contratado

[VERIFIED: npm registry + official docs mercadopago.com.br/developers]

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Cliente (Browser PWA)
        |
        |-- GET /combos ─────────────────────→ API: CombosRoute
        |                                           |── CombosController
        |                                           |── CombosService (lê Combo[])
        |                                           └── Resposta: [{id, name, quantity, price}]
        |
        |-- POST /payments/pix ──────────────→ API: PaymentsRoute
        |   {comboId | quantity, method:'pix'}      |── PaymentsController
        |                                           |── PaymentsService
        |                                           |   └── mercadopago.Payment.create({
        |                                           |         payment_method_id: 'pix',
        |                                           |         transaction_amount, payer
        |                                           |       })
        |                                           |── DB: Payment{status:PENDING, mpId}
        |                                           └── Resposta: {paymentId, qr_code_base64, qr_code}
        |
        |-- [polling] GET /payments/:id/status ─→ API: PaymentsRoute
        |   (3s, max 5 tentativas)                  └── {status:'pending'|'approved'|'rejected'}
        |
        |                                       Mercado Pago Servers
        |                                           |── POST /webhooks/mercadopago
        |                                           |   {data.id, type:'payment', ...}
        |                                           |── WebhookController
        |                                           |   |── validar x-signature (HMAC-SHA256)
        |                                           |   |── Payment.get(data.id) → status
        |                                           |   |── if status=='approved':
        |                                           |   |     DB: Payment{status:PAID}
        |                                           |   |     DB: CreditTransaction{type:PURCHASE, qty}
        |                                           |   |     DB: User{creditBalance += qty}
        |                                           |   └── reply 200
        |
        |-- POST /payments/card ─────────────→ API: PaymentsRoute
        |   {token, installments, ...}              |── mercadopago.Payment.create({
        |   (token gerado pelo Brick MP)             |     payment_method_id, token, ...})
        |                                           └── idem ao Pix (webhook confirma)
        |
[Brick CardPayment]──tokeniza no browser──→ token ──→ POST /payments/card
        |
        |-- GET /pricing ────────────────────→ API: PricingRoute
        |                                           └── Setting{avulsoLimite, avulsoUnit}
        |
        |-- PUT /users/me/auto-recharge ─────→ API: UsersRoute
            {mode, weekday?, comboId}               └── User.update({autoRecharge: {...}})
```

### Recommended Project Structure

```
apps/api/src/modules/
├── payments/
│   ├── payments.route.ts         # POST /payments/pix, POST /payments/card, GET /payments/:id/status
│   ├── payments.controller.ts
│   ├── payments.service.ts       # chama mercadopago SDK, cria Payment no DB
│   └── payments.repository.ts   # CRUD Payment, CreditTransaction, User.creditBalance
├── credits/
│   ├── credits.route.ts          # GET /combos, GET /pricing, GET /credits/history
│   ├── credits.controller.ts
│   ├── credits.service.ts
│   └── credits.repository.ts    # lê Combo[], Setting, CreditTransaction[]
├── webhooks/
│   ├── webhooks.route.ts         # POST /webhooks/mercadopago (SEM authenticate plugin)
│   ├── webhooks.controller.ts
│   └── webhooks.service.ts      # valida assinatura + processa aprovação

apps/web/src/
├── pages/client/
│   ├── ClientLayout.tsx          # ATUALIZAR: adicionar ClientTabBar + sub-rotas
│   ├── HomeScreen.tsx            # HomeA completa
│   ├── CombosScreen.tsx          # Combos + compra personalizada
│   ├── PixWaitingScreen.tsx      # QR code + polling
│   ├── CardPaymentScreen.tsx     # Brick CardPayment
│   ├── PurchasedScreen.tsx       # tela de sucesso
│   ├── AutoBuyScreen.tsx         # configuração de compra recorrente
│   ├── CreditHistoryScreen.tsx   # extrato de créditos
│   └── PlaceholderScreen.tsx     # Agenda e Pedidos (Em breve)
├── components/client/
│   ├── ClientTabBar.tsx          # tab bar fixa — 4 abas
│   ├── QuantityStepper.tsx       # grande (48px) — compra personalizada
│   ├── StepperInline.tsx         # pequeno (34px) — agenda semanal (reutilizado Fase 4)
│   ├── CreditBalanceCard.tsx     # card espresso com saldo
│   ├── ComboCard.tsx             # card de combo selecionável
│   └── BannerInsuficiente.tsx    # banner créditos insuficientes (usado Fase 4)
├── hooks/
│   ├── useCredits.ts             # análogo a useAuth — saldo + transações
│   └── usePaymentPolling.ts      # polling de status do pagamento
└── contexts/
    └── AuthContext.tsx           # ATUALIZAR: adicionar creditBalance ao AuthUser
```

### Pattern 1: Módulo Fastify — payments (seguir padrão auth)

**O que é:** Controller → Service → Repository por domínio, instanciados no constructor.
**Quando usar:** Todos os módulos da API neste projeto.

```typescript
// Source: apps/api/src/modules/auth/auth.route.ts (padrão estabelecido)
// payments.route.ts
import { FastifyPluginAsync } from 'fastify'
import { PaymentsController } from './payments.controller.js'

export const paymentsRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new PaymentsController(fastify)

  // Autenticadas — preHandler: [fastify.authenticate]
  fastify.post('/payments/pix', { preHandler: [fastify.authenticate] }, ctrl.createPix.bind(ctrl))
  fastify.post('/payments/card', { preHandler: [fastify.authenticate] }, ctrl.createCard.bind(ctrl))
  fastify.get('/payments/:id/status', { preHandler: [fastify.authenticate] }, ctrl.getStatus.bind(ctrl))
}
```

### Pattern 2: Criação de pagamento PIX com mercadopago SDK v3

**O que é:** Instanciar `MercadoPagoConfig` + `Payment`, chamar `.create()` com `payment_method_id: 'pix'`.
**Quando usar:** No `PaymentsService.createPix()`.

```typescript
// Source: WebSearch verificado (mercadopago.com.br/developers) + npm view mercadopago
import { MercadoPagoConfig, Payment } from 'mercadopago'

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
  options: { timeout: 5000 }
})

const paymentApi = new Payment(mpClient)

const response = await paymentApi.create({
  body: {
    transaction_amount: combo.price,
    description: `Compra ${combo.name} — Cheirin de Pão`,
    payment_method_id: 'pix',
    payer: { email: user.email ?? `${user.id}@cheirin.app` },
  }
})

// response.point_of_interaction.transaction_data.qr_code_base64
// response.point_of_interaction.transaction_data.qr_code (copia-e-cola)
// response.id → mercadoPagoId no banco
```

### Pattern 3: Validação de webhook Mercado Pago (HMAC-SHA256)

**O que é:** Verificar o header `x-signature` antes de processar o evento.
**Quando usar:** Obrigatório em `POST /webhooks/mercadopago` antes de qualquer lógica.

```typescript
// Source: docs.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks
import { createHmac } from 'node:crypto'

function validateMPSignature(
  xSignature: string,
  xRequestId: string,
  dataId: string,
  secret: string
): boolean {
  const parts = Object.fromEntries(xSignature.split(',').map(p => p.split('=')))
  const { ts, v1 } = parts

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const computed = createHmac('sha256', secret).update(manifest).digest('hex')

  return computed === v1
}
```

### Pattern 4: CardPayment Brick no frontend (React)

**O que é:** Componente React oficial do MP que tokeniza o cartão no browser.
**Quando usar:** Na `CardPaymentScreen` — o `token` recebido no `onSubmit` é enviado para o backend.

```typescript
// Source: github.com/mercadopago/sdk-react README + WebFetch docs oficiais
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react'

// Chamar uma vez (em main.tsx ou no componente de nível superior)
initMercadoPago(import.meta.env.VITE_MP_PUBLIC_KEY, { locale: 'pt-BR' })

// No componente:
<CardPayment
  initialization={{ amount: combo.price }}
  onSubmit={async (formData) => {
    // formData contém: token, payment_method_id, installments, issuer_id, etc.
    const res = await apiFetch('/payments/card', {
      method: 'POST',
      body: JSON.stringify({ ...formData, comboId: selectedComboId }),
    })
    // polling ou redirect para PurchasedScreen
  }}
  onError={(err) => console.error(err)}
  onReady={() => setIsLoading(false)}
/>
```

### Pattern 5: Polling com cleanup no React

**O que é:** `useEffect` com `setInterval` + retorno de cleanup para evitar memory leak.
**Quando usar:** `usePaymentPolling` hook — parar ao desmontar ou ao receber status final.

```typescript
// Source: padrão React estabelecido — ASSUMED (sem referência de doc específica)
function usePaymentPolling(paymentId: string | null, onApproved: () => void) {
  const [attempts, setAttempts] = useState(0)
  const MAX_ATTEMPTS = 5

  useEffect(() => {
    if (!paymentId || attempts >= MAX_ATTEMPTS) return

    const id = setInterval(async () => {
      const res = await apiFetch(`/payments/${paymentId}/status`)
      const data = await res.json()

      if (data.status === 'approved') {
        clearInterval(id)
        onApproved()
      } else if (data.status === 'rejected') {
        clearInterval(id)
      } else {
        setAttempts(a => a + 1)
      }
    }, 3000)

    return () => clearInterval(id)
  }, [paymentId, attempts])

  return { isTimeout: attempts >= MAX_ATTEMPTS }
}
```

### Pattern 6: Saldo de créditos — campo desnormalizado vs. aggregate

**Recomendação:** Adicionar `creditBalance Int @default(0)` no modelo `User` do Prisma (campo desnormalizado). Mantido consistente pelo serviço de pagamentos sempre que cria um `CreditTransaction.PURCHASE`. A alternativa (aggregate de transações a cada request) é mais lenta e desnecessária para o MVP.

```typescript
// No PaymentsService, após webhook approved:
await fastify.prisma.$transaction([
  fastify.prisma.creditTransaction.create({
    data: { userId, type: 'PURCHASE', quantity: combo.quantity, referenceId: paymentId }
  }),
  fastify.prisma.user.update({
    where: { id: userId },
    data: { creditBalance: { increment: combo.quantity } }
  })
])
```

### Anti-Patterns to Evitar

- **Creditar créditos no `POST /payments/pix`:** Nunca creditar antes do webhook aprovado. Um pagamento PIX pode ficar pendente por horas. (D-02)
- **Expor `MP_ACCESS_TOKEN` no frontend:** A variável `MP_PUBLIC_KEY` é a única que vai ao frontend (via `VITE_MP_PUBLIC_KEY`). O access token fica apenas no backend.
- **Registrar webhook com plugin `authenticate`:** O webhook vem do servidor do MP, sem Bearer token do cliente. Deve ser registrado sem o preHandler `fastify.authenticate`. (D-11 + CONTEXT.md)
- **Usar `setInterval` sem cleanup:** Sempre retornar `() => clearInterval(id)` no useEffect para evitar múltiplos pollings simultâneos.
- **`prisma migrate dev` no MongoDB:** O adapter MongoDB do Prisma não suporta migrations. Usar apenas `prisma generate` após mudanças no schema. (comentário no schema.prisma)
- **Calcular saldo somando todas as transações a cada request:** Usar campo desnormalizado `creditBalance` no `User` e atualizar atomicamente com `$transaction`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tokenização de cartão | Formulário manual de captura de dados do cartão | `CardPayment` Brick (`@mercadopago/sdk-react`) | PCI DSS compliance — dados do cartão nunca passam pelo servidor do app. Brick tokeniza no browser diretamente com MP. |
| Geração de QR code | Biblioteca de QR code (`qrcode`, `qrcodejs`) | `qr_code_base64` retornado pela API do MP | O MP já retorna o QR code como imagem base64 pronta para exibição via `<img src="data:image/png;base64,...">` |
| Validação HMAC do webhook | Implementação própria de hash | `node:crypto` built-in (`createHmac`) | Já disponível — sem dependência adicional. Ver Pattern 3. |
| Parsing de valor monetário BRL | Aritmética manual com float | Operar em centavos (Int) ou usar `Intl.NumberFormat` para display apenas | Float point errors em valores monetários causam inconsistências de arredondamento. |
| Retry com back-off para webhook MP | Loop com sleep | Confiar no retry automático do MP | O MP re-envia o webhook automaticamente em caso de falha de resposta. Responder 200 rapidamente e processar de forma idempotente. |

**Insight-chave:** O modelo de segurança do Mercado Pago exige que dados de cartão NUNCA passem pelo servidor do app — o Brick é a única abordagem compliance-compliant para MVP.

---

## Schema Changes Required (CRÍTICO)

O modelo `User` atual **não tem** `creditBalance` nem `autoRecharge`. Esses campos são necessários para a Fase 3. Como MongoDB com Prisma não usa migrations, os campos são adicionados ao schema e um `prisma generate` é suficiente — MongoDB é schemaless e aceita os novos campos sem migration.

```prisma
// Acrescentar ao model User em schema.prisma:
creditBalance Int      @default(0)
autoRecharge  Json?    // null = desativado; {mode, weekday?, comboId}
```

O campo `autoRecharge` como `Json?` evita a criação de um tipo Prisma composto adicional enquanto mantém flexibilidade para os campos `mode: 'acabar' | 'semanal'`, `weekday?: string`, `comboId?: string`.

Também adicionar `quantity Int?` e `customQuantity Int?` ao model `Payment` para distinguir compras de combo vs. avulsas — ou armazenar no `description` JSON.

**Env vars novas a adicionar em `apps/api/.env.example`:**
```
MP_ACCESS_TOKEN=TEST-...
MP_WEBHOOK_SECRET=...
MP_PUBLIC_KEY=TEST-...
```

**Env var nova no frontend `apps/web` (via Vite):**
```
VITE_MP_PUBLIC_KEY=TEST-...
```

---

## Common Pitfalls

### Pitfall 1: Webhook processado sem validação de assinatura
**O que dá errado:** Qualquer HTTP request para `/webhooks/mercadopago` é processado e credita pãezinhos ao usuário — attack surface crítico.
**Por que acontece:** O endpoint não tem o plugin `authenticate` (correto), então é público. Sem validação de assinatura, fica vulnerável.
**Como evitar:** SEMPRE validar `x-signature` com HMAC-SHA256 ANTES de qualquer lógica. Retornar `401` imediatamente se inválido. Ver Pattern 3.
**Sinais de alerta:** Se o endpoint retornar 200 sem checar `request.headers['x-signature']` → bug crítico de segurança.

### Pitfall 2: Duplo crédito por webhook duplicado
**O que dá errado:** O MP pode entregar o mesmo webhook mais de uma vez. Processar duas vezes credita o dobro de pãezinhos.
**Por que acontece:** O MP tenta re-entrega se não recebe `200` em tempo hábil, e ocasionalmente entrega duplicatas.
**Como evitar:** Checar `Payment.status === 'PAID'` antes de creditar. Se já está `PAID`, retornar `200` imediatamente sem reprocessar (idempotência). Usar `$transaction` atômico.
**Sinais de alerta:** Saldo de créditos crescendo sem compra adicional — verificar `CreditTransaction` duplicadas.

### Pitfall 3: PIX `qr_code_base64` sem prefixo MIME correto
**O que dá errado:** `<img src={qr_code_base64} />` — imagem não renderiza.
**Por que acontece:** A API do MP retorna o base64 sem o prefixo `data:image/...`. O src precisa do prefixo.
**Como evitar:** `<img src={`data:image/png;base64,${qrCode}`} />` — sempre adicionar o prefixo no frontend. (Confirmado nos docs e UI-SPEC)
**Sinais de alerta:** `<img>` renderiza mas sem conteúdo visual — verificar o `src` no DevTools.

### Pitfall 4: `setInterval` sem cleanup no polling
**O que dá errado:** Usuário navega para outra tela; o polling continua em background. Após 5 tentativas, o callback de timeout dispara em contexto desmontado → erro React.
**Por que acontece:** `setInterval` retorna um ID que precisa ser cancelado com `clearInterval` no cleanup do `useEffect`.
**Como evitar:** Sempre retornar `() => clearInterval(intervalId)` no `useEffect`. Ver Pattern 5.
**Sinais de alerta:** "Warning: Can't perform a React state update on an unmounted component."

### Pitfall 5: `MP_ACCESS_TOKEN` exposto no frontend (Vite)
**O que dá errado:** Access token vaza no bundle JavaScript — comprometimento de conta.
**Por que acontece:** Variáveis `VITE_*` são expostas no bundle; qualquer outro nome vai para o backend apenas.
**Como evitar:** Apenas `VITE_MP_PUBLIC_KEY` (chave pública) vai ao frontend. `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` ficam no backend exclusivamente. Ver Pattern 4.
**Sinais de alerta:** `import.meta.env.VITE_MP_ACCESS_TOKEN` em qualquer arquivo web → bug de segurança.

### Pitfall 6: `creditBalance` calculado por aggregate em vez de campo desnormalizado
**O que dá errado:** Cada load da HomeA dispara um `aggregate` em `CreditTransaction` — lento em produção com muitas transações.
**Por que acontece:** Falta de campo desnormalizado; serviço calcula saldo na hora.
**Como evitar:** Usar `creditBalance` como campo no `User`, atualizado atomicamente a cada transação via Prisma `$transaction`. Ver Pattern 6.

### Pitfall 7: Bricks CardPayment e React 19 — peerDeps
**O que dá errado:** Possíveis avisos de peerDeps com versões exatas.
**Por que acontece:** `@mercadopago/sdk-react` declara `peerDependencies: { react: '^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0' }` — React 19 está explicitamente suportado.
**Como evitar:** Nenhuma ação necessária. O projeto usa React 19.2.7 que está dentro do range.
**Sinais de alerta:** Se `npm install` mostrar peerDep warnings — verificar a versão do SDK.

### Pitfall 8: `prisma migrate dev` no schema MongoDB
**O que dá errado:** Comando falha; MongoDB não suporta migrations via Prisma.
**Por que acontece:** Confusão com projetos SQL onde `migrate dev` é o fluxo padrão.
**Como evitar:** Após adicionar `creditBalance` e `autoRecharge` ao schema, rodar apenas `prisma generate`. MongoDB aceita os novos campos sem migration. (Confirmado pelo comentário no schema.prisma)

---

## Code Examples

### Criação de pagamento PIX (backend)

```typescript
// Source: mercadopago.com.br/developers (WebSearch verificado)
import { MercadoPagoConfig, Payment } from 'mercadopago'

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })
const paymentApi = new Payment(client)

const mpPayment = await paymentApi.create({
  body: {
    transaction_amount: 24.90,
    description: 'Combo Família — Cheirin de Pão',
    payment_method_id: 'pix',
    payer: { email: 'cliente@email.com' },
  }
})

// Retorna:
// mpPayment.id → string (mercadoPagoId)
// mpPayment.point_of_interaction.transaction_data.qr_code_base64 → base64 da imagem PNG
// mpPayment.point_of_interaction.transaction_data.qr_code → string copia-e-cola
```

### Validação de assinatura de webhook (backend)

```typescript
// Source: docs.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks [VERIFIED]
import { createHmac } from 'node:crypto'

// No WebhookController:
const xSignature = request.headers['x-signature'] as string
const xRequestId = request.headers['x-request-id'] as string
const dataId = (request.query as { 'data.id': string })['data.id']

const parts = Object.fromEntries(xSignature.split(',').map(p => p.split('=')))
const { ts, v1 } = parts

const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
const hash = createHmac('sha256', process.env.MP_WEBHOOK_SECRET!).update(manifest).digest('hex')

if (hash !== v1) {
  return reply.status(401).send({ error: 'Assinatura inválida' })
}
```

### QR code inline no frontend

```tsx
// Source: UI-SPEC.md §Fluxo Pix [VERIFIED: handoff canônico]
function PixQrCode({ qrCodeBase64, qrCode }: { qrCodeBase64: string; qrCode: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(qrCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <img
        src={`data:image/png;base64,${qrCodeBase64}`}
        width={200}
        height={200}
        style={{ borderRadius: 12 }}
        alt="QR Code PIX"
      />
      <div style={{ /* monospace, surface2, borderRadius 10px, padding 12px */ }}>
        {qrCode}
      </div>
      <button onClick={handleCopy}>
        {copied ? 'Copiado!' : 'Copiar código'}
      </button>
    </div>
  )
}
```

### Tab bar do Cliente

```tsx
// Source: UI-SPEC.md §Tab Bar [VERIFIED: handoff canônico]
// ClientTabBar.tsx
import { useLocation, useNavigate } from 'react-router'
import { Icon } from '../brand/Icon'

const TABS = [
  { label: 'Início',   icon: 'home',     path: '/client/home'    },
  { label: 'Agenda',   icon: 'calendar', path: '/client/agenda'  },
  { label: 'Créditos', icon: 'coin',     path: '/client/creditos' },
  { label: 'Pedidos',  icon: 'bag',      path: '/client/pedidos' },
] as const

export function ClientTabBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      background: 'var(--color-surface)',
      borderTop: '1px solid var(--color-border-2)',
      height: 56,
      paddingBottom: 'env(safe-area-inset-bottom)',
      display: 'flex',
    }}>
      {TABS.map(tab => {
        const active = pathname.startsWith(tab.path)
        return (
          <button key={tab.path} onClick={() => navigate(tab.path)}
            style={{ flex: 1, minHeight: 44, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
              background: 'none', border: 'none', cursor: 'pointer' }}>
            <Icon name={tab.icon} size={22} color={active ? 'var(--color-gold)' : 'var(--color-text-ter)'} />
            <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 600,
              color: active ? 'var(--color-accent)' : 'var(--color-text-ter)',
              fontFamily: 'var(--font-body)' }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
```

### AuthUser atualizado para incluir saldo

```typescript
// Source: apps/web/src/contexts/AuthContext.tsx — MODIFICAR
export interface AuthUser {
  id: string
  role: 'CLIENT' | 'COURIER' | 'ADMIN'
  name: string
  creditBalance: number  // NOVO — adicionado na Fase 3
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MP SDK v1 (global `mercadopago.configurations.setAccessToken()`) | MP SDK v3 (`MercadoPagoConfig` + classes instanciáveis) | v2.0.0 → 2023 | Tipagem TypeScript nativa, testabilidade |
| MP Checkout Pro (redirecionamento externo) | MP Checkout Bricks (inline no app) | 2022+ | Experiência no app sem redirecionamento — PCI compliant |
| Geração de QR code no frontend | QR code gerado e retornado pelo backend | — | Segurança — access token permanece no backend |
| `setInterval` sem cleanup | `useEffect` com `clearInterval` no return | — | Padrão React moderno — evita memory leaks |

**Deprecated/obsoleto:**
- `mercadopago.configure()` e API global: substituída pelo padrão de instâncias do SDK v3. Não usar exemplos antigos do Google que ainda mostram o padrão v1.
- MP Checkout Pro para este caso de uso: funciona mas redireciona o usuário para fora do app — incompatível com D-12.

---

## Runtime State Inventory

> Esta fase é de desenvolvimento greenfield de novos módulos — sem rename/refactor/migration de estado existente. No entanto, há uma mudança de schema que precisa ser documentada.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Schema `User` sem `creditBalance` e `autoRecharge` | `prisma generate` após adicionar campos ao schema.prisma — MongoDB aceita sem migration |
| Live service config | Nenhum webhook configurado no painel MP ainda | Configurar URL do ngrok/produção no painel Mercado Pago durante desenvolvimento |
| OS-registered state | None — sem processos registrados | None |
| Secrets/env vars | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_PUBLIC_KEY` ainda não existem no `.env` | Adicionar ao `apps/api/.env` e `apps/api/.env.example`; `VITE_MP_PUBLIC_KEY` no frontend |
| Build artifacts | None — sem pacotes instalados ainda para esta fase | None |

---

## Open Questions

1. **Saldo no AuthContext: refetch completo vs. endpoint `/me` com creditBalance**
   - O que sabemos: `AuthContext` armazena `user` com `id`, `role`, `name`. Não tem `creditBalance`.
   - O que está indefinido: Ao aprovar o pagamento (via polling), o frontend atualiza o saldo como? (a) Invalidar e re-fetch do `/me`; (b) Retornar o novo saldo no `GET /payments/:id/status`; (c) Atualizar localmente via context.
   - Recomendação: Opção (b) — `GET /payments/:id/status` retorna `{ status, creditBalance }` quando `approved`. Frontend atualiza AuthContext sem re-fetch completo. Isso evita um endpoint `/me` separado e mantém a lógica no fluxo de polling.

2. **Card token para compra recorrente — onde salvar no banco**
   - O que sabemos: D-06 diz que Fase 3 salva o card token do Brick. O schema `User` não tem campo para isso.
   - O que está indefinido: `cardToken String?` no `User`, ou coleção separada `PaymentMethod`?
   - Recomendação: `cardTokenMp String?` no `User` (simples para MVP; uma única fonte de token por usuário). A Fase 4/5 pode evoluir para uma coleção `PaymentMethod` se houver múltiplos cartões.

3. **Preço do combo em centavos ou float**
   - O que sabemos: `Combo.price Float` no schema. MP recebe `transaction_amount` como Float (ex: `24.90`).
   - O que está indefinido: Aritmética de float pode causar `24.900000000001` em alguns casos.
   - Recomendação: Manter `Float` no schema (compatível com MP) mas usar `Math.round(price * 100) / 100` antes de enviar para o MP. Para display, sempre usar `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | API (mercadopago SDK requer Node >=18) | ✓ | via Turborepo dev | — |
| MongoDB Atlas (remoto) | Prisma — todas as operações | ✓ (dev/prod) | Atlas Cloud | None — sem fallback local por design |
| `mercadopago` npm pkg | API PaymentsService | Ainda não instalado | 3.1.0 disponível | None — provedor único |
| `@mercadopago/sdk-react` npm pkg | Web CardPaymentScreen | Ainda não instalado | 1.0.7 disponível | None — Bricks exige |
| Credenciais MP sandbox | Dev testing | Requer cadastro | — | MP sandbox gratuito — sem custo |
| ngrok (ou MP CLI) | Testar webhooks localmente | [ASSUMED] não verificado | — | MP CLI como alternativa |
| VITE_MP_PUBLIC_KEY | Web initMercadoPago | Não configurado ainda | — | Obrigatório para Brick |

**Missing dependencies with no fallback:**
- Credenciais sandbox do Mercado Pago (`MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET`) — precisam ser criadas no painel de desenvolvedor antes de testar
- Ferramenta de tunelamento local para webhooks (ngrok ou MP CLI) — sem isso, webhooks não chegam ao servidor local

**Missing dependencies with fallback:**
- ngrok → alternativa: Mercado Pago CLI (gratuita, suporte a forward de webhooks)

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (já configurado em ambos os apps) |
| Config file (API) | `apps/api/vitest.config.ts` |
| Config file (Web) | `apps/web/vitest.config.ts` (jsdom + React Testing Library) |
| Quick run command | `npm run test --workspace=apps/api` |
| Full suite command | `npm run test` (na raiz — executa todos os workspaces) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CRED-01 | Compra combo cria `Payment` + `CreditTransaction.PURCHASE` + incrementa `creditBalance` | unit | `vitest run --reporter=verbose` em `apps/api/src/__tests__/payments.service.test.ts` | ❌ Wave 0 |
| CRED-03 | Compra personalizada rejeita quantity >= avulsoLimite | unit | idem acima | ❌ Wave 0 |
| CRED-04 | Preço unitário avulso > melhor combo/pão | unit | `credits.service.test.ts` | ❌ Wave 0 |
| PAY-01 | Webhook `status:approved` incrementa saldo sem duplicata (idempotência) | unit | `webhooks.service.test.ts` | ❌ Wave 0 |
| PAY-01 | Webhook com assinatura inválida retorna 401 | unit | idem | ❌ Wave 0 |
| CRED-11 | `creditBalance` retornado no polling endpoint quando approved | unit | `payments.service.test.ts` | ❌ Wave 0 |
| UI-07 | `QuantityStepper` não permite value > max ou < min | unit (RTL) | `vitest run` em `apps/web` | ❌ Wave 0 |
| UI-08 | `ClientTabBar` renderiza 4 abas; aba ativa recebe estilo correto | unit (RTL) | idem | ❌ Wave 0 |
| UI-04 | `HomeA` exibe o `creditBalance` do usuário | unit (RTL) | idem | ❌ Wave 0 |
| PAY-02 | `CardPaymentScreen` integração com Brick — smoke test com mock | smoke/manual | Manual + mock do SDK | Manual apenas |

**Testes manuais (só possível com sandbox MP ativo):**
- Fluxo PIX completo end-to-end (QR code → pagamento no app de banco simulado → webhook → saldo atualizado)
- Fluxo cartão end-to-end com CartãoTest MP (número de cartão de teste)

### Sampling Rate
- **Por commit de task:** `npm run test --workspace=apps/api` + `npm run test --workspace=apps/web`
- **Por wave:** Full suite — `npm run test` na raiz
- **Phase gate:** Full suite verde antes de `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/api/src/__tests__/payments.service.test.ts` — cobre CRED-01, CRED-03, PAY-01 (idempotência), CRED-11
- [ ] `apps/api/src/__tests__/webhooks.service.test.ts` — cobre PAY-01 (assinatura), CRED-01 (crédito via webhook)
- [ ] `apps/api/src/__tests__/credits.service.test.ts` — cobre CRED-04
- [ ] `apps/web/src/components/client/__tests__/QuantityStepper.test.tsx` — cobre UI-07
- [ ] `apps/web/src/components/client/__tests__/ClientTabBar.test.tsx` — cobre UI-08
- [ ] `apps/web/src/pages/client/__tests__/HomeScreen.test.tsx` — cobre UI-04, CRED-11

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | sim (endpoints autenticados) | `fastify.authenticate` preHandler já estabelecido (Fase 2) |
| V3 Session Management | não (já implementado Fase 2) | — |
| V4 Access Control | sim (webhook sem auth, mas com assinatura) | HMAC-SHA256 via `node:crypto` |
| V5 Input Validation | sim (todos os endpoints) | Zod schemas no controller (padrão da Fase 2) |
| V6 Cryptography | sim (HMAC webhook) | `node:crypto` built-in — nunca implementação manual de crypto |

### Known Threat Patterns para este Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Webhook spoofing (requisição falsa para `/webhooks/mercadopago`) | Spoofing | HMAC-SHA256 com `MP_WEBHOOK_SECRET` — rejeitar se assinatura inválida |
| Double-credit via replay de webhook | Tampering | Checar `Payment.status` antes de creditar — idempotência obrigatória |
| Exposição do Access Token MP no frontend | Information Disclosure | `MP_ACCESS_TOKEN` nunca em variáveis `VITE_*`; apenas `VITE_MP_PUBLIC_KEY` |
| SQLi/NoSQL injection via inputs de pagamento | Tampering | Zod schema validation + Prisma (queries parametrizadas automaticamente) |
| Crédito antes da confirmação do pagamento | Elevation of Privilege | Nunca creditar antes do webhook `approved` (D-02) |
| CORS no endpoint de webhook | Spoofing | Webhook vem server-to-server — CORS não se aplica, mas IP allowlist é recomendável em produção |

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact na Fase 3 |
|-----------|-----------------|
| Stack Frontend: React + Vite + Tailwind CSS + Zod | `@mercadopago/sdk-react` é compatível; sem UI library externa (componentes próprios) |
| Stack Backend: Node.js + Fastify + Prisma + MongoDB Atlas | `mercadopago` npm + Fastify plugin pattern; sem SQL migrations |
| Pagamentos: Mercado Pago exclusivamente | Confirma uso de `mercadopago` SDK + Bricks — sem outras opções |
| Banco: MongoDB Atlas remoto (não local) | `prisma generate` após schema changes; sem `prisma migrate dev` |
| Alta Fidelidade de Design | UI-SPEC.md é autoritativo — valores exatos do handoff são mandatórios |
| GSD Workflow Enforcement | Não editar arquivos diretamente fora do GSD workflow |

---

## Sources

### Primary (HIGH confidence)
- `apps/api/prisma/schema.prisma` — modelos Payment, CreditTransaction, Combo, Setting, User confirmados [VERIFIED: codebase]
- `apps/api/src/modules/auth/` — padrão Controller/Service/Repository estabelecido [VERIFIED: codebase]
- `.projeto/design_handoff_cheirin_pao/app/screens-order.jsx` — CombosScreen, PurchasedScreen [VERIFIED: handoff canônico]
- `.projeto/design_handoff_cheirin_pao/app/screens-home.jsx` — HomeA [VERIFIED: handoff canônico]
- `.projeto/design_handoff_cheirin_pao/app/screens-client-extra.jsx` — AutoBuyScreen [VERIFIED: handoff canônico]
- `03-UI-SPEC.md` — contrato de design completo para todos os componentes [VERIFIED: arquivo do projeto]
- `03-CONTEXT.md` — decisões D-01 a D-12 [VERIFIED: arquivo do projeto]
- docs.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks — validação x-signature [VERIFIED: WebFetch de doc oficial]

### Secondary (MEDIUM confidence)
- npm view mercadopago — versão 3.1.0, repositório github.com/mercadopago/sdk-nodejs [VERIFIED: npm registry]
- npm view @mercadopago/sdk-react — versão 1.0.7, React 19 suportado (peerDeps) [VERIFIED: npm registry]
- WebSearch mercadopago PIX qr_code_base64 response — `point_of_interaction.transaction_data` confirmado em múltiplas fontes [MEDIUM]
- github.com/mercadopago/sdk-react README — padrão `initMercadoPago` + `CardPayment` component [VERIFIED: WebFetch]

### Tertiary (LOW confidence)
- Previsão de compatibilidade React 19 com sdk-react (peerDeps declara suporte mas sem teste manual neste ambiente) [ASSUMED]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@mercadopago/sdk-react` v1.0.7 funciona corretamente com React 19.2.7 em produção (peerDeps declara suporte) | Standard Stack | Pitfall 7 — instalar e testar cedo; fallback é usar SDK JS via script tag CDN |
| A2 | ngrok está disponível no ambiente de desenvolvimento do desenvolvedor | Environment Availability | Sem impacto no código; apenas atrasa testes de webhook. Alternativa: MP CLI |
| A3 | `point_of_interaction.transaction_data.qr_code_base64` retorna PNG (não JPEG) | Code Examples | Mudar prefixo MIME para `image/jpeg` se não renderizar — testar com sandbox |
| A4 | `cardTokenMp String?` no `User` é suficiente para salvar o card token na Fase 3 | Schema Changes | Se usuário tiver múltiplos cartões no futuro → refatorar para `PaymentMethod` collection na Fase 5/7 |

**Total de claims [VERIFIED] ou [CITED]:** a grande maioria. Os 4 assumptions acima são os únicos pontos que precisam de confirmação durante execução.

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — packages verificados via npm view; repositórios oficiais confirmados
- Architecture: HIGH — padrões extraídos diretamente do código existente (Fase 2)
- Pitfalls: HIGH — validados contra documentação oficial MP e padrões React
- Schema changes: HIGH — inspecionado diretamente no schema.prisma

**Research date:** 2026-06-14
**Valid until:** 2026-07-14 (SDK MP é estável; 30 dias razoável)
