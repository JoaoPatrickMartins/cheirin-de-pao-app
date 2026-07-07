# Plano — Pix via Mercado Pago (só o Pix; cartão continua no Stripe)

## Objetivo
Trocar **apenas o Pix** do Stripe para o **Mercado Pago** (0,99%, sem taxa fixa, aceita CPF).
O **cartão permanece 100% no Stripe** (off_session sem CVV, cartões salvos, auto-recharge).
O **núcleo de créditos não muda** — ele já é agnóstico de provedor.

## Princípio que torna isso barato de fazer
O que credita o cliente (`creditUserBalance` + `updatePaymentStatus('PAID')` + `notifyAdminsCreditPurchase`)
é comum a qualquer provedor. Trocar o Pix = trocar só (a) como se **cria a cobrança** e
(b) como se **confirma o pagamento**. Nada além disso.

## Estado atual a favor (já existe)
- `model Payment` já tem o campo **`mercadoPagoId String?`** (legado pré-Stripe).
- `PaymentsRepository` já tem **`findPaymentByMercadoPagoId(mpId)`**.
- `getStatus(paymentId)` é **agnóstico** — lê o status do banco pelo `paymentId`, não importa o provedor.
- Frontend (`PixWaitingScreen`) consome `pixQrCodeUrl` (usado num `<img src>`) e `pixCopyPaste` (string).
  MP entrega `qr_code` (copia-e-cola) e `qr_code_base64` (imagem) → **frontend não muda**.

## Arquitetura da confirmação (2 caminhos, redundantes)
1. **Pull (reconciliação no polling)** — no `getStatus`, se o pagamento é Pix + PENDING + tem
   `mercadoPagoId`, consulta o MP (`payment.get`) e, se aprovado, credita (idempotente).
   → **Funciona sem webhook público** — ideal para localhost/CPF e como rede de segurança.
2. **Webhook (push)** — endpoint `/webhooks/mercadopago` com validação de assinatura `x-signature`.
   → Em produção (URL pública) confirma na hora, sem depender do polling.

Ambos chamam a MESMA função de crédito idempotente (checa `status === 'PAID'` antes).

---

## Mudanças no BACKEND

### 1. Dependência
- `npm i mercadopago` (SDK oficial v2) no workspace `apps/api`.

### 2. Env (`apps/api/.env.production` e `.env.example`)
```
# Mercado Pago — Pix
MP_ACCESS_TOKEN=APP_USR-...        # Access Token de PRODUÇÃO (conta CPF), painel MP > Suas integrações
MP_WEBHOOK_SECRET=...              # "Assinatura secreta" do webhook (painel MP > Webhooks)
```
Adicionar `MP_ACCESS_TOKEN` como **obrigatório** no `envSchema` do `server.ts`
(o Pix quebra sem ele), `MP_WEBHOOK_SECRET` como opcional (só o webhook usa).

### 3. Novo serviço — `src/modules/payments/mercadopago-pix.service.ts`
Espelha o papel do `StripeService`, mas só para Pix:
```ts
import { MercadoPagoConfig, Payment } from 'mercadopago'
// client singleton lazy (igual ao getStripe): não quebra testes sem a env.
// createPix({ amount, description, payerEmail, payerName, metadata, idempotencyKey })
//   → payment.create({ body: { transaction_amount, description,
//       payment_method_id: 'pix', payer: { email, first_name, last_name }, metadata } })
//   → retorna { id, status, qrCode, qrCodeBase64, expiresAt }
// getPayment(id) → payment.get({ id })  (usado no pull)
// refund(id)     → new PaymentRefund(client).create(...)  (estorno via API)
// validateWebhookSignature(headers, dataId) → HMAC-SHA256 do manifest
//   `id:${dataId};request-id:${xRequestId};ts:${ts};` comparado ao v1 do x-signature
```

### 4. `PaymentsService.createPix` — trocar o provedor
- Remover a chamada a `this.stripe.getOrCreateCustomer` e `this.stripe.createPixPayment`.
- Chamar `this.mp.createPix({ amount, description, payerEmail: user.email, payerName: user.name, metadata })`.
- Persistir com **`mercadoPagoId: mpPayment.id`** (NÃO `stripePaymentIntentId`), `method: 'PIX'`, `status: 'PENDING'`.
- Retornar:
  - `pixCopyPaste`  = `qrCode`
  - `pixQrCodeUrl`  = `` `data:image/png;base64,${qrCodeBase64}` ``  (frontend não muda)
  - `expiresAt`     = `date_of_expiration` (não é usado pela tela, manter por compatibilidade)
- `createCard`, `chargeAutoRecharge`, cartões salvos → **inalterados** (Stripe).

### 5. `PaymentsService.getStatus` — adicionar reconciliação por pull
- Se `payment.status === 'PENDING'` e `payment.method === 'PIX'` e `payment.mercadoPagoId`:
  - `mp = await this.mp.getPayment(payment.mercadoPagoId)`
  - se `mp.status === 'approved'` → chamar `creditFromMercadoPago(payment.mercadoPagoId)` (idempotente)
  - se `mp.status` em `rejected/cancelled` → `updatePaymentStatus(FAILED)`
- Depois segue a lógica atual (lê o status já atualizado). Assim o polling confirma sozinho.

### 6. Crédito compartilhado — refatorar `WebhooksService`
- Extrair a lógica de `creditFromPaymentIntent` para um método reutilizável que credita
  a partir de um **registro `Payment`** (quantidade via `customQuantity ?? comboQuantity`),
  seta `PAID` e notifica. Idempotente (early-return se já `PAID`).
- Criar `creditFromMercadoPago(mpId)` que busca via `findPaymentByMercadoPagoId` e reusa esse método.
- `getStatus` (pull) e o webhook MP chamam `creditFromMercadoPago`.

### 7. Webhook MP — `src/modules/webhooks/mercadopago-webhook.route.ts` (plugin separado)
- **Plugin próprio** (NÃO no mesmo do Stripe): o webhook do Stripe sobrescreve o parser p/ Buffer;
  o MP usa JSON normal. Manter isolados evita conflito de content-type.
- `POST /webhooks/mercadopago` (público, sem authenticate):
  1. Valida `x-signature`/`x-request-id` com `MP_WEBHOOK_SECRET`. Assinatura inválida → 401.
  2. Se `type/topic === 'payment'` → `getPayment(data.id)`; se `approved` → `creditFromMercadoPago(data.id)`.
  3. Sempre responde **200** rápido (MP re-tenta em erro/timeout).

### 8. Limpeza do Stripe Pix
- Manter `StripeService.createPixPayment` só se quiser rollback fácil; senão **remover** o método
  e os trechos de doc que citam "Pix no Stripe". O webhook do Stripe segue tratando **cartão**
  (`payment_intent.succeeded`) normalmente.

---

## Mudanças no FRONTEND
**Praticamente nenhuma.** `PixWaitingScreen` e `usePaymentPolling` já funcionam com os
mesmos campos (`pixQrCodeUrl` como data-URI base64 + `pixCopyPaste`).

**Melhoria recomendada (opcional, mas importante p/ UX de Pix):**
`usePaymentPolling` hoje tenta só **5× a cada 3s (15s)** — curto demais para Pix (o usuário
leva mais que isso para abrir o banco e pagar). Sugerido: aumentar para ~40 tentativas a cada
3s (≈2 min) quando o método for Pix, e/ou tornar `MAX_ATTEMPTS`/intervalo parametrizáveis.

---

## Plano de teste
1. **Localhost (sem webhook público)** — confia no **pull**:
   - `MP_ACCESS_TOKEN` de produção no `.env.production`.
   - Comprar combo → gerar Pix → pagar no app do banco → o polling (getStatus reconcilia com MP)
     credita. Aumentar o poll window ajuda a não estourar o timeout.
2. **Webhook (produção ou túnel)**:
   - Cadastrar `https://<dominio>/webhooks/mercadopago` no painel MP, tópico **payment**.
   - Copiar a **assinatura secreta** para `MP_WEBHOOK_SECRET`.
   - Pagar um Pix → confirmar que credita via push e que assinatura inválida é rejeitada (401).
3. **Estorno** via API (`refund`) e conferir `REFUNDED`.

## Rollback
- `PaymentsService.createPix` volta a usar `this.stripe.createPixPayment` (se o método for mantido).
- Sem migração de dados: pagamentos por cartão nunca deixaram o Stripe; Pix novos usam `mercadoPagoId`.

## Riscos / observações
- **CPF comercial**: MP cobra 0,99% em QR dinâmico (esperado). Confirmar que a conta CPF gera
  Access Token de produção sem exigir CNPJ. (Ver [[stripe-migration-progress]] e histórico MP.)
- **payer.email** é obrigatório no Pix do MP → usar `user.email` (todos têm, é o login).
- **Saldo MP**: o dinheiro cai no saldo do Mercado Pago; configurar saque/transferência p/ conta.
- **Idempotência**: pull + webhook podem coincidir; o early-return em `PAID` evita crédito duplo.
- **`isBusinessError`** no controller: hoje distingue erro de negócio do "erro cru do SDK" checando
  ausência de `message`/`cause`. Erros do SDK do MP também têm `message` → o guard continua válido
  (cai no 500 genérico, sem vazar). Revisar ao integrar.

## Checklist de execução (ordem sugerida)
1. [ ] `npm i mercadopago` em apps/api
2. [ ] Env: `MP_ACCESS_TOKEN` (+ schema em server.ts), `MP_WEBHOOK_SECRET`; atualizar `.env.example`
3. [ ] `mercadopago-pix.service.ts` (create/get/refund/validateSignature)
4. [ ] Refatorar `WebhooksService`: extrair crédito compartilhado + `creditFromMercadoPago`
5. [ ] `PaymentsService.createPix` → MP; retorno data-URI base64
6. [ ] `PaymentsService.getStatus` → reconciliação pull
7. [ ] `mercadopago-webhook.route.ts` (plugin próprio) + registrar no `server.ts`
8. [ ] (Opcional) aumentar poll window do Pix no `usePaymentPolling`
9. [ ] Remover/aposentar `StripeService.createPixPayment` e docs de "Pix Stripe"
10. [ ] Testes: unit (service com MP mockado + idempotência) e manual (localhost pull → produção webhook)
```
