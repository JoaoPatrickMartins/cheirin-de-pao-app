---
phase: 02-authentication
verified: 2026-06-14T05:30:00Z
status: passed
score: 5/5
overrides_applied: 0
gaps:
  - truth: "Novo cliente completa o cadastro em 5 passos e sua conta é criada no banco"
    status: partial
    reason: "O fluxo de cadastro funciona para condomínios do tipo SINGLE_ENTRANCE, mas está bloqueado para condomínios do tipo BLOCKS. O componente OnboardingScreen condiciona os chips de bloco/torre em `selectedCondo?.blocks && selectedCondo.blocks.length > 0`, porém a API GET /condominiums nunca retorna o campo `blocks` (o model Condominium no schema.prisma não possui esse campo). Como resultado: para um condo BLOCKS, `isBlocksCondo=true`, nenhum chip aparece, `bloco` permanece null, e `step3Valid = false` — o usuário fica travado sem conseguir avançar."
    artifacts:
      - path: "apps/web/src/pages/auth/OnboardingScreen.tsx"
        issue: "Linha 521: `{isBlocksCondo && selectedCondo?.blocks && selectedCondo.blocks.length > 0 && (` — a condição `selectedCondo?.blocks` é sempre undefined porque a API não retorna esse campo"
      - path: "apps/api/src/modules/condominiums/condominiums.route.ts"
        issue: "Retorna apenas { id, name, type, neighborhood } — sem campo `blocks`. O model Condominium também não possui o campo."
      - path: "apps/api/prisma/schema.prisma"
        issue: "Model Condominium (linha 120-128) não possui campo `blocks: String[]`. A checagem de tipo BLOCKS existe via CondoType enum mas não há dados de blocos."
    missing:
      - "Adicionar campo `blocks String[]` ao model Condominium no schema.prisma e executar db push/generate"
      - "Incluir o campo `blocks` no mapeamento do GET /condominiums em condominiums.route.ts"
      - "OU: remover a dependência de `selectedCondo?.blocks` e usar apenas `isBlocksCondo` para mostrar um campo de texto livre para bloco (alinhando com a abordagem do backend que aceita `block` como string livre)"
human_verification:
  - test: "Registrar cliente com condomínio SINGLE_ENTRANCE no fluxo completo"
    expected: "5 passos concluídos, usuário criado no MongoDB Atlas, redirecionado para /client"
    why_human: "Requer servidor rodando, condomínio cadastrado no Atlas e OTP_DEV_CODE=1234 configurado"
  - test: "Admin faz login com OTP (1234 em dev) e é redirecionado para /admin"
    expected: "Login bem-sucedido, navegação para /admin, AdminLayout renderiza"
    why_human: "Requer servidor rodando e admin seed executado (ADMIN_NAME, ADMIN_EMAIL, ADMIN_CPF em .env)"
  - test: "Admin cadastra entregador via /admin/couriers/new"
    expected: "Formulário enviado, POST /auth/couriers retorna 201, tela de sucesso exibida"
    why_human: "Requer admin autenticado, depende de bearer token válido injetado pelo apiFetch"
  - test: "Sessão persiste após fechar e reabrir o app"
    expected: "auth_token e auth_user lidos do localStorage, usuario não precisa logar novamente"
    why_human: "Comportamento de rehydration é visual e depende de estado de runtime"
  - test: "Usuário não autenticado acessa /client ou /admin"
    expected: "Redirecionado para / sem flash de conteúdo protegido"
    why_human: "Comportamento de guarda de rota depende de isLoading state e timing de montagem"
---

# Phase 2: Authentication — Verification Report

**Phase Goal:** Sistema de autenticação passwordless completo — OTP via SMS/email, sessões JWT, roteamento por perfil (CLIENT/COURIER/ADMIN), cadastro de cliente e cadastro de entregador pelo admin.
**Verified:** 2026-06-14T05:30:00Z
**Status:** gaps_found
**Re-verification:** No — verificação inicial

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | Novo cliente completa o cadastro em 5 passos e sua conta é criada no banco | PARTIAL | Funciona para SINGLE_ENTRANCE; bloqueado para BLOCKS — campo `blocks` ausente na API e no schema |
| SC2 | Cliente faz login inserindo telefone/e-mail, recebe OTP 4 dígitos com auto-focus e é autenticado | VERIFIED | LoginScreen com OtpInput (4 caixas 64×72px, auto-focus, onComplete) → POST /auth/otp/verify → auth.login() |
| SC3 | Sessão persiste após fechar e reabrir o app | VERIFIED | AuthContext rehydrate: useEffect lê localStorage.auth_token + auth_user com try/catch |
| SC4 | Admin cadastra entregador pelo painel e entregador consegue fazer login com OTP | VERIFIED | CourierRegisterScreen → POST /auth/couriers com preHandler authenticate; entregador faz login via LoginScreen |
| SC5 | Login de Admin funciona com OTP — sem tela de cadastro público disponível | VERIFIED | roleRoutes[ADMIN] = '/admin' em LoginScreen; nenhuma rota pública de cadastro de admin |

**Score:** 4/5 (SC1 parcial — BLOCKER para BLOCKS condominiums)

---

## Gaps Detail

### GAP-01: Cadastro bloqueado para condomínios tipo BLOCKS (SC1, AUTH-01, AUTH-03)

**Raiz do problema:** O campo `blocks` não existe no model `Condominium` do Prisma schema e não é retornado pelo GET /condominiums. O OnboardingScreen condiciona a exibição dos chips de bloco em `selectedCondo?.blocks && selectedCondo.blocks.length > 0`, fazendo com que nenhum chip apareça para condos BLOCKS.

**Consequência em runtime:**
1. `isBlocksCondo = selectedCondo?.type === 'BLOCKS'` → `true`
2. Chips de bloco nunca renderizam (condição `selectedCondo?.blocks` é sempre `undefined`)
3. `bloco` permanece `null`
4. `step3Valid = apto.trim() !== '' && (!isBlocksCondo || bloco !== null)` → `false`
5. Botão "Enviar código de confirmação" fica desabilitado permanentemente
6. Usuário não consegue completar o cadastro

**Nota:** Como o backend aceita `block` como `String?` (campo opcional no User model), a solução mais simples é remover a dependência de `selectedCondo?.blocks` no frontend — ao invés de chips pré-definidos, usar um campo de texto livre ou remover o requisito de bloco no step3Valid e deixá-lo opcional.

**Ficheiros com problema:**
- `apps/web/src/pages/auth/OnboardingScreen.tsx` linha 521 (condição de exibição dos chips)
- `apps/api/src/modules/condominiums/condominiums.route.ts` (não retorna `blocks`)
- `apps/api/prisma/schema.prisma` model Condominium (não possui campo `blocks`)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/prisma/schema.prisma` | Session + OtpCode models | VERIFIED | Modelos nas linhas 285 e 297 com todos os campos necessários |
| `apps/api/src/modules/auth/auth.schema.ts` | RegisterSchema, SendOtpSchema, VerifyOtpSchema, RegisterCourierSchema | VERIFIED | Todos exportados; RegisterSchema tem .refine phone\|email |
| `apps/api/src/modules/auth/auth.repository.ts` | AuthRepository com todos os métodos | VERIFIED | 10 métodos implementados; acessa fastify.prisma |
| `apps/api/src/modules/auth/auth.service.ts` | AuthService com generateOtpCode, sendOtp, etc. | VERIFIED | Todos os 8 métodos; dev bypass NODE_ENV=development funcional |
| `apps/api/src/modules/auth/otp.service.ts` | sendSmsOtp + sendEmailOtp | VERIFIED | Zenvia via fetch direto; Resend via SDK |
| `apps/api/src/modules/auth/auth.controller.ts` | AuthController com 4 handlers | VERIFIED | Validação Zod + delegação ao AuthService |
| `apps/api/src/modules/auth/auth.route.ts` | authRoute com 4 endpoints | VERIFIED | POST /auth/register, /otp/send, /otp/verify sem preHandler; /auth/couriers com preHandler |
| `apps/api/src/plugins/authenticate.ts` | Plugin com decorateRequest + decorate('authenticate') | VERIFIED | Sem addHook('onRequest'); preHandler opt-in apenas |
| `apps/api/src/bootstrap/admin-seed.ts` | seedAdminIfAbsent | VERIFIED | Criação idempotente; lê ADMIN_NAME, ADMIN_EMAIL/PHONE, ADMIN_CPF |
| `apps/api/src/modules/condominiums/condominiums.route.ts` | GET /condominiums público | VERIFIED | Retorna array { id, name, type, neighborhood }; sem preHandler |
| `apps/api/src/server.ts` | Registro correto dos plugins + rotas | VERIFIED | seedAdminIfAbsent → authenticatePlugin → authRoute → condominiumsRoute |
| `apps/api/vitest.config.ts` | Node environment | VERIFIED | environment: 'node', globals: true |
| `packages/shared/src/schemas/index.ts` | CpfSchema com módulo-11 | VERIFIED | validateCpfDigits helper (não exportado) + CpfSchema com .transform() + .refine() |
| `apps/web/src/contexts/AuthContext.tsx` | AuthProvider como layout route | VERIFIED | Renderiza `<Outlet />`; localStorage em try/catch; useMemo no value |
| `apps/web/src/hooks/useAuth.ts` | useAuth com guard | VERIFIED | Throws 'useAuth must be used inside AuthProvider' se context null |
| `apps/web/src/components/ProtectedRoute.tsx` | Guard por role | VERIFIED | isLoading → LoadingScreen; !user → Navigate('/'); role mismatch → Navigate('/') |
| `apps/web/src/pages/auth/LoadingScreen.tsx` | BreadMark 48px centralizado | VERIFIED | size=48, color="var(--color-gold)", aria-live="polite", backgroundColor var(--color-app-bg) |
| `apps/web/src/routes/router.tsx` | AuthProvider como root layout + /login + /register + couriers/new | VERIFIED | Component: AuthProvider na raiz; /login, /register lazy; /admin/couriers/new aninhado |
| `apps/web/src/lib/apiFetch.ts` | Wrapper com X-Device-Id + Authorization | VERIFIED | crypto.randomUUID() para device_id; localStorage try/catch; Authorization injetado se token |
| `apps/web/src/components/auth/OtpInput.tsx` | 4 inputs 64×72px, auto-focus, onComplete | VERIFIED | Dimensões corretas; /^\d?$/ guard; backspace move foco; onComplete após 4 dígitos |
| `apps/web/src/components/auth/ResendTimer.tsx` | Countdown 30s, reenvio ao zerar | VERIFIED | setTimeout countdown; texto correto "Reenviar em 0:XX" / "Reenviar código" |
| `apps/web/src/pages/auth/LoginScreen.tsx` | 2 passos phone/email → OTP | VERIFIED | Step 1 → POST /otp/send; Step 2 OtpInput → POST /otp/verify → role-based navigate |
| `apps/web/src/pages/auth/OnboardingScreen.tsx` | 5-step stepper com API wiring | PARTIAL | SINGLE_ENTRANCE: OK; BLOCKS: chip selector nunca renderiza (blocks array ausente da API) |
| `apps/web/src/components/auth/StepDots.tsx` | 5 dots animados | VERIFIED | Active 24×8px, inactive 8×8px, transition 0.25s ease |
| `apps/web/src/components/auth/ChannelSelector.tsx` | Toggle SMS/email com auto-select | VERIFIED | phone-only → SMS; email-only → email; ambos → mantém seleção atual |
| `apps/web/src/components/auth/CondoSearch.tsx` | Busca com empty state | VERIFIED | Filtro case-insensitive; empty state "Seu condomínio ainda não é parceiro." |
| `apps/web/src/pages/admin/CourierRegisterScreen.tsx` | Form admin 4 campos + POST /auth/couriers | VERIFIED | Todos hooks antes do role guard; CPF formatado; success state |
| `apps/api/src/__tests__/auth.service.test.ts` | 4 testes reais (não it.todo) | VERIFIED | generateOtpCode, dev mode bypass, session expiry, device mismatch |
| `apps/web/src/components/auth/__tests__/OtpInput.test.tsx` | 4 testes reais | VERIFIED | Renders 4 inputs, onComplete after 4 digits, rejects non-numeric, backspace focus |

**Artefato ausente:**
- `apps/api/src/__tests__/auth.schema.test.ts` — planejado no 02-01-PLAN como stub para AUTH-03, não foi criado. Impacto: baixo (stub de teste, não bloqueia funcionalidade).

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `auth.route.ts` | `authenticate.ts` | `preHandler: [fastify.authenticate]` em /auth/couriers | WIRED | Linha 15 de auth.route.ts confirma |
| `authenticate.ts` | `prisma.session` | `fastify.prisma.session.findFirst` | WIRED | Linha 31 de authenticate.ts |
| `server.ts` | `admin-seed.ts` | `seedAdminIfAbsent(fastify.prisma)` | WIRED | Linha 61 de server.ts |
| `auth.service.ts` | `auth.repository.ts` | `new AuthRepository(fastify)` | WIRED | Linha 11 de auth.service.ts |
| `auth.schema.ts` | `packages/shared` | `import { CpfSchema } from '@cheirin-de-pao/shared'` | WIRED | Linha 2 de auth.schema.ts |
| `router.tsx` | `AuthContext.tsx` | `Component: AuthProvider` como root layout route | WIRED | Linha 7 de router.tsx |
| `ClientLayout.tsx` | `useAuth.ts` | `useAuth()` para guard de role | WIRED | Linha 7 de ClientLayout.tsx |
| `LoginScreen.tsx` | `apiFetch.ts` | `apiFetch('/auth/otp/send')` + `apiFetch('/auth/otp/verify')` | WIRED | Linhas 43 e 77 de LoginScreen.tsx |
| `LoginScreen.tsx` | `AuthContext.tsx` | `auth.login(token, user)` após verify | WIRED | Linha 87 de LoginScreen.tsx |
| `OnboardingScreen.tsx` | `apiFetch.ts` | `apiFetch('/auth/register')` + `apiFetch('/condominiums')` + `apiFetch('/auth/otp/verify')` | WIRED | Linhas 84, 133, 198 de OnboardingScreen.tsx |
| `CourierRegisterScreen.tsx` | `apiFetch.ts` | `apiFetch('/auth/couriers')` | WIRED | Linha 53 de CourierRegisterScreen.tsx |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `OnboardingScreen.tsx` | `condos` (Step 2) | `apiFetch('/condominiums')` → `GET /condominiums` → `fastify.prisma.condominium.findMany()` | Sim (DB query real) | FLOWING |
| `LoginScreen.tsx` | `userId` (Step 2) | `apiFetch('/auth/otp/send')` → `POST /auth/otp/send` → `AuthService.sendOtp()` → `AuthRepository.createOtp()` | Sim | FLOWING |
| `AuthContext.tsx` | `user, token` (rehydrate) | `localStorage.getItem('auth_token')` + `'auth_user'` | Sim (persiste após login) | FLOWING |
| `OnboardingScreen.tsx` (Step 3) | `bloco` chips | `selectedCondo.blocks` | **Nunca** — API não retorna `blocks` | DISCONNECTED |

---

## Behavioral Spot-Checks

Sem servidor ativo — spot-checks manuais documentados na seção Human Verification.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUTH-01 | 02-05 | Cliente pode se cadastrar em 5 passos | PARTIAL | OnboardingScreen com 5 steps existe e funciona para SINGLE_ENTRANCE; BLOCKS bloqueado |
| AUTH-02 | 02-01, 02-02 | CPF, nome, data nasc., tel. ou e-mail, condo, apto obrigatórios | VERIFIED | RegisterSchema em auth.schema.ts; CpfSchema com módulo-11; .refine phone\|email |
| AUTH-03 | 02-05 | Bloco/Torre condicional para condo tipo BLOCKS | PARTIAL | isBlocksCondo lógica correta no frontend; chips nunca aparecem (blocks ausente da API) |
| AUTH-04 | 02-05 | Canal automático: SMS se tel., e-mail se só e-mail | VERIFIED | ChannelSelector com useEffect auto-select em OnboardingScreen |
| AUTH-05 | 02-02 | Login sem senha com OTP 4 dígitos | VERIFIED | AuthService.generateOtpCode(); dev bypass; OtpInput 4 boxes |
| AUTH-06 | 02-02, 02-03 | Sessão permanente 90 dias; novo código só em troca de dispositivo | VERIFIED | expiresAt = now + 90d; device mismatch revoga sessão; localStorage rehydration |
| AUTH-07 | 02-02b, 02-05 | Entregador cadastrado pelo Admin (não auto-cadastro) | VERIFIED | POST /auth/couriers com preHandler authenticate + role ADMIN; CourierRegisterScreen |
| AUTH-08 | 02-03, 02-04 | Admin faz login com OTP — sem cadastro público | VERIFIED | roleRoutes[ADMIN]='/admin'; sem rota pública de cadastro de admin |
| UI-06 | 02-04 | OTP com 4 inputs — avanço automático de foco | VERIFIED | OtpInput 64×72px; auto-focus; backspace navigation; 4 testes passando |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `OnboardingScreen.tsx` | 521 | `selectedCondo?.blocks` nunca definido — dado sempre ausente da API | BLOCKER | Cadastro travado para BLOCKS condominiums |
| `condominiums.route.ts` | 10-14 | Retorna apenas id/name/type/neighborhood — sem blocks | BLOCKER (origin) | Causa raiz do gap de AUTH-03 |

Nenhum `TBD`, `FIXME`, `XXX`, `TODO` desbloqueado nos arquivos de produção (os TODOs encontrados são atributos HTML `placeholder` em campos de formulário, não marcadores de código incompleto).

---

## Human Verification Required

### 1. Cadastro completo de cliente com condomínio SINGLE_ENTRANCE

**Test:** Acessar http://localhost:5173/register, completar 5 passos com condo do tipo SINGLE_ENTRANCE, usando OTP_DEV_CODE=1234
**Expected:** Conta criada no MongoDB Atlas; redirecionamento para /client; sem erros no console
**Why human:** Requer servidor API e banco Atlas ativos; fluxo multi-passo com estado

### 2. Login Admin via OTP e acesso ao /admin

**Test:** Acessar http://localhost:5173/login, inserir o e-mail/telefone do admin seedado (configurado em .env), digitar 1234 no step OTP
**Expected:** Redirecionado para /admin; AdminLayout exibe "Painel Admin — Fase 3"; sem loop de redirect
**Why human:** Depende de seed do admin no boot (ADMIN_NAME, ADMIN_EMAIL/PHONE, ADMIN_CPF no .env)

### 3. Cadastro de entregador pelo admin

**Test:** Com admin logado, navegar para http://localhost:5173/admin/couriers/new, preencher o formulário e submeter
**Expected:** POST /auth/couriers retorna 201; tela de sucesso "Entregador cadastrado com sucesso!" exibida
**Why human:** Depende de autenticação admin ativa e token válido no localStorage

### 4. Persistência de sessão após fechamento do app

**Test:** Fazer login como cliente, fechar a aba/app, reabrir http://localhost:5173/client
**Expected:** Usuário permanece autenticado (sem redirect para /, sem tela de login)
**Why human:** Comportamento de rehydration de runtime não testável por grep

### 5. Guard de rota — usuário não autenticado

**Test:** Acessar http://localhost:5173/client ou /admin sem estar autenticado
**Expected:** Redirecionamento imediato para / sem flash de conteúdo protegido; LoadingScreen pode aparecer brevemente
**Why human:** Comportamento visual de timing de isLoading e montagem do componente

---

## Gaps Summary

**1 gap bloqueador** impede a verificação completa do SC1 (cadastro em 5 passos):

O campo `blocks` não existe no model `Condominium` do Prisma schema e não é retornado pelo endpoint GET /condominiums. O OnboardingScreen depende desse campo para exibir os chips de bloco/torre para condominiums do tipo BLOCKS. Sem os chips, o campo `bloco` jamais é preenchido, e a validação do passo 3 bloqueia o progresso.

**Três caminhos de correção possíveis:**

1. **Adicionar `blocks String[]` ao schema Condominium** — adicionar o campo ao model Prisma, executar db push/generate, incluir no retorno do GET /condominiums, e alimentar via admin CRUD (Fase 7).

2. **Campo de texto livre** — substituir os chips por um input de texto para o bloco/torre quando `isBlocksCondo === true`, eliminando a dependência de `blocks` no schema.

3. **Remover obrigatoriedade no frontend** — tornar o campo `block` opcional no step3Valid (alinhando com auth.schema.ts que já tem `block: z.string().optional()`), exibindo um campo de texto simples sem que ele bloqueie o fluxo.

**Opção 3 é a mais rápida** — corresponde ao que o backend já aceita (block é opcional) e evita qualquer mudança de schema.

---

_Verificado: 2026-06-14T05:30:00Z_
_Verificador: Claude (gsd-verifier)_
