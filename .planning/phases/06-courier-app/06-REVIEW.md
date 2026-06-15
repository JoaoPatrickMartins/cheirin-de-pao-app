---
phase: 06-courier-app
reviewed: 2026-06-15T16:15:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - apps/api/src/modules/courier/courier.controller.ts
  - apps/api/src/modules/courier/courier.repository.ts
  - apps/api/src/modules/courier/courier.route.ts
  - apps/api/src/modules/courier/courier.schema.ts
  - apps/api/src/modules/courier/courier.service.ts
  - apps/api/src/modules/courier/__tests__/courier.service.test.ts
  - apps/web/src/components/courier/CondoAccordion.tsx
  - apps/web/src/components/courier/ConfirmDeliveryDialog.tsx
  - apps/web/src/components/courier/CourierMap.tsx
  - apps/web/src/components/courier/ProgressCard.tsx
  - apps/web/src/components/courier/SegmentedControl.tsx
  - apps/web/src/components/courier/StopRow.tsx
  - apps/web/src/main.tsx
  - apps/web/src/pages/courier/CourierRouteView.tsx
  - apps/web/src/pages/courier/CourierScreen.tsx
findings:
  critical: 4
  warning: 5
  info: 3
  total: 12
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-06-15T16:15:00Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Revisao do modulo courier (backend + frontend) da Fase 6. O modulo implementa rota do entregador com listagem de ordens do dia agrupadas por condominio e confirmacao de entregas. A arquitetura de seguranca (courierId extraido do JWT, guards `authenticate`+`requireCourier`) esta correta e bem executada.

Foram encontrados 4 blockers criticos:

1. **O Prisma client nao foi regenerado** apos adicao do campo `courierId` ao modelo `Order` — o campo existe no `schema.prisma` fonte mas nao no client gerado; toda a logica central do modulo (filtro de ordens por courier, confirmacao de ownership) quebra em runtime com erro do Prisma.
2. **`courier.service.ts` acessa `order.condominiumId`, `order.apartment` e `order.block` diretamente no objeto `Order`**, mas esses campos nao pertencem ao modelo `Order` — eles estao no modelo `User`. O servico precisaria buscar o usuario e obter esses dados de la.
3. **Nominatim geocode disparado em paralelo** via `Promise.all` — viola a politica de uso da API publica (maximo 1 req/s).
4. **`geocodeCache` e instancia-nivel** (nao singleton) — como `CourierController` e instanciado uma vez no registro da rota, o cache funciona por processo mas perde efetividade se o servico for instanciado multiplas vezes (ex.: testes, multiplos workers).

---

## Critical Issues

### CR-01: Prisma client desatualizado — `courierId` ausente no client gerado

**File:** `apps/api/src/modules/courier/courier.repository.ts:25`
**Issue:** O campo `courierId` foi adicionado ao modelo `Order` em `apps/api/prisma/schema.prisma` (linha 203), mas o Prisma client gerado em `node_modules/.prisma/client/schema.prisma` nao contem esse campo. A query `findMany` com `where: { courierId }` usa um campo que nao existe no client gerado — o Prisma lancara `PrismaClientValidationError` em runtime invalidando toda a rota `GET /courier/orders/today`. Do mesmo modo, `findById` retorna um objeto sem `courierId`, quebrando a verificacao de ownership em `courier.service.ts:247`.

**Fix:** Executar `prisma generate` (e possivelmente `prisma db push` para MongoDB Atlas) apos a adicao do campo:

```bash
cd apps/api
npx prisma generate
npx prisma db push   # sincroniza o schema com o Atlas em dev
```

O campo correto no `schema.prisma`:
```prisma
model Order {
  ...
  courierId      String?     @db.ObjectId   // ja esta presente — so falta regenerar
  ...
}
```

---

### CR-02: `courier.service.ts` acessa `condominiumId`, `apartment`, `block` no modelo `Order` — campos inexistentes

**File:** `apps/api/src/modules/courier/courier.service.ts:84-100`
**Issue:** O modelo `Order` nao possui os campos `condominiumId`, `apartment` nem `block`. Esses campos pertencem ao modelo `User` (conforme `schema.prisma` linhas 112-114). Ao fazer o cast `order as Record<string, unknown>` e acessar `order.condominiumId`, `order.apartment` e `order.block`, o servico obtera `undefined` para todos eles. Consequencias:
- `condominiumId` sera `'unknown'` para todas as orders.
- `apartment` sera `''` e `sortKey` sera `NaN` -> `9999` para todas as stops.
- `block` sera sempre `null`.
- A busca por `condominium` nunca sera executada pois `order.condominiumId` e sempre falsy.

Todo o agrupamento por condominio e ordenacao por apartamento falha silenciosamente.

**Fix:** Buscar `condominiumId`, `apartment` e `block` do usuario da order, nao da order em si:

```typescript
const [user, condominium] = await Promise.all([
  this.prisma.user.findUnique({
    where: { id: order.userId as string },
    select: { id: true, name: true, condominiumId: true, apartment: true, block: true },
  }),
  // condominium lookup apos ter o user
])

// Depois de obter user:
const userCondoId = user?.condominiumId ?? null
const condominium = userCondoId
  ? await this.prisma.condominium.findUnique({
      where: { id: userCondoId },
      select: { id: true, name: true, address: true },
    })
  : null

const sortKey = parseInt(user?.apartment ?? '9999', 10)
return {
  ...
  condominiumId: userCondoId ?? 'unknown',
  apartment: user?.apartment ?? '',
  block: user?.block ?? null,
  ...
}
```

---

### CR-03: Chamadas Nominatim disparadas em paralelo — violacao da politica de uso

**File:** `apps/api/src/modules/courier/courier.service.ts:137-188`
**Issue:** A geocodificacao via Nominatim e executada dentro de `Promise.all(Array.from(condoMap.values()).map(...))`, o que dispara todas as requisicoes simultaneamente. A [Usage Policy do Nominatim](https://operations.osmfoundation.org/policies/nominatim/) limita a **1 request/segundo** por IP. Com N condominios, N requisicoes serao feitas em paralelo, violando o rate limit. Isso causara bloqueio do IP do servidor pela OSM — todos os entregadores perderao geocodificacao.

O cache em memoria (`geocodeCache`) mitiga chamadas repetidas na mesma instancia do processo, mas nao protege contra parallelismo dentro de uma unica chamada com N condominios novos.

**Fix:** Serializar as chamadas ao Nominatim com delay entre elas:

```typescript
// Geocodificacao sequencial com throttle para respeitar 1 req/s
const condosArray = Array.from(condoMap.values())
const condos: typeof condosArray = []

for (const condo of condosArray) {
  condo.stops.sort((a, b) => a.sortKey - b.sortKey)
  
  if (condo.address) {
    const cached = this.geocodeCache.get(condo.address)
    if (cached !== undefined) {
      condo.lat = cached?.lat ?? null
      condo.lng = cached?.lng ?? null
    } else {
      try {
        // Delay de 1.1s entre chamadas para respeitar rate limit Nominatim
        await new Promise((resolve) => setTimeout(resolve, 1100))
        const url = `https://api.nominatim.openstreetmap.org/search?q=${encodeURIComponent(condo.address)}&format=json&limit=1`
        const res = await fetch(url, { headers: { 'User-Agent': 'CheirimdePao-app/1.0 (contato@cheirindepao.com.br)' } })
        const data = await res.json() as Array<{ lat: string; lon: string }>
        if (data.length > 0) {
          const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
          this.geocodeCache.set(condo.address, coords)
          condo.lat = coords.lat
          condo.lng = coords.lng
        } else {
          this.geocodeCache.set(condo.address, null)
        }
      } catch {
        this.geocodeCache.set(condo.address, null)
      }
    }
  }
  condos.push({ ...condo, stops: condo.stops.map(mapStop) })
}
```

Alternativa melhor a medio prazo: persistir `lat`/`lng` no modelo `Condominium` e eliminara a necessidade de geocodificacao em tempo de requisicao.

---

### CR-04: Ownership check ignora caso `order.courierId === null`

**File:** `apps/api/src/modules/courier/courier.service.ts:247`
**Issue:** A verificacao `if (order.courierId !== courierId)` retorna `403` para ordens onde `courierId` e `null` (nao atribuidas). Isso e o comportamento correto. **Porem**, o campo `courierId` no modelo `Order` e `String?` (nullable) no schema. Com o Prisma client desatualizado (CR-01), `order.courierId` sera sempre `undefined` em runtime. Quando CR-01 for corrigido, o comportamento sera correto — mas o codigo precisa de um comentario explicito de que o `null !== 'courier-id'` e intencional e nao um bug oculto. Alem disso, se `order.courierId` for `null`, o `status` ainda pode ser `SCHEDULED` (nao `OUT_FOR_DELIVERY`), o que significa que o `AdminOrdersService.updateOrderStatus` lancara `422` de qualquer forma — mas a mensagem de erro ao entregador seria enganosa (403 "nao pertence a voce" em vez de "nao atribuida a voce").

**Fix:** Distinguir entre "order nao atribuida" e "order atribuida a outro entregador":

```typescript
if (order.courierId === null || order.courierId === undefined) {
  throw { statusCode: 403, message: 'Este pedido nao esta atribuido a nenhum entregador' }
}
if (order.courierId !== courierId) {
  throw { statusCode: 403, message: 'Acesso negado: esta entrega nao pertence a voce' }
}
```

---

## Warnings

### WR-01: `CourierMap` recebe `durationMin` mas nunca o usa

**File:** `apps/web/src/components/courier/CourierMap.tsx:10,33`
**Issue:** O prop `durationMin: number` e declarado na interface `CourierMapProps` e desestruturado no componente, mas nunca e referenciado no JSX retornado. O tooltip exibe apenas `distanceKm` e `waypoints.length`. Prop morto — causa confusao sobre o que o mapa renderiza.

**Fix:** Adicionar `durationMin` ao tooltip ou remover o prop da interface e do componente:

```tsx
// Opcao 1: exibir no tooltip
<span ...>
  ~{distanceKm} km · ~{durationMin} min · {waypoints.length} {waypoints.length === 1 ? 'parada' : 'paradas'}
</span>

// Opcao 2: remover da interface e do componente se nao for necessario
interface CourierMapProps {
  waypoints: Array<{ lat: number; lng: number; name: string; order: number }>
  geometry: Array<[number, number]>
  distanceKm: string
  // durationMin removido
}
```

---

### WR-02: `ConfirmDeliveryDialog` nao diferencia erros HTTP — mensagem generica para 403/422

**File:** `apps/web/src/components/courier/ConfirmDeliveryDialog.tsx:28-35`
**Issue:** Quando `res.ok` e false, o dialog exibe sempre "Falha na conexao. Tente novamente." independente do status HTTP. Um `403` (entrega de outro entregador) ou `422` (transicao invalida — pedido ja entregue) sao erros de negocio, nao de rede. O usuario nao saberao o que aconteceu.

**Fix:**

```typescript
if (res.ok) {
  onConfirmed(stop.orderId)
} else {
  const body = await res.json().catch(() => ({})) as { error?: string }
  if (res.status === 403) {
    setError('Sem permissao para confirmar esta entrega.')
  } else if (res.status === 422) {
    setError('Este pedido ja foi entregue ou nao pode ser confirmado agora.')
  } else if (res.status >= 500) {
    setError('Erro no servidor. Tente novamente.')
  } else {
    setError(body.error ?? 'Falha na operacao. Tente novamente.')
  }
}
```

---

### WR-03: `CourierScreen` silencia erros de rede sem feedback ao usuario

**File:** `apps/web/src/pages/courier/CourierScreen.tsx:55-57`
**Issue:** O bloco `catch` do `fetchData` e vazio (comentario apenas). Se a requisicao falhar (rede offline, 401, 500), o componente sai do estado `isLoading` com `data === null` sem nenhum estado de erro. O usuario ve uma tela em branco apos o loading sem entender o que aconteceu.

**Fix:**

```typescript
const [error, setError] = useState<string | null>(null)

// No catch:
} catch {
  setError('Nao foi possivel carregar as entregas. Verifique sua conexao.')
} finally {
  setIsLoading(false)
}

// No JSX:
{!isLoading && !data && error && (
  <div style={{ padding: '40px 20px', textAlign: 'center' }}>
    <p style={{ color: 'var(--color-destructive)', fontFamily: 'var(--font-body)', fontSize: 15 }}>
      {error}
    </p>
  </div>
)}
```

---

### WR-04: `getTodayRange` duplicado entre `courier.service.ts` e `orders.service.ts` — risco de divergencia

**File:** `apps/api/src/modules/courier/courier.service.ts:10-26`
**Issue:** A funcao `getTodayRange` e identica em `courier.service.ts` e `orders.service.ts`. O comentario no codigo aceita a duplicacao como "aceitavel no MVP (Assumption A4)". Entretanto, o calculo de `end` em `courier.service.ts` linha 24 usa `BRAZIL_OFFSET_HOURS - 1` (= 2), enquanto `orders.service.ts` linha 42 usa o mesmo valor — ambos corretos. O risco e real: uma correcao futura em um arquivo nao propagara para o outro, causando janelas de tempo diferentes entre os dois modulos.

**Fix:** Extrair para um modulo compartilhado:

```typescript
// apps/api/src/lib/timezone.ts
export function getTodayRangeBRT(): { start: Date; end: Date } { ... }
```

E importar em ambos os services.

---

### WR-05: `CourierRouteView` exibe condominio sem coordenadas na lista mas nao no mapa — inconsistencia de dados

**File:** `apps/web/src/pages/courier/CourierRouteView.tsx:62-73`
**Issue:** `condosWithCoords` (linha 73) e `waypoints` (linha 62) filtram apenas condominios com `lat !== null && lng !== null`. A lista de "ORDEM DE PARADAS" exibe apenas condominios com coordenadas. Condominios sem geocodificacao (Nominatim falhou) desaparecem silenciosamente da aba Rota — o entregador nao e avisado e pode perder entregas ao usar apenas a aba Rota.

**Fix:** Exibir condominios sem coordenadas na lista com aviso visual:

```tsx
{condos.map((condo, index) => {
  const hasCoords = condo.lat !== null && condo.lng !== null
  return (
    <div key={condo.condominiumId} ...>
      ...
      {!hasCoords && (
        <span style={{ color: 'var(--color-destructive)', fontSize: 11 }}>
          Sem coordenadas
        </span>
      )}
    </div>
  )
})}
```

---

## Info

### IN-01: `order` tipado como `Record<string, unknown>` — tipo desnecessariamente fraco

**File:** `apps/api/src/modules/courier/courier.service.ts:78`
**Issue:** `orders.map(async (order: Record<string, unknown>)` usa um tipo completamente fraco para contornar o Prisma client. Isso desabilita verificacoes de tipo em todo o bloco de enriquecimento, permitindo que erros como CR-02 passem despercebidos pelo compilador TypeScript.

**Fix:** Apos corrigir CR-01 (regenerar Prisma client), remover o cast e usar o tipo gerado:

```typescript
orders.map(async (order) => {
  // order agora tem tipo Prisma.Order — TS vai reclamar de campos inexistentes
```

---

### IN-02: `main.tsx` importa `leaflet.css` duas vezes

**File:** `apps/web/src/main.tsx:1` e `apps/web/src/components/courier/CourierMap.tsx:3`
**Issue:** `leaflet/dist/leaflet.css` e importado em `main.tsx` linha 1 E em `CourierMap.tsx` linha 3. Bundlers modernos (Vite) geralmente deduplicam, mas a dupla importacao e semanticamente confusa e pode gerar CSS duplicado dependendo da configuracao.

**Fix:** Remover a importacao de `CourierMap.tsx` e manter apenas em `main.tsx` (onde ja esta de forma centralizada).

---

### IN-03: `OneSignal.init` chamado sem guard — pode lancar em ambientes sem `VITE_ONESIGNAL_APP_ID`

**File:** `apps/web/src/main.tsx:25-29`
**Issue:** `initMercadoPago` tem um guard `if (import.meta.env.VITE_MP_PUBLIC_KEY)` (linha 18), mas `OneSignal.init` nao tem guard equivalente — e sempre chamado mesmo quando `VITE_ONESIGNAL_APP_ID` esta ausente ou e string vazia. O comentario na linha 23-24 reconhece que isso gera "console warning" mas nao e verdadeiramente benigno: `OneSignal.init` com `appId: undefined` pode falhar em ambientes de producao ou gerar logs ruidosos.

**Fix:** Adicionar guard consistente com o padrao ja usado para Mercado Pago:

```typescript
if (import.meta.env.VITE_ONESIGNAL_APP_ID) {
  OneSignal.init({
    appId: import.meta.env.VITE_ONESIGNAL_APP_ID as string,
    serviceWorkerPath: 'push/onesignal/OneSignalSDKWorker.js',
    serviceWorkerParam: { scope: '/push/onesignal/' },
  })
}
```

---

_Reviewed: 2026-06-15T16:15:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
