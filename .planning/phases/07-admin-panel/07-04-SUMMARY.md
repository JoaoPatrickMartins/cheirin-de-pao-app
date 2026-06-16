---
phase: 07-admin-panel
plan: 04
subsystem: api
tags: [fastify, prisma, pdfmake, exceljs, tdd, admin, mongodb]

requires:
  - phase: 07-01
    provides: schema PurchaseOrder + PurchaseOrderItem com status DRAFT/FINALIZED; Supplier.isPrincipal; Prisma Client v6.19.3 regenerado

provides:
  - pdf-generator.ts: generatePdf(data: SupplierOrderData) retorna Promise<Buffer> via pdfmake v0.3 getBuffer()
  - excel-generator.ts: generateExcel(data: SupplierOrderData) retorna Promise<Buffer> via exceljs writeBuffer()
  - SupplierOrderData type exportado de pdf-generator.ts (compartilhado entre geradores e service)
  - GET /admin/supplier-orders/draft: lista de condominios com totais de paes para o dia seguinte
  - POST /admin/supplier-orders: cria PurchaseOrder DRAFT + items em $transaction
  - PATCH /admin/supplier-orders/:id/finalize: DRAFT -> FINALIZED (idempotencia via 400)
  - GET /admin/supplier-orders/:id/pdf: Buffer PDF com Content-Type application/pdf
  - GET /admin/supplier-orders/:id/excel: Buffer XLSX com Content-Type vnd.openxmlformats
  - GET /admin/supplier-orders: historico de pedidos FINALIZED
  - Modulo admin-supplier-orders registrado em server.ts

affects:
  - 07-09 (AdminPedido UI - usa esses endpoints para fluxo de 4 passos)
  - 07-10 (AdminPainel - dashboard pode referenciar totais de pedidos)

tech-stack:
  added:
    - pdfmake v0.3 (hoisting npm workspaces - presente em node_modules raiz)
    - exceljs v4.4.0 (hoisting npm workspaces - presente em node_modules raiz)
  patterns:
    - pdfmake v0.3 pattern: addFonts(Helvetica) + createPdf(docDefinition) + await pdf.getBuffer() (sem callback, sem vfs_fonts.js)
    - exceljs pattern: new Workbook() + addWorksheet() + sheet.columns + addRow() + xlsx.writeBuffer() as Promise<Buffer>
    - AdminSupplierOrdersRepository: findById, findByIdWithItems, findHistory, create ($transaction), finalize
    - Role check ADMIN inline no controller (6 handlers, padrao existente)
    - Rota /draft registrada antes de /:id para evitar conflito de parametro no Fastify

key-files:
  created:
    - apps/api/src/modules/admin-supplier-orders/pdf-generator.ts
    - apps/api/src/modules/admin-supplier-orders/excel-generator.ts
    - apps/api/src/modules/admin-supplier-orders/admin-supplier-orders.schema.ts
    - apps/api/src/modules/admin-supplier-orders/admin-supplier-orders.repository.ts
    - apps/api/src/modules/admin-supplier-orders/admin-supplier-orders.service.ts
    - apps/api/src/modules/admin-supplier-orders/admin-supplier-orders.controller.ts
    - apps/api/src/modules/admin-supplier-orders/admin-supplier-orders.route.ts
    - apps/api/src/modules/admin-supplier-orders/__tests__/generators.test.ts
    - apps/api/src/modules/admin-supplier-orders/__tests__/admin-supplier-orders.module.test.ts
  modified:
    - apps/api/src/server.ts (import + registro adminSupplierOrdersRoute)

key-decisions:
  - "pdfmake v0.3: import exato 'pdfmake/js/index.js', addFonts() antes de createPdf(), getBuffer() como Promise (sem callback) -- incompativel com v0.2"
  - "Rota /draft registrada antes de /:id para evitar ambiguidade de parametro no Fastify router"
  - "getDraft calcula amanha BRT com Date.setUTCDate(+1) + offset BRT simplificado (UTC+3)"
  - "Service verifica Supplier.findUnique antes de criar items (T-07-04-03: 404 se nao existe)"
  - "finalize verifica status=DRAFT antes de atualizar -- retorna 400 se ja FINALIZED (T-07-04-04)"

patterns-established:
  - "pdf-generator: pdfmake v0.3 com Helvetica built-in, tabela 4 colunas, await pdf.getBuffer()"
  - "excel-generator: exceljs Workbook + 4 colunas, rows de items + row TOTAL, writeBuffer() as Promise<Buffer>"
  - "AdminSupplierOrdersRepository: isola acesso ao banco do service (padrao existente)"

requirements-completed: [ADMO-05, ADMO-06, ADMO-07, ADMO-08, ADMO-09]

duration: 15min
completed: "2026-06-16"
---

# Phase 7 Plan 4: Modulo Admin Supplier Orders + Geradores PDF/Excel Summary

**Modulo admin-supplier-orders completo com 7 arquivos TypeScript: geradores PDF (pdfmake v0.3 getBuffer()) e Excel (exceljs writeBuffer()), service com getDraft/create/finalize/history/pdf/excel, e endpoints protegidos por role check ADMIN para os requisitos ADMO-05 a ADMO-09.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-16T21:33:00Z
- **Completed:** 2026-06-16T21:38:30Z
- **Tasks:** 2 (TDD com 4 commits: 2 RED + 2 GREEN)
- **Files criados:** 9 (7 implementacao + 2 testes)
- **Files modificados:** 1 (server.ts)

## Accomplishments

- pdf-generator.ts e excel-generator.ts implementados e verificados retornando Buffer > 100 bytes
- Modulo admin-supplier-orders completo com 5 arquivos (schema, repository, service, controller, route)
- 6 endpoints protegidos com role check ADMIN inline e preHandler authenticate
- Suite Vitest API verde: 11 arquivos de teste, 75 testes passando
- Rota /draft registrada antes de /:id para evitar conflito de parametro no Fastify

## Task Commits

Cada task foi commitada atomicamente seguindo TDD RED -> GREEN:

1. **Task 1 RED - Testes geradores** - `514018c` (test)
2. **Task 1 GREEN - pdf-generator.ts + excel-generator.ts** - `c2f3f76` (feat)
3. **Task 2 RED - Testes service completo** - `4f60b9c` (test)
4. **Task 2 GREEN - 5 arquivos modulo + server.ts** - `81731c6` (feat)

## Files Created/Modified

- `apps/api/src/modules/admin-supplier-orders/pdf-generator.ts` - generatePdf() com pdfmake v0.3 + SupplierOrderData type
- `apps/api/src/modules/admin-supplier-orders/excel-generator.ts` - generateExcel() com exceljs
- `apps/api/src/modules/admin-supplier-orders/admin-supplier-orders.schema.ts` - CreateSupplierOrderSchema Zod
- `apps/api/src/modules/admin-supplier-orders/admin-supplier-orders.repository.ts` - CRUD PurchaseOrder + $transaction
- `apps/api/src/modules/admin-supplier-orders/admin-supplier-orders.service.ts` - getDraft, create, finalize, getHistory, getPdfBuffer, getExcelBuffer
- `apps/api/src/modules/admin-supplier-orders/admin-supplier-orders.controller.ts` - 6 handlers com role check ADMIN
- `apps/api/src/modules/admin-supplier-orders/admin-supplier-orders.route.ts` - 6 rotas com preHandler authenticate
- `apps/api/src/modules/admin-supplier-orders/__tests__/generators.test.ts` - 4 testes para generatePdf e generateExcel
- `apps/api/src/modules/admin-supplier-orders/__tests__/admin-supplier-orders.module.test.ts` - 8 testes para service completo
- `apps/api/src/server.ts` - import + registro adminSupplierOrdersRoute

## Decisions Made

- pdfmake v0.3: import exato `pdfmake/js/index.js` (nao `pdfmake` diretamente), `addFonts()` antes de `createPdf()`, `await pdf.getBuffer()` como Promise sem callback -- conforme Pattern 2 do RESEARCH.md
- Rota `/draft` registrada ANTES de `/:id` para evitar que o router interprete "draft" como parametro de ID no Fastify
- `getDraft` calcula amanha BRT com `Date.setUTCDate(+1)` + offset +3h para BRT simplificado
- Service verifica `Supplier.findUnique` antes de criar items -- lanca 404 se fornecedor invalido (T-07-04-03)
- `finalize` verifica `status === 'DRAFT'` antes de atualizar -- lanca 400 se ja FINALIZED (T-07-04-04 idempotencia)

## Deviations from Plan

Nenhuma -- plano executado exatamente como escrito.

## Known Stubs

Nenhum stub -- todos os metodos implementados com logica real.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| T-07-04-01 mitigado | admin-supplier-orders.controller.ts | 6 handlers com role check ADMIN inline -- 403 se nao ADMIN |
| T-07-04-02 mitigado | admin-supplier-orders.route.ts | preHandler: [fastify.authenticate] em todas as rotas -- 401 sem token |
| T-07-04-03 mitigado | admin-supplier-orders.service.ts | Supplier.findUnique antes de criar items -- 404 se supplierId invalido |
| T-07-04-04 mitigado | admin-supplier-orders.service.ts | status === 'DRAFT' verificado antes de finalize -- 400 se ja FINALIZED |

## Self-Check: PASSED

- `apps/api/src/modules/admin-supplier-orders/pdf-generator.ts` -- FOUND
- `apps/api/src/modules/admin-supplier-orders/excel-generator.ts` -- FOUND
- `apps/api/src/modules/admin-supplier-orders/admin-supplier-orders.schema.ts` -- FOUND
- `apps/api/src/modules/admin-supplier-orders/admin-supplier-orders.repository.ts` -- FOUND
- `apps/api/src/modules/admin-supplier-orders/admin-supplier-orders.service.ts` -- FOUND
- `apps/api/src/modules/admin-supplier-orders/admin-supplier-orders.controller.ts` -- FOUND
- `apps/api/src/modules/admin-supplier-orders/admin-supplier-orders.route.ts` -- FOUND
- Commit `514018c` -- test RED generators
- Commit `c2f3f76` -- feat GREEN generators
- Commit `4f60b9c` -- test RED module
- Commit `81731c6` -- feat GREEN module
- Suite Vitest API: 11 test files, 75 testes passando

## TDD Gate Compliance

- RED gate: commits `514018c` (generators) e `4f60b9c` (module) com prefixo `test(07-04)`
- GREEN gate: commits `c2f3f76` (generators) e `81731c6` (module) com prefixo `feat(07-04)`
- Sequencia RED -> GREEN respeitada em ambas as tasks
