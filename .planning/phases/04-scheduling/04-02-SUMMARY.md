---
phase: 04-scheduling
plan: 02
subsystem: api
tags: [fastify, prisma, mongodb, onesignal, zod, vitest, schedules, cron]

# Dependency graph
requires:
  - phase: 04-01
    provides: Schema Prisma com @@unique([userId, condominiumId]) em Schedule e @onesignal/node-onesignal instalado
  - phase: 03-credits-commerce
    provides: Padrão de módulo Fastify (route/controller/service/repository), authenticate preHandler, prisma plugin

provides:
  - WeeklyQtySchema (Zod) com validação min(0)/max(12) por dia da semana
  - ScheduleBodySchema (Zod) com deliveryTime enum 4 horários
  - SchedulesRepository com findActiveByUserId, upsert (@@unique), findAllActive
  - SchedulesService com upsertSchedule, getSchedule, createDailyOrders, sendReconfigureReminders, processAutoBuy
  - GET /schedules/me — retorna schedule ativo do usuário autenticado (200 ou 404)
  - PUT /schedules/me — upsert de schedule via condominiumId do usuário
  - 7 testes unitários passando para SchedulesService

affects:
  - 04-04-PLAN.md (cron jobs chamam createDailyOrders, sendReconfigureReminders, processAutoBuy)
  - 04-03-PLAN.md (módulo orders que complementa agendamentos)
  - 04-05-PLAN.md (frontend ScheduleScreen consome GET/PUT /schedules/me)
  - 04-06-PLAN.md (frontend SingleScreen consome módulo orders)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Schedule não tem relação Prisma explícita com User — findAllActive retorna apenas schedules e service faz lookup separado de usuário
    - createDailyOrders usa prisma.$transaction para atomicidade (Order + User.creditBalance + CreditTransaction)
    - Timezone America/Sao_Paulo calculado via Intl.DateTimeFormat com weekday short para determinar dia de amanhã
    - processAutoBuy Pix-first MVP — gera push para usuário finalizar pagamento (cobrança recorrente silenciosa adiada)

key-files:
  created:
    - path: apps/api/src/modules/schedules/schedules.schema.ts
      description: WeeklyQtySchema e ScheduleBodySchema com tipos inferidos
    - path: apps/api/src/modules/schedules/schedules.repository.ts
      description: SchedulesRepository com findActiveByUserId, upsert, findAllActive, findUserById
    - path: apps/api/src/modules/schedules/schedules.service.ts
      description: SchedulesService com 5 métodos — inclui lógica de cron e integração OneSignal
    - path: apps/api/src/modules/schedules/schedules.controller.ts
      description: SchedulesController com getMySchedule e updateMySchedule
    - path: apps/api/src/modules/schedules/schedules.route.ts
      description: schedulesRoute FastifyPluginAsync com GET e PUT /schedules/me autenticados
  modified:
    - path: apps/api/src/modules/schedules/__tests__/schedules.service.test.ts
      description: Substituição dos stubs Wave 0 por 7 testes reais com vi.mock do OneSignal
    - path: apps/api/src/server.ts
      description: Registro do schedulesRoute na inicialização do Fastify

key-decisions:
  - "Schedule não tem relação explícita no Prisma — findAllActive sem include, lookup de User separado no service"
  - "createDailyOrders usa 'SCHEDULED' (não 'WEEKLY') para type do Order — conforme enum OrderType"
  - "processAutoBuy Pix-first: gera push para o cliente finalizar o pagamento, cobrança silenciosa no cartão adiada"

patterns-established:
  - "Módulo schedules segue Clean Architecture da Fase 3: route → controller → service → repository"
  - "preHandler: [fastify.authenticate] em array (não como objeto direto) — consistência com padrão da Fase 3"
  - "Lookup de usuário no controller para obter condominiumId ausente no JWT"

requirements-completed:
  - SCHED-02
  - SCHED-03
  - SCHED-04
  - CRED-10

# Metrics
duration: ~25 min
completed: "2026-06-15"
---

# Phase 4 Plan 02: Módulo Schedules Backend Summary

**Módulo Fastify schedules completo: schema Zod com WeeklyQtySchema/ScheduleBodySchema, SchedulesRepository com upsert por @@unique, SchedulesService com 5 métodos de domínio (createDailyOrders/sendReconfigureReminders/processAutoBuy), rotas GET+PUT /schedules/me autenticadas e 7 testes unitários passando**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-15T00:00:00Z
- **Completed:** 2026-06-15T00:25:00Z
- **Tasks:** 2
- **Files modified:** 7 (5 criados, 2 modificados)

## Accomplishments

- Módulo schedules completo em 5 arquivos seguindo Clean Architecture das fases anteriores
- SchedulesService com os 4 métodos de domínio prontos para ser chamados pelos crons do plano 04-04
- Validação Zod robusta: WeeklyQty com min(0)/max(12) por dia, deliveryTime restrito a 4 horários
- 7 testes unitários reais substituindo os stubs Wave 0 — todos passando sem FAIL

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: schedules.schema.ts + schedules.repository.ts** - `19073a7` (feat)
2. **Task 2: service + controller + route + testes** - `05ba201` (feat)

## Files Created/Modified

- `apps/api/src/modules/schedules/schedules.schema.ts` — WeeklyQtySchema (7 dias, 0-12) e ScheduleBodySchema (deliveryTime enum + notifyReconfigure)
- `apps/api/src/modules/schedules/schedules.repository.ts` — CRUD via Prisma: findActiveByUserId, upsert (@@unique userId_condominiumId), findAllActive, findUserById
- `apps/api/src/modules/schedules/schedules.service.ts` — SchedulesService com upsertSchedule, getSchedule, createDailyOrders, sendReconfigureReminders, processAutoBuy
- `apps/api/src/modules/schedules/schedules.controller.ts` — getMySchedule e updateMySchedule com parse Zod e tratamento de erros
- `apps/api/src/modules/schedules/schedules.route.ts` — GET e PUT /schedules/me com preHandler: [fastify.authenticate]
- `apps/api/src/modules/schedules/__tests__/schedules.service.test.ts` — 7 testes unitários reais (substituição dos stubs Wave 0)
- `apps/api/src/server.ts` — importação e registro do schedulesRoute

## Decisions Made

- Schedule não tem relação Prisma explícita com User (sem `user User @relation(...)`), então `findAllActive` retorna apenas schedules e o service faz lookup separado via `findUserById`. Alternativa seria adicionar relação ao schema mas isso requereria migrate.
- `createDailyOrders` usa o literal string `'SCHEDULED'` para o campo `type` do Order (não enum TypeScript) para evitar dependência de enum importado do Prisma Client — segue o padrão dos outros módulos da Fase 3.
- `processAutoBuy` MVP: Pix-first — envia push para o cliente finalizar o pagamento manualmente. Cobrança recorrente silenciosa no cartão (via MP Subscriptions API) adiada para fase futura (D-12 do CONTEXT.md).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Correção de findAllActive — Schedule sem relação Prisma com User**

- **Found during:** Task 1 (schedules.repository.ts)
- **Issue:** O plano descrevia `findAllActive` com `include: { user: { select: {...} } }` mas o modelo Prisma `Schedule` não tem campo de relação `user User @relation(...)` — apenas `userId String @db.ObjectId`. O TypeScript gerava `error TS2322: Type '...' is not assignable to type 'never'`.
- **Fix:** Removido o `include` de `findAllActive`. Adicionados métodos auxiliares `findUserById` e `decrementCreditBalance` ao repository para uso no service. O service faz o lookup do usuário separadamente para cada schedule.
- **Files modified:** `apps/api/src/modules/schedules/schedules.repository.ts`
- **Verification:** `npm run build --workspace=apps/api` passou sem erros TS
- **Committed in:** `19073a7` (Task 1 commit)

---

**Total deviations:** 1 auto-fixado (Rule 1 — Bug de tipagem TypeScript)
**Impact on plan:** Fix necessário para compilação. Sem impacto funcional — o service continua tendo acesso a todos os dados necessários, apenas via queries separadas em vez de JOIN. Adequado para MVP.

## Issues Encountered

Nenhum além da desvio documentado acima.

## Known Stubs

Nenhum stub presente nos arquivos implementados neste plano. Os stubs Wave 0 do arquivo de teste foram substituídos por 7 testes reais.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| T-04-02-01 mitigado | schedules.route.ts | GET e PUT /schedules/me com preHandler: [fastify.authenticate] — apenas usuários autenticados |
| T-04-02-02 mitigado | schedules.schema.ts | WeeklyQtySchema: z.number().int().min(0).max(12) em todos os 7 dias |
| T-04-02-03 mitigado | schedules.schema.ts | z.enum(['06:30','07:00','07:30','08:00']) — rejeita qualquer deliveryTime fora da lista |
| T-04-02-04 aceito | schedules.service.ts | Race condition em creditBalance — aceito para MVP (cron sequencial, risco baixo) |
| T-04-02-05 aceito | schedules.service.ts | Push para player_id expirado — falha silenciosa com log.warn, sem propagação de erro |

## User Setup Required

Para que `sendReconfigureReminders` e `createDailyOrders` enviem push notifications, as variáveis de ambiente OneSignal precisam ser configuradas:

```
ONESIGNAL_REST_API_KEY=<sua-rest-api-key>
ONESIGNAL_APP_ID=<seu-app-id>
```

Sem essas variáveis, as funções de push falharão silenciosamente (log.warn) sem bloquear a criação de Orders.

## Next Phase Readiness

- Módulo schedules pronto — GET/PUT /schedules/me funcionando e autenticados
- `createDailyOrders`, `sendReconfigureReminders` e `processAutoBuy` prontos para serem chamados pelos crons do plano 04-04
- Plano 04-03 (módulo orders) pode iniciar independentemente — não depende deste módulo
- Plano 04-05 (frontend ScheduleScreen) pode consumir GET/PUT /schedules/me

---

*Phase: 04-scheduling*
*Completed: 2026-06-15*
