---
phase: 3
slug: credits-commerce
status: draft
shadcn_initialized: false
preset: none
created: 2026-06-14
---

# Fase 3 — Contrato de Design UI: Créditos & Comércio

> Contrato visual e de interação para a Fase 3 do Cheirin de Pão.
> Gerado por gsd-ui-researcher a partir do design handoff canônico em `.projeto/design_handoff_cheirin_pao/`.
> Toda implementação DEVE seguir este contrato — não alterar valores sem atualizar este arquivo.

---

## Sistema de Design

| Propriedade | Valor |
|-------------|-------|
| Tool | none (Tailwind CSS v4 via `@theme`) |
| Preset | não aplicável |
| Biblioteca de componentes | componentes próprios (primitivas já estabelecidas nas Fases 1–2) |
| Biblioteca de ícones | `Icon` + `Ic` customizado em `apps/web/src/components/brand/Icon.tsx` (paths SVG do handoff) |
| Fontes | Bricolage Grotesque (display/números) + Hanken Grotesk (UI/corpo) via Google Fonts |
| Tokens CSS | `apps/web/src/styles/globals.css` — variáveis `@theme` já estabelecidas |
| Fidelidade | Alta fidelidade — valores exatos do handoff são mandatórios |

**Nota:** `components.json` não existe — projeto usa Tailwind CSS v4 com tokens definidos em `globals.css`. Não inicializar shadcn. Os tokens de cor, tipografia, raios e sombras já estão declarados no CSS e são autoritativos.

---

## Escala de Espaçamento

Grade base de 4px. Todos os valores são múltiplos de 4, exceto os listados na seção de exceções abaixo.

| Token | Valor | Uso nesta fase |
|-------|-------|----------------|
| xs | 4px | Gaps entre ícone e texto inline; dot badge no ícone de sino |
| sm | 8px | Gap entre ícone e label na tab bar; gap entre pills; gap no segmented control (4px padding interno) |
| md | 16px | Padding interno de cards (padrão); padding botões `size="lg"` |
| lg | 24px | Padding horizontal de tela (20–24px — usar 20px como padrão, 22–24px em seções de destaque) |
| xl | 32px | Padding de tela na PurchasedScreen (success screen centralizada) |
| 2xl | 48px | `paddingBottom: 90px` — área protegida pela tab bar (todos os scrollable layouts) |
| 3xl | 64px | Não usado nesta fase |

### Exceções de Alta Fidelidade do Handoff

CLAUDE.md declara "Alta fidelidade — valores exatos do handoff são mandatórios". Os valores abaixo não são múltiplos de 4 mas são overrides autorizados pelo design handoff canônico e DEVEM ser respeitados sem arredondamento.

| Valor | Elemento | Múltiplo mais próximo de 4 | Justificativa |
|-------|----------|---------------------------|---------------|
| `34px` | Dimensão dos botões do Stepper inline (largura e altura) | 32px | Handoff canônico — alta fidelidade |
| `22px` | Padding interno superior e lateral do card de saldo (seção espresso) | 24px | Handoff canônico — alta fidelidade |
| `10px` | Gap entre botões no footer do card de saldo | 8px | Handoff canônico — alta fidelidade |
| `14px` | Gap entre cards na coluna principal da HomeA e padding vertical do CTA bar fixo | 16px | Handoff canônico — alta fidelidade |
| `6px` | Gap interno entre tabs do Segmented Control | 8px | Handoff canônico — alta fidelidade |

**Demais exceções específicas do handoff (também autorizadas):**

| Contexto | Valor | Justificativa |
|----------|-------|---------------|
| Tab bar — altura | 56–64px (estimado) | Elemento fixo no bottom; proteger com safe-area-inset-bottom |
| Hit target mínimo | 44px | UI-10 — todos os elementos interativos (botões, steppers, abas) |
| Stepper grande (+ e −) | 48×48px | QuantityStepper (compra personalizada, pedido único) — múltiplo de 4 |
| Card saldo — padding interno | `22px 22px 20px` | Exato do handoff — parcialmente não-múltiplo de 4; override autorizado (ver tabela acima) |
| Card saldo — footer | `padding: 12px`, `gap: 10px` | `12px` é múltiplo de 4; `10px` é override autorizado (ver tabela acima) |
| Gap entre combo cards | 12px | `gap: 12` na lista de combos — múltiplo de 4 |
| Padding horizontal do CTA bar fixo | 20px | Múltiplo de 4 |

---

## Tipografia

Duas famílias. Quatro tamanhos de texto de interface UI. Tokens de numerais de destaque separados (não contam para o limite de 4).

### Famílias

| Token CSS | Família | Papel |
|-----------|---------|-------|
| `--font-display` | `"Bricolage Grotesque Variable", "Bricolage Grotesque", serif` | Títulos de tela, tokens de numerais de destaque, nomes de combos, valores monetários grandes |
| `--font-body` | `"Hanken Grotesk", sans-serif` | Todo texto UI: labels, descrições, botões, campos, tab bar |

### Escala de Texto UI (máximo 4 tamanhos)

Estes são os 4 tamanhos de texto de interface. São os únicos tamanhos permitidos para elementos de UI (labels, body, subheadings, headings).

**Pesos permitidos na escala UI: apenas 600 (leve) e 700 (forte).** Peso 800 é exclusivo dos tokens de numerais de destaque (ver seção abaixo).

| Role | Tamanho | Peso | Line Height | Letter Spacing | Uso |
|------|---------|------|-------------|----------------|-----|
| `label` | 11–12.5px | 600–700 | 1.0 | +0.01 a +0.06em | Labels de seção em maiúsculas ("SEUS CRÉDITOS", "QUANTOS PÃES?"), labels de campo, hora em NextDays, labels de status, label da tab bar (10.5–11px), sub-textos de ação rápida |
| `body` | 13–15px | 600–700 | 1.45–1.5 | normal / -0.01em | Descrições, textos explicativos, subtítulos de card (13–14px — peso 600), botões `size="md"` e navegação principal (15px — peso 700) |
| `subheading` | 16–18px | 700 | 1.1 | -0.02em | Títulos de card, nome do combo (18px), sufixo "pães" no card de saldo (16px), valor no Stepper inline (18px) |
| `heading` | 21–26px | 700 | 1.0 | -0.02 a -0.03em | AppBar — título de tela (21px, Bricolage Grotesque); PurchasedScreen — "Créditos na conta!" (26px, Bricolage Grotesque) |

**Regras fixas:**
- Botões usam Hanken Grotesk 700 — nunca Bricolage.
- Labels de seção em maiúsculas usam `letter-spacing: 0.03–0.06em`, Hanken Grotesk 600–700, dentro do range `label` (11–12.5px).
- Títulos de tela via `AppBar` e PurchasedScreen usam Bricolage Grotesque 700, dentro do range `heading` (21–26px).

### Tokens de Numerais de Destaque

**Estes tokens são tokens de marca para exibição de valores numéricos (créditos, preços, quantidades em steppers). NÃO são tamanhos de texto de interface UI e NÃO contam para o limite de 4 da escala de texto acima.**

| Token | Tamanho | Peso | Família | Letter Spacing | Uso |
|-------|---------|------|---------|----------------|-----|
| `display-num` | 52px | 800 | Bricolage Grotesque | -0.03em | Saldo de créditos no card espresso da HomeA |
| `display-stepper` | 56px | 800 | Bricolage Grotesque | -0.03em | Quantidade no QuantityStepper grande (compra personalizada, pedido único) |

Ambos os tokens usam `lineHeight: 1.0` e `color: accent` quando o valor é positivo, `color: primaryBtnText (#FBF3E4)` no contexto do card espresso (fundo escuro).

**Peso 800 — token de marca para numerais, excluído do limite de 2 pesos da escala UI (mesmo critério dos tokens de tamanho).** Aplica-se exclusivamente a: `display-num` (52px), `display-stepper` (56px), e valores numéricos/monetários em Bricolage Grotesque com `fontSize` ≥ 16px em contexto de destaque (ex: preço principal do combo, preço na lista da AutoBuyScreen). Nunca usar peso 800 em texto corrido, labels, botões ou headings de interface.

---

## Paleta de Cores

Tema: **CLARO** (THEMES.light). Tema escuro é fora de escopo — não implementar.

Fonte autoritativa: `apps/web/src/styles/globals.css` (tokens `@theme`) e `brand.jsx` (THEMES.light).

### Tokens Canônicos

| Token CSS | Hex / Valor | Nome no handoff |
|-----------|------------|-----------------|
| `--color-app-bg` | `#FAF5EC` | `appBg` |
| `--color-surface` | `#FFFFFF` | `surface` |
| `--color-surface-alt` | `#FBF6EC` | `surfaceAlt` |
| `--color-surface-2` | `#F4EBDA` | `surface2` |
| `--color-espresso` | `#1E1207` | `espresso` |
| `--color-text` | `#241608` | `text` |
| `--color-text-sec` | `#7C6A50` | `textSec` |
| `--color-text-ter` | `#A89A82` | `textTer` |
| `--color-gold` | `#E3AC3F` | `gold` |
| `--color-gold-soft` | `#F3DDA6` | `goldSoft` |
| `--color-accent` | `#B0702A` | `accent` |
| `--color-good` | `#3E7C53` | `good` |
| `--color-good-soft` | `#DCEBDF` | `goodSoft` |
| `--color-border` | `rgba(43,26,12,0.10)` | `border` |
| `--color-border-2` | `rgba(43,26,12,0.06)` | `border2` |
| `--color-primary-btn-text` | `#FBF3E4` | `primaryBtnText` |

**Tokens adicionais necessários nesta fase (não estão em globals.css ainda):**

| Nome sugerido | Valor | Onde usar |
|---------------|-------|-----------|
| `--color-page-bg` | `#F3E9D6` | Fundo externo ao app frame (já existe como `#C9BBA2` — usar o do brand.jsx: `#F3E9D6`) |
| `--color-credit-label` | `#C7B595` | Label "SEUS CRÉDITOS" dentro do card espresso (cor do tema escuro usada no fundo escuro) |
| `--color-credit-hint` | `#9A876B` | "Rende ~N dias no seu ritmo atual" no card espresso |
| `--color-warn` | `#B0702A` | Equivale a `accent` no tema claro — usar `--color-accent` para estado de aviso |

**Distribuição 60/30/10:**

| Proporção | Cor | Elementos |
|-----------|-----|-----------|
| 60% dominante | `#FAF5EC` (`appBg`) | Fundo geral do app, área scrollável |
| 30% secundário | `#FFFFFF` (`surface`) + `#F4EBDA` (`surface2`) | Cards, tab bar background, segmented control |
| 10% accent | `#E3AC3F` (`gold`) + `#B0702A` (`accent`) | Ver lista abaixo |

**Gold (`#E3AC3F`) reservado para:**
- Botão "Comprar créditos" (variante `gold`) na HomeA
- Aba ativa da tab bar
- Tag de combo ("Mais popular", "Melhor valor")
- Pill "Pix ou cartão" no footer de CombosScreen
- Switch habilitado (toggle de compra automática, reconfiguração semanal)
- Badge de notificação (ponto no sino)
- Fundo do comparativo "melhor combo" na compra personalizada (`goldSoft`)
- Borda e fundo selecionado no seletor de horário de entrega

**Accent (`#B0702A`) reservado para:**
- Borda de card selecionado (combo ativo)
- Ícones de ação rápida, ícones de campo
- Rádio botão selecionado (cor do ponto interno)
- Texto de link "Editar agenda", "% mais barato por pão"
- Indicador de foco em campo (borda ao focar)
- Cor do valor no stepper quando `value > 0`

**Good (`#3E7C53`) reservado para:**
- Pill "A caminho" (entrega em andamento)
- Ícone e texto no banner "Créditos não expiram"
- Estatística "Economia c/ combo" no HistoryScreen

**Espresso (`#1E1207`) reservado para:**
- Fundo do card de saldo na HomeA (com gradient para `#2E1D0D`)
- Fundo do header TodayDelivery
- Fundo do avatar BreadMark no Greet
- Botão primário `variant="primary"` (bg espresso, texto `#FBF3E4`)

**Warn (créditos insuficientes):**
- Número do stepper muda para `accent` (`#B0702A`) quando `qtd > saldo`
- Banner usa fundo `goldSoft` com borda `gold`

---

## Componentes desta Fase

### 1. Tab Bar do Cliente

```
Tabs: Início (ic: home) | Agenda (ic: calendar) | Créditos (ic: coin) | Pedidos (ic: bag)
```

| Propriedade | Valor |
|-------------|-------|
| Posição | `fixed bottom-0`, largura 100%, `z-index: 50` |
| Fundo | `surface` (`#FFFFFF`) com `border-top: 1px solid border2` |
| Altura | 56px (área tocável) + `env(safe-area-inset-bottom)` como padding extra |
| Hit target | 44px mínimo por aba |
| Aba ativa — ícone | `color: gold` (`#E3AC3F`) |
| Aba ativa — label | `color: accent` (`#B0702A`), `font-weight: 700` |
| Aba inativa — ícone | `color: textTer` (`#A89A82`) |
| Aba inativa — label | `color: textTer`, `font-weight: 600` |
| Label tamanho | 10.5–11px, Hanken Grotesk (dentro do role `label`) |
| Abas placeholder | "Agenda" e "Pedidos" mostram tela stub ("Em breve") |

### 2. Card de Saldo (HomeA — componente principal desta fase)

| Propriedade | Valor |
|-------------|-------|
| Container | `Card` com `pad={0}`, `overflow: hidden`, `border-radius: 22px` |
| Seção espresso | `background: linear-gradient(135deg, #1E1207, #2E1D0D)` |
| Padding seção espresso | `22px 22px 20px` (override de alta fidelidade — ver Exceções de Espaçamento) |
| Watermark BreadMark | `position: absolute`, `bottom: -50px`, `right: -30px`, `opacity: 0.1`, `size={200}`, `color="#E3AC3F"` |
| Label "SEUS CRÉDITOS" | `fontSize: 12.5px`, `fontWeight: 600`, `color: #C7B595`, `letterSpacing: 0.04em` (role: `label`) |
| Número de saldo | Token `display-num` — Bricolage Grotesque 800, `fontSize: 52px`, `color: #FAF5EC`, `lineHeight: 1`, `letterSpacing: -0.03em` |
| Sufixo "pães" | `fontSize: 16px`, `color: #E3AC3F`, `fontWeight: 700`, alinhado à baseline (role: `subheading`) |
| Subtexto ritmo | `fontSize: 12.5px`, `color: #9A876B`, `marginTop: 8px` (role: `label`) |
| Footer do card | `display: flex`, `padding: 12px`, `gap: 10px` (gap é override de alta fidelidade — ver Exceções de Espaçamento) |
| Botão "Comprar créditos" | `Btn variant="gold" full icon="plus"` |
| Botão "Extrato" | `Btn variant="soft" icon="clock"` — não full, `flexShrink: 0` |

### 3. Segmented Control (CombosScreen)

| Propriedade | Valor |
|-------------|-------|
| Container | `background: surface2`, `borderRadius: 14px`, `padding: 4px`, `display: flex`, `gap: 6px` (override de alta fidelidade — ver Exceções de Espaçamento) |
| Tab inativa | `background: transparent`, `color: textSec`, `boxShadow: none` |
| Tab ativa | `background: surface (#FFFFFF)`, `color: text`, `boxShadow: shadowSoft` |
| Texto | Hanken Grotesk 700, `fontSize: 13.5px` (role: `body`) |
| Padding de cada tab | `10px 0`, `borderRadius: 10px` |
| Transição | `background .15s, box-shadow .15s` |

### 4. Combo Card

| Propriedade | Valor |
|-------------|-------|
| Container | `background: surface`, `borderRadius: 22px`, `padding: 18px` |
| Borda inativo | `2px solid border2` |
| Borda ativo (selecionado) | `2px solid accent (#B0702A)` |
| Sombra inativo | `shadowSoft` |
| Sombra ativo | `shadow` (forte) |
| Tag badge | posição `absolute top: -10px left: 18px`, `background: gold`, `color: espresso`, `fontSize: 11px`, `fontWeight: 700`, `borderRadius: 999px`, `padding: 3px 10px`, `letterSpacing: 0.02em` (role: `label`) |
| Rádio indicator | `width: 26px, height: 26px`, `borderRadius: 99px`, borda `accent` quando ativo; ponto interno `width: 13px height: 13px background: accent` |
| Nome do combo | Bricolage Grotesque 700, `fontSize: 18px`, `letterSpacing: -0.02em` (role: `subheading`) |
| Descrição | `fontSize: 13px`, `color: textTer` (role: `body`) |
| Preço riscado | `fontSize: 12px`, `color: textTer`, `textDecoration: line-through` (role: `label`) |
| Preço principal | Bricolage Grotesque 800, `fontSize: 22px`, `color: accent` (ativo) ou `text` (inativo), `letterSpacing: -0.02em` — token de numeral de marca, exclusão do limite de 2 pesos justificada na seção Tokens de Numerais de Destaque |
| Preço/pão | `fontSize: 11px`, `color: textTer` (role: `label`) |
| Transição | `border-color .15s, box-shadow .15s` |

### 5. QuantityStepper Grande (compra personalizada, pedido único)

| Propriedade | Valor |
|-------------|-------|
| Botões − e + | `width: 48px, height: 48px`, `borderRadius: 16px`, `border: 1.5px solid border`, `background: surface` |
| Ícone | `minus` / `plus`, `size: 22`, `stroke: 2.4` |
| Número | Token `display-stepper` — Bricolage Grotesque 800, `fontSize: 56px`, `color: accent`, `lineHeight: 1`, `letterSpacing: -0.03em` |
| Estado insuficiente (pedido único) | `color: warn` (`#B0702A` / mesmo que accent) |
| Estado desabilitado (max atingido) | `opacity: 0.5`, `cursor: default` |
| Container | `display: flex`, `justifyContent: center`, `alignItems: center`, `gap: 24px` |
| Card container | `Card pad={22}`, `textAlign: center` |

### 6. Stepper Inline (agenda semanal — Fases 4+, mas componente criado aqui)

| Propriedade | Valor |
|-------------|-------|
| Botões − e + | `width: 34px, height: 34px` (override de alta fidelidade — ver Exceções de Espaçamento), `borderRadius: 11px`, `border: 1.5px solid border`, `background: surface` |
| Número | Bricolage Grotesque 800, `fontSize: 18px`, `color: accent` quando `value > 0`, `textTer` quando 0 — token de numeral de marca, exclusão do limite de 2 pesos justificada na seção Tokens de Numerais de Destaque (role: `subheading` de tamanho, peso 800 reservado a numerais) |
| Gap | 12px |

### 7. Botões (`Btn` primitiva já existente)

| Variante | Background | Cor texto | Border | Uso nesta fase |
|----------|-----------|-----------|--------|----------------|
| `primary` | `#1E1207` (espresso) | `#FBF3E4` | none | CTA principal (Comprar, Confirmar) |
| `gold` | `#E3AC3F` | `#1E1207` | none | "Comprar créditos" no card saldo, CTA compra personalizada |
| `ghost` | transparent | `text` | `1.5px solid border` | "Voltar ao início", "Usar N créditos" |
| `soft` | `surface2` | `text` | none | "Extrato", botões secundários |

| Tamanho | Padding | Font Size | Role |
|---------|---------|-----------|------|
| `sm` | `9px 14px` | 13px | `body` |
| `md` | `13px 18px` | 15px | `body` |
| `lg` | `16px 22px` | 16px | `subheading` |

Hover: `transform: translateY(-1px)`, `filter: brightness(1.05)`, `transition: transform .15s, filter .15s`
Disabled: `opacity: 0.45`, sem hover

### 8. Fluxo Pix — Telas de Pagamento

**Tela QR Code + Espera:**

| Elemento | Spec |
|----------|------|
| QR Code | `<img src={`data:image/png;base64,${qrCodeBase64}`} />`, `width: 200px, height: 200px`, `borderRadius: 12px` |
| Código copia-e-cola | `fontFamily: monospace`, `fontSize: 12px`, `wordBreak: break-all`, fundo `surface2`, `borderRadius: 10px`, `padding: 12px` |
| Botão "Copiar código" | `Btn variant="ghost"`, ícone `copy` (não há no Ic — usar `list` ou adicionar novo path) |
| Status polling | Spinner animado (ver Motion abaixo) + texto "Aguardando pagamento..." |
| Contador de tentativas | Texto terciário, `fontSize: 12px` (role: `label`) |
| Timeout (5 tentativas) | Banner `goldSoft` com bordas `gold`: "Não detectamos o pagamento ainda. Verifique mais tarde." + CTA "Voltar" |

**Tela de Sucesso (PurchasedScreen):**

| Elemento | Spec |
|----------|------|
| Ícone check | `width: 96px, height: 96px`, `borderRadius: 30%`, `background: goodSoft`, ícone `check` `size: 48`, `color: good`, `stroke: 2.4` |
| Título | Bricolage Grotesque 700, `fontSize: 26px`, `letterSpacing: -0.03em`, `color: text` (role: `heading`) |
| Subtexto | `"+{N} pães adicionados"` — `<b style={{color: text}}>+{lastBuy} pães</b>` em bold, resto em `textSec`, `fontSize: 15px`, `lineHeight: 1.5` (role: `body`) |
| Gap antes dos CTAs | 32px |
| CTA primário | "Montar minha agenda" `Btn full size="lg" icon="calendar"` |
| CTA secundário | "Voltar ao início" `Btn variant="ghost" full` |

**Tela de Pagamento Cartão (Bricks):**

| Elemento | Spec |
|----------|------|
| Container Brick | `borderRadius: 16px`, `overflow: hidden`, integração SDK Mercado Pago Bricks |
| Wrapper | `padding: 0 20px`, `maxWidth: 390px` |
| AppBar | "Pagamento com cartão", `onBack` fecha/cancela |
| Nota de segurança | `fontSize: 12px`, `color: textTer`, ícone `card`, texto "Pagamento processado com segurança pelo Mercado Pago" (role: `label`) |

### 9. Tela AutoBuy (compra recorrente automática)

| Elemento | Spec |
|----------|------|
| Card master toggle | `Card pad={18}`, ícone `repeat` em fundo `goldSoft 46×46px borderRadius 13px`, `Switch` à direita |
| Opção de modo | Card selecionável, `border: 2px solid accent` quando ativo, rádio `26×26px` |
| Selector de dia (modo semanal) | Chips horizontais com scroll, `borderRadius: 12px`, ativo: `background goldSoft, color accent, border accent` |
| Lista de combos | Items com rádio `22×22px`, nome 14.5px 700, preço Bricolage Grotesque 800 16px — token de numeral de marca (exclusão justificada na seção Tokens de Numerais de Destaque) |
| Nota de cobrança | `background: surface2`, `borderRadius: 14px`, `padding: 13px 16px`, ícone `card` |
| CTA dinâmico | "Ativar — {combo.nome} ({BRL(combo.preco)})" quando `on=true`, "Salvar" quando `on=false` |

### 10. Pill (componente existente)

| Tone | Background | Cor texto | Uso nesta fase |
|------|-----------|-----------|----------------|
| `gold` | `goldSoft` | `accent` | Tags de badge, status "Pix ou cartão" |
| `good` | `goodSoft` | `good` | Status "A caminho", "agora" no timeline |
| `neutral` | `surface2` | `textSec` | Status "Entregue", labels genéricos |

### 11. AppBar (componente existente)

| Elemento | Spec |
|----------|------|
| Botão voltar | `width: 38px, height: 38px`, `borderRadius: 12px`, `background: surface2`, ícone `arrowL size: 20` |
| Título | Bricolage Grotesque 700, `fontSize: 21px`, `letterSpacing: -0.02em` (role: `heading`) |
| Padding | `6px 20px 14px` |

### 12. Banner de Alerta (estado créditos insuficientes)

| Propriedade | Valor |
|-------------|-------|
| Background | `goldSoft` |
| Border | `1.5px solid gold` |
| Border radius | `16px` |
| Padding | `13–16px` |
| Ícone | `spark` ou `alert`, `size: 20`, `color: accent` |
| Texto | `fontSize: 13–13.5px`, `color: text`, `lineHeight: 1.4–1.45` (role: `body`) |
| CTAs inline | `Btn variant="gold" size="sm"` + `Btn variant="ghost" size="sm"` em flex row com `gap: 10px` |

### 13. Tela Placeholder (Agenda e Pedidos)

| Elemento | Spec |
|----------|------|
| Layout | Centralizado vertical e horizontal, `padding: 32px` |
| Ícone | `calendar` ou `bag`, `size: 48`, `color: textTer` |
| Título | Bricolage Grotesque 700, `fontSize: 20px`, `color: textSec` (role: `heading`) |
| Subtexto | "Em breve — disponível na próxima atualização", `fontSize: 14px`, `color: textTer`, `lineHeight: 1.5` (role: `body`) |

---

## Contrato de Copywriting

| Elemento | Texto |
|----------|-------|
| CTA principal de compra (combo) | "Comprar {combo.nome}" |
| CTA principal de compra (personalizada) | "Comprar {qtd} pães" |
| CTA card saldo | "Comprar créditos" |
| CTA extrato | "Extrato" |
| Sucesso — título | "Créditos na conta!" |
| Sucesso — subtexto | "+{N} pães adicionados. Agora é só deixar a agenda no jeito." |
| Sucesso — CTA primário | "Montar minha agenda" |
| Sucesso — CTA secundário | "Voltar ao início" |
| Label saldo | "SEUS CRÉDITOS" (maiúsculas) |
| Subtexto saldo | "Rende ~{N} dias no seu ritmo atual" |
| Compra personalizada — label quantidade | "QUANTOS PÃES?" (maiúsculas) |
| Compra personalizada — preço unitário | "{BRL(avulsoUnit)} por pão" |
| Tab bar — Início | "Início" |
| Tab bar — Agenda | "Agenda" |
| Tab bar — Créditos | "Créditos" |
| Tab bar — Pedidos | "Pedidos" |
| Placeholder Agenda | "Em breve — disponível na próxima atualização" |
| Empty state saldo (HomeA sem dados) | "Nenhuma entrega agendada" (card Entrega de hoje) |
| Créditos insuficientes — título | "Créditos insuficientes" |
| Créditos insuficientes — corpo | "Você tem {saldo} créditos e precisa de {qtd}. Compre mais ou ajuste a quantidade." |
| Créditos insuficientes — CTA compra | "Comprar créditos" |
| Créditos insuficientes — CTA ajuste | "Usar {saldo}" |
| Aviso limite personalizada | "A partir de {limite} pães só dá pra comprar via combo — e sai bem mais em conta." |
| Banner incentivo combo | "{economia}% mais barato por pão" |
| Auto compra — toggle on | "Ativar — {combo.nome} ({BRL(preco)})" |
| Auto compra — toggle off | "Salvar" |
| Polling Pix — aguardando | "Aguardando pagamento..." |
| Polling Pix — timeout | "Não detectamos o pagamento ainda. Verifique o app do banco e tente novamente." |
| Polling Pix — CTA timeout | "Verificar mais tarde" |
| Greet — saudação | "Bom dia, {nome}" (usar saudação por hora do dia: Bom dia / Boa tarde / Boa noite) |
| Greet — localização | "{Condomínio} · {bloco/torre e apto}" |
| Próximas entregas — link | "Editar agenda" |
| Nota segurança cartão | "Pagamento processado com segurança pelo Mercado Pago" |
| Nota cobrança auto | "Cobramos no Pix salvo. Você recebe um aviso a cada compra automática." |

**Ações destrutivas nesta fase:** nenhuma. Não há deleção nem cancelamento de pagamento nesta fase.

---

## Motion & Interação

### Transições Base

| Elemento | Propriedade | Duração | Easing |
|----------|------------|---------|--------|
| Botão hover | `transform`, `filter` | 150ms | ease |
| Card seleção | `border-color`, `box-shadow` | 150ms | ease |
| Segmented control | `background`, `box-shadow` | 150ms | ease |
| Campo foco | `border-color` | 150ms | ease |
| Switch toggle | `background`, posição do thumb | 200ms | ease |
| Barras de progresso (HistoryScreen) | `width` | 300ms | ease-out |

### Spinner de Polling Pix

```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
```

- Elemento: círculo `width: 32px, height: 32px`, `border: 3px solid goldSoft`, `border-top-color: gold`, `borderRadius: 50%`
- Animação: `spin 800ms linear infinite`
- Centralizado acima do texto "Aguardando pagamento..."

### Feedback de Copiar Código Pix

- Ao copiar: texto do botão muda de "Copiar código" para "Copiado!" por 2 segundos
- Ícone: `check` temporariamente no lugar de `list`/`copy`
- Sem toast — o feedback é inline no botão

### Sucesso de Pagamento

- Ícone check na `PurchasedScreen` aparece com `transform: scale(0.8) → scale(1)` em 250ms ease-out
- Sem confetti nem animações elaboradas

### `prefers-reduced-motion`

Já declarado em `globals.css`:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    transition-duration: 0ms !important;
    animation-duration: 0ms !important;
  }
}
```
Spinner de polling: substituir animação por texto estático "Aguardando..." sem ícone rotativo.

---

## Estados de UI

### HomeA — Card Saldo

| Estado | Apresentação |
|--------|-------------|
| Carregando | Skeleton retangular: `background: rgba(255,255,255,0.15)` na área do número, `borderRadius: 8px`, `width: 120px height: 52px` |
| Saldo zero | Número `0` em `#FAF5EC`; subtexto "Adicione créditos para começar" |
| Saldo baixo (< 7 dias no ritmo) | Subtexto normal (sem alert na Home — alert aparece na ScheduleScreen) |
| Saldo carregado | Número animado não obrigatório; exibir valor diretamente |

### Tab Bar

| Estado | Apresentação |
|--------|-------------|
| Aba ativa | Ícone `color: gold`, label `color: accent, fontWeight: 700` |
| Aba inativa | Ícone `color: textTer`, label `color: textTer, fontWeight: 600` |
| Aba placeholder (Agenda, Pedidos) | Visual igual à inativa; tap navega para stub screen |

### CombosScreen

| Estado | Apresentação |
|--------|-------------|
| Carregando combos | 3 skeleton cards com `height: 90px, borderRadius: 22px, background: surface2` |
| Nenhum combo disponível | Empty state centralizado: ícone `bag size: 48 color: textTer`, texto "Nenhum combo disponível no momento. Tente novamente mais tarde." |
| Combo selecionado | Border `2px solid accent`, shadow forte, rádio com ponto interno |

### Polling Pix

| Estado | Apresentação |
|--------|-------------|
| Polling ativo | Spinner + "Aguardando pagamento..." + código copia-e-cola visível |
| Approved | Transição para PurchasedScreen sem animação de loading |
| Rejected | Banner fundo neutro `surface`, border `1.5px solid border`, ícone `x color: warn`, texto "Pagamento recusado. Tente novamente com outro cartão ou use Pix." + CTAs |
| Timeout (5 tentativas sem resposta) | Banner goldSoft com texto de timeout + botão "Verificar mais tarde" (→ HomeA) |

### Botão Primário

| Estado | Apresentação |
|--------|-------------|
| Normal | Background `espresso`, texto `primaryBtnText` |
| Hover (desktop/tablet) | `translateY(-1px)`, `brightness(1.05)` |
| Disabled | `opacity: 0.45`, `cursor: default`, sem hover |
| Loading (submit em andamento) | `opacity: 0.65`, spinner inline `16px` no lugar do ícone |

---

## Raios e Sombras

| Token | Valor | Aplicação |
|-------|-------|-----------|
| `--radius-field` | `14px` | Campos de formulário, segmented control container |
| `--radius-btn` | `16px` | Botões (todos os tamanhos) |
| `--radius-card` | `22px` | Cards (Card, combo cards, card de saldo) |
| `--radius-pill` | `999px` | Pills, badges, switch thumb |
| `--radius-app-icon` | `30%` | Avatar BreadMark no Greet (42×42px) |
| Stepper inline (+ e −) | `11px` | Stepper padrão |
| Stepper grande (+ e −) | `16px` | QuantityStepper (compra personalizada, pedido único) |
| Quick Actions icon | `12px` | Ícones 40×40px em Ações Rápidas |
| Placeholder screen | não aplicável | Layout centralizado sem card |

| Token | Valor | Aplicação |
|-------|-------|-----------|
| `--shadow-soft` | `0 1px 2px rgba(43,26,12,0.05), 0 4px 14px -8px rgba(43,26,12,0.18)` | Cards padrão, segmented tab ativa |
| `--shadow-strong` | `0 1px 2px rgba(43,26,12,0.05), 0 10px 30px -12px rgba(43,26,12,0.22)` | Combo card selecionado |

---

## Segurança de Registry

| Registry | Blocos Usados | Safety Gate |
|----------|--------------|-------------|
| shadcn official | nenhum — projeto não usa shadcn | não aplicável |
| Mercado Pago Bricks (SDK JS) | `CardPayment` Brick | SDK oficial MP — carregado via `<script>` do CDN oficial do Mercado Pago, sem vetting necessário pois é SDK do provedor de pagamento contratado |
| Terceiros adicionais | nenhum | não aplicável |

---

## Mapeamento de Requisitos

| Requisito | Componente / Tela |
|-----------|------------------|
| CRED-01 | CombosScreen (modo combo) → PurchasedScreen → HomeA saldo atualizado |
| CRED-02 | CombosScreen lê combos do backend (GET /combos) |
| CRED-03 | CombosScreen (modo compra personalizada) + QuantityStepper |
| CRED-04 | Comparativo avulso × melhor combo com % mais barato |
| CRED-05 | Limite e preço unitário vindos de `pricing` (GET /pricing) |
| CRED-06 | Banner "Créditos não expiram. Pause quando viajar." |
| CRED-07 | AutoBuyScreen — toggle mestre on/off |
| CRED-08 | AutoBuyScreen — modo "toda semana" + seletor de dia + seletor de combo |
| CRED-09 | Banner de créditos insuficientes (SingleScreen, ScheduleScreen — Fase 4 usa, mas componente criado aqui) |
| CRED-10 | AutoBuyScreen — salva preferência; cron fica para Fase 4/5 |
| CRED-11 | HomeA — token `display-num` (52px Bricolage Grotesque) no card espresso |
| PAY-01 | Fluxo Pix: QR code inline + copia-e-cola + polling |
| PAY-02 | Fluxo Cartão: Mercado Pago Bricks CardPayment |
| UI-04 | HomeA completa: card saldo + TodayDelivery placeholder + QuickActions + NextDays placeholder |
| UI-07 | QuantityStepper (48×48px, token display-stepper) + Stepper inline (34×34px) — componente reutilizável |
| UI-08 | Tab bar: Início / Agenda / Créditos / Pedidos — fixa no bottom com safe-area |

---

## Fontes das Decisões

| Seção | Fonte |
|-------|-------|
| Paleta completa | `brand.jsx` THEMES.light — valores exatos |
| Tokens CSS | `apps/web/src/styles/globals.css` — já estabelecidos na Fase 1 |
| Layout HomeA | `screens-home.jsx` — HomeA, Greet, TodayDelivery, QuickActions, NextDays |
| CombosScreen | `screens-order.jsx` — CombosScreen, PurchasedScreen |
| AutoBuyScreen | `screens-client-extra.jsx` — AutoBuyScreen |
| Fluxo Pix / Cartão | CONTEXT.md D-01..D-03, D-10..D-12 |
| Tab bar (D-07..D-09) | CONTEXT.md — Créditos abre CombosScreen, Agenda/Pedidos como placeholder |
| Polling strategy | CONTEXT.md D-01 — 3–5s, max 5 tentativas |
| Componentes primitivos | brand.jsx: Btn, Card, Pill, Field, AppBar, Stepper, Switch, Row |
| Ícones | `apps/web/src/components/brand/Icon.tsx` — mesmos paths do brand.jsx |
| Espaçamentos | README.md + brand.jsx (padding: 20–24px tela, gap: 10–14px) |
| Tipografia | README.md — escala declarada + valores exatos do JSX |
| Exceções de espaçamento | CLAUDE.md — "Alta fidelidade — valores exatos do handoff são mandatórios" |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Aprovação:** pendente

---

*Fase: 3 — Credits & Commerce*
*UI-SPEC gerado: 2026-06-14*
*UI-SPEC revisado: 2026-06-14 — fix Dimension 4 (typography consolidation + display tokens) e Dimension 5 (spacing override table)*
*UI-SPEC revisado: 2026-06-14 — fix Dimension 5 BLOCK: gap 6px do Segmented Control adicionado à tabela de exceções de alta fidelidade (confirmado em screens-order.jsx do handoff canônico)*
*UI-SPEC revisado: 2026-06-14 — fix Dimension 4 BLOCK: escala UI consolidada para 2 pesos (600 e 700); peso 800 restrito a tokens de numerais de destaque com nota de exclusão explícita; peso 500 removido do role body; fontWeight 800 do tag badge corrigido para 700*
*Handoff canônico: `.projeto/design_handoff_cheirin_pao/`*
