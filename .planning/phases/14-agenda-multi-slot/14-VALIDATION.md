---
phase: 14
slug: agenda-multi-slot
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-20
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (latest) |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `cd apps/api && npm test -- schedules.service` |
| **Full suite command** | `cd apps/api && npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && npm test -- schedules.service`
- **After every plan wave:** Run `cd apps/api && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 0 | MSCHED-02, MSCHED-04 | T-14-01 | userId sempre do JWT (nunca do body) | unit | `cd apps/api && npm test -- schedules.service` | ✅ W0 | ⬜ pending |
| 14-01-02 | 01 | 0 | MSCHED-02 | — | N/A | unit | `cd apps/api && npm test -- schedules.service` | ✅ W0 | ⬜ pending |
| 14-02-01 | 02 | 1 | MSCHED-03 | — | N/A | manual | — | — | ⬜ pending |
| 14-02-02 | 02 | 1 | MSCHED-01, MSCHED-03 | — | N/A | manual | — | — | ⬜ pending |
| 14-03-01 | 03 | 2 | MSCHED-02 | T-14-02 | Validar WeeklyQty min(0) max(12) por dia no DaysSchema | unit | `cd apps/api && npm test -- schedules.service` | ✅ W0 | ⬜ pending |
| 14-03-02 | 03 | 2 | MSCHED-04 | — | N/A | unit | `cd apps/api && npm test -- schedules.service` | ✅ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/modules/schedules/__tests__/schedules.service.test.ts` — adicionar testes MSCHED-02/04:
  - `createDailyOrders_multiSlot_cria2Orders_quandoAmbosSlotsTêmQty`
  - `createDailyOrders_multiSlot_criaApenasOrdersManhã_quandoTardeInsuficiente`
  - `createDailyOrders_legado_continuaFuncionando_quandoDaysNulo`
  - `getConsumoSemanal_retornaSomaTotal_modoMultiSlot`
  - `sendEveReminders_textoPush_inclui_deliveryTime_quandoDisponível`
  - `sendEveReminders_textoPush_SEM_null_quandoDeliveryTimeNulo`
  - `sendLowCreditNotifications_usaGetConsumoSemanal_modoMultiSlot`

*(Infraestrutura de teste já existe — não criar `vitest.config.ts` ou fixtures novos.)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `ScheduleScreen` renderiza 2 seções quando `activeSlots.length >= 2` | MSCHED-01, MSCHED-03 | UI/DOM — Vitest não renderiza React nesta fase | 1. Logar como cliente em condo com 2 slots ativos. 2. Navegar para Agenda. 3. Verificar headers "☀️ Manhã · 06:30" e "🌙 Tarde · 15:30" com 7 day-rows cada. |
| Footer exibe `"Consumo semanal: X pães"` (sem horário) no modo multi-slot | MSCHED-03 | UI | Verificar rodapé da ScheduleScreen no modo multi-slot — sem texto de horário. |
| `ScheduleScreen` modo single-slot permanece inalterado quando `activeSlots.length < 2` | MSCHED-04 | UI — regressão | 1. Logar em condo com 1 slot ativo. 2. Navegar para Agenda. 3. Verificar que a UI single-slot original (DeliveryTimeChips + 7 rows únicas) está intacta. |
| Schedule salvo em formato multi-slot persiste e recarrega corretamente | MSCHED-01 | E2E | 1. Configurar agenda multi-slot. 2. Salvar. 3. Recarregar página. 4. Verificar que os valores estão corretos nas 2 seções. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
