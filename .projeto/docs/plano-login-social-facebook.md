# Plano — Entrar com Facebook (fase futura)

> 🗄️ **Status:** GUARDADO para uso futuro em 30/09/2026 — não entra na versão atual (D-7 do
> [plano do Google](./plano-login-social.md)). Nenhuma linha de código.
>
> **Pré-requisito:** o [login com Google](./plano-login-social.md) implementado. Este documento é só
> o **delta**: tudo o que não está aqui (fluxo no servidor, `claim` com segredo, cadastro "Quase lá",
> vínculo, `mustSetPassword`, conta no Perfil, páginas legais) já vem pronto do Google.
>
> **Design pronto (30/09/2026):** o handoff
> [`.projeto/design_handoff_login_social/`](../design_handoff_login_social/README.md) já desenha o
> Facebook — botão (`SocialBtn provider="facebook"`, `FacebookF`, `ProviderTile`), **L5**
> "Confirme seu e-mail" (`SAEmailConfirm` em `screens-social-auth2.jsx`, estados `sending`,
> `codeWrong`, `codeExpired`, `tooMany`), a linha do Facebook no **L7** (`ConnectedRow`, estado
> `both`) e a pill no **A1**. Na versão do Google essas peças ficaram de fora (V-1 do plano do Google).

---

## 1. Objetivo

Somar **"Continuar com o Facebook"** ao login e ao cadastro, com as mesmas regras do Google, mais
a **confirmação do e-mail por código** — o Facebook não garante que o e-mail foi verificado e às
vezes nem manda e-mail.

---

## 2. Decisões (confirmadas em 30/09/2026, antes de o Facebook sair do escopo)

| # | Tema | Decisão |
|---|---|---|
| D-2 | Já existe conta com o mesmo e-mail | **Pedir confirmação** (senha ou código no e-mail da conta) — igual ao Google. |
| D-3 | E-mail do Facebook | **Confirmar por código** (o de 4 dígitos, mesmo e-mail/visual de hoje). Se o Facebook **não mandar e-mail**, o app pede e confirma. |
| D-4 | Senha | **Opcional**, igual ao Google. |
| — | Perfis | Só **CLIENT**, igual ao Google. |
| — | Conta na Meta | **Perfil pessoal do Facebook de uma pessoa real** (a Meta não aceita Instagram nem perfil de empresa; perfil falso é desativado e derruba o login dos clientes) + **segundo admin** + app ligado ao **portfólio empresarial** da Meta. |

---

## 3. O que muda no desenho (delta sobre o Google)

### 3.1 Regra de decisão no callback
Soma uma regra antes da regra do e-mail verificado (§5.1 do plano do Google):

- **Facebook → sempre `EMAIL_REQUIRED`** (com `suggestedEmail`, se veio). O cliente confirma (ou
  informa) o e-mail e recebe o código. Depois do código, volta à regra do e-mail verificado:
  - conta CLIENT com esse e-mail → **conecta na hora** (`LOGIN`) — o código **já prova** a posse,
    então não pede a confirmação da D-2 de novo;
  - conta COURIER/ADMIN → `ERROR: not_client`;
  - nenhuma conta → `SIGNUP` (cadastro "Quase lá" com o e-mail já confirmado).
- Já vinculado (`SocialAccount(FACEBOOK, id)`) → `LOGIN` direto, como no Google.

### 3.2 Modelo de dados
- `enum SocialProvider { GOOGLE FACEBOOK }` — soma o valor.
- `SocialLoginFlow`: os campos de código já são genéricos no plano do Google (`codeHash`,
  `codeTarget`, `codeExpiresAt`, `attempts`, `emailVerified`) — **nada novo**. O desfecho ganha
  `EMAIL_REQUIRED`.
- `SocialAccount`: nada muda (`@@unique([userId, provider])` passa a permitir 1 Google **e** 1 Facebook).

### 3.3 Backend
- **Adaptador `providers/facebook.ts`** (mesma interface do `google.ts`):
  - `www.facebook.com/<versão>/dialog/oauth` com `scope=email,public_profile`, `state` e **PKCE S256**;
  - troca em `graph.facebook.com/<versão>/oauth/access_token` (com `code_verifier`);
  - perfil em `/me?fields=id,name,email` com **`appsecret_proof`** (HMAC-SHA256 do access token com
    a chave secreta do app);
  - `emailVerified` = **sempre `false`** (D-3); identidade = `id` (por app);
  - versão da Graph API fixada numa constante (a vigente na implementação); `fetch` nativo, sem SDK.
- **Env:** `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` (opcionais; liga quando o par existe). Secrets
  `FACEBOOK_APP_ID_PROD` / `FACEBOOK_APP_SECRET_PROD` no bloco de produção do `mainBackend.yml`.
- **`GET /auth/social/providers`** → `{ google, facebook }`.
- **Endpoints novos:**

  | Método + rota | Corpo → resposta |
  |---|---|
  | `POST /auth/social/email-code/send` | `{ flowId, secret, email }` → manda o código para o e-mail informado (pode editar o sugerido). 5/min. |
  | `POST /auth/social/email-code/verify` | `{ flowId, secret, deviceId, code }` → `LOGGED_IN` (conectou) ou `NEEDS_SIGNUP`. 5/min. |

  Código de 4 dígitos com `generateOtpCode` + `sendEmailOtp` (mesmo e-mail de hoje), 10 min, máx. 5
  tentativas, `OTP_DEV_CODE` em desenvolvimento. **Trocar o e-mail** invalida o código anterior.
- **`claim`** ganha o status `NEEDS_EMAIL` → `{ suggestedEmail? }` (declarar no response schema).
- **`complete`** passa a aceitar e-mail confirmado por código (hoje só aceita o do Google).
- **Admin:** `socialProviders` pode trazer `'FACEBOOK'`. **Métrica:** `method: 'facebook'`.

### 3.4 Frontend
- Botão **"Continuar com o Facebook"** no login e na entrada do cadastro (aparece só com
  `providers.facebook === true`).
- **`SocialReturnScreen`** ganha o passo **"Confirme seu e-mail"** (e-mail sugerido, editável) /
  **"Qual é o seu e-mail?"** (Facebook não mandou) → código (reusa `OtpInput`/`ResendTimer`).
- **Perfil › Minha conta:** linha do Facebook na conta conectada (conectar/desconectar).
- **Admin:** pill "Facebook" na linha "Acesso".
- **Navegador de app** (Instagram/Facebook): o botão do **Facebook funciona** ali — só o do Google
  vira aviso.

### 3.5 Páginas legais
A Meta exige, para o app ir para **Live**, a URL da **política de privacidade** e a URL de
**instruções de exclusão de dados**. Criar a rota própria **`/exclusao-de-dados`** (o conteúdo já
existe como seção da política do Google) — ou apontar para a âncora da seção, se a Meta aceitar.

---

## 4. Configuração na Meta for Developers — passo a passo

Endereços de retorno (não existe ambiente DEV):

| Onde | URI |
|---|---|
| Local | `http://localhost:5173/api/auth/social/facebook/callback` |
| Produção | `https://api.cheirindepao.com.br/auth/social/facebook/callback` |
| Celular (túnel) | `https://<túnel>/api/auth/social/facebook/callback` |

1. **Conta de desenvolvedor** — [developers.facebook.com](https://developers.facebook.com) com o
   **perfil pessoal** de quem vai administrar → "Começar" → confirmar telefone.
2. **Criar app** — Meus apps › Criar app → nome `Cheirin de Pão`, e-mail de contato
   `cheirindepao.contato@gmail.com` → caso de uso **"Autenticar e solicitar dados de usuários com o
   Login do Facebook"** → portfólio: ligar ao **portfólio empresarial** (ou "agora não" e ligar
   depois) → Criar app.
3. **Permissões** — Casos de uso › Autenticação e criação de conta › Personalizar → adicionar
   **`email`** (`public_profile` já vem). Ambas "Pronto para teste".
4. **Configurações do Login do Facebook:**
   - Login do OAuth do cliente: **Sim** · Login do OAuth na Web: **Sim** · Impor HTTPS: **Sim**
   - Modo estrito para URIs de redirecionamento: **Sim**
   - Login do OAuth no navegador incorporado: **Não** · Login com o SDK do JavaScript: **Não** ·
     Login a partir de dispositivos: **Não**
   - URIs de redirecionamento válidos: os da tabela (em modo Desenvolvimento a Meta já libera
     `localhost` sozinha — se recusar o `http://localhost…`, tudo bem).
5. **Configurações do app › Básico** — copiar **ID do app** e **Chave secreta** (→ `apps/api/.env`;
   nunca no chat nem no git); domínios `cheirindepao.com.br`; categoria; ícone 1024×1024; URLs de
   **privacidade**, **termos** e **exclusão de dados** (quando as páginas estiverem no ar).
6. **Funções do app** — segundo **admin** + quem vai testar como **Testador** (aceitam o convite).
   Em **Desenvolvimento**, só essas pessoas entram.
7. **Lançamento** — mudar para **Live** (exige os itens do passo 5). Se a Meta pedir **verificação
   da empresa** para o acesso avançado a `email`, é pelo portfólio empresarial (alguns dias).
   `public_profile` + `email` não passam por App Review.

---

## 5. Segurança (delta)

- [ ] PKCE S256 + `state` também no Facebook; `appsecret_proof` em toda chamada à Graph API.
- [ ] E-mail do Facebook **nunca** vale sem o nosso código (D-3); trocar o e-mail invalida o código.
- [ ] Identidade = `id` do Facebook (por app), nunca o e-mail.
- [ ] Chave secreta do app só no servidor; nenhum token do Facebook persistido.

---

## 6. Testes (delta)

- API: Facebook → `EMAIL_REQUIRED`; sem e-mail → `suggestedEmail` ausente; código ok/errado/
  expirado/5 tentativas; depois do código: conta CLIENT → conecta e entra, COURIER/ADMIN →
  `not_client`, nenhuma → `SIGNUP`; trocar e-mail invalida o código; adaptador com `fetch` mockado
  (sem e-mail, erro da Graph, `appsecret_proof` presente); `providers` com os dois.
- Web: botão só com `facebook: true`; passo de e-mail (sugerido, editável, vazio); fluxo até o cadastro.

---

## 7. UAT (delta)

1. Cadastro novo pelo Facebook → confirma e-mail por código → 3 passos → entra.
2. Facebook sem compartilhar e-mail → informa e-mail → código → segue.
3. Facebook com o e-mail de conta existente → código → conecta e entra (sem pedir senha).
4. Perfil → conectar o Facebook → sair → entrar pelo Facebook; desconectar → entrar por código.
5. Link aberto no Instagram/Facebook → aviso do Google; **Facebook funciona**.
6. Conta com Google **e** Facebook → os dois entram na mesma conta.

---

## 8. Riscos

- **ID do Facebook é por app:** trocar de app na Meta muda os ids e quebra os vínculos. Usar **um
  app só**, para local e produção.
- **Perfil de quem administra:** se for desativado, o app fica sem dono — por isso o segundo admin e
  o portfólio empresarial.
- **Live exige** privacidade + exclusão de dados públicas; a verificação da empresa, se pedida, leva dias.
- Em **Desenvolvimento**, quem não tem função no app vê erro ao tentar entrar — manter o botão
  desligado em produção (sem os secrets) até ir para Live.

---

## 9. Ondas (quando for retomar)

| Onda | Conteúdo |
|---|---|
| F0 — Meta | §4 passos 1–6 (local + prod), credenciais no `apps/api/.env`. |
| F1 — Backend | Enum, adaptador, `email-code/send` + `verify`, `NEEDS_EMAIL`, `complete` com e-mail por código, `providers` + testes. |
| F2 — Front | Botão, passo de e-mail na `SocialReturnScreen`, linha no Perfil, pill no admin — seguindo a parte "Futuro — Facebook" do handoff. |
| F3 — Legal | Rota `/exclusao-de-dados`. |
| F4 — Verificação e lançamento | UAT (§7) no local e pelo túnel; Meta em **Live**; secrets `_PROD` do Facebook no GitHub. |
