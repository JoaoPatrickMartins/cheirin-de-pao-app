# Cheirin de Pão — API REST

**Base URL (dev):** `http://localhost:3001`  
**Base URL (prod):** `https://api.cheirindepao.com.br` *(placeholder)*  
**Formato:** JSON  
**Auth:** Bearer JWT em `Authorization: Bearer <token>`  
**Rate limit global:** 200 req/min por IP

---

## Autenticação

Rotas protegidas exigem header:

```
Authorization: Bearer <jwt_token>
```

O token JWT é obtido via `POST /auth/otp/verify`.

**Roles:** `CLIENT` · `COURIER` · `ADMIN`  
Rotas admin verificam `role === 'ADMIN'` inline no controller.  
Rotas courier verificam via `requireCourier` preHandler.

---

## Códigos de Status Padrão

| Código | Significado |
|--------|-------------|
| 200 | OK |
| 201 | Criado |
| 204 | Sem conteúdo (DELETE) |
| 400 | Validação ou erro de negócio |
| 403 | Não autorizado (role incorreto) |
| 404 | Recurso não encontrado |
| 409 | Conflito (ex: CPF duplicado) |
| 422 | Transição de estado inválida |
| 500 | Erro interno do servidor |
| 502 | Erro da API externa (Mercado Pago) |
| 503 | Banco de dados desconectado |

---

## 1. Health

### `GET /health`

Verifica saúde da API e conexão com o banco.

**Auth:** Pública

**Response 200:**
```json
{ "ok": true, "db": "connected" }
```

**Response 503:**
```json
{ "ok": false, "db": "disconnected", "error": "..." }
```

---

## 2. Auth

Rate limit especial: 5 req/min por IP nos endpoints OTP.

### `GET /condominiums`

Lista condomínios disponíveis para cadastro.

**Auth:** Pública

**Response 200:**
```json
[
  {
    "id": "abc123",
    "name": "Residencial Primavera",
    "type": "BLOCKS",
    "neighborhood": "Centro"
  }
]
```

---

### `POST /auth/register`

Cria conta de cliente (5 passos do onboarding).

**Auth:** Pública  
**Rate limit:** 5 req/min

**Request Body:**
```json
{
  "name": "João Silva",
  "cpf": "12345678901",
  "birthDate": "1990-01-15T00:00:00.000Z",
  "phone": "11999998888",
  "email": "joao@email.com",
  "channel": "sms",
  "condominiumId": "abc123",
  "apartment": "101",
  "block": "A"
}
```

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `name` | string | ✓ | mín 2 chars |
| `cpf` | string | ✓ | 11 dígitos, validado |
| `birthDate` | string (ISO) | — | |
| `phone` | string | ✓* | *phone ou email obrigatório |
| `email` | string | ✓* | *phone ou email obrigatório |
| `channel` | `"sms"` \| `"email"` | ✓ | canal para receber OTP |
| `condominiumId` | string | ✓ | |
| `apartment` | string | ✓ | |
| `block` | string | — | para condomínios com blocos |

**Response 201:**
```json
{ "userId": "user_abc", "role": "CLIENT", "name": "João Silva" }
```

---

### `POST /auth/otp/send`

Envia código OTP de 4 dígitos por SMS ou e-mail.

**Auth:** Pública  
**Rate limit:** 5 req/min

**Request Body:**
```json
{ "phone": "11999998888" }
```
*ou*
```json
{ "email": "joao@email.com" }
```

**Response 200:**
```json
{ "ok": true, "userId": "user_abc" }
```

> **Dev:** `OTP_DEV_CODE=1234` — o código fixo `1234` funciona em desenvolvimento.

---

### `POST /auth/otp/verify`

Verifica OTP e retorna JWT de sessão.

**Auth:** Pública  
**Rate limit:** 5 req/min

**Request Body:**
```json
{
  "userId": "user_abc",
  "code": "1234",
  "deviceId": "device-uuid"
}
```

| Campo | Tipo | Notas |
|-------|------|-------|
| `userId` | string | retornado por `/auth/otp/send` |
| `code` | string | exatamente 4 caracteres |
| `deviceId` | string | UUID único do dispositivo |

**Response 200:**
```json
{
  "token": "eyJhbGc...",
  "user": { "id": "user_abc", "role": "CLIENT", "name": "João Silva" }
}
```

---

### `POST /auth/couriers`

Cadastra novo entregador (apenas Admin).

**Auth:** Bearer + ADMIN

**Request Body:**
```json
{
  "name": "Carlos Entregador",
  "cpf": "98765432100",
  "phone": "11988887777"
}
```

**Response 201:**
```json
{ "userId": "user_xyz", "role": "COURIER", "name": "Carlos Entregador" }
```

---

## 3. Pagamentos

### `POST /payments/pix`

Cria pagamento Pix via Mercado Pago.

**Auth:** Bearer (CLIENT)

**Request Body:**
```json
{ "comboId": "combo_abc" }
```
*ou compra avulsa:*
```json
{ "customQuantity": 10 }
```

**Response 201:**
```json
{
  "paymentId": "pay_abc",
  "status": "pending",
  "qrCode": "00020126..."
}
```

---

### `POST /payments/card`

Cria pagamento com cartão via MP Bricks.

**Auth:** Bearer (CLIENT)

**Request Body:**
```json
{
  "token": "mp_card_token_abc",
  "installments": 1,
  "issuerId": "24",
  "paymentMethodId": "visa",
  "payerEmail": "joao@email.com",
  "payerIdentification": { "type": "CPF", "number": "12345678901" },
  "comboId": "combo_abc"
}
```

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `token` | string | ✓ | token do cartão gerado pelo MP Bricks |
| `installments` | number | — | padrão 1 |
| `issuerId` | string | — | |
| `paymentMethodId` | string | — | |
| `payerEmail` | string | — | |
| `payerIdentification` | object | — | `{ type, number }` |
| `comboId` | string | ✓* | *comboId ou customQuantity |
| `customQuantity` | number | ✓* | *comboId ou customQuantity |

**Response 201:**
```json
{ "paymentId": "pay_xyz", "status": "approved" }
```

---

### `GET /payments/:id/status`

Consulta status de um pagamento.

**Auth:** Bearer

**Response 200:**
```json
{ "paymentId": "pay_abc", "status": "approved", "amount": 49.90 }
```

---

### `POST /webhooks/mercadopago`

Recebe notificações do Mercado Pago. Valida HMAC-SHA256. Processa crédito de forma atômica com idempotência.

**Auth:** Pública (chamada pelo MP)

**Response 200:**
```json
{ "ok": true }
```

---

## 4. Créditos

### `GET /combos`

Lista combos disponíveis para compra.

**Auth:** Bearer

**Response 200:**
```json
[
  { "id": "combo_abc", "name": "Combo 10", "quantity": 10, "price": 19.90, "tag": "Mais popular" }
]
```

---

### `GET /pricing`

Retorna preço unitário do pão avulso e quantidade de combos ativos.

**Auth:** Bearer

**Response 200:**
```json
{ "breadPrice": 2.50, "comboCount": 3 }
```

---

### `GET /credits/history`

Histórico de transações de crédito do usuário autenticado.

**Auth:** Bearer

**Response 200:**
```json
[
  {
    "id": "tx_abc",
    "type": "PURCHASE",
    "quantity": 10,
    "createdAt": "2026-06-16T10:00:00.000Z"
  }
]
```

---

### `PUT /users/me/auto-recharge`

Configura recarga automática de créditos.

**Auth:** Bearer

**Request Body:**
```json
{
  "mode": "semanal",
  "weekday": "seg",
  "comboId": "combo_abc"
}
```

| Campo | Tipo | Notas |
|-------|------|-------|
| `mode` | `"acabar"` \| `"semanal"` | `acabar` = quando créditos acabarem; `semanal` = dia fixo da semana |
| `weekday` | string | obrigatório se `mode === "semanal"` |
| `comboId` | string | combo a comprar na recarga |

**Response 200:**
```json
{ "ok": true }
```

---

### `PUT /users/me/card-token`

Salva token de cartão para cobranças futuras (recarga automática).

**Auth:** Bearer

**Request Body:**
```json
{ "token": "mp_card_token_abc" }
```

**Response 200:**
```json
{ "ok": true }
```

---

## 5. Configurações (cutoff)

### `GET /settings/cutoff-status`

Verifica se o horário de corte já passou (para bloquear novos pedidos).

**Auth:** Pública

**Response 200:**
```json
{ "isCutoff": false, "cutoffTime": "22:00" }
```

---

## 6. Agenda

### `GET /schedules/me`

Retorna agenda semanal do cliente autenticado.

**Auth:** Bearer (CLIENT)

**Response 200:**
```json
{
  "id": "sched_abc",
  "weeklyQty": { "seg": 2, "ter": 2, "qua": 0, "qui": 2, "sex": 2, "sab": 0, "dom": 0 },
  "deliveryTime": "07:00"
}
```

**Response 404:** nenhuma agenda configurada ainda.

---

### `PUT /schedules/me`

Cria ou atualiza agenda semanal. Reserva créditos automaticamente.

**Auth:** Bearer (CLIENT)

**Request Body:**
```json
{
  "weeklyQty": { "seg": 2, "ter": 2, "qua": 0, "qui": 2, "sex": 2, "sab": 0, "dom": 0 },
  "deliveryTime": "07:00",
  "notifyReconfigure": true
}
```

| Campo | Tipo | Notas |
|-------|------|-------|
| `weeklyQty` | object | cada dia: int 0–12 |
| `deliveryTime` | `"06:30"` \| `"07:00"` \| `"07:30"` \| `"08:00"` | |
| `notifyReconfigure` | boolean | padrão `false`; se `true`, recebe lembrete domingo 20h |

**Response 200:** objeto da agenda atualizada.

---

## 7. Pedidos

### `POST /orders`

Cria pedido único (avulso) para data específica. Reserva créditos imediatamente.

**Auth:** Bearer (CLIENT)

**Request Body:**
```json
{
  "quantity": 3,
  "scheduledDate": "2026-06-17T00:00:00.000Z"
}
```

| Campo | Tipo | Notas |
|-------|------|-------|
| `quantity` | int | 1–20 |
| `scheduledDate` | string (ISO) | data desejada |

**Response 201:**
```json
{ "orderId": "ord_abc", "scheduledDate": "2026-06-17T00:00:00.000Z", "quantity": 3 }
```

---

### `GET /orders/today`

Retorna pedido de hoje do cliente autenticado (usado para rastreamento).

**Auth:** Bearer (CLIENT)

**Response 200:**
```json
{
  "id": "ord_abc",
  "status": "SCHEDULED",
  "quantity": 2,
  "scheduledDate": "2026-06-16T00:00:00.000Z"
}
```

**Response 404:** sem entrega agendada para hoje.

---

### `GET /orders/history`

Histórico de pedidos dos últimos N dias.

**Auth:** Bearer (CLIENT)

**Query Params:** `?days=30` (padrão: 30)

**Response 200:**
```json
[
  {
    "id": "ord_abc",
    "status": "DELIVERED",
    "quantity": 2,
    "scheduledDate": "2026-06-15T00:00:00.000Z"
  }
]
```

---

## 8. Notificações

### `POST /users/push-token`

Registra Player ID do OneSignal para push notifications.

**Auth:** Bearer

**Request Body:**
```json
{ "playerId": "onesignal-player-uuid" }
```

**Response 200:**
```json
{ "ok": true }
```

---

### `GET /notifications/me`

Lista últimas 30 notificações do usuário.

**Auth:** Bearer

**Response 200:**
```json
[
  {
    "id": "notif_abc",
    "type": "DELIVERED",
    "title": "Entrega confirmada",
    "body": "Seus pãezinhos foram entregues!",
    "read": false,
    "createdAt": "2026-06-16T08:30:00.000Z"
  }
]
```

---

### `PATCH /notifications/read-all`

Marca todas as notificações do usuário como lidas.

**Auth:** Bearer

**Response 200:**
```json
{ "ok": true }
```

---

### `GET /notifications/unread-count`

Retorna contagem de notificações não lidas (usado para badge).

**Auth:** Bearer

**Response 200:**
```json
{ "count": 3 }
```

---

## 9. Entregador

### `GET /courier/orders/today`

Lista todos os pedidos do dia agrupados por condomínio, com rota OSRM calculada.

**Auth:** Bearer + COURIER

**Response 200:**
```json
{
  "condos": [
    {
      "condominiumId": "condo_abc",
      "condominiumName": "Residencial Primavera",
      "address": "Rua das Flores, 100",
      "lat": -23.5,
      "lng": -46.6,
      "stops": [
        {
          "orderId": "ord_abc",
          "apartment": "101",
          "block": "A",
          "clientName": "João Silva",
          "quantity": 2,
          "status": "SCHEDULED",
          "sortKey": 1
        }
      ]
    }
  ],
  "totalStops": 15,
  "totalBreads": 28,
  "route": {
    "distanceKm": "12.4",
    "durationMin": 35,
    "geometry": [[-46.6, -23.5], [-46.61, -23.51]]
  }
}
```

---

### `PATCH /courier/orders/:id/confirm`

Confirma entrega de um pedido. Dispara notificação push para o cliente.

**Auth:** Bearer + COURIER

**Response 200:**
```json
{ "ok": true }
```

**Response 422:** transição de status inválida (ex: pedido já entregue).  
**Response 403:** pedido não pertence a este entregador.

---

## 10. Admin — Configurações

### `GET /admin/settings/cutoff`

Retorna horário de corte configurado.

**Auth:** Bearer + ADMIN

**Response 200:**
```json
{ "cutoffTime": "22:00" }
```

---

### `PATCH /admin/settings/cutoff`

Atualiza horário de corte para novos pedidos.

**Auth:** Bearer + ADMIN

**Request Body:**
```json
{ "cutoffTime": "22:00" }
```

**Response 200:**
```json
{ "ok": true, "cutoffTime": "22:00" }
```

---

### `GET /admin/settings/avulso`

Retorna configuração de compra avulsa.

**Auth:** Bearer + ADMIN

**Response 200:**
```json
{ "limit": 5, "unitPrice": 2.50 }
```

---

### `PATCH /admin/settings/avulso`

Atualiza limite e preço unitário da compra avulsa.

**Auth:** Bearer + ADMIN

**Request Body:**
```json
{ "limit": 5, "unitPrice": 2.50 }
```

**Response 200:**
```json
{ "ok": true }
```

---

## 11. Admin — Dashboard e Pedidos

### `GET /admin/dashboard`

KPIs do dia: pães, receita, clientes, condomínios.

**Auth:** Bearer + ADMIN

**Response 200:**
```json
{
  "breadsTodayCount": 142,
  "revenueToday": 284.00,
  "clientsCount": 87,
  "condominiumsCount": 5,
  "cutoffTime": "22:00",
  "revenueByType": { "combo": 250.00, "avulso": 34.00 }
}
```

---

### `GET /admin/orders/delivery-status`

Status de entrega do dia agrupado por condomínio.

**Auth:** Bearer + ADMIN

**Response 200:** array de condomínios com pedidos e seus status.

---

### `GET /admin/orders/division-suggestion`

Sugestão de divisão de pedidos entre entregadores (algoritmo greedy).

**Auth:** Bearer + ADMIN

**Response 200:**
```json
{
  "suggestions": [
    { "courierId": "user_c1", "condominiumIds": ["condo_1", "condo_2"] }
  ]
}
```

---

### `PATCH /admin/orders/assign-courier`

Atribui entregador a pedidos por IDs ou por condomínio + data.

**Auth:** Bearer + ADMIN

**Request Body (por IDs):**
```json
{ "courierId": "user_c1", "orderIds": ["ord_1", "ord_2"] }
```

**Request Body (por condomínio):**
```json
{ "courierId": "user_c1", "condominiumId": "condo_abc", "date": "2026-06-16" }
```

**Response 200:**
```json
{ "ok": true, "count": 12 }
```

---

### `PATCH /admin/orders/:id/status`

Atualiza status de um pedido. Transições válidas: `SCHEDULED → OUT_FOR_DELIVERY → DELIVERED`.

**Auth:** Bearer + ADMIN

**Request Body:**
```json
{ "status": "OUT_FOR_DELIVERY" }
```

**Response 200:** objeto do pedido atualizado.

---

## 12. Admin — Condomínios

### `GET /admin/condominiums`

Lista todos os condomínios com detalhes completos.

**Auth:** Bearer + ADMIN

---

### `POST /admin/condominiums`

Cria condomínio.

**Auth:** Bearer + ADMIN

**Request Body:**
```json
{
  "name": "Residencial Primavera",
  "type": "BLOCKS",
  "address": {
    "street": "Rua das Flores",
    "number": "100",
    "complement": "Portaria principal",
    "city": "São Paulo",
    "state": "SP",
    "zip": "01310-100"
  }
}
```

**Response 201:** objeto do condomínio criado.

---

### `PATCH /admin/condominiums/:id`

Atualiza campos do condomínio (partial).

**Auth:** Bearer + ADMIN

**Response 200:** objeto atualizado.

---

### `DELETE /admin/condominiums/:id`

Remove condomínio.

**Auth:** Bearer + ADMIN

**Response 200:**
```json
{ "ok": true }
```

---

## 13. Admin — Combos

### `GET /admin/combos`

Lista combos com dados de promoção.

**Auth:** Bearer + ADMIN

---

### `POST /admin/combos`

Cria combo.

**Auth:** Bearer + ADMIN

**Request Body:**
```json
{ "name": "Combo 10", "quantity": 10, "price": 19.90, "tag": "Mais popular" }
```

**Response 201:** objeto do combo criado.

---

### `PATCH /admin/combos/:id`

Atualiza combo (partial).

**Auth:** Bearer + ADMIN

---

### `DELETE /admin/combos/:id`

Remove combo.

**Auth:** Bearer + ADMIN

**Response 200:**
```json
{ "ok": true }
```

---

### `PATCH /admin/combos/:id/promotion`

Ativa ou desativa promoção do combo.

**Auth:** Bearer + ADMIN

**Request Body:**
```json
{ "active": true }
```

**Response 200:** objeto do combo com promoção atualizada.

---

## 14. Admin — Fornecedores

### `GET /admin/suppliers`

Lista fornecedores.

**Auth:** Bearer + ADMIN

---

### `POST /admin/suppliers`

Cria fornecedor.

**Auth:** Bearer + ADMIN

**Request Body:**
```json
{
  "name": "Padaria Central",
  "cnpj": "12345678000190",
  "phone": "11999998888",
  "email": "padaria@email.com",
  "pricePerUnit": 1.20,
  "isPrincipal": true,
  "address": {
    "street": "Av. Paulista",
    "number": "1000",
    "city": "São Paulo",
    "state": "SP",
    "zip": "01310-100"
  }
}
```

**Response 201:** objeto do fornecedor criado.

---

### `PATCH /admin/suppliers/:id`

Atualiza fornecedor (partial).

**Auth:** Bearer + ADMIN

---

### `DELETE /admin/suppliers/:id`

Remove fornecedor.

**Auth:** Bearer + ADMIN

**Response 204:** sem corpo.

---

## 15. Admin — Entregadores

### `GET /admin/couriers`

Lista entregadores com status ativo/bloqueado.

**Auth:** Bearer + ADMIN

---

### `POST /admin/couriers`

Cria entregador. Alternativa: `POST /auth/couriers`.

**Auth:** Bearer + ADMIN

**Request Body:**
```json
{ "name": "Carlos Entregador", "cpf": "98765432100", "phone": "11988887777" }
```

**Response 201:** objeto do entregador criado. **Response 409:** CPF já cadastrado.

---

### `PATCH /admin/couriers/:id`

Atualiza dados do entregador (name, phone, email).

**Auth:** Bearer + ADMIN

---

### `PATCH /admin/couriers/:id/toggle`

Ativa ou desativa entregador (toggle `isBlocked`).

**Auth:** Bearer + ADMIN

**Response 200:** objeto do entregador com novo estado.

---

## 16. Admin — Clientes

### `GET /admin/clients`

Lista clientes, com filtro opcional por condomínio.

**Auth:** Bearer + ADMIN

**Query Params:** `?condominiumId=condo_abc` (opcional)

---

### `GET /admin/clients/:id`

Detalhe do cliente: dados, agenda ativa e últimos 30 dias de pedidos.

**Auth:** Bearer + ADMIN

**Response 200:**
```json
{
  "id": "user_abc",
  "name": "João Silva",
  "email": "joao@email.com",
  "phone": "11999998888",
  "schedule": { "weeklyQty": { "seg": 2 }, "deliveryTime": "07:00" },
  "orders": [{ "id": "ord_abc", "status": "DELIVERED", "quantity": 2 }]
}
```

---

### `PATCH /admin/clients/:id/block`

Bloqueia ou desbloqueia cliente (toggle `isBlocked`).

**Auth:** Bearer + ADMIN

**Response 200:** objeto do cliente com novo estado.

---

## 17. Admin — Pedido ao Fornecedor

### `GET /admin/supplier-orders/draft`

Prévia do pedido do dia seguinte: totais por condomínio.

**Auth:** Bearer + ADMIN

---

### `POST /admin/supplier-orders`

Cria pedido ao fornecedor (status `DRAFT`).

**Auth:** Bearer + ADMIN

**Request Body:**
```json
{
  "items": [
    { "supplierId": "sup_abc", "quantity": 120 },
    { "supplierId": "sup_xyz", "quantity": 30 }
  ],
  "cutoffTime": "2026-06-16T22:00:00.000Z"
}
```

**Response 201:** objeto `PurchaseOrder` criado.

---

### `GET /admin/supplier-orders`

Lista pedidos finalizados ao fornecedor.

**Auth:** Bearer + ADMIN

---

### `PATCH /admin/supplier-orders/:id/finalize`

Finaliza pedido (`DRAFT → FINALIZED`).

**Auth:** Bearer + ADMIN

**Response 200:**
```json
{ "ok": true }
```

---

### `GET /admin/supplier-orders/:id/pdf`

Baixa relatório do pedido em PDF.

**Auth:** Bearer + ADMIN

**Response 200:** `Content-Type: application/pdf` com buffer do arquivo.

---

### `GET /admin/supplier-orders/:id/excel`

Baixa relatório do pedido em Excel (.xlsx).

**Auth:** Bearer + ADMIN

**Response 200:** `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

---

## 18. Admin — Financeiro

### `GET /admin/financial`

Receita por período, com breakdown por tipo (combo/avulso) e por condomínio.

**Auth:** Bearer + ADMIN

**Query Params:**

| Param | Tipo | Padrão | Opções |
|-------|------|--------|--------|
| `period` | string | `"day"` | `"day"` \| `"week"` \| `"month"` |
| `condominiumId` | string | — | filtra por condomínio |

**Response 200:**
```json
{
  "revenue": 1420.00,
  "breakdown": {
    "byType": { "combo": 1200.00, "avulso": 220.00 },
    "byCondominium": [
      { "condominiumId": "condo_abc", "name": "Residencial Primavera", "revenue": 800.00 }
    ]
  }
}
```

---

## 19. Admin — Pagamentos

### `GET /admin/payments`

Lista pagamentos com status.

**Auth:** Bearer + ADMIN

---

### `GET /admin/payments/:id`

Detalhe de um pagamento.

**Auth:** Bearer + ADMIN

**Response 200:**
```json
{
  "id": "pay_abc",
  "status": "approved",
  "amount": 49.90,
  "user": { "id": "user_abc", "name": "João Silva" }
}
```

---

### `POST /admin/payments/:id/refund`

Estorna pagamento via Mercado Pago. Idempotente — dupla chamada é bloqueada no frontend via `isRefunding`.

**Auth:** Bearer + ADMIN

**Response 200:**
```json
{ "ok": true }
```

**Response 502:** erro na API do Mercado Pago.

---

## Cron Jobs

Rodando no servidor via `node-cron`:

| Job | Horário | Ação |
|-----|---------|------|
| Criar pedidos diários | `00:00 BRT` | Gera orders para agendas ativas |
| Auto-buy | `00:05 BRT` | Processa recargas automáticas com saldo insuficiente |
| Lembrete reconfigure | `20:00 dom BRT` | Push para clientes com `notifyReconfigure=true` |
| Lembrete véspera | `21:00 BRT` | Push para clientes com entrega agendada para o dia seguinte |
| Bloqueio cutoff | Horário configurado | Push para clientes que não agendaram |

---

## Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret para assinar JWT |
| `OTP_DEV_CODE` | Código OTP fixo em dev (ex: `1234`) |
| `ADMIN_NAME` | Nome do admin seed |
| `ADMIN_EMAIL` | E-mail do admin seed |
| `ADMIN_PHONE` | Telefone do admin seed |
| `ADMIN_CPF` | CPF do admin seed |
| `MP_ACCESS_TOKEN` | Token Mercado Pago (sandbox em dev) |
| `MP_WEBHOOK_SECRET` | Secret para validar webhooks MP (HMAC-SHA256) |
| `MP_PUBLIC_KEY` | Chave pública MP para MP Bricks no frontend |
| `ZENVIA_TOKEN` | Token Zenvia para SMS |
| `RESEND_API_KEY` | API key Resend para e-mail |
| `ONESIGNAL_APP_ID` | App ID OneSignal para push |
| `ONESIGNAL_API_KEY` | API key OneSignal |
| `API_PORT` | Porta do servidor (padrão: `3001`) |
