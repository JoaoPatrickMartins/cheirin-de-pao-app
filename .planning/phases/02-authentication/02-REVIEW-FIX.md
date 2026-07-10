---
phase: 02-authentication
fixed_at: 2026-06-14T01:45:00Z
review_path: .planning/phases/02-authentication/02-REVIEW.md
iteration: 1
findings_in_scope: 13
fixed: 13
skipped: 0
status: all_fixed
---

# Fase 02: Relatório de Correções — Autenticação

**Corrigido em:** 2026-06-14T01:45:00Z
**Review fonte:** .planning/phases/02-authentication/02-REVIEW.md
**Iteração:** 1

**Resumo:**
- Findings no escopo: 13 (7 críticos + 6 avisos)
- Corrigidos: 13
- Ignorados: 0

---

## Problemas Corrigidos

### CR-01 + CR-04: Fluxo de login quebrado + vazamento de erros internos

**Arquivos modificados:** `apps/api/src/modules/auth/auth.controller.ts`
**Commit:** `2be5029`
**Correção aplicada:** `sendOtp` agora retorna `{ ok: true, userId: user.id }`, permitindo que `LoginScreen.tsx` armazene o `userId` e o envie corretamente para `/auth/otp/verify`. Todos os blocos `catch` dos handlers passaram a usar `fastify.log.error(err)` + resposta genérica, eliminando vazamento de stack traces e mensagens internas do Prisma/Atlas nas respostas HTTP.

---

### CR-02 + CR-05: OTP inseguro e comparação vulnerável a timing attacks

**Arquivos modificados:** `apps/api/src/modules/auth/auth.service.ts`
**Commit:** `9bc9aa9`
**Correção aplicada:** `generateOtpCode()` agora usa `randomInt(1000, 10000)` do `node:crypto` (CSPRNG), substituindo `Math.random()` previsível. A comparação do hash do OTP usa `timingSafeEqual` em vez de `!==` de string, eliminando ataques de timing que poderiam revelar prefixos do hash correto.

---

### CR-03 + WR-05: Sem rate-limiting e CORS bloqueado em produção

**Arquivos modificados:** `apps/api/src/server.ts`, `apps/api/package.json`, `package-lock.json`
**Commit:** `12c7735`
**Correção aplicada:** Instalado `@fastify/rate-limit` e registrado globalmente com `max: 5, timeWindow: '1 minute'`, bloqueando brute force contra os endpoints OTP. Substituído `origin: false` por `process.env.CORS_ORIGIN ?? 'http://localhost:5173'` — corrigindo o bloqueio total do PWA em produção (browsers rejeitavam respostas cross-origin sem o header `Access-Control-Allow-Origin`). Variável `CORS_ORIGIN` adicionada ao `envSchema`. Em produção: `CORS_ORIGIN=https://app.cheirindepao.com.br`.

---

### CR-06: `condominiums.route.ts` expõe `String(err)` em rota pública

**Arquivos modificados:** `apps/api/src/modules/condominiums/condominiums.route.ts`
**Commit:** `835c016`
**Correção aplicada:** `String(err)` substituído por `fastify.log.error(err)` + `{ error: 'Erro ao carregar condomínios.' }`, evitando exposição de detalhes internos a visitantes não autenticados.

---

### CR-07: `OtpInput` declara `useRef` dentro de array literal — violação das Rules of Hooks

**Arquivos modificados:** `apps/web/src/components/auth/OtpInput.tsx`
**Commit:** `ef15496`
**Correção aplicada:** Cada `useRef` é agora declarado em linha própria (`ref0`, `ref1`, `ref2`, `ref3`) antes de ser agrupado no array `refs`. Hooks fora de array literal são estáveis para o linter ESLint `react-hooks` e para o React Compiler.

---

### WR-01: `admin-seed.ts` usa fallback CPF `'00000000000'`

**Arquivos modificados:** `apps/api/src/bootstrap/admin-seed.ts`
**Commit:** `3bc6867`
**Correção aplicada:** `ADMIN_CPF` agora é obrigatório na verificação inicial — seed é ignorado com aviso se ausente, em vez de criar admin com CPF inválido que viola unicidade do schema e falha em validações futuras de CPF.

---

### WR-02: `LoginScreen` — verificação de expiração com string em inglês

**Arquivos modificados:** `apps/web/src/pages/auth/LoginScreen.tsx`
**Commit:** `b7b73ee`
**Correção aplicada:** `'expired'` (inglês) substituído por `'expir'` (cobre `'OTP expirado'` e `'Sessão expirada'` em português), alinhando com o padrão já presente em `OnboardingScreen.tsx`.

---

### WR-03: `OnboardingScreen` e `CourierRegisterScreen` lêem `err?.message` em vez de `err?.error`

**Arquivos modificados:** `apps/web/src/pages/auth/OnboardingScreen.tsx`, `apps/web/src/pages/admin/CourierRegisterScreen.tsx`
**Commit:** `d31d8d8`
**Correção aplicada:** Três pontos corrigidos: `handleStep3Submit` (OnboardingScreen), `handleOtpComplete` (OnboardingScreen) e `handleSubmit` (CourierRegisterScreen). Todos passaram de `{ message?: string }` para `{ error?: string }` com acesso via `err?.error`, expondo a mensagem real do backend ao usuário.

---

### WR-04: `authenticate.ts` — sessão não filtrada por `expiresAt` no query

**Arquivos modificados:** `apps/api/src/plugins/authenticate.ts`
**Commit:** `4b7f4d0`
**Correção aplicada:** Adicionado `expiresAt: { gt: new Date() }` diretamente ao `findFirst`, eliminando I/O desnecessário e janela de acesso indevido por clock skew. A verificação JavaScript pós-fetch foi removida pois o banco agora garante o filtro.

---

### WR-06: `OnboardingScreen` — dupla submissão possível ao completar OTP

**Arquivos modificados:** `apps/web/src/pages/auth/OnboardingScreen.tsx`
**Commit:** `d47fd1a`
**Correção aplicada:** Adicionado guard `if (loading) return` no topo de `handleOtpComplete`, prevenindo execução concorrente quando `OtpInput.onComplete` e o botão "Criar conta e ver meu pão" são acionados na mesma micro-janela de estado.

---

## Verificação

- TypeScript (`npx tsc --noEmit -p apps/web/tsconfig.json`): erros pré-existentes de setup de tipos no projeto (missing `react`, `react-router` type declarations) — nenhum erro introduzido pelas correções.
- Testes web (`npm run test --workspace=@cheirin-de-pao/web`): **8 passed | 6 todo** — sem regressões.

---

_Corrigido em: 2026-06-14T01:45:00Z_
_Agente: Claude (gsd-code-fixer)_
_Iteração: 1_
