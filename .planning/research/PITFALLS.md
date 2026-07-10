# Armadilhas ao Adicionar Features v1.1 — Cheirin de Pão

**Domínio:** PWA de entrega recorrente com créditos — adição de features a sistema em produção
**Pesquisado em:** 2026-06-18
**Contexto:** Sistema já tem OTP auth, créditos, agenda semanal (1 slot por usuário), pagamentos Pix/cartão via MP, painel admin, app entregador. As armadilhas abaixo são específicas para adicionar as features pedidas ao código existente.

---

## 1. Tokenização de Cartões no Mercado Pago

### Armadilha 1.1 — `cardTokenMp` no banco não é um token reutilizável (CRÍTICA)

**Risco:** ALTO
**Impacto:** Toda cobrança automática via cartão salvo falhará silenciosamente em produção

**O que ocorre:** O código atual salva em `User.cardTokenMp` o valor do campo `token` recebido pelo Checkout Brick após a primeira compra. Esse campo é um **card token de uso único** gerado para aquela transação específica. Ele não é um `card_id` da API Customers/Cards do Mercado Pago. Na próxima tentativa de cobrança com esse valor, o MP retorna `invalid_card_token` ou `3003`.

**Causa raiz:** A API de tokenização do MP tem dois objetos completamente distintos:
- `card_token` (`/v1/card_tokens`): token de uso único, válido por alguns minutos, para autorizar uma transação imediata
- `card_id` (`/v1/customers/{customer_id}/cards`): identificador permanente de um cartão salvo no perfil de um Customer MP

**O que deve ser feito:**
1. Criar um Customer no MP via `POST /v1/customers` com o e-mail do usuário — obrigatório
2. Salvar o `card_token` retornado pelo Brick para o Customer via `POST /v1/customers/{customer_id}/cards`
3. Persistir no banco dois campos: `mpCustomerId` (string permanente) e `mpCardId` (string permanente, não o token)
4. Para cobrar um cartão salvo: gerar um novo `card_token` com o `card_id` + CVV re-inserido pelo usuário, depois chamar `POST /v1/payments`

**Fase afetada:** Nova fase de Cartões Salvos (antes da compra com cartão salvo)

**Detecção:** Testar cobrança automática com o `cardTokenMp` atual retorna erro 400 do MP

---

### Armadilha 1.2 — CVV não pode ser armazenado nem inferido (CRÍTICA)

**Risco:** ALTO
**Impacto:** Violação de PCI DSS se o CVV tocar o backend; impossibilidade de cobrança automática silenciosa com cartão

**O que ocorre:** Qualquer tentativa de armazenar o CVV no banco ou de transmiti-lo entre frontend e backend próprio infringe a norma PCI DSS Requirement 3.2 (proibição de armazenamento de dados de autenticação sensíveis após autorização). O Mercado Pago **exige** que o CVV seja re-inserido pelo usuário a cada cobrança com cartão salvo — ele nunca é persistido, nem pelo MP.

**Consequência prática:** Cobranças automáticas silenciosas via cartão (como `processAutoBuy`) são impossíveis de implementar com cartão de crédito/débito. A recompra automática só funciona com Pix.

**Prevenção:**
- O CVV deve ser capturado exclusivamente pelo Brick do MP no frontend — nunca chegar ao backend como campo aberto
- Para cobranças recorrentes automáticas, usar apenas Pix; cartão salvo é para recompra manual (usuário toca, Brick pede CVV, submete)
- Documentar explicitamente esse limite na spec antes de comprometer UX de "compra em 1 toque" com cartão

**Fase afetada:** Feature de cartão salvo + qualquer fluxo de recompra automática

---

### Armadilha 1.3 — Criação duplicada de Customer no Mercado Pago

**Risco:** MÉDIO
**Impacto:** Clientes com múltiplos perfis no MP; cartões salvos ficam fragmentados entre perfis

**O que ocorre:** A criação do Customer MP é feita via `POST /v1/customers` com e-mail. Se a feature for chamada duas vezes para o mesmo usuário (retry, duplicação de request), o MP pode criar dois Customers com o mesmo e-mail. Operações futuras de busca por e-mail retornam lista, não um único registro.

**Prevenção:**
- Antes de criar, sempre fazer `GET /v1/customers/search?email={email}` e reutilizar se já existir
- Persistir `mpCustomerId` no banco na primeira criação e verificar esse campo antes de chamar a API
- Tratar a criação como upsert: busca primeiro, cria só se não encontrar

**Fase afetada:** Cadastro de cartão (primeira vez que usuário salva um cartão)

---

### Armadilha 1.4 — Cartão expirado ou banido detectado somente no momento do pagamento

**Risco:** MÉDIO
**Impacto:** UX ruim; créditos não comprados quando usuário esperava recompra automática

**O que ocorre:** O MP não notifica proativamente quando um cartão salvo expira ou é bloqueado pelo banco emissor. O erro só aparece no momento da tentativa de pagamento. No fluxo de recompra automática, o usuário pode não perceber a falha até notarem saldo zero.

**Prevenção:**
- Ao exibir a lista de cartões salvos, checar o campo `expiration_year`/`expiration_month` do `card_id` via `GET /v1/customers/{customer_id}/cards/{card_id}` e marcar visualmente cartões expirados
- Quando a cobrança falhar com `cc_rejected_bad_filled_date`, `cc_rejected_blacklist` ou equivalente, enviar notificação push orientando o usuário a atualizar o cartão
- Nunca tentar retry automático de cobrança recusada sem intervenção do usuário (risco de bloqueio anti-fraude no banco)

**Fase afetada:** Feature de cartão salvo e recompra manual

---

## 2. Migração de Schema para Múltiplos Slots de Agenda

### Armadilha 2.1 — `@@unique([userId, condominiumId])` bloqueia múltiplos slots por upsert (CRÍTICA)

**Risco:** ALTO
**Impacto:** Se o schema for alterado sem migração dos dados existentes, todos os schedules ativos existentes ficam inacessíveis para o novo modelo, ou o `prisma db push` falha ao tentar dropar o índice com dados

**O que ocorre atualmente:**
- `Schedule` tem `@@unique([userId, condominiumId])` → garante 1 registro por usuário por condomínio
- `schedules.repository.ts` usa `upsert` com `where: { userId_condominiumId: { userId, condominiumId } }`

**Para múltiplos horários**, é necessário:
1. Remover `@@unique([userId, condominiumId])` do schema
2. O índice precisa incluir também o `deliveryTime` (agora vindo de `DeliverySlot`): `@@unique([userId, condominiumId, deliverySlotId])`
3. Todos os registros existentes precisam ter `deliverySlotId` preenchido antes do `prisma db push`

**Sequência segura de migração no MongoDB Atlas:**
```
Passo 1: Adicionar campo deliverySlotId como opcional no schema (prisma db push)
          → documentos existentes ficam com deliverySlotId: null (não quebra leitura)

Passo 2: Rodar script de backfill:
          db.Schedule.updateMany(
            { deliverySlotId: { $exists: false } },
            { $set: { deliverySlotId: "<id_slot_padrao_0630>" } }
          )

Passo 3: Verificar que zero documentos têm deliverySlotId null

Passo 4: Remover @@unique([userId, condominiumId]) e adicionar
          @@unique([userId, condominiumId, deliverySlotId]) no schema
          → prisma db push

Passo 5: Remover índice antigo manualmente no Atlas se persistir
```

**Armadilha dentro da armadilha:** O Prisma para MongoDB não tem `prisma migrate` — usa `prisma db push`. Se o índice antigo `userId_condominiumId` ainda existir e houver documentos com a mesma combinação (o que é verdade para todos os schedules existentes ao tentar duplicar para um segundo slot), o novo `prisma db push` que tentar criar o índice composto pode conflitar.

**Prevenção:** Executar o backfill em horário de baixo tráfego; manter o campo `deliverySlotId` como opcional durante a janela de migração; nunca remover o índice antigo e adicionar o novo em um único `db push` se houver dados existentes sem o campo novo.

**Fase afetada:** Qualquer fase que altere o model `Schedule`

---

### Armadilha 2.2 — Campo `deliveryTime` string vs. referência a `DeliverySlot` (collection nova)

**Risco:** MÉDIO
**Impacto:** Dados históricos de agendamentos perdem a referência se o campo for simplesmente renomeado/removido

**O que ocorre:** O schema atual tem `deliveryTime: String` hardcoded no `Schedule`. A feature pede horários configuráveis por condomínio, o que requer uma nova collection `DeliverySlot` com relação `condominiumId → [slots]`. A migração de `deliveryTime: "06:30"` para `deliverySlotId: ObjectId` precisa encontrar (ou criar) o slot correspondente antes de apagar o campo antigo.

**Prevenção:**
- Manter `deliveryTime` como campo legado durante a transição (não remover imediatamente)
- O script de backfill deve: (1) garantir que os dois slots padrão (06:30 e 15:30) existem no `DeliverySlot` para cada condomínio antes de rodar, (2) mapear `deliveryTime: "06:30"` → ID do slot 06:30 do condomínio do usuário
- Somente remover `deliveryTime` do schema depois que 100% dos documentos tiverem `deliverySlotId` preenchido

**Fase afetada:** Introdução da collection `DeliverySlot`

---

## 3. Múltiplos Horários de Entrega + Cron de Meia-noite

### Armadilha 3.1 — `createDailyOrders` gerará Orders duplicados sem idempotência (CRÍTICA)

**Risco:** ALTO
**Impacto:** Créditos debitados múltiplas vezes para o mesmo usuário no mesmo dia; pedidos duplicados para o entregador

**O que ocorre atualmente:** `createDailyOrders()` itera em `findAllActive()` e cria 1 `Order` por schedule. Com múltiplos slots, um usuário pode ter 2 schedules ativos (manhã + tarde), o que gerará 2 Orders corretamente. O problema surge em dois cenários:

1. **Cron executado duas vezes** (restart do servidor ao meio-dia, PM2 em cluster mode com múltiplas instâncias): o cron roda de novo para `scheduledDate` do dia seguinte que já foi processado, criando Orders duplicados e debitando créditos dobrado
2. **Retry em erro parcial**: se o loop falhar no usuário N e o cron for reiniciado manualmente, todos os usuários de 1 a N-1 terão Orders duplicados

**Prevenção — implementar idempotência por `(userId, scheduledDate, deliverySlotId)`:**
```typescript
// Em vez de tx.order.create direto, usar findFirst antes:
const existing = await tx.order.findFirst({
  where: { userId, scheduledDate, deliverySlotId }
})
if (existing) continue // idempotente — já processado
```
- Adicionar índice no MongoDB: `@@index([userId, scheduledDate])` no model `Order`
- Para PM2 em cluster: garantir que o cron só rode na instância 0 (`process.env.pm_id === '0'`)

**Fase afetada:** Qualquer expansão do cron de meia-noite ou do model Schedule

---

### Armadilha 3.2 — Múltiplos slots aumentam o volume de Orders por dia sem ajuste no painel do entregador

**Risco:** MÉDIO
**Impacto:** O `CourierScreen` atual agrupa por condomínio assumindo 1 entrega por cliente por dia; com 2 slots, um mesmo cliente aparece duas vezes no mesmo condomínio, o que pode confundir o entregador

**Prevenção:**
- Ao implementar múltiplos slots, incluir `deliverySlotId` (ou `deliveryTime`) no `Order` para que o agrupamento no entregador filtre por slot atual
- O `GET /courier/orders/today` deve aceitar um parâmetro de filtro de slot ou retornar agrupado por slot

**Fase afetada:** Expansão do módulo courier junto com múltiplos slots

---

### Armadilha 3.3 — Timezone da meia-noite vs. condomínio em fuso diferente

**Risco:** BAIXO (Brasil tem poucos fusos)
**Impacto:** Pedidos gerados com `scheduledDate` errado para condomínios em Manaus (UTC-4) ou Acre (UTC-5)

**Estado atual:** `getTomorrowDate()` usa `Date.now() + 24h` (UTC puro, sem timezone explícito). O cron está correto para São Paulo (UTC-3), mas cria um risco latente se a operação expandir.

**Prevenção:** Usar `Intl.DateTimeFormat` com `timeZone: 'America/Sao_Paulo'` consistentemente (já feito em `getTomorrowDayKey`). Garantir que o mesmo padrão seja aplicado para `getTomorrowDate`.

**Fase afetada:** Expansão geográfica futura

---

## 4. Notificação Push de Crédito Manual (Admin → Cliente)

### Armadilha 4.1 — Usuário sem `oneSignalPlayerId` recebe créditos mas não recebe push (ESPERADO, mas precisa de fallback)

**Risco:** MÉDIO
**Impacto:** O admin adiciona créditos e considera a operação concluída, mas o cliente nunca é notificado

**O que ocorre:** Um usuário que nunca instalou o PWA como app nativo (ou negou permissão de push) não tem `oneSignalPlayerId` no banco. O código atual para notificações é best-effort (se não há `playerId`, silencioso). Para crédito manual, o silêncio é um problema de UX: o cliente pode perguntar "recebi créditos mas não vi nada".

**Prevenção:**
- A Notification in-app (`createAndTrim`) deve ser criada **independentemente** de haver `playerId` — ela aparece na central de notificações quando o usuário abre o app
- A push via OneSignal é camada adicional, nunca a única via
- Na tela admin de crédito manual, exibir ícone de alerta se o cliente não tiver `oneSignalPlayerId`

**Fase afetada:** Feature de crédito manual do admin

---

### Armadilha 4.2 — `include_subscription_ids` com array vazio causa erro 400 no OneSignal

**Risco:** MÉDIO
**Impacto:** Exceção não tratada no cron ou no endpoint de crédito manual quando nenhum usuário tem `playerId`

**O que ocorre:** O `sendReconfigureReminders` já trata esse caso (verifica `playerIds.length === 0` antes de chamar a API). Mas ao implementar crédito manual admin, se o admin tentar notificar um usuário sem `playerId` e o código chamar `createNotification` com `include_subscription_ids: []` ou `include_subscription_ids: [undefined]`, o OneSignal retorna erro 400 com mensagem genérica.

**Prevenção:**
- Sempre fazer `if (!user.oneSignalPlayerId) { /* skip push, apenas cria Notification in-app */ return }`
- Nunca passar `undefined` ou string vazia no array de IDs
- O erro do OneSignal é try-catched silenciosamente no padrão atual — mas a Notification in-app deve ser criada antes do try-catch do push, não dentro dele

**Fase afetada:** Feature de crédito manual e qualquer novo fluxo de push

---

### Armadilha 4.3 — `player_id` obsoleto após reinstalação do PWA

**Risco:** BAIXO-MÉDIO
**Impacto:** Push enviado para `playerId` antigo falha silenciosamente; cliente pensa que notificação não veio

**O que ocorre:** Quando um usuário remove e reinstala o PWA (ou limpa dados do browser), o OneSignal gera um novo Subscription ID. O `oneSignalPlayerId` no banco do Cheirin fica obsoleto. O push é enviado sem erro 400 (o OneSignal aceita o request), mas a entrega falha com "Not Subscribed". Isso não é reportado de volta como erro no `createNotification` — o response HTTP é 200.

**Prevenção:**
- No `ClientLayout` ou no bootstrap do app, chamar `POST /users/push-token` sempre que o `OneSignal.User.pushSubscription.id` disponível no SDK for diferente do último enviado (comparar com valor local em `localStorage`)
- O `savePushToken` é idempotente (já implementado), então a chamada extra é segura

**Fase afetada:** Manutenção contínua de todas as features de push

---

### Armadilha 4.4 — iOS só recebe push se o PWA estiver instalado na tela inicial

**Risco:** MÉDIO
**Impacto:** Porcentagem significativa de usuários iOS nunca receberá push se usarem o app pelo browser sem instalar

**O que ocorre:** Web Push API no Safari iOS só funciona para PWAs instaladas (adicionadas à tela inicial via "Adicionar à tela de início"). Usuários que acessam pelo browser padrão do iOS não recebem push, independentemente do OneSignal.

**Prevenção:**
- Na tela de configurações/perfil, verificar se `Notification.permission` é `"default"` ou `"denied"` e exibir instrução contextual de instalação no iOS
- Não bloquear o fluxo de cadastro pela falta de `playerId`; a Notification in-app é sempre o fallback

**Fase afetada:** Feature de crédito manual, todas as features de push

---

## 5. Edição de Perfil com Validação Brasileira

### Armadilha 5.1 — Mudança de telefone sem invalidação de sessão ativa (CRÍTICA DE SEGURANÇA)

**Risco:** ALTO
**Impacto:** Atacante que obteve acesso à conta pode alterar o telefone de autenticação sem ser deslogado; owner legítimo perde acesso

**O que ocorre:** O fluxo de mudança de telefone exige OTP para o novo número. Mas se o código apenas atualiza `User.phone` após validação do OTP sem revogar as Sessions existentes, qualquer dispositivo já autenticado continua ativo. Isso é especialmente crítico porque o login do sistema é baseado em phone/email OTP — alterar o phone é equivalente a mudar a senha.

**Prevenção:**
- Ao confirmar mudança de telefone com OTP, revogar todas as Sessions do usuário (`isRevoked: true`) exceto a sessão que está fazendo a mudança
- Emitir novo token para a sessão atual com o novo telefone
- Nunca reutilizar o OTP de login como OTP de mudança de telefone (endpoints diferentes, contextos diferentes)

**Fase afetada:** Feature de edição de perfil

---

### Armadilha 5.2 — CPF deve ser imutável após cadastro

**Risco:** ALTO (compliance/fraude)
**Impacto:** Fraude de identidade; inconsistência com histórico financeiro/fiscal do usuário

**O que ocorre:** O CPF é o identificador único de pessoa física no Brasil e está vinculado ao histórico de pagamentos, transações e CreditTransactions do sistema. Permitir edição abre vetor para um usuário trocar de identidade após acumular débitos ou chargebacks.

**Prevenção:**
- O endpoint `PATCH /users/me` não deve aceitar o campo `cpf` na lista de campos editáveis
- No frontend, exibir o CPF apenas como leitura (com máscara `xxx.xxx.xxx-xx`) sem campo de edição
- Se um CPF foi digitado errado no cadastro, o fluxo correto é contato com o Admin — não edição self-service

**Fase afetada:** Feature de edição de perfil

---

### Armadilha 5.3 — CPF duplicado na troca de condomínio (edge case de unicidade)

**Risco:** MÉDIO
**Impacto:** `prisma db push` ou `upsert` falha com erro de índice único; usuário não consegue atualizar condomínio

**O que ocorre:** O `User.cpf` tem `@unique` no schema. Esse é o CPF do usuário, que nunca muda. O problema ocorre em outro cenário: ao criar um usuário no sistema, se o formulário de onboarding for submetido duas vezes (duplo tap, retry de network), dois documentos com o mesmo CPF são inseridos antes do índice único ser verificado (janela de race condition no MongoDB sem transação no `create`).

**Prevenção:**
- O `POST /auth/register` deve usar `upsert` ou `findFirst` + `create` dentro de `$transaction` para evitar criação duplicada
- Retornar erro 409 com mensagem clara ("CPF já cadastrado") em vez de 500 quando o índice rejeitar

**Fase afetada:** Atual fluxo de cadastro (bug latente) + edição de perfil

---

### Armadilha 5.4 — Mudança de condomínio invalida o Schedule existente silenciosamente

**Risco:** MÉDIO
**Impacto:** Usuário muda de condomínio, o schedule antigo continua ativo para o condomínio velho, e Orders continuam sendo criados para entrega no endereço errado

**O que ocorre:** O `Schedule` tem `condominiumId` como campo. Se o usuário editar `User.condominiumId` via edição de perfil, o schedule não é atualizado automaticamente. O cron de meia-noite vai criar Orders com o `condominiumId` do schedule (antigo), não do `User`.

**Prevenção:**
- Ao atualizar `User.condominiumId`, sempre executar:
  1. `Schedule.updateMany({ userId }, { isActive: false })` — desativar schedules do condomínio antigo
  2. Exibir mensagem no app: "Condomínio atualizado. Reconfigure sua agenda de entregas."
- Nunca transferir/migrar o schedule automaticamente para o novo condomínio sem confirmação do usuário (os horários disponíveis podem ser diferentes)

**Fase afetada:** Feature de edição de perfil + integridade do schedule

---

### Armadilha 5.5 — Race condition em mudança de e-mail + telefone simultâneos

**Risco:** BAIXO-MÉDIO
**Impacto:** Usuário consegue contornar a verificação OTP ao submeter mudança de telefone e e-mail em paralelo

**O que ocorre:** Se o endpoint de edição de perfil aceitar `phone` e `email` no mesmo request, e a verificação OTP for feita para apenas um deles, o outro campo pode ser alterado sem verificação. Em tese, um atacante com acesso à sessão pode enviar dois requests paralelos para contornar a validação.

**Prevenção:**
- Tratar mudança de telefone e mudança de e-mail como operações separadas, cada uma com seu próprio fluxo de OTP
- O endpoint `PATCH /users/me` não deve aceitar `phone` e `email` diretamente; deve existir `POST /users/me/change-phone` e `POST /users/me/change-email` com fluxos OTP independentes

**Fase afetada:** Feature de edição de perfil

---

## Tabela de Priorização por Fase

| Armadilha | Criticidade | Feature Afetada | Endereçar na Fase |
|-----------|-------------|-----------------|-------------------|
| 1.1 — cardTokenMp não é card_id | CRÍTICA | Cartões salvos | Início da feature de cartões salvos |
| 1.2 — CVV não pode ser armazenado | CRÍTICA | Auto-recompra cartão | Spec da feature (antes de implementar) |
| 2.1 — @@unique bloqueia múltiplos slots | CRÍTICA | Múltiplos horários | Wave 0 da feature de slots múltiplos |
| 3.1 — createDailyOrders sem idempotência | CRÍTICA | Cron multi-slot | Antes de expandir createDailyOrders |
| 5.1 — Mudança de telefone sem revogar sessão | CRÍTICA | Edição de perfil | Implementação do endpoint change-phone |
| 5.2 — CPF imutável | ALTA | Edição de perfil | Schema/validação da feature |
| 1.3 — MP Customer duplicado | MÉDIA | Cartões salvos | Implementação do upsert de Customer |
| 1.4 — Cartão expirado detectado tarde | MÉDIA | Cartões salvos | UI da lista de cartões |
| 2.2 — deliveryTime vs deliverySlotId | MÉDIA | Schema migration | Script de backfill |
| 3.2 — Volume de Orders no app entregador | MÉDIA | Courier + multi-slot | Feature courier expandida |
| 4.1 — Sem playerId, sem push | MÉDIA | Crédito manual | Implementação da Notification in-app |
| 4.2 — Array vazio no OneSignal | MÉDIA | Todos os pushes | Sempre verificar antes de chamar API |
| 4.4 — iOS exige PWA instalado | MÉDIA | Push notifications | UX da tela de configurações |
| 5.4 — Mudança de condomínio não desativa schedule | MÉDIA | Edição de perfil | Transação de update de condomínio |
| 4.3 — playerId obsoleto após reinstalação | BAIXA-MÉDIA | Push notifications | Bootstrap do ClientLayout |
| 3.3 — Timezone de condomínios fora de SP | BAIXA | Cron | Revisão de getTomorrowDate |
| 5.3 — CPF duplicado race condition | MÉDIA | Cadastro (bug latente) | Correção no auth.service register |
| 5.5 — Race condition phone+email | BAIXA-MÉDIA | Edição de perfil | Separar endpoints de mudança |

---

## Fontes

- Mercado Pago Developers — Cards and Customers Management: https://www.mercadopago.com.ar/developers/en/docs/checkout-api/cards-and-customers-management/receive-payments-with-saved-cards
- Mercado Pago — Save card reference: https://www.mercadopago.com.ar/developers/en/reference/cards/_customers_customer_id_cards/post
- Mercado Pago — Card token generation errors: https://www.mercadopago.com.mx/developers/en/docs/checkout-api/error-messages/card-token-creation-errors
- MongoDB Community — Schema migration patterns: https://www.mongodb.com/community/forums/t/best-practices-for-schema-management-migrations-and-scaling-in-mongodb/306805
- Prisma — MongoDB limitations: https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/limitations-and-known-issues
- node-cron — PM2 cluster duplicate execution: https://github.com/node-cron/node-cron/issues/393
- OneSignal — Web push not shown: https://documentation.onesignal.com/docs/en/notifications-not-shown-web-push
- OneSignal Node API — include_subscription_ids bug: https://github.com/OneSignal/onesignal-node-api/issues/67
- PCI DSS — Tokenization guidelines: https://www.sisainfosec.com/blogs/what-is-pci-dss-tokenization-its-guidelines-explained/
- Código fonte analisado: `apps/api/src/modules/schedules/schedules.service.ts`, `apps/api/src/plugins/cron.ts`, `apps/api/prisma/schema.prisma`
