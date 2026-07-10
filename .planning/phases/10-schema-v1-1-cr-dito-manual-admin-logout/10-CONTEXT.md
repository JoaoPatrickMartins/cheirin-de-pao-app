# Phase 10: Schema v1.1 + Crédito Manual Admin + Logout - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Esta fase entrega 3 blocos funcionais independentes:

1. **Schema v1.1 unificado** — `prisma db push` com todos os campos preparatórios para o milestone v1.1: `ADMIN_GRANT` no `TransactionType`, `CREDIT_GRANTED` no `NotificationType`, `adminId`/`reason` no `CreditTransaction`, `User.mpCustomerId`, model `SavedCard`, `Condominium.deliverySlots String[]` e `Schedule.days Json?`. Uma migração única que desbloqueia Phases 11–14.

2. **Crédito manual admin (CREDM-01, 02, 03)** — Admin abre o `ClientDetailView`, toca em '+ Adicionar créditos' no card de saldo, preenche quantidade + motivo em modal, confirma. Backend registra `CreditTransaction` com `type=ADMIN_GRANT`, `adminId` e `reason`. Cliente recebe push + in-app `CREDIT_GRANTED`.

3. **Logout entregador + admin (LGOUT-01, 02)** — Ícone de logout no header do `CourierScreen` (sem confirmação) e item 'Sair' no `AdminBottomNav` (com dialog de confirmação). `AuthContext.logout()` já existe e é reutilizado por ambos.

**Requisitos desta fase:** CREDM-01, CREDM-02, CREDM-03, LGOUT-01, LGOUT-02 (5 requisitos)

</domain>

<decisions>
## Implementation Decisions

### Schema v1.1 — Escopo Completo

- **D-01:** Schema v1.1 aplica **todos os campos de uma vez** nesta fase — uma única migração (`prisma db push`) que desbloqueia Phases 11–14. Não dividir em parciais.
- **D-02:** Campos adicionados ao schema:
  - `TransactionType.ADMIN_GRANT` — novo enum value
  - `NotificationType.CREDIT_GRANTED` — novo enum value
  - `CreditTransaction.adminId String? @db.ObjectId` — quem fez o grant
  - `CreditTransaction.reason String?` — motivo do grant (acerto/bonificação/compensação/promoção)
  - `User.mpCustomerId String?` — prep Phase 12 (MP Customer API)
  - model `SavedCard` (schema mínimo viável — ver D-07)
  - `Condominium.deliverySlots String[]` — prep Phase 13 (array de strings HH:MM)
  - `Schedule.days Json?` — prep Phase 14 (nullable, mantém weeklyQty/deliveryTime)

### UI do Crédito Manual

- **D-03:** Botão '+ Adicionar créditos' aparece **dentro do card de saldo** no `ClientDetailView` — abaixo do número de créditos. Mais contextual: admin vê o saldo e age no mesmo lugar.
- **D-04:** Ao clicar, abre **modal centralizado** com overlay escuro (reutilizando o padrão `aria-modal="true"` já presente no `ClientDetailView` linha 490). Conteúdo: título "Adicionar Créditos", campo numérico de quantidade, chips de motivo, botões Cancelar/Confirmar.
- **D-05:** Seletor de motivo via **chips horizontais** (4 opções: Acerto, Bonificação, Compensação, Promoção) — reutiliza padrão `SegmentedControl` do projeto.
- **D-06:** Após confirmar com sucesso: modal fecha, **saldo atualizado imediatamente** no card (fetch do saldo atualizado), toast de sucesso ('X créditos adicionados a [nome]').

### Model SavedCard (mínimo viável para Phase 12)

- **D-07:** Model `SavedCard` com campos mínimos:
  ```
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  userId     String   @db.ObjectId
  mpCardId   String   // token MP Customer API
  brand      String   // 'visa', 'master', etc.
  lastFour   String
  expiresAt  String   // 'MM/YY'
  isDefault  Boolean  @default(false)
  createdAt  DateTime @default(now())
  ```
  CVV não é salvo (D-16 de fases anteriores — PCI DSS).

### Logout

- **D-08:** Entregador: **ícone de logout** (`LogOut` de lucide-react) no canto superior direito do header do `CourierScreen`. Sem dialog de confirmação — ação direta.
- **D-09:** Admin: **item 'Sair'** (ícone + label) como último item do `AdminBottomNav`. Ao tocar, exibe **dialog de confirmação** ("Sair da conta? Você será redirecionado para a tela de login.") com botões Cancelar / Sair.
- **D-10:** Ambos chamam `AuthContext.logout()` que já implementa remoção do localStorage + `navigate('/')`.

### Notificação CREDM

- **D-11:** Novo tipo no enum: `NotificationType.CREDIT_GRANTED`.
- **D-12:** Push OneSignal: título `'Pãezinhos chegando! 🥐'`, corpo `'Você ganhou {N} pão(es) de crédito. Seu novo saldo é {total} pão(es).'` — tom informal, consistente com `CREDIT_PURCHASED`.
- **D-13:** Notificação in-app persistida com `type=CREDIT_GRANTED`, `actionRoute: '/client/home'`.
- **D-14:** `CTA_CONFIG` na `NotificationsScreen` recebe entrada para `CREDIT_GRANTED`: `{ label: 'Ver saldo', path: '/client/home' }`.
- **D-15:** Push OneSignal para `CREDIT_GRANTED` usa `additionalData: { screen: 'home' }` para deep link via `useOneSignalDeepLink`.

### Claude's Discretion

- Validação do campo quantidade no modal (mínimo 1, máximo razoável — Claude define).
- Ícone específico do botão de logout do entregador (sugestão: `LogOut` de lucide-react já instalado).
- Cores dos chips de motivo quando selecionado (seguir padrão do SegmentedControl existente).
- Posicionamento exato do item 'Sair' no `AdminBottomNav` — último tab, com ícone `LogOut`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos e Regras de Negócio
- `.projeto/Cheirin_de_Pao_Requisitos_v01.md` §CREDM — CREDM-01, CREDM-02, CREDM-03 (crédito manual admin)
- `.projeto/Cheirin_de_Pao_Requisitos_v01.md` §LGOUT — LGOUT-01, LGOUT-02 (logout entregador e admin)
- `.projeto/Cheirin_de_Pao_Modelo_Funcionamento.md` — modelo de negócio: ciclo de créditos e notificações

### Schema Prisma
- `apps/api/prisma/schema.prisma` — schema atual (base para as alterações v1.1). **Leitura obrigatória** antes de modificar.

### Código Existente — Frontend (pontos de integração)
- `apps/web/src/components/admin/ClientDetailView.tsx` — componente do detalhe do cliente. Card de saldo na linha 325–335, modal existente com `aria-modal` na linha 490. Adicionar botão e modal CREDM aqui.
- `apps/web/src/pages/admin/AdminLayout.tsx` — layout do admin com `AdminBottomNav`. Adicionar item 'Sair' aqui.
- `apps/web/src/pages/courier/CourierScreen.tsx` — tela do entregador com header. Adicionar ícone de logout no header (linha 80+).
- `apps/web/src/contexts/AuthContext.tsx` — `logout()` implementado nas linhas 63–76. Reutilizar diretamente.
- `apps/web/src/pages/client/NotificationsScreen.tsx` — `CTA_CONFIG` para adicionar entrada `CREDIT_GRANTED`.
- `apps/web/src/hooks/useOneSignalDeepLink.ts` — handler de deep link push. Adicionar case `screen: 'home'` para CREDIT_GRANTED.

### Código Existente — Backend
- `apps/api/src/modules/admin-clients/` (ou caminho equivalente) — rota do detalhe do cliente admin. Adicionar `POST /admin/clients/:id/grant-credits`.
- `apps/api/src/modules/notifications/notifications.service.ts` — `createAndTrim()`, `markAllRead()`. Reutilizar para persistir CREDIT_GRANTED.
- `apps/api/src/modules/credits/credits.service.ts` (ou equivalente) — lógica de incremento de `creditBalance`. Reutilizar/estender para ADMIN_GRANT.

### Design e UI
- `.projeto/design_handoff_cheirin_pao/app/` — handoff de design para referência de estilos (chips, modais, BottomNav).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AuthContext.logout()` — já implementado (remove localStorage + navigate('/')). Reutilizar diretamente nos dois botões de logout.
- `SegmentedControl` (genérico, Phase 7) — reutilizar como chips de motivo no modal de grant.
- Modal com `aria-modal="true"` em `ClientDetailView.tsx` — padrão já estabelecido no componente; adicionar novo modal seguindo a mesma estrutura.
- `notifyAndPersist()` em `admin-orders.service.ts` — padrão de push + persist Notification. Replicar para CREDIT_GRANTED.
- `useOneSignalDeepLink.ts` — estender com case `screen: 'home'` (mesmo padrão dos cases `pedidos` e `notificacoes` da Phase 9).

### Established Patterns
- `TransactionType` é enum no schema — adicionar `ADMIN_GRANT` como novo value (sem migration forçada no MongoDB, é schemaless).
- `NotificationType` é enum no schema — adicionar `CREDIT_GRANTED` como novo value.
- `CreditTransaction` é imutável (sem `updatedAt`) — `adminId` e `reason` são campos opcionais adicionados como nullable.
- `AdminBottomNav` recebe tabs como array/prop — verificar estrutura antes de adicionar item 'Sair'.
- Toast de sucesso — verificar padrão existente no projeto (lib de toast usada nas telas existentes).

### Integration Points
- `ClientDetailView` → novo endpoint `POST /admin/clients/:id/grant-credits` → `CreditTransaction` (ADMIN_GRANT) + `User.creditBalance` +1 + push OneSignal + Notification in-app.
- `CourierScreen` header → `AuthContext.logout()` → redirect `/`.
- `AdminBottomNav` item 'Sair' → dialog confirm → `AuthContext.logout()` → redirect `/`.
- `NotificationsScreen.CTA_CONFIG` → novo entry `CREDIT_GRANTED` → `useOneSignalDeepLink` case `home`.

</code_context>

<specifics>
## Specific Ideas

- **Copywriting push CREDM**: `'Pãezinhos chegando! 🥐'` / `'Você ganhou {N} pão(es) de crédito. Novo saldo: {total} pão(es).'` — tom informal, estilo Cheirin de Pão.
- **Dialog logout admin**: `"Sair da conta? Você será redirecionado para a tela de login."` com botões `[Cancelar]` / `[Sair]`.
- **Logout entregador**: ícone discreto no canto superior direito do header, sem confirmação (ação rápida).
- **Modal grant**: quantidade mínima 1, motivos como chips clicáveis com estado selected/unselected, confirmar desabilitado até preencher quantidade e motivo.

</specifics>

<deferred>
## Deferred Ideas

- Histórico de ADMIN_GRANTs visível ao cliente no extrato de créditos → defer v2 (decidido em fases anteriores).
- Motivo customizado (campo livre além das 4 opções) → fora do escopo CREDM-01.

</deferred>

---

*Phase: 10-schema-v1-1-credito-manual-admin-logout*
*Context gathered: 2026-06-19*
