# Phase 8: Finalização Pagamentos — Pattern Map

**Mapeado:** 2026-06-18
**Arquivos analisados:** 12 arquivos a modificar/criar
**Análogos encontrados:** 12 / 12

---

## File Classification

| Arquivo Novo/Modificado | Role | Data Flow | Análogo Mais Próximo | Qualidade |
|-------------------------|------|-----------|----------------------|-----------|
| `apps/web/src/pages/client/HomeScreen.tsx` (modificar) | component | request-response | `apps/web/src/pages/client/CombosScreen.tsx` | exact |
| `apps/web/src/pages/client/CardPaymentScreen.tsx` (modificar) | component | request-response | `apps/web/src/pages/client/PixWaitingScreen.tsx` | exact |
| `apps/web/src/pages/client/PixWaitingScreen.tsx` (modificar) | component | request-response | próprio arquivo — apenas texto do estado rejected | — |
| `apps/web/src/pages/client/CombosScreen.tsx` (modificar) | component | request-response | próprio arquivo — verificação apenas | — |
| `apps/web/src/pages/client/ClientLayout.tsx` (modificar) | layout | event-driven | `apps/web/src/hooks/useOneSignalRegister.ts` | role-match |
| `apps/web/src/hooks/useOneSignalDeepLink.ts` (criar) | hook | event-driven | `apps/web/src/hooks/useOneSignalRegister.ts` | exact |
| `apps/api/src/plugins/cron.ts` (modificar) | service | batch | próprio arquivo — adicionar nova chamada no cron de meia-noite | — |
| `apps/api/src/modules/schedules/schedules.service.ts` (modificar) | service | batch | próprio arquivo — adicionar `sendLowCreditNotifications` | — |
| `apps/api/src/modules/schedules/__tests__/schedules.service.test.ts` (modificar) | test | — | `apps/api/src/modules/webhooks/__tests__/webhooks.service.test.ts` | exact |
| `apps/api/src/modules/schedules/schedules.service.ts` — fix `processAutoBuy` URL | service | batch | próprio arquivo — bug fix em `notification.url` | — |
| `.planning/phases/03-credits-commerce/03-03-PLAN.md` (auditar) | — | — | — | — |
| `.planning/phases/03-credits-commerce/03-05-PLAN.md` (auditar) | — | — | — | — |
| `.planning/phases/03-credits-commerce/03-06-PLAN.md` (auditar) | — | — | — | — |

---

## Pattern Assignments

### `apps/web/src/pages/client/HomeScreen.tsx` — adicionar BannerInsuficiente + NextDays reais

**Análogo:** `apps/web/src/pages/client/CombosScreen.tsx`

**Imports pattern** (linhas 1-7 de HomeScreen.tsx — adicionar):
```tsx
import BannerInsuficiente from '../../components/client/BannerInsuficiente'
import { useSchedule } from '../../hooks/useSchedule'
```

**Padrão de uso do BannerInsuficiente** (CombosScreen.tsx linhas 229-236):
```tsx
// Renderização condicional — requerido > saldo
{creditBalance < requiredCredits && requiredCredits > 0 && (
  <BannerInsuficiente
    saldo={creditBalance}
    requerido={requiredCredits}
    onComprar={() => setTab('combos')}
    onAjustar={(qtd) => setCustomQty(qtd)}
  />
)}
```

**Padrão de uso na HomeScreen** — a criar entre TodayDelivery e QuickActions:
```tsx
// HomeScreen.tsx — após CreditBalanceCard, antes do TodayDelivery
{(user?.creditBalance ?? 0) === 0 && (
  <BannerInsuficiente
    saldo={0}
    requerido={1}
    onComprar={() => navigate('/client/creditos')}
    onAjustar={() => {}}   // noop na Home — botão "Usar 0" sem efeito aqui
  />
)}
```

**Nota:** `BannerInsuficiente` não aceita prop `hideAjustar` atualmente. O executor pode: (a) adicionar a prop ao componente, ou (b) usar `onAjustar={() => {}}` como noop e ocultar o botão via CSS/style inline se necessário. Decisão é do executor (Claude's Discretion).

**Padrão de NextDays com dados reais** — baseado em `useSchedule` (useSchedule.ts linhas 56-136):
```tsx
// Importar WeeklyQty do hook existente
import { useSchedule, WeeklyQty } from '../../hooks/useSchedule'

// Dentro do componente HomeScreen:
const { weeklyQty, isLoading: scheduleLoading } = useSchedule(user?.creditBalance ?? 0)

// Mapeamento de índice do dia da semana para chave WeeklyQty
// Mesmo padrão de DAY_OF_WEEK_MAP do schedules.service.ts (linhas 8-16)
const DAY_KEY_MAP: Record<number, keyof WeeklyQty> = {
  0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab',
}
const DAY_ABBR: Record<keyof WeeklyQty, string> = {
  seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb', dom: 'Dom',
}

// Próximos 5 dias a partir de amanhã
const nextDays = Array.from({ length: 5 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() + i + 1)
  const key = DAY_KEY_MAP[d.getDay()]
  return { abbr: DAY_ABBR[key], qty: weeklyQty[key] ?? 0, key }
})
```

**Padrão de fetch com apiFetch** (CombosScreen.tsx linhas 40-65):
```tsx
useEffect(() => {
  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [combosRes, pricingRes] = await Promise.all([
        apiFetch('/combos'),
        apiFetch('/pricing'),
      ])
      // ...
    } catch {
      setError('Não foi possível carregar. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }
  load()
}, [])
```

---

### `apps/web/src/hooks/useOneSignalDeepLink.ts` (criar)

**Análogo:** `apps/web/src/hooks/useOneSignalRegister.ts`

**Imports pattern** (useOneSignalRegister.ts linhas 13-14):
```typescript
import { useEffect } from 'react'
// Sem import de OneSignal do package — usa window.OneSignal para evitar duplo-init
```

**Padrão de listener/cleanup OneSignal via window** (useOneSignalRegister.ts linhas 28-71):
```typescript
export function useOneSignalDeepLink(): void {
  // Dependência: useNavigate() — chamado DENTRO de um componente/hook React com router context
  const navigate = useNavigate()

  useEffect(() => {
    if (typeof window === 'undefined') return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const OS = (window as any).OneSignal
    if (!OS) return

    const handleClick = (event: any) => {
      const screen = event?.notification?.additionalData?.screen
      if (screen === 'creditos') navigate('/client/creditos')
    }

    try {
      OS?.Notifications?.addEventListener?.('click', handleClick)
    } catch {
      // Silencioso — API pode não estar disponível
    }

    return () => {
      try {
        OS?.Notifications?.removeEventListener?.('click', handleClick)
      } catch {
        // Silencioso
      }
    }
  }, [navigate])
}
```

**Onde chamar** — dentro do `ClientLayout.tsx` (ClientLayout.tsx linha 11, padrão de `useOneSignalRegister`):
```tsx
// ClientLayout.tsx — adicionar ao lado de useOneSignalRegister():
useOneSignalRegister()
useOneSignalDeepLink()   // novo — deep link handler para push com additionalData.screen
```

**Anti-pattern a evitar** (RESEARCH.md Pitfall 4): NÃO registrar o listener em `main.tsx` (fora do router context) — `useNavigate` não estaria disponível.

---

### `apps/api/src/modules/schedules/schedules.service.ts` — adicionar `sendLowCreditNotifications`

**Análogo:** próprio arquivo — padrão de `sendEveReminders` (linhas 169-218)

**Imports pattern** (linhas 1-5 — já presentes, nenhum import novo):
```typescript
import { FastifyInstance } from 'fastify'
import * as OneSignal from '@onesignal/node-onesignal'
import { SchedulesRepository } from './schedules.repository.js'
import { ScheduleBody, WeeklyQty } from './schedules.schema.js'
import { NotificationsService } from '../notifications/notifications.service.js'
```

**Padrão de criação do osClient** (linhas 35-40 — função `createOsClient`):
```typescript
function createOsClient() {
  const configuration = OneSignal.createConfiguration({
    restApiKey: process.env.ONESIGNAL_REST_API_KEY!,
  })
  return new OneSignal.DefaultApi(configuration)
}
```

**Padrão de push OneSignal com additionalData** — baseado em `sendReconfigureReminders` (linhas 155-165) e adaptando para deep link:
```typescript
const osClient = createOsClient()
const notification = new OneSignal.Notification()
notification.app_id = process.env.ONESIGNAL_APP_ID!
notification.include_subscription_ids = [user.oneSignalPlayerId]
notification.headings = { 'pt-BR': 'Seus créditos estão acabando' }
notification.contents = {
  'pt-BR': `Você tem ${user.creditBalance} crédito(s) e sua semana precisa de ${consumoSemanal}. Recarregue agora!`,
}
notification.additionalData = { screen: 'creditos' }  // deep link — D-11
await osClient.createNotification(notification)
```

**Padrão de try/catch silencioso em push** (linhas 201-208):
```typescript
try {
  // ... push
} catch (pushErr) {
  // D-06: falha de push é silenciosa
  this.fastify.log.warn(
    { userId: order.userId, err: pushErr },
    '[schedules] falha ao enviar push de véspera — silencioso',
  )
}
```

**Padrão de cálculo do consumoSemanal** (processAutoBuy, linhas 242-247):
```typescript
// Já existente em processAutoBuy — reutilizar a mesma lógica:
const weeklyQty = schedule.weeklyQty as WeeklyQty
const consumoSemanal = Object.values(weeklyQty).reduce(
  (sum: number, v) => sum + (v as number),
  0,
)
```

**Padrão de persistência de Notification** (sendEveReminders, linhas 211-217):
```typescript
await this.notificationsService.createAndTrim({
  userId: order.userId,
  type: 'DELIVERY_EVE',
  title: 'Entrega amanhã',
  body: `Lembrete: ${order.quantity} pães agendados para amanhã.`,
})
```

**Estrutura da nova função** — model exato:
```typescript
async sendLowCreditNotifications(): Promise<void> {
  const schedules = await this.prisma.schedule.findMany({
    where: { isActive: true },
  })

  for (const schedule of schedules) {
    try {
      const user = await this.repo.findUserById(schedule.userId)
      if (!user) continue

      // Usuários com auto-recharge ativo não precisam da notificação (D-10)
      const autoRecharge = user.autoRecharge as any
      if (autoRecharge?.active) continue

      // Calcular consumo semanal (padrão já existente em processAutoBuy, linha 243)
      const weeklyQty = schedule.weeklyQty as WeeklyQty
      const consumoSemanal = Object.values(weeklyQty).reduce(
        (sum: number, v) => sum + (v as number), 0,
      )
      if (consumoSemanal === 0) continue
      if (user.creditBalance >= consumoSemanal) continue

      // Enviar push de crédito insuficiente (D-11)
      if (user.oneSignalPlayerId) {
        try {
          const osClient = createOsClient()
          const notification = new OneSignal.Notification()
          notification.app_id = process.env.ONESIGNAL_APP_ID!
          notification.include_subscription_ids = [user.oneSignalPlayerId]
          notification.headings = { 'pt-BR': 'Seus créditos estão acabando' }
          notification.contents = {
            'pt-BR': `Você tem ${user.creditBalance} crédito(s) e sua semana precisa de ${consumoSemanal}. Recarregue agora!`,
          }
          notification.additionalData = { screen: 'creditos' }
          await osClient.createNotification(notification)
        } catch (pushErr) {
          this.fastify.log.warn(
            { userId: schedule.userId, err: pushErr },
            '[schedules] falha ao enviar push de crédito insuficiente',
          )
        }
      }

      // Persistir Notification (padrão de sendEveReminders, linha 211)
      await this.notificationsService.createAndTrim({
        userId: schedule.userId,
        type: 'LOW_CREDIT',
        title: 'Créditos insuficientes',
        body: `Você tem ${user.creditBalance} crédito(s) e sua semana precisa de ${consumoSemanal}.`,
      })
    } catch (err) {
      this.fastify.log.error(
        { scheduleId: schedule.id, err },
        '[schedules] erro ao processar sendLowCreditNotifications',
      )
    }
  }
}
```

**Fix obrigatório no `processAutoBuy`** — linha 271 tem URL inexistente:
```typescript
// Linha 271 ATUAL (bug):
notification.url = '/client/comprar'

// Linha 271 CORRETO (D-17/D-18):
notification.url = '/client/creditos'
```

---

### `apps/api/src/plugins/cron.ts` — adicionar `sendLowCreditNotifications` no cron de meia-noite

**Análogo:** próprio arquivo — padrão de `processAutoBuy` nas linhas 31-36

**Padrão de adicionar nova chamada no cron de meia-noite** (cron.ts linhas 19-38):
```typescript
// Adicionar APÓS o bloco de processAutoBuy existente (linhas 30-35):
try {
  await schedulesService.sendLowCreditNotifications()
  fastify.log.info('[cron] sendLowCreditNotifications concluído')
} catch (err) {
  fastify.log.error({ err }, '[cron] erro em sendLowCreditNotifications — servidor mantido ativo')
}
```

**Padrão de log no cron** (cron.ts linha 21):
```typescript
fastify.log.info('[cron] iniciando createDailyOrders + processAutoBuy')
// → atualizar para:
fastify.log.info('[cron] iniciando createDailyOrders + processAutoBuy + sendLowCreditNotifications')
```

---

### `apps/web/src/pages/client/CardPaymentScreen.tsx` — fix botão back

**Análogo:** `apps/web/src/pages/client/PixWaitingScreen.tsx` — padrão de layout de header

**Padrão de botão back com Icon** (padrão do projeto em `CombosScreen.tsx` e `HomeScreen.tsx`):
```tsx
// Substituir o botão back literal "←" (CardPaymentScreen.tsx linha 76-85)
// DE:
<button
  onClick={() => navigate('/client/creditos')}
  style={{ /* ... */ fontSize: 18 }}
>
  ←
</button>

// PARA (usando Icon, padrão do projeto):
<button
  onClick={() => navigate('/client/creditos')}
  style={{
    minHeight: 44,
    width: 44,
    borderRadius: 'var(--radius-btn)',
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-surface)',
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
  }}
  aria-label="Voltar"
>
  <Icon name="arrowL" size={20} color="var(--color-text)" />
</button>
```

**Import necessário** (padrão de HomeScreen.tsx linha 6):
```tsx
import { Icon } from '../../components/brand/Icon'
```

---

### `apps/api/src/modules/schedules/__tests__/schedules.service.test.ts` — adicionar teste para `sendLowCreditNotifications`

**Análogo:** `apps/api/src/modules/webhooks/__tests__/webhooks.service.test.ts`

**Imports pattern** (webhooks.service.test.ts linhas 1-8):
```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
```

**Mock do OneSignal** (schedules.service.test.ts linhas 8-21 — já existe no arquivo):
```typescript
vi.mock('@onesignal/node-onesignal', () => {
  const createNotificationMock = vi.fn().mockResolvedValue({})
  return {
    createConfiguration: vi.fn().mockReturnValue({}),
    DefaultApi: vi.fn().mockImplementation(() => ({ createNotification: createNotificationMock })),
    Notification: vi.fn().mockImplementation(() => ({
      app_id: '',
      include_subscription_ids: [],
      headings: {},
      contents: {},
      additionalData: {},  // adicionar para testar deep link
    })),
    _createNotificationMock: createNotificationMock,
  }
})
```

**Padrão de mock do FastifyInstance** (schedules.service.test.ts linhas 50-80 — já existe, reutilizar `createMockFastify`):
```typescript
// Casos de teste a adicionar no describe existente ou em novo describe:
describe('sendLowCreditNotifications [CRED-09]', () => {
  it('envia push quando saldo < consumoSemanal e sem auto-recharge', async () => {
    // mock: user com creditBalance=2, schedule com weeklyQty total=5, sem autoRecharge
  })
  it('NAO envia push quando auto-recharge ativo', async () => {
    // mock: user com autoRecharge.active=true
  })
  it('NAO envia push quando saldo suficiente', async () => {
    // mock: user.creditBalance >= consumoSemanal
  })
  it('NAO envia push quando sem oneSignalPlayerId', async () => {
    // mock: user.oneSignalPlayerId = null
  })
})
```

**Padrão de idempotência nos testes** (webhooks.service.test.ts linhas 148-158):
```typescript
it('idempotencia: pagamento ja PAID nao consulta o MP nem credita de novo', async () => {
  vi.mocked(fastify.prisma.payment.findUnique).mockResolvedValue({
    id: 'pay-d', status: 'PAID', userId: 'u-d', customQuantity: 5, comboId: null,
  } as never)
  // ...
  expect(mockPaymentGet).not.toHaveBeenCalled()
})
```

---

## Padrões Compartilhados

### 1. apiFetch — wrapper de fetch autenticado
**Fonte:** `apps/web/src/lib/apiFetch.ts`
**Aplicar em:** todos os hooks e componentes que fazem chamadas à API
```typescript
// Padrão de uso (de usePaymentPolling.ts linha 17, useOrderTracking.ts linha 17, CombosScreen.tsx linhas 46-47):
import { apiFetch } from '../../lib/apiFetch'
// ou
import { apiFetch } from '../lib/apiFetch'

const res = await apiFetch('/schedules/me')    // GET — autenticado via JWT do localStorage
const res = await apiFetch('/payments/pix', {  // POST com body
  method: 'POST',
  body: JSON.stringify({ comboId }),
})
```

### 2. updateCreditBalance — atualização de saldo sem re-fetch
**Fonte:** `apps/web/src/contexts/AuthContext.tsx` linhas 74-86
**Aplicar em:** `PixWaitingScreen.tsx` (já usa), `HomeScreen.tsx` (verificar)
```typescript
// Atualiza saldo no AuthContext E no localStorage sem re-fetch do usuário inteiro
const { updateCreditBalance } = useAuth()

// Chamado após polling confirmar 'approved':
onCreditUpdate(data.creditBalance ?? 0)   // → updateCreditBalance(newBalance)
```

### 3. Push OneSignal — padrão de criação de notificação
**Fonte:** `apps/api/src/modules/schedules/schedules.service.ts` linhas 155-165
**Aplicar em:** `sendLowCreditNotifications` (nova função) e verificação do `processAutoBuy`
```typescript
const osClient = createOsClient()  // função local no arquivo, linhas 35-40
const notification = new OneSignal.Notification()
notification.app_id = process.env.ONESIGNAL_APP_ID!
notification.include_subscription_ids = [user.oneSignalPlayerId]
notification.headings = { 'pt-BR': '...' }  // nota: usar 'pt-BR' não 'pt' (padrão mais correto)
notification.contents = { 'pt-BR': '...' }
notification.url = '/client/creditos'         // para navegação via URL
// OU:
notification.additionalData = { screen: 'creditos' }  // para handler customizado (D-11)
await osClient.createNotification(notification)
```

### 4. Cron — padrão de try/catch isolado por operação
**Fonte:** `apps/api/src/plugins/cron.ts` linhas 22-35
**Aplicar em:** qualquer nova chamada adicionada ao cron de meia-noite
```typescript
// Cada operação do cron é isolada em seu próprio try/catch
// Falha em uma operação NÃO impede as outras de rodar
try {
  await schedulesService.sendLowCreditNotifications()
  fastify.log.info('[cron] sendLowCreditNotifications concluído')
} catch (err) {
  fastify.log.error({ err }, '[cron] erro em sendLowCreditNotifications — servidor mantido ativo')
}
```

### 5. Icon — componente de ícone do projeto
**Fonte:** `apps/web/src/components/brand/Icon.tsx`
**Aplicar em:** `CardPaymentScreen.tsx` (fix do botão back), qualquer novo elemento de UI
```tsx
import { Icon } from '../../components/brand/Icon'

// Uso padrão:
<Icon name="arrowL" size={20} color="var(--color-text)" />
<Icon name="alert" size={20} color="var(--color-accent)" />
<Icon name="coin" size={22} stroke={2.2} color="var(--color-gold)" />
```

### 6. Polling com cleanup — padrão de setInterval + clearInterval
**Fonte:** `apps/web/src/hooks/useOrderTracking.ts` linhas 16-34
**Aplicar em:** verificação do `useOrderTracking` (já implementado — padrão de referência)
```typescript
useEffect(() => {
  const fetchOrder = async () => { /* ... */ }

  void fetchOrder()
  const id = setInterval(() => { void fetchOrder() }, 30_000)
  return () => clearInterval(id)   // cleanup obrigatório — evita memory leak
}, [])
```

### 7. Mock Fastify nos testes de serviço
**Fonte:** `apps/api/src/modules/webhooks/__tests__/webhooks.service.test.ts` linhas 31-42
**Aplicar em:** qualquer novo teste de service
```typescript
function createMockFastify(overrides: Record<string, unknown> = {}): FastifyInstance {
  return {
    prisma: {
      payment: { findUnique: vi.fn(), update: vi.fn() },
      user: { update: vi.fn() },
      creditTransaction: { create: vi.fn() },
      combo: { findUnique: vi.fn() },
      $transaction: vi.fn().mockResolvedValue([{}, {}]),
      ...overrides,
    },
  } as unknown as FastifyInstance
}
```

---

## Insights Críticos para Auditoria (Wave 0/1)

### Confirmado: `creditUserBalance` USA `$transaction`
**Fonte:** `apps/api/src/modules/payments/payments.repository.ts` linhas 35-52

O método `creditUserBalance` **já usa `$transaction`** — `CreditTransaction.create` + `User.update` são atômicos. O risco de duplo crédito identificado no RESEARCH.md (A2) **não existe**. O `updatePaymentStatus` fora da transação é o único risco residual (janela de falha entre crédito e marcação PAID), mas é improvável dado que são operações rápidas e a idempotência do webhook garante que pagamentos PAID não são reprocessados.

### Confirmado: testes de `webhooks.service.test.ts` cobrem `customQuantity`
**Fonte:** `apps/api/src/modules/webhooks/__tests__/webhooks.service.test.ts` linhas 71-88

O caso `APROVADO (customQuantity)` existe e testa `customQuantity: 5, comboId: null` → crédito de 5. O Pitfall 1 da RESEARCH.md está **resolvido** nos testes.

### Bug confirmado: `processAutoBuy` URL `/client/comprar` não existe
**Fonte:** `apps/api/src/modules/schedules/schedules.service.ts` linha 271

`notification.url = '/client/comprar'` — esta rota não existe no `router.tsx`. Deve ser corrigida para `/client/creditos`. Correção simples de uma linha.

### Chave de locale nas notificações: `'pt'` vs `'pt-BR'`
**Fonte:** `schedules.service.ts` linhas 89-90 (`{ pt: '...' }`) vs RESEARCH.md pattern (`{ 'pt-BR': '...' }`)

O código existente usa `{ pt: '...' }` (chave abreviada). A nova função `sendLowCreditNotifications` deve seguir o mesmo padrão do código existente (`pt`) para consistência, a menos que haja razão explícita para mudar.

---

## Arquivos sem Análogo Novo

Não há arquivos com papel completamente novo nesta fase. Todos os padrões têm análogos diretos no codebase existente.

---

## Metadata

**Escopo da busca de análogos:** `apps/api/src/modules/`, `apps/api/src/plugins/`, `apps/web/src/pages/client/`, `apps/web/src/hooks/`, `apps/web/src/components/client/`, `apps/web/src/contexts/`
**Arquivos lidos:** 18
**Data do mapeamento:** 2026-06-18
