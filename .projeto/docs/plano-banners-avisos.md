# Plano — Banners, avisos e promoções

> ✅ **Status:** **IMPLEMENTADO** em 19/09/2026 (execução direta, sem GSD — os comandos GSD não
> estão instalados neste ambiente). Escopo e decisões confirmados pelo usuário antes da redação (§3).
> **SEM COMMIT** — aguardando autorização explícita. Branch `feat/add-complementocliente`.
>
> Verificação: typecheck (shared + api + web) ✅ · build do api ✅ · build do web ✅ ·
> **969 testes do api passando + 3 todo** (+22) · **170 do web passando + 17 todo** (+22).
>
> ⏳ **Falta rodar `npm run db:push -w @cheirin-de-pao/api`** — as coleções `Banner` e
> `BannerView` e o índice único `(bannerId, userId)` ainda não existem no Atlas. Sem isso, a
> lista do admin responde vazia e a telemetria não grava. Não rodei porque o banco é remoto e
> compartilhado (dev e produção).
>
> Ver §14 para o que divergiu do plano.

## 1. Objetivo

Dar ao admin um lugar único para criar peças de comunicação que aparecem no app do cliente —
promoção, aviso operacional ou recado — **sem depender de deploy**. Três formatos, um cadastro só:

1. **Pop-up de abertura** — modal com arte, botão opcional e X. É o formato do app do McDonald's
   que motivou o pedido. Aparece na Home, uma vez por dia por cliente (configurável).
2. **Faixa fina de aviso** — tira de texto + cor no topo da Home, dispensável, **sem imagem**.
   Serve para o recado rápido que não merece arte ("Feriado dia 7: sem entrega").
3. **Banner no Além do Pãozin** — peça larga dentro da vitrine do mercadinho.

Cada peça pode ter **ação ao clicar ou nenhuma** (aviso puro), pode valer **para todos os clientes
ou só para condomínios escolhidos**, tem **janela de exibição agendada** e **mede alcance, cliques
e CTR**.

**Invariante de produto:** banner nunca bloqueia o app. Imagem que não carrega, rede que cai ou
banner mal cadastrado resultam em *nada na tela* — jamais em erro, layout quebrado ou tela travada.

---

## 2. Contexto — o que já existe

| Peça | Arquivo | O que faz hoje |
|---|---|---|
| Upload S3 | [lib/storage.ts](../../apps/api/src/lib/storage.ts) | `uploadProductImage(body, contentType)` → URL pública. Valida JPG/PNG/WebP e 5 MB. Prefixo fixo `products/` |
| Rota de upload | [admin-market.route.ts:91-95](../../apps/api/src/modules/admin-market/admin-market.route.ts#L91-L95) | `POST /admin/market/upload` (multipart, 1 arquivo) |
| Upload no front | [MarketProductForm.tsx:146-152](../../apps/web/src/pages/admin/gestao/MarketProductForm.tsx#L146-L152) | `FormData` + `apiFetch` → `{ url }`. `apiFetch` já não força `Content-Type` em FormData |
| Estado derivado do `now`, sem cron | [lib/product-availability.ts](../../apps/api/src/lib/product-availability.ts) | Janela/pausa do produto resolvidas na leitura — o padrão que a janela do banner copia |
| Fila de overlays do cliente | [ClientLayout.tsx:121-144](../../apps/web/src/pages/client/ClientLayout.tsx#L121-L144) | `slides` → `tour` → `GanchoConsentModal`, com fase `done` como guarda |
| Modal com arte + CTA | [GanchoConsentModal.tsx](../../apps/web/src/components/client/GanchoConsentModal.tsx) | Molde visual e de acessibilidade do pop-up (backdrop, z-index 100) |
| Home do cliente | [HomeScreen.tsx:388-480](../../apps/web/src/pages/client/HomeScreen.tsx#L388-L480) | Ordem dos blocos: saudação → push nudge → saldo → entrega → ações → mercadinho → próximas |
| Vitrine do mercadinho | [MarketCatalog.tsx:123-150](../../apps/web/src/pages/client/MarketCatalog.tsx#L123-L150) | Já tem um banner fixo ("Duas formas de pagar") — é o vizinho do banner novo |
| Deep link seguro | [useOneSignalDeepLink.ts](../../apps/web/src/hooks/useOneSignalDeepLink.ts) | Navega só para rotas internas conhecidas; nunca aceita URL crua |
| Stream de eventos | [AnalyticsEvent](../../apps/api/prisma/schema.prisma#L649-L663) + `POST /analytics/event` | Ingestão anônima fire-and-forget (202), usada pelos Relatórios |
| Hub do admin | [AdminGestao.tsx:46-63](../../apps/web/src/pages/admin/tabs/AdminGestao.tsx#L46-L63) | `HUB_ITEMS` — lista de cards do menu de Gestão |
| Padrão de módulo admin | [admin-market.controller.ts:26-52](../../apps/api/src/modules/admin-market/admin-market.controller.ts#L26-L52) | `denyNonAdmin` inline + Zod no controller + `handleError` |
| Schemas compartilhados | [packages/shared/src/schemas/market.ts](../../packages/shared/src/schemas/market.ts) | Zod como fonte única (back valida, front reusa) |

### Quatro achados que encurtam o trabalho

1. **Frequência e métrica são a mesma tabela.** "Já mostrei esse pop-up hoje para esse cliente?" e
   "quantos viram?" leem o mesmo registro. Uma coleção `BannerView` com um documento por
   *(banner, cliente)* resolve os dois de uma vez — e não cresce sem limite como um stream de
   eventos cresceria.

2. **Coleção nova = zero armadilha de Mongo.** Todo o schema convive com a regra "campo ausente ≠
   `null`, resolva em código" (ver os avisos em `Condominium` e `User`). Como `Banner` e
   `BannerView` nascem agora, **todo documento terá todas as chaves** — sem backfill, sem
   `?? null` defensivo, sem `where: { campo: null }` proibido.

3. **O pop-up não precisa inventar fila.** O `ClientLayout` já orquestra três overlays com
   prioridade. O banner entra como o **último** da fila, atrás de onboarding, tour e gancho.

4. **O upload já está pronto** — falta só parametrizar a pasta. `uploadProductImage` vira
   `uploadImage(body, contentType, folder)` e ganha um wrapper de compatibilidade.

---

## 3. Decisões confirmadas

| # | Decisão | Origem |
|---|---|---|
| **D-1** | Formatos na 1ª entrega: **pop-up de abertura**, **faixa fina de aviso** e **banner no Além do Pãozin**. **Sem** carrossel na Home | Usuário |
| **D-2** | Ações possíveis: **nenhuma**, **tela do app**, **produto ou combo**, **link externo** — todas as quatro | Usuário |
| **D-3** | Público: padrão **todos os clientes**; quando o admin marcar "segmentar", escolhe **quais condomínios** | Usuário |
| **D-4** | Escopo da 1ª entrega: **cadastro + exibição + métricas** (alcance, cliques, CTR) | Usuário |
| **D-5** | Construção **caseira** (Prisma + S3 + React). Sem CMS, sem SaaS de in-app messaging | Levantamento §2 |
| **D-6** | Frequência do pop-up controlada **no servidor**, via `BannerView` — não em `localStorage` | Achado 1 |
| **D-7** | Janela de exibição **derivada do `now` na leitura**, sem cron — mesma família de `product-availability.ts` | Convenção do repo |
| **D-8** | Link externo aceita **apenas `https://`**, abre em aba nova com `rel="noopener noreferrer"`. Rota interna vem de **allowlist**, nunca de campo livre | Segurança |
| **D-9** | **Teto de 1 pop-up por sessão**, mesmo que dois estejam elegíveis. Desempate por `priority`, depois `createdAt` | Produto |
| **D-10** | Texto alternativo (`alt`) **obrigatório** em toda peça com imagem | Acessibilidade |

---

## 4. Regras finais (como fica)

### 4.1 Os três formatos

| | **POPUP** | **STRIP** (faixa) | **MARKET** |
|---|---|---|---|
| Onde | Sobre a Home, ao abrir | Topo da Home, abaixo da saudação | Vitrine do Além do Pãozin |
| Imagem | **Obrigatória**, 4:5 | **Nenhuma** | **Obrigatória**, 3:1 |
| Texto | `ctaLabel` opcional no botão | `title` + `body` | `ctaLabel` opcional |
| Dispensável | Sim (X) | Sim (X) | Não (faz parte da página) |
| Quantos por vez | **1** (D-9) | 1 (o de maior `priority`) | Até 3, em ordem de `priority` |
| Reaparece | Conforme `frequency` | Não reaparece depois de dispensado no mesmo dia | Sempre (é conteúdo de página) |

### 4.2 Janela de exibição — a matemática

Um banner está **no ar** no instante `now` quando **todas** valem:

```
isActive === true
&& (startsAt == null || startsAt <= now)
&& (endsAt   == null || endsAt   >  now)
&& (condominiumIds.length === 0 || condominiumIds.includes(user.condominiumId))
```

Nada disso é gravado: é calculado na leitura, como em `product-availability.ts`. **Não há cron** —
o banner de Natal some sozinho às 00:00 de 26/12 porque a conta passa a dar `false`, não porque
alguém o desligou.

O **status que o admin vê** na lista sai da mesma conta:

| Status | Condição |
|---|---|
| **No ar** | passa em tudo |
| **Agendado** | `isActive` e `startsAt > now` |
| **Expirado** | `endsAt <= now` |
| **Pausado** | `isActive === false` |

### 4.3 Frequência do pop-up

Só vale para `POPUP`. Lida contra o `BannerView` do cliente:

| `frequency` | Mostra quando |
|---|---|
| `ONCE` | Não existe `BannerView` desse par *(banner, cliente)* — uma vez na vida |
| `DAILY` *(padrão)* | `lastSeenAt` é de um dia anterior (fuso BRT, mesma régua de `lib/cutoff.ts`) |
| `ALWAYS` | Sempre que abrir a Home — usar com parcimônia |

**Dispensar (X) conta como visto**, não como recusa permanente: um `DAILY` dispensado hoje volta
amanhã. Quem clica no CTA **não vê de novo naquele dia**, em qualquer frequência.

### 4.4 Público-alvo (D-3)

`condominiumIds: []` (array vazio) = **todos**. Com IDs dentro = só aqueles condomínios.
Cliente sem `condominiumId` (cadastro incompleto) recebe **apenas** os banners de lista vazia.

### 4.5 Ação ao clicar (D-2)

| `actionType` | Campo usado | Para onde vai |
|---|---|---|
| `NONE` | — | Nada. Fecha o pop-up / a faixa. **É o padrão** |
| `SCREEN` | `actionScreen` | Rota da allowlist (§6.1) |
| `PRODUCT` | `actionProductId` | `/client/market/produto/<id>` |
| `COMBO` | `actionComboId` | `/client/creditos?combo=<id>` — a tela dá scroll e realça o card por 2s |
| `EXTERNAL` | `actionUrl` | `window.open(url, '_blank', 'noopener,noreferrer')` |

O admin **nunca digita rota**: `SCREEN` é um `<select>` com rótulos em português; `PRODUCT` e
`COMBO` são seletores que buscam da lista real. Só `EXTERNAL` tem campo de texto, validado como
`https://` no Zod e de novo no servidor.

### 4.6 Ordem de aparição do pop-up no ClientLayout

```
onboarding (slides) → tour → consentimento do gancho → POP-UP DE BANNER
```

O pop-up só monta quando `phase === 'done' && !needsHookConsent`. Cliente novo vê o tutorial
inteiro sem nenhuma propaganda no meio.

---

## 5. Modelo de dados

`apps/api/prisma/schema.prisma` — dois models e três enums novos. **Coleções novas: sem backfill.**

```prisma
enum BannerPlacement { POPUP STRIP MARKET }
enum BannerActionType { NONE SCREEN PRODUCT COMBO EXTERNAL }
enum BannerFrequency { ONCE DAILY ALWAYS }

// Banner — peça de comunicação criada pelo admin (promoção, aviso ou recado).
// Janela de exibição derivada do `now` na leitura (ver lib/banner-visibility.ts) — sem cron.
model Banner {
  id           String           @id @default(auto()) @map("_id") @db.ObjectId
  name         String           // nome interno; o cliente nunca vê
  placement    BannerPlacement

  // Arte — obrigatória em POPUP (4:5) e MARKET (3:1); ausente em STRIP.
  imageUrl     String?
  alt          String?          // obrigatório quando há imagem (D-10)

  // Texto — a faixa (STRIP) é feita só disto.
  title        String?
  body         String?
  bgColor      String?          // faixa: token do tema ou hex

  ctaLabel     String?          // rótulo do botão ("Peça agora")
  actionType   BannerActionType @default(NONE)
  actionScreen String?          // allowlist (lib/banner-visibility.ts), nunca texto livre
  actionProductId String?       @db.ObjectId
  actionComboId   String?       @db.ObjectId
  actionUrl    String?          // https:// apenas

  frequency    BannerFrequency  @default(DAILY) // só POPUP
  startsAt     DateTime?
  endsAt       DateTime?
  isActive     Boolean          @default(true)
  priority     Int              @default(0)     // maior ganha o desempate

  // Vazio = todos os clientes. Com IDs = só esses condomínios (D-3).
  condominiumIds String[]       @db.ObjectId

  createdById  String?          @db.ObjectId
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  @@index([placement, isActive])
}

// BannerView — um documento por (banner, cliente). Controla a frequência E alimenta a métrica:
// alcance = nº de documentos; impressões = soma de seenCount; cliques/dispensas = campos abaixo.
model BannerView {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  bannerId    String   @db.ObjectId
  userId      String   @db.ObjectId
  seenCount   Int      @default(0)
  firstSeenAt DateTime @default(now())
  lastSeenAt  DateTime @default(now())
  clickedAt   DateTime?
  dismissedAt DateTime?

  @@unique([bannerId, userId])
  @@index([bannerId])
}
```

⚠️ **Os índices ficam SÓ aqui.** Nada de replicar em
[lib/ensure-indexes.ts](../../apps/api/src/lib/ensure-indexes.ts) — o cabeçalho daquele arquivo
documenta o deploy quebrado de 14/08/2026 por índice duplicado, e o commit `c96bee3` é a limpeza
disso. Aplicar com `npm run db:push -w @cheirin-de-pao/api`.

---

## 6. Backend

### 6.1 `apps/api/src/lib/banner-visibility.ts` (novo — toda a regra mora aqui)

Funções puras, sem Prisma, testáveis isoladas (é o que torna a regra barata de verificar):

```ts
export const BANNER_SCREENS = {
  home:        { route: '/client/home',              label: 'Início' },
  creditos:    { route: '/client/creditos',          label: 'Comprar créditos' },
  recorrente:  { route: '/client/creditos/recorrente',label: 'Recarga automática' },
  agenda:      { route: '/client/agenda',            label: 'Minha agenda' },
  pedidoUnico: { route: '/client/agenda/pedido-unico',label: 'Pedido único' },
  pedidos:     { route: '/client/pedidos',           label: 'Meus pedidos' },
  market:      { route: '/client/market',            label: 'Além do Pãozin' },
  cestinha:    { route: '/client/market/cestinha',   label: 'Minha Cestinha' },
  gancho:      { route: '/client/perfil/gancho',     label: 'Gancho de porta' },
} as const

export function bannerStatus(b, now): 'live' | 'scheduled' | 'expired' | 'paused'
export function isWithinWindow(b, now): boolean
export function matchesAudience(b, condominiumId: string | null): boolean
export function passesFrequency(b, view: BannerView | null, now): boolean
export function resolveActionUrl(b): string | null   // valida allowlist/https; null = sem ação
```

`passesFrequency` compara dias em **BRT**, reusando o helper de fuso de
[lib/cutoff.ts](../../apps/api/src/lib/cutoff.ts) — nunca `Date` cru do servidor (que é UTC).

### 6.2 `apps/api/src/lib/storage.ts` (alterar)

```ts
export async function uploadImage(body, contentType, folder: 'products' | 'banners'): Promise<string>
export const uploadProductImage = (body, ct) => uploadImage(body, ct, 'products') // compat
```

Nada mais muda: mesmas validações de tipo e de 5 MB, mesmo `CacheControl` imutável.

### 6.3 `packages/shared/src/schemas/banner.ts` (novo)

Zod como fonte única, exportado no `index.ts` do pacote. Validações que **não** podem ficar só na UI:

- `placement === 'STRIP'` → `title` obrigatório, `imageUrl` proibido.
- `placement !== 'STRIP'` → `imageUrl` e `alt` obrigatórios.
- `actionType === 'SCREEN'` → `actionScreen` ∈ allowlist.
- `actionType === 'EXTERNAL'` → `actionUrl` casa `^https://`.
- `actionType === 'PRODUCT' | 'COMBO'` → ObjectId válido no campo correspondente.
- `startsAt < endsAt` quando ambos existem.
- `name` 1..60; `title` ≤ 60; `body` ≤ 140; `ctaLabel` ≤ 24; `alt` ≤ 120.

Feito com `superRefine` — um `.parse` só, mensagens em português como no resto do projeto.

### 6.4 Módulo `admin-banners` (novo)

Arquivos no padrão de `admin-market`: `.route.ts`, `.controller.ts`, `.service.ts`.
`preHandler: [fastify.authenticate]` + `denyNonAdmin` inline no controller.

| Método | Rota | O que faz |
|---|---|---|
| GET | `/admin/banners` | Lista com `status` derivado **e métricas agregadas** (§6.6) |
| GET | `/admin/banners/:id` | Um banner |
| POST | `/admin/banners` | Cria (Zod) |
| PATCH | `/admin/banners/:id` | Edita (Zod parcial) |
| DELETE | `/admin/banners/:id` | Remove — e apaga os `BannerView` dele |
| POST | `/admin/banners/upload` | Multipart → `uploadImage(..., 'banners')` → `{ url }` |

Registrar em [server.ts](../../apps/api/src/server.ts#L257) junto dos demais `admin*Route`.

### 6.5 Módulo `banners` (cliente, novo)

| Método | Rota | O que faz |
|---|---|---|
| GET | `/client/banners` | Devolve os elegíveis **já filtrados** por janela, público e frequência, agrupados por `placement` |
| POST | `/client/banners/:id/seen` | Upsert do `BannerView` (+1 em `seenCount`, `lastSeenAt = now`). **202 sempre** |
| POST | `/client/banners/:id/click` | Marca `clickedAt` (e conta como visto). **202 sempre** |
| POST | `/client/banners/:id/dismiss` | Marca `dismissedAt` (e conta como visto). **202 sempre** |

Resposta do GET — só o que a tela precisa, nada do cadastro interno:

```jsonc
{
  "popup":  { "id": "...", "imageUrl": "...", "alt": "...", "ctaLabel": "Peça agora",
              "actionUrl": "/client/market", "external": false },
  "strip":  { "id": "...", "title": "...", "body": "...", "bgColor": "...",
              "actionUrl": null, "external": false },
  "market": [ { "id": "...", "imageUrl": "...", "alt": "...", "actionUrl": null, "external": false } ]
}
```

O servidor **já entrega a URL resolvida** (`resolveActionUrl`): o cliente não conhece
`actionType`, não monta rota e não tem como ser induzido a navegar para lugar nenhum.

Os três POSTs são **fire-and-forget, sempre 202** — igual ao `/analytics/event`. Telemetria não
pode derrubar a tela do cliente nem atrasar o clique.

### 6.6 Métricas (D-4)

Calculadas por agregação sobre `BannerView`, direto no `GET /admin/banners`:

| Métrica | Conta |
|---|---|
| **Alcance** | nº de documentos do banner (clientes únicos que viram) |
| **Impressões** | `sum(seenCount)` |
| **Cliques** | nº com `clickedAt != null` |
| **CTR** | cliques ÷ alcance |
| **Dispensas** | nº com `dismissedAt != null` |

Uma agregação `groupBy` por `bannerId` na listagem — sem coleção de relatório, sem job.

---

## 7. Frontend admin

### 7.1 Entrada no hub

Novo item em [`HUB_ITEMS`](../../apps/web/src/pages/admin/tabs/AdminGestao.tsx#L46), logo abaixo de
"Combos e promoções" (é vizinho temático):

```ts
{ key: 'banners', icon: 'spark', titulo: 'Banners e avisos',
  descricao: 'Pop-up, faixa de aviso e banner do mercadinho' }
```

`spark` já existe no [Icon](../../apps/web/src/components/brand/Icon.tsx). Somar `'banners'` ao tipo
`AdminGestaoSub` e a linha `if (sub === 'banners') return <AdminBanners onBack={onBack} />`.

### 7.2 `pages/admin/gestao/AdminBanners.tsx` (novo) — a lista

Modelada em `MarketProdutos`: AppBar com voltar + botão "Novo banner" + lista.

- **Chips de filtro por formato**: Todos · Pop-up · Faixa · Mercadinho.
- **Cada linha**: miniatura (ou quadrado colorido, na faixa), nome interno, chip de formato,
  chip de status (No ar / Agendado / Expirado / Pausado) e, à direita,
  **alcance · CTR**.
- **Ações por linha**: editar (toque), pausar/religar (switch, como nos produtos), excluir
  (via `ConfirmSheet` já existente).
- Ordem da lista: No ar primeiro (por `priority` desc), depois Agendados (por `startsAt`), depois
  Pausados, depois Expirados.

### 7.3 `pages/admin/gestao/BannerForm.tsx` (novo) — o cadastro

Um formulário, com os campos aparecendo conforme o formato escolhido:

1. **Formato** — três cards grandes (Pop-up / Faixa de aviso / Mercadinho). **Escolher primeiro**,
   porque define o resto do formulário.
2. **Arte** (não aparece na faixa) — upload igual ao de produto + **crop na proporção do formato**
   (4:5 ou 3:1), para nenhuma peça sair torta. Campo **texto alternativo obrigatório**.
3. **Texto** — `title`/`body`/`bgColor` na faixa; só `ctaLabel` nos outros.
4. **Ação ao clicar** — `<select>` com as cinco opções (D-2). O campo seguinte muda conforme:
   nenhum, `<select>` de telas, busca de produto, busca de combo, ou campo de URL `https://`.
5. **Quando aparece** — início e fim (ambos opcionais) + `frequency` (só no pop-up).
6. **Para quem** — switch "Todos os clientes" ↔ "Escolher condomínios", com a lista de
   condomínios ativos em checkboxes (D-3).
7. **Prioridade** — número, com a explicação "maior aparece primeiro".

### 7.4 `components/admin/BannerPreview.tsx` (novo)

Moldura de celular ao lado (ou abaixo, no mobile) do formulário, renderizando **o componente real
do cliente** com os dados do formulário. É o que impede banner cortado, texto ilegível ou CTA
sumido chegarem ao cliente — e custa pouco, porque reusa os componentes da §8.

### 7.5 Dependências novas

| Pacote | Peso | Para quê |
|---|---|---|
| `react-easy-crop` | ~15 kB | Crop na proporção fixa (§7.3, item 2) |
| `browser-image-compression` | ~10 kB | Comprimir antes de subir — foto de celular passa dos 5 MB e o upload recusa |

Ambas só no bundle do **admin**, que é carregado por `lazy()` no router — o cliente não paga por elas.

---

## 8. Frontend cliente

### 8.1 `contexts/BannerContext.tsx` + `hooks/useBanners.ts` (novos)

Um `GET /client/banners` **por sessão**, no mount do `ClientLayout`, servido por contexto para a
Home e a vitrine. Sem refetch a cada navegação. Falha de rede → contexto vazio → nada aparece.

### 8.2 `components/client/BannerPopup.tsx` (novo)

Modelado no [`GanchoConsentModal`](../../apps/web/src/components/client/GanchoConsentModal.tsx):
backdrop `rgba(0,0,0,0.5)`, `zIndex: 100`, entrada com `framer-motion`, respeitando
`prefers-reduced-motion` (a Home já usa `MotionConfig reducedMotion="user"`).

- Arte 4:5 com cantos arredondados; botão CTA flutuando sobre a base da arte (como na referência).
- **X grande e fora do card**, abaixo — área de toque ≥ 44 px, `aria-label="Fechar"`.
- `Esc` e clique no backdrop fecham. Foco preso no modal enquanto aberto.
- `onError` na imagem → **não renderiza nada** e reporta `dismiss`: banner quebrado não vira
  retângulo cinza na cara do cliente.
- Montado no [`ClientLayout`](../../apps/web/src/pages/client/ClientLayout.tsx#L136) **depois** do
  `GanchoConsentModal`, com a guarda de fase da §4.6.

### 8.3 `components/client/AvisoStrip.tsx` (novo)

Faixa fina no topo da Home, entre a saudação e o `PushNudge`. Texto + cor + X. Sem imagem, sem
animação de entrada chamativa — é recado, não propaganda.

### 8.4 `components/client/MarketBanner.tsx` (novo)

Peça 3:1 dentro do [`MarketCatalog`](../../apps/web/src/pages/client/MarketCatalog.tsx#L123), logo
acima do banner "Duas formas de pagar". Até 3, empilhados por `priority`.

### 8.5 Telemetria na borda

- **Impressão**: `IntersectionObserver` — conta quando o banner fica ≥ 50% visível por ≥ 1s (no
  pop-up, ao montar). Evita contar banner que passou voando no scroll.
- **Clique** e **dispensa**: no handler, antes de navegar.
- Todas as chamadas com `void fetch(...).catch(() => {})` — nunca `await` no caminho do clique.

---

## 9. Ondas de implementação

| Onda | Entrega | Verificável por |
|---|---|---|
| **1** | Schema + `db:push` + `lib/banner-visibility.ts` + schemas Zod | Testes unitários da lib (§10) |
| **2** | `storage.ts` parametrizado + módulo `admin-banners` (CRUD + upload) | Testes de serviço/controller |
| **3** | Admin: hub, lista, formulário, crop, preview | UAT §12, itens 1-4 |
| **4** | Cliente: contexto, pop-up, faixa, banner do mercadinho | UAT §12, itens 5-9 |
| **5** | Métricas: `BannerView`, os três POSTs, agregação e exibição na lista | UAT §12, itens 10-11 |

Cada onda fecha com `typecheck` do pacote tocado. A onda 1 sozinha já é testável sem UI.

---

## 10. Testes

**API (`vitest`)**

- `lib/__tests__/banner-visibility.test.ts` — o coração:
  - janela: antes de `startsAt`, dentro, depois de `endsAt`, sem datas, `endsAt` exatamente agora;
  - público: lista vazia = todos; cliente do condomínio certo; do errado; **sem condomínio**;
  - frequência: `ONCE` com e sem view; `DAILY` visto ontem vs. hoje **na virada do dia em BRT**;
    `ALWAYS`; clicado hoje não reaparece;
  - `resolveActionUrl`: allowlist válida, rota fora da allowlist → `null`, `http://` → `null`,
    `javascript:` → `null`, produto/combo montando a rota certa.
- `modules/admin-banners/__tests__/` — CRUD, 403 para não-admin, Zod recusando as combinações
  inválidas da §6.3, delete levando os `BannerView` junto.
- `modules/banners/__tests__/` — GET filtrando corretamente; os três POSTs devolvendo 202 mesmo
  com id inexistente; `seenCount` incrementando em vez de duplicar documento.

**Web (`vitest` + Testing Library)**

- `BannerPopup`: fecha no X, fecha no `Esc`, dispara `click` antes de navegar, **não renderiza**
  quando a imagem falha.
- `ClientLayout`: pop-up **não** monta durante slides/tour/gancho.
- `AvisoStrip`: some ao dispensar.
- `BannerForm`: campos trocam conforme o formato; salvar bloqueado sem `alt`.

---

## 11. Riscos e armadilhas

| Risco | Mitigação |
|---|---|
| Pop-up virar incômodo e derrubar retenção | `DAILY` como padrão, teto de 1 por sessão (D-9), X grande, e o CTR na lista mostrando o estrago |
| Índice duplicado quebrar o `db push` | Índices **só** no `schema.prisma` (§5) — ver o histórico em `ensure-indexes.ts` |
| Imagem pesada degradar a Home | Compressão no upload, `loading="lazy"` no banner do mercadinho, `fetchpriority="low"`; pop-up só monta depois da Home pintada |
| Link externo como vetor de phishing | `https://` apenas, validado no Zod **e** no servidor; `noopener noreferrer`; rota interna nunca vem de texto livre (D-8) |
| Banner mal cadastrado quebrar a tela | Toda peça é opcional na renderização; `onError` esconde; GET que falha devolve contexto vazio |
| Fuso na frequência diária | Comparação em BRT com o helper de `lib/cutoff.ts` — `new Date()` no servidor é UTC e erraria a virada |
| `BannerView` crescer demais | Limitado a *clientes × banners* (um doc por par), não por impressão. Delete do banner limpa os dele |
| Confundir com publicidade de terceiros | Este plano cobre comunicação **própria**. Vender espaço a anunciante muda contrato, faturamento e relatório — é outro projeto |

---

## 12. Para validar no app (UAT)

1. Criar pop-up com arte e ação "Além do Pãozin"; conferir o preview antes de salvar.
2. Agendar um banner para amanhã → aparece como **Agendado** e **não** aparece no cliente.
3. Pôr `endsAt` para daqui a 2 min → some sozinho do cliente, sem ninguém mexer.
4. Segmentar por um condomínio → cliente de outro condomínio **não** vê.
5. Abrir o app como cliente → pop-up aparece; X fecha; recarregar a Home → **não** volta (`DAILY`).
6. Clicar no CTA → vai para a tela certa e o pop-up não volta naquele dia.
7. Cliente **novo** → vê slides + tour + gancho, e **nenhum** pop-up no meio.
8. Criar faixa de aviso sem imagem → aparece no topo da Home; dispensar some.
9. Criar banner do mercadinho → aparece na vitrine, acima de "Duas formas de pagar".
10. Voltar ao admin → alcance, cliques e CTR batem com o que foi feito nos passos 5-6.
11. Pausar um banner no ar → some do cliente no próximo carregamento.
12. Cadastrar link externo `http://` → o formulário recusa.

---

## 13. Fora de escopo (ficam para depois)

- Carrossel de banners na Home (avaliado e **descartado** nesta rodada — D-1).
- Segmentação por comportamento (saldo baixo, sem agenda, cliente sumido).
- Push vinculado: publicar o banner e disparar a notificação com a mesma arte.
- Teste A/B entre duas artes.
- Cupom que aplica desconto automaticamente ao clicar.
- Ordenar banners arrastando (`priority` numérico resolve por ora).

---

## 14. O que divergiu do plano

Sete mudanças feitas durante a implementação — todas por algo que só apareceu ao escrever o código:

1. **A allowlist de telas foi para `packages/shared`**, não para `lib/banner-visibility.ts` como a
   §6.1 dizia. Motivo: o formulário do admin precisa dos RÓTULOS ("Comprar créditos"), e o Zod
   precisa das chaves para validar. Deixá-la no back obrigaria a duplicar a lista no front — duas
   cópias que divergiriam no primeiro destino novo.

2. **Telemetria virou uma rota só**, `POST /client/banners/:id/:event`, em vez das três da §6.5.
   Os três eventos escrevem no MESMO documento e diferem apenas no campo que tocam.

3. **`hide` ≠ `dismiss` no front** (não estava no plano). A primeira versão escondia o pop-up
   chamando `dismiss` depois do clique — e isso contava uma dispensa para quem tinha clicado,
   inflando a métrica que mede rejeição. Agora clicar esconde sem registrar dispensa. Há teste
   para isso em `BannerHosts.test.tsx`.

4. **`BannerPopup` ganhou a prop `inline`.** Sem ela o preview do admin teria que ser uma maquete
   à parte, que divergiria do app no primeiro ajuste de estilo. Com ela, o preview renderiza o
   componente REAL preso à moldura em vez da viewport.

5. **A impressão do pop-up é contada quando ele APARECE**, não quando chega do servidor. A versão
   ingênua gastaria a frequência do dia de um pop-up que ficou atrás do tour e ninguém viu.

6. **Ondas 2 e 5 fundidas.** As métricas saem da mesma agregação que a listagem do admin já fazia;
   separá-las em duas entregas significaria escrever o serviço duas vezes.

7. **`resolveActionUrl` recebe só os campos de ação** (`BannerActionFields`), não o banner inteiro.
   Pedir o objeto completo obrigava quem chama a montar um objeto falso com `placement` e
   `isActive` que a função nem lê.

---
