---
phase: 05-delivery-experience
plan: 04
status: completed
completed_at: 2026-06-15
---

# Plan 05-04 Summary — Frontend: TrackingScreen, NotificationsScreen, HomeScreen bell/badge

## O que foi implementado

**Task 1 — useOrderTracking + testes (TDD):**
- `useOrderTracking.ts`: hook com fetch imediato + `setInterval(30_000)` + cleanup `clearInterval`
- Interface `TodayOrder` exportada; HTTP 404 → `order = null`
- 5 casos de teste passando: clearInterval no unmount, sem fetch após unmount, fetch imediato, poll 30s, 404→null

**Task 2 — Telas + HomeScreen + router:**
- `useNotifBadge.ts`: busca `/notifications/unread-count` no mount; expõe `refresh()`
- `TrackingScreen.tsx`: hero card espresso com BreadMark watermark + timeline 3 estados com `role="list"` + `aria-live="polite"` no Pill "agora" + card entregador placeholder + histórico 30 dias
- `NotificationsScreen.tsx`: GET `/notifications/me` + PATCH `/notifications/read-all` no mount; cards por tone (good/gold/neutral); botões CTA; estado vazio
- `HomeScreen.tsx`: bell button 40×40px com badge `var(--color-gold)` quando `unreadCount > 0`; TodayDelivery funcional com 3 variações visuais (SCHEDULED/OUT_FOR_DELIVERY/DELIVERED) + null state
- `router.tsx`: rota `pedidos` atualizada para `TrackingScreen`; rota `notificacoes` adicionada (lazy)

## Arquivos criados
- `apps/web/src/hooks/useOrderTracking.ts`
- `apps/web/src/hooks/__tests__/useOrderTracking.test.ts`
- `apps/web/src/hooks/useNotifBadge.ts`
- `apps/web/src/pages/client/TrackingScreen.tsx`
- `apps/web/src/pages/client/NotificationsScreen.tsx`

## Arquivos modificados
- `apps/web/src/pages/client/HomeScreen.tsx`
- `apps/web/src/routes/router.tsx`
