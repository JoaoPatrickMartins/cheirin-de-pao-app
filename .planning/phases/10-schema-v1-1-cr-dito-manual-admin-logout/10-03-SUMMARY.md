---
phase: 10-schema-v1-1-cr-dito-manual-admin-logout
plan: "03"
subsystem: web/ui-admin-courier-client
tags: [react, ui, grant-credits, logout, notifications, deep-link]
dependency_graph:
  requires:
    - Plan 10-02 (POST /admin/clients/:id/grant-credits operacional)
  provides:
    - Modal bottom sheet grant-credits no ClientDetailView
    - Logout do entregador (ícone no header CourierScreen)
    - Logout do admin (botão Sair + dialog no AdminBottomNav)
    - CREDIT_GRANTED em getTone/getIcon/CTA_CONFIG no NotificationsScreen
    - Case screen === 'home' no useOneSignalDeepLink
  affects:
    - AdminBottomNav (6 botões: 5 tabs + Sair)
    - ClientDetailView (novo modal + toast)
    - CourierScreen (ícone logout no header)
    - NotificationsScreen (suporte CREDIT_GRANTED)
    - useOneSignalDeepLink (nova rota /client/home)
tech_stack:
  added: []
  patterns:
    - "Modal bottom sheet com Fragment overlay + container (padrão UI-SPEC Phase 10)"
    - "Toast inline fixo no topo com setTimeout 2500ms (padrão ScheduleScreen)"
    - "Chips de motivo com aria-pressed (padrão UI-SPEC Phase 10)"
    - "Dialog de confirmação de logout centrado (D-09)"
    - "Logout direto sem dialog para entregador (D-08)"
key_files:
  created: []
  modified:
    - apps/web/src/components/admin/ClientDetailView.tsx
    - apps/web/src/components/admin/AdminBottomNav.tsx
    - apps/web/src/components/admin/AdminBottomNav.js
    - apps/web/src/components/admin/__tests__/AdminBottomNav.test.tsx
    - apps/web/src/pages/courier/CourierScreen.tsx
    - apps/web/src/pages/client/NotificationsScreen.tsx
    - apps/web/src/hooks/useOneSignalDeepLink.ts
decisions:
  - "AdminBottomNav.js atualizado manualmente junto com .tsx — arquivo compilado era o que o teste importava diretamente"
  - "Botão Sair inserido dentro do <nav> (não fora) para consistência de layout — Fragment envolve nav + dialog"
  - "Logout do entregador sem dialog (D-08): re-autenticação via OTP é simples, baixo risco"
  - "Logout do admin com dialog 'Sair da conta?' (D-09): ação de alto impacto em sessão ativa"
metrics:
  duration: "20min"
  completed_date: "2026-06-19"
  tasks_completed: 2
  files_modified: 7
---

# Phase 10 Plan 03: UI Grant-Credits + Logout Admin/Entregador Summary

**One-liner:** Modal bottom sheet de concessão de créditos no ClientDetailView, ícone logout no header do CourierScreen, botão Sair com dialog no AdminBottomNav, suporte a CREDIT_GRANTED na NotificationsScreen e deep link 'home' no useOneSignalDeepLink — todos os 4 testes passando.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Modal grant-credits, logout entregador, CREDIT_GRANTED e deeplink home | 8af7320 | ClientDetailView.tsx, CourierScreen.tsx, NotificationsScreen.tsx, useOneSignalDeepLink.ts |
| 2 | Logout admin no AdminBottomNav + atualizar teste para 6 botões | 93d7d06 | AdminBottomNav.tsx, AdminBottomNav.js, AdminBottomNav.test.tsx |

## What Was Built

### Task 1 — ClientDetailView + CourierScreen + NotificationsScreen + deeplink

**ClientDetailView.tsx** (`apps/web/src/components/admin/ClientDetailView.tsx`):
- Estados adicionados: `showGrantModal`, `grantQty`, `grantMotivo`, `grantLoading`, `toast`
- Função `handleGrant()`: POST `/admin/clients/${id}/grant-credits` com body `{ quantity, reason }`, atualiza `creditBalance` localmente, fecha modal, exibe toast 2500ms
- Botão trigger "+" Adicionar créditos abaixo do saldo de créditos
- Modal bottom sheet com overlay, handle bar 36×4px, título h2 id="modal-grant-title", input type="number" min="1" autoFocus, 4 chips de motivo com aria-pressed, botões Descartar e Adicionar créditos
- `useEffect` para fechar modal com tecla Escape
- Toast inline position:fixed top:16 com z-index 9999

**CourierScreen.tsx** (`apps/web/src/pages/courier/CourierScreen.tsx`):
- Import de `Icon` adicionado
- `logout` desestruturado do `useAuth()`
- Botão com `<Icon name="logout" size={22}>` adicionado acima dos textos no header (div da direita)
- `onClick={logout}` diretamente, sem dialog (D-08)

**NotificationsScreen.tsx** (`apps/web/src/pages/client/NotificationsScreen.tsx`):
- `getTone`: `'CREDIT_GRANTED'` adicionado ao array gold ao lado de `'LOW_CREDIT'`
- `getIcon`: `if (type === 'CREDIT_GRANTED') return 'coin'` adicionado antes do fallback
- `CTA_CONFIG`: `CREDIT_GRANTED: { label: 'Ver saldo', path: '/client/home' }` adicionado

**useOneSignalDeepLink.ts** (`apps/web/src/hooks/useOneSignalDeepLink.ts`):
- `} else if (screen === 'home') { navigate('/client/home') }` adicionado após o case 'pedidos'
- Comentário do threat model atualizado para incluir '/client/home'

### Task 2 — AdminBottomNav + Teste

**AdminBottomNav.tsx** (`apps/web/src/components/admin/AdminBottomNav.tsx`):
- Imports: `useState` e `useAuth` adicionados
- `logout` e `showLogoutDialog` adicionados ao componente
- Botão "Sair" com `<Icon name="logout">` adicionado DENTRO do `<nav>`, APÓS o map de TABS
- `AdminTab` type NÃO modificado (Pitfall 6 respeitado)
- Dialog "Sair da conta?" fora do nav (no Fragment) com botões "Continuar na conta" e "Sair"
- Componente retorna `<>` (Fragment) englobando nav + dialog

**AdminBottomNav.js** (`apps/web/src/components/admin/AdminBottomNav.js`):
- Arquivo compilado atualizado para refletir as mudanças do .tsx
- Necessário porque o arquivo de teste importa diretamente `'../AdminBottomNav.js'`

**AdminBottomNav.test.tsx** (`apps/web/src/components/admin/__tests__/AdminBottomNav.test.tsx`):
- `vi.mock('../../hooks/useAuth', ...)` adicionado para evitar erro de contexto React
- Primeiro teste: `toHaveLength(5)` → `toHaveLength(6)`, descrição atualizada
- Novo teste: "renderiza botão Sair com aria-label correto" usando `screen.getByRole('button', { name: 'Sair' })`

## Verification Results

```
Task 1:
grep "grant-credits" ClientDetailView.tsx: 2 matches (apiFetch + função)
grep "Adicionar Créditos" ClientDetailView.tsx: 1 match (título modal)
grep "CREDIT_GRANTED" NotificationsScreen.tsx: 3 matches (getTone + getIcon + CTA_CONFIG)
grep "client/home" useOneSignalDeepLink.ts: 2 matches (navigate + comment)
grep "logout" CourierScreen.tsx: 5 matches (import Icon, useAuth, onClick, etc.)
npx tsc --noEmit: 0 erros TypeScript

Task 2:
npx vitest run AdminBottomNav.test.tsx: 4/4 passed (0 failed)
grep "toHaveLength(6)": 1 match
grep "Sair da conta": 1 match no AdminBottomNav.tsx
grep "logout" AdminBottomNav.tsx: 7 matches
AdminTab NÃO inclui 'logout': confirmado
npx tsc --noEmit: 0 erros TypeScript
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Arquivo AdminBottomNav.js desatualizado — testes importavam o compilado**
- **Found during:** Task 2 — primeira execução dos testes após implementação
- **Issue:** O arquivo de teste importa `'../AdminBottomNav.js'` (arquivo compilado). O Vitest usou o `.js` diretamente, que estava na versão antiga sem o botão Sair. Resultado: `got 5 buttons` quando esperávamos 6, e `Unable to find accessible element with name "Sair"`.
- **Fix:** Atualizado `AdminBottomNav.js` manualmente com o JSX compilado equivalente ao novo `.tsx`
- **Files modified:** `apps/web/src/components/admin/AdminBottomNav.js`
- **Commit:** 93d7d06 (incluído no commit da task)

## Threat Flags

Nenhum — implementação segue exatamente as mitigações do threat model:
- T-10-03-01: apiFetch injeta JWT automaticamente (sem expor token no frontend)
- T-10-03-02: useOneSignalDeepLink navega apenas para rotas internas fixas
- T-10-03-03: Logout entregador sem dialog — baixo risco (accept)
- T-10-03-04: Dialog de confirmação no logout admin — previne logout acidental

## Known Stubs

Nenhum — implementação completa e funcional. O modal consome o endpoint real (`POST /admin/clients/:id/grant-credits`) implementado no Plan 02.

## Self-Check: PASSED

- [x] `apps/web/src/components/admin/ClientDetailView.tsx` — modificado e commitado (8af7320)
- [x] `apps/web/src/pages/courier/CourierScreen.tsx` — modificado e commitado (8af7320)
- [x] `apps/web/src/pages/client/NotificationsScreen.tsx` — modificado e commitado (8af7320)
- [x] `apps/web/src/hooks/useOneSignalDeepLink.ts` — modificado e commitado (8af7320)
- [x] `apps/web/src/components/admin/AdminBottomNav.tsx` — modificado e commitado (93d7d06)
- [x] `apps/web/src/components/admin/AdminBottomNav.js` — atualizado e commitado (93d7d06)
- [x] `apps/web/src/components/admin/__tests__/AdminBottomNav.test.tsx` — atualizado e commitado (93d7d06)
- [x] Commit 8af7320 existe no git log
- [x] Commit 93d7d06 existe no git log
- [x] 4/4 testes AdminBottomNav passando
- [x] Zero erros TypeScript
