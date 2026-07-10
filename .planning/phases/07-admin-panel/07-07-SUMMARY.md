---
phase: 07-admin-panel
plan: 07
subsystem: admin-ui-navigation
tags: [react, typescript, tdd, admin-layout, bottom-nav, dashboard, kpi, bar-chart]
dependency_graph:
  requires:
    - 07-06 (GET /admin/dashboard disponível — breadsTodayCount, revenueToday, clientsCount, condominiumsCount, cutoffTime, revenueByType)
  provides:
    - AdminLayout com estado interno de 5 abas (D-01) + guard ADMIN
    - AdminBottomNav com 5 abas, safe-area iOS, cores accent/textTer
    - AdminHead reutilizável (avatar espresso + BreadMark gold + subtítulo + título)
    - KpiCard reutilizável (ícone + valor Bricolage + label + pill opcional)
    - BarChart reutilizável (barras flex com coluna destacada em gold)
    - ProgressBar reutilizável (fill animado, cor dinâmica gold/good)
    - AdminPainel funcional consumindo GET /admin/dashboard
  affects:
    - 07-08 (AdminPedido usa AdminLayout e AdminHead)
    - 07-09 (AdminEntregas usa AdminLayout, AdminHead, BarChart, ProgressBar)
    - 07-10 (AdminClientes usa AdminLayout, AdminHead)
    - 07-11 (AdminGestao usa AdminLayout, AdminHead)
tech_stack:
  added: []
  patterns:
    - Estado interno de aba em AdminLayout (sem sub-rotas React Router — padrão D-01)
    - Guard de role inline no componente (user.role !== 'ADMIN')
    - apiFetch com useEffect + falha silenciosa (padrão CourierScreen)
    - Inline styles com CSS custom properties dos tokens de globals.css
    - TDD RED/GREEN para AdminBottomNav (3 testes sem mock)
key_files:
  created:
    - apps/web/src/components/admin/AdminBottomNav.tsx
    - apps/web/src/components/admin/AdminHead.tsx
    - apps/web/src/components/admin/KpiCard.tsx
    - apps/web/src/components/admin/BarChart.tsx
    - apps/web/src/components/admin/ProgressBar.tsx
    - apps/web/src/components/admin/__tests__/AdminBottomNav.test.tsx
    - apps/web/src/pages/admin/tabs/AdminPainel.tsx
  modified:
    - apps/web/src/pages/admin/AdminLayout.tsx (substituído o placeholder Fase 3)
decisions:
  - AdminLayout usa estado interno de aba (D-01) — sem sub-rotas React Router para as 5 abas do admin
  - BarChart com valor uniforme por coluna (sem dados históricos por dia no dashboard MVP) — coluna do dia atual destacada em gold para UX
  - Spinner inline via CSS animation (sem biblioteca externa) para loading state do AdminPainel
metrics:
  duration: 32min
  completed_date: "2026-06-16T01:24:16Z"
  tasks_completed: 2
  files_modified: 8
  files_created: 7
---

# Phase 7 Plan 7: AdminLayout + Dashboard Admin Summary

**One-liner:** Espinha dorsal da UI admin — AdminLayout com estado interno de 5 abas, AdminBottomNav com safe-area iOS, AdminHead reutilizável e AdminPainel consumindo GET /admin/dashboard com 4 KPIs, banner de pedido, BarChart de fornadas e receita por tipo.

## What Was Built

### Task 1: AdminLayout + AdminBottomNav + AdminHead (commit `40ea95d`)

**AdminLayout.tsx** — substituiu o placeholder da Fase 3:
- Estado interno `tab: AdminTab = 'painel'` sem React Router sub-rotas (D-01)
- Guard explícito: `if (!user || user.role !== 'ADMIN') return <Navigate to="/" replace />`
- 5 abas renderizadas condicionalmente; pedido/entregas/clientes/gestao como `<div />` (substituídos nos próximos planos)
- `paddingBottom: 'calc(56px + env(safe-area-inset-bottom))'` para safe area iOS
- Importa AdminBottomNav com `activeTab={tab} onTabChange={setTab}`

**AdminBottomNav.tsx** — novo componente:
- 5 botões flex:1 com `aria-label` e `aria-current="page"` na aba ativa
- Aba ativa: cor `--color-accent`, stroke 2.3, fontWeight 700
- Aba inativa: cor `--color-text-ter`, stroke 2, fontWeight 600
- `minHeight: 44` em cada botão (hit target iOS)
- `padding: '8px 6px calc(8px + env(safe-area-inset-bottom, 0px))'`
- `nav` com `aria-label="Navegação administrativa"` (acessibilidade)

**AdminHead.tsx** — novo componente reutilizável:
- Props: `{ sub: string; titulo: string }`
- Avatar: 42×42px, borderRadius 13px, background espresso (`#1E1207`) com BreadMark size=27 cor `#E3AC3F`
- Subtítulo: 12.5px Hanken weight 600, cor `--color-text-ter`
- Título: Bricolage 20px weight 700, letterSpacing -0.02em

**Testes AdminBottomNav.test.tsx** (RED → GREEN):
- 3 testes sem mock (componente real)
- Verifica 5 botões, aria-label "Navegação administrativa", aria-current correto

### Task 2: KpiCard + BarChart + ProgressBar + AdminPainel (commit `3cc5b1e`)

**KpiCard.tsx** — card de KPI reutilizável:
- Props: `{ icon, value, label, pill? }`
- Card pad=16, borderRadius 22px, border border-2
- Header: ícone accent size=20 + pill opcional (justifyContent: space-between)
- Valor: Bricolage 26px weight=800, letterSpacing -0.02em
- Label: 12.5px Hanken weight=600, cor textSec

**BarChart.tsx** — gráfico de barras:
- Props: `{ data: Array<{ label, value, highlight? }>; height? }`
- Flex com alignItems flex-end, gap 8
- Barra com `highlight=true`: background `--color-gold`; demais: `--color-surface-2`
- Altura proporcional ao máximo; barra mínima de 4px
- Cada barra: flex:1, borderRadius 7px, transition height 0.3s

**ProgressBar.tsx** — barra de progresso:
- Props: `{ value, max, color? }`
- Height 7px, borderRadius 99px, overflow hidden
- Fill: `width=(value/max)*100%`, transition 0.3s ease
- Cor padrão: gold quando parcial, good quando 100%

**AdminPainel.tsx** — dashboard funcional:
- `useEffect` → `apiFetch('/admin/dashboard')` com falha silenciosa
- Interface `DashboardData`: breadsTodayCount, revenueToday, clientsCount, condominiumsCount, cutoffTime, revenueByType
- Grade 2×2 de KpiCards: Pães hoje (bag), Receita do dia (trend), Clientes (users), Condomínios (building)
- Card banner "Pedido de amanhã": fundo espresso, BreadMark decorativo position absolute opacity 0.12 size 120, onClick navega para aba 'pedido'
- Card "Fornadas por dia": BarChart 7 colunas (Seg a Dom), coluna do dia atual em gold via `new Date().getDay()`
- Card "Receita por tipo": barra proporcional combos gold + avulso accent 0.5, legenda com valores formatados

## Deviations from Plan

### Auto-fixed Issues

Nenhum — plano executado conforme especificado.

### Observações de Implementação

**TDD RED → GREEN:** O RED inicial foi confirmado com erro `Failed to resolve import "../AdminBottomNav.js"` (o arquivo não existia no worktree). GREEN confirmado com 3 testes passando no componente real (sem mock).

**Arquivos .js pré-compilados:** O repositório rastreia versões `.js` pré-compiladas dos arquivos `.tsx`. Os arquivos `.js` correspondentes foram gerados automaticamente e incluídos nos commits para manter consistência do repositório.

**BarChart com dados uniformes:** O dashboard MVP não retorna dados históricos de fornadas por dia — apenas totais agregados. O BarChart exibe barras com valor uniforme (1) para cada coluna, destacando apenas o dia atual em gold. Dados reais por dia serão wired quando a API de histórico for implementada.

## Known Stubs

| Stub | Arquivo | Motivo |
|------|---------|--------|
| Tabs pedido/entregas/clientes/gestao renderizam `<div />` | `AdminLayout.tsx` | Substituídos nos planos 07-08 a 07-11 |
| Pills de tendência nos KPIs com valores fixos (+12%, +8%, +3) | `AdminPainel.tsx` | API de tendências não existe no MVP — valores ilustrativos conforme handoff |
| BarChart com valor uniforme por coluna | `AdminPainel.tsx` | GET /admin/dashboard não retorna dados por dia da semana — aguarda extensão de API |

## Threat Surface Scan

| Threat ID | Status | Mitigação Aplicada |
|-----------|--------|-------------------|
| T-07-07-01 | Mitigado | Guard `user.role !== 'ADMIN'` em AdminLayout antes de renderizar qualquer aba |
| T-07-07-02 | Mitigado | apiFetch adiciona JWT automaticamente; sem token o servidor retorna 401 |
| T-07-07-03 | Mitigado | BarChart renderiza apenas numbers — sem innerHTML ou eval |

Nenhuma nova superfície não planejada introduzida.

## TDD Gate Compliance

| Fase | Tarefa | Comportamento RED | Commit GREEN |
|------|--------|-------------------|--------------|
| Task 1 | AdminBottomNav | `Failed to resolve import "../AdminBottomNav.js"` | `40ea95d` |

GREEN: 6 testes passando (3 no `.test.tsx` + 3 herdados no `.test.js`).

## Self-Check: PASSED

Arquivos verificados:
- `apps/web/src/pages/admin/AdminLayout.tsx` — guard ADMIN + estado interno 5 abas FOUND
- `apps/web/src/components/admin/AdminBottomNav.tsx` — 5 tabs, safe-area, aria-label FOUND
- `apps/web/src/components/admin/AdminHead.tsx` — BreadMark gold + subtítulo + título FOUND
- `apps/web/src/components/admin/KpiCard.tsx` — Bricolage 26px/800, pill opcional FOUND
- `apps/web/src/components/admin/BarChart.tsx` — barras flex, highlight gold FOUND
- `apps/web/src/components/admin/ProgressBar.tsx` — fill animado, cor dinâmica FOUND
- `apps/web/src/pages/admin/tabs/AdminPainel.tsx` — apiFetch dashboard, 4 KPIs, banner, chart FOUND

Commits verificados:
- `40ea95d` — feat(07-07): AdminLayout + AdminBottomNav + AdminHead FOUND
- `3cc5b1e` — feat(07-07): KpiCard + BarChart + ProgressBar + AdminPainel FOUND

Verificações do plano:
- Guard ADMIN: `grep "role !== 'ADMIN'" apps/web/src/pages/admin/AdminLayout.tsx` — FOUND
- 5 abas bottom nav: `grep -c "key:" apps/web/src/components/admin/AdminBottomNav.tsx` = 6 (5 TABS + 1 key prop no map) — FOUND
- apiFetch em AdminPainel: FOUND
- Build frontend: SUCCESS (zero erros TypeScript)
- Testes AdminBottomNav: 3 testes verdes (sem mock) — FOUND
