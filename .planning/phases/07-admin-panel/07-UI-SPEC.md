---
phase: 7
slug: admin-panel
status: draft
shadcn_initialized: false
preset: none
created: 2026-06-15
---

# Phase 7 — UI Design Contract: Admin Panel

> Contrato visual e de interação para o painel administrativo completo (5 abas: Painel, Pedido, Entregas, Clientes, Gestão).
> Gerado por gsd-ui-researcher. Verificado por gsd-ui-checker.
> Fonte primária: `.projeto/design_handoff_cheirin_pao/app/screens-admin.jsx` + `screens-admin2.jsx` + `brand.jsx` + `README.md`.

---

## Design System

| Propriedade | Valor |
|-------------|-------|
| Tool | none (CSS custom properties via `@theme` em `globals.css`) |
| Preset | não aplicável |
| Biblioteca de componentes | primitivas próprias: `Card`, `Pill`, `Btn`, `Icon`, `BreadMark`, `AppBar`, `Field`, `Stepper`, `Switch`, `Row` |
| Biblioteca de ícones | Set próprio em `apps/web/src/components/brand/Icon.tsx` (paths SVG 24×24, `currentColor`) |
| Fonte — display | Bricolage Grotesque Variable (`--font-display`), pesos 700 e 800 |
| Fonte — body/UI | Hanken Grotesk (`--font-body`), pesos 600 e 700 |

Nota: shadcn não está inicializado e não deve ser inicializado nesta fase. O design system é o conjunto de tokens CSS declarado em `globals.css` + primitivas em `brand/`. Padrão já consolidado nas fases anteriores. Tema: CLARO (creme) — `THEMES.light`. Tema escuro fora do escopo.

---

## Spacing Scale

Escala 4-point declarada em `globals.css`. Uso de `style={}` inline nas primitivas, alinhado ao handoff.

| Token | Valor | Uso nesta fase |
|-------|-------|----------------|
| xs | 4px | Gap entre ícone e label na bottom nav, gap interno do AdminHead |
| sm | 8px | Gap entre chips de filtro (Clientes), gap entre botões PDF/Excel (Pedido step 3) |
| md | 16px | Padding interno dos cards em toda a fase |
| lg | 24px | Padding inferior da área de scroll de cada aba, separação entre seções |
| xl | 32px | — |
| 2xl | 48px | — |
| 3xl | 64px | — |

Exceções:
- **Padding lateral de tela**: 20px (fiel ao handoff — `padding: '0 20px'`)
- **Padding do AdminHead**: `4px 20px 14px`
- **Padding da bottom nav**: `8px 6px calc(8px + env(safe-area-inset-bottom, 0px))` — respeita safe area iOS
- **Hit target mínimo**: 44px em todos os elementos tocáveis (abas do nav, botões, itens de lista clicáveis, switches, chips de filtro)
- **Chip de filtro (Clientes)**: `padding: 8px 14px`, border-radius 999px
- **Bottom nav — botão de aba**: `padding: 5px 0`, altura mínima de toda a área tocável 44px

---

## Typography

Fonte display: `--font-display` (Bricolage Grotesque) para números de destaque, KPIs e títulos de seção.
Fonte body/UI: `--font-body` (Hanken Grotesk) para todo o restante.
Escala: **4 tamanhos** + **2 pesos** (700 para UI geral; 800 exclusivo para valores Bricolage de destaque).

| Role | Tamanho | Fonte | Peso | Letter-spacing | Line-height | Uso nesta fase |
|------|---------|-------|------|----------------|-------------|----------------|
| Label | 11–12.5px | body | 700 | +0.04em a +0.06em | 1.2 | Subtítulo do AdminHead, label das abas da bottom nav, label "CONSOLIDADO POR CONDOMÍNIO", label de step bar, hora estimada, meta em cards pequenos |
| Base | 13.5–15px | body | 700 | -0.01em | 1.4 | Nome de clientes, fornecedores, entregadores, condomínios em lista; corpo de cards; label de campo; texto de instrução; Row label/value; descrição de hub |
| Heading | 20px | display | 700 | -0.02em | 1.2 | Título do AdminHead (AdminHead `.titulo`), AppBar title de sub-telas, título de seção em cards |
| Display | 22–34px | display | 800 | -0.02em | 1.0 | KPIs do Painel (26px), totais de pães no Pedido (22px), receita no Financeiro (34px) |

Nota especial — Bottom nav labels: 10px, Hanken Grotesk, peso 700 (ativa) / 600 (inativa).

---

## Color

Tokens de `globals.css` (THEMES.light). Todos declarados como CSS custom properties.

| Role | Token CSS | Hex | Uso nesta fase |
|------|-----------|-----|----------------|
| Dominante (60%) | `--color-app-bg` | `#FAF5EC` | Fundo de todas as 5 abas do admin |
| Secundária (30%) | `--color-surface` `--color-surface-2` | `#FFFFFF` / `#F4EBDA` | Cards em toda a fase, fundo do segmented control, ícone de avatar em listas, fundo do AdminHead icon |
| Accent primário | `--color-accent` | `#B0702A` | Aba ativa na bottom nav (ícone + label), ícones de acesso rápido em cards de hub, ícones internos de cards de lista, step text ativo no Pedido |
| Gold (dourado) | `--color-gold` | `#E3AC3F` | BreadMark no AdminHead, barra de step ativa no Pedido, barra de progresso Entregas, barra de receita por tipo, barras do gráfico Fornadas/Financeiro (coluna destacada), botão "Aprovar divisão" (variant gold), botão CTA principal em sub-telas (variant gold) |
| Espresso | `--color-espresso` | `#1E1207` | Avatar do AdminHead (fundo 42×42), card de atalho "Pedido de amanhã" (fundo do banner), card de prévia do incentivo em Avulso |
| Sucesso | `--color-good` | `#3E7C53` | Pill "Aprovada" na divisão de entregadores, pill "Completo" em condomínio com 100% entregas, barra de progresso completa em Entregas |
| Sucesso soft | `--color-good-soft` | `#DCEBDF` | Fundo do ícone de sucesso no step "Pronto" do Pedido, fundo das pills "Completo"/"Aprovada" |
| Gold soft | `--color-gold-soft` | `#F3DDA6` | Fundo do avatar de scissors no card de horário de corte, fundo das pills parciais (ex: "9/23"), fundo de chips de filtro ativos (Clientes) |
| Texto principal | `--color-text` | `#241608` | Nomes, valores, labels principais em toda a fase |
| Texto secundário | `--color-text-sec` | `#7C6A50` | Subtítulos de cards, labels de Row, textos de instrução |
| Texto terciário | `--color-text-ter` | `#A89A82` | Metadados secundários (CNPJ, tel, e-mail inline), ícones chevron inativos, labels de aba inativa na bottom nav |
| Borda | `--color-border` | `rgba(43,26,12,0.10)` | Borda de botão ghost, borda dos Steppers, borda do nav superior |
| Borda 2 | `--color-border-2` | `rgba(43,26,12,0.06)` | Separadores internos de card, borda do card padrão |
| Destrutivo | `--color-warn` | `#B0702A` | Botão "Bloquear cliente" (variant ghost), botão "Estornar pagamento" (bg `surface2`, texto `textSec`) |

Accent (`#B0702A`) reservado para:
1. Aba ativa na bottom nav (ícone stroke 2.3 + label weight 700)
2. Ícones coloridos nos avatares de itens de lista (building, factory, truck, user, bag, card, trend)
3. Step text ativo na barra de progresso do Pedido
4. Ícone `spark` no card "Divisão sugerida" (Entregas)
5. Chips de filtro inativos em Clientes (borda `accent` quando ativo — ver abaixo)
6. Ícone do avatar de condomínio no Pedido step 0

Gold (`#E3AC3F`) reservado para:
1. BreadMark SVG no avatar do AdminHead (size 27, cor `#E3AC3F`)
2. Preenchimento da barra de step ativo/concluído no Pedido
3. Botão "Aprovar divisão" (variant gold — bg `#E3AC3F`, texto `#1E1207`)
4. Botões CTA de CRUD em sub-telas de Gestão (variant gold — "Novo combo", "Novo fornecedor", "Cadastrar entregador", "Adicionar condomínio")
5. Coluna de destaque nos gráficos de barras (Painel: última coluna real; Financeiro: penúltima coluna)
6. Barra de progresso de entregas (quando `feitas < total`)
7. Barra de receita por tipo (lado combos)
8. Número de pães por entregador na divisão (Bricolage 15px weight 800)

---

## Component Inventory

Todos os caminhos relativos a `apps/web/src/`.

### Telas (pages)

| Componente | Caminho | Descrição |
|-----------|---------|-----------|
| `AdminLayout` | `pages/admin/AdminLayout.tsx` | Container com bottom nav de 5 abas + estado `tab` interno. Substitui o placeholder atual. |
| `AdminPainel` | `pages/admin/tabs/AdminPainel.tsx` | Dashboard: 4 KPIs, banner Pedido, gráfico Fornadas, receita por tipo |
| `AdminPedido` | `pages/admin/tabs/AdminPedido.tsx` | Fluxo 4 etapas: barra de steps + step 0..3 |
| `AdminEntregas` | `pages/admin/tabs/AdminEntregas.tsx` | Segmented Hoje/Histórico + divisão sugerida + progresso por condomínio |
| `AdminClientes` | `pages/admin/tabs/AdminClientes.tsx` | Lista com filtro por condomínio + sub-tela de detalhe |
| `AdminGestao` | `pages/admin/tabs/AdminGestao.tsx` | Hub com 7 itens + roteamento para sub-telas via `sub` state |

### Sub-telas de Gestão

| Componente | Caminho | Descrição |
|-----------|---------|-----------|
| `AdminCombos` | `pages/admin/gestao/AdminCombos.tsx` | Lista de combos com CRUD + toggle de promoção por Switch |
| `AdminAvulso` | `pages/admin/gestao/AdminAvulso.tsx` | Config de limite e preço/pão + prévia do incentivo em card espresso |
| `AdminFornecedores` | `pages/admin/gestao/AdminFornecedores.tsx` | Lista de fornecedores com CRUD + badge Principal |
| `AdminEntregadores` | `pages/admin/gestao/AdminEntregadores.tsx` | Lista de entregadores com CRUD + Switch ativo/inativo |
| `AdminCondos` | `pages/admin/gestao/AdminCondos.tsx` | Lista de condomínios com CRUD |
| `AdminPagamentos` | `pages/admin/gestao/AdminPagamentos.tsx` | Lista de pagamentos somente leitura + botão estorno |
| `AdminFinanceiro` | `pages/admin/gestao/AdminFinanceiro.tsx` | Segmented Dia/Semana/Mês + receita total + por tipo + por condomínio |

### Formulários de CRUD (sub=`criar`/`editar`)

| Componente | Caminho | Campos |
|-----------|---------|--------|
| `ComboForm` | `pages/admin/gestao/ComboForm.tsx` | Nome, quantidade, preço, tag opcional |
| `FornecedorForm` | `pages/admin/gestao/FornecedorForm.tsx` | Nome, CNPJ, telefone, e-mail, preço/pão, flag principal |
| `EntregadorForm` | `pages/admin/gestao/EntregadorForm.tsx` | Nome, CPF, telefone, e-mail |
| `CondoForm` | `pages/admin/gestao/CondoForm.tsx` | Nome, endereço, tipo (entrada única / blocos), nº de blocos se aplicável |

### Componentes reutilizáveis (novos nesta fase)

| Componente | Caminho | Descrição |
|-----------|---------|-----------|
| `AdminHead` | `components/admin/AdminHead.tsx` | Cabeçalho padrão de seção: avatar espresso 42×42 (BreadMark 27px gold) + subtítulo + título |
| `AdminBottomNav` | `components/admin/AdminBottomNav.tsx` | Bottom nav 5 abas com safe-area padding |
| `StepBar` | `components/admin/StepBar.tsx` | Barra de 4 steps do Pedido com label e preenchimento dourado |
| `BarChart` | `components/admin/BarChart.tsx` | Gráfico de barras simples (div flex): altura proporcional, cor da coluna configurável |
| `SegmentedControl` | `components/admin/SegmentedControl.tsx` | Reutilizável (mesma estrutura que Phase 6); Hoje/Histórico e Dia/Semana/Mês |
| `KpiCard` | `components/admin/KpiCard.tsx` | Card de KPI: ícone + valor Bricolage 26px + label + pill de tendência opcional |
| `ProgressBar` | `components/admin/ProgressBar.tsx` | Barra de progresso h-7px border-radius 99px, fill animado (`transition: width 0.3s`) |
| `DeliveryDivisionCard` | `components/admin/DeliveryDivisionCard.tsx` | Card de divisão sugerida de entregadores com drag-and-drop e stepper de quantidade |
| `PaymentDetailSheet` | `components/admin/PaymentDetailSheet.tsx` | Tela de detalhe de pagamento (sub-stack) com botão estorno |
| `ClientDetailView` | `components/admin/ClientDetailView.tsx` | Detalhe de cliente (somente leitura) com botão bloquear/desbloquear |

### Componentes existentes reutilizados (não recriar)

- `apps/web/src/components/brand/Icon.tsx` — todos os ícones necessários já existem: `trend`, `factory`, `truck`, `users`, `settings`, `bag`, `building`, `scissors`, `check`, `download`, `edit`, `coin`, `card`, `percent`, `ban`, `refresh`, `wallet`, `calendar`, `clock`, `spark`, `chevR`, `chevD`, `arrowL`, `plus`, `minus`, `phone`, `mail`, `user`, `x`
- `apps/web/src/components/brand/BreadMark.tsx` — avatar do AdminHead
- Primitivas existentes: `Card`, `Pill`, `Btn`, `Field`, `Stepper`, `Switch`, `Row`, `AppBar`

---

## Screens Detail

### AdminLayout — Layout geral

```
┌─────────────────────────────────────────┐  fundo: --color-app-bg (#FAF5EC)
│ [Conteúdo da aba ativa]                  │  flex: 1, overflow: hidden internamente
│                                          │
│                                          │
│                                          │
├─────────────────────────────────────────┤
│ [AdminBottomNav]                         │  flexShrink: 0
│ Painel · Pedido · Entregas · Clientes    │  borderTop: 1px solid --color-border-2
│ · Gestão                                 │  bg: --color-surface
└─────────────────────────────────────────┘
```

**AdminBottomNav:**
- 5 botões `flex: 1`, `flexDirection: column`, `alignItems: center`, `gap: 4px`, `padding: 5px 0`
- Aba ativa: `color: --color-accent (#B0702A)`, ícone `stroke 2.3`, label `fontWeight 700`
- Aba inativa: `color: --color-text-ter (#A89A82)`, ícone `stroke 2`, label `fontWeight 600`
- Label: 10px, Hanken Grotesk
- Ícones: size 22px

| Aba | Ícone | Label |
|-----|-------|-------|
| painel | `trend` | Painel |
| pedido | `factory` | Pedido |
| entregas | `truck` | Entregas |
| clientes | `users` | Clientes |
| gestao | `settings` | Gestão |

### AdminHead — Cabeçalho padrão

- `padding: 4px 20px 14px`
- Avatar: `width: 42px, height: 42px, borderRadius: 13px, background: --color-espresso` com BreadMark `size=27, color="#E3AC3F"`
- Subtítulo (`.sub`): 12.5px, Hanken, weight 600, cor `--color-text-ter`
- Título (`.titulo`): Bricolage Grotesque, weight 700, fontSize 20px, `letterSpacing: -0.02em`, cor `--color-text`

---

### Aba: Painel (AdminPainel)

**Layout:**
```
AdminHead  titulo="Painel"  sub="Cheirin de Pão · {nome da operação}"
────────────────────────────────────
[grade 2 colunas — 4 KpiCards]
[Card banner "Pedido de amanhã"   → atalho para aba Pedido]
[Card "Fornadas por dia" — BarChart 7 colunas]
[Card "Receita por tipo · hoje" — barra proporcional + legenda]
```

**4 KpiCards (grade 2×2, gap 12px):**

| KPI | Ícone | Pill de tendência |
|-----|-------|-------------------|
| Pães hoje | `bag` | sim (tone "good", ex: "+12%") |
| Receita do dia | `trend` | sim (tone "good", ex: "+8%") |
| Clientes | `users` | sim (tone "good", ex: "+3") |
| Condomínios | `building` | não |

KpiCard spec:
- Card pad=16, borderRadius 22px
- Row header: `Icon` (size 20, cor `--color-accent`) + Pill opcional no lado oposto (`flex: justifyContent: space-between`)
- Valor: Bricolage 26px, weight 800, `marginTop: 12`, `letterSpacing: -0.02em`
- Label: 12.5px, Hanken, weight 600, cor `--color-text-sec`

**Card atalho "Pedido de amanhã":**
- `Card pad=0, overflow: hidden`
- Área clicável (onClick navega para aba `pedido`): `background: --color-espresso`, `padding: 16px 18px`
- BreadMark decorativo: `position: absolute, bottom: -40px, right: -16px, opacity: 0.12, size: 120`
- Avatar do ícone: `width: 44px, height: 44px, borderRadius: 12px, background: rgba(227,172,63,0.16), color: #E3AC3F`
- Ícone: `factory` size 22
- Subtítulo: 11.5px, Hanken, weight 700, cor `#E3AC3F`, letterSpacing 0.05em — ex: "CORTE 20:00 · ABERTO"
- Título: Bricolage 16px, weight 700, cor `#FAF5EC`, marginTop 2 — ex: "Pedido de amanhã · 340 pães"
- Chevron direita: `Icon chevR` size 20, cor `#C7B595`

**Card "Fornadas por dia":**
- `Card pad=18`
- Título: Bricolage 15px, weight 700, marginBottom 14
- BarChart: `display: flex, alignItems: flex-end, gap: 8, height: 96px`
- 7 colunas (seg a dom); coluna do dia atual: cor `--color-gold`; demais: `--color-surface-2`
- Label de dia: 10.5px, Hanken, weight 600, cor `--color-text-ter` (ex: "Seg", "Ter")
- Cada barra: `flex: 1, borderRadius: 7px, transition: height 0.3s`

**Card "Receita por tipo":**
- `Card pad=18`
- Header: Bricolage 15px weight 700 (esquerda) + valor total Bricolage 15px weight 800 (direita)
- Barra proporcional: `height: 12px, borderRadius: 99px, overflow: hidden, marginBottom: 14`
  - Fatia combos: cor `--color-gold`
  - Fatia avulso: cor `--color-accent`, opacity 0.5
- Legenda: 2 itens — indicador quadrado 11×11px, label 13.5px cor `textSec`, valor 13.5px cor `text` weight 700

---

### Aba: Pedido (AdminPedido)

**Layout geral:**
```
AdminHead  titulo="Pedido ao fornecedor"  sub="Para amanhã · {data}"
StepBar (4 steps: Conferir · Ajustar · Dividir · Pronto)
────────────────────────────────────
[Conteúdo do step atual — scrollável]
────────────────────────────────────
[Rodapé fixo — total + CTA]          borderTop: 1px solid --color-border-2
```

**StepBar:**
- `display: flex, gap: 6px, padding: 0 20px 14px`
- 4 labels: "Conferir", "Ajustar", "Dividir", "Pronto"
- Cada step: `flex: 1, textAlign: center`
  - Barra acima: `height: 4px, borderRadius: 99px`
    - Ativo/concluído (`i <= step`): `background: --color-gold (#E3AC3F)`
    - Pendente: `background: --color-border`
  - Label: 11px, Hanken, weight 700
    - Ativo/concluído: cor `--color-accent (#B0702A)`
    - Pendente: cor `--color-text-ter`
- Navegação: Admin pode clicar em step anterior para voltar (D-09)

**Step 0 — Conferir:**
- Card de horário de corte: avatar `scissors` 44×44px em fundo `--color-gold-soft`, cor `--color-accent`; título "Horário de corte · {HH:MM}"; subtítulo "Após o corte, pedidos do dia são bloqueados"; Pill tone="good" "Aberto" (ou tone="neutral" "Encerrado")
- Label seção: "CONSOLIDADO POR CONDOMÍNIO" — 12.5px, weight 700, cor `textSec`, margin `4px 2px 9px`
- Lista de cards por condomínio: avatar `building` 42×42px em `surface2`; nome do condomínio 14.5px weight 700; subtítulo "{N} entregas" 12px textTer; total de pães Bricolage 18px weight 800
- Rodapé: label "Total necessário" + valor Bricolage 22px weight 800 + `Btn full size="lg" icon="scissors"` "Encerrar corte e gerar pedido"

**Step 1 — Ajustar:**
- Instrução: 13.5px, cor `textSec`, lineHeight 1.5, marginBottom 16
- Lista: cada condomínio em Card pad=14 com `Stepper` à direita
  - Nome condomínio: 14px weight 700
  - "base {N} pães": 11.5px cor textTer
  - `Stepper value={qts[i]} min=0 max=400`
- Rodapé: "Total ajustado" + valor Bricolage 22px + `Btn full size="lg"` "Escolher fornecedores"

**Step 2 — Dividir:**
- Instrução: 13.5px, cor `textSec`, lineHeight 1.5
- 2 Cards — Fornecedor Principal e Fornecedor Reserva:
  - Header do card: avatar `factory` 40×40px em `surface2`; nome do fornecedor 14.5px weight 700; "{R$/pão}" 12px textTer; Pill tone="gold" "Principal" ou tone="neutral" "Reserva"
  - Body: `Stepper` (os dois somam sempre o total) + custo BRL Bricolage 16px weight 800
  - Sugestão inicial: principal 75%, reserva 25%
- Rodapé: "{total} pães" 13.5px + custo total Bricolage 22px + `Btn full size="lg" icon="check"` "Finalizar pedido"

**Step 3 — Pronto (confirmação final irreversível):**
- Ícone de sucesso: `div 72×72px, borderRadius 28%, background: --color-good-soft, margin: 0 auto 14px`; `Icon check size=36 color=--color-good stroke=2.6`
- Título: Bricolage 22px weight 700 "Pedido gerado", `letterSpacing: -0.02em`
- Subtítulo: "Salvo no histórico · {data}" — 13.5px cor textSec
- Card de resumo: 2 linhas (um por fornecedor) com nome + "{N} pães × R$X" + valor por linha; separador `borderBottom`; linha de total: "Total do pedido" + valor Bricolage 20px cor `--color-accent`
- Botões de download: `display: flex, gap: 10, marginBottom: 10`
  - `Btn variant="soft" full icon="download"` "PDF"
  - `Btn variant="soft" full icon="download"` "Excel"
- Voltar: `Btn variant="ghost" full` "Voltar ao início"

---

### Aba: Entregas (AdminEntregas)

**Layout:**
```
AdminHead  titulo="Entregas"  sub="Controle do dia · {data}"
SegmentedControl [Hoje] [Histórico]
────────────────────────────────────
[Conteúdo da aba selecionada — scrollável]
```

**SegmentedControl Hoje/Histórico:**
- Fundo `surface2`, borderRadius 13px, padding 4px
- Tab ativa: fundo `surface`, borderRadius 10px, shadowSoft
- Tab inativa: fundo transparente
- Texto ativo: `text` weight 700 · Texto inativo: `textSec` weight 700
- Altura mínima: 44px (padding 9px 0 + conteúdo)
- Fonte: Hanken 13.5px weight 700

**Aba Hoje — Card "Divisão sugerida" (D-11):**
- Card com borda especial:
  - Não aprovado: `border: 1.5px solid --color-accent`
  - Aprovado: `border: 1.5px solid --color-border-2`
- Header: `Icon spark size=20 color=--color-accent` + "Divisão sugerida" 14.5px weight 700 + Pill tone="good" com `Icon check size=13` "Aprovada" (visível só quando aprovado)
- Por entregador (2+ linhas): avatar `user` 36×36px circular em `surface2`; nome 14px weight 700; lista de condomínios 12px textTer; total de pães Bricolage 15px weight 800
- Drag-and-drop: cada card de condomínio dentro do entregador é arrastável para outro entregador (D-11)
- Total em tempo real por entregador: atualizado imediatamente ao soltar o drag
- Botão "Aprovar divisão": `Btn variant="gold" full size="sm" icon="check" marginTop=12` — só visível quando não aprovado

**Aba Hoje — "Agendadas vs Realizadas":**
- Label seção: "AGENDADAS VS REALIZADAS" — 12.5px, weight 700, cor `textSec`
- Por condomínio — Card pad=15:
  - Nome: 14.5px weight 700
  - Pill: tone="gold" "{feitas}/{total}" (parcial) ou tone="good" `Icon check size=13` "Completo" (100%)
  - Barra de progresso: `height: 7px, borderRadius: 99px, background: surface2, overflow: hidden`
    - Fill: cor `--color-good` quando completo; cor `--color-gold` quando parcial; `transition: width 0.3s`

**Aba Histórico:**
- Lista de cards: avatar `truck` 42×42px em `surface2`; label "{data longa}" 14.5px weight 700; "{ok} de {total} entregues" 12px textTer; Pill tone="good" ou tone="neutral" "{%}%"

---

### Aba: Clientes (AdminClientes)

**Layout — Tela de lista:**
```
AdminHead  titulo="Clientes"  sub="{N} cadastrados"
[Chips de filtro horizontais com scroll — Todos + nomes dos condomínios]
────────────────────────────────────
[Lista de cards — scrollável]
```

**Chips de filtro:**
- `display: flex, gap: 8px, overflowX: auto, paddingBottom: 4px`
- Cada chip: `padding: 8px 14px, borderRadius: 999px, fontFamily: Hanken, fontSize: 12.5px, weight: 700, whiteSpace: nowrap`
- Ativo: `border: 1.5px solid --color-accent, background: --color-gold-soft, color: --color-accent`
- Inativo: `border: 1.5px solid --color-border, background: --color-surface, color: --color-text-sec`
- Primeiro chip: "Todos"

**Card de cliente na lista:**
- Card pad=14, `cursor: pointer`, `opacity: 0.6` quando bloqueado
- Avatar: `user` 44×44px em `surface2`, borderRadius 12px
- Linha principal: nome 14.5px weight 700 + `Icon ban size=14 color=--color-accent` quando bloqueado
- Linha secundária: "{condomínio} · {apto} · últ. {data}" — 12px textTer, truncado com ellipsis
- Coluna direita: saldo Bricolage 17px weight 800 (cor `textTer` quando 0, `text` quando >0) + label "créditos" 10.5px textTer

**Sub-tela de detalhe do cliente (sub=`detalhe`):**
```
AppBar  title="Cliente"  onBack=setSub(null)
────────────────────────────────────
[Card de avatar + nome + condomínio/apto + pill "Bloqueado" se aplicável]
[Card de dados: Saldo, Última compra, Agendamento — Row components]
[Nota "O admin apenas visualiza..."]
[Btn bloquear/desbloquear]
```

- Card de avatar: `textAlign: center`, avatar circular `user` 64×64px em `surface2`, nome Bricolage 20px weight 700, condomínio + apto 13px textSec, Pill tone="gold" `Icon ban size=13` "Bloqueado" (se bloqueado)
- 3 rows com ícones: `wallet` "Saldo de créditos" · `clock` "Última compra" · `calendar` "Agendamento"
- Separadores entre rows: `height: 1px, background: --color-border-2`
- Nota: 12px, cor `textTer`, lineHeight 1.5, marginBottom 14
- Botão bloqueado: `Btn variant="ghost" full icon="ban"` "Bloquear cliente"
- Botão desbloquear: `Btn variant="gold" full icon="check"` "Desbloquear cliente"

---

### Aba: Gestão (AdminGestao)

**Layout — Hub:**
```
AdminHead  titulo="Gestão"  sub="Configurações da operação"
────────────────────────────────────
[7 cards de acesso — lista vertical scrollável]
```

**Card de acesso ao hub:**
- Card pad=15, `cursor: pointer`, `display: flex, alignItems: center, gap: 13`
- Avatar: 44×44px borderRadius 12px, `background: --color-surface-2`, `color: --color-accent`
- Título: 14.5px weight 700, cor `text`
- Descrição: 12px textTer, marginTop 1
- Chevron: `Icon chevR size=18 color=--color-text-ter`

| Item | Ícone | Título | Descrição |
|------|-------|--------|-----------|
| combos | `bag` | Combos e promoções | Criar, editar, descontos |
| avulso | `coin` | Compra personalizada | Limite e preço por pão |
| fornecedores | `factory` | Fornecedores | Padarias e preço do pão |
| entregadores | `truck` | Entregadores | Equipe e disponibilidade |
| condos | `building` | Condomínios | Locais atendidos |
| pagamentos | `card` | Pagamentos | Status e estornos |
| financeiro | `trend` | Financeiro | Receita por período |

**Sub-telas de Gestão — Layout padrão:**
```
AppBar  title="{nome da seção}"  onBack=setSub(null)
────────────────────────────────────
[Conteúdo específico da sub-tela — scrollável com padding 0 20px 24px]
```

**AdminCombos:**
- `Btn variant="gold" full icon="plus"` "Novo combo" — topo
- Por combo — Card pad=16:
  - Avatar `bag` 44×44px em `surface2`, borderRadius 13px
  - Nome combo: 15px weight 700 + tag opcional 11px cor `accent` (ex: "· Mais popular")
  - Detalhes: "{N} pães · " + preço (se promoção: `<span textDecoration=line-through>R$X</span> R$Y`)
  - Botão editar: 36×36px borderRadius 11px, borda `border`, fundo `surface`, `Icon edit size=17 color=textSec`
  - Footer do card (separado por borderTop `border2`): `Icon percent size=17` + "Promoção {X}% OFF" + `Switch`
    - Switch ativo: `background: --color-gold`; inativo: `background: --color-border`

**AdminAvulso:**
- Instrução textual: 13.5px cor `textSec`, lineHeight 1.5
- Card pad=18: "Limite máximo" (subtítulo "A partir daqui, só via combo") + Stepper; separador; "Preço por pão" + Stepper
- Card espresso (`background: --color-espresso, border: none, pad=16`):
  - Label "PRÉVIA DO INCENTIVO": 11.5px, cor `#E3AC3F`, weight 700, letterSpacing 0.06em
  - Linha avulso: "Avulso (até N pães)" 13.5px cor `#C7B595` + valor Bricolage 16px cor `#FAF5EC`
  - Linha combo: nome do combo + unidade Bricolage 16px cor `#E3AC3F`
  - Banner de resultado: borderRadius 12px, `background: rgba(227,172,63,0.16)`, textAlign center, 13.5px weight 700 cor `#E3AC3F`

**AdminFornecedores:**
- `Btn variant="gold" full icon="plus"` "Novo fornecedor" — topo
- Por fornecedor — Card pad=16:
  - Avatar `factory` 44×44px em `surface2`, borderRadius 13px
  - Nome: 15px weight 700 + Pill tone="gold" "Principal" quando `f.principal`
  - CNPJ: 12px textTer
  - Botão editar: mesmo spec de AdminCombos
  - Footer (separado por borderTop `border2`): `Row icon="coin"` "Preço do pão" + linhas de tel/e-mail (12px textTer, icon `phone`/`mail` size 13)

**AdminEntregadores:**
- `Btn variant="gold" full icon="plus"` "Cadastrar entregador" — topo
- Por entregador — Card pad=16:
  - Avatar `user` 44×44px circular em `surface2`, `opacity: 0.5` quando desativado
  - Nome: 15px weight 700
  - Status line: condomínios atribuídos 12px textTer (ou "Desativado" quando inativo)
  - `Switch on={ativo} onChange={toggle}` à direita
  - Footer (separado por borderTop `border2`): CPF com `Icon card size=13` + tel com `Icon phone size=13`

**AdminCondos:**
- `Btn variant="gold" full icon="plus"` "Adicionar condomínio" — topo
- Por condomínio — Card pad=16, `display: flex`:
  - Avatar `building` 44×44px em `surface2`, borderRadius 13px
  - Nome: 15px weight 700; tipo + nº clientes: 12.5px textTer
  - `Icon chevR size=18 color=textTer` — indica que é clicável para editar (sub=`editar`)

**AdminPagamentos (PAY-03 + PAY-04):**
- Lista somente leitura, sem botão "Novo"
- Por pagamento — Card pad=15:
  - Avatar `card` 42×42px em `surface2`, borderRadius 12px
  - Nome do cliente: 14.5px weight 700
  - Detalhes: "{tipo} · {método} · {data}" — 12px textTer
  - Coluna direita: valor Bricolage 16px weight 800 (`textDecoration: line-through` quando estornado) + Pill
    - `pago` → Pill tone="good" "Pago"
    - `pendente` → Pill tone="gold" "Pendente"
    - `falhou` → Pill tone="neutral" "Falhou"
    - `estornado` → Pill tone="neutral" "Estornado"
  - Botão estorno (só quando `status === 'pago'`): `width: 100%, background: surface2, border: none, borderRadius: 11px, padding: 9px 0, fontWeight: 700, fontSize: 13px, color: textSec`; `Icon refresh size=15` + "Estornar pagamento" — mostra dialog de confirmação antes de chamar API (D-04)
- Sub-tela de detalhe de pagamento (sub=`detalhe`): via AppBar title="Pagamento" onBack; exibe todos os dados + botão "Estornar" em vermelho

**AdminFinanceiro (ADMF-01..04):**
- SegmentedControl 3 tabs: "Dia" / "Semana" / "Mês"
- Card de receita total:
  - Label "Receita · {período}" — 12.5px cor textSec weight 600
  - Valor total: Bricolage 34px weight 800, `letterSpacing: -0.02em`, marginBottom 16
  - BarChart: `height: 80px` (como percentual das alturas), penúltima barra com cor `gold`, demais `surface2`
- Card "Por tipo de compra": mesma estrutura de "Receita por tipo" do Painel
- Card "Por condomínio":
  - Por linha: nome (13px textSec weight 600) + valor (13px text weight 700)
  - Barra proporcional: `height: 6px, borderRadius: 99px`, largura relativa ao maior valor, cor `--color-gold`

---

### Formulários de CRUD (sub=`criar` ou `editar`)

**Layout padrão:**
```
AppBar  title="Novo {entidade}" / "Editar {entidade}"  onBack=setSub(null)
────────────────────────────────────
[Campos Field empilhados — padding 0 20px 24px]
[Btn full size="lg" variant="primary"] ao final
```

**Campos Field (componente existente):**
- Background: `surfaceAlt (#FBF6EC)`, borda 1.5px `border` default → `accent` no focus
- borderRadius 14px, padding `12px 14px`
- Label: 12.5px weight 700 cor textSec, letterSpacing 0.01em, marginBottom 7
- Input: 15px Hanken weight 500, cor `text`

**Campos por formulário:**

ComboForm: Nome (`field icon="bag"`), Quantidade de pães (`field icon="bag"` type="number"), Preço (`field icon="coin"` type="number"), Tag (opcional, placeholder "ex: Mais popular")

FornecedorForm: Nome, CNPJ (`field icon="building"`), Telefone (`field icon="phone"` type="tel"), E-mail (`field icon="mail"` type="email"), Preço por pão (`field icon="coin"` type="number"), Switch "Fornecedor principal"

EntregadorForm: Nome completo (`field icon="user"`), CPF (`field icon="card"`), Telefone (`field icon="phone"` type="tel"), E-mail (`field icon="mail"` type="email")

CondoForm: Nome (`field icon="building"`), Endereço (`field icon="pin"`), Tipo (segmented control "Entrada única" / "Blocos/Torres"), Número de blocos (field — condicional, só visível quando tipo=blocos)

---

## Interaction Contracts

### Navegação principal (D-01)

- Estado `tab` em `AdminLayout`: `'painel' | 'pedido' | 'entregas' | 'clientes' | 'gestao'`
- Troca de aba: instantânea, sem animação de transição
- URL permanece `/admin` (sem sub-rotas)
- Ao clicar na aba "gestao" vinda de outra aba: `setSub(null)` resetar para o hub
- Scroll position não é preservado ao trocar de aba (comportamento padrão)

### Sub-telas por aba (D-02)

- Estado `sub` por aba: `null | 'detalhe' | 'criar' | 'editar'`
- `sub !== null` substitui o conteúdo da aba pelo componente de sub-tela
- AppBar `onBack` → `setSub(null)`
- Formulários de CRUD (D-03): ocupam a tela toda — não bottom sheet

### Fluxo do Pedido ao Fornecedor (D-09)

- Estado `step`: `0 | 1 | 2 | 3`
- Steps 0, 1, 2: livremente navegáveis (clicar no indicador da StepBar retorna ao step anterior)
- Step 3 (Pronto): irreversível — confirmar o pedido salva o `SupplierOrder`; "Voltar ao início" reseta para step 0
- Ao avançar do step 1 para 2: `setSplit({ p: Math.round(total * 0.75), r: total - Math.round(total * 0.75) })`
- Stepper duplo no step 2: os dois steppers são acoplados — a soma é sempre `total`

### Drag-and-drop na divisão de entregadores (D-11)

- Implementar com `@dnd-kit/core` (biblioteca existente no projeto ou adicionar como dependência)
- Unidade arrastável: card de condomínio dentro do bloco do entregador
- Drop targets: bloco de cada entregador
- Total de pães por entregador: calculado em tempo real ao soltar
- Quando um condomínio é dividido entre dois entregadores: stepper de quantidade aparece na linha do condomínio dentro de cada entregador; os dois devem somar o total do condomínio
- Estado visual durante drag: card arrastado com `opacity: 0.5`

### Aprovar divisão de entregadores (D-12)

1. Admin confere a divisão (com ou sem drag-and-drop)
2. Clica "Aprovar divisão" (variant gold, full width)
3. Loading state no botão (opacity 0.6, cursor wait)
4. Chamada `PATCH /admin/orders/assign-courier` em batch
5. Sucesso: borda do card muda de `accent` para `border2`; Pill "Aprovada" aparece; botão "Aprovar divisão" desaparece
6. Erro: botão volta ao estado normal; mensagem inline abaixo do botão: "Falha ao salvar. Tente novamente."

### Bloquear/Desbloquear cliente (ADMG-10)

1. Admin abre detalhe do cliente
2. Clica "Bloquear cliente" (variant ghost, full width)
3. Dialog de confirmação: "Bloquear {nome do cliente}? O cliente não poderá acessar o app."
4. Confirmar: `PATCH /admin/clients/:id/block`
5. Sucesso: botão muda para "Desbloquear cliente" (variant gold), pill "Bloqueado" aparece no card do topo, card na lista fica com `opacity: 0.6`

### Estornar pagamento (PAY-04)

1. Admin clica "Estornar pagamento" no card ou na sub-tela de detalhe
2. Dialog de confirmação: "Estornar R${valor}? Esta ação não pode ser desfeita. Os créditos correspondentes serão removidos do cliente." (D-04 + D-05)
3. Confirmar: `POST /admin/payments/:id/refund`
4. Loading state no botão de confirmação
5. Sucesso: valor do card fica com `textDecoration: line-through`; Pill muda para tone="neutral" "Estornado"; botão "Estornar pagamento" desaparece
6. Erro: dialog permanece; mensagem "Falha no estorno. Tente novamente."

### Switch de entregador (ADMG-07)

- Toggle imediato otimista na UI + `PATCH /admin/couriers/:id` em background
- Erro: revertê o switch ao estado anterior + toast "Falha ao alterar disponibilidade"

### Toggle de promoção em combo (ADMG-03)

- Switch imediato otimista na UI + `PATCH /admin/combos/:id` com `discount`
- Preço com promoção: `<span style={{ textDecoration: 'line-through' }}>{precoOriginal}</span> {precoComDesconto}`
- Desconto padrão no handoff: 15% (`preco * 0.85`)

---

## Copywriting Contract (pt-BR)

### Bottom nav

| Aba | Label |
|-----|-------|
| painel | Painel |
| pedido | Pedido |
| entregas | Entregas |
| clientes | Clientes |
| gestao | Gestão |

### AdminHead subtítulos

| Aba | Subtítulo |
|-----|-----------|
| Painel | "Cheirin de Pão · {nome da operação}" |
| Pedido | "Para amanhã · {dia} {mês}" |
| Entregas | "Controle do dia · {dia} {mês}" |
| Clientes | "{N} cadastrados" |
| Gestão | "Configurações da operação" |

### Painel

| Elemento | Texto |
|---------|-------|
| KPI — pães | "Pães hoje" |
| KPI — receita | "Receita do dia" |
| KPI — clientes | "Clientes" |
| KPI — condomínios | "Condomínios" |
| Banner corte (aberto) | "CORTE {HH:MM} · ABERTO" |
| Banner pedido | "Pedido de amanhã · {N} pães" |
| Gráfico — título | "Fornadas por dia" |
| Receita por tipo — título | "Receita por tipo · hoje" |
| Receita por tipo — combos | "Combos" |
| Receita por tipo — avulso | "Compra personalizada" |

### Pedido ao fornecedor

| Elemento | Texto |
|---------|-------|
| Steps | "Conferir" / "Ajustar" / "Dividir" / "Pronto" |
| Card corte (aberto) | "Horário de corte · {HH:MM}" |
| Card corte (subtítulo) | "Após o corte, pedidos do dia são bloqueados" |
| Pill corte aberto | "Aberto" |
| Pill corte encerrado | "Encerrado" |
| Label seção step 0 | "CONSOLIDADO POR CONDOMÍNIO" |
| Rodapé step 0 — label | "Total necessário" |
| CTA step 0 | "Encerrar corte e gerar pedido" |
| Instrução step 1 | "Ajuste as quantidades antes de fechar — margem de segurança, arredondamento, etc." |
| Rodapé step 1 — label | "Total ajustado" |
| CTA step 1 | "Escolher fornecedores" |
| Pill fornecedor | "Principal" / "Reserva" |
| Instrução step 2 | "Comece pelo fornecedor principal e divida o restante se quiser." |
| CTA step 2 | "Finalizar pedido" |
| Título step 3 | "Pedido gerado" |
| Subtítulo step 3 | "Salvo no histórico · {data}" |
| Linha de total step 3 | "Total do pedido" |
| Botão PDF | "PDF" |
| Botão Excel | "Excel" |
| Botão voltar step 3 | "Voltar ao início" |
| Empty state (sem agendamentos) | "Sem pedidos hoje" / "Nenhum cliente agendou entrega para amanhã." |

### Entregas

| Elemento | Texto |
|---------|-------|
| Tab hoje | "Hoje" |
| Tab histórico | "Histórico" |
| Divisão — título | "Divisão sugerida" |
| Divisão — CTA aprovar | "Aprovar divisão" |
| Divisão — pill aprovada | "Aprovada" |
| Divisão — erro | "Falha ao salvar. Tente novamente." |
| Seção progresso | "AGENDADAS VS REALIZADAS" |
| Pill parcial | "{N}/{total}" |
| Pill completo | "Completo" |
| Empty state hoje — heading | "Aguardando o corte" |
| Empty state hoje — corpo | "A divisão de entregadores ficará disponível após o pedido ser confirmado." |

### Clientes

| Elemento | Texto |
|---------|-------|
| Chip filtro padrão | "Todos" |
| Detalhe — nota | "O admin apenas visualiza os dados do cliente — não edita o cadastro." |
| Row saldo | "Saldo de créditos" |
| Row última compra | "Última compra" |
| Row agendamento | "Agendamento" |
| Pill bloqueado | "Bloqueado" |
| CTA bloquear | "Bloquear cliente" |
| CTA desbloquear | "Desbloquear cliente" |
| Dialog bloquear — título | "Bloquear {nome}?" |
| Dialog bloquear — corpo | "O cliente não poderá fazer pedidos ou acessar o app." |
| Dialog bloquear — confirmar | "Confirmar bloqueio" |
| Dialog bloquear — cancelar | "Cancelar" |
| Empty state lista — heading | "Nenhum cliente encontrado" |
| Empty state lista — corpo | "Tente filtrar por outro condomínio." |

### Gestão

| Elemento | Texto |
|---------|-------|
| Hub — título | "Gestão" |
| Combos — CTA criar | "Novo combo" |
| Fornecedores — CTA criar | "Novo fornecedor" |
| Entregadores — CTA criar | "Cadastrar entregador" |
| Condomínios — CTA criar | "Adicionar condomínio" |
| Toggle promoção — label | "Promoção {X}% OFF" |
| Entregador — inativo | "Desativado" |
| Entregador — sem rota | "Sem rota hoje" |
| Prévia incentivo — label | "PRÉVIA DO INCENTIVO" |
| Prévia incentivo — positivo | "Combo fica {N}% mais barato por pão" |
| Prévia incentivo — negativo | "Ajuste: o avulso precisa custar mais que o combo" |
| Avulso — instrução | "O preço por pão deve ficar acima do melhor combo para empurrar o cliente ao combo." |
| Avulso — limite label | "Limite máximo" |
| Avulso — limite sub | "A partir daqui, só via combo" |
| Avulso — preço label | "Preço por pão" |
| Avulso — preço sub | "Compra personalizada" |
| Pill fornecedor principal | "Principal" |

### Pagamentos

| Elemento | Texto |
|---------|-------|
| Status pago | "Pago" |
| Status pendente | "Pendente" |
| Status falhou | "Falhou" |
| Status estornado | "Estornado" |
| Botão estornar | "Estornar pagamento" |
| Dialog estorno — título | "Estornar R${valor}?" |
| Dialog estorno — corpo | "Esta ação não pode ser desfeita. Os créditos correspondentes serão removidos do saldo do cliente." |
| Dialog estorno — confirmar | "Confirmar estorno" |
| Dialog estorno — cancelar | "Cancelar" |
| Dialog estorno — erro | "Falha no estorno. Tente novamente." |

### Financeiro

| Elemento | Texto |
|---------|-------|
| Tab dia | "Dia" |
| Tab semana | "Semana" |
| Tab mês | "Mês" |
| Receita label (dia) | "Receita · hoje" |
| Receita label (semana) | "Receita · esta semana" |
| Receita label (mês) | "Receita · este mês" |
| Por tipo — título | "Por tipo de compra" |
| Por condomínio — título | "Por condomínio" |
| Legenda combos | "Combos" |
| Legenda avulso | "Compra personalizada" |

### Estados genéricos

| Elemento | Texto |
|---------|-------|
| Loading (spinner, sem texto) | — |
| Erro genérico de rede | "Falha na conexão. Tente novamente." |
| Erro ao salvar | "Não foi possível salvar. Tente novamente." |

---

## Registry Safety

| Registro | Componentes usados | Safety Gate |
|----------|--------------------|-------------|
| shadcn official | nenhum | não aplicável — shadcn não inicializado |
| @dnd-kit/core + @dnd-kit/sortable | `DndContext`, `SortableContext`, `useSortable`, `DraggableItem` | Pacotes npm padrão (não registry shadcn) — instalar via `npm install @dnd-kit/core @dnd-kit/sortable` em `apps/web`. Sem vetting de registry requerido. Revisão de código de implementação (handlers de eventos apenas — sem fetch/eval). |

Nota: nenhum componente de terceiros vem via shadcn registry nesta fase. Toda a UI usa primitivas próprias do projeto.

---

## Accessibility Checklist

| Item | Contrato |
|------|---------|
| Hit targets | Mínimo 44px em: cada botão da bottom nav, chips de filtro de Clientes, rows de lista (cards clicáveis), switches, botões de stepper, tabs do SegmentedControl, botões de CRUD |
| `aria-label` nos ícones decorativos | `aria-hidden="true"` em todos os ícones dentro de botões com texto; `aria-label` em ícones que sozinhos são o botão |
| `role="dialog"` + `aria-modal="true"` | Todos os dialogs de confirmação (bloquear cliente, estornar pagamento, aprovar divisão) |
| Focus trap | Dialog captura foco enquanto aberto; ao fechar, foco retorna ao elemento que o abriu |
| `aria-expanded` | AppBar de sub-telas não usa accordion; SegmentedControl com `role="tablist"` + `aria-selected` |
| `prefers-reduced-motion` | Declarado em `globals.css` — barras animadas, transições de borda e width desabilitadas automaticamente |
| Contraste | Todos os tokens de `THEMES.light` passam 4.5:1 para texto normal. Atenção especial ao card espresso em AdminAvulso: `#C7B595` sobre `#1E1207` passa 7.5:1. Pill `Aprovada` (`#3E7C53` sobre `#DCEBDF`) passa 3.9:1 (large text) |
| Safe area iOS | Bottom nav usa `calc(8px + env(safe-area-inset-bottom, 0px))` |

---

## Animations & Transitions

| Elemento | Propriedade | Duração | Easing |
|---------|------------|---------|--------|
| Barra de progresso (Entregas) | `width` | 0.3s | ease |
| Barras do gráfico (Painel / Financeiro) | `height` | 0.3s | ease |
| Borda do card de divisão sugerida | `border-color` | 0.2s | ease |
| Switch | `background`, `justify-content` | 0.2s | ease |
| Botões (hover) | `transform: translateY(-1px)`, `filter: brightness(1.05)` | 0.15s | ease |
| StepBar — preenchimento de barra | `background` (via condicional) | — | instantâneo |
| SegmentedControl — tab ativa | `background`, `box-shadow` | 0.15s | ease |
| Card de cliente bloqueado | `opacity` | 0.15s | ease |

Todas desabilitadas quando `prefers-reduced-motion: reduce`.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
