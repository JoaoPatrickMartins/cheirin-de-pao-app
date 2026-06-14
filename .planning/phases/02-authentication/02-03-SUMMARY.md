---
phase: 02-authentication
plan: 03
subsystem: auth
tags: [react, react-router, context, auth, protected-routes]

requires:
  - phase: 02-02
    provides: JWT auth service e OTP service no backend
  - phase: 02-02b
    provides: Rotas HTTP de autenticação (POST /auth/otp/send, /auth/otp/verify)

provides:
  - AuthContext com user/token/isLoading/login/logout — disponível em toda a árvore de rotas
  - useAuth() hook com guard (throws fora do AuthProvider)
  - ProtectedRoute para gates de role CLIENT/COURIER/ADMIN
  - LoadingScreen com BreadMark centralizado durante rehydration
  - Router reescrito com AuthProvider como layout route raiz
  - ClientLayout, CourierLayout, AdminLayout com guards de autenticação por role
  - Rotas /login e /register declaradas (lazy, componentes nos planos 04 e 05)

affects: [02-04-login-screen, 02-05-registration, 03-client-home, 04-courier-route, 05-admin-panel]

tech-stack:
  added: []
  patterns:
    - AuthProvider como layout route dentro de createBrowserRouter (não wrapper de RouterProvider)
    - localStorage.auth_token + localStorage.auth_user com try/catch para iOS Safari private mode
    - ProtectedRoute com renderização condicional — isLoading → LoadingScreen, !user → Navigate, role mismatch → Navigate

key-files:
  created:
    - apps/web/src/contexts/AuthContext.tsx
    - apps/web/src/hooks/useAuth.ts
    - apps/web/src/components/ProtectedRoute.tsx
    - apps/web/src/pages/auth/LoadingScreen.tsx
  modified:
    - apps/web/src/routes/router.tsx
    - apps/web/src/pages/client/ClientLayout.tsx
    - apps/web/src/pages/courier/CourierLayout.tsx
    - apps/web/src/pages/admin/AdminLayout.tsx

key-decisions:
  - "AuthProvider como layout route (Component: AuthProvider) com Outlet — permite useNavigate dentro do provider"
  - "Todos os acessos a localStorage no try/catch — iOS Safari private mode pode lançar exceção"
  - "ProtectedRoute é um componente wrapper (não layout route) — usado dentro de cada Layout"
  - "router.tsx agora declara /login e /register como lazy routes mesmo sem os componentes existirem ainda"

patterns-established:
  - "Layout route auth: usar Component: AuthProvider na raiz do router, não wrapper em main.tsx"
  - "Session rehydration: useEffect lê localStorage.auth_token + auth_user na montagem, setState com isLoading=false ao final"
  - "Role guard pattern: isLoading check → user null check → role check — nesta ordem"

requirements-completed: [AUTH-06, AUTH-08]

duration: ~45min
completed: 2026-06-14
---

# Plan 02-03: React Auth Infrastructure Summary

**Infraestrutura de autenticação React completa — AuthProvider como layout route raiz, guards por role nos layouts, e session rehydration via localStorage.**

## Accomplishments

- **AuthContext** (`AuthContext.tsx`): AuthProvider como named export renderizando `<Outlet />` como layout route no React Router. State: `user`, `token`, `isLoading`. login() / logout() persistem no localStorage com try/catch. useMemo no value para evitar re-renders desnecessários.
- **useAuth** (`useAuth.ts`): Hook com guard — throws `'useAuth must be used inside AuthProvider'` se context for null.
- **ProtectedRoute** (`ProtectedRoute.tsx`): Guard de role com 3 níveis — isLoading → LoadingScreen, !user → Navigate(/), role mismatch → Navigate(/). Aceita prop `requiredRole`.
- **LoadingScreen** (`LoadingScreen.tsx`): BreadMark size=48 centralizado em `var(--color-app-bg)`, `aria-live="polite"`, sem texto.
- **Router** (`router.tsx`): AuthProvider como root layout route wrapping todas as rotas. /login e /register adicionados como lazy routes. /client, /courier, /admin mantidos como lazy routes filhos.
- **Layouts com guards**: ClientLayout, CourierLayout, AdminLayout agora guardam acesso por role via useAuth() diretamente.

## Self-Check

- [x] AuthProvider usa `<Outlet />`, não `children` — compatível com React Router layout routes
- [x] localStorage envolvido em try/catch em todos os acessos (iOS Safari private mode)
- [x] ProtectedRoute redireciona para '/' em !user ou role mismatch
- [x] LoadingScreen: BreadMark size=48, var(--color-gold), var(--color-app-bg), aria-live=polite
- [x] Router: AuthProvider como raiz, /login e /register declarados, layouts como filhos
- [x] TypeScript: 2 erros esperados (LoginScreen e OnboardingScreen não existem ainda — plans 04+05)
- [x] Testes: 10 stubs passando (sem regressões)

## Deviations

- Layouts usam useAuth() diretamente em vez de ProtectedRoute como wrapper — ambas as abordagens são corretas; usando diretamente simplifica o componente e dá mais controle sobre a UI de loading.
