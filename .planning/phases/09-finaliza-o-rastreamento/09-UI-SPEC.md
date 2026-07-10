---
phase: 9
slug: finaliza-o-rastreamento
status: approved
reviewed_at: 2026-06-19T00:00:00Z
shadcn_initialized: false
preset: none
created: 2026-06-19
---

# Phase 9 — UI Design Contract

> Contrato visual e de interação para a Fase 9: Finalização Rastreamento.
> Esta fase é de **auditoria + completude** — não greenfield. O código substancial já existe
> (TrackingScreen 564 linhas, NotificationsScreen 277 linhas, hooks, crons, rotas backend).
> O contrato distingue entre elementos a verificar (existentes) e elementos a criar (ausentes).
> Gerado por gsd-ui-researcher. Verificado por gsd-ui-checker.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (CSS variables + inline styles — sem shadcn) |
| Preset | not applicable |
| Component library | none (componentes próprios em `apps/web/src/components/`) |
| Icon library | Ícones próprios via `<Icon name={...}>` — paths SVG definidos em `brand.jsx` e `Icon.tsx` |
| Fonts | Bricolage Grotesque (display/headings) + Hanken Grotesk (body/labels) |

**Fonte dos tokens:** `apps/web/src/styles/globals.css` — todas as variáveis CSS já declaradas e em uso.
Nenhum novo token de cor ou tipografia deve ser introduzido nesta fase.

---

## Spacing Scale

Escala de 8 pontos (múltiplos de 4) — já em uso no projeto via inline styles. Idêntica à Fase 8.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Gap entre ícone e label inline; dot de badge |
| sm | 8px | Gap entre elementos adjacentes; padding de pill |
| md | 16px | Padding padrão de card; gap entre seções |
| lg | 24px | Padding inferior de scroll area |
| xl | 32px | Padding vertical de empty state |
| 2xl | 48px | Padding top de empty state grande |
| 3xl | 64px | Não usado nesta fase |

### Exceções aprovadas (herança da Fase 8 — não alterar)

- Padding lateral de tela: `20px` — estabelecido em todas as telas do projeto.
- Tab bar height: `56px` fixo — definido em ClientTabBar.
- Touch target mínimo: `44px` de minHeight em todos os botões interativos.
- AppBar back button: `38×38px` radius 12 bg `surface-2` (TrackingScreen usa 38×38; NotificationsScreen usa 40×40 — manter como está em cada tela, diferença de 2px aprovada).
- Timeline circle: `34×34px` — tamanho definido no handoff de design.
- Notification icon container: `42×42px` radius 12 — definido no handoff NotifsScreen.

---

## Typography

Idêntica à Fase 8. Quatro tamanhos exatos, dois pesos canônicos.

| Role | Token CSS | Size | Family | Weight | Line Height | Usage nesta fase |
|------|-----------|------|--------|--------|-------------|-----------------|
| Label/Caption | `--text-sm` | 12.5px | Hanken Grotesk | 600 | 1.4 | Timestamps de notificação (11px), subtítulos de card do histórico (12.5px), label do step horário (11.5px) |
| Body | `--text-base` | 15px | Hanken Grotesk | 600 | 1.5 | Corpo de notificação (13px), descrição do step (13px), texto de condomínio no HeroCard (13px) |
| Heading | `--text-xl` | 21px | Bricolage Grotesque | 700 | 1.15 | Título de AppBar ("Sua entrega", "Notificações") — 21px, weight 700, letterSpacing -0.02em |
| Display | `--text-3xl` | 30px | Bricolage Grotesque | 800 | 1.0 | Quantidade de pães no HeroCard — 30px, weight 800, letterSpacing -0.02em |

**Pesos canônicos:** 600 (body/label range) e 700 (heading/display range).

**Exceções aprovadas de tamanho e peso (herança do handoff):**
- HeroCard quantidade: `30px / weight 800 / letterSpacing -0.02em` — conforme handoff TrackScreen.
- HeroCard data label: `11.5px / weight 700 / color #E3AC3F / letterSpacing 0.06em / uppercase` — conforme handoff.
- Step label (timeline): `16.5px / Bricolage / weight 700 / letterSpacing -0.01em` — conforme código existente.
- Notification title: `14.5px / weight 700 / lineHeight 1.25` — conforme handoff NotifsScreen.
- History item title: `14.5px / weight 700` — conforme código existente (TrackingScreen linha 540).
- CTA button de notificação: `13px / weight 700` — conforme handoff NotifsScreen.
- "Seu entregador" label: `12px / weight 600 / textTer` — conforme código existente.
- Timestamp de notificação: `11px / weight 600 / textTer` — conforme código existente.
- History item subtitle: `12.5px / weight normal / textTer` — conforme código existente.
- Section heading "Histórico": `16px / Bricolage / weight 700 / letterSpacing -0.02em` — conforme código existente.
- Empty state heading: `16px / Bricolage / weight 700 / textSec` — conforme código existente.
- Empty state body: `13px / Hanken / textTer / lineHeight 1.5` — conforme código existente.
- Pill badge: `11.5px / weight 700` — conforme Pill component existente.

---

## Color

Todos os valores já declarados como variáveis CSS em `globals.css`. Usar **somente variáveis CSS** — nunca hex direto, exceto no HeroCard espresso (herança do handoff).

| Role | CSS Var | Hex | Usage nesta fase |
|------|---------|-----|-----------------|
| Dominant (60%) | `--color-app-bg` | `#FAF5EC` | Background das telas TrackingScreen e NotificationsScreen |
| Secondary (30%) | `--color-surface` | `#FFFFFF` | Cards do histórico, cards de notificação, courier card |
| Surface Alt | `--color-surface-2` | `#F4EBDA` | Skeleton loader, ícone do courier, AppBar back button bg, CTA neutro de notificação |
| Accent (10%) | `--color-accent` | `#B0702A` | Border de card não lido (`1.5px solid`), step circle ativo, connector line ativo, ícone tipo "gold" |
| Gold | `--color-gold` | `#E3AC3F` | CTA button de notificação tipo "gold" (LOW_CREDIT), data label no HeroCard |
| Espresso | `--color-espresso` | `#1E1207` | Background do HeroCard (TrackingScreen) |
| Good | `--color-good` | `#3E7C53` | Pill "A caminho" text, dot do pill "A caminho", ícone tipo "good" |
| Good Soft | `--color-good-soft` | `#DCEBDF` | Pill "A caminho" background, icon bg tipo "good" (DELIVERY_DONE, OUT_FOR_DELIVERY, DELIVERY_EVE) |
| Gold Soft | `--color-gold-soft` | `#F3DDA6` | Icon bg tipo "gold" (LOW_CREDIT), phone button bg no courier card |

**Accent (`#B0702A`) reservado nesta fase para:**
- Border de card de notificação não lido (`1.5px solid var(--color-accent)`)
- Circle do stepper no estado `cur` e `done` (background e border)
- Connector line entre steps completos
- Ícone do courier card (`color: var(--color-accent)`)
- Ícone do histórico (bag/calendar, `color: var(--color-accent)`)

**Gold (`#E3AC3F`) reservado nesta fase para:**
- Background do CTA de notificação tipo "gold" (`background: var(--color-gold)`)
- Data label no HeroCard (texto `#E3AC3F` — único uso de hex direto aprovado, herança do handoff)
- Badge do sino na HomeScreen (badge `--color-gold` background)

**Hex direto aprovado (herança do handoff — não converter para variável):**
- `#E3AC3F` — data label e BreadMark watermark dentro do HeroCard espresso
- `#FAF5EC` — texto da quantidade de pães dentro do HeroCard espresso
- `#C7B595` — texto de subtítulo ("Entrega no seu condomínio") dentro do HeroCard espresso
- `#FBF3E4` — dot interno do step `cur` (círculo pequeno 11×11px dentro do step ativo)

---

## Screens — Contrato por Tela

### TrackingScreen (`/client/pedidos`)

**Status:** existente (564 linhas) — **auditar e completar gaps pontuais**

**Layout final esperado:**
```
AppBar: título "Sua entrega" + back button 38×38 radius 12 bg surface-2 icon arrowL size 20
Scroll area (padding 0 20px 24px):
  HeroCard (espresso bg)
  Timeline stepper (3 steps)
  Courier card (estático — placeholder)
  Section heading "Histórico"
  History list (ou skeleton / empty state)
```

**HeroCard — elementos a verificar:**
- [ ] Background `var(--color-espresso)` borderRadius `var(--radius-card)` padding 20px
- [ ] `BreadMark` watermark: `position absolute, top -36, right -20, opacity 0.13, size 150, color "#E3AC3F"`
- [ ] Data label: `formatHeroDate(order.scheduledDate)` — 11.5px, gold `#E3AC3F`, weight 700, letterSpacing 0.06em, uppercase
- [ ] Quantidade: `formatQty(order.quantity)` — Bricolage 30px, weight 800, `#FAF5EC`, letterSpacing -0.02em
- [ ] Subtítulo: "Entrega no seu condomínio" — 13px, `#C7B595`

**Timeline — elementos a verificar:**

| State | Circle | Inner | Connector |
|-------|--------|-------|-----------|
| `done` | 34×34, bg accent, border accent | `<Icon name="check" size={18} color="var(--color-app-bg)" stroke={2.6}>` | 2.5px wide, bg accent |
| `cur` | 34×34, bg accent, border accent | dot 11×11 radius 50% bg `#FBF3E4` | 2.5px wide, bg border |
| `future` | 34×34, bg surface, border border | dot 11×11 transparent | 2.5px wide, bg border |

- [ ] Step label: Bricolage 16.5px, weight 700, letterSpacing -0.01em — `var(--color-text)` (done/cur) ou `var(--color-text-ter)` (future)
- [ ] Step description: 13px, `var(--color-text-sec)`, lineHeight 1.45
- [ ] Pill "agora" apenas no step `cur`: tone `good` com dot verde — já implementado
- [ ] paddingBottom 26px entre steps (exceto o último)

**Courier card — elementos a verificar:**
- [ ] Container: `padding: '14px 16px'`, bg surface, radius 16, border `1px solid var(--color-border-2)`, marginBottom 18
- [ ] Avatar: 44×44 radius 99, bg surface-2, ícone `user` size 22 color accent
- [ ] Label "Seu entregador": 12px weight 600 textTer
- [ ] Nome "A definir": 14.5px weight 700 text
- [ ] Phone button: 40×40 radius 12 bg goldSoft, ícone `phone` size 19 color accent

**Histórico — elementos a verificar:**
- [ ] Section heading "Histórico": Bricolage 16px, weight 700, letterSpacing -0.02em, margin `18px 0 10px`
- [ ] Skeleton: 3 divs height 64, radius `var(--radius-card)`, bg surface-2
- [ ] Empty state: ícone `clock` size 48 textTer + heading "Nenhuma entrega ainda" (Bricolage 16px, textSec) + body correto
- [ ] Item de histórico:
  - Container: flex, gap 13, padding 14, bg surface, radius `var(--radius-card)`, alignItems center
  - Ícone: 44×44 radius 13 bg surface-2, `bag` (SINGLE) / `calendar` (SCHEDULED), size 21 color accent
  - Título: `formatHistoryDate(o.scheduledDate)` — 14.5px weight 700 text
  - Subtítulo: `{typeLabel} · {timeLabel} · {o.quantity} pães` — 12.5px textTer
  - `<StatusPill status={o.status}>` à direita

**StatusPill — elementos a verificar:**
- `OUT_FOR_DELIVERY` → `<Pill tone="good" dot>A caminho</Pill>`
- `DELIVERED` → `<Pill tone="neutral">Entregue</Pill>`
- `SCHEDULED` (default) → `<Pill tone="neutral">Agendado</Pill>`

**Estado sem pedido hoje (order === null/undefined):**
- HeroCard e Timeline NÃO são renderizados — verificar condicional `{order && <HeroCard />}`
- Courier card NÃO é renderizado
- Histórico SIM é renderizado (independe de ter pedido hoje)

**Gap a completar — AppBar usa `navigate(-1)`:**
- Verificar que `navigate(-1)` funciona corretamente quando acessado via tab bar (sem histórico de navegação anterior) vs. via deep link de push
- Se `navigate(-1)` não tiver histórico, considerar fallback para `navigate('/client/home')` — implementação a critério do executor

---

### NotificationsScreen (`/client/notificacoes`)

**Status:** existente (277 linhas) — **completar CTA_CONFIG e sincronizar badge via NotifContext**

**Layout final esperado:**
```
AppBar: título "Notificações" + back button 40×40 radius 12 bg surface-2 icon arrowL size 20
Scroll area (padding 0 20px 24px, gap 10, flex column):
  [Skeleton 3 items OU Empty state OU Lista de cards]
```

**Cards de notificação — elementos a verificar:**

| Campo | Spec |
|-------|------|
| Container | bg surface, radius `var(--radius-card)`, padding 15, display flex, gap 13 |
| Border não lida | `1.5px solid var(--color-accent)` |
| Border lida | `1px solid var(--color-border-2)` |
| Icon container | 42×42 radius 12, bg por tone (goodSoft/goldSoft/surface-2) |
| Icon size | 20px, color por tone (good/accent/textSec) |
| Título | 14.5px weight 700 text, lineHeight 1.25 |
| Timestamp | 11px weight 600 textTer, flexShrink 0, marginTop 2 |
| Body | 13px textSec, marginTop 3, lineHeight 1.45 |

**Tone map — elementos a verificar:**

| Type | Tone | Icon | Icon color | Icon bg |
|------|------|------|-----------|---------|
| DELIVERY_EVE | good | `bell` | `var(--color-good)` | `var(--color-good-soft)` |
| DELIVERY_DONE | good | `check` | `var(--color-good)` | `var(--color-good-soft)` |
| OUT_FOR_DELIVERY | good | `truck` | `var(--color-good)` | `var(--color-good-soft)` |
| LOW_CREDIT | gold | `alert` | `var(--color-accent)` | `var(--color-gold-soft)` |
| outros | neutral | `repeat` | `var(--color-text-sec)` | `var(--color-surface-2)` |

**CTA_CONFIG — elementos a completar:**

O `CTA_CONFIG` atual cobre `LOW_CREDIT`, `DELIVERY_DONE`, `RECONFIGURE`. Gaps a preencher:

```typescript
const CTA_CONFIG: Record<string, { label: string; path: string }> = {
  LOW_CREDIT: { label: 'Comprar créditos', path: '/client/creditos' },
  DELIVERY_DONE: { label: 'Ver pedido', path: '/client/pedidos' },     // label a corrigir: era 'Acompanhar'
  DELIVERY_EVE: { label: 'Ver pedido', path: '/client/pedidos' },      // NOVO — D-10
  OUT_FOR_DELIVERY: { label: 'Acompanhar', path: '/client/pedidos' },  // NOVO — D-11
  RECONFIGURE: { label: 'Ajustar agenda', path: '/client/agenda' },
}
```

- [ ] `DELIVERY_EVE` adicionado ao CTA_CONFIG com label "Ver pedido" e path `/client/pedidos` (D-10)
- [ ] `OUT_FOR_DELIVERY` adicionado ao CTA_CONFIG com label "Acompanhar" e path `/client/pedidos` (D-11)
- [ ] `DELIVERY_DONE` label atualizado para "Ver pedido" (mais preciso que "Acompanhar" pós-entrega)

**CTA button — elementos a verificar:**
- Tone `gold` (LOW_CREDIT): bg `var(--color-gold)`, color `var(--color-app-bg)`
- Tone `good` e `neutral`: bg `var(--color-surface-2)`, color `var(--color-text)`
- Radius 11, padding `8px 14px`, fontWeight 700, fontSize 13
- `onClick={() => navigate(cta.path)` — já implementado

**Mark-all-read automático — elementos a verificar:**
- [ ] `PATCH /notifications/read-all` chamado no `useEffect` de montagem (já implementado na linha 75: `apiFetch('/notifications/read-all', { method: 'PATCH' })`)
- [ ] Badge do sino zera imediatamente após montagem — depende da integração com `NotifContext` (ver seção Interaction Contracts)
- [ ] Sem botão explícito "Marcar como lida" — comportamento automático ao abrir tela (D-08)

**Empty state — elementos a verificar:**
- [ ] Ícone `bell` size 48, color textTer
- [ ] Heading: "Tudo tranquilo por aqui" — Bricolage 16px, weight 700, textSec, margin `12px 0 6px`
- [ ] Body: "As notificações sobre suas entregas e créditos aparecem aqui." — 13px, textTer, lineHeight 1.5

**Skeleton — elementos a verificar:**
- [ ] 3 divs height 80, radius `var(--radius-card)`, bg surface-2

---

### HomeScreen (`/client/home`) — Badge do Sino

**Status:** badge já implementado via `useNotifBadge` — **migrar para NotifContext**

Esta tela não recebe mudança visual. A única mudança é trocar `useNotifBadge()` por `useNotif()` do `NotifContext`.

**Badge do sino — elementos a verificar (sem mudança visual):**
- [ ] Badge aparece quando `unreadCount > 0`
- [ ] Badge: bg `var(--color-gold)`, color `var(--color-espresso)` (ou branco — manter como está no código existente)
- [ ] Badge zerado quando cliente abre NotificationsScreen (via `refresh()` do NotifContext após mark-all-read)
- [ ] Botão sino navega para `/client/notificacoes`

---

## Component Inventory

Componentes reutilizáveis envolvidos nesta fase — não recriar, apenas usar/auditar.

| Componente | Path | Uso nesta fase | Status |
|------------|------|----------------|--------|
| `Icon` | `components/brand/Icon.tsx` | Todas as telas | Existente — usar com `name`, `size`, `stroke`, `color` |
| `BreadMark` | `components/brand/BreadMark.tsx` | HeroCard (TrackingScreen) | Existente — apenas verificar |
| `ClientTabBar` | `components/client/ClientTabBar.tsx` | Layout wrapper | Existente — verificar aba "Pedidos" ativa em `/client/pedidos` |

**Novos a criar:**

| Componente/Hook | Path sugerido | O que faz |
|----------------|---------------|-----------|
| `NotifContext` | `contexts/NotifContext.tsx` | `unreadCount` + `refresh()` — React.createContext, pattern de AuthContext |
| `useNotif` hook | dentro de `NotifContext.tsx` | `useContext(NotifContext)` — consumido em HomeScreen e NotificationsScreen |

---

## Copywriting Contract

Idioma: português brasileiro, tom informal e conversacional, voz da marca Cheirin de Pão.

| Elemento | Copy |
|----------|------|
| AppBar TrackingScreen | "Sua entrega" |
| AppBar NotificationsScreen | "Notificações" |
| Step 1 label | "Agendado" |
| Step 1 desc | "Pedido confirmado e créditos reservados" |
| Step 2 label | "Saiu para entrega" |
| Step 2 desc | "O entregador está a caminho do seu condomínio" |
| Step 3 label | "Entregue" |
| Step 3 desc | "Pãezinhos na sua porta. Bom dia!" |
| Pill step atual | "agora" |
| StatusPill SCHEDULED | "Agendado" |
| StatusPill OUT_FOR_DELIVERY | "A caminho" (com dot verde) |
| StatusPill DELIVERED | "Entregue" |
| HeroCard subtítulo | "Entrega no seu condomínio" |
| Courier label | "Seu entregador" |
| Courier nome placeholder | "A definir" |
| History section heading | "Histórico" |
| History type SCHEDULED | "Agendamento" |
| History type SINGLE | "Pedido único" |
| Empty state TrackingScreen heading | "Nenhuma entrega ainda" |
| Empty state TrackingScreen body | "Seus pedidos dos últimos 30 dias aparecem aqui. Configure sua agenda para começar." |
| Empty state NotificationsScreen heading | "Tudo tranquilo por aqui" |
| Empty state NotificationsScreen body | "As notificações sobre suas entregas e créditos aparecem aqui." |
| CTA LOW_CREDIT | "Comprar créditos" |
| CTA DELIVERY_DONE | "Ver pedido" |
| CTA DELIVERY_EVE | "Ver pedido" |
| CTA OUT_FOR_DELIVERY | "Acompanhar" |
| CTA RECONFIGURE | "Ajustar agenda" |
| Push véspera — título | "Entrega amanhã 🍞" |
| Push véspera — body | "Lembrete: {N} pães agendados para {diaSemana}, {horário}." |
| Push entregue — título | "Entrega realizada! 🎉" |
| Push entregue — body | "Seus {N} pães foram entregues. Bom apetite!" |

---

## Interaction Contracts

### NotifContext — Criação

Seguir exatamente o padrão do `AuthContext` existente:

```typescript
// apps/web/src/contexts/NotifContext.tsx
interface NotifContextValue {
  unreadCount: number
  refresh: () => void
}

const NotifContext = React.createContext<NotifContextValue>({
  unreadCount: 0,
  refresh: () => {},
})

export function NotifProvider({ children }: { children: React.ReactNode }) {
  // Mesma lógica de useNotifBadge — fetch /notifications/unread-count
  // refresh() re-faz o fetch e atualiza o state
  return <NotifContext.Provider value={{ unreadCount, refresh }}>{children}</NotifContext.Provider>
}

export function useNotif() {
  return useContext(NotifContext)
}
```

- Provisionar `<NotifProvider>` no `ClientLayout` (arquivo: `apps/web/src/layouts/ClientLayout.tsx` ou equivalente)
- `HomeScreen`: substituir `const { unreadCount } = useNotifBadge()` por `const { unreadCount } = useNotif()`
- `NotificationsScreen`: após `PATCH /notifications/read-all`, chamar `refresh()` do `useNotif()` para zerar o badge imediatamente (D-08)
- `useNotifBadge` pode ser removido ou mantido como wrapper — decisão do executor

### NotificationsScreen — Mark-All-Read automático

Comportamento atual (linha 75 do código): `PATCH /notifications/read-all` já é chamado no `useEffect` de montagem.

Gap a preencher: após o PATCH, chamar `refresh()` do NotifContext para sincronizar o badge no HomeScreen:

```typescript
// No useEffect de load em NotificationsScreen:
const { refresh } = useNotif()

apiFetch('/notifications/read-all', { method: 'PATCH' })
  .then(() => {
    setIsRead(true)
    refresh() // zera badge na HomeScreen
  })
  .catch(() => {})
```

### useOneSignalDeepLink — Extensão

Adicionar case `'pedidos'` ao handler existente (D-05):

```typescript
// apps/web/src/hooks/useOneSignalDeepLink.ts
const screen = event?.notification?.additionalData?.screen
if (screen === 'creditos') {
  navigate('/client/creditos')
} else if (screen === 'pedidos') {
  navigate('/client/pedidos')
}
```

- Extensão montada em `ClientLayout` (já está — `useOneSignalDeepLink()` já é chamado lá)
- Não criar novo listener — adicionar ao `handleClick` existente

### Backend — sendEveReminders (cron 21h)

Arquivo: `apps/api/src/modules/schedules/schedules.service.ts`

Adicionar ao push OneSignal em `sendEveReminders()` (D-03, D-09):
- `additionalData: { screen: 'pedidos' }` no payload do push
- `actionRoute: '/client/pedidos'` na chamada a `createAndTrim` para a notificação in-app do tipo `DELIVERY_EVE`

### Backend — notifyAndPersist (confirmação de entrega)

Arquivo: `apps/api/src/modules/admin-orders/admin-orders.service.ts`

Adicionar ao push OneSignal em `notifyAndPersist()` (D-04):
- `additionalData: { screen: 'pedidos' }` no payload do push de `DELIVERY_DONE`

### Polling de rastreamento — useOrderTracking

- Intervalo: 30s (mantido como está — sem alteração)
- Parar quando: status `DELIVERED` (já implementado)
- `order` é `null` quando não há pedido hoje

### Navegação Geral — Fase 9

```
/client/home
  ├── tap sino → /client/notificacoes
  └── (badge zerado ao abrir /client/notificacoes)

/client/pedidos (TrackingScreen)
  ├── back → navigate(-1) [ou /client/home como fallback]
  └── acessível via tab bar "Pedidos" (ClientTabBar)

/client/notificacoes (NotificationsScreen)
  ├── back → navigate(-1)
  ├── tap CTA DELIVERY_DONE/DELIVERY_EVE/OUT_FOR_DELIVERY → /client/pedidos
  ├── tap CTA LOW_CREDIT → /client/creditos
  └── tap CTA RECONFIGURE → /client/agenda

Push notification (OneSignal)
  ├── screen: 'pedidos' → navigate('/client/pedidos')
  └── screen: 'creditos' → navigate('/client/creditos') [existente]
```

---

## Auditoria vs Criação — Mapa de Trabalho

| Elemento | Verbo | O que fazer |
|----------|-------|-------------|
| TrackingScreen — HeroCard | verificar | Confirmar espresso bg, BreadMark watermark, formatHeroDate, formatQty |
| TrackingScreen — Timeline 3 estados | verificar | Confirmar circle done/cur/future, connector, pill "agora" |
| TrackingScreen — Courier card | verificar | Confirmar layout avatar + nome + phone button |
| TrackingScreen — Histórico skeleton | verificar | Confirmar 3 divs height 64 surface-2 |
| TrackingScreen — Histórico empty state | verificar | Confirmar ícone + heading + body corretos |
| TrackingScreen — Histórico lista | verificar | Confirmar item layout, StatusPill, formatHistoryDate/Time |
| TrackingScreen — AppBar back | verificar | Confirmar `navigate(-1)` e fallback se necessário |
| NotificationsScreen — tone map | verificar | Confirmar icon/bg por type (DELIVERY_EVE, DELIVERY_DONE, OUT_FOR_DELIVERY, LOW_CREDIT) |
| NotificationsScreen — border não lida | verificar | `1.5px solid accent` quando `!isRead && !n.isRead` |
| NotificationsScreen — formatTimestamp | verificar | Confirmar lógica: agora < 1h / Xh atrás / Xd atrás / data |
| NotificationsScreen — mark-all-read | verificar | PATCH já chamado; verificar método (está `'PATCH'` — endpoint aceita PATCH ou PUT?) |
| NotificationsScreen — empty state | verificar | Confirmar ícone + heading + body corretos |
| NotificationsScreen — skeleton | verificar | 3 divs height 80 surface-2 |
| NotificationsScreen — CTA_CONFIG DELIVERY_EVE | completar | Adicionar entrada `DELIVERY_EVE: { label: 'Ver pedido', path: '/client/pedidos' }` |
| NotificationsScreen — CTA_CONFIG OUT_FOR_DELIVERY | completar | Adicionar entrada `OUT_FOR_DELIVERY: { label: 'Acompanhar', path: '/client/pedidos' }` |
| NotificationsScreen — CTA_CONFIG DELIVERY_DONE label | completar | Corrigir label de "Acompanhar" para "Ver pedido" |
| NotifContext | criar | React Context com unreadCount + refresh(), provisioned em ClientLayout |
| HomeScreen — substituir useNotifBadge | completar | Trocar `useNotifBadge()` por `useNotif()` do NotifContext |
| NotificationsScreen — sincronizar badge | completar | Chamar `refresh()` após PATCH mark-all-read |
| useOneSignalDeepLink — screen pedidos | completar | Adicionar case `'pedidos'` → `navigate('/client/pedidos')` |
| sendEveReminders — additionalData | completar | Adicionar `{ screen: 'pedidos' }` no push OneSignal |
| sendEveReminders — actionRoute | completar | Adicionar `actionRoute: '/client/pedidos'` na chamada createAndTrim DELIVERY_EVE |
| notifyAndPersist — additionalData | completar | Adicionar `{ screen: 'pedidos' }` no push DELIVERY_DONE |
| Planos 05-03 / 05-04 | verificar + marcar | Confirmar que trabalho coberto; atualizar ROADMAP.md como concluídos |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | nenhum — projeto não usa shadcn | não aplicável |

Nenhuma dependência de terceiros nova é introduzida nesta fase.
Todas as libs em uso (`react-onesignal`, `react-router`, `apiFetch`) foram introduzidas em fases anteriores.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: FLAG (não-bloqueante — CTA "Acompanhar" sem substantivo; considerar "Ver entrega")
- [x] Dimension 2 Visuals: FLAG (não-bloqueante — phone button icon-only sem aria-label declarada; adicionar na execução)
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: FLAG (não-bloqueante — exceções do handoff mandatório, mesmo padrão Fase 8 aprovada)
- [x] Dimension 5 Spacing: FLAG (não-bloqueante — 38px/34px/42px são dimensões de componente herdadas do handoff)
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-06-19
