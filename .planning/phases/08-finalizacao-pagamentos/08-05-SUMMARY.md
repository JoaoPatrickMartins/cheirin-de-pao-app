---
phase: 08-finalizacao-pagamentos
plan: "05"
subsystem: api/schedules
tags: [testes, cron, auto-recharge, onesignal, CRED-08, CRED-10]
dependency_graph:
  requires: [08-02]
  provides: [cobertura CRED-08/10 com evidência testada]
  affects: [apps/api/src/modules/schedules]
tech_stack:
  added: []
  patterns: [Vitest fake timers para teste de weekday, function-keyword constructor mocks Vitest 4+]
key_files:
  created: []
  modified:
    - apps/api/src/modules/schedules/__tests__/schedules.service.test.ts
decisions:
  - "vi.setSystemTime() com UTC explícito para simular dia da semana em America/Sao_Paulo (UTC-3)"
  - "function keyword nos mockImplementation do DefaultApi (Vitest 4+ constructor mock)"
  - "Importação direta de OneSignalModule para acesso tipado ao spy nos novos testes"
metrics:
  duration: "~7 min"
  completed: "2026-06-19"
  tasks: 1
  files_modified: 1
---

# Phase 08 Plan 05: Testes unitários processAutoBuy [CRED-08/10] Summary

**One-liner:** 3 testes unitários verdes para processAutoBuy cobrindo weekday, modo semanal e push de confirmação via vi.setSystemTime + constructor mocks Vitest 4+.

## What Was Built

Adicionado bloco `describe('processAutoBuy [CRED-08/10]')` com 3 casos de teste em `schedules.service.test.ts`, fechando os requisitos CRED-08 e CRED-10 com evidência testada.

## Estado encontrado na inspeção de processAutoBuy

**Weekday:** JA IMPLEMENTADO. Linhas 251-256 de `schedules.service.ts` usam `Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' })` para obter o dia atual em BRT, mapeiam via `DAY_OF_WEEK_MAP` para a chave ('seg', 'ter', etc.) e comparam com `autoRecharge.weekday`. Correto e completo.

**Mode:** JA IMPLEMENTADO. Linha 249: `else if (autoRecharge.mode === 'semanal')` — mode semanal verificado. O mode 'acabar' tem sua própria lógica independente (verificação de consumoSemanal vs creditBalance). Qualquer outro mode resulta em `shouldBuy = false` implicitamente.

**Push de confirmação:** JA IMPLEMENTADO. Após `shouldBuy = true`, o código envia push com `notification.url = '/client/creditos'` (correção de bug já aplicada no plano 08-02). Não havia lacuna de implementação a corrigir.

**Conclusão:** Toda a lógica de verificação estava correta. Este plano adicionou apenas os testes de cobertura que estavam ausentes.

## Tasks Completadas

| Task | Descricao | Commit | Arquivos |
|------|-----------|--------|---------|
| 1 | Auditar processAutoBuy e adicionar 3 testes unitários CRED-08/10 | e524e4c | schedules.service.test.ts |

## Detalhes dos Testes Adicionados

| Teste | Cenario | Assert |
|-------|---------|--------|
| CRED-08 weekday | autoRecharge.weekday='seg', dia atual='ter' (2024-01-09T15:00Z) | createNotification NOT called |
| CRED-10 mode | autoRecharge.mode='mensal' (invalido para processAutoBuy) | createNotification NOT called |
| CRED-08/10 push | weekday='seg', dia atual='seg' (2024-01-08T15:00Z), mode='semanal' | createNotification called 1x com url='/client/creditos' |

## Deviations from Plan

### Ajustes automaticos aplicados

**1. [Rule 2 - Qualidade] Atualizacao do mock OneSignal no arquivo worktree**

- **Found during:** Task 1 — ao ler o arquivo no worktree
- **Issue:** O arquivo no worktree tinha versao antiga do mock: `DefaultApi: vi.fn().mockImplementation(() => ...)` com arrow function, sem `import * as OneSignalModule`. Em Vitest 4+, arrow functions em constructor mocks ignoram o return value.
- **Fix:** Atualizado para `function` keyword e adicionado `import * as OneSignalModule` para acesso tipado nos novos testes. Alinhado com a versao do repositorio principal.
- **Files modified:** apps/api/src/modules/schedules/__tests__/schedules.service.test.ts
- **Commit:** e524e4c (incluido na task)

**Implementacao de weekday/mode:** Nenhuma implementacao foi necessaria — ambas as verificacoes ja existiam corretamente em `schedules.service.ts`.

## Resultados de Verificacao

- `npm test -- schedules.service.test.ts`: **13 passed, 0 failed**
- `npm test` (suite completa): **278 passed, 0 failed, 38 test files**
- `grep -c "processAutoBuy" schedules.service.test.ts`: **5** (>= 3 requerido)
- `grep -c "weekday|CRED-08" schedules.service.test.ts`: **7** (>= 1 requerido)
- `grep -c "semanal|CRED-10" schedules.service.test.ts`: **6** (>= 1 requerido)

## Known Stubs

Nenhum.

## Threat Flags

Nenhum novo endpoint ou surface de segurança introduzido. Apenas testes unitarios.

## Self-Check: PASSED

- [x] `apps/api/src/modules/schedules/__tests__/schedules.service.test.ts` — modificado e commitado
- [x] Commit e524e4c existe
- [x] 278 testes verdes, 0 falhas
- [x] CRED-08 e CRED-10 cobertos com 3 casos de teste
