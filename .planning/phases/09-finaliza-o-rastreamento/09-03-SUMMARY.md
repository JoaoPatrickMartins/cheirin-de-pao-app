---
plan: 09-03
phase: 09-finaliza-o-rastreamento
status: complete
completed_at: "2026-06-19"
commits:
  - ef813c0
tasks_completed: 2
files_changed: 8
---

# Summary — Plan 09-03

## O que foi feito

**Task 1 — Stubs de teste Wave 0:**
- `TrackingScreen.test.tsx`: 5 casos (null order, SCHEDULED, DELIVERED, histórico com dados, empty state)
- `NotificationsScreen.test.tsx`: 5 casos (AppBar, empty state, CTA DELIVERY_EVE, CTA OUT_FOR_DELIVERY, refresh após PATCH)
- Descoberta e remoção de arquivos `.js` stale (NotificationsScreen.js, HomeScreen.js, ClientLayout.js, TrackingScreen.js) que estavam sendo resolvidos pelo Vitest em vez dos `.tsx` corretos

**Task 2 — NotificationsScreen + HomeScreen:**
- `CTA_CONFIG` expandido para 5 entradas: LOW_CREDIT, DELIVERY_DONE (label corrigido para 'Ver pedido'), DELIVERY_EVE (novo), OUT_FOR_DELIVERY (novo), RECONFIGURE
- `refresh()` do NotifContext chamado após PATCH `/notifications/read-all` no `.then()` — badge sincroniza automaticamente ao abrir a tela
- `useEffect` deps atualizado para `[refresh]` (refresh estável via useCallback)
- `HomeScreen`: `useNotifBadge` removido, substituído por `useNotif()` do NotifContext

## Resultado

- 105 testes passando (suite web completa), 0 falhas
- Requisitos ACOMP-01, ACOMP-04, ACOMP-05 cobertos

## Insight

Arquivos `.js` stale gerados por compilação anterior sobrepunham os `.tsx` na resolução de módulos do Vitest. Removidos para evitar falsos positivos silenciosos em testes futuros.
