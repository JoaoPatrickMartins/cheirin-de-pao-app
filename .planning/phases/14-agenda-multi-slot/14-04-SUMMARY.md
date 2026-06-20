---
phase: 14-agenda-multi-slot
plan: 04
status: complete
completed_at: "2026-06-20"
---

# Summary — Plano 04: Frontend Multi-Slot (useSchedule + ScheduleScreen)

## O que foi feito

**Task 1 — useSchedule.ts (D-11, D-12)**
- Adicionado estado `days: Record<string, WeeklyQty>` e `setDays`
- Interface `ScheduleApiResponse` estende com `days?: Record<string, WeeklyQty> | null`
- `useEffect` de load inicializa `days` a partir de `data.days` quando presente no backend
- `consumoSemanal`: atualizado para somar todos os slots multi-slot se `Object.keys(days).length > 0` (D-09 client-side)
- `saveSchedule(activeSlots)`: nova assinatura — detecta `isMulti` e envia `{ days }` ou `{ weeklyQty, deliveryTime }` conforme o modo (D-12)
- `UseScheduleReturn` exporta `days` e `setDays`

**Task 2 — ScheduleScreen.tsx (D-05, D-06, D-07, D-13)**
- `isMultiSlot = activeSlots.length >= 2` calculado após fetch de slots (D-05)
- D-13: `useEffect` de fetchSlots inicializa `days` zerado para condo multi-slot sem `schedule.days` preexistente
- `handleSave`: `saveSchedule(slots)` — passa todos os slots para o hook determinar o modo
- Subtexto introdutório condicional por modo
- Renderização condicional: modo multi-slot exibe 2 seções com headers pill "☀️ Manhã · HH:MM" / "🌙 Tarde · HH:MM" (D-06)
- Modo single-slot: layout original inalterado (DeliveryTimeChips + 7 rows)
- Footer: multi-slot exibe só "X pães" sem horário; single-slot mantém "X pães · HH:MM" (D-07)
- `DEFAULT_WEEKLY_QTY` declarado localmente para fallback em `days[slot.time] ?? DEFAULT_WEEKLY_QTY`

## Resultado técnico

- TypeScript sem erros em `useSchedule.ts` e `ScheduleScreen.tsx`
- Backend: 39/39 testes verdes (zero regressões)
- Aguardando checkpoint humano de verificação visual

## Pending

- Verificação visual do checkpoint (Teste 1, 2, 3 do plano)
