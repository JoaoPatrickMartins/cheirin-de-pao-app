# Resumo de Pesquisa — Cheirin de Pão v1.1

**Projeto:** Cheirin de Pão — PWA de entrega recorrente de pãezinhos  
**Milestone:** v1.1 — Cartões salvos, crédito manual admin, horários configuráveis, agenda multi-slot, tela de configurações  
**Pesquisado em:** 2026-06-18  
**Confiança geral:** HIGH — decisões verificadas nos tipos do SDK instalado, documentação oficial MP e leitura direta do codebase

---

## Sumário Executivo

O v1.1 do Cheirin de Pão adiciona 5 features sobre uma base v1.0 funcional em produção. A pesquisa confirma que nenhuma biblioteca nova é necessária: o `mercadopago@3.1.0` já instalado expõe `Customer` e `CustomerCard` com tipagem completa; o Zod 4.4.3 instalado cobre validação de telefone BR via `z.string().refine()`; o `node-cron@4.2.1` suporta a lógica expandida de múltiplos slots. O trabalho é inteiramente de modelagem de dados, orquestração de serviços e expansão de UI com os componentes existentes.

A decisão arquitetural mais impactante é a retrocompatibilidade do `Schedule`. O campo `weeklyQty Json` atual e o `deliveryTime String` único precisam ser mantidos como nullable enquanto o novo campo `days Json` é adicionado — uma estratégia de migração em 3 passos que garante que os schedules existentes continuem funcionando durante a transição. A mudança no `@@unique([userId, condominiumId])` para incluir `deliverySlotId` é o ponto de maior risco técnico do milestone: exige backfill dos documentos existentes antes do `prisma db push`, e pular esse passo pode corromper dados em produção.

O risco de negócio mais crítico é a limitação do Mercado Pago sobre CVV: cobranças automáticas silenciosas com cartão salvo são impossíveis pelo padrão PCI DSS. O CVV deve ser recapturado pelo Brick a cada transação. Isso significa que `processAutoBuy` continua funcionando apenas com Pix; cartão salvo é para recompra manual pelo cliente. Essa limitação deve ser documentada na spec antes de qualquer comprometimento de UX com "1 toque com cartão".

---

## Adições de Stack

Nenhuma biblioteca nova necessária para o milestone v1.1 inteiro.

**Dependências já instaladas que cobrem todo o escopo:**

- `mercadopago@3.1.0` — `Customer.create()`, `Customer.createCard()`, `Customer.listCards()`, `Customer.removeCard()`, `Customer.search()` — tipagem completa disponível
- `zod@4.4.3` — `z.string().refine()` para validação de telefone BR sem regex library externa
- `node-cron@4.2.1` — suporte à lógica expandida de multi-slot via iteração interna
- `prisma@6.x` — composite types e `String[]` em MongoDB Atlas confirmados

**Mudanças de configuração necessárias:**

- Nenhuma variável de ambiente nova — a Customer API usa o mesmo `MP_ACCESS_TOKEN` da Payment API
- Após todas as mudanças de schema: executar apenas `prisma generate` (nunca `prisma migrate dev` — MongoDB não suporta migrations Prisma)
- Webhook MP: não requer nova configuração — `Customer.createCard()` roda sincronamente após aprovação do pagamento, sem evento de webhook

---

## Features: Table Stakes vs Diferenciadores

### Feature 1 — Cartões Salvos

| Categoria | Feature | Decisão |
|-----------|---------|---------|
| Table stake | Listar cartões com bandeira + 4 dígitos + vencimento | Implementar — padrão universal de e-commerce |
| Table stake | Re-captura de CVV via Brick ao usar salvo | Implementar — obrigatório PCI/MP, sem exceção |
| Table stake | "Usar novo cartão" sempre visível | Implementar — não pode aprisionar o usuário |
| Table stake | Opt-in explícito "salvar este cartão" | Implementar — nunca opt-out silencioso |
| Diferenciador | Até 3 cartões salvos por cliente | MVP: 1 cartão (o último salvo); expandir depois |
| Diferenciador | Cartão padrão com 1 toque | Defer — v2 |
| NÃO FAZER | CVV fora do Brick | Risco PCI DSS, proibido |
| NÃO FAZER | Cobrança automática silenciosa com cartão | MP não suporta via Customer Cards — usar Pix |
| NÃO FAZER | Exibir número completo do cartão | Proibido — apenas `last_four_digits` |

### Feature 2 — Crédito Manual Admin

| Categoria | Feature | Decisão |
|-----------|---------|---------|
| Table stake | Modal quantidade + motivo (select obrigatório) | Implementar — sem motivo não há auditoria |
| Table stake | Confirmação em 2 passos | Implementar — previne erro de digitação |
| Table stake | Log imutável em CreditTransaction | Implementar — `ADMIN_GRANT` no enum existente |
| Table stake | Push + notificação in-app para o cliente | Implementar — ambos, push é camada adicional |
| Diferenciador | Histórico de créditos manuais visível ao cliente | Defer — v2 |
| NÃO FAZER | Crédito sem motivo obrigatório | Sem auditoria defensável em disputa |
| NÃO FAZER | Crédito negativo (débito manual) | Cria fricção e conflito com cliente |
| NÃO FAZER | Crédito de valor zero | Dado inútil no audit log |

### Feature 3 — Horários por Condomínio

| Categoria | Feature | Decisão |
|-----------|---------|---------|
| Table stake | CRUD de slots no admin por condomínio | Implementar |
| Table stake | 2 slots default ao criar condo (06:30, 15:30) | Implementar |
| Table stake | DeliveryTimeChips carregados dinamicamente | Implementar — chips fixos no frontend não escalam |
| Table stake | Proteção contra remoção de slot em uso | Implementar — 409 com mensagem explicativa |
| Diferenciador | Badge de contagem de clientes por slot | Defer |
| NÃO FAZER | Slots com data absoluta | Apenas HH:MM string simples |
| NÃO FAZER | Mais de 6 slots por condomínio | Inviável operacionalmente — validar máximo na API |
| NÃO FAZER | Slots duplicados no mesmo condomínio | Validar unicidade ao adicionar |

### Feature 4 — Agenda Multi-Slot

| Categoria | Feature | Decisão |
|-----------|---------|---------|
| Table stake | Chips de slot horizontal na ScheduleScreen | Implementar |
| Table stake | Grade de 7 dias independente por slot | Implementar |
| Table stake | Consumo semanal total (soma de todos os slots) | Implementar |
| Table stake | Banner de créditos baseado no total combinado | Implementar |
| Diferenciador | Visualização simultânea dos 2 slots na mesma tela | Defer |
| Diferenciador | Copiar configuração de um slot para outro | Defer |
| NÃO FAZER | Schedule único para múltiplos slots com JSON complexo | 1 Schedule por slot no banco |
| NÃO FAZER | Todos os slots em uma grade única com linhas extras | Sobrecarrega mobile — usar abas/chips |

### Feature 5 — Tela de Configurações

| Categoria | Feature | Decisão |
|-----------|---------|---------|
| Table stake | Editar dados pessoais (nome, data nasc.) | Implementar |
| Table stake | Editar contato (tel + email) com OTP de confirmação | Implementar — canal de auth exige verificação |
| Table stake | Editar condomínio (condo + bloco + apto) | Implementar + desativar agenda ativa |
| Table stake | Seção de cartões salvos (Feature 1) | Implementar — depende de F1 |
| Table stake | Logout | Implementar |
| Diferenciador | Toggles granulares de notificações push | Defer |
| NÃO FAZER | CPF editável | Imutável — identificador fiscal/legal |
| NÃO FAZER | Deletar conta | Fora do escopo v1.1, complexidade legal |
| NÃO FAZER | Settings como modal fullscreen | Push navigation — tela separada com AppBar |

---

## Decisões Arquiteturais Chave

### 1. SavedCard — collection separada vs. campo único em User

**Decisão: collection `SavedCard` separada.**

Razões: permite `@@index([userId])` para lookup eficiente; operações de remover/setar-default são diretas; `isDefault` com múltiplos cartões futuros precisa de atomicidade que array embedded não oferece; o `mpCardId` é identificador permanente no MP, não um token one-shot.

`User` recebe apenas `mpCustomerId String?` — o vínculo estável com o Customer MP. IDs de cartões individuais vivem em `SavedCard`.

### 2. Schema Schedule para múltiplos slots — campo `days Json` com retrocompatibilidade

**Decisão: adicionar `days Json?` mantendo `weeklyQty Json?` e `deliveryTime String?` como nullable.**

O campo `days` tem estrutura `{ seg: { qty: number, deliveryTime: string }, ter: {...}, ... }`. O service lê `days` se presente, cai para `weeklyQty + deliveryTime` se não. Registros antigos continuam válidos até o usuário re-salvar a agenda. Sem janela de downtime.

`@@unique([userId, condominiumId])` é **mantido** — uma agenda por usuário por condomínio, mas com horário configurável por dia da semana (Cenário A). Isso evita a migração de índice de risco ALTO.

### 3. Condominium deliverySlots — array de strings embedded

**Decisão: `deliverySlots String[]` embedded no model `Condominium`.**

Razões: slots são simples strings HH:MM sem metadados por slot; `String[]` é tipado no Prisma (retorna `string[]` sem casting manual); array nativo MongoDB eficiente para leitura; admin edita via `PATCH /admin/condominiums/:id` passando o novo array. Condomínios existentes terão `deliverySlots: []` — tratar array vazio como "sem restrição" para não bloquear clientes.

### 4. Migração de dados — estratégia de 3 passos

Para qualquer mudança de schema que afete documentos existentes:

```
Passo 1: Adicionar campos novos como nullable → prisma generate → deploy
          (documentos existentes continuam válidos)

Passo 2: Backfill via script MongoDB direto no Atlas:
          db.collection.updateMany({ newField: { $exists: false } }, { $set: { newField: defaultValue } })
          Verificar: db.collection.countDocuments({ newField: null }) === 0

Passo 3: Tornar campo obrigatório ou adicionar índice → prisma generate → deploy
```

Nunca executar Passo 3 sem Passo 2 completo. Nunca remover índice antigo e adicionar novo em um único `db push` com dados sem o campo novo preenchido.

### 5. CVV obrigatório em cada transação com cartão salvo — limitação MP/PCI

Imutável — não é contornável. O CVV nunca é armazenado pelo MP. `processAutoBuy` (cron) não pode cobrar cartão salvo automaticamente. Cobranças recorrentes automáticas usam apenas Pix. Cartão salvo é para recompra manual pelo cliente.

---

## Ordem de Implementação Recomendada

### Fase 1 — Schema unificado (pré-requisito de tudo)

Todas as mudanças de schema em um único `prisma generate`:

- `User`: adicionar `mpCustomerId String?`, `pendingPhone String?`, `pendingEmail String?`
- `Condominium`: adicionar `deliverySlots String[] @default([])`
- `Order`: adicionar `deliveryTime String?`
- `Schedule`: adicionar `days Json?`, tornar `weeklyQty` e `deliveryTime` nullable
- `TransactionType` enum: adicionar `ADMIN_GRANT`
- `CreditTransaction`: adicionar `adminId String? @db.ObjectId`, `reason String?`
- Criar model `SavedCard`
- Um único `prisma generate`

**Rationale:** Campos novos nullable não quebram documentos existentes. Um generate é mais seguro do que múltiplos parciais.

### Fase 2 — Crédito manual admin

Completamente independente. Maior impacto operacional imediato com menor risco técnico.

**Entrega:** `POST /admin/clients/:id/credits`, modal no painel admin, push + notificação in-app, log em `CreditTransaction`.

**Evita:** Armadilha 4.1 — criar `Notification` in-app antes do try-catch do OneSignal.

### Fase 3 — Perfil editável + Settings

Independente de pagamentos e agenda. Implementar antes de cartões salvos porque a SettingsScreen integra cartões mas o restante não depende de F1.

**Entrega:** Módulo `users` com `GET /users/me` + `PATCH /users/me`, endpoints de mudança de contato com OTP, `ProfileScreen`, `SettingsScreen` (sem sub-tela de cartões ainda).

**Evita:** Armadilha 5.1 (revogar sessions ao mudar telefone), 5.2 (CPF imutável), 5.4 (desativar schedule ao mudar condomínio).

### Fase 4 — Cartões salvos

Depende do schema `SavedCard` (Fase 1).

**Entrega:** Módulo `saved-cards` (CRUD), modificações em `payments.service`, `CardPaymentScreen` com flag `saveCard`, `SavedCardsScreen`, sub-tela na `SettingsScreen`.

**Evita:** Armadilha 1.1 (usar `mpCardId` permanente), 1.2 (CVV via Brick), 1.3 (upsert de Customer via search primeiro).

### Fase 5 — Horários configuráveis por condomínio

Base para Fase 6. Independente de cartões.

**Entrega:** CRUD de `deliverySlots` no admin-condominiums, 2 slots default ao criar condomínio, `DeliveryTimeChips` carregados dinamicamente, validação no `schedules.service`.

**Evita:** Armadilha 2.2 (manter `deliveryTime` legado durante transição).

### Fase 6 — Agenda multi-slot

Depende de Fase 5. Maior superfície de mudança do milestone.

**Entrega:** Campo `days` no `Schedule`, `DaysScheduleSchema`, `ScheduleScreen` refatorada com chip de horário por dia, `useSchedule` gerenciando `days` record, `createDailyOrders` com leitura de `days` + fallback.

**Evita:** Armadilha 2.1 (não alterar `@@unique` — usar Cenário A), 3.1 (idempotência no cron por `userId + scheduledDate + deliveryTime`).

---

## Armadilhas Críticas

### 1. `cardTokenMp` não é um `card_id` reutilizável (CRÍTICA)

O campo `User.cardTokenMp` armazena token de uso único do Brick, não um `card_id` permanente da API Customer/Cards. São objetos distintos no MP. Usar o `card_token` para reuso retorna `invalid_card_token` (erro 400) em produção.

**Prevenção:** Usar `SavedCard.mpCardId` (de `Customer.createCard()`) para identificar o cartão. Para cobrar, gerar novo `card_token` via Brick + CVV.

### 2. CVV inviabiliza cobrança automática com cartão (CRÍTICA)

PCI DSS Requirement 3.2 proíbe armazenar CVV. MP não persiste CVV. `processAutoBuy` não pode cobrar cartão salvo automaticamente.

**Prevenção:** CVV exclusivamente via Brick no frontend. Auto-recharge = Pix. Cartão salvo = recompra manual.

### 3. Backfill obrigatório antes de alterar índice de Schedule (CRÍTICA)

`@@unique([userId, condominiumId])` com dados existentes — dropar e recriar o índice sem backfill corrompe ou bloqueia o `prisma db push`.

**Prevenção:** Usar Cenário A (horário por dia dentro de Schedule único) que mantém o `@@unique` existente e elimina o risco. Se Cenário B for necessário no futuro, seguir a estratégia de 3 passos.

### 4. `createDailyOrders` sem idempotência gera Orders duplicados (ALTA)

Com multi-slot, restart do servidor ou PM2 em cluster pode executar o cron duas vezes para o mesmo `scheduledDate`, debitando créditos dobrado.

**Prevenção:** `Order.findFirst({ userId, scheduledDate, deliveryTime })` antes de criar. `@@index([userId, scheduledDate])` no `Order`. Cron apenas na instância PM2 `id === 0`.

### 5. Mudança de telefone sem revogar sessões ativas (CRÍTICA DE SEGURANÇA)

Login é phone/email OTP — alterar o telefone equivale a mudar a senha. Sessões existentes continuariam ativas com credencial de outro número.

**Prevenção:** Ao confirmar OTP: `Session.updateMany({ userId }, { isRevoked: true })` exceto a sessão atual. Emitir novo JWT para a sessão que fez a mudança.

---

## Questões em Aberto para Produto

| Questão | Impacto | Urgência |
|---------|---------|---------|
| Limite de cartões salvos: 1 (MVP) ou 3? | Define se `isDefault` entra já no v1.1 | Alta |
| Revogar todos os dispositivos ao mudar telefone? | Afeta UX de quem usa tablet + celular | Alta |
| Condomínios existentes sem slots: aceitar qualquer horário ou exigir configuração? | Possível bloqueio operacional no deploy | Alta |
| Crédito manual admin pode ser desfeito? | Define se precisamos de endpoint de remoção de ADMIN_GRANT | Média |
| App entregador precisa filtrar por slot com multi-slot? | Afeta escopo da Fase 6 | Média |
| OTP de mudança de contato reutiliza componentes do fluxo de login? | Afeta tamanho da Fase 3 | Média |
| Motivo do crédito manual é visível para o cliente no extrato? | Define response de `GET /credits/history` para role CLIENT | Baixa |

---

## Avaliação de Confiança

| Área | Confiança | Base |
|------|-----------|------|
| Stack | HIGH | Tipos do SDK instalado verificados diretamente; schema.prisma lido; código dos serviços analisado |
| Features | HIGH | Docs oficiais MP para cartões; padrões consolidados de SaaS para crédito manual e settings |
| Arquitetura | HIGH | Leitura direta do codebase — módulos, repositories, crons, hooks |
| Armadilhas | HIGH | Docs oficiais MP, limitações Prisma/MongoDB documentadas, leitura do código dos crons |

**Confiança geral: HIGH**

### Gaps a Endereçar

- **`processAutoBuy` e `cardTokenMp`:** verificar se o campo é lido no cron antes de alterar o schema — o endpoint `PUT /users/me/card-token` mencionado no frontend não foi encontrado nas routes do backend.
- **OTP de mudança de contato vs. OTP de login:** `findActiveOtp` usa `userId` como chave — possível conflito. Solução: adicionar `purpose: 'LOGIN' | 'CONTACT_CHANGE'` ao `OtpCode`.
- **Escopo do courier com multi-slot:** verificar se `CourierScreen` precisa de ajuste no `GET /courier/orders/today` para filtrar por slot antes de fechar a Fase 6.

---

## Fontes

### Alta confiança (HIGH)

- Tipos instalados: `node_modules/mercadopago/dist/clients/customer/index.d.ts`, `customerCard/commonTypes.d.ts`
- Código fonte: `apps/api/prisma/schema.prisma`, `apps/api/src/modules/schedules/schedules.service.ts`, `apps/api/src/plugins/cron.ts`
- Prisma Docs — Composite types MongoDB: https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/composite-types

### Confiança média (MEDIUM)

- MP Docs — Add saved cards (Payment Brick): https://www.mercadopago.com.co/developers/en/docs/checkout-bricks/payment-brick/advanced-features/customers-cards
- MP Docs — Receive payments with saved cards: https://www.mercadopago.com.ar/developers/en/docs/checkout-api/cards-and-customers-management/receive-payments-with-saved-cards
- OneSignal Docs — Web push issues: https://documentation.onesignal.com/docs/en/notifications-not-shown-web-push
- node-cron Issues — PM2 cluster: https://github.com/node-cron/node-cron/issues/393

### Confiança baixa (LOW)

- MongoDB Community — Schema migration patterns: https://www.mongodb.com/community/forums/t/best-practices-for-schema-management-migrations-and-scaling-in-mongodb/306805

---

*Pesquisa concluída: 2026-06-18*  
*Pronto para roadmap: sim*
