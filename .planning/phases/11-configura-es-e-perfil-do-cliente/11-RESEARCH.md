# Phase 11: Configurações e Perfil do Cliente — Research

**Pesquisado:** 2026-06-19
**Domínio:** Perfil de usuário, edição de dados com OTP, mudança de condomínio com desativação de agenda
**Confiança:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Tab Bar — Acesso às Configurações (CONF-01)**
- D-01: Adicionar 5º tab "Perfil" ao `ClientTabBar` com ícone `user` e label `'Perfil'`.
- D-02: Rota `/client/perfil` — renderiza dentro do `ClientLayout` com tab bar visível.
- D-03: Sem botão de voltar — aba de nível superior.

**Dados do Perfil no AuthContext**
- D-04: Enriquecer `AuthUser` após login com `GET /client/profile`. Campos: `phone?`, `email?`, `cpf`, `birthDate`, `condominiumId`, `condominiumName`, `apartment`, `block?`.
- D-05: `AuthContext` ganha método `updateUser(partial: Partial<AuthUser>)` — análogo a `updateCreditBalance()`.
- D-06: Sem refetch de profile ao abrir a tela — dados vêm do `AuthUser` em memória.

**Tela de Configurações — SettingsScreen (CONF-02, CONF-03, CONF-05, CONF-07)**
- D-07: Seções: Dados Pessoais, Contato, Condomínio, Conta.
- D-08: CPF readonly com estilo visual diferente.
- D-09: Botão "Sair" chama `AuthContext.logout()` diretamente — sem dialog.

**Fluxo de Edição de Contato com OTP (CONF-04)**
- D-10: Botão 'Editar' em Contato navega para `/client/perfil/editar-contato`.
- D-11: Tela com 2 steps visuais na mesma tela (step wizard inline).
- D-12: Backend valida conflito antes de enviar OTP; retorna `422` se contato já existe.
- D-13: OTP enviado com `purpose: 'CONTACT_CHANGE'`.
- D-14: Após OTP validado: backend atualiza contato, frontend chama `updateUser()` e navega para `/client/perfil`.

**Mudança de Condomínio (CONF-05, CONF-06)**
- D-15: Edição inline na SettingsScreen (sem tela separada).
- D-16: Campo 'Bloco' aparece somente se condomínio for do tipo `BLOCKS`.
- D-17: Dialog de confirmação ao salvar se condomínio mudou.
- D-18: Após confirmação: backend desativa schedule, frontend chama `updateUser()`.
- D-19: `ScheduleScreen` exibe banner contextual se mudou de condomínio e não tem agenda ativa.

### Claude's Discretion

- Design visual das seções da SettingsScreen — seguir padrão existente (fundo creme, headers espresso).
- Ícone de "perfil" — usar `user` (disponível no Ic do Icon.tsx).
- Validações de campo inline (formato de data, tamanho mínimo de nome).
- Mensagens de erro e toast de sucesso.
- Como detectar "mudou de condomínio" no banner da ScheduleScreen (comparar `condominiumId` ou flag).

### Deferred Ideas (OUT OF SCOPE)

Nenhum item diferido — discussão ficou dentro do escopo.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Descrição | Suporte da Research |
|----|-----------|---------------------|
| CONF-01 | Cliente acessa configurações pelo 5º tab "Perfil" no ClientTabBar | D-01/02/03 mapeados; `ClientTabBar` auditado — precisa de 5º item no array `TABS` |
| CONF-02 | Visualizar e editar nome completo e data de nascimento | `PATCH /client/profile` — campos `name` e `birthDate` no `User` schema |
| CONF-03 | CPF exibido mas imutável | Campo `cpf` em `User` — input readonly, sem envio no PATCH |
| CONF-04 | Editar telefone/email com re-verificação OTP | `OtpCode` sem campo `purpose` — necessita migração de schema para `purpose: 'CONTACT_CHANGE'` |
| CONF-05 | Visualizar e editar condomínio e apartamento | `condominiumId`, `apartment`, `block` em `User`; `CondoSearch` reutilizável |
| CONF-06 | Mudança de condomínio desativa agenda semanal | `Schedule.isActive = false` via `prisma.schedule.updateMany` por userId |
| CONF-07 | Logout pelo menu de configurações | `AuthContext.logout()` já implementado — reutilizar diretamente |
</phase_requirements>

---

## Summary

A Phase 11 é uma fase de integração e completude: todos os componentes necessários já existem no codebase e precisam ser conectados corretamente, não construídos do zero. O frontend já tem `OtpInput`, `CondoSearch`, o padrão de dialog de `ConfirmDeliveryDialog`, o sistema de toast do `ScheduleScreen`, e o `AuthContext` com um padrão análogo ao `updateUser` pedido. O backend tem toda a infraestrutura de OTP, autenticação JWT e operações Prisma necessárias.

O ponto de atenção crítico da fase é o campo `purpose` no schema `OtpCode`: o modelo atual NÃO tem esse campo — a decisão D-13 exige que OTPs de `CONTACT_CHANGE` não conflitem com o `findActiveOtp` de login. Isso implica adicionar o campo `purpose` ao model `OtpCode` no schema Prisma e adaptar o `findActiveOtp` para filtrar por purpose. Esta é a única mudança de schema necessária na fase.

O segundo ponto relevante é o enriquecimento do `AuthUser` no login (D-04): o `GET /client/profile` precisa ser chamado após o `verifyOtp` bem-sucedido e os campos adicionados ao objeto persistido no localStorage. Isso toca o `AuthController.verifyOtp` ou o fluxo pós-login no frontend.

**Recomendação primária:** Iniciar pelo backend (schema + endpoints `client-profile`) antes do frontend. O frontend depende do contrato de API para tipagem dos novos campos do `AuthUser`.

---

## Architectural Responsibility Map

| Capability | Tier Primário | Tier Secundário | Racional |
|------------|---------------|-----------------|----------|
| Exibição e edição de dados pessoais | Frontend (React) | API (validação) | Dados carregados do AuthUser em memória; API valida e persiste |
| Edição de contato com OTP | API | Frontend (fluxo wizard) | Validação de conflito e envio de OTP são responsabilidade do backend |
| Mudança de condomínio + desativação de agenda | API | Frontend (dialog + banner) | Desativação de `Schedule` é operação atômica no backend |
| Persistência de perfil enriquecido | API | Frontend (localStorage) | Backend é fonte de verdade; frontend armazena em cache no localStorage |
| Logout | Frontend (AuthContext) | — | `logout()` limpa localStorage e navega — sem chamada API necessária |
| Banner de condomínio mudado | Frontend (ScheduleScreen) | — | Lógica de detecção e exibição puramente frontend via AuthUser |

---

## Standard Stack

### Core (sem instalações novas — stack já definida)

| Biblioteca | Versão atual | Propósito nesta fase |
|-----------|--------------|----------------------|
| React + Vite | ~18 / ~5 | Frontend components (SettingsScreen, ContactEditScreen) |
| Fastify | ~4 | Novos endpoints `/client/profile/*` |
| Prisma + MongoDB | ~6.19 / Atlas | `User.update`, `Schedule.updateMany` |
| Zod | ~3 | Validação de body nos novos endpoints |

Nenhum pacote externo novo é necessário para esta fase. [VERIFIED: codebase grep]

### Componentes Reutilizáveis Existentes

| Componente/Hook | Localização | Reutilização |
|----------------|-------------|--------------|
| `OtpInput` | `src/components/auth/OtpInput.tsx` | Step 2 do fluxo de edição de contato |
| `CondoSearch` | `src/components/auth/CondoSearch.tsx` | Seção de condomínio da SettingsScreen |
| `ConfirmDeliveryDialog` | `src/components/courier/ConfirmDeliveryDialog.tsx` | Padrão para o dialog de confirmação de mudança de condomínio |
| `AuthContext.logout()` | `src/contexts/AuthContext.tsx:63` | Botão "Sair" |
| `updateCreditBalance()` | `src/contexts/AuthContext.tsx:74` | Modelo direto para `updateUser()` |
| `apiFetch` | `src/lib/apiFetch.ts` | Chamadas autenticadas aos novos endpoints |
| `sendSmsOtp` / `sendEmailOtp` | `apps/api/src/modules/auth/otp.service.ts` | Envio do OTP de mudança de contato |

## Package Legitimacy Audit

> Nenhum pacote externo novo instalado nesta fase. Auditoria não aplicável.

**Pacotes removidos:** nenhum
**Pacotes suspeitos:** nenhum

---

## Architecture Patterns

### Diagrama de Fluxo de Dados

```
                    SettingsScreen (/client/perfil)
                           |
          ┌────────────────┼───────────────────┐
          |                |                   |
   [Dados Pessoais]   [Contato]          [Condomínio]
   PATCH /client/     POST /client/       PATCH /client/
   profile            profile/contact/    profile
   (name,             request-change      (condominiumId,
   birthDate)         ──► OTP step        apartment, block)
          |           confirm-change           |
          |                |                   |
          └────────────────┴───────────────────┘
                           |
                    updateUser(partial)
                    (AuthContext + localStorage)
                           |
                    [ScheduleScreen detecta
                    condominiumId mudado →
                    banner contextual CONF-06]
```

### Estrutura do Novo Módulo Backend

```
apps/api/src/modules/client-profile/
├── client-profile.route.ts        # Endpoints GET/PATCH /client/profile, POST contact/request-change, POST contact/confirm-change
├── client-profile.controller.ts   # Handlers HTTP — role check CLIENT inline
├── client-profile.service.ts      # Lógica de negócio: validação de conflito, envio OTP, desativação de schedule
├── client-profile.repository.ts   # Prisma: findById, updateUser, findActiveSchedule, deactivateSchedule
└── client-profile.schema.ts       # Zod schemas para os 4 endpoints
```

### Estrutura do Novo Código Frontend

```
apps/web/src/pages/client/
├── SettingsScreen.tsx              # CONF-01..03, CONF-05, CONF-07 — tela principal
└── ContactEditScreen.tsx           # CONF-04 — wizard de 2 steps inline
```

### Pattern 1: Módulo Backend controller → service → repository

Padrão estabelecido em todos os módulos existentes. [VERIFIED: codebase grep]

```typescript
// Source: apps/api/src/modules/admin-clients/admin-clients.controller.ts
export class ClientProfileController {
  private service: ClientProfileService

  constructor(private fastify: FastifyInstance) {
    this.service = new ClientProfileService(fastify)
  }

  async getProfile(request: FastifyRequest, reply: FastifyReply) {
    // Role check CLIENT inline — padrão T-07-03-01 adaptado para CLIENT
    if (request.user?.role !== 'CLIENT') {
      return reply.status(403).send({ error: 'Acesso negado' })
    }
    const result = await this.service.getProfile(request.user.id)
    return reply.status(200).send(result)
  }
}
```

### Pattern 2: updateUser() no AuthContext

Modelo direto de `updateCreditBalance()` em `AuthContext.tsx:74`. [VERIFIED: codebase]

```typescript
// Seguir exatamente o mesmo padrão de updateCreditBalance (linhas 74-86 de AuthContext.tsx)
updateUser: (partial: Partial<AuthUser>) => {
  setUser((prev) => {
    if (!prev) return prev
    const updated: AuthUser = { ...prev, ...partial }
    try {
      localStorage.setItem('auth_user', JSON.stringify(updated))
    } catch {
      // localStorage unavailable — update in-memory only
    }
    return updated
  })
}
```

### Pattern 3: Rota Lazy-Loaded no router.tsx

[VERIFIED: codebase — apps/web/src/routes/router.tsx]

```typescript
// Adicionar sob o path '/client' children:
{
  path: 'perfil',
  lazy: () =>
    import('../pages/client/SettingsScreen').then((m) => ({
      Component: m.SettingsScreen,
    })),
},
{
  path: 'perfil/editar-contato',
  lazy: () =>
    import('../pages/client/ContactEditScreen').then((m) => ({
      Component: m.ContactEditScreen,
    })),
},
```

### Pattern 4: Dialog de Confirmação (sem biblioteca)

O projeto usa dialog inline sem biblioteca externa. Padrão em `ConfirmDeliveryDialog.tsx`. [VERIFIED: codebase]

```typescript
// Backdrop com role="dialog" aria-modal="true", stopPropagation no card interno
// background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center'
// Card: background: 'var(--color-surface)', borderRadius: 22, padding: 24, maxWidth: 320
// Botão cancelar: border, background transparent
// Botão confirmar: background: 'var(--color-espresso)'
```

### Pattern 5: Toast de Feedback

Padrão do `ScheduleScreen.tsx` — estado local, `setTimeout` de 2500ms. [VERIFIED: codebase]

```typescript
const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null)
// position: fixed, top: 16, left: 50%, transform: translateX(-50%)
// zIndex: 9999, background: 'var(--color-espresso)'
// setTimeout(() => setToast(null), 2500)
```

### Anti-Patterns a Evitar

- **Refetch de profile ao abrir settings:** D-06 proíbe. Dados devem vir do `AuthUser` em memória.
- **Passar `adminId` no body:** T-10-02-01 — extrair `userId` sempre do JWT (`request.user.id`), nunca do body.
- **Dialog de confirmação no logout do cliente:** D-09 é explícito — sem dialog para o cliente (diferente do Admin).
- **Navegar para nova rota no wizard de OTP:** D-11 — 2 steps na mesma tela (`/client/perfil/editar-contato`), não criar sub-rotas adicionais.
- **`findActiveOtp` sem filtro de purpose:** Sem o campo `purpose` no `OtpCode`, o OTP de `CONTACT_CHANGE` conflitaria com o OTP de login do mesmo usuário — `findActiveOtp` atual não distingue purpose.

---

## Ponto Crítico: Campo `purpose` no OtpCode

### Estado Atual do Schema

O model `OtpCode` atual **não tem campo `purpose`**: [VERIFIED: codebase]

```prisma
model OtpCode {
  id        String    @id @default(auto()) @map("_id") @db.ObjectId
  userId    String    @db.ObjectId
  code      String
  channel   String        // 'sms' | 'email'
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())
}
```

### Mudança Necessária

D-13 exige `purpose: 'CONTACT_CHANGE'` para não conflitar. Isso requer:

1. **Schema Prisma:** Adicionar `purpose String @default("LOGIN")` ao `OtpCode`.
2. **`auth.repository.ts` / `findActiveOtp`:** Adicionar filtro `purpose: 'LOGIN'` para não buscar OTPs de CONTACT_CHANGE durante o fluxo de login.
3. **`auth.service.ts` / `sendOtp`:** Passar `purpose` ao `createOtp`.
4. **Novo módulo `client-profile`:** Criar OTPs com `purpose: 'CONTACT_CHANGE'`.

> [ASSUMED] Como MongoDB com Prisma não executa migrações declarativas, documentos existentes de `OtpCode` sem o campo `purpose` são tratados como `null` pelo Prisma. O `@default("LOGIN")` aplica apenas a novos documentos. A query de `findActiveOtp` com `purpose: 'LOGIN'` pode não encontrar OTPs legados que não têm o campo. Mitigação: usar `purpose: { in: ['LOGIN', null] }` na query de findActiveOtp para compatibilidade retroativa, ou adicionar `purpose` como opcional (`purpose String?`) e tratar null como LOGIN.

### Estratégia Recomendada

Declarar `purpose String?` (opcional) no schema. Na query `findActiveOtp` do login, usar:
```typescript
where: { userId, usedAt: { isSet: false }, expiresAt: { gt: new Date() }, purpose: { in: [null, 'LOGIN'] } }
```
Para `findActiveOtp` de `CONTACT_CHANGE`, filtrar `purpose: 'CONTACT_CHANGE'` explicitamente.

---

## Don't Hand-Roll

| Problema | Não construir | Usar em vez | Por quê |
|----------|---------------|-------------|---------|
| Envio de OTP de contato | Novo serviço SMS/email | `sendSmsOtp` / `sendEmailOtp` já em `otp.service.ts` | Já integra Zenvia + Resend, com tratamento de erros |
| Input OTP 4 dígitos | Novo componente | `OtpInput` em `src/components/auth/OtpInput.tsx` | Já implementa auto-advance, backspace, validação numérica, ARIA |
| Busca de condomínio | Novo buscador | `CondoSearch` em `src/components/auth/CondoSearch.tsx` | Filtro case-insensitive, empty state, seleção visual |
| Autenticação JWT | Novo guard | `preHandler: [fastify.authenticate]` | Plugin já registrado, popula `request.user` com `id` e `role` |
| Dialog modal | Biblioteca externa | Componente inline (padrão `ConfirmDeliveryDialog`) | Projeto não usa biblioteca de UI — dialogs são implementados inline |

**Insight chave:** Esta fase é de conexão, não de invenção. Quase toda primitiva necessária já existe.

---

## Common Pitfalls

### Pitfall 1: OtpCode sem purpose conflita com login

**O que vai errado:** Se o usuário está logado e solicita mudança de contato, `findActiveOtp(userId)` encontra o OTP de CONTACT_CHANGE durante o próximo login (se o OTP ainda não expirou), causando falha silenciosa no login.
**Por que acontece:** `findActiveOtp` atual não distingue purpose.
**Como evitar:** Adicionar `purpose String?` ao schema e filtrar por purpose nas queries. Ver seção acima.
**Sinais de alerta:** Login falha com "OTP expirado" em usuários que recentemente solicitaram mudança de contato.

### Pitfall 2: Enriquecimento de AuthUser no login sem backward-compat

**O que vai errado:** Sessões existentes no localStorage não têm os novos campos (`cpf`, `birthDate`, etc.). `useAuth()` retorna `null` para esses campos, quebrando a SettingsScreen em sessões antigas.
**Por que acontece:** D-04 adiciona campos ao `AuthUser`, mas sessões persistidas antes da fase não os têm.
**Como evitar:** Seguir o padrão de backward-compat já existente no `AuthContext` (linha 38: `creditBalance: parsed.creditBalance ?? 0`). Ao reidratar, aplicar defaults para todos os novos campos opcionais.
**Sinais de alerta:** SettingsScreen exibe campos em branco para usuários que não fizeram logout desde antes da fase.

### Pitfall 3: PATCH /client/profile aceita campos imutáveis

**O que vai errado:** O endpoint PATCH aceita `cpf` no body e o sobrescreve, violando CONF-03.
**Por que acontece:** Schema Zod do body não exclui explicitamente o campo.
**Como evitar:** O Zod schema de PATCH deve listar apenas os campos editáveis: `name`, `birthDate`, `condominiumId`, `apartment`, `block`. CPF nunca deve estar no schema de input.

### Pitfall 4: Dialog de condomínio não detecta mudança real

**O que vai errado:** Dialog aparece mesmo quando o usuário seleciona o mesmo condomínio que já tem.
**Por que acontece:** Comparação não feita antes de abrir o dialog.
**Como evitar:** Comparar `selectedCondoId !== user.condominiumId` antes de mostrar o dialog de confirmação. Dialog deve aparecer apenas quando `condominiumId` efetivamente mudou.

### Pitfall 5: Banner da ScheduleScreen sempre visível

**O que vai errado:** Banner "Você mudou de condomínio" aparece para usuários novos que nunca tiveram agenda.
**Por que acontece:** Lógica detecta apenas ausência de agenda, não a mudança de condomínio.
**Como evitar:** Banner deve ter condição dupla: (a) houve mudança de condomínio E (b) não há agenda ativa. A detecção de "mudança" pode ser feita comparando `user.condominiumId` atual com um valor anterior salvo em estado local após o PATCH, ou usando um campo auxiliar no `AuthUser` (ex: `condominiumJustChanged: boolean` limpo ao criar agenda).

### Pitfall 6: CondoSearch precisa carregar condomínios do backend

**O que vai errado:** `CondoSearch` na SettingsScreen renderiza lista vazia porque os dados não são carregados.
**Por que acontece:** No `OnboardingScreen`, condos são carregados via `useEffect` no step 2. Na SettingsScreen, o carregamento precisa ser acionado ao montar a seção de condomínio.
**Como evitar:** Carregar a lista de condomínios via `GET /condominiums` ao montar a SettingsScreen (ou ao expandir a seção de condomínio, se a seção for lazy).

---

## Code Examples

### GET /client/profile — Response

```typescript
// Source: schema Prisma (apps/api/prisma/schema.prisma) + interface AuthUser (D-04)
// Retorno mapeado dos campos do User para o frontend
{
  id: string            // User.id
  name: string          // User.name
  cpf: string           // User.cpf (mascarado ou completo — a definir)
  birthDate: string     // User.birthDate.toISOString()
  phone?: string        // User.phone
  email?: string        // User.email
  condominiumId: string // User.condominiumId
  condominiumName: string // Condominium.name (JOIN necessário)
  apartment: string     // User.apartment
  block?: string        // User.block
  creditBalance: number // User.creditBalance
}
```

> [ASSUMED] O campo `condominiumName` requer um join com a coleção `Condominium` no endpoint `GET /client/profile`. Prisma não tem FK declarada no schema atual (MongoDB não força FK), então o join deve ser feito manualmente com `findUnique` por `condominiumId`.

### PATCH /client/profile — Body Schema Zod

```typescript
// Source: padrão dos schemas existentes (apps/api/src/modules/auth/auth.schema.ts)
export const UpdateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  birthDate: z.string().datetime().optional(),
  condominiumId: z.string().optional(),
  apartment: z.string().optional(),
  block: z.string().optional(),
  // CPF NUNCA aqui — imutável (CONF-03)
})
```

### POST /client/profile/contact/request-change — Body Schema Zod

```typescript
export const ContactChangeRequestSchema = z
  .object({
    phone: z.string().optional(),
    email: z.string().email().optional(),
  })
  .refine((d) => d.phone || d.email, { message: 'phone ou email obrigatório' })
// Retorno: 204 (sem body) se OTP enviado; 422 se contato já pertence a outra conta
```

### POST /client/profile/contact/confirm-change — Body Schema Zod

```typescript
export const ContactChangeConfirmSchema = z.object({
  code: z.string().length(4),
  // userId vem do JWT (request.user.id) — não do body
})
// Retorno: 200 com { phone?, email? } atualizado; 401 se OTP inválido/expirado
```

### Adição do 5º Tab no ClientTabBar

```typescript
// Source: apps/web/src/components/client/ClientTabBar.tsx
// Ícone 'user' já disponível em Ic (Icon.tsx linha 5)
const TABS: TabItem[] = [
  { label: 'Início',   icon: 'home',     path: '/client/home'     },
  { label: 'Agenda',   icon: 'calendar', path: '/client/agenda'   },
  { label: 'Créditos', icon: 'coin',     path: '/client/creditos' },
  { label: 'Pedidos',  icon: 'bag',      path: '/client/pedidos'  },
  { label: 'Perfil',   icon: 'user',     path: '/client/perfil'   }, // D-01
]
```

### interface AuthUser Atualizada

```typescript
// Source: apps/web/src/contexts/AuthContext.tsx (linhas 4-9 — atualizar)
export interface AuthUser {
  id: string
  role: 'CLIENT' | 'COURIER' | 'ADMIN'
  name: string
  creditBalance: number
  // Campos adicionados em D-04 (opcionais para backward-compat com outras roles)
  phone?: string
  email?: string
  cpf?: string
  birthDate?: string
  condominiumId?: string
  condominiumName?: string
  apartment?: string
  block?: string
}
```

---

## Runtime State Inventory

> Fase de adição de funcionalidade, não de rename/refactor. Sem runtime state a migrar, exceto:

| Categoria | Itens Encontrados | Ação Necessária |
|-----------|-------------------|-----------------|
| Stored data | OtpCode documents no Atlas sem campo `purpose` | Nenhuma migração de dados — tratar `null` como `'LOGIN'` na query |
| Live service config | Nenhum | Nenhuma |
| OS-registered state | Nenhum | Nenhuma |
| Secrets/env vars | Nenhum novo necessário — Zenvia e Resend já configurados | Nenhuma |
| Build artifacts | Nenhum | Nenhuma |

---

## Environment Availability

| Dependência | Requerida por | Disponível | Versão | Fallback |
|-------------|---------------|------------|--------|----------|
| MongoDB Atlas | Backend endpoints | Depende de .env | — | Nenhum (dev usa Atlas remoto por decisão) |
| Zenvia (SMS) | CONF-04 OTP via SMS | Depende de ZENVIA_TOKEN | — | Usar OTP_DEV_CODE=1234 em dev |
| Resend (email) | CONF-04 OTP via email | Depende de RESEND_API_KEY | — | Usar OTP_DEV_CODE=1234 em dev |

**Dependências ausentes com fallback:** Zenvia e Resend — em dev, `NODE_ENV=development` usa `OTP_DEV_CODE` e não chama as APIs externas. [VERIFIED: `auth.service.ts` linhas 29-35]

---

## Validation Architecture

### Test Framework

| Propriedade | Valor |
|-------------|-------|
| Framework Frontend | Vitest + @testing-library/react (jsdom) |
| Config frontend | `apps/web/vitest.config.ts` |
| Framework Backend | Vitest (node) |
| Config backend | `apps/api/vitest.config.ts` |
| Quick run frontend | `cd apps/web && npx vitest run` |
| Quick run backend | `cd apps/api && npx vitest run` |
| Full suite | `npm run test` (Turborepo root) |

### Mapeamento de Requisitos → Testes

| Req ID | Comportamento | Tipo | Comando Automatizado | Arquivo existe? |
|--------|---------------|------|----------------------|-----------------|
| CONF-01 | ClientTabBar renderiza 5 abas com 'Perfil' | unit | `cd apps/web && npx vitest run src/components/client/__tests__/ClientTabBar.test.tsx` | Existe — precisa de novos casos |
| CONF-02 | SettingsScreen renderiza campos nome e birthDate editáveis | unit | `cd apps/web && npx vitest run src/pages/client/__tests__/SettingsScreen.test.tsx` | Inexistente — Wave 0 |
| CONF-03 | Campo CPF é readonly | unit | Mesmo arquivo acima | Inexistente — Wave 0 |
| CONF-04 | ContactEditScreen renderiza steps 1 e 2 | unit | `cd apps/web && npx vitest run src/pages/client/__tests__/ContactEditScreen.test.tsx` | Inexistente — Wave 0 |
| CONF-05 | Seção condomínio exibe CondoSearch e campo apto | unit | Mesmo arquivo SettingsScreen | Inexistente — Wave 0 |
| CONF-06 | Mudança de condomínio desativa schedule — lógica no service | unit | `cd apps/api && npx vitest run src/modules/client-profile/__tests__/client-profile.service.test.ts` | Inexistente — Wave 0 |
| CONF-07 | Botão Sair chama logout() | unit | Mesmo arquivo SettingsScreen | Inexistente — Wave 0 |

### Sampling Rate

- **Por commit de task:** `cd apps/web && npx vitest run` (frontend)
- **Por merge de wave:** `npm run test` (full suite Turborepo)
- **Phase gate:** Full suite verde antes de `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/web/src/pages/client/__tests__/SettingsScreen.test.tsx` — cobre CONF-02, CONF-03, CONF-05, CONF-07
- [ ] `apps/web/src/pages/client/__tests__/ContactEditScreen.test.tsx` — cobre CONF-04 (steps 1 e 2)
- [ ] `apps/api/src/modules/client-profile/__tests__/client-profile.service.test.ts` — cobre CONF-06 (desativação de schedule)
- [ ] Atualizar `apps/web/src/components/client/__tests__/ClientTabBar.test.tsx` — adicionar casos para 5º aba

---

## Security Domain

### Categorias ASVS Aplicáveis

| Categoria ASVS | Aplica | Controle Padrão |
|----------------|--------|-----------------|
| V2 Authentication | Sim | JWT via `fastify.authenticate` — já implementado |
| V3 Session Management | Não | Nenhuma sessão nova criada nesta fase |
| V4 Access Control | Sim | Role check `CLIENT` inline nos handlers (padrão existente) |
| V5 Input Validation | Sim | Zod em todos os endpoints de PATCH e POST |
| V6 Cryptography | Sim — OTP | `timingSafeEqual` já usado em `verifyOtpAndCreateSession`; replicar no confirm-change |

### Ameaças Conhecidas para Este Stack

| Padrão | STRIDE | Mitigação Padrão |
|--------|--------|-----------------|
| Enumeração de contato via 422 | Information Disclosure | Retornar mensagem genérica — D-12 já especifica: "Este contato já está associado a outra conta." |
| OTP brute force no confirm-change | Elevation of Privilege | Aplicar rate limit de 5 req/min por IP no endpoint — mesmo padrão do `/auth/otp/verify` |
| Sobrescrita de CPF via PATCH | Tampering | Zod schema de PATCH não inclui `cpf` — nunca atualizar esse campo |
| Acesso ao perfil de outro usuário | Spoofing | `userId` extraído sempre do JWT (`request.user.id`) — nunca do body ou params |

---

## State of the Art

| Abordagem Antiga | Abordagem Atual | Mudança | Impacto |
|-----------------|-----------------|---------|---------|
| AuthUser com apenas 4 campos | AuthUser enriquecido com dados de perfil (D-04) | Esta fase | Sem refetch de API ao abrir settings |
| OtpCode sem purpose | OtpCode com `purpose` opcional | Esta fase | Permite múltiplos fluxos OTP por usuário |

---

## Assumptions Log

| # | Afirmação | Seção | Risco se Errado |
|---|-----------|-------|-----------------|
| A1 | `condominiumName` requer join manual com coleção Condominium no `GET /client/profile` | Code Examples | Endpoint retorna `condominiumId` mas não `condominiumName` — SettingsScreen não consegue exibir o nome |
| A2 | OtpCode documents sem campo `purpose` são tratados como `null` pelo Prisma (MongoDB schema-less) | Pitfall 1 | Se Prisma lançar erro em vez de retornar null, queries de login quebram |
| A3 | `CondoSearch` pode ser reutilizado diretamente com os dados de `GET /condominiums` | Standard Stack | Se a interface Condo não bater (ex: campo `neighborhood` ausente em algum condomínio), filtro falha silenciosamente |

**Se a tabela estiver vazia:** todas as afirmações seriam verificadas. A3 pode ser confirmada lendo `GET /condominiums` response schema antes de implementar.

---

## Open Questions

1. **Como detectar "mudou de condomínio" no banner da ScheduleScreen?**
   - O que sabemos: `user.condominiumId` é atualizado via `updateUser()` após PATCH bem-sucedido
   - O que está incerto: A ScheduleScreen não tem acesso ao condomínio anterior para comparar
   - Recomendação: Adicionar campo `condominiumJustChanged: boolean` ao `AuthUser` — `updateUser` seta `true` quando `condominiumId` muda, `ScheduleScreen` exibe banner quando `condominiumJustChanged === true && !schedule?.isActive`. Campo limpo quando usuário cria nova agenda.

2. **CPF deve ser mascarado no `GET /client/profile`?**
   - O que sabemos: CONF-03 diz "exibido mas não pode ser alterado" — sugestão de exibição parcial
   - O que está incerto: Nível de mascaramento (ex: `***.***.009-09` vs completo)
   - Recomendação: Expor CPF completo no endpoint autenticado (o usuário é o dono dos dados). Mascaramento visual é responsabilidade do frontend se desejado.

---

## Sources

### Primary (HIGH confidence)
- `apps/web/src/contexts/AuthContext.tsx` — interface AuthUser, login(), logout(), updateCreditBalance() padrões
- `apps/web/src/components/client/ClientTabBar.tsx` — array TABS, estado ativo, ícones disponíveis
- `apps/web/src/routes/router.tsx` — padrão lazy import, estrutura de rotas `/client`
- `apps/web/src/components/auth/OtpInput.tsx` — API do componente OTP
- `apps/web/src/components/auth/CondoSearch.tsx` — interface Condo, props, comportamento
- `apps/web/src/components/courier/ConfirmDeliveryDialog.tsx` — padrão de dialog inline
- `apps/api/prisma/schema.prisma` — models User, OtpCode, Schedule, Condominium
- `apps/api/src/modules/auth/auth.repository.ts` — `findActiveOtp` sem filtro de purpose
- `apps/api/src/modules/auth/otp.service.ts` — `sendSmsOtp`, `sendEmailOtp`
- `apps/api/src/server.ts` — padrão de registro de rotas
- `apps/api/src/plugins/authenticate.ts` — `fastify.authenticate`, `request.user`

### Secondary (MEDIUM confidence)
- `apps/web/src/pages/client/ScheduleScreen.tsx` — padrão de toast, padrão de banner
- `apps/api/src/modules/admin-clients/admin-clients.controller.ts` — padrão de role check inline
- `apps/api/src/modules/credits/credits.route.ts` — padrão de rota autenticada
- `apps/api/src/modules/auth/auth.schema.ts` — padrão Zod para schemas de request

---

## Metadata

**Breakdown de confiança:**
- Standard Stack: HIGH — todos os componentes verificados diretamente no codebase
- Arquitetura: HIGH — padrão modular estabelecido e consistente em todo o projeto
- Pitfalls: HIGH (1-4) / MEDIUM (5-6) — pitfalls 1-4 verificados no código; 5-6 inferidos por analogia
- OtpCode/purpose: HIGH — verificado que o campo NÃO existe no schema atual

**Data da research:** 2026-06-19
**Válido até:** 2026-07-19 (stack estável)
