# Phase 11: Configurações e Perfil do Cliente — Pattern Map

**Mapeado:** 2026-06-19
**Arquivos analisados:** 14 (novos/modificados)
**Analógicos encontrados:** 14 / 14

---

## File Classification

| Novo/Modificado | Role | Data Flow | Analógico Mais Próximo | Match |
|-----------------|------|-----------|------------------------|-------|
| `apps/web/src/contexts/AuthContext.tsx` | provider | request-response | si mesmo (modificação) | exact |
| `apps/web/src/components/client/ClientTabBar.tsx` | component | event-driven | si mesmo (modificação) | exact |
| `apps/web/src/routes/router.tsx` | config | request-response | si mesmo (modificação) | exact |
| `apps/web/src/pages/client/SettingsScreen.tsx` | component | request-response | `apps/web/src/pages/client/ScheduleScreen.tsx` | role-match |
| `apps/web/src/pages/client/ContactEditScreen.tsx` | component | request-response | `apps/web/src/pages/auth/OnboardingScreen.tsx` | role-match |
| `apps/api/src/modules/client-profile/client-profile.route.ts` | route | request-response | `apps/api/src/modules/credits/credits.route.ts` | exact |
| `apps/api/src/modules/client-profile/client-profile.controller.ts` | controller | request-response | `apps/api/src/modules/admin-clients/admin-clients.controller.ts` | exact |
| `apps/api/src/modules/client-profile/client-profile.service.ts` | service | CRUD | `apps/api/src/modules/admin-clients/admin-clients.service.ts` | exact |
| `apps/api/src/modules/client-profile/client-profile.repository.ts` | model | CRUD | `apps/api/src/modules/admin-clients/admin-clients.repository.ts` | exact |
| `apps/api/src/modules/client-profile/client-profile.schema.ts` | utility | request-response | `apps/api/src/modules/auth/auth.schema.ts` | exact |
| `apps/api/prisma/schema.prisma` | config | CRUD | si mesmo (modificação) | exact |
| `apps/api/src/modules/auth/auth.repository.ts` | model | CRUD | si mesmo (modificação) | exact |
| `apps/api/src/server.ts` | config | request-response | si mesmo (modificação) | exact |
| `apps/web/src/pages/client/ScheduleScreen.tsx` | component | request-response | si mesmo (modificação) | exact |

---

## Pattern Assignments

### `apps/web/src/contexts/AuthContext.tsx` (provider, request-response)

**Analog:** si mesmo — arquivo existente a ser modificado

**Interface AuthUser atual** (linhas 4–9):
```typescript
export interface AuthUser {
  id: string
  role: 'CLIENT' | 'COURIER' | 'ADMIN'
  name: string
  creditBalance: number
}
```

**Padrão de backward-compat na reidratação** (linhas 36–38):
```typescript
const parsed = JSON.parse(storedUser) as AuthUser
// backward compat: older sessions may not have creditBalance
setUser({ ...parsed, creditBalance: parsed.creditBalance ?? 0 })
```
Aplicar o mesmo padrão para os novos campos opcionais. Todos os campos do perfil devem receber `?? undefined` ou valor default correspondente ao reidratar.

**Padrão updateCreditBalance — modelo exato para updateUser** (linhas 74–85):
```typescript
updateCreditBalance: (balance: number) => {
  setUser((prev) => {
    if (!prev) return prev
    const updated: AuthUser = { ...prev, creditBalance: balance }
    try {
      localStorage.setItem('auth_user', JSON.stringify(updated))
    } catch {
      // localStorage unavailable — update in-memory only
    }
    return updated
  })
},
```
O novo `updateUser(partial: Partial<AuthUser>)` deve seguir exatamente este padrão com spread: `{ ...prev, ...partial }`.

**Padrão login — onde injetar o GET /client/profile** (linhas 51–62):
```typescript
login: (t: string, u: AuthUser) => {
  const userData: AuthUser = { ...u, creditBalance: u.creditBalance ?? 0 }
  try {
    localStorage.setItem('auth_token', t)
    localStorage.setItem('auth_user', JSON.stringify(userData))
  } catch { }
  setToken(t)
  setUser(userData)
},
```
Após o login bem-sucedido no `LoginScreen`/`OnboardingScreen`, chamar `GET /client/profile` e então `auth.login(token, { ...user, ...profileData })`.

**Padrão logout** (linhas 63–73):
```typescript
logout: () => {
  try {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
  } catch { }
  setToken(null)
  setUser(null)
  navigate('/')
},
```
Reutilizar diretamente — sem nenhuma modificação.

---

### `apps/web/src/components/client/ClientTabBar.tsx` (component, event-driven)

**Analog:** si mesmo — arquivo existente a ser modificado

**Array TABS atual** (linhas 10–15):
```typescript
const TABS: TabItem[] = [
  { label: 'Início',   icon: 'home',     path: '/client/home'     },
  { label: 'Agenda',   icon: 'calendar', path: '/client/agenda'   },
  { label: 'Créditos', icon: 'coin',     path: '/client/creditos' },
  { label: 'Pedidos',  icon: 'bag',      path: '/client/pedidos'  },
]
```
Adicionar 5º item: `{ label: 'Perfil', icon: 'user', path: '/client/perfil' }`.

**Padrão de isActive** (linha 40):
```typescript
const isActive = location.pathname.startsWith(tab.path)
```
O `startsWith` cobre automaticamente `/client/perfil/editar-contato` como ativo quando em `/client/perfil`. Nenhuma mudança necessária neste padrão.

**Padrão visual do tab ativo** (linhas 62–79): ícone usa `color: 'var(--color-gold)'` e `stroke: 2.2`, label usa `fontWeight: 700` e `color: 'var(--color-accent)'`. Manter idêntico para o novo tab.

---

### `apps/web/src/routes/router.tsx` (config, request-response)

**Analog:** si mesmo — arquivo existente a ser modificado

**Padrão lazy-load de rota existente** (linhas 57–63):
```typescript
{
  path: 'agenda',
  lazy: () =>
    import('../pages/client/ScheduleScreen').then((m) => ({
      Component: m.ScheduleScreen,
    })),
},
```
Adicionar dois novos filhos sob o path `/client` (após linha 117, antes do fechamento do array `children`):
```typescript
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

---

### `apps/web/src/pages/client/SettingsScreen.tsx` (component, request-response)

**Analog:** `apps/web/src/pages/client/ScheduleScreen.tsx`

**Padrão de imports** (linhas 1–18 de ScheduleScreen.tsx):
```typescript
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { Icon } from '../../components/brand/Icon'
```
Adicionar também `apiFetch` de `'../../lib/apiFetch'` e `CondoSearch` de `'../../components/auth/CondoSearch'`.

**Padrão de toast de feedback** (linhas 49–58 de ScheduleScreen.tsx):
```typescript
const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null)

const handleSave = async () => {
  // ...
  setToast({ message: result.ok ? 'Salvo!' : (result.error ?? 'Erro ao salvar.'), ok: result.ok })
  setTimeout(() => setToast(null), 2500)
}
```

**Renderização do toast** (linhas 71–92 de ScheduleScreen.tsx):
```typescript
{toast && (
  <div
    style={{
      position: 'fixed',
      top: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      background: 'var(--color-espresso)',
      color: 'var(--color-primary-btn-text)',
      borderRadius: 12,
      padding: '12px 16px',
      fontFamily: 'var(--font-body)',
      fontWeight: 600,
      fontSize: 14,
      whiteSpace: 'nowrap',
      boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
    }}
  >
    {toast.message}
  </div>
)}
```

**Padrão de acesso a user via useAuth** (linhas 32–33 de ScheduleScreen.tsx):
```typescript
const { user } = useAuth()
const creditBalance = user?.creditBalance ?? 0
```
Na SettingsScreen, os dados vêm do `user` do AuthContext diretamente — sem `useEffect` de fetch ao montar (D-06).

**Padrão visual do AppBar sem botão voltar** (SettingsScreen é aba de nível superior — D-03): Omitir botão de voltar. Usar apenas título. Ver linha 104+ de ScheduleScreen para referência de estilo do header:
```typescript
<div style={{
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '6px 20px 14px',
  paddingTop: 'calc(6px + env(safe-area-inset-top))',
  background: 'var(--color-app-bg)',
}}>
  {/* SEM botão voltar — aba nível superior */}
  <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--color-text)' }}>
    Perfil
  </h1>
</div>
```

**Dialog de confirmação de mudança de condomínio** — copiar de `apps/web/src/components/courier/ConfirmDeliveryDialog.tsx` (linhas 44–158):
```typescript
<div
  role="dialog"
  aria-modal="true"
  onClick={handleBackdropClick}
  style={{
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  }}
>
  <div
    onClick={(e) => e.stopPropagation()}
    style={{
      background: 'var(--color-surface)',
      borderRadius: 22,
      padding: 24,
      width: '100%',
      maxWidth: 320,
    }}
  >
    {/* Botão cancelar */}
    <button style={{ border: '1.5px solid var(--color-border)', background: 'transparent' }} />
    {/* Botão confirmar */}
    <button style={{ background: 'var(--color-espresso)', color: 'var(--color-primary-btn-text)' }} />
  </div>
</div>
```

---

### `apps/web/src/pages/client/ContactEditScreen.tsx` (component, request-response)

**Analog:** `apps/web/src/pages/auth/OnboardingScreen.tsx`

**Padrão de imports** (linhas 1–11 de OnboardingScreen.tsx):
```typescript
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Icon } from '../../components/brand/Icon'
import { OtpInput } from '../../components/auth/OtpInput'
import { useAuth } from '../../hooks/useAuth'
import { apiFetch } from '../../lib/apiFetch'
```

**Padrão de step wizard inline** (linhas 55–81 de OnboardingScreen.tsx — gerenciamento de steps):
```typescript
const [step, setStep] = useState(0)
const [error, setError] = useState<string | null>(null)
const [loading, setLoading] = useState(false)
```
ContactEditScreen usa `step: 0 | 1` — step 0 é input do novo contato, step 1 é input do OTP.

**Padrão do OtpInput — API do componente** (linhas 3–6 de OtpInput.tsx):
```typescript
export interface OtpInputProps {
  onComplete: (code: string) => void
  disabled?: boolean
}
```
Chamar `<OtpInput onComplete={(code) => handleConfirmOtp(code)} disabled={loading} />` no step 1.

**Padrão de input OTP 4 dígitos** (linha 17 de OtpInput.tsx):
```typescript
export function OtpInput({ onComplete, disabled = false }: OtpInputProps) {
```
Cada caixa: `width: 64, height: 72, borderRadius: 18, fontSize: 30, fontFamily: 'var(--font-display)'`. Borda: `var(--color-accent)` quando preenchido, `var(--color-border)` quando vazio.

**Padrão do botão voltar** — ContactEditScreen É uma tela em stack (não tab top-level), então DEVE ter botão voltar:
```typescript
<button
  onClick={() => navigate(-1)}
  aria-label="voltar"
  style={{
    width: 38, height: 38,
    borderRadius: 12,
    border: 'none',
    background: 'var(--color-surface-2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0,
  }}
>
  <Icon name="arrow-left" size={20} color="var(--color-text)" />
</button>
```

---

### `apps/api/src/modules/client-profile/client-profile.route.ts` (route, request-response)

**Analog:** `apps/api/src/modules/credits/credits.route.ts`

**Padrão de imports e estrutura da rota** (linhas 1–8 de credits.route.ts):
```typescript
import { FastifyPluginAsync } from 'fastify'
import { CreditsController } from './credits.controller.js'

export const creditsRoute: FastifyPluginAsync = async (fastify) => {
  const ctrl = new CreditsController(fastify)
  // ...
}
```
Nomear como `clientProfileRoute` e exportar de `client-profile.route.ts`.

**Padrão de rota autenticada com preHandler** (linhas 7–32 de credits.route.ts):
```typescript
fastify.get('/combos', {
  preHandler: [fastify.authenticate],
  schema: {
    tags: ['client-profile'],
    summary: '...',
    security: [{ bearerAuth: [] }],
    // ...
  },
}, ctrl.listCombos.bind(ctrl))
```
TODOS os endpoints do módulo `client-profile` usam `preHandler: [fastify.authenticate]`.

**Rate limit em endpoints OTP** — copiar `otpRateLimit` de `auth.route.ts` (linhas 4–5):
```typescript
const otpRateLimit = { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }
```
Aplicar em `POST /client/profile/contact/request-change` e `POST /client/profile/contact/confirm-change`.

---

### `apps/api/src/modules/client-profile/client-profile.controller.ts` (controller, request-response)

**Analog:** `apps/api/src/modules/admin-clients/admin-clients.controller.ts`

**Padrão de imports e classe** (linhas 1–12 de admin-clients.controller.ts):
```typescript
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { UpdateProfileSchema, ContactChangeRequestSchema, ContactChangeConfirmSchema } from './client-profile.schema.js'
import { ClientProfileService } from './client-profile.service.js'

type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}

export class ClientProfileController {
  private service: ClientProfileService

  constructor(private fastify: FastifyInstance) {
    this.service = new ClientProfileService(fastify)
  }
```

**Padrão de role check CLIENT inline** (linhas 27–30 de admin-clients.controller.ts — adaptar role):
```typescript
async getProfile(request: FastifyRequest, reply: FastifyReply) {
  // Role check CLIENT inline
  if (request.user?.role !== 'CLIENT') {
    return reply.status(403).send({ error: 'Acesso negado' })
  }
  // userId sempre do JWT — nunca do body
  const result = await this.service.getProfile(request.user.id)
  return reply.status(200).send(result)
}
```

**Padrão de validação Zod + try/catch duplo** (linhas 32–48 de admin-clients.controller.ts):
```typescript
let body: ReturnType<typeof UpdateProfileSchema.parse>
try {
  body = UpdateProfileSchema.parse(request.body)
} catch (err) {
  if (err instanceof ZodError) {
    return reply.status(400).send({ error: zodMessage(err) })
  }
  return reply.status(400).send({ error: 'Dados inválidos.' })
}
try {
  const result = await this.service.updateProfile(request.user.id, body)
  if ('error' in result) {
    return reply.status(result.status).send({ error: result.error })
  }
  return reply.status(200).send(result)
} catch (err) {
  this.fastify.log.error(err)
  return reply.status(500).send({ error: 'Erro interno. Tente novamente.' })
}
```

**Padrão de userId extraído do JWT** (linha 90 de admin-clients.controller.ts):
```typescript
// T-10-02-01: adminId extraído do JWT — nunca do body
const result = await this.service.grantCredits(id, { ...body, adminId: request.user.id })
```
Adaptar para: `request.user.id` é sempre o userId do cliente autenticado.

---

### `apps/api/src/modules/client-profile/client-profile.service.ts` (service, CRUD)

**Analog:** `apps/api/src/modules/admin-clients/admin-clients.service.ts`

**Padrão de estrutura da classe** (linhas 21–26 de admin-clients.service.ts):
```typescript
export class ClientProfileService {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }
```

**Padrão de validação de existência de usuário com throw** (linhas 75–78 de admin-clients.service.ts):
```typescript
const user = await this.prisma.user.findUnique({ where: { id } })
if (!user || user.role !== 'CLIENT') {
  throw { statusCode: 404, message: 'Cliente não encontrado' }
}
```

**Padrão de verificação de conflito de contato** — análogo ao registro (linhas 103–110 de auth.service.ts):
```typescript
// Em requestContactChange:
if (phone) {
  const existing = await this.prisma.user.findFirst({ where: { phone } })
  if (existing && existing.id !== userId) {
    return { error: 'Este contato já está associado a outra conta.', status: 422 }
  }
}
```

**Padrão de sendOtp com purpose** — adaptar `auth.service.ts` linhas 28–51 para passar `purpose`:
```typescript
// Para CONTACT_CHANGE — repo.createOtp com purpose: 'CONTACT_CHANGE'
const devCode = process.env.OTP_DEV_CODE ?? '1234'
const code = this.generateOtpCode()
const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
await this.repo.createOtp({ userId, code: this.hashValue(code), channel, expiresAt, purpose: 'CONTACT_CHANGE' })
```

**Padrão de timingSafeEqual para OTP** (linhas 79–83 de auth.service.ts):
```typescript
const expectedHash = Buffer.from(this.hashValue(code), 'hex')
const actualHash = Buffer.from(otp.code, 'hex')
const match =
  expectedHash.length === actualHash.length && timingSafeEqual(expectedHash, actualHash)
if (!match) return { error: 'Código inválido', status: 401 }
```
Reutilizar exatamente este padrão no `confirmContactChange`.

**Padrão de desativação de agenda** — análogo a `prisma.schedule.findFirst` do admin-clients.service.ts (linhas 84–88):
```typescript
// Em updateProfile quando condominiumId muda:
await this.prisma.schedule.updateMany({
  where: { userId, isActive: true },
  data: { isActive: false },
})
```

---

### `apps/api/src/modules/client-profile/client-profile.repository.ts` (model, CRUD)

**Analog:** `apps/api/src/modules/admin-clients/admin-clients.repository.ts`

**Padrão base de classe** (linhas 1–9 de admin-clients.repository.ts):
```typescript
import { FastifyInstance } from 'fastify'

export class ClientProfileRepository {
  constructor(private fastify: FastifyInstance) {}

  private get prisma() {
    return this.fastify.prisma
  }
```

**Padrão de findById** (linhas 30–32 de admin-clients.repository.ts):
```typescript
findUserById(id: string) {
  return this.prisma.user.findUnique({ where: { id } })
}
```

**Padrão de updateUser com Prisma** (linhas 57–65 de admin-clients.repository.ts — toggleBlocked como modelo):
```typescript
updateProfile(id: string, data: { name?: string; birthDate?: Date; condominiumId?: string; apartment?: string; block?: string }) {
  return this.prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, birthDate: true, condominiumId: true, apartment: true, block: true },
  })
}
```

**Padrão de findActiveOtp com filtro de purpose** — adaptar `auth.repository.ts` linhas 32–37:
```typescript
// findActiveOtp para LOGIN (atualizar este método):
findActiveOtp(userId: string) {
  return this.prisma.otpCode.findFirst({
    where: {
      userId,
      usedAt: { isSet: false },
      expiresAt: { gt: new Date() },
      purpose: { in: [null, 'LOGIN'] },   // backward-compat: null = LOGIN legado
    },
    orderBy: { createdAt: 'desc' },
  })
}

// findActiveContactChangeOtp (novo método no ClientProfileRepository):
findActiveContactChangeOtp(userId: string) {
  return this.prisma.otpCode.findFirst({
    where: {
      userId,
      usedAt: { isSet: false },
      expiresAt: { gt: new Date() },
      purpose: 'CONTACT_CHANGE',
    },
    orderBy: { createdAt: 'desc' },
  })
}
```

**Padrão de deactivateSchedule**:
```typescript
deactivateSchedules(userId: string) {
  return this.prisma.schedule.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false },
  })
}
```

---

### `apps/api/src/modules/client-profile/client-profile.schema.ts` (utility, request-response)

**Analog:** `apps/api/src/modules/auth/auth.schema.ts`

**Padrão de imports e estrutura** (linhas 1–3 de auth.schema.ts):
```typescript
import { z } from 'zod'

export const UpdateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  birthDate: z.string().datetime().optional(),
  condominiumId: z.string().optional(),
  apartment: z.string().optional(),
  block: z.string().optional(),
  // CPF NUNCA aqui — imutável (CONF-03, Pitfall 3)
})
export type UpdateProfileBody = z.infer<typeof UpdateProfileSchema>
```

**Padrão de refine com phone/email opcional** (linhas 20–26 de auth.schema.ts):
```typescript
export const ContactChangeRequestSchema = z
  .object({
    phone: z.string().optional(),
    email: z.string().email().optional(),
  })
  .refine((d) => d.phone || d.email, { message: 'phone ou email obrigatório' })
export type ContactChangeRequestBody = z.infer<typeof ContactChangeRequestSchema>

export const ContactChangeConfirmSchema = z.object({
  code: z.string().length(4),
  // userId vem do JWT (request.user.id) — nunca do body
})
export type ContactChangeConfirmBody = z.infer<typeof ContactChangeConfirmSchema>
```

---

### `apps/api/prisma/schema.prisma` (config, CRUD)

**Analog:** si mesmo — arquivo existente a ser modificado

**Model OtpCode atual — campo purpose a adicionar** (da RESEARCH.md, verificado):
```prisma
model OtpCode {
  id        String    @id @default(auto()) @map("_id") @db.ObjectId
  userId    String    @db.ObjectId
  code      String
  channel   String
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())
  // ADICIONAR:
  purpose   String?   // null tratado como 'LOGIN' para backward-compat (A2)
}
```

---

### `apps/api/src/modules/auth/auth.repository.ts` (model, CRUD)

**Analog:** si mesmo — arquivo existente a ser modificado

**Método `findActiveOtp` atual** (linhas 32–37):
```typescript
findActiveOtp(userId: string) {
  return this.prisma.otpCode.findFirst({
    where: { userId, usedAt: { isSet: false }, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
}
```
Modificar para adicionar filtro de purpose:
```typescript
where: { userId, usedAt: { isSet: false }, expiresAt: { gt: new Date() }, purpose: { in: [null, 'LOGIN'] } },
```

**Método `createOtp` atual** (linhas 39–41):
```typescript
createOtp(data: { userId: string; code: string; channel: string; expiresAt: Date }) {
  return this.prisma.otpCode.create({ data })
}
```
Adicionar `purpose?: string` ao tipo do parâmetro.

---

### `apps/api/src/server.ts` (config, request-response)

**Analog:** si mesmo — arquivo existente a ser modificado

**Padrão de registro de rota** (linhas 159–186 — apenas adicionar uma linha):
```typescript
import { clientProfileRoute } from './modules/client-profile/client-profile.route.js'
// ...
await fastify.register(clientProfileRoute)  // Phase 11 — GET/PATCH /client/profile, POST contact/change
```
Adicionar após a linha do `courierRoute` (linha 186).

---

### `apps/web/src/pages/client/ScheduleScreen.tsx` (component, request-response)

**Analog:** si mesmo — arquivo existente a ser modificado (banner contextual D-19)

**Padrão de acesso ao user e estado condicional** (linhas 32–33):
```typescript
const { user } = useAuth()
```
Adicionar verificação de banner após o hook:
```typescript
// Banner de mudança de condomínio (D-19, CONF-06)
// condominiumJustChanged = true quando usuario mudou de condo e ainda não tem agenda ativa
const showCondoBanner = user?.condominiumJustChanged === true
```

**Padrão visual de banner** — usar o mesmo estilo do toast mas fixo no topo da tela abaixo do AppBar:
```typescript
{showCondoBanner && (
  <div style={{
    background: 'var(--color-gold)',
    color: 'var(--color-espresso)',
    padding: '10px 20px',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 13,
  }}>
    Você mudou de condomínio. Configure sua nova agenda semanal.
  </div>
)}
```

---

## Shared Patterns

### Autenticação JWT em todos os endpoints do módulo
**Fonte:** `apps/api/src/modules/credits/credits.route.ts` linhas 7–9
**Aplicar a:** todos os handlers de `client-profile.route.ts`
```typescript
preHandler: [fastify.authenticate],
```
O plugin `authenticate` popula `request.user` com `{ id, role }` extraídos do JWT Bearer.

### Role Check CLIENT inline
**Fonte:** `apps/api/src/modules/admin-clients/admin-clients.controller.ts` linhas 28–30 (adaptar role)
**Aplicar a:** todos os handlers de `client-profile.controller.ts`
```typescript
if (request.user?.role !== 'CLIENT') {
  return reply.status(403).send({ error: 'Acesso negado' })
}
```

### Padrão de Erro Zod
**Fonte:** `apps/api/src/modules/admin-clients/admin-clients.controller.ts` linhas 6–10
**Aplicar a:** `client-profile.controller.ts`
```typescript
type ZodIssue = { message: string }

function zodMessage(err: ZodError): string {
  return err.issues.map((e: ZodIssue) => e.message).join(', ')
}
```

### userId sempre do JWT
**Fonte:** `apps/api/src/modules/admin-clients/admin-clients.controller.ts` linha 90 (comentário T-10-02-01)
**Aplicar a:** todos os handlers de `client-profile.controller.ts`
```typescript
// userId extraído do JWT — nunca do body ou params
const userId = request.user.id
```

### apiFetch autenticado no frontend
**Fonte:** `apps/web/src/components/courier/ConfirmDeliveryDialog.tsx` linhas 2 e 27
**Aplicar a:** `SettingsScreen.tsx` e `ContactEditScreen.tsx`
```typescript
import { apiFetch } from '../../lib/apiFetch'
// ...
const res = await apiFetch('/client/profile', { method: 'PATCH', body: JSON.stringify(data) })
```

### Design visual — Campos de formulário
**Fonte:** `apps/web/src/components/auth/CondoSearch.tsx` linhas 38–44
```typescript
style={{
  background: 'var(--color-surface-alt)',
  border: `1.5px solid ${focused ? 'var(--color-accent)' : 'var(--color-border)'}`,
  borderRadius: 'var(--radius-field)',
  padding: '12px 14px',
  transition: 'border-color 0.15s ease',
}}
```

### Design visual — Botão primário (ação principal)
**Fonte:** `apps/web/src/components/courier/ConfirmDeliveryDialog.tsx` linhas 119–136
```typescript
style={{
  width: '100%',
  minHeight: 44,
  background: 'var(--color-espresso)',
  color: 'var(--color-primary-btn-text)',
  borderRadius: 'var(--radius-btn)',
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  fontWeight: 700,
  border: 'none',
  cursor: isLoading ? 'wait' : 'pointer',
  opacity: isLoading ? 0.6 : 1,
  transition: 'opacity 0.15s',
}}
```

### Design visual — Campo readonly (CPF imutável)
Não há análogo direto. Usar `disabled` + estilo diferenciado:
```typescript
<input
  readOnly
  value={cpf ?? ''}
  style={{
    opacity: 0.6,
    background: 'var(--color-surface-2)',
    border: '1.5px solid var(--color-border)',
    cursor: 'not-allowed',
    // mesmos padding/borderRadius dos outros campos
  }}
/>
```

---

## Sem Analógico Direto

| Arquivo | Role | Data Flow | Razão |
|---------|------|-----------|-------|
| — | — | — | Todos os arquivos têm analógico suficientemente próximo no codebase |

**Nota:** O campo `condominiumJustChanged: boolean` na interface `AuthUser` não tem precedente direto, mas segue o mesmo padrão de adição de campos opcionais já estabelecido pelo `creditBalance`. Ver seção de `AuthContext.tsx` acima.

---

## Metadata

**Escopo de busca de analógicos:**
- `apps/web/src/contexts/`
- `apps/web/src/components/client/`, `auth/`, `courier/`
- `apps/web/src/pages/client/`, `auth/`
- `apps/web/src/routes/`
- `apps/api/src/modules/auth/`
- `apps/api/src/modules/admin-clients/`
- `apps/api/src/modules/credits/`
- `apps/api/prisma/`
- `apps/api/src/server.ts`

**Arquivos escaneados:** 18
**Data do mapeamento:** 2026-06-19
