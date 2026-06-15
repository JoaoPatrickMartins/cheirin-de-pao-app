---
phase: 4
slug: scheduling
status: draft
shadcn_initialized: false
preset: none
created: 2026-06-14
---

# Fase 4 — Contrato de Design UI: Agendamento

> Contrato visual e de interação para a Fase 4 do Cheirin de Pão.
> Gerado por gsd-ui-researcher a partir do design handoff canônico em `.projeto/design_handoff_cheirin_pao/`.
> Toda implementação DEVE seguir este contrato — não alterar valores sem atualizar este arquivo.

---

## Sistema de Design

| Propriedade | Valor |
|-------------|-------|
| Tool | none (Tailwind CSS v4 via `@theme`) |
| Preset | não aplicável |
| Biblioteca de componentes | componentes próprios (primitivas estabelecidas nas Fases 1–3) |
| Biblioteca de ícones | `Icon` + `Ic` customizado em `apps/web/src/components/brand/Icon.tsx` |
| Fontes | Bricolage Grotesque (display/números) + Hanken Grotesk (UI/corpo) via Google Fonts |
| Tokens CSS | `apps/web/src/styles/globals.css` — variáveis `@theme` já estabelecidas |
| Fidelidade | Alta fidelidade — valores exatos do handoff são mandatórios |

**Nota:** `components.json` não existe — projeto usa Tailwind CSS v4 com tokens definidos em `globals.css`. Não inicializar shadcn. Os tokens de cor, tipografia, raios e sombras já estão declarados no CSS e são autoritativos. Esta fase herda integralmente o sistema de design da Fase 3.

**Fonte:** `03-UI-SPEC.md` (sistema de design estabelecido)

---

## Escala de Espaçamento

Grade base de 4px. Todos os valores são múltiplos de 4, exceto os listados na seção de exceções abaixo. Herdado integralmente da Fase 3.

| Token | Valor | Uso nesta fase |
|-------|-------|----------------|
| xs | 4px | Gaps entre ícone e texto inline |
| sm | 8px | Gap entre ícone e label; gap entre chips de horário/data (`gap: 9–10px`) |
| md | 16px | Padding interno de cards; padding do CoverageCard |
| lg | 24px | Padding horizontal de tela (`20px` — ver exceção); padding inferior da área scrollável |
| xl | 32px | Não usado nesta fase |
| 2xl | 48px | `paddingBottom: 90px` — área protegida pela tab bar (todos os scrollable layouts) |
| 3xl | 64px | Não usado nesta fase |

**Fonte:** `brand.jsx`, `screens-order.jsx` (handoff canônico), `03-UI-SPEC.md`

### Exceções de Alta Fidelidade do Handoff

| Valor | Elemento | Múltiplo mais próximo de 4 | Justificativa |
|-------|----------|---------------------------|---------------|
| `34px` | Botões do StepperInline (largura e altura) | 32px | Handoff canônico — já implementado em `StepperInline.tsx` |
| `9px` | Gap entre chips de horário de entrega | 8px | Handoff canônico — `gap: 9` em `screens-order.jsx` linha 194 |
| `11px` | Padding vertical dos chips de horário (`padding: '11px 0'`) | 12px | Handoff canônico — linha 195 |
| `13px` | Padding do StepperCard da SingleScreen (`Card pad={22}`) | não aplicável | `22px` = override de alta fidelidade herdado da Fase 3 |
| `14px` | Gap entre linhas de dia da semana na ScheduleScreen | 16px | Handoff canônico — `gap: 10` na lista de dias linha 200 (com padding interno `12px 16px`) |
| `18px` | Padding interno dos day-rows (`padding: '12px 16px'`) | 16px | Handoff canônico |

---

## Tipografia

Herança total da Fase 3 — sem novos tamanhos. Quatro tamanhos de interface + tokens de numerais de destaque.

### Famílias

| Token CSS | Família | Papel |
|-----------|---------|-------|
| `--font-display` | `"Bricolage Grotesque Variable", "Bricolage Grotesque", serif` | Título de tela (AppBar), numerais de destaque (stepper), consumo semanal no footer |
| `--font-body` | `"Hanken Grotesk", sans-serif` | Labels de dia, chips de horário/data, botões, subtextos |

**Fonte:** `globals.css` — tokens `@theme` já estabelecidos

### Escala de Texto UI (4 tamanhos máximos)

**Pesos permitidos na escala UI: apenas 600 e 700.** Peso 800 é exclusivo de tokens de numerais de destaque.

| Role | Tamanho | Peso | Line Height | Letter Spacing | Uso nesta fase |
|------|---------|------|-------------|----------------|----------------|
| `label` | 11–12.5px | 600–700 | 1.0 | +0.01 a +0.06em | "QUANTOS PÃES?", label "Horário de entrega", label "Para quando?", label "Consumo semanal", subtexto "folga" / "{v} pães" por dia, hora no chip de data, "Aviso no domingo à noite p/ ajustar a semana" |
| `body` | 13–15px | 600–700 | 1.45–1.5 | normal / -0.01em | Texto introdutório das telas, texto do alerta de cobertura, texto do BannerInsuficiente, texto do CoverageCard, chips de horário (`14px 700`), nome do dia (`15px 700`), label-data nos DateChips |
| `subheading` | 16–18px | 700 | 1.1 | -0.02em | "Lembrar de reconfigurar" (`14.5px`), consumo semanal no footer (`18px 800` — token de numeral), nome de combo na AutoBuyScreen (`14.5px`), preço de combo na AutoBuyScreen (Bricolage 800 16px — token de numeral) |
| `heading` | 21–26px | 700 | 1.0 | -0.02 a -0.03em | AppBar "Agenda semanal" e "Pedido único" (21px Bricolage Grotesque) |

**Regras fixas (herdadas):**
- Botões usam Hanken Grotesk 700 — nunca Bricolage.
- Títulos de tela via `AppBar` usam Bricolage Grotesque 700, `fontSize: 21px`.
- Labels de seção em maiúsculas ("QUANTOS PÃES?", "QUANDO COMPRAR", "DIA DA COMPRA", "COMBO A REPOR") usam Hanken Grotesk 600–700, `fontSize: 12.5px`, `letterSpacing: 0.04em`.

### Tokens de Numerais de Destaque

**Não contam para o limite de 4 da escala UI.**

| Token | Tamanho | Peso | Família | Letter Spacing | Uso |
|-------|---------|------|---------|----------------|-----|
| `display-stepper` | 56px | 800 | Bricolage Grotesque | -0.03em | Quantidade na SingleScreen (QuantityStepper grande) |
| `display-stepper-inline` | 18px | 800 | Bricolage Grotesque | normal | Quantidade no StepperInline por dia da semana |
| `display-footer` | 18px | 800 | Bricolage Grotesque | -0.02em | Consumo semanal total no footer da ScheduleScreen (`{semana} pães · {hora}`) |
| `display-combo-price` | 16px | 800 | Bricolage Grotesque | -0.02em | Preço de combo na lista da AutoBuyScreen |

**Fonte:** `screens-order.jsx` linha 247 (footer), linha 264 (stepper), `screens-client-extra.jsx` linha 75 (combo price)

---

## Paleta de Cores

Tema: **CLARO** (THEMES.light). Herança total da Fase 3 — sem novos tokens.

Fonte autoritativa: `apps/web/src/styles/globals.css` (tokens `@theme`) e `brand.jsx` (THEMES.light).

### Tokens Canônicos (já em globals.css)

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

**Distribuição 60/30/10:**

| Proporção | Cor | Elementos |
|-----------|-----|-----------|
| 60% dominante | `#FAF5EC` (`appBg`) | Fundo geral, área scrollável, fundo do footer CTA |
| 30% secundário | `#FFFFFF` (`surface`) + `#F4EBDA` (`surface2`) | Day-rows, cards, nota de cobrança, CoverageCard |
| 10% accent | `#E3AC3F` (`gold`) + `#B0702A` (`accent`) | Ver listas abaixo |

**Gold (`#E3AC3F`) reservado para esta fase:**
- Fundo de chip de horário selecionado (DeliveryTimeChip ativo)
- Fundo de DateChip selecionado (SingleScreen)
- Fundo do BannerInsuficiente (alerta de créditos na SingleScreen)
- Borda do BannerInsuficiente (`1.5px solid gold`)
- Switch habilitado ("Lembrar de reconfigurar" ON)
- Fundo do BannerCobertura quando `falta === true` (`goldSoft` como fundo)
- Botão "Comprar créditos" (`variant="gold"`) no BannerInsuficiente da SingleScreen

**Accent (`#B0702A`) reservado para esta fase:**
- Borda de chip de horário selecionado (`1.5px solid accent`)
- Borda de DateChip selecionado (`1.5px solid accent`)
- Texto de chip selecionado (horário e data)
- Ícone `alert` no BannerCobertura (estado `falta`)
- Ícone `repeat` no CoverageCard (estado `cobre`)
- Ícone `spark` no BannerInsuficiente da SingleScreen
- Ícone `wallet` no CreditCard da SingleScreen (estado suficiente)
- Ícone `repeat` no card "Lembrar de reconfigurar"
- Valor numérico do StepperInline quando `value > 0`
- Valor numérico do QuantityStepper quando `qtd <= saldo`
- Borda do card de modo selecionado na AutoBuyScreen (`2px solid accent`)
- Borda do chip de dia da semana selecionado na AutoBuyScreen

**Warn (estado de alerta):**
- `color: var(--color-accent)` — no tema claro, `warn === accent` (#B0702A)
- Valor numérico do QuantityStepper da SingleScreen muda para `warn` quando `qtd > saldo`

**Fonte:** `brand.jsx` (THEMES.light.warn === THEMES.light.accent), `screens-order.jsx` linha 274

---

## Componentes desta Fase

### 1. ScheduleScreen (`/client/agenda`)

**Estrutura geral:**

```
StatusBar
AppBar ("Agenda semanal", onBack → HomeScreen)
  [scrollável]
    Subtexto introdutório
    Seção: Horário de entrega (DeliveryTimeChips)
    Lista de Day-Rows (7 dias: Seg–Dom)
    Card: "Lembrar de reconfigurar" + Switch
    BannerCobertura (condicional — 2 estados)
  [footer fixo]
    Linha "Consumo semanal" + valor + hora
    Btn "Salvar agenda"
```

**Subtexto introdutório:**

| Propriedade | Valor |
|-------------|-------|
| Texto | "Quantos pães em cada dia. A gente entrega sozinho, todo dia, no horário escolhido." |
| Tamanho | 14px |
| Cor | `textSec` |
| Line height | 1.5 |
| Margin bottom | 16px |

### 2. DeliveryTimeChips (componente novo)

4 chips lado a lado com scroll horizontal se necessário. Seleção exclusiva (uma opção por vez).

| Propriedade | Valor |
|-------------|-------|
| Container | `display: flex`, `gap: 9px`, `marginBottom: 18px` |
| Valores | `['06:30', '07:00', '07:30', '08:00']` |
| Label da seção | "Horário de entrega", `fontSize: 12.5px`, `fontWeight: 700`, `color: textSec`, `marginBottom: 9px` |
| Chip inativo | `flex: 1`, `padding: '11px 0'`, `borderRadius: 13`, `border: '1.5px solid border'`, `background: surface`, `color: text`, `fontWeight: 700`, `fontSize: 14`, `fontFamily: Hanken Grotesk` |
| Chip ativo | `border: '1.5px solid accent'`, `background: goldSoft`, `color: accent` |
| Hit target | mínimo 44px de altura (padding vertical já garante ~44px) |
| Transição | `background .15s, border-color .15s, color .15s` |
| Salvo em | campo `deliveryTime` do Schedule (ex: `"07:00"`) |

**Fonte:** `screens-order.jsx` linhas 193–197

### 3. Day-Row (linha de dia da semana)

Uma linha por dia da semana (Seg, Ter, Qua, Qui, Sex, Sáb, Dom). Componente interno da ScheduleScreen.

| Propriedade | Valor |
|-------------|-------|
| Container | `display: flex`, `alignItems: center`, `gap: 14px`, `background: surface`, `borderRadius: 18px`, `border: '1px solid border2'`, `padding: '12px 16px'` |
| Opacidade quando `v === 0` | `opacity: 0.66` |
| Coluna de label (largura fixa) | `width: 44px`, `flexShrink: 0` |
| Nome do dia (abreviatura) | Ex: "Seg", "Ter" — Bricolage Grotesque 700, `fontSize: 15px`, `color: text` |
| Sub-label | `"folga"` quando `v === 0`, `"{v} pães"` quando `v > 0` — Hanken Grotesk, `fontSize: 11px`, `color: textTer` |
| Espacor | `flex: 1` |
| StepperInline | `min={0}`, `max={12}` — componente existente em `StepperInline.tsx` |
| Gap entre rows | `gap: 10px` (container pai `display: flex, flexDirection: column`) |

**Dias da semana e chaves:**

| Abreviatura | Chave `weeklyQty` |
|-------------|-------------------|
| Seg | `seg` |
| Ter | `ter` |
| Qua | `qua` |
| Qui | `qui` |
| Sex | `sex` |
| Sáb | `sab` |
| Dom | `dom` |

**Fonte:** `screens-order.jsx` linhas 201–214

### 4. Card "Lembrar de reconfigurar"

| Propriedade | Valor |
|-------------|-------|
| Container | `Card pad={16}`, `marginTop: 16px` |
| Layout interno | `display: flex`, `alignItems: center`, `gap: 13px` |
| Ícone container | `width: 42px`, `height: 42px`, `borderRadius: 12px`, `background: surface2`, ícone `repeat` `size: 20`, `color: accent` |
| Título | `fontWeight: 700`, `fontSize: 14.5px`, `color: text` |
| Subtexto | `fontSize: 12px`, `color: textTer`, `marginTop: 2px` |
| Texto subtexto | "Aviso no domingo à noite p/ ajustar a semana" |
| Switch | componente `Switch` existente (`on={notifyReconfigure}`) |

**Fonte:** `screens-order.jsx` linhas 218–227

### 5. BannerCobertura (componente novo — 2 estados)

**Estado A — Saldo insuficiente (`semana > saldo`):**

| Propriedade | Valor |
|-------------|-------|
| Container | `onClick → CombosScreen`, `cursor: pointer`, `marginTop: 14px` |
| Layout | `display: flex`, `alignItems: center`, `gap: 11px`, `padding: '14px 16px'` |
| Fundo | `goldSoft` (`#F3DDA6`) |
| Borda | `1.5px solid gold` (`#E3AC3F`) |
| Border radius | `16px` |
| Ícone | `alert`, `size: 20`, `color: accent` |
| Texto | `fontSize: 13px`, `color: text`, `fontWeight: 600`, `lineHeight: 1.45` |
| Texto copy | "Seu saldo ({saldo}) não cobre a semana ({semana}). **Compre um combo** ou ative a reposição automática." |
| Chevron | `chevR`, `size: 18`, `color: accent` |
| Destino do tap | `CombosScreen` |

**Estado B — Saldo suficiente (`semana <= saldo`):**

| Propriedade | Valor |
|-------------|-------|
| Container | `onClick → AutoBuyScreen`, `cursor: pointer`, `marginTop: 14px` |
| Layout | `display: flex`, `alignItems: center`, `gap: 11px`, `padding: '14px 16px'` |
| Fundo | `surface` (`#FFFFFF`) |
| Borda | `1px solid border2` |
| Border radius | `16px` |
| Ícone | `repeat`, `size: 19`, `color: accent` |
| Texto | `fontSize: 13px`, `color: textSec`, `fontWeight: 600`, `lineHeight: 1.45` |
| Texto copy | "Saldo cobre **~{cobre} semanas**. Ative a compra automática pra nunca faltar." |
| Chevron | `chevR`, `size: 18`, `color: textTer` |
| Destino do tap | `AutoBuyScreen` |

**Lógica de cobertura (D-03):**
```typescript
const semana = Object.values(weeklyQty).reduce((a, b) => a + b, 0)  // soma local
const cobre = Math.floor(saldo / (semana || 1))                      // semanas cobertas
const falta = semana > saldo                                          // boolean
```

**Fonte:** `screens-order.jsx` linhas 230–242, `04-CONTEXT.md` D-03

### 6. Footer da ScheduleScreen (fixo)

| Propriedade | Valor |
|-------------|-------|
| Container | `position: sticky bottom: 0`, `padding: '14px 20px'`, `borderTop: '1px solid border2'`, `background: appBg` |
| Linha de resumo | `display: flex`, `justifyContent: space-between`, `alignItems: center`, `marginBottom: 12px` |
| Label | "Consumo semanal", `fontSize: 13.5px`, `color: textSec`, `fontWeight: 600` |
| Valor | Bricolage Grotesque 800, `fontSize: 18px`, `color: text` — token `display-footer` |
| Formato do valor | `"{semana} pães · {hora}"` (ex: "22 pães · 07:00") |
| CTA | `Btn full size="lg" icon="check"` — texto: "Salvar agenda" |

**Fonte:** `screens-order.jsx` linhas 244–251

---

### 7. SingleScreen (`/client/agenda/pedido-unico`)

**Estrutura geral:**

```
StatusBar
AppBar ("Pedido único", onBack → ScheduleScreen ou HomeScreen)
  [scrollável]
    Subtexto introdutório
    QuantityStepper card ("QUANTOS PÃES?" — igual ao da CombosScreen)
    Seção: "Para quando?" — DateChips + chip "Outra data"
    Condicional:
      se qtd > saldo: BannerInsuficiente (estado insuficiente)
      se qtd <= saldo: CreditCard (estado suficiente)
  [footer fixo]
    Btn "Reservar e confirmar" (disabled quando semCredito)
```

**Subtexto introdutório:**

| Propriedade | Valor |
|-------------|-------|
| Texto | "Agende uma entrega avulsa para uma data. Os créditos são reservados na hora." |
| Tamanho | 14px |
| Cor | `textSec` |
| Line height | 1.5 |
| Margin bottom | 18px |

**Fonte:** `screens-order.jsx` linha 266

### 8. QuantityStepper na SingleScreen

Mesmo componente `QuantityStepper.tsx` já existente. Idêntico ao da CombosScreen (compra personalizada).

| Propriedade | Valor |
|-------------|-------|
| Container | `Card pad={22}`, `textAlign: center`, `marginBottom: 16px` |
| Label | "QUANTOS PÃES?", `fontSize: 12.5px`, `fontWeight: 700`, `color: textSec`, `marginBottom: 16px` |
| Botões − e + | `width: 48px`, `height: 48px`, `borderRadius: 16px`, `border: '1.5px solid border'`, `background: surface` |
| Ícones | `minus` / `plus`, `size: 22`, `stroke: 2.4` |
| Número | Bricolage Grotesque 800, `fontSize: 56px`, `lineHeight: 1`, `letterSpacing: '-0.03em'` — token `display-stepper` |
| Cor normal | `accent` (`#B0702A`) |
| Cor insuficiente | `warn` (`#B0702A` — mesmo valor no tema claro) quando `qtd > saldo` |
| min / max | `min={1}`, `max={20}` |
| Layout | `display: flex`, `justifyContent: center`, `alignItems: center`, `gap: 24px` |

**Fonte:** `screens-order.jsx` linhas 271–278

### 9. DateChips (componente novo)

Quick chips de seleção de data para a SingleScreen. O número de chips exibidos depende da data atual e do horário de corte.

| Propriedade | Valor |
|-------------|-------|
| Label da seção | "Para quando?", `fontSize: 12.5px`, `fontWeight: 700`, `color: textSec`, `marginBottom: 9px` |
| Container dos chips | `display: flex`, `gap: 10px`, `marginBottom: 16px` (scroll horizontal se mais de 3 chips) |
| Chip inativo | `flex: 1`, `padding: '13px 14px'`, `borderRadius: 16px`, `border: '1.5px solid border'`, `background: surface`, `cursor: pointer` |
| Chip ativo | `border: '1.5px solid accent'`, `background: goldSoft` |
| Título do chip | `fontWeight: 700`, `fontSize: 14px`, `color: accent` (ativo) ou `text` (inativo) |
| Sub-label do chip | Data formatada (ex: "Qui, 7:00" ou "14 jun, 8:00"), `fontSize: 12px`, `color: textTer`, `marginTop: 2px` |
| Chip "Outra data" | Exibe o ícone `calendar size: 16` + texto "Outra data" — abre `<input type="date">` nativo (hidden, acionado via ref) |

**Chips exibidos por padrão:**
- "Amanhã cedo" — desabilitado se hora atual >= 21h (D-05); sub-label = dia abrev. + hora de entrega do Schedule
- "Depois de amanhã" — fallback quando "Amanhã" estiver desabilitado
- 1 ou 2 próximas datas relevantes (sábado, próximo feriado se detectável)
- "Outra data" — sempre exibido como última opção

**Chip "Amanhã" desabilitado:**

| Propriedade | Valor |
|-------------|-------|
| Opacidade | `0.4` |
| Cursor | `default` |
| `onClick` | `undefined` (sem interação) |
| Sub-label | "Disponível até 21:00" |

**Input nativo "Outra data":**
```typescript
// Restrições D-04 e D-06
<input
  type="date"
  min={tomorrow.toISOString().slice(0, 10)}
  max={in30Days.toISOString().slice(0, 10)}
  style={{ display: 'none' }}
  ref={dateInputRef}
  onChange={(e) => setQuando(e.target.value)}
/>
```

**Fonte:** `screens-order.jsx` linhas 280–288, `04-CONTEXT.md` D-04, D-05, D-06

### 10. BannerInsuficiente na SingleScreen

Componente `BannerInsuficiente.tsx` já existente. Na SingleScreen, adaptar props e copy para o contexto:

| Propriedade | Valor |
|-------------|-------|
| Container | `padding: 16px`, `background: goldSoft`, `border: '1.5px solid gold'`, `borderRadius: 16px` |
| Header | `display: flex`, `alignItems: center`, `gap: 11px`, `marginBottom: 12px` |
| Ícone | `spark`, `size: 20`, `color: accent` |
| Título | `fontSize: 13.5px`, `fontWeight: 700`, `color: text`, `lineHeight: 1.4` — "Créditos insuficientes" |
| Corpo | `fontSize: 13px`, `color: textSec`, `lineHeight: 1.5`, `marginBottom: 14px` |
| Botão CTA primário | `Btn variant="gold" full icon="plus" size="sm"` — "Comprar créditos" → `CombosScreen` |
| Botão CTA secundário | `Btn variant="ghost" size="sm" style={{ flexShrink: 0 }}` — "Usar {saldo}" → seta stepper para `saldo` |
| Gap entre botões | `10px` |

**Diferença do BannerInsuficiente.tsx atual:** O componente existente usa `onComprar` e `onAjustar`. A SingleScreen deve reutilizá-lo passando as props corretas. O texto "Comprar mais" no botão atual deve ser alterado para "Comprar créditos" (ver Copywriting).

**Fonte:** `screens-order.jsx` linhas 290–302, `04-CONTEXT.md` specifics

### 11. CreditCard na SingleScreen (estado suficiente)

Card informativo exibido quando `qtd <= saldo`.

| Propriedade | Valor |
|-------------|-------|
| Container | `Card pad={16}` |
| Layout interno | `display: flex`, `alignItems: center`, `justifyContent: space-between` |
| Lado esquerdo | `display: flex`, `alignItems: center`, `gap: 11px` |
| Ícone | `wallet`, `size: 20`, `color: accent` |
| Título | `fontWeight: 700`, `fontSize: 14px`, `color: text` — "Usar créditos" |
| Subtexto | `fontSize: 12px`, `color: textTer` — "Sobram {saldo - qtd} de {saldo} créditos" |
| Lado direito | Bricolage Grotesque 800, `fontSize: 18px`, `color: text` — `"{qtd} 🥖"` |

**Nota:** O emoji 🥖 está no handoff. Manter conforme especificado no handoff canônico.

**Fonte:** `screens-order.jsx` linhas 304–316

### 12. Footer da SingleScreen (fixo)

| Propriedade | Valor |
|-------------|-------|
| Container | `position: sticky bottom: 0`, `padding: '14px 20px'`, `borderTop: '1px solid border2'`, `background: appBg` |
| CTA | `Btn full size="lg" icon="check" disabled={semCredito}` |
| Texto | "Reservar e confirmar" |
| Estado disabled | `opacity: 0.45`, sem hover, `cursor: default` |

**Fonte:** `screens-order.jsx` linhas 319–320

---

### 13. Botões (herdados — sem novos botões nesta fase)

| Variante | Background | Cor texto | Uso nesta fase |
|----------|-----------|-----------|----------------|
| `primary` | `#1E1207` (espresso) | `#FBF3E4` | "Salvar agenda", "Reservar e confirmar" |
| `gold` | `#E3AC3F` | `#1E1207` | "Comprar créditos" no BannerInsuficiente |
| `ghost` | transparent | `text` | "Usar {saldo}" no BannerInsuficiente |
| `soft` | `surface2` | `text` | Não usado diretamente nesta fase |

**Fonte:** `brand.jsx` + `03-UI-SPEC.md`

### 14. AppBar (componente existente — sem alteração)

| Elemento | Spec |
|----------|------|
| Botão voltar | `width: 38px, height: 38px`, `borderRadius: 12px`, `background: surface2`, ícone `arrowL size: 20` |
| Título | Bricolage Grotesque 700, `fontSize: 21px`, `letterSpacing: -0.02em` |
| Padding | `6px 20px 14px` |

**Textos de título por tela:**
- ScheduleScreen: "Agenda semanal"
- SingleScreen: "Pedido único"
- AutoBuyScreen: "Compra automática" (já existente na Fase 3)

**Fonte:** `brand.jsx` + `screens-order.jsx` linhas 185, 263

### 15. Switch (componente existente — sem alteração)

Usado no card "Lembrar de reconfigurar".

| Propriedade | Valor |
|-------------|-------|
| Largura | 48px |
| Altura | 28px |
| Background ON | `gold` (`#E3AC3F`) |
| Background OFF | `border` (`rgba(43,26,12,0.10)`) |
| Thumb ON | `onGold` (`#1E1207`) |
| Thumb OFF | `surface` (`#FFFFFF`) |
| Transição | `background .2s` |

**Fonte:** `brand.jsx` linha 274 + `03-UI-SPEC.md`

---

## Contrato de Copywriting

| Elemento | Texto |
|----------|-------|
| CTA principal ScheduleScreen | "Salvar agenda" |
| CTA principal SingleScreen | "Reservar e confirmar" |
| AppBar ScheduleScreen | "Agenda semanal" |
| AppBar SingleScreen | "Pedido único" |
| Subtexto ScheduleScreen | "Quantos pães em cada dia. A gente entrega sozinho, todo dia, no horário escolhido." |
| Subtexto SingleScreen | "Agende uma entrega avulsa para uma data. Os créditos são reservados na hora." |
| Label horário de entrega | "Horário de entrega" |
| Label seção data | "Para quando?" |
| Label quantidade | "QUANTOS PÃES?" (maiúsculas) |
| Label consumo semanal | "Consumo semanal" |
| Valor no footer | "{semana} pães · {hora}" (ex: "22 pães · 07:00") |
| Day-row sem entrega | "folga" |
| Day-row com entrega | "{v} pães" |
| Card reconfiguração — título | "Lembrar de reconfigurar" |
| Card reconfiguração — subtexto | "Aviso no domingo à noite p/ ajustar a semana" |
| BannerCobertura — falta | "Seu saldo ({saldo}) não cobre a semana ({semana}). **Compre um combo** ou ative a reposição automática." |
| BannerCobertura — suficiente | "Saldo cobre **~{cobre} semanas**. Ative a compra automática pra nunca faltar." |
| BannerInsuficiente — título | "Créditos insuficientes" |
| BannerInsuficiente — corpo | "Você tem **{saldo} créditos** e precisa de **{qtd}**. Compre mais ou ajuste a quantidade." |
| BannerInsuficiente — CTA primário | "Comprar créditos" |
| BannerInsuficiente — CTA secundário | "Usar {saldo}" |
| CreditCard SingleScreen — título | "Usar créditos" |
| CreditCard SingleScreen — subtexto | "Sobram {saldo - qtd} de {saldo} créditos" |
| Chip "Amanhã" normal | "Amanhã cedo" |
| Chip "Amanhã" desabilitado — subtexto | "Disponível até 21:00" |
| Chip "Outra data" | "Outra data" |
| Empty state ScheduleScreen (sem Schedule no backend) | "Configure sua agenda semanal de pãezinhos." (subtexto da tela antes do primeiro save) |
| Toast de sucesso (save da agenda) | "Agenda salva!" |
| Toast de sucesso (pedido único criado) | "Pedido agendado!" |
| Erro genérico (falha no save) | "Não conseguimos salvar. Tente novamente." |
| Erro créditos insuficientes (backend 400) | "Créditos insuficientes para este pedido." |

**Ações destrutivas nesta fase:** nenhuma. Não há deleção nem cancelamento de agendamento nesta fase (deferred para Fase 5/7).

**Fonte:** `screens-order.jsx` (handoff canônico), `04-CONTEXT.md` specifics

---

## Motion & Interação

Herança da Fase 3 — sem novas animações. Transições base aplicadas:

| Elemento | Propriedade | Duração | Easing |
|----------|------------|---------|--------|
| DeliveryTimeChip (seleção) | `background`, `border-color`, `color` | 150ms | ease |
| DateChip (seleção) | `background`, `border-color`, `color` | 150ms | ease |
| Day-row opacidade (v = 0) | `opacity` | 150ms | ease |
| BannerCobertura (troca de estado) | sem animação — troca síncrona com o estado | — | — |
| Botão hover | `transform`, `filter` | 150ms | ease |
| Switch toggle | `background`, posição do thumb | 200ms | ease |

**`prefers-reduced-motion`:** já declarado em `globals.css` — todas as transições são zerificadas automaticamente.

**Feedback de "Salvar agenda":**
- CTA fica em estado loading (`opacity: 0.65`, spinner inline 16px) durante a chamada `PUT /schedules/me`
- Após sucesso: toast "Agenda salva!" (implementação a definir na Fase 4 — posição: topo da tela, `background: espresso`, `color: primaryBtnText`, `borderRadius: 12px`, `padding: 12px 16px`, duração: 2.5s)
- Após erro: toast "Não conseguimos salvar. Tente novamente."

**Feedback de "Reservar e confirmar":**
- CTA fica em estado loading durante `POST /orders`
- Após sucesso: toast "Pedido agendado!" + navegar para ScheduleScreen (ou HomeScreen)
- Após erro 400 (créditos insuficientes): BannerInsuficiente aparece inline (não toast)

---

## Estados de UI

### ScheduleScreen

| Estado | Apresentação |
|--------|-------------|
| Carregando (GET /schedules/me) | Skeleton das 7 day-rows: `height: 64px, borderRadius: 18px, background: surface2`, animação de pulse suave |
| Sem Schedule (primeiro acesso) | Tela renderiza com valores padrão zerados (`seg: 0, ter: 0, ... dom: 0`) — banner CoverageCard não exibido |
| Schedule carregado | Pre-popula os steppers + hora + toggle de reconfiguração |
| `falta === true` (semana > saldo) | BannerCobertura estado A (goldSoft, borda gold, ícone alert) |
| `falta === false` (semana <= saldo) | BannerCobertura estado B (surface, borda border2, ícone repeat) |
| `semana === 0` | BannerCobertura ocultado (não há consumo para calcular) |
| Save em andamento | CTA "Salvar agenda" em loading |
| Save com sucesso | Toast "Agenda salva!" |

### SingleScreen

| Estado | Apresentação |
|--------|-------------|
| `qtd <= saldo` | QuantityStepper com número em `accent`; CreditCard visível; CTA habilitado |
| `qtd > saldo` | QuantityStepper com número em `warn` (`accent`); BannerInsuficiente visível; CTA disabled (`opacity: 0.45`) |
| Chip "Amanhã" após 21h | Chip exibido com `opacity: 0.4`, não interativo, sub-label "Disponível até 21:00" |
| "Outra data" selecionada via input nativo | DateChip exibe a data formatada como "DD mmm" em vez de "Outra data" |
| Submit em andamento | CTA em loading |
| Submit com sucesso | Toast "Pedido agendado!" + navegação |
| Erro 400 backend | Banner inline com copy de erro (não usa BannerInsuficiente — usar card de erro separado com borda `border` e ícone `alert`) |

### Tab Bar — Aba Agenda

| Estado | Apresentação |
|--------|-------------|
| Aba ativa | Ícone `calendar` em `gold`; label "Agenda" em `accent`, `fontWeight: 700` |
| Aba inativa | Ícone `calendar` em `textTer`; label "Agenda" em `textTer`, `fontWeight: 600` |

**Nota:** A aba "Agenda" deixa de ser placeholder — taps navegam para `/client/agenda` (ScheduleScreen).

---

## Raios e Sombras (herdados — sem alteração)

| Token | Valor | Aplicação nesta fase |
|-------|-------|---------------------|
| `--radius-field` | `14px` | Não usado diretamente nesta fase |
| `--radius-btn` | `16px` | Todos os botões; DeliveryTimeChips (`borderRadius: 13px` — ver exceção); DateChips (`borderRadius: 16px`) |
| `--radius-card` | `22px` | Card QuantityStepper, Card reconfiguração, CreditCard |
| `--radius-pill` | `999px` | Switch thumb |

**Exceção de alta fidelidade:**
- DeliveryTimeChips usam `borderRadius: 13px` (handoff linha 195) — não `16px`
- Day-rows usam `borderRadius: 18px` (handoff linha 205) — não `22px`
- Ícone do card de reconfiguração: `borderRadius: 12px`
- BannerCobertura e BannerInsuficiente: `borderRadius: 16px`

| Token | Valor | Aplicação nesta fase |
|-------|-------|---------------------|
| `--shadow-soft` | `0 1px 2px rgba(43,26,12,0.05), 0 4px 14px -8px rgba(43,26,12,0.18)` | Day-rows (via `Card` ou `border: 1px solid border2`) |
| `--shadow-strong` | `0 1px 2px rgba(43,26,12,0.05), 0 10px 30px -12px rgba(43,26,12,0.22)` | Não usado nesta fase |

---

## Segurança de Registry

| Registry | Blocos Usados | Safety Gate |
|----------|--------------|-------------|
| shadcn official | nenhum — projeto não usa shadcn | não aplicável |
| Terceiros adicionais | nenhum | não aplicável |

Não há novos componentes de terceiros nesta fase. Os componentes de UI são todos criados internamente, reutilizando as primitivas do `brand.jsx` já implementadas.

---

## Mapeamento de Requisitos

| Requisito | Componente / Tela |
|-----------|------------------|
| SCHED-01 | SingleScreen → `POST /orders` → reserva de créditos |
| SCHED-02 | ScheduleScreen → Day-Rows + StepperInline → `PUT /schedules/me` |
| SCHED-03 | Cron backend (sem UI específica) |
| SCHED-04 | Card "Lembrar de reconfigurar" + Switch → campo `notifyReconfigure` no Schedule |
| SCHED-05 | BannerInsuficiente (SingleScreen) + BannerCobertura estado A (ScheduleScreen) |
| SCHED-06 | Footer da ScheduleScreen — consumo semanal calculado localmente (D-03) + cobertura em semanas |
| CRED-07 | AutoBuyScreen já existente — cron backend implementado na Fase 4 |
| CRED-10 | Push OneSignal backend (sem UI específica — confirmação via notificação) |

---

## Fontes das Decisões

| Seção | Fonte |
|-------|-------|
| Paleta completa | `brand.jsx` THEMES.light — valores exatos; `globals.css` tokens autoritativos |
| ScheduleScreen layout | `screens-order.jsx` linhas 173–253 — handoff canônico |
| SingleScreen layout | `screens-order.jsx` linhas 255–324 — handoff canônico |
| AutoBuyScreen (referência) | `screens-client-extra.jsx` linhas 7–93 — já implementado na Fase 3 |
| DeliveryTimeChips | `screens-order.jsx` linhas 182–197 — 4 chips, `gap: 9`, `borderRadius: 13` |
| DateChips | `screens-order.jsx` linhas 280–288 — 2 chips fixos + "Outra data" |
| BannerCobertura (2 estados) | `screens-order.jsx` linhas 230–242 + `04-CONTEXT.md` specifics |
| BannerInsuficiente | `screens-order.jsx` linhas 290–302 + `BannerInsuficiente.tsx` (Fase 3) |
| StepperInline | `StepperInline.tsx` (Fase 3) — `34×34px`, `borderRadius: 11px` |
| QuantityStepper (56px) | `QuantityStepper.tsx` (Fase 3) — `48×48px`, token `display-stepper` |
| Horário de corte 21h | `04-CONTEXT.md` D-05 |
| Cálculo de cobertura | `04-CONTEXT.md` D-03 |
| Seleção de data | `04-CONTEXT.md` D-04 |
| Tipografia e pesos | `03-UI-SPEC.md` — herança completa |
| Raios e sombras | `globals.css` + exceções de alta fidelidade do handoff |

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

*Fase: 4 — Scheduling*
*UI-SPEC gerado: 2026-06-14*
*Handoff canônico: `.projeto/design_handoff_cheirin_pao/`*
