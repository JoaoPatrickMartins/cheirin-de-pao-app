# Roadmap: Cheirin de Pão

## Overview

Construção do PWA Cheirin de Pão em fases verticais. Cada fase entrega um bloco funcional completo que o usuário pode testar manualmente ao final. A progressão vai da fundação técnica ao núcleo de negócio (créditos + agendamento) e termina no painel admin completo. Cada fase desbloqueia a próxima — não há código morto esperando integração.

O milestone v1.1 (Fases 8–14) completa o loop de valor do cliente: fecha os pagamentos e rastreamento pendentes do v1.0, e adiciona crédito manual admin, configurações de conta, cartões salvos, horários configuráveis por condomínio e agenda multi-slot.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

### Milestone v1.0

- [x] **Phase 1: Foundation** - Monorepo, Dev Container, Prisma schema, shared packages e PWA shell instalável (completed 2026-06-13)
- [x] **Phase 2: Authentication** - OTP login, cadastro em 5 passos, sessão permanente e roteamento por perfil (completed 2026-06-14)
- [ ] **Phase 3: Credits & Commerce** - Compra de combos, compra personalizada, saldo de créditos e pagamento via Mercado Pago
- [x] **Phase 4: Scheduling** - Agenda semanal, pedido único, reserva de créditos e compra automática (completed 2026-06-15)
- [x] **Phase 5: Delivery Experience** - Rastreamento 3 estados, notificações push, histórico e central de notificações (completed 2026-06-19)
- [x] **Phase 6: Courier App** - Lista de entregas do entregador, confirmação manual e rota com mapa (completed 2026-06-15)
- [x] **Phase 7: Admin Panel** - Painel admin completo: gestão, operação, financeiro e pagamentos (completed 2026-06-15)

### Milestone v1.1 — Experiência Completa do Cliente

- [x] **Phase 8: Finalização Pagamentos** - Webhooks MP, telas de compra (CombosScreen, PixWaiting, CardPayment) e Home Carteira completa (completed 2026-06-19)
- [x] **Phase 9: Finalização Rastreamento** - Cron de véspera, TrackingScreen, NotificationsScreen e badge na Home (completed 2026-06-19)
- [x] **Phase 10: Schema v1.1 + Crédito Manual Admin + Logout** - Schema unificado v1.1, crédito manual admin com push, botão de logout para entregador e admin (completed 2026-06-19)
- [ ] **Phase 11: Configurações e Perfil do Cliente** - Tela de configurações completa: dados pessoais, contato com OTP, condomínio e logout do cliente
- [x] **Phase 12: Cartões Salvos** - Fluxo de compra com cartão salvo via MP Customer API, CRUD de cartões nas configurações (completed 2026-06-20)
- [x] **Phase 13: Horários por Condomínio** - Admin configura 2 slots (manhã/tarde) por condomínio com horários e cortes individuais (completed 2026-06-20)
- [ ] **Phase 14: Agenda Multi-Slot** - Cliente agenda quantidade por horário por dia; cron e app entregador ajustados

## Phase Details

### Phase 1: Foundation

**Goal**: Desenvolvedor consegue rodar o projeto completo localmente com um único comando, e usuário vê a tela inicial do PWA instalável no celular
**Mode**: mvp
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, PWA-01, PWA-02, PWA-03, PWA-04, PWA-05, UI-01, UI-02, UI-03, UI-05, UI-10
**Success Criteria** (what must be TRUE):

  1. `npm install && npm run dev` na raiz do monorepo sobe frontend e backend simultaneamente sem erros
  2. Acessar o app no celular Android mostra o banner "Instalar app" e ao tocar abre a janela nativa de instalação do navegador
  3. Acessar o app no iPhone (iOS 16.4+) mostra o banner com instrução visual passo a passo para adicionar à tela inicial
  4. PWA instalado abre como app standalone (sem barra do navegador) com a tela Splash em fundo espresso e símbolo dourado BreadMark
  5. API Fastify responde em `/health` com status 200 e conexão com MongoDB Atlas confirmada nos logs

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Monorepo scaffold + workspace config + Vitest test infrastructure

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Fastify API + Prisma schema (15 collections) + /health endpoint + MongoDB Atlas connection
- [x] 01-03-PLAN.md — Frontend PWA + design tokens + BreadMark + SplashScreen + install prompts + React Router

**UI hint**: yes

### Phase 2: Authentication

**Goal**: Usuário pode criar conta em 5 passos, fazer login com OTP e ser redirecionado para a tela correta conforme seu perfil (Cliente, Entregador ou Admin)
**Mode**: mvp
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, UI-06
**Success Criteria** (what must be TRUE):

  1. Novo cliente completa o cadastro em 5 passos (Dados, Contato, Condomínio, Endereço, OTP) e sua conta é criada no banco
  2. Cliente faz login inserindo telefone ou e-mail, recebe código OTP de 4 dígitos com avanço automático de foco entre campos e é autenticado
  3. Sessão persiste após fechar e reabrir o app — cliente não precisa logar novamente
  4. Admin cadastra entregador pelo painel e entregador consegue fazer login com OTP
  5. Login de Admin funciona com OTP — sem tela de cadastro público disponível

**Plans**: 6 plans
Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Prisma schema extension (Session + OtpCode) + db push + CpfSchema + Wave 0 test stubs

**Wave 2** *(blocked on Wave 1 completion — 02-02 e 02-02b são sequenciais: 02-02b depende de 02-02)*

- [x] 02-02-PLAN.md — Auth business logic core: schemas, repository, service, OTP service, unit tests
- [x] 02-02b-PLAN.md — Auth wiring: routes, controller, authenticate plugin (preHandler only), admin bootstrap, GET /condominiums, server.ts

**Wave 3** *(blocked on Wave 2 completion — depende de 02-02b)*

- [x] 02-03-PLAN.md — AuthContext + ProtectedRoute + LoadingScreen + router rewiring + profile layout guards

**Wave 4** *(blocked on Wave 3 completion — plans 04 e 05 são paralelos)*

- [x] 02-04-PLAN.md — LoginScreen (2-step OTP login) + apiFetch wrapper + OtpInput + ResendTimer
- [x] 02-05-PLAN.md — OnboardingScreen (5-step registration) + StepDots + CondoSearch + ChannelSelector + CourierRegisterScreen

**UI hint**: yes

### Phase 3: Credits & Commerce

**Goal**: Cliente autenticado pode comprar créditos de pãezinhos via combo ou compra personalizada, pagar com Pix ou cartão e ver o saldo atualizado na Home
**Mode**: mvp
**Depends on**: Phase 2
**Requirements**: CRED-01, CRED-02, CRED-03, CRED-04, CRED-05, CRED-06, CRED-07, CRED-08, CRED-09, CRED-10, CRED-11, PAY-01, PAY-02, UI-04, UI-07, UI-08
**Success Criteria** (what must be TRUE):

  1. Home do Cliente (variação A "Carteira") exibe o saldo de créditos como número de pãezinhos disponíveis em card espresso grande
  2. Cliente compra um combo, paga via Pix no Mercado Pago, e os créditos aparecem imediatamente no saldo
  3. Cliente compra via cartão de crédito/débito no Mercado Pago e os créditos são creditados após confirmação do pagamento
  4. Cliente faz compra personalizada (avulsa) com quantidade abaixo do limite configurado pelo Admin e o preço unitário é maior que o do combo
  5. Tab bar do Cliente (Início / Agenda / Créditos / Pedidos) está presente e navega entre as seções corretamente

**Plans**: 6 plans
Plans:
**Wave 0** *(bloqueante — deve completar antes dos demais)*

- [x] 03-01-PLAN.md — Schema Prisma (creditBalance, autoRecharge, cardTokenMp, customQuantity) + prisma generate + stubs de teste Wave 0

**Wave 1** *(blocked on Wave 0 completion — 03-02 e 03-04 são paralelos)*

- [x] 03-02-PLAN.md — Módulo payments API (POST /payments/pix, POST /payments/card, GET /payments/:id/status) + módulo credits API (GET /combos, GET /pricing, GET /credits/history)
- [x] 03-04-PLAN.md — AuthContext (creditBalance) + ClientTabBar + router sub-rotas /client + HomeA + CreditBalanceCard + CreditHistoryScreen + PlaceholderScreen

**Wave 2** *(blocked on Wave 1 — 03-03 depende de 03-02; 03-05 depende de 03-04)*

- [x] 03-03-PLAN.md — Módulo webhooks API (HMAC-SHA256, idempotência, crédito atômico) + registro dos 3 módulos em server.ts
- [x] 03-05-PLAN.md — CombosScreen + QuantityStepper + StepperInline + ComboCard + BannerInsuficiente + PurchasedScreen + AutoBuyScreen

**Wave 3** *(blocked on Wave 2 completion — 03-06 depende de 03-03 e 03-05)*

- [x] 03-06-PLAN.md — PixWaitingScreen (QR code + polling) + CardPaymentScreen (Bricks) + usePaymentPolling + initMercadoPago

**UI hint**: yes

### Phase 4: Scheduling

**Goal**: Cliente pode configurar agenda semanal recorrente e pedidos únicos, com créditos reservados automaticamente e alertas de saldo insuficiente
**Mode**: mvp
**Depends on**: Phase 3
**Requirements**: SCHED-01, SCHED-02, SCHED-03, SCHED-04, SCHED-05, SCHED-06
**Success Criteria** (what must be TRUE):

  1. Cliente configura agenda semanal definindo quantidade por dia da semana (0 = sem entrega) e os créditos são reservados imediatamente
  2. Agenda semanal repete automaticamente na semana seguinte sem o cliente precisar reconfigurá-la
  3. Cliente cria pedido único para data específica com quantidade escolhida e créditos são reservados imediatamente
  4. Tela de agenda exibe consumo semanal total, cobertura de créditos e banner de alerta quando créditos são insuficientes
  5. Cliente ativa notificação de reconfiguração semanal e recebe lembrete no domingo à noite

**Plans**: 6 plans
Plans:
**Wave 0** *(bloqueante — deve completar antes dos demais)*

- [x] 04-01-PLAN.md — Schema Prisma (oneSignalPlayerId + @@unique Schedule) + db push + node-cron/@onesignal install + stubs de teste

**Wave 1** *(blocked on Wave 0 — 04-02 e 04-03 são paralelos)*

- [x] 04-02-PLAN.md — Módulo schedules (GET/PUT /schedules/me) + SchedulesService (createDailyOrders, sendReconfigureReminders, processAutoBuy) + testes
- [x] 04-03-PLAN.md — Módulo orders (POST /orders, reserva atômica) + módulo notifications (POST /users/push-token) + testes

**Wave 2** *(blocked on Wave 1 — 04-04 e 04-05 são paralelos)*

- [x] 04-04-PLAN.md — Plugin cron.ts (3 crons: meia-noite, auto-buy, domingo 20h) + wiring server.ts
- [x] 04-05-PLAN.md — ScheduleScreen + DeliveryTimeChips + BannerCobertura + useSchedule hook

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-06-PLAN.md — SingleScreen + DateChips + router.tsx atualizado + useOneSignalRegister + ClientLayout wiring

**UI hint**: yes

### Phase 5: Delivery Experience

**Goal**: Cliente acompanha o status da entrega em tempo real, recebe notificações push na véspera e na entrega, e acessa histórico dos últimos 30 dias
**Mode**: mvp
**Depends on**: Phase 4
**Requirements**: ACOMP-01, ACOMP-02, ACOMP-03, ACOMP-04, ACOMP-05, PAY-03, PAY-04
**Success Criteria** (what must be TRUE):

  1. Home do Cliente exibe o status da entrega de hoje em 3 estados: Agendado → Saiu para entrega → Entregue, e o estado muda em tempo real quando o entregador confirma
  2. Cliente instalado como PWA recebe notificação push na véspera lembrando da entrega do dia seguinte
  3. Cliente recebe notificação push de confirmação quando a entrega é marcada como realizada pelo entregador
  4. Tela de histórico exibe os pedidos dos últimos 30 dias com data, quantidade e status de cada entrega
  5. Central de notificações lista todas as notificações recebidas com cards por tipo e indicação visual de itens novos

**Plans**: 4 plans
Plans:
**Wave 1** *(05-01 e 05-02 são paralelos)*

- [x] 05-01-PLAN.md — Módulo admin-orders (PATCH /admin/orders/:id/status, VALID_TRANSITIONS, push DELIVERED, persist Notification + trim 30)
- [x] 05-02-PLAN.md — Extensão orders (GET /orders/today BRT, GET /orders/history) + extensão notifications (GET /me, PATCH /read-all, GET /unread-count)

**Wave 2** *(blocked on Wave 1 — 05-03 e 05-04 são paralelos)*

- [x] 05-03-PLAN.md — sendEveReminders em schedules.service + cron 21h em cron.ts + wiring adminOrdersRoute em server.ts
- [x] 05-04-PLAN.md — useOrderTracking hook + TrackingScreen + NotificationsScreen + HomeScreen bell/badge + router.tsx

**UI hint**: yes

### Phase 6: Courier App

**Goal**: Entregador acessa a lista de entregas do dia, confirma cada entrega com um toque e visualiza a rota no mapa com ordem de paradas entre condomínios
**Mode**: mvp
**Depends on**: Phase 5
**Requirements**: COUR-01, COUR-02, COUR-03, COUR-04, COUR-05
**Success Criteria** (what must be TRUE):

  1. Entregador faz login e vê a lista de entregas do dia agrupada por condomínio com bloco/torre, apartamento, quantidade e nome do cliente
  2. Entregador toca em uma entrega para confirmar manualmente e o status muda para "Entregue" — cliente recebe notificação imediatamente
  3. Mapa exibe a rota entre condomínios com a ordem sugerida de paradas (OpenStreetMap + Leaflet + OSRM)
  4. Card de progresso exibe paradas feitas/total e total de pães entregues no dia
  5. Dentro de cada condomínio, o sistema exibe a ordem sugerida de apartamentos para otimizar o percurso

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 06-01-PLAN.md — Schema Prisma (courierId em Order) + módulo courier API (GET today + PATCH confirm) + requireCourier guard + assign-courier admin + testes

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 06-02-PLAN.md — CourierScreen + ProgressCard + SegmentedControl + CondoAccordion + StopRow + ConfirmDeliveryDialog + router.tsx

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 06-03-PLAN.md — CourierMap (react-leaflet) + CourierRouteView (aba Rota real) + substituição do placeholder

**UI hint**: yes

### Phase 7: Admin Panel

**Goal**: Admin tem controle total da operação — gerencia condomínios, combos, fornecedores, entregadores e clientes, gera pedidos ao fornecedor, acompanha entregas e visualiza o financeiro
**Mode**: mvp
**Depends on**: Phase 6
**Requirements**: ADMO-01, ADMO-02, ADMO-03, ADMO-04, ADMO-05, ADMO-06, ADMO-07, ADMO-08, ADMO-09, ADMO-10, ADMO-11, ADMG-01, ADMG-02, ADMG-03, ADMG-04, ADMG-05, ADMG-06, ADMG-07, ADMG-08, ADMG-09, ADMG-10, ADMG-11, ADMF-01, ADMF-02, ADMF-03, ADMF-04, PAY-03, PAY-04, UI-09
**Success Criteria** (what must be TRUE):

  1. Admin configura horário de corte e após o horário novos pedidos são bloqueados — clientes que não agendaram recebem notificação push
  2. Admin gera o pedido de compra ao fornecedor, ajusta quantidades, divide entre fornecedores e baixa o relatório em PDF e Excel
  3. Admin realiza CRUD completo de condomínios, combos (com promoções), fornecedores e entregadores (com ativar/desativar)
  4. Admin visualiza lista de clientes com filtro por condomínio, pode bloquear/desbloquear e ver histórico de agendamentos de cada cliente
  5. Admin visualiza receita por período (dia/semana/mês), filtrada por condomínio e separada por tipo (combos vs avulso), e gerencia pagamentos com opção de estorno

**Plans**: 12 plans
Plans:
**Wave 0** *(bloqueante — deve completar antes dos demais)*

- [x] 07-01-PLAN.md — Schema Prisma (Order.condominiumId + Supplier.isPrincipal) + prisma generate [BLOCKING] + stubs de teste Wave 0

**Wave 1** *(paralelo — 07-02, 07-03, 07-04, 07-05 independentes; 07-06 depende de todos)*

- [x] 07-02-PLAN.md — API: admin-settings (cutoffTime + avulso) + admin-condominiums CRUD + admin-combos CRUD + promoções
- [x] 07-03-PLAN.md — API: admin-suppliers CRUD (isPrincipal) + admin-couriers (cadastro + toggle) + admin-clients (lista + detalhe + bloquear)
- [x] 07-04-PLAN.md — API: admin-supplier-orders (draft + create + finalize + PDF + Excel) + pdf-generator + excel-generator
- [x] 07-05-PLAN.md — API: admin-financial (receita por período/tipo/condomínio) + admin-payments (lista + estorno MP)
- [x] 07-06-PLAN.md — API wiring: cron cutoff em cron.ts + 9 módulos em server.ts + admin-orders estendido (dashboard + delivery-status + division-suggestion)

**Wave 2** *(paralelo — 07-07 a 07-11 independentes; todos dependem de 07-06)*

- [x] 07-07-PLAN.md — Frontend: AdminLayout + AdminBottomNav + AdminHead + KpiCard + BarChart + ProgressBar + AdminPainel (dashboard)
- [x] 07-08-PLAN.md — Frontend: AdminPedido (fluxo 4 etapas) + StepBar + download PDF/Excel
- [x] 07-09-PLAN.md — Frontend: AdminEntregas + SegmentedControl genérico + DeliveryDivisionCard (dnd-kit)
- [x] 07-10-PLAN.md — Frontend: AdminClientes (lista + chips filtro) + ClientDetailView (detalhe + bloquear)
- [x] 07-11-PLAN.md — Frontend: AdminGestao hub + AdminCombos + AdminAvulso + AdminFornecedores + AdminEntregadores + AdminCondos + 4 formulários CRUD

**Wave 3** *(depende de todos da Wave 2)*

- [x] 07-12-PLAN.md — Frontend: AdminFinanceiro + AdminPagamentos + PaymentDetailSheet + wiring AdminGestao + AdminLayout + router.tsx

**UI hint**: yes

---

### Phase 8: Finalização Pagamentos

**Goal**: Cliente consegue comprar combos e fazer compra personalizada, pagar com Pix ou cartão, e ver o saldo atualizado na Home Carteira com navegação completa por tab bar
**Depends on**: Phase 7 (planos 03-03, 03-05, 03-06 pendentes da Phase 3)
**Requirements**: CRED-01, CRED-02, CRED-03, CRED-04, CRED-05, CRED-06, CRED-08, CRED-09, CRED-10, CRED-11, PAY-01, PAY-02, UI-04, UI-07, UI-08
**Success Criteria** (what must be TRUE):

  1. Home do Cliente (variação A "Carteira") exibe saldo de créditos em card espresso grande com tab bar (Início / Agenda / Créditos / Pedidos) funcional
  2. Cliente abre a tela de Créditos, vê os combos disponíveis configurados pelo Admin, escolhe um, paga via Pix e os créditos aparecem no saldo após confirmação via webhook
  3. Cliente paga via cartão de crédito/débito pelo MP Bricks e os créditos são creditados ao receber o webhook de aprovação
  4. Cliente faz compra personalizada com quantidade abaixo do limite do Admin — o preço unitário exibido é maior que o do combo
  5. Quando créditos estão insuficientes sem compra automática, o banner de alerta aparece com opções de comprar combo ou ajustar agendamento

**Plans**: 5 plans
Plans:
**Wave 1** *(08-01 e 08-02 são paralelos)*

- [x] 08-01-PLAN.md — Auditoria backend (testes payments + webhooks + credits) + user_setup MP sandbox blocking
- [x] 08-02-PLAN.md — sendLowCreditNotifications (CRED-09) + fix processAutoBuy URL + cron wiring + testes unitários

**Wave 2** *(blocked on Wave 1 — 08-05 depende de 08-02)*

- [x] 08-05-PLAN.md — Auditoria e testes unitários de processAutoBuy (CRED-08/10): weekday, modo semanal, push de confirmação

**Wave 3** *(blocked on Wave 2 — 08-03 depende de 08-01, 08-02 e 08-05)*

- [x] 08-03-PLAN.md — HomeScreen (BannerInsuficiente + NextDays reais + TodayDelivery 3 estados) + CardPaymentScreen fix + useOneSignalDeepLink + auditoria CombosScreen e PixWaitingScreen

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 08-04-PLAN.md — Verificação end-to-end sandbox MP (Pix + cartão + avulso) + marcação planos 03-03/05/06 concluídos no ROADMAP

**UI hint**: yes

### Phase 9: Finalização Rastreamento

**Goal**: Cliente acompanha o status da entrega em tempo real na Home, recebe notificações push na véspera e ao ser entregue, e acessa histórico e central de notificações
**Depends on**: Phase 8
**Requirements**: ACOMP-01, ACOMP-02, ACOMP-03, ACOMP-04, ACOMP-05
**Success Criteria** (what must be TRUE):

  1. Home do Cliente exibe status da entrega de hoje (Agendado → Saiu para entrega → Entregue) e o ícone de sino mostra badge com contagem de notificações não lidas
  2. Cliente recebe notificação push na véspera lembrando a entrega do dia seguinte (disparada pelo cron das 21h BRT)
  3. Ao tocar no sino, a tela de notificações lista todas as notificações com cards por tipo e marca as não lidas visualmente
  4. Tela de histórico exibe os pedidos dos últimos 30 dias com data, quantidade e status de cada entrega

**Plans**: 4 plans
Plans:
**Wave 1** *(09-01 e 09-02 são paralelos)*

- [x] 09-01-PLAN.md — Backend gaps: notification.data nos pushes sendEveReminders + notifyAndPersist + copywriting alinhado ao UI-SPEC
- [x] 09-02-PLAN.md — NotifContext + ClientLayout provider + useOneSignalDeepLink case pedidos + stubs de teste NotifContext

**Wave 2** *(blocked on Wave 1 — 09-03 depende de 09-02)*

- [x] 09-03-PLAN.md — NotificationsScreen CTA_CONFIG completo + badge sync via refresh(); HomeScreen migra useNotifBadge → useNotif; stubs TrackingScreen + NotificationsScreen

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 09-04-PLAN.md — Auditoria TrackingScreen + fallback navigate + ROADMAP 05-03/05-04 concluídos + checkpoint humano

**UI hint**: yes

### Phase 10: Schema v1.1 + Crédito Manual Admin + Logout

**Goal**: Admin consegue adicionar créditos manualmente a um cliente com registro de auditoria e notificação push; entregador e admin conseguem fazer logout
**Depends on**: Phase 9
**Requirements**: CREDM-01, CREDM-02, CREDM-03, LGOUT-01, LGOUT-02
**Success Criteria** (what must be TRUE):

  1. Schema v1.1 aplicado — campos `mpCustomerId`, `deliverySlots`, `days`, `ADMIN_GRANT` e model `SavedCard` presentes sem quebrar documentos existentes
  2. Admin abre o detalhe de um cliente, insere quantidade e seleciona um motivo (acerto, bonificação, compensação ou promoção) e confirma — os créditos são adicionados ao saldo
  3. A operação é registrada em `CreditTransaction` com `type=ADMIN_GRANT`, quantidade, adminId e motivo visíveis no histórico de auditoria
  4. Cliente recebe notificação push e notificação in-app informando o recebimento dos créditos manuais
  5. Entregador e Admin conseguem fazer logout e são redirecionados para a tela de login

**Plans**: TBD
**UI hint**: yes

### Phase 11: Configurações e Perfil do Cliente

**Goal**: Cliente acessa uma tela de configurações completa onde pode editar dados pessoais, contato (com re-verificação OTP), condomínio e fazer logout
**Depends on**: Phase 10
**Requirements**: CONF-01, CONF-02, CONF-03, CONF-04, CONF-05, CONF-06, CONF-07
**Success Criteria** (what must be TRUE):

  1. Cliente toca no tab Perfil e acessa a tela de configurações com seções de dados pessoais, contato, condomínio e logout
  2. Cliente edita nome completo e data de nascimento — CPF é exibido mas bloqueado para edição
  3. Cliente altera telefone ou e-mail, recebe OTP no novo contato para confirmar, e o dado é atualizado apenas após validação
  4. Ao mudar de condomínio, o sistema desativa a agenda semanal ativa e exibe aviso para o cliente reconfigurar
  5. Cliente toca em "Sair" e a sessão é encerrada com redirecionamento para a tela de login

**Plans**: 5 plans
Plans:
**Wave 1** *(bloqueante — schema + stubs de teste)*

- [x] 11-01-PLAN.md — Schema Prisma (OtpCode.purpose String?) + auth.repository.ts fix (findActiveOtp backward-compat) + stubs de teste Wave 0

**Wave 2** *(blocked on Wave 1)*

- [x] 11-02-PLAN.md — Módulo backend client-profile (schema Zod + repository + service + controller + route) + db push + wiring server.ts

**Wave 3** *(blocked on Wave 2)*

- [ ] 11-03-PLAN.md — AuthContext enriquecido (updateUser + campos de perfil) + ClientTabBar 5º tab Perfil + router.tsx rotas perfil + LoginScreen fetch pós-login

**Wave 4** *(blocked on Wave 2 + Wave 3)*

- [ ] 11-04-PLAN.md — SettingsScreen (4 seções + dialog condomínio + toast) + ContactEditScreen (wizard 2 steps + OTP)

**Wave 5** *(blocked on Wave 3 + Wave 4 — tem checkpoint humano)*

- [ ] 11-05-PLAN.md — ScheduleScreen banner contextual (condominiumJustChanged) + checkpoint humano de verificação CONF-01 a CONF-07

**UI hint**: yes

### Phase 12: Cartões Salvos

**Goal**: Cliente pode pagar com cartão salvo no fluxo de compra (sem redigitar dados), cadastrar novo cartão com opção de salvar, e gerenciar seus cartões nas configurações
**Depends on**: Phase 11
**Requirements**: CARD-01, CARD-02, CARD-03, CARD-04, CARD-05, CARD-06
**Success Criteria** (what must be TRUE):

  1. No fluxo de compra com cartão, cliente vê seus cartões salvos (bandeira + 4 últimos dígitos + vencimento) e seleciona um para pagar — CVV é recapturado via Brick
  2. Cliente cadastra novo cartão no fluxo de compra marcando a opção "salvar para uso futuro" — o cartão aparece nas compras seguintes
  3. Compra única sem salvar cartão está disponível com menor destaque visual na mesma tela
  4. Nas configurações, cliente vê seus cartões salvos (até 3), pode definir um como padrão e remover cartões existentes
  5. Fluxo de cartão salvo funciona tanto para compra de combo quanto para compra personalizada

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 12-01-PLAN.md — Módulo backend saved-cards (schema + repository + service + controller + route) + expansão payments.service (savedCardId + saveCard:true) + wiring server.ts + testes unitários

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 12-02-PLAN.md — SavedCardItem + SavedCardsList + CardPaymentScreen refatorada (Modo A: cartões salvos / Modo B: sem cartões)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 12-03-PLAN.md — SavedCardsSection na SettingsScreen + checkpoint humano CARD-01..06

**UI hint**: yes

### Phase 13: Horários por Condomínio

**Goal**: Admin configura 2 slots de entrega (manhã e tarde) por condomínio com horários e horários de corte individuais; novos condomínios ganham slots padrão automaticamente
**Depends on**: Phase 12
**Requirements**: SLOT-01, SLOT-02, SLOT-03, SLOT-04, SLOT-05, SLOT-06, SLOT-07
**Success Criteria** (what must be TRUE):

  1. Admin acessa as configurações de um condomínio e vê os 2 slots (manhã 06:30 e tarde 15:30) com opção de editar horário, ativar/desativar e configurar horário de corte de cada um
  2. Ao criar um novo condomínio, os 2 slots padrão são criados automaticamente sem ação adicional do admin
  3. Condomínios existentes recebem os slots padrão via script de migração no deploy — dados legados não são quebrados
  4. Na tela de agenda, os horários disponíveis para o cliente são carregados dos slots ativos do seu condomínio (não mais fixos no frontend)
  5. O cron de meia-noite e as notificações de corte disparam separadamente para cada slot ativo, respeitando o horário de corte individual de cada um

**Plans**: TBD
**UI hint**: yes

### Phase 14: Agenda Multi-Slot

**Goal**: Cliente configura quantidade de pães por horário de entrega (manhã e tarde) para cada dia da semana; o cron gera orders separados por slot; agendamentos legados continuam funcionando
**Depends on**: Phase 13
**Requirements**: MSCHED-01, MSCHED-02, MSCHED-03, MSCHED-04
**Success Criteria** (what must be TRUE):

  1. Na tela de agenda, o cliente vê uma seção por horário (manhã / tarde) — cada seção tem stepper de quantidade por dia da semana
  2. O cron de meia-noite gera um Order separado por slot agendado — um cliente com 2 slots ativos num mesmo dia gera 2 orders naquele dia
  3. Agendamentos antigos com `weeklyQty` e `deliveryTime` único continuam funcionando sem migração forçada de dados
  4. O consumo semanal total exibido na tela de agenda soma a quantidade de todos os slots de todos os dias

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-06-13 |
| 2. Authentication | 6/6 | Complete | 2026-06-14 |
| 3. Credits & Commerce | 6/6 | Complete | 2026-06-18 |
| 4. Scheduling | 6/6 | Complete | 2026-06-15 |
| 5. Delivery Experience | 4/4 | Complete | 2026-06-19 |
| 6. Courier App | 3/3 | Complete | 2026-06-15 |
| 7. Admin Panel | 12/12 | Complete | 2026-06-15 |
| 8. Finalização Pagamentos | 5/5 | Complete   | 2026-06-19 |
| 9. Finalização Rastreamento | 4/4 | Complete   | 2026-06-19 |
| 10. Schema v1.1 + Crédito Manual + Logout | 3/3 | Complete    | 2026-06-19 |
| 11. Configurações e Perfil do Cliente | 2/5 | In Progress|  |
| 12. Cartões Salvos | 3/3 | Complete   | 2026-06-20 |
| 13. Horários por Condomínio | 4/4 | Complete   | 2026-06-20 |
| 14. Agenda Multi-Slot | 0/TBD | Not started | |
