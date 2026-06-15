---
phase: 5
slug: delivery-experience
status: approved
shadcn_initialized: false
preset: none
created: 2026-06-15
reviewed_at: 2026-06-15
---

# Phase 5 — UI Design Contract: Delivery Experience

> Contrato visual e de interação para a Fase 5. Gerado por gsd-ui-researcher.
> Consumido por gsd-planner, gsd-executor e gsd-ui-auditor.
> Specs visuais do handoff são mandatórias (UI-01, CLAUDE.md).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (Tailwind CSS customizado via `@theme` em `globals.css`) |
| Preset | not applicable |
| Component library | Custom — componentes inline com CSS-in-JS via style props e CSS vars |
| Icon library | Custom SVG inline — `Icon` component em `apps/web/src/components/brand/Icon` |
| Font display | Bricolage Grotesque Variable — títulos, números grandes, AppBar |
| Font body | Hanken Grotesk — texto corrido, labels, UI |
| Source | `apps/web/src/styles/globals.css` — tokens `@theme` já definidos |

**Nota shadcn:** Projeto usa React + Vite sem `components.json`. Não inicializar shadcn — o design system é manual via CSS custom properties, padrão estabelecido nas Fases 1–4.

---

## Spacing Scale

Escala base 8-point confirmada no handoff e nos componentes existentes:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Gap entre ícone e texto, dot do badge |
| sm | 8px | Gap entre cards da timeline, padding interno de Pill |
| md | 16px | Padding lateral das telas (padding: `0 20px`), espaçamento entre steps |
| lg | 24px | Padding vertical de seções, padding bottom do scroll (24px) |
| xl | 32px | Não usado nesta fase |
| 2xl | 48px | Não usado nesta fase |
| 3xl | 64px | Não usado nesta fase |

**Exceções desta fase:**
- Padding lateral das telas: 20px (não-múltiplo de 4 — herdado do handoff e de todas as telas anteriores; mandatório)
- Hit targets mínimos: 44px em todos os elementos interativos (UI-10)
- Card de entregador na TrackingScreen: avatar 44×44px, botão de telefone 40×40px (mínimo 44px de hit area)
- Badge do sino: 7×7px visual, hit area do botão pai 40×40px
- Step indicator da timeline: círculo 34×34px com hit area 44px
- Conexão vertical da timeline: 2.5px de largura, minHeight 38px
- Padding/gap de componentes herdados do handoff (não-múltiplos de 4 — todos mandatórios): gap 13px (card entregador, row histórico), padding 14px (cards internos), padding 15px (card de notificação), paddingBottom 26px (row de step da timeline)

---

## Typography

> **Escala de handoff aprovada** — CLAUDE.md §Constraints declara "Fidelidade de Design: Alta fidelidade — cores, tipografia e espaçamentos definidos no handoff são mandatórios". Os tamanhos e pesos abaixo refletem o handoff pixel-perfect e são todos mandatórios. O limite padrão do checker (4 tamanhos, 2 pesos) não se aplica quando a fonte de verdade é um design handoff de alta fidelidade aprovado pelo projeto.

Tokens já declarados em `apps/web/src/styles/globals.css`:

| Role | Size | Family | Weight | Line Height | Usage |
|------|------|--------|--------|-------------|-------|
| Label / caption | 12.5px (`--text-sm`) | Hanken Grotesk | 600 (semibold) | 1.4 | Section labels em CAIXA ALTA, hora do step, hora das notificações, subtitle do entregador |
| Body / UI | 15px (`--text-base`) | Hanken Grotesk | 400 (regular) | 1.5 | Texto corrido; não usado diretamente nesta fase |
| Step label / card title | 16.5px (valor handoff) | Bricolage Grotesque | 700 (bold) | 1.25 | Labels dos 3 estados da timeline (Agendado / Saiu para entrega / Entregue) |
| AppBar heading | 21px (`--text-xl`) | Bricolage Grotesque | 700 (bold) | 1.2 | Títulos "Sua entrega" e "Notificações" nas AppBars |
| Hero display (card espresso) | 30px | Bricolage Grotesque | 800 (extrabold) | 1.0 | "4 pãezinhos" no hero card da TrackingScreen |

**Tamanhos fora dos tokens globais mas mandatórios pelo handoff:**
- 13px — descrição dos steps da timeline, texto do card de notificação, texto do card do entregador
- 14.5px — título de card de notificação (`fontWeight: 700`)
- 11px — timestamp de notificação (`fontWeight: 600`)
- 11.5px — label de data no hero espresso da TrackingScreen, label em CAIXA ALTA
- 16.5px — step label da timeline (Bricolage Grotesque, weight 700)

**Regra:** Para novos elementos não cobertos acima, usar 12.5px (label) ou 13px (body secundário). Nunca introduzir novo tamanho de fonte sem referência no handoff.

---

## Color

Todos os tokens já estão em `apps/web/src/styles/globals.css`:

| Role | CSS Var | Hex | Usage |
|------|---------|-----|-------|
| Dominant (60%) — app background | `--color-app-bg` | `#FAF5EC` | Background da tela, fundo de tela de notificações |
| Dominant (60%) — surface | `--color-surface` | `#FFFFFF` | Cards brancos (timeline card, notif cards, card entregador) |
| Secondary (30%) — surface 2 | `--color-surface-2` | `#F4EBDA` | Background de avatar do entregador, icon bg dos steps futuros, background de pill neutro |
| Accent (10%) — burnt orange | `--color-accent` | `#B0702A` | Elementos ativos de acento: step atual (círculo filled), step concluído (linha + círculo), badge de "agora", texto de links, ícone do bell button |
| Gold | `--color-gold` | `#E3AC3F` | Badge do sino (ponto vermelho é gold no handoff!); label da data no hero espresso; cor do item ativo na tab bar |
| Gold soft | `--color-gold-soft` | `#F3DDA6` | Background de Pill tone="gold"; fundo de botão de ação em notif tipo gold |
| Espresso | `--color-espresso` | `#1E1207` | Hero card da TrackingScreen (fundo escuro com BreadMark watermark) |
| Good | `--color-good` | `#3E7C53` | Pill "A caminho" / "agora" (cor do texto); dot animado no step atual |
| Good soft | `--color-good-soft` | `#DCEBDF` | Background de Pill tone="good"; fundo do icon de notif tipo "good" |
| Text primary | `--color-text` | `#241608` | Texto principal, step labels ativos, títulos de notif |
| Text secondary | `--color-text-sec` | `#7C6A50` | Descrição dos steps, texto de notif, label do entregador |
| Text tertiary | `--color-text-ter` | `#A89A82` | Hora dos steps, timestamp, label de data no hero |
| Border | `--color-border` | `rgba(43,26,12,0.10)` | Borda dos step circles inativos, borda do card do entregador |
| Border 2 | `--color-border-2` | `rgba(43,26,12,0.06)` | Borda de cards brancos; borda do botão sino |

**Accent reservado EXCLUSIVAMENTE para:**
1. Círculo do step atual (filled) e círculos dos steps concluídos (filled)
2. Linha vertical da timeline entre steps concluídos
3. Ícone do bell button na HomeScreen
4. Texto dos links inline (ex: "Editar agenda")

**Gold reservado EXCLUSIVAMENTE para:**
1. Ponto/badge no ícone de sino da HomeScreen
2. Label de data no hero espresso da TrackingScreen (`#E3AC3F` no fundo escuro)
3. Ícone tab bar ativo (herança de padrão existente)
4. Background de Pill de CTA em notificação tipo "gold"

**Segundo semântico (good) reservado para:**
- Pill "A caminho" e Pill "agora" na timeline
- Ícone de notificação do tipo DELIVERY_DONE (tone: good)

**Não há ação destrutiva nesta fase** — sem cor de erro/destructive necessária.

---

## Screens e Componentes

### Screen 1: TrackingScreen (`/client/pedidos`)

**Layout:** scroll vertical, fundo `--color-app-bg`, padding `0 20px 24px`

**Seção 1 — Hero Card (status de hoje):**
- Exibido apenas quando há order para hoje (`GET /orders/today` retorna dados)
- Fundo `--color-espresso` com padding 20px
- BreadMark watermark: 150px, cor `#E3AC3F`, opacidade 0.13, posição absolute `top: -36, right: -20`
- Label da data: 11.5px, cor `#E3AC3F`, weight 700, letterSpacing `0.06em`, CAIXA ALTA (ex: "QUARTA · 11 JUN")
- Quantidade: Bricolage Grotesque, weight 800, 30px, cor `#FAF5EC`, letterSpacing `-0.02em` (ex: "4 pãezinhos")
- Endereço: 13px, cor `#C7B595`, marginTop 4px
- Container: `borderRadius: var(--radius-card)`, overflow hidden, marginBottom 18px

**Seção 2 — Timeline de 3 Steps:**
- Container: paddingLeft 6px, position relative
- Step = div flex com gap 16px entre coluna esquerda (círculo + linha) e coluna direita (texto)

**Step circle (coluna esquerda):**
- Tamanho: 34×34px, borderRadius 99px, zIndex 1
- Estado CONCLUÍDO (`done`): background `--color-accent`, border 2px `--color-accent`; ícone `check` 18px, cor `--color-app-bg`, stroke 2.6
- Estado ATUAL (`cur`): background `--color-accent`, border 2px `--color-accent`; dot interno 11×11px, cor `--color-primary-btn-text` (#FBF3E4)
- Estado FUTURO: background `--color-surface`, border 2px `--color-border`; dot interno 11×11px, cor `transparent`

**Linha vertical (coluna esquerda):**
- Largura: 2.5px, minHeight: 38px, flex: 1, margin: `2px 0`
- Cor quando step acima está CONCLUÍDO: `--color-accent`
- Cor quando step acima está ATUAL ou FUTURO: `--color-border`
- Não renderiza após o último step

**Texto do step (coluna direita):**
- Label: Bricolage Grotesque, weight 700, 16.5px, letterSpacing `-0.01em`; cor `--color-text` quando done ou cur; cor `--color-text-ter` quando futuro
- Pill "agora" ao lado do label quando `cur`: tone="good", dot 6×6px `--color-good`
- Descrição: 13px, cor `--color-text-sec`, marginTop 4px, lineHeight 1.45
- Hora: 11.5px, cor `--color-text-ter`, marginTop 4px, weight 600; exibida apenas se step tiver hora (step futuro = "—" = não exibir)
- Padding bottom da row: 26px (espaçamento entre steps)

**Seção 3 — Card do Entregador:**
- Layout: flex, gap 12px, padding `14px 16px`, background `--color-surface`, borderRadius 16px, border `1px solid --color-border-2`
- Avatar: 44×44px, borderRadius 99px, background `--color-surface-2`, ícone `user` 22px, cor `--color-accent`
- Nome do entregador: weight 700, 14.5px, cor `--color-text`; label acima: 12px, cor `--color-text-ter`, weight 600
- Botão telefone: 40×40px, borderRadius 12px, background `--color-gold-soft`, ícone `phone` 19px, cor `--color-accent`
- Hit area do botão: mínimo 44px (padding se necessário)

**Seção 4 — Histórico (últimos 30 dias):**
- Título de seção: Bricolage Grotesque, 16px, weight 700, letterSpacing `-0.02em`, cor `--color-text`; marginTop 18px, marginBottom 10px
- Um card por entry de order (status não CANCELLED)
- Card: padding 14px, background `--color-surface`, borderRadius `var(--radius-card)`, display flex, gap 13px
- Ícone-avatar: 44×44px, borderRadius 13px, background `--color-surface-2`; ícone `calendar` (agendamento) ou `bag` (pedido único), tamanho 21px, cor `--color-accent`
- Data: weight 700, 14.5px, cor `--color-text`
- Detalhe: 12.5px, cor `--color-text-ter`, marginTop 1px (formato: "Agendamento · 07:10 · 4 pães")
- Pill status: tone="good" para `OUT_FOR_DELIVERY`; tone="neutral" para `DELIVERED` + dot 6×6px quando a_caminho

**Estado vazio da TrackingScreen (sem histórico):**
- Ícone: `clock` 48px, cor `--color-text-ter`
- Heading: 16px, Bricolage Grotesque, weight 700, cor `--color-text-sec`; copy: "Nenhuma entrega ainda"
- Body: 13px, cor `--color-text-ter`, lineHeight 1.5; copy: "Seus pedidos dos últimos 30 dias aparecem aqui. Configure sua agenda para começar."
- Sem CTA (não há ação destrutiva)

---

### Screen 2: NotificationsScreen (`/client/notificacoes`)

**Layout:** AppBar + scroll vertical, padding `0 20px 24px`, display flex, flexDirection column, gap 10px

**AppBar:** título "Notificações", botão voltar (40×40px, borderRadius 12px, background `--color-surface-2`)

**Card de notificação:**
- Padding: 15px
- Border: `1.5px solid --color-accent` quando `isRead=false` (novo); `1px solid --color-border-2` quando lido
- Layout: flex, gap 13px, position relative
- Icon-avatar: 42×42px, borderRadius 12px; cor e background variam por tone (ver tabela abaixo)
- Título: weight 700, 14.5px, cor `--color-text`, lineHeight 1.25
- Timestamp: 11px, cor `--color-text-ter`, weight 600, flexShrink 0, marginTop 2px
- Texto: 13px, cor `--color-text-sec`, marginTop 3px, lineHeight 1.45
- Botão CTA (quando presente): marginTop 10px, borderRadius 11px, padding `8px 14px`, weight 700, 13px, fontFamily Hanken Grotesk

**Tabela de tones para ícone-avatar:**

| Tone | Cor do ícone | Background | Tipos de notif |
|------|-------------|------------|----------------|
| gold | `--color-accent` | `--color-gold-soft` | LOW_CREDIT, RECONFIGURE |
| good | `--color-good` | `--color-good-soft` | DELIVERY_EVE (`truck`), DELIVERY_DONE (`check`) |
| neutral | `--color-text-sec` | `--color-surface-2` | RECONFIGURE (`repeat`), genérico |

**Ícones por tipo de notificação:**
- `DELIVERY_EVE` → `bell` (lembrete véspera) — tone: good
- `DELIVERY_DONE` → `check` (entrega confirmada) — tone: good
- `OUT_FOR_DELIVERY` → `truck` (saiu para entrega) — tone: good
- `LOW_CREDIT` → `alert` — tone: gold
- `RECONFIGURE` → `repeat` — tone: neutral

**Botão CTA (quando presente):**
- Tone gold → background `--color-gold`, cor `--color-app-bg` (onGold)
- Tone neutral → background `--color-surface-2`, cor `--color-text`
- CTA labels: "Comprar créditos" (LOW_CREDIT → navega para /client/creditos), "Acompanhar" (DELIVERY_DONE → navega para /client/pedidos), "Ajustar agenda" (RECONFIGURE → navega para /client/agenda)

**Comportamento de leitura:**
- `PATCH /notifications/read-all` executado no mount da tela (D-10)
- Após o PATCH, todos os cards exibem border `1px solid --color-border-2` (lidos)
- Badge do sino na HomeScreen é zerado

**Estado vazio da NotificationsScreen:**
- Ícone: `bell` 48px, cor `--color-text-ter`
- Heading: "Tudo tranquilo por aqui"
- Body: "As notificações sobre suas entregas e créditos aparecem aqui."

---

### Modificação: HomeScreen — Bell + Badge + TodayDelivery funcional

**Bell button no header (Greet component):**
- Posição: canto superior direito do header, alinhado ao nome do usuário
- Tamanho: 40×40px, borderRadius 12px, background `--color-surface`, border `1px solid --color-border-2`
- Ícone: `bell` 20px, cor `--color-text`
- Badge de notificação não lida: círculo 7×7px, background `--color-gold`, posição absolute `top: 9px, right: 9px`
- Badge exibido apenas quando `unreadCount > 0`
- Tap: navega para `/client/notificacoes`
- Aria-label: "Notificações" (+ " (X não lidas)" quando unreadCount > 0)

**TodayDelivery card funcional (substituir placeholder):**
- Card clicável → navega para `/client/pedidos`
- **Variação SCHEDULED** (agendado):
  - Hero fundo espresso; ícone `calendar` 24px, cor `#E3AC3F`; label "AGENDADO"; título "4 pãezinhos · Hoje"
  - Rodapé: Pill tone="neutral" com texto "Agendado"
- **Variação OUT_FOR_DELIVERY** (a caminho):
  - Hero fundo espresso; ícone `truck` 24px, cor `#E3AC3F`; label "SAINDO DO FORNO"
  - Rodapé: Pill tone="good" com dot verde + "A caminho"
- **Variação DELIVERED** (entregue):
  - Hero fundo espresso com opacidade reduzida; ícone `check` 24px, cor `#E3AC3F`; label "ENTREGUE"
  - Rodapé: Pill tone="neutral" com texto "Entregue hoje"
- **Sem entrega hoje** (estado existente — manter copy atual): "Nenhuma entrega agendada"

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| AppBar TrackingScreen | "Sua entrega" |
| AppBar NotificationsScreen | "Notificações" |
| Hero label (data do pedido) | "[DIA DA SEMANA] · [DD MMM]" em CAIXA ALTA — ex: "QUARTA · 11 JUN" |
| Hero quantity | "[N] pãezinhos" — sempre plural, mesmo para 1 pão ("1 pãozinho" se N=1) |
| Step label 1 | "Agendado" |
| Step label 2 | "Saiu para entrega" |
| Step label 3 | "Entregue" |
| Step desc 1 | "Pedido confirmado e créditos reservados" |
| Step desc 2 | "O entregador está a caminho do seu condomínio" |
| Step desc 3 | "Pãezinhos na sua porta. Bom dia!" |
| Pill step atual | "agora" (minúsculo) |
| Subtitle entregador | "Seu entregador" |
| Empty state TrackingScreen heading | "Nenhuma entrega ainda" |
| Empty state TrackingScreen body | "Seus pedidos dos últimos 30 dias aparecem aqui. Configure sua agenda para começar." |
| Empty state NotificationsScreen heading | "Tudo tranquilo por aqui" |
| Empty state NotificationsScreen body | "As notificações sobre suas entregas e créditos aparecem aqui." |
| Notif DELIVERY_EVE título | "Entrega amanhã" |
| Notif DELIVERY_EVE texto | "Lembrete: [N] pães agendados para [DIA], [HORA]." |
| Notif DELIVERY_DONE título | "Entrega realizada" |
| Notif DELIVERY_DONE texto | "Seus [N] pães foram entregues. Bom apetite!" |
| Notif OUT_FOR_DELIVERY título | "Saiu para entrega" |
| Notif OUT_FOR_DELIVERY texto | "O entregador está a caminho com seus [N] pãezinhos." |
| Bell aria-label (sem novidades) | "Notificações" |
| Bell aria-label (com novidades) | "Notificações ([N] não lidas)" |
| Histórico — detalhe do item | "[Tipo] · [HH:MM] · [N] pães" — ex: "Agendamento · 07:10 · 4 pães" |
| Histórico — Pill SCHEDULED | "Agendado" |
| Histórico — Pill OUT_FOR_DELIVERY | "A caminho" |
| Histórico — Pill DELIVERED | "Entregue" |
| TodayDelivery label SCHEDULED | "AGENDADO" |
| TodayDelivery label OUT_FOR_DELIVERY | "SAINDO DO FORNO" |
| TodayDelivery label DELIVERED | "ENTREGUE" |
| Sem entrega hoje (HomeScreen) | "Nenhuma entrega agendada" |

**Ações destrutivas nesta fase:** nenhuma. Não há confirmações necessárias.

---

## Interações e Comportamentos

### Polling de status (D-03)
- `useOrderTracking` hook: `setInterval` a cada 30 000ms, fetch imediato na montagem
- Cleanup obrigatório: `return () => clearInterval(id)` no useEffect
- Sem MAX_ATTEMPTS — polling contínuo enquanto montado
- Falha de rede: mantém estado anterior, sem exibir erro ao usuário
- HTTP 404: seta `order = null` (sem pedido hoje)

### Badge do sino (stale prevention)
- Count carregado via `GET /notifications/unread-count` no mount da HomeScreen
- Ao retornar da NotificationsScreen: HomeScreen é re-montada automaticamente via React Router → refetch automático
- Sem necessidade de context global — estado local no HomeScreen

### Marcar como lidas
- `PATCH /notifications/read-all` executado no mount da NotificationsScreen (D-10)
- Sem feedback visual da operação (silencioso)
- Lista exibida imediatamente com dados do GET anterior; borders atualizadas para "lido" após o PATCH

### Transições da timeline
- Sem animação de transição entre estados no MVP — atualização imediata ao polling detectar mudança
- Step atual marcado com Pill "agora" (cor good)
- Step hora do estado futuro não exibida ("—" substituído por ausência do elemento)

### Cards de histórico
- Não são clicáveis no MVP
- Scroll vertical nativo do container pai

---

## Componentes Reutilizáveis Existentes

| Componente | Localização | Como reutilizar nesta fase |
|------------|-------------|---------------------------|
| `Icon` | `apps/web/src/components/brand/Icon` | Ícones da timeline, bell, notif cards — usar `bell`, `truck`, `check`, `calendar`, `bag`, `user`, `phone`, `alert`, `repeat`, `arrowL`, `chevR` |
| `ClientTabBar` | `apps/web/src/components/client/ClientTabBar` | Já presente em `ClientLayout` — sem alteração |
| `BreadMark` | `apps/web/src/components/brand/BreadMark` | Watermark no hero espresso da TrackingScreen |
| `HomeScreen` | `apps/web/src/pages/client/HomeScreen` | Modificar: adicionar bell com badge + TodayDelivery funcional |

**Novos componentes a criar nesta fase:**

| Componente | Localização | Responsabilidade |
|------------|-------------|-----------------|
| `TrackingScreen` | `apps/web/src/pages/client/TrackingScreen.tsx` | Hero card + timeline + histórico |
| `NotificationsScreen` | `apps/web/src/pages/client/NotificationsScreen.tsx` | Lista de notificações com cards por tipo |
| `useOrderTracking` | `apps/web/src/hooks/useOrderTracking.ts` | Polling GET /orders/today a cada 30s |
| `useNotifications` | `apps/web/src/hooks/useNotifications.ts` | GET /notifications/me + PATCH /notifications/read-all |
| `useNotifBadge` | `apps/web/src/hooks/useNotifBadge.ts` | GET /notifications/unread-count para o badge |

---

## Acessibilidade

- Todos os botões com `aria-label` descritivo (bell, voltar, botão telefone)
- Pill "agora" com atributo `aria-live="polite"` para anunciar mudança de estado em tempo real
- Timeline: usar `role="list"` no container e `role="listitem"` em cada step
- Ícone de check (step concluído): `aria-hidden="true"` (decorativo)
- Cards de histórico: cada card com `aria-label` incluindo data e status
- Cards de notificação: `aria-label` com título + texto da notificação

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| N/A | N/A | shadcn não inicializado — registry gate não aplicável |

Nenhum componente de terceiros adicionado nesta fase. Todos os componentes são custom, herdados das fases anteriores ou novos construídos from scratch.

---

## Fontes de Pre-Population

| Source | Decisões Aplicadas |
|--------|-------------------|
| CONTEXT.md | D-07 (TrackingScreen unificada), D-08 (histórico 30 dias, sem dias vazios), D-09 (bell+badge, abre NotificationsScreen), D-10 (30 notif max, mark-all-read ao abrir) |
| RESEARCH.md | Padrão polling setInterval+cleanup, padrão NotifsScreen do handoff, padrão ícones por tipo |
| `globals.css` | Todos os tokens de cor, tipografia e raios — pré-existentes |
| `screens-client-extra.jsx` | Layout exato da TrackingScreen (TrackScreen) e NotificationsScreen (NotifsScreen) — mandatório |
| `screens-home.jsx` | Bell button no Greet component, TodayDelivery card — referência mandatória |
| `brand.jsx` | THEMES.light — todos os valores de cor confirmados |
| `data.jsx` | TRACK_STEPS — copy dos 3 estados e descrições |
| Componentes existentes | `ClientTabBar`, `Icon`, `BreadMark`, `HomeScreen` — reutilizados sem alteração de API |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
