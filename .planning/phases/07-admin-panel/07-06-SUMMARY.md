---
phase: 07-admin-panel
plan: 06
subsystem: api-integration
tags: [fastify, prisma, cron, tdd, dashboard, admin-orders, cutoff-status, frontend]
dependency_graph:
  requires:
    - 07-02 (AdminSettingsService.processCutoff, adminSettingsRoute)
    - 07-03 (adminSuppliersRoute, adminCouriersRoute, adminClientsRoute)
    - 07-04 (adminSupplierOrdersRoute)
    - 07-05 (adminFinancialRoute, adminPaymentsRoute)
  provides:
    - server.ts com todos os 9 módulos admin registrados (Wave 1 fechada)
    - Cron 4: '0 * * * *' chamando AdminSettingsService.processCutoff() (cutoff-check)
    - GET /admin/dashboard (breadsTodayCount, revenueToday, clientsCount, condominiumsCount, cutoffTime, revenueByType)
    - GET /admin/orders/delivery-status (entregas do dia por condomínio + orderIds)
    - GET /admin/orders/division-suggestion (algoritmo greedy de divisão entre entregadores)
    - GET /settings/cutoff-status (endpoint público para HomeScreen do cliente)
    - Banner de corte no HomeScreen.tsx (isCutoff check sem autenticação)
  affects:
    - 07-09 (AdminEntregas usa /admin/orders/delivery-status e /admin/orders/division-suggestion)
    - 07-10 (AdminPainel usa GET /admin/dashboard)
    - Cliente (HomeScreen exibe banner quando isCutoff === true)
tech_stack:
  added: []
  patterns:
    - getDashboard via Promise.all paralelizando 7 queries (performance)
    - Cálculo de "hoje BRT" via toLocaleDateString + parse manual para UTC (sem lib externa)
    - Algoritmo greedy de divisão: sort desc por quantity + min-heap simulado com array scan
    - Endpoint público registrado ANTES das rotas autenticadas para evitar conflito de preHandler
    - Banner de corte: fetch sem token + falha silenciosa (catch → isCutoff=false)
key_files:
  modified:
    - apps/api/src/server.ts (9 novos fastify.register)
    - apps/api/src/plugins/cron.ts (Cron 4 processCutoff)
    - apps/api/src/modules/admin-orders/admin-orders.service.ts (getDashboard + getDeliveryStatus + getDivisionSuggestion + fix NotificationType)
    - apps/api/src/modules/admin-orders/admin-orders.controller.ts (handlers dashboard + deliveryStatus + divisionSuggestion)
    - apps/api/src/modules/admin-orders/admin-orders.route.ts (3 novas rotas GET antes das rotas dinâmicas)
    - apps/api/src/modules/admin-settings/admin-settings.service.ts (getCutoffStatus)
    - apps/api/src/modules/admin-settings/admin-settings.controller.ts (handler cutoffStatus)
    - apps/api/src/modules/admin-settings/admin-settings.route.ts (rota pública /settings/cutoff-status)
    - apps/web/src/pages/client/HomeScreen.tsx (useEffect + banner de corte)
  created:
    - apps/api/src/modules/admin-orders/__tests__/admin-orders-dashboard.service.test.ts (15 testes TDD RED/GREEN)
decisions:
  - getDashboard usa Promise.all com 7 queries paralelas para minimizar latência dos KPIs
  - Cálculo de "início do dia BRT" usa toLocaleDateString + parse manual: BRT = UTC-3, então startOfDay BRT = 03:00 UTC — evita dependência de lib externa de timezone
  - getDivisionSuggestion retorna apenas entregadores com pelo menos 1 condomínio atribuído — evita entradas vazias no resultado
  - GET /settings/cutoff-status registrado sem preHandler (público) ANTES das rotas autenticadas — garante que o authenticate plugin não interfira
  - HomeScreen usa falha silenciosa no fetch (catch → isCutoff=false) — evita degradação da UX em caso de falha de rede
metrics:
  duration: 15min
  completed_date: "2026-06-16T00:55:00Z"
  tasks_completed: 3
  files_modified: 9
  files_created: 1
---

# Phase 7 Plan 6: Integração Wave 1 API — Dashboard, Cron Cutoff e Banner de Corte Summary

**One-liner:** Fechamento da Wave 1 API: 9 módulos admin registrados no server.ts, Cron 4 de corte horário, endpoints de dashboard/delivery-status/division-suggestion com algoritmo greedy, endpoint público de cutoff-status e banner de aviso no HomeScreen do cliente.

## What Was Built

### Task 1: Registrar 9 módulos em server.ts + Cron 4 em cron.ts (commit `e8adac9`)

**server.ts:**

| Módulo | Rota base |
|--------|-----------|
| `adminSettingsRoute` | `/admin/settings/*` |
| `adminCondominiumsRoute` | `/admin/condominiums/*` |
| `adminCombosRoute` | `/admin/combos/*` |
| `adminSuppliersRoute` | `/admin/suppliers/*` |
| `adminCouriersRoute` | `/admin/couriers/*` |
| `adminClientsRoute` | `/admin/clients/*` |
| `adminSupplierOrdersRoute` | `/admin/supplier-orders/*` |
| `adminFinancialRoute` | `/admin/financial/*` |
| `adminPaymentsRoute` | `/admin/payments/*` |

Total: 10 `fastify.register(admin...)` (incluindo `adminOrdersRoute` pré-existente da Fase 5).

**cron.ts:**
- Import de `AdminSettingsService`
- Cron 4: `cron.schedule('0 * * * *', ...)` com `{ timezone: 'America/Sao_Paulo', name: 'cutoff-check' }`
- try/catch interno para não derrubar o servidor em caso de falha (T-07-06-02)
- Log: `[cron] 4 cron jobs registrados...`

### Task 2: getDashboard, getDeliveryStatus, getDivisionSuggestion (commits `adb0338` RED + `b688694` GREEN)

**TDD RED (`adb0338`):** 15 testes em `admin-orders-dashboard.service.test.ts` cobrindo:
- `getDashboard`: 7 testes (breadsTodayCount, aggregate null=0, revenueToday, clientsCount, condominiumsCount, cutoffTime com/sem Setting, revenueByType)
- `getDeliveryStatus`: 3 testes (agrupamento, array vazio, orderIds completos)
- `getDivisionSuggestion`: 4 testes (sem couriers, sem orders, greedy 2 couriers, 1 courier todos condominios)

**GREEN (`b688694`):** 3 novos métodos no service + 3 handlers no controller + 3 rotas no route.

**getDashboard():**
- `Promise.all` com 7 queries paralelas: `order.aggregate`, `payment.aggregate`, `user.count`, `condominium.count`, `setting.findUnique`, 2x `payment.findMany` (combos vs avulso)
- Cálculo de startOfDayBrt: `toLocaleDateString('pt-BR', timeZone)` → parse → `Date.UTC(y, m-1, d, 3)` (BRT = UTC-3)
- `revenueByType`: soma `comboPaidPayments` (comboId != null) e `avulsoPaidPayments` (comboId == null)

**getDeliveryStatus():**
- Busca Orders de hoje BRT (status != CANCELLED)
- Agrupa por condominiumId via Map: scheduled++, delivered++ se DELIVERED, acumula orderIds
- Busca nomes dos condomínios em batch (1 query)

**getDivisionSuggestion():**
- Busca entregadores ativos (role=COURIER, isBlocked=false)
- Busca Orders de amanhã BRT, agrupa por condominiumId, soma quantity
- Ordena condomínios desc por quantity
- Greedy: para cada condomínio, aloca ao entregador com menor total atual (scan linear — MVP ok)
- Retorna apenas entregadores com condomínios atribuídos

### Task 3: GET /settings/cutoff-status + banner no HomeScreen (commit `c160499`)

**API:**
- `getCutoffStatus()`: `Intl.DateTimeFormat` para extrair HH:MM em BRT, compara `>=` com cutoffTime
- Rota pública sem `preHandler` registrada antes das rotas autenticadas
- Controller sem role check — endpoint público para clientes

**Frontend (HomeScreen.tsx):**
- `useEffect` ao montar: `fetch(${API_BASE_URL}/settings/cutoff-status)` sem Authorization header
- Banner JSX condicional: `{isCutoff && <div>...banner...</div>}`
- Estilo: surface2 background, 1.5px accent border, radius 10, clock icon 18px gold, texto 13.5px/600
- Falha silenciosa (catch → `setIsCutoff(false)`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Tipagem incorreta de NotificationType em createAndTrim**

- **Found during:** Task 3 — verificação de erros TypeScript nos arquivos modificados
- **Issue:** `createAndTrim` aceitava `type: string` mas Prisma exige `NotificationType` — causava TS2322
- **Fix:** Import de `NotificationType` de `@prisma/client` + tipagem correta do parâmetro
- **Files modified:** `apps/api/src/modules/admin-orders/admin-orders.service.ts`
- **Commit:** `c160499`

### Erros TypeScript Pré-existentes (Fora do Escopo)

Os seguintes erros de build existiam antes desta tarefa (confirmado via `git stash`) e não são causados pelas alterações do plano 07-06:

| Arquivo | Erro | Causa |
|---------|------|-------|
| `admin-orders.schema.ts:16` | TS2769 z.enum overload | Incompatibilidade Zod version |
| `admin-supplier-orders/pdf-generator.ts:7` | TS7016 pdfmake types | @types/pdfmake ausente |
| `admin-condominiums/admin-condominiums.schema.ts:17` | TS2769 | Zod/TS version |
| `admin-financial/admin-financial.service.ts:147` | TS2322 InputJsonValue | Tipo incompatível |
| `courier/courier.service.ts:126` | TS2322 string | Address vs string |
| `notifications/notifications.service.ts:76` | TS2322 NotificationType | Mesmo padrão que o fix acima |

Esses itens foram registrados como deferred.

## Known Stubs

Nenhum stub nos arquivos criados/modificados. Todos os métodos têm implementação real.

## Threat Surface Scan

| Threat ID | Status | Mitigação Aplicada |
|-----------|--------|-------------------|
| T-07-06-01 | Mitigado | Role check `request.user?.role !== 'ADMIN'` nos 3 handlers novos de admin-orders + preHandler authenticate |
| T-07-06-02 | Mitigado | try/catch com `fastify.log.error` dentro do callback do Cron 4 — servidor não derrubado |
| T-07-06-03 | Mitigado | getDivisionSuggestion é GET sem body/query params — sem input do usuário afetando lógica |
| T-07-06-04 | Mitigado | `/settings/cutoff-status` é intencional público (sem dados sensíveis — apenas boolean + HH:MM) |

Nenhuma nova superfície não planejada introduzida.

## TDD Gate Compliance

| Fase | Tarefa | Commit RED | Commit GREEN |
|------|--------|------------|--------------|
| 1 | getDashboard + getDeliveryStatus + getDivisionSuggestion | `adb0338` | `b688694` |

RED confirmado: 15 testes falhando com `TypeError: service.getDashboard is not a function`.
GREEN confirmado: 38 test files, 272 testes passando.

## Self-Check: PASSED

Arquivos verificados:
- `apps/api/src/server.ts` — 10 `fastify.register(admin...)` FOUND
- `apps/api/src/plugins/cron.ts` — `cutoff-check` + `processCutoff` FOUND
- `apps/api/src/modules/admin-orders/admin-orders.service.ts` — getDashboard + getDeliveryStatus + getDivisionSuggestion FOUND
- `apps/api/src/modules/admin-orders/admin-orders.controller.ts` — dashboard + deliveryStatus + divisionSuggestion FOUND
- `apps/api/src/modules/admin-orders/admin-orders.route.ts` — `/admin/dashboard` + `/admin/orders/delivery-status` + `/admin/orders/division-suggestion` FOUND
- `apps/api/src/modules/admin-settings/admin-settings.service.ts` — getCutoffStatus FOUND
- `apps/api/src/modules/admin-settings/admin-settings.controller.ts` — cutoffStatus FOUND
- `apps/api/src/modules/admin-settings/admin-settings.route.ts` — `/settings/cutoff-status` FOUND
- `apps/web/src/pages/client/HomeScreen.tsx` — isCutoff + banner FOUND
- `apps/api/src/modules/admin-orders/__tests__/admin-orders-dashboard.service.test.ts` — 15 testes FOUND

Commits verificados:
- `e8adac9` — feat(07-06): registrar 9 módulos admin em server.ts e cron FOUND
- `adb0338` — test(07-06): RED FOUND
- `b688694` — feat(07-06): GREEN FOUND
- `c160499` — feat(07-06): cutoff-status + banner FOUND

Suite Vitest API: 38 test files, 272 testes passando — CONFIRMED
Web build: SUCCESS (zero erros TypeScript no projeto web)
