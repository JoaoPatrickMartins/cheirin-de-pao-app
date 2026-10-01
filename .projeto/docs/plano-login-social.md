# Plano — Entrar com Google (cadastro facilitado)

> 📝 **Status:** PLANEJADO em 30/09/2026 — nenhuma linha de código ainda. Execução direta, sem GSD
> (convenção do projeto). Tem tela nova → **Onda 1 é o design** (brief pronto em
> [`../brief-telas-login-social.md`](../brief-telas-login-social.md)).
>
> 🔁 **30/09/2026 — Facebook saiu do escopo** (D-7). O **projeto e o design do Facebook ficam
> guardados** para uso futuro: [`plano-login-social-facebook.md`](./plano-login-social-facebook.md)
> (delta sobre este plano) e as telas "Futuro — Facebook" no brief. O desenho daqui já é genérico
> por provedor, então o Facebook volta **somando**, sem refazer nada.
>
> 🟡 **Onda 0 em andamento (30/09/2026):** projeto `cheirin-de-pao` criado no Google Cloud (conta
> `cheirindepao.contato@gmail.com`), status **Teste**, escopos `openid`/`email`/`profile`, cliente
> "Cheirin de Pão — Web" com as URIs **local e prod**; credenciais no `apps/api/.env` local.
> Pendente: aceitar o convite da 2ª proprietária, rascunho das páginas legais. A troca da chave
> secreta (foi colada no chat) ficou para depois, por decisão do usuário — fazer antes de criar os
> secrets `_PROD`.
>
> ✅ **Onda 1 (design) CONCLUÍDA em 30/09/2026** — handoff em
> [`.projeto/design_handoff_login_social/`](../design_handoff_login_social/README.md), conferido
> contra este plano (§13). Ele desenha Google **e** Facebook: a parte do Facebook fica guardada para
> o [plano do Facebook](./plano-login-social-facebook.md).
>
> ✅ **Onda 2 (fundação) CONCLUÍDA em 30/09/2026 — SEM COMMIT.** Schema (`SocialProvider`,
> `SocialAccount`, `SocialLoginFlow` + `@@index([expiresAt])`), limpeza diária dos fluxos vencidos
> (`lib/social-flow-cleanup.ts` no `daily-jobs`), env no `envSchema` + `.env.example`,
> `google-auth-library@^10.9.1`, schemas em `packages/shared/src/schemas/social-auth.ts`.
> `prisma generate` + `db push` no banco de teste (`cheirin-de-pao-teste`). Verificação: typecheck
> (api + web + shared) ✅ · **1.674 testes do api + 3 todo** (+2) · **shared 82 + 4 todo** (+8).
> Divergências: D-8 e D-9 (§18).
>
> ✅ **Ondas 3–4 (backend) CONCLUÍDAS em 30/09/2026 — SEM COMMIT.** Módulo `modules/social-auth/`
> (config, adaptador Google, repository, service, controller, rotas) registrado no `server.ts`;
> `AuthService.startSession` + `mustSetPassword` em login/OTP/refresh/reset (response schemas
> incluídos); `SignupProfileSchema` compartilhado entre `RegisterSchema` e `SocialCompleteSchema`;
> `accessMethods` no detalhe do cliente (admin); `method` no evento de login (`AnalyticsEvent`).
> Smoke test local contra o banco de teste: `providers`, `start` (URL do Google com PKCE S256 e o
> `redirect_uri` cadastrado), `claim` (PENDING / segredo errado / outro aparelho), callback pelo
> proxy do Vite (cancelou → `cancelled`; `state` reusado → recusado). Verificação: typecheck (api +
> web + shared) ✅ · **1.719 testes do api + 3 todo** (+45) · shared 82 + 4 todo. Divergências D-10 a
> D-13 (§18).
> **E2E real com o Google (30/09/2026):** consentimento com uma conta de teste → callback pelo proxy
> do Vite → `claim` devolveu `NEEDS_LINK` (`jo•••@gmail.com`, `canUsePassword: true`) — troca do
> código com PKCE, `verifyIdToken` e a busca da conta existente funcionando; nada conectado antes da
> confirmação.
>
> ✅ **Ondas 5–7 (front) CONCLUÍDAS em 30/09/2026 — SEM COMMIT.** Base (`lib/socialAuth`,
> `inAppBrowser`, `finishAuth`, `flash`, `support`, captura do `?social=` no `main.tsx`,
> `needsPasswordSetup` nas 5 guardas), kit `components/auth/SocialAuthUI.tsx`, telas L1 (login),
> L2 (`RegisterChoice`), L3a/L3b/L3c/L6 (`SocialReturnScreen`), L4 (`SocialSignupStep` + roteiro Google
> no `OnboardingScreen`), L7/L8 (Minha conta + `CreatePasswordScreen`), L9 (3 páginas + hub no
> Perfil › Ajuda) e A1 (linha "Acesso" no admin). Fonte `@fontsource/roboto` (só 500 latin, 22 kB).
> Verificação: typecheck (api + web + shared) ✅ · **web 396 testes + 17 todo** (+39) · api 1.719 ·
> shared 82 · `vite build` ✅ · capturas em 390 px de L1, L2, L3a/b/c, L4, L6, L7, L8 e L9 conferidas
> contra o handoff. Divergências D-14 a D-19 (§18). **Falta a Onda 8** (UAT no celular pelo túnel +
> lançamento).
>
> ⚠️ **Documento temporário de planejamento.** Apagar quando o trabalho for mergeado.

---

## 1. Objetivo

1. O cliente pode **entrar ou criar a conta com o Google**, com um toque.
2. No primeiro acesso pelo Google, o cadastro pede **só o que o Google não entrega**: CPF,
   nascimento, celular, condomínio e endereço. Nome vem preenchido; e-mail vem verificado pelo
   Google; **sem senha e sem código**.
3. Quem já tem conta pode **conectar** o Google no Perfil e passar a entrar por ele.
4. O que já existe continua igual: e-mail + senha, código no e-mail, recuperação de senha,
   sessão única por aparelho, Indique e Ganhe e lista de espera de condomínio.

**Ganho no cadastro:** hoje são 5 passos e 11 campos + código. Pelo Google ficam **3 passos e
6 campos** (nome já vem preenchido), sem e-mail, sem senha ×2 e sem código.

---

## 2. Decisões confirmadas (30/09/2026)

| # | Tema | Decisão |
|---|---|---|
| D-1 | Provedor e perfis | **Só Google**, só para **CLIENT**. E-mail de entregador/admin num login pelo Google é recusado ("entre com e-mail e senha"). |
| D-2 | Já existe conta com o mesmo e-mail | **Pedir confirmação** antes de conectar — com a **senha da conta** ou um **código no e-mail** da conta. |
| D-4 | Senha em conta criada pelo Google | **Opcional.** O cadastro não pede senha; em Perfil › Segurança aparece **"Criar senha"**. A conta segue entrando também por código no e-mail. |
| D-5 | Privacidade e termos | **Criar no app** as páginas públicas `/privacidade`, `/termos` e `/exclusao-de-dados` (o handoff desenha as 3 — V-3). Entra um **rascunho-base marcado para revisão**; o texto final é de vocês. |
| D-6 | Escopo | **Tudo numa versão:** login, cadastro, vínculo, conta Google no Perfil, Criar senha, selo no admin, páginas legais. |
| D-7 | Facebook | **Fora por agora.** A Meta exige o perfil pessoal de uma pessoa para administrar o app, e a decisão foi seguir só com o Google. **Projeto e design guardados** para uso futuro ([plano do Facebook](./plano-login-social-facebook.md)). |

> A D-3 (confirmar o e-mail do Facebook por código) está guardada no
> [plano do Facebook](./plano-login-social-facebook.md).

### Decisões técnicas (desta análise — justificativa na §4)

| # | Decisão |
|---|---|
| T-1 | **Fluxo no servidor** (OAuth 2.0 *authorization code* + **PKCE** + `state`), genérico por provedor (`:provider` na rota, adaptador por provedor). Nenhum SDK do Google no front. |
| T-2 | O resultado fica **guardado no servidor** e o app o busca com `flowId` + **`secret`** que só o app que iniciou conhece (`POST /auth/social/claim`). Resolve o PWA do iPhone e impede injeção de login. |
| T-3 | O `User` **só nasce no fim do cadastro** (CPF é obrigatório e único). Até lá, a identidade verificada vive no registro do fluxo (`SocialLoginFlow`). |
| T-4 | O Google volta para a API, e a API devolve para a **raiz do app** (`/?social=<flowId>`), capturado no boot como o `?ref=`. Não depende de *deep link* no Nginx. |
| T-5 | `GET /auth/social/providers` diz se o Google está configurado. O botão só aparece com as credenciais no servidor — **os secrets de produção são o interruptor do lançamento**. |
| T-6 | **Não guardamos** access/refresh token do Google nem foto. Só `sub`, e-mail e nome. |
| T-7 | `hasPassword` continua verdadeiro; a guarda do "defina sua senha" passa a usar um campo novo **`mustSetPassword`** (= sem senha **e** sem conta social). |

---

## 3. Levantamento — o que existe hoje

- **Cadastro** — [OnboardingScreen.tsx](../../apps/web/src/pages/auth/OnboardingScreen.tsx) (1.103 linhas),
  5 passos: *Seus dados* (nome, CPF, nascimento + código de indicação) → *Como falamos com você?*
  (e-mail, celular, senha, confirmação) → *Onde você mora?* (busca + lista de espera) → *Seu
  endereço* (bloco, complemento, apto) → *Confirme seu cadastro* (OTP). `POST /auth/register` cria o
  `User` **antes** do OTP; `POST /auth/otp/verify` emite os tokens e chama `markReferralVerified`.
- **Login** — [LoginScreen.tsx](../../apps/web/src/pages/auth/LoginScreen.tsx): e-mail + senha
  (`/auth/login`) ou código no e-mail (`/auth/otp/send` + `/verify`). `finishAuth` guarda a sessão,
  hidrata `/client/profile` e navega por papel.
- **Sessão** — JWT de 15 min + refresh opaco de 90 dias na `Session`; revoga outros aparelhos no
  login (exceto ADMIN) — [auth.service.ts](../../apps/api/src/modules/auth/auth.service.ts). Bloqueio
  checado em todo caminho que emite token (`BLOCKED_ERROR`).
- **`User`** — [schema.prisma:276](../../apps/api/prisma/schema.prisma#L276): `cpf` **obrigatório e
  `@unique`**, `name` obrigatório, `email` e `phone` `@unique` opcionais, `passwordHash` opcional.
  Nenhuma identidade externa.
- **Senha obrigatória** (plano de auth de 02/07/2026): `hasPassword === false` força
  `/set-password` em [roleRoutes.ts](../../apps/web/src/lib/roleRoutes.ts),
  [ClientLayout.tsx:117](../../apps/web/src/pages/client/ClientLayout.tsx#L117),
  [CourierLayout.tsx:16](../../apps/web/src/pages/courier/CourierLayout.tsx#L16),
  [AdminLayout.tsx:74](../../apps/web/src/pages/admin/AdminLayout.tsx#L74),
  [SetPasswordScreen.tsx:37](../../apps/web/src/pages/auth/SetPasswordScreen.tsx#L37) e no
  `finishAuth` do login. **Uma conta do Google cairia nessa tela** — por isso a T-7.
- **`POST /auth/password/set`** já só aceita conta **sem** senha → serve pronto para o "Criar senha".
- **Indique e Ganhe** — o `?ref=` é guardado no `localStorage` por 30 dias
  ([main.tsx](../../apps/web/src/main.tsx) → `captureReferralFromUrl`), então **sobrevive** ao desvio
  pelo Google. `attachReferralAtSignup` no cadastro, `markReferralVerified` no 1º login.
- **Infra** — front e API em domínios diferentes, **confirmados em produção em 30/09/2026**:
  `https://app.cheirindepao.com.br` (o bundle aponta para `https://api.cheirindepao.com.br`,
  `/health` ok), mesmo VPS. O `try_files` do README **não está versionado** no repo, mas em produção
  *deep link* funciona (`/login` → 200); a T-4 fica mesmo assim, por não depender dessa config. O SW
  só faz *precache*, não intercepta navegação. Em dev, o Vite faz proxy de `/api` → `:3001`.
- **Ambientes:** só **local** e **produção**. Os blocos `_DEV` do `mainBackend.yml`/`mainFrontend.yml`
  nunca rodam (o build só dispara na `main`).
- **Não existe:** nenhuma referência a login social (código ou protótipo), página de política de
  privacidade ou de termos.

---

## 4. Por que este desenho (análise)

### 4.1 Onde o login com Google esbarra
1. **CPF obrigatório** → não dá para criar o `User` só com o Google. A conta nasce no fim (T-3).
2. **Senha obrigatória** → a guarda de `hasPassword` jogaria a conta do Google no "defina sua senha" (T-7).
3. **PWA instalado no iPhone** → ao abrir o Google, o iOS usa uma janela do Safari **com
   armazenamento separado** do app. Um redirect comum com o token na URL deixaria a pessoa logada
   *nessa janela*, e o app instalado continuaria deslogado. Com o resultado guardado no servidor
   (T-2), o app instalado busca o resultado quando volta para a tela; a janela do Safari só mostra
   "Pronto! Pode voltar ao app".
4. **Navegador dentro de app** (Instagram, Facebook) → o Google **bloqueia** login em *webview*
   (`disallowed_useragent`). O front detecta esses navegadores e mostra um aviso no lugar do botão.

### 4.2 Alternativas descartadas
| Alternativa | Por que não |
|---|---|
| SDK no front (Google Identity Services, *popup*/One Tap) | *Popup* é instável no PWA do iPhone e em navegador de app; SDK de terceiro no bundle. |
| Redirect com token na URL de volta | Quebra no PWA do iPhone (armazenamento separado) e expõe token em histórico/log. |
| Criar `User` provisório sem CPF | Exigiria afrouxar `cpf` obrigatório/único no schema e tratar contas pela metade em todo o sistema. |
| Vincular automático pelo e-mail | Descartado pela D-2. |

---

## 5. Jornadas

```
[Login ou Cadastro] ── toque "Continuar com o Google"
      │  POST /auth/social/google/start  → { flowId, secret, authUrl }  (guarda flowId+secret)
      ▼
[Google]  (escolher a conta)
      │  GET  api/auth/social/google/callback?code&state
      │       troca o code (PKCE) · lê a identidade · decide o desfecho · grava no fluxo
      ▼  302 → app/?social=<flowId>
[Retorno]  POST /auth/social/claim { flowId, secret, deviceId }
      ├─ LOGGED_IN    → entra no app (igual ao login de hoje)
      ├─ NEEDS_SIGNUP → "Quase lá" (3 passos) → POST /auth/social/complete → entra
      ├─ NEEDS_LINK   → "Encontramos sua conta" → senha ou código → conecta e entra
      ├─ LINKED       → (Perfil) "Google conectado"
      └─ ERROR        → cancelou · bloqueada · conta de entregador/admin · e-mail não verificado ·
                        expirou · já ligada a outro cadastro
```

### 5.1 Regras de decisão no callback (`intent = login`)
1. Google devolveu erro (`access_denied`) → `ERROR: cancelled`.
2. Já existe `SocialAccount(GOOGLE, sub)` → dono é CLIENT? `LOGIN`. Senão `ERROR: not_client`.
3. `email_verified: false` (raro no Google) → `ERROR: email_unverified` ("use o cadastro com e-mail").
4. E-mail verificado:
   - existe `User` com esse e-mail e é CLIENT → `LINK_REQUIRED` (D-2);
   - existe e é COURIER/ADMIN → `ERROR: not_client`;
   - não existe → `SIGNUP`.

Bloqueio (`isBlocked`) é checado **na emissão do token** (claim/complete/link), como nos outros caminhos.

### 5.2 Conectar no Perfil (`intent = link`, logado)
`start` exige Bearer e grava `linkUserId`. No callback: se esse Google já é de **outra** conta →
`ERROR: already_linked`; se o cliente já tem **outro** Google conectado → `ERROR: provider_taken`;
senão cria a `SocialAccount` → `LINKED`. Não pede confirmação: a pessoa já está logada. O e-mail do
Google **pode ser diferente** do e-mail da conta — o vínculo é pelo `sub`.

### 5.3 Desconectar
`DELETE /auth/social/google`. Sempre permitido: a conta tem e-mail, então o **código no e-mail**
continua funcionando mesmo sem senha. A tela avisa isso.

### 5.4 Retorno — quem busca o resultado
- No `start`, o front grava `{ flowId, secret, provider, intent, displayMode, createdAt }` em
  `localStorage` (`cdp_social_flow`).
- Ao voltar (`/?social=<flowId>`), a tela de retorno **só chama o `claim` se o `display-mode`
  atual for o mesmo do início** (`standalone` × `browser`) **e** o `flowId` bater. Caso contrário,
  mostra "Pronto! Pode voltar ao app Cheirin de Pão".
- O app instalado escuta `visibilitychange`/`focus` enquanto houver `cdp_social_flow` pendente e
  faz o `claim` (com *polling* de 2 s por até 3 min enquanto a tela "Conectando…" está aberta).
- O `claim` devolve `PENDING` enquanto o callback não chegou. Resultado de login é **entregue uma
  vez** (fluxo vira `CONSUMED`).

### 5.5 Cadastro pelo Google ("Quase lá")
| Passo | Campos | Origem |
|---|---|---|
| 1 · Quase lá | **Nome** (preenchido, editável) · e-mail **travado** com selo do Google · **CPF** · **Nascimento** · **Celular** · código de indicação (como hoje) | Google + cliente |
| 2 · Onde você mora? | busca de condomínio + lista de espera | igual hoje |
| 3 · Seu endereço | bloco, complemento, apto → **"Criar conta"** | igual hoje |

- Sem senha (D-4) e sem OTP (o e-mail já foi verificado pelo Google).
- Conflitos no envio: **CPF já cadastrado** → "Esse CPF já tem uma conta" + "Entrar na minha conta";
  **celular já cadastrado** → mensagem no campo. (Quem tem conta com outro e-mail entra nela e
  conecta o Google pelo Perfil.)
- Lista de espera: o contato vem preenchido com o e-mail do Google.
- Fluxo expirou (60 min) → "Sua sessão com o Google expirou" + botão para refazer (os campos
  digitados ficam na memória da tela).

---

## 6. Modelo de dados (Prisma / MongoDB)

[schema.prisma](../../apps/api/prisma/schema.prisma) — coleções novas; `User` **não muda**.

```prisma
// Só GOOGLE por enquanto. Outro provedor (ex.: FACEBOOK) entra somando um valor aqui.
enum SocialProvider {
  GOOGLE
}

// Identidade externa ligada a um cliente. A chave é o id do provedor (Google `sub`) —
// NUNCA o e-mail, que pode mudar dos dois lados.
model SocialAccount {
  id             String         @id @default(auto()) @map("_id") @db.ObjectId
  userId         String         @db.ObjectId
  provider       SocialProvider
  providerUserId String
  // E-mail informado pelo provedor no momento do vínculo — só auditoria/exibição.
  email          String?
  linkedAt       DateTime       @default(now())
  lastLoginAt    DateTime?

  @@unique([provider, providerUserId]) // um Google só pode estar em uma conta
  @@unique([userId, provider])         // uma conta tem no máximo 1 Google
}

// Fluxo de login social em andamento (efêmero, TTL de 60 min). Guarda o que o navegador
// não pode ver (PKCE) e o resultado até o app buscá-lo com o segredo.
model SocialLoginFlow {
  id                 String         @id @default(auto()) @map("_id") @db.ObjectId
  provider           SocialProvider
  intent             String         // 'login' | 'link'
  stateHash          String         @unique
  codeVerifier       String         // PKCE — nunca sai do servidor
  secretHash         String         // SHA-256 do segredo entregue ao app que iniciou
  deviceId           String
  linkUserId         String?        @db.ObjectId // intent=link: quem está logado
  status             String         // PENDING | RESOLVED | CONSUMED | ERROR
  outcome            String?        // LOGIN | SIGNUP | LINK_REQUIRED | LINKED
  errorCode          String?        // cancelled | not_client | blocked | email_unverified | expired | already_linked | provider_taken | provider_error
  providerUserId     String?
  providerEmail      String?
  emailVerified      Boolean?       // Google: `email_verified`; (futuro) Facebook: só após o nosso código
  name               String?
  matchedUserId      String?        @db.ObjectId // conta existente com o mesmo e-mail
  // Código de e-mail do próprio fluxo. Agora: confirmação do vínculo (D-2), sempre para o e-mail
  // da conta encontrada. Nomes genéricos de propósito: o Facebook reusa para confirmar o e-mail.
  codeHash           String?
  codeTarget         String?        // e-mail para onde o código foi
  codeExpiresAt      DateTime?
  attempts           Int?           // senha ou código, somados
  expiresAt          DateTime
  createdAt          DateTime       @default(now())
}
```

- **Validade:** o código **sempre** confere `expiresAt`; os vencidos são apagados no cron diário
  ([social-flow-cleanup.ts](../../apps/api/src/lib/social-flow-cleanup.ts)), com
  `@@index([expiresAt])` no schema. **Sem índice TTL** — ver D-8 (§18).
- Índices `@@unique` compostos são seguros: os dois campos sempre existem (não é o caso do
  `referralCode`, que precisou de índice parcial).
- **`db push`** no banco de teste (`cheirin-de-pao-teste` — conferir o alvo antes), sem
  `--accept-data-loss`. Produção: o deploy do backend já roda.

---

## 7. Backend (`apps/api`)

### 7.1 Configuração
Novas variáveis no `envSchema` de [server.ts](../../apps/api/src/server.ts) — **todas opcionais**
(a API sobe sem elas; o Google só liga quando o par está completo), no
[.env.example](../../apps/api/.env.example) e no bloco de **produção** do `mainBackend.yml`
(secrets `_PROD`):

| Variável | Uso |
|---|---|
| `API_PUBLIC_URL` | Base pública da API para montar o `redirect_uri` (prod `https://api.cheirindepao.com.br`; local `http://localhost:5173/api`, via proxy do Vite; celular `https://<túnel>/api`). |
| `APP_PUBLIC_URL` | Para onde a API devolve no fim (prod `https://app.cheirindepao.com.br`; local `http://localhost:5173`; celular `https://<túnel>`). Padrão: `CORS_ORIGIN`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Cliente OAuth "Aplicativo da Web" do Google Cloud. |

Dependência nova: **`google-auth-library@^10.9.1`** (troca do código e `verifyIdToken`). Presa na
faixa 10: a 11 exige Node 22 e a API roda em Node 20 (D-9).

### 7.2 Adaptador do provedor — `src/modules/social-auth/providers/`
Interface comum (para outro provedor entrar depois): `buildAuthUrl({ state, codeChallenge,
redirectUri })` e `exchange({ code, codeVerifier, redirectUri }) → { providerUserId, email?,
emailVerified, name }`.

- **`google.ts`** — `accounts.google.com/o/oauth2/v2/auth` com `scope=openid email profile`,
  `prompt=select_account`, PKCE S256. Troca em `oauth2.googleapis.com/token`; valida o `id_token`
  (`aud` = client id, `iss`, `exp`) e usa `sub`, `email`, `email_verified`, `name`.
- Nenhum token do Google é persistido (T-6).

### 7.3 Endpoints — módulo novo `social-auth` (registrado em `server.ts`)

`:provider` aceita só `google` por enquanto (`SocialProviderSchema`).

| Método + rota | Auth | Corpo → resposta |
|---|---|---|
| `GET /auth/social/providers` | pública | `{ google: boolean }` |
| `POST /auth/social/:provider/start` | pública (`login`) · Bearer (`link`) | `{ intent, deviceId }` → `{ flowId, secret, authUrl }` |
| `GET /auth/social/:provider/callback` | pública (navegação do Google) | `code`, `state` → resolve (§5.1/§5.2) → **302** `APP_PUBLIC_URL/?social=<flowId>` |
| `POST /auth/social/claim` | pública | `{ flowId, secret, deviceId }` → `{ status, … }` (abaixo) |
| `POST /auth/social/link/code` | pública | `{ flowId, secret }` — manda o código para o e-mail **da conta encontrada** |
| `POST /auth/social/link/code/verify` | pública | `{ flowId, secret, deviceId, code }` → `LOGGED_IN` |
| `POST /auth/social/link/password` | pública | `{ flowId, secret, deviceId, password }` → `LOGGED_IN` |
| `POST /auth/social/complete` | pública | `{ flowId, secret, deviceId, name, cpf, birthDate, phone, condominiumId, apartment, block?, complement?, referralCode?, referralSource? }` → `LOGGED_IN` |
| `GET /auth/social/accounts` | Bearer (CLIENT) | `[{ provider, email, linkedAt }]` |
| `DELETE /auth/social/:provider` | Bearer (CLIENT) | `{ ok: true }` |

**Respostas do `claim`** (e dos passos seguintes):
- `PENDING` — callback ainda não chegou.
- `LOGGED_IN` — `{ accessToken, refreshToken, hasPassword, mustSetPassword, user }` (mesmo formato do `/auth/login`).
- `NEEDS_SIGNUP` — `{ prefill: { name, email, provider } }`.
- `NEEDS_LINK` — `{ maskedEmail, canUsePassword }` (conta sem senha → só código).
- `LINKED` — `{ provider }`.
- `ERROR` — `{ code }`.

⚠️ **Response schema do Fastify:** todo campo novo (`status`, `mustSetPassword`, `prefill`…) tem que
estar declarado no `response` da rota, senão o Fastify **descarta** o campo em silêncio.

### 7.4 Regras de cada passo
- **start:** gera `state` e `secret` (32 bytes, guarda só o hash), `code_verifier` (PKCE), `expiresAt`
  = +60 min. `redirect_uri` vem **só** do env.
- **callback:** acha o fluxo por `hash(state)`; recusa desconhecido/expirado/já usado. Nunca devolve
  erro técnico na tela: vai para `/?social=<flowId>` e o erro sai no `claim`. Sem fluxo válido →
  `/?social_error=expired`.
- **claim:** compara `hash(secret)` com `timingSafeEqual`, exige o mesmo `deviceId` do `start`.
  `LOGIN` → checa bloqueio → `revokeOtherDevices` → `issueTokens` → `lastLoginAt` →
  `markReferralVerified` → `CONSUMED`.
- **link/code:** código de 4 dígitos (`generateOtpCode` + `sendEmailOtp` do
  [otp.service.ts](../../apps/api/src/modules/auth/otp.service.ts) — mesmo e-mail de hoje), hash no
  fluxo, 10 min. Destino **sempre o e-mail da conta encontrada** (o cliente não escolhe). Em
  `NODE_ENV=development` aceita o `OTP_DEV_CODE`, como o OTP atual.
- **link/password:** `verifyPassword` contra a conta encontrada; errou → 401 genérico.
- **Tentativas do vínculo:** senha + código somam **no máximo 5** (`attempts`); depois `ERROR: expired`
  ("comece de novo"). Sucesso → cria a `SocialAccount` → mesmo final do `claim` (`LOGIN`).
- **complete:** só com o desfecho `SIGNUP`. Valida com `SocialCompleteSchema` (§8). Reconfere
  e-mail/CPF/celular únicos (409 com a mesma mensagem do `register`). Cria **`User` (sem
  `passwordHash`, `creditMilli: 0`) + `SocialAccount` numa transação** (reusar
  [tx-retry.ts](../../apps/api/src/lib/tx-retry.ts)); índice único estourou por corrida → 409.
  `attachReferralAtSignup` (best-effort, como no `register`) → `issueTokens` →
  `markReferralVerified` → `CONSUMED`.
- **unlink:** remove a `SocialAccount` do cliente logado.

### 7.5 `mustSetPassword` (T-7) — mexe no auth atual
- `AuthTokens` ganha `mustSetPassword = !passwordHash && contasSociais === 0`.
- `issueTokens` recebe esse valor; `findUserAuthInfo` passa a trazer a contagem de `SocialAccount`
  (1 `count` a mais por login/refresh).
- Vale em **todos** os caminhos: `/auth/login`, `/auth/otp/verify`, `/auth/refresh`,
  `/auth/password/reset` e os sociais. Adicionar ao `response` das 4 rotas antigas
  ([auth.route.ts](../../apps/api/src/modules/auth/auth.route.ts)).
- `/auth/password/set` **não muda** (já é "só sem senha") — atende o "Criar senha".
- Login por senha de conta só Google: continua o 401 genérico (anti-enumeração).

### 7.6 Admin e métrica
- Detalhe do cliente (card Cadastro): linha **"Acesso"** com `Google` / `E-mail e senha`. O detalhe
  do `admin-clients` passa a devolver `socialProviders: 'GOOGLE'[]` (declarar no response schema).
- Evento de login (`AnalyticsEvent`): campo opcional **`method`** (`password | otp | google`) no
  `TrackEventSchema` e no `trackLogin`. Só captura; relatório por método fica fora (§17).

### 7.7 Rate limit
`start` 10/min · `claim` 60/min (polling) · `link/code` 5/min · `link/code/verify` 5/min ·
`link/password` 10/min · `complete` 10/min · `callback` 30/min. (IP real já tratado — `trustProxy`.)

---

## 8. Shared (`packages/shared`)

Em [schemas/index.ts](../../packages/shared/src/schemas/index.ts):
- `SocialProviderSchema = z.enum(['google'])` (rota em minúsculas, enum do banco em maiúsculas).
- `SocialStartSchema`, `SocialClaimSchema`, `SocialLinkCodeSchema`, `SocialLinkCodeVerifySchema`,
  `SocialLinkPasswordSchema`.
- **`SocialCompleteSchema`** = o `RegisterSchema` **sem** `email` e `password`, **com** `flowId`,
  `secret`, `deviceId` e `birthDate` **obrigatório** (como a rota de cadastro já exige). Extrair os
  campos comuns para um `SignupProfileSchema` usado pelos dois, para não divergirem.
- Tipos em [types/index.ts](../../packages/shared/src/types/index.ts).

---

## 9. Frontend (`apps/web`)

### 9.1 Infra
- **`lib/socialAuth.ts`** (novo) — `fetchProviders()` (cache em memória), `startSocial(provider,
  intent)` (chama `start`, grava `cdp_social_flow`, `window.location.assign(authUrl)`),
  `readPendingFlow()`, `clearPendingFlow()`, `claim()`, `currentDisplayMode()`. Todo `localStorage`
  em try/catch (padrão do projeto).
- **`lib/inAppBrowser.ts`** (novo) — detecta navegador de app (`FBAN|FBAV|FB_IAB|Instagram|…`).
- **Captura do retorno** em [main.tsx](../../apps/web/src/main.tsx), ao lado de
  `captureReferralFromUrl`: lê `?social=`/`?social_error=`, limpa a URL (`history.replaceState`) e
  deixa a rota `/entrar/social` assumir.
- **`lib/finishAuth.ts`** (novo) — extrair o `finishAuth` do [LoginScreen.tsx](../../apps/web/src/pages/auth/LoginScreen.tsx)
  (guardar sessão → hidratar perfil → navegar) para Login, Cadastro e Google usarem o mesmo.
- **Guardas** — `needsPasswordSetup(user) = user.mustSetPassword ?? (user.hasPassword === false)` em
  [roleRoutes.ts](../../apps/web/src/lib/roleRoutes.ts). O `?? hasPassword` mantém sessões antigas
  gravadas no aparelho funcionando. Trocar nos 6 pontos listados na §3. `AuthUser` ganha
  `mustSetPassword?: boolean`.

### 9.2 Telas (o visual final vem do handoff — Onda 1)

| Tela | Rota | Tipo |
|---|---|---|
| Botão "Continuar com o Google" + "ou com e-mail" + aviso de navegador de app + linha de consentimento | `/login` | modifica [LoginScreen.tsx](../../apps/web/src/pages/auth/LoginScreen.tsx) |
| Entrada do cadastro: "Como você quer criar sua conta?" (Google / e-mail), com o selo de indicação | `/register` (passo novo antes do 1º) | modifica [OnboardingScreen.tsx](../../apps/web/src/pages/auth/OnboardingScreen.tsx) |
| Retorno: conectando · "pode voltar ao app" · erros | `/entrar/social` (pública, **fora** da guarda de logado) | nova `SocialReturnScreen` |
| Encontramos sua conta (senha ou código) | passo da `SocialReturnScreen` (reusa `OtpInput`/`ResendTimer`) | nova |
| Cadastro "Quase lá" → condomínio → endereço | `/register?modo=google` | `OnboardingScreen` no modo Google |
| Conta Google (conectar/desconectar) | Perfil › Minha conta | modifica [AccountScreen.tsx](../../apps/web/src/pages/client/AccountScreen.tsx) |
| Segurança sem senha + "Criar senha" | seção Segurança + `/change-password` em modo criar | modifica `AccountScreen` e [ChangePasswordScreen.tsx](../../apps/web/src/pages/auth/ChangePasswordScreen.tsx) |
| Linha "Acesso" | admin › detalhe do cliente › card Cadastro | modifica tela do admin |
| Privacidade · Termos · Exclusão de dados | `/privacidade`, `/termos`, `/exclusao-de-dados` (públicas) | novas `LegalPage` |
| Privacidade e termos (hub) | Perfil › Ajuda › `/client/perfil/privacidade` | nova `LegalHub` (lista as 3 páginas) |

### 9.3 `OnboardingScreen` com dois roteiros
Hoje os passos são índices fixos (`step === 0..4`, `TOTAL_STEPS = 5`). Trocar por **lista de passos**
por modo:
- e-mail: `['dados', 'contato', 'condominio', 'endereco', 'codigo']` (igual hoje);
- Google: `['quase-la', 'condominio', 'endereco']` → envia `POST /auth/social/complete`.

`StepDots` usa o tamanho da lista. Antes, extrair `FieldRow`, `SelectRow`, `PrimaryBtn`, `ErrorText`
e os formatadores (CPF, data, telefone, blocos) para `components/auth/signupFields.tsx` e
`lib/signupFormat.ts` — o arquivo tem 1.103 linhas e vai crescer. Passos `condominio` e `endereco`
ficam idênticos nos dois modos.

### 9.4 Páginas legais (D-5)
Componente `LegalPage` (título + seções de texto, voltar), conteúdo em `content/legal/*.ts`. O
**rascunho** cobre, no mínimo: dados coletados (cadastro, endereço, entregas, pagamentos, dados do
Google: id, nome, e-mail), finalidade, compartilhamento (Mercado Pago, Stripe, OneSignal, Resend,
Google), retenção, direitos LGPD e o contato do encarregado; a página de exclusão traz os 3 passos
do handoff + botão do WhatsApp (prazo placeholder: 15 dias) — **marcado "RASCUNHO — revisar com o jurídico"** até vocês aprovarem. Links
nas telas de login/cadastro ("Ao continuar, você concorda com os Termos e a Política de
Privacidade") e no Perfil › Ajuda.

---

## 10. Configuração externa (fora do código — com vocês)

### 10.1 Google Cloud Console
Conta dona: **`cheirindepao.contato@gmail.com`** (da empresa), com uma segunda pessoa como
proprietária do projeto.

1. Criar o projeto → **Google Auth Platform**: público **Externo**, nome "Cheirin de Pão", e-mail de
   suporte, domínio `cheirindepao.com.br` autorizado, escopos `openid`, `email`, `profile` (não
   sensíveis → sem auditoria de escopo). **Logo e links de privacidade/termos só depois** das
   páginas no ar.
2. **Clientes → Aplicativo da Web**. URIs de redirecionamento:
   - `http://localhost:5173/api/auth/social/google/callback` (local, no computador);
   - `https://api.cheirindepao.com.br/auth/social/google/callback` (prod — cadastrar já não liga
     nada: sem os secrets de prod o botão não aparece);
   - `https://<túnel>/api/auth/social/google/callback` (teste no celular — §10.3, na Onda 8).
3. Enquanto testa: status **Teste** + usuários de teste. No lançamento: **Em produção**. Com logo
   na tela de consentimento, o Google faz a **verificação da marca** (alguns dias; pede o domínio
   verificado no Search Console).

### 10.2 Deploy
- ✅ **Workflow pronto (30/09/2026):** o [mainBackend.yml](../../.github/workflows/mainBackend.yml) já
  escreve `API_PUBLIC_URL`, `APP_PUBLIC_URL`, `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no `.env` da
  API (blocos DEV e PROD, como as outras variáveis). Secret que não existe vira linha vazia → Google
  desligado.
- Secrets a criar no GitHub **no lançamento**: `API_PUBLIC_URL_PROD` (`https://api.cheirindepao.com.br`),
  `GOOGLE_CLIENT_ID_PROD`, `GOOGLE_CLIENT_SECRET_PROD`. ✅ `APP_PUBLIC_URL_PROD` =
  `https://app.cheirindepao.com.br` **já criado** (30/09/2026) — sozinho não liga nada.
- **Os secrets são o interruptor do lançamento** (T-5): o código pode ir para produção antes, e o
  botão só aparece quando os secrets entram. Criar na hora de lançar.
- Front: **nada** (o provedor vem de `/auth/social/providers`).

### 10.3 Teste no celular sem ambiente DEV — túnel HTTPS
`localhost` só funciona no computador, e o Google recusa IP de rede local. Para testar no celular
(inclusive **instalar o PWA no iPhone**, que exige HTTPS), expor o Vite local por um túnel:
- **ngrok** com o domínio estático gratuito (endereço fixo → cadastra uma vez no Google):
  `ngrok http --url=<nome>.ngrok-free.app 5173`. No plano gratuito o ngrok mostra uma página de
  aviso na 1ª visita de cada navegador — clicar "Visit Site" uma vez em cada contexto (Safari e PWA).
- Alternativa sem aviso: túnel nomeado da Cloudflare num subdomínio próprio
  (ex.: `teste.cheirindepao.com.br`), se o DNS do domínio estiver na Cloudflare.
- No `apps/api/.env`, trocar `API_PUBLIC_URL`/`APP_PUBLIC_URL` para o endereço do túnel enquanto testa.
- No [vite.config.ts](../../apps/web/vite.config.ts), liberar o host do túnel em
  `server.allowedHosts` (o Vite bloqueia host desconhecido) — só afeta `vite dev`.
- Google em **Teste** limita o acesso aos usuários de teste cadastrados.

---

## 11. Segurança (checklist)

- [ ] `state` aleatório, guardado em hash, uso único, amarrado ao fluxo; callback recusa desconhecido/expirado/usado.
- [ ] **PKCE S256**; `code_verifier` nunca sai do servidor.
- [ ] `redirect_uri` e destino final **só do env** (sem *open redirect*); na URL de volta vai **só o `flowId`**.
- [ ] `claim` exige `secret` (timing-safe) + mesmo `deviceId`; token de login entregue **uma vez** (`CONSUMED`).
- [ ] `id_token` validado (`aud`, `iss`, `exp`); identidade = `sub`, nunca o e-mail; `email_verified: false` recusado.
- [ ] Vínculo com conta existente só com senha ou código (D-2); código sempre para o e-mail **da conta**.
- [ ] Só CLIENT; bloqueio checado em toda emissão de token; `revokeOtherDevices` como nos outros logins.
- [ ] Fluxo expira em 60 min; código em 10 min; vínculo com no máximo 5 tentativas.
- [ ] Rate limit em todas as rotas novas (§7.7).
- [ ] Sem token do Google e sem foto no banco (T-6); logs sem `code`, `secret`, `state` ou token.
- [ ] `mustSetPassword` e demais campos novos declarados nos response schemas.

---

## 12. Ondas de implementação

| Onda | Conteúdo | Depende de |
|---|---|---|
| **0 — Pré-requisitos externos** (em paralelo) | Projeto Google (em Teste) com as URIs **local e prod**; credenciais no `apps/api/.env`; rascunho das páginas legais para revisão. Secrets de prod **ainda não**. | — |
| **1 — Design** | Colar o [brief](../brief-telas-login-social.md) no Claude Design → handoff em `.projeto/handoff-login-social.md` + jsx em `.projeto/design_handoff_cheirin_pao/app/` → conferir contra este plano e registrar aqui o que mudou. | — |
| **2 — Fundação** ✅ | Schema (`SocialProvider`, `SocialAccount`, `SocialLoginFlow`), limpeza diária no cron, env, `google-auth-library`, schemas no shared, `prisma generate` + `db push` no banco de teste. | — |
| **3 — Backend: fluxo** ✅ | Adaptador Google, `providers`, `start`, `connect`, `callback`, `claim`, regras da §5.1/§5.2 + testes. | 2 |
| **4 — Backend: cadastro e vínculo** ✅ | `link/code`, `link/code/verify`, `link/password`, `complete`, `accounts`, `DELETE`; `mustSetPassword` em todos os caminhos + response schemas; `accessMethods` no admin; `method` no evento de login + testes. | 3 |
| **5 — Front: base** ✅ | `socialAuth`, `inAppBrowser`, captura do `?social=`, `finishAuth` extraído, `needsPasswordSetup` nas guardas, `SocialReturnScreen` (claim, polling, "volte ao app", erros). | 3 |
| **6 — Front: telas** ✅ | Botão no login, entrada do cadastro, `OnboardingScreen` em dois roteiros (extração antes), vínculo, conta Google no Perfil, Criar senha, linha "Acesso" no admin — **seguindo o handoff**. | 1, 4, 5 |
| **7 — Páginas legais** ✅ | `LegalPage` + 3 rotas + `LegalHub` no Perfil + links nas telas. | 1 |
| **8 — Verificação** | typecheck (api + web + shared), testes, E2E real com o Google no local e no celular pelo túnel (§10.3), UAT (§15). Lançamento: Google "Em produção" + secrets `_PROD` no GitHub. | todas |

---

## 13. Etapa de design (Onda 1) ✅

Brief: [`.projeto/brief-telas-login-social.md`](../brief-telas-login-social.md). **Handoff entregue em
30/09/2026:** [`.projeto/design_handoff_login_social/`](../design_handoff_login_social/README.md)
(`README.md` = especificação; `design/Login Social - Telas.html` = quadro com todos os estados;
`design/app/screens-social-auth*.jsx` = telas; `screenshots/` = um PNG por grupo).

Regra de handoff (convenção do projeto): o que é **novo** segue o handoff por inteiro; mudanças do
handoff em telas **existentes** só entram se forem só de front, sem mudar funcionalidade.
O botão do Google segue as **diretrizes de marca do Google** (logo oficial, cores e textos
permitidos) — é a única exceção ao sistema visual do app.

### 13.1 Conferência do handoff contra o plano

| # | Handoff | Decisão na implementação |
|---|---|---|
| V-1 | Desenha **Google e Facebook** juntos (`SOCIAL_PROVIDERS` com os dois). | Implementar **só o Google**. Tudo o que é do Facebook (`FacebookF`, L5, linha do Facebook no L7, pill no A1, textos que citam o Facebook) fica para o [plano do Facebook](./plano-login-social-facebook.md). Ex.: o texto do erro `cancel` perde "com o Facebook". |
| V-2 | L8 "Criar senha": critérios **8+ caracteres · letras e números · iguais**. | **Regra real** do app (`passwordIssues`/`PasswordCriteria`: 8–72, minúscula, maiúscula, número) com o visual do L8 + "as duas iguais". Senão a tela aceitaria senha que a API recusa. |
| V-3 | L9 com **3 páginas** (Privacidade, Termos, Exclusão) + `LegalHub` no Perfil › Ajuda. | Implementar as 3 e o hub (D-5 volta ao original). A de exclusão já fica pronta para a Meta. |
| V-4 | L3c não tem os erros `email_unverified` e `provider_taken`. | Mesmo padrão do L3c, com dois itens novos: **`email`** — ícone `mail`, tom gold, "Esse e-mail do Google ainda não foi confirmado." / "Confirme o e-mail na sua conta Google ou crie a conta com seu e-mail — leva 1 minuto." / CTA **Criar com e-mail** · Voltar ao login. **`other`** — ícone `link`, tom gold, "Você já tem uma conta Google conectada." / "Para trocar, desconecte a atual em Minha conta e conecte a nova." / CTA **Voltar para Minha conta**. |
| V-5 | Resultados `ok_login`, `new_user`, `link_required`, `cancelled`, `blocked`, `role_not_allowed`, `expired`, `provider_error`, `already_linked`. | Backend mantém os nomes do plano (§7.3). O front mapeia para as telas: `LOGGED_IN`→Home · `NEEDS_SIGNUP`→L4 · `NEEDS_LINK`→L6 · `cancelled`→`cancel` · `blocked` · `not_client`→`role` · `expired` · `provider_error`→`provider` · `already_linked`→`taken` · `email_unverified`→`email` · `provider_taken`→`other`. |
| V-6 | Cancelar/falha: "L1 com aviso **ou** L3c `cancel`". | **Cancelou** ou **falha do Google** a partir do L1/L2 → volta para a tela de origem com o aviso (`errCancel`/`errFail`). Os demais erros (e origem desconhecida) → L3c. |
| V-7 | Botão do Google em **Roboto Medium** (carregada do Google Fonts no protótipo). | O app hospeda as fontes pelo `@fontsource` → nova dependência **`@fontsource/roboto`**, só o peso **500** (latin), usada só no botão. |
| V-8 | A1 pode mostrar "Código no e-mail". | Não mostrar — todo cliente tem. Pills: **Google** e **E-mail e senha**. |
| V-9 | Modelo sugerido `SocialIdentity { clienteId, … }`. | Fica `SocialAccount { userId, … }` (§6). Sem impacto nas telas. |
| V-10 | L3a com botão **Cancelar**. | Só front: limpa o `cdp_social_flow` e volta à origem; o fluxo no servidor expira sozinho. |
| V-11 | "Instalar e criar conta" leva ao L2. | Já é o comportamento do app (`/register` como fallback do CTA da splash) — sem mudança. |
| V-12 | "Esqueci minha senha" e "Trocar" não desenhados. | Fluxos existentes, sem mudança. |

---

## 14. Testes

**API (Vitest, padrão de [auth.service.test.ts](../../apps/api/src/__tests__/auth.service.test.ts) com prisma mockado):**
- decisão do callback: vinculado → `LOGIN`; e-mail verificado sem conta → `SIGNUP`; e-mail de
  CLIENT → `LINK_REQUIRED`; e-mail de COURIER/ADMIN → `not_client`; `email_verified: false` →
  `email_unverified`; `access_denied` → `cancelled`; `state` inválido/expirado/reusado;
- `claim`: `PENDING`, `secret` errado, `deviceId` diferente, entrega única, bloqueado;
- vínculo: código vai para o e-mail da conta; código ok/errado/expirado; senha ok/errada; conta sem
  senha (só código); 5 tentativas somadas; dev code;
- `complete`: sucesso (User sem senha + SocialAccount + tokens + indicação), CPF/celular/e-mail
  duplicado, corrida no índice único, fluxo fora do desfecho `SIGNUP` → recusa;
- `intent=link`: conecta, `already_linked`, `provider_taken`; `unlink`;
- `mustSetPassword` nos 5 caminhos (sem senha/sem social → true; com Google → false; com senha → false);
- adaptador com `fetch` mockado (`id_token` com `aud` errado recusado).

**Web (Vitest + jsdom + MemoryRouter):**
- `socialAuth`: grava/lê/limpa o fluxo; regra do `display-mode` (claim só no mesmo contexto);
  `localStorage` lançando não quebra;
- `SocialReturnScreen`: cada `status` leva à tela certa; polling; "volte ao app";
- `OnboardingScreen` modo Google: 3 passos, sem campos de e-mail/senha, payload do `complete`, CPF duplicado;
- guardas com `needsPasswordSetup` (inclui sessão antiga só com `hasPassword`);
- `LoginScreen`: botão só com o Google ligado; aviso em navegador de app;
- `AccountScreen`: conta Google (conectar, desconectar com confirmação), Segurança sem senha.

---

## 15. Para validar no app (UAT)

Matriz: **Android Chrome · Android PWA instalado · iPhone Safari · iPhone PWA instalado · desktop ·
link aberto dentro do Instagram**. Celular pelo túnel (§10.3); desktop em `localhost`.

1. Cadastro novo pelo Google → 3 passos → entra na Home → tutorial aparece → saldo 0.
2. Google com e-mail de conta existente → "Encontramos sua conta" → senha → entra; repetir com código.
3. Segundo acesso pelo Google → entra direto.
4. Conta de entregador/admin pelo Google → recusa com mensagem clara.
5. Conta bloqueada → mensagem de bloqueio.
6. Cancelar no Google → volta ao login com "você cancelou".
7. Perfil → conectar o Google numa conta de e-mail → sair → entrar pelo Google. Desconectar → entrar
   por código no e-mail.
8. Conta só Google → Perfil › Segurança → Criar senha → sair → entrar com senha.
9. Veio por link de indicação → cadastro pelo Google → a indicação fica vinculada.
10. CPF que já tem conta → mensagem + "Entrar na minha conta".
11. Sessão única: entrar pelo Google no aparelho B derruba o A.
12. **iPhone PWA**: toque no Google → janela do Safari → "Pode voltar ao app" → ao voltar, o app entra sozinho.
13. Link aberto no Instagram → aviso no lugar do botão do Google.
14. Páginas `/privacidade`, `/termos` e `/exclusao-de-dados` abrem deslogado e logado; Perfil › Ajuda ›
    Privacidade e termos lista as 3.

---

## 16. Riscos e armadilhas

- **PWA do iPhone** — o comportamento da janela do Safari muda entre versões do iOS; o desenho
  cobre os dois casos (volta dentro do app ou na janela), mas **só o UAT no aparelho confirma**.
- **Google em navegador de app** é bloqueado pelo próprio Google — mitigado com aviso, não resolvido.
- **Verificação da marca** (logo na tela de consentimento) leva dias e pede as páginas legais no ar
  e o domínio no Search Console. Sem logo, o app funciona antes disso.
- **Response schema** descarta `mustSetPassword`/`status` se não for declarado (já aconteceu no projeto).
- **Bundle antigo em cache:** o SW assume na hora (`skipWaiting`), e o `?? hasPassword` nas guardas
  cobre sessões antigas. No pior caso, conta do Google num bundle antigo entrando por código cai no
  "defina sua senha" — aceitável.
- **Transação no Mongo** (User + SocialAccount): Atlas é *replica set*, suporta; usar o `tx-retry`.
- **Deep link:** evitado de propósito voltando pela raiz (`/?social=`).

---

## 17. Fora de escopo

- **Facebook** (D-7) — **guardado para uso futuro**, com projeto completo em
  [`plano-login-social-facebook.md`](./plano-login-social-facebook.md) (regras, endpoints, passo a
  passo da Meta, testes, UAT) e telas no brief marcadas "Futuro — Facebook". Volta somando: valor
  no enum, adaptador, confirmação de e-mail por código e o botão.
- **Entrar com Apple** — não é obrigatório para PWA (a regra da App Store vale para app nativo);
  próximo passo natural para o público de iPhone.
- "Entrar com Instagram" — a Meta não oferece login do Instagram para apps de consumidor.
- Login social para entregador e admin.
- *One Tap* / FedCM do Google.
- Foto do perfil vinda do Google.
- Relatório "cadastros e logins por método" — os dados passam a existir (`SocialAccount.linkedAt`,
  `method` no evento de login); a tela fica para depois.
- OTP por WhatsApp (segue o plano existente).

---

## 18. O que divergiu do plano

- **D-8 — Sem índice TTL (Onda 2, 30/09/2026).** O plano previa um TTL em `SocialLoginFlow.expiresAt`
  via `ensure-indexes`. No banco de teste, o `db push` **apagou** o TTL que a API tinha criado no boot
  (`[-] Index expiresAt_ttl`): o Prisma trata um índice comum fora do schema como sobra — só os
  **parciais** (`paymentId_1`, `referralCode_1`) ele deixa em paz. Em produção o deploy roda o
  `db push` depois de a API subir, então o TTL sumiria a cada deploy. Troca: `@@index([expiresAt])`
  no schema + `cleanupExpiredSocialFlows` no `daily-jobs`. O `ensure-indexes.ts` ficou como era.
- **D-9 — `google-auth-library` na faixa 10 (Onda 2).** A versão atual (11) exige Node ≥ 22; o
  Dockerfile da API e o ambiente local usam Node 20. A 10.9 é a última compatível (Node ≥ 18).
- **D-10 — Conectar pelo Perfil tem rota própria (Onda 3).** O plano previa `start` com `intent=link`
  e Bearer opcional. Ficou `POST /auth/social/:provider/connect` (autenticada, só CLIENT) e o
  `start` só aceita `login` — autenticação explícita em vez de "Bearer se o corpo pedir".
- **D-11 — `SocialCompleteSchema` mora na API, não no shared (Onda 4).** O `RegisterSchema` já mora em
  `apps/api/.../auth.schema.ts`; os dois derivam do `SignupProfileSchema` de lá. O front não usa Zod.
  No shared ficaram os contratos do fluxo (`social-auth.ts`).
- **D-12 — Erros de campo do vínculo (Onda 4).** Senha/código errado → **401** `{ error, reason:
  'code_wrong' | 'password_wrong' | 'code_expired' | 'no_code', attemptsLeft }`; estourou as 5
  tentativas → **429** `reason: 'too_many'` e o fluxo acaba (o `claim` passa a dar `expired`).
- **D-13 — Admin recebe `accessMethods` (Onda 4).** No lugar de `socialProviders`, o detalhe devolve
  `accessMethods: ('google' | 'password')[]` — é o que a linha "Acesso" do A1 desenha.
- **Achado — e-mail sem diferenciar maiúsculas.** O Google devolve o e-mail em minúsculas; um cadastro
  antigo pode ter "Joao@Gmail.com". A busca de conta existente (e a checagem do `complete`) usa
  `mode: 'insensitive'`, senão a mesma pessoa ganharia uma segunda conta.
- **D-14 — Minha conta inteira no visual do handoff (Onda 6).** O handoff reestiliza a tela toda
  (rótulo fora do card, "Editar" no cabeçalho, linhas compactas, CPF mascarado `•••.982.247-••`,
  celular formatado, toast embaixo). É só visual, então entrou (regra do handoff). As edições
  (dados pessoais, endereço, troca de condomínio) seguem as mesmas, dentro do card novo. O endereço
  mantém as linhas Apartamento/Bloco/Complemento em vez do "Endereço" combinado do protótipo.
- **D-15 — Quem abre o Google é a tela de retorno (Onda 5).** O `start` só cria o fluxo; o app vai
  para `/entrar/social` (L3a) e lá abre o Google (`goToProvider`). Assim o PWA do iPhone fica
  esperando no L3a. Um reload no L3a não reabre o Google (marca por fluxo no `sessionStorage`).
- **D-16 — "Google conectado!" por aviso de uma vez (Onda 6).** Depois do vínculo (L6) ou do
  conectar pelo Perfil, o toast aparece na tela de destino via `lib/flash` + `FlashToast` no
  `ClientLayout`.
- **D-17 — A1 nunca vazio (Onda 6).** Conta sem Google e sem senha (antiga) mostra a pill
  "Código no e-mail" — o caminho que toda conta tem.
- **D-18 — "Quase lá" não chama a API no Continuar (Onda 6).** Não há o que salvar no passo 1; o
  "Salvando…" do handoff ficou no botão final. CPF/celular repetidos voltam do passo 3 para o 1 com o
  aviso do handoff. Ao refazer o Google (fluxo expirado), o que foi digitado é guardado e volta.
- **D-19 — Páginas legais com rascunho real (Onda 7).** No lugar do lorem do handoff, um rascunho que
  descreve o app de verdade (dados, finalidade, compartilhamento, direitos, exclusão em 15 dias), com o
  aviso "Versão provisória" enquanto `LEGAL_DRAFT` for true (`content/legal.ts`). **30/09/2026: o
  usuário decidiu subir sem o aviso (`LEGAL_DRAFT = false`), antes da revisão jurídica.** Contato:
  `cheirindepao.contato@gmail.com`. Pendente com vocês: revisão jurídica, razão social/CNPJ,
  encarregado, prazo de exclusão.
- **Bug achado no teste real (30/09/2026) — router criado antes da reescrita da URL.** O `router.tsx`
  criava o `createBrowserRouter` no import; o `main.tsx` reescrevia `/?social=<id>` → `/entrar/social`
  depois, e o router, que já tinha lido `/`, mostrava a splash com a URL nova na barra. Correção:
  `createAppRouter()` (função), chamada no `main.tsx` depois de `captureSocialReturn()`. As capturas
  passaram a incluir o caminho real (abrir `/?social=<id>`), não só `/entrar/social` direto.
- **Bug achado no teste real (01/10/2026) — "Demorou um pouquinho." com o login feito (local e
  prod).** A API entrega o `LOGGED_IN` uma vez só (RESOLVED → CONSUMED); o 2º `claim` leva "expirou".
  O efeito de busca do `SocialReturnScreen` rodava de novo com o 1º `claim` no ar — em prod porque o
  `AuthProvider` termina de hidratar logo depois da volta (`isLoading` → novo `finishAuth` → novo
  `handleResult`), em dev também pelo `StrictMode` —, descartava a resposta com os tokens e mostrava
  o "expirou" do 2º. No banco o fluxo aparecia CONSUMED/LOGIN. Correção: `claimSocial` reaproveita o
  pedido que já está no ar para o mesmo fluxo. Testes de regressão no `SocialReturnScreen.test.tsx`
  (StrictMode e `finishAuth` mudando no meio da busca). A verificação da marca no Google **não**
  tinha relação com essa falha.
- **Revisão de produção da branch (30/09/2026) — bug do módulo de Despesas, fora do login social.**
  O `@@unique([recurrenceId, recurrenceMonth])` de `Expense` impedia a 2ª despesa avulsa (P2002).
  Virou índice parcial no `ensure-indexes` (detalhe no topo de `plano-financeiro-vendas.md`).

