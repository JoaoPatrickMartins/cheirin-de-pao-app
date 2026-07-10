---
phase: 13-hor-rios-por-condom-nio
plan: "03"
subsystem: backend
tags: [slots, multi-slot, processCutoff, condominium, push-notification, api, security]
dependency_graph:
  requires: [13-01]
  provides: [GET /client/condominium/slots, processCutoff multi-slot]
  affects: [admin-settings.service.ts, condominiums.route.ts]
tech_stack:
  added: []
  patterns: [batched-query-per-condominium, IDOR-prevention-via-DB-lookup]
key_files:
  created: []
  modified:
    - apps/api/src/modules/admin-settings/admin-settings.service.ts
    - apps/api/src/modules/condominiums/condominiums.route.ts
decisions:
  - processCutoff itera por condomínio/slot sem O(N²) — query batched por condominiumId
  - GET /client/condominium/slots busca condominiumId via DB (não JWT) por consistência com padrão do projeto
metrics:
  duration: "~15min"
  completed: "2026-06-19"
  tasks_completed: 2
  files_changed: 2
---

# Phase 13 Plan 03: processCutoff multi-slot + GET /client/condominium/slots Summary

**One-liner:** Refatoração de `processCutoff` para iterar por condomínio/slot com push personalizado por período, e novo endpoint `GET /client/condominium/slots` com proteção anti-IDOR.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Refatorar processCutoff para multi-slot por condomínio | (via 13-02 f78f45b) | admin-settings.service.ts |
| 2 | Endpoint GET /client/condominium/slots | 25f9ec0 | condominiums.route.ts |

## What Was Built

### Task 1 — processCutoff multi-slot

O método `processCutoff()` foi refatorado para:
1. Calcular `nowHHMM` via `Intl.DateTimeFormat` em BRT.
2. Buscar todos os condomínios ativos com `deliverySlots`.
3. Filtrar pares (condomínio, slot) cujo `slot.cutoffTime === nowHHMM`.
4. Para cada par: query batched de clientes por `condominiumId`, query Orders de amanhã filtrada por `condominiumId`.
5. Push personalizado: `'tarde'` → "Prazo de pãezinhos da tarde de amanhã encerrando!", padrão → "Prazo de pãezinhos da manhã de amanhã encerrando!".

`getCutoffTime()`, `getCutoffStatus()`, `setCutoffTime()` — intocados.

### Task 2 — GET /client/condominium/slots

Nova rota registrada em `condominiumsRoute`:
- `GET /client/condominium/slots` com `preHandler: [fastify.authenticate]`
- Busca `condominiumId` do usuário autenticado via `prisma.user.findUnique` (nunca de query param)
- Filtra `deliverySlots.filter(s => s.isActive)`
- Retorna 404 se usuário sem condomínio ou condomínio não encontrado

## Deviations from Plan

### Coordination com agente paralelo 13-02

**Encontrado durante:** Task 1  
**Situação:** O agente do plano 13-02 já havia implementado `processCutoff` multi-slot como Rule 2 (funcionalidade crítica faltante) no commit `f78f45b`. A implementação já presente no `HEAD` era idêntica à planejada para este plano.  
**Ação tomada:** Task 1 foi verificada como já satisfeita — sem commit duplicado. Task 2 continuou normalmente.  
**Impacto:** Nenhum — resultado final correto.

### condominiumId não disponível no JWT (Rule 1 — auto-fix)

**Encontrado durante:** Task 2  
**Situação:** O plano assumia `user.condominiumId` do JWT, mas o plugin `authenticate.ts` popula apenas `{ id, role, name }`.  
**Fix:** Buscar `condominiumId` via `prisma.user.findUnique({ where: { id: user.id }, select: { condominiumId: true } })` — padrão idêntico ao `schedules.controller.ts`.  
**Commit:** 25f9ec0

## Security Notes

- `GET /client/condominium/slots` nunca aceita `condominiumId` de query param ou body.
- `condominiumId` é obtido do banco a partir do `user.id` do JWT — proteção IDOR garantida.
- Schema Swagger documenta a política de segurança explicitamente.

## Known Stubs

Nenhum — implementação completa.

## Self-Check

- [x] `condominiums.route.ts` contém `/client/condominium/slots`
- [x] `admin-settings.service.ts` contém `deliverySlots`  
- [x] TypeScript compila sem erros nos arquivos modificados
- [x] Commit 25f9ec0 existe no log

## Self-Check: PASSED
