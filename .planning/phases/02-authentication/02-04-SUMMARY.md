---
phase: 02-authentication
plan: 04
subsystem: auth
tags: [react, otp, login, fetch, api-client]

requires:
  - phase: 02-03
    provides: AuthContext com auth.login(), useAuth(), ProtectedRoute, router com /login lazy route

provides:
  - apiFetch: wrapper centralizado com X-Device-Id + Authorization headers em toda requisição
  - OtpInput: 4 inputs OTP com auto-focus, backspace navigation, onComplete callback
  - ResendTimer: countdown 30s habilitando reenvio
  - LoginScreen: fluxo 2 passos (phone/email → OTP) com API wiring completo e redirect por role

affects: [02-05-registration, 03-client-home, 04-courier-route, 05-admin-panel]

tech-stack:
  added: []
  patterns:
    - apiFetch centraliza X-Device-Id e Authorization em toda requisição da app
    - device_id gerado via crypto.randomUUID() e persistido em localStorage no primeiro uso
    - OtpInput usa refs array + onChange guard /^\d?$/ para reject não-dígitos
    - LoginScreen mantém estado interno (step, userId, isLoading, error) e chama auth.login() após verify

key-files:
  created:
    - apps/web/src/lib/apiFetch.ts
    - apps/web/src/components/auth/OtpInput.tsx
    - apps/web/src/components/auth/ResendTimer.tsx
    - apps/web/src/components/auth/__tests__/OtpInput.test.tsx
    - apps/web/src/pages/auth/LoginScreen.tsx
  modified:
    - apps/web/src/components/__tests__/OtpInput.test.tsx

key-decisions:
  - "apiFetch retorna Response raw — callers fazem .json() e checam status (sem abstração de erro no wrapper)"
  - "Backspace em caixa OTP vazia foca caixa anterior (onKeyDown handler separado do onChange)"
  - "LoginScreen não tem botão 'Confirmar' explícito no step OTP — submit via onComplete do OtpInput (auto)"
  - "ResendTimer usa setTimeout (não setInterval) para evitar race conditions de timer"
  - "Erro de OTP expirado detectado por string matching na mensagem de erro do backend ('expired')"

requirements-completed: [AUTH-04, AUTH-05, AUTH-08, UI-06]

duration: ~35min
completed: 2026-06-14
---

# Plan 02-04: Login Vertical Slice Summary

**Login OTP completo end-to-end — apiFetch com device binding, OtpInput 4-box com auto-focus, ResendTimer 30s, e LoginScreen 2-step que chama a API e roteia por perfil.**

## Accomplishments

- **apiFetch** (`apps/web/src/lib/apiFetch.ts`): Wrapper centralizado que injeta `Content-Type: application/json`, `X-Device-Id` (gerado via `crypto.randomUUID()` no primeiro uso e persistido em localStorage) e `Authorization: Bearer <token>` (quando disponível). Todo acesso a localStorage envolvido em try/catch (Pitfall 6 — iOS Safari private mode). Retorna `Response` raw.

- **OtpInput** (`apps/web/src/components/auth/OtpInput.tsx`): 4 inputs independentes com auto-focus ao digitar, backspace em caixa vazia move foco para anterior, rejeição de não-dígitos via `/^\d?$/`, `onComplete(code)` dispara quando todos 4 dígitos preenchidos. Dimensões exatas do UI-SPEC: 64×72px, borderRadius 18, fontSize 30, --color-accent quando preenchido.

- **ResendTimer** (`apps/web/src/components/auth/ResendTimer.tsx`): Countdown 30s com `useState + useEffect setTimeout`. Exibe "Não chegou? Reenviar em 0:XX" em `--color-text-ter` durante countdown. Ao zerar: botão "Não chegou? Reenviar código" em `--color-accent`. On click: reseta para 30s e chama `onResend()`.

- **OtpInput.test.tsx** (`apps/web/src/components/__tests__/OtpInput.test.tsx`): 4 `it.todo` stubs substituídos por testes reais com `@testing-library/react` + `fireEvent`. Testes: renders 4 inputs, focus advance on digit, onComplete after 4 digits, rejeição de não-numérico. Todos passando.

- **LoginScreen** (`apps/web/src/pages/auth/LoginScreen.tsx`): 2 steps via `useState<'phone-entry' | 'otp'>`. Step 1: input phone/email → POST `/auth/otp/send` → avança para step 2. Step 2: OtpInput → POST `/auth/otp/verify` → `auth.login(token, user)` → redirect por role (`ADMIN → /admin`, `CLIENT → /client`, `COURIER → /courier`). Back button do step 2 retorna ao step 1 (não navega para '/'). Mensagens de erro: "Código incorreto. Verifique e tente de novo." (401), "Código expirado. Solicite um novo." (expired). Toggle phone/email mode.

## Self-Check

```
FOUND: apps/web/src/lib/apiFetch.ts
FOUND: apps/web/src/components/auth/OtpInput.tsx
FOUND: apps/web/src/components/auth/ResendTimer.tsx
FOUND: apps/web/src/components/auth/__tests__/OtpInput.test.tsx
FOUND: apps/web/src/pages/auth/LoginScreen.tsx
FOUND: commit 4907ea5
FOUND: commit f6b313d
Tests: 8 passed (4 OtpInput tests in __tests__/, 4 in auth/__tests__/)
TypeScript: 1 expected error (OnboardingScreen — Plan 05 scope)
```

## Self-Check: PASSED

## Deviations from Plan

### Auto-fixed Issues

None. Plan executed as written.

### Notes

- `@testing-library/user-event` não está instalado no projeto. Testes escritos com `fireEvent` do `@testing-library/react` (já instalado). Comportamento equivalente para os casos testados.
- O teste de "focus advances" verificado via `document.activeElement` após `fireEvent.change` — funciona corretamente com a implementação de refs.
- TypeScript reporta 1 erro esperado (`OnboardingScreen` — plano 05 fora de escopo). Resolvido quando Plan 05 for executado.
- Executado em worktree paralelo (`worktree-agent-a1cee489a360924c1`); testes verificados localmente com `cd apps/web && npx vitest run`.

## Known Stubs

Nenhum. Todos os componentes têm dados reais wired.

## Threat Flags

Nenhuma nova superfície de segurança além do que está no threat model do plano. apiFetch injeta X-Device-Id em todas as requisições conforme planejado (T-02-12 mitigado no OtpInput, T-02-14 mitigado pelo loading state no CTA).
