---
phase: 13-hor-rios-por-condom-nio
plan: "02"
subsystem: backend/admin-condominiums
tags: [fastify, prisma, mongodb, crud, slots, read-modify-write]
dependency_graph:
  requires: [13-01 (DeliverySlot composite type)]
  provides: [PATCH /admin/condominiums/:id/slots/:slotName, DEFAULT_SLOTS na criação, processCutoff multi-slot]
  affects: [apps/api/src/modules/admin-condominiums, apps/api/src/modules/admin-settings]
tech_stack:
  added: []
  patterns: [read-modify-write para atualização de elemento de array no MongoDB via Prisma]
key_files:
  created: []
  modified:
    - apps/api/src/modules/admin-condominiums/admin-condominiums.schema.ts
    - apps/api/src/modules/admin-condominiums/admin-condominiums.repository.ts
    - apps/api/src/modules/admin-condominiums/admin-condominiums.service.ts
    - apps/api/src/modules/admin-condominiums/admin-condominiums.controller.ts
    - apps/api/src/modules/admin-condominiums/admin-condominiums.route.ts
    - apps/api/src/modules/admin-settings/admin-settings.service.ts
decisions:
  - "repository.create() aceita deliverySlots opcional via type intersection para não quebrar CreateCondominiumBody existente"
  - "processCutoff atualizado inline (Rule 2) para iterar por condomínio/slot em vez de cutoffTime global"
  - "slotName aceita apenas 'manha' ou 'tarde' — documentado no schema Swagger com enum"
metrics:
  duration: "~8 minutos"
  completed: "2026-06-20"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 6
---

# Phase 13 Plan 02: Admin CRUD Slots (backend) Summary

**One-liner:** PATCH /admin/condominiums/:id/slots/:slotName implementado via read-modify-write no Prisma MongoDB, com DEFAULT_SLOTS injetados na criação e processCutoff adaptado para multi-slot por condomínio.

## Tasks Completed

| Task | Descrição | Commit | Arquivos |
|------|-----------|--------|---------|
| 1 | SlotUpdateSchema + repository.updateSlot (read-modify-write) | `908abdc` | `admin-condominiums.schema.ts`, `admin-condominiums.repository.ts` |
| 2 | Service + Controller + Route + processCutoff multi-slot | `f78f45b` | `admin-condominiums.service.ts`, `admin-condominiums.controller.ts`, `admin-condominiums.route.ts`, `admin-settings.service.ts` |

## What Was Built

### Task 1 — SlotUpdateSchema e repository.updateSlot

Adicionado `SlotUpdateSchema` ao schema com validação de `time` e `cutoffTime` no formato `HH:MM` e `isActive` como boolean (todos opcionais). O método `updateSlot` no repository implementa o padrão read-modify-write obrigatório no Prisma com MongoDB:

1. `findById(id)` — lança 404 se condomínio não existir
2. Verifica se slot com `name === slotName` existe no array — lança 404 se não encontrado
3. Mapeia array substituindo apenas o slot alvo com spread: `{ ...s, ...patch }`
4. `prisma.condominium.update` reescreve o array inteiro

### Task 2 — Service, Controller, Route e processCutoff

`AdminCondominiumsService.create()` agora injeta `DEFAULT_SLOTS` ao criar qualquer condomínio:
```typescript
const DEFAULT_SLOTS = [
  { name: 'manha', time: '06:30', cutoffTime: '22:00', isActive: true },
  { name: 'tarde', time: '15:30', cutoffTime: '10:00', isActive: true },
]
```

Handler `updateSlot` no controller segue o mesmo padrão dos demais handlers: check ADMIN, Zod parse, try/catch com mapeamento de statusCode. Rota `PATCH /admin/condominiums/:id/slots/:slotName` registrada com `preHandler: [fastify.authenticate]` e schema Swagger completo incluindo enum `['manha', 'tarde']` no param `slotName`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Funcionalidade crítica] processCutoff atualizado para multi-slot**
- **Encontrado em:** Task 2 (ao verificar admin-settings.service.ts estava modificado mas não commitado)
- **Problema:** `processCutoff` ainda usava `getCutoffTime()` global — incompatível com o modelo multi-slot por condomínio introduzido na Wave 1. A lógica precisava iterar por condomínio e slot ativo para comparar `cutoffTime` do slot com o horário atual, em vez de um cutoff único global.
- **Fix:** Refatorado para buscar todos os condomínios ativos com seus slots, filtrar pares `(condoId, slotName)` cujo `cutoffTime` bate com o horário atual (HH:MM BRT), e iterar por par enviando pushes filtrados por `condominiumId` do cliente.
- **Arquivos modificados:** `apps/api/src/modules/admin-settings/admin-settings.service.ts`
- **Commit:** `f78f45b`

## Known Stubs

Nenhum stub identificado — endpoints retornam dados reais do MongoDB.

## Threat Flags

Nenhum novo surface de segurança introduzido. PATCH /admin/condominiums/:id/slots/:slotName está protegido por `fastify.authenticate` + role check ADMIN inline (padrão D-11 do projeto).

## Self-Check: PASSED

- [x] `SlotUpdateSchema` em `admin-condominiums.schema.ts` (2 ocorrências: declaração + export)
- [x] `updateSlot` em `admin-condominiums.repository.ts` (1 ocorrência)
- [x] `slots/:slotName` em `admin-condominiums.route.ts` (1 ocorrência)
- [x] `DEFAULT_SLOTS` em `admin-condominiums.service.ts` (2 ocorrências: declaração + uso)
- [x] TypeScript sem erros em arquivos admin-condominiums (npx tsc --noEmit retorna zero linhas para esses arquivos)
- [x] Commit `908abdc` — Task 1
- [x] Commit `f78f45b` — Task 2
