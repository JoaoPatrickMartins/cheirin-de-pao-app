# Roadmap: Cheirin de Pão

## Overview

Construção do PWA Cheirin de Pão em 7 fases verticais. Cada fase entrega um bloco funcional completo que o usuário pode testar manualmente ao final. A progressão vai da fundação técnica ao núcleo de negócio (créditos + agendamento) e termina no painel admin completo. Cada fase desbloqueia a próxima — não há código morto esperando integração.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Monorepo, Dev Container, Prisma schema, shared packages e PWA shell instalável (completed 2026-06-13)
- [ ] **Phase 2: Authentication** - OTP login, cadastro em 5 passos, sessão permanente e roteamento por perfil
- [ ] **Phase 3: Credits & Commerce** - Compra de combos, compra personalizada, saldo de créditos e pagamento via Mercado Pago
- [ ] **Phase 4: Scheduling** - Agenda semanal, pedido único, reserva de créditos e compra automática
- [ ] **Phase 5: Delivery Experience** - Rastreamento 3 estados, notificações push, histórico e central de notificações
- [ ] **Phase 6: Courier App** - Lista de entregas do entregador, confirmação manual e rota com mapa
- [ ] **Phase 7: Admin Panel** - Painel admin completo: gestão, operação, financeiro e pagamentos

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

**Plans**: 5 plans
Plans:
**Wave 1**

- [ ] 02-01-PLAN.md — Prisma schema extension (Session + OtpCode) + db push + CpfSchema + Wave 0 test stubs

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 02-02-PLAN.md — API auth module (register/OTP/verify/couriers) + authenticate plugin + admin bootstrap + GET /condominiums

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 02-03-PLAN.md — AuthContext + ProtectedRoute + LoadingScreen + router rewiring + profile layout guards

**Wave 4** *(blocked on Wave 3 completion — plans 04 and 05 are parallel)*

- [ ] 02-04-PLAN.md — LoginScreen (2-step OTP login) + apiFetch wrapper + OtpInput + ResendTimer
- [ ] 02-05-PLAN.md — OnboardingScreen (5-step registration) + StepDots + CondoSearch + ChannelSelector + CourierRegisterScreen

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

**Plans**: TBD
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

**Plans**: TBD
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

**Plans**: TBD
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

**Plans**: TBD
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

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete   | 2026-06-13 |
| 2. Authentication | 0/5 | Not started | - |
| 3. Credits & Commerce | 0/TBD | Not started | - |
| 4. Scheduling | 0/TBD | Not started | - |
| 5. Delivery Experience | 0/TBD | Not started | - |
| 6. Courier App | 0/TBD | Not started | - |
| 7. Admin Panel | 0/TBD | Not started | - |
