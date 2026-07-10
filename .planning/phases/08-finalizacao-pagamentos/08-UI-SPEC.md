---
phase: 8
slug: finalizacao-pagamentos
status: approved
reviewed_at: 2026-06-18T00:00:00Z
shadcn_initialized: false
preset: none
created: 2026-06-18
---

# Phase 8 — UI Design Contract

> Contrato visual e de interação para a Fase 8: Finalização Pagamentos.
> Esta fase é de **auditoria + completude** — não greenfield. O contrato distingue
> entre elementos a verificar (existentes) e elementos a criar (ausentes).
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

Escala de 8 pontos (múltiplos de 4) — já em uso no projeto via inline styles.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Gap entre ícone e label inline; dot de badge |
| sm | 8px | Gap entre botões adjacentes; padding de pill |
| md | 16px | Padding padrão de card; gap entre seções |
| lg | 24px | Padding lateral de tela (`padding: '0 20px'` ≈ 20px — aprovado) |
| xl | 32px | Padding vertical de tela de sucesso (centralizada) |
| 2xl | 48px | Não usado explicitamente nesta fase |
| 3xl | 64px | Não usado explicitamente nesta fase |

### Exceções aprovadas

Os valores abaixo fogem da escala canônica mas são mandatórios por fidelidade ao handoff ou por restrição de plataforma. Não são tokens da escala — não alterar nem normalizar.

- Padding lateral de tela: `20px` (não 24px) — já estabelecido em todas as telas do projeto, não alterar.
- Segmented control inner gap: `6px` — conforme handoff e existente em CombosScreen.
- Tab bar height: `56px` fixo — definido em ClientTabBar.
- Touch target mínimo: `44px` de minHeight em todos os botões interativos — obrigatório.
- QR code: `200×200px` — tamanho fixo de imagem.

---

## Typography

Quatro tamanhos exatos, dois pesos canônicos. Mapeados a tokens CSS existentes em `globals.css`.

| Role | Token CSS | Size | Family | Weight | Line Height | Usage |
|------|-----------|------|--------|--------|-------------|-------|
| Label/Caption | `--text-sm` | 12.5px | Hanken Grotesk | 600 | 1.4 | Rótulos de campo, subtítulos de card, `textSec`/`textTer` |
| Body | `--text-base` | 15px | Hanken Grotesk | 600 | 1.5 | Texto corrido, parágrafos explicativos, inputs |
| Heading | `--text-xl` | 21px | Bricolage Grotesque | 700 | 1.15 | Títulos de tela (AppBar title), nomes de combo |
| Display | `--text-3xl` | 32px | Bricolage Grotesque | 700 | 1.0 | Saldo em destaque no CreditBalanceCard (usa 52px — exceção aprovada) |

**Pesos canônicos:** 600 (body/label range) e 700 (heading/display range).

**Exceção aprovada — sistema de 4 pesos do handoff:**
CLAUDE.md declara "Fidelidade de Design: Alta fidelidade — cores, tipografia e espaçamentos definidos no handoff são mandatórios". O handoff (`brand.jsx`) estabelece 4 valores de peso distintos como requisito de sistema de design do projeto. Esta é uma decisão não-revisitável equivalente às exceções de espaçamento (20px lateral, 6px gap) e tamanho (52px, 56px). O executor deve usar os 4 pesos conforme o papel semântico de cada elemento:

| Peso | Uso semântico |
|------|--------------|
| 500 | Valor digitado em campos de input (Hanken Grotesk) |
| 600 | Labels de campo, texto secundário, sufixos, sublabel de lockup, dias abreviados no NextDays |
| 700 | Títulos de tela, CTAs, valores de row, nome da marca, tags uppercase, Heading e Display canônicos |
| 800 | Número do stepper avulso (56px), saldo display (52px), número de dia no NextDays (20px), quantidade no Stepper inline |

Nos elementos de produção, usar o peso do handoff para aquele elemento específico. A tabela canônica acima representa o intervalo mínimo do projeto; os pesos 500 e 800 são exceções com escopo restrito aos elementos listados.

**Exceções aprovadas de tamanho:**
- Saldo de créditos no CreditBalanceCard: `52px / weight 800 / letter-spacing -0.03em` — conforme handoff HomeA. Não reduzir.
- Quantidade no stepper avulso: `56px / weight 800 / letter-spacing -0.03em` — conforme handoff CombosScreen avulso.
- Preço de combo: `22px / weight 800` — aprovado como variante de heading.
- Pill / badge: `11.5px / weight 700` — abaixo do mínimo de label; aceito apenas em pills.
- LetterSpacing: `-0.02em` em todos os headings Bricolage Grotesque — obrigatório.

---

## Color

Todos os valores já declarados como variáveis CSS em `globals.css`. Usar **somente variáveis CSS** — nunca hex direto, exceto nos gradientes e cores literais herdadas do handoff (CreditBalanceCard, TodayDelivery).

| Role | CSS Var | Hex | Usage nesta fase |
|------|---------|-----|-----------------|
| Dominant (60%) | `--color-app-bg` | `#FAF5EC` | Background de tela, fundo de segmented control |
| Secondary (30%) | `--color-surface` | `#FFFFFF` | Cards de combo, área de CTA, CardPayment Brick |
| Surface Alt | `--color-surface-2` | `#F4EBDA` | Segmented control track, botão soft, skeleton loader |
| Accent (10%) | `--color-accent` | `#B0702A` | Ver lista abaixo |
| Gold | `--color-gold` | `#E3AC3F` | Botão CTA principal gold, ícone selecionado na tab bar, badge de notificação, borda do BannerInsuficiente |
| Espresso | `--color-espresso` | `#1E1207` | Background do CreditBalanceCard header, TodayDelivery header |
| Good | `--color-good` | `#3E7C53` | Ícone/texto de estado "Entregue", indicador "A caminho" |
| Good Soft | `--color-good-soft` | `#DCEBDF` | Background de pill "A caminho", background de ícone de sucesso |
| Gold Soft | `--color-gold-soft` | `#F3DDA6` | Background do BannerInsuficiente, background de pill dourada |
| Destructive | `--color-accent` | `#B0702A` | Erros de formulário/pagamento (mesmo token — warn = accent neste tema) |

**Accent (`#B0702A`) reservado exclusivamente para:**
- Borda de combo selecionado (2px solid)
- Borda de método de pagamento selecionado (1.5px solid)
- Botão "Tentar novamente" no estado de rejeição Pix
- Texto de link "Editar agenda" na HomeA
- Ícone do BannerInsuficiente (alert icon)
- Texto de label em campo de quantidade avulso quando dentro do limite
- Mensagens de erro (`setError`)

**Gold (`#E3AC3F`) reservado para:**
- Botão CTA primário em todas as telas de crédito ("Comprar créditos", "Copiar código")
- Ícone ativo na tab bar
- Texto "pães" ao lado do saldo display
- Badge de notificação não lida no sino
- Tag de combo "Mais popular" / "Melhor valor"
- Estado selecionado no PixWaitingScreen (spinner bordTopColor)

**Nunca usar `#E3AC3F` como cor de texto corrido.** Nunca usar `#B0702A` em backgrounds.

---

## Screens — Contrato por Tela

### CombosScreen (`/client/creditos`)

**Status:** existente (407 linhas) — **auditar e completar**

**Layout final esperado:**
```
StatusBar (44px) — gerenciado pela OS/PWA
AppBar: título "Comprar créditos" + botão back (38×38px, radius 12, bg surface-2)
Segmented control: "Combos" | "Compra personalizada" (height 44, radius 10/14, gap 6)
Scrollable area (flex: 1, padding 0 20px, paddingBottom 116)
Fixed CTA bar (above tab bar: bottom = 56px + env(safe-area-inset-bottom))
```

**Aba Combos — elementos a verificar:**
- [ ] `BannerInsuficiente` aparece quando `selectedCombo.quantity > creditBalance`
- [ ] Cada `ComboCard` tem borda `2px solid accent` quando selecionado; `1px solid border-2` quando não
- [ ] Tag de destaque (ex: "Mais popular") posicionada `top: -10, left: 18` em pill gold
- [ ] Preço riscado quando `antes` disponível: `font-size 12, textDecoration line-through, color textTer`
- [ ] Bloco de garantia ("Créditos não expiram") em `goodSoft` com icon "gift"
- [ ] Link "Quer no automático?" navega para `/client/auto-recompra`
- [ ] Resumo na CTA bar: qty + price/pão na esquerda, pill "Pix ou cartão" na direita

**Aba Compra Personalizada — elementos a verificar:**
- [ ] Stepper central com botões 48×48px, radius 16, ícones minus/plus size 22
- [ ] Quantidade em destaque: 56px, weight 800, `--color-accent`, letterSpacing -0.03em
- [ ] Tabela comparativo avulso vs combo (melhor combo em `goldSoft`)
- [ ] Aviso de limite (quando `qtd >= maxAvulso`): pill border `1.5px solid accent`, link para aba combos
- [ ] CTA bar: `{qty} créditos · R$ X,XX/pão` + total em Bricolage 24px

**CTA bar — método de pagamento (a completar / verificar):**
- Toggle Pix/Cartão: dois botões flex:1, height 36, radius `--radius-btn`
- Pix selecionado: border `1.5px solid accent`, bg surface, text accent
- Cartão selecionado: mesmas regras
- Botão principal: height 52, bg `--color-accent`, text `--color-primary-btn-text`, Bricolage 16px weight 700
- Label dinâmica: "Comprar {nomeCombo}" (combos) / "Comprar {N} pão/pães" (avulso)
- Estado loading: "Processando..." com `opacity: 0.7`

**Navegação:**
- Pix selecionado + tap CTA → `POST /payments/pix` → navegar para `/client/creditos/pix` com state `{paymentId, qrCodeBase64, qrCode, comboQuantity}`
- Cartão selecionado + tap CTA → navegar para `/client/creditos/cartao` com state `{comboId?, customQuantity?, amount}`
- Back → `/client/home`

---

### PixWaitingScreen (`/client/creditos/pix`)

**Status:** existente (262 linhas) — **auditar e completar**

**Layout final esperado:**
```
AppBar: título "Pix" + back para /client/creditos
QR Code: img 200×200px, borderRadius 12, centralizado
Bloco copia-e-cola: código em monospace size 12, bg surface-2, radius 10, padding 12
Botão "Copiar código": full width, minHeight 44
Área de status: spinner | timeout | rejected
```

**Estado Aguardando (padrão):**
- Spinner: 32×32px, border 3px, `borderTopColor: --color-gold`, border restante `--color-gold-soft`, radius 50%, animação spin 800ms linear
- Texto: "Aguardando pagamento..." em body 14px, `textSec`

**Estado Timeout (5 tentativas esgotadas):**
- Container: bg `goldSoft`, border `1.5px solid gold`, radius 16, padding 16
- Texto: "Não detectamos o pagamento ainda. Verifique o app do banco e tente novamente." — body 14px
- Botão "Verificar mais tarde": bg `gold`, color `espresso`, minHeight 44, alignSelf flex-start
- Navega para `/client/home`

**Estado Rejected (polling recebeu `rejected`):**
- Container: bg `surface-2`, border `1.5px solid border`, radius 16, padding 16
- Texto: "Pagamento não aprovado. Isso pode ter sido um erro temporário do banco. Tente novamente."
- Botão "Tentar novamente": bg `accent`, color `primaryBtnText`, minHeight 44
- Navega para `/client/creditos`

**Estado Aprovado:**
- Não permanece nesta tela — navigate imediato para `/client/creditos/sucesso` com `{quantity: comboQuantity}`
- `updateCreditBalance(novoSaldo)` chamado antes de navegar

**Botão copiar:**
- Default: bg `surface`, text `text`, border `1.5px solid border`
- Copiado (2s): bg `goodSoft`, text `good`, label "Copiado!"
- Transition all .15s

**Interações a verificar:**
- [ ] Guard: se `state.paymentId` ausente → redirect para `/client/creditos` (já implementado)
- [ ] `usePaymentPolling` chamado com `null` quando `isApproved || isRejected` (já implementado)
- [ ] QR code exibido como `data:image/png;base64,{qrCodeBase64}` (já implementado)
- [ ] `isTimeout` vem do hook — tela responde ao estado corretamente

---

### CardPaymentScreen (`/client/creditos/cartao`)

**Status:** existente (127 linhas) — **auditar e completar**

**Layout final esperado:**
```
AppBar: título "Pagamento com cartão" + back para /client/creditos (botão 44×44)
Subtítulo: "Pagamento processado com segurança pelo Mercado Pago" (12px, textTer)
Estado loading: texto "Carregando formulário de pagamento..." (14px, textSec)
Container do Brick: borderRadius 16, maxWidth 390
Mensagem de erro: 14px, cor accent (quando setError não null)
```

**Filosofia do Brick:** mínimo de chrome — deixar o MP Bricks renderizar o formulário.
Não adicionar bordas, backgrounds, sombras ou estilos ao container `#cardPaymentBrick_container`
além do que já está em `globals.css` (fix de touch/pointer-events para iframes).

**AppBar back button — elemento a completar:**
- Botão existente usa símbolo "←" puro — **substituir** por `<Icon name="arrowL" size={20}>` em container 38×38, radius 12, bg `surface-2`, conforme padrão `AppBar` do handoff.

**Estado de erro:**
- Mensagem inline: `fontSize 14, color: var(--color-accent)` — já implementado
- Mensagem genérica: "Algo deu errado. Verifique sua conexão e tente novamente."
- Erro de carregamento do Brick: "Erro ao carregar o formulário. Recarregue a página e tente novamente."

**Navegação pós-pagamento:**
- Sucesso → `/client/creditos/sucesso` com `{quantity: customQuantity ?? comboQty}`
- Back → `/client/creditos`

**Interações a verificar:**
- [ ] `onReady` seta `isLoading(false)` e oculta texto de loading
- [ ] `onError` chama `setError(...)` com mensagem legível
- [ ] `onSubmit` extrai `formData.token`, `formData.installments`, `formData.issuer_id`, `formData.payment_method_id`, `formData.payer`
- [ ] Fire-and-forget de `/users/me/card-token` não bloqueia fluxo nem exibe erro ao usuário

---

### PurchasedScreen (`/client/creditos/sucesso`)

**Status:** existente — **verificar conformidade com handoff**

**Layout final esperado:**
```
Tela centrada verticalmente (flex, justifyContent center)
Ícone de check: 96×96px, radius 30%, bg goodSoft, ícone check size 48, cor good, animação scaleIn 250ms
Heading: "Créditos na conta!" — Bricolage 26px, weight 700, letterSpacing -0.03em
Body: "+{N} pães adicionados. Agora é só deixar a agenda no jeito." — Hanken 15px, textSec
Botão primário: "Montar minha agenda" — bg accent, color primaryBtnText, height 52, icon calendar
Botão secundário: "Voltar ao início" — ghost (border borderColor, bg transparent), height 52
```

**Elementos a verificar:**
- [ ] `quantity` vem de `location.state.quantity` (já implementado)
- [ ] Animação `scaleIn` declarada via `<style>` tag inline (já implementado)
- [ ] Botão primário navega para `/client/agenda`
- [ ] Botão secundário navega para `/client/home`

---

### HomeScreen (`/client/home`) — Seção Carteira

**Status:** existente (412 linhas) — **auditar e completar 3 lacunas**

**Layout completo esperado (ordem vertical):**
```
1. Banner de corte (condicional, quando isCutoff = true)
2. Greeting + Bell icon
3. CreditBalanceCard (espresso gradient + botões "Comprar créditos" / "Extrato")
4. TodayDelivery card (3 estados)
5. [NOVO] BannerInsuficiente (quando creditBalance = 0)
6. QuickActions grid (4 ações)
7. NextDays — Próximas entregas (com dados reais ou placeholder)
```

**Lacuna 1 — BannerInsuficiente na HomeA (a criar):**
Inserir `<BannerInsuficiente>` entre o TodayDelivery e os QuickActions quando `creditBalance === 0`.

Props para HomeA:
```tsx
<BannerInsuficiente
  saldo={0}
  requerido={1}
  onComprar={() => navigate('/client/creditos')}
  onAjustar={() => {}} // sem efeito na Home — botão "Usar 0" oculto
/>
```

Comportamento: o botão "Usar {saldo}" não faz sentido no contexto Home (saldo = 0).
O componente existente já oculta automaticamente quando `requerido <= saldo` — no caso saldo=0/requerido=1 ele aparece. O botão "Usar 0" fica visível mas pode ser omitido com `style={{ display: 'none' }}` no contexto Home, ou o componente pode receber prop `hideAjustar?: boolean`. Implementação a critério do executor — resultado final deve mostrar apenas "Comprar mais".

**Lacuna 2 — TodayDelivery com 3 estados reais (auditar/completar):**

O HomeScreen já usa `useOrderTracking()` e renderiza o card com states. Verificar se os 3 estados estão completos e conformes ao handoff:

| Status API | Label badge | Ícone | Cor header card |
|-----------|-------------|-------|-----------------|
| `SCHEDULED` | "Agendado" | `calendar` | `espresso` |
| `OUT_FOR_DELIVERY` | "A caminho" (com dot verde) | `truck` | `espresso` |
| `DELIVERED` | "Entregue hoje" | `check` | `espresso` (opacity 0.85) |
| sem pedido | "Nenhuma entrega agendada" | — | `surface` |

**Card header quando há pedido (bg espresso):**
- Label superior: `11.5px, weight 700, color #E3AC3F, letterSpacing 0.06em, uppercase`
  - SCHEDULED → "AGENDADO"
  - OUT_FOR_DELIVERY → "SAINDO DO FORNO"
  - DELIVERED → "ENTREGUE"
- Texto principal: `Bricolage, weight 700, size 16, color #FAF5EC`
  - ex: "4 pãezinhos · Hoje" (SCHEDULED) / "4 pãezinhos" (outros)
- BreadMark watermark: `position absolute, top -40, right -20, opacity 0.13, size 140, color #E3AC3F`

**Pill de status (rodapé do card — a completar se ausente):**
- `OUT_FOR_DELIVERY`: bg `goodSoft`, color `good`, dot verde 6×6px
- `SCHEDULED`: bg `surface-2`, color `textSec`, sem dot
- `DELIVERED`: bg `surface-2`, color `textSec`, sem dot

**Lacuna 3 — NextDays com dados reais (a criar):**

O HomeScreen atual exibe placeholder "Configure sua agenda para ver as próximas entregas".
Deve exibir os próximos 5 dias do agendamento semanal do usuário.

**Layout do NextDays:**
```
Header row: "Próximas entregas" (Bricolage 16px, weight 700) + "Editar agenda" (accent, 13px, weight 700)
ScrollRow horizontal (gap 9, overflow-x auto, paddingBottom 4):
  Por dia: card 62×auto, radius 16, textAlign center, padding 12px 0
    - bg: surface (ativo) / transparent (folga)
    - border: 1.5px solid border-2 (ativo) / border (folga)
    - opacity: 1 (ativo) / 0.5 (folga)
    - Dia abreviado: 11.5px, textTer, weight 600 (ex: "Seg")
    - Número: Bricolage 20px, weight 800, text (ex: "23")
    - Pill gold (ativo): "{qty}🥖" — pill tone="gold", padding 2px 7px, fontSize 10
    - Texto "folga" (inativo): 10.5px, textTer
```

Fonte de dados: `GET /schedules/me` retorna o agendamento semanal do usuário.
Exibir próximos 5 dias a partir de amanhã.
Quando sem agendamento configurado: manter placeholder atual.

---

### BannerInsuficiente — Aparições obrigatórias (3 locais)

**Local 1 — CombosScreen (existente):**
- Posição: antes da lista de combos, dentro da scrollable area
- Condição: `selectedCombo.quantity > creditBalance` (aba combos) ou `customQty > creditBalance` (aba avulso)
- Props: `saldo={creditBalance}, requerido={requiredCredits}, onComprar={...}, onAjustar={...}`
- Verificar que aparece e desaparece ao alternar combos

**Local 2 — HomeScreen (a criar):**
- Posição: após TodayDelivery card, antes de QuickActions
- Condição: `creditBalance === 0`
- Props: ver especificação acima na seção HomeScreen
- Não aparece quando `creditBalance > 0` (mesmo saldo baixo — threshold = 0 para esta fase)

**Local 3 — Push notification (a criar no cron):**
- Não é componente React — é chamada OneSignal no `cron.ts` (backend)
- Condição: `saldo < consumo semanal do agendamento ativo` AND `autoRecharge = false`
- Horário: cron de meia-noite (já existe, adicionar verificação)
- Payload OneSignal:
  - `headings.pt-BR`: "Seus créditos estão acabando 🍞"
  - `contents.pt-BR`: "Você tem {N} crédito(s) e sua semana precisa de {M}. Recarregue agora antes que faltem pães!"
  - `additionalData.screen`: `"creditos"`
  - `url`: deep link para `/client/creditos`
- Deep link handler no frontend: `react-onesignal` `NotificationClickListener` já configurado — verificar que `additionalData.screen === 'creditos'` navega para `/client/creditos`

---

## Tab Bar — ClientTabBar

**Status:** existente e completo — apenas verificar navegação correta

| Tab | Ícone | Path | Ativo quando |
|-----|-------|------|-------------|
| Início | `home` | `/client/home` | `pathname.startsWith('/client/home')` |
| Agenda | `calendar` | `/client/agenda` | `pathname.startsWith('/client/agenda')` |
| Créditos | `coin` | `/client/creditos` | `pathname.startsWith('/client/creditos')` |
| Pedidos | `bag` | `/client/pedidos` | `pathname.startsWith('/client/pedidos')` |

**Estilo ativo:** ícone stroke 2.2, color `gold`; label fontSize 10.5, weight 700, color `accent`
**Estilo inativo:** ícone stroke 1.9, color `textTer`; label fontSize 10.5, weight 600, color `textTer`
**Tab bar height:** 56px fixo + `paddingBottom: env(safe-area-inset-bottom)`
**Verificar:** aba "Créditos" ativa quando usuário está em `/client/creditos`, `/client/creditos/pix`, `/client/creditos/cartao`, `/client/creditos/sucesso`.

---

## Component Inventory

Componentes reutilizáveis envolvidos nesta fase — não recriar, apenas usar/auditar.

| Componente | Path | Uso nesta fase | Status |
|------------|------|----------------|--------|
| `BannerInsuficiente` | `components/client/BannerInsuficiente.tsx` | CombosScreen + HomeScreen | Existente — reutilizar |
| `CreditBalanceCard` | `components/client/CreditBalanceCard.tsx` | HomeScreen | Existente — apenas verificar |
| `QuantityStepper` | `components/client/QuantityStepper.tsx` | CombosScreen avulso | Existente — apenas verificar |
| `ComboCard` | `components/client/ComboCard.tsx` | CombosScreen combos | Existente — apenas verificar |
| `ClientTabBar` | `components/client/ClientTabBar.tsx` | Layout wrapper | Existente — apenas verificar navegação |
| `Icon` | `components/brand/Icon.tsx` | Todas as telas | Existente — usar com `name`, `size`, `stroke`, `color` |
| `BreadMark` | `components/brand/BreadMark.tsx` | CreditBalanceCard, TodayDelivery (watermark) | Existente |

---

## Copywriting Contract

Idioma: português brasileiro, tom informal e conversacional, voz da marca Cheirin de Pão.

| Elemento | Copy |
|----------|------|
| CTA primário CombosScreen (combo) | "Comprar {nomeCombo}" (ex: "Comprar Combo Semanal") |
| CTA primário CombosScreen (avulso) | "Comprar {N} pão" / "Comprar {N} pães" (singular/plural) |
| CTA primário CreditBalanceCard | "Comprar créditos" |
| CTA secundário CreditBalanceCard | "Extrato" |
| CTA copia-e-cola Pix | "Copiar código" → "Copiado!" (2s) |
| CTA pós-timeout Pix | "Verificar mais tarde" |
| CTA pós-rejeição Pix | "Tentar novamente" |
| CTA PurchasedScreen primário | "Montar minha agenda" |
| CTA PurchasedScreen secundário | "Voltar ao início" |
| Heading PurchasedScreen | "Créditos na conta!" |
| Body PurchasedScreen | "+{N} pães adicionados. Agora é só deixar a agenda no jeito." |
| Empty state CombosScreen (sem combos) | "Nenhum combo disponível no momento." |
| Empty state NextDays (sem agenda) | "Configure sua agenda para ver as próximas entregas" |
| Empty state TodayDelivery | "Nenhuma entrega agendada" |
| Status label SCHEDULED | "AGENDADO" (uppercase, gold, no card espresso) + "Agendado" (pill neutral) |
| Status label OUT_FOR_DELIVERY | "SAINDO DO FORNO" (uppercase, gold) + "A caminho" (pill good, com dot) |
| Status label DELIVERED | "ENTREGUE" (uppercase, gold, card opacidade 0.85) + "Entregue hoje" (pill neutral) |
| Erro genérico de rede | "Algo deu errado. Verifique sua conexão e tente novamente." |
| Erro de API (combo/avulso) | usar `err.error` do backend; fallback: "Algo deu errado. Tente novamente." |
| Erro de loading do Brick | "Erro ao carregar o formulário. Recarregue a página e tente novamente." |
| Timeout Pix body | "Não detectamos o pagamento ainda. Verifique o app do banco e tente novamente." |
| Rejected Pix body | "Pagamento não aprovado. Isso pode ter sido um erro temporário do banco. Tente novamente." |
| BannerInsuficiente body | "Você tem {N} crédito(s) e precisa de {M}. Compre mais ou ajuste a quantidade." |
| Push — título | "Seus créditos estão acabando 🍞" |
| Push — body | "Você tem {N} crédito(s) e sua semana precisa de {M}. Recarregue agora antes que faltem pães!" |
| Label método Pix | "Pix" |
| Label método Cartão | "Cartão" |
| Label aguardando Pix | "Aguardando pagamento..." |
| Subtítulo CardPaymentScreen | "Pagamento processado com segurança pelo Mercado Pago" |
| Loading Brick | "Carregando formulário de pagamento..." |
| Texto garantia créditos | "Créditos não expiram. Pause quando viajar." |
| Texto reposição automática | "Quer no automático? **Ative a reposição** semanal ou quando acabar." |
| NextDays header | "Próximas entregas" |
| NextDays link | "Editar agenda" |
| Rótulo saldo label | "SEUS CRÉDITOS" (uppercase) |
| Texto ritmo saldo | "Rende ~{N} dias no seu ritmo atual" |
| Texto saldo zerado | "Adicione créditos para começar" |
| Greeting matinal | "Bom dia, {firstName}" |
| Greeting vespertino | "Boa tarde, {firstName}" |
| Greeting noturno | "Boa noite, {firstName}" |

---

## Interaction Contracts

### Polling Pix — `usePaymentPolling`

- Intervalo: 3 segundos
- Máximo de tentativas: 5
- Parar quando: `isApproved = true` OR `isRejected = true` OR `paymentId = null`
- `onApproved(creditBalance: number)`: atualiza AuthContext via `updateCreditBalance`, navega para sucesso
- `onRejected()`: seta `isRejected = true`
- Após 5 tentativas sem resposta: hook retorna `isTimeout = true`

### MP Bricks — CardPayment

- Container id: `cardPaymentBrick_container` (para o CSS fix de iframes em `globals.css`)
- `initialization.amount`: vem de `location.state.amount`
- Não adicionar nenhum estilo dentro do container além do fix existente
- `onReady`: ocultar texto "Carregando..."
- `onError`: `setError("Erro ao carregar o formulário. Recarregue a página e tente novamente.")`
- `onSubmit(formData)`: extrair token + metadata + payer, enviar para `POST /payments/card`

### AuthContext — updateCreditBalance

- Chamar `updateCreditBalance(novoSaldo)` após cada pagamento aprovado (Pix via polling, Cartão via `res.ok`)
- O saldo no `CreditBalanceCard` reflete o novo valor sem recarregar a página
- Fonte do `novoSaldo`: response do `GET /payments/:id/status` (polling Pix) ou response do `POST /payments/card`

### Deep Link OneSignal

- Listener em `react-onesignal`: `NotificationClickListener`
- Quando `additionalData.screen === 'creditos'` → `navigate('/client/creditos')`
- Sem action buttons (conforme Decisão D-11 do CONTEXT.md)

### Navegação Geral

```
/client/home
  ├── tap "Comprar créditos" → /client/creditos
  ├── tap "Extrato" → /client/creditos/extrato
  └── tap TodayDelivery card → /client/pedidos

/client/creditos
  ├── Pix selecionado → POST /payments/pix → /client/creditos/pix
  └── Cartão selecionado → /client/creditos/cartao

/client/creditos/pix
  ├── approved → /client/creditos/sucesso
  ├── timeout → botão → /client/home
  └── rejected → botão → /client/creditos

/client/creditos/cartao
  ├── res.ok → /client/creditos/sucesso
  └── back → /client/creditos

/client/creditos/sucesso
  ├── "Montar minha agenda" → /client/agenda
  └── "Voltar ao início" → /client/home
```

---

## Auditoria vs Criação — Mapa de Trabalho

| Elemento | Verbo | O que fazer |
|----------|-------|-------------|
| CombosScreen — estrutura base | verificar | Confirmar tabs, CTA bar, BannerInsuficiente, navegação |
| CombosScreen — avulso stepper | verificar | Confirmar visual 56px, limites min/max |
| CombosScreen — comparativo avulso/combo | verificar | Confirmar bloco goldSoft presente |
| CombosScreen — CTA bar | verificar | Confirmar toggle Pix/Cartão + label dinâmica |
| PixWaitingScreen — estados | verificar | Confirmar waiting/timeout/rejected/approved |
| PixWaitingScreen — copy rejected | completar | Atualizar mensagem para copy aprovado acima |
| PixWaitingScreen — AppBar back | verificar | Confirmar botão back usa `<Icon name="arrowL">` |
| CardPaymentScreen — AppBar back | completar | Substituir "←" puro por `<Icon name="arrowL">` em container 38×38 |
| CardPaymentScreen — Brick | verificar | Confirmar onReady/onError/onSubmit funcionais |
| PurchasedScreen | verificar | Confirmar animação + copy + navegação |
| HomeScreen — BannerInsuficiente | criar | Inserir componente quando `creditBalance === 0` |
| HomeScreen — TodayDelivery | verificar | Confirmar 3 estados + pill de status + BreadMark watermark |
| HomeScreen — NextDays | completar | Conectar a dados reais de `GET /schedules/me`; placeholder OK se não configurado |
| ClientTabBar — navegação | verificar | Confirmar activeState correto em todas as 4 abas |
| Push notification | criar | Adicionar verificação no cron de meia-noite + chamada OneSignal |
| OneSignal deep link handler | verificar/criar | Confirmar que `screen: 'creditos'` navega para `/client/creditos` |
| AuthContext updateCreditBalance | verificar | Confirmar chamada pós-Pix e pós-Cartão aprovados |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | nenhum — projeto não usa shadcn | não aplicável |
| @mercadopago/sdk-react | `CardPayment` Brick | Dependência npm — não é registry shadcn. Já instalada. Não requer vetting de registry. |

Nenhuma dependência de terceiros nova é introduzida nesta fase.
Todas as libs em uso (`@mercadopago/sdk-react`, `react-onesignal`, `react-router`) foram introduzidas em fases anteriores.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
