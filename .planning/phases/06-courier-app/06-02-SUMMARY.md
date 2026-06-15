---
phase: 06-courier-app
plan: "02"
subsystem: frontend-courier
tags:
  - courier
  - react
  - frontend
  - react-leaflet
  - ui-components

dependency_graph:
  requires:
    - 06-01  # backend courier (GET /courier/orders/today + PATCH /courier/orders/:id/confirm)
  provides:
    - courier-screen-ui           # tela principal do entregador com lista de entregas
    - progress-card-component     # card espresso com contador + barra animada
    - condo-accordion-component   # accordion por condomínio com pill de progresso
    - stop-row-component          # linha de parada clicável com estado confirmado
    - confirm-delivery-dialog     # modal de confirmação antes de PATCH confirm
    - courier-route-entry         # sub-rota /courier index no router.tsx
  affects:
    - 06-03  # courier map (substituirá placeholder da aba Rota)

tech_stack:
  added:
    - react-leaflet 5.0.0 (instalado — utilizado no Plano 03)
    - leaflet 1.9.4 (peer dep do react-leaflet)
    - "@types/leaflet" 1.9.21 (tipos TypeScript para leaflet)
  patterns:
    - SegmentedControl como tab container com fundo surface-2 e tab ativa com shadowSoft
    - CondoAccordion accordion exclusivo (estado openAccordion: number, -1 = todos fechados)
    - confirmedIds como Set<string> gerenciado no CourierScreen (state lifting)
    - StopRow usa <button> nativo (não div+onClick) para acessibilidade e hit target

key_files:
  created:
    - apps/web/src/components/courier/ProgressCard.tsx
    - apps/web/src/components/courier/SegmentedControl.tsx
    - apps/web/src/components/courier/StopRow.tsx
    - apps/web/src/components/courier/CondoAccordion.tsx
    - apps/web/src/components/courier/ConfirmDeliveryDialog.tsx
    - apps/web/src/pages/courier/CourierScreen.tsx
  modified:
    - apps/web/src/routes/router.tsx  # sub-rota index CourierScreen em /courier

decisions:
  - "confirmedIds como Set<string> no CourierScreen — estado único para barra + pill + strikethrough sem prop drilling excessivo"
  - "StopRow desabilita <button> quando confirmado — previne dupla confirmação no UI antes do dialog abrir"
  - "CondoAccordion recebe confirmedIds via prop (não estado interno) — ProgressCard e accordion sincronizados pelo mesmo Set"

metrics:
  duration: "~420s (~7min)"
  completed_date: "2026-06-15"
  tasks_completed: 2
  files_created: 6
  files_modified: 1
---

# Phase 06 Plan 02: Frontend Courier App Summary

**One-liner:** Tela CourierScreen com lista de entregas agrupada por condomínio, accordion exclusivo, confirmação via PATCH com feedback visual imediato (strikethrough + check verde + barra animada) e react-leaflet instalado para o Plano 03.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | react-leaflet + ProgressCard + SegmentedControl | aae54dc | ProgressCard.tsx, SegmentedControl.tsx |
| 2 | StopRow + CondoAccordion + ConfirmDeliveryDialog + CourierScreen + router | 9c6a6ee | 4 novos + router.tsx modificado |

## What Was Built

### Frontend — CourierScreen

**`GET /courier/orders/today`** consumido em useEffect no mount:
- Agrupa condominios em `<CondoAccordion>` — accordion exclusivo (primeiro aberto por padrão)
- Card de progresso `<ProgressCard>` com `confirmed/total paradas` e `confirmedBreads/totalBreads`
- Barra de progresso dourada com `transition: width 0.3s ease` — anima ao confirmar cada parada
- Tab "Rota" exibe placeholder "Mapa disponível em breve" (implementado no Plano 03)

**`PATCH /courier/orders/:id/confirm`** chamado pelo `ConfirmDeliveryDialog`:
- orderId extraído da resposta do GET — nunca de input do usuário (T-06-02)
- Loading state no botão (opacity 0.6, cursor wait) durante o PATCH
- Ao 200: `confirmedIds.add(orderId)` → strikethrough + opacity 50% na parada + pill atualiza + barra anima
- Ao erro: mensagem inline "Falha na conexão. Tente novamente." — dialog permanece aberto

### Componentes

**`ProgressCard`:**
- Fundo `#1E1207` (espresso), BreadMark decorativo `opacity: 0.12`, `size: 130`, `bottom: -40px`
- Dois colunas: esquerda `X/N paradas` (Bricolage 26px 800 #FAF5EC), direita `confirmedBreads/totalBreads` (Bricolage 26px 800 gold)
- Barra `height: 6px`, `transition: 'width 0.3s ease'`

**`SegmentedControl`:**
- Container surface-2, borderRadius 13, padding 4
- Tab ativa: surface + shadowSoft; inativa: transparent
- `minHeight: 44` (UI-10 compliance)

**`CondoAccordion`:**
- Badge dourado 36×36px, borderRadius 12, Bricolage 15px 800 espresso
- Pill parcial: gold-soft/accent `X/N`; completo: good-soft/good `Ok` + Icon check
- Chevron com `transform: rotate(180deg)` quando aberto, `transition: 0.2s`
- `aria-expanded={isOpen}` no header button

**`StopRow`:**
- `<button>` nativo (não div) — acessibilidade + hit target
- Checkbox 28×28px borderRadius 9: vazio → preenchido good + Icon check 16px
- Strikethrough + opacity 0.5 no texto confirmado
- `minHeight: 44` (UI-10)

**`ConfirmDeliveryDialog`:**
- `role="dialog"` `aria-modal="true"` no backdrop
- Fecha ao clicar no backdrop (salvo durante loading)
- Botão "Cancelar" ghost, "Confirmar entrega" espresso/primary
- Erro inline em `var(--color-destructive)`

### Router

Sub-rota `index: true` adicionada em `/courier` com lazy import de `CourierScreen`:
```
/courier → CourierLayout → (index) CourierScreen
```

## Security Threats Addressed

| Threat ID | Mitigation Implementada |
|-----------|------------------------|
| T-06-02 | CourierLayout (fase 2) faz role check CLIENT; router sub-rota requer que CourierLayout renderize o Outlet |
| T-06-06 | `disabled={isConfirmed}` no StopRow + `isLoading` no botão Confirmar bloqueia dupla confirmação |

## Deviations from Plan

None — plano executado exatamente conforme especificado.

## Known Stubs

**Aba Rota:** Placeholder "Mapa disponível em breve" no tab `route` do CourierScreen.
- Arquivo: `apps/web/src/pages/courier/CourierScreen.tsx`
- Motivo: intencional — o plano especifica explicitamente que a aba Rota é placeholder neste plano
- Resolução: Plano 03 implementará `CourierRouteView` com mapa Leaflet real

## Threat Flags

None — nenhuma nova superfície de segurança além do que está no threat_model do plano.

## Self-Check: PASSED

### Arquivos criados
- [x] apps/web/src/components/courier/ProgressCard.tsx
- [x] apps/web/src/components/courier/SegmentedControl.tsx
- [x] apps/web/src/components/courier/StopRow.tsx
- [x] apps/web/src/components/courier/CondoAccordion.tsx
- [x] apps/web/src/components/courier/ConfirmDeliveryDialog.tsx
- [x] apps/web/src/pages/courier/CourierScreen.tsx

### Arquivos modificados
- [x] apps/web/src/routes/router.tsx

### Commits
- [x] aae54dc — feat(06-02): ProgressCard + SegmentedControl + instalar react-leaflet/leaflet
- [x] 9c6a6ee — feat(06-02): StopRow + CondoAccordion + ConfirmDeliveryDialog + CourierScreen + router

### Acceptance criteria
- [x] CourierScreen.tsx usa `apiFetch('/courier/orders/today')` em useEffect
- [x] ConfirmDeliveryDialog.tsx chama `apiFetch('/courier/orders/${stop.orderId}/confirm', { method: 'PATCH' })`
- [x] StopRow.tsx usa `<button>` (não `<div onClick>`)
- [x] StopRow.tsx tem minHeight 44 (UI-10)
- [x] CondoAccordion.tsx header button tem aria-expanded={isOpen}
- [x] CondoAccordion.tsx pill muda para "Ok" com cor good quando feitas === condo.stops.length
- [x] router.tsx contém sub-rota index de CourierScreen dentro do path /courier
- [x] ConfirmDeliveryDialog.tsx tem role="dialog" aria-modal="true"
- [x] ConfirmDeliveryDialog.tsx tem "Falha na conexão. Tente novamente." em caso de erro
- [x] `npm run typecheck --workspace=apps/web` sai com código 0
