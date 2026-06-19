# Phase 8: Finalização Pagamentos - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Auditar e completar o fluxo de pagamentos end-to-end: verificar o código existente dos planos 03-03/03-05/03-06 (webhooks MP, CombosScreen, PixWaitingScreen, CardPaymentScreen), identificar e corrigir gaps funcionais, e entregar a HomeA Carteira completa com saldo real + "Entrega de hoje" com 3 estados reais. Inclui push de crédito insuficiente no cron de meia-noite e configuração guiada das credenciais MP sandbox.

**Entregáveis desta fase:**
- Verificação dos módulos API (payments, credits, webhooks) funcionando end-to-end com sandbox MP
- CombosScreen com compra de combos + compra personalizada (avulsa) funcionais
- PixWaitingScreen com QR code + polling funcional (sandbox MP)
- CardPaymentScreen com MP Bricks funcional (sandbox MP)
- HomeA Carteira com saldo real + "Entrega de hoje" com 3 estados via GET /orders/today + tab bar funcional
- BannerInsuficiente na CombosScreen + alerta visual na HomeA quando saldo zerado
- Push notification de crédito insuficiente no cron de meia-noite (deep link para CombosScreen)
- Planos 03-03, 03-05, 03-06 marcados como concluídos no ROADMAP após verificação

**Requisitos desta fase:** CRED-01..06, CRED-08..11, PAY-01..02, UI-04, UI-07, UI-08 (15 requisitos)

</domain>

<decisions>
## Implementation Decisions

### Abordagem ao Código Existente
- **D-01:** Phase 8 **audita e completa gaps** — não reescreve do zero. Os planos 03-03/03-05/03-06 têm código substancial no repositório (webhooks.service.ts, CombosScreen, PixWaitingScreen, CardPaymentScreen). A auditoria identifica o que já funciona e cria planos apenas para lacunas funcionais reais (funcionalidade faltando, quebrada, ou código que compila mas nunca foi testado end-to-end).
- **D-02:** Ao verificar que os planos 03-03/03-05/03-06 estão funcionando corretamente, **marcá-los como concluídos** no ROADMAP.md. Mantém o ROADMAP preciso com o estado real do código.

### HomeA Carteira — Completude
- **D-03:** HomeA entrega **saldo real + "Entrega de hoje" com dados reais** + tab bar funcional. Não fica como placeholder — o endpoint `GET /orders/today` já existe (Phase 5, plano 05-01) e retorna o status real da entrega.
- **D-04:** "Entrega de hoje" exibe os 3 estados: **Agendado → Saiu para entrega → Entregue**, conectado ao `GET /orders/today`. Interface visual completa conforme design handoff. Notificações push de entrega ficam para Phase 9.
- **D-05:** Phase 8 **audita e completa** o HomeScreen existente (412 linhas): verificar que botões navegam corretamente, saldo atualiza após pagamento aprovado, "Entrega de hoje" está conectado, e "Próximas entregas" existe conforme design. Criar tarefas para o que faltar.

### Fluxo Pix pós-pagamento (carry-forward Phase 3)
- **D-06 (=D-01 Phase 3):** Após gerar o QR code, app faz **polling a cada 3s, max 5 tentativas** em `GET /payments/:id/status`. Ao receber `approved`, atualiza saldo e exibe tela de sucesso.
- **D-07 (=D-02 Phase 3):** Créditos creditados **somente após webhook MP** com `status: approved`. Nunca antecipa.
- **D-08 (=D-03 Phase 3):** QR code gerado pelo backend — retorna `qr_code_base64` e `qr_code` (copia-e-cola).

### Crédito Insuficiente (CRED-09 / CRED-10)
- **D-09:** BannerInsuficiente aparece em **3 lugares**: (1) CombosScreen — já existe no código; (2) HomeA — mostrar alerta visual quando saldo zerado (card ou banner no topo); (3) push notification via cron de meia-noite.
- **D-10:** Push de crédito insuficiente disparado no **cron de meia-noite** (já existe, Phase 4) quando: saldo < consumo semanal do agendamento ativo E sem auto-recharge ativado.
- **D-11:** Push usa **deep link** para CombosScreen via `additionalData: { screen: 'creditos' }`. Sem action buttons — o cliente toca na notificação e abre diretamente a tela de compra.

### Mercado Pago Sandbox
- **D-12:** Planos de pagamento incluem **`user_setup` blocking** com env vars e instruções de onde obter no dashboard MP. O executor para e pede ao usuário as credenciais antes dos testes end-to-end.
- **D-13:** Webhooks testados localmente com **ngrok** — cria túnel HTTPS para localhost e a URL é configurada no dashboard MP sandbox.
- **D-14 (=D-12 Phase 3):** Cartão via **MP Bricks** — o componente `CardPayment` tokeniza o cartão no frontend e envia token para o backend. PCI-compliant, sem redirecionamento.

### Compra Recorrente Automática (carry-forward Phase 3)
- **D-15 (=D-04 Phase 3):** AutoBuyScreen **já salva preferência** no banco via `PUT /users/me/auto-recharge`. O cron que dispara a compra automática já está implementado (Phase 4). Phase 8 verifica que a integração está correta.
- **D-16:** `processAutoBuy` (cron Phase 4) usa apenas **Pix** para compra automática — cartão exige CVV a cada transação (PCI-DSS), o que não é possível em automação.

### Tab Bar e Navegação
- **D-17:** Tab bar **Início / Agenda / Créditos / Pedidos** — funcional desde Phase 3. Phase 8 verifica que todas as abas navegam corretamente e o `creditBalance` no AuthContext atualiza após pagamento aprovado.
- **D-18:** Aba **Créditos** abre diretamente a **CombosScreen**. Extrato de transações acessível via botão "Extrato" no card de saldo da HomeA.

### Claude's Discretion
- Estrutura interna do alerta de crédito insuficiente na HomeA (card dismissível vs banner fixo) — implementar conforme design handoff
- Threshold exato do alerta na HomeA (saldo = 0 vs saldo < consumo próximos 7 dias) — começar com saldo = 0, ajustar se necessário
- Mensagem exata na push notification de crédito insuficiente — estilo conversacional Cheirin de Pão

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos e Regras de Negócio
- `.projeto/Cheirin_de_Pao_Requisitos_v01.md` §CRED — CRED-01..11 (sistema de créditos completo)
- `.projeto/Cheirin_de_Pao_Requisitos_v01.md` §PAY — PAY-01..02 (pagamentos Pix e cartão)
- `.projeto/Cheirin_de_Pao_Modelo_Funcionamento.md` — modelo de negócio: como créditos são adquiridos, consumidos e como a compra recorrente funciona

### Design e UI
- `.projeto/design_handoff_cheirin_pao/app/screens-home.jsx` — HomeA "Carteira" completa: card espresso, "Entrega de hoje", próximas entregas, tab bar. **Leitura obrigatória** para completar HomeScreen.
- `.projeto/design_handoff_cheirin_pao/app/screens-order.jsx` — CombosScreen (combos + avulso), PixWaitingScreen (QR + copia-e-cola), CardPaymentScreen. **Leitura obrigatória** para auditoria.
- `.projeto/design_handoff_cheirin_pao/app/brand.jsx` — tokens de tema (espresso, dourado, creme), tipografia Bricolage Grotesque + Hanken Grotesk

### Código Existente — Módulos API
- `apps/api/src/modules/payments/payments.service.ts` — Pix (POST /payments/pix) e cartão (POST /payments/card), polling (GET /payments/:id/status)
- `apps/api/src/modules/webhooks/webhooks.service.ts` — validateSignature (HMAC-SHA256) + reconcilePayment (idempotência + crédito atômico)
- `apps/api/src/modules/credits/credits.service.ts` — GET /combos, GET /pricing, GET /credits/history
- `apps/api/src/server.ts` — registro de paymentsRoute, creditsRoute, webhooksRoute (linhas 168-170)
- `apps/api/prisma/schema.prisma` — modelos Payment, CreditTransaction, Combo, User (creditBalance, autoRecharge, cardTokenMp)

### Código Existente — Frontend
- `apps/web/src/pages/client/CombosScreen.tsx` — 407 linhas; tabs combos/avulso, ComboCard, QuantityStepper, BannerInsuficiente, navegação para PixWaiting e CardPayment
- `apps/web/src/pages/client/PixWaitingScreen.tsx` — 262 linhas; QR code base64, copia-e-cola, usePaymentPolling
- `apps/web/src/pages/client/CardPaymentScreen.tsx` — 127 linhas; CardPayment Brick, token enviado ao backend
- `apps/web/src/pages/client/HomeScreen.tsx` — 412 linhas; usa CreditBalanceCard; auditar e completar seção "Entrega de hoje"
- `apps/web/src/hooks/usePaymentPolling.ts` — polling 3s/5 tentativas existente
- `apps/web/src/routes/router.tsx` — rotas /client/creditos, /client/creditos/pix, /client/creditos/cartao

### Planos Pendentes da Phase 3 (para auditoria)
- `.planning/phases/03-credits-commerce/03-03-PLAN.md` — plano: webhooks + server.ts (não executado via GSD)
- `.planning/phases/03-credits-commerce/03-05-PLAN.md` — plano: CombosScreen + componentes (não executado via GSD)
- `.planning/phases/03-credits-commerce/03-06-PLAN.md` — plano: PixWaitingScreen + CardPaymentScreen + initMercadoPago (não executado via GSD)
- `.planning/phases/03-credits-commerce/03-CONTEXT.md` — decisões de design da Phase 3 (D-01..D-12 carregados neste contexto)

### Módulos do Backend Relacionados (Phase 4/5)
- `apps/api/src/plugins/cron.ts` — cron de meia-noite (para adicionar push de crédito insuficiente)
- `apps/api/src/modules/schedules/schedules.service.ts` — processAutoBuy + sendEveReminders (padrão de push existente)
- `apps/api/src/modules/orders/orders.route.ts` — GET /orders/today (para "Entrega de hoje" na HomeA)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BannerInsuficiente` (apps/web/src/components/client/BannerInsuficiente.tsx) — já usado em CombosScreen, reutilizar na HomeA
- `CreditBalanceCard` (apps/web/src/components/client/CreditBalanceCard.tsx) — card espresso com saldo, já na HomeA
- `QuantityStepper` (apps/web/src/components/client/QuantityStepper.tsx) — stepper min/max usado em CombosScreen e ScheduleScreen
- `usePaymentPolling` (apps/web/src/hooks/usePaymentPolling.ts) — polling 3s/5 tentativas, já usado em PixWaitingScreen
- `useAuth()` com `user.creditBalance` — saldo exposto via AuthContext; `updateCreditBalance()` chamado após pagamento aprovado

### Established Patterns
- **Módulo Fastify**: `modules/{domain}/{domain}.route.ts` + `.controller.ts` + `.service.ts` + `.repository.ts` — payments, webhooks, credits já seguem o padrão
- **apiFetch wrapper**: todos os hooks de pagamento usam `apiFetch` (injeção automática do token de autorização)
- **Push notifications**: padrão estabelecido em `schedules.service.ts` — `OneSignal.Notifications.push()` com `additionalData` para deep link
- **AuthContext invalidation**: após pagamento, `updateCreditBalance(newBalance)` atualiza o saldo no contexto sem re-fetch do usuário inteiro

### Integration Points
- **server.ts**: paymentsRoute, creditsRoute, webhooksRoute já registrados (linhas 168–170) — sem necessidade de registrar novamente
- **router.tsx**: rotas `/client/creditos`, `/client/creditos/pix`, `/client/creditos/cartao` já wired com lazy imports
- **cron.ts**: cron de meia-noite já existe — adicionar verificação de crédito insuficiente na função existente
- **Webhook URL**: configurada no dashboard MP → ngrok local URL → POST /webhooks/mercadopago
- **ENV vars necessárias**: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` (apps/api/.env); `MP_PUBLIC_KEY`, `VITE_MP_PUBLIC_KEY` (apps/web/.env)

</code_context>

<specifics>
## Specific Ideas

- **user_setup blocking**: planos de pagamento devem incluir `user_setup` com instruções para obter credenciais no dashboard MP sandbox (mercadopago.com.br → Minhas integrações → Credenciais de teste)
- **ngrok para webhooks**: `ngrok http 3001` e configurar a URL resultante no dashboard MP como webhook endpoint: `https://{ngrok-id}.ngrok.io/webhooks/mercadopago`
- **Deep link na push**: `additionalData: { screen: 'creditos' }` e handler no frontend em `react-onesignal` para navegar para `/client/creditos`
- **"Entrega de hoje" no HomeScreen**: usar `GET /orders/today` (já existe em `orders.route.ts`) — retorna array de pedidos do dia BRT. Se array vazio, mostrar "Nenhuma entrega hoje". Se existe, mostrar status do primeiro pedido ativo.
- **Auditoria dos planos 03-03/05/06**: verificar especificamente: (1) assinatura HMAC-SHA256 do webhook, (2) idempotência (mesmo mpPaymentId não credita duas vezes), (3) BannerInsuficiente visível com créditos insuficientes, (4) polling para em 5 tentativas ou ao receber approved/rejected

</specifics>

<deferred>
## Deferred Ideas

- **Push de crédito insuficiente com 2 botões de ação** (action buttons "Comprar" e "Ajustar agenda") — defer para quando OneSignal action buttons estiverem sendo usados por outras notificações. Deep link é suficiente.
- **Alerta de crédito insuficiente baseado em previsão de 7 dias** (não apenas saldo zerado) — defer para ajuste pós-lançamento. Começar com saldo = 0 e refinar com base no uso real.
- **Script de setup automático de env vars** — `user_setup` blocking é suficiente para os desenvolvedores.
- **Histórico de créditos manuais admin visível ao cliente** — defer → v2 (extrato de ADMIN_GRANT).

</deferred>

---

*Phase: 08-finalizacao-pagamentos*
*Context gathered: 2026-06-18*
