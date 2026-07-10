# Phase 7: Admin Panel - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin tem controle total da operação diária e da gestão do sistema. Entrega 5 áreas funcionais acessíveis via tab bar inferior (Painel, Pedido, Entregas, Clientes, Gestão):

- **Painel**: dashboard com métricas do dia e financeiro resumido
- **Pedido**: geração do pedido ao fornecedor com fluxo de 4 etapas (Conferir → Ajustar → Dividir → Pronto), download PDF e Excel
- **Entregas**: divisão sugerida de condomínios entre entregadores com aprovação do Admin + dashboard de entregas do dia por condomínio
- **Clientes**: lista com filtro por condomínio, detalhe com histórico de agendamentos, bloquear/desbloquear
- **Gestão**: CRUD de condomínios, combos (com promoções), compra personalizada, fornecedores, entregadores, pagamentos e financeiro

27 requisitos: ADMO-01..11, ADMG-01..11, ADMF-01..04, PAY-03, PAY-04, UI-09.

</domain>

<decisions>
## Implementation Decisions

### Navegação Frontend Admin (UI-09)
- **D-01:** Tab navigation como **estado interno no AdminLayout** (`tab: 'painel' | 'pedido' | 'entregas' | 'clientes' | 'gestao'`) — sem React Router sub-rotas para as 5 abas principais. URL permanece `/admin`. Fiel ao comportamento do handoff (`screens-admin.jsx`).
- **D-02:** Sub-telas dentro de cada aba (detalhe de cliente, formulário de cadastro, etc.) navegam via **stack de estado interno por aba** (`sub: null = lista | 'detalhe' | 'criar' | 'editar'`). Botão "Voltar" = `setSub(null)`. Padrão já demonstrado no handoff (`AdminClientes` com `sel null/id`).
- **D-03:** Formulários de CRUD (condomínios, combos, fornecedores, entregadores) abrem como **tela separada no stack** (`sub = 'criar' | 'editar'`), não bottom sheet. Formulários ocupam a tela toda — consistente para entidades com muitos campos (ex: Fornecedor tem CNPJ, contato, endereço, preço).

### Estorno e Pagamentos (PAY-03 + PAY-04)
- **D-04:** Estorno via Mercado Pago é **somente total** no MVP — uma chamada à API do MP com o `payment_id`. Sem estorno parcial.
- **D-05:** Ao confirmar estorno: **créditos removidos automaticamente** do saldo do cliente — sistema debita os créditos daquele pagamento do `creditBalance`. Se o cliente já consumiu parte dos créditos, debita apenas o restante disponível. Consistência: crédito só existe se pago.
- **D-06:** Tela de pagamentos (PAY-03): **lista somente leitura** com status (pago, estornado, pendente) + ao tocar num pagamento abre **tela de detalhe** com informações completas e botão "Estornar" (disponível apenas para `Payment.status === 'PAID'` — enum `PaymentStatus = PENDING | PAID | FAILED | REFUNDED`).

### Geração de PDF e Excel (ADMO-08)
- **D-07:** Backend gera ambos os formatos: **PDF via pdfmake** + **Excel via exceljs**. API retorna arquivo para download (endpoint dedicado por formato). Consistente em qualquer dispositivo, sem dependência do browser.
- **D-08:** **Collection nova `SupplierOrder`** para histórico de pedidos ao fornecedor (ADMO-09). Independente da collection `Order` (que são pedidos de clientes). Armazena: data, fornecedor(es) com quantidades, total de pães, status (rascunho / confirmado).
- **D-09:** Fluxo do pedido ao fornecedor (4 etapas: Conferir → Ajustar → Dividir → Pronto) é **navegável livremente** — Admin pode voltar de qualquer etapa para a anterior. Apenas a confirmação final (`Pronto` + download) é irreversível e salva o `SupplierOrder`.

### Atribuição e Divisão de Entregadores (ADMO-11)
- **D-10:** Algoritmo de sugestão **híbrido**: prioriza atribuir condomínios inteiros a um entregador (sem dividir um condo), mas permite dividir a quantidade de um condomínio entre dois entregadores se necessário para balancear. Critério: equilibrar total de pães entre entregadores ativos.
- **D-11:** UI de aprovação com **drag and drop de condomínios** entre entregadores (Admin redistribui visualmente). Quando um condo é dividido entre dois, stepper ajusta a quantidade por entregador. Admin vê o total de pães por entregador em tempo real.
- **D-12:** Ao clicar "Aprovar divisão": dispara **`PATCH /admin/orders/assign-courier` em batch** imediatamente (uma chamada por entregador com os `orderIds` dos seus condomínios). Endpoint já existe da Fase 6 — reutilizar.

### Horário de Corte (ADMO-01..03)
- **Claude's Discretion:** Horário de corte configurável salvo como campo no documento de configuração global do sistema (ex: collection `Settings` com `cutoffTime: "20:00"`). Cron job verifica às XX:00 e bloqueia novos pedidos. Notificação push via OneSignal para clientes sem agendamento (ADMO-02).

### Promoções em Combos (ADMG-03)
- **Claude's Discretion:** Campo `discount` embed no documento Combo no schema Prisma (`discount: { type: 'percent' | 'fixed', value: number, expiresAt: DateTime? }`). Promoção sem `expiresAt` é permanente. Expiração verificada on-demand ao listar combos (sem cron para MVP).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Handoff (referência primária para todas as telas)
- `.projeto/design_handoff_cheirin_pao/app/screens-admin.jsx` — **referência primária Admin parte 1**: `AdminScreen` (nav inferior + 5 abas), `AdminHead`, `AdminPainel`, `AdminPedido` (fluxo 4 etapas com Steps/Conferir/Ajustar/Dividir/Pronto), padrões de Card, Pill, Btn, Icon
- `.projeto/design_handoff_cheirin_pao/app/screens-admin2.jsx` — **referência primária Admin parte 2**: `AdminEntregas` (divisão sugerida + aprovação + agendadas vs realizadas), `AdminClientes` (lista filtro + detalhe + bloquear), `AdminGestao` (hub + sub-telas CRUD)
- `.projeto/design_handoff_cheirin_pao/README.md` — tokens de design (cores, tipografia, espaçamentos)
- `.projeto/design_handoff_cheirin_pao/app/brand.jsx` — primitivas UI (`Card`, `Pill`, `Btn`, `Icon`, `BreadMark`, tokens)

### Requisitos e Domínio
- `.planning/REQUIREMENTS.md` §ADMO-01..11, §ADMG-01..11, §ADMF-01..04, §PAY-03, §PAY-04, §UI-09 — 27 requisitos desta fase
- `.planning/phases/07-admin-panel/07-CONTEXT.md` — este arquivo

### Fases Anteriores (dependências diretas)
- `.planning/phases/06-courier-app/06-CONTEXT.md` — decisões de atribuição de entregadores, endpoint `assign-courier`, schema `courierId` em Order
- `.planning/phases/05-delivery-experience/05-CONTEXT.md` — decisões de transição de status, notificações push, módulo admin-orders
- `apps/api/src/modules/admin-orders/admin-orders.route.ts` — endpoint `PATCH /admin/orders/assign-courier` a ser reutilizado pela UI de atribuição
- `apps/api/src/modules/admin-orders/admin-orders.service.ts` — lógica de transição de status + push (reutilizar no fluxo de entregas)

### Padrões de Código Existentes
- `apps/web/src/pages/admin/AdminLayout.tsx` — layout admin atual (placeholder) — substituir nesta fase
- `apps/api/src/plugins/authenticate.ts` — `requireAdmin` guard para proteger rotas admin
- `apps/api/src/modules/notifications/notifications.service.ts` — OneSignal push (reutilizar para notificação de corte ADMO-02)
- `apps/api/src/modules/payments/` — módulo de pagamentos (referência para endpoint de estorno MP)
- `apps/api/src/plugins/cron.ts` — padrão de cron jobs (referência para cron de horário de corte)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/pages/admin/AdminLayout.tsx` — guard de role ADMIN pronto; `<Outlet />` a ser substituído por tab navigation de estado
- `apps/api/src/modules/admin-orders/admin-orders.route.ts` + `admin-orders.service.ts` — `PATCH /admin/orders/assign-courier` já implementado; reutilizar para aprovar divisão de entregadores
- `apps/api/src/modules/notifications/notifications.service.ts` — `sendPushNotification()` já usa OneSignal SDK; importar para notificação de corte
- `apps/api/src/plugins/cron.ts` — padrão de cron jobs com `NODE_ENV !== 'test'` guard (referência para cron de horário de corte)
- `apps/api/src/plugins/authenticate.ts` — `requireAdmin` guard para todas as novas rotas admin

### Established Patterns
- Módulos API: `*.route.ts` → `*.controller.ts` → `*.service.ts` → `*.repository.ts`
- Autenticação admin: `preHandler: [fastify.authenticate]` + check de role `ADMIN` no controller
- Zod schemas em `*.schema.ts`; validação no controller antes de chamar service
- Tab navigation com estado interno: padrão `AdminClientes` (`sel: null | number`) e `AdminGestao` (`sub: null | string`) do handoff são o modelo para todo o admin
- Commits atômicos por tarefa; `SUMMARY.md` obrigatório ao final de cada plano

### Integration Points
- Schema Prisma: adicionar collection `SupplierOrder` + campo `discount` embed em `Combo` + `cutoffTime` em `Settings` + `status` enum em `Payment`
- `apps/api/src/server.ts` — registrar novos módulos: `adminCondominiums`, `adminCombos`, `adminSuppliers`, `adminCouriers`, `adminClients`, `adminFinancial`, `adminSupplierOrders`
- `apps/web/src/routes/router.tsx` — AdminLayout recebe sub-rotas ou é standalone `/admin` com estado interno (D-01: estado interno, sem sub-rotas)
- Mercado Pago API: endpoint de estorno (`POST /v1/payments/{id}/refunds`) a ser chamado pelo `payments.service.ts`
- pdfmake + exceljs: dependências novas a adicionar em `apps/api/package.json`

</code_context>

<specifics>
## Specific Ideas

- **Tab bar Admin**: 5 itens (Painel/Pedido/Entregas/Clientes/Gestão) com ícones e labels — fiel ao handoff `screens-admin.jsx` `nav` array. Aba ativa: cor espresso/dourado; inativa: `textTer`.
- **AdminHead**: cabeçalho padrão de seção admin com BreadMark 27px dourado + título Bricolage Grotesque 20px — reutilizar o componente do handoff em todas as abas.
- **Fluxo Pedido ao Fornecedor**: barra de progresso de 4 etapas com cor dourada nas completadas. Divisão entre fornecedores: principal (75%) e reserva (25%) como sugestão inicial ajustável via steppers.
- **Divisão de entregadores**: card espresso com "Divisão sugerida" + ícone de spark dourado. Após aprovar, card muda para borda verde + pill "Aprovada". Fiel ao `AdminEntregas` do handoff.
- **Detalhe de cliente**: Admin vê saldo de créditos, última compra, agendamento semanal — somente leitura. Botão "Bloquear/Desbloquear" no final. Nota: "O admin apenas visualiza os dados do cliente — não edita o cadastro."
- **Financeiro**: gráfico de barras (fornadas por dia) + receita por tipo (combos vs avulso) com barra proporcional dourado/accent — fiel ao `AdminPainel` do handoff.

</specifics>

<deferred>
## Deferred Ideas

- **OSRM self-hosted no VPS** para produção com volume maior — pós-MVP
- **Estorno parcial** de pagamentos — pós-MVP (Fase 7 entrega apenas estorno total)
- **Drag and drop com reordenação otimizada geograficamente** — pós-MVP (MVP usa drag simples por volume)
- **Clustering geográfico na sugestão de atribuição** — pós-MVP (MVP usa balanceamento por volume de pães)
- **Tema escuro** — explicitamente fora de escopo no design handoff

### Reviewed Todos (not folded)
- "Documentação completa da API REST" — genérico demais para esta fase; não folded.

</deferred>

---

*Phase: 7-admin-panel*
*Context gathered: 2026-06-15*
