# Phase 7: Admin Panel - Research

**Researched:** 2026-06-15
**Domain:** Painel administrativo React PWA + API Fastify + Mercado Pago refund + pdfmake/exceljs + dnd-kit
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Tab navigation como estado interno no AdminLayout (`tab: 'painel' | 'pedido' | 'entregas' | 'clientes' | 'gestao'`) — sem React Router sub-rotas para as 5 abas principais. URL permanece `/admin`.

**D-02:** Sub-telas dentro de cada aba navegam via stack de estado interno por aba (`sub: null = lista | 'detalhe' | 'criar' | 'editar'`). Botão "Voltar" = `setSub(null)`.

**D-03:** Formulários de CRUD abrem como tela separada no stack (`sub = 'criar' | 'editar'`), não bottom sheet.

**D-04:** Estorno via Mercado Pago é somente total no MVP — uma chamada à API do MP com o `payment_id`. Sem estorno parcial.

**D-05:** Ao confirmar estorno: créditos removidos automaticamente do saldo do cliente — debita apenas o restante disponível.

**D-06:** Tela de pagamentos (PAY-03): lista somente leitura com status + sub-tela de detalhe com botão "Estornar" (disponível apenas para `status === 'APPROVED'`).

**D-07:** Backend gera PDF via pdfmake + Excel via exceljs. API retorna arquivo para download (endpoint dedicado por formato).

**D-08:** Collection nova `SupplierOrder` para histórico de pedidos ao fornecedor. NOTA: O schema Prisma já possui `PurchaseOrder` + `PurchaseOrderItem` — são exatamente essas coleções (nome diferente, mesma função).

**D-09:** Fluxo do pedido ao fornecedor (4 etapas) é navegável livremente — apenas a confirmação final (step Pronto) é irreversível.

**D-10:** Algoritmo de sugestão híbrido: prioriza condomínios inteiros por entregador, divide quantidade se necessário para balancear por volume de pães.

**D-11:** UI de aprovação com drag and drop de condomínios entre entregadores.

**D-12:** Ao aprovar divisão: `PATCH /admin/orders/assign-courier` em batch — endpoint já existe da Fase 6.

### Claude's Discretion

- **Horário de corte:** Campo `cutoffTime` no documento de configuração global (collection `Setting`, key `cutoffTime`). Cron job verifica a cada hora cheia e bloqueia novos pedidos. Notificação push via OneSignal para clientes sem agendamento (ADMO-02).

- **Promoções em Combos (ADMG-03):** O schema Prisma já possui model `Promotion` separado (mais normalizado). Usar o model `Promotion` existente — NÃO adicionar campo `discount` embed no Combo. Promoção ativa = `isActive: true` e `endsAt > now()` (ou null = permanente). Expiração verificada on-demand ao listar combos (sem cron para MVP).

### Deferred Ideas (OUT OF SCOPE)

- OSRM self-hosted para produção com volume maior — pós-MVP
- Estorno parcial de pagamentos — pós-MVP
- Drag and drop com reordenação otimizada geograficamente — pós-MVP
- Clustering geográfico na sugestão de atribuição — pós-MVP
- Tema escuro — explicitamente fora de escopo
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADMO-01 | Admin configura horário de corte diário | Setting 'cutoffTime' + cron node-cron v4 + endpoint PATCH /admin/settings |
| ADMO-02 | Clientes sem agendamento recebem push ao atingir corte | notifications.service.ts existente (sendPushNotification) — mesmo padrão dos crons Phase 4 |
| ADMO-03 | App exibe aviso ao cliente quando prazo encerrou | Frontend: verificar `cutoffTime` vs hora atual no card de atalho do Painel |
| ADMO-04 | Admin visualiza lista de entregas do dia por condomínio após corte | SCHEMA GAP: Order precisa de `condominiumId` — adicionar no Wave 0 |
| ADMO-05 | Admin gera pedido de compra ao fornecedor | PurchaseOrder + PurchaseOrderItem já no schema; endpoint POST /admin/supplier-orders |
| ADMO-06 | Admin ajusta quantidades antes de finalizar pedido | Step 1 do fluxo Pedido — steppers por condomínio, total calculado no frontend |
| ADMO-07 | Admin escolha fornecedor principal e divide pedido | Step 2 — Supplier.isPrincipal (SCHEMA GAP: campo precisa ser adicionado) + steppers acoplados |
| ADMO-08 | Relatório PDF e Excel para download | pdfmake v0.3 (getBuffer) + exceljs (writeBuffer) — verificados e funcionais em Node.js |
| ADMO-09 | Pedido salvo no histórico | PurchaseOrder status FINALIZED ao confirmar; GET /admin/supplier-orders para histórico |
| ADMO-10 | Dashboard de entregas — totais por dia, condomínio, entregador | Requer Order.condominiumId; aggregation via findMany + group no service |
| ADMO-11 | Sugestão automática de divisão; Admin aprova antes de iniciar | Algoritmo balanceamento por pães no service; dnd-kit/core para UI drag |
| ADMG-01 | CRUD de condomínios | Condominium model existente — novos endpoints /admin/condominiums |
| ADMG-02 | CRUD de combos | Combo model existente — novos endpoints /admin/combos |
| ADMG-03 | Promoções e descontos temporários em combos | Promotion model existente no schema — usar isActive + endsAt |
| ADMG-04 | Config compra personalizada — limite e preço unitário | Setting 'avulsoLimite' + 'avulsoUnit' já existem — endpoint PATCH /admin/settings |
| ADMG-05 | CRUD de fornecedores | Supplier model — adicionar `isPrincipal` Boolean no schema Wave 0 |
| ADMG-06 | CRUD de entregadores | User model com role=COURIER — criar via auth.service padrão existente |
| ADMG-07 | Ativar/desativar entregadores | PATCH /admin/couriers/:id — toggle isActive (campo precisa ser adicionado a User para COURIER) |
| ADMG-08 | Lista de clientes com saldo, condomínio, apartamento, última compra | GET /admin/clients — findMany Users com role=CLIENT |
| ADMG-09 | Filtrar clientes por condomínio | ?condominiumId query param no GET /admin/clients |
| ADMG-10 | Bloquear e desbloquear clientes | PATCH /admin/clients/:id/block — toggle User.isBlocked |
| ADMG-11 | Histórico de agendamentos e entregas de cada cliente (somente leitura) | GET /admin/clients/:id com Schedule + Orders |
| ADMF-01 | Receita por dia, semana, mês | Payment.aggregate(_sum amount) WHERE status=PAID + date range |
| ADMF-02 | Filtrar receita por condomínio | Requer join Payment → User.condominiumId — prisma.$runCommandRaw com $lookup |
| ADMF-03 | Receita por tipo: combos vs compra personalizada | GROUP BY comboId IS NULL: combos (comboId !== null) vs avulso (customQuantity !== null) |
| ADMF-04 | Lista de todos os pagamentos com detalhes | GET /admin/payments — findMany Payment com userId join |
| PAY-03 | Status de pagamento no painel Admin | GET /admin/payments com status enum (PENDING/PAID/FAILED/REFUNDED) — já no schema |
| PAY-04 | Admin estorna pagamentos | POST /admin/payments/:id/refund — PaymentRefund.total() do SDK mercadopago v3 |
| UI-09 | Navegação inferior Admin com 5 itens | AdminBottomNav com estado `tab` interno — sem React Router sub-rotas (D-01) |
</phase_requirements>

---

## Summary

Esta fase implementa o painel administrativo completo do Cheirin de Pão. O trabalho se divide em dois grandes blocos: **API Fastify** (7 novos módulos + cron de corte + geração de arquivos) e **UI React** (substituir AdminLayout placeholder por 5 abas com ~20 componentes novos).

A base de código existente está bem preparada: o modelo de dados no schema Prisma já contempla as principais coleções necessárias (PurchaseOrder, PurchaseOrderItem, Supplier, Promotion, Payment com status REFUNDED). Os padrões de módulo API (route → controller → service → repository), cron jobs e push OneSignal já estão consolidados. Os gaps de schema são pequenos e precisos: adicionar `condominiumId` em `Order` e `isPrincipal` em `Supplier`.

A maior superfície de risco está em três pontos: (1) pdfmake v0.3 tem API diferente do v0.2 — usa `getBuffer()` (não `getStream()`), e fontes built-in incluem Helvetica, sem necessidade de `vfs_fonts.js`; (2) estorno Mercado Pago usa a classe `PaymentRefund` do SDK (já exportada em `mercadopago` v3) com método `.total({ payment_id })` — não a classe `Payment`; (3) receita por condomínio (ADMF-02) requer join Payment → User → condominiumId, que no Prisma+MongoDB não pode usar `groupBy` diretamente — requer `$runCommandRaw` com pipeline `$lookup`.

**Primary recommendation:** Priorizar Wave 0 (schema Prisma + gerar cliente) antes de qualquer módulo de API ou UI. Os dois campos ausentes (`Order.condominiumId`, `Supplier.isPrincipal`) bloqueiam ADMO-04, ADMO-10, ADMO-11 e ADMG-05 inteiros.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tab navigation admin (UI-09) | Browser / Client (React state) | — | D-01: estado interno, URL única /admin |
| CRUD condomínios, combos, fornecedores, entregadores | API / Backend | Browser (forms) | Dados persistidos no MongoDB; frontend envia JSON |
| Geração PDF + Excel | API / Backend | — | D-07: backend gera buffer, retorna como download |
| Estorno Mercado Pago | API / Backend | — | Chave de acesso MP no servidor; nunca no cliente |
| Cron horário de corte | API / Backend (cron plugin) | — | Mesma estrutura do cron.ts existente |
| Algoritmo sugestão de divisão de entregadores | API / Backend | — | Regra de negócio complexa — não no cliente |
| Drag-and-drop redistribuição visual | Browser / Client (dnd-kit) | — | Só UI — aprovação final dispara API |
| Dashboard financeiro / métricas | API / Backend | Browser (render) | Agregações MongoDB via Prisma; frontend só exibe |
| Notificação push (ADMO-02) | API / Backend (OneSignal) | — | SDK OneSignal no servidor (já implementado) |
| Bloquear/desbloquear cliente | API / Backend | — | Altera User.isBlocked no banco |
| Settings cutoffTime | API / Backend (Setting key-value) | Browser (read) | Key 'cutoffTime' na collection Setting existente |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdfmake | 0.3.11 [VERIFIED: npm registry] | Geração de PDF no backend | Biblioteca madura (2014), pura JS, funciona com `getBuffer()` em Node.js sem dependências nativas |
| exceljs | 4.4.0 [VERIFIED: npm registry] | Geração de XLSX no backend | Padrão de mercado para Excel em Node.js; `writeBuffer()` retorna Buffer direto |
| @dnd-kit/core | 6.3.1 [VERIFIED: npm registry] | Drag-and-drop React (web + touch) | Acessível, sem DOM hacks, suporte nativo a TouchSensor para PWA mobile |
| @dnd-kit/sortable | 10.0.0 [VERIFIED: npm registry] | Listas sortáveis com dnd-kit | Complemento oficial do dnd-kit/core para listas reordenáveis |

### Supporting (já no projeto — reutilizar)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| mercadopago | ^3.1.0 [VERIFIED: codebase] | SDK MP — classe PaymentRefund | Estorno via `PaymentRefund.total({ payment_id })` |
| node-cron | ^4.2.1 [VERIFIED: codebase] | Cron job horário de corte | Adicionar novo schedule no cron.ts existente |
| @onesignal/node-onesignal | ^5.8.0 [VERIFIED: codebase] | Push notificação corte | Reutilizar notifications.service.ts existente |

### Alternativas Consideradas

| Em vez de | Poderia usar | Tradeoff |
|------------|-----------|----------|
| pdfmake | puppeteer/html-to-pdf | Puppeteer requer Chromium headless (pesado, inaceitável em VPS pequeno) |
| exceljs | xlsx (SheetJS) | xlsx é mais popular mas tem licenciamento dual; exceljs é MIT completo |
| @dnd-kit | react-beautiful-dnd | rbd está deprecado e não mantido; dnd-kit é o sucessor recomendado pela comunidade |
| @dnd-kit | react-dnd | react-dnd tem suporte a touch mais complexo de configurar para PWA |

**Installation:**
```bash
# Backend (apps/api)
npm install pdfmake exceljs --workspace=@cheirin-de-pao/api

# Frontend (apps/web)
npm install @dnd-kit/core @dnd-kit/sortable --workspace=@cheirin-de-pao/web
```

---

## Package Legitimacy Audit

| Package | Registry | Idade | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-------|-----------|-------------|-----------|-------------|
| pdfmake | npm | ~12 anos (2014) | Muito alto | github.com/bpampuch/pdfmake | [OK] | Aprovado |
| exceljs | npm | ~12 anos (2014) | Muito alto | github.com/exceljs/exceljs | [OK] | Aprovado |
| @dnd-kit/core | npm | ~5 anos (2021) | Alto | github.com/clauderic/dnd-kit | [OK] | Aprovado |
| @dnd-kit/sortable | npm | ~5 anos (2021) | Alto | github.com/clauderic/dnd-kit | [OK] | Aprovado |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

**Postinstall scripts:** Nenhum dos 4 pacotes possui `scripts.postinstall` — verificado. [VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
Admin Browser (React)
       │
       │  tab state (painel/pedido/entregas/clientes/gestao)
       ▼
  AdminLayout.tsx
  ┌─────────────────────────────────────────────────┐
  │  AdminBottomNav (5 tabs)                         │
  │  ┌──────────┬──────────┬──────────┬──────────┐  │
  │  │AdminPainel│AdminPedido│AdminEntregas│AdminClientes│AdminGestao│
  │  │  KPIs    │ 4-step   │ DnD divs │  list+  │  hub+   │
  │  │  charts  │  flow    │ progress │  detail  │  CRUDs  │
  │  └──────────┴──────────┴──────────┴──────────┘  │
  └─────────────────────────────────────────────────┘
       │
       │  apiFetch (JWT Bearer)
       ▼
  Fastify API (apps/api)
  ┌──────────────────────────────────────────────────────┐
  │  requireAdmin preHandler                              │
  │                                                       │
  │  /admin/dashboard   → AdminDashboardService          │
  │  /admin/supplier-orders → AdminSupplierOrdersService │
  │    ├── GET /admin/supplier-orders/:id/pdf   (pdfmake) │
  │    └── GET /admin/supplier-orders/:id/excel (exceljs) │
  │  /admin/orders      → AdminOrdersService (existente) │
  │  /admin/clients     → AdminClientsService            │
  │  /admin/condominiums → AdminCondominiumsService      │
  │  /admin/combos      → AdminCombosService             │
  │  /admin/suppliers   → AdminSuppliersService          │
  │  /admin/couriers    → AdminCouriersService           │
  │  /admin/payments    → AdminPaymentsService           │
  │    └── POST /admin/payments/:id/refund               │
  │         └── PaymentRefund.total() → MP API           │
  │  /admin/financial   → AdminFinancialService          │
  │  /admin/settings    → AdminSettingsService           │
  │                                                       │
  │  cron.ts (node-cron v4)                              │
  │    └── cron 4 diário HH:00 → verificaCutoffTime()   │
  │         └── notifica clientes sem agendamento        │
  └──────────────────────────────────────────────────────┘
       │
       ▼
  MongoDB Atlas (Prisma)
  Collections: Order, User, Condominium, Combo, Promotion,
               Supplier, PurchaseOrder, PurchaseOrderItem,
               Payment, Setting, Notification, Schedule
```

### Recommended Project Structure

```
apps/api/src/modules/
├── admin-condominiums/      # CRUD condomínios (ADMG-01)
├── admin-combos/            # CRUD combos + promoções (ADMG-02/03)
├── admin-suppliers/         # CRUD fornecedores (ADMG-05)
├── admin-couriers/          # CRUD entregadores + toggle (ADMG-06/07)
├── admin-clients/           # Lista + detalhe + block/unblock (ADMG-08..11)
├── admin-supplier-orders/   # Pedido ao fornecedor + PDF/Excel (ADMO-05..09)
├── admin-financial/         # Receita por período/tipo/condo (ADMF-01..04)
├── admin-payments/          # Lista pagamentos + estorno (PAY-03/04)
├── admin-settings/          # cutoffTime + avulso config (ADMO-01/ADMG-04)
└── admin-orders/            # JÁ EXISTE — assign-courier + status (Fase 6)

apps/web/src/
├── pages/admin/
│   ├── AdminLayout.tsx      # substituir placeholder — tab state
│   └── tabs/
│       ├── AdminPainel.tsx
│       ├── AdminPedido.tsx
│       ├── AdminEntregas.tsx
│       ├── AdminClientes.tsx
│       └── AdminGestao.tsx
├── pages/admin/gestao/
│   ├── AdminCombos.tsx
│   ├── AdminAvulso.tsx
│   ├── AdminFornecedores.tsx
│   ├── AdminEntregadores.tsx
│   ├── AdminCondos.tsx
│   ├── AdminPagamentos.tsx
│   └── AdminFinanceiro.tsx
├── pages/admin/gestao/forms/
│   ├── ComboForm.tsx
│   ├── FornecedorForm.tsx
│   ├── EntregadorForm.tsx
│   └── CondoForm.tsx
└── components/admin/
    ├── AdminHead.tsx
    ├── AdminBottomNav.tsx
    ├── StepBar.tsx
    ├── BarChart.tsx
    ├── SegmentedControl.tsx
    ├── KpiCard.tsx
    ├── ProgressBar.tsx
    ├── DeliveryDivisionCard.tsx
    ├── PaymentDetailSheet.tsx
    └── ClientDetailView.tsx
```

### Pattern 1: Módulo API Admin (route → controller → service → repository)

Padrão idêntico ao já estabelecido no projeto:

```typescript
// Source: codebase — admin-orders.route.ts
export const adminCondominiumsRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new AdminCondominiumsController(fastify)
  fastify.get('/admin/condominiums', { preHandler: [fastify.authenticate] }, ctrl.list.bind(ctrl))
  fastify.post('/admin/condominiums', { preHandler: [fastify.authenticate] }, ctrl.create.bind(ctrl))
  fastify.patch('/admin/condominiums/:id', { preHandler: [fastify.authenticate] }, ctrl.update.bind(ctrl))
  fastify.delete('/admin/condominiums/:id', { preHandler: [fastify.authenticate] }, ctrl.remove.bind(ctrl))
}
```

Role check inline no controller (não no preHandler):
```typescript
// Source: codebase — admin-orders.controller.ts padrão
if (request.user?.role !== 'ADMIN') {
  return reply.status(403).send({ error: 'Acesso negado: apenas administradores' })
}
```

### Pattern 2: Geração de PDF com pdfmake v0.3 em Node.js

```typescript
// Source: VERIFIED em Node.js v20 + pdfmake 0.3.11 neste ambiente
import pdfmake from 'pdfmake/js/index.js'

// Fontes built-in disponíveis: Helvetica, Courier, Symbol, ZapfDingbats
// Para caracteres especiais PT-BR (ã, ç, etc.) usar Helvetica — suportado
pdfmake.addFonts({
  Helvetica: { normal: 'Helvetica', bold: 'Helvetica-Bold', italics: 'Helvetica-Oblique' }
})

const docDefinition = {
  defaultStyle: { font: 'Helvetica' },
  content: [
    { text: 'Pedido ao Fornecedor', style: 'header' },
    { text: `Data: ${date}` },
    {
      table: {
        widths: ['*', 'auto', 'auto'],
        body: [
          ['Condomínio', 'Pães', 'Total'],
          ...rows.map(r => [r.name, r.quantity, `R$ ${r.total}`])
        ]
      }
    }
  ],
  styles: { header: { fontSize: 18, bold: true } }
}

const pdf = pdfmake.createPdf(docDefinition)
const buffer = await pdf.getBuffer()  // retorna Buffer — usar em reply.send(buffer)

// Na rota Fastify:
reply
  .header('Content-Type', 'application/pdf')
  .header('Content-Disposition', 'attachment; filename="pedido.pdf"')
  .send(buffer)
```

**IMPORTANTE:** pdfmake v0.3 usa `getBuffer()` (async, retorna Buffer). A API antiga `getBuffer(callback)` do v0.2 não existe mais. O import é `pdfmake/js/index.js` (não `pdfmake` diretamente — o `main` aponta para `js/index.js`).

### Pattern 3: Geração de Excel com exceljs

```typescript
// Source: VERIFIED em Node.js v20 + exceljs 4.4.0 neste ambiente
import ExcelJS from 'exceljs'

const workbook = new ExcelJS.Workbook()
const sheet = workbook.addWorksheet('Pedido ao Fornecedor')

sheet.columns = [
  { header: 'Condomínio', key: 'name', width: 30 },
  { header: 'Pães', key: 'quantity', width: 10 },
  { header: 'Fornecedor', key: 'supplier', width: 25 },
  { header: 'Preço (R$)', key: 'total', width: 12 },
]

rows.forEach(r => sheet.addRow(r))

const buffer = await workbook.xlsx.writeBuffer()  // retorna Buffer

// Na rota Fastify:
reply
  .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  .header('Content-Disposition', 'attachment; filename="pedido.xlsx"')
  .send(buffer)
```

### Pattern 4: Estorno Mercado Pago (classe PaymentRefund)

```typescript
// Source: VERIFIED em mercadopago v3.1.0 instalado no projeto
import { MercadoPagoConfig, PaymentRefund } from 'mercadopago'

// Instanciar no construtor do service (padrão payments.service.ts)
const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })
const refundApi = new PaymentRefund(mpClient)

// Estorno total (D-04: somente total no MVP)
await refundApi.total({ payment_id: payment.mercadoPagoId! })

// Após sucesso:
// 1. Atualizar Payment.status = REFUNDED no banco
// 2. Debitar créditos do cliente (D-05)
//    Apenas o saldo disponível — Math.min(payment.quantity, user.creditBalance)
await prisma.$transaction([
  prisma.payment.update({ where: { id }, data: { status: 'REFUNDED' } }),
  prisma.creditTransaction.create({ data: { userId, type: 'REFUND', quantity: -creditsToDebit } }),
  prisma.user.update({ where: { id: userId }, data: { creditBalance: { decrement: creditsToDebit } } }),
])
```

**IMPORTANTE:** A classe é `PaymentRefund` (não `Payment`). O método para estorno total é `.total({ payment_id })`, que envia `POST /v1/payments/{payment_id}/refunds` com body vazio. O SDK já exporta `PaymentRefund` do pacote `mercadopago`. [VERIFIED: código fonte do SDK instalado]

### Pattern 5: Drag-and-Drop com dnd-kit para divisão de entregadores

```typescript
// Source: VERIFIED — @dnd-kit/core 6.3.1 + @dnd-kit/sortable 10.0.0 instalados
import {
  DndContext, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'

// PWA mobile: ativar AMBOS PointerSensor e TouchSensor
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
)

// Cada condomínio arrastável dentro do bloco do entregador
function SortableCondominium({ condo }: { condo: CondoItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id: condo.id })
  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.5 : 1, transform: CSS.Transform.toString(transform) }}
      {...attributes}
      {...listeners}
    >
      {condo.name} — {condo.quantity} pães
    </div>
  )
}

// Drop targets: um DndContext por bloco de entregador, ou um único DndContext com multiple droppables
// RECOMENDADO: único DndContext com onDragEnd movendo condo entre arrays de entregadores
```

**TouchSensor delay:** 250ms com tolerance 5px — padrão para PWA. Evita ativar drag no scroll.

### Pattern 6: Cron de horário de corte (estendendo cron.ts)

```typescript
// Source: codebase — cron.ts (padrão existente)
// Adicionar no cronPlugin APÓS os 3 crons existentes:

const adminSettingsService = new AdminSettingsService(fastify)

// Cron 4 — verificação de cutoff a cada hora cheia (America/Sao_Paulo)
cron.schedule(
  '0 * * * *',   // todo XX:00
  async () => {
    fastify.log.info('[cron] verificando cutoff')
    try {
      await adminSettingsService.processCutoff()
    } catch (err) {
      fastify.log.error({ err }, '[cron] erro no processCutoff — servidor mantido ativo')
    }
  },
  { timezone: 'America/Sao_Paulo', name: 'cutoff-check' },
)
```

`processCutoff()` lógica:
1. Buscar `Setting` com `key: 'cutoffTime'` (valor ex: `"20:00"`)
2. Comparar com hora atual em BRT
3. Se hora atual === cutoffTime: bloquear novos pedidos (flag no Setting ou verificar on-demand)
4. Notificar via OneSignal todos os clientes ativos sem Order para amanhã (ADMO-02)

### Pattern 7: Agregação financeira com Prisma + MongoDB

Para ADMF-01 (receita por período) — usando `prisma.payment.aggregate()`:
```typescript
// Source: Prisma 6.19.3 documentação + verificação de availablity no projeto
const result = await prisma.payment.aggregate({
  _sum: { amount: true },
  where: {
    status: 'PAID',
    createdAt: { gte: startDate, lte: endDate },
  },
})
const revenue = result._sum.amount ?? 0
```

Para ADMF-02 (receita por condomínio) — requer `$runCommandRaw` (join Payment → User → condominiumId):
```typescript
// Source: ASSUMED — padrão MongoDB aggregation pipeline com Prisma $runCommandRaw
const result = await prisma.$runCommandRaw({
  aggregate: 'Payment',
  pipeline: [
    { $match: { status: 'PAID', createdAt: { $gte: start, $lte: end } } },
    { $lookup: { from: 'User', localField: 'userId', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $group: { _id: '$user.condominiumId', total: { $sum: '$amount' } } },
  ],
  cursor: {},
})
```

**NOTA:** `prisma.payment.groupBy()` existe mas não permite filtrar por campo de documento relacionado (`User.condominiumId`). Para ADMF-02, `$runCommandRaw` é necessário. [ASSUMED — baseado em limitações conhecidas do Prisma MongoDB]

### Anti-Patterns to Avoid

- **NÃO usar `react-beautiful-dnd`:** deprecado desde 2023, sem suporte a touch moderno
- **NÃO usar `pdfmake.getBuffer(callback)` do v0.2:** v0.3 usa `getBuffer()` como Promise sem callback
- **NÃO usar `vfs_fonts.js`:** pdfmake v0.3 não usa mais o sistema VFS para fontes padrão
- **NÃO fazer estorno com `Payment.create()`:** usar a classe `PaymentRefund`, não `Payment`
- **NÃO usar `prisma migrate dev`:** MongoDB com Prisma não suporta migrations — apenas `prisma generate`
- **NÃO colocar role check no preHandler:** manter inline no controller (padrão existente do projeto)
- **NÃO criar sub-rotas React Router para as 5 abas:** D-01 exige estado interno no AdminLayout

---

## Don't Hand-Roll

| Problema | Não construir | Usar em vez disso | Por quê |
|---------|-------------|-------------|-----|
| Geração de PDF | Template string → HTML → PDF | pdfmake v0.3 `createPdf().getBuffer()` | Paginação automática, tabelas, estilos — dezenas de edge cases |
| Geração de XLSX | Construtores binários manuais | exceljs `Workbook + writeBuffer()` | Formato XLSX é ZIP interno; incompatível se construído manualmente |
| Drag-and-drop touch mobile | `onTouchStart`/`onMouseMove` custom | @dnd-kit/core com TouchSensor | Requer detectar scroll vs drag, cancelamento, múltiplos dedos — inviável sem biblioteca |
| Estorno Mercado Pago | axios.post para MP API | `PaymentRefund.total()` do SDK mercadopago | SDK gerencia auth, retry, erros HTTP, serialização correta do corpo vazio |
| Aggregation financeira cross-collection | JOIN em JS (N+1 queries) | `$runCommandRaw` com pipeline MongoDB | Performance: N documentos = N queries extras sem pipeline |

**Key insight:** As três gerações (PDF, Excel, drag-and-drop) parecem simples mas cada uma tem uma camada de complexidade não óbvia que só aparece em produção (encoding de fontes, spec binária XLSX, conflito scroll/drag em touch).

---

## Common Pitfalls

### Pitfall 1: pdfmake v0.3 vs v0.2 — API incompatível

**O que acontece:** Código escrito para v0.2 usa `getBuffer(callback)` ou importa `PdfPrinter` de `pdfmake/build/pdfmake`. Ambos falham silenciosamente ou lançam TypeError no v0.3.

**Por que acontece:** A maioria dos tutoriais e exemplos online ainda usa a API v0.2. O upgrade para v0.3 mudou a API de callbacks para Promises e reorganizou os exports.

**Como evitar:**
- Import: `import pdfmake from 'pdfmake/js/index.js'` (não `from 'pdfmake'`)
- Uso: `const pdf = pdfmake.createPdf(docDef); const buf = await pdf.getBuffer()`
- Fontes: `pdfmake.addFonts({ Helvetica: { normal: 'Helvetica', bold: 'Helvetica-Bold' } })`
- Não importar `vfs_fonts.js` — não existe mais como módulo separado em v0.3

**Warning signs:** TypeError `getBuffer is not a function`, ou erro `Cannot find module 'pdfmake/build/pdfmake'`.

### Pitfall 2: estorno MP com classe errada

**O que acontece:** Dev instancia `new Payment(mpClient)` e tenta `.refund()` ou `.cancel()` — esses métodos não existem na classe `Payment`. O resultado é TypeError.

**Por que acontece:** A classe `Payment` gerencia criação e consulta. A classe `PaymentRefund` é separada e específica para estornos.

**Como evitar:**
```typescript
import { PaymentRefund, MercadoPagoConfig } from 'mercadopago'
const refundApi = new PaymentRefund(new MercadoPagoConfig({ accessToken: ... }))
await refundApi.total({ payment_id: mercadoPagoId })
```

**Warning signs:** `TypeError: refundApi.total is not a function` ou `Payment has no method refund`.

### Pitfall 3: dnd-kit em PWA mobile — scroll vs drag

**O que acontece:** Em mobile touch, o usuário scrollando a lista acidentalmente inicia um drag. A loja de arrastar itens fica inutilizável.

**Por que acontece:** TouchSensor sem configuração de `activationConstraint` interpreta qualquer toque como início de drag.

**Como evitar:**
```typescript
useSensor(TouchSensor, {
  activationConstraint: { delay: 250, tolerance: 5 }
})
```
O `delay: 250` exige segurar por 250ms antes de ativar. O `tolerance: 5` cancela o drag se mover mais de 5px durante o delay.

**Warning signs:** Usuário reclama que não consegue scrollar a lista de entregadores.

### Pitfall 4: Order.condominiumId ausente — N+1 queries

**O que acontece:** Para agrupar Orders por condomínio no dashboard de entregas, o código faz uma query por Order para buscar o `User.condominiumId`. Com 100 pedidos, são 100 queries adicionais.

**Por que acontece:** O schema atual de `Order` não tem `condominiumId` — derivado do `User` em runtime (como faz o `courier.service.ts`).

**Como evitar:** Adicionar `condominiumId String? @db.ObjectId` ao model `Order` no Wave 0. Populá-lo ao criar Orders via `schedules.service.ts` (usar o `condominiumId` do User). Para Orders existentes (sem condominiumId), aceitar degradação temporária ou fazer migration script.

**Warning signs:** Tempos de resposta altos no endpoint de entregas do admin; muitas queries MongoDB nos logs.

### Pitfall 5: Prisma MongoDB — sem prisma db push, sem migrations

**O que acontece:** Dev executa `prisma migrate dev` ou `prisma db push` esperando que o MongoDB valide o schema. No melhor caso, o comando é ignorado. No pior, gera erro de compatibilidade.

**Por que acontece:** MongoDB é schemaless — não há schema enforcement no banco. Prisma gera apenas o cliente TypeScript, não DDL.

**Como evitar:**
- Após qualquer mudança em `schema.prisma`: rodar `npx prisma generate`
- Campos novos (ex: `condominiumId`) começam como `null` em documentos existentes automaticamente
- Não é necessário `db push` — MongoDB aceita qualquer campo na próxima escrita

**Warning signs:** Dev espera que o MongoDB rejeite documentos sem campo obrigatório — não rejeita.

### Pitfall 6: receita por condomínio — groupBy não funciona com $lookup

**O que acontece:** `prisma.payment.groupBy({ by: ['userId'] })` agrupa por `userId`, mas o condomínio está em `User.condominiumId`. Não há como fazer `groupBy` diretamente por campo de documento relacionado no Prisma MongoDB.

**Por que acontece:** Limitação conhecida: `groupBy` no Prisma MongoDB não suporta `$lookup` (join entre coleções).

**Como evitar:** Usar `prisma.$runCommandRaw` com pipeline de agregação MongoDB incluindo `$lookup` e `$group`.

---

## Schema Changes Required (Wave 0)

Esta seção é crítica — o planner DEVE incluir um Wave 0 de schema antes de qualquer módulo API ou UI.

### Mudanças necessárias em `schema.prisma`

```prisma
// 1. Order — adicionar condominiumId (necessário para ADMO-04, ADMO-10, ADMO-11)
model Order {
  // ... campos existentes ...
  condominiumId  String?     @db.ObjectId   // ← ADICIONAR
  // ...
}

// 2. Supplier — adicionar isPrincipal (necessário para ADMG-05 + step 2 divisão)
model Supplier {
  // ... campos existentes ...
  isPrincipal    Boolean     @default(false)  // ← ADICIONAR
}

// 3. User — adicionar isActive para COURIER (necessário para ADMG-07 toggle)
// ATENÇÃO: User já tem isBlocked para cliente — para entregadores usar campo separado
// OPÇÃO: reutilizar isBlocked também para COURIER (semântica diferente mas funciona)
// Alternativa: campo isActive dedicado (mais semântico)
```

**Coleções NÃO precisam ser criadas (já existem):**
- `PurchaseOrder` + `PurchaseOrderItem` — são as "SupplierOrder" do CONTEXT.md
- `Promotion` — model separado para promoções em combos (usar em vez de embed em Combo)
- `Setting` — key-value store; adicionar key `cutoffTime` via seed/endpoint
- `Payment` com `status: REFUNDED` — já no enum `PaymentStatus`

### NOTA sobre entregador ativo/inativo (ADMG-07)

O model `User` não tem campo `isActive` para entregadores. Opções:
1. **Reutilizar `isBlocked`** (já existe) para COURIER: semântica diferente mas funciona no MVP
2. **Adicionar `isCourierActive Boolean @default(true)`** ao model User: mais semântico

CONTEXT.md não decidiu explicitamente — Claude's Discretion. **Recomendação: usar campo `isBlocked` existente para o MVP** para evitar change de schema. O UI mostrará "Desativado" quando `isBlocked: true` para COURIER.

---

## Runtime State Inventory

> Fase 7 é uma fase greenfield de features — não é rename/refactor/migration. Omitido.

---

## Environment Availability

| Dependência | Necessária para | Disponível | Versão | Fallback |
|-------------|----------------|-----------|---------|----------|
| Node.js v20 | pdfmake, exceljs | ✓ | v20.20.2 | — |
| npm v10 | instalar pdfmake/exceljs | ✓ | — | — |
| MongoDB Atlas | API (já em uso) | ✓ | Atlas (remoto) | — |
| MP_ACCESS_TOKEN | Estorno MP | ✓ (env configurado) | — | Sem fallback — obrigatório |
| ONESIGNAL_APP_ID | Push notificação corte | ✓ (env configurado) | — | Sem push — feature degradada |

**Missing dependencies with no fallback:** nenhuma.

**Missing dependencies with fallback:** nenhuma.

---

## Validation Architecture

### Test Framework

| Propriedade | Valor |
|-------------|-------|
| Framework | Vitest (latest) |
| Config file API | `apps/api/vitest.config.ts` (environment: node) |
| Config file Web | `apps/web/vitest.config.ts` (environment: jsdom) |
| Quick run command | `npm run test --workspace=@cheirin-de-pao/api` |
| Full suite command | `npm run test -w apps/api && npm run test -w apps/web` |

### Phase Requirements → Test Map

| Req ID | Comportamento | Tipo | Comando Automatizado | Arquivo Existe? |
|--------|--------------|------|---------------------|-----------------|
| ADMO-01 | Settings.cutoffTime salvo e lido | unit | `vitest run admin-settings.service.test.ts` | ❌ Wave 0 |
| ADMO-02 | Push enviado para clientes sem Order ao corte | unit (mock OneSignal) | `vitest run admin-settings.service.test.ts` | ❌ Wave 0 |
| ADMO-05 | PurchaseOrder criado com items corretos | unit | `vitest run admin-supplier-orders.service.test.ts` | ❌ Wave 0 |
| ADMO-08 | getBuffer() retorna Buffer > 0 bytes | unit (pdfmake mock) | `vitest run admin-supplier-orders.service.test.ts` | ❌ Wave 0 |
| PAY-04 | Estorno chama PaymentRefund.total() + debita créditos | unit (mock MP) | `vitest run admin-payments.service.test.ts` | ❌ Wave 0 |
| ADMG-10 | Bloquear cliente altera User.isBlocked | unit | `vitest run admin-clients.service.test.ts` | ❌ Wave 0 |
| ADMF-01 | Receita por período soma Payment.amount WHERE status=PAID | unit | `vitest run admin-financial.service.test.ts` | ❌ Wave 0 |
| UI-09 | AdminBottomNav renderiza 5 abas + ativa correta | component | `vitest run AdminBottomNav.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Por commit de task:** `npm run test --workspace=@cheirin-de-pao/api`
- **Por merge de wave:** Suite completa API + Web
- **Phase gate:** Full suite verde antes de `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/api/src/modules/admin-settings/__tests__/admin-settings.service.test.ts`
- [ ] `apps/api/src/modules/admin-payments/__tests__/admin-payments.service.test.ts`
- [ ] `apps/api/src/modules/admin-supplier-orders/__tests__/admin-supplier-orders.service.test.ts`
- [ ] `apps/api/src/modules/admin-financial/__tests__/admin-financial.service.test.ts`
- [ ] `apps/api/src/modules/admin-clients/__tests__/admin-clients.service.test.ts`
- [ ] `apps/web/src/components/admin/__tests__/AdminBottomNav.test.tsx`

---

## State of the Art

| Abordagem Antiga | Abordagem Atual | Quando Mudou | Impacto |
|-----------------|-----------------|--------------|---------|
| pdfmake v0.2: `getBuffer(callback)` + `vfs_fonts.js` | pdfmake v0.3: `await getBuffer()` Promise + `addFonts()` | 2023 (v0.3.x) | Import path muda; callback vira Promise |
| react-beautiful-dnd (padrão histórico) | @dnd-kit (novo padrão) | 2022-2023 | rbd deprecado; dnd-kit é o sucessor |
| MP SDK v1/v2: `Payment.refund()` | MP SDK v3: `PaymentRefund.total()` classe separada | 2023 | Classe separada, método `.total()` para estorno total |

**Deprecated/outdated:**
- `react-beautiful-dnd`: descontinuado pelo autor em 2023 — não usar
- `pdfmake/build/pdfmake` (build path v0.2): path mudou em v0.3 para `pdfmake/js/index.js`

---

## Assumptions Log

| # | Claim | Seção | Risco se errado |
|---|-------|-------|-----------------|
| A1 | Receita por condomínio requer `$runCommandRaw` com `$lookup` | Pattern 7 + Pitfall 6 | Se Prisma suportar join para groupBy em v6.x, código desnecessariamente complexo |
| A2 | Usar `isBlocked` existente para toggle de entregador (ADMG-07) | Schema Changes | Se semântica confundir futuras queries, precisar de migration futura |
| A3 | MP sandbox aceita estorno total na mesma sessão do pagamento | PAY-04 | Se sandbox bloquear estornos imediatos, testar com pagamento antigo |
| A4 | pdfmake v0.3 suporta caracteres UTF-8 pt-BR (ã, ç, ê) com Helvetica | Pattern 2 | Se não suportar, precisar de fonte customizada (DejaVu ou similar via addFonts) |

---

## Open Questions

1. **Cron de corte — bloqueio ativo ou passivo?**
   - O que sabemos: `cutoffTime` é lido pelo cron a cada hora cheia
   - O que está indefinido: ao atingir o horário, o sistema seta um flag no Setting (`isCutoffActive: 'true'`), ou os endpoints de pedido verificam `cutoffTime` a cada request?
   - Recomendação: verificação on-demand nos endpoints de agendamento (mais simples, sem estado extra). O cron apenas envia a notificação push (ADMO-02).

2. **Order.condominiumId em Orders existentes**
   - O que sabemos: Orders criadas antes dessa fase não terão o campo
   - O que está indefinido: o planner deve incluir um script de backfill (buscar User.condominiumId para cada Order existente) ou aceitar `null` e tratar no admin service?
   - Recomendação: aceitar `null` no MVP — admin service filtra/agrupa apenas orders com `condominiumId != null`. Backfill pode ser feito em Wave 0 via script simples.

3. **Sugestão de divisão de entregadores — quando gerar?**
   - O que sabemos: algoritmo híbrido balanceia pães entre entregadores ativos
   - O que está indefinido: a sugestão é gerada on-demand no GET `/admin/orders/division-suggestion`, ou pré-computada quando o pedido ao fornecedor é confirmado?
   - Recomendação: on-demand no GET, calculado em memória no service (dados pequenos no MVP).

---

## Security Domain

### Applicable ASVS Categories

| Categoria ASVS | Aplica | Controle Padrão |
|----------------|--------|-----------------|
| V2 Authentication | sim | JWT existente via `fastify.authenticate` preHandler |
| V3 Session Management | não | Sem nova gestão de sessão nesta fase |
| V4 Access Control | sim | Role check ADMIN inline no controller (padrão existente) |
| V5 Input Validation | sim | Zod schemas em `*.schema.ts` — todos os body/params validados |
| V6 Cryptography | não | Sem nova criptografia; chave MP no env var |

### Known Threat Patterns for Admin API

| Padrão | STRIDE | Mitigação Padrão |
|--------|--------|-----------------|
| Acesso não-autorizado às rotas admin | Elevation of Privilege | Role check `user.role !== 'ADMIN'` inline no controller — padrão existente |
| Estorno fraudulento por ID | Tampering | Verificar `Payment.status === 'PAID'` antes de chamar MP; idempotência na API MP |
| Injeção via campos de CRUD | Tampering | Zod parse antes de qualquer operação de banco — padrão existente |
| Download de arquivo sem autenticação | Information Disclosure | Endpoints PDF/Excel protegidos com `preHandler: [fastify.authenticate]` |

---

## Sources

### Primary (HIGH confidence)

- SDK mercadopago v3.1.0 instalado no projeto — `PaymentRefund` exportado de `dist/index.js` [VERIFIED: código fonte inspecionado]
- pdfmake v0.3.11 instalado — `getBuffer()` testado com sucesso retornando Buffer de 1431 bytes [VERIFIED: executado em Node.js v20]
- exceljs v4.4.0 instalado — `writeBuffer()` testado retornando Buffer de 6521 bytes [VERIFIED: executado em Node.js v20]
- @dnd-kit/core 6.3.1 + @dnd-kit/sortable 10.0.0 instalados — exports verificados [VERIFIED: código fonte]
- schema.prisma do projeto — todos os models inspecionados diretamente [VERIFIED: codebase]
- cron.ts do projeto — padrão node-cron v4 com timezone [VERIFIED: codebase]
- admin-orders.service.ts — padrão de role check + assignCourier [VERIFIED: codebase]
- payments.service.ts — padrão MercadoPagoConfig + Payment [VERIFIED: codebase]

### Secondary (MEDIUM confidence)

- slopcheck [OK] para todos os 4 pacotes novos — sem flags de risco [VERIFIED: slopcheck 0.6.1]
- npm registry — ages e versões dos pacotes [VERIFIED: npm view]

### Tertiary (LOW confidence)

- Limitação do Prisma MongoDB `groupBy` sem `$lookup` [ASSUMED — baseado em limitações conhecidas do ORM]
- Comportamento do pdfmake v0.3 com UTF-8 pt-BR em Helvetica [ASSUMED — testado apenas com ASCII]

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — todos os 4 pacotes instalados e testados localmente
- Architecture: HIGH — baseada em código existente do projeto (padrões consolidados nas fases 1-6)
- Pitfalls: HIGH — pitfalls 1-5 verificados diretamente; pitfall 6 MEDIUM (assumed)
- Schema gaps: HIGH — inspecionado diretamente o schema.prisma

**Research date:** 2026-06-15
**Valid until:** 2026-07-15 (30 dias — stack estável)
