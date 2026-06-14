# Phase 2: Authentication - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Autenticação completa do Cheirin de Pão — OTP login, cadastro em 5 passos, sessão permanente com detecção de dispositivo, e roteamento para a tela correta por perfil (Cliente, Entregador, Admin). Nenhuma funcionalidade de negócio nesta fase.

**Entregáveis desta fase:**
- Fluxo de login OTP (telefone ou e-mail → código 4 dígitos → sessão)
- Cadastro de cliente em 5 passos (Dados → Contato → Condomínio → Endereço → OTP)
- Sessão permanente com device_id no localStorage; expira em 90 dias de inatividade ou troca de dispositivo
- Admin criado automaticamente no boot via env vars; Admin cadastra Entregador via tela simples
- Roteamento por perfil após autenticação: `/client`, `/courier`, `/admin`
- Schema: 2 novas coleções (Session + OtpCode) adicionadas ao Prisma schema existente

</domain>

<decisions>
## Implementation Decisions

### Sessão e Token
- **D-01:** Sessão implementada como **opaque session token no MongoDB** (não JWT). Coleção `Session` nova no Prisma: `userId`, `token` (hashed com bcrypt/crypto), `deviceId`, `lastUsedAt`, `expiresAt`, `isRevoked`. Permite revogar sessões individuais e checar 90 dias de inatividade via `lastUsedAt`.
- **D-02:** Token armazenado no frontend em **localStorage** como `auth_token`. Enviado como `Authorization: Bearer <token>` em todas as requisições autenticadas. XSS risk baixo — app não renderiza HTML externo.
- **D-03:** Coleção **`OtpCode`** separada no Prisma: `userId`, `code` (hashed), `channel` (`sms` | `email`), `expiresAt`, `usedAt`. TTL de 10 minutos. Registro marcado como usado (`usedAt`) após validação — nunca deletado, para auditoria.

### OTP Provider
- **D-04:** SMS via **Zenvia** (provider brasileiro). API REST direto (sem SDK oficial Node.js). Env vars: `ZENVIA_TOKEN`, `ZENVIA_FROM`. Custo: R$0,05–0,15/SMS.
- **D-05:** E-mail via **Resend** (free tier: 3.000 e-mails/mês). SDK oficial `resend` npm. Env vars: `RESEND_API_KEY`, `RESEND_FROM`. Provavelmente cobre o MVP inteiro sem custo.
- **D-06:** Em `NODE_ENV=development`: **código fixo** via env var `OTP_DEV_CODE=1234`. Qualquer código aceita "1234". Zero custo, zero latência. Documentado em `.env.example`.

### Detecção de Dispositivo
- **D-07:** **Device ID** implementado como UUID v4 gerado no primeiro acesso ao app, persistido em `localStorage` como `device_id`. A coleção `Session` salva o `deviceId` no momento da criação da sessão.
- **D-08:** Se o `device_id` do localStorage não bater com o `deviceId` da Session salva no banco → Session marcada como `isRevoked: true` + frontend redirecionado para tela de login com novo OTP. Implementa exatamente AUTH-06: "novo código solicitado em troca de dispositivo ou limpeza do navegador".

### Bootstrap do Admin e Entregador
- **D-09:** Admin criado **automaticamente no boot** do servidor: se `ADMIN_PHONE` (ou `ADMIN_EMAIL`) e `ADMIN_NAME` existem no `.env` e não há nenhum usuário com `role: ADMIN` no banco, o servidor cria o registro. Env vars: `ADMIN_NAME`, `ADMIN_PHONE`, `ADMIN_EMAIL` (pelo menos um de phone ou email). Documentado em `.env.example`.
- **D-10:** **Fase 2 inclui tela de cadastro de Entregador pelo Admin** (AUTH-07) — necessário para o Success Criteria #4 ("Admin cadastra entregador e entregador consegue fazer login"). Interface mínima dentro do fluxo auth: campos nome, CPF, telefone, e-mail.

### Claude's Discretion
- Estrutura interna do módulo auth na API (controller/service/repository) — seguir o padrão Clean Architecture já estabelecido em `apps/api/src/modules/health/`
- Hash do session token — usar `crypto.randomBytes(32).toString('hex')` para gerar + armazenar hash `sha256` no banco
- Gestão de estado de auth no frontend — React Context com `AuthProvider` que lê `localStorage` e expõe `user`, `token`, `isLoading`; integrado ao router para guards de rota
- Tab bar e navegação inferior dos perfis — não implementar na Fase 2 (escopo Fases 3+). Apenas layouts placeholder com header simples.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requisitos e Regras de Negócio
- `.projeto/Cheirin_de_Pao_Requisitos_v01.md` §4.1 — Cadastro do cliente (dados coletados, confirmação, autenticação); §4.2 — Perfil Entregador (cadastro simplificado pelo Admin); §4.3 — Perfil Admin; §5.2 — Clean Architecture
- `.projeto/Cheirin_de_Pao_Requisitos_v01.md` §AUTH — AUTH-01..08 (requirements completos desta fase)

### Design e UI
- `.projeto/design_handoff_cheirin_pao/app/screens-onboarding.jsx` — telas de login (LoginScreen), cadastro 5 passos (OnboardingScreen), OTP 4 dígitos com auto-focus. **Leitura obrigatória** — implementação UI deve seguir este design com alta fidelidade.
- `.projeto/design_handoff_cheirin_pao/app/brand.jsx` — tokens de tema (cores, tipografia) usados nas telas de auth
- `.projeto/design_handoff_cheirin_pao/README.md` — design tokens e guia geral de UI

### Código Existente (Fase 1)
- `apps/web/src/routes/router.tsx` — route groups já criados: `/client`, `/courier`, `/admin` com lazy loading. Fase 2 adiciona rotas filhas de auth sem alterar a estrutura raiz.
- `apps/api/prisma/schema.prisma` — schema existente (User sem Session/OtpCode). Fase 2 adiciona modelos `Session` e `OtpCode`.
- `apps/api/src/modules/health/health.route.ts` — padrão de módulo Fastify a seguir para o módulo `auth`
- `packages/shared/src/schemas/index.ts` — `UserRoleSchema` (CLIENT, COURIER, ADMIN) já definido

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `UserRoleSchema` em `packages/shared/src/schemas/index.ts` — enum de perfis já disponível para Zod validation nas rotas de auth
- Route groups `/client`, `/courier`, `/admin` em `apps/web/src/routes/router.tsx` — guards de rota de auth se encaixam como wrappers nos layouts existentes
- `fastify.prisma` decorator em `apps/api/src/plugins/prisma.ts` — disponível para o módulo de auth sem configuração adicional

### Established Patterns
- **Módulo Fastify**: `modules/{domain}/{domain}.route.ts` registrado no `server.ts` — Fase 2 cria `modules/auth/auth.route.ts` seguindo o mesmo padrão
- **Lazy loading por perfil**: `createBrowserRouter` + `React.lazy()` já configurado — adicionar sub-rotas de auth dentro de cada perfil mantém a estrutura
- **Clean Architecture**: controller → service → repository por domínio (definido em Requisitos_v01.md §5.2)

### Integration Points
- `Session` e `OtpCode` são coleções novas — adicionar ao `schema.prisma` existente (sem migration destrutiva com MongoDB)
- `AuthProvider` (Context) envolve o `RouterProvider` em `apps/web/src/main.tsx` — intercepta toda navegação
- Variáveis de ambiente novas (`ZENVIA_TOKEN`, `RESEND_API_KEY`, etc.) adicionadas ao schema `envSchema` em `apps/api/src/server.ts`

</code_context>

<specifics>
## Specific Ideas

- **OTP input:** 4 inputs independentes com `maxLength={1}` e auto-focus ao digitar — já implementado no protótipo `LoginScreen` e `OnboardingScreen` de `screens-onboarding.jsx`. Replicar exatamente esse padrão (incluindo o `inputMode="numeric"` e os estilos do token `surfaceAlt` com borda `accent` ao preencher).
- **Reenvio de código:** timer visual de 30 segundos antes de habilitar reenvio (visto no design: "Reenviar em 0:28"). Bloquear reenvio antes do timer expirar no frontend.
- **Canal automático:** no cadastro, se o usuário informou telefone, o canal de OTP é SMS automaticamente. Se informou apenas e-mail, o canal é email. Se informou ambos, exibir seletor (já visível no `OnboardingScreen` do design).
- **Admin bootstrap:** documentar claramente no `.env.example` que `ADMIN_PHONE`/`ADMIN_EMAIL` + `ADMIN_NAME` são usados para criar o primeiro Admin no boot.

</specifics>

<deferred>
## Deferred Ideas

- **Múltiplos dispositivos simultâneos** — A política atual revoga a sessão ao detectar device_id diferente. Suporte a múltiplos dispositivos (um token por device, todos válidos) pode ser considerado futuramente, mas foge de AUTH-06 como definido.
- **Logout explícito** — não está nos requirements desta fase; pode ser adicionado na Fase 5 ou Fase 7 quando o perfil do cliente tiver mais telas.
- **Rate limiting de OTP** — limitação de reenvios por número de telefone/hora (anti-abuse). Não é requisito explícito do MVP mas é boa prática de segurança. Defer para após o MVP.

</deferred>

---

*Phase: 2-Authentication*
*Context gathered: 2026-06-13*
