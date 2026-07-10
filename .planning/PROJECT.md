# Cheirin de Pão

## Current Milestone: v1.1 Experiência Completa do Cliente

**Goal:** Fechar o loop de valor do cliente — pagamento funcional, rastreamento de entregas, configurações de conta, cartões salvos e agendamentos múltiplos — com melhorias operacionais para Admin e Entregador.

**Target features:**
- Conclusão das Fases 3 e 5 pendentes do v1.0 (pagamentos/webhooks MP + rastreamento/notificações)
- Admin: adição manual de créditos a clientes com notificação push no estilo Cheirin de Pão
- Cliente: tela de configurações completa (dados pessoais, condomínio, cartões salvos, logout)
- Cliente/Compra: fluxo com cartão salvo (escolher salvo, cadastrar novo, ou compra única)
- Admin/Condomínios: gestão de horários de entrega por condomínio (padrão 06:30 e 15:30)
- Cliente/Agenda: suporte a múltiplos horários de entrega no mesmo dia (qty por slot por dia)
- Entregador + Admin: botão de logout

## What This Is

PWA (Progressive Web App) de entrega recorrente de pãezinhos em condomínios, baseado em sistema de créditos. O cliente compra combos de pãezinhos que viram créditos, monta uma agenda semanal personalizada e os pãezinhos chegam na porta toda manhã. Três perfis: Cliente (compra, agenda, acompanha), Entregador (rota e confirmação de entrega) e Admin (operação completa — pedido ao fornecedor, financeiro, gestão).

## Core Value

O cliente configura a agenda uma vez e os pãezinhos chegam todo dia sem que ele precise fazer nada — o sistema cuida dos créditos, dos agendamentos e das notificações automaticamente.

## Requirements

### Validated

#### Infraestrutura Base (Validado em Phase 1: Foundation)
- [x] Monorepo Turborepo com apps/web (React+Vite PWA), apps/api (Fastify+Prisma), packages/shared (Zod schemas)
- [x] Dev Container configurado (VS Code + Docker Compose)
- [x] TypeScript ponta a ponta (frontend + backend + shared)
- [x] Prisma com MongoDB Atlas — 15 collections (schema gerado, validate passa)

#### Schema v1.1 + Crédito Manual + Logout (Validado em Phase 10)
- [x] Schema v1.1 aplicado: ADMIN_GRANT/CREDIT_GRANTED, adminId/reason em CreditTransaction, mpCustomerId em User, model SavedCard, deliverySlots em Condominium, days em Schedule
- [x] Endpoint POST /admin/clients/:id/grant-credits com transação atômica, push OneSignal e notificação in-app
- [x] Logout em todos os perfis: admin (dialog), entregador (direto), cliente (via configurações)
- [x] Suporte a CREDIT_GRANTED na NotificationsScreen (tom gold, ícone coin, deep link home)

#### PWA Base (Validado em Phase 1: Foundation)
- [x] PWA instalável — VitePWA injectManifest, manifest.webmanifest servido, SW registrado
- [x] SplashScreen com prompt de instalação (Android: banner nativo; iOS: bottom sheet 3 passos)
- [x] Fontsource (Bricolage Grotesque + Hanken Grotesk) — offline-safe, sem Google CDN

### Active

#### Infraestrutura e Base
- [ ] Monorepo Turborepo com apps/web (React+Vite PWA), apps/api (Fastify+Prisma), packages/shared (Zod schemas)
- [ ] Dev Container configurado (VS Code + Docker Compose)
- [ ] TypeScript ponta a ponta (frontend + backend + shared)
- [ ] Prisma com MongoDB Atlas — 15 collections

#### PWA e Instalação
- [ ] PWA instalável (Android: banner nativo; iOS 16.4+: instruções passo a passo)
- [ ] Notificações push via OneSignal (iOS requer PWA instalado)
- [ ] Prompt de instalação sempre que fora do modo PWA

#### Autenticação (3 perfis)
- [ ] Login sem senha — código OTP via SMS ou e-mail
- [ ] Cadastro de cliente em 5 passos (dados, contato, condomínio, endereço, verificação OTP)
- [ ] Sessão permanente — expira após 90 dias de inatividade ou troca de dispositivo
- [ ] Entregador e Admin cadastrados pelo Admin

#### Sistema de Créditos (Cliente)
- [ ] Compra de combos configuráveis (nome, qtd, preço definidos pelo Admin)
- [ ] Compra personalizada (avulsa) com limite máximo e preço unitário maior definidos pelo Admin
- [ ] Créditos não expiram — ficam no saldo até serem consumidos em entregas realizadas
- [ ] Compra recorrente automática: semanal ou quando estiver acabando
- [ ] Alerta de crédito insuficiente com opção de comprar ou ajustar agendamento

#### Agendamentos (Cliente)
- [ ] Pedido único (avulso) — data específica e quantidade escolhida
- [ ] Agendamento semanal personalizado — quantidade por dia da semana (0 = sem entrega)
- [ ] Recorrência automática semanal até o cliente alterar ou desativar
- [ ] Notificação opcional de reconfiguração semanal (domingo à noite)
- [ ] Créditos reservados imediatamente ao agendar

#### Acompanhamento e Notificações (Cliente)
- [ ] Status da entrega em 3 estados: Agendado → Saiu para entrega → Entregue
- [ ] Notificação push na véspera (lembrete) e na entrega (confirmação)
- [ ] Histórico de pedidos — últimos 30 dias
- [ ] Central de notificações no app

#### Pagamentos
- [ ] Pix e cartão (crédito/débito) via Mercado Pago

#### Perfil Entregador
- [ ] Lista de entregas do dia agrupada por condomínio (bloco/torre, apto, qtd, nome)
- [ ] Confirmação manual de cada entrega (check)
- [ ] Rota com mapa (OpenStreetMap + Leaflet + OSRM) — ordem de paradas entre condomínios

#### Perfil Admin — Operação
- [ ] Horário de corte configurável — bloqueia novos pedidos para o dia seguinte após o horário
- [ ] Geração do pedido de compra ao fornecedor (total de pães, divisão entre fornecedores)
- [ ] Ajuste de quantidades antes de finalizar o pedido (margem de segurança)
- [ ] Download do relatório em PDF e Excel
- [ ] Dashboard de entregas do dia + histórico

#### Perfil Admin — Gestão
- [ ] CRUD de condomínios (entrada única ou blocos/torres)
- [ ] CRUD de combos + promoções e descontos temporários
- [ ] Configuração da compra personalizada (limite máximo + preço unitário)
- [ ] CRUD de fornecedores (CNPJ, contato, preço do pão)
- [ ] CRUD de entregadores + ativar/desativar + divisão de entregas
- [ ] Painel de clientes (visualização + filtro por condomínio + bloquear/desbloquear)
- [ ] Gestão de pagamentos (lista + status + estorno/reembolso)
- [ ] Financeiro por período (dia/semana/mês), por tipo (combos vs avulso) e por condomínio

#### Design e UI
- [ ] Implementação fiel ao design handoff (tema CLARO creme, Home variação A "Carteira")
- [ ] Design tokens: Bricolage Grotesque + Hanken Grotesk, paleta espresso/dourado/creme
- [ ] 12 telas do Cliente + 2 do Entregador + 11 do Admin

### Out of Scope

- Tema escuro — definido para fase futura, fora do escopo inicial
- Home variações B e C — apenas variação A "Carteira" implementada
- Entregadores externos — MVP usa apenas os próprios donos como entregadores
- App nativo (iOS/Android via loja) — distribuição por link, sem loja

## Context

- Documentação completa em `.projeto/` — requisitos v01, modelo de funcionamento e design handoff em JSX+HTML
- Design handoff em alta fidelidade em `.projeto/design_handoff_cheirin_pao/` com todos os componentes, tokens e comportamentos
- Protótipo de referência pode ser aberto em `Cheirin de Pão - App.html` (servidor estático)
- Cada fase deve entregar um bloco funcional testável — o usuário testa manualmente ao final de cada fase

## Constraints

- **Stack Frontend**: React + Vite + Tailwind CSS + Zod — definido e não revisitável
- **Stack Backend**: Node.js + Fastify + Prisma + MongoDB Atlas — definido e não revisitável
- **Monorepo**: Turborepo com npm workspaces — estrutura de pasta já especificada
- **Banco**: MongoDB Atlas remoto (não local) — tanto em dev quanto em produção
- **Pagamentos**: Mercado Pago exclusivamente (Pix + cartão)
- **Push**: OneSignal (gratuito, suporte nativo a PWA)
- **Mapas**: OpenStreetMap + Leaflet + OSRM (gratuito, open source)
- **Autenticação**: Sem senha — apenas OTP via SMS/e-mail
- **Hospedagem**: VPS (DigitalOcean ou Hostinger) com Docker + Nginx + Let's Encrypt
- **Fidelidade de Design**: Alta fidelidade — cores, tipografia e espaçamentos definidos no handoff são mandatórios

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| PWA em vez de app nativo | Sem loja, distribuição por link, menor custo, suporte iOS 16.4+ | — Pending |
| Sistema de créditos em vez de assinatura | Flexibilidade de consumo sem compromisso recorrente obrigatório | — Pending |
| Sem senha (OTP) | Reduz fricção de cadastro, elimina esquecimento de senha | — Pending |
| Monorepo Turborepo | Compartilhamento de Zod schemas e tipos entre frontend e backend | — Pending |
| MongoDB Atlas remoto em dev | Consistência dev/prod, sem configuração de banco local | — Pending |
| Créditos não expiram | Reduz ansiedade de compra, incentiva compra em quantidade | — Pending |

## Evolution

Este documento evolui a cada transição de fase e a cada milestone.

**Após cada transição de fase** (via `/gsd-transition`):
1. Requisitos invalidados? → Mover para Out of Scope com motivo
2. Requisitos validados? → Mover para Validated com referência da fase
3. Novos requisitos emergiram? → Adicionar em Active
4. Decisões a registrar? → Adicionar em Key Decisions
5. "What This Is" ainda preciso? → Atualizar se divergiu

**Após cada milestone** (via `/gsd:complete-milestone`):
1. Revisão completa de todas as seções
2. Verificação do Core Value — ainda é a prioridade certa?
3. Auditoria do Out of Scope — motivos ainda válidos?
4. Atualizar Context com o estado atual

---
*Last updated: 2026-06-18 — Milestone v1.1 Experiência Completa do Cliente iniciado*
