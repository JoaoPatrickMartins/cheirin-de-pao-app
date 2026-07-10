# Feature Landscape — Cheirin de Pão v1.1

**Domínio:** App de entrega recorrente de pãezinhos em condomínios (créditos + agendamento)
**Pesquisado:** 2026-06-18
**Milestone:** v1.1 — features novas sobre a base do v1.0

---

## Premissas e contexto de base

O v1.0 já entregou: auth OTP, cadastro 5 passos, agenda semanal com um único horário por dia, compra de combos com Pix/cartão via MP Bricks (token one-time), painel admin, e app do entregador. O `Schedule` atual armazena `weeklyQty` (JSON com `seg..dom`) e `deliveryTime` (enum string único: `'06:30'|'07:00'|'07:30'|'08:00'`). O esquema Prisma tem `Condominium` sem nenhum campo de horários — horários de entrega são valores fixos no frontend.

---

## Feature 1 — Cartões Salvos / Tokenização Mercado Pago

### Como funciona hoje

O v1.0 usa MP Bricks (`CardPaymentBrick`) no modo token one-time: o Brick captura os dados completos do cartão a cada compra, gera um token descartável, e o backend envia ao MP `/v1/payments`. O campo `cardTokenMp` no modelo `User` existe no schema mas não está sendo usado para reuso — foi previsto para compra automática (D-12 da Fase 3/4), que também foi postergada para Pix porque tokens one-time não são reutilizáveis.

### Como o MP Customer + Cards API funciona (HIGH confidence — documentação oficial)

**Fluxo backend para criar e salvar:**
1. Na primeira compra de um cliente, o backend cria um Customer MP: `POST /v1/customers` com `{ email, first_name, last_name, phone, identification: { type: "CPF", number: "..." } }`. Retorna `customer_id` (ex: `123456789-jxOV430go9fx2e`).
2. O backend salva esse `customer_id` no `User` (campo novo: `mpCustomerId`).
3. Após pagamento aprovado, o backend associa o cartão ao customer: `POST /v1/customers/{customer_id}/cards` com `{ token: "<token_one_time_usado_no_pagamento>" }`. Retorna `card_id` (ex: `1518023392627`) com `last_four_digits`, `first_six_digits`, `expiration_month/year`, bandeira.
4. O backend persiste o `card_id` em uma nova collection `SavedCard` ou array embedded no `User`.

**Fluxo UX para usar cartão salvo — Payment Brick com customerId:**
- Na inicialização do Brick, passar: `initialization: { payer: { customerId: "...", cardsIds: ["1518023392627"] } }`.
- O Brick exibe os cartões salvos como opções selecionáveis automaticamente (já filtra expirados).
- O usuário seleciona um cartão salvo e insere apenas o CVV — o Brick não re-solicita número completo.
- O Brick gera um novo token curto (que embute o CVV + card_id) e o frontend envia ao backend normalmente.
- O backend usa `POST /v1/payments` com `{ token, payer: { type: "customer", id: customer_id } }`.

**Restrição crítica:** O CVV nunca é armazenado pelo MP. A cada pagamento com cartão salvo, o cliente SEMPRE reinforma o CVV. Isso é obrigatório e inegociável — é um requisito regulatório, não uma limitação de implementação.

### Table stakes (mínimo esperado)

| Feature | Razão | Complexidade |
|---------|-------|-------------|
| Listar cartões salvos como opção de seleção na CombosScreen | Padrão universal em e-commerce com cartão recorrente | Média |
| Exibir bandeira + 4 últimos dígitos + vencimento de cada cartão | Identificação visual obrigatória | Baixa |
| Re-captura de CVV na seleção de salvo | Obrigatório pelo MP — sem exceção | Baixa (Brick faz) |
| Opção "Usar novo cartão" sempre visível | Usuário precisa trocar cartão sem remover o salvo | Baixa |
| Botão "salvar este cartão" na compra com cartão novo | Opt-in claro, não opt-out | Baixa |

### Diferenciadores

| Feature | Valor | Complexidade |
|---------|-------|-------------|
| Múltiplos cartões salvos (até 3) | Comodidade para quem tem mais de um cartão | Média |
| Remover cartão salvo nas configurações | Controle do usuário sobre dados sensíveis | Baixa |
| Indicar qual é o cartão padrão | Reduz cliques na próxima compra | Baixa |

### Anti-features

| Anti-feature | Por quê evitar | Alternativa |
|-------------|---------------|-------------|
| Solicitar CVV de forma costumizada (fora do Brick) | Risco de segurança e não-conformidade PCI | Usar sempre o MP Brick para captura |
| Salvar CVV em qualquer lugar | Proibido por PCI DSS — MP não permite | Nunca armazenar |
| "Cobrar silenciosamente" no cartão salvo sem interação | MP não suporta via Customer Cards — requer preapproval/subscriptions | Usar Pix para compra automática ou redirecionar para compra ativa |
| Exibir número completo do cartão | Proibido | Apenas `last_four_digits` + bandeira |

### Dependências de implementação

- **Schema:** Novo campo `mpCustomerId: String?` no `User`. Nova collection `SavedCard` (ou array embedded) com `cardId`, `lastFour`, `brand`, `expiresAt`, `isDefault`.
- **Backend:** `customers.service` (criar customer MP, listar cards, associar card pós-pagamento, remover card).
- **Payments service:** modificar `POST /payments/card` para: (a) criar customer se não existir, (b) associar card após pagamento aprovado, (c) aceitar `{ customerId, cardId }` junto com token.
- **Frontend CombosScreen:** inicializar o Brick com `payer.customerId + payer.cardsIds` quando disponível.
- **Frontend SettingsScreen:** tela de cartões salvos com lista + remover.

### Complexidade geral

**MÉDIA** — o MP Bricks já gerencia a UI de seleção quando `customerId` e `cardsIds` são passados. O trabalho real está na orquestração backend: criar customer, salvar card_id pós-aprovação, e expor a lista de cartões para a SettingsScreen.

---

## Feature 2 — Crédito Manual pelo Admin

### Comportamento esperado (padrões de mercado — MEDIUM confidence)

Em apps de assinatura e delivery, o painel admin permite ao operador adicionar créditos manualmente por três motivos principais: (1) compensação por falha na entrega, (2) bônus de fidelidade/promoção, (3) acerto contábil. O padrão consolidado no mercado:

**UX admin:**
- Botão "Adicionar créditos" visível na tela de detalhe do cliente (não na lista).
- Modal com dois campos: quantidade (stepper ou input numérico, min 1) + motivo (select com opções: Compensação, Bônus, Promoção, Outro — campo texto livre quando "Outro").
- Confirmação em 2 passos: "Adicionar 10 pães para João Silva — Compensação de entrega não realizada. Confirmar?"
- Feedback visual do novo saldo após confirmação.

**Push notification para o cliente:**
- Notificação automática no estilo da marca: "Boa notícia, [Nome]! Você ganhou X pãezinhos fresquinhos no Cheirinho de Pão."
- Motivo incluído de forma amigável quando possível.

**Auditoria (HIGH confidence — padrões de SaaS enterprise):**
Os dados mínimos para um audit log defensável:
- `adminId` (quem fez), `userId` (quem recebeu), `quantity`, `reason` (motivo escolhido), `note` (texto livre), `createdAt`, `type: MANUAL_CREDIT`.
- A `CreditTransaction` já existe no schema com `type: TransactionType` — basta adicionar `MANUAL_CREDIT` ao enum e incluir os campos `adminId` + `reason` + `note` (ambos `String?`).

### Table stakes

| Feature | Razão | Complexidade |
|---------|-------|-------------|
| Campo quantidade + motivo | Mínimo para rastreabilidade | Baixa |
| Confirmação em 2 passos antes de creditar | Evita erros de digitação | Baixa |
| Registro imutável na CreditTransaction | Auditoria e disputa | Baixa |
| Notificação push para o cliente | Experiência de cliente + transparência | Baixa |

### Diferenciadores

| Feature | Valor | Complexidade |
|---------|-------|-------------|
| Mensagem de notificação no estilo da marca | Experiência mais humana que "Crédito adicionado" | Baixa |
| Histórico de créditos manuais na tela do cliente | Transparência — cliente vê o motivo | Baixa |

### Anti-features

| Anti-feature | Por quê evitar | Alternativa |
|-------------|---------------|-------------|
| Crédito manual sem motivo obrigatório | Sem motivo = sem auditoria = sem defesa em disputa | Motivo como campo obrigatório (select) |
| Crédito negativo (debitar crédito manualmente) | Cria fricção e possível conflito com cliente | Se necessário, usar modal separado com aviso mais explícito |
| Crédito manual de valor zero | Dado inútil no audit log | Validar `quantity >= 1` |

### Dependências de implementação

- **Schema:** `TransactionType` enum: adicionar `MANUAL_CREDIT`. `CreditTransaction`: adicionar `adminId: String? @db.ObjectId` e `reason: String?`.
- **API:** `POST /admin/clients/:userId/credits` — novo endpoint no módulo `admin-clients`.
- **Frontend:** Modal em `ClientDetailView` (AdminClientes já implementado). Notificação via OneSignal service existente.

### Complexidade geral

**BAIXA** — reutiliza infraestrutura existente (`CreditTransaction`, OneSignal, `admin-clients` module). A maior atenção deve ser na UX do modal (confirmação em 2 passos, mensagem de notificação customizável).

---

## Feature 3 — Gestão de Horários de Entrega por Condomínio

### Como funciona em apps de delivery (MEDIUM confidence)

Apps de delivery como iFood e Rappi tratam janelas de entrega no nível da "loja" (equivalente ao condomínio aqui). O admin configura quais janelas horários existem, e o cliente escolhe entre as disponíveis. Não é "qual horário você quer" — é "quais janelas oferecemos, você escolhe uma."

**Modelo mental correto para este domínio:**
Cada condomínio tem sua própria lista de `DeliverySlot` (horários cadastrados). Um slot é apenas um horário string (ex: `"06:30"`, `"15:30"`). O cliente vinculado a esse condomínio só vê os slots daquele condomínio ao configurar a agenda.

**UX admin (configurar horários por condomínio):**
- Na tela de edição do condomínio (`AdminCondos` — já existente), adicionar uma seção "Horários de entrega".
- Lista dos horários cadastrados para aquele condomínio, cada um com botão de remover (X).
- Botão "+ Adicionar horário" → input time picker (HTML `<input type="time">` ou campo HH:MM com validação).
- Ao criar condomínio, dois slots padrão são adicionados automaticamente: `"06:30"` e `"15:30"`.
- Sem limite máximo de slots por condomínio (recomendação: 2-4 na prática).
- Regra: não remover um slot que esteja em uso (há `Schedule` com esse `deliveryTime`). API retorna 409 com mensagem explicativa.

**UX cliente (escolher horário na agenda):**
- Os `DeliveryTimeChips` do `ScheduleScreen` atual mostram chips fixos `['06:30', '07:00', '07:30', '08:00']` — hardcoded.
- Com esta feature, os chips devem ser carregados da API (`GET /condominiums/:id/slots` ou incluído no response do `GET /schedules/me`).
- Se o condomínio tem apenas 1 slot, o chip é selecionado automaticamente (sem escolha necessária).
- Se tem 2+ slots, o cliente escolhe um — mas apenas um único slot por agenda (a seleção de múltiplos slots vai na Feature 4).

### Table stakes

| Feature | Razão | Complexidade |
|---------|-------|-------------|
| CRUD de slots por condomínio no admin | Cada condomínio tem operação logística diferente | Baixa |
| Dois slots default ao criar condomínio (`06:30`, `15:30`) | Operação imediata sem configuração manual | Baixa |
| DeliveryTimeChips do cliente carregados dinamicamente | Chips fixos no frontend não escalam | Baixa |
| Proteção contra remoção de slot em uso | Integridade de dados | Baixa |

### Diferenciadores

| Feature | Valor | Complexidade |
|---------|-------|-------------|
| Mensagem explicativa quando slot não pode ser removido (clientes ativos) | Melhor que erro genérico | Baixa |
| Badge de contagem de clientes por slot | Admin vê impacto antes de remover | Média |

### Anti-features

| Anti-feature | Por quê evitar | Alternativa |
|-------------|---------------|-------------|
| Slots como horário absoluto com data | Complexidade desnecessária para operação diária | Apenas HH:MM string simples |
| Permitir slots duplicados no mesmo condomínio | Confusão | Validar unicidade ao adicionar |
| Mais de 6 slots por condomínio | Operação logística inviável | Validar máximo na API |

### Dependências de implementação

- **Schema:** Nova collection `DeliverySlot` (`id`, `condominiumId`, `time: String`, `isActive: Boolean`, `createdAt`). Alternativa: array embedded em `Condominium.deliverySlots: String[]` — mais simples para leitura, mas sem auditoria individual. **Recomendação: collection separada** (permite proteção de remoção via query).
- **API:** `GET /condominiums/:id/slots`, `POST /admin/condominiums/:id/slots`, `DELETE /admin/condominiums/:id/slots/:slotId`.
- **Seed de condomínio:** `AdminCondominiumsService.create` deve inserir dois `DeliverySlot` padrão atomicamente.
- **Frontend ScheduleScreen:** `DeliveryTimeChips` passa a ser `DeliveryTimeChips({ slots: DeliverySlot[], value, onChange })` — busca slots via API no mount.
- **Validação no Schedule:** `deliveryTime` no `ScheduleBodySchema` passa de `z.enum([...fixo...])` para `z.string()` validado contra os slots do condomínio do usuário no service.

### Complexidade geral

**BAIXA-MÉDIA** — a parte mais delicada é a migração: o campo `deliveryTime` do `Schedule` hoje é validado contra enum fixo no schema Zod. Isso precisa ser relaxado para `String` e a validação movida para o service (que consulta os slots do condomínio).

---

## Feature 4 — Múltiplos Slots de Entrega na Agenda Semanal

### Como o cliente configura (padrão de UX — MEDIUM confidence)

Esta é a extensão natural da Feature 3: com múltiplos slots disponíveis no condomínio, o cliente pode querer entregas em MAIS DE UM horário no mesmo dia. Exemplo: 4 pães às 06:30 E 6 pães às 15:30 na segunda-feira.

**Mudança de modelo mental:**
- Antes: um `Schedule` por cliente com `weeklyQty.seg = 4` (total do dia, horário único).
- Depois: o cliente pode ter N configurações de horário, cada uma com seu próprio `weeklyQty`. Ou seja: um Schedule por `(userId, condominiumId, deliverySlotId)`.

**Padrão de UI mais intuitivo:**

O padrão mais testado em apps similares (Swiggy, Dunzo, apps de milkman delivery) usa **abas ou chips de slot no topo da agenda**, onde cada slot selecionado expõe sua própria grade de dias. Sequência:

1. **Chips de slot no topo** (ex: `[06:30] [15:30]`): o usuário clica para ativar/desativar cada slot.
2. Para cada slot ativo, exibe uma grade compacta de 7 dias com steppers.
3. O rodapé mostra o consumo total combinado de todos os slots.

Exemplo de estado: slot 06:30 ativo (seg 4, ter 4, qua 0...) + slot 15:30 ativo (seg 6, sab 8...).

**Alternativa mais simples (recomendada para MVP desta feature):**
- Um slot é configurado por vez (navegação por aba/chip).
- O usuário seleciona qual slot está configurando via chip horizontal.
- A mesma grade de 7 steppers é re-usada para o slot selecionado.
- O rodapé mostra consumo total (soma de todos slots).

Esta alternativa reusa o componente `ScheduleScreen` atual com mínimas modificações.

### Table stakes

| Feature | Razão | Complexidade |
|---------|-------|-------------|
| Chips de slot horizontal no topo da ScheduleScreen | Navegar entre slots sem confusão | Baixa |
| Grade de 7 dias independente por slot | Cada horário pode ter quantidades diferentes por dia | Baixa |
| Consumo semanal total (todos os slots somados) | Cliente sabe quantos créditos vai gastar | Baixa |
| Banner de cobertura de créditos baseado no total combinado | Alerta correto de saldo insuficiente | Baixa |

### Diferenciadores

| Feature | Valor | Complexidade |
|---------|-------|-------------|
| Visualização simultânea dos dois slots na mesma tela (layout expandido) | Usuário vê o quadro completo sem navegar | Média |
| Cópia de configuração de um slot para outro | Comodidade quando as quantidades são iguais | Baixa |

### Anti-features

| Anti-feature | Por quê evitar | Alternativa |
|-------------|---------------|-------------|
| Única `Schedule` tentando representar múltiplos slots com JSON complexo | Complexidade desnecessária, dificulta queries | Um `Schedule` por slot, uniqueness em `(userId, condominiumId, slotId)` |
| Mostrar todos os slots ao mesmo tempo em uma única grade (linhas extras por dia) | Grade fica visualmente sobrecarregada em mobile | Usar abas/chips para alternar |
| Configurar slots sem que o admin os tenha cadastrado | Dados inválidos | Frontend apenas exibe o que a API retorna |

### Dependências de implementação

- **Depende de Feature 3** (slots devem estar cadastrados e acessíveis pela API).
- **Schema:** `Schedule` atual tem `@@unique([userId, condominiumId])`. Com múltiplos slots, a uniqueness deve ser `@@unique([userId, condominiumId, deliverySlotId])`. Adicionar `deliverySlotId: String @db.ObjectId` ao modelo. **Atenção: breaking change no constraint único existente** — precisará de `prisma db push` com cuidado para não duplicar o índice.
- **API `PUT /schedules/me`:** deve aceitar array de schedules (`[{ slotId, weeklyQty }]`) ou endpoint por slot (`PUT /schedules/me/:slotId`). **Recomendado: array** para salvar tudo em uma transação.
- **Frontend ScheduleScreen:** adicionar chips de slot horizontal acima dos day-rows. O estado `weeklyQty` passa a ser `Record<slotId, WeeklyQty>`. `consumoSemanal` = soma de todos os totais.
- **Cron de criação de Orders:** `createDailyOrders` percorre todos os `Schedule` ativos de um usuário (agora pode haver múltiplos) para um mesmo dia.

### Complexidade geral

**MÉDIA-ALTA** — é a feature com maior superfície de mudança no v1.1. A mudança no schema `Schedule` (novo campo `deliverySlotId`, novo constraint único) e na lógica de criação de Orders (múltiplos schedules por usuário/dia) são os pontos de atenção. Deve ser implementada DEPOIS das Features 3 e 5 (SettingsScreen) para evitar retrabalho.

---

## Feature 5 — Tela de Configurações do Cliente

### O que deve estar em uma tela de configurações (HIGH confidence — padrões consolidados)

Para apps de assinatura/delivery, a tela de configurações tem função diferente do perfil: perfil é identidade, configurações é controle operacional. O padrão consolidado em mobile:

**Hierarquia e organização recomendada:**

```
Configurações
├── [Avatar/inicial do nome — não clicável, apenas visual]
│
├── Seção: MINHA CONTA
│   ├── Dados pessoais (nome, CPF, data nasc.) → tela de edição
│   └── Contato (telefone, e-mail) → tela de edição com re-verificação OTP
│
├── Seção: ENTREGA
│   └── Meu condomínio (nome do condo, bloco, apartamento) → tela de edição
│
├── Seção: PAGAMENTOS
│   └── Cartões salvos → tela de cartões (Feature 1)
│
├── Seção: NOTIFICAÇÕES
│   ├── Push notifications (toggle — liga/desliga todas)
│   └── Avisos de crédito baixo (toggle)
│
└── [Botão de logout — destacado visualmente, mas não agressivo]
```

**Prioridades de uso (dados reais de apps similares):**
1. Logout — acessado com mais frequência que o resto
2. Cartões salvos — gestão de formas de pagamento
3. Dados de contato — mudança de telefone/email
4. Condomínio — mudança de moradia
5. Dados pessoais — raramente alterado após cadastro

### Table stakes

| Feature | Razão | Complexidade |
|---------|-------|-------------|
| Visualizar e editar dados pessoais (nome, data nasc.) | Usuário pode ter digitado errado no cadastro | Baixa |
| Visualizar e editar contato (tel + email) com re-verificação OTP | Contato é canal de autenticação — alteração requer verificação | Média |
| Visualizar e editar condomínio (condo + bloco + apto) | Usuário pode mudar de apartamento | Baixa |
| Seção de cartões salvos (Feature 1) | Necessário para gestão de dados de pagamento | Depende de F1 |
| Logout | Universal | Baixa |

### Diferenciadores

| Feature | Valor | Complexidade |
|---------|-------|-------------|
| Toggle de notificações push (categoria por categoria) | Controle granular sem desinstalar | Baixa |
| Avisos sobre o que cada toggle afeta | Reduz surpresas — "se desativar isso, não receberá X" | Baixa |

### Anti-features

| Anti-feature | Por quê evitar | Alternativa |
|-------------|---------------|-------------|
| Editar CPF | CPF é identificador de negócio e fiscal — não deve ser editável | Exibir como somente leitura |
| Editar condomínio levando ao mesmo select do cadastro sem contexto | Confuso — parece "criar nova conta" | Tela simples com current value + campo de edição |
| Logout dentro de "Dados pessoais" | Anti-pattern de UX — mistura identidade com controle de sessão | Logout sempre no final da tela principal de configurações |
| Deletar conta (sem solicitação explícita do negócio) | Fora do escopo v1.1, adiciona complexidade legal | Não implementar ainda |
| Tela de configurações como modal full-screen | Não segue padrão de navegação do app (push navigation) | Tela separada com AppBar e back |

### Dependências de implementação

- **Frontend:** Nova rota `/client/settings` com `SettingsScreen`. Sub-rotas: `/client/settings/profile`, `/client/settings/contact`, `/client/settings/address`, `/client/settings/cards`.
- **API:** `PATCH /users/me` para dados pessoais/contato/endereço (possível já existir parcialmente). Mudança de telefone/email requer novo OTP (`POST /auth/otp` + `POST /auth/verify`).
- **Feature 1** (cartões) deve estar pronta antes ou em paralelo para a sub-tela de cartões funcionar.
- **Logout entregador/admin:** Ambos precisam do mesmo logout básico — um `AuthContext.logout()` genérico já satisfaz todos os três perfis.

### Complexidade geral

**BAIXA-MÉDIA** — a estrutura é simples; a parte média é a re-verificação OTP para mudança de contato (telefone/email são canais de autenticação) e a integração com cartões salvos (Feature 1).

---

## Tabela de Dependências entre Features v1.1

```
Feature 3 (slots por condomínio)
  └─→ Feature 4 (múltiplos slots na agenda)
        └─→ Feature 4 depende de slots existentes na API

Feature 1 (cartões salvos)
  └─→ Feature 5 (settings) exibe tela de cartões

Feature 2 (crédito manual admin) — independente
Feature 5 (settings cliente) — independente do ponto de view da API, mas integra Feature 1
```

**Ordem de implementação recomendada para o milestone v1.1:**
1. Feature 2 (crédito manual) — menor risco, maior impacto imediato para o negócio
2. Feature 3 (horários por condomínio) — base para Feature 4
3. Feature 5 (settings) + Feature 1 (cartões) — podem ser em paralelo
4. Feature 4 (múltiplos slots) — depende de Feature 3 estar funcionando

---

## MVP Recommendations por Feature

### Feature 1 — Cartões Salvos

**MVP:** Salvar 1 cartão por cliente (o último usado). UI no checkout: "Usar cartão •••• 4321" + "Usar outro cartão" + "Compra única (sem salvar)". Remover na SettingsScreen.

**Defer:** Múltiplos cartões, cartão padrão, lista de cartões fora do checkout.

### Feature 2 — Crédito Manual

**MVP:** Modal na tela de detalhe do cliente com quantidade + motivo (select). Confirmação em 2 passos. Log na CreditTransaction. Push via OneSignal.

**Defer:** Histórico de créditos manuais visível para o cliente, crédito negativo.

### Feature 3 — Horários por Condomínio

**MVP:** Seção na tela de edição de condomínio no admin. CRUD de slots. Default 06:30 + 15:30 ao criar. DeliveryTimeChips carregados dinamicamente.

**Defer:** Badge de contagem de clientes por slot.

### Feature 4 — Múltiplos Slots na Agenda

**MVP:** Chips de slot horizontal na ScheduleScreen. Um slot configurado por vez. Consumo total combinado no rodapé. Um Schedule por slot no banco.

**Defer:** Visualização simultânea dos dois slots lado a lado, copiar configuração entre slots.

### Feature 5 — Settings Cliente

**MVP:** Tela com 4 seções (dados pessoais, contato, condomínio, cartões). Logout funcional. Edição de dados pessoais e condomínio sem re-verificação. Edição de contato COM re-verificação OTP.

**Defer:** Toggles de notificações granulares, delete account.

---

## Fontes e Confiança

| Area | Confiança | Fonte principal |
|------|-----------|----------------|
| MP Customer + Cards API — fluxo técnico | HIGH | Docs oficiais mercadopago.com.br/developers |
| MP Bricks com customerId + cardsIds | HIGH | Docs oficiais mercadopago.com/developers/en/docs/checkout-bricks |
| CVV obrigatório a cada transação salva | HIGH | Docs MP — restrição de segurança explícita |
| Audit log fields para crédito manual | HIGH | Enterprise SaaS patterns (chrisdermody.com, enterpriseready.io) |
| UX modal 2 passos para admin actions | MEDIUM | Padrão consolidado em tools como Stripe Dashboard, Shopify Admin |
| UX chips de slot para seleção de horário | MEDIUM | UX case studies Swiggy/Dunzo + análise do design handoff existente |
| Hierarquia da SettingsScreen | HIGH | Padrão iOS/Android Human Interface Guidelines + toptal.com/designers/ux/settings-ux |
| Delivery slots como collection separada | MEDIUM | Análise de integridade referencial vs simplicidade — recommendation baseada em tradeoffs técnicos |
