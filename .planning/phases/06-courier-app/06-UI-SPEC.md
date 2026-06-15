---
phase: 6
slug: courier-app
status: draft
shadcn_initialized: false
preset: none
created: 2026-06-15
---

# Phase 6 — UI Design Contract: Courier App

> Contrato visual e de interação para o app do entregador (CourierScreen + CourierRoute).
> Gerado por gsd-ui-researcher. Verificado por gsd-ui-checker.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (CSS custom properties via `@theme` em `globals.css`) |
| Preset | not applicable |
| Component library | nenhuma — primitivas próprias (Card, Pill, Icon, BreadMark) |
| Icon library | Set próprio em `apps/web/src/components/brand/Icon.tsx` (paths SVG 24×24, `currentColor`) |
| Font — display | Bricolage Grotesque Variable (`--font-display`), pesos 700–800 |
| Font — body/UI | Hanken Grotesk (`--font-body`), pesos 400–700 |

Nota: shadcn não está inicializado. Stack é React + Vite + Tailwind CSS. Design system é o conjunto de tokens CSS declarado em `globals.css` + primitivas em `brand/`. Não inicializar shadcn nesta fase — padrão já estabelecido nas fases anteriores.

---

## Spacing Scale

Escala 4-point declarada em `globals.css` via inline style (projecto usa `style={}` nas primitivas, alinhado ao padrão do handoff). Escala canônica:

| Token | Value | Uso nesta fase |
|-------|-------|----------------|
| xs | 4px | Gap entre ícone e label no segmented control |
| sm | 8px | Gap entre chips/pills, padding do label OSRM |
| md | 16px | Padding lateral das telas, padding interno dos cards |
| lg | 24px | Padding de seção, espaço entre card de progresso e lista |
| xl | 32px | — |
| 2xl | 48px | — |
| 3xl | 64px | — |

Exceções:
- **Padding lateral da tela**: 20px (fiel ao handoff — `padding: '0 20px'`)
- **Hit target mínimo**: 44px em todos os elementos tocáveis (paradas, botões do accordion, segmented tabs) — requisito UI-10
- **Card de progresso interno**: padding 16px × 18px (horizontal maior, fiel ao handoff)
- **Linha de parada (touch area)**: mínimo 44px de altura via `padding: '10px 16px'` + conteúdo de ~24px

---

## Typography

Fonte: `--font-display` (Bricolage Grotesque) para números de destaque e títulos; `--font-body` (Hanken Grotesk) para UI e corpo. Tokens já definidos em `globals.css`.

| Role | Size | Fonte | Weight | Letter-spacing | Line Height | Uso nesta fase |
|------|------|-------|--------|---------------|-------------|---------------|
| Label | 11.5px (--text-sm ~) | body | 700 | +0.04em a +0.06em | 1.2 | "PROGRESSO", "ORDEM SUGERIDA NO PRÉDIO", "Total de pães" |
| Body | 12.5px | body | 600–700 | 0 | 1.4 | Subtítulo condomínio (bairro · pães · paradas), nome do cliente, hora estimada |
| Base | 14.5–15px | body | 700 | -0.01em | 1.4 | Apartamento na lista de paradas, nome do condomínio na aba Rota |
| Heading | 16–18px | display | 700 | -0.02em | 1.2 | Nome do condomínio no accordion header, saudação |
| Display | 26px | display | 800 | -0.02em | 1.0 | Contador progresso (`X/N paradas`) e total de pães no card espresso |

Mapeamento aos tokens CSS existentes:
- `--text-sm: 12.5px` → subtítulos e labels secundários
- `--text-base: 15px` → texto de UI padrão
- `--text-xl: 21px` → não usado diretamente nesta fase
- `--text-3xl: 32px` → não usado nesta fase (display é 26px, inline style)

Nota: 26px é intermediário entre `--text-xl` (21px) e `--text-3xl` (32px). Usar `fontSize: 26` via inline style no card de progresso, alinhado ao padrão do handoff.

---

## Color

Tokens de `globals.css` (THEMES.light). Todos declarados como CSS custom properties.

| Role | Token CSS | Hex | Uso nesta fase |
|------|-----------|-----|---------------|
| Dominant (60%) | `--color-app-bg` | `#FAF5EC` | Fundo da tela do entregador |
| Secondary (30%) | `--color-surface` `--color-surface-2` | `#FFFFFF` / `#F4EBDA` | Cards accordion, card de rota, fundo do segmented control |
| Accent primário | `--color-gold` | `#E3AC3F` | Badge numérico do condomínio, barra de progresso, polyline da rota, pinos do mapa, número de pães confirmados, check box preenchido |
| Accent secundário | `--color-accent` | `#B0702A` | Quantidade de pães por parada (número em destaque na linha), ícone de rota no tooltip do mapa |
| Espresso | `--color-espresso` | `#1E1207` | Card de progresso (fundo), avatar BreadMark no header, pinos do mapa (fundo do círculo) |
| Good / Sucesso | `--color-good` | `#3E7C53` | Check box preenchido após confirmar, pill "Ok" do condomínio concluído, ponto inicial verde na rota |
| Good soft | `--color-good-soft` | `#DCEBDF` | Fundo da pill "Ok" |
| Gold soft | `--color-gold-soft` | `#F3DDA6` | Fundo da pill com contagem parcial (ex: "2/4") |
| Texto principal | `--color-text` | `#241608` | Nomes, labels principais |
| Texto secundário | `--color-text-sec` | `#7C6A50` | Label "PROGRESSO" (gold no handoff — usar `--color-gold`), hora estimada |
| Texto terciário | `--color-text-ter` | `#A89A82` | Subtítulos de condomínio, chevron inativo |
| Destrutivo | — | N/A | Nenhuma ação destrutiva nesta fase |

Accent reservado para:
1. Badge dourado numerado do condomínio (número de ordem: 36×36px, fundo `gold`, texto `espresso`)
2. Barra de progresso (`width` animado, `background: gold`)
3. Polyline da rota SVG (cor dourada tracejada)
4. Pinos numerados no mapa (círculo `espresso` + borda `gold`, texto `gold`)
5. Número de pães por parada na linha (cor `accent` #B0702A, Bricolage 17px bold)
6. Estado ativo do segmented control (subtil: `surface` com shadowSoft — não usa gold)
7. BreadMark no avatar do header (cor gold, tamanho 27px)

---

## Component Inventory

Componentes a criar nesta fase (todos em `apps/web/src/`):

### Telas (pages)

| Componente | Caminho | Descrição |
|-----------|---------|-----------|
| `CourierScreen` | `pages/courier/CourierScreen.tsx` | Tela principal: header + segmented control + card de progresso + lista ou rota |
| `CourierRouteView` | `pages/courier/CourierRouteView.tsx` | Sub-view da aba "Rota": mapa Leaflet real + lista de paradas com horário estimado |

### Componentes reutilizáveis (novos)

| Componente | Caminho | Descrição |
|-----------|---------|-----------|
| `ProgressCard` | `components/courier/ProgressCard.tsx` | Card espresso com `X/N paradas`, total de pães e barra de progresso dourada |
| `SegmentedControl` | `components/courier/SegmentedControl.tsx` | Tabs Lista / Rota com ícone + label; reutilizável por outras fases |
| `CondoAccordion` | `components/courier/CondoAccordion.tsx` | Accordion de condomínio: header clicável + lista de paradas internas |
| `StopRow` | `components/courier/StopRow.tsx` | Linha de parada: número de ordem, checkbox, apartamento, cliente, quantidade |
| `ConfirmDeliveryDialog` | `components/courier/ConfirmDeliveryDialog.tsx` | Modal de confirmação antes de PATCH confirm (D-02) |
| `CourierMap` | `components/courier/CourierMap.tsx` | Wrapper react-leaflet com tiles OSM, marcadores dourados, polyline e tooltip de distância |

### Componentes reutilizáveis existentes (não recriar)

- `apps/web/src/components/brand/Icon.tsx` — ícones `list`, `route`, `check`, `chevD`, `pin`
- `apps/web/src/components/brand/BreadMark.tsx` — avatar do header (size=27, color=`#E3AC3F`)

---

## Screens Detail

### CourierScreen — Layout Geral

```
┌─────────────────────────────────────────┐  fundo: --color-app-bg (#FAF5EC)
│ [Avatar BreadMark 42px espresso]         │  padding: 4px 20px 12px
│ Rota de hoje · {data}     Olá, {nome}   │
├─────────────────────────────────────────┤
│ [Segmented] [Lista ▸] [Rota]            │  padding: 0 20px 12px
├─────────────────────────────────────────┤
│ [ProgressCard espresso 16px/18px]        │  padding: 0 20px
│  PROGRESSO   X/N paradas | Total pães   │
│  [barra dourada animada height:6px]      │
├─────────────────────────────────────────┤
│ [Lista de acordeões OU CourierRouteView] │  padding: 0 20px 24px
└─────────────────────────────────────────┘
```

### SegmentedControl

- Fundo: `--color-surface-2` (#F4EBDA), border-radius 13px, padding 4px
- Tab ativa: fundo `--color-surface` (#FFF), border-radius 10px, `shadowSoft`
- Tab inativa: fundo transparente
- Altura de cada tab: mínimo 44px (padding: 9px 0, conteúdo ~26px)
- Fonte: Hanken Grotesk 13.5px weight 700
- Cor ativa: `--color-text`; inativa: `--color-text-sec`
- Ícones: `list` (Lista) e `route` (Rota), size 17px

### ProgressCard

- Fundo: `--color-espresso` (#1E1207), border-radius herdado do Card (22px)
- Layout: flex row com gap 14px, padding 16px 18px
- BreadMark decorativo: position absolute, bottom -40px, right -16px, opacity 0.12, size 130px, cor gold
- "PROGRESSO": 11.5px, Hanken, weight 700, cor `#E3AC3F`, letter-spacing 0.06em
- Contador: 26px, Bricolage, weight 800, cor `#FAF5EC`
- "Total de pães" label: 11.5px, Hanken, weight 600, cor `#C7B595` (textSec dark)
- Total de pães: 26px, Bricolage, weight 800, cor `#E3AC3F`
- Barra de progresso: height 6px, fundo `--color-surface-2`, fill `--color-gold`, `transition: width 0.3s ease`

### CondoAccordion — Header

- Card border-radius 22px, shadowSoft, fundo surface
- Badge numérico: 36×36px, border-radius 11px, fundo `--color-gold`, cor `--color-espresso`, Bricolage 16px weight 800
- Nome do condomínio: Bricolage 16px weight 700, color `--color-text`, letter-spacing -0.02em
- Subtítulo: 12.5px Hanken weight 600, cor `--color-text-ter`
- Pill parcial (`X/N`): tone "gold" (fundo `goldSoft`, cor `accent`)
- Pill concluído ("Ok"): tone "good" (fundo `goodSoft`, cor `good`) com ícone `check` size 13px
- Chevron: Icon `chevD` size 18px, cor `textTer`, `transform: rotate(180deg)` quando aberto, `transition 0.2s`
- Toque em qualquer ponto do header toggle o accordion

### CondoAccordion — Conteúdo (paradas)

- Separador: `borderTop: 1px solid --color-border-2`
- Label seção: "ORDEM SUGERIDA NO PRÉDIO", 11px, weight 700, letter-spacing 0.04em, cor `textTer`, padding 6px 16px 2px
- Cada parada: `padding: 10px 16px`, `cursor: pointer`, touch area mínimo 44px
  - Número de ordem: círculo 22×22px, border-radius 99px, fundo `surface2`, cor `textSec`, Bricolage 12px weight 800
  - Checkbox: 28×28px, border-radius 9px, borda 2px
    - Não confirmado: `border-color: --color-border`, fundo transparente
    - Confirmado: `border-color: --color-good`, `background: --color-good`, ícone `check` size 16px, cor `#fff`, stroke 3
    - Transição: `all 0.15s`
  - Apartamento: 14.5px, weight 700, cor `text`
    - Confirmado: `text-decoration: line-through`, `opacity: 0.5`
  - Nome cliente: 12.5px, cor `textTer`
  - Quantidade: Bricolage 17px, weight 800, cor `--color-accent`

### ConfirmDeliveryDialog (D-02)

- Modal (não bottom sheet): backdrop `rgba(0,0,0,0.4)`, zIndex 100
- Card centralizado: fundo `surface`, border-radius 22px, padding 24px, largura máx. 320px, margin 20px
- Título: "Confirmar entrega?" — Bricolage 18px weight 700
- Corpo: "{Número de pães} pães para {Nome do cliente}" + "Apartamento {número}" — 15px, cor `textSec`
- Dois botões (full width, gap 8px, stacked vertical):
  1. "Cancelar" — variant ghost (borda `border`, fundo transparente)
  2. "Confirmar entrega" — variant primary (fundo `espresso`, cor `primaryBtnText`)
- Fechar ao clicar fora do card
- Estado loading: botão "Confirmar entrega" com opacity 0.6 e cursor wait durante a chamada PATCH

### CourierRouteView (Aba Rota)

**Mapa Leaflet (react-leaflet):**
- Container: Card border-radius 22px overflow hidden, height 290px
- Tiles: OpenStreetMap padrão (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`)
- Marcadores: círculo espresso com borda gold, número dourado (Bricolage), implementados como DivIcon customizado
- Polyline: cor `#E3AC3F`, weight 4px, dashArray "2 9" (tracejado), lineCap round
- Ponto de partida (posição atual): círculo verde `--color-good`, raio 6px
- Tooltip de distância/tempo (posição absoluta, bottom-left do card): fundo `surface`, border-radius 10px, padding 7px 11px, shadowSoft; ícone `route` color `accent`; "~X km · N paradas" 12.5px weight 700

**Lista de paradas (abaixo do mapa):**
- Cada item: fundo `surface`, border-radius 16px, borda `border2`, padding 13px 16px, gap 13px
- Badge: 32×32px, border-radius 10px, fundo `gold`, cor `espresso`, Bricolage 15px weight 800
- Nome: 14.5px weight 700, cor `text`
- Subtítulo: 12px, cor `textTer`
- Hora estimada: 12.5px weight 700, cor `textSec`

---

## Interaction Contracts

### Accordion (CondoAccordion)

- Um único condomínio aberto por vez (accordion exclusivo, não multi-open)
- Toque no header: toggle aberto/fechado
- Animação de abertura: recomendado CSS `max-height` transition 0.2s ou simplesmente montagem condicional (sem animação forçada) — aceito dado o tamanho da lista
- Estado inicial: primeiro condomínio aberto (`open === 0`)

### Confirmação de parada (StopRow → ConfirmDeliveryDialog)

1. Entregador toca na linha da parada (status: não confirmado)
2. Dialog abre com dados da parada (apartamento + cliente + quantidade)
3. Entregador toca "Confirmar entrega"
4. Chamada `PATCH /courier/orders/:id/confirm` (loading state no botão)
5. Ao receber 200: dialog fecha, parada recebe estado confirmado (strikethrough + opacity 50% + check verde), pill do condomínio atualiza contagem, barra de progresso anima
6. Erro de rede: dialog permanece aberto, botão volta ao estado normal, mensagem de erro inline sob o botão confirmar: "Falha na conexão. Tente novamente."

### Regras de estado da parada

- Estado inicial: não confirmado (checkbox vazio, sem strikethrough)
- Estado confirmado: irreversível na UI — checkbox verde preenchido, texto com strikethrough e opacity 50%
- Pill do condomínio: `feitas/total` (gold) → "Ok" (good) quando `feitas === total`
- Barra de progresso: atualiza em tempo real, `transition: width 0.3s ease`

### Segmented Control (Lista ↔ Rota)

- Troca de view: instantânea, sem animação de transição entre painéis
- Estado "Lista" ativo por padrão ao entrar na tela
- O card de progresso permanece visível em ambas as views

### Mapa (CourierRouteView)

- Mapa carrega com `fitBounds` nos marcadores da rota ao montar
- Loading state do mapa: spinner dourado centralizado sobre o container de 290px enquanto os tiles carregam
- Erro de geocodificação: marcador cinza com "?" substitui o número; tooltip indica "Endereço não localizado"
- Erro de rota OSRM: polyline não é desenhada; tooltip exibe "Rota indisponível" (sem bloquear o uso da lista)

---

## Copywriting Contract

| Elemento | Texto |
|---------|-------|
| Header — subtítulo | "Rota de hoje · {dia} {mês}" |
| Header — saudação | "Olá, {nome do entregador}" |
| ProgressCard — label contagem | "PROGRESSO" |
| ProgressCard — label pães | "Total de pães" |
| Segmented tab lista | "Lista" |
| Segmented tab rota | "Rota" |
| Accordion — label ordem | "ORDEM SUGERIDA NO PRÉDIO" |
| Pill condomínio concluído | "Ok" |
| Dialog — título | "Confirmar entrega?" |
| Dialog — corpo | "{N} pão(ões) para {Nome do cliente} · Apartamento {número}" |
| Dialog — CTA cancelar | "Cancelar" |
| Dialog — CTA confirmar | "Confirmar entrega" |
| Dialog — erro de rede | "Falha na conexão. Tente novamente." |
| Mapa — tooltip distância | "~{X} km · {N} paradas" |
| Mapa — erro geocoding | "Endereço não localizado" |
| Mapa — erro rota | "Rota indisponível" |
| Empty state (sem entregas hoje) — heading | "Sem entregas hoje" |
| Empty state (sem entregas hoje) — corpo | "Não há pedidos atribuídos a você para hoje." |
| Loading do mapa | (spinner, sem texto) |

Nota sobre pluralização:
- "1 pão" / "N pães" — usar lógica: `qtd === 1 ? '1 pão' : '${qtd} pães'`
- "1 parada" / "N paradas" — idem

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | nenhum | not applicable — shadcn não inicializado |
| react-leaflet | `MapContainer`, `TileLayer`, `Polyline`, `Marker`, `Tooltip`, `useMap` | Biblioteca declarada em D-08 do CONTEXT.md; instalação via npm (não registry shadcn) — sem vetting de registry requerido |
| leaflet | Dependência peer do react-leaflet | idem |

Nota: `react-leaflet` e `leaflet` são instalados como pacotes npm padrão, não via shadcn registry. Vetting de registry shadcn não se aplica.

---

## Accessibility Checklist

| Item | Contrato |
|------|---------|
| Hit targets | Mínimo 44px em toda parada, header de accordion, tabs do segmented control, botões do dialog — requisito UI-10 |
| `aria-expanded` | Header do accordion expõe estado ao leitor de tela |
| `role="dialog"` + `aria-modal="true"` | ConfirmDeliveryDialog |
| `aria-label` nos ícones | BreadMark com `aria-label="Cheirin de Pão"` (já implementado); ícones decorativos com `aria-hidden="true"` |
| Focus trap | Dialog captura foco enquanto aberto; ao fechar, foco retorna ao elemento que o abriu |
| `prefers-reduced-motion` | Já declarado em `globals.css` — todas as transitions desabilitadas automaticamente |
| Contraste | Todos os tokens de cor do THEMES.light passam 4.5:1 para texto normal e 3:1 para texto grande |
| Mapa | `<MapContainer>` com `aria-label="Mapa de rota do entregador"`; marcadores com `title` = nome do condomínio |

---

## Animations & Transitions

| Elemento | Propriedade | Duração | Easing |
|---------|------------|---------|--------|
| Chevron do accordion | `transform: rotate` | 0.2s | ease |
| Checkbox da parada | `border-color`, `background`, `opacity` (container) | 0.15s | ease |
| Barra de progresso | `width` | 0.3s | ease |
| Botões (hover) | `transform: translateY(-1px)`, `filter: brightness(1.05)` | 0.15s | ease |
| Segmented tab | `background`, `box-shadow` | 0.15s | ease |

Todas desabilitadas automaticamente quando `prefers-reduced-motion: reduce` (declarado em `globals.css`).

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
