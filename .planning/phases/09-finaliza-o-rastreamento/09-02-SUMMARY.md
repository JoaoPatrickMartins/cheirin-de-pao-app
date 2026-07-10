---
phase: 09-finaliza-o-rastreamento
plan: "02"
subsystem: web-contexts
tags: [context, notifications, deep-link, provider]
dependency_graph:
  requires: []
  provides:
    - NotifContext.tsx (NotifProvider + useNotif + NotifContext)
    - ClientLayout wraps Outlet+ClientTabBar with NotifProvider
    - useOneSignalDeepLink handles screen=pedidos
  affects:
    - apps/web/src/contexts/NotifContext.tsx
    - apps/web/src/pages/client/ClientLayout.tsx
    - apps/web/src/hooks/useOneSignalDeepLink.ts
tech_stack:
  added: []
  patterns:
    - React.createContext com valor default no-op (não null) para evitar null check nos consumers
    - useCallback com deps [] para referência estável de refresh()
    - NotifProvider com children prop (vs AuthProvider com Outlet) — provider dentro de layout existente
key_files:
  created:
    - apps/web/src/contexts/NotifContext.tsx
    - apps/web/src/contexts/__tests__/NotifContext.test.tsx
  modified:
    - apps/web/src/pages/client/ClientLayout.tsx
    - apps/web/src/hooks/useOneSignalDeepLink.ts
decisions:
  - "NotifContext usa createContext com valor default { unreadCount: 0, refresh: () => {} } em vez de null — elimina null check em todos os consumers"
  - "refresh() via useCallback com deps [] — referência estável para incluir em useEffect de consumers sem loop infinito"
  - "NotifProvider envolve também ClientTabBar — permite que ClientTabBar exiba badge futuramente sem custo adicional"
metrics:
  duration: "~6 minutes"
  completed: "2026-06-19"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 2
requirements_satisfied:
  - ACOMP-05
---

# Phase 09 Plan 02: NotifContext — Infraestrutura de Badge de Notificações

**One-liner:** NotifContext com refresh estável via useCallback(deps=[]), provisionado no ClientLayout e deep link pedidos ativado em useOneSignalDeepLink.

## What Was Built

### Task 1: NotifContext + Test Stubs (TDD RED/GREEN)

Criado `apps/web/src/contexts/NotifContext.tsx` com:
- `NotifContext` — createContext com valor default no-op `{ unreadCount: 0, refresh: () => {} }`
- `NotifProvider({ children })` — fetcha `/notifications/unread-count` no mount; atualiza `unreadCount`
- `refresh` — `useCallback` com `deps []` garantindo referência estável (pitfall crítico: evita loop infinito em NotificationsScreen que inclui `refresh` no seu array de deps)
- `useNotif()` — `useContext(NotifContext)` para consumers

5 testes escritos primeiro (RED: falha com "Cannot find module") e depois passados (GREEN):
1. NotifProvider renderiza children sem erro
2. useNotif() fora de provider retorna `{ unreadCount: 0 }`
3. mount-fetch: `{ count: 3 }` → `unreadCount === 3` via waitFor
4. refresh() re-faz fetch: apiFetch chamado 2x
5. falha de rede: unreadCount permanece 0, sem exceção propagada

### Task 2: Provisionar NotifProvider + Estender Deep Link

`ClientLayout.tsx`:
- Import adicionado: `import { NotifProvider } from '../../contexts/NotifContext'`
- `<Outlet />` e `<ClientTabBar />` envolvidos por `<NotifProvider>` dentro do div externo
- `useOneSignalRegister()` e `useOneSignalDeepLink()` no corpo do componente — inalterados

`useOneSignalDeepLink.ts`:
- Adicionado `} else if (screen === 'pedidos') { navigate('/client/pedidos') }` após o case `'creditos'` existente
- Padrão de addEventListener/removeEventListener de cleanup — inalterado
- Sem novo listener ou nova instância do hook

## Verification Results

```
cd apps/web && npx vitest run
Test Files  21 passed | 8 skipped (29)
Tests  95 passed | 20 todo (115)
```

Verificações do plano:
- `grep "export function NotifProvider\|export function useNotif\|export const NotifContext" NotifContext.tsx` → 3 linhas
- `grep "useCallback" NotifContext.tsx` → linha com `}, [])`
- `grep "NotifProvider" ClientLayout.tsx` → 3 ocorrências (import, tag abertura, tag fechamento)
- `grep "pedidos" useOneSignalDeepLink.ts` → `navigate('/client/pedidos')`

## Commits

| Hash | Mensagem | Arquivos |
|------|----------|---------|
| `66e472b` | feat(09-02): criar NotifContext com NotifProvider e useNotif | NotifContext.tsx, NotifContext.test.tsx |
| `bf67146` | feat(09-02): provisionar NotifProvider no ClientLayout e adicionar case 'pedidos' no deep link | ClientLayout.tsx, useOneSignalDeepLink.ts |

## Deviations from Plan

None — plano executado exatamente conforme especificado.

## Threat Flags

Nenhuma superfície nova identificada além do escopo do plano. Todas as ameaças catalogadas no threat_model do plano estão cobertas:
- T-09-01: GET /notifications/unread-count autenticado via JWT (preHandler existente)
- T-09-02: whitelist implícita no deep link: `creditos` e `pedidos` — qualquer outro valor ignorado
- T-09-04: fetch único no mount via useEffect; sem polling contínuo

## Known Stubs

Nenhum — NotifContext faz fetch real e retorna dados da API. Sem valores hardcoded que bloqueiem o objetivo do plano.

## Self-Check: PASSED

- FOUND: apps/web/src/contexts/NotifContext.tsx
- FOUND: apps/web/src/contexts/__tests__/NotifContext.test.tsx
- FOUND: commit 66e472b
- FOUND: commit bf67146
- Suite completa: 95 passed, 0 failed
