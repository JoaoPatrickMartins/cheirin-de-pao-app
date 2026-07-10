# Plano — Autenticação por senha + migração para JWT

> ✅ **CONCLUÍDO (2026-07-02)** — Fases 1–10 implementadas na branch `feat/redesign-compra-dias`.
> Regressão E2E no backend real: 19/19 fluxos OK (register→OTP→login, refresh+rotação,
> troca logado, reset via OTP, single-device, logout). Testes: 269 api + 96 web. Sem commit ainda.
> **Apagar este documento quando o trabalho for mergeado.**

> ⚠️ **Documento temporário de planejamento.** Referência durante a implementação.

---

## 1. Objetivo

1. Adicionar **login por e-mail + senha** como método primário para os **3 papéis** (`CLIENT`, `COURIER`, `ADMIN`).
2. Manter o **OTP** com dois papéis: (a) **recuperação/troca de senha** e (b) **método alternativo de login**.
3. Adicionar **troca de senha logado** (senha atual → nova senha), além da troca via OTP.
4. **Migrar a camada de sessão para JWT** (access token JWT curto + refresh token rotacionado), substituindo o token opaco atual.

---

## 2. Como funciona hoje (levantamento)

- **Sem senha, sem JWT.** Login = OTP de 4 dígitos por e-mail (Resend). O "token" é opaco (`randomBytes(32)` hex), guardado **hasheado (SHA-256)** na coleção `Session`, válido **90 dias**. A cada request o [authenticate.ts](../../apps/api/src/plugins/authenticate.ts) hasheia o Bearer e busca a `Session` no banco.
- **`User` não tem campo de senha** — [schema.prisma:121](../../apps/api/prisma/schema.prisma#L121). `@types/bcryptjs` está no `package.json` raiz, mas **`bcryptjs` (runtime) NÃO** — só os tipos, órfãos.
- **1 fluxo, 3 papéis.** `role` (`UserRole { CLIENT, COURIER, ADMIN }`) lido no verify. Cliente se cadastra (`POST /auth/register`), entregador é criado pelo admin (`POST /auth/couriers`), admin é seedado por env ([admin-seed.ts](../../apps/api/src/bootstrap/admin-seed.ts)).
- **Sessão única por dispositivo** — no verify revoga sessões de outros `deviceId`; a cada request checa `X-Device-Id` e o flag `isRevoked` no banco (**revogação instantânea**). Ver [authenticate.ts:33-65](../../apps/api/src/plugins/authenticate.ts#L33-L65).
- **Front sem Zod, sem interceptor de 401.** Token em `localStorage` (`auth_token`/`auth_user`). Ver [apiFetch.ts](../../apps/web/src/lib/apiFetch.ts), [AuthContext.tsx](../../apps/web/src/contexts/AuthContext.tsx), [LoginScreen.tsx](../../apps/web/src/pages/auth/LoginScreen.tsx).
- **Rate limit**: global 200/min; OTP send/verify 5/min/IP ([auth.route.ts:5](../../apps/api/src/modules/auth/auth.route.ts#L5)).

---

## 3. Decisões travadas (confirmadas com o usuário 2026-07-02)

| Tema | Decisão |
|---|---|
| Senha obrigatória? | **Sim, para todas as contas.** OTP = alternativo + recuperação. |
| Contas existentes (sem senha) | No próximo acesso entram por OTP e são **forçadas a definir senha** antes de usar o app. |
| Cadastro de cliente | **Cria senha no wizard de cadastro** (+ verifica OTP uma vez para ativar). |
| Entregador / Admin | Primeiro acesso via OTP → **obrigatório definir senha nesse primeiro acesso**. Cadastro de entregador pelo admin **não muda**. |
| Troca de senha | Dois caminhos: **(a) via OTP** (esqueci a senha) e **(b) logado com senha atual** (dentro do perfil). |
| Hash | **bcryptjs** (`@types/bcryptjs` já presente; adicionar runtime). |
| Política de senha | Mínimo **8 caracteres** (regra única no `packages/shared`, validada no backend). |
| Sessão | **Migrar para JWT**: access token JWT curto + refresh token rotacionado no banco. |
| Revogação single-device | **Opção A — stateless** (confirmada 2026-07-02): lag ≤15 min; sem lookup por request. |

---

## 4. Modelo de dados (Prisma)

[schema.prisma](../../apps/api/prisma/schema.prisma) — MongoDB (sem migração, basta `prisma generate` / `db push`).

### `User` — adicionar
```prisma
passwordHash  String?     // bcrypt; null = ainda não definiu (força set no 1º acesso via OTP)
passwordSetAt DateTime?   // auditoria
```
- **Nullable** de propósito: não há como fazer backfill; a obrigatoriedade é garantida no **fluxo**, não no banco.
- `passwordHash` **nunca** pode sair em resposta/select público (cuidado com o response-schema do Fastify — memória `fastify-response-schema-strips-fields`).

### `Session` — passa a ser o *store de refresh token*
O model atual ([schema.prisma:353](../../apps/api/prisma/schema.prisma#L353)) é reaproveitado: o campo `token` passa a guardar o **hash SHA-256 do refresh token** (não mais do access token). `deviceId`, `expiresAt` (90 dias), `isRevoked`, `lastUsedAt` seguem. Sem campos novos obrigatórios.

---

## 5. Migração para JWT (camada de sessão)

### 5.1 Desenho
- **Access token (JWT)** — assinado com `JWT_SECRET`, TTL **curto (15 min)**. Claims: `sub`=userId, `role`, `name`, `sid`=sessionId, `deviceId`, `iat`, `exp`. Validado por **assinatura** (sem I/O no caminho comum).
- **Refresh token** — opaco (`randomBytes(32)` hex), guardado **hasheado** na `Session`, TTL **90 dias**, **rotacionado** a cada refresh (gera novo, revoga o antigo).
- **Biblioteca**: `@fastify/jwt` (integra `fastify.jwt.sign/verify`).

### 5.2 Trade-off — sessão única por dispositivo ⚠️ (decisão de execução)
Hoje o kick de dispositivo é **instantâneo** (checa `isRevoked` no banco a cada request). Com JWT stateless o access token continua válido até expirar. Duas opções:

| Opção | Revogação | Custo | Recomendação |
|---|---|---|---|
| **A — Stateless puro** | Lag ≤ TTL do access (15 min): device kickado só perde acesso quando o access expira e o refresh (revogado) falha ao renovar. `deviceId` no claim ainda dá **detecção de troca de device instantânea** (401 sem banco). | Zero I/O no request | **Recomendada** — 15 min de lag é aceitável para o app; enforcement real acontece no login/refresh. |
| **B — Híbrida** | Instantânea (igual hoje). | 1 lookup por `sid` a cada request (mesmo custo de hoje). | Escolher se lag zero for requisito duro. |

**✅ DECIDIDO (2026-07-02): Opção A**, TTL de access = 15 min, revogação de outros devices no **login e no refresh**. (Se um dia quiser lag zero, trocar para B é trivial — basta reintroduzir o check de `sid`/`isRevoked` no `authenticate`.)

### 5.3 Arquivos
- Registrar `@fastify/jwt` em [server.ts](../../apps/api/src/server.ts); `JWT_SECRET` no `envSchema` (obrigatório) e no `.env.example`.
- [authenticate.ts](../../apps/api/src/plugins/authenticate.ts) — trocar o lookup de `Session` por `fastify.jwt.verify`; popular `request.user` a partir dos claims; manter o check `X-Device-Id` vs `deviceId` do claim (401 instantâneo). (Opção B: + lookup de `sid`.)
- Novo endpoint **`POST /auth/refresh`** — `{ refreshToken, deviceId }` → valida refresh na `Session` (não revogado, não expirado) → **rotaciona** → emite novo `{ accessToken, refreshToken }`. Rate limit próprio.
- Novo endpoint **`POST /auth/logout`** (autenticado) — revoga a `Session` (refresh) atual. Hoje não existe self-logout; passa a existir (o front hoje só limpa localStorage).

---

## 6. Backend — senha (`apps/api`)

### 6.1 Dependência
- Adicionar **`bcryptjs`** (runtime) em `apps/api` (cost 10).

### 6.2 Endpoints

| Método + rota | Estado | Descrição |
|---|---|---|
| `POST /auth/login` | **NOVO** | `{ email, password, deviceId }` → valida bcrypt → revoga outros devices → cria refresh + emite `{ accessToken, refreshToken, user }`. Resposta genérica + dummy-compare (anti-enumeração). Rate limit próprio. |
| `POST /auth/otp/send` | mantido | Reaproveitado para login-alternativo **e** reset. |
| `POST /auth/otp/verify` | **estendido** | Resposta ganha `hasPassword: boolean` e passa a devolver `{ accessToken, refreshToken, user, hasPassword }`. |
| `POST /auth/password/set` | **NOVO** (autenticado) | `{ password }`. Define senha do usuário da sessão. **Só quando `hasPassword === false`** (1º acesso: existentes, entregador, admin). |
| `POST /auth/password/reset` | **NOVO** | `{ userId, code, deviceId, newPassword }`. Atômico: verifica OTP → define nova senha → revoga outros devices → emite tokens. Fluxo "esqueci a senha". |
| `POST /auth/password/change` | **NOVO** (autenticado) | `{ currentPassword, newPassword }`. Valida `currentPassword` (bcrypt) → troca. **Troca logado** (item trazido ao escopo). |
| `POST /auth/register` | **estendido** | `RegisterSchema` ganha `password`; cria usuário já com `passwordHash` e dispara OTP de ativação. |
| `POST /auth/couriers` | mantido | Sem senha (entregador define no 1º acesso). |

### 6.3 Arquivos
- [auth.service.ts](../../apps/api/src/modules/auth/auth.service.ts) — `hashPassword`/`verifyPassword` (bcrypt); `loginWithPassword`; `setPassword`; `resetPasswordWithOtp`; `changePassword(userId, current, next)`; helper de **emissão de tokens** (access JWT + refresh) e helper de **revogação single-device** (extrair das linhas 85-91) reusado por login/reset/verify.
- [auth.controller.ts](../../apps/api/src/modules/auth/auth.controller.ts) — handlers `login`, `refresh`, `logout`, `setPassword`, `resetPassword`, `changePassword`; `hasPassword` no `verifyOtp`.
- [auth.schema.ts](../../apps/api/src/modules/auth/auth.schema.ts) — `LoginSchema`, `SetPasswordSchema`, `ResetPasswordSchema`, `ChangePasswordSchema`, `RefreshSchema`; `RegisterSchema` + `password`.
- [auth.route.ts](../../apps/api/src/modules/auth/auth.route.ts) — rotas novas + schemas Swagger; `set`/`change`/`logout` com `preHandler:[fastify.authenticate]`; **rate limit** em `/auth/login` (~10/min), `/auth/password/reset` (5/min), `/auth/refresh` (~30/min). Corrigir textos que dizem "JWT" mas hoje não são (agora passam a ser de verdade).
- [auth.repository.ts](../../apps/api/src/modules/auth/auth.repository.ts) — `updatePassword`; `findUserByEmail` trazendo `passwordHash` só para uso interno; rotação de refresh (`revokeSession` + `createSession`).
- [admin-seed.ts](../../apps/api/src/bootstrap/admin-seed.ts) — **opcional**: se `ADMIN_PASSWORD` no env, seedar `passwordHash`.

---

## 7. Shared (`packages/shared`)

[schemas/index.ts](../../packages/shared/src/schemas/index.ts) — fonte única:
- `PasswordSchema = z.string().min(8)` (+ complexidade se desejado).
- `LoginSchema`, `SetPasswordSchema`, `ResetPasswordSchema`, `ChangePasswordSchema`, `RefreshSchema`.
- Reexportar tipos em [types/index.ts](../../packages/shared/src/types/index.ts).

---

## 8. Frontend (`apps/web`)

### 8.1 Camada de sessão (JWT)
- [AuthContext.tsx](../../apps/web/src/contexts/AuthContext.tsx) — guardar `accessToken` **e** `refreshToken` (localStorage `auth_access`/`auth_refresh`); `login(access, refresh, user)`; `logout()` chama `POST /auth/logout` antes de limpar.
- [apiFetch.ts](../../apps/web/src/lib/apiFetch.ts) — anexar `Bearer accessToken`; **interceptor de 401** (NOVO): em 401, tenta `POST /auth/refresh` (com fila para evitar corrida de múltiplos 401 simultâneos), atualiza tokens, **retenta 1x**; se o refresh falhar → `logout()`. Infra nova (hoje não existe).

### 8.2 Telas
- **[LoginScreen.tsx](../../apps/web/src/pages/auth/LoginScreen.tsx)** — e-mail + senha (CTA "Entrar"). Links: **"Entrar com código"** (fluxo OTP atual) e **"Esqueci minha senha"**. Ajustar copy ("Sem senha pra decorar.").
- **`SetPasswordScreen`** (NOVA) — "defina sua senha" forçada quando `verifyOtp` retorna `hasPassword === false` → `POST /auth/password/set`.
- **`ForgotPasswordScreen`** (NOVA) — e-mail → `OtpInput` ([OtpInput.tsx](../../apps/web/src/components/auth/OtpInput.tsx)) → nova senha → `POST /auth/password/reset` → loga.
- **`ChangePasswordScreen`** (NOVA) — no perfil: senha atual + nova + confirmar → `POST /auth/password/change`. (Troca logado.)
- **[OnboardingScreen.tsx](../../apps/web/src/pages/auth/OnboardingScreen.tsx)** — adicionar campo **senha**; enviar no `POST /auth/register`.
- **Perfil** — itens "Alterar senha" (logado) e o reset via OTP. Vizinho de UX: [ContactEditScreen.tsx](../../apps/web/src/pages/client/ContactEditScreen.tsx).

### 8.3 Roteamento
- [router.tsx](../../apps/web/src/routes/router.tsx) — rotas `/forgot-password`, `/set-password`, `/change-password` (ou passos internos). Forçar set-password antes de cair no layout do papel quando `hasPassword=false`.

---

## 9. Segurança (checklist)

- [ ] `bcryptjs` cost ≥ 10; `passwordHash` **nunca** em resposta/select público.
- [ ] `JWT_SECRET` forte, obrigatório no boot; access TTL curto (15 min).
- [ ] Refresh **rotacionado** e hasheado no banco; reuse de refresh antigo → revoga a cadeia.
- [ ] `/auth/login`, `/auth/password/reset`, `/auth/refresh` com rate limit próprio; login com resposta genérica + dummy-compare.
- [ ] `set` restrito a `hasPassword===false`; `change` exige `currentPassword`; `reset` OTP-gated (timingSafe já existe).
- [ ] Login/reset revogam sessões de outros devices; `X-Device-Id` no claim → 401 instantâneo em troca de device.
- [ ] Opção A adotada: aceitar o **lag de revogação ≤15 min** (access TTL); enforcement real no login/refresh.
- [ ] Interceptor de refresh no front com fila (sem tempestade de refresh).

---

## 10. Fases sugeridas

1. **Schema + shared + bcrypt** — `passwordHash`/`passwordSetAt`, `PasswordSchema`+schemas, add `bcryptjs`, `prisma generate`.
2. **JWT — camada de sessão** — `@fastify/jwt`, `JWT_SECRET`, reescrever `authenticate.ts` (verify JWT + deviceId), `POST /auth/refresh`, `POST /auth/logout`, helper de emissão de tokens. Migrar `verifyOtp` p/ `{accessToken, refreshToken}`. **Testar 3 papéis com OTP ainda (sem senha) — não pode regredir.**
3. **Backend login por senha** — `POST /auth/login` + rate limit + anti-enumeração + testes.
4. **Backend senha** — `set`, `reset`, `change`, `hasPassword` no verify, `register`+password; testes.
5. **Front — camada de sessão** — dual token + interceptor de refresh + `logout` no servidor.
6. **Front — login por senha** — LoginScreen + link "entrar com código".
7. **Front — set-password forçado** — SetPasswordScreen no pós-OTP (`hasPassword=false`).
8. **Front — recuperação e troca** — ForgotPasswordScreen + ChangePasswordScreen no perfil.
9. **Cadastro com senha** — OnboardingScreen.
10. **Regressão completa** — 3 papéis: login por senha, OTP-alternativo, refresh/expiração, reset, troca logado, 1º acesso, single-device.

---

## 11. Fora de escopo

- 2º canal de OTP (WhatsApp) — segue o plano existente.
- Login social / biometria.
- Refresh token com armazenamento em cookie httpOnly (segue localStorage, como o resto do app).
