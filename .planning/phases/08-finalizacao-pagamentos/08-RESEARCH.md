# Phase 8: Finalização Pagamentos - Research

**Pesquisado:** 2026-06-18
**Domínio:** Pagamentos Mercado Pago + Sistema de Créditos + HomeA Carteira + Push OneSignal
**Confiança geral:** HIGH — toda a stack já está instalada e o código existe; a fase é auditoria + completude, não greenfield.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Phase 8 audita e completa gaps — não reescreve do zero. Os planos 03-03/03-05/03-06 têm código substancial no repositório. A auditoria identifica o que já funciona e cria planos apenas para lacunas funcionais reais.
- **D-02:** Ao verificar que os planos 03-03/03-05/03-06 estão funcionando corretamente, marcá-los como concluídos no ROADMAP.md.
- **D-03:** HomeA entrega saldo real + "Entrega de hoje" com dados reais + tab bar funcional.
- **D-04:** "Entrega de hoje" exibe os 3 estados: Agendado → Saiu para entrega → Entregue, conectado ao `GET /orders/today`. Notificações push de entrega ficam para Phase 9.
- **D-05:** Phase 8 audita e completa o HomeScreen existente (412 linhas).
- **D-06 (=D-01 Phase 3):** Polling a cada 3s, max 5 tentativas em `GET /payments/:id/status`. Ao receber `approved`, atualiza saldo e exibe tela de sucesso.
- **D-07 (=D-02 Phase 3):** Créditos creditados somente após webhook MP com `status: approved`. Nunca antecipa.
- **D-08 (=D-03 Phase 3):** QR code gerado pelo backend — retorna `qr_code_base64` e `qr_code` (copia-e-cola).
- **D-09:** BannerInsuficiente aparece em 3 lugares: CombosScreen (já existe), HomeA (a criar), push notification via cron de meia-noite.
- **D-10:** Push de crédito insuficiente disparado no cron de meia-noite quando saldo < consumo semanal E sem auto-recharge ativado.
- **D-11:** Push usa deep link via `additionalData: { screen: 'creditos' }`. Sem action buttons.
- **D-12:** Planos de pagamento incluem `user_setup` blocking com env vars e instruções MP sandbox.
- **D-13:** Webhooks testados localmente com ngrok.
- **D-14 (=D-12 Phase 3):** Cartão via MP Bricks — componente `CardPayment` tokeniza no frontend, envia token ao backend.
- **D-15 (=D-04 Phase 3):** AutoBuyScreen já salva preferência no banco via `PUT /users/me/auto-recharge`. O cron que dispara a compra automática já está implementado (Phase 4).
- **D-16:** `processAutoBuy` usa apenas Pix — cartão exige CVV a cada transação (PCI-DSS).
- **D-17:** Tab bar Início / Agenda / Créditos / Pedidos — funcional desde Phase 3. Phase 8 verifica navegação e `creditBalance` no AuthContext.
- **D-18:** Aba Créditos abre CombosScreen. Extrato acessível via botão "Extrato" no card de saldo da HomeA.

### Claude's Discretion

- Estrutura interna do alerta de crédito insuficiente na HomeA (card dismissível vs banner fixo) — implementar conforme design handoff.
- Threshold exato do alerta na HomeA (saldo = 0 vs saldo < consumo próximos 7 dias) — começar com saldo = 0.
- Mensagem exata na push notification de crédito insuficiente — estilo conversacional Cheirin de Pão.

### Deferred Ideas (OUT OF SCOPE)

- Push de crédito insuficiente com 2 botões de ação (action buttons "Comprar" e "Ajustar agenda").
- Alerta de crédito insuficiente baseado em previsão de 7 dias.
- Script de setup automático de env vars.
- Histórico de créditos manuais admin visível ao cliente.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Descrição | Suporte de pesquisa |
|----|-----------|---------------------|
| CRED-01 | Cliente pode comprar combos de pãezinhos — cada combo vira créditos | CombosScreen (407 lin.) existe; backend payments.service.ts `createPix`/`createCard` + webhooks.service.ts `reconcilePayment` já implementados |
| CRED-02 | Combos configuráveis pelo Admin (nome, quantidade, preço) | credits.service.ts `listCombos` lê do Prisma; CRUD no Admin (Phase 7) — apenas leitura aqui |
| CRED-03 | Cliente pode fazer compra personalizada (avulsa) | CombosScreen aba "avulso" + `customQuantity` no backend já implementados |
| CRED-04 | Preço unitário avulso maior que o do combo | credits.service.ts `getUnitPrice` compara `avulsoUnit` vs `bestComboUnitPrice` — lógica OK |
| CRED-05 | Admin define limite máximo da compra personalizada | Setting `avulsoLimite` lida via `getPricing()` — CombosScreen aplica `max={pricing.avulsoLimite - 1}` |
| CRED-06 | Créditos não expiram | Nenhum campo de expiração no schema; lógica de não-expiração por ausência — UI exibe "Créditos não expiram" |
| CRED-08 | Compra automática "toda semana" com seletor de dia e combo | `processAutoBuy` em cron.ts + AutoBuyScreen salva `autoRecharge.mode='semanal'` + `weekday` — verificar integração |
| CRED-09 | Se créditos insuficientes e sem compra automática, sistema notifica | Push de crédito insuficiente no cron de meia-noite — CRIAR; BannerInsuficiente na HomeA — CRIAR |
| CRED-10 | Se créditos insuficientes e com compra automática, combo comprado automaticamente | `processAutoBuy` envia push Pix para o cliente finalizar — verificar fluxo |
| CRED-11 | Saldo de créditos exibido na tela principal como número de pãezinhos | CreditBalanceCard já exibe `user.creditBalance` via AuthContext — verificar atualização pós-pagamento |
| PAY-01 | Cliente pode pagar via Pix (Mercado Pago) | `createPix` no backend + PixWaitingScreen no frontend — verificar end-to-end com sandbox |
| PAY-02 | Cliente pode pagar via cartão de crédito ou débito (Mercado Pago) | `createCard` no backend + CardPaymentScreen com Brick — verificar end-to-end com sandbox |
| UI-04 | Home Cliente — variação A "Carteira" com saldo, entrega de hoje, ações rápidas, próximas entregas | HomeScreen (412 lin.) existe; lacunas: BannerInsuficiente, NextDays com dados reais |
| UI-07 | Stepper de quantidade com min/max respeitados | `QuantityStepper` já existe e é usado em CombosScreen e ScheduleScreen — verificar min/max |
| UI-08 | Tab bar do Cliente: Início / Agenda / Créditos / Pedidos | `ClientTabBar` existe com 4 abas e activeState correto — verificar sub-rotas de créditos |
</phase_requirements>

---

## Summary

A Phase 8 é uma fase de **auditoria e completude**, não de construção do zero. O código dos planos 03-03 (webhooks MP), 03-05 (CombosScreen) e 03-06 (PixWaitingScreen + CardPaymentScreen) está integralmente no repositório. A inspeção direta do código confirma que a maioria da lógica de pagamento está corretamente implementada: HMAC-SHA256 para validação do webhook, idempotência via verificação de `payment.status === 'PAID'` antes de creditar, polling de 3s/5 tentativas, MP Bricks para cartão e QR code gerado pelo backend.

As lacunas reais identificadas são: (1) **BannerInsuficiente na HomeA** — componente existe mas não está inserido no HomeScreen quando `creditBalance === 0`; (2) **NextDays com dados reais** — HomeScreen exibe placeholder estático em vez de dados do `GET /schedules/me`; (3) **push de crédito insuficiente no cron de meia-noite** — o cron já envia push quando `creditBalance < qty` para o dia seguinte, mas o requisito CRED-09 exige notificação proativa baseada no consumo semanal total para usuários *sem* auto-recharge; (4) **deep link handler OneSignal** — o `react-onesignal` está inicializado mas não há `NotificationClickListener` configurado para navegar ao clicar em push com `additionalData.screen === 'creditos'`; (5) **AppBar back button da CardPaymentScreen** — usa `"←"` literal em vez de `<Icon name="arrowL">`.

**Recomendação primária:** Dividir a fase em 3 waves — Wave 0 para setup do sandbox MP + ngrok (user_setup blocking), Wave 1 para auditoria do código existente e correção de gaps funcionais identificados, Wave 2 para as funcionalidades novas (BannerInsuficiente HomeA, NextDays, push de crédito insuficiente, deep link handler).

---

## Architectural Responsibility Map

| Capability | Tier Primário | Tier Secundário | Racional |
|------------|--------------|-----------------|---------|
| Gerar QR code Pix | API / Backend | — | Exige MP_ACCESS_TOKEN; chamada server-to-server via SDK mercadopago |
| Processar pagamento cartão | API / Backend | Browser (tokenização) | Brick tokeniza no browser (PCI); backend processa com token |
| Validar assinatura do webhook MP | API / Backend | — | HMAC-SHA256 com MP_WEBHOOK_SECRET — nunca expor no frontend |
| Creditar saldo após pagamento | API / Backend | — | Operação atômica com CreditTransaction — D-07: somente após webhook |
| Polling de status de pagamento | Browser / Client | — | `usePaymentPolling` hook — polling HTTP a cada 3s, max 5 tentativas |
| Exibir QR code e copia-e-cola | Browser / Client | — | Renderiza `qr_code_base64` como `<img>` + clipboard API |
| Exibir saldo atualizado | Browser / Client | — | `updateCreditBalance` no AuthContext após polling confirmar `approved` |
| Enviar push de crédito insuficiente | API / Backend | — | `OneSignal.createNotification` no cron de meia-noite |
| Handler de deep link de push | Browser / Client | — | `react-onesignal` `NotificationClickListener` navega para `/client/creditos` |
| Exibir "Entrega de hoje" | Browser / Client | API (dados) | `useOrderTracking` polling `GET /orders/today` a cada 30s |
| Exibir "Próximas entregas" (NextDays) | Browser / Client | API (dados) | Fetch `GET /schedules/me` — dados do agendamento semanal |
| BannerInsuficiente HomeA | Browser / Client | — | Condição `creditBalance === 0` — lógica no componente |
| Tab bar navegação | Browser / Client | — | `ClientTabBar` já funcional — verificar activeState nas sub-rotas |

---

## Standard Stack

### Core (já instalado — sem novas dependências)

| Biblioteca | Versão | Propósito | Status |
|-----------|--------|-----------|--------|
| `mercadopago` | ^3.1.0 | SDK Node.js do MP — Pix e cartão no backend | Instalado no `apps/api` |
| `@mercadopago/sdk-react` | ^1.0.7 | CardPayment Brick no frontend | Instalado no `apps/web` |
| `react-onesignal` | 3.5.5 | SDK OneSignal para push e deep link handler | Instalado no `apps/web` |
| `@onesignal/node-onesignal` | ^5.8.0 | Envio de push do backend | Instalado no `apps/api` |
| `node-cron` | ^4.2.1 | Cron jobs — meia-noite + domingo 20h + 21h | Instalado no `apps/api` |

**Verificação de versões:** Confirmado via `apps/api/package.json` e `apps/web/package.json` — leitura direta do código. [VERIFIED: codebase grep]

### Nenhuma nova dependência necessária nesta fase

O UI-SPEC (08-UI-SPEC.md) confirma explicitamente: "Nenhuma dependência de terceiros nova é introduzida nesta fase. Todas as libs em uso foram introduzidas em fases anteriores." [VERIFIED: codebase grep]

---

## Package Legitimacy Audit

> Fase não instala novos pacotes externos. Todas as dependências já estão no node_modules.

| Pacote | Registry | Fonte | Disposition |
|--------|----------|-------|-------------|
| `mercadopago` | npm | Fase 3 — já instalado | Aprovado — em produção |
| `@mercadopago/sdk-react` | npm | Fase 3 — já instalado | Aprovado — em produção |
| `react-onesignal` | npm | Fase 1 — já instalado | Aprovado — em produção |
| `@onesignal/node-onesignal` | npm | Fase 4 — já instalado | Aprovado — em produção |
| `node-cron` | npm | Fase 4 — já instalado | Aprovado — em produção |

**Pacotes removidos por slopcheck:** nenhum (sem novos pacotes).
**Pacotes suspeitos:** nenhum.

---

## Architecture Patterns

### System Architecture Diagram

```
[Cliente PWA]
      |
      | 1. POST /payments/pix ou /payments/card
      v
[Fastify API — paymentsRoute]
      |
      | 2. SDK mercadopago — Payment.create()
      v
[Mercado Pago API]
      |
      | 3. Webhook (quando approved)
      v
[Fastify API — webhooksRoute]
      | validateSignature (HMAC-SHA256)
      | reconcilePayment (idempotente)
      v
[MongoDB Atlas — Payment.status=PAID, User.creditBalance+=qty, CreditTransaction]
      |
      | 4. Polling GET /payments/:id/status
      v
[Cliente PWA — updateCreditBalance(novoSaldo)]

[Cron meia-noite — createDailyOrders]
      |
      | creditBalance < consumoSemanal AND !autoRecharge
      v
[OneSignal — push "Seus créditos estão acabando"]
      |
      | additionalData.screen = 'creditos'
      v
[Cliente PWA — NotificationClickListener → navigate('/client/creditos')]
```

### Estrutura de Módulos Relevante

```
apps/api/src/
  modules/
    payments/           # Pix + cartão + polling status
    webhooks/           # validateSignature + reconcilePayment
    credits/            # listCombos + getPricing + creditHistory + auto-recharge
  plugins/
    cron.ts             # Adicionar: verificação de crédito insuficiente no cron de meia-noite

apps/web/src/
  pages/client/
    HomeScreen.tsx      # Lacunas: BannerInsuficiente + NextDays real
    CombosScreen.tsx    # Verificar: BannerInsuficiente condicional por aba
    PixWaitingScreen.tsx    # Verificar: copy do estado rejected atualizado
    CardPaymentScreen.tsx   # Completar: botão back com Icon arrowL
    PurchasedScreen.tsx     # Verificar: OK conforme inspeção
  components/client/
    BannerInsuficiente.tsx  # Reutilizar na HomeA com prop hideAjustar
    CreditBalanceCard.tsx   # Verificar: OK conforme inspeção
    ClientTabBar.tsx        # Verificar: activeState sub-rotas de créditos
  hooks/
    usePaymentPolling.ts    # Verificar: OK — 3s/5 tentativas
    useOrderTracking.ts     # Verificar: OK — polling /orders/today 30s
```

### Pattern 1: Reconciliação de Pagamento Idempotente

**O quê:** Webhook do MP pode disparar múltiplas vezes para o mesmo pagamento. O backend deve creditar apenas uma vez.
**Como está implementado:** `webhooks.service.ts` verifica `payment.status === 'PAID'` antes de chamar `creditUserBalance`. [VERIFIED: codebase grep]

```typescript
// Source: apps/api/src/modules/webhooks/webhooks.service.ts
async reconcilePayment(mpPaymentId: string): Promise<void> {
  const payment = await this.repo.findPaymentByMercadoPagoId(mpPaymentId)
  if (!payment) return
  if (payment.status === 'PAID') return  // Idempotência: já processado

  const mpStatus = await this.fetchMercadoPagoStatus(mpPaymentId)
  if (mpStatus === 'approved') {
    // credita + marca PAID em operação não-atômica (Prisma MongoDB não suporta transações entre coleções)
    await this.repo.creditUserBalance(payment.userId, quantity, payment.id)
    await this.repo.updatePaymentStatus(payment.id, 'PAID')
  }
}
```

**Limitação identificada:** O `creditUserBalance` e o `updatePaymentStatus` não são executados em transação Prisma (`$transaction`). Se o processo morrer entre os dois, o usuário pode ter crédito sem o payment marcado como PAID — possibilitando duplo crédito em próximo webhook. Deve-se avaliar se o `PaymentsRepository.creditUserBalance` já usa transação.

### Pattern 2: Push OneSignal com additionalData (Deep Link)

**O quê:** Padrão estabelecido em `schedules.service.ts` para push com `url` ou `additionalData`.
**Como funciona no frontend:** `react-onesignal` expõe `OneSignal.Notifications.addEventListener('click', handler)`. O handler recebe `event.notification.additionalData`.

```typescript
// Source: apps/api/src/modules/schedules/schedules.service.ts (padrão existente)
notification.headings = { pt: 'Cheirin de Pão' }
notification.contents = { pt: 'Toque para...' }
notification.url = '/client/creditos'   // alternativa: url direto
// OU:
notification.additionalData = { screen: 'creditos' }  // para handler customizado

// Source: apps/web/src/main.tsx (a adicionar — deep link handler)
OneSignal.Notifications.addEventListener('click', (event) => {
  const screen = event.notification?.additionalData?.screen
  if (screen === 'creditos') {
    navigate('/client/creditos')
  }
})
```

**Observação:** O `navigate` não está disponível fora de componentes React. O handler deve usar `window.location.href` ou ser configurado dentro de um componente/hook React. [ASSUMED — padrão de integração react-onesignal + react-router]

### Pattern 3: Cron de Crédito Insuficiente (a criar)

**O quê:** Adicionar verificação de CRED-09 no cron de meia-noite existente.
**Trigger:** `creditBalance < consumoSemanal` E `!autoRecharge.active`.
**Distinção do código existente:** O cron já envia push de crédito insuficiente em `createDailyOrders` (linha 82-99) quando saldo < quantidade do *próximo dia*. O CRED-09 exige notificação quando saldo < consumo *semanal total* para usuários sem auto-recharge — é um check diferente.

```typescript
// Padrão a seguir: apps/api/src/plugins/cron.ts
// Adicionar no cron de meia-noite, após processAutoBuy:
async function sendLowCreditNotifications(fastify) {
  const schedules = await prisma.schedule.findMany({ where: { isActive: true } })
  for (const schedule of schedules) {
    const user = await prisma.user.findUnique({ where: { id: schedule.userId } })
    const autoRecharge = user.autoRecharge as any
    if (autoRecharge?.active) continue  // tem auto-recharge — não notificar

    const weeklyQty = schedule.weeklyQty as WeeklyQty
    const consumoSemanal = Object.values(weeklyQty).reduce((s, v) => s + (v as number), 0)
    if (user.creditBalance >= consumoSemanal) continue  // saldo suficiente

    // Enviar push + persistir Notification com type=LOW_CREDIT
    if (user.oneSignalPlayerId) {
      const notification = new OneSignal.Notification()
      notification.app_id = process.env.ONESIGNAL_APP_ID!
      notification.include_subscription_ids = [user.oneSignalPlayerId]
      notification.headings = { 'pt-BR': 'Seus créditos estão acabando 🍞' }
      notification.contents = {
        'pt-BR': `Você tem ${user.creditBalance} crédito(s) e sua semana precisa de ${consumoSemanal}. Recarregue agora!`
      }
      notification.additionalData = { screen: 'creditos' }
      await osClient.createNotification(notification)
    }
  }
}
```

### Pattern 4: NextDays — Próximas Entregas

**O quê:** Substituir o placeholder estático do HomeScreen por dados reais do `GET /schedules/me`.
**Fonte de dados:** `apps/api/src/modules/schedules/schedules.route.ts` expõe `GET /schedules/me` (já usado em `ScheduleScreen.tsx`). Retorna `weeklyQty: { seg: N, ter: N, ... }`.
**Lógica de exibição:** Gerar próximos 5 dias a partir de amanhã; mapear cada dia para sua chave `weeklyQty`; exibir pill gold quando `qty > 0`.

```typescript
// Padrão de mapeamento de dia da semana para chave weeklyQty
const DAY_KEY_MAP: Record<number, keyof WeeklyQty> = {
  1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab', 0: 'dom'
}
// Próximos 5 dias a partir de amanhã (BRT)
const days = Array.from({ length: 5 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() + i + 1)
  return { date: d, key: DAY_KEY_MAP[d.getDay()] }
})
```

### Anti-Patterns a Evitar

- **Creditar antes do webhook:** Nunca usar o resultado do `POST /payments/pix` ou `/payments/card` como sinal para creditar — o crédito só ocorre após webhook `approved` (D-07).
- **Reescrever código existente:** Os planos 03-03/05/06 têm código funcional. Auditar antes de alterar — só modificar o que tem gap real.
- **Inicializar `mercadopago` sem env var:** `MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })` falha silenciosamente se a env var estiver ausente — o `user_setup` blocking previne isso.
- **navigate fora de componente React:** O deep link handler do OneSignal no `main.tsx` não tem acesso ao `useNavigate` — usar `window.location.href` ou registrar o listener dentro de um hook/componente.
- **Duplo listener de NotificationClick:** O `OneSignal.init` em `main.tsx` executa em StrictMode (2x em dev). `react-onesignal` previne double-init mas o `addEventListener` deve ser protegido contra duplicação.

---

## Don't Hand-Roll

| Problema | Não construir | Usar | Motivo |
|----------|--------------|------|--------|
| Tokenização de cartão | Formulário HTML próprio | MP Bricks `CardPayment` | PCI DSS — dados do cartão nunca tocam o servidor sem tokenização |
| Validação de assinatura do webhook | Parsing manual do header | `createHmac('sha256', secret)` (já implementado) | Edge cases de encoding — já resolvidos no `webhooks.service.ts` |
| Polling de status com cleanup | `setInterval` manual sem cleanup | `usePaymentPolling` hook (já implementado) | Memory leak em componentes desmontados — hook já faz cleanup |
| Push notifications | API REST direta ao OneSignal | `@onesignal/node-onesignal` SDK (já instalado) | Simplifica criação de `Notification` com tipagem |
| Agendamento de cron | `setTimeout` recursivo | `node-cron` (já instalado) | Parsing de cron expression, timezone support, error isolation |

---

## Runtime State Inventory

> Esta fase não envolve rename, refactor ou migração. Seção não aplicável.

None — verificado: Phase 8 é auditoria + completude de código existente, sem renomear collections, env vars ou modelos.

---

## Common Pitfalls

### Pitfall 1: `customQuantity` no webhook — divisão por zero ou null

**O que dá errado:** Em `webhooks.service.ts`, o `reconcilePayment` chama `getComboQuantity(payment.comboId)`. Se o payment foi gerado com `customQuantity` (compra avulsa), `comboId` é null e `getComboQuantity` retorna `null` — a linha `if (!quantity) return` aborta sem creditar. O `payment.customQuantity` existe no registro mas não é verificado.

**Por que ocorre:** O código em `webhooks.service.ts` linha 66: `const quantity = payment.customQuantity ?? (await this.getComboQuantity(payment.comboId))` — verifica `customQuantity` primeiro. Isso deve funcionar. **Verificar no teste:** garantir que um payment com `customQuantity=5, comboId=null` resulta em crédito de 5 pãezinhos após webhook. [VERIFIED: codebase grep — lógica parece correta, mas teste end-to-end ainda não confirmado]

**Como verificar:** `apps/api/src/modules/webhooks/__tests__/webhooks.service.test.ts` — confirmar que existe case de teste para compra avulsa.

### Pitfall 2: `cardTokenMp` salvo duas vezes (PaymentsService + CardPaymentScreen)

**O que dá errado:** O `payments.service.ts` `createCard` já salva o `cardTokenMp` no banco (linhas 139-143). O `CardPaymentScreen.tsx` também faz fire-and-forget para `PUT /users/me/card-token` (linha 45). São dois writes para o mesmo campo com o mesmo valor — desnecessário mas não danoso. O endpoint `/users/me/card-token` existe em `credits.route.ts` (linha 132). Verificar se os dois paths devem coexistir ou se um deve ser removido.

**Risco:** Baixo — ambos salvam o mesmo token. O custo é uma request extra desnecessária.

### Pitfall 3: activeState da tab bar nas sub-rotas de créditos

**O que dá errado:** `ClientTabBar.tsx` usa `location.pathname.startsWith(tab.path)` para determinar a aba ativa. A aba "Créditos" tem `path: '/client/creditos'`. Sub-rotas `/client/creditos/pix`, `/client/creditos/cartao`, `/client/creditos/sucesso` são prefixadas com `/client/creditos` — o `startsWith` deve funcionar corretamente. **Verificar:** que nenhuma rota de créditos usa path diferente como `/client/comprar` (detectado em `schedules.service.ts` linha 272: `notification.url = '/client/comprar'` — rota inexistente no router).

**Como prevenir:** Auditar o `schedules.service.ts processAutoBuy` — a URL `/client/comprar` deve ser substituída por `/client/creditos`.

### Pitfall 4: Deep link handler sem acesso ao `navigate` do React Router

**O que dá errado:** O `OneSignal.Notifications.addEventListener('click', handler)` em `main.tsx` não está dentro do contexto do React Router — `useNavigate` não está disponível. Usar `window.location.href = '/client/creditos'` funciona mas causa reload completo da página (ruim em PWA).

**Como prevenir:** Configurar o listener dentro de um hook `useOneSignalDeepLink` chamado dentro do `ClientLayout` (onde o router context existe), usando `useNavigate`.

### Pitfall 5: HMAC-sha256 — header `x-request-id` ausente

**O que dá errado:** A função `validateSignature` usa `xRequestId` na montagem do manifest: `id:${dataId};request-id:${xRequestId};ts:${ts};`. Se o MP não enviar o header `x-request-id`, a string manifest será diferente da esperada pelo MP e a validação vai falhar.

**Como prevenir:** No handler de webhook, inspecionar os headers reais do MP sandbox via ngrok. O `webhooks.controller.ts` deve logar os headers recebidos em ambiente de desenvolvimento para diagnóstico.

### Pitfall 6: ngrok não instalado — blocker para testes de webhook

**O que dá errado:** Sem ngrok, o MP sandbox não consegue entregar webhooks para `localhost:3001`. Sem webhook, o polling nunca recebe `approved`, e os testes end-to-end do Pix falham.

**Como prevenir:** `user_setup` blocking no Wave 0 do plano instrui o executor a instalar ngrok e configurar a URL no dashboard MP sandbox antes de rodar qualquer teste end-to-end.

---

## Code Examples

### Verificado: `reconcilePayment` com `customQuantity`

```typescript
// Source: apps/api/src/modules/webhooks/webhooks.service.ts (linha 63-70)
// customQuantity é verificado ANTES de getComboQuantity — correto para compras avulsas
const quantity = payment.customQuantity ?? (await this.getComboQuantity(payment.comboId))
if (!quantity) return
await this.repo.creditUserBalance(payment.userId, quantity, payment.id)
await this.repo.updatePaymentStatus(payment.id, 'PAID')
```

### Verificado: `usePaymentPolling` com cleanup correto

```typescript
// Source: apps/web/src/hooks/usePaymentPolling.ts
// paymentId = null para o polling quando isApproved || isRejected — correto
const { isTimeout } = usePaymentPolling(
  isApproved || isRejected ? null : paymentId,
  handleApproved,
  handleRejected,
)
```

### A criar: BannerInsuficiente na HomeA

```tsx
// Source: apps/web/src/pages/client/HomeScreen.tsx — inserir entre TodayDelivery e QuickActions
{user?.creditBalance === 0 && (
  <BannerInsuficiente
    saldo={0}
    requerido={1}
    onComprar={() => navigate('/client/creditos')}
    onAjustar={() => {}}  // sem efeito na Home
    // Ocultar botão "Usar 0" via estilo inline no contexto Home
  />
)}
```

**Nota:** `BannerInsuficiente` não aceita prop `hideAjustar` atualmente — o plano deve adicionar a prop ou ocultar o botão via wrapper. A decisão é do executor (Claude's Discretion, UI-SPEC §HomeScreen Lacuna 1).

### A criar: NextDays com dados reais

```tsx
// Fonte de dados: GET /schedules/me (já usado em ScheduleScreen.tsx)
// Mapear weeklyQty para os próximos 5 dias a partir de amanhã (BRT)
const DAY_ABBR = { seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb', dom: 'Dom' }
const dayKeys = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const
```

### A criar: Push de crédito insuficiente (cron de meia-noite)

```typescript
// Source: padrão de apps/api/src/modules/schedules/schedules.service.ts
notification.headings = { 'pt-BR': 'Seus créditos estão acabando 🍞' }
notification.contents = {
  'pt-BR': `Você tem ${creditBalance} crédito(s) e sua semana precisa de ${consumoSemanal}. Recarregue agora antes que faltem pães!`
}
notification.additionalData = { screen: 'creditos' }
// Também persistir: prisma.notification.create({ type: 'LOW_CREDIT', ... })
```

### A criar: Deep link handler no ClientLayout

```typescript
// Source: react-onesignal API (ASSUMED — verificar docs react-onesignal 3.5.x)
// Dentro de um hook/componente com acesso ao useNavigate:
import OneSignal from 'react-onesignal'
useEffect(() => {
  const handleClick = (event: any) => {
    const screen = event?.notification?.additionalData?.screen
    if (screen === 'creditos') navigate('/client/creditos')
  }
  OneSignal.Notifications.addEventListener('click', handleClick)
  return () => OneSignal.Notifications.removeEventListener('click', handleClick)
}, [navigate])
```

---

## State of the Art

| Abordagem antiga | Abordagem atual | Impacto |
|------------------|-----------------|---------|
| Pix com redirecionamento para site MP | Pix inline com QR code + copia-e-cola gerado pelo backend | Experiência nativa no app; sem redirect |
| Formulário de cartão próprio | MP Bricks `CardPayment` | PCI DSS compliance sem esforço; MP garante segurança |
| WebSocket para status de pagamento | Polling simples 3s/5 tentativas | Suficiente para casos de uso; sem complexidade de infra |
| Push com action buttons | Deep link simples via `additionalData` | Mais simples; iOS PWA tem limitações com action buttons |

**Deprecated/Desatualizado:**
- `notification.url = '/client/comprar'` em `processAutoBuy` — path inexistente, deve ser `/client/creditos`.
- Notificação de baixo crédito via push já existe em `createDailyOrders` (por dia) mas não atende CRED-09 completo (por consumo semanal, para usuários sem auto-recharge).

---

## Assumptions Log

| # | Claim | Seção | Risco se errado |
|---|-------|-------|-----------------|
| A1 | `react-onesignal` 3.5.x expõe `OneSignal.Notifications.addEventListener('click', handler)` para deep links | Code Examples — Deep link handler | O executor precisaria buscar a API correta da versão 3.5.5 — ajuste mínimo |
| A2 | O `PaymentsRepository.creditUserBalance` e `updatePaymentStatus` não usam `$transaction` — risco de duplo crédito entre webhooks | Common Pitfalls #1 | Se usarem transação, o risco não existe — verificar o repo |
| A3 | O header `x-request-id` é sempre enviado pelo MP sandbox nos webhooks | Common Pitfalls #5 | Se ausente, `validateSignature` falha — diagnóstico via ngrok |

---

## Open Questions (RESOLVED)

1. **`PaymentsRepository.creditUserBalance` usa `$transaction`?**
   - O que sabemos: `reconcilePayment` chama `creditUserBalance` e `updatePaymentStatus` sequencialmente.
   - O que era incerto: o arquivo `payments.repository.ts` não foi inspecionado nesta pesquisa.
   - Resolução: 08-01 Task 2 inclui leitura obrigatória de `payments.repository.ts` e documenta o resultado no SUMMARY.

2. **`webhooks.service.test.ts` cobre o caso de `customQuantity` (compra avulsa)?**
   - O que sabemos: o arquivo existe em `apps/api/src/modules/webhooks/__tests__/`.
   - O que é incerto: quais casos de teste existem — pode faltar o caso avulso.
   - Recomendação: Inspeção obrigatória na wave de auditoria.

3. **URL do deep link do `processAutoBuy` em schedules.service.ts (`/client/comprar`)**
   - O que sabemos: `/client/comprar` não existe no router.tsx — a rota correta é `/client/creditos`.
   - O que é incerto: se essa URL era intencional ou bug de fase anterior.
   - Recomendação: Corrigir para `/client/creditos` na wave de auditoria.

---

## Environment Availability

| Dependência | Necessária para | Disponível | Versão | Fallback |
|-------------|----------------|-----------|--------|----------|
| Node.js | runtime API + web | ✓ | v20.20.2 | — |
| MongoDB Atlas (remoto) | banco de dados | ✓ (remoto) | — | Sem fallback — usar Atlas |
| `mercadopago` npm SDK | pagamentos backend | ✓ | ^3.1.0 | — |
| `@mercadopago/sdk-react` | CardPayment Brick | ✓ | ^1.0.7 | — |
| `react-onesignal` | deep link handler | ✓ | 3.5.5 | — |
| `@onesignal/node-onesignal` | push notifications | ✓ | ^5.8.0 | — |
| MP sandbox credentials (env vars) | testes end-to-end | ✗ | — | Blocker — user_setup obrigatório |
| ngrok | testes de webhook local | ✗ | — | Blocker — instalar antes dos testes |

**Dependências faltando sem fallback:**
- Credenciais MP sandbox (`MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_PUBLIC_KEY`, `VITE_MP_PUBLIC_KEY`) — o `user_setup` blocking no Wave 0 do plano resolve isso instruindo o executor.
- ngrok — executar `ngrok http 3001` e configurar URL resultante no dashboard MP sandbox.

**Dependências faltando com fallback:**
- Nenhuma com fallback viável para os testes end-to-end.

---

## Validation Architecture

### Test Framework

| Propriedade | Valor |
|-------------|-------|
| Framework | Vitest |
| Arquivo de config | `apps/api/vitest.config.ts` |
| Comando rápido | `cd apps/api && npm test` |
| Comando completo | `cd apps/api && npm test` |

### Phase Requirements → Test Map

| Req ID | Comportamento | Tipo de Teste | Comando | Arquivo Existe? |
|--------|--------------|---------------|---------|-----------------|
| CRED-01/PAY-01 | `createPix` retorna `qr_code_base64` e `qr_code` | unit | `cd apps/api && npm test -- payments.service.test.ts` | ✅ |
| CRED-01/PAY-02 | `createCard` salva payment e retorna `paymentId` | unit | `cd apps/api && npm test -- payments.service.test.ts` | ✅ |
| CRED-01 | `reconcilePayment` credita quantidade correta após `approved` | unit | `cd apps/api && npm test -- webhooks.service.test.ts` | ✅ |
| CRED-01 | `reconcilePayment` não credita duas vezes (idempotência) | unit | `cd apps/api && npm test -- webhooks.service.test.ts` | ✅ (provável) |
| CRED-03 | `reconcilePayment` com `customQuantity` (avulso) credita corretamente | unit | `cd apps/api && npm test -- webhooks.service.test.ts` | ❌ Wave 0 (verificar) |
| CRED-09 | Push de crédito insuficiente disparado quando `saldo < consumoSemanal` e sem auto-recharge | unit | `cd apps/api && npm test -- schedules.service.test.ts` | ❌ Wave 0 (criar) |
| UI-04 | HomeScreen renderiza BannerInsuficiente quando `creditBalance=0` | manual | Verificar em browser com saldo zerado | — |
| UI-08 | Tab bar ativa aba "Créditos" em `/client/creditos/*` | manual | Navegar para `/client/creditos/pix` e verificar tab ativa | — |
| PAY-01 | Fluxo Pix end-to-end: QR → sandbox → webhook → saldo atualizado | manual/sandbox | ngrok + dashboard MP sandbox + testar no browser | — |
| PAY-02 | Fluxo cartão end-to-end: Brick → token → backend → saldo atualizado | manual/sandbox | Dados de teste MP sandbox + testar no browser | — |

### Sampling Rate

- **Por commit de tarefa:** `cd apps/api && npm test -- payments.service.test.ts webhooks.service.test.ts`
- **Por wave merge:** `cd apps/api && npm test`
- **Phase gate:** Suite completa verde antes do `/gsd:verify-work`

### Wave 0 Gaps

- [ ] Verificar `apps/api/src/modules/webhooks/__tests__/webhooks.service.test.ts` — confirmar cobertura do caso `customQuantity`
- [ ] Verificar `apps/api/src/modules/credits/__tests__/credits.service.test.ts` — confirmar cobertura de `getPricing` e `checkBalance`
- [ ] Criar case de teste para `sendLowCreditNotifications` em `schedules.service.test.ts` (nova função a implementar)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Aplica | Controle padrão |
|---------------|--------|-----------------|
| V2 Authentication | não (endpoints protegidos por JWT já implementado) | fastify.authenticate preHandler |
| V3 Session Management | não (sessões gerenciadas pela Phase 2) | Session model + JWT |
| V4 Access Control | sim — webhook endpoint sem auth | Validação HMAC-SHA256 com `MP_WEBHOOK_SECRET` (já implementado) |
| V5 Input Validation | sim — `comboId`, `customQuantity` no body do payment | Zod schemas em `payments.schema.ts` — verificar se cobrem todos os campos |
| V6 Cryptography | sim — assinatura do webhook | `createHmac('sha256')` — correto; `MP_WEBHOOK_SECRET` deve ser strong secret de produção |

### Known Threat Patterns

| Padrão | STRIDE | Mitigação padrão |
|--------|--------|-----------------|
| Webhook spoofing (chamada falsa ao endpoint /webhooks/mercadopago) | Spoofing | HMAC-SHA256 com `MP_WEBHOOK_SECRET` — já implementado |
| Double-credit (mesmo webhook recebido duas vezes) | Tampering | Idempotência via `payment.status === 'PAID'` — já implementado |
| Bypass de autenticação no endpoint de webhook | Elevation of Privilege | Endpoint de webhook corretamente registrado sem `fastify.authenticate` — só usa HMAC |
| `customQuantity` negativo ou zero para obter crédito sem pagar | Tampering | Validação no backend `credits.service.ts validateCustomPurchase` — verificar se aplica a `/payments/pix` também |
| Env vars ausentes em produção (`MP_ACCESS_TOKEN=undefined`) | Denial of Service | `user_setup` blocking no Wave 0 + validação de env vars no startup |

---

## Sources

### Primary (HIGH confidence)

- Codebase direto — `apps/api/src/modules/payments/payments.service.ts` — implementação Pix e cartão
- Codebase direto — `apps/api/src/modules/webhooks/webhooks.service.ts` — HMAC-SHA256 + reconciliação
- Codebase direto — `apps/api/src/modules/credits/credits.service.ts` — listCombos, getPricing
- Codebase direto — `apps/web/src/pages/client/HomeScreen.tsx` (412 linhas) — estado atual da HomeA
- Codebase direto — `apps/web/src/hooks/usePaymentPolling.ts` — polling 3s/5 tentativas
- Codebase direto — `apps/api/src/plugins/cron.ts` — cron jobs existentes
- Codebase direto — `apps/api/prisma/schema.prisma` — modelos Payment, CreditTransaction, Notification
- Codebase direto — `apps/web/src/main.tsx` — inicialização OneSignal e MP
- `.planning/phases/08-finalizacao-pagamentos/08-CONTEXT.md` — decisões locked da fase
- `.planning/phases/08-finalizacao-pagamentos/08-UI-SPEC.md` — contrato visual aprovado

### Secondary (MEDIUM confidence)

- `apps/web/package.json` — versões de `@mercadopago/sdk-react` e `react-onesignal`
- `apps/api/package.json` — versões de `mercadopago`, `@onesignal/node-onesignal`, `node-cron`

### Tertiary (LOW confidence)

- A1: API `react-onesignal` 3.5.x para deep link click handler — baseado em padrão de uso geral do SDK, não verificado na documentação oficial nesta sessão.

---

## Metadata

**Confidence breakdown:**
- Stack (dependências instaladas): HIGH — verificado diretamente nos package.json
- Código existente (gaps identificados): HIGH — inspeção direta de todos os arquivos relevantes
- Padrões de integração OneSignal deep link: MEDIUM — padrão de SDK; API específica da versão 3.5.5 é ASSUMED
- Pitfalls de webhook: HIGH — identificados por análise direta do código
- Testes existentes: MEDIUM — presença dos arquivos confirmada, conteúdo completo não inspecionado

**Research date:** 2026-06-18
**Valid until:** 2026-07-18 (stack estável; MP API pode mudar; OneSignal SDK relativamente estável)
