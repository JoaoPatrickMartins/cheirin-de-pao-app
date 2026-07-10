---
phase: 07-admin-panel
plan: 09
subsystem: admin-ui-entregas
tags: [react, typescript, dnd-kit, drag-and-drop, admin-entregas, segmented-control, pwa-mobile]
dependency_graph:
  requires:
    - 07-07 (AdminLayout, AdminHead, ProgressBar disponíveis)
    - 07-08 (AdminPedido — padrão de useEffect + apiFetch estabelecido)
  provides:
    - SegmentedControl<T> genérico reutilizável (Hoje/Histórico, Dia/Semana/Mês)
    - DeliveryDivisionCard com dnd-kit drag-and-drop de condomínios entre entregadores
    - AdminEntregas funcional: aba Hoje com divisão sugerida + progresso; aba Histórico com lista
    - Aprovação em batch via PATCH /admin/orders/assign-courier
  affects:
    - 07-11 (AdminGestao/AdminFinanceiro — reutiliza SegmentedControl genérico)
tech_stack:
  added:
    - "@dnd-kit/core@^6.3.1"
    - "@dnd-kit/sortable@^10.0.0"
    - "@dnd-kit/utilities@^3.2.2"
  patterns:
    - Generic SegmentedControl<T extends string> — único componente para qualquer tipo de tab
    - DndContext + PointerSensor (distance:8) + TouchSensor (delay:250ms, tolerance:5) — padrão PWA mobile
    - useSortable com id composto "courierId:condominiumId" para identificar item e origem no onDragEnd
    - Batch PATCH por entregador — iterar assignments e chamar assign-courier uma vez por courier com condos
    - DragOverlay com card flutuante — feedback visual durante drag
key_files:
  created:
    - apps/web/src/components/admin/SegmentedControl.tsx
    - apps/web/src/components/admin/DeliveryDivisionCard.tsx
    - apps/web/src/pages/admin/tabs/AdminEntregas.tsx
  modified:
    - apps/web/src/pages/admin/AdminLayout.tsx (substituiu placeholder entregas por AdminEntregas)
    - apps/web/package.json (adicionadas dependências @dnd-kit)
decisions:
  - ID composto "courierId:condominiumId" para itens sortáveis evita colisões quando mesmo condomínio aparece em contextos diferentes
  - DragOverlay separado do SortableContext — evita rerenders no array durante drag
  - Aprovação com try/finally garante isApproving=false mesmo em caso de erro; erro exibido inline abaixo do botão
  - fetchHistory com guard (history.length > 0) evita re-fetch desnecessário ao trocar de aba
metrics:
  duration: 25min
  completed_date: "2026-06-16T01:37:44Z"
  tasks_completed: 2
  files_modified: 2
  files_created: 3
---

# Phase 7 Plan 9: AdminEntregas + DeliveryDivisionCard + SegmentedControl Summary

**One-liner:** SegmentedControl genérico com TypeScript generic T, DeliveryDivisionCard com drag-and-drop @dnd-kit (TouchSensor delay=250ms para PWA mobile) e AdminEntregas completo com aprovação em batch via PATCH assign-courier.

## What Was Built

### Task 1: SegmentedControl genérico + instalação @dnd-kit (commit `c24d29e`)

**SegmentedControl.tsx** — componente genérico reutilizável:
- Props: `tabs: Array<{ key: T; label: string }>`, `value: T`, `onChange: (v: T) => void`
- Generic `<T extends string>` — funciona para Hoje/Histórico (AdminEntregas) e Dia/Semana/Mês (AdminFinanceiro)
- Estilos idênticos ao analog courier: surface2/13px background, tab ativa surface+shadowSoft/10px, minHeight 44px
- Fonte Hanken 13.5px weight 700; `role="tablist"` + `aria-selected` para acessibilidade (UI-SPEC Accessibility Checklist)
- Diferença do analog: sem ícones (apenas texto) e font size 13.5px vs 15px do courier

**Pacotes instalados no workspace web:**
- `@dnd-kit/core@^6.3.1` — contexto e sensores
- `@dnd-kit/sortable@^10.0.0` — useSortable + SortableContext
- `@dnd-kit/utilities@^3.2.2` — CSS.Transform.toString

### Task 2: DeliveryDivisionCard + AdminEntregas (commit `48ab0da`)

**DeliveryDivisionCard.tsx** — card de divisão de entregadores com drag-and-drop:
- `DndContext` com `PointerSensor (distance: 8)` + `TouchSensor (delay: 250, tolerance: 5)` — CRÍTICO para PWA mobile (RESEARCH.md Pitfall 3 — previne drag acidental durante scroll)
- `SortableContext` com IDs compostos `"courierId:condominiumId"` — identifica item e entregador de origem no `onDragEnd`
- `handleDragEnd`: extrai sourceCourierId e targetCourierId; move condo do array de origem para destino; recalcula totais em tempo real
- `DragOverlay` com card flutuante durante drag; `opacity: 0.5` no item de origem via `isDragging`
- Props interface: `{ assignments, onAssignmentsChange, onApprove, isApproved, isApproving }`
- Visual conforme UI-SPEC: borda 1.5px accent quando não aprovado → border-2 quando aprovado (transition 0.2s); pill "Aprovada" com icon check
- Por entregador: avatar user circular 36px surface, nome 14px weight 700, lista condos 12px textTer, total pães Bricolage 15px weight 800 gold
- Botão "Aprovar divisão": bg gold, texto espresso, minHeight 44px, disabled quando isApproving
- Erro inline "Falha ao salvar. Tente novamente." após falha na API

**AdminEntregas.tsx** — aba completa:
- `AdminHead sub="Controle do dia · {data}" titulo="Entregas"` (Copywriting Contract)
- `SegmentedControl<Segment>` tabs Hoje/Histórico com valor tipado
- **Aba Hoje:**
  - `useEffect` → `GET /admin/orders/division-suggestion` (assignments) + `GET /admin/orders/delivery-status` (progresso)
  - `DeliveryDivisionCard` com callbacks de estado; `onApprove` itera por entregador, busca orderIds via deliveryStatus, chama `PATCH /admin/orders/assign-courier` em batch
  - Empty state quando assignments vazio: "Aguardando o corte" + corpo explicativo (Copywriting Contract)
  - Seção "AGENDADAS VS REALIZADAS": cards por condomínio com nome, pill gold parcial/{N}/{total} ou pill good "Completo", ProgressBar com cor dinâmica
- **Aba Histórico:**
  - `GET /admin/supplier-orders` com guard para evitar re-fetch
  - Cards com avatar truck 42px, data longa, "N de M entregues", pill percentual good/neutral
- `AdminLayout.tsx` atualizado: substituiu `<div />` por `<AdminEntregas />` na aba entregas

## Deviations from Plan

### Auto-fixed Issues

Nenhuma desvio necessário — plano executado conforme especificado.

### Observações de Implementação

**ID composto para SortableContext:** O plano sugeria usar `condo.condominiumId` como ID sortável, mas IDs de condomínio podem se repetir entre entregadores diferentes. Adotado ID composto `"courierId:condominiumId"` para garantir unicidade no contexto do DndContext. O `handleDragEnd` faz split(":") para recuperar os IDs individuais.

**drop target por courierId:** O `over.id` pode ser o ID do item (composto) ou o ID do drop zone (courierId puro). O handler detecta isso verificando se o overStr inclui ":" — se sim, extrai o courierId do prefixo.

**ProgressBar com prop color:** O componente ProgressBar existente aceita `color` opcional, permitindo passar `--color-good` ou `--color-gold` explicitamente baseado no estado de conclusão. A lógica de cor foi mantida no componente pai (AdminEntregas) para respeitar o contexto visual da seção de progresso.

## Known Stubs

| Stub | Arquivo | Motivo |
|------|---------|--------|
| GET /admin/orders/division-suggestion | AdminEntregas.tsx | Endpoint pode não existir na Fase 6 — o componente inicia com assignments=[] e exibe empty state gracioso |
| GET /admin/orders/delivery-status | AdminEntregas.tsx | Endpoint existente da Fase 6; se retornar array vazio, a seção de progresso não é renderizada |
| GET /admin/supplier-orders (histórico) | AdminEntregas.tsx | Retorna supplier orders; o campo delivered/total pode variar — tratado com fallback `item.delivered ?? 0` |

## Threat Surface Scan

| Threat ID | Status | Mitigação Aplicada |
|-----------|--------|-------------------|
| T-07-09-01 | Mitigado | apiFetch inclui JWT automaticamente; servidor verifica role=ADMIN; sem bypass no frontend |
| T-07-09-02 | Mitigado | IDs de condomínio e entregador vêm do servidor via GET division-suggestion — sem input textual do usuário |
| T-07-09-03 | Mitigado | TouchSensor delay=250ms tolerance=5 implementado conforme RESEARCH.md Pitfall 3 |
| T-07-09-04 | Mitigado | `isApproving` desabilita botão durante chamada; `isApproved` oculta botão após sucesso; duplo clique ignorado |

Nenhuma nova superfície não planejada introduzida.

## Self-Check: PASSED

Arquivos verificados:
- `apps/web/src/components/admin/SegmentedControl.tsx` — generic T extends string FOUND
- `apps/web/src/components/admin/DeliveryDivisionCard.tsx` — TouchSensor delay:250 FOUND
- `apps/web/src/pages/admin/tabs/AdminEntregas.tsx` — assign-courier FOUND
- `apps/web/package.json` — @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities FOUND
- `apps/web/src/pages/admin/AdminLayout.tsx` — AdminEntregas importado e usado FOUND

Commits verificados:
- `c24d29e` — feat(07-09): SegmentedControl generico admin + instalar @dnd-kit FOUND
- `48ab0da` — feat(07-09): DeliveryDivisionCard dnd-kit + AdminEntregas completo FOUND

Verificações do plano:
- Build frontend: SUCCESS (zero erros TypeScript)
- dnd-kit instalado: grep "@dnd-kit" package.json — FOUND (3 pacotes)
- TouchSensor delay: grep "delay: 250" DeliveryDivisionCard.tsx — FOUND
- Aprovação em batch: grep "assign-courier" AdminEntregas.tsx — FOUND
- SegmentedControl genérico: grep "extends string" SegmentedControl.tsx — FOUND (3 ocorrências)
