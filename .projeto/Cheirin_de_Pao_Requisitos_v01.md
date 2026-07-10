# 🍞 Cheirin de Pão

## Levantamento de Requisitos — App (PWA)

**Versão 0.1 • Junho 2026**

---

## 1. Visão Geral

Este documento registra o levantamento de requisitos do aplicativo do Cheirin de Pão. Todos os pontos funcionais, técnicos e de design estão definidos e o desenvolvimento pode ser iniciado.

**Legenda de status:**

- ✔ Definido — decisão tomada, não será revisitada
- ⏳ Pendente — precisa de mais informação ou reflexão
- ○ Em aberto — ainda não discutido

---

## 2. Plataforma e Tecnologia

### 2.1 Tipo de aplicação

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Tipo de app** | PWA (Progressive Web App) | ✔ Definido |
| **Compatibilidade** | Android e iPhone (iOS 16.4+) | ✔ Definido |
| **Distribuição** | Sem loja — acesso direto por link | ✔ Definido |

### 2.2 Instalação

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Android** | Botão 'Instalar app' que dispara janela nativa do navegador | ✔ Definido |
| **iPhone (iOS)** | Banner com instrução visual passo a passo (toque em ⬆ → Adicionar à Tela Inicial) | ✔ Definido |
| **Frequência do prompt** | Exibir sempre que acessar fora do PWA instalado, em dispositivo Android ou iPhone | ✔ Definido |
| **Notificações push** | Suportadas. No iOS, requer instalação prévia do PWA. | ✔ Definido |

---

## 3. Entidades do Sistema

### 3.1 Condomínios

O condomínio é a entidade central que conecta clientes, entregadores e admin. Todo o fluxo de entrega é organizado por condomínio.

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Pré-cadastro obrigatório** | Somente condomínios cadastrados pelo admin recebem o serviço | ✔ Definido |
| **Quem cadastra** | Admin cadastra os condomínios disponíveis | ✔ Definido |
| **Vínculo do cliente** | No cadastro, o cliente informa a qual condomínio pertence | ✔ Definido |
| **Condomínio indisponível** | Cliente não consegue concluir cadastro se o condomínio não estiver cadastrado | ✔ Definido |
| **Dados do condomínio** | Nome, endereço. Admin define se possui blocos/torres ou entrada única | ✔ Definido |
| **Tipo: entrada única** | Cliente informa apenas o número do apartamento | ✔ Definido |
| **Tipo: blocos/torres** | Cliente informa o bloco/torre + número do apartamento | ✔ Definido |
| **Múltiplos clientes por condomínio** | Sim — vários clientes podem pertencer ao mesmo condomínio | ✔ Definido |
| **Múltiplos entregadores por condomínio** | Sim — possível dividir entregas de um condomínio entre entregadores | ✔ Definido |

### 3.2 Fornecedores

Fornecedores são as padarias ou fábricas que fornecem os pãezinhos. O admin cadastra e gerencia fornecedores, e gera pedidos de compra diários com base nos agendamentos dos clientes.

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Pré-cadastro obrigatório** | Fornecedores devem ser cadastrados pelo admin antes de gerar pedidos | ✔ Definido |
| **Dados do fornecedor** | Nome, CNPJ, telefone, e-mail, endereço e preço do pão | ✔ Definido |
| **Múltiplos fornecedores** | Pedido do dia pode ser dividido entre vários fornecedores | ✔ Definido |

### 3.3 Perfis de Usuário

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Perfis existentes** | Cliente, Entregador, Admin (dono) | ✔ Definido |
| **Autenticação** | E-mail ou telefone (a escolha do usuário) | ✔ Definido |
| **Cadastro de cliente** | Nome, CPF, data nasc., telefone e/ou e-mail, condomínio, apto — ver seção 4.1 | ✔ Definido |
| **Cadastro de entregador** | Nome, CPF, telefone, e-mail — cadastrado pelo admin | ✔ Definido |

---

## 4. Funcionalidades por Perfil

Cada perfil será detalhado em sessão própria. As seções abaixo registram o que já foi definido como base inicial.

### 4.1 Perfil: Cliente

#### Modelo de uso

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Tipo de usuário** | Cliente (não necessariamente assinante) | ✔ Definido |
| **Pedido avulso** | Cliente pode fazer agendamentos únicos sem configurar recorrência | ✔ Definido |
| **Modelo de assinatura** | Substituído pelo sistema de créditos (combos) + agendamentos personalizados | ✔ Definido |
| **Sistema de créditos** | Cliente compra combos que viram créditos, consumidos nos agendamentos | ✔ Definido |

#### Cadastro — Dados coletados

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Nome completo** | Obrigatório | ✔ Definido |
| **CPF** | Obrigatório | ✔ Definido |
| **Data de nascimento** | Obrigatório | ✔ Definido |
| **Telefone** | Opcional — mas pelo menos telefone ou e-mail é obrigatório | ✔ Definido |
| **E-mail** | Opcional — mas pelo menos telefone ou e-mail é obrigatório | ✔ Definido |
| **Condomínio** | Obrigatório — selecionado na lista de condomínios cadastrados | ✔ Definido |
| **Bloco/Torre** | Obrigatório apenas se o condomínio for do tipo blocos/torres | ✔ Definido |
| **Apartamento** | Obrigatório | ✔ Definido |

#### Cadastro — Confirmação e autenticação

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Confirmação de cadastro** | Via código de verificação | ✔ Definido |
| **Canal de confirmação** | SMS se tiver telefone; e-mail se cadastrou apenas e-mail | ✔ Definido |
| **Login futuro** | E-mail ou telefone (a escolha do usuário no momento do login) | ✔ Definido |
| **Senha** | Sem senha — login via código de verificação (SMS ou e-mail) | ✔ Definido |
| **Sessão** | Permanente após primeiro login — só solicita novo código se trocar dispositivo, limpar navegador ou sessão expirar | ✔ Definido |
| **Expiração da sessão** | 90 dias de inatividade | ✔ Definido |

#### Funcionalidades — Sistema de Créditos (Combos)

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Compra de créditos via combo** | Cliente compra combos de pãezinhos que viram créditos na plataforma | ✔ Definido |
| **Compra personalizada (avulsa)** | Cliente pode comprar quantidade personalizada abaixo do limite definido pelo admin | ✔ Definido |
| **Limite da compra personalizada** | Admin define a quantidade máxima para compra personalizada (ex: abaixo de 20 pães) | ✔ Definido |
| **Preço personalizado vs combo** | Preço unitário da compra personalizada é mais caro que o do combo — incentiva compra em quantidade | ✔ Definido |
| **Combos configuráveis** | Admin define nome, quantidade e preço dos combos | ✔ Definido |
| **Uso dos créditos** | Consumidos em pedidos únicos ou distribuídos nos agendamentos semanais | ✔ Definido |
| **Compra recorrente automática** | Semanal ou quando estiver para acabar (opcional, ativado pelo cliente) | ✔ Definido |
| **Alerta de crédito insuficiente** | Notificação quando há agendamento sem créditos suficientes, com opção de compra | ✔ Definido |
| **Expiração dos créditos** | Não expiram — créditos permanecem no saldo até serem consumidos | ✔ Definido |

#### Funcionalidades — Agendamentos

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Pedido único (avulso)** | Cliente agenda entrega para data específica com quantidade escolhida | ✔ Definido |
| **Agendamento semanal personalizado** | Cliente configura quantidade de pãezinhos para cada dia da semana individualmente | ✔ Definido |
| **Dias sem entrega** | Cliente pode deixar dias da semana sem entrega na configuração | ✔ Definido |
| **Recorrência automática** | Agendamento semanal se repete até o cliente alterar ou desativar | ✔ Definido |
| **Notificação de reconfiguração** | Opcional — lembra o cliente de ajustar quantidades para a semana seguinte | ✔ Definido |
| **Reserva de créditos** | Créditos reservados no momento do agendamento | ✔ Definido |

#### Funcionalidades — Gerais

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Status da entrega do dia** | Três estados: Agendado → Saiu para entrega → Entregue | ✔ Definido |
| **Histórico de pedidos** | Exibe data, quantidade e status (entregue/não entregue) — últimos 30 dias | ✔ Definido |
| **Notificação push — lembrete** | Notificação na véspera lembrando da entrega agendada para o dia seguinte | ✔ Definido |
| **Notificação push — entrega** | Notificação quando a entrega for realizada | ✔ Definido |
| **Forma de pagamento** | Pix e cartão (crédito/débito) | ✔ Definido |
| **Saldo de créditos** | Tela principal exibe apenas o número de pãezinhos disponíveis | ✔ Definido |

### 4.2 Perfil: Entregador

#### Contexto operacional

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Entregadores atuais** | Os próprios donos — sem entregadores externos no MVP | ✔ Definido |
| **Estrutura futura** | Suporte a entregadores externos será adicionado depois | ✔ Definido |
| **Agrupamento de entregas** | Entregador recebe sempre as entregas de um condomínio inteiro (ou mais de um) | ✔ Definido |
| **Múltiplos entregadores** | Possível dividir pedidos de um mesmo condomínio entre entregadores | ✔ Definido |

#### Cadastro

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Complexidade do cadastro** | Simplificado ao máximo no MVP | ✔ Definido |
| **Quem cadastra** | Admin cadastra o entregador | ✔ Definido |
| **Dados do cadastro** | Nome completo, CPF, telefone e e-mail | ✔ Definido |

#### Funcionalidades

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Lista de entregas do dia** | Agrupada por condomínio — exibe bloco/torre, apartamento, quantidade e nome do cliente | ✔ Definido |
| **Confirmar entrega realizada** | Check manual — toque para confirmar cada entrega | ✔ Definido |
| **Separação por entregador** | Sistema sugere divisão automática, admin aprova antes da entrega | ✔ Definido |
| **Rota entre condomínios** | Mapa com ordem de paradas entre os condomínios atribuídos | ✔ Definido |
| **Ordem dentro do prédio** | Ordem sugerida de apartamentos dentro de cada condomínio | ✔ Definido |

### 4.3 Perfil: Admin (Dono)

#### Gestão de Condomínios e Produtos

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Cadastro de condomínios** | Admin pré-cadastra os condomínios atendidos | ✔ Definido |
| **Gestão de combos** | Criar, editar, remover combos de pãezinhos (nome, qtd, preço) | ✔ Definido |
| **Compra personalizada** | Admin define limite máximo de quantidade e preço unitário da compra avulsa | ✔ Definido |
| **Promoções e descontos** | Aplicar preços promocionais ou descontos a combos | ✔ Definido |

#### Painel de Clientes

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Visualização** | Lista com nome, condomínio, apto, saldo de créditos, última compra e histórico de agendamentos/entregas | ✔ Definido |
| **Filtros** | Filtrar clientes por condomínio | ✔ Definido |
| **Interação com cadastro** | Apenas visualização — não edita dados do cliente | ✔ Definido |
| **Bloqueio de cliente** | Admin pode bloquear e desbloquear clientes | ✔ Definido |

#### Gestão de Entregadores

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Cadastrar entregador** | Admin cadastra com nome, CPF, telefone e e-mail | ✔ Definido |
| **Editar entregador** | Admin pode alterar dados do entregador | ✔ Definido |
| **Remover entregador** | Admin pode remover entregadores | ✔ Definido |
| **Ativar/desativar** | Admin pode desativar temporariamente um entregador sem removê-lo | ✔ Definido |
| **Divisão de entregas** | Sistema sugere divisão automática entre entregadores, admin aprova | ✔ Definido |

#### Controle de Entregas

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Lista do dia** | Entregas agendadas vs realizadas, agrupadas por condomínio | ✔ Definido |
| **Histórico de entregas** | Consulta de entregas passadas | ✔ Definido |
| **Dashboard** | Totais de entregas por dia, por condomínio e por entregador | ✔ Definido |

#### Controle Financeiro

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Receita por período** | Visualizar receita por dia, semana e mês | ✔ Definido |
| **Receita por condomínio** | Filtrar receita por condomínio | ✔ Definido |
| **Receita por tipo de compra** | Separar receita de combos vs compra personalizada | ✔ Definido |

#### Gestão de Pagamentos

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Lista de pagamentos** | Todos os pagamentos recebidos com detalhes | ✔ Definido |
| **Status do pagamento** | Exibir status: pago, pendente ou falhou | ✔ Definido |
| **Estorno/reembolso** | Admin pode estornar ou reembolsar pagamentos | ✔ Definido |

#### Gestão de Fornecedores

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Cadastro de fornecedor** | Nome, CNPJ, telefone, e-mail, endereço e preço do pão | ✔ Definido |
| **CRUD completo** | Admin pode cadastrar, editar e remover fornecedores | ✔ Definido |
| **Preço por fornecedor** | Cada fornecedor tem seu preço de pão cadastrado | ✔ Definido |

#### Pedido de Compra ao Fornecedor

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Horário de corte** | Horário único para todos os condomínios, configurável pelo admin | ✔ Definido |
| **Bloqueio após corte** | Após o horário, novos pedidos para o dia seguinte são bloqueados | ✔ Definido |
| **Notificação de corte** | Clientes que não agendaram são notificados + aviso exibido no app | ✔ Definido |
| **Geração do pedido** | Admin gera manualmente após o horário de corte | ✔ Definido |
| **Edição antes de finalizar** | Admin pode ajustar quantidades antes de finalizar o pedido | ✔ Definido |
| **Fornecedor principal** | Admin escolhe um fornecedor principal e só divide entre outros se quiser | ✔ Definido |
| **Divisão entre fornecedores** | Admin pode distribuir manualmente o pedido entre múltiplos fornecedores | ✔ Definido |

#### Relatórios e Listas de Entrega

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Lista de entregas por condomínio** | Disponível após horário de corte — detalhada por bloco/torre e apartamento | ✔ Definido |
| **Relatório de pedido ao fornecedor** | Quantidade total + valor por fornecedor, disponível para download | ✔ Definido |
| **Formato de download** | PDF e Excel (.xlsx) | ✔ Definido |
| **Histórico de pedidos** | Registro de todos os pedidos de compra feitos aos fornecedores | ✔ Definido |

---

## 5. Stack Técnica

### 5.1 Frontend

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Framework** | React com Vite | ✔ Definido |
| **Tipo de aplicação** | PWA (Progressive Web App) | ✔ Definido |
| **Estilização** | Tailwind CSS | ✔ Definido |
| **Validação** | Zod (validação de formulários e dados) | ✔ Definido |

### 5.2 Backend

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Linguagem** | Node.js | ✔ Definido |
| **Framework** | Fastify | ✔ Definido |
| **API** | REST | ✔ Definido |
| **ORM** | Prisma (com adapter MongoDB) | ✔ Definido |
| **Validação** | Zod (validação de payloads e schemas) | ✔ Definido |
| **Arquitetura** | Clean Architecture | ✔ Definido |

### 5.3 Banco de Dados

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Banco principal** | MongoDB | ✔ Definido |
| **Hospedagem do banco** | MongoDB Atlas (cloud gerenciado) | ✔ Definido |
| **ORM** | Prisma (com adapter MongoDB) | ✔ Definido |
| **Total de collections** | 14 collections | ✔ Definido |

**Collections definidas:**

- **USERS** — clientes, entregadores e admins com role-based access
- **CONDOMINIUMS** — condomínios cadastrados (entrada única ou blocos/torres)
- **COMBOS** — pacotes de créditos de pãezinhos
- **PROMOTIONS** — promoções e descontos temporários por combo
- **SETTINGS** — configurações globais (horário de corte, preço avulso, limite personalizado, expiração de sessão)
- **CREDIT_TRANSACTIONS** — toda movimentação de créditos (compra = entrada, entrega = saída)
- **SCHEDULES** — agendamento semanal personalizado por cliente
- **ORDERS** — pedidos unitários (avulsos ou gerados pelo schedule)
- **DELIVERIES** — registro de entrega com confirmação por entregador
- **DELIVERY_LISTS** — lista consolidada por condomínio para entregadores
- **SUPPLIERS** — fornecedores de pãezinhos
- **PURCHASE_ORDERS** — pedidos de compra ao fornecedor (cabeçalho)
- **PURCHASE_ORDER_ITEMS** — itens do pedido separados por fornecedor
- **PAYMENTS** — pagamentos via Mercado Pago (Pix/cartão) com status e estorno
- **NOTIFICATIONS** — fila de notificações por tipo (entrega, lembrete, crédito baixo, corte, reconfiguração)

### 5.4 Infraestrutura e Serviços

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Hospedagem** | VPS (DigitalOcean ou Hostinger) | ✔ Definido |
| **Containerização** | Docker (deploy em containers) | ✔ Definido |
| **Ambiente de desenvolvimento** | Dev Container (VS Code) | ✔ Definido |
| **Gateway de pagamento** | Mercado Pago (Pix + cartão crédito/débito) | ✔ Definido |
| **Notificações push** | OneSignal (gratuito, suporte nativo a PWA) | ✔ Definido |
| **Mapas e rotas** | OpenStreetMap + Leaflet (mapa) + OSRM (cálculo de rotas) — gratuito e open source | ✔ Definido |

### 5.5 Estrutura do Projeto

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Monorepo** | Sim — Turborepo com npm workspaces | ✔ Definido |
| **apps/web** | React + Vite (PWA do cliente, entregador e admin) | ✔ Definido |
| **apps/api** | Fastify + Prisma (API REST) | ✔ Definido |
| **packages/shared** | Zod schemas, tipos Prisma e constantes compartilhadas | ✔ Definido |
| **Linguagem** | TypeScript ponta a ponta (frontend + backend + shared) | ✔ Definido |

### 5.6 Ambiente de Desenvolvimento

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Editor** | VS Code com Dev Containers extension | ✔ Definido |
| **Dev Container** | Configuração pronta com Node.js, TypeScript e ferramentas do projeto | ✔ Definido |
| **Docker Compose (dev)** | Frontend + Backend em containers, MongoDB via Atlas remoto | ✔ Definido |
| **Mongo local** | Não — usa Atlas remoto tanto em dev quanto em produção | ✔ Definido |

### 5.7 Deploy e CI/CD

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Repositório** | GitHub | ✔ Definido |
| **CI/CD** | GitHub Actions — pipeline automatizado de testes e deploy | ✔ Definido |
| **Produção** | Docker Compose na VPS com Nginx como reverse proxy | ✔ Definido |
| **SSL/HTTPS** | Nginx + Let's Encrypt (certificado gratuito) | ✔ Definido |

### 5.8 Estrutura do Repositório

Estrutura de pastas e arquivos do monorepo Turborepo:

```
cheirin-de-pao/
├── apps/
│   ├── web/                        → PWA React + Vite (cliente, entregador, admin)
│   │   ├── public/                  → manifest.json, service-worker, ícones PWA
│   │   ├── src/
│   │   │   ├── components/           → componentes reutilizáveis
│   │   │   ├── pages/                → telas por perfil (client/, delivery/, admin/)
│   │   │   ├── hooks/                → custom hooks
│   │   │   ├── services/             → chamadas à API (fetch/axios)
│   │   │   ├── stores/               → estado global (contextos ou zustand)
│   │   │   ├── routes/               → definição de rotas por perfil
│   │   │   ├── utils/                → funções utilitárias
│   │   │   └── App.tsx
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── api/                         → Backend Fastify + Prisma
│       ├── src/
│       │   ├── modules/              → módulos por domínio (Clean Architecture)
│       │   │   ├── users/            → controller, service, repository, schema
│       │   │   ├── condominiums/
│       │   │   ├── combos/
│       │   │   ├── credits/
│       │   │   ├── schedules/
│       │   │   ├── orders/
│       │   │   ├── deliveries/
│       │   │   ├── suppliers/
│       │   │   ├── purchase-orders/
│       │   │   ├── payments/
│       │   │   └── notifications/
│       │   ├── infra/                → plugins Fastify, middlewares, auth
│       │   ├── config/               → variáveis de ambiente, constantes
│       │   └── server.ts
│       ├── prisma/
│       │   └── schema.prisma          → schema MongoDB com 14 collections
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   └── shared/                      → Zod schemas, tipos Prisma, constantes
│       ├── src/
│       │   ├── schemas/              → Zod schemas compartilhados
│       │   ├── types/                → tipos TypeScript
│       │   └── constants/            → enums, valores fixos
│       ├── tsconfig.json
│       └── package.json
├── .devcontainer/
│   └── devcontainer.json             → config do Dev Container (VS Code)
├── .github/
│   └── workflows/                   → GitHub Actions (CI/CD)
├── docker-compose.yml                → dev: frontend + backend
├── docker-compose.prod.yml           → prod: frontend + backend + nginx
├── nginx/
│   └── nginx.conf                    → reverse proxy + SSL
├── turbo.json                        → configuração Turborepo
├── package.json                      → workspaces root
├── tsconfig.base.json                → config TS base compartilhada
├── .env.example
├── .gitignore
└── README.md
```

---

## 6. UI/UX — Design do App

Handoff completo recebido do Claude Design. Protótipo em alta fidelidade (hifi) com todas as telas, tokens e comportamentos definidos. Arquivos de referência em JSX + HTML.

### 6.1 Direção de Design

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Fidelidade** | Alta fidelidade (hifi) — cores, tipografia, espaçamentos e estados finais definidos | ✔ Definido |
| **Tema** | Tema CLARO (creme) como padrão. Tema escuro fora do escopo inicial | ✔ Definido |
| **Home** | Variação A 'Carteira' — única a ser implementada | ✔ Definido |
| **Frame de referência** | 390px de largura (mobile-first) | ✔ Definido |
| **Hit target mínimo** | 44px (acessibilidade) | ✔ Definido |

### 6.2 Design Tokens — Cores (Tema Claro)

| Token | Hex | Status |
|---|---|---|
| **Fundo da página** | `#C9BBA2` | ✔ Definido |
| **App background** | `#FAF5EC` | ✔ Definido |
| **Surface** | `#FFFFFF` | ✔ Definido |
| **Surface alt** | `#FBF6EC` | ✔ Definido |
| **Surface 2** | `#F4EBDA` | ✔ Definido |
| **Texto** | `#241608` | ✔ Definido |
| **Texto secundário** | `#7C6A50` | ✔ Definido |
| **Texto terciário** | `#A89A82` | ✔ Definido |
| **Accent** | `#B0702A` | ✔ Definido |
| **Gold (dourado)** | `#E3AC3F` | ✔ Definido |
| **Gold soft** | `#F3DDA6` | ✔ Definido |
| **Espresso** | `#1E1207` | ✔ Definido |
| **Botão primário** | bg `#1E1207` / texto `#FBF3E4` | ✔ Definido |
| **Sucesso** | `#3E7C53` / soft `#DCEBDF` | ✔ Definido |

### 6.3 Tipografia

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Display / títulos / números** | Bricolage Grotesque (Google Fonts) — peso 700–800, tracking -0.02em a -0.03em | ✔ Definido |
| **Texto / UI** | Hanken Grotesk (Google Fonts) — peso 400–800 | ✔ Definido |
| **Escala** | Títulos 26–32px; cards 15–18px; corpo 13–15px; labels 11–12.5px; números destaque 24–56px | ✔ Definido |

### 6.4 Espaçamento e Raios

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Padding de tela** | 0 20–24px | ✔ Definido |
| **Gaps comuns** | 10–14px | ✔ Definido |
| **Raios** | Campos 14; botões 16; cards 18–22; ícone app 30%; pills 999 | ✔ Definido |
| **Sombra suave** | `0 1px 2px rgba(43,26,12,.05), 0 4px 14px -8px rgba(43,26,12,.18)` | ✔ Definido |
| **Sombra forte** | `0 1px 2px rgba(43,26,12,.05), 0 10px 30px -12px rgba(43,26,12,.22)` | ✔ Definido |

### 6.5 Telas do Cliente (12 telas)

| Tela | Descrição | Status |
|---|---|---|
| **1. Splash / Instalar PWA** | Fundo espresso, símbolo dourado, CTA instalar + link 'Já tenho conta' | ✔ Definido |
| **2. Login por código** | Campo celular/e-mail → OTP 4 dígitos, avanço automático de foco | ✔ Definido |
| **3. Cadastro (5 passos)** | Dados → Contato → Condomínio → Endereço → Verificação OTP | ✔ Definido |
| **4. Home (variação A Carteira)** | Saldo grande, entrega de hoje, ações rápidas, próximas entregas | ✔ Definido |
| **5. Comprar créditos** | Combos (3 cards) + compra personalizada (stepper + comparativo) | ✔ Definido |
| **6. Confirmação de compra** | Check + '+N pães adicionados' + CTAs | ✔ Definido |
| **7. Agenda semanal** | 7 dias com stepper, horário, toggle reconfigurar, alerta de cobertura | ✔ Definido |
| **8. Pedido único** | Stepper + data + estado créditos insuficientes | ✔ Definido |
| **9. Compra automática** | Toggle, modo (acabando/semanal), combo a repor | ✔ Definido |
| **10. Acompanhamento entrega** | Timeline 3 estados: Agendado → Saiu → Entregue | ✔ Definido |
| **11. Central de notificações** | Cards por tipo com ícone colorido, itens novos com borda dourada | ✔ Definido |
| **12. Histórico** | Lista últimos 30 dias com data, quantidade e status | ✔ Definido |

### 6.6 Telas do Entregador (2 telas)

| Tela | Descrição | Status |
|---|---|---|
| **1. Lista de entregas** | Agrupada por condomínio, bloco/torre, apto, qtd, nome do cliente | ✔ Definido |
| **2. Rota (mapa)** | Mapa com ordem de paradas + lista de apartamentos | ✔ Definido |

### 6.7 Telas do Admin (10+ telas)

| Tela | Descrição | Status |
|---|---|---|
| **1. Painel** | Navegação inferior 5 itens, visão geral | ✔ Definido |
| **2. Pedido ao fornecedor** | 4 passos: gerar → revisar → dividir → baixar relatório | ✔ Definido |
| **3. Entregas** | Lista do dia + histórico + dashboard | ✔ Definido |
| **4. Clientes** | Lista com filtros por condomínio + bloquear/desbloquear | ✔ Definido |
| **5. Combos e promoções** | CRUD + toggle promoção 15% OFF | ✔ Definido |
| **6. Compra personalizada** | Limite máximo + preço/pão + prévia do incentivo | ✔ Definido |
| **7. Fornecedores** | CRUD: CNPJ, contato, preço do pão | ✔ Definido |
| **8. Entregadores** | CRUD + ativar/desativar | ✔ Definido |
| **9. Condomínios** | Lista: nome, tipo, nº de clientes | ✔ Definido |
| **10. Pagamentos** | Status + estornar | ✔ Definido |
| **11. Financeiro** | Dia/Semana/Mês + por tipo + por condomínio | ✔ Definido |

### 6.8 Navegação

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Cliente — tab bar** | Início / Agenda / Créditos / Pedidos | ✔ Definido |
| **Admin — nav inferior** | 5 itens de navegação | ✔ Definido |
| **Roteamento** | React Router (substituir go(route) do protótipo) | ✔ Definido |
| **Estado global** | Context ou Zustand (substituir localStorage do protótipo) | ✔ Definido |

### 6.9 Assets e Marca

| Requisito | Decisão / Observação | Status |
|---|---|---|
| **Fontes** | Bricolage Grotesque + Hanken Grotesk (Google Fonts) | ✔ Definido |
| **Ícones** | Set próprio de SVG paths — substituível por Lucide | ✔ Definido |
| **Símbolo (BreadMark)** | SVG inline: arco do pão + ondas de aroma. Regra de redução abaixo de 48px | ✔ Definido |
| **Imagens raster** | Nenhuma — tudo SVG/componente | ✔ Definido |

---

## 7. Status Final

Levantamento de requisitos concluído. Todos os itens funcionais, técnicos e de design estão definidos.

**Documentação de referência para desenvolvimento:**

- Este documento (Requisitos v01) — regras de negócio, stack técnica, estrutura de banco e repositório
- Modelo de Funcionamento — fluxos de créditos, agendamentos e pedidos ao fornecedor
- Handoff de Design — protótipo hifi em JSX + tokens + comportamentos (pacote Claude Design)

---

*Documento finalizado — pronto para início do desenvolvimento.*
