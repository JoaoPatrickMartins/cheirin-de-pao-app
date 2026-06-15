---
phase: 04-scheduling
plan: 04
subsystem: api/plugins
tags: [cron, node-cron, fastify-plugin, onesignal, automation, scheduling]

# Dependency graph
requires:
  - phase: 04-02
    provides: SchedulesService com createDailyOrders, sendReconfigureReminders, processAutoBuy
  - phase: 04-03
    provides: ordersRoute e notificationsRoute registrados no server.ts

provides:
  - cronPlugin Fastify (apps/api/src/plugins/cron.ts) com 2 cron jobs registrados
  - Cron meia-noite diário (America/Sao_Paulo): createDailyOrders + processAutoBuy
  - Cron domingo 20h (America/Sao_Paulo): sendReconfigureReminders
  - ONESIGNAL_APP_ID e ONESIGNAL_REST_API_KEY no envSchema do server.ts
  - cronPlugin registrado no server.ts após todos os módulos de rota

affects:
  - 04-05-PLAN.md (frontend pode depender das vars OneSignal configuradas)
  - 04-06-PLAN.md (automação de orders ativa para testes end-to-end)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - node-cron v4 TaskOptions sem 'scheduled' (removido) — tasks ativas por padrão
    - cronPlugin usa fastify-plugin (fp) para acesso a fastify.prisma decorado
    - Guard NODE_ENV !== 'test' evita crons em ambiente de teste
    - try/catch por handler — erros logados com fastify.log.error sem re-lançar (servidor não cai)
    - cronPlugin registrado APÓS todos os módulos de rota (última posição no server.ts)

key-files:
  created:
    - path: apps/api/src/plugins/cron.ts
      description: Plugin Fastify com 2 cron jobs (meia-noite + domingo 20h) usando node-cron v4
  modified:
    - path: apps/api/src/server.ts
      description: Import + register do cronPlugin e ONESIGNAL_APP_ID/ONESIGNAL_REST_API_KEY no envSchema
    - path: apps/api/.env.example
      description: Seção Phase 4 com ONESIGNAL_APP_ID e ONESIGNAL_REST_API_KEY como placeholders

key-decisions:
  - "node-cron v4 não tem 'scheduled' em TaskOptions — corrigido automaticamente após erro TS2353"
  - "2 crons em vez de 3: processAutoBuy unificado no cron de meia-noite (lógica interna filtra modo semanal/acabar)"
  - "cronPlugin registrado como último plugin para garantir acesso a fastify.prisma"

patterns-established:
  - "Plugin cron.ts usa mesma estrutura do prisma.ts: fp(async (fastify) => { ... })"
  - "Guard NODE_ENV=test como padrão para plugins com efeitos colaterais"

requirements-completed:
  - SCHED-03
  - SCHED-04
  - CRED-07

# Metrics
duration: ~10 min
completed: "2026-06-15"
---

# Phase 4 Plan 04: Plugin Cron + Wiring Final Summary

**Plugin cron.ts com 2 cron jobs (meia-noite diário + domingo 20h) em America/Sao_Paulo usando node-cron v4, registrado no server.ts com guard de teste e vars OneSignal no envSchema.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-15T03:04:51Z
- **Completed:** 2026-06-15T03:15:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 criado, 2 modificados)

## Accomplishments

- Plugin cron.ts criado como Fastify plugin usando fastify-plugin (fp)
- 2 cron jobs registrados com timezone America/Sao_Paulo:
  - Meia-noite diário (0 0 * * *): createDailyOrders + processAutoBuy
  - Domingo 20h (0 20 * * 0): sendReconfigureReminders
- Guard de ambiente (NODE_ENV=test) evita crons em testes unitários
- try/catch em cada handler — erros logados sem derrubar o servidor (T-04-04-02 mitigado)
- server.ts atualizado com cronPlugin + ONESIGNAL_APP_ID/ONESIGNAL_REST_API_KEY no envSchema
- 80 testes passando (0 falhas) após todas as modificações

## Task Commits

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | cron.ts — plugin com 2 cron jobs | dcf07e7 | apps/api/src/plugins/cron.ts |
| 2 | server.ts — cronPlugin + envSchema OneSignal | 3180a5b | apps/api/src/server.ts, apps/api/.env.example |

## Files Created/Modified

- `apps/api/src/plugins/cron.ts` — Plugin Fastify fp() com 2 crons: meia-noite (createDailyOrders+processAutoBuy) e domingo 20h (sendReconfigureReminders)
- `apps/api/src/server.ts` — import cronPlugin + `await fastify.register(cronPlugin)` + ONESIGNAL_APP_ID/ONESIGNAL_REST_API_KEY no envSchema
- `apps/api/.env.example` — seção Phase 4 com placeholders OneSignal

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] node-cron v4 — 'scheduled' removido de TaskOptions**

- **Found during:** Task 1 (build TypeScript após criar cron.ts)
- **Issue:** O plano especificava `{ scheduled: true, timezone: 'America/Sao_Paulo' }` mas node-cron v4.2.1 removeu a opção `scheduled` de `TaskOptions`. O TypeScript gerava `error TS2353: Object literal may only specify known properties, and 'scheduled' does not exist in type 'TaskOptions'`.
- **Fix:** Removido `scheduled: true` e adicionado `name` descritivo. No node-cron v4, tasks são iniciadas automaticamente por padrão — o campo `scheduled` não é mais necessário.
- **Files modified:** `apps/api/src/plugins/cron.ts`
- **Verification:** `npm run build --workspace=apps/api` passou sem erros TS
- **Committed in:** `dcf07e7` (Task 1 commit, mesma versão)

---

**Total deviations:** 1 auto-fixado (Rule 1 — Bug de tipagem TypeScript por mudança de API do node-cron v4)
**Impact on plan:** Fix necessário para compilação. Sem impacto funcional — o comportamento de scheduler é idêntico (tasks ativas automaticamente em ambos os casos).

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| T-04-04-01 mitigado | server.ts | ONESIGNAL_REST_API_KEY declarada no envSchema (validação na startup) — nunca logada pelo plugin |
| T-04-04-02 mitigado | plugins/cron.ts | Cada handler encapsulado em try/catch — fastify.log.error sem re-lançar |
| T-04-04-03 mitigado | plugins/cron.ts | timezone: 'America/Sao_Paulo' em ambos os cron.schedule() calls |

## Self-Check: PASSED

- [x] apps/api/src/plugins/cron.ts — FOUND
- [x] `grep -c "America/Sao_Paulo" apps/api/src/plugins/cron.ts` retorna 4 (>= 2) — OK
- [x] `grep "node-cron" apps/api/src/plugins/cron.ts` — import presente
- [x] `grep "cronPlugin" apps/api/src/server.ts` — import e register presentes (linha 17 e 98)
- [x] `grep "ONESIGNAL_APP_ID" apps/api/src/server.ts` — no envSchema (linha 46)
- [x] cronPlugin (linha 98) após webhooksRoute (linha 92) — ordem correta
- [x] `npm run build --workspace=apps/api` — sem erros TS
- [x] `npm run test --workspace=apps/api` — 80 passed, 0 failed
- [x] Commit dcf07e7 (Task 1 — cron.ts) — FOUND
- [x] Commit 3180a5b (Task 2 — server.ts + .env.example) — FOUND
