---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: — Experiência Completa do Cliente
status: executing
last_updated: "2026-06-19T00:00:00.000Z"
last_activity: 2026-06-19
progress:
  total_phases: 14
  completed_phases: 11
  total_plans: 57
  completed_plans: 59
  percent: 79
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-18)

**Core value:** O cliente configura a agenda uma vez e os pãezinhos chegam todo dia sem que ele precise fazer nada — o sistema cuida dos créditos, dos agendamentos e das notificações automaticamente.
**Current focus:** Phase 11 — configurações e perfil do cliente

## Current Position

Phase: 11 (configurações e perfil do cliente) — COMPLETE (2026-06-19)
Next: Phase 12 (cartões salvos)
Status: Ready to plan Phase 12
Last activity: 2026-06-19

## v1.0 Status Summary

| Phase | Status | Planos pendentes |
|-------|--------|-----------------|
| 1. Foundation | Complete (2026-06-13) | — |
| 2. Authentication | Complete (2026-06-14) | — |
| 3. Credits & Commerce | Complete (2026-06-18) | — |
| 4. Scheduling | Complete (2026-06-15) | — |
| 5. Delivery Experience | PARCIAL | 05-03, 05-04 |
| 6. Courier App | Complete (2026-06-15) | — |
| 7. Admin Panel | Complete (2026-06-15) | — |

## v1.1 Phases

| Phase | Goal | Requirements | Status |
|-------|------|--------------|--------|
| 8. Finalização Pagamentos | Webhooks MP + telas compra + Home Carteira | CRED-01..11 (exceto 07), PAY-01..02, UI-04, UI-07, UI-08 | Complete (2026-06-19) |
| 9. Finalização Rastreamento | Cron 21h + TrackingScreen + NotificationsScreen + badge | ACOMP-01..05 | Complete (2026-06-19) |
| 10. Schema v1.1 + CREDM + Logout | Schema unificado + crédito manual + logout | CREDM-01..03, LGOUT-01..02 | Needs Review (human UAT) |
| 11. Configurações e Perfil | Tela configurações completa + OTP contato + logout | CONF-01..07 | Complete (2026-06-19) |
| 12. Cartões Salvos | MP Customer API + cartão salvo no fluxo compra | CARD-01..06 | Not started |
| 13. Horários por Condomínio | Admin CRUD slots + cortes individuais + migração | SLOT-01..07 | Not started |
| 14. Agenda Multi-Slot | days Json + cron multi-slot + ScheduleScreen refatorada | MSCHED-01..04 | Not started |

## Performance Metrics

**Velocity:**

- Total plans completed: 18 (v1.0)
- Average duration: -
- Total execution time: 0 hours (v1.1)

**By Phase (v1.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | - | - |
| 02 | 6 | - | - |
| 04 | 6 | - | - |
| 10 | 3 | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 09-finaliza-o-rastreamento P01 | 8min | 2 tasks | 2 files |
| Phase 10 P01 | 2min | 2 tasks | 2 files |
| Phase 10 P02 | 15min | 2 tasks | 5 files |
| Phase 10 P03 | 20min | 2 tasks | 7 files |
| Phase 11-configura-es-e-perfil-do-cliente P01 | 8min | 2 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Stack definida e não revisitável: React+Vite PWA / Fastify+Prisma+MongoDB / Turborepo monorepo
- MongoDB Atlas remoto em dev (sem banco local) — consistência dev/prod
- Autenticação sem senha — apenas OTP via SMS/e-mail
- Pagamentos exclusivamente via Mercado Pago (Pix + cartão)
- Push notifications via OneSignal
- Fase 3: Polling Pix a cada 3s, max 5 tentativas (D-01)
- Fase 3: Créditos somente após webhook approved do MP (D-02)
- Fase 3: QR code gerado pelo backend (D-03)
- Fase 3: AutoBuyScreen apenas UI+save — cron na Fase 4/5 (D-04)
- Fase 3: CardPayment via MP Bricks frontend (D-12)
- v1.1: SavedCard como collection separada — `User.mpCustomerId` + model `SavedCard` com `mpCardId` (D-13)
- v1.1: Schedule mantém `weeklyQty`/`deliveryTime` como nullable — campo `days Json?` adicionado para multi-slot sem migração forçada (D-14)
- v1.1: `Condominium.deliverySlots String[]` embedded — array simples de strings HH:MM (D-15)
- v1.1: CVV obrigatório via Brick a cada transação com cartão salvo — `processAutoBuy` apenas via Pix (D-16)
- v1.1: `@@unique([userId, condominiumId])` em Schedule mantido — horário por dia dentro do campo `days` (Cenário A, sem risco de migração de índice) (D-17)
- v1.1: OTP de mudança de contato precisa de `purpose: 'CONTACT_CHANGE'` para não conflitar com `findActiveOtp` de login (D-18)
- Fase 9: Fase audita e completa gaps — não reconstrói do zero (D-01 Phase 9)
- Fase 9: NotifContext usa React Context nativo (padrão AuthContext) com useCallback para refresh() (D-06/07 Phase 9)
- Fase 9: mark-all-read automático ao montar NotificationsScreen — sem botão explícito (D-08 Phase 9)
- Fase 9: notification.data = { screen: 'pedidos' } nos pushes sendEveReminders e notifyAndPersist (D-03/04 Phase 9)
- [Phase ?]: Campo data do SDK @onesignal/node-onesignal recebido pelo frontend como additionalData.screen
- [Phase ?]: v1.1 Phase 10-02: adminId extraido do JWT no controller (nunca do body) — padrao T-10-02-01 aplicado
- [Phase ?]: D-18 aplicado: purpose: { in: [null, 'LOGIN'] } em findActiveOtp — documentos OtpCode sem purpose (legados) tratados como LOGIN para backward-compat

### Pending Todos

- Executar script de backfill de `deliverySlots` nos condomínios existentes antes de iniciar Phase 13
- Verificar se `CourierScreen` precisa filtrar por slot em `GET /courier/orders/today` após Phase 14

### Blockers/Concerns

- Phase 10 concluída — schema v1.1 aplicado, desbloqueando Phases 11, 12, 13, 14
- Phase 13 depende de script de migração ser executado no Atlas antes do deploy — documentar no plano

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Fase 4/5 | Cron job de compra automática (CRED-07/10) | Em produção (Phase 4) | Phase 3 Context |
| Fase 4/5 | Tokenização de cartão para cobranças futuras | Endereçado em Phase 12 (v1.1) | Phase 3 Context |
| Fase 5/7 | Status de pagamento no painel Admin (PAY-03) | Completo (Phase 7) | Phase 3 Context |
| Fase 5 | Estorno e reembolso de pagamentos (PAY-04) | Completo (Phase 7) | Phase 3 Context |
| Fase 7 | Promoções e descontos em combos (ADMG-03) | Completo (Phase 7) | Phase 3 Context |
| v1.1 | Histórico de créditos manuais visível ao cliente | Defer → v2 | Research v1.1 |
| v1.1 | Cartão padrão com 1 toque | Defer → v2 | Research v1.1 |
| v1.1 | Toggles granulares de notificações push | Defer → v2 | Research v1.1 |
| v1.1 | Badge de contagem de clientes por slot | Defer → v2 | Research v1.1 |
| v1.1 Fase 9 | Push de "Saiu para entrega" (OUT_FOR_DELIVERY) | Defer → v2 | Phase 9 Context |
| v1.1 Fase 9 | Polling do badge em tempo real com app aberto (WebSocket/SSE) | Defer → v2 | Phase 9 Context |

## Quick Tasks Completed

| Task | Date | Commit |
|------|------|--------|
| openapi-schemas-routes — schemas OpenAPI detalhados em 20 route files | 2026-06-16 | 34e95d3 |

## Session Continuity

Last session: 2026-06-19
Resume with: `/gsd:plan-phase 12`
Next phase: 12-cartoes-salvos (not planned)
