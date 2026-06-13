# Requirements: Cheirin de Pão

**Defined:** 2026-06-13
**Core Value:** O cliente configura a agenda uma vez e os pãezinhos chegam todo dia sem que ele precise fazer nada — o sistema cuida dos créditos, dos agendamentos e das notificações automaticamente.

---

## v1 Requirements

### Infraestrutura e Base (INFRA)

- [ ] **INFRA-01**: Monorepo Turborepo configurado com apps/web, apps/api e packages/shared
- [ ] **INFRA-02**: Dev Container funcional (VS Code + Docker Compose) com Node.js e TypeScript
- [ ] **INFRA-03**: TypeScript ponta a ponta — frontend, backend e shared
- [ ] **INFRA-04**: Prisma com adapter MongoDB configurado com as 15 collections do schema
- [ ] **INFRA-05**: packages/shared exporta Zod schemas, tipos TypeScript e constantes compartilhadas
- [ ] **INFRA-06**: Variáveis de ambiente configuradas (.env.example documentado)
- [ ] **INFRA-07**: Conexão com MongoDB Atlas funcional em ambiente de desenvolvimento

### PWA e Instalação (PWA)

- [ ] **PWA-01**: App funciona como PWA instalável — manifest.json e service worker configurados
- [ ] **PWA-02**: Android: botão "Instalar app" dispara janela nativa de instalação do navegador
- [ ] **PWA-03**: iOS (16.4+): banner com instrução visual passo a passo (⬆ → Adicionar à Tela Inicial)
- [ ] **PWA-04**: Prompt de instalação exibido sempre que o app for acessado fora do modo PWA instalado
- [ ] **PWA-05**: Notificações push configuradas via OneSignal (iOS requer PWA instalado previamente)

### Autenticação (AUTH)

- [ ] **AUTH-01**: Cliente pode se cadastrar em 5 passos: Dados → Contato → Condomínio → Endereço → Verificação OTP
- [ ] **AUTH-02**: Cadastro exige nome completo, CPF, data de nascimento, pelo menos telefone ou e-mail, condomínio e apartamento
- [ ] **AUTH-03**: Bloco/Torre obrigatório apenas se o condomínio for do tipo blocos/torres
- [ ] **AUTH-04**: Canal de confirmação automático — SMS se tiver telefone, e-mail se cadastrou apenas e-mail
- [ ] **AUTH-05**: Login sem senha — usuário recebe código OTP (4 dígitos) via SMS ou e-mail
- [ ] **AUTH-06**: Sessão permanente após primeiro login — novo código solicitado apenas em troca de dispositivo, limpeza do navegador ou após 90 dias de inatividade
- [ ] **AUTH-07**: Entregador cadastrado pelo Admin (não faz auto-cadastro)
- [ ] **AUTH-08**: Admin faz login com OTP — sem cadastro público

### Sistema de Créditos (CRED)

- [ ] **CRED-01**: Cliente pode comprar combos de pãezinhos — cada combo vira créditos no saldo
- [ ] **CRED-02**: Combos configuráveis pelo Admin (nome, quantidade de pãezinhos, preço)
- [ ] **CRED-03**: Cliente pode fazer compra personalizada (avulsa) para quantidades abaixo do limite definido pelo Admin
- [ ] **CRED-04**: Preço unitário da compra personalizada é maior que o do combo (configurado pelo Admin) — incentiva combo
- [ ] **CRED-05**: Admin define limite máximo da compra personalizada (ex: abaixo de 20 pães) e preço unitário
- [ ] **CRED-06**: Créditos não expiram — permanecem no saldo até serem consumidos em entregas realizadas
- [ ] **CRED-07**: Cliente pode ativar compra recorrente automática — modalidade "quando estiver acabando" ou "toda semana"
- [ ] **CRED-08**: Compra automática "toda semana" tem seletor de dia da semana e combo a repor
- [ ] **CRED-09**: Se créditos insuficientes e sem compra automática, sistema notifica com opção de comprar combo ou ajustar agendamento
- [ ] **CRED-10**: Se créditos insuficientes e com compra automática, combo é comprado automaticamente e cliente recebe confirmação
- [ ] **CRED-11**: Saldo de créditos exibido na tela principal como número de pãezinhos disponíveis

### Agendamentos (SCHED)

- [ ] **SCHED-01**: Cliente pode criar pedido único (avulso) — escolhe data e quantidade; créditos reservados imediatamente
- [ ] **SCHED-02**: Cliente pode configurar agendamento semanal personalizado — define quantidade por dia (0 = sem entrega)
- [ ] **SCHED-03**: Agendamento semanal repete automaticamente toda semana até o cliente alterar ou desativar
- [ ] **SCHED-04**: Cliente pode ativar notificação de reconfiguração semanal (domingo à noite lembra de ajustar semana seguinte)
- [ ] **SCHED-05**: Se créditos insuficientes para cobrir o agendamento, banner de alerta exibido com opções de ação
- [ ] **SCHED-06**: Tela de agenda semanal exibe consumo semanal total e cobertura de créditos

### Acompanhamento de Entrega e Histórico (ACOMP)

- [ ] **ACOMP-01**: Status da entrega do dia em 3 estados: Agendado → Saiu para entrega → Entregue
- [ ] **ACOMP-02**: Notificação push na véspera lembrando da entrega agendada para o dia seguinte
- [ ] **ACOMP-03**: Notificação push confirmando quando a entrega foi realizada
- [ ] **ACOMP-04**: Histórico de pedidos — últimos 30 dias com data, quantidade e status
- [ ] **ACOMP-05**: Central de notificações no app com cards por tipo e indicação de itens novos

### Pagamentos (PAY)

- [ ] **PAY-01**: Cliente pode pagar via Pix (Mercado Pago)
- [ ] **PAY-02**: Cliente pode pagar via cartão de crédito ou débito (Mercado Pago)
- [ ] **PAY-03**: Status de pagamento disponível no painel Admin (pago/pendente/falhou)
- [ ] **PAY-04**: Admin pode estornar ou reembolsar pagamentos

### Entregador (COUR)

- [ ] **COUR-01**: Entregador acessa lista de entregas do dia agrupada por condomínio (bloco/torre, apto, qtd, nome do cliente)
- [ ] **COUR-02**: Entregador confirma cada entrega com check manual (toque na parada)
- [ ] **COUR-03**: Entregador visualiza mapa com ordem de paradas entre condomínios (OpenStreetMap + Leaflet + OSRM)
- [ ] **COUR-04**: Sistema exibe ordem sugerida de apartamentos dentro de cada condomínio
- [ ] **COUR-05**: Card de progresso exibe paradas feitas/total e total de pães

### Admin — Operação (ADMO)

- [ ] **ADMO-01**: Admin configura horário de corte diário — bloqueia novos pedidos para o dia seguinte após o horário
- [ ] **ADMO-02**: Clientes que não agendaram recebem notificação ao atingir o horário de corte
- [ ] **ADMO-03**: App exibe aviso ao cliente quando o prazo para o dia seguinte encerrou
- [ ] **ADMO-04**: Admin visualiza lista completa de entregas do dia por condomínio, bloco e apartamento após o corte
- [ ] **ADMO-05**: Admin gera pedido de compra ao fornecedor (calcula total de pães dos agendamentos)
- [ ] **ADMO-06**: Admin pode ajustar quantidades antes de finalizar o pedido (margem de segurança, arredondamento)
- [ ] **ADMO-07**: Admin escolhe fornecedor principal e pode dividir o pedido entre múltiplos fornecedores
- [ ] **ADMO-08**: Relatório de pedido ao fornecedor disponível para download em PDF e Excel
- [ ] **ADMO-09**: Pedido salvo no histórico para consulta futura
- [ ] **ADMO-10**: Dashboard de entregas — totais por dia, por condomínio e por entregador
- [ ] **ADMO-11**: Sistema sugere divisão automática de entregas entre entregadores; Admin aprova antes de iniciar

### Admin — Gestão (ADMG)

- [ ] **ADMG-01**: Admin faz CRUD de condomínios — define nome, endereço e tipo (entrada única ou blocos/torres)
- [ ] **ADMG-02**: Admin faz CRUD de combos — nome, quantidade de pãezinhos, preço
- [ ] **ADMG-03**: Admin aplica promoções e descontos temporários a combos (percentual ou valor fixo)
- [ ] **ADMG-04**: Admin configura compra personalizada — limite máximo de quantidade e preço unitário
- [ ] **ADMG-05**: Admin faz CRUD de fornecedores — nome, CNPJ, telefone, e-mail, endereço, preço do pão
- [ ] **ADMG-06**: Admin faz CRUD de entregadores — nome, CPF, telefone, e-mail
- [ ] **ADMG-07**: Admin ativa ou desativa entregadores temporariamente sem removê-los
- [ ] **ADMG-08**: Admin visualiza lista de clientes com saldo de créditos, condomínio, apartamento, última compra
- [ ] **ADMG-09**: Admin filtra clientes por condomínio
- [ ] **ADMG-10**: Admin bloqueia e desbloqueia clientes
- [ ] **ADMG-11**: Admin visualiza histórico de agendamentos e entregas de cada cliente (somente leitura)

### Admin — Financeiro (ADMF)

- [ ] **ADMF-01**: Admin visualiza receita por dia, semana e mês
- [ ] **ADMF-02**: Admin filtra receita por condomínio
- [ ] **ADMF-03**: Admin visualiza receita separada por tipo: combos vs compra personalizada
- [ ] **ADMF-04**: Admin visualiza lista de todos os pagamentos recebidos com detalhes

### Design e UI (UI)

- [ ] **UI-01**: Design fiel ao handoff — tema CLARO creme com tokens de cores, tipografia e espaçamentos definidos
- [ ] **UI-02**: Fontes Bricolage Grotesque (títulos/números) e Hanken Grotesk (texto/UI) via Google Fonts
- [ ] **UI-03**: Símbolo BreadMark implementado como componente SVG inline
- [ ] **UI-04**: Home Cliente — variação A "Carteira" com saldo grande em card espresso, entrega de hoje, ações rápidas e próximas entregas
- [ ] **UI-05**: Tela Splash/Install com fundo espresso, símbolo dourado e CTA de instalação
- [ ] **UI-06**: OTP com 4 inputs — avanço automático de foco entre dígitos
- [ ] **UI-07**: Stepper de quantidade com min/max respeitados (agenda semanal, pedido único, compra personalizada)
- [ ] **UI-08**: Tab bar do Cliente: Início / Agenda / Créditos / Pedidos
- [ ] **UI-09**: Navegação inferior do Admin com 5 itens: Painel / Pedido / Entregas / Clientes / Gestão
- [ ] **UI-10**: Hit targets mínimos de 44px em todos os elementos interativos

---

## v2 Requirements

### Tema Escuro
- **DARK-01**: Implementação do tema escuro com tokens `THEMES.dark` do design handoff

### Entregadores Externos
- **EXT-01**: Suporte a entregadores externos (fora da equipe do dono)
- **EXT-02**: Auto-cadastro de entregadores com fluxo de aprovação pelo Admin

### App Nativo
- **NATIVE-01**: Publicação em lojas (Google Play / Apple App Store)

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Tema escuro | Explicitamente fora do escopo inicial no design handoff — fase futura |
| Home variações B e C | Apenas variação A "Carteira" definida para implementação |
| Entregadores externos | MVP usa apenas os próprios donos — suporte externo será adicionado depois |
| App nativo (loja) | PWA com distribuição por link — sem necessidade de loja no MVP |
| MongoDB local em dev | Usa Atlas remoto tanto em dev quanto em produção — por consistência |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 — Foundation | Pending |
| INFRA-02 | Phase 1 — Foundation | Pending |
| INFRA-03 | Phase 1 — Foundation | Pending |
| INFRA-04 | Phase 1 — Foundation | Pending |
| INFRA-05 | Phase 1 — Foundation | Pending |
| INFRA-06 | Phase 1 — Foundation | Pending |
| INFRA-07 | Phase 1 — Foundation | Pending |
| PWA-01 | Phase 1 — Foundation | Pending |
| PWA-02 | Phase 1 — Foundation | Pending |
| PWA-03 | Phase 1 — Foundation | Pending |
| PWA-04 | Phase 1 — Foundation | Pending |
| PWA-05 | Phase 1 — Foundation | Pending |
| UI-01 | Phase 1 — Foundation | Pending |
| UI-02 | Phase 1 — Foundation | Pending |
| UI-03 | Phase 1 — Foundation | Pending |
| UI-05 | Phase 1 — Foundation | Pending |
| UI-10 | Phase 1 — Foundation | Pending |
| AUTH-01 | Phase 2 — Authentication | Pending |
| AUTH-02 | Phase 2 — Authentication | Pending |
| AUTH-03 | Phase 2 — Authentication | Pending |
| AUTH-04 | Phase 2 — Authentication | Pending |
| AUTH-05 | Phase 2 — Authentication | Pending |
| AUTH-06 | Phase 2 — Authentication | Pending |
| AUTH-07 | Phase 2 — Authentication | Pending |
| AUTH-08 | Phase 2 — Authentication | Pending |
| UI-06 | Phase 2 — Authentication | Pending |
| CRED-01 | Phase 3 — Credits & Commerce | Pending |
| CRED-02 | Phase 3 — Credits & Commerce | Pending |
| CRED-03 | Phase 3 — Credits & Commerce | Pending |
| CRED-04 | Phase 3 — Credits & Commerce | Pending |
| CRED-05 | Phase 3 — Credits & Commerce | Pending |
| CRED-06 | Phase 3 — Credits & Commerce | Pending |
| CRED-07 | Phase 3 — Credits & Commerce | Pending |
| CRED-08 | Phase 3 — Credits & Commerce | Pending |
| CRED-09 | Phase 3 — Credits & Commerce | Pending |
| CRED-10 | Phase 3 — Credits & Commerce | Pending |
| CRED-11 | Phase 3 — Credits & Commerce | Pending |
| PAY-01 | Phase 3 — Credits & Commerce | Pending |
| PAY-02 | Phase 3 — Credits & Commerce | Pending |
| UI-04 | Phase 3 — Credits & Commerce | Pending |
| UI-07 | Phase 3 — Credits & Commerce | Pending |
| UI-08 | Phase 3 — Credits & Commerce | Pending |
| SCHED-01 | Phase 4 — Scheduling | Pending |
| SCHED-02 | Phase 4 — Scheduling | Pending |
| SCHED-03 | Phase 4 — Scheduling | Pending |
| SCHED-04 | Phase 4 — Scheduling | Pending |
| SCHED-05 | Phase 4 — Scheduling | Pending |
| SCHED-06 | Phase 4 — Scheduling | Pending |
| ACOMP-01 | Phase 5 — Delivery Experience | Pending |
| ACOMP-02 | Phase 5 — Delivery Experience | Pending |
| ACOMP-03 | Phase 5 — Delivery Experience | Pending |
| ACOMP-04 | Phase 5 — Delivery Experience | Pending |
| ACOMP-05 | Phase 5 — Delivery Experience | Pending |
| PAY-03 | Phase 5 — Delivery Experience | Pending |
| PAY-04 | Phase 5 — Delivery Experience | Pending |
| COUR-01 | Phase 6 — Courier App | Pending |
| COUR-02 | Phase 6 — Courier App | Pending |
| COUR-03 | Phase 6 — Courier App | Pending |
| COUR-04 | Phase 6 — Courier App | Pending |
| COUR-05 | Phase 6 — Courier App | Pending |
| ADMO-01 | Phase 7 — Admin Panel | Pending |
| ADMO-02 | Phase 7 — Admin Panel | Pending |
| ADMO-03 | Phase 7 — Admin Panel | Pending |
| ADMO-04 | Phase 7 — Admin Panel | Pending |
| ADMO-05 | Phase 7 — Admin Panel | Pending |
| ADMO-06 | Phase 7 — Admin Panel | Pending |
| ADMO-07 | Phase 7 — Admin Panel | Pending |
| ADMO-08 | Phase 7 — Admin Panel | Pending |
| ADMO-09 | Phase 7 — Admin Panel | Pending |
| ADMO-10 | Phase 7 — Admin Panel | Pending |
| ADMO-11 | Phase 7 — Admin Panel | Pending |
| ADMG-01 | Phase 7 — Admin Panel | Pending |
| ADMG-02 | Phase 7 — Admin Panel | Pending |
| ADMG-03 | Phase 7 — Admin Panel | Pending |
| ADMG-04 | Phase 7 — Admin Panel | Pending |
| ADMG-05 | Phase 7 — Admin Panel | Pending |
| ADMG-06 | Phase 7 — Admin Panel | Pending |
| ADMG-07 | Phase 7 — Admin Panel | Pending |
| ADMG-08 | Phase 7 — Admin Panel | Pending |
| ADMG-09 | Phase 7 — Admin Panel | Pending |
| ADMG-10 | Phase 7 — Admin Panel | Pending |
| ADMG-11 | Phase 7 — Admin Panel | Pending |
| ADMF-01 | Phase 7 — Admin Panel | Pending |
| ADMF-02 | Phase 7 — Admin Panel | Pending |
| ADMF-03 | Phase 7 — Admin Panel | Pending |
| ADMF-04 | Phase 7 — Admin Panel | Pending |
| UI-09 | Phase 7 — Admin Panel | Pending |

**Coverage:**
- v1 requirements: 87 total
- Mapped to phases: 87
- Unmapped: 0 ✓

**Phase Distribution:**
| Phase | Requirements | Count |
|-------|-------------|-------|
| Phase 1 — Foundation | INFRA-01..07, PWA-01..05, UI-01, UI-02, UI-03, UI-05, UI-10 | 17 |
| Phase 2 — Authentication | AUTH-01..08, UI-06 | 9 |
| Phase 3 — Credits & Commerce | CRED-01..11, PAY-01..02, UI-04, UI-07, UI-08 | 16 |
| Phase 4 — Scheduling | SCHED-01..06 | 6 |
| Phase 5 — Delivery Experience | ACOMP-01..05, PAY-03..04 | 7 |
| Phase 6 — Courier App | COUR-01..05 | 5 |
| Phase 7 — Admin Panel | ADMO-01..11, ADMG-01..11, ADMF-01..04, UI-09 | 27 |

---
*Requirements defined: 2026-06-13*
*Last updated: 2026-06-13 — traceability completa após criação do roadmap*
