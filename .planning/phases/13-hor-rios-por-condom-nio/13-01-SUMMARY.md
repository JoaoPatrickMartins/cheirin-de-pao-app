---
phase: 13-hor-rios-por-condom-nio
plan: "01"
subsystem: backend/schema
tags: [prisma, mongodb, composite-type, migration, schema]
dependency_graph:
  requires: []
  provides: [DeliverySlot composite type, migrate-delivery-slots script]
  affects: [apps/api, prisma client]
tech_stack:
  added: []
  patterns: [Prisma composite type (embedded document), standalone migration script]
key_files:
  created:
    - apps/api/src/scripts/migrate-delivery-slots.ts
  modified:
    - apps/api/prisma/schema.prisma
    - apps/api/package.json
decisions:
  - "prisma db push NÃO executado — aguarda execução do script no Atlas primeiro"
  - "DeliverySlot declarado como composite type (tipo embutido), seguindo o padrão do Address já existente"
  - "Script de migração usa detecção defensiva: migra condos com slots vazios OU sem campo name"
metrics:
  duration: "~5 minutos"
  completed: "2026-06-20"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# Phase 13 Plan 01: Schema Prisma + Script de Migração Summary

**One-liner:** Composite type `DeliverySlot` adicionado ao schema Prisma com script standalone de migração de dados legados para MongoDB Atlas.

## Tasks Completed

| Task | Descrição | Commit | Arquivos |
|------|-----------|--------|---------|
| 1 | Adicionar composite type DeliverySlot ao schema.prisma e executar prisma generate | `1e97ca4` | `apps/api/prisma/schema.prisma` |
| 2 | Criar script migrate-delivery-slots.ts e registrar migrate:slots no package.json | `4dc1f9e` | `apps/api/src/scripts/migrate-delivery-slots.ts`, `apps/api/package.json` |

## What Was Built

### Task 1 — Composite type DeliverySlot

Adicionado o composite type `DeliverySlot` na seção de tipos embutidos do schema, seguindo o padrão já estabelecido pelo type `Address`. O campo `deliverySlots String[]` foi substituído por `deliverySlots DeliverySlot[]` no model `Condominium`. O comando `prisma generate` foi executado com sucesso, regenerando o Prisma Client tipado.

```prisma
type DeliverySlot {
  name        String  // "manha" | "tarde"
  time        String  // "06:30"
  cutoffTime  String  // "22:00"
  isActive    Boolean
}
```

### Task 2 — Script de migração standalone

Criado `apps/api/src/scripts/migrate-delivery-slots.ts` com lógica defensiva de detecção de formato legado:
- Migra condomínios com `deliverySlots` vazio (`length === 0`)
- Migra condomínios cujos slots não possuem campo `name` (formato string legado)
- Pula condomínios já migrados (com slots no formato correto)
- Reporta contagem de atualizados vs. já migrados ao final

Script `migrate:slots` registrado em `apps/api/package.json` para execução via `npm run migrate:slots`.

## AVISO CRITICO: Ordem de Deploy Obrigatoria

**`prisma db push` NAO foi executado intencionalmente.** Executar o push antes de migrar os dados existentes no Atlas causaria erros de tipo em runtime — o Prisma MongoDB não faz coerção automática de `String` para o composite type.

### Ordem obrigatória antes do deploy:

1. **Executar script de migração no Atlas:**
   ```bash
   cd apps/api && npm run migrate:slots
   ```

2. **Executar prisma generate** (se ainda não feito):
   ```bash
   cd apps/api && npx prisma generate
   ```

3. **Executar prisma db push** (somente após o script ter rodado):
   ```bash
   cd apps/api && npx prisma db push
   ```

4. **Deploy da API** (somente após os passos anteriores)

Pular ou inverter a ordem desses passos resultará em documentos com strings no Atlas sendo lidos pelo client tipado, gerando erros de runtime.

## Deviations from Plan

None — plano executado exatamente conforme escrito.

## Self-Check

- [x] `apps/api/prisma/schema.prisma` contém `type DeliverySlot` (1 ocorrência)
- [x] `apps/api/prisma/schema.prisma` contém `deliverySlots DeliverySlot[]` (1 ocorrência)
- [x] `prisma generate` executou sem erros
- [x] `apps/api/src/scripts/migrate-delivery-slots.ts` criado com DEFAULT_SLOTS corretos
- [x] Script `migrate:slots` registrado em `apps/api/package.json`
- [x] Commit `1e97ca4` — Task 1
- [x] Commit `4dc1f9e` — Task 2
