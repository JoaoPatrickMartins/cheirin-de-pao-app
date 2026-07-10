# Phase 7: Admin Panel - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 7-admin-panel
**Areas discussed:** Navegação frontend Admin, Estorno e pagamentos, Geração de PDF e Excel, Atribuição e divisão de entregadores

---

## Navegação frontend Admin

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Estado de tab (como no handoff) | Tab navigation como estado de componente no AdminLayout. URL permanece /admin sem sub-rotas. | ✓ |
| Rotas React Router | Cada aba é uma rota (/admin/painel, etc.). Permite bookmarks e botão voltar. | |
| Híbrido: rotas para abas + estado para sub-telas | Balanceia bookmarkabilidade com simplicidade. | |

**User's choice:** Estado de tab (como no handoff)

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Stack de estado interna | Cada aba mantém seu próprio stack: null = lista, 'detalhe', 'criar', 'editar'. Botão 'Voltar' = setState(null). | ✓ |
| Sheets e modais por cima | Sub-telas abrem como bottom sheet ou modal. | |

**User's choice:** Stack de estado interna

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Tela separada no stack | Formulário ocupa a tela toda. Padrão consistente com o handoff. | ✓ |
| Bottom sheet por cima da lista | Sheet desliza de baixo, lista fica visível atrás. | |

**User's choice:** Tela separada no stack
**Notes:** Consistente com o handoff `screens-admin.jsx`/`screens-admin2.jsx` que já usa esse padrão.

---

## Estorno e Pagamentos (PAY-03 + PAY-04)

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Somente estorno total | Uma chamada à API do MP. Mais simples para MVP. | ✓ |
| Estorno total e parcial | Admin informa o valor a estornar. Requer campo de valor na UI. | |

**User's choice:** Somente estorno total

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Remover créditos automaticamente | Sistema debita do saldo do cliente os créditos daquele pagamento. | ✓ |
| Admin decide manualmente | Estorno financeiro, mas créditos ficam intactos. | |
| Bloquear estorno se créditos usados | Sistema bloqueia o botão se algum crédito já foi consumido. | |

**User's choice:** Remover créditos automaticamente

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Lista + botão Estornar por pagamento | Lista com botão inline por pagamento. | |
| Lista somente leitura + tela de detalhe | Ao tocar abre detalhe completo com botão Estornar. | ✓ |

**User's choice:** Lista somente leitura + tela de detalhe com ações

---

## Geração de PDF e Excel (ADMO-08)

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Backend (pdfmake + exceljs) | API retorna arquivo. Consistente em qualquer dispositivo. | ✓ |
| Frontend (sheetjs + print CSS) | Zero dependências backend. PDF limitado ao que o browser renderiza. | |

**User's choice:** Backend gera ambos (pdfmake + exceljs)

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Collection nova SupplierOrder | Independente de Order. Permite consulta histórica fácil. | ✓ |
| Campo embed em Order ou DailyReport | Mais simples mas mistura conceitos. | |

**User's choice:** Collection nova SupplierOrder

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Fluxo navegável livremente | Admin pode voltar entre etapas. Só confirmação final é irreversível. | ✓ |
| Wizard linear sem volta | Uma vez avançado, não pode voltar. | |

**User's choice:** Fluxo navegável livremente

---

## Atribuição e Divisão de Entregadores (ADMO-11)

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Por condomínio inteiro | Nunca divide um condo entre dois entregadores. Simples. | |
| Por volume total de pães | Divisão numérica igualitária. Não considera localização. | |
| Por proximidade geográfica | Usa lat/lng para clustering. Mais inteligente, mais complexo. | |
| Misto (user freeform) | Prioridade por condomínio inteiro, mas permite divisão de quantidade e edição manual. | ✓ |

**User's choice (freeform):** "um misto entre 1 e 2 onde da prioridade de separação por condominio mas com a possibilidade de dividir para mais de um entregador e poder editar manualmente os volumes"

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Drag and drop de condomínios | Admin redistribui condomínios entre entregadores visualmente. | ✓ |
| Stepper por condomínio por entregador | Tabela com steppers numéricos por entregador. | |

**User's choice:** Arrastar condomínio de um entregador para outro

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Aprovar dispara PATCH em batch imediatamente | Botão 'Aprovar' chama a API existente com orderIds e courierId. | ✓ |
| Rascunho com confirmação em segundo passo | Pré-aprovar + Confirmar. | |

**User's choice:** Aprovar na UI já dispara o PATCH /admin/orders/assign-courier em batch

---

## Claude's Discretion

- **Horário de corte**: salvo como campo `cutoffTime` em collection `Settings`. Cron job verifica e bloqueia pedidos + notifica clientes sem agendamento via OneSignal.
- **Promoções em combos**: campo `discount` embed no documento Combo (`{ type, value, expiresAt? }`). Expiração verificada on-demand, sem cron no MVP.

## Deferred Ideas

- Estorno parcial — pós-MVP
- Clustering geográfico na sugestão de atribuição — pós-MVP
- Drag and drop com otimização geográfica — pós-MVP
- OSRM self-hosted no VPS — pós-MVP
