---
phase: 02-authentication
reviewed: 2026-06-14T04:35:09Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - apps/api/src/bootstrap/admin-seed.ts
  - apps/api/src/modules/auth/auth.controller.ts
  - apps/api/src/modules/auth/auth.repository.ts
  - apps/api/src/modules/auth/auth.route.ts
  - apps/api/src/modules/auth/auth.schema.ts
  - apps/api/src/modules/auth/auth.service.ts
  - apps/api/src/modules/auth/otp.service.ts
  - apps/api/src/modules/condominiums/condominiums.route.ts
  - apps/api/src/plugins/authenticate.ts
  - apps/api/src/server.ts
  - apps/web/src/components/auth/ChannelSelector.tsx
  - apps/web/src/components/auth/CondoSearch.tsx
  - apps/web/src/components/auth/OtpInput.tsx
  - apps/web/src/components/auth/ResendTimer.tsx
  - apps/web/src/components/auth/StepDots.tsx
  - apps/web/src/components/ProtectedRoute.tsx
  - apps/web/src/contexts/AuthContext.tsx
  - apps/web/src/hooks/useAuth.ts
  - apps/web/src/lib/apiFetch.ts
  - apps/web/src/pages/admin/AdminLayout.tsx
  - apps/web/src/pages/admin/CourierRegisterScreen.tsx
  - apps/web/src/pages/auth/LoadingScreen.tsx
  - apps/web/src/pages/auth/LoginScreen.tsx
  - apps/web/src/pages/auth/OnboardingScreen.tsx
  - apps/web/src/pages/client/ClientLayout.tsx
  - apps/web/src/pages/courier/CourierLayout.tsx
  - apps/web/src/routes/router.tsx
findings:
  critical: 7
  warning: 6
  info: 3
  total: 16
status: issues_found
---

# Fase 02: Relatório de Code Review — Autenticação

**Revisado em:** 2026-06-14T04:35:09Z
**Profundidade:** standard
**Arquivos revisados:** 27
**Status:** issues_found

---

## Resumo

Revisão da camada completa de autenticação: backend Fastify/Prisma (controller, service, repository, plugin de autenticação, seed) e frontend React (contexto de auth, hooks, telas de login/onboarding, rotas protegidas).

A arquitetura geral é coerente — sessões opacas com hash SHA-256, OTP de curta duração, proteção de dispositivo — mas há **7 issues críticos** que bloqueiam o funcionamento em produção ou criam brechas de segurança graves. O mais severo é um contrato de API quebrado que torna o fluxo de login (LoginScreen) completamente inoperante: o endpoint `POST /auth/otp/send` retorna `{ ok: true }` mas o cliente espera `{ userId }`. Há também ausência total de rate-limiting nos endpoints OTP, geração de OTP não criptograficamente segura, e vazamento de mensagens de erro internas.

---

## Problemas Críticos

### CR-01: Fluxo de login completamente quebrado — `sendOtp` não retorna `userId`

**Arquivo:** `apps/api/src/modules/auth/auth.controller.ts:69` / `apps/web/src/pages/auth/LoginScreen.tsx:49-50`

**Issue:** `POST /auth/otp/send` retorna apenas `{ ok: true }`. O `LoginScreen` faz `data.userId ?? ''`, armazena uma string vazia em `userId` e envia `{ userId: '', code, deviceId }` para `POST /auth/otp/verify`. O servidor tenta `findActiveOtp({ where: { userId: '' } })`, não encontra nenhum OTP e retorna 401 em 100% dos casos. **O login de usuários existentes está completamente inoperante.**

**Fix:**

No controller (`auth.controller.ts`), retornar o `userId` na resposta do `sendOtp`:

```typescript
// auth.controller.ts — método sendOtp, linhas 55-69
const user = phone
  ? await this.fastify.prisma.user.findFirst({ where: { phone } })
  : await this.fastify.prisma.user.findFirst({ where: { email } })

if (!user) {
  return reply.status(404).send({ error: 'Usuário não encontrado' })
}

const channel = phone ? 'sms' : 'email'
const dest = (phone ?? email)!
await this.service.sendOtp(user.id, channel, dest)
// Retornar userId para que o cliente possa chamá-lo em /otp/verify
return reply.status(200).send({ ok: true, userId: user.id })
```

---

### CR-02: OTP gerado com `Math.random()` — não criptograficamente seguro

**Arquivo:** `apps/api/src/modules/auth/auth.service.ts:15`

**Issue:** `Math.floor(1000 + Math.random() * 9000)` usa o PRNG de JavaScript (Xorshift ou similar), que é previsível dado o estado da engine. Um atacante com acesso ao timing de respostas pode reduzir o espaço de busca efetivo abaixo de 9000 possibilidades. Em 4 dígitos (10.000 combinações), isso é crítico.

**Fix:**

```typescript
import { randomInt } from 'node:crypto'

generateOtpCode(): string {
  // randomInt é CSPRNG: gera inteiro em [min, max) com segurança criptográfica
  return randomInt(1000, 10000).toString()
}
```

---

### CR-03: Sem rate-limiting nos endpoints OTP — brute force irrestrito

**Arquivo:** `apps/api/src/modules/auth/auth.route.ts:9-10` / `apps/api/src/server.ts`

**Issue:** `POST /auth/otp/send` e `POST /auth/otp/verify` não têm qualquer limitação de taxa. Com um OTP de 4 dígitos, um atacante pode exaurir o espaço de 9.000 possibilidades em segundos sem restrição alguma. Não há contador de tentativas por `userId`, nem por IP.

**Fix:**

Instalar `@fastify/rate-limit` e aplicar nas rotas sensíveis:

```typescript
// server.ts
import rateLimit from '@fastify/rate-limit'
await fastify.register(rateLimit, { max: 5, timeWindow: '1 minute' })
```

Adicionalmente, no `verifyOtpAndCreateSession`, registrar tentativas falhas na entidade OTP e invalidar após N falhas (ex.: 5):

```typescript
// Na OtpCode: adicionar campo attempts Int @default(0)
// Em verifyOtpAndCreateSession: incrementar attempts e invalidar se >= 5
if (otp.attempts >= 5) return { error: 'OTP bloqueado por excesso de tentativas', status: 401 }
await this.repo.incrementOtpAttempts(otp.id)
```

---

### CR-04: Vazamento de mensagens de erro internas em produção

**Arquivo:** `apps/api/src/modules/auth/auth.controller.ts:32,41,53,71,83,107,124,133`

**Issue:** Em todos os blocos `catch` dos handlers, `String(err)` é enviado diretamente ao cliente. Isso pode expor stack traces, mensagens do Prisma contendo nomes de tabelas/campos, erros de conexão com MongoDB Atlas com credenciais parciais, e outros detalhes internos. Exemplo: `Error: Invalid Prisma query on 'User': ...` seria visível na resposta HTTP.

**Fix:**

```typescript
// Padrão a aplicar em todos os catch dos controllers:
} catch (err) {
  fastify.log.error(err) // log interno completo
  return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
}
```

Reservar `String(err)` apenas para logs server-side, nunca para a resposta HTTP.

---

### CR-05: Comparação de OTP sem proteção contra timing attacks

**Arquivo:** `apps/api/src/modules/auth/auth.service.ts:77`

**Issue:** `if (otp.code !== this.hashValue(code))` usa comparação de strings JavaScript, que retorna `false` assim que encontra o primeiro byte diferente. Um atacante pode medir diferenças de tempo (dezenas de nanosegundos) entre respostas para descobrir prefixos do hash correto e reduzir o espaço de busca.

**Fix:**

```typescript
import { timingSafeEqual } from 'node:crypto'

// Em verifyOtpAndCreateSession:
const expectedHash = Buffer.from(this.hashValue(code), 'hex')
const actualHash = Buffer.from(otp.code, 'hex')
const match = expectedHash.length === actualHash.length &&
  timingSafeEqual(expectedHash, actualHash)
if (!match) return { error: 'Código inválido', status: 401 }
```

---

### CR-06: `condominiums.route.ts` expõe `String(err)` em produção

**Arquivo:** `apps/api/src/modules/condominiums/condominiums.route.ts:18`

**Issue:** `return reply.status(500).send({ error: String(err) })` — mesmo problema do CR-04, mas em rota pública sem autenticação. Qualquer exceção (falha do Atlas, erro de schema Prisma) expõe detalhes internos a qualquer visitante não autenticado.

**Fix:**

```typescript
} catch (err) {
  fastify.log.error(err)
  return reply.status(500).send({ error: 'Erro ao carregar condomínios.' })
}
```

---

### CR-07: `OtpInput` declara `useRef` dentro de array literal — violação das Rules of Hooks

**Arquivo:** `apps/web/src/components/auth/OtpInput.tsx:19-24`

**Issue:** Os 4 `useRef` são declarados como elementos de um array literal `[useRef(...), useRef(...), ...]` construído durante o render. Hooks chamados dentro de estruturas de dados (arrays, objetos) que dependem de avaliação de expressão violam as React Rules of Hooks. Embora o número seja fixo (4) e o comportamento seja estável em runtime hoje, o linter ESLint (`eslint-plugin-react-hooks`) reporta isso como violação e builds futuros com React Compiler podem quebrá-lo.

**Fix:**

```typescript
const ref0 = useRef<HTMLInputElement>(null)
const ref1 = useRef<HTMLInputElement>(null)
const ref2 = useRef<HTMLInputElement>(null)
const ref3 = useRef<HTMLInputElement>(null)
const refs = [ref0, ref1, ref2, ref3]
```

---

## Avisos (Warning)

### WR-01: `admin-seed.ts` usa fallback de CPF `'00000000000'` — viola unicidade do schema

**Arquivo:** `apps/api/src/bootstrap/admin-seed.ts:24`

**Issue:** Se `ADMIN_CPF` não estiver configurado, o admin é criado com CPF `'00000000000'`. O schema Prisma define `cpf String @unique`. Se o seed rodar novamente em ambiente limpo (ou um segundo usuário for criado sem CPF), ou se o campo CPF não aceitar esse valor em validação futura, a operação falha com erro de unicidade. Adicionalmente, um CPF de zeros não é válido segundo o algoritmo CPF e pode quebrar validações nas fases seguintes.

**Fix:**

Tornar `ADMIN_CPF` obrigatório no envSchema, ou rejeitar claramente em vez de silenciosamente usar valor inválido:

```typescript
// admin-seed.ts
if (!name || (!phone && !email) || !process.env.ADMIN_CPF) {
  console.warn('[bootstrap] ADMIN_CPF não configurado — admin seed ignorado')
  return
}
// usar process.env.ADMIN_CPF sem fallback
cpf: process.env.ADMIN_CPF,
```

---

### WR-02: `LoginScreen` — verificação de expiração do OTP por string em inglês

**Arquivo:** `apps/web/src/pages/auth/LoginScreen.tsx:102`

**Issue:** `if (errMsg.toLowerCase().includes('expired'))` — o servidor retorna mensagens em português (`'OTP expirado'`, `'Sessão expirada ou inválida'`). O teste procura `'expired'` (inglês), o que nunca vai bater. Usuários com OTP expirado verão sempre a mensagem genérica "Código incorreto" em vez da mensagem correta orientando ao reenvio.

**Fix:**

Padronizar o contrato de erro ou testar a string em português:

```typescript
if (errMsg.toLowerCase().includes('expir')) {
  setError('Código expirado. Solicite um novo.')
} else {
  setError('Código incorreto. Verifique e tente de novo.')
}
```

(O `OnboardingScreen.tsx:205` já usa `'expir'` corretamente — aplicar o mesmo padrão no LoginScreen.)

---

### WR-03: `OnboardingScreen` e `CourierRegisterScreen` lêem chave `message` da resposta de erro, mas a API envia `error`

**Arquivo:** `apps/web/src/pages/auth/OnboardingScreen.tsx:154` / `apps/web/src/pages/admin/CourierRegisterScreen.tsx:65`

**Issue:** As respostas de erro do backend têm shape `{ error: string }` (ver controller linha 32, 41, etc.). Mas o cliente lê `err?.message` nos casos de erro não-409. O fallback genérico sempre vence, ocultando a mensagem real do servidor do usuário.

**Fix:**

```typescript
// OnboardingScreen.tsx:154 e CourierRegisterScreen.tsx:65
const err = (await regRes.json().catch(() => null)) as { error?: string } | null
setError(err?.error ?? 'Algo deu errado. Verifique sua conexão e tente novamente.')
```

O mesmo se aplica a `OnboardingScreen.tsx:203-204`:
```typescript
const err = (await res.json().catch(() => null)) as { error?: string } | null
const msg = err?.error ?? ''
```

---

### WR-04: `authenticate.ts` — sessão não é verificada com `expiresAt` no query, apenas após fetch

**Arquivo:** `apps/api/src/plugins/authenticate.ts:31-36`

**Issue:** O `findFirst` busca `{ token: tokenHash, isRevoked: false }` mas não filtra por `expiresAt`. Sessões expiradas são carregadas do banco, depois testadas com `session.expiresAt < new Date()`. Isso desperdiça I/O desnecessariamente e — mais importante — em sistemas com clock skew ou eventual consistency do Atlas, pode criar uma janela de acesso indevido.

**Fix:**

Incluir o filtro de expiração diretamente na query:

```typescript
const session = await fastify.prisma.session.findFirst({
  where: {
    token: tokenHash,
    isRevoked: false,
    expiresAt: { gt: new Date() },  // filtra no banco
  },
})
if (!session) {
  return reply.status(401).send({ error: 'Sessão expirada ou inválida' })
}
```

---

### WR-05: `server.ts` — CORS em produção configurado como `false`, bloqueia todas as origens

**Arquivo:** `apps/api/src/server.ts:47-51`

**Issue:** `origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173'` — `origin: false` no `@fastify/cors` desabilita o CORS completamente (não envia headers `Access-Control-Allow-Origin`). Na prática, isso bloqueia o frontend PWA de acessar a API em produção, pois browsers recusam respostas cross-origin sem esses headers.

**Fix:**

Adicionar variável de ambiente `CORS_ORIGIN` para produção:

```typescript
await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
})
// Em produção: CORS_ORIGIN=https://app.cheirindepao.com.br
```

---

### WR-06: `OnboardingScreen` — dupla submissão possível ao completar OTP

**Arquivo:** `apps/web/src/pages/auth/OnboardingScreen.tsx:617,629-630`

**Issue:** O `OtpInput.onComplete` dispara `handleOtpComplete(code)` automaticamente quando o 4º dígito é preenchido. O botão "Criar conta e ver meu pão" também pode disparar `handleOtpComplete(otpCode)` — via `otpCode` no estado da tela pai. Se o usuário teclar o 4º dígito e clicar no botão antes que o loading seja ativado (micro-janela de estado), `handleOtpComplete` é chamado duas vezes, disparando dois requests de verificação. O segundo vai falhar (OTP já marcado como usado) e o usuário verá mensagem de erro após uma operação bem-sucedida.

**Fix:**

Adicionar guard no handler para evitar execução concorrente:

```typescript
const verifyOtp = async (code: string) => {
  if (loading) return  // guard contra dupla submissão
  setIsLoading(true)
  // ...
}
```

---

## Informações (Info)

### IN-01: `admin-seed.ts` roda em produção sem proteção de ambiente

**Arquivo:** `apps/api/src/bootstrap/admin-seed.ts:3-28`

**Issue:** O seed é chamado incondicionalmente em `server.ts:57` em qualquer `NODE_ENV`. Em produção, isso é uma verificação desnecessária ao banco a cada inicialização. Embora seja idempotente, cria latência no startup e acopla lógica de seed com código de produção.

**Sugestão:** Considerar mover para script separado (`npm run seed:admin`) ou guardar com `if (process.env.NODE_ENV !== 'production')` para produção futura, desde que a criação do admin em produção seja feita out-of-band.

---

### IN-02: `apiFetch` fallback hardcoded para `http://localhost:3001`

**Arquivo:** `apps/web/src/lib/apiFetch.ts:16`

**Issue:** `import.meta.env.VITE_API_URL ?? 'http://localhost:3001'` — em um build de produção onde `VITE_API_URL` não estiver definido (erro de CI/CD, pipeline incompleto), o app em produção silenciosamente apontará para localhost. O erro seria difícil de diagnosticar pois as requests simplesmente falhariam sem mensagem clara.

**Sugestão:** Lançar erro em build de produção se a variável não estiver definida, ou pelo menos logar um aviso visível:

```typescript
const BASE_URL = import.meta.env.VITE_API_URL
if (!BASE_URL && import.meta.env.PROD) {
  console.error('[apiFetch] VITE_API_URL não configurado em produção!')
}
```

---

### IN-03: Código duplicado — `formatCpf` / `stripCpf` em `OnboardingScreen` e `CourierRegisterScreen`

**Arquivo:** `apps/web/src/pages/auth/OnboardingScreen.tsx:22-32` / `apps/web/src/pages/admin/CourierRegisterScreen.tsx:8-19`

**Issue:** As funções `formatCpf` e `stripCpf` são idênticas em ambos os arquivos. Qualquer correção futura precisa ser aplicada nos dois lugares.

**Sugestão:** Extrair para `apps/web/src/lib/cpf.ts` e importar de lá.

---

_Revisado em: 2026-06-14T04:35:09Z_
_Revisor: Claude (gsd-code-reviewer)_
_Profundidade: standard_
