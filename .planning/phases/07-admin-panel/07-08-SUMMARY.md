---
phase: 07-admin-panel
plan: 08
subsystem: admin-pedido
tags: [react, typescript, admin-panel, supplier-orders, step-bar, download]
dependency_graph:
  requires:
    - 07-07 (AdminLayout, AdminHead, componentes admin existentes)
    - 07-06 (GET /admin/supplier-orders/draft, POST /admin/supplier-orders, GET /admin/suppliers, GET /admin/settings/cutoff)
  provides:
    - StepBar reutilizável (4 steps com preenchimento dourado, navegacao D-09)
    - AdminPedido completo: fluxo 4 etapas Conferir -> Ajustar -> Dividir -> Pronto
  affects:
    - AdminLayout.tsx (tab pedido substituiu placeholder div)
tech_stack:
  added: []
  patterns:
    - Steppers acoplados: split.p + split.r == total em qualquer onChange (D-09)
    - Download de arquivo via blob() + URL.createObjectURL sem dependencias externas (D-07)
    - Falha silenciosa em apiFetch com try/catch (padrao CourierScreen)
    - Componente StepperInline reutilizado do sistema cliente (apps/web/src/components/client/)
key_files:
  created:
    - apps/web/src/components/admin/StepBar.tsx
    - apps/web/src/pages/admin/tabs/AdminPedido.tsx
  modified:
    - apps/web/src/pages/admin/AdminLayout.tsx (importa e renderiza AdminPedido)
decisions:
  - StepperInline (client) reutilizado em vez de criar novo Stepper — mesmo contrato de props, tamanho compacto adequado para cards de lista
  - Split inicial 75/25 calculado ao entrar no step 2 (Math.round para principal, restante para reserva)
  - Botao Finalizar bloqueado quando split.p === 0 e split.r === 0 (mitigacao T-07-08-04)
  - POST filtra items com quantity > 0 antes de enviar para API
metrics:
  duration: 28min
  completed_date: "2026-06-16T02:00:00Z"
  tasks_completed: 2
  files_modified: 3
  files_created: 2
---

# Phase 7 Plan 8: StepBar + AdminPedido Summary

**One-liner:** Fluxo completo de pedido ao fornecedor em 4 etapas — StepBar dourado, steppers acoplados 75/25, criação de PurchaseOrder via POST e download PDF/Excel via createObjectURL.

## What Was Built

### Task 1: StepBar (commit `db887f9`)

**StepBar.tsx** — novo componente reutilizável:
- Props: `{ step: 0 | 1 | 2 | 3; onStepClick: (i: number) => void }`
- Constante `STEP_LABELS = ['Conferir', 'Ajustar', 'Dividir', 'Pronto']`
- Para cada step: barra 4px `#E3AC3F` quando `i <= step`, `--color-border` quando pendente
- Label 11px Hanken weight=700: cor `--color-accent` quando ativo/concluído; `--color-text-ter` quando pendente
- Click em step anterior (`i < step`) dispara `onStepClick(i)` — navegação D-09
- `role="button"` e `aria-label` nos steps clicáveis

### Task 2: AdminPedido (commit `bc1bd46`)

**AdminPedido.tsx** — tela com fluxo completo de 4 etapas:

**Estados gerenciados:**
- `step: 0|1|2|3`, `draftData: CondoDraft[] | null`, `cutoff: CutoffSettings | null`
- `adjustedQts: Record<string, number>` — quantidades por condominium ID
- `suppliers: Supplier[] | null`, `split: { p: number; r: number }`
- `orderId: string | null`, `isLoading`, `isCreating`, `isDownloading: 'pdf'|'excel'|null`

**Step 0 — Conferir:**
- `useEffect` busca `GET /admin/supplier-orders/draft` + `GET /admin/settings/cutoff` em paralelo
- Card de horário de corte: avatar scissors 44px fundo `gold-soft`, pill "Aberto"/"Encerrado"
- Lista de cards por condomínio: avatar building 42px `surface2`, nome, entregas, total Bricolage 18px
- Rodapé fixo: "Total necessário" + total em pães + botão "Encerrar corte e gerar pedido"
- Label de seção "CONSOLIDADO POR CONDOMÍNIO"
- Empty state "Sem pedidos hoje" quando draft vazio

**Step 1 — Ajustar:**
- Instrução textual conforme Copywriting Contract
- StepperInline por condomínio (value=adjustedQts, min=0, max=400)
- Ao avançar: `goToStep2()` busca `GET /admin/suppliers`, calcula split 75/25, avança para step 2
- Rodapé: "Total ajustado" + soma dinâmica

**Step 2 — Dividir:**
- 2 cards: Fornecedor Principal (pill "Principal" gold) + Fornecedor Reserva (pill "Reserva" neutral)
- StepperInline acoplado: `onChange p → setSplit({p:v, r:total-v})`, `onChange r → setSplit({p:total-v, r:v})`
- Custo calculado em tempo real (`split.p * pricePerUnit`)
- Rodapé: total em pães + custo total + "Finalizar pedido" (bloqueado se split.p=0 e split.r=0)
- `finalizarPedido()` → `POST /admin/supplier-orders` com `items` filtrados (quantity > 0) → salva `orderId` → avança para step 3

**Step 3 — Pronto:**
- Ícone check 72px, fundo `good-soft`
- Título "Pedido gerado" Bricolage 22px + subtítulo com data
- Card de resumo: linha por fornecedor (nome, N pães × preço, subtotal) + separadores + total Bricolage 20px accent
- Botões PDF e Excel: `apiFetch → res.blob() → URL.createObjectURL → a.click() → revokeObjectURL`
- "Voltar ao início": reseta step=0, orderId=null, adjustedQts={}, suppliers=null

**AdminLayout.tsx** — modificado:
- Importa `AdminPedido`
- `{tab === 'pedido' && <AdminPedido />}` substitui o placeholder `<div />`

## Deviations from Plan

### Observações de Implementação

**StepperInline reutilizado:** O plano menciona "Stepper existente em brand/". O projeto não tem um `Stepper` em `brand/` — os steppers existem apenas em `components/client/`. `StepperInline` foi reutilizado pois tem o contrato de props compatível (value, min, max, onChange) e tamanho compacto adequado para listas de cards. Isto é consistente com a UI-SPEC.md que diz "usar Stepper existente para quantidades — não recriar".

**Validação de split (T-07-08-04):** Botão "Finalizar pedido" fica `disabled` quando `split.p === 0 && split.r === 0`. POST envia apenas items com `quantity > 0`. Ambas as mitigações aplicadas conforme threat model.

## Known Stubs

| Stub | Arquivo | Motivo |
|------|---------|--------|
| empty state fornecedores (sem supplier principal/reserva) | `AdminPedido.tsx` | Se API retornar lista vazia, step 2 renderiza sem cards — comportamento gracioso, sem crash |

Sem stubs que impeçam o objetivo do plano — o fluxo completo está funcional.

## Threat Surface Scan

| Threat ID | Status | Mitigação Aplicada |
|-----------|--------|-------------------|
| T-07-08-01 | Mitigado | AdminPedido renderizado dentro do AdminLayout que já guarda role=ADMIN |
| T-07-08-02 | Mitigado | Download via apiFetch que inclui JWT — sem acesso sem token |
| T-07-08-03 | Mitigado | onChange acoplado: `split.p + split.r === total` sempre; min=0 em ambos |
| T-07-08-04 | Mitigado | Botão disabled + filtro de items (quantity > 0) antes do POST |

Nenhuma nova superfície não planejada introduzida.

## Self-Check: PASSED

Arquivos verificados:
- `apps/web/src/components/admin/StepBar.tsx` — 4 steps, barra gold, label accent FOUND
- `apps/web/src/pages/admin/tabs/AdminPedido.tsx` — 4 steps, steppers acoplados, POST, download FOUND
- `apps/web/src/pages/admin/AdminLayout.tsx` — AdminPedido importado e renderizado FOUND

Commits verificados:
- `db887f9` — feat(07-08): StepBar FOUND
- `bc1bd46` — feat(07-08): AdminPedido FOUND

Verificações do plano:
- StepBar.tsx existe: FOUND
- 4 steps no AdminPedido (`grep -c "step === "`): 4 FOUND
- Download via blob: `URL.createObjectURL` FOUND
- POST supplier-orders: `apiFetch('/admin/supplier-orders', { method: 'POST'` FOUND
- Build frontend: SUCCESS (zero erros TypeScript)
